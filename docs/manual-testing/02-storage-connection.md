# Manual test — Module 2 configuration report

The API must be running a build that includes `GET /api/v1/storage/connection`. PostgreSQL is not involved. Do not add Drive credentials for this test.

## 1. Unconfigured report

```bash
curl -sS -D - http://127.0.0.1:43124/api/v1/storage/connection -H 'X-Request-Id: drive-check'
```

Expect HTTP 200, header `x-request-id: drive-check`, and a body with:

- `"status":"not_configured"`
- `"provider":"google_drive"`
- `"liveCheck":"not_run"`
- `"correlationId":"drive-check"`
- `missing` containing `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` when those two are unset

A workstation `.env` that already has the client id and secret returns `status: configured` and `missing: ["GOOGLE_DRIVE_ID"]`. The body still must not contain the client id or the secret.

The body must not contain `dam_local_dev_only` or any client secret. The API log for that call is `request.completed` with path `/api/v1/storage/connection`. It must not contain a bearer token.

## 2. Health is unchanged

```bash
curl -sS http://127.0.0.1:43124/api/v1/health
```

Expect `checks.database` and no Drive field. Open http://127.0.0.1:43123/ and confirm the status table still lists Web app, API, and PostgreSQL only.

Open http://127.0.0.1:43124/api/docs and confirm a storage tag whose description says this is not a live Google call.

## 3. What you cannot prove here

There is no shared drive to open. Do not mark the module complete from this test. A later test, after the four settings exist, must show a failed or successful live Drive call and must still hide the secret.

## Partial configuration

To see the startup refusal, stop the API and set only `GOOGLE_CLIENT_ID` in `.env`, then start it. Expect the process to exit with `Invalid environment` and `GOOGLE_CLIENT_SECRET`. Put the secret back, or remove the client id, before starting again. Do not leave a secret in the shell history.
