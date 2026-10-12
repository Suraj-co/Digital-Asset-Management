# Module 11 — Timesheets

## A. Purpose and status

A member can record minutes for one company, optionally on a task in that company, and submit them. An RM or admin can accept or return a submitted entry.

Status: **ready for manual verification**. Not COMPLETE until that verification is recorded.

## B. Functionality

| Name | Purpose | Role | UI | API | Data | External | Security | Tests |
|---|---|---|---|---|---|---|---|---|
| Record | Store the minutes that were entered | Member | Record time | `POST /api/v1/time-entries` | `TimeEntry` | None | Other company is 403 | e2e, page test |
| Correct | Change an open or returned entry | Owner | Save minutes | `PATCH /api/v1/time-entries/:id` | `minutes` | None | Another person is 403. Submitted or accepted is 409 | e2e |
| Submit | Send an open or returned entry for review | Owner | Submit | `POST .../review` | `status` | None | Another person's time is 403 | e2e |
| Review | Accept or return a submitted entry | RM or admin | Accept, Return | `POST .../review` | `status`, `reviewReason` | None | A creator is 403. A return needs a reason | e2e |

## C. Not in this module

- A payroll total, a rate, or a chart. The sum on the page is only the rows listed.
- Email. Module 13 writes an in-app notice when someone else returns the entry. Accepting an entry does not.
- A general audit log. That is Module 14.
- Minutes stored on the task row. `/tasks` still says time is not recorded there.
- A stored file or a Drive call.

## D. Files

- `apps/api/prisma/migrations/20261010230000_time_entry`
- `apps/api/src/time/`
- `apps/web/src/pages/TimePage.tsx`
- ADR 0017.

## E. Tests

API end-to-end covers 90 minutes, a BAPL denial, submit, accept, a return that needs a reason, a correction, a task in another company, a future date, and the split between a creator's list and an RM's list. The page test covers the signed-out state and the sentence that the recorded minutes are not a payroll total. Counts are in `TESTING_STATUS.md`.

## F. Manual verification

Steps are in `docs/manual-testing/11-timesheets.md`. Product-owner confirmation is still open.

## G. Health

No new outbound call. See `SYSTEM_HEALTH.md`.

## H. Showcase

`/time` lists entries for the company selected in the tab. The page says minutes are the number you enter. There is no hours field and no payroll total.
