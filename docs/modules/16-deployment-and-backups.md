# Module 16 — Deployment and backups

## A. Purpose and status

Production refuses the workstation database password. An operator can dump PostgreSQL to a file outside the repository. This repository does not deploy itself.

Status: **ready for manual verification**. Not COMPLETE until that verification is recorded.

## B. Functionality

| Name | Purpose | Role | UI | API | Data | External | Security | Tests |
|---|---|---|---|---|---|---|---|---|
| Refuse workstation password | Stop production from using the example password | Operator | The status page says it does not deploy | Startup check | None | None | The error does not repeat the password | `env.spec.ts` |
| Release start | Apply forward migrations, then listen | Operator | — | `scripts/start-release.mjs` | PostgreSQL schema | None | Same password check before migrate | Script exit when the password is the example |
| Local dump | Write a plain SQL dump | Operator | The status page says a backup is an operator dump | `scripts/backup-database.mjs` | PostgreSQL | `pg_dump` on the operator machine | Path must be outside the repository | Path unit test. One local dump, then deleted |

## C. Not in this module

- A running production host.
- TLS.
- An offsite or scheduled backup.
- Google Drive retention.
- A down migration.
- A built container image. The Dockerfile is present. Docker was not installed here.
- A live Google call.

## D. Files

- `apps/api/scripts/start-release.mjs`
- `apps/api/scripts/backup-database.mjs`
- `deploy/api.Dockerfile`
- ADR 0022.

## E. Tests

Production `loadEnv` throws on the workstation password and allows a different password. The path helper rejects a dump inside the repository. Counts are in `TESTING_STATUS.md`.

## F. Manual verification

Steps are in `docs/manual-testing/16-deployment-and-backups.md`. Product-owner confirmation is still open.

## G. Health

No new outbound call. The running API stays on the workstation database. See `SYSTEM_HEALTH.md`.

## H. Showcase

`/` still reports the API and PostgreSQL. It says a backup is a database dump an operator runs outside this page, and that this page does not deploy.
