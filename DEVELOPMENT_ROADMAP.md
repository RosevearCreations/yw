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

## Build 2026-06-11a / schema 142

Completed this pass:
1. Repaired the canonical full schema reference for the schema 142 `app_local_seo_conversion_queue` VALUES-list mismatch.
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

## Build 2026-06-11a / Schema 142 completed pass

Completed this pass:

1. Repaired the canonical `sql/000_full_schema_reference.sql` schema 142 block using the verified standalone schema 142 migration.
2. Added `sql/142_schema_deploy_repair_payment_recon_equipment_seo_runtime_source_migration_controls.sql`.
3. Added Admin-visible schema deploy repair queue.
4. Added Admin-visible payment/reconciliation proof closeout queue.
5. Added Admin-visible equipment return exception action queue.
6. Added Admin-visible local-search prominence evidence queue.
7. Added Admin-visible runtime fallback observability queue.
8. Added Admin-visible JSON/DB source migration queue.
9. Updated `admin-directory` to load schema 142 views in command-center and health scopes.
10. Updated Admin UI state, payload mapping, table bindings, and rendering placeholders for schema 142 queues.
11. Updated smoke checks so schema 142 and schema 142 checks run before the script exits.
12. Updated cache markers to `2026-06-11a`.
13. Updated sitemap lastmod to `2026-06-11`.
14. Preserved one-H1 public page rule.
15. Preserved CSS drift/brace-balance validation.
16. Archived root helper Markdown files out of the active deployment root.
17. Archived root `test_write` files out of the active deployment root.
18. Added schema 142 documentation.
19. Updated active Markdown build/schema markers.
20. Packaged a fresh schema 142 release zip after smoke and syntax checks.

Next 20 steps:

1. Add real Admin action buttons for schema deploy repair checklist rows.
2. Add proof upload/reason fields to payment/reconciliation closeout actions.
3. Add split/reject/accept/undo write actions for reconciliation exceptions.
4. Add equipment return exception actions that create service/cost/write-off decisions.
5. Add mobile camera scan fallback for equipment return exception verification.
6. Add DB-backed equipment accessory template editor.
7. Generate sitemap/internal-link candidates from approved route registry rows.
8. Add local-search conversion dead-link checks for CTA targets.
9. Add image alt/local proof smoke checks for public pages.
10. Persist runtime fallback observability events from UI errors.
11. Persist runtime fallback observability events from Edge Function safeList fallbacks.
12. Add offline conflict queue review actions for mobile drafts.
13. Connect payment proof closeout to accountant export packaging.
14. Connect equipment exception costs to job profitability.
15. Add HST/GST review status to accounting closeout readiness.
16. Add payroll/remittance proof queues into the same release checklist.
17. Add month-end lock/reopen controls with audit reason.
18. Create generated release handoff view for deploy order and rollback notes.
19. Move repeated fallback copy toward the DB message catalog.
20. Continue reducing JSON/static duplication where DB registries are more reliable.

---

## Build 2026-06-11a / Schema 142 sync note

This Markdown file was reviewed during the schema 142 pass. The active build is **2026-06-11a / schema 142**. Keep Markdown, schema files, Admin readiness views, SEO/H1 checks, CSS drift checks, runtime fallback notes, and JSON/DB source-of-truth decisions aligned during the next pass.


## Build 2026-06-12a / Schema 143 completed pass

1. Added `sql/143_desktop_mobile_visual_enrichment_seo_css_runtime_data_source_controls.sql`.
2. Appended schema 143 to `sql/000_full_schema_reference.sql`.
3. Added desktop/mobile surface parity queues and views.
4. Added professional visual enrichment queues and views.
5. Added local-search content-depth queues and views.
6. Added CSS/motion/image guard queues and views.
7. Added schema deploy validation queues and views.
8. Added JSON/DB source-consolidation decision queues and views.
9. Updated `admin-directory` to load schema 143 views in command-center and health scopes.
10. Updated Admin UI state, payload mapping, table bindings, and readiness rendering for schema 143 queues.
11. Added Admin table markup for schema 143 desktop/mobile, visual, SEO, CSS, deploy, and source-consolidation rows.
12. Added a public desktop/mobile readiness visual strip without adding another H1.
13. Added responsive visual-polish CSS for the readiness strip.
14. Updated cache markers to `2026-06-12a`.
15. Updated `sitemap.xml` lastmod to `2026-06-12`.
16. Preserved `robots.txt` sitemap reference.
17. Preserved repaired schema 141/142 compatibility in the full schema path.
18. Archived retired helper Markdown out of the active root.
19. Archived temporary `test_write` files out of the active root.
20. Updated roadmap, known issues, deployment, testing, database, project-state, README, and handoff Markdown for schema 143.

## Next 20 steps after Schema 143

1. Build editable Admin actions for desktop/mobile parity rows.
2. Add a DB-backed visual asset registry with alt text, proof, compression, and publication status.
3. Add thumbnail/proof review for approved service, equipment, crew, and safety images.
4. Generate sitemap and robots candidates from approved DB route rows.
5. Generate internal-link candidates from approved service-area and proof rows.
6. Add smoke checks for title/meta/H1/local phrase/CTA target alignment per public route.
7. Add image size, alt text, and consent/proof checks before public image publication.
8. Add reduced-motion checks for any future visual effects.
9. Add mobile-first cards for offline conflict choices: retry, keep local, or discard after confirmation.
10. Add desktop/Admin deploy checklist controls for schema order, function redeploy, and cache clear.
11. Convert payment posting proof queues into real upload/reason/signoff controls.
12. Convert reconciliation exception queues into split/undo/export actions.
13. Convert equipment custody evidence rows into a timeline with scan/signature/photo proof.
14. Add equipment accessory replacement-cost recovery and write-off decisions.
15. Add job profitability links for equipment damage, accessory loss, and service tasks.
16. Persist runtime fallback events from UI and Edge Function failures.
17. Add fallback event rollups by surface, owner, and repeated blocker.
18. Move repeated visual, SEO, and surface-parity config from Markdown/static files toward DB registries.
19. Add an accountant export proof manifest for unresolved payment/reconciliation/equipment exceptions.
20. Continue one-H1, CSS brace, sitemap/robots, cache marker, and Edge Function parse checks every pass.

## Build 2026-06-12a / Schema 143 sync note

This Markdown file was reviewed during the schema 143 pass. The active build is **2026-06-12a / schema 143**. Keep Markdown, schema files, Admin readiness views, desktop/mobile parity, visual enrichment, SEO/H1 checks, CSS drift checks, runtime fallback notes, and JSON/DB source-of-truth decisions aligned during the next pass.
