# Manual test — Module 13

The API and web app are running. You need two people in the same company: one who assigns or reviews, and one who receives the notice. Do not commit either email or password. No email is sent.

## 1. Signed out

Open `/notifications`. Expect “Sign in is required” and “No email is sent.” The bell, with accessible name “Notifications”, says the same. There is no unread count.

## 2. Empty inbox

Sign in as someone with no notices. Expect “No notifications” and “Nothing is waiting. No email is sent.”

## 3. Assignment

As the other member, add a task in that company and set the assignee to the first person. Sign in as the assignee. The bell’s accessible name includes “1 unread”. The body names the assigner and the task title. Open `/notifications` and see the same body and the company code. Mark read. The control becomes “Read”, and the unread count goes away. Marking it again does not change the time.

Assigning yourself does not add a row.

## 4. Returned time

Submit a time entry. Have someone else return it with a reason. The owner’s list shows that return, the minutes, and the reason. Accepting an entry does not add a row.

## 5. Rejection

Upload an asset, submit it, and reject it as a reviewer with a reason. The creator’s list shows the rejection and the reason. The href opens that asset. The file is still not stored.

## 6. Someone else’s row

`POST /api/v1/notifications/{id}/read` with another person’s id is HTTP 404, “No notification has that id.”

## 7. Cleanup

Delete only the temporary account, its notices, and the task or asset created for this check. Do not delete a pre-existing account.
