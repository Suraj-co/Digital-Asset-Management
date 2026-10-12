# ADR 0011 — Folder catalog does not call Google

## Status

Accepted. Module 5.

## Problem

Uploads need a folder path that the server chooses. Google credentials are still absent. Inventing a Drive folder id, or accepting one from the browser, would look like a stored file that does not exist.

## Decision

- A department is a row on one company. An admin of that company creates it. Names are data, not constants.
- `POST /api/v1/storage/folders/resolve` requires membership in the company on the body. It loads the department only when that department belongs to the same company.
- The path is `AARADHYA_DAM/{company}/{department}/{year}/{campaign}/{stage}/{type}`. Stage and type folders are the fixed names from the storage design. Company, department, year, and campaign come from stored or validated input.
- A name may contain letters, numbers, spaces, hyphens, and underscores. Slashes and `..` are rejected.
- The same department, year, campaign, stage, and type return the same row.
- `driveFolderId` stays null. `liveCheck` is `not_run`. The detail says Google was not called. This stays true even if the four Drive settings are present, until a later module performs one live call.
- A client field named `driveFolderId` is rejected by the validation pipe.

## Alternatives

- Call Drive as soon as any setting is present. Rejected. Module 2 already refused a live call without a mapped failure result, and this workspace has no credentials to test against.
- Skip the catalog and only document the path. Rejected. The next upload needs a row to point at, and the membership check has to exist before that upload.

## Trade-offs

The page can list paths that are not folders in Drive. The copy says so. Creating the Drive folder is still future work.

## Security

A SAPL member receives 403 for a BAPL company id. The browser cannot choose the parent id.

## Scaling limit

Listing uses the database page size. The path string is short. No Drive quota is consumed.

## Revisit when

The four Drive settings exist and one live folder create can be tested. That change writes `driveFolderId` only after Google returns an id.
