# Database Structure

Last refreshed: **2026-05-28a**

## Current schema marker

Latest migration: **122** — `sql/122_mobile_form_stepper_draft_resume_guardrails.sql`

## Current schema focus

Schema 122 adds low-risk metadata tables and views for mobile form stepper readiness:

- `mobile_form_stepper_registry`
- `mobile_form_quality_gates`
- `v_mobile_form_stepper_registry`
- `v_mobile_form_quality_gates`
- updated `v_schema_drift_status` expected version **122**
- `app_schema_versions` marker for release **2026-05-28a**

No live submission table shape is changed by this pass.

## Canonical reference

`sql/000_full_schema_reference.sql` has been updated through schema **122**.
