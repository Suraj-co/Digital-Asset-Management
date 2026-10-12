# API specification

Base path: `/api/v1`. OpenAPI UI: `/api/docs` when `NODE_ENV` is not `production`. The UI is generated from the Nest controllers. It is not a second source of truth.

## Implemented

### `GET /api/v1/health/live`

Does not touch PostgreSQL.

```json
{
  "status": "ok",
  "service": "aaradhya-dam-api",
  "version": "0.1.0",
  "timestamp": "2026-10-10T04:56:12.225Z",
  "correlationId": "03e71679-8eab-4666-a442-510fd06eb64b"
}
```

HTTP 200.

### `GET /api/v1/health`

HTTP 200 when the process can answer. `status` is `ok` or `degraded`.

```json
{
  "status": "ok",
  "service": "aaradhya-dam-api",
  "version": "0.1.0",
  "timestamp": "2026-10-10T04:56:12.291Z",
  "correlationId": "manual-check",
  "checks": {
    "api": { "status": "up" },
    "database": { "status": "up", "latencyMs": 58, "category": null }
  }
}
```

`database.category` is null on success. On failure it is one of `connection_refused`, `timeout`, `authentication_failed`, `database_not_found`, `database_unavailable`.

### `GET /api/v1/health/ready`

Same body as `/health`. HTTP 200 when the database check is `up`, otherwise HTTP 503.

### Errors

```json
{
  "statusCode": 404,
  "error": "not_found",
  "message": "Cannot GET /api/v1/missing",
  "correlationId": "b949f93b-165f-4d49-a1ac-9f49c348f95c",
  "timestamp": "2026-10-10T04:56:12.306Z",
  "path": "/api/v1/missing"
}
```

500 responses use the message `An unexpected error occurred.` and do not include a stack.

### `GET /api/v1/storage/connection`

