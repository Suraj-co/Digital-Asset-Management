# Testing status

Updated: 2026-10-10, after the deployment browser check.

Commands were run from `/workspace` with Node.js v22.23.3 and pnpm 10.33.4. PostgreSQL 16.15 was listening on `127.0.0.1:5432`. Databases `dam` and `dam_test` had the baseline migration applied.

## Commands and results

| Command | Result |
|---|---|
| `pnpm lint` (Module 1 workspace run) | Passed. Oxlint for `@aaradhya/api` and `@aaradhya/web`. Web reported two warnings in shadcn `button.tsx` and `badge.tsx` (`only-export-components`). Exit code 0. |
| `pnpm typecheck` (Module 1 workspace run) | Passed. API `tsc` after `prisma generate`. Web `tsc -b`. |
| `pnpm --filter @aaradhya/api test` | Passed. 61 tests in 17 files. The Drive client pair can be set without a shared drive id, and the secret is not in the report. |
| `pnpm --filter @aaradhya/api test:e2e` | Passed. 32 Supertest tests, including a third health call refused with HTTP 429 when the limit is 2. |
| `pnpm --filter @aaradhya/web test` | Passed. 45 tests in 14 files, including the limited environment state. |
| `pnpm --filter @aaradhya/web typecheck` | Passed after that split. |
| `pnpm --filter @aaradhya/web lint` | Passed after that split. Exit code 0. The only warnings are shadcn `button.tsx` and `badge.tsx`. `session.tsx` no longer warns. |
| `pnpm --filter @aaradhya/api lint` | Passed. |
| `pnpm --filter @aaradhya/api typecheck` | Passed. |
| `pnpm test` (web, previous Module 1 run) | Passed. 19 tests in 4 files. Web sources were not changed for the Drive report. |
| `pnpm --filter @aaradhya/api build` | Passed after the Drive report. `nest build`. |
| `pnpm build` (Module 1 workspace run) | Passed. `nest build` and `vite build`. Web JS about 490 KB uncompressed, 155 KB gzipped, plus the Source Sans 3 files. |

No tests were skipped. No tests were failing at the end of the run.

## What the automated tests cover

Module 0 coverage is unchanged: environment parsing, correlation id, request path, redaction, database error categories, health service, liveness, exception filter, and the health HTTP suite.

Module 1:

- Sidebar navigation from Environment to the design system, including the Primary button on that page.
- Signed-out company menu says to sign in and does not list companies as assigned. A mocked Ontale membership appears on the button and in the menu, without BAPL.
- Signed-out notifications say a server session is required and that no email is sent. An unread bell shows the count and the body.
- Signed-out menu says it does not collect a password and links to sign-in.
- Search submits a code, title, or file name and opens Assets.
- The mobile sheet lists Environment and Design system, navigates, and closes.
- Design-system filter, empty filter, example-title validation, and discard confirmation.

Module 4:

- Five company codes and no ASEDS row.
- SAPL-only list, SAPL requesting the BAPL id (403), unknown id (404).
- Ontale admin grant, duplicate grant, and the other user’s list.
- Creator cannot list users. A SAPL admin does not see a BAPL-only user.
- Disable is refused when the user also belongs to BAPL, then succeeds for a user inside the admin’s companies.
- The last active admin membership cannot be deleted.
- Companies page signed-out state, and the Ontale grant notice.

Module 5:

- Path `AARADHYA_DAM/SAPL/.../01_Working/Posters`, a repeated resolve, and a null `driveFolderId`.
- A creator cannot add a department. A SAPL caller receives 403 for BAPL departments and folder resolve.
- A client `driveFolderId` is rejected.
- The Folders page signed-out state, and a recorded path with no Drive id.

Module 6:

