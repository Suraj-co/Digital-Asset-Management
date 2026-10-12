# Frontend file map

Root: `apps/web`. Alias `@` is `apps/web/src`. Entry: `src/main.tsx` mounts `App` inside React strict mode.

Styling lives in `src/index.css` (navy/paper tokens) and Tailwind classes. Primitives in `src/components/ui` are visual. Business rules live in pages and `src/api`.

Safe to restyle: class names, layout, `components/ui/*`, `PageHeader`, `StatePanels`, `CountChart`, sidebar link chrome.

Do not change without an API change: Zod schemas, `credentials: 'include'`, route paths, `actions` handling, company id query params, idempotency on upload.

## Shell and routing

| File | Purpose | Redesign |
|---|---|---|
| `src/App.tsx` | Route table | Keep paths |
| `src/shell/navigation.ts` | `NAV_ITEMS`, `COMPANY_CODES` | Labels can change; `to` values must match routes |
| `src/components/shell/SidebarNav.tsx` | Renders `NAV_ITEMS` with `NavLink` | Safe visual change. No nested Timesheet item in the current code |
| `src/components/shell/AppShell.tsx` | Skip link, sidebar, mobile `Sheet`, search, company, bell, user, breadcrumb, `QueryClient`, `SessionProvider`, `CompanyProvider` | Layout is safe. `currentCrumb` and search `GET` to `/assets?q=` are behavior |
| `src/components/shell/CompanySelector.tsx` | Loads memberships. Signed out: sign-in copy. Does not list companies the user does not belong to | Keep the "does not grant access" behavior |
| `src/components/shell/UserMenu.tsx` | Email or "Not signed in". Link to `/sign-in`. Sign-out calls `DELETE /api/v1/session` | Safe visual change |
| `src/components/shell/NotificationsMenu.tsx` | Bell. Query key `['notifications']`. `fetchNotifications()`. Unread badge when `unread > 0` | Shows the latest rows, including read. Link text is "All notifications" |
| `src/components/shell/NotificationList.tsx` | Body, company code, email detail, "Mark read" or "Read" | Link goes to `item.href` and does not mark read by itself |
| `src/components/shell/PageHeader.tsx` | `h1` plus description | Safe |
| `src/components/shell/StatePanels.tsx` | `LoadingState`, `EmptyState`, `ErrorState`, `IncompleteNotice` | Keep `onRetry` only when refetch exists |
| `src/components/shell/CountChart.tsx` | Recharts bar chart | Safe |
| `src/shell/session.tsx` / `session-context.ts` | `useSession()` | Do not cache a session the API rejected |
| `src/shell/company.tsx` / `company-context.ts` | `useCompany()` | Selection resets to the first membership on full reload |
| `src/api/session.ts` | `POST/GET/DELETE /api/v1/session` | Contract |
| `src/api/companies.ts` | Companies, memberships, users, pay rate, creator invitations | Contract |
| `src/lib/utils.ts` | `cn` | Safe |

Search form in `AppShell` navigates to `/assets?q=`. It matches code, title, or file name. It does not search file bytes.

## Pages

### `src/pages/SignInPage.tsx` — IMPLEMENTED

Route `/sign-in`. Form: email, password. Zod validation. `createSession` then query invalidation. Errors from `CompanyRequestError`. No role picker. After sign-in the same shell shows data the API allows.

### `src/pages/AcceptInvitationPage.tsx` — IMPLEMENTED

Route `/invite/:token`. Posts the token to `POST /api/v1/invitations/accept` with a password. Creates the user and creator membership. Depends on `src/api/companies.ts` invitation helpers.

### `src/pages/CompaniesPage.tsx` — IMPLEMENTED

Route `/companies`. Admin of the selected company can invite a creator, grant a membership, revoke a membership, and disable or enable a user. Calls companies, users, and invitation endpoints. Creator and RM see a reduced page when they are not admin.

### `src/pages/DashboardPage.tsx` — IMPLEMENTED

Route `/dashboard`. `fetchDashboard(companyId)`. Scope sentence from `scope`: `company`, `review`, or `own`. Sections: asset stage chart, task open/done, time status chart, payroll. Admin can `setPayRate`. Links: View assets, View tasks, View time. Does not load a separate task list or notification feed.

### `src/pages/FoldersPage.tsx` — IMPLEMENTED

Route `/folders`. Components: `DepartmentForm`, `ResolveForm`, `FolderBrowser`, `FilePanel`, `FileRow`.

- Departments: `GET/POST /api/v1/companies/:id/departments`.
- Catalog: `GET /api/v1/storage/folders?companyId=`.
- Resolve: the browser walks department, year, campaign, stage, and asset type. `ResolveForm` calls `resolveFolder` in `src/api/folders.ts`, which posts `POST /api/v1/storage/folders/resolve`. `renameFolder` patches the campaign only.
- `FilePanel` uploads through the asset API into the selected folder. Nested navigation is over stored catalog rows, not a raw Drive tree.
- Connect Google Drive copy is on this page. OAuth start is `GET /api/v1/storage/oauth/start` when the page links it.

Safe: table and tree chrome. Unsafe: path identity `(department, year, campaign, stage, assetType)` and `driveFolderId`.

