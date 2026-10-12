# Build status

Updated: 2026-10-11. A payroll total uses accepted minutes and a company rate. Dashboard charts use the stored counts. An email copy waits on Redis and is sent only when SMTP is set. A live Google call is not implemented. Docker was not installed, so the API image was not built.

## Current module

Module 17 — Email, payroll, and charts. Status: **READY FOR MANUAL VERIFICATION**. No file is stored. SMTP is optional.

Modules 0 through 7 remain ready for manual verification. The stopped-database steps for Module 0 are still open. The Drive report does not call Google.

## Completed modules

None are COMPLETE.

| Module | Status |
|---|---|
| 0 Repository and environment | Ready for manual verification |
| 1 Design system and shell | Ready for manual verification |
| 2 Drive configuration report | Report ready for manual verification. Live Drive call not implemented |
| 3 Server sessions | Ready for manual verification |
| 4 Companies and membership | Ready for manual verification |
| 5 Folder catalog | Ready for manual verification. Live Drive call not implemented |
| 6 Asset upload failure | Ready for manual verification. The file is not stored |
| 7 Metadata search | Ready for manual verification. No preview |
| 8 Version history | Ready for manual verification. No file is stored |
| 9 Approval workflow | Ready for manual verification. The file is not moved |
| 10 Tasks | Ready for manual verification. Time is not recorded |
| 11 Timesheets | Ready for manual verification. Minutes are the number entered. No payroll total |
| 12 Dashboards | Ready for manual verification. Counts of stored rows. No chart and no payroll total |
| 13 Notifications | Ready for manual verification. In-app notices. No email |
| 14 Audit | Ready for manual verification. Inserted sentences. Admins read them |
| 15 Rate limit | Ready for manual verification. Counted in this process. HTTP 429 over the limit |
| 16 Deployment and backups | Ready for manual verification. Production refuses the workstation password. Local dump only |
| 17 Email, payroll, and charts | Ready for manual verification. Email is queued. A blank mail server keeps the copy. Payroll uses accepted minutes |

## What Module 17 contains

- `EmailDelivery` is written with the in-app notice. Redis queues it. Without SMTP the status is `held` and the page says it was not sent.
- An admin sets a company hourly rate. The payroll total is accepted minutes times that rate. A missing rate does not invent an amount.
- `/dashboard` charts the stored asset, task, and time counts.
- ADR 0024, ADR 0025, and ADR 0026. Showcase steps are in `docs/showcase.md`.

## What Module 16 contains

- Production startup refuses a database URL whose password is the workstation password. The error does not repeat it.
- `scripts/start-release.mjs` checks that password, applies forward migrations, and listens. There is no down migration.
- `scripts/backup-database.mjs` writes a plain SQL dump outside the repository. It does not upload the file.
- `deploy/api.Dockerfile` is not built here. Docker was not installed.
- ADR 0022. The environment page says it does not deploy.

## What Module 15 contains

- A per-address count in this API process. The default is 240 requests in 60 seconds.
- HTTP 429 with `Retry-After` when the window is full. Those calls are not each written as `request.completed`.
- The environment page says a client that calls too often is refused. It does not show the counter.
- ADR 0021. No Redis and no account lock.

## What Module 14 contains

- `AuditEvent` rows inserted with an asset, task, time, membership, or account change.
- `GET /api/v1/audit-events?companyId=` for an admin of that company.
- `/audit` shows those sentences. A sign-in, a page view, and a folder path are not listed. Earlier work is not copied in.
- ADR 0020. No client create route and no update of a sentence.

## What Module 13 contains

- `Notification` rows for one user and one company.
- A row is written in the same transaction as an assignment to someone else, a return by someone else, or a rejection of someone else’s asset.
- `GET /api/v1/notifications` and `POST /api/v1/notifications/:id/read`.
- `/notifications` and the bell. An unread count appears only when unread rows exist.
- ADR 0019. No email, no Redis, and no storage alert.

## What Module 12 contains

