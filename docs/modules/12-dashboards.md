# Module 12 — Dashboards

## A. Purpose and status

A member can see counts of stored rows for one company. The counts follow the caller’s role.

Status: **ready for manual verification**. Not COMPLETE until that verification is recorded.

## B. Functionality

| Name | Purpose | Role | UI | API | Data | External | Security | Tests |
|---|---|---|---|---|---|---|---|---|
| Own counts | Count the caller’s assets, tasks, and time | Creator | Dashboard | `GET /api/v1/dashboard` | Existing rows | None | Teammate rows are excluded | e2e, page test |
| Company counts | Count every row in the company | RM or admin | Dashboard | same route | Existing rows | None | Another company is 403 | e2e |

## C. Not in this module

- A chart, a trend, or a chart library.
- A payroll total. Minutes are the sum of stored minutes.
- A stored-file count. Uploads stay `upload_failed`.
- A notification. That is Module 13.
- A general audit log. That is Module 14.
- A new table. The dashboard reads rows other modules already store.

## D. Files

- `apps/api/src/dashboard/`
- `apps/web/src/pages/DashboardPage.tsx`
- ADR 0018.

## E. Tests

API end-to-end covers a creator’s own counts, an RM’s company counts, a BAPL denial, and the absence of a payroll total or a stored-file count. The page test covers the signed-out state and the own-scope sentence. Counts are in `TESTING_STATUS.md`.

## F. Manual verification

Steps are in `docs/manual-testing/12-dashboards.md`. Product-owner confirmation is still open.

## G. Health

No new outbound call and no chart library. See `SYSTEM_HEALTH.md`.

## H. Showcase

`/dashboard` shows counts for the company selected in the tab. The page says the counts are stored rows, the file is not stored, and the minute sum is not a payroll total.
