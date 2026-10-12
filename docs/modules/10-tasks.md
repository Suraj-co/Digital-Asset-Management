# Module 10 — Tasks

## A. Purpose and status

A member can plan work inside a company, name an asset, and name another member. The task does not record time.

Status: **ready for manual verification**. Not COMPLETE until that verification is recorded.

## B. Functionality

| Name | Purpose | Role | UI | API | Data | External | Security | Tests |
|---|---|---|---|---|---|---|---|---|
| Plan | Add a task | Member | Add a task | `POST /api/v1/tasks` | `Task` | None | Other company is 403 | e2e, page test |
| Assign | Name a member of the same company | Member | Assignee email | same route | `TaskAssignment` | None | Outsider is 403. Unknown email is 404 | e2e |
| Link | Name an asset in the same company | Member | Asset menu | same route | `TaskLink` | None | Another company’s asset is refused | e2e |
| Finish | Mark open or done | Member | Mark done, Reopen | `PATCH /api/v1/tasks/:id` | `Task.status` | None | Other company is 403 | e2e |

## C. Not in this module

- Time entries. That is Module 11.
- Email. Module 13 writes an in-app notice when someone else is assigned. This module still does not record time.
- A general audit log. That is Module 14.
- A stored file or a Drive call.

## D. Files

- `apps/api/prisma/migrations/20261010220000_task`
- `apps/api/src/tasks/`
- `apps/web/src/pages/TasksPage.tsx`
- ADR 0016.

## E. Tests

API end-to-end covers create, assign, link, mark done, clear the links, a BAPL denial, and the absence of a time field. The page test covers the signed-out state and the sentence that time was not recorded. Counts are in `TESTING_STATUS.md`.

## F. Manual verification

Steps are in `docs/manual-testing/10-tasks.md`. Product-owner confirmation is still open.

## G. Health

No new outbound call. See `SYSTEM_HEALTH.md`.

## H. Showcase

`/tasks` lists plans for the company selected in the tab. The page says time is not recorded. There is no hours field.