- A failed upload returns `upload_failed`, `not_configured`, and `driveFileId: null`.
- The response and the operation row do not contain the file bytes.
- The same idempotency key returns the same asset. A different title with that key is 409.
- A SAPL caller receives 403 for a BAPL folder and a BAPL caller receives 403 for the SAPL asset.
- Retry keeps the asset id and still stores no file.
- The Assets page signed-out state, and the failure sentence with no download link.

Module 7:

- A title, a code, and a file name each return only the matching asset.
- A BAPL caller searching a SAPL title gets an empty list.
- A title change stays `upload_failed` with `driveFileId` null. A body field `driveFileId` is 400.
- The shell search opens `/assets`, and the detail page says there is no preview.

Module 8:

- The first upload is `v001`.
- A second attempt keeps the asset id, keeps `v001`, and adds `v002`.
- The same idempotency key returns those two versions. A different file with that key is 409.
- Retry changes only the latest file name.
- A BAPL caller cannot add a version to a SAPL asset.
- The detail page says the new version was not stored.

Module 9:

- A creator can submit a draft. Approving scope analysis as a creator is 403.
- An RM can advance scope analysis, RM QC, and RM approval, and cannot approve admin QC.
- A rejection without a reason is 400. A reason returns the asset to changes requested.
- A creator’s next version keeps `v001`, adds `v002`, and returns to scope analysis. An RM cannot add that version.
- Admin approval stays at `admin_approval` with `publication: not_run`. A second approve is 409. Publish records the same Drive failure.
- A BAPL caller cannot decide a SAPL asset.
- The detail page submits a draft and says the file is not stored.

Module 10:

- A SAPL member can plan a task, link a SAPL asset, and assign another SAPL member.
- Marking the task done does not add a time field. Clearing the assignee and the asset leaves both empty.
- A BAPL email cannot be assigned. A BAPL caller cannot list or update the SAPL task.
- A `driveFileId` on the task body is 400.
- The tasks page says time was not recorded.

Module 11:

- A SAPL creator records 90 minutes on a SAPL task. The stored minutes are 90. The body has no payroll total.
- A BAPL caller cannot list that company’s time. The creator cannot accept the entry.
- The owner submits. An RM accepts. A return without a reason is 400. A reason marks the entry returned.
- The owner then saves 45 minutes and submits again.
- A task in another company is refused. Minutes of 0 are refused. A future work date is refused.
- The creator’s list omits the RM’s entry. The RM’s list includes both. The time page says the recorded minutes are not a payroll total.

Module 12:

- A SAPL creator’s dashboard counts one asset, one open task, and 90 stored minutes. Scope is `own`.
- An RM’s dashboard counts both people’s rows. Scope is `company`. The minute sum is 110 more than the count before those rows.
- A BAPL caller requesting SAPL is 403. A missing `companyId` is 400.
- The body has no payroll total, no stored-file count, and no file bytes.
- The dashboard page says the caller sees their own rows and that the minute sum is not a payroll total.

Module 13:

- Assigning someone else writes `task_assigned`. Assigning yourself writes nothing. Assigning the same person again does not add a row.
- A return by someone else writes `time_returned` with the minutes and the reason. Accepting an entry does not.
- A rejection writes `asset_rejected` with the reason. The body has no `emailSent` field and no file bytes.
- Mark read sets `readAt`. A second mark keeps that time. Another person’s id is 404.
- The notifications page says sign-in is required when signed out, and it shows the latest-rows sentence when the total is larger than the page.

Module 14:

- A task, an upload, a title change, a rejection, a returned time entry, and a membership grant each insert one sentence. The newest row is the grant.
- The upload sentence says the file was not stored. The body has no `driveFileId` and no file bytes.
- A second read returns the same `createdAt`. There is no update field.
- A creator of that company is 403. An admin of another company is 403. A missing `companyId` is 400. `POST /api/v1/audit-events` is 404.
- The audit page says sign-in is required when signed out, shows the server refusal for a non-admin, and shows a stored sentence plus the latest-rows line for an admin.

Module 15:

