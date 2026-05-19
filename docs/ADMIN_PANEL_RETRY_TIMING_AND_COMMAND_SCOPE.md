# Admin Panel Retry, Timing, and Command Scope

Last refreshed: **2026-05-18b**

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
