# Database Structure

Last refreshed: **2026-05-26a**

## Current migration marker

Latest schema: **120**

Latest migration file:

`sql/120_ontario_ohsa_mobile_first_app_guardrails.sql`

Canonical reference:

`sql/000_full_schema_reference.sql`

## Added in schema 120

### Tables

- `public.app_mobile_first_quality_gates`
- `public.app_jurisdiction_wording_gates`

### Views

- `public.v_app_mobile_first_quality_gates`
- `public.v_app_jurisdiction_wording_gates`
- `public.v_schema_drift_status` now expects schema **120**.

## Purpose

Schema 120 is a production-readiness and mobile-readiness layer. It records checks for phone-first field usage and Ontario-specific wording so the Admin readiness screen can show whether the app is staying aligned with Ontario workplace safety language and mobile field workflows.
