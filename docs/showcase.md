# Showcase steps

Modules 0 through 16 are ready for manual verification and are not marked complete. Module 17 adds the payroll total, the dashboard charts, and the email copy. Google Drive still does not store a file. Use this order when you show the product.

## 1. Start the app

From the repository root, with Node.js 22.23.3:

```bash
pnpm install
pnpm --filter @aaradhya/api prisma:generate
pnpm --filter @aaradhya/api exec prisma migrate deploy
pnpm --filter @aaradhya/api build
pnpm --filter @aaradhya/api start
```

In a second terminal:

```bash
pnpm --filter @aaradhya/web dev
```

Open http://127.0.0.1:43123 and sign in with the account that already belongs to SAPL.

## 2. Show payroll and charts

1. Open Dashboard. The bars are the stored asset, task, and time counts. SAPL already has one Done task and one accepted 90-minute entry.
2. As an admin of that company, set the hourly rate. Example: `500.00` and `INR`, then Save rate.
3. The payroll total becomes accepted minutes times that rate. 90 accepted minutes at 500.00 per hour is 750.00. Open and returned minutes stay out of the total.
4. The audit page gains a sentence for the rate change.
5. Leave the rate blank on a company and the total says it is not calculated. The page does not invent an amount.

## 3. Show email and Redis

1. Install and start Redis on port 6379, or run `docker compose --profile jobs up -d redis` on a machine with Docker.
2. Set `REDIS_URL=redis://127.0.0.1:6379` in `.env` and restart the API.
3. Environment status shows Redis as Up. The API stays Ready when Redis is down; only PostgreSQL decides that.
4. Have one member assign a task to a different member of the same company. The recipient’s Notifications page shows the in-app sentence and “No mail server is configured. This copy is kept here and was not sent.”
5. To send that copy, set `SMTP_HOST`, `SMTP_PORT`, `SMTP_FROM`, and, when the server requires it, both `SMTP_USER` and `SMTP_PASSWORD`. Restart the API. The next notice moves to Sent. One SMTP value without the others refuses startup. The password is not shown.

## 4. What you still do before a file showcase

These are not done in the repository. Do them in this order.

1. In Google Drive, create or open a Shared Drive and copy its id. Put it in `.env` as `GOOGLE_DRIVE_ID`. The client id and secret are already the only Google secrets you edit. Do not invent an id.
2. Complete `neon login` in a browser, then:

```bash
neon link --project-id restless-shape-14487392 --branch production -y
neon deploy -y
```

Use a development branch for day-to-day data. The connection string you already have is the pooled host. Prisma migrations need the direct host, without `-pooler`. Keep `sslmode=require`. Put that URL in gitignored `.env` only when you intend the API to leave the workstation database.

3. Apply the Prisma migrations to that Neon database and create a user with `apps/api/scripts/create-user.mjs`. The workstation sign-in does not move with the database.
4. Add the OAuth consent path and one live Drive write: create the folder, store the file, save `driveFileId` on that version, and leave the earlier version in place. Then move an approved version into `02_Approved`. Preview stays unavailable until a file id exists. The client id and secret alone cannot open the Shared Drive; a token is required.
5. Walk `docs/manual-testing/` for modules 0 through 16, including the stopped-database steps in module 0. None of those modules are complete until you confirm them.
6. Run the API on a machine that stays up. Neon can be PostgreSQL. The Nest process is not a serverless function. Build `deploy/api.Dockerfile` on a machine with Docker, and copy a `pg_dump` off that machine when you need a backup that survives the disk.

## 5. What this showcase does not claim

- A file is stored in Drive.
- An email left the machine when SMTP is blank.
- A payroll total exists before an admin sets a rate.
- A chart counts stored files.
- Redis shares the rate limit. The limit remains one count inside each API process.
