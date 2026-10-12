# Manual test — Module 3

The API and web app are running, and migration `20261010154000_user_and_session` is applied to database `dam`.

## 1. No session

```bash
curl -sS -D - http://127.0.0.1:43124/api/v1/session -o /tmp/session.json -w "\n"
```

Expect HTTP 401, `"error":"unauthorized"`, and `"message":"Sign in is required."`

Open http://127.0.0.1:43123/sign-in . Expect the heading "Sign in" and no signed-in email. Click "Sign in" with empty fields. Expect "Enter an email."

## 2. Create a user

Pick an email you control and a password of at least 12 characters. Do not commit either.

```bash
cd apps/api
CREATE_USER_EMAIL="you@example.com" CREATE_USER_PASSWORD="a-long-password" \
  DATABASE_URL="postgresql://dam:dam_local_dev_only@127.0.0.1:5432/dam?schema=public" \
  node scripts/create-user.mjs
```

Expect JSON with `email` and `"status":"active"`. The password must not appear.

## 3. Sign in and sign out

On http://127.0.0.1:43123/sign-in enter that email and password. Expect "Signed in as" and a sentence that company membership is listed in the company menu and on the Companies page.

In the browser devtools, the `dam_session` cookie is HttpOnly. Page JavaScript must not be able to read `document.cookie` and see the token.

The user menu shows the email. Choose "Sign out" on the sign-in page. The form returns. `GET /api/v1/session` is 401 again.

## 4. Wrong password

Sign in with the right email and a wrong password. Expect "The email or password is incorrect." No cookie is stored.

## 5. Disabled account

```bash
PGPASSWORD=dam_local_dev_only psql -h 127.0.0.1 -U dam -d dam \
  -c "UPDATE \"User\" SET status = 'disabled' WHERE email = 'you@example.com';"
```

Sign in again. Expect the same incorrect-email-or-password message.

Set the user back to `active` if you want to keep using the account. Delete the row when you are finished:

```bash
PGPASSWORD=dam_local_dev_only psql -h 127.0.0.1 -U dam -d dam \
  -c "DELETE FROM \"User\" WHERE email = 'you@example.com';"
```

## What this does not prove

It does not prove company isolation. There are no company rows.
