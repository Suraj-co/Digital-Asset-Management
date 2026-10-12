# Manual test — Module 5

The API and web app are running. Migration `20261010180000_department_and_folder` is applied to database `dam`. You need a user who is an admin of one company, from the Module 4 grant script. Do not commit the email or password.

## 1. Signed out

Open http://127.0.0.1:43123/folders . Expect "Sign in is required" and a sentence that the page does not call Google Drive.

`POST /api/v1/storage/folders/resolve` without a cookie is HTTP 401.

## 2. Department

Sign in as an admin. Select that company. On Folders, add a department named `Brand`. Expect "Brand was added."

Sign in as a creator in the same company. The add-department form is absent. Brand is available in the department field.

A creator calling `POST /api/v1/companies/{companyId}/departments` receives HTTP 403.

## 3. Path

As the creator, record year 2026, campaign `Spring`, stage Working, type Posters. Expect the path:

```text
AARADHYA_DAM/{CODE}/Brand/2026/Spring/01_Working/Posters
```

Expect the sentence that Google Drive was not called, and the table cell "Not in Drive". Repeat the same values. The path stays one row.

## 4. Other company

With the SAPL session, call resolve with BAPL's id `4b4c0001-0000-4000-8000-000000000001`. Expect HTTP 403 and "You do not have access to this company."

Send `driveFolderId` in the JSON body. Expect HTTP 400. No stored row should contain that value.

## 5. Cleanup

Delete the department only after its folder rows are gone, or delete the test users if they were created for this check. Do not leave a shared password in database `dam`.
