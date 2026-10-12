# Module 1 — Design system and application shell

## A. Purpose and status

Give every later screen one layout, one set of tokens, and one set of controls. The exit condition is a reusable shell that is consistent on the pages that exist, with loading, empty, and error states that say what they are doing.

Status: **ready for manual verification**. Not COMPLETE until that verification is recorded. Module 0 stays ready for manual verification as well. The stopped-database check has not been confirmed by the product owner.

## B. Functionality

| Name | Purpose | Role | UI | API | Data | External | Security | Tests |
|---|---|---|---|---|---|---|---|---|
| Tokens | One palette and type scale | Implementer | `index.css` | — | — | — | — | Build |
| Shell | Sidebar, top bar, breadcrumb, skip link | Operator | Every route | — | — | — | — | `AppShell.test.tsx` |
| Navigation | Environment and design system only | Operator | `/`, `/design-system` | — | — | — | No dead product links | Navigation test |
| Mobile nav | Same links in a sheet below `md` | Operator | Open navigation | — | — | — | Focus trapped by the dialog | Sheet test |
| Company control | Hold the company slot. Module 4 lists memberships here | Operator | Menu | `GET /api/v1/companies` | `Membership` | None | The menu does not grant access | Menu test |
| Notifications | Bell for the signed-in person’s rows. Delivery is Module 13 | Operator | Menu, `/notifications` | `GET /api/v1/notifications` | `Notification` | None | No fake unread count. No email | Menu test |
| Account | Show that nobody is signed in | Operator | Menu | — | None | None | Cannot start a session | Menu test |
| Search | Reserve the field | Operator | Disabled input | — | None | None | Does not query | Disabled assertion |
| Design system page | Show buttons, fields, badges, table, dialog, states | Implementer | `/design-system` | — | None | None | Example field is not stored | `DesignSystemPage.test.tsx` |
| Not-found | Explain an unknown route | Operator | `*` | — | — | — | — | Covered with the shell routes in unit tests |

No new API route. No new table. No Google Drive call.

## C. Not in this module

- Login, users, roles, company rows, Drive, assets, versions, workflow, tasks, timesheets, dashboards, notification delivery, audit.
- A selected company. The menu does not remember a choice.
- React Hook Form and TanStack Query. ADR 0007.
- A dark-mode switch. `.dark` tokens exist and are unused.
- Playwright. Navigation is covered in jsdom. Playwright starts with the first workflow that needs a real browser.
- Redis.

## D. Files

- `apps/web/src/index.css` — tokens, Source Sans 3, shadcn theme mapping.
- `apps/web/src/components/ui/` — button, input, label, textarea, badge, table, dialog, dropdown menu, sheet, breadcrumb, separator, skeleton.
- `apps/web/src/components/shell/` — `AppShell`, `SidebarNav`, `CompanySelector`, `NotificationsMenu`, `UserMenu`, `PageHeader`, `StatePanels`.
- `apps/web/src/shell/navigation.ts` — company names and the two real routes.
- `apps/web/src/pages/DesignSystemPage.tsx` — the component gallery.
- `apps/web/src/App.tsx` — routes inside the shell.
- `apps/web/components.json` — shadcn config (`radix-vega`, radix base, lucide).
- `docs/design-system.md`, this file, `docs/manual-testing/01-design-system.md`, ADR 0007.

`AppHeader.tsx` was removed. The shell replaces it.

## E. Tests

`pnpm --filter @aaradhya/web test` — 19 tests, 4 files, after the shell landed. See `TESTING_STATUS.md` for the full command list once the module verification run is recorded.

Covered:

- Design system route from the sidebar, and from the mobile sheet, which then closes.
- Company menu names BAPL, SAPL, GBAPL, KABPL, and Ontale and says it does not grant access.
- Signed-out notifications say a server session is required and that no email is sent.
- User menu says it does not collect a password and links to sign-in.
- Search submits a code, title, or file name. Module 1 left the field disabled; Module 7 wires it.
- Filter, field validation, discard confirmation, and the empty filter result.

## F. Known defects

None open in this module.

Oxlint reports `react(only-export-components)` on `button.tsx` and `badge.tsx` because shadcn exports `buttonVariants` and `badgeVariants` from the same file as the component. The lint command still exits 0. Those files stay in the generated shape so a later `shadcn add` does not fight a local split.

## G. Manual verification

Follow `docs/manual-testing/01-design-system.md`.

## H. System health

See `SYSTEM_HEALTH.md`. Module 1 adds no server, database, or credential risk. The web production bundle grew because the shell pulls in Radix. The API health contract is unchanged.

## Dependencies

Existing web toolchain, plus `radix-ui`, `class-variance-authority`, `cn`, `lucide-react`, `shadcn`, `tw-animate-css`, and `@fontsource-variable/source-sans-3`. No new secret.

## How to operate

```bash
pnpm dev
```

Open http://127.0.0.1:43123/ and http://127.0.0.1:43123/design-system.

## Limitations

The company menu lists memberships. Search queries asset metadata in the selected company. The example table is not the company registry.
