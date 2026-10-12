# Module 4 — Companies and membership

## A. Purpose and status

The five companies exist as rows. A person sees and manages only the companies they belong to.

Status: **ready for manual verification**. Not COMPLETE until that verification is recorded.

## B. Functionality

| Name | Purpose | Role | UI | API | Data | External | Security | Tests |
|---|---|---|---|---|---|---|---|---|
| Company registry | Store BAPL, SAPL, GBAPL, KABPL, and Ontale | Operator | Companies page names the registry | — | `Company` | None | No ASEDS row | e2e |
| List memberships | Show the caller’s companies | Member | Company menu, `/companies` | `GET /api/v1/companies` | `Membership` | None | Other companies omitted | e2e, page test |
| Read one company | Reject a direct id outside membership | Member | — | `GET /api/v1/companies/:id` | `Company` | None | 403 for another company, 404 if missing | e2e |
| Grant membership | Add a role in a company the caller administers | Admin | Grant form | `POST .../memberships` | `Membership` | None | 403 outside the caller’s admin companies | e2e, page test |
| Revoke membership | Remove a role | Admin | Remove on the people table | `DELETE .../memberships/:id` | deletes the row | None | Last active admin is kept | e2e |
| List people | Show users who share an administered company | Admin | People table | `GET /api/v1/users` | `User`, `Membership` | None | Creator receives 403. Other companies’ memberships omitted | e2e |
| Disable account | Stop sign-in | Admin | Disable, then confirm | `PATCH /api/v1/users/:id` | `User.status` | None | Cannot disable yourself or a user who also belongs elsewhere | e2e |
| First admin | Operator grant before any admin exists | Operator | None | script | `Membership` | None | Requires `DATABASE_URL` | Script exits when env is missing |

## C. Not in this module

- Departments, assets, folders, and a live Drive call.
- Public registration. The grant form needs an account that already exists.
- A platform superuser. Admin is per company.
- Persisting the selected company as a credential.

## D. Files

- `apps/api/prisma/migrations/20261010170000_company_and_membership`
- `apps/api/src/access/`
- `apps/api/scripts/grant-membership.mjs`
- `apps/web/src/pages/CompaniesPage.tsx`
- `apps/web/src/shell/company.tsx`
- ADR 0010.

## E. Tests

API end-to-end covers the five rows, the SAPL-to-BAPL 403, Ontale grant, user listing, disable, and the last admin. Web tests cover the signed-out menu, an Ontale membership in the menu, and the grant notice. Counts are in `TESTING_STATUS.md`.

## F. Known defects

None in the membership flow. The selected company lives in the tab’s memory. A refresh selects the first active membership again.

## G. Manual verification

`docs/manual-testing/04-companies.md`.

## H. System health

Company routes require a session. Health and the Drive report stay public. See `SYSTEM_HEALTH.md`.

## Dependencies

PostgreSQL. `@tanstack/react-query` on the web, for the shared company list.

## Limitations

Anyone who can run the grant script against `DATABASE_URL` can insert a membership. That is an operator action on the workstation, not an API.
