# ADR 0019 — An in-app notice does not send email

## Status

The in-app row remains. Email delivery is ADR 0024. Module 13.

## Problem

An assignee, a person whose time was returned, and a creator whose asset was rejected need to see that event. Email, a queue, or a storage alert would claim a delivery this module does not have. Google Drive is not called, so there is no stored file to announce.

## Decision

- `Notification` is a row for one user and one company. Kinds are `task_assigned`, `time_returned`, and `asset_rejected`.
- The row is written in the same transaction as the assignment, the return, or the rejection. If the recipient is the actor, nothing is written.
- Assigning the same person again, clearing an assignee, or accepting time does not write a row.
- `GET /api/v1/notifications` returns only the caller’s rows, newest first. `unread` counts rows whose `readAt` is null.
- `POST /api/v1/notifications/:id/read` sets `readAt` once. Another person’s id is 404. Marking a read row again keeps the original time.
- The body and the href are stored on the row. No email is sent. Redis is not used. The client cannot create an arbitrary notice.
- There is no storage notice. Uploads stay `upload_failed` and `driveFileId` stays null.

## Alternatives

- Send email. Rejected. There is no mail transport, and the page would claim a message that was not sent.
- Let the client insert a notice. Rejected. The recipient and the text would no longer be tied to the event.

## Trade-offs

A notice stays after the task or asset is deleted, because the body and href are copied onto the row. That keeps user deletion from depending on those other rows, and it keeps the sentence the person already saw.

## Security

The list and the mark-read route use the session user id. A row for someone else is 404, the same as a missing id. The response has no file bytes.

## Revisit when

A mail transport exists, or a Drive call stores a file id. Until then the bell stays an in-app list and says that no email is sent.
