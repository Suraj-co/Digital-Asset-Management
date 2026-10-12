# ADR 0005 — Local ports and development credentials

## Status

Accepted. Module 0.

## Problem

Default ports 3000, 5173, and 8080 collide with other local tools. A database password still has to exist for Docker and for this workstation.

## Decision

| Service | Port |
|---|---|
| Web | 43123 |
| API | 43124 |
| PostgreSQL | 5432 |

The development role is `dam` with password `dam_local_dev_only`. It is documented in `.env.example` and is only for a private workstation or CI service container. Production must replace it.

The web dev server proxies `/api` to `http://127.0.0.1:43124`, so the browser calls the same origin during development.

## Alternatives

- Environment-selected ports with no project default. Rejected. Manual tests need stable URLs.

## Trade-offs

Two fixed ports can still collide. Both servers use `strictPort` semantics (Vite) or an explicit bind (API) so a collision fails loudly instead of moving to a random port.

## Security

`.env` is gitignored. `.env.example` holds the local password on purpose so setup is repeatable. Do not point `.env.example` at a shared or production database.

## Scaling limit

Not a runtime scaling decision.

## Revisit when

A deployed environment is introduced in Module 16. Production origins, secrets, and ports are a separate configuration, not a copy of this file.