### `src/pages/AssetsPage.tsx` — IMPLEMENTED

Route `/assets`. `fetchAssets`. Query `q` from the shell search. `UploadForm` posts multipart to `POST /api/v1/assets` with `Idempotency-Key`. `AssetTable` links to `/assets/:id`. `RetryControl` calls content retry. `reviewLabel` is a display label over `workflowStage`. Filters are the company selector plus search, not a second review system.

### `src/pages/AssetDetailPage.tsx` — IMPLEMENTED

Route `/assets/:assetId`. This is the asset approval screen.

- `ReviewPanel` renders `asset.actions` (`submit`, `approve`, `reject`, `publish`). Reject requires a reason. Calls `POST /api/v1/assets/:id/transitions`.
- `DecisionList` is the approval timeline from `decisions`.
- `VersionList` shows version number, file name, `driveFileId`, detail.
- `VersionForm` posts `POST /api/v1/assets/:id/versions`.
- `TitleForm` patches the title.
- `pendingReviewer` is display text from stage and publication. The server still decides who may act.

Do not add client-side stage jumps.

### `src/pages/TasksPage.tsx` — IMPLEMENTED

Route `/tasks`. `TaskForm` creates a task (`title`, `detail`, optional asset, deadline, priority, assignee email). `TaskWorkspace` buttons: Tasks, Planner, RM QC, Admin QC, Analytics. `inWorkspace` filters the same task list. It is not a new backend. Link label "Timesheets" goes to `/time`. `TaskTable` shows department, stage, priority. Department filter calls `fetchTasks(companyId, departmentId)`.

Priority `''` is omitted on create so the API receives `low | normal | high | undefined`.

### `src/pages/TaskDetailPage.tsx` — IMPLEMENTED

Route `/tasks/:taskId`. `TaskActions` posts `POST /api/v1/tasks/:id/transitions` with the server-provided actions (`start`, `submit`, `approve`, `reject`, `complete`, `resubmit`). `CommentForm` posts comments. `FileForm` uploads an attachment (`POST /api/v1/tasks/:id/files`), which the API stores in Drive when ready. History and comments come from `GET /api/v1/tasks/:id`.

### `src/pages/TimePage.tsx` — IMPLEMENTED

Route `/time`. Title "Time". `TimeForm` records work date (UTC, not future), minutes, note, optional task. `TimeTable` lists rows. `EntryActions` submits, accepts, or returns. Return requires a reason. No start/stop timer.

### `src/pages/NotificationsPage.tsx` — IMPLEMENTED

Route `/notifications`. Same query key as the bell, so they share cache. Full list for the signed-in user, read and unread. Mark read per row.

### `src/pages/AuditPage.tsx` — IMPLEMENTED

Route `/audit`. `fetchAuditEvents(companyId)`. Read-only sentences. Admin scope is enforced by the API.

### `src/pages/EnvironmentStatusPage.tsx` — IMPLEMENTED

Route `/`. `fetchHealth` against `/api/v1/health`. Shows API, database, and Redis. Not a product dashboard.

### `src/pages/DesignSystemPage.tsx` — IMPLEMENTED

Route `/design-system`. Sample controls. Discard dialog does not delete data. Safe to restyle. Do not treat sample rows as records.

### `src/pages/NotFoundPage.tsx`

Route `*`.

## API clients

| File | Endpoints |
|---|---|
| `src/api/health.ts` | `GET /api/v1/health` |
| `src/api/session.ts` | session create, read, delete |
| `src/api/companies.ts` | companies, memberships, users, pay rate, invitations |
| `src/api/folders.ts` | departments, folder list, folder patch, resolve |
| `src/api/assets.ts` | list, get, patch, delete, upload, content retry, versions, transitions |
| `src/api/tasks.ts` | list, get, create, patch, transitions, comments. File upload is called from `TaskDetailPage` |
| `src/api/time.ts` | list, patch, review |
| `src/api/dashboard.ts` | `GET /api/v1/dashboard` |
| `src/api/notifications.ts` | list, mark one read |
| `src/api/audit.ts` | `GET /api/v1/audit-events` |

Shared error type: `CompanyRequestError` in `companies.ts`.

## UI primitives

`src/components/ui/`: `badge`, `breadcrumb`, `button`, `dialog`, `dropdown-menu`, `input`, `label`, `separator`, `sheet`, `skeleton`, `table`, `textarea`. Generated-style shadcn pieces. Safe to replace if the same accessibility names stay: "Search", "Company", "Notifications", "Open navigation", "Primary".

## State, loading, errors

- Server data: TanStack Query. No Redux.
- Forms: React Hook Form + Zod on sign-in, tasks, and several editors. Other forms use local state.
- Loading: `LoadingState` or query `isLoading` before the company is ready.
- Errors: `ErrorState` with `refetch` where a retry can succeed.
- Signed-out and no-membership branches are explicit empty states. Keep them.

## What a redesign must not treat as missing

The bell is functional. It is not unread-only. Audit and Design system are real routes. Planner is a task workspace filter, not a sidebar parent. Timesheet is the Time page at `/time`.
