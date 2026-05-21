# Database Structure

Last refreshed: **2026-05-20a**

## Latest schema marker

Latest migration: **118**

`sql/118_admin_preflight_registry_deployment_checklist_ui.sql`

## New schema 118 additions

- `admin_function_readiness_checks`
- `v_admin_function_readiness_checks`
- additional `admin_deployment_checklist_items` rows for schema 118 deployment
- `app_frontend_quality_gates` rows for registry-driven Admin loading and readiness-table rendering
- `v_schema_drift_status` now expects schema 118
- `app_schema_versions` marker for release `2026-05-20a`

## Important compatibility notes

- `v_schema_drift_status` keeps the column name `expected_schema_version` to avoid PostgreSQL view-column rename errors.
- Schema 118 re-creates/guards the small tracking tables it depends on, so it is safer after partial earlier migration attempts.
- The Admin UI still keeps static fallbacks while the DB-backed fast-path registry is being proven live.
