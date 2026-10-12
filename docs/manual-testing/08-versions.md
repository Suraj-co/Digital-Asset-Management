# Manual test — Module 8

The API and web app are running. Migration `20261010200000_asset_version` is applied. You need a membership and one recorded upload. Do not commit the email or password.

## 1. First version

Open the asset. Expect `v001`, the original file name, and “Not stored”. There is no download and no image.

## 2. Another version

Choose Record another version and pick a different small file. Expect the same asset code, `v002` with the new file name, and `v001` still listing the first file name.

The notice says the file was not stored. Google Drive was not called.

## 3. Retry

On the assets table, Try again with a third small file. Expect the same two version numbers. Only the latest file name changes.

## 4. Other company

With a BAPL session, `POST /api/v1/assets/{saplAssetId}/versions` is HTTP 403.

## 5. Cleanup

Delete the asset, which removes its versions, and any user created only for this check. Do not leave a shared password in database `dam`.
