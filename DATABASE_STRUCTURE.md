# Database Structure

Last refreshed: **2026-05-19b**

## Current schema marker

Latest schema file: `sql/117_split_admin_scopes_confirmation_and_deployment_checklist.sql`.

## Schema 117 additions

- `admin_fast_path_scope_registry`
- `admin_action_confirmation_rules`
- `admin_deployment_checklist_items`
- `v_admin_fast_path_scope_registry`
- `v_admin_action_confirmation_rules`
- `v_admin_deployment_checklist`
- `v_schema_drift_status` now expects schema **117**.

## Purpose

Schema 117 documents and tracks the move from broad Admin payloads to smaller panel fast paths, records which actions need confirmation guardrails, and adds deployment checklist rows for schema/function/cache readiness.

## Important compatibility rule

Keep `v_schema_drift_status.expected_schema_version` as the column name. Do not rename it with `create or replace view`, because PostgreSQL can raise `42P16` when a replacement view tries to rename an existing column.
