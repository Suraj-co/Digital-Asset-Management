# ADR 0004 — Redis is not an application dependency yet

## Status

Superseded for the mail queue by ADR 0024. Rate limiting still does not use Redis. Module 0.

## Problem

The stack list includes Redis and BullMQ for background jobs. Module 0 has no job that needs a queue. Starting Redis anyway would add a service that nothing checks.

## Decision

`docker-compose.yml` defines Redis under the Compose profile `jobs`. `docker compose up -d` starts PostgreSQL only. The API does not open a Redis connection and the health report does not claim Redis is healthy.

## Alternatives

- Run Redis in Module 0 and report it as up. Rejected. That would present an unused dependency as part of the product.
- Omit Redis from Compose until the first job. Considered. The profile keeps the intended image and port documented without starting it.

## Trade-offs

The first module that needs retries across process restarts must enable the profile, add a client, and extend the health report. Until then, failed Drive operations cannot be queued.

## Security

No Redis port is required for Module 0. When the profile is enabled, Redis is bound for local development only and has no authentication in the Compose file. That file must not be copied to production unchanged.

## Scaling limit

Not applicable until a worker exists.

## Revisit when

Upload, folder reconciliation, or notification delivery must survive an API restart. That is expected around asset upload and Drive folder modules.
