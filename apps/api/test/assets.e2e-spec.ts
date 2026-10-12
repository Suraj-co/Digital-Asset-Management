import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { hashPassword } from '../src/auth/password.js';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/configure-app.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

describe('Asset upload failure API (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const stamp = Date.now();
  const password = 'correct-horse-battery';
  const saplEmail = `asset-sapl-${stamp}@example.com`;
  const baplEmail = `asset-bapl-${stamp}@example.com`;
  const secret = `not-stored-bytes-${stamp}`;
  let saplId = '';
  let saplFolderId = '';
  let baplFolderId = '';

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
    const saplUser = await prisma.user.create({
      data: { email: saplEmail, passwordHash },
    });
    const baplUser = await prisma.user.create({
      data: { email: baplEmail, passwordHash },
    });
    await prisma.membership.createMany({
      data: [
        { userId: saplUser.id, companyId: saplId, role: 'creator' },
        { userId: baplUser.id, companyId: baplId, role: 'creator' },
      ],
    });
    const saplDepartment = await prisma.department.create({
      data: { companyId: saplId, name: `Upload${stamp}` },
    });
    const baplDepartment = await prisma.department.create({
      data: { companyId: baplId, name: `Upload${stamp}` },
    });
    const saplFolder = await prisma.folderCatalog.create({
      data: {
        companyId: saplId,
        departmentId: saplDepartment.id,
        year: 2026,
        campaign: `Up${stamp}`,
        stage: 'working',
        assetType: 'posters',
        path: `AARADHYA_DAM/SAPL/Upload${stamp}/2026/Up${stamp}/01_Working/Posters`,
      },
    });
    const baplFolder = await prisma.folderCatalog.create({
      data: {
        companyId: baplId,
        departmentId: baplDepartment.id,
        year: 2026,
        campaign: `Up${stamp}`,
        stage: 'working',
        assetType: 'posters',
        path: `AARADHYA_DAM/BAPL/Upload${stamp}/2026/Up${stamp}/01_Working/Posters`,
      },
    });
    saplFolderId = saplFolder.id;
    baplFolderId = baplFolder.id;
  });

  afterAll(async () => {
    const emails = [saplEmail, baplEmail];
    await prisma.auditEvent.deleteMany({
      where: { actor: { email: { in: emails } } },
    });
    await prisma.asset.deleteMany({
      where: { createdBy: { email: { in: emails } } },
    });
    await prisma.folderCatalog.deleteMany({ where: { campaign: `Up${stamp}` } });
    await prisma.department.deleteMany({ where: { name: `Upload${stamp}` } });
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

  it('records a failed upload and does not keep the file', async () => {
    const sapl = await signIn(saplEmail);
    const created = await sapl
      .post('/api/v1/assets')
      .set('Idempotency-Key', `spring-${stamp}`)
      .field('title', 'Spring poster')
      .field('folderId', saplFolderId)
      .attach('file', Buffer.from(secret), 'poster.png')
      .expect(201);

    expect(created.body).toMatchObject({
      companyCode: 'SAPL',
      title: 'Spring poster',
      state: 'upload_failed',
      fileName: 'poster.png',
      byteSize: Buffer.byteLength(secret),
      driveFileId: null,
      failureClass: 'not_configured',
    });
    expect(created.body.code).toMatch(/^SAPL-\d{4}$/);
    expect(created.body.detail).toContain('Google Drive was not called');
    expect(JSON.stringify(created.body)).not.toContain(secret);

    const again = await sapl
      .post('/api/v1/assets')
      .set('Idempotency-Key', `spring-${stamp}`)
      .field('title', 'Spring poster')
      .field('folderId', saplFolderId)
      .attach('file', Buffer.from(secret), 'poster.png')
      .expect(201);
    expect(again.body.id).toBe(created.body.id);

    const conflict = await sapl
      .post('/api/v1/assets')
      .set('Idempotency-Key', `spring-${stamp}`)
      .field('title', 'Other poster')
      .field('folderId', saplFolderId)
      .attach('file', Buffer.from(secret), 'poster.png')
      .expect(409);
    expect(conflict.body.message).toBe('That idempotency key was already used.');

    const denied = await sapl
      .post('/api/v1/assets')
      .field('title', 'Spring poster')
      .field('folderId', baplFolderId)
      .attach('file', Buffer.from('x'), 'poster.png')
      .expect(403);
    expect(denied.body.message).toBe('You do not have access to this company.');

    const retried = await sapl
      .post(`/api/v1/assets/${created.body.id}/content`)
      .attach('file', Buffer.from(`${secret}-retry`), 'poster-v2.png')
      .expect(200);
    expect(retried.body.id).toBe(created.body.id);
    expect(retried.body.fileName).toBe('poster-v2.png');
    expect(retried.body.driveFileId).toBeNull();
    expect(retried.body.state).toBe('upload_failed');
    expect(JSON.stringify(retried.body)).not.toContain(secret);

    const bapl = await signIn(baplEmail);
    const hidden = await bapl.get(`/api/v1/assets/${created.body.id}`).expect(403);
    expect(hidden.body.message).toBe('You do not have access to this company.');
    const list = await bapl.get('/api/v1/assets').expect(200);
    expect(list.body.items).toEqual([]);
    const own = await sapl.get(`/api/v1/assets?companyId=${saplId}`).expect(200);
    expect(own.body.items.map((item: { id: string }) => item.id)).toContain(
      created.body.id,
    );

    const stored = await prisma.uploadOperation.findFirstOrThrow({
      where: { assetId: created.body.id as string },
    });
    expect(JSON.stringify(stored)).not.toContain(secret);
    expect(stored).not.toHaveProperty('buffer');
  });

  it('searches metadata and edits the title without storing a file', async () => {
    const sapl = await signIn(saplEmail);
    const harbor = await sapl
      .post('/api/v1/assets')
      .field('title', 'Harbor banner')
      .field('folderId', saplFolderId)
      .attach('file', Buffer.from('harbor-bytes'), 'harbor-banner.png')
      .expect(201);
    const night = await sapl
      .post('/api/v1/assets')
      .field('title', 'Night cut')
      .field('folderId', saplFolderId)
      .attach('file', Buffer.from('night-bytes'), 'night-cut.png')
      .expect(201);

    const byTitle = await sapl
      .get(`/api/v1/assets?companyId=${saplId}&q=harbor`)
      .expect(200);
    expect(byTitle.body.items.map((item: { id: string }) => item.id)).toEqual([
      harbor.body.id,
    ]);

    const byCode = await sapl
      .get(`/api/v1/assets?companyId=${saplId}&q=${harbor.body.code}`)
      .expect(200);
    expect(byCode.body.items.map((item: { id: string }) => item.id)).toEqual([
      harbor.body.id,
    ]);

    const byFile = await sapl
      .get(`/api/v1/assets?companyId=${saplId}&q=night-cut.png`)
      .expect(200);
    expect(byFile.body.items.map((item: { id: string }) => item.id)).toEqual([
      night.body.id,
    ]);

    await sapl.get('/api/v1/assets?q=har%0Abor').expect(400);
    const blank = await sapl.get(`/api/v1/assets?companyId=${saplId}&q=%20`).expect(200);
    expect(blank.body.total).toBeGreaterThanOrEqual(2);

    const bapl = await signIn(baplEmail);
    const hidden = await bapl.get('/api/v1/assets?q=Harbor').expect(200);
    expect(hidden.body.items).toEqual([]);

    const renamed = await sapl
      .patch(`/api/v1/assets/${harbor.body.id}`)
      .send({ title: 'Harbor revised' })
      .expect(200);
    expect(renamed.body.title).toBe('Harbor revised');
    expect(renamed.body.driveFileId).toBeNull();
    expect(renamed.body.state).toBe('upload_failed');
    expect(renamed.body.fileName).toBe('harbor-banner.png');
    expect(JSON.stringify(renamed.body)).not.toContain('harbor-bytes');

    const rejected = await sapl
      .patch(`/api/v1/assets/${harbor.body.id}`)
      .send({ title: 'Harbor revised', driveFileId: 'fake-drive-id' })
      .expect(400);
    expect(rejected.body.message).toContain('driveFileId');

    const denied = await bapl
      .patch(`/api/v1/assets/${harbor.body.id}`)
      .send({ title: 'Taken' })
      .expect(403);
    expect(denied.body.message).toBe('You do not have access to this company.');

    const stored = await prisma.asset.findUniqueOrThrow({
      where: { id: harbor.body.id as string },
    });
    expect(stored.title).toBe('Harbor revised');
    expect(stored).not.toHaveProperty('driveFileId');
  });

  it('keeps the asset id and the earlier version when another attempt is recorded', async () => {
    const sapl = await signIn(saplEmail);
    const created = await sapl
      .post('/api/v1/assets')
      .field('title', 'Versioned poster')
      .field('folderId', saplFolderId)
      .attach('file', Buffer.from(`version-one-${stamp}`), 'first.png')
      .expect(201);
    expect(created.body.versions).toEqual([
      expect.objectContaining({
        number: 1,
        label: 'v001',
        fileName: 'first.png',
        driveFileId: null,
        state: 'upload_failed',
      }),
    ]);

    const second = await sapl
      .post(`/api/v1/assets/${created.body.id}/versions`)
      .set('Idempotency-Key', `version-${stamp}`)
      .attach('file', Buffer.from(`version-two-${stamp}`), 'second.png')
      .expect(201);
    expect(second.body.id).toBe(created.body.id);
    expect(second.body.code).toBe(created.body.code);
    expect(second.body.versions.map((item: { label: string; fileName: string }) => [item.label, item.fileName])).toEqual([
      ['v001', 'first.png'],
      ['v002', 'second.png'],
    ]);
    expect(second.body.fileName).toBe('second.png');
    expect(second.body.driveFileId).toBeNull();
    expect(JSON.stringify(second.body)).not.toContain(`version-one-${stamp}`);
    expect(JSON.stringify(second.body)).not.toContain(`version-two-${stamp}`);

    const again = await sapl
      .post(`/api/v1/assets/${created.body.id}/versions`)
      .set('Idempotency-Key', `version-${stamp}`)
      .attach('file', Buffer.from(`version-two-${stamp}`), 'second.png')
      .expect(201);
    expect(again.body.versions).toHaveLength(2);

    const conflict = await sapl
      .post(`/api/v1/assets/${created.body.id}/versions`)
      .set('Idempotency-Key', `version-${stamp}`)
      .attach('file', Buffer.from('x'), 'third.png')
      .expect(409);
    expect(conflict.body.message).toBe('That idempotency key was already used.');

    const retried = await sapl
      .post(`/api/v1/assets/${created.body.id}/content`)
      .attach('file', Buffer.from('retry-bytes'), 'second-v2.png')
      .expect(200);
    expect(retried.body.versions.map((item: { fileName: string }) => item.fileName)).toEqual([
      'first.png',
      'second-v2.png',
    ]);

    const bapl = await signIn(baplEmail);
    const denied = await bapl
      .post(`/api/v1/assets/${created.body.id}/versions`)
      .attach('file', Buffer.from('x'), 'other.png')
      .expect(403);
    expect(denied.body.message).toBe('You do not have access to this company.');

    const rows = await prisma.assetVersion.findMany({
      where: { assetId: created.body.id as string },
      orderBy: { number: 'asc' },
    });
    expect(rows).toHaveLength(2);
    expect(JSON.stringify(rows)).not.toContain(`version-one-${stamp}`);
    expect(rows[0]?.driveFileId).toBeNull();
  });
});
