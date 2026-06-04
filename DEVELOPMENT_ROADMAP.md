# Development Roadmap

Last refreshed: **2026-06-03a**

## Completed in this pass

1. Archived the schema 127 active root Markdown into `archive/markdown-current-snapshot-2026-06-02b/` before editing.
2. Retired legacy root Markdown files into `archive/retired-root-markdown-2026-06-03a/`.
3. Retired uploaded `test_write` files into `archive/retired-test-files-2026-06-03a/`.
4. Added schema **128**: `128_accounting_equipment_seo_fallback_execution_depth.sql`.
5. Updated `sql/000_full_schema_reference.sql` through schema **128**.
6. Updated `v_schema_drift_status` to expect schema **128**.
7. Added `app_payment_application_action_registry` and `v_app_payment_application_action_registry`.
8. Added `app_accounting_close_control_queue` and `v_app_accounting_close_control_queue`.
9. Added `app_equipment_accountability_action_queue` and `v_app_equipment_accountability_action_queue`.
10. Added `app_public_seo_publication_queue` and `v_app_public_seo_publication_queue`.
11. Added `app_fallback_observability_matrix` and `v_app_fallback_observability_matrix`.
12. Seeded schema 128 payment actions for apply, reverse, adjustments, refunds, and job cost rollups.
13. Seeded schema 128 accounting close controls for bank CSV preview, reconciliation, HST/GST, payroll remittance, month-end close, and accountant export packaging.
14. Seeded schema 128 equipment accountability actions for camera scan, accessory templates, verifier roles, failed-test work orders, and return-to-service signoff.
15. Seeded schema 128 SEO publication gates for sitemap, robots, broken links, structured data, and image-alt checks.
16. Seeded schema 128 fallback observability rows for optional views, stale service worker, offline conflict, unsupported scanner, and blocked accounting actions.
17. Updated `admin-directory` to return schema 128 queues on command-center and health scopes.
18. Updated `admin-ui` to render schema 128 readiness tables.
19. Updated `index.html` and `server-worker.js` to cache marker **2026-06-03a**.
20. Updated `scripts/repo-smoke-check.mjs`, active Markdown, and added `docs/ACCOUNTING_EQUIPMENT_SEO_FALLBACK_EXECUTION_SCHEMA128.md`.

## Next 20 steps

1. Build working payment application UI actions for apply, reverse, approve, discounts, write-offs, overpayments, refunds, and reversals.
2. Add bank CSV import preview with header validation, duplicate detection, rejected rows, bad dates, and amount-sign review.
3. Add reconciliation manual match, split match, unmatch/undo, reviewer notes, and final reviewer signoff.
4. Finish HST/GST filing proof workflow with source totals, adjustments, uploaded proof, filed/remitted dates, and lock status.
5. Finish payroll remittance review with source pay runs, deductions, employer costs, proof, payment date, and close-period link.
6. Finish month-end close lock/reopen controls and posting blocks for closed periods.
7. Generate accountant export packages with manifest, CSV/JSON summaries, proof list, delivery status, and resend history.
8. Replace manual equipment scan fallback with real camera/BarcodeDetector scanning where supported.
9. Create reusable DB accessory checklist templates per equipment category or pool.
10. Enforce verifier roles server-side for final return verification, defect clearing, and return-to-service.
11. Convert failed arrival/return tests into assigned service work orders with due date, cost, evidence, and completion proof.
12. Add detailed job cost rollup cards for repair, delay, equipment usage, replacement, fuel, disposal, materials, and subcontractors.
13. Carry accepted quote terms into invoice candidates without retyping.
14. Generate sitemap and robots files from approved public route SEO registry rows.
15. Add public broken-link, broken-asset, structured-data, and image-alt smoke checks.
16. Add Today dashboard quick buttons for equipment scan, proof upload, exception review, and draft resume.
17. Improve offline conflict language with Retry, Keep Local, Discard Local, and Sync Status choices.
18. Convert repeated inline Admin styles into reusable component/token classes.
19. Generate release manifest Markdown/JSON automatically from schema, docs, cache markers, code, and smoke results.
20. Add Edge Function deploy compatibility preflight that catches TypeScript parse errors and optional-view fallback gaps before deployment.

## Following 20 steps after that

1. Add compact mobile cards for schema 128 readiness queues.
2. Add action buttons to payment application registry rows.
3. Add import-row detail drawers to bank CSV preview.
4. Add reconciliation match confidence scoring and reviewer override reasons.
5. Add HST/GST filing package download.
6. Add payroll remittance package download.
7. Add closed-period warning banners across Jobs and Accounting.
8. Add QR label export for equipment assets.
9. Add accessory missing/damaged trend reports.
10. Add equipment service-cost rollup to job profitability.
11. Add return-to-service evidence upload and final signoff.
12. Add internal-link approve/dismiss actions.
13. Add route SEO proof previews.
14. Add public sitemap/robots generation task.
15. Add structured-data preview and parse results in Admin.
16. Add mobile accessibility checks for labels, contrast, and tap targets.
17. Add support snapshot export for Supabase deploy failures.
18. Add browser cache/schema mismatch banner tied to `v_schema_drift_status`.
19. Split Jobs UI into jobs, equipment, accounting, and evidence modules.
20. Split Admin readiness rendering into smaller modules.

<!-- 2026-06-03a pass: schema 128 accounting/equipment/SEO/fallback execution queues, Admin readiness visibility, archive hygiene, cache marker, smoke updates, and Markdown refresh. -->
