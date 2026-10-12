# ADR 0003 — A down database does not stop API startup

## Status

Accepted. Module 0.

## Problem

The Nest Prisma recipe connects in `onModuleInit` and fails the process if PostgreSQL is down. That hides the API from operators at the moment they need a health report and a correlation id.

## Decision

`PrismaService` builds the client at startup but does not call `$connect()` during bootstrap. The first query connects. `GET /api/v1/health` returns HTTP 200 with `status: "degraded"` when the database check fails. `GET /api/v1/health/ready` returns HTTP 503 in that case. `GET /api/v1/health/live` never queries the database.

## Alternatives

- Fail startup when the database is down. Rejected for this service because liveness and diagnostics would disappear with the dependency.
- Cache a successful check for several seconds. Deferred. Module 0 traffic does not justify it, and a cache would hide a database outage.

## Trade-offs

The first request after a database recovery pays the connect cost. A misconfigured `DATABASE_URL` is still rejected at startup by Zod, before listen.

## Security

Database errors returned to clients are categories (`connection_refused`, `timeout`, `authentication_failed`, `database_not_found`, `database_unavailable`). Driver text stays in server logs, with credentials redacted.

## Scaling limit

Every health report runs `SELECT 1`. A load balancer polling `/health/ready` faster than once a second should be reconsidered before that path is used as a public probe.

## Revisit when

The process is placed behind an orchestrator that restarts unhealthy containers. Readiness should remain the failing probe. Liveness should stay independent of PostgreSQL.
