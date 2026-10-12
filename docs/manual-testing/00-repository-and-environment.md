# Manual test — Module 0

Do this on a machine that can run the two processes and PostgreSQL. The steps below match the ports in `.env.example`.

## Preconditions

1. Node.js 22.23.3 (`node -v`).
2. pnpm 10 (`pnpm -v`).
3. PostgreSQL 16 with role `dam` / password `dam_local_dev_only`, databases `dam` and `dam_test`.
4. From the repository root: `cp .env.example .env`, `pnpm install`, `pnpm db:migrate`.
5. Also migrate the test database:

```bash
DATABASE_URL="postgresql://dam:dam_local_dev_only@127.0.0.1:5432/dam_test?schema=public" \
  pnpm --filter @aaradhya/api exec prisma migrate deploy
```

## 1. Start and read the logs

Terminal A:

```bash
pnpm dev:api
```

Expect a JSON line `api.listening` with `"port":43124`.

Terminal B:

```bash
pnpm dev:web
```

Expect Vite to print a local URL on port 43123.

## 2. Call the API directly

```bash
curl -sS -D - http://127.0.0.1:43124/api/v1/health -H 'X-Request-Id: manual-check'
```

Expect HTTP 200, header `x-request-id: manual-check`, and a body with `"status":"ok"`, `"checks.database.status":"up"`, and `"correlationId":"manual-check"`.

In terminal A, expect one JSON object with `"message":"request.completed"`, the same correlation id, `"path":"/api/v1/health"`, and `"statusCode":200`.

```bash
curl -sS http://127.0.0.1:43124/api/v1/health/live
curl -sS -D - http://127.0.0.1:43124/api/v1/missing -o /tmp/missing.json -w "%{http_code}\n"
```

Live returns 200 and has no `checks` field. Missing returns 404 and `/tmp/missing.json` has `"error":"not_found"` and no `stack`. The API log path for that call is `/api/v1/missing`.

```bash
curl -sS -D - -o /dev/null http://127.0.0.1:43124/api/v1/health/live -H 'X-Request-Id: bad id'
```

The response `x-request-id` is a UUID, not `bad id`.

Open http://127.0.0.1:43124/api/docs and confirm the health routes are listed.

## 3. Use the page

1. Open http://127.0.0.1:43123/
2. Expect the heading "Environment status", Web app Up, API Up, PostgreSQL Up, overall Ready, a timestamp, and a correlation id.
3. Click "Refresh status". It may say Checking, then Ready again.
4. Open http://127.0.0.1:43123/not-a-page . Expect "Page not available". Follow "Back to environment status".
5. Narrow the window to phone width. The word Up remains visible. The page does not require horizontal scrolling to read the status.

In the browser network panel, the page request to `/api/v1/health` is status 200. That request is proxied to port 43124. You should not see a CORS error on that same-origin call.

## 4. Database evidence

```bash
PGPASSWORD=dam_local_dev_only psql -h 127.0.0.1 -U dam -d dam -c '\dt'
PGPASSWORD=dam_local_dev_only psql -h 127.0.0.1 -U dam -d dam -c 'SELECT migration_name, finished_at FROM _prisma_migrations;'
```

Expect no business tables. Expect migration `20261010120000_init_baseline`.

There is no Google Drive folder to inspect.

## 5. Stop PostgreSQL on purpose

Stop only the database, leave the API running, then:

```bash
curl -sS -w "\nHTTP %{http_code}\n" http://127.0.0.1:43124/api/v1/health
curl -sS -w "\nHTTP %{http_code}\n" http://127.0.0.1:43124/api/v1/health/ready
curl -sS -w "\nHTTP %{http_code}\n" http://127.0.0.1:43124/api/v1/health/live
```

Expect health HTTP 200 with `"status":"degraded"` and a `database.category` such as `connection_refused`. Expect ready HTTP 503. Expect live HTTP 200. The body must not contain `dam_local_dev_only`. The API log contains `database.health_failed` and a redacted URL if a URL was in the driver error.

Reload http://127.0.0.1:43123/ . PostgreSQL shows Down and the category. API stays Up. Overall says Degraded.

Start PostgreSQL again. Refresh. Ready returns.

## 6. Automated checks

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm build
```

All five should exit 0.

## Evidence to keep

- The health JSON.
- The 404 JSON.
- The `_prisma_migrations` query output.
- A note of pass or fail for the stopped-database check.

## Troubleshooting

See `docs/operations/troubleshooting.md`.

## Cleanup

Stop the two terminals. If you used Docker only for this test and want the volume gone:

```bash
docker compose down
```

Add `-v` only if you intend to delete the local database volume. There is no business data in Module 0, but the command still destroys the volume.
