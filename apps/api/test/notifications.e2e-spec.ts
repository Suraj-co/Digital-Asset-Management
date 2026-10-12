import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { hashPassword } from '../src/auth/password.js';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/configure-app.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

describe('Notification API (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const stamp = Date.now();
  const password = 'correct-horse-battery';
  const creatorEmail = `note-sapl-${stamp}@example.com`;
  const mateEmail = `note-mate-${stamp}@example.com`;
  const baplEmail = `note-bapl-${stamp}@example.com`;
  const adminEmail = `note-admin-${stamp}@example.com`;
  const workerEmail = `note-worker-${stamp}@example.com`;
  const secret = `note-bytes-${stamp}`;
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
    const mate = await prisma.user.create({ data: { email: mateEmail, passwordHash } });
    const bapl = await prisma.user.create({ data: { email: baplEmail, passwordHash } });
    const admin = await prisma.user.create({ data: { email: adminEmail, passwordHash } });
    const worker = await prisma.user.create({ data: { email: workerEmail, passwordHash } });
    await prisma.membership.createMany({
      data: [
        { userId: creator.id, companyId: saplId, role: 'creator' },
        { userId: mate.id, companyId: saplId, role: 'rm' },
        { userId: bapl.id, companyId: baplId, role: 'creator' },
        { userId: admin.id, companyId: saplId, role: 'admin' },
        { userId: worker.id, companyId: saplId, role: 'creator' },
      ],
    });
    const department = await prisma.department.create({
      data: { companyId: saplId, name: `Note${stamp}` },
    });
    const folder = await prisma.folderCatalog.create({
      data: {
        companyId: saplId,
        departmentId: department.id,
        year: 2026,
        campaign: `Nt${stamp}`,
        stage: 'working',
        assetType: 'posters',
        path: `AARADHYA_DAM/SAPL/Note${stamp}/2026/Nt${stamp}/01_Working/Posters`,
      },
    });
    folderId = folder.id;
  });

  afterAll(async () => {
    const emails = [creatorEmail, mateEmail, baplEmail, adminEmail, workerEmail];
    await prisma.auditEvent.deleteMany({
      where: { actor: { email: { in: emails } } },
    });
    await prisma.notification.deleteMany({
      where: { user: { email: { in: emails } } },
    });
    await prisma.timeEntry.deleteMany({
      where: {
        OR: [{ user: { email: { in: emails } } }, { reviewedBy: { email: { in: emails } } }],
      },
    });
    await prisma.task.deleteMany({
      where: { createdBy: { email: { in: emails } } },
    });
    await prisma.asset.deleteMany({
      where: { createdBy: { email: { in: emails } } },
    });
    await prisma.folderCatalog.deleteMany({ where: { campaign: `Nt${stamp}` } });
    await prisma.department.deleteMany({ where: { name: `Note${stamp}` } });
    await prisma.user.deleteMany({ where: { email: { in: emails } } });
    await app.close();
  });

  async function signIn(email: string) {
    const agent = request.agent(app.getHttpServer());
    await agent.post('/api/v1/session').send({ email, password }).expect(201);
    return agent;
  }

  it('writes an in-app notice for an assignment, a returned time entry, and a rejection', async () => {
    const creator = await signIn(creatorEmail);
    const mate = await signIn(mateEmail);
    const bapl = await signIn(baplEmail);

    await creator
      .post('/api/v1/tasks')
      .send({ companyId: saplId, title: 'Own crop', assigneeEmail: creatorEmail })
      .expect(201);
    const own = await creator.get('/api/v1/notifications').expect(200);
    expect(own.body.items).toEqual([]);
    expect(own.body.unread).toBe(0);
    expect(own.body).not.toHaveProperty('emailSent');

    const assigned = await creator
      .post('/api/v1/tasks')
      .send({ companyId: saplId, title: 'Crop the poster', assigneeEmail: mateEmail })
      .expect(201);
    const mateList = await mate.get('/api/v1/notifications').expect(200);
    expect(mateList.body.unread).toBe(1);
    expect(mateList.body.total).toBe(1);
    expect(mateList.body.items[0]).toMatchObject({
      companyCode: 'SAPL',
      kind: 'task_assigned',
      body: `${creatorEmail} assigned "Crop the poster". Description: None Deadline: Not set Priority: Not set`,
      href: '/tasks',
      readAt: null,
    });
    const creatorCopy = await prisma.emailDelivery.findFirst({
      where: { toAddress: mateEmail, body: { contains: 'Crop the poster' } },
    });
    expect(creatorCopy?.body).toContain(`${creatorEmail} assigned "Crop the poster".`);
    expect(creatorCopy?.body).not.toContain('Jai has assigned');
    expect(JSON.stringify(mateList.body)).not.toContain('emailSent');
    expect(JSON.stringify(mateList.body)).not.toContain(secret);
    const creatorList = await creator.get('/api/v1/notifications').expect(200);
    expect(creatorList.body.items).toEqual([]);
    const baplList = await bapl.get('/api/v1/notifications').expect(200);
    expect(baplList.body.items).toEqual([]);

    await creator
      .patch(`/api/v1/tasks/${assigned.body.id}`)
      .send({ assigneeEmail: mateEmail })
      .expect(200);
    const same = await mate.get('/api/v1/notifications').expect(200);
    expect(same.body.total).toBe(1);

    const noticeId = mateList.body.items[0].id as string;
    const read = await mate.post(`/api/v1/notifications/${noticeId}/read`).expect(200);
    expect(read.body.readAt).toEqual(expect.any(String));
    const again = await mate.post(`/api/v1/notifications/${noticeId}/read`).expect(200);
    expect(again.body.readAt).toBe(read.body.readAt);
    const afterRead = await mate.get('/api/v1/notifications').expect(200);
    expect(afterRead.body.unread).toBe(0);
    const stolen = await creator.post(`/api/v1/notifications/${noticeId}/read`).expect(404);
    expect(stolen.body.message).toBe('No notification has that id.');
    const missing = await creator
      .post('/api/v1/notifications/4b4c0099-0000-4000-8000-000000000099/read')
      .expect(404);
    expect(missing.body.message).toBe('No notification has that id.');

    const today = new Date().toISOString().slice(0, 10);
    const entry = await creator
      .post('/api/v1/time-entries')
      .send({ companyId: saplId, workDate: today, minutes: 40 })
      .expect(201);
    await creator
      .post(`/api/v1/time-entries/${entry.body.id}/review`)
      .send({ action: 'submit' })
      .expect(200);
    await mate
      .post(`/api/v1/time-entries/${entry.body.id}/review`)
      .send({ action: 'return', reason: 'Split the crop.' })
      .expect(200);
    const returned = await creator.get('/api/v1/notifications').expect(200);
    expect(returned.body.unread).toBe(1);
    expect(returned.body.items[0]).toMatchObject({
      kind: 'time_returned',
      body: `${mateEmail} returned 40 minutes: Split the crop.`,
      href: '/time',
      readAt: null,
    });

    const accepted = await creator
      .post('/api/v1/time-entries')
      .send({ companyId: saplId, workDate: today, minutes: 15 })
      .expect(201);
    await creator
      .post(`/api/v1/time-entries/${accepted.body.id}/review`)
      .send({ action: 'submit' })
      .expect(200);
    await mate
      .post(`/api/v1/time-entries/${accepted.body.id}/review`)
      .send({ action: 'accept' })
      .expect(200);
    const afterAccept = await creator.get('/api/v1/notifications').expect(200);
    expect(afterAccept.body.total).toBe(1);

    const asset = await creator
      .post('/api/v1/assets')
      .field('title', 'Harbor poster')
      .field('folderId', folderId)
      .attach('file', Buffer.from(secret), 'harbor.png')
      .expect(201);
    await creator
      .post(`/api/v1/assets/${asset.body.id}/transitions`)
      .send({ action: 'submit' })
      .expect(200);
    await mate
      .post(`/api/v1/assets/${asset.body.id}/transitions`)
      .send({ action: 'reject', reason: 'Crop the logo.' })
      .expect(200);
    const rejected = await creator.get('/api/v1/notifications').expect(200);
    expect(rejected.body.unread).toBe(2);
    expect(rejected.body.items[0]).toMatchObject({
      companyCode: 'SAPL',
      kind: 'asset_rejected',
      body: `${mateEmail} rejected "Harbor poster": Crop the logo.`,
      href: `/assets/${asset.body.id}`,
      readAt: null,
    });
    expect(JSON.stringify(rejected.body)).not.toContain('emailSent');
    expect(JSON.stringify(rejected.body)).not.toContain(secret);
  });

  it('emails task details when an RM or an admin assigns the task', async () => {
    const admin = await signIn(adminEmail);
    const rm = await signIn(mateEmail);
    await admin
      .post('/api/v1/tasks')
      .send({
        companyId: saplId,
        title: 'Ship the banner',
        detail: 'Use the harbor crop.',
        deadline: '2026-10-20',
        priority: 'high',
        assigneeEmail: workerEmail,
      })
      .expect(201);
    const adminCopy = await prisma.emailDelivery.findFirst({
      where: { toAddress: workerEmail, body: { contains: 'Ship the banner' } },
    });
    expect(['pending', 'held', 'queued', 'sent', 'failed']).toContain(adminCopy?.status);
    expect(adminCopy?.body).toContain('Aman has assigned you a new task.');
    expect(adminCopy?.body).toContain('Title: Ship the banner');
    expect(adminCopy?.body).toContain('Description: Use the harbor crop.');
    expect(adminCopy?.body).toContain('Deadline: 2026-10-20');
    expect(adminCopy?.body).toContain('Priority: High');
    expect(adminCopy?.body).toContain('View the task: http://127.0.0.1:43123/tasks');
    const worker = await signIn(workerEmail);
    const inApp = await worker.get('/api/v1/notifications').expect(200);
    expect(inApp.body.items[0].body).toBe(
      `${adminEmail} assigned "Ship the banner". Description: Use the harbor crop. Deadline: 2026-10-20 Priority: high`,
    );

    await rm
      .post('/api/v1/tasks')
      .send({
        companyId: saplId,
        title: 'Review the crop',
        assigneeEmail: workerEmail,
      })
      .expect(201);
    const rmCopy = await prisma.emailDelivery.findFirst({
      where: { toAddress: workerEmail, body: { contains: 'Review the crop' } },
    });
    expect(rmCopy?.body).toContain('Jai has assigned you a new task.');
    expect(rmCopy?.body).toContain('Description: None');
    expect(rmCopy?.body).toContain('Deadline: Not set');
    expect(rmCopy?.body).toContain('Priority: Not set');
  });
});
