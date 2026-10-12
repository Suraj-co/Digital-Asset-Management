# Deployment architecture

## Implemented

Local development only.

```text
developer machine
  pnpm dev
    apps/web   Vite  0.0.0.0:43123
    apps/api   Nest  0.0.0.0:43124
  PostgreSQL 16      127.0.0.1:5432
```

`docker-compose.yml` publishes PostgreSQL and, with `--profile jobs`, Redis. It does not start the API image. `deploy/api.Dockerfile` defines that image. It was not built in this workspace. Docker was not installed. The Compose database password is the workstation password, so that file must not be used as a production host.

GitHub Actions workflow `.github/workflows/ci.yml` installs dependencies, creates `dam_test` if needed, migrates, lints, typechecks, runs unit and end-to-end tests, and builds. It has not been observed on a runner.

## Planned production shape

```text
Browser -- TLS --> web static host
Browser -- TLS --> API process
API --> private PostgreSQL
API --> Google Drive
optional worker --> Redis
```

One API process is enough until a measurement says otherwise. Do not add Kubernetes to look complete.

## Configuration

| Variable | Local | Production |
|---|---|---|
| `NODE_ENV` | `development` | `production` |
| `PORT` | `43124` | platform port |
| `WEB_ORIGIN` | `http://127.0.0.1:43123` | the real web origin |
| `DATABASE_URL` | local role `dam` | secret. Production startup refuses the example password |
| `LOG_LEVEL` | `info` | `info`, `warn` if volume requires it |

Production turns on Helmet content-security policy and HSTS, and it does not serve `/api/docs`.

## Release checks

Lint, typecheck, unit tests, API tests against a migrated database, and a production build. A green build is not a claim that Drive or auth works.

## Release start

`node scripts/start-release.mjs` from `apps/api` checks the database password, runs `prisma migrate deploy`, then `node dist/main.js`. Migrations are forward-only. There is no down migration. The development process does not use this script.

## Backup

`node scripts/backup-database.mjs` writes a plain SQL dump to an absolute `BACKUP_PATH` outside the repository. The file stays on that machine. It is not uploaded. Google Drive retention is not configured. Restore means loading that dump into a new database after an operator checks it. Do not point the running API at the dump first.

## Rollback

Rollback is the previous build. Leave the schema in place. If the previous build cannot read the new schema, restore a dump into a new database and point a new process at that database. Do not run a down migration. None are in this repository.
