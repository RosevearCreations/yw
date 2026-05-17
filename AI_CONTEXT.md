# AI Context

Last refreshed: **2026-05-17a**

## Current state

The latest pass added production-style Admin list controls. Staff Directory now has sort/direction controls. Jobs/Operations now has visible search/sort/page-size/previous/next controls. `admin-directory` now accepts sanitized people/jobs sort payloads and returns paging metadata.

## Key files changed in this pass

- `js/admin-ui.js`
- `style.css`
- `supabase/functions/admin-directory/index.ts`
- `sql/112_admin_operations_pagination_sorting_panel_refresh.sql`
- `sql/000_full_schema_reference.sql`
- `scripts/repo-smoke-check.mjs`
- active Markdown files

## Next best task

Add panel-only refresh buttons so Staff, Operations, Health, Accounting, Evidence, and Reporting can refresh independently without reloading the full Admin directory.
