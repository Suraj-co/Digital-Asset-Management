# Troubleshooting

Use one correlation id from the browser or from `X-Request-Id` and follow it downward. Module 0 has no asset id to follow.

## From the page to the API

1. Open the status page at http://127.0.0.1:43123/ .
2. If the API row says Down, the browser did not get a health document. Check that `pnpm dev:api` is running and that Vite's proxy target is `http://127.0.0.1:43124`. In the browser network panel, `/api/v1/health` should be requested on port 43123, not blocked as CORS. A direct call to port 43124 from a different origin uses CORS and only allows `WEB_ORIGIN`.
3. If the API row says Up and PostgreSQL says Down, copy the correlation id and the category.

## From the API log

Search stdout for the correlation id. A completed call is `request.completed` with method, path, status, and duration. A failure is `request.failed` with `error` and, for server errors, `detail`.

The path is the original URL without the query string. If you are looking at an older log line that says `/missing` for a call to `/api/v1/missing`, that was the defect fixed in Module 0. Rebuild and restart the API if you still see it.

## Categories

| Category or symptom | Likely cause | What to do |
|---|---|---|
| Startup `Invalid environment` | `.env` missing or wrong | Copy `.env.example`. Commands run with the working directory at the repo root or at `apps/api`. Both are loaded. |
| `connection_refused` | PostgreSQL is stopped or the port is wrong | `docker compose ps` or `pg_lsclusters`. Start it. Readiness stays 503 until it answers. |
| `authentication_failed` | Role or password does not match `DATABASE_URL` | Compare the URL with the role. Do not paste the URL into a ticket without removing the password. The log redactor removes `user:password@` when the message uses that shape. |
| `database_not_found` | Database `dam` was not created | Create it, then `pnpm db:migrate`. |
| `timeout` | Host unreachable or firewall | Check the host in the URL and security groups. Connect timeout is 5 seconds. |
| `database_unavailable` | Anything else from the driver | Read `detail` in the server log. The client only has the category. |
| API process will not start, Nest CLI error `ERR_REQUIRE_CYCLE_MODULE` | Node.js 22.14.0 | Use 22.23.3. |
| `class-validator` package is missing | Dependencies not installed after a partial install | `pnpm install` from the root. |
| Prisma generate cannot find `DATABASE_URL` | Environment not loaded | Export it or provide `.env` at the repo root. |
| Port already in use | Another process on 43123 or 43124 | Stop that process. The servers do not switch ports silently. |

## Database checks

```bash
PGPASSWORD=dam_local_dev_only psql -h 127.0.0.1 -U dam -d dam -c 'SELECT 1;'
PGPASSWORD=dam_local_dev_only psql -h 127.0.0.1 -U dam -d dam -c 'SELECT migration_name FROM _prisma_migrations;'
```

`SELECT 1` is the same statement the health check runs. If `psql` fails and the API reports `up`, you are not talking to the same database as `DATABASE_URL`.

## Google Drive

`GET /api/v1/storage/connection` says whether the client id and secret are present. It does not call Drive. `GOOGLE_DRIVE_ID` may be listed as missing without stopping the API. A missing file in Drive still cannot be diagnosed. When a live call exists, classify the failure as authentication, authorization, invalid request, missing, quota, transient, or database before changing code.

## What not to collect

Do not attach `.env`, refresh tokens, or a full database dump to a bug report. The correlation id, status code, error category, path, and timestamp are enough for Module 0.