HTTP 200. Reports whether `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are present. `liveCheck` is `not_run`. The handler does not call Google. Readiness does not depend on this route. The redirect URI defaults locally and is not a required setting. `GOOGLE_DRIVE_ID` is optional.

```json
{
  "status": "not_configured",
  "provider": "google_drive",
  "missing": [
    "GOOGLE_CLIENT_ID",
    "GOOGLE_CLIENT_SECRET"
  ],
  "liveCheck": "not_run",
  "detail": "Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET. The redirect URI has a local default. This response did not call Google.",
  "timestamp": "2026-10-10T05:40:00.000Z",
  "correlationId": "drive-check"
}
```

When the client id and secret are present and `GOOGLE_DRIVE_ID` is not, `status` is `configured`, `missing` is `["GOOGLE_DRIVE_ID"]`, and `detail` says Google was not called. When the drive id is also present, `missing` is empty and `detail` says the shared drive was not verified. Values are not returned.

### `POST /api/v1/session`

Body: `{ "email", "password" }`. HTTP 201 sets the `dam_session` httpOnly cookie and returns `{ user: { id, email, status }, expiresAt }`. The token is not in the JSON. HTTP 401 with "The email or password is incorrect." for an unknown user, a wrong password, or a disabled user. HTTP 400 when the body fails validation.

### `GET /api/v1/session`

HTTP 200 with the same user shape when the cookie matches an active user and an unexpired session. HTTP 401 "Sign in is required." otherwise. A disabled or expired session row is deleted.

### `DELETE /api/v1/session`

HTTP 204. Deletes the server session for the cookie and clears it.

### `GET /api/v1/companies`

Requires the session cookie. HTTP 200 returns `{ items, total, limit, offset }`. Each item is `{ id, code, name, active, roles }`. `roles` is the caller’s roles in that company. Companies the caller does not belong to are omitted. `limit` defaults to 20 and cannot exceed 100. HTTP 401 without a session.

### `GET /api/v1/companies/:id`

HTTP 200 with the same company shape when the caller is a member. HTTP 403 "You do not have access to this company." when the row exists and the caller is not a member. HTTP 404 "No company has that id." when it does not. The seeded ids are stable: BAPL `4b4c0001-0000-4000-8000-000000000001`, SAPL `4b4c0002-0000-4000-8000-000000000002`, GBAPL `4b4c0003-0000-4000-8000-000000000003`, KABPL `4b4c0004-0000-4000-8000-000000000004`, Ontale `4b4c0005-0000-4000-8000-000000000005`.

### `POST /api/v1/companies/:id/memberships`

Body: `{ "email", "role" }` where `role` is `creator`, `rm`, or `admin`. The caller must be an admin of that company. HTTP 201 returns the membership. HTTP 403 when the caller cannot administer that company. HTTP 404 when the email has no user. HTTP 409 when that membership already exists.

### `DELETE /api/v1/companies/:id/memberships/:membershipId`

HTTP 204. The caller must administer that company. HTTP 409 "This company needs an active admin." when the row is the last active admin membership.

### `GET /api/v1/users`

Requires an admin membership. HTTP 200 returns users who share one of those companies, with only those memberships attached. HTTP 403 "You do not have access to manage users." for a caller who is not an admin. Paginated like companies.

### `PATCH /api/v1/users/:id`

Body: `{ "status": "active" | "disabled" }`. The caller must administer every company the target belongs to. HTTP 403 "You cannot disable your own account." HTTP 403 "You do not have access to this user." when the target has a membership outside that set, or none inside it. HTTP 409 when disabling the user would leave a company without an active admin. A disabled user then fails login with the same message as a wrong password.

### `GET /api/v1/companies/:id/departments` and `POST /api/v1/companies/:id/departments`

Requires a session. List returns departments for a company the caller belongs to. Create requires the admin role and a name of letters, numbers, spaces, hyphens, or underscores. HTTP 201 returns the department. HTTP 409 when that name already exists. HTTP 403 when the caller cannot administer the company, or is not a member on the list.

### `GET /api/v1/storage/folders?companyId=`

Requires a session and membership in `companyId`. HTTP 200 returns catalog rows. `driveFolderId` is null and `liveCheck` is `not_run`.

### `POST /api/v1/storage/folders/resolve`

Body: `{ companyId, departmentId, year, campaign, stage, assetType }`. `stage` is `working`, `approved`, or `archive`. `assetType` is `images`, `videos`, `posters`, `banners`, `source_files`, or `other`. The server builds the path. HTTP 200 returns the row, including on a repeat of the same path. HTTP 403 for a company the caller does not belong to. HTTP 404 when the department is not in that company. A body field `driveFolderId` is HTTP 400. Google is not called.

### `POST /api/v1/assets`

Multipart body: `folderId`, `title`, and `file`. Requires a session and membership in the folder’s company. HTTP 201 returns the asset with `state: "upload_failed"`, `failureClass: "not_configured"`, and `driveFileId: null`. The file bytes are not stored. Google is not called. Optional header `Idempotency-Key` returns the same asset for the same payload and 409 for a different payload. A file over 20 MB is HTTP 400.

### `POST /api/v1/assets/:id/content`

Multipart body: `file`. HTTP 200 updates the recorded name and size and stays `upload_failed`. HTTP 403 when the asset belongs to another company.

### `GET /api/v1/assets` and `GET /api/v1/assets/:id`

The list is limited to the caller’s companies. `companyId` may narrow it and is 403 when the caller is not a member. Optional `q` matches code, title, or file name and does not search file contents. A blank `q` is ignored. One asset in another company is 403. An unknown id is 404. The body includes `updatedAt`. `driveFileId` is null.

### `POST /api/v1/assets/:id/versions`

Multipart body: `file`. HTTP 201 keeps the same asset id and appends a version such as `v002`. The earlier version row stays. Both versions have `driveFileId: null`. The file bytes are not stored. Optional `Idempotency-Key` returns the same versions for the same file name and size, and 409 for a different file. Another company’s asset is 403.

`POST /api/v1/assets/:id/content` still retries the latest version. It does not add a version number. Retry is HTTP 409 unless the stage is `draft`. A new version is HTTP 409 while the asset is in review. After `changes_requested`, a creator’s new version returns the asset to `scope_analysis` and writes a `resubmit` decision. An RM doing that is 403.

### `GET /api/v1/tasks`, `POST /api/v1/tasks`, and `PATCH /api/v1/tasks/:id`

The list is limited to the caller’s companies. `companyId` may narrow it and is 403 when the caller is not a member. Body fields are `title`, optional `detail`, optional `assetId`, and optional `assigneeEmail`. The asset and the assignee must belong to that company. Status is `open` or `done`. A null `assetId` or `assigneeEmail` on PATCH clears that link. A body field `driveFileId` is HTTP 400. The response has no time field. Time is recorded on `/api/v1/time-entries`, not on the task.

### `GET /api/v1/time-entries`, `POST /api/v1/time-entries`, `GET` and `PATCH /api/v1/time-entries/:id`

The list is limited to entries the caller may see. A creator sees their own. An RM or admin sees every entry in a company they review. `companyId` may narrow the list and is 403 when the caller is not a member. Create body: `companyId`, `workDate` as `YYYY-MM-DD`, `minutes` from 1 to 720, optional `note`, optional `taskId`. The task must belong to that company. The work date cannot be in the future. The entry starts `open` and the user is the caller. PATCH changes an open or returned entry and only the owner may send it. A submitted or accepted entry is 409. The response includes `minutes` as entered and `actions` for this caller. It has no payroll total.

### `POST /api/v1/time-entries/:id/review`

Body: `{ "action": "submit" | "accept" | "return", "reason"?: string }`. The owner submits from `open` or `returned`. An RM or admin accepts or returns a `submitted` entry. A return requires a trimmed reason. A reason on submit or accept is HTTP 400. A creator who tries to accept is 403. Review of an entry that is not submitted is 409, except submit of an open or returned entry.

### `GET /api/v1/dashboard`

Query: `companyId` (required UUID). HTTP 200 returns counts of stored assets, tasks, and time entries. `scope` is `own` for a creator and `company` for an RM or admin. A creator’s tasks include ones they created and ones assigned to them. Minutes are the sum of stored minutes on the counted time rows. Asset `uploadFailed` is the count whose state is `upload_failed`. Publication counts are `publicationNotStarted` and `publicationNotRun`. Another company is 403. A missing `companyId` is 400. The body has no payroll total and no stored-file count.

### `GET /api/v1/notifications` and `POST /api/v1/notifications/:id/read`

The list is only the signed-in person’s rows, newest first. Query `limit` and `offset` paginate it. The body includes `items`, `total`, `unread`, `limit`, and `offset`. `unread` counts that person’s rows whose `readAt` is null, not only the page. Each item has `id`, `companyCode`, `kind` (`task_assigned`, `time_returned`, or `asset_rejected`), `body`, `href`, `readAt` (ISO or null), and `createdAt`. Mark read returns HTTP 200. Another person’s id, and a missing id, are HTTP 404 with “No notification has that id.” Marking a read row again keeps the original `readAt`. The body has no `emailSent` field and no file bytes. A row is written only with an assignment to someone else, a return by someone else, or a rejection of someone else’s asset.

### `GET /api/v1/audit-events`

Query: `companyId` (required UUID), plus `limit` and `offset`. HTTP 200 returns sentences for that company, newest first. The caller must be an admin of that company. A creator, an RM, or an admin of another company is HTTP 403 with “You do not have access to manage this company.” An unknown company is HTTP 404 with “No company has that id.” A missing `companyId` is HTTP 400. The body includes `items`, `total`, `limit`, and `offset`. Each item has `id`, `companyCode`, `actorEmail`, `action`, `summary`, `subjectType`, `subjectId`, and `createdAt`. The body has no `updatedAt`, no `driveFileId`, and no file bytes. There is no route that creates, updates, or deletes a sentence. `POST /api/v1/audit-events` is HTTP 404. A sentence is inserted in the same transaction as the company change. Earlier work is not copied in.

### `POST /api/v1/assets/:id/transitions`

Body: `{ "action": "submit" | "approve" | "reject" | "publish", "reason"?: string }`. HTTP 200 returns the asset, including `workflowStage`, `publication`, `actions` for this caller, and `decisions`. `reject` requires a trimmed reason of 1–500 characters. A reason on another action is HTTP 400. The wrong role is 403. The wrong stage is 409. Admin approval sets `publication` to `not_run` and leaves the stage at `admin_approval`. The decision detail says Google Drive was not called and the file was not moved into `02_Approved`. `publish` retries that and stays `not_run`. `driveFileId` stays null.

### `PATCH /api/v1/assets/:id`

Body: `{ "title" }`. HTTP 200 returns the same asset shape with the new title. The state stays `upload_failed`. A body field `driveFileId` is HTTP 400. Another company’s asset is 403.

### Headers

| Header | Direction | Behavior |
|---|---|---|
| `X-Request-Id` | Request, optional | Kept if it matches `[A-Za-z0-9._:-]{1,128}` |
| `X-Request-Id` | Response, always | The id that was kept or generated |
| `Access-Control-Allow-Origin` | Response | The configured `WEB_ORIGIN` only |
| `Retry-After` | Response, HTTP 429 | Seconds until this client address can call again |

Every request that reaches this process counts toward one client address, taken from the socket. `X-Forwarded-For` is not read. The default is 240 requests in 60 seconds. The next request is HTTP 429 with `error: too_many_requests` and “Too many requests from this client. Try again later.” The body has no password and no file bytes. Requests over the limit are not each written as `request.completed`. The first refusal in a window is one warn line. The count is not shared with another API process. The map keeps at most 1000 addresses.

## Planned and not implemented

No reserved path from the original list remains. A path this API does not define returns 404.

Production refusal of the workstation database password is a startup check, not a route. `scripts/start-release.mjs` applies forward migrations and then listens. `scripts/backup-database.mjs` writes a local SQL dump. Neither is an HTTP route.

List routes stay paginated and filtered by the caller's companies on the server.
