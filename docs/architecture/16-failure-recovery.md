# Failure recovery and consistency

## Implemented now

| Failure | What happens | How to recover |
|---|---|---|
| `DATABASE_URL` missing or not PostgreSQL | Process exits before listen. Message names the variable. | Fix `.env` and start again. |
| PostgreSQL down after start | `/health` is HTTP 200 `degraded` with a category. `/health/ready` is HTTP 503. `/health/live` stays 200. | Restore PostgreSQL. The next check connects. Membership and folder rows are ordinary database writes. A crash before commit leaves them unwritten. There is still no Drive operation to replay. |
| Unknown route or bug | JSON error, correlation id, log line | Follow `docs/operations/troubleshooting.md`. |
| Process crash | Nothing is queued. In-flight requests end. | Start the process again. No data repair. |

Prisma disconnects when the Nest app closes, including tests.

## Planned for Drive plus database

There is no two-phase commit. The asset module will use an operation row:

```text
pending -> drive_succeeded -> recorded
pending -> drive_failed
drive_succeeded -> record_failed
```

Recovery:

- `drive_failed` with no file id: safe to retry the upload if the idempotency key matches.
- `drive_succeeded` with no database file id: reconciliation lists the Drive folder for the idempotency key and stores the id. It must not upload a second copy.
- Database committed and Drive move failed during publish: asset stays unpublished and the move can be retried.

Orphan detection compares Drive files under the known root with `driveFileId` rows. Missing-file detection is the opposite. Both are read-only until an admin confirms a repair.

## Backups

An operator can run `apps/api/scripts/backup-database.mjs`. It writes a plain SQL dump outside the repository and stops. Nothing schedules that command, nothing copies the file off the machine, and Google Drive retention is not configured. Restore is a new database, after the operator reads the dump. Production startup refuses the workstation database password before it migrates or listens.

## What not to do

Do not delete a database row because a Drive call failed, and do not delete a Drive file because a database call failed, until the operation row says which side completed.
