# Deployment Guide

Current build: **2026-06-06a**  
Current schema: **134**

## Deploy order

1. Apply SQL migrations through schema 134.
2. Redeploy `admin-directory`.
3. Redeploy `jobs-manage` and `jobs-directory` if the live functions are behind the packaged build.
4. Hard-refresh or clear the old service worker so `2026-06-06a` assets load.
5. Run the smoke check script before treating the upload as production-ready.

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

## Build 2026-06-06d / Schema 137 Update

This pass adds schema 137 and keeps the active Markdown, full schema reference, Admin readiness UI, public SEO guardrails, one-H1 rule, CSS sanity checks, data migration notes, and fallback checks aligned.

Completed 20 steps this pass:

1. Added schema 137 migration for release depth controls.
2. Added payment/reconciliation cutover drill queue.
3. Added equipment service cost recovery queue.
4. Added local SEO prominence action queue.
5. Added CSS accessibility fallback queue.
6. Added data migration validation queue.
7. Added runtime release message queue.
8. Updated the canonical full schema reference to schema 137.
9. Added Admin Directory loading for schema 137 views.
10. Added Admin Production Readiness tables for schema 137 rows.
11. Updated cache/version marker to 2026-06-06d.
12. Restored required Markdown archive snapshots.
13. Retired active root test_write files.
14. Retired helper Markdown from the active root.
15. Preserved sitemap.xml and robots.txt.
16. Preserved the one-H1 public page rule.
17. Preserved CSS brace-balance checks.
18. Preserved Edge Function parse checks.
19. Added smoke checks for schema 137 readiness.
20. Added this schema 137 note across the active Markdown set.

Next 20 steps to move toward:

1. Build live payment apply/reverse/credit/refund/write-off buttons.
2. Build bank CSV preview and import staging UI.
3. Build reconciliation scoring, manual match, split match, undo, and signoff screens.
4. Build month-end close lock/reopen controls.
5. Build accountant export manifest packaging.
6. Add equipment accessory templates as DB-managed records.
7. Add real camera QR/barcode scan support with manual fallback.
8. Require return-to-service proof before locked-out equipment becomes available.
9. Link failed-test service tasks to job financial cost rows.
10. Add local proof blocks for approved services and service areas.
11. Generate sitemap.xml and robots.txt from approved DB route rows.
12. Add broken-link, broken-asset, image-alt, and JSON-LD smoke checks.
13. Add mobile offline conflict resolution choices.
14. Add runtime fallback telemetry and drill history.
15. Use the runtime message catalog in visible UI errors.
16. Add CSS contrast and touch-target validation.
17. Convert high-duplication JSON sources to DB-backed registries.
18. Add data migration export/import proof checks.
19. Add release cutover proof attachments.
20. Add final live deployment proof checklist.

