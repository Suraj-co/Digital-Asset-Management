# Module 5 — Folder catalog

## A. Purpose and status

A member can record the folder path for a department, year, campaign, stage, and file type. The row does not claim that a Drive folder exists.

Status: **ready for manual verification**. Not COMPLETE until that verification is recorded. A live Drive call is still not implemented.

## B. Functionality

| Name | Purpose | Role | UI | API | Data | External | Security | Tests |
|---|---|---|---|---|---|---|---|---|
| Add department | Name a department inside one company | Admin | `/folders` | `POST /api/v1/companies/:id/departments` | `Department` | None | 403 for a non-admin and for another company | e2e |
| List departments | Show names for the selected company | Member | `/folders` | `GET .../departments` | `Department` | None | Membership required | e2e |
| Resolve path | Store the server-built path | Member | Record folder path | `POST /api/v1/storage/folders/resolve` | `FolderCatalog` | None. Google is not called | 403 for another company. Client folder ids rejected | e2e, page test |
| List paths | Show recorded paths | Member | Table | `GET /api/v1/storage/folders` | `FolderCatalog` | None | Filtered by company. `driveFolderId` is null | e2e |

## C. Not in this module

- Creating, listing, or uploading files in Google Drive.
- Assets, versions, and approval moves between Working, Approved, and Archive.
- A department tree beyond one name per company.

## D. Files

- `apps/api/prisma/migrations/20261010180000_department_and_folder`
- `apps/api/src/storage/folders.service.ts`
- `apps/web/src/pages/FoldersPage.tsx`
- ADR 0011.

## E. Tests

API end-to-end covers the path, a repeated resolve, a SAPL caller asking for BAPL, and a null Drive id. The page test covers the signed-out state and a recorded path with no Drive id. Counts are in `TESTING_STATUS.md`.

## F. Known defects

None in the catalog. The selected company is still tab memory from Module 4. A refresh selects the first active membership again.

## G. Manual verification

`docs/manual-testing/05-folder-catalog.md`.

## H. System health

No new outbound call. See `SYSTEM_HEALTH.md`.

## Dependencies

PostgreSQL. No new package.

## Limitations

The path is a record of intent. Nothing in Google Drive changes.
