import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Queue, Worker, type ConnectionOptions } from 'bullmq';
import { Redis } from 'ioredis';
import { writeLog } from '../logging/json-logger.js';
import { redact } from '../logging/redact.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { mailboxError } from './mailbox.js';
import { failedDetail, heldBecauseNoSmtp, sentDetail } from './notice-email.js';
import { readSmtp, redisUrl } from './mail-settings.js';
import { sendSmtp } from './send-smtp.js';

const QUEUE_NAME = 'mail';

@Injectable()
export class MailService implements OnModuleInit, OnModuleDestroy {
  private timer: ReturnType<typeof setInterval> | null = null;
  private queue: Queue | null = null;
  private worker: Worker | null = null;
  private connection: Redis | null = null;
  private workerConnection: Redis | null = null;
  private starting = false;
  private announcedDirect = false;

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit(): Promise<void> {
    this.timer = setInterval(() => {
      void this.tick();
    }, 2_000);
    await this.tick();
  }

  async onModuleDestroy(): Promise<void> {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    await this.worker?.close();
    await this.queue?.close();
    this.connection?.disconnect();
    this.workerConnection?.disconnect();
    this.worker = null;
    this.queue = null;
    this.connection = null;
    this.workerConnection = null;
  }

  private async tick(): Promise<void> {
    await this.ensureQueue();
    if (this.queue) {
      await this.claimPending();
      return;
    }
    if (!this.announcedDirect) {
      this.announcedDirect = true;
      writeLog('warn', 'mail.direct', {
        context: 'MailService',
        detail: 'Redis is not configured. Pending mail is delivered in this process.',
      });
    }
    await this.deliverPendingDirect();
  }

  async deliverNow(id: string): Promise<{ status: 'pending' | 'queued' | 'held' | 'sent' | 'failed'; detail: string }> {
    await this.deliver(id);
    const row = await this.prisma.emailDelivery.findUnique({
      where: { id },
      select: { status: true, detail: true },
    });
    if (!row) {
      return { status: 'failed', detail: 'The mail copy is missing.' };
    }
    return { status: row.status, detail: row.detail };
  }

  private async deliverPendingDirect(): Promise<void> {
    const cutoff = new Date(Date.now() - 30_000);
    const rows = await this.prisma.emailDelivery.findMany({
      where: {
        OR: [{ status: 'pending' }, { status: 'queued', updatedAt: { lt: cutoff } }],
      },
      orderBy: { createdAt: 'asc' },
      take: 20,
      select: { id: true },
    });
    for (const row of rows) {
      await this.deliver(row.id);
    }
  }

  private async ensureQueue(): Promise<void> {
    if (this.queue || this.starting) {
      return;
    }
    const url = redisUrl();
    if (!url || !/^rediss?:\/\//.test(url)) {
      return;
    }
    this.starting = true;
    const connection = new Redis(url, {
      maxRetriesPerRequest: null,
      connectTimeout: 2_000,
      lazyConnect: true,
      enableOfflineQueue: false,
    });
    try {
      await connection.connect();
      await connection.ping();
      const workerConnection = connection.duplicate({
        maxRetriesPerRequest: null,
        lazyConnect: true,
      });
      await workerConnection.connect();
      this.connection = connection;
      this.workerConnection = workerConnection;
      this.queue = new Queue(QUEUE_NAME, { connection: connection as unknown as ConnectionOptions });
      this.worker = new Worker(
        QUEUE_NAME,
        async (job: { data: { id?: string } }) => {
          if (typeof job.data.id === 'string') {
            await this.deliver(job.data.id);
          }
        },
        { connection: workerConnection as unknown as ConnectionOptions },
      );
      this.worker.on('error', (error: Error) => {
        writeLog('warn', 'mail.worker_error', {
          context: 'MailService',
          detail: redact(error.message),
        });
      });
    } catch (error) {
      connection.disconnect();
      writeLog('warn', 'mail.redis_unavailable', {
        context: 'MailService',
        detail: redact(error instanceof Error ? error.message : 'unknown'),
      });
    } finally {
      this.starting = false;
    }
  }

  private async claimPending(): Promise<void> {
    if (!this.queue) {
      return;
    }
    const rows = await this.prisma.emailDelivery.findMany({
      where: { status: 'pending' },
      orderBy: { createdAt: 'asc' },
      take: 20,
      select: { id: true },
    });
    for (const row of rows) {
      const claimed = await this.prisma.emailDelivery.updateMany({
        where: { id: row.id, status: 'pending' },
        data: { status: 'queued', detail: 'Queued in Redis.' },
      });
      if (claimed.count !== 1) {
        continue;
      }
      try {
        await this.queue.add('deliver', { id: row.id }, { jobId: row.id, removeOnComplete: 100 });
      } catch (error) {
        await this.prisma.emailDelivery.updateMany({
          where: { id: row.id, status: 'queued' },
          data: { status: 'pending', detail: 'Waiting for the mail queue.' },
        });
        writeLog('warn', 'mail.enqueue_failed', {
          context: 'MailService',
          detail: redact(error instanceof Error ? error.message : 'unknown'),
        });
      }
    }
  }

  private async deliver(id: string): Promise<void> {
    const row = await this.prisma.emailDelivery.findUnique({ where: { id } });
    if (!row || row.status === 'sent' || row.status === 'held') {
      return;
    }
    if (mailboxError(row.toAddress)) {
      await this.prisma.emailDelivery.update({
        where: { id },
        data: {
          status: 'failed',
          detail: 'Enter a valid email address. This copy was not sent.',
        },
      });
      this.logDelivery(id, 'failed', 'invalid_mailbox');
      return;
    }
    const claimed = await this.prisma.emailDelivery.updateMany({
      where: { id, status: 'pending' },
      data: { status: 'queued', detail: 'The mail server is being contacted.' },
    });
    if (claimed.count !== 1) {
      const handoff = await this.prisma.emailDelivery.updateMany({
        where: {
          id,
          status: 'queued',
          OR: [
            { detail: 'Queued in Redis.' },
            { updatedAt: { lt: new Date(Date.now() - 30_000) } },
          ],
        },
        data: { detail: 'The mail server is being contacted.' },
      });
      if (handoff.count !== 1) {
        return;
      }
    }
    const smtp = readSmtp();
    if (!smtp) {
      const held = heldBecauseNoSmtp();
      await this.prisma.emailDelivery.update({
        where: { id },
        data: { status: held.status, detail: held.detail },
      });
      this.logDelivery(id, 'held', 'no_smtp');
      return;
    }
    try {
      await sendSmtp(smtp, { to: row.toAddress, subject: row.subject, text: row.body });
      await this.prisma.emailDelivery.update({
        where: { id },
        data: { status: 'sent', detail: sentDetail(row.toAddress), sentAt: new Date() },
      });
      this.logDelivery(id, 'sent', 'accepted');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown mail error';
      const detail = failedDetail(redact(message));
      await this.prisma.emailDelivery.update({
        where: { id },
        data: { status: 'failed', detail },
      });
      this.logDelivery(id, 'failed', detail);
    }
  }

  private logDelivery(deliveryId: string, status: string, detail: string): void {
    writeLog(status === 'sent' ? 'info' : 'warn', 'mail.delivery', {
      context: 'MailService',
      deliveryId,
      status,
      detail,
    });
  }
}
