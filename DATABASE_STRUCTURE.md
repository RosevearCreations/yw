# Database Structure

Last refreshed: **2026-06-01a**

## Current schema marker

The active schema reference is aligned through:

- `sql/125_deployment_bundle_parse_seo_fallback_guardrails.sql`

`v_schema_drift_status` now expects schema **125**.

## Latest schema 125 additions

New deployment/quality guardrail tables:

- `app_deployment_bundle_checks`
- `app_public_seo_checks`
- `app_runtime_fallback_checks`

New views:

- `v_app_deployment_bundle_checks`
- `v_app_public_seo_checks`
- `v_app_runtime_fallback_checks`

Updated:

- `app_operational_depth_gates` receives deployment bundle, regex repair, SEO/local wording, and runtime fallback rows.
- `app_schema_versions` receives schema version 125 marker.
- `v_schema_drift_status` expects schema 125.

## Previous schema 124 depth still active

Schema 124 remains the accounting/equipment-accountability foundation:

- `v_job_cost_depth_directory`
- `v_payment_application_workbench_directory`
- `v_bank_reconciliation_review_workbench`
- `v_remittance_filing_review_workbench`
- `v_month_end_close_workbench`
- `v_equipment_accountability_workbench`
- `v_equipment_service_task_directory`

## Deployment note

Apply migrations in order. For this build, schema **125** should be applied after schema **124**, then redeploy `jobs-manage` and `jobs-directory`.

<!-- 2026-06-01a pass: schema 125 deployment bundle parse repair, SEO/local checks, fallback guardrails, jobs-manage fix, jobs-directory attachment dedupe, cache marker, and roadmap refresh. -->
