import { describe, expect, it } from 'vitest';
import { fetchHealthReport, HealthLimitError, healthReportSchema } from './health.ts';

const report = {
  status: 'ok',
  service: 'aaradhya-dam-api',
  version: '0.1.0',
  timestamp: '2026-10-10T04:41:00.000Z',
  correlationId: 'trace-42',
  checks: {
    api: { status: 'up' },
    database: { status: 'up', latencyMs: 4, category: null },
    redis: { status: 'not_configured', latencyMs: null },
  },
};

describe('health contract', () => {
  it('accepts a healthy report', () => {
    expect(healthReportSchema.parse(report)).toEqual(report);
  });

  it('accepts a degraded database', () => {
    const degraded = {
      ...report,
      status: 'degraded',
      checks: {
        api: { status: 'up' },
        database: {
          status: 'down',
          latencyMs: null,
          category: 'connection_refused',
        },
        redis: { status: 'not_configured', latencyMs: null },
      },
    };
    expect(healthReportSchema.parse(degraded).status).toBe('degraded');
  });

  it('rejects a body that is not the health contract', () => {
    expect(healthReportSchema.safeParse({ status: 'ok' }).success).toBe(false);
  });

  it('surfaces a rate limit as the server message', async () => {
    const limitedFetch: typeof fetch = async () =>
      new Response(
        JSON.stringify({
          statusCode: 429,
          error: 'too_many_requests',
          message: 'Too many requests from this client. Try again later.',
        }),
        { status: 429, headers: { 'Content-Type': 'application/json' } },
      );
    await expect(fetchHealthReport(limitedFetch)).rejects.toBeInstanceOf(HealthLimitError);
    await expect(fetchHealthReport(limitedFetch)).rejects.toThrow(
      /Too many requests from this client/,
    );
  });

  it('surfaces an unreachable API', async () => {
    const failingFetch: typeof fetch = async () => {
      throw new Error('network down');
    };
    await expect(fetchHealthReport(failingFetch)).rejects.toThrow(
      /did not respond/,
    );
  });
});
