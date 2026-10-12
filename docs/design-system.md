# Design system

Module 1. The shell and these controls are what later screens must reuse. Tokens live in `apps/web/src/index.css`. Primitives live in `apps/web/src/components/ui`. Shell pieces live in `apps/web/src/components/shell`.

## Tokens

The palette is navy and paper. It replaces the default shadcn neutral theme. Do not introduce a second accent color for a single page.

| Token | Value | Use |
|---|---|---|
| `--primary` | `#1e3a5f` | Primary buttons, focus ring, sidebar |
| `--primary-foreground` | `#ffffff` | Text on primary |
| `--background` | `#eef1f4` | Page background |
| `--foreground` | `#1a2332` | Body text |
| `--card` | `#ffffff` | Panels and tables |
| `--muted-foreground` | `#5c6b7a` | Secondary text |
| `--destructive` | `#a12626` | Destructive actions and field errors |
| `--border` / `--input` | `#d5dbe3` | Borders and inputs |
| `--radius` | `0.375rem` | Control corners |
| `--color-ok` / `--color-ok-bg` | `#1b7f4e` / `#e7f5ee` | Up, success |
| `--color-warn` / `--color-warn-bg` | `#8a5a00` / `#fff6e5` | Pending, incomplete |
| `--color-bad` / `--color-bad-bg` | `#a12626` / `#fdecec` | Down, failure |
| `--sidebar` | `#1e3a5f` | Sidebar and mobile sheet |
| `--sidebar-foreground` | `#f4f7fb` | Text on the sidebar |

Status colors are `ok`, `warn`, and `bad`. They are not named `accent`. shadcn already uses `--accent` for hover surfaces.

`.dark` token values are defined and unused. There is no theme switch.

## Typography and spacing

- Font: Source Sans 3 Variable, loaded from `@fontsource-variable/source-sans-3`.
- Page title: `text-2xl font-semibold tracking-tight`.
- Section title: `text-lg font-semibold`.
- Body and help text: `text-sm leading-6`.
- Page column: `max-w-5xl`, horizontal padding `px-4` (`sm:px-6`), vertical padding `py-8`.
- Sidebar width: `w-60` from the `md` breakpoint up. Below that, navigation is a sheet.

Use the Tailwind spacing scale. Do not add one-off pixel margins for a single screen.

## Shell

`AppShell` wraps every route.

| Piece | Behavior |
|---|---|
| Skip link | "Skip to content" moves focus to `#main`. |
| Sidebar | Primary nav. Visible from `md` up. |
| Open navigation | Sheet with the same links. Visible below `md`. Choosing a link closes the sheet. |
| Breadcrumb | "Aaradhya DAM" and the current page name. |
| Search | Accessible name "Search". Submits to `/assets?q=` and matches code, title, or file name in the selected company. It does not search file contents. |
| Company | See below. |
| Notifications | The signed-in person’s rows. Signed out, the menu says a server session is required. No email is sent. An unread count appears only when `unread` is greater than zero. |
| User | "Not signed in", or the signed-in email. The menu links to sign-in and does not collect a password. |

`NAV_ITEMS` in `apps/web/src/shell/navigation.ts` is the only primary navigation. Add a link when the screen exists. Do not add a link that lands on a placeholder pretending to be the library, workflow, or a dashboard.

### Company selector

The trigger’s accessible name is "Company". The visible label is "No company" until the signed-in user has an active membership. It then shows that company’s code.

Signed out, the menu says to sign in. It does not list the five companies as if they were assigned. Signed in, it lists only memberships from `GET /api/v1/companies`. SAPL replaces ASEDS. ASEDS is not listed.

Choosing a company keeps that id in memory for the tab. It does not grant access. The server checks membership on each company request. A refresh selects the first active membership again.

## Component API

Import primitives from `@/components/ui/*`. Import shell pieces from `@/components/shell/*`. `cn` is re-exported from `@/lib/utils` and is the `cn` package.

### Button

`variant`: `default`, `secondary`, `outline`, `ghost`, `destructive`, `link`.

`size`: `default`, `xs`, `sm`, `lg`, `icon`, `icon-xs`, `icon-sm`, `icon-lg`.

`asChild` renders the child through Radix `Slot` so a `Link` can look like a button. Disabled buttons do not submit and do not navigate.

### Input, Textarea, Label

Always pair a visible `Label` with `htmlFor`. Put the error in an element referenced by `aria-describedby`, and set `aria-invalid` when the value fails validation. The design-system example uses Zod: a title must be at least 3 characters after trim. Checking it does not save anything.

### Badge

`variant`: `default`, `secondary`, `destructive`, `outline`, `ghost`, `link` (the generated set). Status badges on the design-system page use `bg-ok-bg text-ok`, `bg-warn-bg text-warn`, and `bg-bad-bg text-bad` so color is not the only difference: the label says Up, Pending, or Down.

### Table

Use `Table`, `TableHeader`, `TableBody`, `TableRow`, `TableHead`, `TableCell`. The sample rows say "Not stored". They are not company records.

### Dialog

Use for a confirmation that must be explicit. `DialogTitle` and `DialogDescription` are required. The example "Discard example" clears the sample title on this page only. It does not delete an asset.

### Dropdown menu and sheet

Radix hides the rest of the page while a menu or sheet is open. Content that is not a menu item is still allowed when the menu is explaining why an action is unavailable. Prefer `DropdownMenuItem` once an action does something.

### States

| Component | When |
|---|---|
| `LoadingState` | A request is in flight. Includes a polite status and skeletons. |
| `EmptyState` | The request succeeded and the list is empty. Say why. |
| `ErrorState` | The request failed. Pass `onRetry` only when retry does something. |
| `IncompleteNotice` | The control is visible and the capability is not built. |
| `PageHeader` | One `h1` per page, optional description, optional actions. |

Do not render a spinner that never ends, an empty illustration with no sentence, or an error with a button that does nothing.

## What is deliberately not here

- React Hook Form and TanStack Query. ADR 0007.
- A dark-mode toggle.
- Charts, toasts, and a command palette.
- Asset, workflow, task, or dashboard screens.
