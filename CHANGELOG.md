# Changelog

Last refreshed: **2026-05-20a**

## 2026-05-20a

- Added schema 118 for Admin preflight registry, deployment checklist rendering, and function readiness tracking.
- Added function readiness table rows for `admin-directory`, `admin-manage`, `report-subscription-delivery-run`, and `service-execution-scheduler-run`.
- Updated Admin startup to load `command_center` first, then read configured initial scopes from `v_admin_fast_path_scope_registry` when available.
- Updated Production Readiness UI to render deployment checklist and function readiness rows.
- Updated `admin-directory` to return scope registry, confirmation rules, deployment checklist, and function readiness rows in Command Center/Health scopes.
- Updated canonical schema reference and smoke checks through schema 118.
- Refreshed active Markdown and archived old Markdown snapshots.
- Removed retired root Markdown and recurring temp files from active root.
- Bumped cache version to `2026-05-20a`.

## Recent prior passes

- `2026-05-19b`: split Admin accounting/evidence scopes and confirmation guardrails.
- `2026-05-19a`: Admin diagnostics drawer and stale-data badges.
- `2026-05-18b`: Admin panel retry timing and command-center scope.
- `2026-05-18a`: staged Admin loading and cache fallback guardrails.
