# Threat model

## Assets

| Asset | Where it will live | Module 0 exposure |
|---|---|---|
| Marketing files | Google Drive | None. No upload. |
| Metadata, memberships, audit | PostgreSQL | Users, sessions, companies, memberships, departments, folder paths, failed uploads, titles, version rows, review decisions, and audit sentences for completed company changes. No file bytes. A sign-in and a page view are not audit rows. |
| Database URL | Environment | On disk in gitignored `.env`. Example password is in git. |
| Session cookies | Browser | httpOnly `dam_session`. PostgreSQL stores a SHA-256 of the token. |
| Drive refresh token | Server, later | Do not exist. |
| Logs | stdout | Health traffic and error categories. URL passwords are redacted. |

## Actors

- An anonymous caller of the public health routes. In scope now.
- A signed-in creator, RM, or admin. Company membership, upload failure, metadata search, title edits, version attempts, and review decisions are in scope. Preview is not. Approval checks the stage role.
- A compromised workstation with `.env`. In scope as an operational risk.

## What was considered for Module 0

| Threat | Mitigation | Residual |
|---|---|---|
| Caller learns a stack trace or SQL text | Exception filter hides 500 details | Server logs still contain a redacted detail for operators |
| Log injection through `X-Request-Id` | Id must match a short safe pattern | A valid id can still be misleading. It cannot add a newline. |
| Credential in a driver error returned to the client | Health body has a category only. Redactor covers URL userinfo. | A novel error format might still leak if it avoids `postgresql://user:pass@`. Add a case when seen. |
| Cross-origin browser call | CORS allows only `WEB_ORIGIN` | Health data is not secret. CORS is not a substitute for later authorization. |
| Clickjacking the API JSON | Helmet `X-Frame-Options: SAMEORIGIN` | Low value against a JSON API |
| Missing dependency scripts silently skipped | `pnpm.onlyBuiltDependencies` allows Prisma engines | A future native module must be added to that list or install will skip it |
| Local password reused in production | `NODE_ENV=production` refuses a database URL whose password is the workstation password. The error does not repeat it. `start-release` checks before migrate. | Development and test still accept it. A different weak password is not detected. TLS is still required on the host. |
| HSTS pinning the developer browser | HSTS disabled unless `NODE_ENV=production` | Production must actually use TLS |
| Unauthenticated health flood | This process counts each socket address. Over the limit the response is HTTP 429 and that call is not written as `request.completed`. | A second API process has its own count. The Vite proxy makes browser calls share 127.0.0.1. `X-Forwarded-For` is not trusted. The map keeps 1000 addresses. This is not a distributed denial-of-service control. |

## Review against the routes that exist

Checked with Module 15. No new external call and no new table.

| Route group | What a caller can do | What still holds |
|---|---|---|
| `GET /api/v1/health`, `/live`, `/ready` | Public. Live does not query PostgreSQL. Ready and health report a category, not a password. | The same address limit applies, including these public routes. |
| `GET /api/v1/storage/connection` | Public configuration report. Google is not called. | No Drive token exists to steal. |
| `/api/v1/session` | Cookie session. A bad password is 401. A new login deletes that user’s other sessions. | The address limit slows a password spray from one machine. It does not lock an account. |
| Companies, users, folders, assets, tasks, time, dashboard | Membership or stage role is checked on the server. Another company is 403. | The limit does not replace those checks. |
| `/api/v1/notifications` | Only the signed-in user’s rows. Another id is 404. | No email is sent. |
| `/api/v1/audit-events` | Admin of that company. Sentences are inserted, not updated. | There is no client create route. |
| Swagger `/api/docs` | Served when `NODE_ENV` is not production. | Production does not mount it. Requests to it still count. |

## Explicitly not mitigated yet

Session theft, Drive token theft, and malicious uploads are not mitigated yet. Company, user, department, and folder routes check membership. Folder names cannot contain a slash or `..`. The request limit does not survive a second API process and does not read a forwarded client address.

## Security review trigger

A live Drive call is still absent. Any new external call or new table should add a row here in the same change. A dump contains password hashes and must stay outside the repository.
