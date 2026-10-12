import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { hashPassword } from '../src/auth/password.js';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/configure-app.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

describe('Company membership API (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const stamp = Date.now();
  const password = 'correct-horse-battery';
  const saplEmail = `sapl-${stamp}@example.com`;
  const baplEmail = `bapl-${stamp}@example.com`;
  const adminEmail = `admin-${stamp}@example.com`;
  const otherEmail = `other-${stamp}@example.com`;
  let saplId = '';
  let baplId = '';
  let ontaleId = '';

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
    ontaleId = companies.find((company) => company.code === 'Ontale')?.id ?? '';
    const users = await Promise.all(
      [saplEmail, baplEmail, adminEmail, otherEmail].map((email) =>
        prisma.user.create({ data: { email, passwordHash } }),
      ),
    );
    const byEmail = new Map(users.map((user) => [user.email, user.id]));
    await prisma.membership.createMany({
      data: [
        { userId: byEmail.get(saplEmail)!, companyId: saplId, role: 'creator' },
        { userId: byEmail.get(baplEmail)!, companyId: baplId, role: 'creator' },
        { userId: byEmail.get(adminEmail)!, companyId: saplId, role: 'admin' },
        { userId: byEmail.get(adminEmail)!, companyId: ontaleId, role: 'admin' },
      ],
    });
  });

  afterAll(async () => {
    const emails = [saplEmail, baplEmail, adminEmail, otherEmail];
    await prisma.auditEvent.deleteMany({
      where: { actor: { email: { in: emails } } },
    });
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

  it('stores the five companies and no ASEDS row', async () => {
    const companies = await prisma.company.findMany({ orderBy: { code: 'asc' } });
    expect(companies.map((company) => company.code)).toEqual([
      'BAPL',
      'GBAPL',
      'KABPL',
      'Ontale',
      'SAPL',
    ]);
    expect(companies.some((company) => company.code === 'ASEDS')).toBe(false);
  });

  it('requires a session to list companies', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/companies')
      .expect(401);
    expect(response.body.message).toBe('Sign in is required.');
  });

  it('lists only the caller’s companies', async () => {
    const sapl = await signIn(saplEmail);
    const response = await sapl.get('/api/v1/companies').expect(200);
    expect(response.body.total).toBe(1);
    expect(response.body.items).toEqual([
      expect.objectContaining({ code: 'SAPL', roles: ['creator'] }),
    ]);
    expect(JSON.stringify(response.body)).not.toContain('BAPL');
  });

  it('returns 403 when a SAPL user requests BAPL by id', async () => {
    const sapl = await signIn(saplEmail);
    const response = await sapl.get(`/api/v1/companies/${baplId}`).expect(403);
    expect(response.body.error).toBe('forbidden');
    expect(response.body.message).toBe('You do not have access to this company.');
    const own = await sapl.get(`/api/v1/companies/${saplId}`).expect(200);
    expect(own.body.code).toBe('SAPL');
  });

  it('returns 404 for an unknown company id', async () => {
    const sapl = await signIn(saplEmail);
    const response = await sapl
      .get('/api/v1/companies/4b4c9999-0000-4000-8000-000000000099')
      .expect(404);
    expect(response.body.message).toBe('No company has that id.');
  });

  it('lets an Ontale admin grant Ontale and rejects a BAPL grant', async () => {
    const admin = await signIn(adminEmail);
    const denied = await admin
      .post(`/api/v1/companies/${baplId}/memberships`)
      .send({ email: otherEmail, role: 'creator' })
      .expect(403);
    expect(denied.body.message).toBe(
      'You do not have access to manage this company.',
    );

    const granted = await admin
      .post(`/api/v1/companies/${ontaleId}/memberships`)
      .send({ email: otherEmail, role: 'creator' })
      .expect(201);
    expect(granted.body).toMatchObject({
      email: otherEmail,
      companyCode: 'Ontale',
      role: 'creator',
    });

    const duplicate = await admin
      .post(`/api/v1/companies/${ontaleId}/memberships`)
      .send({ email: otherEmail, role: 'creator' })
      .expect(409);
    expect(duplicate.body.message).toBe('That membership already exists.');

    const other = await signIn(otherEmail);
    const list = await other.get('/api/v1/companies').expect(200);
    expect(list.body.items.map((item: { code: string }) => item.code)).toEqual([
      'Ontale',
    ]);
  });

  it('rejects a creator managing users and hides the other company', async () => {
    const sapl = await signIn(saplEmail);
    const denied = await sapl.get('/api/v1/users').expect(403);
    expect(denied.body.message).toBe('You do not have access to manage users.');

    const admin = await signIn(adminEmail);
    const users = await admin.get('/api/v1/users?limit=100').expect(200);
    const emails = users.body.items.map((item: { email: string }) => item.email);
    expect(emails).toContain(saplEmail);
    expect(emails).not.toContain(baplEmail);
    const saplRow = users.body.items.find(
      (item: { email: string }) => item.email === saplEmail,
    );
    expect(saplRow.memberships).toEqual([
      expect.objectContaining({ companyCode: 'SAPL', role: 'creator' }),
    ]);
  });

  it('disables a SAPL-only user and refuses a user who also belongs to BAPL', async () => {
    const shared = await prisma.user.findUniqueOrThrow({
      where: { email: saplEmail },
    });
    await prisma.membership.create({
      data: { userId: shared.id, companyId: baplId, role: 'creator' },
    });
    const admin = await signIn(adminEmail);
    const blocked = await admin
      .patch(`/api/v1/users/${shared.id}`)
      .send({ status: 'disabled' })
      .expect(403);
    expect(blocked.body.message).toBe('You do not have access to this user.');
    await prisma.membership.deleteMany({
      where: { userId: shared.id, companyId: baplId },
    });

    const other = await prisma.user.findUniqueOrThrow({
      where: { email: otherEmail },
    });
    await prisma.membership.create({
      data: { userId: other.id, companyId: saplId, role: 'creator' },
    });
    const disabled = await admin
      .patch(`/api/v1/users/${other.id}`)
      .send({ status: 'disabled' })
      .expect(200);
    expect(disabled.body.status).toBe('disabled');
    const login = await request(app.getHttpServer())
      .post('/api/v1/session')
      .send({ email: otherEmail, password })
      .expect(401);
    expect(login.body.message).toBe('The email or password is incorrect.');
    await prisma.user.update({
      where: { id: other.id },
      data: { status: 'active' },
    });
  });

  it('keeps the last active admin', async () => {
    const admin = await prisma.user.findUniqueOrThrow({
      where: { email: adminEmail },
    });
    const membership = await prisma.membership.findFirstOrThrow({
      where: { userId: admin.id, companyId: ontaleId, role: 'admin' },
    });
    const agent = await signIn(adminEmail);
    const response = await agent
      .delete(`/api/v1/companies/${ontaleId}/memberships/${membership.id}`)
      .expect(409);
    expect(response.body.message).toBe('This company needs an active admin.');
    const stillThere = await prisma.membership.findUnique({
      where: { id: membership.id },
    });
    expect(stillThere).not.toBeNull();
  });

  it('rejects a page size of zero', async () => {
    const sapl = await signIn(saplEmail);
    await sapl.get('/api/v1/companies?limit=0').expect(400);
  });
});
