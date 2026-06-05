# Development Roadmap

Last refreshed: **2026-06-04a**

## Completed in this pass

1. Repaired the canonical `sql/000_full_schema_reference.sql` copy of schema 128 so it no longer inserts into missing roadmap columns.
2. Confirmed standalone `sql/128_accounting_equipment_seo_fallback_execution_depth.sql` uses `source_doc`, `route_hint`, and `implementation_notes`.
3. Added schema **129**: `129_schema_compatibility_accounting_equipment_seo_fallback_playbooks.sql`.
4. Updated `v_schema_drift_status` to expect schema **129**.
5. Added schema migration compatibility checks for roadmap column naming.
6. Added accounting evidence package queues for payment application, reconciliation, remittance, and month-end close proof packages.
7. Added equipment return-to-service rule queues for failed arrival tests, failed return tests, missing accessories, and manual scan audit.
8. Added public asset smoke-check rows for single H1, cache marker, sitemap/robots, and broken asset checks.
9. Added error recovery playbook rows for schema column errors, Edge Function parse failures, optional-view gaps, and offline conflicts.
10. Updated `admin-directory` so Admin can load schema 129 readiness views.
11. Updated `admin-ui` with schema 129 readiness tables.
12. Updated `scripts/repo-smoke-check.mjs` to catch the schema 128 legacy roadmap insert pattern.
13. Updated cache/version marker to **2026-06-04a** in `index.html` and `server-worker.js`.
14. Archived active root Markdown into `archive/markdown-current-snapshot-2026-06-03a/`.
15. Preserved required legacy archive snapshots for smoke compatibility.
16. Retired old root helper Markdown into `archive/retired-root-markdown-2026-06-04a/`.
17. Retired uploaded `test_write` files into `archive/retired-test-files-2026-06-04a/`.
18. Added `docs/SCHEMA_COMPATIBILITY_ACCOUNTING_EQUIPMENT_SEO_FALLBACK_SCHEMA129.md`.
19. Verified one public H1 in `index.html`.
20. Verified CSS and JavaScript smoke checks after the schema 129 pass.

## Next 20 steps

1. Build the working payment application screen for apply, reverse, approve, discounts, write-offs, overpayments, refunds, and reversals.
2. Add payment proof package generation from the schema 129 accounting evidence package queue.
3. Add bank CSV import preview with header validation, duplicate detection, rejected rows, bad dates, and amount-sign review.
4. Add reconciliation match, split match, unmatch/undo, reviewer notes, and final reviewer signoff.
5. Add match confidence scoring and reviewer override reasons.
6. Finish HST/GST filing source totals, adjustments, uploaded proof, filed/remitted dates, and lock status.
7. Finish payroll remittance review with source pay runs, deductions, employer costs, proof, payment date, and close-period link.
8. Finish month-end close lock/reopen controls and posting blocks for closed periods.
9. Generate accountant export packages with manifest, CSV/JSON summaries, proof list, delivery status, and resend history.
10. Replace manual equipment scan fallback with real camera/BarcodeDetector scanning where supported.
11. Record manual scan fallback reason, actor, and timestamp.
12. Create reusable DB accessory checklist templates per equipment category or pool.
13. Enforce verifier roles server-side for final return verification, defect clearing, and return-to-service.
14. Convert failed arrival/return tests into assigned service work orders with due date, cost, evidence, and completion proof.
15. Block equipment availability until return-to-service proof is complete.
16. Add detailed job cost rollup cards for repair, delay, equipment usage, replacement, fuel, disposal, materials, and subcontractors.
17. Generate sitemap and robots files from approved public route SEO registry rows.
18. Add broken-link, broken-asset, structured-data, and image-alt smoke checks.
19. Improve offline conflict language with Retry, Keep Local, Discard Local, and Sync Status choices.
20. Convert repeated inline Admin styles into reusable component/token classes.

## Following 20 steps after that

1. Add compact mobile cards for schema 129 readiness queues.
2. Add action buttons to payment application registry rows.
3. Add import-row detail drawers to bank CSV preview.
4. Add HST/GST filing package download.
5. Add payroll remittance package download.
6. Add closed-period warning banners across Jobs and Accounting.
7. Add QR label export for equipment assets.
8. Add accessory missing/damaged cost rollups into job profitability.
9. Add service-task closeout proof uploads.
10. Add automatic release manifest Markdown/JSON generation.
11. Add local SEO page approval workflow.
12. Add route-level proof requirements before public publish.
13. Add image-alt scoring to Admin media review.
14. Add stale service-worker warning inside Admin readiness.
15. Add deploy checklist grouping by schema/function/static assets.
16. Add Edge Function deploy dry-run notes to the runbook.
17. Add user-friendly Supabase SQL error playbooks.
18. Add database rollback notes per schema version.
19. Add recurring cleanup for archived helper files.
20. Add final production-readiness export report.
