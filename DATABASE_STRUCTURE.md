# Database Structure

Last refreshed: **2026-06-04b**

Current schema marker: **130**.

Latest migration: `sql/130_payment_reconciliation_equipment_scan_local_seo_execution_playbooks.sql`.

Schema 130 adds:

- `app_payment_execution_queue` / `v_app_payment_execution_queue`
- `app_bank_reconciliation_execution_queue` / `v_app_bank_reconciliation_execution_queue`
- `app_equipment_scan_template_registry` / `v_app_equipment_scan_template_registry`
- `app_local_seo_execution_queue` / `v_app_local_seo_execution_queue`
- `app_fallback_drill_queue` / `v_app_fallback_drill_queue`

`v_schema_drift_status` now expects schema **130**. Apply migrations in order and redeploy `admin-directory` after schema 130 is applied.

## Important compatibility note

The repaired schema 128 roadmap insert uses `source_doc`, `route_hint`, and `implementation_notes`. Do not reintroduce the legacy `source_document`, `target_route_hint`, or `completion_note` names in schema 128 or the canonical full schema.
