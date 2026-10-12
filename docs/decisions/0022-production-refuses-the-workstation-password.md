# ADR 0022 — Production refuses the workstation password

## Status

Accepted. Module 16.

## Problem

`.env.example` contains the database password `dam_local_dev_only` so a workstation can start. Copying that value into production would ship a known password. A backup that lands inside the repository could commit password hashes. A deploy button on the status page would claim a host this repository does not have.

## Decision

- When `NODE_ENV` is `production`, startup throws if the database URL’s password is the workstation password. Development and test still accept it.
- `node scripts/start-release.mjs` checks that password before `prisma migrate deploy`. Migrations stay forward-only. There is no down migration.
- `node scripts/backup-database.mjs` writes a plain SQL dump to an absolute `BACKUP_PATH` outside the repository. It does not upload the file. Google Drive retention is not configured.
- `deploy/api.Dockerfile` is the API image definition. It was not built here. Docker was not installed. The image is not started by `docker-compose.yml`, because that file still uses the workstation password.
- The environment page says a backup is an operator dump and that the page does not deploy. There is no deploy button.

## Alternatives

- Delete the example password. Rejected. Local setup would then need a secret that is not in the repository.
- Schedule backups from the API. Rejected. This process has no offsite store.
- Add a down migration. Rejected. Rollback is the previous build plus a dump restored into a new database, after an operator checks it.

## Trade-offs

A production process with a different password still needs TLS, a real `WEB_ORIGIN`, and a host. This module does not provide those.

## Security

The refusal message does not repeat the password. A dump contains password hashes and must stay outside the repository.

## Revisit when

A host exists. Build the API image there, set a new database password, and keep the dump off the application server.
