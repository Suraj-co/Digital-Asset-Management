import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { hashPassword } from '../src/auth/password.js';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/configure-app.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

describe('Session API (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const email = `session-${Date.now()}@example.com`;
  const password = 'correct-horse-battery';

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    await prisma.user.create({
      data: {
        email,
        passwordHash: await hashPassword(password),
      },
    });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email } });
    await app.close();
  });

  it('rejects an unknown password and does not set a cookie', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/session')
      .send({ email, password: 'wrong-horse-battery' })
      .expect(401);

    expect(response.body.error).toBe('unauthorized');
    expect(response.body.message).toBe('The email or password is incorrect.');
    expect(JSON.stringify(response.body)).not.toContain(password);
    expect(response.headers['set-cookie']).toBeUndefined();
  });

  it('creates a session cookie and reads it back', async () => {
    const agent = request.agent(app.getHttpServer());
    const created = await agent
      .post('/api/v1/session')
      .send({ email, password })
      .expect(201);

    expect(created.body.user).toMatchObject({ email, status: 'active' });
    expect(JSON.stringify(created.body)).not.toContain(password);
    const setCookie = created.headers['set-cookie'];
    const cookieText = Array.isArray(setCookie)
      ? setCookie.join(';')
      : (setCookie ?? '');
    expect(cookieText).toContain('dam_session=');
    expect(cookieText).toContain('HttpOnly');

    const current = await agent.get('/api/v1/session').expect(200);
    expect(current.body.user.email).toBe(email);

    await agent.delete('/api/v1/session').expect(204);
    await agent.get('/api/v1/session').expect(401);
  });

  it('replaces the previous session on the next login', async () => {
    const first = request.agent(app.getHttpServer());
    await first.post('/api/v1/session').send({ email, password }).expect(201);
    const second = request.agent(app.getHttpServer());
    await second.post('/api/v1/session').send({ email, password }).expect(201);
    await first.get('/api/v1/session').expect(401);
    await second.get('/api/v1/session').expect(200);
    await second.delete('/api/v1/session').expect(204);
  });

  it('rejects a disabled account', async () => {
    const agent = request.agent(app.getHttpServer());
    await agent.post('/api/v1/session').send({ email, password }).expect(201);
    await prisma.user.update({
      where: { email },
      data: { status: 'disabled' },
    });
    const current = await agent.get('/api/v1/session').expect(401);
    expect(current.body.message).toBe('Sign in is required.');
    const login = await agent
      .post('/api/v1/session')
      .send({ email, password })
      .expect(401);
    expect(login.body.message).toBe('The email or password is incorrect.');
    await prisma.user.update({
      where: { email },
      data: { status: 'active' },
    });
  });
});
