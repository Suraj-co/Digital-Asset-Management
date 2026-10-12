import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { hashPassword } from '../src/auth/password.js';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/configure-app.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

describe('Task workspace API (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const stamp = Date.now();
  const password = 'correct-horse-battery';
  const creatorEmail = `flow-creator-${stamp}@example.com`;
  const rmEmail = `flow-rm-${stamp}@example.com`;
  const adminEmail = `flow-admin-${stamp}@example.com`;
  const otherEmail = `flow-other-${stamp}@example.com`;
  let companyId = '';

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    const passwordHash = await hashPassword(password);
    companyId = (await prisma.company.findFirstOrThrow({ where: { code: 'SAPL' } })).id;
    const [creator, rm, admin, other] = await Promise.all([
      prisma.user.create({ data: { email: creatorEmail, passwordHash } }),
      prisma.user.create({ data: { email: rmEmail, passwordHash } }),
      prisma.user.create({ data: { email: adminEmail, passwordHash } }),
      prisma.user.create({ data: { email: otherEmail, passwordHash } }),
    ]);
    await prisma.membership.createMany({
      data: [
        { userId: creator.id, companyId, role: 'creator' },
        { userId: rm.id, companyId, role: 'rm' },
        { userId: admin.id, companyId, role: 'admin' },
        { userId: other.id, companyId, role: 'creator' },
      ],
    });
  });

  afterAll(async () => {
    const emails = [creatorEmail, rmEmail, adminEmail, otherEmail];
    await prisma.auditEvent.deleteMany({ where: { actor: { email: { in: emails } } } });
    await prisma.notification.deleteMany({ where: { user: { email: { in: emails } } } });
    await prisma.task.deleteMany({ where: { createdBy: { email: { in: emails } } } });
    await prisma.user.deleteMany({ where: { email: { in: emails } } });
    await app.close();
  });

  async function signIn(email: string) {
    const agent = request.agent(app.getHttpServer());
    await agent.post('/api/v1/session').send({ email, password }).expect(201);
    return agent;
  }

  function move(agent: Awaited<ReturnType<typeof signIn>>, taskId: string, action: string, reason?: string) {
    return agent
      .post(`/api/v1/tasks/${taskId}/transitions`)
      .send(reason === undefined ? { action } : { action, reason });
  }

  it('keeps one task visible to its creator, RM, and admin through every stage', async () => {
    const creator = await signIn(creatorEmail);
    const rm = await signIn(rmEmail);
    const admin = await signIn(adminEmail);
    const other = await signIn(otherEmail);

    const created = await rm
      .post('/api/v1/tasks')
      .send({
        companyId,
        title: 'Harbor crop',
        detail: 'Keep the skyline.',
        deadline: '2026-10-20',
        priority: 'high',
        assigneeEmail: creatorEmail,
      })
      .expect(201);
    const taskId = created.body.id as string;
    expect(created.body.stage).toBe('assigned');
    expect(created.body.status).toBe('open');

    expect((await creator.get(`/api/v1/tasks/${taskId}`)).status).toBe(200);
    expect((await admin.get(`/api/v1/tasks/${taskId}`)).status).toBe(200);
    await other.get(`/api/v1/tasks/${taskId}`).expect(404);
    const creatorNotes = await creator.get('/api/v1/notifications').expect(200);
    expect(creatorNotes.body.items.some((item: { body: string }) => item.body.includes('Harbor crop'))).toBe(
      true,
    );
    const otherNotes = await other.get('/api/v1/notifications').expect(200);
    expect(otherNotes.body.items).toEqual([]);

    expect((await move(creator, taskId, 'start')).body.stage).toBe('in_progress');
    expect((await move(creator, taskId, 'submit')).body.stage).toBe('submitted_rm_qc');
    await move(creator, taskId, 'approve').expect(403);
    await move(admin, taskId, 'approve').expect(403);
    const rmNotes = await rm.get('/api/v1/notifications').expect(200);
    expect(rmNotes.body.items.some((item: { body: string }) => item.body.includes('Submitted for RM QC'))).toBe(
      true,
    );

    expect((await move(rm, taskId, 'approve')).body.stage).toBe('rm_approved');
    expect((await move(rm, taskId, 'approve')).body.stage).toBe('submitted_admin_qc');
    await move(rm, taskId, 'approve').expect(403);
    const adminNotes = await admin.get('/api/v1/notifications').expect(200);
    expect(
      adminNotes.body.items.some((item: { body: string }) => item.body.includes('Submitted for Admin QC')),
    ).toBe(true);

    expect((await move(admin, taskId, 'approve')).body.stage).toBe('admin_approved');
    expect((await move(admin, taskId, 'approve')).body.stage).toBe('ready_to_publish');
    const completed = await move(admin, taskId, 'complete').expect(200);
    expect(completed.body.stage).toBe('completed');
    expect(completed.body.status).toBe('done');
    expect((await creator.get(`/api/v1/tasks/${taskId}`)).body.stage).toBe('completed');

    const second = await rm
      .post('/api/v1/tasks')
      .send({ companyId, title: 'Banner crop', assigneeEmail: creatorEmail })
      .expect(201);
    const secondId = second.body.id as string;
    await move(creator, secondId, 'start').expect(200);
    await move(creator, secondId, 'submit').expect(200);
    const rejected = await move(rm, secondId, 'reject', 'Crop the logo.').expect(200);
    expect(rejected.body.stage).toBe('changes_requested');
    expect(rejected.body.comments.at(-1).body).toBe('Crop the logo.');
    const resubmitted = await move(creator, secondId, 'resubmit').expect(200);
    expect(resubmitted.body.stage).toBe('submitted_rm_qc');
    expect(resubmitted.body.history.some((item: { summary: string }) => item.summary.includes('Crop the logo.'))).toBe(
      true,
    );
    await creator
      .post(`/api/v1/tasks/${secondId}/comments`)
      .send({ body: 'The skyline is back.' })
      .expect(201);
    const commented = await creator.get(`/api/v1/tasks/${secondId}`).expect(200);
    expect(commented.body.comments.some((item: { body: string }) => item.body === 'The skyline is back.')).toBe(
      true,
    );
    expect((await rm.get(`/api/v1/tasks/${secondId}`)).body.stage).toBe('submitted_rm_qc');
    expect((await admin.get(`/api/v1/tasks/${secondId}`)).body.stage).toBe('submitted_rm_qc');
  });
});
