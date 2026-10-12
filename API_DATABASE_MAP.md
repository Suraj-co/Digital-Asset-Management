# API and database map

Global prefix: `/api/v1`. Swagger: `/api/docs` when `NODE_ENV` is not `production`. Validation pipe rejects unknown body fields.

Guard: `SessionGuard` unless noted. Role checks are inside services, using `Membership` and `portal-scope.ts`. Cookie: `dam_session`.

Response shapes below are the persisted fields the UI reads. Swagger classes live next to each module (`*.types.ts`).

## Session and health

| Method | Route | Controller | Service | Request | Response | Role | Models |
|---|---|---|---|---|---|---|---|
| POST | `/session` | `SessionController` | `SessionService.create` | `email`, `password` | user id, email, status, `expiresAt` | Public | `User`, `Session` (deletes prior sessions for that user) |
| GET | `/session` | `SessionController` | `SessionService.read` | cookie | same, or 401 | Cookie | `Session`, `User` |
| DELETE | `/session` | `SessionController` | `SessionService.destroy` | cookie | 204 | Cookie | `Session` |
| GET | `/health` | `HealthController` | health checks | none | `status`, `checks.api/database/redis` | Public | none |
| GET | `/health/live` | `HealthController` | process | none | live | Public | none |
| GET | `/health/ready` | `HealthController` | dependencies | none | ready | Public | none |

## Companies, users, invitations

| Method | Route | Controller | Service | Request | Response | Role | Models |
|---|---|---|---|---|---|---|---|
| GET | `/companies` | `CompaniesController` | `CompaniesService.list` | page | memberships: id, code, name, active, roles | Signed in | `Company`, `Membership` |
| GET | `/companies/:companyId` | `CompaniesController` | `CompaniesService.get` | id | company | Member | `Company` |
| PATCH | `/companies/:companyId/pay-rate` | `CompaniesController` | pay rate | `hourlyRateMinor`, `currency` | company pay fields | Admin | `Company`, `AuditEvent` `pay_rate_set` |
| POST | `/companies/:companyId/memberships` | `CompaniesController` | grant | email, role | membership | Admin | `Membership`, `AuditEvent` |
| DELETE | `/companies/:companyId/memberships/:membershipId` | `CompaniesController` | revoke | ids | 204 | Admin | `Membership` |
| GET | `/users` | `UsersController` | `UsersService.list` | page | id, email, status | Admin-scoped | `User` |
| PATCH | `/users/:userId` | `UsersController` | `UsersService.update` | `status` active or disabled | user | Admin | `User`, `AuditEvent` |
| GET | `/companies/:companyId/creator-invitations` | `InvitationsController` | list | page | invitation rows, no raw token | Admin | `CreatorInvitation` |
| POST | `/companies/:companyId/creator-invitations` | `InvitationsController` | create | email, name | invitation | Admin | `CreatorInvitation`, `EmailDelivery` |
| POST | `.../creator-invitations/:invitationId/resend` | `InvitationsController` | resend | id | invitation | Admin | `EmailDelivery` |
| POST | `/invitations/accept` | `InvitationsController` | accept | token, password | session or user | Public token | `User`, `Membership` role creator, `Session` |

## Storage

| Method | Route | Controller | Service | Request | Response | Role | Models |
|---|---|---|---|---|---|---|---|
| GET | `/storage/connection` | `StorageConnectionController` | `StorageConnectionService.report` | none | `status` configured or not, `missing` names | Public | none. Does not call Google |
| GET | `/storage/oauth/start` | `DriveOauthController` | Google auth URL | none | redirect | Signed-in flow in practice | writes refresh token on callback |
| GET | `/storage/oauth/callback` | `DriveOauthController` | code exchange | `code` | stores `GOOGLE_REFRESH_TOKEN` | OAuth | env file, not a user table |
| GET | `/companies/:companyId/departments` | `DepartmentsController` | list | page | id, name | Member | `Department` |
| POST | `/companies/:companyId/departments` | `DepartmentsController` | create | `name` | department | Admin | `Department` |
| GET | `/storage/folders` | `FoldersController` | list | `companyId`, page | path, stage, assetType, year, campaign, `driveFolderId`, department | Member | `FolderCatalog` |
| POST | `/storage/folders/resolve` | `FoldersController` | resolve | company, department, year, campaign, stage, assetType | folder, creates Drive folder when ready | Member who may create | `FolderCatalog` |
| PATCH | `/storage/folders/:folderId` | `FoldersController` | update | catalog fields the DTO allows | folder | Admin or service rule | `FolderCatalog` |

