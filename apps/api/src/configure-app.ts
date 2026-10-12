import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { loadEnv } from './config/env.js';
import { AllExceptionsFilter } from './http/all-exceptions.filter.js';
import { rateLimitMiddleware, RequestRateLimiter } from './http/rate-limit.js';
import { requestContextMiddleware } from './http/request-context.middleware.js';
import { APP_NAME, APP_VERSION } from './version.js';

export type ConfigureAppOptions = {
  rateLimiter?: RequestRateLimiter;
};

export function configureApp(
  app: INestApplication,
  options: ConfigureAppOptions = {},
): void {
  const env = loadEnv();
  const production = env.nodeEnv === 'production';
  const rateLimiter =
    options.rateLimiter ??
    new RequestRateLimiter(env.rateLimitMax, env.rateLimitWindowMs);

  app.setGlobalPrefix('api/v1');
  app.enableCors({
    origin: env.webOrigin,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
    exposedHeaders: ['X-Request-Id', 'Retry-After'],
  });
  app.use(
    helmet({
      // Swagger UI needs a relaxed content policy. Production does not serve
      // Swagger in this module, so the default Helmet policy stays on there.
      // HSTS is also production-only: this API is served over plain HTTP in
      // local development, and a remembered HSTS policy would break that.
      contentSecurityPolicy: production ? undefined : false,
      crossOriginEmbedderPolicy: false,
      strictTransportSecurity: production ? undefined : false,
    }),
  );
  app.use(rateLimitMiddleware(rateLimiter));
  app.use(requestContextMiddleware);
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.enableShutdownHooks();

  if (!production) {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle('Aaradhya DAM API')
        .setDescription(
          'Versioned HTTP API for the Aaradhya digital asset platform. Health, the Drive configuration report, server sessions, and company membership are live. The Drive report does not call Google. Each client address is limited in this process.',
        )
        .setVersion(APP_VERSION)
        .addTag('health', 'Process and dependency probes')
        .addTag(
          'storage',
          'Drive configuration and the folder catalog. Neither calls Google.',
        )
        .addTag('session', 'Server sessions. The token is an httpOnly cookie.')
        .addTag('companies', 'Company membership. The list is the caller’s companies.')
        .addTag('users', 'Users in companies the caller administers.')
        .addTag(
          'assets',
          'Upload attempts. The file is not stored and Google is not called.',
        )
        .build(),
    );
    SwaggerModule.setup('api/docs', app, document, {
      customSiteTitle: `${APP_NAME} docs`,
    });
  }
}
