import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/configure-app.js';
import { RequestRateLimiter } from '../src/http/rate-limit.js';

describe('Rate limit (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureApp(app, { rateLimiter: new RequestRateLimiter(2, 60_000) });
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('refuses the third request from the same client', async () => {
    await request(app.getHttpServer()).get('/api/v1/health/live').expect(200);
    await request(app.getHttpServer()).get('/api/v1/health/live').expect(200);

    const refused = await request(app.getHttpServer())
      .get('/api/v1/health/live')
      .set('X-Request-Id', 'rate-e2e')
      .expect(429)
      .expect('X-Request-Id', 'rate-e2e');

    expect(refused.body).toMatchObject({
      statusCode: 429,
      error: 'too_many_requests',
      message: 'Too many requests from this client. Try again later.',
      correlationId: 'rate-e2e',
      path: '/api/v1/health/live',
    });
    expect(refused.headers['retry-after']).toEqual(expect.any(String));
    expect(Number(refused.headers['retry-after'])).toBeGreaterThan(0);
    expect(JSON.stringify(refused.body)).not.toContain('dam_local_dev_only');

    await request(app.getHttpServer()).get('/api/v1/health/live').expect(429);
  });
});
