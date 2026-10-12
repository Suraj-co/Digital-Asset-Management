import { Injectable } from '@nestjs/common';
import { writeLog } from '../logging/json-logger.js';
import { redact } from '../logging/redact.js';
import { redisUrl } from '../mail/mail-settings.js';
import { checkRedis } from '../mail/redis-check.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { APP_NAME, APP_VERSION } from '../version.js';
import { classifyDatabaseError } from './database-error.js';
import type { DatabaseCheck, HealthReport } from './health.types.js';

@Injectable()
export class HealthService {
  constructor(private readonly prisma: PrismaService) {}

  async check(correlationId: string): Promise<HealthReport> {
    const [database, redis] = await Promise.all([
      this.checkDatabase(),
      checkRedis(redisUrl()),
    ]);
    return {
      status: database.status === 'up' ? 'ok' : 'degraded',
      service: APP_NAME,
      version: APP_VERSION,
      timestamp: new Date().toISOString(),
      correlationId,
      checks: {
        api: { status: 'up' },
        database,
        redis,
      },
    };
  }

  private async checkDatabase(): Promise<DatabaseCheck> {
    const started = performance.now();
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return {
        status: 'up',
        latencyMs: Math.round(performance.now() - started),
        category: null,
      };
    } catch (error) {
      const category = classifyDatabaseError(error);
      writeLog('error', 'database.health_failed', {
        context: 'HealthService',
        category,
        detail: redact(error instanceof Error ? error.message : 'unknown'),
      });
      return {
        status: 'down',
        latencyMs: null,
        category,
      };
    }
  }
}
