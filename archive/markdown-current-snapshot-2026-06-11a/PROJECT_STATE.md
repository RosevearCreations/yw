# Project State

Build: **2026-06-06a**  
Schema: **134**

The app is continuing toward production-readiness by moving repeated roadmap/checklist items into DB-visible Admin queues. The newest pass adds payment write path, reconciliation scoring, equipment accessory template, local SEO generation, and mobile offline conflict-resolution queues.

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

## Build 2026-06-07a / Schema 138 Update

Completed this pass:

1. Added schema 138 release readiness signoff queues.
2. Added accounting exception closure tracking for unapplied cash, low-confidence reconciliation rows, and remittance proof gaps.
3. Added equipment service verification tracking for scan gates, accessory kit closeout, and failed-test cost links.
4. Added local SEO refresh tracking for homepage wording, service proof depth, sitemap/robots freshness, and internal-link discipline.
5. Added CSS/mobile regression tracking for Admin readiness tables, equipment action buttons, and offline/runtime banners.
6. Added runtime observability release tracking for optional-view fallbacks, stale service worker cache recovery, and offline draft conflicts.
7. Updated Admin directory to load schema 138 views with safe optional fallbacks.
8. Updated Admin UI readiness tables to display the schema 138 queues.
9. Updated full schema reference to expect schema 138.
10. Updated smoke checks to verify schema 138, sitemap freshness, and cache marker 2026-06-07a.
11. Updated sitemap lastmod to 2026-06-07 and preserved robots.txt.
12. Preserved the one-H1 public-page rule.
13. Preserved CSS brace-balance validation.
14. Retired root helper Markdown into archive.
15. Retired root test_write files into archive.
16. Created a Markdown snapshot for the previous build.
17. Kept the schema 128 roadmap-column repair in the canonical full-schema path.
18. Kept service worker cache marker aligned with index.html.
19. Kept Admin fallback guidance visible when optional schema views are not deployed yet.
20. Updated active Markdown so the release state, roadmap, issues, testing, deployment, and database notes agree.

Next 20 steps:

1. Turn payment exception closure rows into working Admin buttons.
2. Add apply/reverse/refund/write-off server actions with reviewer notes and period-lock checks.
3. Add bank CSV preview upload with rejected-row reasons before staging.
4. Add reconciliation scoring thresholds and manual match/split/undo screens.
5. Add month-end close proof package generation with export manifest.
6. Add HST/GST filing proof upload and filed/remitted date controls.
7. Add payroll remittance proof upload and close-period lock checks.
8. Add equipment return-to-service server enforcement for verifier role and proof completion.
9. Add camera QR/barcode scanning where the browser supports it.
10. Add reusable equipment accessory kit templates in the database.
11. Add automatic job financial event candidates from failed equipment tests and service tasks.
12. Add local SEO proof blocks from approved jobs/media without creating thin location pages.
13. Add broken-link and image-alt smoke checks for every approved public route.
14. Add structured-data review checks that match visible page content.
15. Convert dense Admin readiness tables to mobile card layouts where tables are too wide.
16. Add offline draft conflict UI choices: Retry, Keep Local, and Discard Local.
17. Add runtime observability counters for optional-view fallback, stale cache, and failed sync.
18. Finish JSON/DB source-of-truth decisions for duplicated reference data.
19. Add release cutover checklist steps for Supabase schema, functions, cache clear, and smoke evidence.
20. Keep documenting every pass in active Markdown and the full schema reference.

## Build 2026-06-07b / Schema 139 Update

Completed 20-step pass:
1. Added schema 139 accounting cutover trial-balance queue.
2. Added equipment QR/barcode scan asset rollout queue.
3. Added local SEO prominence publication queue.
4. Added CSS/mobile release guard queue.
5. Added runtime support playbook queue.
6. Added data-source migration lock queue.
7. Updated canonical full schema through schema 139.
8. Updated Admin directory schema 139 view loading.
9. Updated Admin readiness UI schema 139 rendering.
10. Updated smoke checks for schema 139.
11. Updated cache marker to 2026-06-07b.
12. Preserved sitemap and robots assets.
13. Confirmed one-H1 public page smoke check remains active.
14. Confirmed CSS brace-balance smoke check remains active.
15. Retired active root test_write files.
16. Retired helper Markdown from active root into archive.
17. Preserved Markdown archive snapshots.
18. Kept schema 128 roadmap-column compatibility repair.
19. Added documentation for schema 139.
20. Refreshed this Markdown file with completed and next-step actions.

Next 20-step direction:
1. Build real payment apply/reverse/adjust/refund write actions.
2. Add bank CSV preview and rejected-row screen.
3. Add reconciliation match/split/undo/signoff screen.
4. Add HST/GST proof upload and remittance signoff.
5. Add payroll remittance proof and close-period linkage.
6. Add accountant export package manifest download.
7. Add equipment camera scanning with manual fallback.
8. Add reusable equipment accessory checklist templates.
9. Add role-gated return-to-service closeout.
10. Link equipment service costs to job profitability.
11. Add route approval before sitemap publication.
12. Add broken-link and broken-asset checks.
13. Add public image-alt scoring and proof review.
14. Add CSS/mobile visual regression notes for admin tables.
15. Add offline conflict resolution for field/mobile forms.
16. Add runtime support messages directly in failed panels.
17. Decide JSON vs DB source-of-truth for duplicated datasets.
18. Add migration compatibility dry-run checks.
19. Add release cutover signoff workflow.
20. Add post-deploy service-worker and Edge Function log verification.

## Build 2026-06-09b / Schema 141

Completed this pass:
1. Repaired the canonical full schema reference for the schema 140 `app_local_seo_conversion_queue` VALUES-list mismatch.
2. Added `sql/141_release_handoff_payment_proof_equipment_custody_seo_runtime_logging_controls.sql`.
3. Added Admin-visible queues for release handoff, payment posting proof, equipment custody evidence, SEO conversion evidence, and runtime fallback event logging.
4. Updated Admin directory/UI references, cache markers, sitemap freshness, smoke checks, and archive hygiene.
5. Archived retired helper Markdown and root `test_write` files.

Next 20 focus:
1. Turn release handoff queue rows into a deploy checklist with copyable schema/function order.
2. Build payment posting proof upload/reason controls.
3. Build equipment custody evidence timeline and cost recovery decision actions.
4. Add local SEO conversion evidence checks to the smoke script.
5. Create persistent fallback event logging from UI and Edge Function failures.
6. Add proof attachment storage rules for payment/reconciliation closeout.
7. Add split-match reconciliation UI with undo history.
8. Add accessory replacement cost workflow tied to job profitability.
9. Add service-area route proof gating before sitemap/internal-link publication.
10. Add scanner-supported and manual-code equipment handoff testing.
11. Add close-period blocker export for unresolved payment/reconciliation rows.
12. Add runtime fallback counts to Admin readiness cards.
13. Add mobile offline conflict review queue actions.
14. Add CSS/mobile regression snapshots for Admin readiness sections.
15. Add broken-link and CTA target smoke checks.
16. Add accountant export proof manifest preview.
17. Add role enforcement for equipment lockout override.
18. Add payment/refund/write-off approval reason templates.
19. Add DB/source-of-truth lock checks for migrated JSON data.
20. Add a release-final sanity summary generator.

