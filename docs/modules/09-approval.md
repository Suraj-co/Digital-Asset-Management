# Module 9 — Approval workflow

## A. Purpose and status

A member can submit a draft. An RM and an admin can decide the later stages. Rejection needs a reason. Admin approval does not move a file.

Status: **ready for manual verification**. Not COMPLETE until that verification is recorded.

## B. Functionality

| Name | Purpose | Role | UI | API | Data | External | Security | Tests |
|---|---|---|---|---|---|---|---|---|
| Submit | Send the latest version to scope analysis | Creator | Submit for review | `POST /api/v1/assets/:id/transitions` | `WorkflowDecision` | None | A reason on submit is 400 | e2e, page test |
| Approve | Advance RM and admin stages | RM or admin for that stage | Approve | same route | `WorkflowDecision` | None | The other role is 403 | e2e, unit |
| Reject | Return to changes requested | The stage role | Reject, with a reason | same route | `WorkflowDecision` | None | A missing reason is 400 | e2e, unit |
| Resubmit | A new version returns to scope analysis | Creator | Record another version | `POST /api/v1/assets/:id/versions` | version plus `resubmit` | None | An RM is 403. Earlier versions stay | e2e |
| Publication retry | Record that the move did not run | Admin | Try publication again | `publish` on the transition route | `publication: not_run` | None | Google is not called | e2e, unit |

## C. Not in this module

- A Drive folder move into `02_Approved`.
- A published stage or a Drive file id.
- A general audit log. That remains Module 14.
- Role gates on the original upload. Any member can still record a failed upload.

## D. Files

- `apps/api/prisma/migrations/20261010210000_workflow_decision`
- `apps/api/src/assets/workflow.ts`
- `apps/web/src/pages/AssetDetailPage.tsx`
- ADR 0015.

## E. Tests

The planner unit test covers submit, a creator blocked from an RM stage, a rejection reason, and a publication that stays `not_run`. API end-to-end walks the stages, a rejection, a new version, and the failed publication. The page test submits a draft and says the file is not stored. Counts are in `TESTING_STATUS.md`.

## F. Manual verification

Steps are in `docs/manual-testing/09-approval.md`. Product-owner confirmation is still open.

## G. Health

No new outbound call. See `SYSTEM_HEALTH.md`.

## H. Showcase

The asset page shows the stage, only the actions that caller can take, and the decision history. Admin approval says Google Drive was not called and the file was not moved into `02_Approved`. There is still no preview and no download.
