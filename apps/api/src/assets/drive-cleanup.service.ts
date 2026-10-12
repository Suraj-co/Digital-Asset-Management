import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Queue, Worker, type ConnectionOptions } from 'bullmq';
import { Redis } from 'ioredis';
import { AuditService } from '../audit/audit.service.js';
import { writeLog } from '../logging/json-logger.js';
import { redact } from '../logging/redact.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { redisUrl } from '../mail/mail-settings.js';
import { GoogleWorkspaceService } from '../storage/google-workspace.js';

const QUEUE_NAME = 'drive-cleanup';

@Injectable()
export class DriveCleanupService implements OnModuleInit, OnModuleDestroy {
  private timer: ReturnType<typeof setInterval> | null = null;
  private queue: Queue | null = null;
  private worker: Worker | null = null;
  private connection: Redis | null = null;
  private workerConnection: Redis | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly google: GoogleWorkspaceService,
    private readonly audit: AuditService,
  ) {}

  async onModuleInit(): Promise<void> {
    this.timer = setInterval(() => {
      void this.runOnce();
    }, 5_000);
    await this.ensureQueue();
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
  }

  async runOnce(): Promise<void> {
    const stale = new Date(Date.now() - 120_000);
    const rows = await this.prisma.driveCleanup.findMany({
      where: {
        OR: [
          { status: { in: ['pending', 'failed'] }, attempts: { lt: 5 } },
          { status: 'running', updatedAt: { lt: stale } },
        ],
      },
      orderBy: { createdAt: 'asc' },
      take: 10,
      select: { id: true },
    });
    for (const row of rows) {
      await this.process(row.id);
    }
  }

  private async ensureQueue(): Promise<void> {
    const url = redisUrl();
    if (!url || !/^rediss?:\/\//.test(url) || this.queue) {
      return;
    }
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
            await this.process(job.data.id);
          }
        },
        { connection: workerConnection as unknown as ConnectionOptions },
      );
      this.worker.on('error', (error: Error) => {
        writeLog('warn', 'drive.cleanup_worker', {
          context: 'DriveCleanupService',
          detail: redact(error.message),
        });
      });
    } catch (error) {
      connection.disconnect();
      writeLog('warn', 'drive.cleanup_direct', {
        context: 'DriveCleanupService',
        detail: redact(error instanceof Error ? error.message : 'Redis is unavailable.'),
      });
    }
  }

  async enqueue(id: string): Promise<void> {
    await this.ensureQueue();
    if (!this.queue) {
      return;
    }
    await this.queue.add('delete', { id }, { jobId: id, attempts: 5, backoff: { type: 'exponential', delay: 2_000 } });
  }

  private async process(id: string): Promise<void> {
    const stale = new Date(Date.now() - 120_000);
    const claimed = await this.prisma.driveCleanup.updateMany({
      where: {
        id,
        OR: [
          { status: { in: ['pending', 'failed'] } },
          { status: 'running', updatedAt: { lt: stale } },
        ],
      },
      data: { status: 'running', attempts: { increment: 1 } },
    });
    if (claimed.count !== 1) {
      return;
    }
    const row = await this.prisma.driveCleanup.findUnique({
      where: { id },
      include: {
        version: {
          select: {
            id: true,
            driveFileId: true,
            number: true,
            createdById: true,
            asset: {
              select: {
                id: true,
                companyId: true,
                code: true,
                publication: true,
                approvedVersionId: true,
              },
            },
          },
        },
      },
    });
    if (!row) {
      return;
    }
    try {
      const kept = await this.keepReason(row.version, row.driveFileId);
      if (kept) {
        await this.finish(id, 'kept', kept);
        return;
      }
      const before = await this.google.filePresence(row.driveFileId);
      if (before === 'missing') {
        await this.finish(
          id,
          'failed',
          'Google Drive does not have that file, so deletion was not confirmed.',
        );
        return;
      }
      if (before === 'active') {
        await this.google.trashFile(row.driveFileId);
      }
      const after = await this.google.filePresence(row.driveFileId);
      if (after === 'active') {
        await this.finish(id, 'failed', 'Google Drive still has the file.');
        return;
      }
      await this.prisma.$transaction(async (tx) => {
        const saved = await tx.driveCleanup.updateMany({
          where: { id, status: 'running' },
          data: {
            status: 'deleted',
            detail: 'Removed from Google Drive.',
            deletedAt: new Date(),
          },
        });
        if (saved.count !== 1) {
          return;
        }
        await tx.assetVersion.updateMany({
          where: { id: row.versionId, driveFileId: row.driveFileId },
          data: { driveFileId: null, detail: 'Removed from Google Drive after a newer version was approved.' },
        });
        const decision = await tx.workflowDecision.findFirst({
          where: { assetId: row.version.asset.id, action: 'approve' },
          orderBy: { createdAt: 'desc' },
          select: { actorId: true },
        });
        await this.audit.write(tx, {
          companyId: row.version.asset.companyId,
          actorId: decision?.actorId ?? row.version.createdById,
          action: 'drive_file_removed',
          summary: `${row.version.asset.code} ${versionLabel(row.version.number)} was removed from Google Drive after the approved version changed.`,
          subjectType: 'asset',
          subjectId: row.version.asset.id,
        });
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Google Drive did not delete the file.';
      await this.finish(id, 'failed', message);
    }
  }

  private async keepReason(
    version: {
      id: string;
      driveFileId: string | null;
      asset: { publication: string; approvedVersionId: string | null };
    },
    driveFileId: string,
  ): Promise<string | null> {
    if (!version.driveFileId || version.driveFileId !== driveFileId) {
      return 'This version no longer points at that Drive file.';
    }
    if (version.asset.publication !== 'ready' || version.asset.approvedVersionId === version.id) {
      return 'This file is still the approved version or its replacement is not fully approved.';
    }
    if (!version.asset.approvedVersionId) {
      return 'This file is still the approved version or its replacement is not fully approved.';
    }
    const holders = await this.prisma.assetVersion.findMany({
      where: { driveFileId },
      select: {
        id: true,
        asset: { select: { approvedVersionId: true, publication: true } },
      },
    });
    const blocked = holders.some(
      (holder) =>
        holder.asset.approvedVersionId === holder.id || holder.asset.publication !== 'ready',
    );
    if (blocked) {
      return 'This Drive file is still used by an approved version or a version in review.';
    }
    return null;
  }

  private async finish(id: string, status: 'failed' | 'kept', detail: string): Promise<void> {
    await this.prisma.driveCleanup.updateMany({
      where: { id, status: 'running' },
      data: { status, detail: detail.slice(0, 300) },
    });
  }

}

function versionLabel(number: number): string {
  return `v${String(number).padStart(3, '0')}`;
}
