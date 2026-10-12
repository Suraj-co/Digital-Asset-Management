# Module 0 — Repository and environment

## Purpose

Make the repository start, connect to PostgreSQL, and expose enough diagnostics that a later failure can be traced. Record the design the other modules have to follow.

## Exit condition

The project starts and the environment is documented. Status: ready for manual verification. Not COMPLETE until that verification is recorded.

## Functionality

| Name | Purpose | Role | UI | API | Data | External | Security | Tests |
|---|---|---|---|---|---|---|---|---|
| Workspace | Install and run both apps | Operator | — | — | — | — | Lockfile, Prisma build scripts allowed | Install, build |
| Environment validation | Refuse a bad configuration | Operator | — | startup | — | — | URL must be PostgreSQL | `env.spec.ts` |
| Liveness | Show the process is up | Operator, probe | Status page indirectly | `GET /api/v1/health/live` | None | None | Public, no business data | Controller unit, e2e |
| Readiness and health | Show PostgreSQL | Operator, probe | Environment status | `GET /api/v1/health`, `/ready` | `SELECT 1` | PostgreSQL | Category only, no driver text | Service unit, e2e, live curl |
| Correlation and logs | Trace one call | Operator | Correlation id on the page | `X-Request-Id` | None | None | Unsafe ids replaced; URL passwords redacted | Unit, e2e |
| Error body | Avoid leaking internals | Any caller | Unreachable and invalid states | Exception filter | None | None | Fixed 500 message | Filter unit, e2e 404 |
| OpenAPI | Read the health contract | Operator | — | `GET /api/docs` | None | None | Off in production | E2e status 200 or 301 |
| Status page | See the checks without curl | Operator | `/` | via proxy | None | API | Public | View tests |
| Not-found page | Avoid a blank route | Operator | `*` | — | None | None | — | Not automated in the browser |
| Baseline migration | Start the migration history | Operator | — | — | `_prisma_migrations` | PostgreSQL | No business data | `migrate deploy` on `dam` and `dam_test` |

## Not in this module

- Design system, sidebar, company selector, login, users, roles.
- The five company rows. They are specified, not seeded.
- Google Drive, uploads, versions, workflow, tasks, timesheets, dashboards, notifications, audit.
- Redis, BullMQ, application Docker images, backups.
- Playwright.
- Rate limiting.
- Any button that pretends to create an asset.

## Dependencies

Node.js 22.23.3, pnpm 10.33.4, PostgreSQL 16, packages in the lockfile. No Google credential.

## How to operate

See the root `README.md` and `docs/manual-testing/00-repository-and-environment.md`.

## Limitations

Docker Compose and GitHub Actions were not executed here. See `SYSTEM_HEALTH.md`.

Module 1 replaced `AppHeader` with the application shell. The environment status checks are unchanged. The page no longer carries its own header.
