# ADR 0015 — Approval records a decision and does not move a file

## Status

Accepted. Module 9.

## Problem

Review has to follow creator, scope analysis, RM QC, RM approval, admin QC, and admin approval. A rejection needs a reason, and a decision has to name the version that was reviewed. The last approval is supposed to move the file into `02_Approved`. No file is stored, and Google Drive is not configured. Inventing a published stage or a Drive file id would claim a move that did not happen.

## Decision

- `POST /api/v1/assets/:id/transitions` records a `WorkflowDecision`. The body is `submit`, `approve`, `reject`, or `publish`. Only `reject` takes a reason.
- The caller must hold the role for the current stage. A creator submits a draft. An RM decides scope analysis, RM QC, and RM approval. An admin decides admin QC and admin approval. Anyone else receives 403. The wrong action for the current stage is 409.
- Admin approval keeps the stage at `admin_approval` and sets `publication` to `not_run`. The detail is “Google Drive was not called. The file was not moved into 02_Approved.”
- `publish` retries that move and fails the same way. It does not invent a published stage.
- Rejection returns the asset to `changes_requested`. A creator’s next version goes back to scope analysis and keeps the earlier version rows. That resubmit is a decision, not a client action.
- A new version is refused while the asset is in review. Retry is refused unless the stage is still `draft`.
- Uploads stay open to any member of the company. Approval is what the role gates.
- These rows are the transition record. A general audit log remains Module 14.

## Alternatives

- Wait until Drive can move a file. Rejected for this module. The sequence, the reason, and the version under review can be true before a file exists.
- Mark the asset published when the admin approves. Rejected. That would hide the failed move.

## Trade-offs

The stage stays `admin_approval` after a successful decision. `publication: not_run` is the record that the move did not happen. A later Drive write has to perform that move and only then change the stage.

## Security

The service checks membership and the stage role. The client receives only the actions that caller can take. The response and the decision rows do not contain the file bytes.

## Scaling limit

Each decision is one row in the same short transaction as the stage update. Do not call Google inside that transaction.

## Revisit when

A live Drive write can move the approved version into `02_Approved` without dropping the earlier version.
