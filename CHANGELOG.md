# Changelog

Last refreshed: **2026-05-20b**

## 2026-05-20b

- Added schema 119: `sql/119_admin_action_permissions_preflight_and_retry_rules.sql`.
- Added Admin action permission registry and view.
- Added Admin schema preflight checks and view.
- Added Admin panel retry/backoff policy and view.
- Added function readiness signoff metadata fields.
- Updated `v_schema_drift_status` expected version to 119.
- Updated `admin-directory` to return:
  - `actor_role`,
  - `admin_action_permission_registry`,
  - `admin_panel_retry_policy`,
  - `admin_schema_preflight_checks`.
- Updated Admin UI Production Readiness to render action permissions, schema preflight, retry policy, and enriched function readiness rows.
- Added role-aware disabled states for known Admin status-changing buttons.
- Updated CSS for mobile-safe readiness tables and disabled buttons.
- Updated active Markdown, archived the previous Markdown snapshot, and removed retired/temp root files again.
- Bumped cache version to `2026-05-20b`.

## Recent prior passes

- `2026-05-20a`: Admin preflight registry and deployment/function readiness UI.
- `2026-05-19b`: split Admin accounting/evidence scopes and confirmation guardrails.
- `2026-05-19a`: Admin diagnostics drawer and stale-data badges.
- `2026-05-18b`: Admin panel retry timing and command-center scope.
- `2026-05-18a`: staged Admin loading and cache fallback guardrails.
