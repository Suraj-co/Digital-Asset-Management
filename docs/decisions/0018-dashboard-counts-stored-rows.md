# ADR 0018 — A dashboard counts stored rows

## Status

Accepted. Module 12.

## Problem

People need a role-specific view of work already recorded for one company. A chart, a payroll total, or a stored-file count would claim a measurement this module does not have. No Drive file exists to count.

## Decision

- `GET /api/v1/dashboard?companyId=` counts assets, tasks, and time entries that are already stored.
- A creator sees their own assets, tasks they created or are assigned, and their own time. An RM or admin sees every row in that company.
- Another company is 403. The company menu does not widen the count.
- Asset counts include the recorded state `upload_failed` and the workflow stage. Publication counts stay `not_started` or `not_run`. The response has no stored-file count.
- Time minutes are the sum of `minutes` on the counted rows. That sum is not a payroll total.
- There is no chart and no new table. The page does not add a chart library.

## Alternatives

- Cache a snapshot table. Rejected. A count of the live rows cannot drift from a copy.
- Show a company-wide total to every member. Rejected. A creator must not learn a teammate’s minutes from this page.

## Trade-offs

Zero is a real count when no row exists. The page shows that zero instead of an empty state that hides it.

## Security

The service checks membership, then applies the role scope in the query. The response does not include file bytes.

## Revisit when

A later module stores a Drive file id. The asset section can then count stored files from that column. Until then the upload-failed count stays the honest one.
