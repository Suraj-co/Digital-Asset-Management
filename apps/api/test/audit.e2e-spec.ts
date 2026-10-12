import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { hashPassword } from '../src/auth/password.js';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/configure-app.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

describe('Audit log API (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const stamp = Date.now();
  const password = 'correct-horse-battery';
  const adminEmail = `audit-admin-${stamp}@example.com`;
  const creatorEmail = `audit-creator-${stamp}@example.com`;
  const rmEmail = `audit-rm-${stamp}@example.com`;
  const baplEmail = `audit-bapl-${stamp}@example.com`;
  const secret = `audit-bytes-${stamp}`;
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
    const admin = await prisma.user.create({ data: { email: adminEmail, passwordHash } });
    const creator = await prisma.user.create({ data: { email: creatorEmail, passwordHash } });
    const rm = await prisma.user.create({ data: { email: rmEmail, passwordHash } });
    const bapl = await prisma.user.create({ data: { email: baplEmail, passwordHash } });
    await prisma.membership.createMany({
      data: [
        { userId: admin.id, companyId: saplId, role: 'admin' },
        { userId: creator.id, companyId: saplId, role: 'creator' },
        { userId: rm.id, companyId: saplId, role: 'rm' },
        { userId: bapl.id, companyId: baplId, role: 'admin' },
      ],
    });
    const department = await prisma.department.create({
      data: { companyId: saplId, name: `Audit${stamp}` },
    });
    const folder = await prisma.folderCatalog.create({
      data: {
        companyId: saplId,
        departmentId: department.id,
        year: 2026,
        campaign: `Au${stamp}`,
        stage: 'working',
        assetType: 'posters',
        path: `AARADHYA_DAM/SAPL/Audit${stamp}/2026/Au${stamp}/01_Working/Posters`,
      },
    });
    folderId = folder.id;
  });

  afterAll(async () => {
    const emails = [adminEmail, creatorEmail, rmEmail, baplEmail];
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
    await prisma.folderCatalog.deleteMany({ where: { campaign: `Au${stamp}` } });
    await prisma.department.deleteMany({ where: { name: `Audit${stamp}` } });
    await prisma.user.deleteMany({ where: { email: { in: emails } } });
    await app.close();
  });

  async function signIn(email: string) {
    const agent = request.agent(app.getHttpServer());
    await agent.post('/api/v1/session').send({ email, password }).expect(201);
    return agent;
  }

  it('records completed company changes and lets only an admin read them', async () => {
    const admin = await signIn(adminEmail);
    const creator = await signIn(creatorEmail);
    const rm = await signIn(rmEmail);
    const bapl = await signIn(baplEmail);

    await admin.get('/api/v1/audit-events').expect(400);
    const denied = await creator.get(`/api/v1/audit-events?companyId=${saplId}`).expect(403);
    expect(denied.body.message).toBe('You do not have access to manage this company.');
    const other = await bapl.get(`/api/v1/audit-events?companyId=${saplId}`).expect(403);
    expect(other.body.message).toBe('You do not have access to manage this company.');
    await admin.post('/api/v1/audit-events').send({ summary: 'Invented.' }).expect(404);

    const task = await creator
      .post('/api/v1/tasks')
      .send({ companyId: saplId, title: 'Label the poster' })
      .expect(201);
    const listed = await admin.get(`/api/v1/audit-events?companyId=${saplId}`).expect(200);
    expect(listed.body.total).toBe(1);
    expect(listed.body.items[0]).toMatchObject({
      companyCode: 'SAPL',
      actorEmail: creatorEmail,
      action: 'task_planned',
      summary: `${creatorEmail} planned "Label the poster".`,
      subjectType: 'task',
      subjectId: task.body.id,
    });
    expect(listed.body.items[0]).not.toHaveProperty('updatedAt');
    expect(JSON.stringify(listed.body)).not.toContain('driveFileId');
    expect(JSON.stringify(listed.body)).not.toContain(secret);
    const createdAt = listed.body.items[0].createdAt as string;

    const asset = await creator
      .post('/api/v1/assets')
      .field('title', 'Harbor poster')
      .field('folderId', folderId)
      .attach('file', Buffer.from(secret), 'harbor.png')
      .expect(201);
    await creator
      .patch(`/api/v1/assets/${asset.body.id}`)
      .send({ title: 'Harbor crop' })
      .expect(200);
    await creator
      .post(`/api/v1/assets/${asset.body.id}/transitions`)
      .send({ action: 'submit' })
      .expect(200);
    await rm
      .post(`/api/v1/assets/${asset.body.id}/transitions`)
      .send({ action: 'reject', reason: 'Crop the logo.' })
      .expect(200);

    const today = new Date().toISOString().slice(0, 10);
    const entry = await creator
      .post('/api/v1/time-entries')
      .send({ companyId: saplId, workDate: today, minutes: 40 })
      .expect(201);
    await creator
      .post(`/api/v1/time-entries/${entry.body.id}/review`)
      .send({ action: 'submit' })
      .expect(200);
    await rm
      .post(`/api/v1/time-entries/${entry.body.id}/review`)
      .send({ action: 'return', reason: 'Split the crop.' })
      .expect(200);

    const granted = await admin
      .post(`/api/v1/companies/${saplId}/memberships`)
      .send({ email: baplEmail, role: 'creator' })
      .expect(201);

    const after = await admin.get(`/api/v1/audit-events?companyId=${saplId}`).expect(200);
    const summaries = after.body.items.map((item: { summary: string }) => item.summary);
    expect(summaries[0]).toBe(`${adminEmail} granted creator to ${baplEmail}.`);
    expect(summaries).toContain(`${creatorEmail} planned "Label the poster".`);
    expect(summaries).toContain(
      `${creatorEmail} recorded "Harbor poster" as ${asset.body.code}. The file was not stored.`,
    );
    expect(summaries).toContain(
      `${creatorEmail} changed the title of ${asset.body.code} to "Harbor crop". The file is still not stored.`,
    );
    expect(summaries).toContain(
      `${rmEmail} rejected ${asset.body.code}: Crop the logo. The file is not stored.`,
    );
    expect(summaries).toContain(`${rmEmail} returned 40 minutes: Split the crop.`);
    expect(JSON.stringify(after.body)).not.toContain(secret);
    expect(JSON.stringify(after.body)).not.toContain('driveFileId');
    const planned = after.body.items.find(
      (item: { subjectId: string }) => item.subjectId === task.body.id,
    );
    expect(planned.createdAt).toBe(createdAt);
    expect(after.body.items[0].subjectId).toBe(granted.body.id);

    const again = await admin.get(`/api/v1/audit-events?companyId=${saplId}`).expect(200);
    expect(again.body.items.find((item: { id: string }) => item.id === planned.id).createdAt).toBe(
      createdAt,
    );
  });
});
