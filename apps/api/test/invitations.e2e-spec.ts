import { createServer, type AddressInfo, type Socket } from 'node:net';
import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { hashPassword } from '../src/auth/password.js';
import { hashSessionToken } from '../src/auth/session-token.js';
import { configureApp } from '../src/configure-app.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

const SMTP_KEYS = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_FROM', 'SMTP_USER', 'SMTP_PASSWORD'] as const;

describe('Creator invitation API (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const stamp = Date.now();
  const password = 'correct-horse-battery';
  const setupPassword = 'harbor-setup-key';
  const changedPassword = 'changed-harbor-key';
  const secondPassword = 'second-harbor-key';
  const rmEmail = `invite-rm-${stamp}@example.com`;
  const adminEmail = `invite-admin-${stamp}@example.com`;
  const creatorEmail = `invite-creator-${stamp}@example.com`;
  const existingEmail = `invite-existing-${stamp}@example.com`;
  const invitedEmail = `invite-new-${stamp}@example.com`;
  const secondEmail = `invite-second-${stamp}@example.com`;
  const smtpEmail = `invite-smtp-${stamp}@example.com`;
  const refusedEmail = `invite-refused-${stamp}@example.com`;
  const emails = [
    rmEmail,
    adminEmail,
    creatorEmail,
    existingEmail,
    invitedEmail,
    secondEmail,
    smtpEmail,
    refusedEmail,
  ];
  let saplId = '';
  const savedSmtp: Partial<Record<(typeof SMTP_KEYS)[number], string | undefined>> = {};

  beforeAll(async () => {
    for (const key of SMTP_KEYS) {
      savedSmtp[key] = process.env[key];
      delete process.env[key];
    }
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
    const rm = await prisma.user.create({ data: { email: rmEmail, passwordHash } });
    const admin = await prisma.user.create({ data: { email: adminEmail, passwordHash } });
    const creator = await prisma.user.create({ data: { email: creatorEmail, passwordHash } });
    const existing = await prisma.user.create({ data: { email: existingEmail, passwordHash } });
    await prisma.membership.createMany({
      data: [
        { userId: rm.id, companyId: saplId, role: 'rm' },
        { userId: admin.id, companyId: saplId, role: 'admin' },
        { userId: creator.id, companyId: saplId, role: 'creator' },
        { userId: existing.id, companyId: saplId, role: 'creator' },
      ],
    });
  });

  afterAll(async () => {
    await prisma.auditEvent.deleteMany({ where: { actor: { email: { in: emails } } } });
    await prisma.emailDelivery.deleteMany({ where: { toAddress: { in: emails } } });
    await prisma.creatorInvitation.deleteMany({ where: { email: { in: emails } } });
    await prisma.session.deleteMany({ where: { user: { email: { in: emails } } } });
    await prisma.membership.deleteMany({ where: { user: { email: { in: emails } } } });
    await prisma.user.deleteMany({ where: { email: { in: emails } } });
    await app.close();
    for (const key of SMTP_KEYS) {
      const value = savedSmtp[key];
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });

  async function signIn(email: string, secret = password) {
    const agent = request.agent(app.getHttpServer());
    await agent.post('/api/v1/session').send({ email, password: secret }).expect(201);
    return agent;
  }

  function tokenFrom(body: string): string {
    const match = body.match(/\/invite\/([A-Za-z0-9_-]+)/);
    if (!match?.[1]) {
      throw new Error('The invitation email has no setup link.');
    }
    return match[1];
  }

  it('lets an RM or an admin set a hashed password and reports real mail status', async () => {
    const rm = await signIn(rmEmail);
    const admin = await signIn(adminEmail);
    const creator = await signIn(creatorEmail);

    await request(app.getHttpServer())
      .post(`/api/v1/companies/${saplId}/creator-invitations`)
      .send({ name: 'Meera', email: invitedEmail, password: setupPassword })
      .expect(401);

    await creator
      .post(`/api/v1/companies/${saplId}/creator-invitations`)
      .send({ name: 'Meera', email: invitedEmail, password: setupPassword })
      .expect(403);
    await rm
      .post(`/api/v1/companies/${saplId}/creator-invitations`)
      .send({ name: 'Meera', email: invitedEmail, password: 'short' })
      .expect(400);

    const invited = await rm
      .post(`/api/v1/companies/${saplId}/creator-invitations`)
      .send({ name: 'Meera', email: invitedEmail, password: setupPassword })
      .expect(201);
    expect(invited.body).toMatchObject({
      email: invitedEmail,
      name: 'Meera',
      companyCode: 'SAPL',
      delivery: {
        status: 'held',
        detail: 'No mail server is configured. This copy is kept here and was not sent.',
      },
    });
    expect(JSON.stringify(invited.body)).not.toContain(setupPassword);
    expect(JSON.stringify(invited.body)).not.toContain('/invite/');

    const account = await prisma.user.findUnique({ where: { email: invitedEmail } });
    expect(account?.passwordHash.startsWith('scrypt$')).toBe(true);
    expect(account?.passwordHash).not.toContain(setupPassword);
    const rmCopy = await prisma.emailDelivery.findFirst({
      where: { toAddress: invitedEmail },
    });
    expect(rmCopy?.status).toBe('held');
    expect(rmCopy?.body).toContain('Jai, an RM, invited you to Aaradhya DAM as a Creator.');
    expect(rmCopy?.body).toContain(`Login email: ${invitedEmail}`);
    expect(rmCopy?.body).toContain('This message does not include a password.');
    expect(rmCopy?.body).not.toContain(setupPassword);
    const token = tokenFrom(rmCopy?.body ?? '');
    const stored = await prisma.creatorInvitation.findUnique({
      where: { tokenHash: hashSessionToken(token) },
    });
    expect(stored?.tokenHash).not.toBe(token);

    const signedIn = request.agent(app.getHttpServer());
    const session = await signedIn
      .post('/api/v1/session')
      .send({ email: invitedEmail, password: setupPassword })
      .expect(201);
    expect(session.body.user.email).toBe(invitedEmail);
    await signedIn.get(`/api/v1/dashboard?companyId=${saplId}`).expect(200);

    await rm
      .post(`/api/v1/companies/${saplId}/creator-invitations`)
      .send({ name: 'Meera', email: invitedEmail, password: setupPassword })
      .expect(409);
    await admin
      .post(`/api/v1/companies/${saplId}/creator-invitations`)
      .send({ name: 'Meera', email: existingEmail, password: setupPassword })
      .expect(409);

    const resent = await rm
      .post(`/api/v1/companies/${saplId}/creator-invitations/${invited.body.id}/resend`)
      .expect(200);
    expect(resent.body.delivery.status).toBe('held');
    const resentCopy = await prisma.emailDelivery.findFirst({
      where: { invitationId: invited.body.id as string },
    });
    const resentToken = tokenFrom(resentCopy?.body ?? '');
    expect(resentToken).not.toBe(token);
    expect(await prisma.user.count({ where: { email: invitedEmail } })).toBe(1);
    await request(app.getHttpServer())
      .post('/api/v1/invitations/accept')
      .send({ token, password: changedPassword })
      .expect(400);

    const accepted = await request(app.getHttpServer())
      .post('/api/v1/invitations/accept')
      .send({ token: resentToken, password: changedPassword })
      .expect(200);
    expect(accepted.body).toMatchObject({
      email: invitedEmail,
      companyCode: 'SAPL',
      passwordSet: true,
    });
    await request(app.getHttpServer())
      .post('/api/v1/invitations/accept')
      .send({ token: resentToken, password: changedPassword })
      .expect(400);
    await request(app.getHttpServer())
      .post('/api/v1/session')
      .send({ email: invitedEmail, password: setupPassword })
      .expect(401);
    await request(app.getHttpServer())
      .post('/api/v1/session')
      .send({ email: invitedEmail, password: changedPassword })
      .expect(201);
    await rm
      .post(`/api/v1/companies/${saplId}/creator-invitations/${invited.body.id}/resend`)
      .expect(400);

    const adminInvite = await admin
      .post(`/api/v1/companies/${saplId}/creator-invitations`)
      .send({ name: 'Neel', email: secondEmail, password: secondPassword })
      .expect(201);
    const adminCopy = await prisma.emailDelivery.findFirst({
      where: { toAddress: secondEmail },
    });
    expect(adminCopy?.body).toContain('Aman, an Admin, invited you to Aaradhya DAM as a Creator.');
    expect(adminCopy?.body).not.toContain(secondPassword);
    const secondToken = tokenFrom(adminCopy?.body ?? '');
    await prisma.creatorInvitation.update({
      where: { tokenHash: hashSessionToken(secondToken) },
      data: { expiresAt: new Date(Date.now() - 60_000) },
    });
    await request(app.getHttpServer())
      .post('/api/v1/invitations/accept')
      .send({ token: secondToken, password: changedPassword })
      .expect(400);
    await request(app.getHttpServer())
      .post('/api/v1/session')
      .send({ email: secondEmail, password: secondPassword })
      .expect(201);
    await request(app.getHttpServer())
      .post('/api/v1/invitations/accept')
      .send({ token: 'not-a-real-invitation-token', password: changedPassword })
      .expect(400);
    const renewed = await admin
      .post(`/api/v1/companies/${saplId}/creator-invitations/${adminInvite.body.id}/resend`)
      .expect(200);
    expect(renewed.body.email).toBe(secondEmail);
    expect(await prisma.user.count({ where: { email: secondEmail } })).toBe(1);
  });

  it('marks the invitation failed when the mail server refuses the connection', async () => {
    const port = await closedPort();
    process.env.SMTP_HOST = '127.0.0.1';
    process.env.SMTP_PORT = String(port);
    process.env.SMTP_FROM = 'dam@localhost';
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASSWORD;
    try {
      const admin = await signIn(adminEmail);
      const refused = await admin
        .post(`/api/v1/companies/${saplId}/creator-invitations`)
        .send({ name: 'Ria', email: refusedEmail, password: setupPassword })
        .expect(201);
      expect(refused.body.delivery.status).toBe('failed');
      expect(refused.body.delivery.detail).toContain('The mail server refused the message.');
      expect(refused.body.delivery.detail).not.toContain(setupPassword);
      expect(JSON.stringify(refused.body)).not.toContain('Invitation sent');
    } finally {
      clearSmtp();
    }
  });

  it('marks the invitation sent only after the mail server accepts it', async () => {
    const sink = await startSink();
    process.env.SMTP_HOST = '127.0.0.1';
    process.env.SMTP_PORT = String(sink.port);
    process.env.SMTP_FROM = 'dam@localhost';
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASSWORD;
    try {
      const admin = await signIn(adminEmail);
      const sent = await admin
        .post(`/api/v1/companies/${saplId}/creator-invitations`)
        .send({ name: 'Kiran', email: smtpEmail, password: setupPassword })
        .expect(201);
      expect(sent.body.delivery.status).toBe('sent');
      expect(sent.body.delivery.detail).toBe(`Sent to ${smtpEmail}.`);
      const delivered = sink.messages.join('\n').replace(/=\r\n/g, '');
      expect(delivered).toContain(`Login email: ${smtpEmail}`);
      expect(delivered).toContain('This message does not include a password.');
      expect(delivered).not.toContain(setupPassword);
      const row = await prisma.emailDelivery.findFirst({ where: { toAddress: smtpEmail } });
      expect(row?.status).toBe('sent');
      expect(row?.sentAt).toBeTruthy();
    } finally {
      clearSmtp();
      await sink.close();
    }
  });
});

