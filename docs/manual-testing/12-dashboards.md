# Manual test — Module 12

The API and web app are running. You need a membership in SAPL. An RM or admin sees every row in that company. A creator sees their own. Do not commit the email or password.

## 1. Signed out

Open `/dashboard`. Expect “Sign in is required” and a sentence that counts are stored rows and that the page is not a payroll total.

## 2. Counts

Sign in and choose SAPL. Expect either “You see every row in this company.” or “You see your own rows.” Assets include Upload failed. Tasks include Open and Done. Time includes “Sum of stored minutes” and says that is not a payroll total. There is no chart.

## 3. Links

View assets, View tasks, and View time open those pages. They are the same lists as the navigation.

## 4. Other company

With a BAPL session, `GET /api/v1/dashboard?companyId={saplId}` is HTTP 403.

## 5. Cleanup

This module does not add a row. Do not delete the account you used to read the counts.
