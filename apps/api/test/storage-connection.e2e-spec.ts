import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/configure-app.js';

describe('Storage connection API (e2e)', () => {
  let app: INestApplication<App>;
  const savedDriveEnv = {
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
    GOOGLE_REDIRECT_URI: process.env.GOOGLE_REDIRECT_URI,
    GOOGLE_DRIVE_ID: process.env.GOOGLE_DRIVE_ID,
  };

  beforeAll(async () => {
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_SECRET;
    delete process.env.GOOGLE_REDIRECT_URI;
    delete process.env.GOOGLE_DRIVE_ID;
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    for (const [name, value] of Object.entries(savedDriveEnv)) {
      if (value === undefined) {
        delete process.env[name];
      } else {
        process.env[name] = value;
      }
    }
  });

  it('GET /api/v1/storage/connection reports missing Drive settings', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/storage/connection')
      .set('X-Request-Id', 'e2e-drive')
      .expect(200)
      .expect('X-Request-Id', 'e2e-drive');

    expect(response.body).toMatchObject({
      status: 'not_configured',
      provider: 'google_drive',
      liveCheck: 'not_run',
      correlationId: 'e2e-drive',
      missing: ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'],
    });
    expect(response.body.detail).toContain('did not call Google');
    expect(JSON.stringify(response.body)).not.toContain('dam_local_dev_only');
  });
});
