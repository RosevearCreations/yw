# Database Structure

Last refreshed: **2026-05-17b**

## Latest schema marker

- Current repo schema: **113**
- Latest migration file: `sql/113_admin_panel_refresh_and_job_review_actions.sql`
- Canonical reference: `sql/000_full_schema_reference.sql`

## Schema 113 additions

- `admin_panel_refresh_preferences`
- `admin_job_action_audit`
- `v_admin_panel_refresh_preferences`
- `v_admin_job_action_audit_directory`
- additional `app_frontend_quality_gates` rows
- updated `v_schema_drift_status` repo marker to 113

## Important live-schema guardrail

Use `jobs.status`. Do not assume `jobs.job_status` exists in the live database.