- Two calls are allowed when the max is 2. The third is refused. A later window allows the address again.
- A different address has its own count. After 1000 tracked addresses, the oldest is dropped.
- The HTTP refusal is 429, `too_many_requests`, with `Retry-After`. The body has no database password.
- The environment page shows Limited and does not mark PostgreSQL down. A 429 health body becomes that message.

Module 16:

- Production `loadEnv` throws when the database password is the workstation password. The message does not contain that password. Development still accepts it. A different password is accepted in production.
- A dump path inside the repository is rejected. An absolute path outside it is accepted. The Prisma `schema` query is removed before `pg_dump`.
- The environment page says this page does not deploy.

Radix menus in jsdom need a pointer down before click. `src/test/setup.ts` polyfills pointer capture. The shell tests open controls that way.

## Not run here

| Check | Why |
|---|---|
| `docker compose up` | Docker is not installed in this workspace. The Compose file was not executed. |
| GitHub Actions | The workflow is committed. A runner result was not available yet. |
| Playwright | Still deferred. The upload failure path is covered by the asset end-to-end test and the browser pass below. |
| Live Google Drive call | No credentials. The configuration report is tested. `liveCheck` stays `not_run`. |
| Stopped-database check against the live API | Still covered by the health-service unit test. Not repeated for Module 1. |
| Module 1 browser pass | Recorded below. Product-owner confirmation is still open. |

## Browser pass

Module 0 browser pass remains the one recorded on 2026-10-10 against the pre-shell page. See the previous notes in git history for correlation ids `cc687b73-fcc3-41d0-bf9b-977a45dba148` and `c9854955-aefa-4c38-a4b6-c4a891d789fb`. That pass does not cover the shell.

Module 1 shell walk on 2026-10-10, against `http://127.0.0.1:43123`, reported every listed step passing:

- Environment status Ready on desktop. Screenshot correlation ids `099685a6-db67-4a91-9905-7586f1dcd8fe` at `2026-10-10T05:19:24.703Z` (1 ms) and, after refresh, `3f1b888a-3ebf-490c-89ef-2261204f4c9f` at `2026-10-10T05:25:42.539Z` (8 ms).
- Search stays disabled.
- Company menu names BAPL, SAPL, GBAPL, KABPL, and Ontale, does not list ASEDS, and does not grant access.
- Notifications show the empty state and cite Module 13, with no unread badge.
- Design system: filter dialog, a query with no matches, title validation, Poster with “Nothing was saved.”, Keep then Discard with “Example discarded.”, badges, table “Not stored”, and Try again with “Sample error dismissed.”
- At 390px the sidebar is hidden, the navigation sheet opens, Design system navigates, and the environment page stays Ready without horizontal scroll. Correlation id `afda5086-6f27-4ab8-abaf-578ffe7c7556` at `2026-10-10T05:47:14.747Z`.
- An unknown route shows “Page not available” and a link back.
- Keyboard: Skip to content is first, focus rings are visible, and Company opens with Enter or Space and closes with Escape.

The account menu was read before sign-in existed, so that step still described the Module 3 notice. The menu now says it does not collect a password and links to Sign in.

While sessions were hot-reloaded during that walk, the console threw `useSession must be used inside SessionProvider` and Vite reported a failed module reload. The page still showed “Not signed in” and Ready. Cause: the provider and the hook shared `session.tsx`, so Fast Refresh replaced the context identity. The hook now lives in `session-context.ts`, and `session.tsx` exports only `SessionProvider`.

A later headless Chrome load of `/` and `/sign-in`, after that split, recorded no exception. `GET /api/v1/session` without a cookie returned HTTP 401 twice on each page (React Strict Mode runs the effect twice in development). `GET /api/v1/health` returned HTTP 200. Those 401s are the signed-out contract, not missing routes.

## Manual verification

Module 0: **not yet confirmed by the product owner**. The stopped-database steps in `docs/manual-testing/00-repository-and-environment.md` are still open.

