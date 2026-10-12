# Aaradhya DAM

Enterprise digital asset management for BAPL, SAPL, GBAPL, KABPL, and Ontale. SAPL replaces ASEDS. ASEDS is not an active company.

This repository has the environment, the shell, a Drive configuration report, server sessions, company membership, a folder catalog, a failed-upload record, metadata search, version history, approval decisions, task plans, time entries, dashboard counts and charts, a payroll total from accepted minutes, in-app notices with an email copy, and an audit log. Google is not called. The company menu lists memberships and does not grant access. Files are not stored. Approval does not move a file. A task does not record time. A time entry stores the minutes a person entered. The payroll total is accepted minutes times a company hourly rate an admin sets. A dashboard charts those stored counts. A notice is a row in the app. Redis queues an email copy, and that copy is sent only when SMTP is configured. An audit sentence is inserted with a completed company change and is not updated. One client address is limited inside this API process. Over that limit the response is HTTP 429. The count is not shared with another process. Production refuses the workstation database password. A backup is a local SQL dump and is not uploaded. The steps still required for a file showcase are in `docs/showcase.md`.

## What is running

| Surface | URL | Role |
|---|---|---|
| Web | http://127.0.0.1:43123 | Environment status, inside the application shell |
| Design system | http://127.0.0.1:43123/design-system | Shared controls. Nothing on this page is saved |
| Sign in | http://127.0.0.1:43123/sign-in | Server session. No public registration |
| Companies | http://127.0.0.1:43123/companies | Membership for the signed-in user |
| Folders | http://127.0.0.1:43123/folders | Stored folder paths. No Drive folder is created |
| Assets | http://127.0.0.1:43123/assets | Recorded uploads. Search matches code, title, or file name. The file is not stored |
| Tasks | http://127.0.0.1:43123/tasks | Planned work for the selected company. Time is not recorded |
| Time | http://127.0.0.1:43123/time | Minutes a person entered. The payroll total is on the dashboard |
| Dashboard | http://127.0.0.1:43123/dashboard | Stored counts, charts, and the payroll total |
| Notifications | http://127.0.0.1:43123/notifications | In-app notices and the email-copy status |
| Audit | http://127.0.0.1:43123/audit | Stored sentences for an admin of the selected company |
| API health | http://127.0.0.1:43124/api/v1/health | Process and database report |
| Liveness | http://127.0.0.1:43124/api/v1/health/live | Process only. Does not query PostgreSQL |
| Readiness | http://127.0.0.1:43124/api/v1/health/ready | HTTP 503 when PostgreSQL does not answer |
| Drive report | http://127.0.0.1:43124/api/v1/storage/connection | Whether Drive settings exist. Does not call Google |
| OpenAPI | http://127.0.0.1:43124/api/docs | Served when `NODE_ENV` is not `production` |

During development the web server proxies `/api` to the API, so the browser calls same-origin `/api/v1/health`.

## Prerequisites

- Node.js 22.23.3 (see `.nvmrc`). The NestJS 12 CLI crashes on Node.js 22.14.0.
- pnpm 10.33.4 (`corepack enable` uses the `packageManager` field).
- PostgreSQL 16.

Docker Compose is the supported way to start PostgreSQL. This workspace was also verified against a PostgreSQL 16 install on the host because Docker was not available there. Redis queues email copies. Start it with `docker compose --profile jobs up -d redis`, or run Redis yourself and set `REDIS_URL`. The site still opens when Redis is down; the email copy stays in the app.

## Start PostgreSQL

```bash
docker compose up -d
docker compose ps
docker compose logs postgres
```

The Compose file creates the `dam` database and, on a new volume, `dam_test`. Role `dam`, password `dam_local_dev_only`. Those credentials are for a private workstation and CI only.

If you already have PostgreSQL 16:

```sql
CREATE ROLE dam LOGIN PASSWORD 'dam_local_dev_only';
CREATE DATABASE dam OWNER dam;
CREATE DATABASE dam_test OWNER dam;
```

## Configure and run

```bash
cp .env.example .env
pnpm install
pnpm db:migrate
pnpm dev
```

`pnpm dev` starts the API on port 43124 and the web app on port 43123. Run them separately with `pnpm dev:api` and `pnpm dev:web` when you want one log stream each.

Open http://127.0.0.1:43123. There is no public registration. Create the first account from `apps/api`, then grant a company:

```bash
CREATE_USER_EMAIL=you@example.com CREATE_USER_PASSWORD='a-long-password' \
  node scripts/create-user.mjs
GRANT_MEMBERSHIP_EMAIL=you@example.com GRANT_MEMBERSHIP_COMPANY=SAPL GRANT_MEMBERSHIP_ROLE=admin \
  node scripts/grant-membership.mjs
```

The password must be at least 12 characters. It is stored only as a hash.

Apply the same migrations to the test database before end-to-end tests if `TEST_DATABASE_URL` points somewhere that has not been migrated:

```bash
DATABASE_URL="postgresql://dam:dam_local_dev_only@127.0.0.1:5432/dam_test?schema=public" \
  pnpm --filter @aaradhya/api exec prisma migrate deploy
```

`pnpm db:migrate` uses `DATABASE_URL` from the environment or from `.env`.

Google uses two lines in `.env`: `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`. That file is gitignored. The redirect URI defaults to `http://127.0.0.1:43124/api/v1/storage/oauth/callback`. Leave `GOOGLE_DRIVE_ID` unset until you have a Shared Drive id. The connection report does not call Google and does not return those values.

## Inspect logs

API logs are single-line JSON on stdout and stderr. A normal health check looks like:

```json
{"level":"info","message":"request.completed","correlationId":"manual-check","method":"GET","path":"/api/v1/health","statusCode":200}
```

Pass any safe `X-Request-Id` header (`A-Z`, `a-z`, `0-9`, `.`, `_`, `:`, `-`, up to 128 characters) and the same value comes back on the response and in the log. Anything else is replaced with a UUID. Passwords and `postgresql://user:password@` URLs are stripped from log lines.

Do not log or paste access tokens. Module 0 does not use any.

## Verify

```bash
curl -sS http://127.0.0.1:43124/api/v1/health | jq
curl -sS -o /dev/null -w "%{http_code}\n" http://127.0.0.1:43123/
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm build
```

A healthy body has `"status":"ok"` and `"checks.database.status":"up"`. Step-by-step checks, including a stopped database, are in `docs/manual-testing/00-repository-and-environment.md`.

## Layout

```text
apps/api     NestJS 12 API
apps/web     Vite, React 19, Tailwind 4
docs         Requirements, architecture, ADRs, module notes, manual tests
```

Read `BUILD_STATUS.md` before adding a feature. A live Google Drive call waits on credentials. Do not add asset or login behavior to the status page or the design-system page.

## Production build

```bash
pnpm build
pnpm --filter @aaradhya/api start
pnpm --filter @aaradhya/web preview
```

`NODE_ENV=production` turns on Helmet's content-security policy and strict-transport-security, and it does not serve Swagger. It also refuses `DATABASE_URL` when the password is the workstation password from `.env.example`.

A release process, from `apps/api`, is `node scripts/start-release.mjs`. It checks that password, applies forward migrations, and listens. There is no down migration.

A local dump, from `apps/api`:

```bash
BACKUP_PATH=/tmp/aaradhya-dam.sql node scripts/backup-database.mjs
```

The path must be outside this repository. Delete the file when you are done. It contains password hashes. Nothing uploads it.

`deploy/api.Dockerfile` is the API image. It was not built in this workspace. Docker was not installed. See `docs/architecture/13-deployment-architecture.md`.
