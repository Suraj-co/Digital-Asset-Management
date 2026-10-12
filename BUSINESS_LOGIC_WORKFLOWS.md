# Business logic and workflows

Status words match `ANTIGRAVITY_HANDOVER.md`. All rules below are in `apps/api/src` unless noted.

## Authentication — IMPLEMENTED

`POST /api/v1/session` compares the password with `User.passwordHash` (`auth/password.ts`). On success, `session.service.ts` deletes every existing `Session` for that user, then stores a new token hash. The cookie name is `dam_session`. A second login of the same account invalidates the first browser.

`SessionGuard` loads the session on later requests. Disabled users cannot continue as active accounts (`User.status`).

There is no SSO and no per-department login. **NOT FOUND.**

## Roles — IMPLEMENTED

Roles are rows in `Membership`, not columns on `User`. Values: `creator`, `rm`, `admin`. Unique on `(userId, companyId, role)`, so one person can be both RM and admin only as two rows; `portal-scope.ts` treats admin as the wider bucket and drops the lower role for that company.

Invitation acceptance creates a creator membership for one company. Admins grant other roles from `CompaniesPage`.

There is no table that assigns a user to a department. Department on a task or folder is catalog data. **NOT FOUND** as an authorization boundary.

## Asset approval — IMPLEMENTED

Source: `apps/api/src/assets/workflow.ts`.

Stages: `draft` → `scope_analysis` → `rm_qc` → `rm_approval` → `admin_qc` → `admin_approval`. Rejection from any review stage goes to `changes_requested`.

Who may act (`STAGE_ROLE`):

| Stage | Role |
|---|---|
| `draft`, `changes_requested` | creator |
| `scope_analysis`, `rm_qc`, `rm_approval` | rm |
| `admin_qc`, `admin_approval` | admin |

Actions:

- Draft: `submit` moves to `scope_analysis`.
- `changes_requested`: `allowedActions` returns none. The creator sends a new version instead.
- Review stages: `approve` or `reject`. Reject requires `reason`. A reason on any other action is 400.
- Approve walks one stage at a time. The last approve, while publication is `not_started`, sets publication `ready` and stays on `admin_approval`.
- If publication is already `ready`, the only admin action is `reject`. Another approve returns 409 "This asset is ready to publish."
- `publish` is allowed only when stage is `admin_approval` and publication is `not_run`. The normal approve path sets `ready` directly, so `publish` is the recovery action for a `not_run` row.

Each decision inserts `WorkflowDecision` with from/to stage, actor, reason, and detail. The asset detail page renders that list. It is the approval timeline. **IMPLEMENTED.**

A new file version (`addVersion`) always uses `number + 1`. It does not reuse a rejected version row. If the asset was publication `ready`, the new version sets stage `draft` and publication `not_started` and leaves `approvedVersionId` pointing at the last fully approved version.

Resubmit after rejection is a new version, which the service places back into review (decision action `resubmit` exists on `WorkflowAction`). The UI posts versions, not a fake stage.

Creators cannot approve. RMs cannot approve `admin_qc` or `admin_approval`. The UI must keep using `actions` from the GET.

Concurrent decisions: `updateMany` where id, stage, and publication match. If another request already moved the row, the API returns "This asset was already decided."

## Version retention — IMPLEMENTED

`approvedVersionId` is set in the same transaction that makes publication `ready`, and it points at the latest version.

`retireDriveFiles` (`version-retention.ts`) returns other versions' Drive ids only when the approved version has a non-null `driveFileId` and the other id is different. If the new approved version has no Drive id, nothing is queued. A shared file id is not retired.

`AssetsService` upserts `DriveCleanup` rows for those ids. Rows already `deleted` stay deleted. Older `kept` or `failed` rows for obsolete versions can return to `pending`.

`DriveCleanupService`:

- Polls every 5 seconds. Optional BullMQ queue name `drive-cleanup` when `REDIS_URL` is set.
- Claims `pending` or `failed` rows with `attempts < 5`, or a `running` row older than 2 minutes.
- `keepReason` refuses deletion when the version's `driveFileId` no longer matches, publication is not `ready`, this version is still `approvedVersionId`, `approvedVersionId` is null, or any version with that Drive id belongs to an asset whose approved pointer is that version or whose publication is not `ready`.
- Those cases are stored as status `kept`.
- If `keepReason` returns null, the service asks Google to remove the file. A thrown error becomes status `failed` and detail "Google Drive did not delete the file." or the error message.
- Success clears the obsolete version's `driveFileId` only after the delete is accepted, writes audit action `drive_file_removed`, and sets cleanup `deleted`.
- `WorkflowDecision` rows are not deleted.

Rejection never enqueues cleanup and never clears `approvedVersionId`.

Duplicate uploads: the same `Idempotency-Key` returns the existing asset or version. If a second Drive upload lands after the row already has `driveFileId`, the extra file is trashed. **IMPLEMENTED** in `persistDriveFile`.

## Task workflow — IMPLEMENTED

Source: `apps/api/src/tasks/task-workflow.ts`.