Module 1: the shell walk above passed. Product-owner confirmation is still open. Steps are in `docs/manual-testing/01-design-system.md`.

Module 2 report: the implementer called the restarted API. `GET /api/v1/storage/connection` with `X-Request-Id: drive-check` returned HTTP 200, `status: not_configured`, `liveCheck: not_run`, the four missing names, and `correlationId: drive-check`. The body did not contain the database password. Product-owner confirmation is still open. Steps are in `docs/manual-testing/02-storage-connection.md`.

Module 3: **not yet confirmed by the product owner**. End-to-end tests cover the session rules. Steps are in `docs/manual-testing/03-sessions.md`. No demo user was left in database `dam`. The sign-in page rendered after the context split, with no console exception.

Module 4: **not yet confirmed by the product owner**. End-to-end tests cover the five company rows, a SAPL user requesting BAPL, an Ontale grant, the user list, disable, and the last admin. Steps are in `docs/manual-testing/04-companies.md`. No demo membership was left in database `dam`.

Module 5: **not yet confirmed by the product owner**. End-to-end tests cover the catalog path and the BAPL denial. Steps are in `docs/manual-testing/05-folder-catalog.md`. Google was not called.

Module 6: **not yet confirmed by the product owner**. End-to-end tests cover the failure path. Steps are in `docs/manual-testing/06-asset-upload.md`. The file is not stored.

Module 7: **not yet confirmed by the product owner**. End-to-end tests cover metadata search and a title edit. Steps are in `docs/manual-testing/07-metadata-search.md`. There is no preview.

Module 8: **not yet confirmed by the product owner**. End-to-end tests cover `v001` and `v002` on the same asset. Steps are in `docs/manual-testing/08-versions.md`. No version stores a file.

Module 9: **not yet confirmed by the product owner**. End-to-end tests cover the stage walk, a rejection reason, a new version, and a publication that stays `not_run`. Steps are in `docs/manual-testing/09-approval.md`. Google was not called.

Module 10: **not yet confirmed by the product owner**. End-to-end tests cover a company task, an assignee, an asset link, and a BAPL denial. Steps are in `docs/manual-testing/10-tasks.md`. Time is not recorded.

Module 11: **not yet confirmed by the product owner**. End-to-end tests cover entered minutes, submit, accept, a required return reason, and a BAPL denial. Steps are in `docs/manual-testing/11-timesheets.md`. There is no payroll total.

Module 12: **not yet confirmed by the product owner**. End-to-end tests cover own counts, company counts, and a BAPL denial. Steps are in `docs/manual-testing/12-dashboards.md`. There is no chart and no payroll total.

Module 13: **not yet confirmed by the product owner**. End-to-end tests cover an assignment, a returned time entry, a rejection, and a 404 for another person’s id. Steps are in `docs/manual-testing/13-notifications.md`. No email is sent.

Module 14: **not yet confirmed by the product owner**. End-to-end tests cover an inserted sentence, a creator denial, a missing company id, and the absence of a client create route. Steps are in `docs/manual-testing/14-audit.md`. Earlier work is not copied in.

Module 15: **not yet confirmed by the product owner**. The limiter test and the HTTP test cover a refusal at a limit of 2. Steps are in `docs/manual-testing/15-rate-limit.md`. The count stays in this process.

Module 16: **not yet confirmed by the product owner**. Production startup with the workstation password exits 1 before migrate. A dump to `/tmp/aaradhya-dam-module16.sql` wrote 35788 bytes and was deleted. The file did not contain the workstation password. A path inside the repository was rejected. Steps are in `docs/manual-testing/16-deployment-and-backups.md`. The API image was not built.

