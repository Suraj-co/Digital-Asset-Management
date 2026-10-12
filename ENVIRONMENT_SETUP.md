# Environment setup

Names only. Do not copy values from `.env` into docs, tickets, or chat.

## Required for the API process

Loaded by `apps/api/src/config/env.ts` (`loadEnv`) after `loadLocalEnvFile` reads `.env` in the API cwd and `../../.env`.

| Name | Purpose |
|---|---|
| `NODE_ENV` | `development`, `test`, or `production`. Swagger is off in production |
| `PORT` | HTTP port. Default `43124` |
| `WEB_ORIGIN` | Browser origin allowed by CORS. Default `http://127.0.0.1:43123` |
| `DATABASE_URL` | PostgreSQL URL, schema `public`. Required |
| `LOG_LEVEL` | `debug`, `info`, `warn`, or `error`. Default `info` |
| `RATE_LIMIT_MAX` | Requests per window. Default `240` |
| `RATE_LIMIT_WINDOW_SECONDS` | Window length. Default `60` |

Production refuses a `DATABASE_URL` that uses the workstation password checked in `env.ts`.

## Tests

| Name | Purpose |
|---|---|
| `TEST_DATABASE_URL` | e2e Vitest database. Same host and user as local dev, different database name. Not read by the running API |

e2e config: `apps/api/vitest.config.e2e.ts` (`fileParallelism: false`).

## Redis and mail

Read by `apps/api/src/mail/mail-settings.ts`. Both are optional. Missing Redis keeps the in-process poll. Missing SMTP marks email `held`.

| Name | Purpose |
|---|---|
| `REDIS_URL` | Must start with `redis://` or `rediss://`. Queues `mail` and `drive-cleanup` |
| `SMTP_HOST` | SMTP server. If any SMTP name is set, host, port, and from are required |
| `SMTP_PORT` | 1–65535 |
| `SMTP_FROM` | From address |
| `SMTP_USER` | Optional. Required when `SMTP_PASSWORD` is set |
| `SMTP_PASSWORD` | Optional. Required when `SMTP_USER` is set |

## Google

Uploads: `apps/api/src/storage/google-workspace.ts`. Connection report: `drive-settings.ts`.

| Name | Purpose |
|---|---|
| `GOOGLE_CLIENT_ID` | OAuth client. Required for Drive |
| `GOOGLE_CLIENT_SECRET` | OAuth secret. Required for Drive |
| `GOOGLE_REFRESH_TOKEN` | Saved by the OAuth callback. Required for uploads |
| `GOOGLE_REDIRECT_URI` | Callback URL. Default `http://127.0.0.1:43124/api/v1/storage/oauth/callback`. Must match the Google client |
| `GOOGLE_DRIVE_ID` | Required by `GET /api/v1/storage/connection` |
| `GOOGLE_DRIVE_ROOT_ID` | Used as the upload root when `GOOGLE_DRIVE_ID` is blank |
| `GOOGLE_SHEETS_ID` | Optional spreadsheet id for history export |

Drive is ready only when client id, client secret, refresh token, and a root id are all present. Otherwise uploads record an asset and do not store bytes.

The OAuth callback writes `GOOGLE_REFRESH_TOKEN` into the env file. Treat that file as secret.

## Local services

| Service | Typical local use |
|---|---|
| Node.js | `>=22.12.0` (`package.json` engines) |
| pnpm | `10.33.4` |
| PostgreSQL | `DATABASE_URL` |
| Redis | `REDIS_URL`, optional for queues |

Web dev server: port `43123`, proxies `/api` to `http://127.0.0.1:43124`.

## Commands

From `Aaradhya_DAM`:

```
pnpm install
pnpm dev:api
pnpm dev:web
pnpm --filter @aaradhya/api prisma:migrate
pnpm --filter @aaradhya/web test
pnpm --filter @aaradhya/web typecheck
pnpm --filter @aaradhya/api test
pnpm --filter @aaradhya/api test:e2e
pnpm build
```

API dev script generates the Prisma client and runs Nest in watch mode. The client output is `apps/api/src/generated/prisma`. Do not edit that directory.

Health: `http://127.0.0.1:43124/api/v1/health`.

Cookie session requires the web origin and the API origin to match `WEB_ORIGIN` and the Vite proxy. Call the API with credentials.

## What not to commit

`.env`, refresh tokens, SMTP passwords, OAuth client secrets, and database passwords. This file lists names only.
