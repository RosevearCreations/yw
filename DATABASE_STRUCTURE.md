# Database Structure

Last refreshed: **2026-05-18b**

## Current schema marker

The active schema set is synchronized through:

```text
sql/115_admin_panel_retry_timing_and_command_scope.sql
```

## Added in schema 115

- `admin_panel_load_diagnostics` table for future persisted panel load diagnostics.
- `v_admin_panel_load_diagnostics` view.
- Additional rows in `admin_panel_refresh_preferences` for command-center, health retry, accounting retry, and scope timing cards.
- Additional `app_frontend_quality_gates` rows for Admin panel retry/timing and report delivery bundle readiness.
- `v_schema_drift_status` now expects schema **115** while keeping the column name `expected_schema_version` stable.

## Deployment note

Apply migrations through schema **115** before relying on the latest Admin Health/Schema panel. Do not rename `v_schema_drift_status.expected_schema_version`; PostgreSQL requires explicit view column renames and previous deployments failed when this column name changed.
