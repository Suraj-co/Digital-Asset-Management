# ADR 0017 — A time entry stores the minutes that were entered

## Status

Accepted. Module 11.

## Problem

People need to record time against a company, and optionally against a task in that company, then submit it for review. A payroll total, a chart, or a notification would claim a number or a delivery this module does not compute.

## Decision

- `TimeEntry` belongs to the person who recorded it and to one company. Minutes are an integer from 1 to 720, stored as entered.
- `workDate` is a calendar date. It cannot be in the future, compared as UTC `YYYY-MM-DD`.
- An optional task must belong to the same company. A task in another company is refused.
- Status is `open`, `submitted`, `accepted`, or `returned`. The owner submits from `open` or `returned`. An RM or admin accepts or returns a submitted entry. A return requires a reason.
- A creator sees only their own entries. An RM or admin of the company sees every entry in that company.
- The page may add the minutes on the rows it listed. That sum is not a payroll total. The task row still does not record time.

## Alternatives

- Store hours on `Task`. Rejected in ADR 0016. Time stays on its own row so a plan can exist with no minutes.
- Compute a company payroll total. Rejected. Nothing in this module knows a rate, a period close, or which rows were left off the page.

## Trade-offs

A person who is both the owner and an RM can review their own submitted entry. The actions on a response are for the caller, so an open row offers submit and a submitted row offers accept and return.

## Security

List and read check company membership, then ownership unless the caller is an RM or admin of that company. The response does not include file bytes.

## Revisit when

A later module needs a rate or a pay period. Those stay out. ADR 0019 writes an in-app notice when someone else returns the entry. No email is sent, and the minutes are still not a payroll total.
