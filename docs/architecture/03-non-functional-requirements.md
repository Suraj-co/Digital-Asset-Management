# Non-functional requirements

| ID | Requirement | Module 0 state |
|---|---|---|
| NFR-1 | Strict TypeScript on API and web. | Met. `strict` is on. The web app also enables `verbatimModuleSyntax` and `erasableSyntaxOnly`. |
| NFR-2 | Server-side authorization for business data. | Not applicable yet. No business data. The design forbids UI-only checks. |
| NFR-3 | Binaries stay out of PostgreSQL. | Met by absence. The schema has no file columns. |
| NFR-4 | Structured logs with a correlation id. No passwords, refresh tokens, or file contents. | Met for the current log paths. URL userinfo is redacted. |
| NFR-5 | Safe client errors. No stack traces. | Met. 500 responses use a fixed message. |
| NFR-6 | Pagination and indexes for list endpoints. | Not applicable yet. |
| NFR-7 | Health endpoints for process and database. | Met. |
| NFR-8 | WCAG 2.2 AA practices on the status page: labels, focus, text plus color, keyboard. | Partially met. The page uses a table, a named button, a skip link, and text status. It has not had a formal audit. |
| NFR-9 | Responsive layout. | The status table hides the detail column under the `sm` breakpoint and repeats the error under the table. Not visually signed off. |
| NFR-10 | Reproducible local setup. | Documented. Docker Compose is unverified in this workspace. |
| NFR-11 | Automated lint, typecheck, unit tests, API tests, and production build. | Met locally. CI is authored, not yet observed. |

Performance targets are not invented here. The only measurement is a local health query: about 58 ms on first connect and about 1–2 ms after the pool is warm.
