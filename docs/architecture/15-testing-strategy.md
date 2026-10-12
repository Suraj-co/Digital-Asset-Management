# Testing strategy

## Layers

| Layer | Tool | What belongs here |
|---|---|---|
| Unit | Vitest | Pure rules: env parsing, error categories, redaction, React states with a fixture |
| HTTP | Vitest + Supertest | A booted Nest app and a real test database for routes that claim to touch PostgreSQL |
| Browser components | Vitest + Testing Library + jsdom | View states and controls |
| Browser flows | Playwright | First workflow that needs a real browser (upload, OAuth). Shell navigation is covered in jsdom. |
| External systems | Recorded fixtures in unit tests, a separate live test when credentials exist | Drive. Never mock a live test and call it live. |

Jest is not used. ADR 0002 explains why.

## Rules

- A test that was generated and not executed is not a pass. `TESTING_STATUS.md` records commands and counts from the run.
- End-to-end tests use `dam_test`, not the development database, even while both are empty.
- Authorization tests call the API. They do not stop at a hidden button.
- When a bug is fixed, add a regression test that failed before the fix. `requestPath` is the example for the rewritten 404 path.
- Do not assert on timestamps except that they are present. Do assert on status, category, and correlation id.

## Module 0 commands

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm build
```

## Later suites that must exist before those modules are called complete

- Company isolation, including a SAPL user requesting BAPL.
- Upload failure that does not leave two asset rows.
- Illegal workflow transition and missing rejection reason.
- Timesheet duration and duplicate entry.
- Notification delivered once to the intended user.

## CI

`.github/workflows/ci.yml` runs those commands with PostgreSQL 16. Treat a red job as the source of truth for that commit, even if a laptop was green.
