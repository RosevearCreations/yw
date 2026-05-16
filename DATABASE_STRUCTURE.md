# Database Structure

Last refreshed: **2026-05-16a**

## Latest migration

`sql/110_mobile_navigation_quality_gates.sql`

## New schema 110 areas

- `app_frontend_quality_gates`: frontend/mobile/SEO/deployment quality gate tracking.
- `v_mobile_navigation_quality_gates`: compact mobile main menu, Admin section menu, one-H1, cache version, and active Markdown readiness rows.
- `v_schema_drift_status`: now expects schema **110**.
- `app_schema_versions`: receives schema 110 marker with release label `2026-05-16a`.

## Apply order

Apply all migrations in order through schema **110**. The canonical reference is `sql/000_full_schema_reference.sql`.

## Prior schema 109 foundations still active

Schema 109 remains the base for pagination settings, guided close actions, admin audit events, backup/restore rehearsals, bank CSV import staging, evidence action queue, and mobile action cards.
