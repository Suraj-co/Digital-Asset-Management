# Module 13 — Notifications

## A. Purpose and status

A person can read notices addressed to them. The notice is written with the assignment, the returned time, or the rejection. No email is sent.

Status: **ready for manual verification**. Not COMPLETE until that verification is recorded.

## B. Functionality

| Name | Purpose | Role | UI | API | Data | External | Security | Tests |
|---|---|---|---|---|---|---|---|---|
| Assignment | Tell someone else they were assigned | Member | Bell, `/notifications` | Written with `POST` or `PATCH /api/v1/tasks` | `Notification` | None | Self-assign writes nothing | e2e |
| Returned time | Tell the owner a reviewer returned the entry | RM or admin | Bell, `/time` | Written with `POST .../review` | `Notification` | None | A self-return writes nothing. Accept writes nothing | e2e |
| Rejection | Tell the creator the asset was rejected | Reviewer | Bell, asset href | Written with `POST .../transitions` | `Notification` | None | A self-rejection writes nothing | e2e |
| Inbox | List and mark the caller’s rows | Signed-in user | Bell and `/notifications` | `GET /api/v1/notifications`, `POST .../read` | `Notification` | None | Another person’s id is 404 | e2e, page test |

## C. Not in this module

- Email, Slack, or any message that leaves the app.
- Redis or a background job.
- A notice the client can invent.
- A storage alert. Google Drive is not called, and no file is stored.
- A general audit log. That is Module 14.

## D. Files

- `apps/api/prisma/migrations/20261010240000_notification`
- `apps/api/src/notifications/`
- `apps/web/src/pages/NotificationsPage.tsx`
- ADR 0019.

## E. Tests

API end-to-end covers an assignment, a same-person assign that does not add a row, a returned time entry, an accepted entry that does not add a row, a rejection, mark-read, and a 404 for another person’s id. The page test covers the signed-out state, the empty inbox, and the latest-rows sentence. Counts are in `TESTING_STATUS.md`.

## F. Manual verification

Steps are in `docs/manual-testing/13-notifications.md`. Product-owner confirmation is still open.

## G. Health

No new outbound call and no mail transport. See `SYSTEM_HEALTH.md`.

## H. Showcase

The bell and `/notifications` list the signed-in person’s rows. The page says no email is sent. A signed-out visit says sign-in is required.
