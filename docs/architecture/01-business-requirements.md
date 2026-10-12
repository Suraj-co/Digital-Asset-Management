# Business requirements

Status key: **implemented** means present in this repository now. **planned** means specified and not built.

## Purpose

Aaradhya DAM is the shared place where five companies keep marketing and design files, decide which version is approved, and see who did the work.

Companies:

| Code | Status |
|---|---|
| BAPL | Implemented as a company row. Required in every later company-scoped module. |
| SAPL | Implemented as a company row. Replaces ASEDS. ASEDS must not appear as an active company. |
| GBAPL | Implemented as a company row. |
| KABPL | Implemented as a company row. |
| Ontale | Implemented as a company row. First-class in company management, permissions, storage, assets, workflow, dashboards, reports, and tests. |

## Asset kinds

Images, videos, posters, banners, marketing assets, campaign assets, design source files, documents, and other types configured in data. An upload can be recorded as a failure. The file is not stored yet.

## Capabilities

| Capability | Status | Module |
|---|---|---|
| Start the application and see whether the API and database are up | Implemented | 0 |
| Sign in, sign out, and disable an account | Implemented | 3, 4 |
| Limit a person to authorized companies | Implemented | 4 |
| Store files in a Google Shared Drive hierarchy | Planned | 2, 5, 6 |
| Record an upload that fails closed when Drive is absent | Implemented as a failure | 6 |
| Search and edit metadata | Implemented for code, title, and file name. No preview, because the file is not stored | 7 |
| Keep version history under a stable asset id | Implemented as failed attempts. No Drive file is stored on any version | 8 |
| Review from creator through RM and admin approval | Implemented as recorded decisions. The file is not moved | 9 |
| Plan tasks and record time | Tasks are plans. Time stores the minutes that were entered. The payroll total is accepted minutes times a company rate | 10, 11, 17 |
| Show role-specific dashboards from stored rows | Implemented as counts and charts of those counts, plus the payroll total | 12, 17 |
| Notify the right people | Implemented as an in-app notice and an email copy. The copy is sent only when SMTP is configured | 13, 17 |
| Record an audit trail | Implemented as an inserted sentence. It is not updated. Earlier work is not copied in | 14 |
| Refuse a client that calls too often | Implemented as a count in this API process. It is not shared across processes | 15 |
| Refuse the workstation database password in production, and dump PostgreSQL locally | Implemented. The dump is not uploaded. This repository does not deploy itself | 16 |

## Roles

Creator, RM, and Admin are enforced on company membership. Approval uses the role for the current stage. Uploads stay open to any member. The authorization design is in `09-authentication-authorization.md`.

## Out of scope for the product

- ASEDS as a live company.
- Storing binary files in PostgreSQL.
- Microservices, Kafka, or Kubernetes unless a later ADR says a real limit was hit.
