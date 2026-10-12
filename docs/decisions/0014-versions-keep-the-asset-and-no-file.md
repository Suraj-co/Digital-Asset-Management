# ADR 0014 — A new version keeps the asset and still stores no file

## Status

Accepted. Module 8.

## Problem

A later upload has to keep the same asset id and leave the earlier attempt in place. ADR 0012 deferred version rows until a Drive file id existed. Those credentials are still absent. Inventing a file id, or overwriting `v001` with the new name, would hide the earlier attempt.

## Decision

- The first upload creates `AssetVersion` number 1, labeled `v001`, in the same transaction as the asset.
- `POST /api/v1/assets/:id/versions` appends the next number. The asset id and the earlier version rows stay.
- Every version is `upload_failed` / `not_configured`. `driveFileId` is not a column. The response sends `null`. The file bytes are discarded.
- `POST /api/v1/assets/:id/content` updates the latest version’s recorded name and size. It does not add a number and does not change earlier versions.
- The same `Idempotency-Key` for the same user, file name, and size returns the same version list. A different file with that key is 409.
- Another company’s asset is 403.

## Alternatives

- Wait until Drive can store both files. Rejected for this module. The stable id and the history of attempts can be true before either file exists.
- Keep only the latest file name. Rejected. That is what retry already does, and it is not a history.

## Trade-offs

The version list grows with failed attempts. None of them can be opened. The page says so.

## Security

The response and the version rows do not contain the file bytes. A caller outside the company cannot add a version.

## Scaling limit

Version numbers are allocated in a short transaction and retried on a unique conflict. Do not store the bytes in that transaction.

## Revisit when

A live Drive write can put a file id on one version without deleting the other version’s file.
