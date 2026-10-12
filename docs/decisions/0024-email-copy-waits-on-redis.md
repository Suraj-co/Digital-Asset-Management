# ADR 0024 — An email copy waits on Redis

## Status

Accepted. Module 17.

## Problem

An assignment, a returned time entry, and a rejected asset already write an in-app notice. A showcase that says “email is sent” without a mail server would be false. A queue is the durable job ADR 0004 was waiting for.

## Decision

- The same transaction that inserts `Notification` inserts `EmailDelivery` for the recipient’s account email. The actor does not receive a copy of their own action.
- Redis and BullMQ move `pending` to `queued`, then a worker in this API process delivers it.
- With `SMTP_HOST`, `SMTP_PORT`, and `SMTP_FROM` set, the worker sends the copy and stores `sent`. `SMTP_USER` and `SMTP_PASSWORD` are both required when either one is set. Startup refuses a partial set and does not repeat the password.
- With no SMTP settings, the worker stores `held` and the sentence “No mail server is configured. This copy is kept here and was not sent.”
- With no `REDIS_URL`, the row stays `pending` and the list says Redis is not configured. The in-app notice is still saved.
- Health reports Redis as `up`, `down`, or `not_configured`. That check does not change the API’s ok/degraded status. Readiness remains PostgreSQL.
- The client cannot create a notice or an email.

## Alternatives

- Send from the request without Redis. Rejected. A crashed process would lose the send, and a second API process would not share the work.
- Pretend a message was sent when SMTP is blank. Rejected.

## Trade-offs

The worker runs inside the API process. A second process shares the queue through Redis. The rate limit is still per process.

## Security

The SMTP password is not written to the delivery row, the audit log, or the health body. A failed send stores a shortened, redacted error.

## Revisit when

A Shared Drive file needs its own mail, or the worker should run as a separate process.
