# Manual test — Module 9

The API and web app are running. Migration `20261010210000_workflow_decision` is applied. You need a SAPL creator, a SAPL RM, and a SAPL admin, plus one recorded upload. Do not commit the email or password.

## 1. Submit

Sign in as the creator and open the asset. Expect Review “Draft” and “Submit for review”. Submit. Expect “Scope analysis” and a decision that says the file is not stored. There is no download and no image.

## 2. RM and admin

Sign in as the RM. Approve scope analysis, RM QC, and RM approval. Expect Admin QC. An approve from the RM on that stage is HTTP 403.

Sign in as the admin. Reject with a reason. Expect “Changes requested” and that reason in the decision list.

## 3. New version

As the creator, record another version. Expect the same asset code, `v001` still listed, `v002` added, and the stage back at Scope analysis. The notice says the file is not stored.

Walk the RM stages and admin QC again until Admin approval.

## 4. Publication does not run

As the admin, approve. Expect the stage to stay Admin approval. The page says Google Drive was not called and the file was not moved into `02_Approved`. Approve again is HTTP 409. Try publication again stays on that sentence.

## 5. Other company

With a BAPL session, `POST /api/v1/assets/{saplAssetId}/transitions` is HTTP 403.

## 6. Cleanup

Delete the asset, which removes its versions and decisions, and any user created only for this check. Do not leave a shared password in database `dam`.
