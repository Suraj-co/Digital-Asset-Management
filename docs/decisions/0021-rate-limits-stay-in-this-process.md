# ADR 0021 — A rate limit stays in this process

## Status

Accepted. Module 15.

## Problem

Public health and session routes write a log line for every call. One client can fill that log. A limit that claimed to cover every server, or that trusted a forwarded address, would describe a control this process does not have.

## Decision

- Each request counts against the socket address. `X-Forwarded-For` is not read.
- The default is 240 requests in 60 seconds. `RATE_LIMIT_MAX` and `RATE_LIMIT_WINDOW_SECONDS` can change that. Zero is refused at startup.
- The next request is HTTP 429 with `Retry-After` and `error: too_many_requests`.
- That request is not written as `request.completed`. The first refusal in a window is one warn line.
- The count lives in this process. Redis is not used. A second API process has its own count.
- The map keeps at most 1000 addresses. Older entries are dropped.
- The environment page says a client that calls too often is refused. It does not show the counter.

## Alternatives

- Redis. Rejected. ADR 0004 still holds. This limit does not need to survive a restart.
- Trust the first forwarded address. Rejected. A caller can set that header.
- Lock an account after bad passwords. Rejected. The address limit already slows a spray. An account lock could shut out a real user.

## Trade-offs

The Vite development proxy makes browser calls share `127.0.0.1`. One busy tab and a script on the same machine share one count for a minute.

## Security

The 429 body uses the same error shape as other client errors. It does not include a password or file bytes.

## Revisit when

More than one API process is deployed. The counts will not add up until a shared store exists.
