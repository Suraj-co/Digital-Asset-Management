import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/configure-app.js';

describe('Health API (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/v1/health/live does not require a database body field', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/health/live')
      .expect(200);

    expect(response.body).toMatchObject({
      status: 'ok',
      service: 'aaradhya-dam-api',
      version: '0.1.0',
    });
    expect(response.body.checks).toBeUndefined();
    expect(response.headers['x-request-id']).toEqual(expect.any(String));
  });

  it('GET /api/v1/health reports a live PostgreSQL connection', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/health')
      .set('X-Request-Id', 'e2e-health')
      .expect(200)
      .expect('X-Request-Id', 'e2e-health');

    expect(response.body).toMatchObject({
      status: 'ok',
      correlationId: 'e2e-health',
      checks: {
        api: { status: 'up' },
        database: { status: 'up', category: null },
      },
    });
    expect(response.body.checks.database.latencyMs).toEqual(expect.any(Number));
  });

  it('replaces an unsafe correlation id', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/health/live')
      .set('X-Request-Id', 'bad id')
      .expect(200);

    expect(response.headers['x-request-id']).not.toBe('bad id');
    expect(response.body.correlationId).not.toContain(' ');
  });

  it('GET /api/v1/health/ready returns 200 when PostgreSQL answers', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/health/ready')
      .expect(200);

    expect(response.body.status).toBe('ok');
  });

  it('GET /api/v1/missing returns a safe JSON error', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/missing')
      .set('X-Request-Id', 'e2e-missing')
      .expect(404);

    expect(response.body).toMatchObject({
      statusCode: 404,
      error: 'not_found',
      correlationId: 'e2e-missing',
      path: '/api/v1/missing',
    });
    expect(JSON.stringify(response.body)).not.toContain('stack');
  });

  it('GET /api/docs serves the OpenAPI UI outside production', async () => {
    const response = await request(app.getHttpServer()).get('/api/docs');
    expect([200, 301]).toContain(response.status);
  });
});
