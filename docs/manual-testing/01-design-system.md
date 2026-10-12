# Manual test — Module 1

Do this with the Module 0 processes already running: API on 43124, web on 43123, PostgreSQL up. See `docs/manual-testing/00-repository-and-environment.md` for startup.

## 1. Desktop shell

1. Open http://127.0.0.1:43123/ at a width of at least 1024px.
2. Expect a navy sidebar with "Aaradhya DAM", "Environment" (current), "Companies", "Folders", "Assets", and "Design system".
3. Expect a breadcrumb "Aaradhya DAM / Environment".
4. Expect the heading "Environment status", and the same health rows as Module 0: Web app Up, API Up, PostgreSQL Up, overall Ready, a timestamp, and a correlation id.
5. The search field is enabled. Its placeholder is "Search code, title, or file name". Submitting a term opens `/assets?q=` for the selected company. It does not search file contents.
6. Click "Refresh status". The page returns to Ready. It still calls `/api/v1/health`.

## 2. Company, notifications, and account

1. Click "No company" while signed out. Expect a menu that says to sign in and says the control does not grant access. It must not list BAPL as an assigned company. ASEDS must not appear. Membership is checked in `docs/manual-testing/04-companies.md`.
2. Close the menu. Click the notifications button (bell, accessible name "Notifications" when nothing is unread). Signed out, expect "Sign in is required" and "No email is sent." There is no unread count. Signed in with no rows, expect "No notifications" and "Nothing is waiting. No email is sent."
3. Click "Not signed in". Expect a sentence that this menu does not collect a password, and a Sign in link to `/sign-in`. There is no password field in the menu.

## 3. Design system page

1. Click "Design system" in the sidebar. The heading is "Design system". The breadcrumb ends with "Design system".
2. Expect buttons labeled Primary, Secondary, Outline, Ghost, Destructive, and Disabled. Disabled does not activate.
3. In "Filter components", type `dialog`. Only "Confirmation dialog" remains. Clear the field. The other sections return.
4. Type `zzzz`. Expect "No matching components".
5. Clear the filter. In "Example title", click "Check example" with an empty field. Expect "Enter at least 3 characters."
6. Enter `Poster` and click "Check example". Expect the accepted message and the sentence "Nothing was saved."
7. Click "Discard example". Expect "Discard the example title?" and "No asset is deleted." Click "Keep". The title stays `Poster`.
8. Open the dialog again and click "Discard". The title is empty and the page says "Example discarded."
9. Expect status badges Up, Pending, Down, and Not started.
10. Expect a table whose rows are BAPL, SAPL, and Ontale, each "Not stored".
11. Expect a loading example, an empty state "No assets", and a sample error. Click "Try again" on the sample error. It hides that example and does not change the environment status.

## 4. Narrow layout

1. Set the window to about 390px wide.
2. The sidebar is gone. A button labeled "Open navigation" is visible.
3. Open it. Expect "Aaradhya DAM", "Environment", and "Design system". Follow "Design system". The sheet closes and the design-system heading is visible.
4. The health table still shows Up without horizontal scrolling of the whole page. Detail columns stay hidden at this width, as they did in Module 0.
5. Company, notifications, and account still open. Search stays disabled.

## 5. Unknown route

Open http://127.0.0.1:43123/not-a-page. Expect "Page not available" and the sentence that this address is not part of the Module 0 environment check. Follow "Back to environment status".

## 6. Keyboard

1. Reload `/`. Press Tab. The first stop is "Skip to content". Activate it. Focus moves to the main region.
2. Tab to "Refresh status", "Company", "Notifications", and "Not signed in". Each shows a visible focus ring.
3. Open "Company" with Enter or Space, then close it with Escape.

## Evidence to keep

- A note of pass or fail for desktop, the three menus, the design-system checks, 390px, and keyboard.
- Confirmation that no asset, user, or company row was created. Database tables are unchanged from Module 0 (`\dt` still shows no business tables).

## What this test does not prove

- That a company can be selected. It cannot.
- That search returns assets. It does not.
- That the stopped-database check from Module 0 has been done. Run that separately if it is still open.
