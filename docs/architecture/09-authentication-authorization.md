# Authentication and authorization

## Implemented

`POST`, `GET`, and `DELETE /api/v1/session` use an httpOnly `dam_session` cookie. Passwords are scrypt hashes. A disabled user cannot keep a session or open a new one. Health and the Drive configuration report stay public because they expose no business records. ADR 0009.

Company membership is enforced on `/api/v1/companies` and `/api/v1/users`. The company menu lists the signed-in user’s memberships and does not grant access by itself. ADR 0010. Approval checks the role for the current stage. A creator submits, an RM decides the RM stages, and an admin decides admin QC and admin approval. Uploads stay open to any member of the company. ADR 0015. A creator reads and submits only their own time. An RM or admin of that company reads every entry there and accepts or returns a submitted one. ADR 0017. Dashboard counts use the same split: a creator sees their own rows, and an RM or admin sees every row in the company. ADR 0018. A notification is readable only by the user it addresses. Another person’s id is 404. ADR 0019. The audit list requires an admin of the requested company. A creator or RM of that company is 403. ADR 0020.

## Planned model

| Piece | Choice | Why |
|---|---|---|
| Login | Server session, httpOnly cookie | A bearer token in local storage is easier to steal from script. |
| Password storage | A slow password hash | Plain or reversible storage is rejected. |
| Session expiry | Fixed lifetime plus rotation on login | Document the lifetime in the auth module. |
| Disabled users | Checked on every protected request | A stale UI must not keep access. |
| Authorization | RBAC plus ABAC | Role is not enough. Company, department, ownership, and workflow state also matter. |

### Roles

| Role | Intended ability | Not allowed |
|---|---|---|
| Creator | Upload, edit permitted metadata, submit, read feedback, own tasks and time | Approve, manage users, read other companies |
| RM | Review and decide at RM stages, see team work, review timesheets | Final admin approval, cross-company admin |
| Admin | Users, roles, workflow configuration, admin QC and approval, archives, reports, audit | Implicit access to a company they are not a member of |

A person can belong to more than one company. The company selector lists memberships. Changing the selector changes the company sent on later calls. The API still checks membership. A crafted company id from another tenant is a 403, not an empty list that hides the denial.

Direct object access (`GET /assets/:id`) checks the asset's company, not the selector. The selector is a client convenience.

### Enforcement

- Guards run in Nest, before the service returns data.
- Services receive the authenticated principal and re-check when the rule depends on the row (owner, workflow state).
- The React route table can hide links. Hiding a link is not authorization.
- Tests for Module 4 must call the API as a SAPL-only user and request a BAPL id.

Google OAuth for Drive is a separate credential from user login. A user's Google account is not the DAM session unless a later ADR says so. The storage adapter uses the application connection described in document 10.