`GOOGLE_DRIVE_ID` is what the connection report requires. `readWorkspaceEnv` uses `GOOGLE_DRIVE_ID` or, if that is blank, `GOOGLE_DRIVE_ROOT_ID`, as the upload root. A report can say `GOOGLE_DRIVE_ID` is missing while uploads still use `GOOGLE_DRIVE_ROOT_ID`.

## Assets

Controller `AssetsController`, service `AssetsService`. Visibility: `assetVisibility`.

| Method | Route | Request | Response | Role | Models |
|---|---|---|---|---|---|
| GET | `/assets` | `companyId`, `q`, page | `AssetDto` page | Portal scope | `Asset` |
| GET | `/assets/:assetId` | id | asset, versions, decisions, `actions` | Portal scope | `Asset`, `AssetVersion`, `WorkflowDecision` |
| GET | `/assets/:assetId/file` | id | bytes or redirect/stream from Drive | Portal scope | `AssetVersion.driveFileId` |
| POST | `/assets` | multipart file, title, folderId, `Idempotency-Key` | asset | Creator (or role allowed to upload) | `Asset`, `AssetVersion`, `UploadOperation` |
| POST | `/assets/:assetId/content` | file, idempotency | asset | Owner retry | `AssetVersion` |
| POST | `/assets/:assetId/versions` | file, idempotency | new version number + 1 | Creator path | `AssetVersion`. If publication was `ready`, stage returns to `draft` and publication to `not_started`. `approvedVersionId` stays |
| PATCH | `/assets/:assetId` | title | asset | Allowed editor | `Asset`, audit `asset_title_changed` |
| DELETE | `/assets/:assetId` | id | 204 | Authorized deleter | `Asset` cascade versions. `approvedVersionId` is restricted; delete clears the pointer first in tests |
| POST | `/assets/:assetId/transitions` | `action`, optional `reason` | asset | `allowedActions` | `WorkflowDecision`, maybe `approvedVersionId`, `DriveCleanup` |

`AssetDto` fields the web schema requires: id, companyId, companyCode, folderId, path, code, title, state, fileName, byteSize, contentType, driveFileId, failureClass, detail, createdAt, updatedAt, workflowStage, publication, actions, decisions, versions.

`state` is always `upload_failed`. `failureClass` is always `not_configured` in the enum, including after a successful Drive store. Clients must use `driveFileId`.

Transition rules: `apps/api/src/assets/workflow.ts` `planTransition`. Optimistic update uses `updateMany` on id + stage + publication. Count other than 1 throws "This asset was already decided."

## Tasks

Controller `TasksController`, service `TasksService`. Visibility: `taskVisibility`.

| Method | Route | Request | Response | Role | Models |
|---|---|---|---|---|---|
| GET | `/tasks` | `companyId`, optional `departmentId`, page | tasks plus stage counts | Portal scope | `Task` |
| POST | `/tasks` | companyId, title, detail, deadline, priority, assigneeEmail, assetId, departmentId | task | Member who can plan | `Task`, `TaskAssignment`, `TaskLink`, `Notification`, `AuditEvent` |
| GET | `/tasks/:taskId` | id | detail: comments, files, history, actions | Portal scope | `Task`, `TaskComment`, `TaskFile` |
| PATCH | `/tasks/:taskId` | title, detail, deadline, priority, assignee, asset | task | Authorized editor | `Task`. Direct `status: done` is rejected: "Use a task transition." |
| POST | `/tasks/:taskId/transitions` | `action`, `reason` for reject | task | `planTaskTransition` | `Task.stage`, `Task.status` becomes `done` only when stage is `completed` |
| POST | `/tasks/:taskId/comments` | body | comment | People who can see the task | `TaskComment` |
| POST | `/tasks/:taskId/files` | multipart | file metadata, `driveFileId` when stored | Same | `TaskFile` |

