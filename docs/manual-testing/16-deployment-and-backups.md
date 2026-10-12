# Manual test — Module 16

The running API on this workstation stays in development. Do not restart it with `NODE_ENV=production` while it uses the example database password. It will refuse to listen.

## Password refusal

From `apps/api`, with the workstation `DATABASE_URL`:

```bash
NODE_ENV=production node scripts/start-release.mjs
```

Expect exit code 1 and “DATABASE_URL uses the workstation password.” Expect no listen line. The message must not print the password.

Development and test still accept that password.

## Dump

```bash
BACKUP_PATH=/tmp/aaradhya-dam.sql node scripts/backup-database.mjs
```

Expect a JSON line with `path`, `bytes` greater than 0, and a note that the dump is local and Drive retention is not configured. Delete the file when finished. Do not commit it. A dump contains password hashes.

A `BACKUP_PATH` inside the repository must exit 1.

## Status page

Open `/`. Expect Ready when the API and PostgreSQL are up. Expect the sentences that a backup is a database dump an operator runs outside this page, and that this page does not deploy. There is no deploy button.

## Not claimed

`deploy/api.Dockerfile` was not built here. Docker was not installed. There is no offsite backup and no down migration.
