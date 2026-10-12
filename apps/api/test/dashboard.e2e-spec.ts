import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { hashPassword } from '../src/auth/password.js';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/configure-app.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

describe('Dashboard counts API (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const stamp = Date.now();
  const password = 'correct-horse-battery';
  const creatorEmail = `dash-sapl-${stamp}@example.com`;
  const rmEmail = `dash-rm-${stamp}@example.com`;
  const baplEmail = `dash-bapl-${stamp}@example.com`;
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
    const bapl = await prisma.user.create({ data: { email: baplEmail, passwordHash } });
    await prisma.membership.createMany({
      data: [
        { userId: creator.id, companyId: saplId, role: 'creator' },
        { userId: rm.id, companyId: saplId, role: 'rm' },
        { userId: bapl.id, companyId: baplId, role: 'creator' },
      ],
    });
    const department = await prisma.department.create({
      data: { companyId: saplId, name: `Dash${stamp}` },
    });
    const folder = await prisma.folderCatalog.create({
      data: {
        companyId: saplId,
        departmentId: department.id,
        year: 2026,
        campaign: `Ds${stamp}`,
        stage: 'working',
        assetType: 'posters',
        path: `AARADHYA_DAM/SAPL/Dash${stamp}/2026/Ds${stamp}/01_Working/Posters`,
      },
    });
    folderId = folder.id;
  });

  afterAll(async () => {
    const emails = [creatorEmail, rmEmail, baplEmail];
    await prisma.auditEvent.deleteMany({
      where: { actor: { email: { in: emails } } },
    });
    await prisma.timeEntry.deleteMany({
      where: { user: { email: { in: emails } } },
    });
    await prisma.task.deleteMany({
      where: { createdBy: { email: { in: emails } } },
    });
    await prisma.asset.deleteMany({
      where: { createdBy: { email: { in: emails } } },
    });
    await prisma.folderCatalog.deleteMany({ where: { campaign: `Ds${stamp}` } });
    await prisma.department.deleteMany({ where: { name: `Dash${stamp}` } });
    await prisma.user.deleteMany({ where: { email: { in: emails } } });
    await app.close();
  });

  async function signIn(email: string) {
    const agent = request.agent(app.getHttpServer());
    await agent.post('/api/v1/session').send({ email, password }).expect(201);
    return agent;
  }

  it('counts the caller’s own rows and a reviewer’s company rows without a payroll total', async () => {
    const creator = await signIn(creatorEmail);
    const rm = await signIn(rmEmail);
    const bapl = await signIn(baplEmail);
    const today = new Date().toISOString().slice(0, 10);
    const before = await rm.get(`/api/v1/dashboard?companyId=${saplId}`).expect(200);

    await creator
      .post('/api/v1/assets')
      .field('title', 'Creator poster')
      .field('folderId', folderId)
      .attach('file', Buffer.from(`dash-bytes-${stamp}`), 'creator-poster.png')
      .expect(201);
    await rm
      .post('/api/v1/assets')
      .field('title', 'RM poster')
      .field('folderId', folderId)
      .attach('file', Buffer.from(`dash-rm-bytes-${stamp}`), 'rm-poster.png')
      .expect(201);
    await creator.post('/api/v1/tasks').send({ companyId: saplId, title: 'Creator plan' }).expect(201);
    await rm.post('/api/v1/tasks').send({ companyId: saplId, title: 'RM plan' }).expect(201);
    await creator
      .post('/api/v1/time-entries')
      .send({ companyId: saplId, workDate: today, minutes: 90 })
      .expect(201);
    await rm
      .post('/api/v1/time-entries')
      .send({ companyId: saplId, workDate: today, minutes: 20 })
      .expect(201);

    const own = await creator.get(`/api/v1/dashboard?companyId=${saplId}`).expect(200);
    expect(own.body).toMatchObject({
      companyCode: 'SAPL',
      scope: 'own',
      assets: {
        total: 1,
        uploadFailed: 1,
        publicationNotStarted: 1,
        publicationNotRun: 0,
        byStage: { draft: 1, admin_approval: 0 },
      },
      tasks: { open: 1, done: 0 },
      time: { open: 1, submitted: 0, accepted: 0, returned: 0, minutes: 90 },
      payroll: {
        acceptedMinutes: 0,
        hourlyRateMinor: null,
        currency: 'INR',
        amountMinor: null,
      },
    });
    expect(own.body.payroll.detail).toContain('No hourly rate');
    expect(own.body).not.toHaveProperty('filesStored');
    expect(own.body).not.toHaveProperty('driveFileId');
    expect(JSON.stringify(own.body)).not.toContain(`dash-bytes-${stamp}`);

    const company = await rm.get(`/api/v1/dashboard?companyId=${saplId}`).expect(200);
    expect(company.body.scope).toBe('review');
    expect(company.body.assets.total).toBe(before.body.assets.total + 1);
    expect(company.body.assets.uploadFailed).toBe(before.body.assets.uploadFailed + 1);
    expect(company.body.tasks.open).toBe(before.body.tasks.open + 1);
    expect(company.body.time.open).toBe(before.body.time.open + 1);
    expect(company.body.time.minutes).toBe(before.body.time.minutes + 20);

    const hidden = await bapl.get(`/api/v1/dashboard?companyId=${saplId}`).expect(403);
    expect(hidden.body.message).toBe('You do not have access to this company.');

    const missing = await creator.get('/api/v1/dashboard').expect(400);
    expect(JSON.stringify(missing.body.message)).toContain('companyId');
  });
});