Task stages: `draft`, `assigned`, `in_progress`, `submitted_rm_qc`, `rm_approved`, `submitted_admin_qc`, `admin_approved`, `ready_to_publish`, `completed`, `changes_requested`. Coarse `status` stays `open` until `completed`, then `done`.

## Time, dashboard, notifications, audit

| Method | Route | Request | Response | Role | Models |
|---|---|---|---|---|---|
| GET | `/time-entries` | companyId, dates | entries | Worker sees own; RM/admin see review scope in `time.service.ts` | `TimeEntry` |
| POST | `/time-entries` | companyId, workDate, minutes, note, taskId | entry status `open` | Member | `TimeEntry` |
| GET | `/time-entries/:entryId` | id | entry | Scope | `TimeEntry` |
| PATCH | `/time-entries/:entryId` | minutes, note, date, task | entry | Owner while open or returned | `TimeEntry` |
| POST | `/time-entries/:entryId/review` | `submit`, `accept`, or `return` plus reason | entry | Owner submits; RM/admin accepts or returns | `TimeEntry`, `Notification` on return |
| GET | `/dashboard` | companyId | counts and payroll | Scope `own`, `review`, or `company` | reads `Asset`, `Task`, `TimeEntry`, `Company` |
| GET | `/notifications` | limit, offset | items, total, unread | Only `userId` of the caller | `Notification`, `EmailDelivery` |
| POST | `/notifications/:notificationId/read` | id | row with `readAt` | Owner, else 404 | `Notification.readAt` |
| GET | `/audit-events` | companyId, page | sentences | Admin of that company | `AuditEvent` |

`POST /notifications/read-all` and `?unread=true` are **NOT FOUND** in the current controller.

## Prisma relationships

- `Company` 1—N `Membership`, `Department`, `FolderCatalog`, `Asset`, `Task`, `TimeEntry`, `Notification`, `AuditEvent`, `CreatorInvitation`.
- `Department` 1—N `FolderCatalog` and optional `Task`.
- `FolderCatalog` unique on department + year + campaign + stage + assetType. Optional `driveFolderId`.
- `Asset` unique company+sequence and company+code. Optional `approvedVersionId` → `AssetVersion` (unique, ON DELETE RESTRICT, deferrable).
- `AssetVersion` unique asset+number. Optional `driveFileId`. Unique `(createdById, idempotencyKey)`.
- `UploadOperation` unique `(userId, idempotencyKey)`.
- `DriveCleanup.versionId` unique.
- `WorkflowDecision` belongs to asset and version. Not deleted by cleanup.
- `Task` 1—N assignments, links, comments, files, time entries.
- `TaskAssignment` unique task+user. `TaskLink` unique task+asset.
- `Notification.userId` is the only recipient. Optional 1—1 `EmailDelivery`.
- `Session.tokenHash` unique. `CreatorInvitation.tokenHash` unique.

Enums are listed in `apps/api/prisma/schema.prisma`. Migrations live in `apps/api/prisma/migrations`, including `20261012190000_version_cleanup` for `approvedVersionId`, `DriveCleanup`, and audit action `drive_file_removed`.

## Logic that must stay on the server

- Password checks and session deletion.
- `assetVisibility` and `taskVisibility`.
- `planTransition` and `planTaskTransition`.
- Time review authority.
- Idempotent upload and "trash the extra Drive file if the row already has a driveFileId".
- Setting `approvedVersionId` only when publication becomes `ready`.
- `retireDriveFiles` and `DriveCleanupService` keep rules.
- Audit writes.
- Email queue and recipient address.
