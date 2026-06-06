# Known Issues and Gaps

Build: **2026-06-05a**  
Schema: **131**

## Still needs depth

1. Payment application rows are planned and visible, but the real apply/reverse/adjust buttons still need posting logic.
2. Bank reconciliation has execution queues, but CSV preview/import and manual match controls still need UI actions.
3. HST/GST and payroll remittance still need source-total screens, proof upload, and final signoff.
4. Month-end close still needs lock/reopen enforcement and accountant export file generation.
5. Equipment scan has manual fallback and queue rows, but real camera BarcodeDetector support still needs implementation.
6. Accessory templates still need DB-backed editor screens and equipment pool/category assignment.
7. Failed equipment tests create service-task direction, but full closeout proof/cost UI is still outstanding.
8. Return-to-service needs stronger server-side verifier role enforcement.
9. Sitemap, robots, broken-link, image-alt, and JSON-LD checks are still planned execution steps.
10. Runtime recovery telemetry is now queued but still needs real captured counts and summary cards.

## Recently repaired

- Schema 128 compatibility issue with `source_document`, `target_route_hint`, and `completion_note` was repaired to use `source_doc`, `route_hint`, and `implementation_notes`.
- Canonical full schema now carries the repaired schema 128 path.
- Missing archive snapshot folders are restored so smoke checks do not fail on legacy hygiene checks.
- Active `test_write` files are retired into archive.

## Next focus

The next strongest pass is to turn schema 131 queues into real Admin/mobile actions, starting with payment application, reconciliation import preview, equipment service closeout, and technical SEO file generation.

## Schema 132 Remaining Gaps

- Payment proof queues are visible, but real payment apply/reverse/refund/write-off actions still need write paths.
- Reconciliation match workbench rows are visible, but CSV upload, score calculation, split/undo, and signoff screens still need implementation.
- Equipment scan verification rows are visible, but real camera scanning and DB accessory templates still need implementation.
- `sitemap.xml` and `robots.txt` now exist as a baseline, but sitemap generation should move to approved route data.
- Fallback drill-history rows are visible, but pass/fail drill result storage is not yet implemented.
