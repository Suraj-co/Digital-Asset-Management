# Functional requirements

Module 0 behaviors, the Drive configuration report, server sessions, company membership, the folder catalog, the upload failure path, metadata search, and failed version history are implemented. Later rows are the contract those modules must meet. They are not available in the API. Google is not called.

## Module 0

| ID | Requirement | Status |
|---|---|---|
| FR-0.1 | The API process starts when PostgreSQL is configured, and it still starts when PostgreSQL is down. | Implemented |
| FR-0.2 | `GET /api/v1/health` reports API and database state, a version, a timestamp, and a correlation id. | Implemented |
| FR-0.3 | `GET /api/v1/health/live` does not query the database. | Implemented |
| FR-0.4 | `GET /api/v1/health/ready` returns 200 only when `SELECT 1` succeeds, otherwise 503. | Implemented |
| FR-0.5 | Invalid environment variables stop startup with a message that names the variable. | Implemented |
| FR-0.6 | The web app shows loading, healthy, degraded, and unreachable states from the live health payload. | Implemented |
| FR-0.7 | Unknown web routes say the page is outside Module 0. | Implemented |
| FR-0.8 | Each request has a correlation id in the response header and the log line. | Implemented |

## Module 3

| ID | Requirement | Status |
|---|---|---|
| FR-3.1 | Valid credentials create a server-side session. Invalid credentials do not. | Implemented |
| FR-3.2 | A disabled account cannot call protected APIs. | Implemented |

## Module 4

| ID | Requirement | Status |
|---|---|---|
| FR-4.1 | The five companies exist as database rows. | Implemented |
| FR-4.2 | A user limited to SAPL receives 403 for BAPL resources, including direct API calls. | Implemented |
| FR-4.3 | Granting Ontale membership changes the company selector. | Implemented |

## Module 5

| ID | Requirement | Status |
|---|---|---|
| FR-5.1 | An admin can add a department to a company they administer. | Implemented |
| FR-5.2 | Resolving a folder stores a server-built path and does not call Google or accept a client folder id. | Implemented |
| FR-5.3 | A user limited to SAPL receives 403 when resolving a folder for BAPL. | Implemented |

## Module 6

| ID | Requirement | Status |
|---|---|---|
| FR-6.1 | An upload writes metadata in PostgreSQL and a file in the resolved Drive folder, or records a recoverable failure. | Failure path implemented. No Drive file is written. |

## Module 7

| ID | Requirement | Status |
|---|---|---|
| FR-7.1 | Search finds a recorded upload by code, title, or file name inside the caller’s companies. | Implemented. File contents are not searched. |
| FR-7.2 | A member can change the title. The file stays unstored, and a client Drive id is rejected. | Implemented |

## Module 8

| ID | Requirement | Status |
|---|---|---|
| FR-8.1 | A new version keeps the same asset id and does not delete the previous Drive file. | The asset id and the earlier version row stay. No Drive file exists to delete or keep. |

## Module 9

| ID | Requirement | Status |
|---|---|---|
| FR-9.1 | Approval follows creator, scope analysis, RM QC, RM approval, admin QC, admin approval. Rejection requires a reason. | Implemented as decisions. Admin approval does not move a file. `publication` stays `not_run`. |

## Module 10

| ID | Requirement | Status |
|---|---|---|
| FR-10.1 | A member can plan a task inside a company they belong to. | Implemented. The task does not record time. An assignee or asset outside that company is refused. |

## Module 11

| ID | Requirement | Status |
|---|---|---|
| FR-11.1 | A member can record time for a company they belong to, and an RM can review it. | Implemented. Minutes are the number entered. The payroll total is on the dashboard. A task in another company is refused. |

## Module 12

| ID | Requirement | Status |
|---|---|---|
| FR-12.1 | A person sees a role-specific dashboard built from stored rows. | Implemented as counts and charts of those counts. Payroll is accepted minutes times the company rate. There is no stored-file count. |

## Module 13

| ID | Requirement | Status |
|---|---|---|
| FR-13.1 | The person who was assigned, whose time was returned, or whose asset was rejected can read that notice. | Implemented as an in-app row and an email copy. The copy is sent only when SMTP is configured. Another person’s row is 404. |

## Module 14

| ID | Requirement | Status |
|---|---|---|
| FR-14.1 | An admin of a company can read sentences for completed changes in that company. | Implemented as an inserted row written with the change. A creator or RM is 403. There is no client create route. Earlier work is not copied in. No file is stored. |

## Module 15

| ID | Requirement | Status |
|---|---|---|
| FR-15.1 | One client address cannot call this API without a limit. | Implemented in this process. The default is 240 requests in 60 seconds. The next request is HTTP 429. A second process does not share the count. `X-Forwarded-For` is not read. |

## Module 16

| ID | Requirement | Status |
|---|---|---|
| FR-16.1 | Production does not start with the workstation database password. | Implemented. Development and test still accept it. The error does not repeat the password. |
| FR-16.2 | An operator can dump PostgreSQL without uploading it. | Implemented as a plain SQL file outside the repository. No schedule, no offsite copy, and no Drive retention. |
