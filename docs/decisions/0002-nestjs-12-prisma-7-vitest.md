# ADR 0002 — NestJS 12, Prisma ORM 7.10, Vitest

## Status

Accepted. Module 0. Verified by install, typecheck, unit tests, end-to-end tests, and production build on Node.js 22.23.3.

## Problem

The requested stack names NestJS, Prisma, PostgreSQL, and Jest or Vitest. Current releases are not all mutually compatible.

## Decision

| Package | Version | Reason |
|---|---|---|
| Node.js | 22.23.3 | Prisma 7 requires `^20.19`, `^22.12`, or `>=24`. The Nest CLI failed on Node 22.14.0 with `ERR_REQUIRE_CYCLE_MODULE` inside `ora`. |
| NestJS | 12.1.x | Current stable line. Official scaffold is ESM (`"type": "module"`, `module: nodenext`). |
| TypeScript | 6.0.x | The Nest CLI 12 package depends on `typescript ~6.0.2`. TypeScript 7.0.2 is current on npm but `ts-jest` still declares `typescript <7`. |
| Prisma CLI and Client | 7.10.0 exactly | Nest's Prisma recipe targets ORM 7. The `prisma` npm `latest` tag is 8.0.0-rc.22, which does not provide the migrate and generate commands used here. |
| Driver | `@prisma/adapter-pg` 7.10.0 | Prisma 7 requires a driver adapter. |
| Tests | Vitest 4 | The Nest 12 scaffold uses Vitest, not Jest. Supertest still drives HTTP tests. |
| Lint | Oxlint | Shipped by both the Nest 12 and Vite 8 scaffolds. |

## Alternatives

- Prisma 6.19. Rejected for new work. It avoids the driver adapter, but the current Nest recipe documents Prisma 7 and CommonJS is no longer the Nest default.
- Prisma 8 release candidate. Rejected. It is not a stable release.
- Jest. Rejected. The official Nest 12 project no longer scaffolds it, and pairing it with TypeScript 7 is unsupported by `ts-jest`.

## Trade-offs

Prisma Client is generated into `apps/api/src/generated` and is not committed. `prisma generate` runs before dev, test, typecheck, and build. The client talks to PostgreSQL through `node-postgres`, so pool timeouts are driver settings (`connectionTimeoutMillis: 5000`), not the old Prisma engine settings.

## Security

Connection URLs stay in environment variables. Logs pass through a redactor that strips `postgresql://user:password@` credentials.

## Scaling limit

The `pg` pool default is used, with a 5 second connect timeout. Revisit pool size when upload and dashboard queries run concurrently.

## Revisit when

Prisma 8 is a stable release and the Nest recipe supports it, or when Nest changes its default test runner again.
