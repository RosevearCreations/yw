# Database Structure

Last refreshed: **2026-05-18a**

## Current schema level

Latest repo schema marker: **114**

## New schema

- `sql/114_staged_admin_load_and_cache_fallback_guardrails.sql`

## Purpose

Schema 114 records the staged Admin load strategy, frontend quality gates, panel timeout expectations, and schema drift status. It does not attempt destructive table changes.

## Important tracking objects

- `public.app_schema_versions`
- `public.app_frontend_quality_gates`
- `public.admin_panel_refresh_preferences`
- `public.v_admin_panel_refresh_preferences`
- `public.v_schema_drift_status`

## Apply order

Apply migrations through schema 114 in sequence. If schema 113 was partially applied, use the corrected schema 113 file before applying 114.
