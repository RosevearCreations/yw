# Database Structure

Last refreshed: **2026-05-19a**

## Current schema marker

The active schema reference is aligned through:

- `sql/116_admin_diagnostics_drawer_and_stale_data_badges.sql`

## Latest additions

- `admin_panel_load_diagnostics` is now used by the frontend write path for failed staged Admin panel loads.
- `v_admin_panel_load_diagnostics` now includes the captured profile name when available.
- `v_schema_drift_status` now expects schema version **116**.
- `app_frontend_quality_gates` includes checks for diagnostics drawer visibility, persisted panel failures, and stale-data badges.
- `admin_panel_refresh_preferences` includes rows for diagnostics drawer, stale age badges, and persisted panel failures.

## Safe migration notes

- Keep `v_schema_drift_status.expected_schema_version` as the column name. Do not rename it through `CREATE OR REPLACE VIEW`.
- If a view needs a column rename, use `drop view if exists ...` first or use `alter view ... rename column` when safe.
- Apply migrations in order through schema 116 before deploying functions that depend on the new views.
