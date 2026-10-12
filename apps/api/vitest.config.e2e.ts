import { config as loadDotenv } from 'dotenv';
import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

loadDotenv({ path: resolve(process.cwd(), '.env') });
loadDotenv({ path: resolve(process.cwd(), '../../.env') });

const databaseUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error(
    'Set TEST_DATABASE_URL or DATABASE_URL before running API end-to-end tests.',
  );
}

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['test/**/*.e2e-spec.ts'],
    fileParallelism: false,
    env: {
      NODE_ENV: 'test',
      PORT: '43124',
      WEB_ORIGIN: process.env.WEB_ORIGIN ?? 'http://127.0.0.1:43123',
      LOG_LEVEL: 'error',
      DATABASE_URL: databaseUrl,
    },
  },
});
