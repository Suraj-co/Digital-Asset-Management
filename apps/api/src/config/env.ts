import { z } from 'zod';
import { usesWorkstationDatabasePassword } from '../../scripts/workstation-password.mjs';
import { redisConfigError, smtpConfigError } from '../mail/mail-settings.js';
import { readDriveConfiguration } from '../storage/drive-settings.js';

const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(43124),
  WEB_ORIGIN: z.url().default('http://127.0.0.1:43123'),
  DATABASE_URL: z
    .string()
    .regex(
      /^postgres(ql)?:\/\//,
      'DATABASE_URL must be a PostgreSQL connection URL',
    ),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  RATE_LIMIT_MAX: z.coerce.number().int().min(1).max(10_000).default(240),
  RATE_LIMIT_WINDOW_SECONDS: z.coerce.number().int().min(1).max(3600).default(60),
});

export type AppEnv = {
  nodeEnv: 'development' | 'test' | 'production';
  port: number;
  webOrigin: string;
  databaseUrl: string;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  rateLimitMax: number;
  rateLimitWindowMs: number;
};

export function loadEnv(source: NodeJS.ProcessEnv = process.env): AppEnv {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join('.') || 'env'}: ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid environment: ${details}`);
  }

  if (
    parsed.data.NODE_ENV === 'production' &&
    usesWorkstationDatabasePassword(parsed.data.DATABASE_URL)
  ) {
    throw new Error(
      'Invalid environment: DATABASE_URL uses the workstation password. Set a different password before production.',
    );
  }

  // A partial Drive configuration must fail startup. The values are not
  // copied onto AppEnv, so a secret cannot leak through the config object.
  readDriveConfiguration(source);
  const smtpError = smtpConfigError(source);
  if (smtpError) {
    throw new Error(`Invalid environment: ${smtpError}`);
  }
  const redisError = redisConfigError(source);
  if (redisError) {
    throw new Error(`Invalid environment: ${redisError}`);
  }

  return {
    nodeEnv: parsed.data.NODE_ENV,
    port: parsed.data.PORT,
    webOrigin: parsed.data.WEB_ORIGIN,
    databaseUrl: parsed.data.DATABASE_URL,
    logLevel: parsed.data.LOG_LEVEL,
    rateLimitMax: parsed.data.RATE_LIMIT_MAX,
    rateLimitWindowMs: parsed.data.RATE_LIMIT_WINDOW_SECONDS * 1000,
  };
}
