# Manual test — Module 7

The API and web app are running. You need a membership and at least one recorded upload from Module 6. Do not commit the email or password.

## 1. Search

Sign in. On any page, type part of an asset code, title, or file name into Search and submit. Expect `/assets` with that text, and only rows from the company selected in the tab.

A title that exists only in another company does not appear. File contents are not searched. The page says so when nothing matches.

## 2. Open

Choose the asset code. Expect the code, title, file name, size, folder path, “Upload failed”, “Not stored”, and “No preview. The file was not stored.”

There is no image and no download.

## 3. Edit the title

Change the title and choose Save title. Expect “Title saved. The file is still not stored.” Reload the page. The new title remains. The state is still Upload failed.

## 4. Other company

With a BAPL session, `GET /api/v1/assets?q=` for a SAPL-only title returns an empty list. `PATCH /api/v1/assets/{saplAssetId}` with a new title is HTTP 403.

A body that includes `driveFileId` is HTTP 400.

## 5. Cleanup

If you created a user only for this check, delete that user and the asset rows. Do not leave a shared password in database `dam`.