A local browser pass on 2026-10-10 opened `/` signed out. The page said “A backup is a database dump an operator runs outside this page. This page does not deploy.” There was no deploy button. API and PostgreSQL were Up. Overall was Ready. `GET /api/v1/health` returned HTTP 200, correlation id `2423bd5c-589c-4e8f-99e5-d23b22904822` at `2026-10-10T14:05:57.166Z`. At 390px `documentElement.scrollWidth` and `clientWidth` were both 390. Product-owner confirmation is still open.

A local browser pass on 2026-10-10 opened `/` signed out. The page said “A client that calls too often is refused. This page does not show that counter.” API and PostgreSQL were Up. Overall was Ready. `GET /api/v1/health` returned HTTP 200, correlation id `c5ec0f46-4ab7-41d1-86ba-9af8adc554b9` at `2026-10-10T13:58:09.331Z`. The body was the health report and had no request counter. At 390px `documentElement.scrollWidth` and `clientWidth` were both 390. The live API was not flooded, because this machine’s browser and a local curl share one address. Product-owner confirmation is still open.

A local browser pass on 2026-10-10 opened `/audit` signed out and showed “Sign in is required” and “The audit log is available after a server session.” The page also said a sign-in, a page view, and a folder path are not listed, earlier work is not copied here, and no file is stored. A temporary SAPL admin then planned “Label the harbor”. The audit page showed `audit-admin-1791639563@example.com planned "Label the harbor".` with that email and SAPL under the sentence. `POST /api/v1/tasks` returned HTTP 201, correlation id `fee30a9f-5efc-4c3e-8060-3c39d648aeb4` at `2026-10-10T13:40:55.219Z`. `GET /api/v1/audit-events` returned HTTP 200, correlation id `c07dec7a-60d7-491e-9bdf-5ecfe69fc666` at `2026-10-10T13:40:55.562Z`. At 390px `documentElement.scrollWidth` and `clientWidth` were both 390. That account, its audit row, and that task were deleted. The existing SAPL account, the Done task “Crop the poster”, and the accepted 90-minute entry remain. Those older rows are not in the log. Product-owner confirmation is still open.

A local browser pass on 2026-10-10 opened `/notifications` signed out and showed “Sign in is required” and “No email is sent.” A temporary SAPL member then assigned “Label the poster” to another temporary member. That recipient’s bell was named “Notifications, 1 unread”. The page showed the assignment sentence, the company code SAPL, and Mark read. Mark read changed the row to Read. `GET /api/v1/notifications` returned HTTP 200, correlation id `5700eaca-6e41-4b39-8318-1de460e5f8e9` at `2026-10-10T13:24:46.036Z`. `POST /api/v1/notifications/{id}/read` returned HTTP 200, correlation id `7f999b23-dd1a-4e2c-acab-7ad18c9c468c` at `2026-10-10T13:24:47.195Z`. At 390px `documentElement.scrollWidth` and `clientWidth` were both 390. Those two accounts, the notice, and that task were deleted. The existing SAPL account, the Done task “Crop the poster”, and the accepted 90-minute entry remain. Product-owner confirmation is still open.

A local browser pass on 2026-10-10 opened `/dashboard` signed out and showed “Sign in is required” and “Counts are stored rows. This page is not a payroll total, and no file is stored.” The existing SAPL account then saw “You see every row in this company.” Assets and Upload failed were 0. Tasks were Open 0 and Done 1. Time said “Sum of stored minutes: 90. This is not a payroll total.” with Accepted 1. Those numbers match the rows already stored for SAPL. `GET /api/v1/dashboard` returned HTTP 200, correlation id `9ee3c84c-5eba-4e86-9ff9-2f0eb8b14346` at `2026-10-10T13:05:31.617Z`. At 390px `documentElement.scrollWidth` and `clientWidth` were both 390. No account or row was deleted. Product-owner confirmation is still open.

