# Manual test — Module 10

The API and web app are running. Migration `20261010220000_task` is applied. You need a membership in SAPL and, for the assignee check, a second person in that same company. Do not commit the email or password.

## 1. Signed out

Open `/tasks`. Expect “Sign in is required” and a sentence that a task does not record time.

## 2. Add a task

Sign in, choose SAPL, and add a title. Leave the asset as “No asset” and leave the assignee empty. Expect the notice “Time was not recorded.” The row says Open and Unassigned.

## 3. Assignee and asset

Add another task with an asset code from this company and the other member’s email. Expect that code and email on the row. An email that belongs only to BAPL is refused.

## 4. Done

Choose Mark done. Expect Done. Choose Reopen. Expect Open. There is no hours field.

## 5. Other company

With a BAPL session, `GET /api/v1/tasks?companyId={saplId}` is HTTP 403.

## 6. Cleanup

Delete tasks created only for this check before deleting their users. Do not leave a shared password in database `dam`.
