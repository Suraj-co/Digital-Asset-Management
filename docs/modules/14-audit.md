# Module 14 — Audit

## A. Purpose and status

An admin can read stored sentences for completed changes in one company. The sentence is written with the change. Earlier work is not copied in.

Status: **ready for manual verification**. Not COMPLETE until that verification is recorded.

## B. Functionality

| Name | Purpose | Role | UI | API | Data | External | Security | Tests |
|---|---|---|---|---|---|---|---|---|
| Record | Insert a sentence with the change | The actor | — | Written by the service | `AuditEvent` | None | Same transaction as the change | e2e |
| Read | List newest first | Admin of that company | `/audit` | `GET /api/v1/audit-events` | `AuditEvent` | None | Creator and RM are 403. Another company is 403 | e2e, page test |

## C. Not in this module

- A client route that inserts a sentence.
- An update or a delete of a sentence.
- Sign-in, page view, notification read, and folder-path rows.
- A copy of work saved before this table existed.
- A stored file. Asset sentences say the file was not stored.
- Rate limiting. That is Module 15.
- Backups and production deploy. That is Module 16.

## D. Files

- `apps/api/prisma/migrations/20261010250000_audit_event`
- `apps/api/src/audit/`
- `apps/web/src/pages/AuditPage.tsx`
- ADR 0020.

## E. Tests

API end-to-end covers a task, an upload, a title change, a rejection, a returned time entry, a membership grant, a creator denial, a missing company id, and the absence of a client create route. The page test covers the signed-out state, the admin refusal, and a stored sentence. Counts are in `TESTING_STATUS.md`.

## F. Manual verification

Steps are in `docs/manual-testing/14-audit.md`. Product-owner confirmation is still open.

## G. Health

No new outbound call. Rows are inserted only. See `SYSTEM_HEALTH.md`.

## H. Showcase

`/audit` lists sentences for the company selected in the tab when the caller is an admin. The page says earlier work is not copied here and no file is stored.