A local browser pass on 2026-10-10 opened `/time` signed out and showed “Sign in is required” and “Minutes are the number you enter. This page is not a payroll total.” The existing SAPL account then recorded 90 minutes. The page said “90 minutes recorded. This is not a payroll total.” Submit changed the row to Submitted, and Accept changed it to Accepted with no further action. The sum line read “Sum of these rows: 90 minutes. This is not a payroll total.” The task menu still listed “Crop the poster,” and that task stayed Done. `POST /api/v1/time-entries` returned HTTP 201, correlation id `ffef1cb8-3b02-48d2-a145-f4e20f86bfb3` at `2026-10-10T12:55:06.493Z`. The two review calls returned HTTP 200, correlation ids `31cf9e63-33db-4685-9426-ec0ca7a003cd` and `6aafbc88-5b97-4fa6-a962-f87da1366cf4`. The stored row is 90 minutes, status `accepted`, with no task. At 390px `documentElement.scrollWidth` and `clientWidth` were both 390. The account and the task were left in database `dam`. Product-owner confirmation is still open.

A local browser pass on 2026-10-10 opened `/tasks` as the existing SAPL account. Adding “Crop the poster” showed “Crop the poster added. Time was not recorded.” The row was Open, with no asset and no assignee. Mark done changed it to Done and the button to Reopen. There was no hours field and no download. That task was left in database `dam` for the same account. Product-owner confirmation is still open.

A local browser pass on 2026-10-10 opened a temporary SAPL asset `SAPL-0001` as a creator. Submit changed Draft to Scope analysis and showed “Submitted the latest version. The file is not stored.” `v001` stayed Not stored. There was no preview and no download. An RM then approved the three RM stages. An admin rejected with “Crop the logo.” The creator’s next file added `v002` and returned the asset to scope analysis, leaving `v001` in place. After the stages were approved again, admin approval stayed on Admin approval and the page said Google Drive was not called and the file was not moved into `02_Approved`. Try publication again left that sentence in place and added a publish decision. A BAPL session posting a transition received HTTP 403. At 390px the review card, both versions, and that sentence fit without a horizontal page scroll. Those users, the asset, its versions, its decisions, the folder, and the department were deleted. Product-owner confirmation is still open.

A local browser pass on 2026-10-10 opened a temporary SAPL asset `SAPL-0001`. It showed `v001` `first-poster.png`. Recording another file added `v002` `second-poster.png` and left `v001` in place. A later attempt added `v003`. Every Drive cell said “Not stored”. The page said the file was not stored and showed no preview. A BAPL session posting a version to that asset received HTTP 403. Those users, the asset, its versions, the folder, and the department were deleted. Product-owner confirmation is still open.

A local browser pass on 2026-10-10 signed in as a temporary SAPL admin, searched `Harbor`, and opened `SAPL-0001`. The list said file contents are not searched. The detail page said “No preview. The file was not stored.” and showed Drive “Not stored”. Saving the title showed “Title saved. The file is still not stored.” The state stayed Upload failed. A BAPL session searching `Harbor` got an empty list. A title body that included `driveFileId` was HTTP 400. Those users, the asset, the folder, and the department were deleted. The console kept the two signed-out `GET /api/v1/session` 401s from before sign-in. Product-owner confirmation is still open.

Module 6 browser pass on 2026-10-10 opened `http://127.0.0.1:43123/assets` signed out and showed “Sign in is required.” A temporary SAPL admin recorded `SAPL-0001` (Festival poster). Retry replaced the file name with `poster-v2.txt` and kept the same code. A second submit recorded `SAPL-0002` (Second attempt, `festival-poster.txt`). Both rows said “Not stored.” The page showed “Google Drive was not called. The file was not stored.” There was no download control. `POST /api/v1/assets` for those rows returned HTTP 201. `POST` without a cookie returned 401. A BAPL-only session received 403 for the SAPL asset and for a SAPL company list. The operation row stored the name and size only. Those users, assets, folders, and departments were deleted. The console kept the two signed-out `GET /api/v1/session` 401s from before sign-in. Product-owner confirmation is still open.