- `GET /api/v1/dashboard?companyId=` counts assets, tasks, and time entries already stored.
- A creator sees their own rows. An RM or admin sees every row in that company.
- Asset counts include `upload_failed` and the workflow stage. There is no stored-file count.
- Time minutes are the sum of stored minutes. `/dashboard` says that is not a payroll total.
- ADR 0018. No new table and no chart library.

## What Module 11 contains

- `TimeEntry` rows for one person and one company. An optional task must be in that company.
- `GET`, `POST`, and `PATCH /api/v1/time-entries`, and `POST /api/v1/time-entries/:id/review`.
- Status is `open`, `submitted`, `accepted`, or `returned`. A return requires a reason.
- A creator sees their own entries. An RM or admin sees every entry in that company.
- `/time` says the minutes are the number entered. The sum, when shown, is only the listed rows.
- ADR 0017.

## What Module 10 contains

- `Task`, `TaskAssignment`, and `TaskLink` rows inside one company.
- `GET`, `POST`, and `PATCH /api/v1/tasks`. Status is `open` or `done`.
- The assignee must already belong to that company. The asset must belong to that company.
- `/tasks` says time was not recorded. There is no hours field.
- ADR 0016.

## What Module 9 contains

- `WorkflowDecision` rows for submit, approve, reject, publish, and resubmit.
- `POST /api/v1/assets/:id/transitions`. The caller must hold the stage role. A rejection needs a reason.
- Admin approval stays at `admin_approval` with `publication: not_run`. Google Drive is not called.
- A new version after rejection returns to scope analysis and keeps the earlier version.
- `/assets/:id` shows the stage, the allowed actions, and the decision history.
- ADR 0015.

## What Module 8 contains

- `AssetVersion` rows. The first upload is `v001`.
- `POST /api/v1/assets/:id/versions` appends the next number and keeps the asset id.
- Retry updates only the latest version’s recorded name.
- `/assets/:id` lists every version as “Not stored”.
- ADR 0014.

## What Module 7 contains

- `GET /api/v1/assets?q=` matches code, title, or file name inside the caller’s companies.
- `PATCH /api/v1/assets/:id` changes the title. `driveFileId` in the body is rejected.
- `/assets/:id` shows the metadata and “No preview. The file was not stored.”
- The shell search field submits to `/assets?q=` for the company selected in the tab.
- ADR 0013.

## What Module 6 contains

- `Asset` metadata with a company-scoped code such as `SAPL-0001`.
- `UploadOperation` in `drive_failed` / `not_configured`. The file bytes are not stored.
- `POST /api/v1/assets` and `POST /api/v1/assets/:id/content`. A repeat of the same idempotency key returns the same asset.
- Another company's folder or asset id is 403.
- `/assets` shows "Upload failed" and "Not stored". There is no download.
- ADR 0012.

## What Module 5 contains

- `Department` rows created by an admin of that company.
- `FolderCatalog` rows whose path is built on the server. Repeating the same path returns the same row.
- `driveFolderId` is null and `liveCheck` is `not_run`. A client-supplied folder id is rejected.
- `/folders` shows the path and "Not in Drive".
- ADR 0011.

## What Module 4 contains

- `Company` rows for BAPL, SAPL, GBAPL, KABPL, and Ontale. No ASEDS row. The name matches the code.
- `Membership` with roles creator, RM, and admin. One row per user, company, and role.
- `GET /api/v1/companies` returns the caller’s companies. A direct id outside that set is 403.
- Admins grant and revoke membership in their own companies, list those people, and enable or disable them.
- `/companies` and the company menu. The menu does not grant access.
- `apps/api/scripts/grant-membership.mjs` for the first admin. No seeded demo user.
- ADR 0010.

## What Module 3 contains

- `User` and `Session` tables. Passwords are scrypt hashes. Session rows store a SHA-256 of the cookie token.
- `POST`, `GET`, and `DELETE /api/v1/session`.
- `/sign-in` uses React Hook Form. The user menu links there and does not collect a password.
- `apps/api/scripts/create-user.mjs` for an operator. No seeded demo user.
- ADR 0009. Session lifetime is 12 hours.

