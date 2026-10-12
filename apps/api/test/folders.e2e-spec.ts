import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { hashPassword } from '../src/auth/password.js';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/configure-app.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

describe('Folder catalog API (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const stamp = Date.now();
  const password = 'correct-horse-battery';
  const adminEmail = `folder-admin-${stamp}@example.com`;
  const creatorEmail = `folder-creator-${stamp}@example.com`;
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
    const admin = await prisma.user.create({
      data: { email: adminEmail, passwordHash },
    });
    const creator = await prisma.user.create({
      data: { email: creatorEmail, passwordHash },
    });
    await prisma.membership.createMany({
      data: [
        { userId: admin.id, companyId: saplId, role: 'admin' },
        { userId: creator.id, companyId: saplId, role: 'creator' },
      ],
    });
  });

  afterAll(async () => {
    await prisma.folderCatalog.deleteMany({
      where: { company: { code: 'SAPL' }, campaign: `Spring${stamp}` },
    });
    await prisma.department.deleteMany({
      where: { companyId: saplId, name: `Brand${stamp}` },
    });
    await prisma.user.deleteMany({
      where: { email: { in: [adminEmail, creatorEmail] } },
    });
    await app.close();
  });

  async function signIn(email: string) {
    const agent = request.agent(app.getHttpServer());
    await agent.post('/api/v1/session').send({ email, password }).expect(201);
    return agent;
  }

  it('stores a path without calling Drive and rejects another company', async () => {
    const admin = await signIn(adminEmail);
    const creator = await signIn(creatorEmail);
    const created = await creator
      .post(`/api/v1/companies/${saplId}/departments`)
      .send({ name: `Brand${stamp}` })
      .expect(201);
    const otherDepartment = await creator
      .post(`/api/v1/companies/${baplId}/departments`)
      .send({ name: `Brand${stamp}` })
      .expect(403);
    expect(otherDepartment.body.message).toBe('You do not have access to this company.');
    await admin
      .post(`/api/v1/companies/${saplId}/departments`)
      .send({ name: `Brand${stamp}` })
      .expect(409);
    expect(created.body.name).toBe(`Brand${stamp}`);
    const duplicate = await admin
      .post(`/api/v1/companies/${saplId}/departments`)
      .send({ name: `Brand${stamp}` })
      .expect(409);

    expect(duplicate.body.message).toBe('That department already exists.');
    const listed = await creator
      .get(`/api/v1/companies/${saplId}/departments`)
      .expect(200);
    expect(listed.body.items.map((item: { name: string }) => item.name)).toContain(
      `Brand${stamp}`,
    );
    const otherCompany = await creator
      .get(`/api/v1/companies/${baplId}/departments`)
      .expect(403);
    expect(otherCompany.body.message).toBe(
      'You do not have access to this company.',
    );

    const body = {
      companyId: saplId,
      departmentId: created.body.id as string,
      year: 2026,
      campaign: `Spring${stamp}`,
      stage: 'working',
      assetType: 'posters',
    };
    const resolved = await creator
      .post('/api/v1/storage/folders/resolve')
      .send(body)
      .expect(200);
    expect(resolved.body.path).toBe(
      `AARADHYA_DAM/SAPL/Brand${stamp}/2026/Spring${stamp}/01_Working/Posters`,
    );
    expect(resolved.body.driveFolderId).toBeNull();
    expect(resolved.body.liveCheck).toBe('not_run');
    expect(resolved.body.detail).toContain('Google Drive was not called');
    const again = await creator
      .post('/api/v1/storage/folders/resolve')
      .send(body)
      .expect(200);
    expect(again.body.id).toBe(resolved.body.id);

    const crossed = await creator
      .post('/api/v1/storage/folders/resolve')
      .send({ ...body, companyId: baplId })
      .expect(403);
    expect(crossed.body.message).toBe('You do not have access to this company.');
    const folders = await creator
      .get(`/api/v1/storage/folders?companyId=${saplId}`)
      .expect(200);
    expect(folders.body.items.map((item: { id: string }) => item.id)).toContain(
      resolved.body.id,
    );
    expect(JSON.stringify(folders.body)).not.toContain('driveFolderId":"');
    await creator.get(`/api/v1/storage/folders?companyId=${baplId}`).expect(403);

    await creator
      .post('/api/v1/storage/folders/resolve')
      .send({ ...body, campaign: '../Secret', driveFolderId: 'client-picked' })
      .expect(400);
    const stored = await prisma.folderCatalog.findUniqueOrThrow({
      where: { id: resolved.body.id as string },
    });
    expect(stored.driveFolderId).toBeNull();
  });
});
