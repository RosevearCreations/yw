# Known Issues and Gaps

Last refreshed: **2026-05-17b**

## Highest priority after this pass

1. Apply SQL through **schema 113** so Admin Health and schema drift show current.
2. Redeploy Supabase functions **admin-directory** and **admin-manage**.
3. Hard refresh or clear the service worker cache so `2026-05-17b` Admin UI assets load.
4. Test **Refresh Staff Only** on a real account and confirm it does not reload the full Admin manager.
5. Test **Refresh Jobs Only** with search/sort/page-size/pager values and confirm the current filter is preserved.
6. Test the Jobs review row actions on a safe test job: Open, Add Note, Complete, and Cancel.
7. Confirm live `jobs.status` is the correct status column; do not reintroduce `jobs.job_status` assumptions.
8. Confirm job notes are written to `job_comments` and status actions write site activity rows.
9. Move Staff Directory paging closer to SQL-side filtering before the team list grows.
10. Add owner/due-date editing to Guided Close Center steps next.
11. Add bank CSV upload/preview next; staging tables exist but the import UI is not complete.
12. Add real evidence retry/replace/archive handlers; current queue tracking is still mostly workflow scaffolding.

## Recently addressed

- Compact mobile main menu and Admin section menu.
- Staff Directory pagination, search, role filter, sort, direction, and saved-view replay.
- Jobs/Operations pagination, search, sort, direction, saved-view replay, and now panel-only refresh.
- Separate mobile-friendly Jobs review table with row actions.
- Admin Edge Function fast paths for reporting, operations, health, and accounting.
- Schema tracking through **113**.
- Active Markdown refresh and archive snapshot cleanup.
- Repeated cleanup of retired root Markdown and `test_write` files.

## Watch items after deploy

- Old service worker cache may still show `2026-05-17a` files until cleared.
- Job action buttons depend on the updated `admin-manage` function.
- Operations fast path depends on the updated `admin-directory` function.
- Browser extension async-listener warnings may still appear in the console and are not the app timeout issue.
