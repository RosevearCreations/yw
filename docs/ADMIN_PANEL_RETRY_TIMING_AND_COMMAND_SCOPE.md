# Admin Panel Retry, Timing, and Command Scope

Last refreshed: **2026-06-02b**

## Purpose

Admin had grown large enough that one live load could fail or time out and force the whole page into cached data. This pass makes staged loading visible and recoverable.

## What changed

- Added `command_center` as a small first-stage Edge Function scope.
- Kept separate `health`, `people`, `operations`, and `accounting` scopes.
- Added retry buttons for Command Center, Health, Staff, Jobs, and Accounting.
- Added scope timing cards in the Health panel.
- Added schema **115** to track the quality gates and future diagnostics table.

## Next step

Wire frontend panel failure events into `admin_panel_load_diagnostics` so repeated production failures are visible in the database, not only in the current browser session.

<!-- 2026-05-29a pass: Schema 123 equipment verification, accounting-depth, SEO/H1, CSS, fallback, and roadmap sanity refresh. -->

<!-- 2026-06-02a pass: schema 126 roadmap depth, data migration candidates, SEO/CSS/fallback guardrails, Admin readiness visibility, archive hygiene, cache marker, and Markdown refresh. -->

<!-- 2026-06-02a pass: schema 126 roadmap depth, data migration candidates, SEO/CSS/fallback guardrails, Admin readiness visibility, archive hygiene, cache marker, and Markdown refresh. -->
<!-- 2026-06-02b pass: schema 127 public route SEO registry, internal links, CSS token inventory, mobile field actions, release manifest checks, Admin readiness visibility, scan fallback, archive hygiene, cache marker, and Markdown refresh. -->


## Schema 133 pass marker

Reviewed during build **2026-06-05c / schema 133**. Keep this document aligned with the active roadmap and known gaps.
