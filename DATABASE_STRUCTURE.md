# Database Structure

Last refreshed: **2026-05-17a**

## Current schema marker

- Latest migration: **112**
- File: `sql/112_admin_operations_pagination_sorting_panel_refresh.sql`
- Canonical reference: `sql/000_full_schema_reference.sql`

## Schema 112 purpose

Schema 112 is a low-risk tracking migration. It does not rebuild core business tables. It updates/records:

- `app_schema_versions` marker for release `2026-05-17a`
- frontend quality gates for Staff sorting
- frontend quality gates for Jobs/Operations paging
- Edge Function sorting payload expectations
- saved-view replay expectations
- cache version quality gate
- `v_schema_drift_status` expected version 112
- `v_mobile_navigation_quality_gates` with current Admin UX gates

## Main DB-backed areas

- Profiles, sites, assignments, access views
- Jobs, routes, work orders, estimates, equipment, materials
- HSE forms, evidence, corrective actions, training, SDS
- Accounting close, reconciliation, tax, payroll, AR/AP, GL, accountant handoff
- Admin health, schema drift, audit, saved filters, deployment gates

## Deploy rule

Apply SQL through schema 112 before relying on Admin Health, schema drift, or new quality-gate rows.
