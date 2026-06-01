# Admin Staged Load and Cache Fallbacks

Last refreshed: **2026-06-01a**

## Current behavior

Admin no longer starts with one giant `scope: all` request. The first load now stages smaller requests:

1. `command_center`
2. `health`
3. `people`
4. `operations`
5. `accounting`

The older `all` scope is retained only as an emergency fallback if every staged request fails.

## User-facing recovery

Operators now have visible retry buttons:

- Retry Command Center
- Retry Health
- Refresh Staff Only
- Refresh Jobs Only
- Retry Accounting

The Health panel also shows per-scope timing cards so a slow or failed panel is visible without opening the browser console.

## Next work

Persist failed panel load events into `admin_panel_load_diagnostics` through a write action so recurring production issues can be reviewed later.

<!-- 2026-05-29a pass: Schema 123 equipment verification, accounting-depth, SEO/H1, CSS, fallback, and roadmap sanity refresh. -->

<!-- 2026-06-01a pass: schema 125 deployment bundle parse repair, SEO/local checks, fallback guardrails, jobs-manage fix, jobs-directory attachment dedupe, cache marker, and roadmap refresh. -->
