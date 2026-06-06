# Database Structure

Latest schema: **131**

Schema 131 adds DB-visible execution-control queues for payment application UI validation, reconciliation import validation, equipment service closeout, SEO asset publication, and runtime recovery telemetry. The canonical schema drift view now expects schema 131.

## Schema 132 Additions

- `app_payment_posting_proof_queue` / `v_app_payment_posting_proof_queue`
- `app_reconciliation_match_workbench_queue` / `v_app_reconciliation_match_workbench_queue`
- `app_equipment_scan_verification_queue` / `v_app_equipment_scan_verification_queue`
- `app_local_seo_asset_smoke_queue` / `v_app_local_seo_asset_smoke_queue`
- `app_runtime_fallback_drill_history_queue` / `v_app_runtime_fallback_drill_history_queue`

`v_schema_drift_status` now expects schema **132**.
