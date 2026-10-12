import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { hashPassword } from '../src/auth/password.js';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/configure-app.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

describe('Time entry API (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const stamp = Date.now();
  const password = 'correct-horse-battery';
  const creatorEmail = `time-sapl-${stamp}@example.com`;
  const rmEmail = `time-rm-${stamp}@example.com`;
  const baplEmail = `time-bapl-${stamp}@example.com`;
  let saplId = '';
  let baplId = '';

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
    baplId = companies.find((company) => company.code === 'BAPL')?.id ?? '';
    const creator = await prisma.user.create({ data: { email: creatorEmail, passwordHash } });
    const rm = await prisma.user.create({ data: { email: rmEmail, passwordHash } });
    const bapl = await prisma.user.create({ data: { email: baplEmail, passwordHash } });
    await prisma.membership.createMany({
      data: [
        { userId: creator.id, companyId: saplId, role: 'creator' },
        { userId: rm.id, companyId: saplId, role: 'rm' },
        { userId: rm.id, companyId: baplId, role: 'creator' },
        { userId: bapl.id, companyId: baplId, role: 'creator' },
      ],
    });
  });

  afterAll(async () => {
    const emails = [creatorEmail, rmEmail, baplEmail];
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
    await prisma.user.deleteMany({ where: { email: { in: emails } } });
    await app.close();
  });

  async function signIn(email: string) {
    const agent = request.agent(app.getHttpServer());
    await agent.post('/api/v1/session').send({ email, password }).expect(201);
    return agent;
  }

  it('records the minutes that were entered and reviews them without a payroll total', async () => {
    const creator = await signIn(creatorEmail);
    const rm = await signIn(rmEmail);
    const bapl = await signIn(baplEmail);
    const today = new Date().toISOString().slice(0, 10);
    const saplTask = await creator
      .post('/api/v1/tasks')
      .send({ companyId: saplId, title: 'Crop the poster' })
      .expect(201);
    const baplTask = await bapl
      .post('/api/v1/tasks')
      .send({ companyId: baplId, title: 'BAPL only' })
      .expect(201);

    const created = await creator
      .post('/api/v1/time-entries')
      .send({ companyId: saplId, workDate: today, minutes: 90, taskId: saplTask.body.id, note: 'Harbor crop' })
      .expect(201);
    expect(created.body).toMatchObject({
      companyCode: 'SAPL',
      userEmail: creatorEmail,
      taskId: saplTask.body.id,
      taskTitle: 'Crop the poster',
      workDate: today,
      minutes: 90,
      note: 'Harbor crop',
      status: 'open',
      reviewReason: null,
      actions: ['submit'],
    });
    expect(created.body).not.toHaveProperty('total');
    expect(created.body).not.toHaveProperty('payroll');
    expect(JSON.stringify(created.body)).not.toMatch(/file bytes|driveFileId/i);

    const listed = await creator.get(`/api/v1/time-entries?companyId=${saplId}`).expect(200);
    expect(listed.body.items.map((item: { id: string }) => item.id)).toContain(created.body.id);
    expect(listed.body).not.toHaveProperty('payroll');

    const hidden = await bapl.get(`/api/v1/time-entries?companyId=${saplId}`).expect(403);
    expect(hidden.body.message).toBe('You do not have access to this company.');

    const denied = await creator
      .post(`/api/v1/time-entries/${created.body.id}/review`)
      .send({ action: 'accept' })
      .expect(403);
    expect(denied.body.message).toBe('You cannot review time.');

    const submitted = await creator
      .post(`/api/v1/time-entries/${created.body.id}/review`)
      .send({ action: 'submit' })
      .expect(200);
    expect(submitted.body.status).toBe('submitted');
    expect(submitted.body.actions).toEqual([]);

    const accepted = await rm
      .post(`/api/v1/time-entries/${created.body.id}/review`)
      .send({ action: 'accept' })
      .expect(200);
    expect(accepted.body.status).toBe('accepted');
    expect(accepted.body.reviewReason).toBeNull();

    const second = await creator
      .post('/api/v1/time-entries')
      .send({ companyId: saplId, workDate: today, minutes: 30 })
      .expect(201);
    await creator
      .post(`/api/v1/time-entries/${second.body.id}/review`)
      .send({ action: 'submit' })
      .expect(200);
    const missingReason = await rm
      .post(`/api/v1/time-entries/${second.body.id}/review`)
      .send({ action: 'return' })
      .expect(400);
    expect(missingReason.body.message).toBe('Enter a reason for the return.');
    const returned = await rm
      .post(`/api/v1/time-entries/${second.body.id}/review`)
      .send({ action: 'return', reason: 'Split the crop.' })
      .expect(200);
    expect(returned.body.status).toBe('returned');
    expect(returned.body.reviewReason).toBe('Split the crop.');
    expect(returned.body.actions).toEqual([]);

    const corrected = await creator
      .patch(`/api/v1/time-entries/${second.body.id}`)
      .send({ minutes: 45 })
      .expect(200);
    expect(corrected.body.minutes).toBe(45);
    expect(corrected.body.status).toBe('returned');
    const resubmitted = await creator
      .post(`/api/v1/time-entries/${second.body.id}/review`)
      .send({ action: 'submit' })
      .expect(200);
    expect(resubmitted.body.status).toBe('submitted');
    expect(resubmitted.body.minutes).toBe(45);

    const otherCompany = await bapl
      .post('/api/v1/time-entries')
      .send({ companyId: baplId, workDate: today, minutes: 15, taskId: saplTask.body.id })
      .expect(403);
    expect(otherCompany.body.message).toBe('You do not have access to this company.');
    const samePerson = await rm
      .post('/api/v1/time-entries')
      .send({ companyId: saplId, workDate: today, minutes: 15, taskId: baplTask.body.id })
      .expect(409);
    expect(samePerson.body.message).toBe('That task is not in this company.');

    await creator
      .post('/api/v1/time-entries')
      .send({ companyId: saplId, workDate: today, minutes: 0 })
      .expect(400);
    const future = await creator
      .post('/api/v1/time-entries')
      .send({ companyId: saplId, workDate: '2099-01-01', minutes: 10 })
      .expect(400);
    expect(future.body.message).toBe('Use a work date that is not in the future.');

    const rmEntry = await rm
      .post('/api/v1/time-entries')
      .send({ companyId: saplId, workDate: today, minutes: 20 })
      .expect(201);
    const creatorList = await creator.get(`/api/v1/time-entries?companyId=${saplId}`).expect(200);
    const creatorIds = creatorList.body.items.map((item: { id: string }) => item.id);
    expect(creatorIds).toContain(created.body.id);
    expect(creatorIds).not.toContain(rmEntry.body.id);
    const unread = await creator.get(`/api/v1/time-entries/${rmEntry.body.id}`).expect(403);
    expect(unread.body.message).toBe('You cannot read another person\'s time.');
    const rmList = await rm.get(`/api/v1/time-entries?companyId=${saplId}`).expect(200);
    const rmIds = rmList.body.items.map((item: { id: string }) => item.id);
    expect(rmIds).toContain(created.body.id);
    expect(rmIds).toContain(rmEntry.body.id);

    const stored = await prisma.timeEntry.findUniqueOrThrow({ where: { id: created.body.id as string } });
    expect(stored.minutes).toBe(90);
    expect(stored.status).toBe('accepted');
  });
});