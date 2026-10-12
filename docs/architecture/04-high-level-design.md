# High-level design

## Logical shape

```text
Browser
  |
  |  same origin in development (Vite proxies /api)
  v
React application (apps/web)
  |
  |  HTTPS JSON, /api/v1
  v
NestJS API (apps/api)
  |
  +-- configuration and validation
  +-- health
  +-- auth, access, storage, assets, tasks, time, dashboard, notifications, audit
  |
  +---------------------------+
  |                           |
  v                           v
PostgreSQL 16             Google Drive API v3
metadata only             files and folders
                          (not connected)
```

Redis and BullMQ are not in the running process. See ADR 0004.

## Module boundaries inside the API

Each later feature is a Nest module with a controller, a service that owns the rules, and Prisma access through `PrismaService`. Controllers do not call Drive or invent permission checks that the service skips.

| Nest module | Responsibility | State |
|---|---|---|
| `HealthModule` | Liveness, readiness, dependency report | Implemented |
| `PrismaModule` | One shared PostgreSQL client | Implemented |
| `AuthModule` | Server sessions | Implemented |
| `AccessModule` | Companies, memberships, and user status inside those companies | Implemented |
| `StorageModule` | Drive configuration report and the folder catalog. No Google call. | Implemented. `driveFolderId` stays null. |
| `AssetsModule` | Upload metadata, metadata search, title edits, failed version history, and review decisions. No preview and no Drive file. | Failure path, search, versions, and approval decisions implemented. Publication stays `not_run`. |
| `TasksModule` | Company-scoped plans, one assignee, and one asset link. No time on the task row. | Implemented |
| `TimeModule` | Minutes a person entered, optional task in the same company, and review. No payroll total. | Implemented |
| `DashboardModule` | Counts of stored assets, tasks, and time for one company. No chart and no stored-file count. | Implemented |
| `NotificationsModule` | In-app notices for an assignment, a returned time entry, and a rejection. No email. | Implemented |
| `AuditModule` | Inserted sentences for completed company changes. No client create, update, or delete. | Implemented |
| Rate limit | Count requests from one client address in this process. No Redis. | Implemented |

## Data ownership

PostgreSQL owns ids, relationships, workflow state, and the Drive file id for each stored object. Drive owns bytes. The two stores do not share a transaction. An upload now writes an operation row and stops at `drive_failed` because Google is not called. No Drive file id is stored. Search reads that metadata. A title edit does not create a file. A new version keeps the asset id and the earlier version row, and still stores no file. A review decision updates the stage in the same transaction and does not call Google. Admin approval leaves `publication` at `not_run`. A time entry stores minutes on its own row and does not change the task. A notification stores the body and href in the same transaction as the event and does not send email. An audit sentence is inserted in that same transaction and is not updated.

## Request path today

1. Helmet and CORS.
2. The rate limit counts the socket address. Over the limit, the response is HTTP 429 and the request log line is not written.
3. Correlation middleware assigns `X-Request-Id` and writes one JSON line when the response finishes.
4. Global exception filter turns failures into a small JSON body.
5. Global validation pipe is armed for later bodies.
6. `HealthController` reads the correlation id stored on the request.

`configureApp` in `apps/api/src/configure-app.ts` is the function both `main.ts` and the end-to-end tests use, so the test server matches the process.
