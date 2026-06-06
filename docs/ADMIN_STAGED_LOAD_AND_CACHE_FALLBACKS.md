# Admin Staged Load and Cache Fallbacks

Last refreshed: **2026-06-02b**

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

<!-- 2026-06-02a pass: schema 126 roadmap depth, data migration candidates, SEO/CSS/fallback guardrails, Admin readiness visibility, archive hygiene, cache marker, and Markdown refresh. -->

<!-- 2026-06-02a pass: schema 126 roadmap depth, data migration candidates, SEO/CSS/fallback guardrails, Admin readiness visibility, archive hygiene, cache marker, and Markdown refresh. -->
<!-- 2026-06-02b pass: schema 127 public route SEO registry, internal links, CSS token inventory, mobile field actions, release manifest checks, Admin readiness visibility, scan fallback, archive hygiene, cache marker, and Markdown refresh. -->


## Schema 133 pass marker

Reviewed during build **2026-06-05c / schema 133**. Keep this document aligned with the active roadmap and known gaps.
