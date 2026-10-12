# ADR 0025 — A payroll total uses accepted minutes

## Status

Accepted. Module 17.

## Problem

The dashboard used to refuse the name “payroll total” because no rate was stored. A sum of every minute on the page, including open and returned rows, is still not pay.

## Decision

- An admin of a company sets `hourlyRateMinor` and `currency` (`INR`, `USD`, or `EUR`) with `PATCH /api/v1/companies/:id/pay-rate`. The rate is minor units per hour.
- The payroll total is `round(acceptedMinutes * hourlyRateMinor / 60)`. Open, submitted, and returned minutes are excluded.
- Until a rate is stored, `amountMinor` is null and the page says an admin has to set the rate. No amount is invented.
- The change writes an audit sentence. The stored time rows are not rewritten.
- A creator sees their own accepted minutes. An RM or admin sees the company.

## Alternatives

- Treat every stored minute as pay. Rejected. A returned entry is not accepted work.
- Use a per-person rate. Deferred. This total is the company rate.

## Trade-offs

One rate applies to every person in the company. Currencies without a 1/100 minor unit are not offered.

## Security

Only an admin of that company can set the rate. Another company is 403.

## Revisit when

Pay periods or per-person rates are required.
