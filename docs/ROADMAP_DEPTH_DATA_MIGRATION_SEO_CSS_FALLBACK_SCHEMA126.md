# Roadmap Depth, Data Migration, SEO/CSS, and Fallback Guardrails — Schema 126

Last refreshed: **2026-06-02b**

## What schema 126 adds

Schema 126 turns this build pass into database-visible operating controls:

- Completed 20 steps and next 20 steps are stored in `app_roadmap_action_steps`.
- Application depth gaps are stored in `app_depth_review_queue`.
- JSON/DB duplication and source-of-truth decisions are stored in `app_data_migration_candidates`.
- Schema/documentation/cache/smoke sync checks are stored in `app_schema_documentation_sync_checks`.

## New views

- `v_app_roadmap_action_steps`
- `v_app_depth_review_queue`
- `v_app_data_migration_candidates`
- `v_app_schema_documentation_sync_checks`

## Admin visibility

`admin-directory` now loads schema 125/126 guardrail views on `command_center` and `health` scopes. `admin-ui` now renders the rows in Production Readiness so operators can see the build-readiness state without manually querying the database.

## Main depth areas carried forward

- Accounting cost category rollups
- Payment application UI
- Bank CSV preview and reconciliation review
- HST/GST and payroll remittance signoff
- Month-end close lock/reopen and accountant export packaging
- Equipment QR/barcode scan workflow
- Equipment accessory templates
- Equipment verifier permissions
- Failed equipment test service work orders
- Public route SEO registry
- CSS/mobile drift checks
- Runtime fallback clarity

## Data migration rule

Move duplicated operational state to the database when it needs review, audit, accounting, equipment custody, publishing approval, or Admin visibility. Keep generated/static or local-first fallbacks where public pages and offline mobile work must continue without a live database.

<!-- 2026-06-02a pass: schema 126 roadmap depth, data migration candidates, SEO/CSS/fallback guardrails, Admin readiness visibility, archive hygiene, cache marker, and Markdown refresh. -->
<!-- 2026-06-02b pass: schema 127 public route SEO registry, internal links, CSS token inventory, mobile field actions, release manifest checks, Admin readiness visibility, scan fallback, archive hygiene, cache marker, and Markdown refresh. -->


## Schema 133 pass marker

Reviewed during build **2026-06-05c / schema 133**. Keep this document aligned with the active roadmap and known gaps.
