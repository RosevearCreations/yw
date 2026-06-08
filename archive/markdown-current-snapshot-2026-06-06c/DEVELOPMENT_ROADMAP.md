# Development Roadmap

Build: **2026-06-06a**  
Schema: **134**

## Completed this pass

1. Added `sql/134_payment_adjustment_recon_exception_equipment_scan_seo_runtime_messages.sql`.
2. Updated `sql/000_full_schema_reference.sql` so the canonical full-schema path now includes schema 134.
3. Added Admin-visible payment adjustment workflow queue for deposits, credits, refunds, write-offs, overpayments, reversals, and closed-period guards.
4. Added reconciliation exception resolution queue for duplicate rows, split payments, no-match rows, posting blocks, and undo guidance.
5. Added equipment scan rollout queue for camera/manual scan, accessory templates, verifier role gates, and service-task behaviour.
6. Added local SEO content-depth queue for truthful local wording, proof requirements, internal links, and publication gates.
7. Added runtime error-message catalog for clearer field/user messages, operator hints, telemetry hints, retry rules, and fallback text.
8. Loaded schema 134 views through `admin-directory` with safe optional-view fallbacks.
9. Added Admin readiness table bindings for the schema 134 queues.
10. Fixed the Admin readiness HTML around the SEO smoke / bank CSV table boundary to reduce layout drift.
11. Updated cache marker and frontend asset query strings to `2026-06-06a`.
12. Updated `sitemap.xml` lastmod to `2026-06-06` and preserved `robots.txt`.
13. Preserved the one-H1 public page smoke check.
14. Preserved the CSS brace-balance smoke check.
15. Preserved Edge Function TypeScript parse checks.
16. Restored required legacy Markdown archive snapshots.
17. Archived the active Markdown snapshot from the previous build.
18. Retired active root `test_write` files into archive.
19. Added `docs/PAYMENT_ADJUSTMENT_RECON_EXCEPTION_EQUIPMENT_SCAN_SEO_RUNTIME_SCHEMA134.md`.
20. Updated roadmap, known issues, deployment, testing, database, project state, and active docs review markers for schema 134.

## Next 20 steps

1. Create real payment application tables and Edge write actions for applying deposits/payments to invoices.
2. Add payment reversal workflow with reason, reviewer, original-payment link, and period-lock check.
3. Add credit, write-off, refund, and overpayment workflow with GL account mapping and proof notes.
4. Build bank CSV upload preview with header validation, duplicate detection, rejected-row reasons, and import staging.
5. Build reconciliation match scoring rows using amount/date/reference/customer/memo matching.
6. Add manual reconciliation match/split/undo/signoff UI.
7. Add reconciliation exception export into the accountant package.
8. Create DB-backed equipment accessory template tables and an Admin editor.
9. Add phone camera QR/barcode scanning where supported, while keeping manual entry as fallback.
10. Enforce equipment verifier role server-side for arrival, return, defect clear, and return-to-service.
11. Convert failed arrival/return tests into assigned service work orders with owner, due date, proof, and cost.
12. Roll equipment repair/replacement/delay/usage costs into job profitability.
13. Generate sitemap and robots from approved route registry rows rather than static files only.
14. Add JSON-LD validation, broken-link, image-alt, and local-proof smoke checks.
15. Add mobile offline conflict choices: retry sync, keep local, reload server, or discard local.
16. Store runtime fallback telemetry counts and drill results in DB-backed tables.
17. Complete HST/GST review screens with source totals, proof, filed/remitted dates, and locks.
18. Complete payroll remittance proof/signoff screens.
19. Complete month-end close lock/reopen controls and accountant export delivery.
20. Continue migrating repeated JSON/checklist config into DB registries when Admin visibility, review state, sorting, or workflow actions are needed.

## Direction

Keep every pass tied to working deployment guardrails: update SQL migrations, `sql/000_full_schema_reference.sql`, active Markdown, cache markers, Admin readiness views, CSS/H1 checks, and smoke checks together. Continue moving repeated JSON/checklist-style data into DB-backed registries when the data needs Admin visibility, sorting, review status, or future workflow actions.

## 2026-06-06b Schema 135 update

This pass adds release-validation guardrails for payment/reconciliation execution, equipment mobile scan validation, local SEO release validation, runtime fallback messages, and JSON/DB migration candidates. The schema marker, cache marker, sitemap/robots check, one-H1 guardrail, CSS brace-balance check, and smoke script were updated together.

Completed in this pass:

