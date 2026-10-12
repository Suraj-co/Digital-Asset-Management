# Documentation

Module 0 records the design for the whole platform and implements the environment. Module 1 adds the shell. Module 2 reports whether Drive settings are present and does not call Google. Module 3 opens a server session. Module 4 stores the five companies and membership. Module 5 stores folder paths and does not call Google. Module 6 records an upload failure and does not store the file. Module 7 searches that metadata and edits the title. There is no preview. Module 8 keeps another attempt on the same asset id. No version stores a file. Module 9 records approval decisions. The file is not moved. Module 10 plans a task and does not record time. Module 11 stores the minutes a person entered. Module 12 counts those stored rows. Module 13 writes an in-app notice for an assignment, a returned time entry, and a rejection. Module 17 charts those counts, calculates a payroll total from accepted minutes and a company rate, and queues an email copy on Redis. The copy is sent only when SMTP is configured. Module 14 inserts an audit sentence with a completed company change. Earlier work is not copied in. The sentence is not updated. Module 15 counts requests from one client address in this API process. Over the limit the response is HTTP 429. The count is not shared with another process. Module 16 refuses the workstation database password in production and writes a local SQL dump. The dump is not uploaded. This repository does not deploy itself.

| Document | What it decides |
|---|---|
| [Business requirements](architecture/01-business-requirements.md) | Companies, roles, and which capabilities exist |
| [Functional requirements](architecture/02-functional-requirements.md) | Module 0 behavior and the ids reserved for later modules |
| [Non-functional requirements](architecture/03-non-functional-requirements.md) | Logging, safety, and what has actually been checked |
| [High-level design](architecture/04-high-level-design.md) | Process boundaries |
| [Low-level design](architecture/05-low-level-design.md) | Health, configuration, errors |
| [System architecture](architecture/06-system-architecture.md) | Diagram of the running pieces |
| [Database model](architecture/07-database-erd.md) | What is migrated, and the planned model |
| [API specification](architecture/08-api-specification.md) | Live routes and names that are reserved |
| [Authentication and authorization](architecture/09-authentication-authorization.md) | Planned session and company checks |
| [Google Drive storage](architecture/10-google-drive-storage.md) | Planned hierarchy and failure classes |
| [Asset lifecycle](architecture/11-asset-lifecycle.md) | Failed upload now. Later states are planned |
| [Approval workflow](architecture/12-approval-workflow.md) | Review stages. Publication stays `not_run` |
| [Deployment](architecture/13-deployment-architecture.md) | Local run and the CI workflow |
| [Threat model](architecture/14-threat-model.md) | What Module 0 protects and what it does not |
| [Testing strategy](architecture/15-testing-strategy.md) | Which tool covers which risk |
| [Failure recovery](architecture/16-failure-recovery.md) | Database down today, Drive divergence later |
| [Traceability](architecture/17-requirements-traceability.md) | Requirement to test |
| [Design system](design-system.md) | Tokens, shell, and component API |
| [Decisions](decisions/) | ADRs 0001–0026 |
| [Showcase steps](showcase.md) | How to demonstrate payroll, charts, and email, and what remains for Drive |
| [Module 0](modules/00-repository-and-environment.md) | Environment and health |
| [Module 1](modules/01-design-system-and-shell.md) | Design system and shell |
| [Module 2](modules/02-storage-connection.md) | Drive configuration report. No Google call |
| [Module 3](modules/03-sessions.md) | Server sessions |
| [Module 4](modules/04-companies.md) | Companies and membership |
| [Module 5](modules/05-folder-catalog.md) | Folder catalog. No Google call |
| [Module 6](modules/06-asset-upload.md) | Upload failure. The file is not stored |
| [Module 7](modules/07-metadata-search.md) | Search and title edit. No preview |
| [Module 8](modules/08-versions.md) | Version history. No file is stored |
| [Module 9](modules/09-approval.md) | Approval decisions. The file is not moved |
| [Module 10](modules/10-tasks.md) | Task plans. Time is not recorded |
| [Module 11](modules/11-timesheets.md) | Entered minutes and review. The payroll total is on the dashboard |
| [Module 12](modules/12-dashboards.md) | Counts of stored rows, charted in Module 17 |
| [Module 13](modules/13-notifications.md) | In-app notices. Email copy is Module 17 |
| [Module 14](modules/14-audit.md) | Inserted audit sentences. No update |
| [Module 15](modules/15-rate-limit.md) | In-process request limit. No Redis |
| [Module 16](modules/16-deployment-and-backups.md) | Production password refusal and a local dump |
| [Module 17](modules/17-email-payroll-charts.md) | Email copy, payroll total, and charts |
| [Manual test, Module 0](manual-testing/00-repository-and-environment.md) | How to verify the environment |
| [Manual test, Module 1](manual-testing/01-design-system.md) | How to verify the shell |
| [Manual test, Module 2](manual-testing/02-storage-connection.md) | How to verify the Drive report |
| [Manual test, Module 3](manual-testing/03-sessions.md) | How to verify sign-in |
| [Manual test, Module 4](manual-testing/04-companies.md) | How to verify company membership |
| [Manual test, Module 5](manual-testing/05-folder-catalog.md) | How to verify folder paths |
| [Manual test, Module 6](manual-testing/06-asset-upload.md) | How to verify a failed upload |
| [Manual test, Module 7](manual-testing/07-metadata-search.md) | How to verify search and a title edit |
| [Manual test, Module 8](manual-testing/08-versions.md) | How to verify a second version |
| [Manual test, Module 9](manual-testing/09-approval.md) | How to verify a review decision |
| [Manual test, Module 10](manual-testing/10-tasks.md) | How to verify a task plan |
| [Manual test, Module 11](manual-testing/11-timesheets.md) | How to verify a time entry |
| [Manual test, Module 12](manual-testing/12-dashboards.md) | How to verify dashboard counts |
| [Manual test, Module 13](manual-testing/13-notifications.md) | How to verify an in-app notice |
| [Manual test, Module 14](manual-testing/14-audit.md) | How to verify an audit sentence |
| [Manual test, Module 15](manual-testing/15-rate-limit.md) | How to verify the request limit |
| [Manual test, Module 16](manual-testing/16-deployment-and-backups.md) | How to verify the password refusal and a local dump |
| [Troubleshooting](operations/troubleshooting.md) | How to follow a correlation id |

Status of the build is in the repository root: `BUILD_STATUS.md`, `TESTING_STATUS.md`, and `SYSTEM_HEALTH.md`.