function clearSmtp(): void {
  for (const key of SMTP_KEYS) {
    delete process.env[key];
  }
}

function closedPort(): Promise<number> {
  const server = createServer();
  return new Promise((resolve, reject) => {
    server.listen(0, '127.0.0.1', () => {
      const address = server.address() as AddressInfo;
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(address.port);
      });
    });
  });
}

function startSink(): Promise<{ port: number; messages: string[]; close: () => Promise<void> }> {
  const messages: string[] = [];
  const server = createServer((socket: Socket) => {
    let buffer = '';
    let dataMode = false;
    let data = '';
    const reply = (line: string) => {
      socket.write(`${line}\r\n`);
    };
    const finishData = () => {
      if (!data.endsWith('\r\n.\r\n')) {
        return;
      }
      messages.push(data);
      data = '';
      dataMode = false;
      reply('250 accepted');
    };
    reply('220 localhost ESMTP');
    socket.on('data', (chunk) => {
      buffer += chunk.toString('utf8');
      if (dataMode) {
        data += buffer;
        buffer = '';
        finishData();
        return;
      }
      let newline = buffer.indexOf('\r\n');
      while (newline >= 0 && !dataMode) {
        const line = buffer.slice(0, newline);
        buffer = buffer.slice(newline + 2);
        const upper = line.toUpperCase();
        if (upper.startsWith('EHLO') || upper.startsWith('HELO')) {
          reply('250 localhost');
        } else if (upper.startsWith('DATA')) {
          dataMode = true;
          data = buffer;
          buffer = '';
          reply('354 end with <CRLF>.<CRLF>');
          finishData();
        } else if (upper.startsWith('QUIT')) {
          reply('221 bye');
          socket.end();
        } else {
          reply('250 OK');
        }
        newline = buffer.indexOf('\r\n');
      }
    });
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const address = server.address() as AddressInfo;
      resolve({
        port: address.port,
        messages,
        close: () =>
          new Promise((done) => {
            server.close(() => done());
          }),
      });
    });
  });
}
