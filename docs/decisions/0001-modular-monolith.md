# ADR 0001 — Modular monolith

## Status

Accepted. Module 0.

## Problem

The platform has to cover assets, workflow, tasks, timesheets, notifications, and audit for five companies. Splitting that into microservices before the domain boundaries are proven would add network failure modes without a scaling requirement.

## Decision

One NestJS API and one React application, in a pnpm workspace. Domain modules live inside the API. PostgreSQL holds metadata. Google Drive will hold files. Redis and BullMQ are not running processes until a module has a job that must survive a process restart.

## Alternatives

- Microservices per domain. Rejected. No independent scaling or deployment requirement exists yet.
- A Next.js application that serves both UI and API. Rejected. The required stack is Vite plus NestJS, and the API must be callable without the UI.

## Why this approach

A modular monolith keeps transactions local, makes company-isolation tests straightforward, and matches the team size implied by a single repository.

## Trade-offs

Modules can become coupled if boundaries are ignored. Each later module gets its own Nest module, and controllers stay thin.

## Security

One process means one authentication boundary. Authorization still has to be enforced in services, not only in the UI.

## Scaling limit

A single API process plus PostgreSQL is enough for an internal asset team. Revisit when upload concurrency, preview generation, or reporting queries contend for the same process.

## Revisit when

A module needs an independent release cycle, or background work can no longer share the API process safely.
