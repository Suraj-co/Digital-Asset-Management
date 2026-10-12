# Module 3 — Server sessions

## A. Purpose and status

A person with an account can open a server session, and a disabled account cannot keep using one.

Status: **ready for manual verification**. Not COMPLETE until that verification is recorded. Company membership arrived in Module 4.

## B. Functionality

| Name | Purpose | Role | UI | API | Data | External | Security | Tests |
|---|---|---|---|---|---|---|---|---|
| Create session | Accept email and password | Operator | `/sign-in` | `POST /api/v1/session` | `User`, `Session` | None | httpOnly cookie, scrypt, same 401 for unknown, wrong, and disabled | e2e |
| Read session | Show who is signed in | Operator | Sign-in page, user menu | `GET /api/v1/session` | `Session` | None | 401 without a live active user | e2e, page test |
| End session | Sign out | Operator | Sign out | `DELETE /api/v1/session` | deletes the row | None | Cookie cleared | e2e |
| Replace session | A new login drops the previous cookie | Operator | Sign in again | POST | delete then insert | None | Old cookie 401 | e2e |
| Create user | Operator-only insert | Operator | None | script | `User` | None | Password not printed, minimum 12 characters | Script exits when env is missing |

## C. Not in this module

- Roles, company membership, the five company rows, Drive calls, assets.
- Public registration.
- A password reset flow.
- React Query on the session itself. The shell and the sign-in page share one session context. Module 4 installed TanStack Query for the company list.

## D. Files

- `apps/api/prisma/migrations/20261010154000_user_and_session`
- `apps/api/src/auth/`
- `apps/api/scripts/create-user.mjs`
- `apps/web/src/pages/SignInPage.tsx`
- `apps/web/src/shell/session.tsx`
- ADR 0009.

## E. Tests

API end-to-end covers wrong password, cookie session, rotation, and a disabled account. Web tests cover empty-field validation and a successful sign-in response. Counts are in `TESTING_STATUS.md`.

## F. Known defects

None in the session flow. The user menu shows the email only after the shell has read the session. It does not list companies, because none are assigned.

## G. Manual verification

`docs/manual-testing/03-sessions.md`.

## H. System health

Passwords are hashed. The cookie is not readable from page script. See `SYSTEM_HEALTH.md`.

## Dependencies

PostgreSQL. No new native module. React Hook Form and `@hookform/resolvers` validate the sign-in form.

## Limitations

Anyone who can run the create-user script against `DATABASE_URL` can insert an active user. That is an operator action on the workstation, not an API.
