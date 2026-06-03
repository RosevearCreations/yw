# Development Roadmap

Last refreshed: **2026-06-02b**

## Completed in this pass

1. Archived the schema 126 active root Markdown into `archive/markdown-current-snapshot-2026-06-02a/` before editing.
2. Retired legacy root Markdown files back into archive so the active root stays clean.
3. Retired uploaded `test_write` files into `archive/retired-test-files-2026-06-02b/`.
4. Added schema **127**: `127_public_route_seo_internal_link_css_mobile_guardrails.sql`.
5. Updated `sql/000_full_schema_reference.sql` through schema **127**.
6. Updated `v_schema_drift_status` to expect schema **127**.
7. Added `app_public_route_seo_registry` and `v_app_public_route_seo_registry` for route title/H1/meta/local/proof/internal-link status.
8. Added `app_internal_link_suggestion_queue` and `v_app_internal_link_suggestion_queue` for route-to-route internal link review.
9. Added `app_css_component_token_inventory` and `v_app_css_component_token_inventory` to reduce CSS drift through component/token review.
10. Added `app_mobile_field_action_queue` and `v_app_mobile_field_action_queue` for phone-first scan/proof work.
11. Added `app_release_manifest_checks` and `v_app_release_manifest_checks` so each release has schema/docs/cache/smoke markers.
12. Added schema 127 completed and next-20 rows to `app_roadmap_action_steps`.
13. Added new data migration candidates for public SEO registry, CSS token inventory, and release manifest checks.
14. Added new schema/documentation sync checks for schema 127 SQL, Markdown, and cache markers.
15. Updated `admin-directory` to load schema 127 views on command center and health scopes.
16. Updated `admin-ui` to render route SEO, internal link, CSS token, mobile action, and release manifest tables.
17. Added a manual scan/enter fallback button in the equipment form so phone users can capture QR/barcode values even before camera scanning is finished.
18. Updated `index.html` and `server-worker.js` to cache marker **2026-06-02b**.
19. Updated `scripts/repo-smoke-check.mjs` to check schema 127, cache marker 2026-06-02b, archive hygiene, Admin visibility, and scan fallback.
20. Updated active Markdown files and added `docs/PUBLIC_ROUTE_SEO_INTERNAL_LINK_CSS_MOBILE_SCHEMA127.md`.

## Next 20 steps

1. Build payment application UI actions for apply, reverse, approve, discounts, write-offs, overpayments, refunds, and reversals.
2. Add bank CSV import preview with header validation, duplicate detection, bad date checks, and amount sign review.
3. Add reconciliation manual match, split match, unmatch/undo, review notes, and reviewer signoff.
4. Finish HST/GST filing proof workflow with source totals, adjustments, uploaded proof, filed/remitted dates, and lock status.
5. Finish payroll remittance review with source pay runs, deductions, employer costs, proof, payment date, and close-period link.
6. Finish month-end close lock/reopen controls and posting blocks for closed periods.
7. Package accountant export files with manifest, CSV/JSON summaries, proof list, delivery status, and resend history.
8. Replace the manual equipment scan fallback with real camera/BarcodeDetector scanning where supported.
9. Create reusable DB accessory checklist templates per equipment category or pool.
10. Enforce verifier roles server-side for final return verification, defect clearing, and return-to-service.
11. Convert failed arrival/return tests into assigned service work orders with due date, cost, evidence, and completion proof.
12. Roll detailed cost categories into job profitability: repair, delay, equipment usage, replacement, fuel, disposal, materials, subcontractors.
13. Carry accepted quote terms into invoice candidates without retyping.
14. Populate the public route SEO registry from real public routes and fail missing title/H1/meta/local terms.
15. Build an Admin internal-link review UI for service, location, proof, gallery, and contact routes.
16. Add Today dashboard quick buttons for equipment scan, proof upload, exception review, and draft resume.
17. Improve offline conflict language with clear retry, keep local, discard local, and sync status choices.
18. Convert repeated inline CSS into reusable component/token classes.
19. Generate release manifest files automatically from schema, docs, code, cache, and smoke results.
20. Add sitemap, robots, broken-link, structured-data, and image-alt smoke checks.

## Following 20 steps after that

1. Add compact mobile cards for route SEO registry and release manifest rows.
2. Add proof previews to route SEO registry rows.
3. Add link approval/dismiss actions to the internal-link queue.
4. Add image-alt completeness scoring to the route SEO registry.
5. Add public sitemap/robots generation from approved route rows.
6. Add browser cache/schema mismatch banner tied to `v_schema_drift_status`.
7. Split Jobs UI into jobs, equipment, accounting, and evidence modules.
8. Split Admin readiness rendering into smaller modules.
9. Add demo data fixtures for accounting and equipment workflow testing.
10. Add backup/restore rehearsal evidence upload.
11. Add accountant export download bundle generation.
12. Add remittance close-period warning banners.
13. Add QR labels/export for equipment assets.
14. Add accessory missing/damaged trend reports.
15. Add equipment service-cost rollup to job profitability.
16. Add location/service SEO wording review before public route publish.
17. Add mobile accessibility smoke checks for labels and tap targets.
18. Add support snapshot export for Supabase deploy failures.
19. Add Edge Function/schema compatibility preflight before deploy.
20. Add release-history cards in Admin.

<!-- 2026-06-02b pass: schema 127 public route SEO registry, internal links, CSS token inventory, mobile field actions, release manifest checks, Admin readiness visibility, scan fallback, archive hygiene, cache marker, and Markdown refresh. -->