1. Added schema 135 migration.
2. Updated the canonical full schema reference through schema 135.
3. Added Admin-visible release validation queue.
4. Added payment/reconciliation execution queue.
5. Added equipment mobile scan validation queue.
6. Added local SEO release validation queue.
7. Added runtime fallback message queue.
8. Added JSON/DB migration execution queue.
9. Exposed schema 135 queues in `admin-directory`.
10. Rendered schema 135 queues in Admin Production Readiness.
11. Updated cache marker to `2026-06-06b`.
12. Preserved sitemap and robots files.
13. Preserved the one-H1 public-page rule.
14. Preserved CSS brace-balance checking.
15. Restored required archive snapshots.
16. Retired root `test_write` files into archive.
17. Retired helper Markdown files out of active root.
18. Kept schema 128 roadmap-column compatibility repair.
19. Updated smoke checks for schema 135.
20. Added schema 135 documentation.

Next 20 recommended steps:

1. Build payment apply/reverse buttons backed by staged payment rows.
2. Build adjustment workflow buttons for credits, write-offs, refunds, and overpayments.
3. Add closed-period blocking to payment and adjustment write paths.
4. Build bank CSV preview with header, duplicate, date, and amount-sign validation.
5. Build reconciliation match, split, undo, and reviewer signoff workflow.
6. Add low-confidence reconciliation exception queue with accountant export.
7. Add payment/reconciliation proof attachments.
8. Add month-end close reopen reason and re-close audit trail.
9. Build equipment accessory template editor by equipment pool/category.
10. Add real camera/BarcodeDetector scanning where supported.
11. Keep manual equipment-code entry as the required fallback.
12. Enforce verifier role server-side for defect clear and return-to-service.
13. Promote failed equipment tests into assigned service work orders with costs.
14. Feed equipment repair/service costs into job profitability rollups.
15. Generate sitemap and robots from approved DB route rows.
16. Add broken-link, missing-image, and alt-text smoke checks.
17. Add structured-data validation before public route publish.
18. Move repeated runtime error/fallback copy toward DB-managed message catalog.
19. Continue reviewing JSON-vs-DB duplication and migrate high-risk duplicated data to one source of truth.
20. Add mobile offline conflict UI for keep local, use server, or review before sync.

---

## Build 2026-06-06c / Schema 136 Update

This pass adds schema 136 and keeps the active Markdown, schema reference, Admin readiness UI, public SEO guardrails, CSS sanity checks, and fallback checks aligned.

### Completed 20 for this pass

1. Added schema 136 migration for release cutover controls.
2. Added payment exception decision queue.
3. Added equipment return-to-service gate queue.
4. Added local search evidence queue.
5. Added CSS drift watchlist.
6. Added runtime fallback test plan.
7. Added JSON/DB source-of-truth queue.
8. Updated the canonical full schema reference to schema 136.
9. Updated schema drift expectations to 136.
10. Added Admin Directory loading for new schema 136 views.
11. Added Admin Production Readiness tables for schema 136 rows.
12. Updated cache/version marker to 2026-06-06c.
13. Preserved sitemap.xml and robots.txt local SEO assets.
14. Verified the public shell remains one H1.
15. Verified CSS brace balance remains clean.
16. Restored required archive snapshots for smoke continuity.
17. Archived current root Markdown snapshot.
18. Retired root test_write files into archive.
19. Updated smoke checks for schema 136 readiness.
20. Added this schema 136 note across the active Markdown set.

### Next 20 steps to move toward

1. Build real payment apply and reverse buttons with staged posting rows.
2. Add overpayment decision handling: hold credit, refund, or apply to invoice.
3. Add write-off workflow with threshold approval and tax-impact review.
4. Add refund workflow with original-payment link and proof upload.
5. Build bank CSV preview with header, date, duplicate, and amount-sign checks.
6. Add reconciliation candidate scoring and reviewer decision notes.
7. Add reconciliation split-match and undo workflow.
8. Add close-period lock/reopen enforcement to payment and reconciliation writes.
9. Add equipment accessory template editor by equipment pool/category.
10. Enforce equipment return-to-service server-side before status returns to available.
11. Link equipment repair/replacement costs to job profitability rows.
12. Add camera BarcodeDetector scan with manual fallback tracking.
13. Generate sitemap.xml and robots.txt from approved DB route evidence.
14. Add broken-link, missing-image, and JSON-LD smoke checks to the release script.
15. Add local proof requirements before publishing new town/service pages.
16. Move runtime fallback copy into a reviewed DB/admin catalog.
17. Add fallback drill execution history for missing views, stale cache, offline conflicts, and unsupported scanner.
18. Add CSS visual regression notes for Admin tables, mobile quick nav, and mobile forms.
19. Move repeated JSON/static route data toward DB-owned source-of-truth rows where it reduces duplication.
20. Package accountant-ready exports that include payment, reconciliation, remittance, close, and proof metadata.

