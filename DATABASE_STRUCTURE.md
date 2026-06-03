# Database Structure

Last refreshed: **2026-06-02a**

Current schema marker: **126**

## Latest migration

- `sql/126_roadmap_depth_data_migration_seo_css_fallback_guardrails.sql`

## Latest schema 126 additions

- `app_roadmap_action_steps`
- `v_app_roadmap_action_steps`
- `app_depth_review_queue`
- `v_app_depth_review_queue`
- `app_data_migration_candidates`
- `v_app_data_migration_candidates`
- `app_schema_documentation_sync_checks`
- `v_app_schema_documentation_sync_checks`

## Schema 126 guardrails now visible in Admin

- `v_app_deployment_bundle_checks`
- `v_app_public_seo_checks`
- `v_app_runtime_fallback_checks`

## Drift marker

`v_schema_drift_status` now expects schema **126** and reports `behind` until the live Supabase database has applied migrations through schema 126.

## Current source-of-truth direction

- Keep offline-first drafts and outbox entries local-first, then sync conflict summaries to DB.
- Move shared/reviewable workflow state into DB when it affects accounting, equipment accountability, SEO publishing, deployment readiness, or operator signoff.
- Preserve generated/static fallbacks where public pages or offline mobile workflows must continue without a live DB connection.

<!-- 2026-06-02a pass: schema 126 roadmap depth, data migration candidates, SEO/CSS/fallback guardrails, Admin readiness visibility, archive hygiene, cache marker, and Markdown refresh. -->
