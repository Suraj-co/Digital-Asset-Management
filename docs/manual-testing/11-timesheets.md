# Manual test — Module 11

The API and web app are running. Migration `20261010230000_time_entry` is applied. You need a membership in SAPL. An RM or admin of that company can accept or return. Do not commit the email or password.

## 1. Signed out

Open `/time`. Expect “Sign in is required” and a sentence that minutes are the number you enter and that the page is not a payroll total.

## 2. Record

Sign in, choose SAPL, leave the task as “No task”, and enter 90 minutes. Expect “90 minutes recorded. This is not a payroll total.” The row shows 90, Open, and your email. A creator sees “You see your own entries.” An RM or admin sees “You see every entry in this company.”

## 3. Submit and review

On an open row, choose Submit. The status becomes Submitted. As an RM or admin, Accept changes it to Accepted. Record another entry, submit it, and Return it with a reason. Expect Returned and that reason. Save minutes, then Submit again. A return with an empty reason is refused.

## 4. Limits

Minutes of 0 are refused. A work date after today (UTC) is refused. A task that belongs to another company is refused. There is no hours field.

## 5. Other company

With a BAPL session, `GET /api/v1/time-entries?companyId={saplId}` is HTTP 403. A creator cannot read a teammate's entry.

## 6. Cleanup

Delete time entries created only for this check before deleting their tasks or users. `userId` and `reviewedById` block user deletion. Do not leave a shared password in database `dam`.
