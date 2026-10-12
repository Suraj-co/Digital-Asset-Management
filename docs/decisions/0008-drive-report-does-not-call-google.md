# ADR 0008 — The Drive report does not call Google

## Status

Accepted. Module 2, configuration report only. The required-set rule below is replaced by ADR 0023. This route still does not call Google.

## Problem

`GET /api/v1/storage/connection` is the reserved way to ask whether Drive is usable. This workspace has no Google client id, secret, redirect URI, or shared drive id. A handler that returns "connected", or a health row that turns red because Drive is absent, would look like an integration that was tried.

## Decision

- The route returns HTTP 200 with `status: "not_configured"` when all four settings are absent, and `status: "configured"` when all four are present.
- `liveCheck` is always `not_run`. The handler does not import the Google client and does not open a network connection to Google.
- Setting any one of `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`, or `GOOGLE_DRIVE_ID` requires the other three. Startup fails otherwise. Blank values count as unset.
- The secret is validated and then dropped. It is not placed on `AppEnv`, not returned, and not written to the log by this route.
- Readiness stays a PostgreSQL check. The environment page does not gain a Drive row.

A later change may call Drive only when `status` is `configured`, and it must record the failure class from `docs/architecture/10-google-drive-storage.md`. That change is not this one.

## Alternatives

- Hide the route until credentials exist. Rejected. Callers would keep seeing 404 and could not tell "not built" from "not configured".
- Return HTTP 503 when settings are missing. Rejected. The API is ready for the work it can do. Drive is optional until an upload exists.

## Trade-offs

`configured` can be true for credentials that Google will later reject. The `detail` string says the shared drive was not verified.

## Security

The response lists setting names, not values. A partial `.env` cannot boot.

## Scaling limit

One in-memory read of the environment per request. No Drive quota is consumed.

## Revisit when

A Workspace admin supplies the four settings. The next change is a live `files.get` or `drives.get` against `GOOGLE_DRIVE_ID`, with the failure classes, still without putting the secret in the response.
