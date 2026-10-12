# Module 2 — Drive configuration report

## A. Purpose and status

Tell an operator whether the Google Drive settings are present, without pretending a shared drive was contacted.

Status: **ready for manual verification of the configuration report**. The live Drive call is not implemented. This module is not COMPLETE.

## B. Functionality

| Name | Purpose | Role | UI | API | Data | External | Security | Tests |
|---|---|---|---|---|---|---|---|---|
| Missing configuration | Say Drive is not set up | Operator | None | `GET /api/v1/storage/connection` | None | None | Names only, no secret | Unit, e2e |
| Partial configuration | Refuse to boot | Operator | — | startup | None | None | Error names the missing variables | `env.spec.ts`, `drive-settings.spec.ts` |
| Complete configuration | Say settings exist and were not verified | Operator | None | same route | None | None | Secret dropped before the response | Service unit test |

`liveCheck` is `not_run` in every response. HTTP 200. Readiness is unchanged.

## C. Not in this module

- A call to Google Drive API v3.
- OAuth consent, token storage, folder creation, upload, or the callback route named in `.env.example`. That path is documentation for a future redirect. It is not a route.
- A Drive row on the environment page.
- Company folders, assets, or Redis.

## D. Files

- `apps/api/src/storage/drive-settings.ts` — presence rules.
- `apps/api/src/storage/storage-connection.controller.ts` — the route.
- `apps/api/src/config/env.ts` — startup calls the same rules.
- `.env.example` — the four names, commented out.
- ADR 0008.

## E. Tests

API unit tests include the new cases. End-to-end `storage-connection.e2e-spec.ts` calls the live route against the test process and expects `not_configured`. Counts are in `TESTING_STATUS.md`.

## F. Known defects

None in the report. The product still cannot store a file.

## G. Manual verification

`docs/manual-testing/02-storage-connection.md`.

## H. System health

No new network dependency. See `SYSTEM_HEALTH.md`. Google remains unconfigured on purpose.

## Dependencies

The Module 0 API. No new package. No Google credential.

## Limitations

`configured` would only mean the four strings are present. It would not mean the shared drive listed this client as a member.
