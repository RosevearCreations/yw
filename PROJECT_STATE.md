# Project State

Last refreshed: **2026-05-17a**

## Status

The app is a Supabase-backed HSE/operations/accounting admin system with a growing production-readiness workflow. Current focus is reducing heavy Admin loads, improving mobile usability, and making backend workflows easier to manage safely.

## Current schema marker

- Latest repo schema: **112**
- Latest migration file: `sql/112_admin_operations_pagination_sorting_panel_refresh.sql`
- Canonical schema reference: `sql/000_full_schema_reference.sql`

## Current frontend/cache marker

- Static asset version: **2026-05-17a**
- Service worker cache: **ywi-shell-v2026-05-17a**

## Main active areas

- Admin Command Center and Health Center
- Staff Directory and access management
- Jobs/Operations backbone manager
- Guided Close Center
- Evidence Manager
- Reporting fast path
- Accounting close and accountant handoff foundations
- Mobile navigation and responsive Admin toolbars

## Important deploy note

The database must be migrated through schema 112 and `admin-directory` must be redeployed before the new Staff/Jobs sorting and pagination metadata can be trusted live.
