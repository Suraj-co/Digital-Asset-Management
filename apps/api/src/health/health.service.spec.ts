import { HealthService } from './health.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';

function serviceWith(
  query: () => Promise<unknown>,
): HealthService {
  const prisma = {
    $queryRaw: query,
  } as unknown as PrismaService;
  return new HealthService(prisma);
}

describe('HealthService', () => {
  it('reports the database as up when SELECT 1 succeeds', async () => {
    const report = await serviceWith(async () => [{ '?column?': 1 }]).check(
      'trace-ok',
    );

    expect(report.status).toBe('ok');
    expect(report.correlationId).toBe('trace-ok');
    expect(report.checks.database.status).toBe('up');
    expect(report.checks.database.category).toBeNull();
    expect(report.checks.database.latencyMs).toEqual(expect.any(Number));
  });

  it('reports a category and does not leak the database password', async () => {
    const password = 'dam_local_dev_only';
    const report = await serviceWith(async () => {
      throw new Error(
        `password authentication failed for postgresql://dam:${password}@127.0.0.1:5432/dam`,
      );
    }).check('trace-down');

    expect(report.status).toBe('degraded');
    expect(report.checks.database).toEqual({
      status: 'down',
      latencyMs: null,
      category: 'authentication_failed',
    });
    expect(JSON.stringify(report)).not.toContain(password);
  });
});