Assignee path: `assigned` --start--> `in_progress` --submit--> `submitted_rm_qc`. From `changes_requested`, the assignee `resubmit`s to `submitted_rm_qc`.

Responsible RM: `submitted_rm_qc` --approve--> `rm_approved` --approve--> `submitted_admin_qc`. Reject goes to `changes_requested` and requires a comment.

Admin: `submitted_admin_qc` --approve--> `admin_approved` --approve--> `ready_to_publish` --complete--> `completed`. Admin reject from those stages also goes to `changes_requested`.

`completed` sets coarse status `done`. Patching `{ status: 'done' }` is rejected.

`TasksPage` workspaces filter this one list:

- Planner, Tasks, RM QC, Admin QC, and Analytics are client filters in `inWorkspace`.
- They are **IMPLEMENTED** as views, not as extra tables.

Comments (`TaskComment`) and attachments (`TaskFile`, optional `driveFileId`) are **IMPLEMENTED** on `TaskDetailPage`.

A start/stop timer is **NOT FOUND**.

## Timesheets — IMPLEMENTED as time entries

Model `TimeEntry`. Status: `open`, `submitted`, `accepted`, `returned`.

The worker creates and edits while `open` or `returned`. Submit sets `submitted`. Accept sets `accepted` and is what payroll uses. Return requires a reason, sets `returned`, and writes a `time_returned` notification to the worker.

Optional `taskId` links minutes to a task in the same company. The Time page is `/time`. The tasks page link is labeled "Timesheets".

Payroll on the dashboard is accepted minutes times `Company.hourlyRateMinor`. Currency is `INR`, `USD`, or `EUR`. Amount is minor units. If the rate is null, the total is not calculated. **IMPLEMENTED.** An admin sets the rate. This is not a payroll run or payslip. **PARTIAL.**

## Notifications — IMPLEMENTED

`NotificationsService.write` inserts a row for one recipient `userId` and may insert `EmailDelivery`. Kinds: `task_assigned`, `task_updated`, `time_returned`, `asset_submitted`, `asset_approved`, `asset_rejected`.

`GET /notifications` counts and lists only that user's rows. `unread` is the count of rows with `readAt` null. The list itself includes read rows. `POST /notifications/:id/read` sets `readAt` once. Another user's id is 404 "No notification has that id." Mark-all and unread-only query are **NOT FOUND**.

The bell and the notifications page share query key `['notifications']`. Clicking the body link navigates to `href` and does not mark the row read. The button does.

## Email — IMPLEMENTED, delivery depends on env

`MailService` polls every 2 seconds. Queue name `mail` when Redis is configured. Without SMTP, delivery is `held` and the in-app notification remains. Status values: `pending`, `queued`, `held`, `sent`, `failed`.

Creator invitations store a token hash, not the raw token, and queue an email the same way.

## Google Drive — IMPLEMENTED when configured

`GoogleWorkspaceService.readWorkspaceEnv` needs client id, client secret, refresh token, and a root id (`GOOGLE_DRIVE_ID` or `GOOGLE_DRIVE_ROOT_ID`).

OAuth: `GET /api/v1/storage/oauth/start` builds the Google URL. `GET /api/v1/storage/oauth/callback` exchanges the code and writes `GOOGLE_REFRESH_TOKEN` into the process env and the workspace env file. The redirect URI must be registered on the Google client. Default: `http://127.0.0.1:43124/api/v1/storage/oauth/callback`.

Folder resolve creates a Drive folder under the root and stores `driveFolderId`. Uploads create a Drive file and store `driveFileId`. Downloads use `GET /api/v1/assets/:id/file`.

`GET /api/v1/storage/connection` only checks that `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`, and `GOOGLE_DRIVE_ID` are non-empty. It does not call Google. **PARTIAL** as a health probe.

If Drive is not ready, the API still records the asset and the bytes are not stored. The UI must not pretend a file exists when `driveFileId` is null.

Sheets id `GOOGLE_SHEETS_ID` is read for history export support in the Google service. It is not a second DAM database.

## Audit — IMPLEMENTED

`AuditService.write` appends `AuditEvent` inside the same transaction as the change. Actions include asset, task, time, membership, invitation, account, pay rate, and `drive_file_removed`. The audit page lists those sentences for a company. Sign-in and page views are not audit events.

## Dashboard scope — IMPLEMENTED

`DashboardService` returns `scope`:

- `company` for an admin of the selected company.
- `review` for an RM.
- `own` for a creator.

Counts are SQL aggregates of stored rows. They are not mock charts.

## Known gaps

| Item | Status |
|---|---|
| Separate Creator, RM, and Admin apps | NOT FOUND |
| Unread-only bell, mark all read | NOT FOUND |
| Start/stop timer | NOT FOUND |
| User-department ACL | NOT FOUND |
| Asset `state` other than `upload_failed` | NOT FOUND. Do not infer failure from this enum |
| Unified `/review` page | NOT FOUND. Review is the asset detail page and task workspaces |
| Connection check calling Google | NOT FOUND |
| Moving approval rules into React | Must not be done |
