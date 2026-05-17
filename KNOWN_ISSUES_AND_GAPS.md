# Known Issues and Gaps

Last refreshed: **2026-05-17a**

## Highest priority after this pass

1. **Apply schema 112 live.** Admin Health will show behind until the database has the latest schema marker.
2. **Redeploy `admin-directory`.** Staff and Jobs sorting/pagination require the updated Edge Function.
3. **Clear the service worker cache.** Old `2026-05-16b` files may keep the previous Admin controls visible.
4. **Test Staff Directory sorting with real users.** Confirm sort direction works for name, email, role, status, and last login.
5. **Test Jobs/Operations paging with real jobs.** Confirm search, sort, page size, previous/next, and saved-view replay.
6. **Panel-only refresh is still next.** Fast paths now exist, but the UI still reloads the full Admin directory in many actions.
7. **People paging is not fully SQL-side yet.** Current logic still merges profile and access views before slicing; this should move closer to SQL for bigger teams.
8. **Guided Close Center owner/due editing remains next.** Complete/reopen exists, but edit controls are still needed.
9. **Bank CSV import still has DB staging only.** Upload/preview/accept/reject UI is next.
10. **Evidence action queue still needs real retry/replace/archive handlers.** Current records track follow-up intent.
11. **Worker/supervisor mobile dashboard screens are still next.** Navigation is compact, but role-specific mobile dashboards remain to be built.
12. **Operations jobs review needs its own table.** The toolbar now controls job source data, but we still need a dedicated jobs review table and row actions.

## Recently addressed

1. Compact mobile main menu.
2. Compact mobile Admin section menu.
3. Staff Directory search/role/page-size/pager controls.
4. Staff Directory sort and sort direction controls.
5. Jobs/Operations search/sort/page-size/pager controls.
6. Admin directory pagination metadata for people and jobs.
7. Saved admin view replay for Staff and Jobs list filters.
8. Schema 112 marker and canonical schema reference.
9. Repo smoke checks for Admin list controls and Edge Function sorting.
10. Active Markdown refresh and archive snapshot cleanup.
11. Repeated cleanup of retired Markdown and temp files.

## Watch items after deploy

- Confirm Admin > People and Access shows Staff sort and direction controls.
- Confirm Admin > Jobs and Operations shows the Jobs toolbar above the backbone form.
- Confirm page labels read correctly, such as “Jobs page 1 of 3”.
- Confirm saved views restore Staff and Jobs filters.
- Confirm Admin Health shows schema **112** current after SQL is applied.
- Confirm old service worker cache does not keep `2026-05-16b` assets loaded.
