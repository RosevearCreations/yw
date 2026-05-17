# Known Issues and Gaps

Last refreshed: **2026-05-16b**

## Highest priority after this pass

1. **Apply schema 111 live.** Admin Health will show behind until the database has the latest schema marker.
2. **Redeploy `admin-directory`.** The Staff Directory pagination and jobs metadata require the updated Edge Function.
3. **Clear the service worker cache.** Old `2026-05-16a` assets may keep the older Admin UI visible.
4. **Test Staff Directory paging with real data.** Confirm page totals, search, role filtering, and saved-view replay.
5. **Jobs/Operations table UI still needs visible pagination controls.** Backend metadata is now started, but the Operations UI still needs controls.
6. **People paging is not yet fully SQL-side for every role path.** Current work reduces output payload and creates UI metadata; a later pass should move more filtering into direct SQL queries for admin-wide lists.
7. **Guided Close Center owner/due editing remains next.** Complete/reopen exists, but edit controls are still needed.
8. **Bank CSV import still has DB staging only.** Upload/preview/accept/reject UI is next.
9. **Evidence action queue still needs real retry/replace/archive handlers.** Current records track follow-up intent.
10. **Worker/supervisor mobile dashboard screens are still next.** Navigation is compact, but role-specific mobile dashboards remain to be built.

## Recently addressed

1. Compact mobile main menu.
2. Compact mobile Admin section menu.
3. Staff Directory search/role/page-size/pager controls.
4. Admin directory pagination metadata for people.
5. Paged jobs Edge Function foundation.
6. Saved admin view replay for Staff Directory filters.
7. Schema 111 marker and canonical schema reference.
8. Repo smoke checks for pagination/saved-view replay.
9. Active Markdown refresh.
10. Repeated cleanup of retired Markdown and temp files.

## Watch items after deploy

- Confirm Admin > People and Access shows the new toolbar.
- Confirm page label reads correctly, such as “Page 1 of 3”.
- Confirm saved views restore Staff Directory filters.
- Confirm Admin Health shows schema **111** current after SQL is applied.
- Confirm old service worker cache does not keep `2026-05-16a` assets loaded.
