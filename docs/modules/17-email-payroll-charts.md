# Module 17 — Email copy, payroll total, and charts

## A. Purpose and status

Queue an email copy of an in-app notice, calculate a payroll total from accepted minutes, and chart the dashboard counts that are already stored.

Status: **ready for manual verification**. This module is not COMPLETE. No file is stored. An email is not sent unless SMTP is configured.

## B. Functionality

| Name | Purpose | Role | UI | API | Data | External | Security | Tests |
|---|---|---|---|---|---|---|---|---|
| Email copy | Keep the message that would be sent | Recipient | `/notifications` | Written with the notice | `EmailDelivery` | Redis, then SMTP when set | Recipient only | Unit, notification e2e |
| Payroll total | Accepted minutes times the company rate | Member, admin sets the rate | `/dashboard` | `GET /api/v1/dashboard`, `PATCH /api/v1/companies/:id/pay-rate` | `Company.hourlyRateMinor` | None | Admin of that company | Unit, dashboard e2e |
| Charts | Draw the stored counts | Member | `/dashboard` | Same dashboard response | None new | None | Same company check | Page test |

## C. Not in this module

- A Google Drive file, a preview, or a move into `02_Approved`.
- A payroll total before an admin sets a rate.
- Sending mail when SMTP is blank.
- Sharing the rate limit through Redis.

## D. Files

- `apps/api/src/mail/` — queue and SMTP.
- `apps/api/src/payroll/payroll-total.ts` — the calculation.
- `apps/web/src/pages/DashboardPage.tsx` and `CountChart.tsx`.
- ADR 0024, ADR 0025, ADR 0026.
- Operator steps: `docs/showcase.md`.

## E. Tests

API unit tests cover the rate math, the held-mail sentence, and a partial SMTP configuration. API end-to-end still passes, including the dashboard payroll fields for open minutes. Web tests cover the payroll sentence and the chart heading.

## F. Known defects

None in this module. The product still cannot store a file.

## G. Manual verification

`docs/showcase.md`.

## H. System health

Redis is reported on `/api/v1/health` and does not decide readiness. See `SYSTEM_HEALTH.md`.
