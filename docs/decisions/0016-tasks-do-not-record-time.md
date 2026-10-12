# ADR 0016 — A task is a plan and does not record time

## Status

Accepted. Module 10.

## Problem

People need a company-scoped list of planned work, optionally tied to an asset and a person. Timesheets, notifications, and a general audit log are later modules. A task screen that shows hours, or sends mail, would claim work this module does not do.

## Decision

- `Task` belongs to one company. Any member of that company can create, read, and update its tasks.
- `TaskAssignment` names one member of that same company. A person outside the company is 403. An unknown email is 404.
- `TaskLink` names one asset in that same company. An asset in another company is refused.
- Status is `open` or `done`. There is no percent complete and no time field.
- The task row does not send email or store minutes. ADR 0019 writes an in-app notice when the assignee is someone else. Time entries remain Module 11.

## Alternatives

- Store hours on the task. Rejected. That collapses the timesheet module into a field nothing can total honestly yet.
- Let a creator assign any email. Rejected. Company membership is the authorization boundary.

## Trade-offs

The page can mark a task done without saying how long it took. That gap stays visible in the copy.

## Security

List and update check membership on the task’s company. The response does not include file bytes.

## Revisit when

Module 11 stores minutes on a time entry that can point at one of these tasks. The task row still has no minutes.
