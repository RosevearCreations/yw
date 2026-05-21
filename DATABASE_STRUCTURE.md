# Database Structure

Last refreshed: **2026-05-20b**

## Current migration marker

Latest schema: **119**

Latest migration file:

`sql/119_admin_action_permissions_preflight_and_retry_rules.sql`

Canonical reference:

`sql/000_full_schema_reference.sql`

## Added in schema 119

### Tables

- `public.admin_action_permission_registry`
- `public.admin_panel_retry_policy`
- `public.admin_schema_preflight_checks`

### Updated table

- `public.admin_function_readiness_checks`
  - `last_checked_at`
  - `operator_signoff_at`
  - `operator_signoff_by`
  - `operator_notes`

### Views

- `public.v_admin_action_permission_registry`
- `public.v_admin_panel_retry_policy`
- `public.v_admin_schema_preflight_checks`
- `public.v_admin_function_readiness_checks`
- `public.v_schema_drift_status` now expects schema **119**.

## Purpose

Schema 119 is a production-readiness layer. It does not replace the existing app workflow tables. It gives Admin a DB-backed way to show required schema objects, action role requirements, panel retry/backoff rules, and function readiness signoff state before operators click risky buttons.