## What Module 2 contains

- `GET /api/v1/storage/connection` returns HTTP 200, the missing setting names, and `liveCheck: "not_run"`.
- Startup fails when only some of the four Google settings are set. Blank values count as unset.
- Secrets are not copied onto the application config object and are not returned.
- The environment page has no Drive row. ADR 0008.

## What Module 1 contains

- Navy and paper tokens, Source Sans 3, and shared spacing. Documented in `docs/design-system.md`.
- Application shell: sidebar from the `md` breakpoint, sheet navigation below it, breadcrumb, skip link, disabled search.
- Company menu slot. Module 4 replaced the five-name notice with the signed-in user’s memberships. ASEDS is not listed.
- Notifications empty state (Module 13). The account menu links to sign-in and does not collect a password.
- Reusable button, input, textarea, badge, table, dialog, dropdown, sheet, breadcrumb, and loading, empty, and error states.
- Design-system page at `/design-system`. The example field and discard dialog do not save or delete anything.
- Environment status and the not-found page rendered inside the shell. Health behavior is unchanged.

## Architecture decisions

| ID | Decision |
|---|---|
| 0001 | Modular monolith. No microservices. |
| 0002 | NestJS 12, Prisma 7.10 (not the Prisma 8 release candidate), Vitest, TypeScript 6.0. |
| 0003 | API starts when PostgreSQL is down. Readiness fails. Liveness does not. |
| 0004 | Redis is not an application dependency until a module has a durable job. |
| 0005 | Web 43123, API 43124. Local database password is workstation-only. |
| 0006 | Zod validates environment and the web health contract. Nest's validation pipe is armed for later request bodies. |
| 0007 | React Hook Form and TanStack Query are installed with the first real form or shared cache, not in the shell. |
| 0008 | The Drive route reports configuration only. It does not call Google. |
| 0009 | Sessions are httpOnly cookies. Passwords use Node scrypt. No public registration. |
| 0010 | Company checks use membership rows. The menu selection is not authorization. |
| 0011 | Folder resolve stores a path and does not call Google. |
| 0012 | An upload records a failure and does not keep the file. |
| 0013 | Search matches metadata. A missing file has no preview. |
| 0014 | A new version keeps the asset id and the earlier attempt. No file is stored. |
| 0015 | Approval records a decision. The file is not moved into `02_Approved`. |
| 0016 | A task is a plan. It does not record time. |
| 0017 | A time entry stores the minutes that were entered. It is not a payroll total. |
| 0018 | A dashboard counts stored rows. It does not count a stored file or a payroll total. |
| 0019 | An in-app notice does not send email. |
| 0020 | An audit row is an inserted sentence. It is not updated. |
| 0021 | A rate limit stays in this process. It does not read `X-Forwarded-For`. |
| 0022 | Production refuses the workstation database password. A dump stays on this machine. |
| 0024 | An email copy waits on Redis. It is sent only when SMTP is configured. |
| 0025 | A payroll total is accepted minutes times the company hourly rate. |
| 0026 | Dashboard charts use the stored counts. |

## Known defects

None open. Oxlint warns that `button.tsx` and `badge.tsx` export variant helpers next to components. The lint command exits 0. See the Module 1 showcase.

## Outstanding requirements

A live Drive call that stores a file id on one version without removing the other, then moves the approved version into `02_Approved`. Preview waits for a stored file. Notices stay in the app until a mail transport exists. Audit sentences already written stay as they are.

## Missing credentials

- `GOOGLE_DRIVE_ID`. The client id and secret are read from `.env` on a workstation that has them. They are not in git. The redirect URI has a local default. Without a shared drive id the report stays `configured` with that one name missing, and Google is not called. Do not invent a drive id.
- No production database URL. Production startup now refuses the workstation password, and no other password is configured.

## Next implementation step

Module 17 is ready for manual verification. The file path is still open. After `GOOGLE_DRIVE_ID` and a Google token exist, add one live Drive read and map the failure classes. Do not mark Module 2 complete from the configuration report alone. The operator steps are in `docs/showcase.md`.
