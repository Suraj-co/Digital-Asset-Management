# ADR 0013 — Search metadata, and do not preview a missing file

## Status

Accepted. Module 7.

## Problem

People need to find a recorded upload and correct its title. The file was never stored. A thumbnail, a download, or a search of file contents would claim bytes that are not in PostgreSQL or Drive.

## Decision

- `GET /api/v1/assets?q=` matches the asset code, title, or recorded file name. The match is case-insensitive and stays inside the caller’s companies. `companyId` still narrows the list and is 403 when the caller is not a member.
- A blank `q` is ignored. More than 80 characters, or a control character, is 400.
- `PATCH /api/v1/assets/:id` accepts `{ title }` only. Any other field, including `driveFileId`, is 400. Another company’s asset is 403.
- The title change does not create a version and does not change `upload_failed`.
- The asset page says there is no preview. It does not render an image or a download.
- The shell search field submits to `/assets?q=`. It searches the company selected in that tab.

## Alternatives

- Search file contents. Rejected. The bytes are discarded in Module 6.
- Generate a placeholder thumbnail. Rejected. A picture would look like a stored file.
- Let the client set `driveFileId` while editing the title. Rejected. That id stays null until a live Drive write.

## Trade-offs

Search cannot find text inside a poster. The page says so. Switching company and searching again is required to look at another membership.

## Security

The query is a bound filter, not a raw SQL fragment. A caller who does not belong to the company receives an empty list, or 403 when they name that company id.

## Scaling limit

The filter uses `ILIKE` on code, title, and file name. That is enough for the recorded failure rows. Add an index when a company list is large enough that this scan shows up in the logs.

## Revisit when

A stored Drive file exists. Preview and content search belong to that change, not to this query.
