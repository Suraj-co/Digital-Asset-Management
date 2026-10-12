# Requirements traceability

| Requirement | Design | Implementation | Test | Status |
|---|---|---|---|---|
| Project starts | ADR 0005, LLD | `apps/api/src/main.ts`, `apps/web` | Dev servers responded on 43124 and 43123 | Ready for manual verification |
| Database connectivity | ADR 0002, ADR 0003 | `PrismaService`, baseline migration | E2E `SELECT 1`; live health `database.status: up` | Ready for manual verification |
| Health endpoints | API specification | `HealthController` | Unit and e2e | Ready for manual verification |
| Liveness ignores the database | ADR 0003 | `HealthController.live` | Unit test asserts the check is not called | Met by automation |
| Degraded database is visible and does not leak a password | ADR 0003 | `HealthService`, redactor | Unit test with a URL in the thrown error | Met by automation |
| Safe errors | Threat model | `AllExceptionsFilter` | Unit and e2e 404 | Met by automation |
| Correlation id | LLD | request middleware | Unit and e2e | Met by automation |
| Original path in logs | LLD | `requestPath` | Unit test; live 404 log checked | Met |
| Environment validation | ADR 0006 | `loadEnv` | Unit tests | Met by automation |
| Web states | Functional FR-0.6 | `EnvironmentStatusView` | Testing Library | Met by automation |
| Shared shell and controls | Design system, ADR 0007 | `AppShell`, `apps/web/src/components/ui` | `AppShell.test.tsx`, `DesignSystemPage.test.tsx` | Ready for manual verification |
| Lint, types, build | Testing strategy | package scripts, CI workflow | Local commands passed. CI not observed. | Partial |
| Five companies | ERD, BRS, ADR 0010 | `Company` rows, `/companies` | Company e2e asserts the five codes and no ASEDS | Ready for manual verification |
| Auth and roles | Auth design, ADR 0009, ADR 0010 | Sessions, memberships, admin checks | Session e2e and company e2e, including SAPL requesting BAPL | Ready for manual verification |
| Drive configuration report | ADR 0008, API specification | `GET /api/v1/storage/connection` | Unit and e2e. No live Google call. | Ready for manual verification of the report only |
| Server session | ADR 0009, FR-3.1, FR-3.2 | `POST/GET/DELETE /api/v1/session`, `/sign-in` | Session e2e and sign-in page tests | Ready for manual verification |
| Drive hierarchy | Storage design, ADR 0011 | `Department`, `FolderCatalog`, `/folders` | Folder e2e. No live Google call. | Ready for manual verification of the catalog only |
| Upload failure | Lifecycle, ADR 0012, FR-6.1 | `Asset`, `UploadOperation`, `/assets` | Asset e2e. No file bytes and no Drive id. | Ready for manual verification of the failure path |
| Metadata search and title edit | ADR 0013, FR-7.1, FR-7.2 | `GET /api/v1/assets?q=`, `PATCH /api/v1/assets/:id`, `/assets/:id` | Asset e2e and page tests. No preview. | Ready for manual verification |
| Version history | ADR 0014, FR-8.1 | `AssetVersion`, `POST /api/v1/assets/:id/versions` | Asset e2e. Same asset id, `v001` kept, no Drive id. | Ready for manual verification |
| Approval sequence | Workflow, ADR 0015, FR-9.1 | `WorkflowDecision`, `POST /api/v1/assets/:id/transitions` | Workflow unit test and e2e. Publication stays `not_run`. No Drive id. | Ready for manual verification |
| Task plan | ADR 0016, FR-10.1 | `Task`, `POST /api/v1/tasks`, `/tasks` | Task e2e. No time field. Other company is 403. | Ready for manual verification |
| Time entry | ADR 0017, FR-11.1 | `TimeEntry`, `POST /api/v1/time-entries`, `/time` | Time e2e. Minutes match the request. No payroll total. Other company is 403. | Ready for manual verification |
| Dashboard counts | ADR 0018, FR-12.1 | `GET /api/v1/dashboard`, `/dashboard` | Dashboard e2e. Own scope and company scope. No payroll total and no stored-file count. | Ready for manual verification |
| In-app notice | BRS, ADR 0019, FR-13.1 | `Notification`, `GET /api/v1/notifications`, `/notifications` | Notification e2e. No email field. Another person’s id is 404. | Ready for manual verification |
| Audit | BRS, ADR 0020, FR-14.1 | `AuditEvent`, `GET /api/v1/audit-events`, `/audit` | Audit e2e. Creator is 403. No client create route. No file bytes. | Ready for manual verification |
| Request limit | BRS, ADR 0021, FR-15.1 | `RequestRateLimiter`, HTTP 429 | Limiter unit test and e2e. The third call on a limit of 2 is 429. No password in the body. | Ready for manual verification |
| Production password and local dump | BRS, ADR 0022, FR-16.1, FR-16.2 | `loadEnv`, `start-release.mjs`, `backup-database.mjs` | Production refuses the workstation password. A dump path inside the repository is rejected. | Ready for manual verification |

Company membership is implemented for the company and user routes. The selector reads that list. The Drive route does not call Google. Folder paths, failed uploads, version rows, and review decisions are stored. Publication does not move a file.
