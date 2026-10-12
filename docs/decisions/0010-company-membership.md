# ADR 0010 — Company membership

## Status

Accepted. Module 4.

## Problem

Five companies have to exist as data, and a person limited to SAPL must be rejected when they request BAPL. The shell previously listed every company as a notice. Treating that list as access would be a false authorization check.

## Decision

- The migration inserts BAPL, SAPL, GBAPL, KABPL, and Ontale. There is no ASEDS row. `name` matches `code` because no separate legal name was specified.
- Roles are the enum `creator`, `rm`, and `admin`. They are not a table. The product brief fixes these three, and a table would imply roles can be invented at runtime.
- A membership is one user, one company, and one role. The same person can hold more than one role in one company, and can belong to more than one company.
- `GET /api/v1/companies` returns only the caller’s companies. `GET /api/v1/companies/:id` returns 403 when the company exists and the caller is not a member, and 404 when the id does not exist.
- Grant, revoke, the user list, and account status require the `admin` role on the relevant company. An admin of SAPL cannot manage BAPL. A status change is refused when the target also belongs to a company the caller does not administer.
- The last active admin membership of a company cannot be removed or disabled.
- The first admin is granted by `apps/api/scripts/grant-membership.mjs`. The API cannot create that first admin, because nobody would be allowed to call it.
- The company menu stores the selected id in memory for the tab. It is not sent as a credential and it is not authorization. Each company route checks membership again.
- TanStack Query caches the company list for the menu and the Companies page. ADR 0007.

## Alternatives

- Keep the five names only in the client. Rejected. FR-4.1 requires database rows, and a client list cannot enforce FR-4.2.
- Hide another company’s id as an empty list or a 404. Rejected. The authorization design says a crafted id is 403.
- Give every admin implicit access to every company. Rejected. Admin is a role inside a company, not a platform superuser.

## Trade-offs

Departments are still absent. An operator with `DATABASE_URL` can insert the first admin. That is the same trust boundary as creating the first user.

## Security

Passwords are not part of these responses. The session cookie is unchanged. Disabling an account still deletes the useful session on the next read, and login stays the same 401 as a wrong password.

## Scaling limit

The company list groups a person’s memberships in memory. That is acceptable while a person belongs to a handful of companies. Revisit if one account can hold more than the page size of 100.

## Revisit when

A department, a folder, or an asset needs the company id on the row. The membership check stays in the service that loads that row.
