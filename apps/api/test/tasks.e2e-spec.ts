import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { hashPassword } from '../src/auth/password.js';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/configure-app.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

describe('Task plan API (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const stamp = Date.now();
  const password = 'correct-horse-battery';
  const saplEmail = `task-sapl-${stamp}@example.com`;
  const mateEmail = `task-mate-${stamp}@example.com`;
  const peerEmail = `task-peer-${stamp}@example.com`;
  const otherRmEmail = `task-rm2-${stamp}@example.com`;
  const baplEmail = `task-bapl-${stamp}@example.com`;
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
    const sapl = await prisma.user.create({ data: { email: saplEmail, passwordHash } });
    const mate = await prisma.user.create({ data: { email: mateEmail, passwordHash } });
    const peer = await prisma.user.create({ data: { email: peerEmail, passwordHash } });
    const otherRm = await prisma.user.create({ data: { email: otherRmEmail, passwordHash } });
    const bapl = await prisma.user.create({ data: { email: baplEmail, passwordHash } });
    await prisma.membership.createMany({
      data: [
        { userId: sapl.id, companyId: saplId, role: 'creator' },
        { userId: mate.id, companyId: saplId, role: 'rm' },
        { userId: peer.id, companyId: saplId, role: 'creator' },
        { userId: otherRm.id, companyId: saplId, role: 'rm' },
        { userId: bapl.id, companyId: baplId, role: 'creator' },
      ],
    });
    const department = await prisma.department.create({
      data: { companyId: saplId, name: `Plan${stamp}` },
    });
    const folder = await prisma.folderCatalog.create({
      data: {
        companyId: saplId,
        departmentId: department.id,
        year: 2026,
        campaign: `Tk${stamp}`,
        stage: 'working',
        assetType: 'posters',
        path: `AARADHYA_DAM/SAPL/Plan${stamp}/2026/Tk${stamp}/01_Working/Posters`,
      },
    });
    folderId = folder.id;
  });

  afterAll(async () => {
    const emails = [saplEmail, mateEmail, peerEmail, otherRmEmail, baplEmail];
    await prisma.auditEvent.deleteMany({
      where: { actor: { email: { in: emails } } },
    });
    await prisma.notification.deleteMany({
      where: { user: { email: { in: emails } } },
    });
    await prisma.task.deleteMany({
      where: { createdBy: { email: { in: emails } } },
    });
    await prisma.asset.deleteMany({
      where: { createdBy: { email: { in: emails } } },
    });
    await prisma.folderCatalog.deleteMany({ where: { campaign: `Tk${stamp}` } });
    await prisma.department.deleteMany({ where: { name: `Plan${stamp}` } });
    await prisma.user.deleteMany({ where: { email: { in: emails } } });
    await app.close();
  });

  async function signIn(email: string) {
    const agent = request.agent(app.getHttpServer());
    await agent.post('/api/v1/session').send({ email, password }).expect(201);
    return agent;
  }

  it('plans a task inside the caller’s company and does not record time', async () => {
    const sapl = await signIn(saplEmail);
    const asset = await sapl
      .post('/api/v1/assets')
      .field('title', 'Task poster')
      .field('folderId', folderId)
      .attach('file', Buffer.from(`task-bytes-${stamp}`), 'task-poster.png')
      .expect(201);

    const created = await sapl
      .post('/api/v1/tasks')
      .send({
        companyId: saplId,
        title: 'Crop the poster',
        detail: 'Keep the harbor.',
        assetId: asset.body.id,
        assigneeEmail: mateEmail,
      })
      .expect(201);
    expect(created.body).toMatchObject({
      companyCode: 'SAPL',
      title: 'Crop the poster',
      detail: 'Keep the harbor.',
      status: 'open',
      stage: 'assigned',
      assetId: asset.body.id,
      assetCode: asset.body.code,
      assigneeEmail: mateEmail,
      createdByEmail: saplEmail,
    });
    expect(created.body).not.toHaveProperty('minutes');
    expect(JSON.stringify(created.body)).not.toContain(`task-bytes-${stamp}`);

    const mate = await signIn(mateEmail);
    const assignedView = await mate.get(`/api/v1/tasks/${created.body.id}`).expect(200);
    expect(assignedView.body.assigneeEmail).toBe(mateEmail);
    const peer = await signIn(peerEmail);
    await peer.get(`/api/v1/tasks/${created.body.id}`).expect(404);
    await peer.get(`/api/v1/assets/${asset.body.id}`).expect(404);
    const peerTasks = await peer.get(`/api/v1/tasks?companyId=${saplId}`).expect(200);
    expect(peerTasks.body.items).toEqual([]);
    const peerNotes = await peer.get('/api/v1/notifications').expect(200);
    expect(peerNotes.body.items).toEqual([]);
    await peer
      .post(`/api/v1/assets/${asset.body.id}/transitions`)
      .send({ action: 'approve' })
      .expect(404);
    const otherRm = await signIn(otherRmEmail);
    await otherRm.get(`/api/v1/tasks/${created.body.id}`).expect(404);
    await otherRm.get(`/api/v1/assets/${asset.body.id}`).expect(404);
    const otherRmTasks = await otherRm.get(`/api/v1/tasks?companyId=${saplId}`).expect(200);
    expect(otherRmTasks.body.items.map((item: { id: string }) => item.id)).not.toContain(
      created.body.id,
    );
    const otherCreator = await signIn(baplEmail);
    await otherCreator.get(`/api/v1/tasks/${created.body.id}`).expect(403);

    const listed = await sapl.get(`/api/v1/tasks?companyId=${saplId}`).expect(200);
    expect(listed.body.items.map((item: { id: string }) => item.id)).toContain(created.body.id);

    const skipped = await sapl
      .patch(`/api/v1/tasks/${created.body.id}`)
      .send({ status: 'done' })
      .expect(400);
    expect(skipped.body.message).toBe('Use a task transition.');

    const cleared = await sapl
      .patch(`/api/v1/tasks/${created.body.id}`)
      .send({ assigneeEmail: null, assetId: null })
      .expect(200);
    expect(cleared.body.stage).toBe('draft');
    expect(cleared.body.assigneeEmail).toBeNull();
    expect(cleared.body.assetId).toBeNull();
    await mate.get(`/api/v1/tasks/${created.body.id}`).expect(404);

    const outsider = await sapl
      .post('/api/v1/tasks')
      .send({ companyId: saplId, title: 'Wrong person', assigneeEmail: baplEmail })
      .expect(403);
    expect(outsider.body.message).toBe('You do not have access to this user.');

    const missing = await sapl
      .post('/api/v1/tasks')
      .send({ companyId: saplId, title: 'Nobody', assigneeEmail: `missing-${stamp}@example.com` })
      .expect(404);
    expect(missing.body.message).toBe('No user has that email.');

    const rejected = await sapl
      .post('/api/v1/tasks')
      .send({ companyId: saplId, title: 'Nope', driveFileId: 'fake' })
      .expect(400);
    expect(rejected.body.message).toContain('driveFileId');

    const hidden = await otherCreator.get(`/api/v1/tasks?companyId=${saplId}`).expect(403);
    expect(hidden.body.message).toBe('You do not have access to this company.');
    const denied = await otherCreator
      .patch(`/api/v1/tasks/${created.body.id}`)
      .send({ status: 'done' })
      .expect(403);
    expect(denied.body.message).toBe('You do not have access to this company.');

    const stored = await prisma.task.findUniqueOrThrow({
      where: { id: created.body.id as string },
      include: { assignments: true, links: true },
    });
    expect(stored.status).toBe('open');
    expect(stored.assignments).toEqual([]);
    expect(stored.links).toEqual([]);
    expect(stored).not.toHaveProperty('minutes');
  });
});
