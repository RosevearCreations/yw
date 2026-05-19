# Changelog

## 2026-05-18b

- Added schema **115: `admin_panel_retry_timing_and_command_scope`**.
- Added a dedicated `command_center` Admin Edge Function fast path.
- Added visible retry buttons for Command Center, Health, and Accounting panels.
- Preserved existing Staff and Jobs panel-only refresh controls.
- Added per-scope Admin load timing/status cards in the Health panel.
- Updated Admin staged load order to: `command_center`, `health`, `people`, `operations`, `accounting`.
- Expanded Admin scope response merging so panel-only retries update more of the correct dashboard state.
- Added mobile CSS for Admin scope timing cards.
- Confirmed `report-subscription-delivery-run/index.ts` uses escaped newline strings instead of bundle-breaking literal line breaks.
- Refreshed active Markdown, schema reference, and smoke checks.
- Archived the previous Markdown snapshot under `archive/markdown-current-snapshot-2026-05-18b/`.
- Removed reintroduced retired root Markdown and temporary `test_write` files from active root.
