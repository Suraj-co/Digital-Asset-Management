# Manual test — Module 6

The API and web app are running. Migration `20261010190000_asset_upload_failure` is applied. You need a membership and a folder path from Modules 4 and 5. Do not commit the email or password.

## 1. Signed out

Open http://127.0.0.1:43123/assets . Expect "Sign in is required" and a sentence that the file is not stored.

`POST /api/v1/assets` without a cookie is HTTP 401.

## 2. Record a failure

Sign in as a member of one company that already has a folder path. On Assets, choose that path, enter a title, and choose a small file. Expect an asset code such as `SAPL-0001`, the state "Upload failed", and the sentence that Google Drive was not called.

The table says "Not stored". There is no download link.

Submit the same file again. Expect a second asset code. This is a new attempt, not a stored version.

## 3. Other company

With a SAPL session, post the same form using a folder id that belongs to BAPL. Expect HTTP 403 and "You do not have access to this company."

`GET /api/v1/assets/{saplAssetId}` as a BAPL-only user is also 403.

## 4. Retry

On the asset row, choose Try again, pick another small file, and choose Send again. Expect the same asset code, the new file name, and the same failure sentence. The file is still not stored.

## 5. Cleanup

Delete the asset rows you created, then the folder and department if they were only for this check. Do not leave a shared password in database `dam`.
