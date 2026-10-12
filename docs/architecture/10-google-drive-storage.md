# Google Drive storage

## Implemented

`GET /api/v1/storage/connection` reports whether `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are present. The redirect URI defaults to `http://127.0.0.1:43124/api/v1/storage/oauth/callback` when it is unset. `GOOGLE_DRIVE_ID` is optional. The route returns HTTP 200 and `liveCheck: "not_run"`. It does not call Google. The health page still has no Drive row, because a red or green Drive check would look like a finished integration. ADR 0008 and ADR 0023.

`POST /api/v1/storage/folders/resolve` stores a catalog path for a department the caller can access. `driveFolderId` stays null. ADR 0011. Departments are rows, not constants. The Drive layout below is the path shape. It is not a folder Google has created.

## Planned layout

Shared drive root `AARADHYA_DAM`, then company, department, year, campaign, and stage:

```text
AARADHYA_DAM/
└── {COMPANY}/          BAPL | SAPL | GBAPL | KABPL | Ontale
    └── {DEPARTMENT}/
        └── {YEAR}/
            └── {CAMPAIGN_OR_PROJECT}/
                ├── 01_Working/{Images|Videos|Posters|Banners|Source_Files|Other}
                ├── 02_Approved/{same types}
                └── 03_Archive/{same types}
```

Company, department, year, campaign, and folder ids are data. They are not constants in source code.

## Authorization model to decide in Module 2

A service account does not automatically see a Shared Drive. The Workspace admin must add the client as a member of that drive.

Preferred direction, to be confirmed when credentials exist:

| Topic | Preference |
|---|---|
| API | Drive API v3 |
| Scope | The narrowest scope that can create folders and upload into the shared drive. `https://www.googleapis.com/auth/drive` is broader than we want if a file-only scope can do the job. Record the chosen scope in the Module 2 note. |
| Token storage | Encrypted at rest, or a workload identity the host provides. Never in the database as plaintext, never in logs, never in the browser. |
| OAuth state | Random, single use, bound to the session that started the consent flow. |
| Parent folder | Resolved by the server from company and path records. Client-supplied parent ids are ignored. |
| Default visibility | Private to the shared drive. No public link. |

## Operations the adapter must grow

Connection status, folder create and lookup, list, multipart and resumable upload, move, metadata read, authorized preview and download, archive, trash where policy allows, retry classification, quota errors, reconciliation, orphan detection, and missing-file detection.

## Failure classes

Keep these distinct in logs and operation rows:

| Class | Examples | Typical action |
|---|---|---|
| Authentication | Invalid client, expired refresh token | Stop and alert. Do not retry blindly. |
| Authorization | Shared drive membership missing | Stop. Fix Workspace permissions. |
| Invalid request | Bad metadata | Fix the caller. Do not retry. |
| Missing | File id 404 | Mark missing. Do not recreate silently. |
| Quota | 403 rate or storage quota | Back off. |
| Transient | 429, 500, 503 | Retry with a limit. |
| Database | Drive succeeded, row failed | Reconciliation. See document 16. |

## Partial failure

Drive and PostgreSQL cannot commit together. The asset module must insert an operation row first, call Drive, then store the file id, and leave a failed or unknown state when the second step does not finish. Module 6 owns that state machine. Module 0 only records the rule.
