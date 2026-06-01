# Mobile Navigation and Responsive UX

Last refreshed: **2026-06-01a**

## Current mobile UX status

The mobile main menu remains compact by default. The Admin section menu also remains compact on phones.

This pass adds responsive Staff Directory list controls so the Admin app is not just visually compact; it is also easier to use with real data on small screens.

## Files involved

- `index.html`: versioned frontend assets at `2026-05-17a`.
- `js/mobile-menu.js`: compact main menu behaviour.
- `js/admin-ui.js`: compact Admin sections plus Staff Directory pager/search controls.
- `style.css`: mobile menu and admin list toolbar styles.
- `server-worker.js`: cache version `2026-05-17a`.
- `sql/111_admin_directory_pagination_saved_view_replay.sql`: quality gates for Staff Directory pagination and saved-view replay.

## Manual test

1. Open the app under 760px wide.
2. Confirm the top navigation is one Menu button before expansion.
3. Open Admin under 720px wide.
4. Confirm Admin sections are behind one expandable control.
5. Open People and Access.
6. Confirm Staff Directory controls stack cleanly.
7. Search, filter by role, change page size, and use Previous/Next.

_Reviewed in the 2026-05-17a pass for schema 112 documentation consistency._

<!-- 2026-05-29a pass: Schema 123 equipment verification, accounting-depth, SEO/H1, CSS, fallback, and roadmap sanity refresh. -->

<!-- 2026-06-01a pass: schema 125 deployment bundle parse repair, SEO/local checks, fallback guardrails, jobs-manage fix, jobs-directory attachment dedupe, cache marker, and roadmap refresh. -->
