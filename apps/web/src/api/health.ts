import { z } from 'zod';

export const healthReportSchema = z.object({
  status: z.enum(['ok', 'degraded']),
  service: z.string(),
  version: z.string(),
  timestamp: z.string(),
  correlationId: z.string(),
  checks: z.object({
    api: z.object({
      status: z.literal('up'),
    }),
    database: z.object({
      status: z.enum(['up', 'down']),
      latencyMs: z.number().nullable(),
      category: z.string().nullable(),
    }),
    redis: z.object({
      status: z.enum(['up', 'down', 'not_configured']),
      latencyMs: z.number().nullable(),
    }),
  }),
});

export type HealthReport = z.infer<typeof healthReportSchema>;

export class HealthRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'HealthRequestError';
  }
}

export class HealthContractError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'HealthContractError';
  }
}

export class HealthLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'HealthLimitError';
  }
}

export function healthUrl(): string {
  const base = import.meta.env.VITE_API_BASE_URL ?? '';
  return `${base}/api/v1/health`;
}

export async function fetchHealthReport(
  fetchImpl: typeof fetch = fetch,
): Promise<HealthReport> {
  let response: Response;
  try {
    response = await fetchImpl(healthUrl(), {
      headers: { Accept: 'application/json' },
    });
  } catch {
    throw new HealthRequestError(
      'The API did not respond. Start it and confirm it is listening on port 43124.',
    );
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new HealthContractError(
      `The API responded with HTTP ${response.status}, but the body was not JSON.`,
    );
  }

  if (response.status === 429) {
    const message =
      typeof body === 'object' &&
      body !== null &&
      'message' in body &&
      typeof body.message === 'string'
        ? body.message
        : 'Too many requests from this client. Try again later.';
    throw new HealthLimitError(message);
  }

  const parsed = healthReportSchema.safeParse(body);
  if (!parsed.success) {
    throw new HealthContractError(
      `The API responded with HTTP ${response.status}, but the body did not match the health contract.`,
    );
  }

  return parsed.data;
}
