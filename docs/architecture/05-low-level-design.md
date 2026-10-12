# Low-level design

Module 0 components. Planned modules are named so later work has a place to land. Their classes do not exist.

## API composition

```text
main.ts
  loadLocalEnvFile()     root .env or apps/api/.env
  loadEnv()              Zod. Exit 1 on failure.
  NestFactory.create
  configureApp()
  listen 0.0.0.0:PORT
```

`loadEnv` returns:

| Field | Source | Rule |
|---|---|---|
| `nodeEnv` | `NODE_ENV` | `development`, `test`, or `production`. Default `development`. |
| `port` | `PORT` | Integer 1–65535. Default 43124. |
| `webOrigin` | `WEB_ORIGIN` | Absolute URL. Default `http://127.0.0.1:43123`. |
| `databaseUrl` | `DATABASE_URL` | Must start with `postgres://` or `postgresql://`. Production refuses the workstation password. |
| `logLevel` | `LOG_LEVEL` | `debug`, `info`, `warn`, `error`. Default `info`. |
| `rateLimitMax` | `RATE_LIMIT_MAX` | Integer 1–10000. Default 240. |
| `rateLimitWindowMs` | `RATE_LIMIT_WINDOW_SECONDS` | Integer 1–3600, stored as milliseconds. Default 60 seconds. |

## Health report

`HealthService.check` always fills `checks.api.status = "up"` because the handler is running. It then runs `SELECT 1` through Prisma. Success sets `database.status = "up"` and `latencyMs`. Failure sets `database.status = "down"`, `latencyMs = null`, and a category from `classifyDatabaseError`. The HTTP body never includes the driver message.

| Route | Database | HTTP |
|---|---|---|
| `GET /api/v1/health/live` | Not called | 200 |
| `GET /api/v1/health` | Called | 200 even when degraded |
| `GET /api/v1/health/ready` | Called | 200 or 503 |

## PostgreSQL access

`PrismaService` extends the generated `PrismaClient` and passes `@prisma/adapter-pg` a connection string plus `connectionTimeoutMillis: 5000`. It disconnects on module destroy. It does not connect during bootstrap (ADR 0003).

The schema generator writes TypeScript to `apps/api/src/generated/prisma`, which is gitignored. `moduleFormat` is omitted so Prisma follows the ESM Nest project.

The only migration, `20261010120000_init_baseline`, executes `SELECT 1`. It exists so later migrations have a parent. There are no business tables.

## Errors

`AllExceptionsFilter` maps:

| Situation | HTTP | `error` |
|---|---|---|
| `HttpException` 4xx | that status | category such as `not_found` |
| `HttpException` 5xx | that status | `internal_error`, fixed message |
| Prisma or driver connection/auth/missing database | 503 | `database_unavailable` |
| Anything else | 500 | `internal_error`, fixed message |
| More requests than `RATE_LIMIT_MAX` from one socket address in the window | 429 | `too_many_requests`. Not written once per request. |

Server logs include a redacted `detail` for 5xx. The client body does not.

## Web

`fetchHealthReport` calls `/api/v1/health` and parses it with Zod. Network failure becomes "unreachable". A JSON body that is not the contract becomes "invalid". The view component is separate from the loader so tests can render each state without a server.

Routes: `/` status, everything else `NotFoundPage`.

## Logging

`writeLog` prints one JSON object. `LOG_LEVEL` drops quieter lines. The redactor replaces `postgresql://user:password@` with `postgresql://***@`. Query strings are not logged.
