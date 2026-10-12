import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { loadEnv } from './config/env.js';
import { loadLocalEnvFile } from './config/load-local-env.js';
import { configureApp } from './configure-app.js';
import { JsonLogger, writeLog } from './logging/json-logger.js';

async function bootstrap(): Promise<void> {
  loadLocalEnvFile();
  const env = loadEnv();
  const app = await NestFactory.create(AppModule, {
    logger: new JsonLogger('Nest'),
  });
  configureApp(app);
  await app.listen(env.port, '0.0.0.0');
  writeLog('info', 'api.listening', {
    context: 'Bootstrap',
    port: env.port,
    health: `http://127.0.0.1:${env.port}/api/v1/health`,
    docs:
      env.nodeEnv === 'production'
        ? null
        : `http://127.0.0.1:${env.port}/api/docs`,
  });
}

bootstrap().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'unknown startup error';
  writeLog('error', 'api.startup_failed', {
    context: 'Bootstrap',
    detail: message,
  });
  process.exit(1);
});
