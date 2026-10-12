# System health

Updated: 2026-10-11. Scope: Modules 0 through 17. Module 17 queues an email copy, charts stored counts, and calculates a payroll total from accepted minutes. Module 2 is the configuration report only. Module 6 records a failed upload and does not store the file. Module 7 searches that metadata and does not preview a file. Module 8 keeps earlier version rows and still stores no file. Module 9 records review decisions and does not move a file. Module 10 plans a task and does not record time. Module 11 stores the minutes a person entered and does not compute a payroll total. Module 12 counts those stored rows and does not add a chart library. Module 13 writes an in-app notice and does not send email. Module 14 inserts an audit sentence with a completed company change and does not update it. Module 15 counts requests in this process and does not share that count. Module 16 refuses the workstation database password in production and writes a local SQL dump. The dump is not uploaded. The API image was not built.

## Known bugs

None open.

Module 0: unknown routes were logged as `/missing` after the router rewrote `req.path`. The access log now uses `originalUrl` without the query string.

Module 1: dropdown and sheet tests failed in jsdom until pointer capture was polyfilled and the assertions looked inside the open menu or dialog. That was a test harness gap, not a defect in the running page. It is covered by `AppShell.test.tsx`.

Session hot reload: while the provider and `useSession` shared one file, a Vite refresh threw `useSession must be used inside SessionProvider`. The hook and context now live in `apps/web/src/shell/session-context.ts`. A fresh load of `/` and `/sign-in` after that split had no exception. Unsigned `GET /api/v1/session` stays HTTP 401.

## Operational limitations

| Item | Severity | Why it matters | Resolution |
|---|---|---|---|
| Docker was not executed in this workspace | Medium | The documented Compose path is unproven on a machine that has never run it. Host PostgreSQL 16 was used instead. | Run `docker compose up -d` on a machine with Docker and repeat the migration and health check in the manual test. |
| GitHub Actions has not been observed | Medium | The workflow may still fail on a clean runner, for example while creating `dam_test` or downloading Prisma engines. | Watch the first push. Fix the workflow from the runner log, not by assuming local success is enough. |
| Nest CLI crashes on Node.js 22.14.0 | Medium | `nest start` and `nest build` depend on the CLI. That patch throws `ERR_REQUIRE_CYCLE_MODULE` inside `ora`. | Use Node.js 22.23.3, as pinned in `.nvmrc` and CI. |
| Rate limit is per process | Low | One address is limited here. A second API process has its own count. The development proxy shares `127.0.0.1` across browser tabs and local curl. | Share the count only when more than one API process is deployed. |
| No offsite backup | Medium | The dump stays on the machine that ran `pg_dump`. A lost disk loses the copy. Drive retention is not configured. | Copy the dump to a store outside this machine when a host exists. |
| API image was not built | Low | `deploy/api.Dockerfile` is in the repository. Docker was not installed here. | Build it on a machine with Docker. Do not use the Compose password as the production password. |
| Content-Security-Policy is off outside production | Low | Swagger UI is served in development and test. The session cookie is httpOnly. | Production sets Helmet's default CSP and does not mount Swagger. |
| HSTS is off outside production | Informational | Local HTTP would stick in the browser if HSTS were sent. | Production keeps Helmet's HSTS default. Serve TLS there. |
| Redis is not running | Informational | There is no queue to retry a failed external call. | ADR 0004. Enable it with the module that needs a durable job. |
| Google Drive is not configured | Informational | No file can be stored. Folder rows keep `driveFolderId` null. Uploads stay `upload_failed`. Approval cannot move a file into `02_Approved`. | Add a live write after the four settings exist. ADR 0008, ADR 0011, ADR 0012, and ADR 0015. |
| Public health endpoints | Informational | They expose process version, database category, and latency. They do not expose credentials or business rows. | Keep them public for probes. Do not add asset data to this payload. |
| Company menu is not authorization | Informational | The menu lists memberships and can highlight one for this tab. The API checks membership on each company request. | Keep that check in the service when assets arrive. |
| Dark tokens are unused | Informational | `.dark` is in the stylesheet and nothing toggles it. | Add a switch only when a module needs it. |

## Security findings

No critical or high findings in Modules 0 or 1.

- Database passwords are rejected from client responses in the health-service test, and log lines pass through a URL redactor.
- Unknown failures return "An unexpected error occurred." The server log keeps a redacted detail.
- Correlation ids that contain spaces or newlines are replaced.
- `.env` is gitignored. `.env.example` contains the local password on purpose. Do not reuse it outside a private workstation or CI.
- Sessions use an httpOnly cookie and a scrypt password hash. The token stored in PostgreSQL is a SHA-256. ADR 0009.
- Health and the Drive report stay public. They do not read the session.
- Company routes require a session. A membership outside the caller’s companies is 403. Health and the Drive report stay public.
- No account is seeded. The first admin is an operator script against `DATABASE_URL`.
- The design-system example does not send the title anywhere. Discard clears local state only.
- A review decision requires the role for that stage. The decision row stores the actor, the version, and an optional reason. It does not store file bytes.

## Integration failures

Google Drive: not called. The configuration report reads the process environment only. PostgreSQL: connected during the Module 0 live check and the API end-to-end tests.

## Performance risks

Every `/health` and `/health/ready` call runs `SELECT 1`. A measured local call during Module 0 was 58 ms on the first connection and about 1–2 ms after that. Do not poll readiness more than about once a second per checker until the pool size is reviewed.

The web production bundle is about 490 KB uncompressed JavaScript (155 KB gzipped) plus about 49 KB of CSS (9 KB gzipped) and the Source Sans 3 variable font files. The increase from Module 0 is Radix, the shell, and the font. Acceptable for the shell. Module 12 counts stored rows and does not add a chart library. Module 13 does not add a mail transport or Redis. Module 14 does not add an update path for an audit sentence. Module 15 does not add Redis. Over-limit requests are not each written to the log. Module 16 does not add a scheduler or an upload of the dump.

## Technical debt

- Zod and class-validator are both installed. ADR 0006 says which one owns which boundary. The first POST must not invent a third style.
- React Hook Form is installed for sign-in and the grant form. TanStack Query caches the company list. ADR 0007.
- Prisma Client is generated and gitignored. Every install path must keep `prisma generate` in front of compile and test.
- `vite-tsconfig-paths` was removed from the Nest scaffold because it required TypeScript 5. The API has no path aliases.
- shadcn `buttonVariants` and `badgeVariants` share a file with the component. Oxlint warns. Leaving the generated shape avoids a fork.

## Recommended fixes before later modules

1. Confirm Docker Compose and the GitHub Actions run.
2. Keep business tables out of the database until their module, and add them by migration rather than `db push`.
3. Do not point the health page at fake asset counts.
4. Do not add a primary-nav link until the screen behind it exists.
