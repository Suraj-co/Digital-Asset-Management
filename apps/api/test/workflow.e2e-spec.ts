import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { hashPassword } from '../src/auth/password.js';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/configure-app.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

describe('Approval workflow API (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const stamp = Date.now();
  const password = 'correct-horse-battery';
  const creatorEmail = `workflow-creator-${stamp}@example.com`;
  const rmEmail = `workflow-rm-${stamp}@example.com`;
  const adminEmail = `workflow-admin-${stamp}@example.com`;
  const baplEmail = `workflow-bapl-${stamp}@example.com`;
  const secret = `workflow-bytes-${stamp}`;
  let saplId = '';
  let folderId = '';

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    const passwordHash = await hashPassword(password);
    const companies = await prisma.company.findMany();
    saplId = companies.find((company) => company.code === 'SAPL')?.id ?? '';
    const baplId = companies.find((company) => company.code === 'BAPL')?.id ?? '';
    const creator = await prisma.user.create({ data: { email: creatorEmail, passwordHash } });
    const rm = await prisma.user.create({ data: { email: rmEmail, passwordHash } });
    const admin = await prisma.user.create({ data: { email: adminEmail, passwordHash } });
    const bapl = await prisma.user.create({ data: { email: baplEmail, passwordHash } });
    await prisma.membership.createMany({
      data: [
        { userId: creator.id, companyId: saplId, role: 'creator' },
        { userId: rm.id, companyId: saplId, role: 'rm' },
        { userId: admin.id, companyId: saplId, role: 'admin' },
        { userId: bapl.id, companyId: baplId, role: 'creator' },
      ],
    });
    const department = await prisma.department.create({
      data: { companyId: saplId, name: `Review${stamp}` },
    });
    const folder = await prisma.folderCatalog.create({
      data: {
        companyId: saplId,
        departmentId: department.id,
        year: 2026,
        campaign: `Rv${stamp}`,
        stage: 'working',
        assetType: 'posters',
        path: `AARADHYA_DAM/SAPL/Review${stamp}/2026/Rv${stamp}/01_Working/Posters`,
      },
    });
    folderId = folder.id;
  });

  afterAll(async () => {
    const emails = [creatorEmail, rmEmail, adminEmail, baplEmail];
    await prisma.auditEvent.deleteMany({
      where: { actor: { email: { in: emails } } },
    });
    await prisma.notification.deleteMany({
      where: { user: { email: { in: emails } } },
    });
    await prisma.asset.deleteMany({
      where: {
        createdBy: { email: { in: [creatorEmail, rmEmail, adminEmail, baplEmail] } },
      },
    });
    await prisma.folderCatalog.deleteMany({ where: { campaign: `Rv${stamp}` } });
    await prisma.department.deleteMany({ where: { name: `Review${stamp}` } });
    await prisma.user.deleteMany({
      where: { email: { in: emails } },
    });
    await app.close();
  });

  async function signIn(email: string) {
    const agent = request.agent(app.getHttpServer());
    await agent.post('/api/v1/session').send({ email, password }).expect(201);
    return agent;
  }

  function decide(
    agent: ReturnType<typeof request.agent>,
    assetId: string,
    action: string,
    reason?: string,
  ) {
    return agent
      .post(`/api/v1/assets/${assetId}/transitions`)
      .send(reason === undefined ? { action } : { action, reason });
  }

  it('records each review stage and does not publish a file', async () => {
    const creator = await signIn(creatorEmail);
    const rm = await signIn(rmEmail);
    const admin = await signIn(adminEmail);
    const bapl = await signIn(baplEmail);

    const created = await creator
      .post('/api/v1/assets')
      .field('title', 'Review poster')
      .field('folderId', folderId)
      .attach('file', Buffer.from(secret), 'review.png')
      .expect(201);
    const assetId = created.body.id as string;
    expect(created.body.workflowStage).toBe('draft');
    expect(created.body.publication).toBe('not_started');
    expect(created.body.actions).toEqual(['submit']);
    expect(created.body.decisions).toEqual([]);
    expect(
      created.body.driveFileId === null ||
        (typeof created.body.driveFileId === 'string' && created.body.driveFileId.length > 0),
    ).toBe(true);
    expect(JSON.stringify(created.body)).not.toContain(secret);

    const early = await decide(creator, assetId, 'approve').expect(409);
    expect(early.body.message).toBe('This asset is not waiting for that decision.');
    const reasoned = await decide(creator, assetId, 'submit', 'Too soon.').expect(400);
    expect(reasoned.body.message).toBe('A reason is only recorded for a rejection.');

    const submitted = await decide(creator, assetId, 'submit').expect(200);
    expect(submitted.body.workflowStage).toBe('scope_analysis');
    expect(submitted.body.actions).toEqual([]);
    expect(submitted.body.decisions).toEqual([
      expect.objectContaining({
        action: 'submit',
        versionLabel: 'v001',
        fromStage: 'draft',
        toStage: 'scope_analysis',
        reason: null,
        actorEmail: creatorEmail,
      }),
    ]);

    const creatorApprove = await decide(creator, assetId, 'approve').expect(403);
    expect(creatorApprove.body.message).toBe('You cannot decide this stage.');
    const blockedVersion = await creator
      .post(`/api/v1/assets/${assetId}/versions`)
      .attach('file', Buffer.from('x'), 'during-review.png')
      .expect(409);
    expect(blockedVersion.body.message).toBe(
      'This asset is in review. Record another version after it is rejected.',
    );
    const blockedRetry = await creator
      .post(`/api/v1/assets/${assetId}/content`)
      .attach('file', Buffer.from('x'), 'retry.png')
      .expect(409);
    expect(blockedRetry.body.message).toBe(
      'Send a new version after a rejection. Retry is only available on a draft.',
    );

    const scope = await decide(rm, assetId, 'approve').expect(200);
    expect(scope.body.workflowStage).toBe('rm_qc');
    const qc = await decide(rm, assetId, 'approve').expect(200);
    expect(qc.body.workflowStage).toBe('rm_approval');
    const rmApproval = await decide(rm, assetId, 'approve').expect(200);
    expect(rmApproval.body.workflowStage).toBe('admin_qc');
    const rmOverreach = await decide(rm, assetId, 'approve').expect(403);
    expect(rmOverreach.body.message).toBe('You cannot decide this stage.');
    const missingReason = await decide(admin, assetId, 'reject').expect(400);
    expect(missingReason.body.message).toBe('Enter a reason for the rejection.');

    const rejected = await decide(admin, assetId, 'reject', 'Crop the logo.').expect(200);
    expect(rejected.body.workflowStage).toBe('changes_requested');
    expect(rejected.body.publication).toBe('not_started');
    expect(rejected.body.decisions.at(-1)).toMatchObject({
      action: 'reject',
      reason: 'Crop the logo.',
      toStage: 'changes_requested',
      versionLabel: 'v001',
    });

    const rmVersion = await rm
      .post(`/api/v1/assets/${assetId}/versions`)
      .attach('file', Buffer.from('x'), 'rm-version.png')
      .expect(403);
    expect(rmVersion.body.message).toBe('You cannot decide this stage.');

    const revised = await creator
      .post(`/api/v1/assets/${assetId}/versions`)
      .attach('file', Buffer.from(`${secret}-v2`), 'review-v2.png')
      .expect(201);
    expect(revised.body.workflowStage).toBe('scope_analysis');
    expect(revised.body.publication).toBe('not_started');
    expect(revised.body.versions.map((item: { label: string }) => item.label)).toEqual([
      'v001',
      'v002',
    ]);
    expect(revised.body.decisions.at(-1)).toMatchObject({
      action: 'resubmit',
      versionLabel: 'v002',
      fromStage: 'changes_requested',
      toStage: 'scope_analysis',
    });
    expect(JSON.stringify(revised.body)).not.toContain(secret);

    await decide(rm, assetId, 'approve').expect(200);
    await decide(rm, assetId, 'approve').expect(200);
    await decide(rm, assetId, 'approve').expect(200);
    const adminQc = await decide(admin, assetId, 'approve').expect(200);
    expect(adminQc.body.workflowStage).toBe('admin_approval');
    expect(adminQc.body.publication).toBe('not_started');

    const approved = await decide(admin, assetId, 'approve').expect(200);
    expect(approved.body.workflowStage).toBe('admin_approval');
    expect(approved.body.publication).toBe('ready');
    expect(
      approved.body.driveFileId === null ||
        (typeof approved.body.driveFileId === 'string' && approved.body.driveFileId.length > 0),
    ).toBe(true);
    expect(approved.body.decisions.at(-1).detail).toBe('Ready to publish.');
    expect(approved.body.decisions.at(-1).versionLabel).toBe('v002');
    expect(approved.body.actions).toEqual(['reject']);

    const again = await decide(admin, assetId, 'approve').expect(409);
    expect(again.body.message).toBe('This asset is ready to publish.');

    const creatorNotice = await creator.get('/api/v1/notifications').expect(200);
    expect(
      creatorNotice.body.items.some(
        (item: { body: string }) => item.body.includes('ready to publish'),
      ),
    ).toBe(true);
    const rmNotice = await rm.get('/api/v1/notifications').expect(200);
    expect(
      rmNotice.body.items.some((item: { body: string }) => item.body.includes('ready to publish')),
    ).toBe(false);

    const denied = await decide(bapl, assetId, 'approve').expect(403);
    expect(denied.body.message).toBe('You do not have access to this company.');

    const stored = await prisma.workflowDecision.findMany({ where: { assetId } });
    expect(stored.some((row) => row.action === 'approve' && row.detail === 'Ready to publish.')).toBe(
      true,
    );
    expect(JSON.stringify(stored)).not.toContain(secret);
    expect(stored[0]).not.toHaveProperty('driveFileId');
  });
});
