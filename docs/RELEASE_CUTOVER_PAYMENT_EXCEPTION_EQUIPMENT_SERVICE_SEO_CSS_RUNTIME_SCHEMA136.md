# Schema 136 — Release Cutover, Payment Exceptions, Equipment Service Gates, Local SEO Evidence, CSS Drift, Runtime Fallback, and JSON/DB Source-of-Truth Controls

Build marker: `2026-06-06c`  
Schema marker: `136_release_cutover_payment_exception_equipment_service_seo_css_runtime_controls`

## What changed

Schema 136 adds Admin-visible queues for the next operational depth layer:

1. Release cutover checklist
2. Payment exception decisions
3. Equipment return-to-service gates
4. Local search evidence queue
5. CSS drift watchlist
6. Runtime fallback test plan
7. JSON/DB source-of-truth queue

These queues keep the app moving toward real execution instead of only documenting the work in Markdown.

## Why this matters

The previous passes created many planned controls. This pass makes the next set of practical decisions visible in Admin so the team can track which parts are ready, which are still manual, and which data sources should become DB-owned instead of living in static JSON or scattered UI text.

## Completed in this pass

- Added `sql/136_release_cutover_payment_exception_equipment_service_seo_css_runtime_controls.sql`.
- Updated `sql/000_full_schema_reference.sql` to expect schema 136.
- Added Admin Directory loading for schema 136 views.
- Added Admin Production Readiness tables for schema 136 queues.
- Updated smoke checks for schema 136, cache marker, SEO assets, and Admin readiness rendering.
- Updated active Markdown files with completed and next roadmap steps.
- Archived current root Markdown and retired root `test_write` files.

## Deployment order

1. Apply schema 136.
2. Redeploy `admin-directory`.
3. Redeploy `jobs-manage` and `jobs-directory` only if the live versions are behind the current build.
4. Hard-refresh the browser or clear the old service worker cache so `2026-06-06c` assets load.

## Next focus

The next strongest pass is to convert the queued decisions into real write workflows:

- payment apply/reverse/refund/write-off actions,
- bank CSV preview and reconciliation matching,
- equipment return-to-service enforcement,
- sitemap/robots generation from approved DB route evidence,
- runtime fallback drill execution history.
