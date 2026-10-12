# Aaradhya DAM — Frontend Handover

Read-only inspection of `Aaradhya_DAM` on 2026-10-12. Status words mean:

- **IMPLEMENTED** — present in source and wired to a route or worker.
- **PARTIAL** — present, with a limit called out below.
- **PLANNED** — named in docs or UI copy, not backed by the behavior described.
- **NOT FOUND** — no implementation in `apps/web` or `apps/api/src`.

There is one web app and one API. Creator, RM, and Admin are membership roles on `Membership.role`, not separate portals.

## Architecture

```
Aaradhya_DAM/
  apps/web/          Vite + React 19 UI (port 43123)
  apps/api/          NestJS API (port 43124, prefix /api/v1)
  apps/api/prisma/   schema.prisma and migrations
  docs/              architecture notes, ADRs, design-system.md
  deploy/            api.Dockerfile
  package.json       pnpm workspace scripts
```

`apps/web` has no shared package with the API. Contracts are duplicated: Zod schemas in `apps/web/src/api/*` and Nest DTOs plus Prisma in `apps/api`.

| Layer | Stack | Entry |
|---|---|---|
| Web | React 19, React Router 8, TanStack Query, React Hook Form, Zod 4, Tailwind 4, Radix, Recharts | `apps/web/src/main.tsx` → `App.tsx` |
| API | NestJS 12, class-validator, Prisma 7, PostgreSQL via `pg` | `apps/api/src/main.ts` |
| Session | Cookie `dam_session`, hash stored on `Session` | `auth/session.service.ts`, `auth/session.guard.ts` |
| Drive | Google OAuth refresh token, Drive + optional Sheets | `storage/google-workspace.ts` |
| Mail | Nodemailer + BullMQ queue `mail` | `mail/mail.service.ts` |
| Cleanup | BullMQ queue `drive-cleanup` plus a 5s poll | `assets/drive-cleanup.service.ts` |

Vite proxies `/api` to `http://127.0.0.1:43124` (`apps/web/vite.config.ts`). The browser always calls `/api/v1/...` with `credentials: 'include'`.

`AppModule` imports: Config, Prisma, Google, Mail, Health, Storage, Auth, Access, Invitations, Assets, Tasks, Time, Dashboard, Notifications, Audit.

## How the pieces talk

1. The browser loads React. `SessionProvider` calls `GET /api/v1/session`.
2. `CompanyProvider` calls `GET /api/v1/companies` and keeps the selected company id in memory for the tab.
3. Page queries send that company id. The API checks `Membership` again. The selector does not grant access.
4. PostgreSQL is the system of record: users, assets, versions, decisions, tasks, time, notifications, audit.
5. When Drive is ready, uploads call Google and store `AssetVersion.driveFileId`. Folder rows store `FolderCatalog.driveFolderId`.
6. Notifications are rows for one `userId`. An `EmailDelivery` row may be queued. Redis/BullMQ sends mail. If Redis or SMTP is absent, the in-app row still exists and the email row is `held` or the worker polls without a queue.
7. After an asset becomes publication `ready`, obsolete Drive file ids are queued on `DriveCleanup`. The worker trashes them only after PostgreSQL confirms the new version is the active approved version.

## Routing

`apps/web/src/App.tsx` wraps every route in `AppShell`.

| Path | Page | Status |
|---|---|---|
| `/` | `EnvironmentStatusPage` | IMPLEMENTED |
| `/companies` | `CompaniesPage` | IMPLEMENTED |
| `/folders` | `FoldersPage` | IMPLEMENTED |
| `/assets` | `AssetsPage` | IMPLEMENTED |
| `/assets/:assetId` | `AssetDetailPage` | IMPLEMENTED |
| `/tasks` | `TasksPage` | IMPLEMENTED |
| `/tasks/:taskId` | `TaskDetailPage` | IMPLEMENTED |
| `/time` | `TimePage` | IMPLEMENTED |
| `/dashboard` | `DashboardPage` | IMPLEMENTED |
| `/notifications` | `NotificationsPage` | IMPLEMENTED |
| `/audit` | `AuditPage` | IMPLEMENTED |
| `/design-system` | `DesignSystemPage` | IMPLEMENTED |
| `/sign-in` | `SignInPage` | IMPLEMENTED |
| `/invite/:token` | `AcceptInvitationPage` | IMPLEMENTED |
| `*` | `NotFoundPage` | IMPLEMENTED |

Sidebar order is `NAV_ITEMS` in `apps/web/src/shell/navigation.ts`: Environment, Companies, Folders, Assets, Tasks, Time, Dashboard, Notifications, Audit, Design system.

There is no `/review` route. Asset review is `AssetDetailPage`. Task RM QC and Admin QC are workspace filters inside `TasksPage`, not separate routes.

## Authentication

**IMPLEMENTED.** `POST /api/v1/session` with email and password. `session.service.ts` deletes previous sessions for that user, then inserts one. A second sign-in invalidates the first cookie. `GET /api/v1/session` returns the principal or 401. `DELETE /api/v1/session` signs out.

