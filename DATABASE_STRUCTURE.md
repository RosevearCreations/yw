# Database Structure

Last refreshed: **2026-05-15b**

## Current schema marker

Latest migration file:

- `sql/108_saved_filters_close_wizard_health_and_seo_gates.sql`

Canonical reference:

- `sql/000_full_schema_reference.sql`

## Schema 108 additions

Tables / extensions:

- `admin_saved_filters` gains `last_used_at`, `usage_count`, `route_hint`, and `section_hint`.
- `admin_close_workflow_steps`
- `admin_health_resolution_notes`
- `admin_deployment_gate_checks`
- `admin_public_seo_checks`

Views:

- `v_admin_saved_filter_scope_summary`
- `v_admin_close_wizard_steps`
- `v_admin_health_resolution_queue`
- `v_admin_deployment_gate_status`
- `v_public_seo_smoke_check`
- refreshed `v_schema_drift_status` expecting schema 108

## Important note

Run schema 108 after schemas 100-107 are already applied. Schema 108 assumes the previous accounting-close, admin health, and production-readiness foundations exist.
