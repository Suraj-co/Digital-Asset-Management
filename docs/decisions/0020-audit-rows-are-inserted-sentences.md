# ADR 0020 — An audit row is an inserted sentence

## Status

Accepted. Module 14.

## Problem

An admin needs one list of completed company changes. A log that can be edited, or that claims a file was stored, would not be a record of what this application did. Sign-ins and page views are not company work. Work saved before this table existed cannot be reconstructed honestly.

## Decision

- `AuditEvent` is inserted in the same transaction as the change. Application code does not update or delete it.
- The summary is a sentence. It names the actor, the action, and, for an asset, that the file was not stored.
- Recorded actions are asset upload, retry, version, resubmit, title change, and review; task plan and update; time record, change, submit, accept, and return; membership grant and removal; account disable and enable.
- A sign-in, a page view, a notification read, and a folder path are not rows in this log.
- `GET /api/v1/audit-events?companyId=` is limited to an admin of that company. A creator or RM receives 403. There is no route that creates a row from the client.
- Earlier tasks, time entries, and assets are not copied into the log.

## Alternatives

- Update one row per subject. Rejected. A later change would erase the earlier sentence.
- Let every member read the company log. Rejected. The admin role is the boundary already used for user management.

## Trade-offs

The sentence is stored as text. Deleting the task or asset later does not remove the sentence, and it does not rewrite it.

## Security

The list checks the admin membership for the requested company. The response has no file bytes and no password hash.

## Revisit when

A Drive call stores a file id. New sentences can then say the file was stored, using that id. Rows already written stay as they are.
