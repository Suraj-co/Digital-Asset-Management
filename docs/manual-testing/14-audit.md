# Manual test — Module 14

The API and web app are running. You need an admin membership in one company, and a second person in that company who is not an admin. Do not commit either email or password.

## 1. Signed out

Open `/audit`. Expect “Sign in is required” and a sentence that no file is stored and that earlier work is not copied here.

## 2. Not an admin

Sign in as a creator or RM and choose that company. Expect “You do not have access to manage this company.”

## 3. A new sentence

As an admin, plan a task or record an upload in that company. Open `/audit`. Expect a sentence that names the actor. An upload sentence says the file was not stored. There is no control that edits or deletes the sentence.

## 4. Earlier work

A task or time entry saved before this log started does not appear by itself. The page says earlier work is not copied here.

## 5. Another company

`GET /api/v1/audit-events?companyId={otherCompany}` as an admin of a different company is HTTP 403. A missing `companyId` is HTTP 400.

## 6. Cleanup

Delete only the temporary account, its audit rows, and the task or asset created for this check. Do not delete a pre-existing account.
