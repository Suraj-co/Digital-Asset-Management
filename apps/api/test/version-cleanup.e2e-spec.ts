import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { hashPassword } from '../src/auth/password.js';
import { AppModule } from '../src/app.module.js';
import { DriveCleanupService } from '../src/assets/drive-cleanup.service.js';
import { configureApp } from '../src/configure-app.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { GoogleWorkspaceService } from '../src/storage/google-workspace.js';

describe('Version lifecycle and Drive cleanup (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let google: GoogleWorkspaceService;
  let cleanup: DriveCleanupService;
  const stamp = Date.now();
  const password = 'correct-horse-battery';
  const creatorEmail = `cleanup-creator-${stamp}@example.com`;
  const rmEmail = `cleanup-rm-${stamp}@example.com`;
  const adminEmail = `cleanup-admin-${stamp}@example.com`;
  let folderId = '';

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    google = app.get(GoogleWorkspaceService);
    cleanup = app.get(DriveCleanupService);
    const passwordHash = await hashPassword(password);
    const saplId = (await prisma.company.findFirstOrThrow({ where: { code: 'SAPL' } })).id;
    const creator = await prisma.user.create({ data: { email: creatorEmail, passwordHash } });
    const rm = await prisma.user.create({ data: { email: rmEmail, passwordHash } });
    const admin = await prisma.user.create({ data: { email: adminEmail, passwordHash } });
    await prisma.membership.createMany({
      data: [
        { userId: creator.id, companyId: saplId, role: 'creator' },
        { userId: rm.id, companyId: saplId, role: 'rm' },
        { userId: admin.id, companyId: saplId, role: 'admin' },
      ],
    });
    const department = await prisma.department.create({
      data: { companyId: saplId, name: `Clean${stamp}` },
    });
    const folder = await prisma.folderCatalog.create({
      data: {
        companyId: saplId,
        departmentId: department.id,
        year: 2026,
        campaign: `Cl${stamp}`,
        stage: 'working',
        assetType: 'posters',
        path: `AARADHYA_DAM/SAPL/Clean${stamp}/2026/Cl${stamp}/01_Working/Posters`,
      },
    });
    folderId = folder.id;
  });

  afterAll(async () => {
    const emails = [creatorEmail, rmEmail, adminEmail];
    await prisma.auditEvent.deleteMany({ where: { actor: { email: { in: emails } } } });
    await prisma.notification.deleteMany({ where: { user: { email: { in: emails } } } });
    await prisma.asset.updateMany({
      where: { createdBy: { email: { in: emails } } },
      data: { approvedVersionId: null },
    });
    await prisma.asset.deleteMany({ where: { createdBy: { email: { in: emails } } } });
    await prisma.folderCatalog.deleteMany({ where: { campaign: `Cl${stamp}` } });
    await prisma.department.deleteMany({ where: { name: `Clean${stamp}` } });
    await prisma.user.deleteMany({ where: { email: { in: emails } } });
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

  function upload(agent: ReturnType<typeof request.agent>, name: string, bytes: string, key?: string) {
    const call = agent.post('/api/v1/assets').field('title', name).field('folderId', folderId);
    if (key) {
      call.set('Idempotency-Key', key);
    }
    return call.attach('file', Buffer.from(bytes), name);
  }

  async function approveAll(
    creator: ReturnType<typeof request.agent>,
    rm: ReturnType<typeof request.agent>,
    admin: ReturnType<typeof request.agent>,
    assetId: string,
  ) {
    const current = await creator.get(`/api/v1/assets/${assetId}`).expect(200);
    if (current.body.workflowStage === 'draft') {
      await decide(creator, assetId, 'submit').expect(200);
    }
    await decide(rm, assetId, 'approve').expect(200);
    await decide(rm, assetId, 'approve').expect(200);
    await decide(rm, assetId, 'approve').expect(200);
    await decide(admin, assetId, 'approve').expect(200);
    const ready = await decide(admin, assetId, 'approve').expect(200);
    expect(ready.body.publication).toBe('ready');
  }

  async function settle(assetId: string) {
    let jobs = await prisma.driveCleanup.findMany({ where: { version: { assetId } } });
    for (let attempt = 0; attempt < 8; attempt += 1) {
      await cleanup.runOnce();
      jobs = await prisma.driveCleanup.findMany({ where: { version: { assetId } } });
      if (jobs.length > 0 && jobs.every((job) => job.status === 'deleted' || job.status === 'failed' || job.status === 'kept')) {
        return jobs;
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    return jobs;
  }

  async function versionsOf(assetId: string) {
    return prisma.assetVersion.findMany({
      where: { assetId },
      orderBy: { number: 'asc' },
    });
  }

  it('keeps the approved file until a later stored version is fully approved', async () => {
    const creator = await signIn(creatorEmail);
    const rm = await signIn(rmEmail);
    const admin = await signIn(adminEmail);
    const created = await upload(creator, 'life-v1.png', `v1-${stamp}`).expect(201);
    const assetId = created.body.id as string;
    await approveAll(creator, rm, admin, assetId);
    const approved = await prisma.asset.findUniqueOrThrow({ where: { id: assetId } });
    const afterV1 = await versionsOf(assetId);
    expect(approved.approvedVersionId).toBe(afterV1[0]?.id);
    expect(approved.publication).toBe('ready');
    const queuedEarly = await prisma.driveCleanup.count({ where: { version: { assetId } } });
    expect(queuedEarly).toBe(0);
    expect(google.driveReady()).toBe(true);
    expect(afterV1[0]?.driveFileId).toEqual(expect.any(String));
    expect(await google.filePresence(afterV1[0]!.driveFileId!)).toBe('active');

    const pending = await creator
      .post(`/api/v1/assets/${assetId}/versions`)
      .attach('file', Buffer.from(`v2-${stamp}`), 'life-v2.png')
      .expect(201);
    expect(pending.body.workflowStage).toBe('draft');
    expect(pending.body.publication).toBe('not_started');
    const duringReview = await prisma.asset.findUniqueOrThrow({ where: { id: assetId } });
    expect(duringReview.approvedVersionId).toBe(afterV1[0]?.id);
    expect(await prisma.driveCleanup.count({ where: { status: 'deleted', version: { assetId } } })).toBe(0);

    await decide(creator, assetId, 'submit').expect(200);
    await decide(rm, assetId, 'approve').expect(200);
    await decide(rm, assetId, 'approve').expect(200);
    await decide(rm, assetId, 'approve').expect(200);
    const rejected = await decide(admin, assetId, 'reject', 'Keep the first cut.').expect(200);
    expect(rejected.body.workflowStage).toBe('changes_requested');
    const afterReject = await prisma.asset.findUniqueOrThrow({ where: { id: assetId } });
    expect(afterReject.approvedVersionId).toBe(afterV1[0]?.id);
    expect(await prisma.workflowDecision.count({ where: { assetId, action: 'reject' } })).toBeGreaterThan(0);
    expect(await prisma.driveCleanup.count({ where: { status: 'deleted', version: { assetId } } })).toBe(0);
    expect(await google.filePresence(afterV1[0]!.driveFileId!)).toBe('active');

    await creator
      .post(`/api/v1/assets/${assetId}/versions`)
      .attach('file', Buffer.from(`v3-${stamp}`), 'life-v3.png')
      .expect(201);
    await approveAll(creator, rm, admin, assetId);
    const replacement = await versionsOf(assetId);
    const active = await prisma.asset.findUniqueOrThrow({ where: { id: assetId } });
    expect(replacement).toHaveLength(3);
    expect(active.approvedVersionId).toBe(replacement[2]?.id);
    expect(await prisma.workflowDecision.count({ where: { assetId } })).toBeGreaterThan(0);
    expect(google.driveReady()).toBe(true);
    expect(replacement[2]?.driveFileId).toEqual(expect.any(String));
    const activeFileId = replacement[2]!.driveFileId!;
    const jobs = await settle(assetId);
    expect(jobs).toHaveLength(2);
    expect(jobs.every((job) => job.status === 'deleted')).toBe(true);
    expect(await google.filePresence(activeFileId)).toBe('active');
    for (const job of jobs) {
      expect(['trashed', 'missing']).toContain(await google.filePresence(job.driveFileId));
    }
    const stored = await versionsOf(assetId);
    expect(stored[2]?.driveFileId).toBe(activeFileId);
    expect(stored[0]?.driveFileId).toBeNull();
    expect(stored[1]?.driveFileId).toBeNull();
  });

  it('deletes a rejected first version after the next version is fully approved', async () => {
    const creator = await signIn(creatorEmail);
    const rm = await signIn(rmEmail);
    const admin = await signIn(adminEmail);
    const created = await upload(creator, 'rm-v1.png', `rmv1-${stamp}`).expect(201);
    const assetId = created.body.id as string;
    await decide(creator, assetId, 'submit').expect(200);
    await decide(rm, assetId, 'reject', 'Start again.').expect(200);
    const first = await versionsOf(assetId);
    await creator
      .post(`/api/v1/assets/${assetId}/versions`)
      .attach('file', Buffer.from(`rmv2-${stamp}`), 'rm-v2.png')
      .expect(201);
    await approveAll(creator, rm, admin, assetId);
    const rows = await versionsOf(assetId);
    const asset = await prisma.asset.findUniqueOrThrow({ where: { id: assetId } });
    expect(asset.approvedVersionId).toBe(rows[1]?.id);
    expect(await prisma.workflowDecision.count({ where: { versionId: first[0]?.id } })).toBeGreaterThan(0);
    expect(google.driveReady()).toBe(true);
    expect(rows[1]?.driveFileId).toEqual(expect.any(String));
    expect(first[0]?.driveFileId).toEqual(expect.any(String));
    const jobs = await settle(assetId);
    const job = jobs.find((item) => item.versionId === first[0]?.id);
    expect(job?.status).toBe('deleted');
    expect(await google.filePresence(rows[1]!.driveFileId!)).toBe('active');
    expect(['trashed', 'missing']).toContain(await google.filePresence(job!.driveFileId));
  });

  it('keeps an admin-rejected version until its replacement is fully approved', async () => {
    const creator = await signIn(creatorEmail);
    const rm = await signIn(rmEmail);
    const admin = await signIn(adminEmail);
    const created = await upload(creator, 'admin-v1.png', `adminv1-${stamp}`).expect(201);
    const assetId = created.body.id as string;
    await decide(creator, assetId, 'submit').expect(200);
    await decide(rm, assetId, 'approve').expect(200);
    await decide(rm, assetId, 'approve').expect(200);
    await decide(rm, assetId, 'approve').expect(200);
    await decide(admin, assetId, 'reject', 'Use the revised crop.').expect(200);
    const first = await versionsOf(assetId);
    const held = await prisma.asset.findUniqueOrThrow({ where: { id: assetId } });
    expect(held.approvedVersionId).toBeNull();
    expect(await prisma.driveCleanup.count({ where: { status: 'deleted', version: { assetId } } })).toBe(0);
    expect(google.driveReady()).toBe(true);
    expect(first[0]?.driveFileId).toEqual(expect.any(String));
    expect(await google.filePresence(first[0]!.driveFileId!)).toBe('active');
    await creator
      .post(`/api/v1/assets/${assetId}/versions`)
      .attach('file', Buffer.from(`adminv2-${stamp}`), 'admin-v2.png')
      .expect(201);
    await approveAll(creator, rm, admin, assetId);
    const rows = await versionsOf(assetId);
    const asset = await prisma.asset.findUniqueOrThrow({ where: { id: assetId } });
    expect(asset.approvedVersionId).toBe(rows[1]?.id);
    expect(await prisma.workflowDecision.count({ where: { versionId: first[0]?.id, action: 'reject' } })).toBe(1);
    expect(google.driveReady()).toBe(true);
    expect(rows[1]?.driveFileId).toEqual(expect.any(String));
    expect(first[0]?.driveFileId).toEqual(expect.any(String));
    const jobs = await settle(assetId);
    const job = jobs.find((item) => item.versionId === first[0]?.id);
    expect(job?.status).toBe('deleted');
    expect(await google.filePresence(rows[1]!.driveFileId!)).toBe('active');
    expect(['trashed', 'missing']).toContain(await google.filePresence(job!.driveFileId));
  });

  it('keeps one version and one Drive file when the same upload is retried', async () => {
    const creator = await signIn(creatorEmail);
    const key = `retry-${stamp}`;
    const first = await upload(creator, 'retry.png', `retry-${stamp}`, key).expect(201);
    const second = await upload(creator, 'retry.png', `retry-${stamp}`, key).expect(201);
    expect(second.body.id).toBe(first.body.id);
    expect(second.body.driveFileId).toBe(first.body.driveFileId);
    const count = await prisma.assetVersion.count({ where: { assetId: first.body.id as string } });
    expect(count).toBe(1);
    expect(google.driveReady()).toBe(true);
    expect(first.body.driveFileId).toEqual(expect.any(String));
    expect(await google.filePresence(first.body.driveFileId as string)).toBe('active');
  });

  it('leaves the file pointer in place when Drive deletion is not confirmed', async () => {
    const creator = await signIn(creatorEmail);
    const rm = await signIn(rmEmail);
    const admin = await signIn(adminEmail);
    const created = await upload(creator, 'fail.png', `fail-${stamp}`).expect(201);
    const assetId = created.body.id as string;
    await approveAll(creator, rm, admin, assetId);
    const approved = await versionsOf(assetId);
    const bogus = await prisma.assetVersion.create({
      data: {
        assetId,
        number: 9,
        fileName: 'missing.png',
        contentType: 'image/png',
        byteSize: 1,
        state: 'upload_failed',
        failureClass: 'not_configured',
        driveFileId: `missing-${stamp}`,
        detail: 'Not stored.',
        createdById: approved[0]!.createdById,
      },
    });
    await prisma.driveCleanup.create({
      data: { versionId: bogus.id, driveFileId: bogus.driveFileId! },
    });
    await cleanup.runOnce();
    const job = await prisma.driveCleanup.findUniqueOrThrow({ where: { versionId: bogus.id } });
    expect(job.status).not.toBe('deleted');
    expect(job.status).toBe('failed');
    const still = await prisma.assetVersion.findUniqueOrThrow({ where: { id: bogus.id } });
    expect(still.driveFileId).toBe(`missing-${stamp}`);
    const active = await prisma.asset.findUniqueOrThrow({ where: { id: assetId } });
    expect(active.approvedVersionId).toBe(approved[0]?.id);
  });
});
