# ADR 0006 — Validation boundaries

## Status

Accepted. Module 0.

## Problem

The environment, the health JSON consumed by the browser, and future request bodies all need validation. Nest's `ValidationPipe` exits the process if `class-validator` and `class-transformer` are not installed, even when no route has a body.

## Decision

- Zod validates process environment at startup and the health JSON on the web client.
- `ValidationPipe` is registered globally with `whitelist` and `forbidNonWhitelisted`.
- `class-validator` and `class-transformer` are installed so the pipe can load. No Module 0 route uses a body DTO.

The first route that accepts a body will use a class-validator DTO with the existing pipe, unless that module's design note explicitly replaces the pipe with a Zod validation pipe for every route.

## Alternatives

- Zod-only, and a custom pipe. Attractive, but it was not required to boot Module 0, and removing `ValidationPipe` just to avoid two libraries would be a drive-by change.
- Leaving the pipe registered without the packages. Rejected. End-to-end startup called `process.exit(1)`.

## Trade-offs

Two libraries can drift. A reviewer should reject a pull request that validates the same payload with both.

## Security

Unknown JSON fields will be stripped, and forbidden once a DTO declares its shape. Until a DTO exists, there is no body to smuggle fields through.

## Scaling limit

Not a throughput decision.

## Revisit when

The first write endpoint is designed, or if class-validator becomes incompatible with the Nest 12 pipe.