`SessionGuard` protects company, user, invitation, asset, task, time, dashboard, notification, and audit routes. Health and `GET /api/v1/storage/connection` are not behind that guard. OAuth start/callback are separate.

Passwords are hashed in `auth/password.ts`. The API never returns `passwordHash`.

## Roles

`MembershipRole`: `creator`, `rm`, `admin`. A user can hold more than one role, including in different companies. There is no user-to-department membership table.

`access/portal-scope.ts`:

- Admin in a company sees that company's assets and tasks.
- RM sees own assets, assets in `scope_analysis` / `rm_qc` / `rm_approval`, assets they have decided, and assets linked to tasks they created or are assigned.
- Creator sees only assets they created.
- Tasks for RM and creator are limited to tasks they created or are assigned. Admin sees the company task list.
- If the same company has admin and a lower role, admin wins for that company (`buckets` excludes lower roles).

Stage actions are computed on the server (`assets/workflow.ts`, `tasks/task-workflow.ts`, `time/time.service.ts`). The UI renders `actions` from the response. Do not reimplement those rules in the client.

## Critical rules for a redesign

1. Keep routes and query keys stable unless the API client is updated with them.
2. Do not decide approval, rejection, publication, or cleanup in the browser. Call the existing transition endpoints.
3. `Asset.state` is only `upload_failed`. A stored Drive file still uses that enum. Success is `driveFileId` plus the detail string from the API.
4. Do not invent a second asset or task status. Use `workflowStage`, `publication`, and task `stage`.
5. Notification lists must stay scoped to the signed-in user. The API filters `Notification.userId`.
6. Company selection is not authorization.
7. Cookie requests need `credentials: 'include'`.
8. Zod parsers in `apps/web/src/api` must stay aligned with API DTOs. Extra or missing fields throw "did not match the contract."

## Feature map

| Feature | Status | Where |
|---|---|---|
| Sign-in, session cookie, sign-out | IMPLEMENTED | `SignInPage`, `UserMenu`, `session.controller.ts` |
| Creator invitation email and accept | IMPLEMENTED | `CompaniesPage`, `AcceptInvitationPage`, `invitations.controller.ts` |
| Role-specific data on one dashboard | IMPLEMENTED | `dashboard.service.ts` scope `own` / `review` / `company` |
| Separate portal apps | NOT FOUND | One shell |
| Nested folder catalog and uploads | IMPLEMENTED | `FoldersPage`, `folders.controller.ts`, `assets.controller.ts` |
| Google Drive upload and folder ids | IMPLEMENTED when env is ready | `google-workspace.ts` |
| Live Drive connection probe | NOT FOUND | `GET /storage/connection` does not call Google |
| Task plan, comments, file attachments | IMPLEMENTED | `TasksPage`, `TaskDetailPage` |
| Start/stop timer | NOT FOUND | Time is entered as minutes |
| Asset RM/Admin approval | IMPLEMENTED | `AssetDetailPage` + `workflow.ts` |
| Task RM QC / Admin QC | IMPLEMENTED | `TasksPage` workspaces + `task-workflow.ts` |
| Version retention and Drive cleanup | IMPLEMENTED | `version-retention.ts`, `drive-cleanup.service.ts` |
| Unread count and mark read | IMPLEMENTED | Bell and `NotificationsPage` |
| Unread-only bell and mark-all | NOT FOUND | List includes read rows; one mark-read button |
| Audit history | IMPLEMENTED | `AuditPage`; not deleted when the sidebar changes |

## Redesign safety

Appearance files: `src/index.css`, `src/components/ui/*`, `PageHeader`, `StatePanels`, `CountChart`, `SidebarNav` classes, page layout wrappers.

Behavior files: `src/api/*`, `src/shell/session.tsx`, `src/shell/company.tsx`, `workflow` actions rendered by `AssetDetailPage`, `TaskDetailPage`, and `TimePage`, folder resolve and upload forms.

Leave unchanged:

- Route paths in `App.tsx` and `NAV_ITEMS.to`.
- Cookie requests (`credentials: 'include'`).
- Zod field names and enums.
- `actions` arrays. Hide a button the API did not send.
- Company id on every company-scoped request.
- `Idempotency-Key` on uploads.
- Loading, empty, signed-out, and no-membership states.
- Responsive shell: sidebar from `md` up, sheet below.

Risky facts discovered in source:

- `Asset.state` is only `upload_failed`. A green "stored" state must key off `driveFileId`, not `state`.
- Connection status can report `GOOGLE_DRIVE_ID` missing while uploads use `GOOGLE_DRIVE_ROOT_ID`.
- The bell list includes read notifications. There is no mark-all endpoint.
- Planner and RM QC are filters inside `TasksPage`, not routes.
- There is no start/stop timer.
- Login replaces the previous session for that user.
- `docs/architecture` can lag the Prisma schema. Trust `schema.prisma` and the services named above.
- No shared frontend/backend types package. A DTO change must update both sides or the Zod parser fails closed.

## Related documents

- `FRONTEND_FILE_MAP.md`
- `API_DATABASE_MAP.md`
- `BUSINESS_LOGIC_WORKFLOWS.md`
- `ENVIRONMENT_SETUP.md`
