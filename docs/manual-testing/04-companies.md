# Manual test — Module 4

The API and web app are running. Migration `20261010170000_company_and_membership` is applied to database `dam`. Create a user with the Module 3 script first. Do not commit the email or password.

## 1. Registry

```bash
psql "postgresql://dam:dam_local_dev_only@127.0.0.1:5432/dam" \
  -c 'SELECT code FROM "Company" ORDER BY code'
```

Expect BAPL, GBAPL, KABPL, Ontale, and SAPL. ASEDS must not appear.

## 2. Signed out

Open http://127.0.0.1:43123/companies . Expect "Sign in is required" and a Sign in link.

Open the company menu. Expect "Sign in to see company membership." The menu must not list BAPL as if it were assigned.

`GET /api/v1/companies` without a cookie is HTTP 401, "Sign in is required."

## 3. Grant the first membership

```bash
cd apps/api
GRANT_MEMBERSHIP_EMAIL="you@example.com" \
GRANT_MEMBERSHIP_COMPANY="SAPL" \
GRANT_MEMBERSHIP_ROLE="creator" \
  DATABASE_URL="postgresql://dam:dam_local_dev_only@127.0.0.1:5432/dam?schema=public" \
  node scripts/grant-membership.mjs
```

Expect JSON with `"company":"SAPL"` and `"role":"creator"`. Sign in at http://127.0.0.1:43123/sign-in . The company button shows SAPL. The menu does not show BAPL. `/companies` lists SAPL and has no grant form.

## 4. Direct BAPL request

From the signed-in browser session, or with the `dam_session` cookie:

```bash
curl -sS -b "dam_session=THE_COOKIE" \
  http://127.0.0.1:43124/api/v1/companies/4b4c0001-0000-4000-8000-000000000001
```

Expect HTTP 403 and "You do not have access to this company."

`GET /api/v1/companies/4b4c0002-0000-4000-8000-000000000002` returns SAPL.

## 5. Admin grant changes the other person’s menu

Grant yourself Ontale admin with the script (`GRANT_MEMBERSHIP_ROLE=admin`, company `Ontale`). Create a second user. Sign in as the Ontale admin, open `/companies`, and grant that second user the Creator role in Ontale. Expect "Ontale membership granted."

Sign in as the second user. The company menu includes Ontale. It still does not include BAPL unless that membership was granted too.

## 6. Cleanup

Delete the users you created, or disable them from the people table when an admin covers every company they belong to. Do not leave a shared password in database `dam`.
