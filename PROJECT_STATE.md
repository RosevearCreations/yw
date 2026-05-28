# Project State

Last refreshed: **2026-05-26a**

Current output label: `yw-main-130-updated-2026-05-26a-ontario-ohsa-mobile-first.zip`

## Current state

The app is now moving from "desktop Admin first" toward **mobile-first field operation**. Admin still keeps the production-readiness registry work from prior passes, but this pass adds a practical phone layer: a bottom quick-action bar and Ontario-specific safety wording.

## Current schema

- Latest migration: `sql/120_ontario_ohsa_mobile_first_app_guardrails.sql`
- Canonical schema: `sql/000_full_schema_reference.sql`
- Schema drift marker: expected schema version **120**

## Current frontend

- Cache version: `2026-05-26a`
- Main menu remains compact/expandable on mobile.
- New mobile quick-action bar appears on phone-width screens.
- Visible safety wording now uses Ontario OHSA / Ontario workplace safety language.
- App shell still has one H1.
- CSS brace counts were verified.

## Current backend focus

- Keep Admin payloads smaller through fast paths.
- Keep schema drift and readiness rows visible.
- Keep action buttons guarded by role and DB registry.
- Add phone-first rows and mobile quality gates before expanding more field workflows.
