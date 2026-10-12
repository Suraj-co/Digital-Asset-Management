# Module 15 — Rate limit

## A. Purpose and status

One client address cannot call this API without a limit. The count stays in this process.

Status: **ready for manual verification**. Not COMPLETE until that verification is recorded.

## B. Functionality

| Name | Purpose | Role | UI | API | Data | External | Security | Tests |
|---|---|---|---|---|---|---|---|---|
| Count | Refuse the next request after the window is full | Any caller | Environment status names the refusal. It does not show the counter | HTTP 429 on the next request | Memory in this process | None | Socket address only. `X-Forwarded-For` is ignored | Unit, e2e, page test |

## C. Not in this module

- A shared count across API processes.
- Redis.
- An account lock after bad passwords.
- A live Google call.
- Backups and production deploy. That is Module 16.

## D. Files

- `apps/api/src/http/rate-limit.ts`
- `apps/web/src/pages/EnvironmentStatusPage.tsx`
- ADR 0021.

## E. Tests

The limiter allows the max, refuses the next call, and starts again when the window ends. The HTTP test uses a limit of 2 and expects the third `GET /api/v1/health/live` to be 429. The page test shows Limited without marking PostgreSQL down. Counts are in `TESTING_STATUS.md`.

## F. Manual verification

Steps are in `docs/manual-testing/15-rate-limit.md`. Product-owner confirmation is still open.

## G. Health

No new outbound call. The counter is not in PostgreSQL. See `SYSTEM_HEALTH.md`.

## H. Showcase

`/` still reports the API and PostgreSQL. The description says a client that calls too often is refused, and that this page does not show the counter.
