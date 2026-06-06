# Changelog

## 2026-06-05a - Schema 131

- Added schema 131 payment/reconciliation/equipment/SEO/runtime execution controls.
- Updated canonical full schema reference and schema drift marker to 131.
- Added Admin readiness loading/rendering for schema 131 queues.
- Updated cache marker to 2026-06-05a.
- Restored missing archive snapshots and retired active test files.

## 2026-06-05b – Schema 132

- Added `sql/132_payment_recon_equipment_seo_fallback_telemetry_drill_history.sql`.
- Added Admin-visible payment posting proof, reconciliation match workbench, equipment scan verification, local SEO asset smoke, and fallback drill-history queues.
- Added baseline `sitemap.xml` and `robots.txt` files for SEO asset execution.
- Updated `admin-directory`, `admin-ui`, smoke checks, cache markers, schema reference, and active Markdown.
- Retired root `test_write` files into archive and preserved current Markdown snapshot.
