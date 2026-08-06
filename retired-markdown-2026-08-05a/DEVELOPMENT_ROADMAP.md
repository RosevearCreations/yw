# Development Roadmap

Build: **2026-06-17a**  
Schema: **149**

## Completed this pass — 20

1. Archived retired helper Markdown from the active root.
2. Archived temporary `test_write` files.
3. Added schema 149 and appended it to the canonical full schema.
4. Added persistent operation write-audit events.
5. Added quote/contact duplicate suppression and follow-up targeting.
6. Added payment idempotency, proof, decision, and period-lock controls.
7. Added bank CSV header/date/amount validation and confirmation.
8. Added reconciliation idempotency, split, undo, signoff, and reject controls.
9. Added equipment scan idempotency and custody write controls.
10. Added visual asset approval/readiness controls.
11. Added public route SEO readiness controls.
12. Added Admin Operations Cockpit scorecard views.
13. Added role enforcement and write auditing in `operations-manage`.
14. Added payment approve/reject/post/cancel API actions.
15. Added bank preview confirmation API action.
16. Added visual/route approval decision logic.
17. Added offline-conflict resolution actions.
18. Added responsive desktop/mobile Operations Cockpit forms.
19. Added BarcodeDetector scanning, manual fallback, and local retry storage.
20. Updated Markdown, cache marker, sitemap, Admin loading, CSS, and smoke checks.

## Next 20 steps

1. Add live queue tables and action buttons beneath each cockpit form.
2. Add quote owner assignment, follow-up events, and email alerts.
3. Add proof attachment uploads for payments/reconciliation.
4. Post approved payment actions into real AR/AP and journals.
5. Promote confirmed bank rows into reconciliation workbench tables.
6. Add explainable match-scoring suggestions.
7. Validate split actions balance to the source amount.
8. Resolve scan codes to equipment master records.
9. Add accessory templates and stage-specific checklists.
10. Create service work orders/cost recovery from failed returns.
11. Add image upload, dimensions, compression, and thumbnails.
12. Replace placeholders only with approved assets.
13. Generate public pages from approved route data.
14. Generate sitemap entries from publication-ready routes.
15. Add customer portal for requests, quotes, jobs, invoices, and receipts.
16. Add online quote acceptance and deposits.
17. Add drag/drop dispatch and crew notifications.
18. Add live estimate-vs-actual job costing.
19. Add offline conflict merge and supervisor history.
20. Add end-to-end tests for all new write flows.

## Historical roadmap

## 2026-06-17a — Schema 149 Operations Cockpit

This pass converts schema 148 write targets into responsive desktop/mobile Admin forms with role checks, idempotency, approval controls, audit logging, local retry fallback, QR/barcode/manual scanning, quote duplicate suppression, and route/asset readiness validation. The public shell remains at one H1 and no unapproved public route was added.

## Completed this pass

1. Added `sql/145_sanity_check_value_added_breakdown_and_enrichment_controls.sql`.
2. Updated `sql/000_full_schema_reference.sql` through schema 145.
3. Added Admin-visible sanity-check snapshot queue.
4. Added value-added modification priority queue.
5. Added desktop/mobile value-gap queue.
6. Added visual professional backlog queue.
7. Added local-search value queue.
8. Added source-of-truth migration value queue.
9. Exposed schema 145 views through `admin-directory` with optional-view safe fallbacks.
10. Rendered schema 145 queues in Admin Production Readiness.
11. Added `docs/SCHEMA_145_SANITY_CHECK_VALUE_ADDED_BREAKDOWN.md`.
12. Added a public CSS-only sanity value-map strip while preserving one H1.
13. Updated cache marker and frontend asset query strings to `2026-06-13a`.
14. Updated `sitemap.xml` lastmod to `2026-06-13` and preserved `robots.txt`.
15. Archived retired helper Markdown files from the active root.
16. Archived active root `test_write` files.
17. Created `archive/markdown-current-snapshot-2026-06-13a/`.
18. Preserved repaired schema 140/141/142 paths in the full schema reference.
19. Updated smoke checks for schema 145.
20. Updated active Markdown with the sanity check, current state, and next 20 value-added steps.

## Next 20 steps

1. Build real payment application/reversal/refund/write-off/overpayment Edge write actions with proof, reason, reviewer, and period lock checks.
2. Build bank CSV upload preview with header/date/amount validation, duplicate detection, rejected-row reasons, and staging.
3. Build reconciliation match scoring, split matching, undo history, reviewer signoff, and accountant exception export.
4. Build equipment QR/barcode scan with BarcodeDetector where supported and manual-code fallback everywhere.
5. Build equipment custody timeline for checkout, site arrival, return, return-to-service, accessory exceptions, and service tasks.
6. Create DB-backed equipment accessory template editor by equipment pool/category.
7. Roll missing/damaged equipment and accessory costs into job profitability and accountant export.
8. Create public route registry with approved title, meta, one-H1, local proof, CTA, and sitemap inclusion status.
9. Create visual asset registry with source, consent/proof, alt text, route assignment, compression status, and publish state.
10. Add local SEO smoke checks for title/meta/H1/internal links/CTA target/image alt/route proof.
11. Add approved service-area/service-page candidate workflow before adding more sitemap URLs.
12. Add trust FAQ blocks connected to real service proof and quote/contact paths.
13. Add Admin dashboard scorecards and progress rails for accounting, equipment, SEO, runtime, and release readiness.
14. Add mobile offline conflict cards: Retry sync, Keep local, Reload server, Discard local after confirmation.
15. Persist runtime fallback events from UI and Edge Functions with owner action and resolution status.
16. Add public quote/request form with service choice, contact info, source route, and spam/fallback protection.
17. Add lightweight approved image/proof gallery after the visual asset registry is ready.
18. Add reduced-motion-safe micro-interactions for cards, buttons, status pills, and Admin scorecards.
19. Move repeated route/visual/checklist config out of static files and into DB registries where it controls publishing.
20. Package accountant export with payment applications, reconciliations, unresolved exceptions, HST/GST, payroll proof, and close/reopen audit trail.

## Sanity-check direction

The application is now most valuable when we convert readiness queues into operational write paths. Additional passive tracking should be secondary to accounting actions, reconciliation actions, equipment custody actions, approved visual/SEO registries, and mobile fallback resolution.

## Build 2026-06-13b / Schema 146 — Highest-value execution layer

Implemented the next value-added layer from the sanity check: payment action workbench, bank CSV import preview, reconciliation match/split/undo/signoff scaffolding, equipment QR/barcode custody workbench, visual asset approval registry, public route registry, quote/contact intake shell, mobile offline conflict cards, and Admin scorecard/progress rails.

SEO/H1/CSS guardrails remain active: one public H1, sitemap/robots freshness, cache marker `2026-06-13b`, and CSS brace balance checks. The public shell gained quote/contact intake and mobile conflict preview sections without adding extra H1 headings.

Next priority: connect payment actions and quote/contact intake to real Edge write actions, then build bank CSV preview and reconciliation match buttons.

## Schema 146 completed 20 — Highest-value execution layer

1. Added DB-backed payment action workbench for apply, reverse, refund, write-off, and overpayment actions.
2. Added bank CSV import preview queue with header validation, rejected rows, duplicate detection, and staging hints.
3. Added reconciliation match/split/undo/signoff action queue.
4. Added equipment QR/barcode/manual scan custody workbench.
5. Added equipment custody timeline requirements from checkout to return-to-service.
6. Added visual asset approval registry before real galleries.
7. Added public route publication registry before more sitemap pages.
8. Added public quote/contact intake shell on the website.
9. Added mobile offline conflict card preview.
10. Added Admin scorecard/progress rail registry.
11. Added public highest-value execution strip.
12. Added quote/contact intake responsive CSS.
13. Added mobile conflict preview responsive CSS.
14. Updated Admin directory safeLists for schema 146 views.
15. Updated Admin UI state, payload merge, element refs, and render calls for schema 146 views.
16. Updated full schema reference to schema 146.
17. Updated cache marker to 2026-06-13b.
18. Updated Markdown and schema-specific documentation.
19. Archived retired root helper Markdown and test files.
20. Added smoke checks for schema 146 public shell, Admin wiring, schema drift, and docs.

## Next 20 after schema 146

1. Build real Edge write action for payment apply.
2. Build payment reversal action with original action reference.
3. Build refund/write-off/overpayment action paths with approval reason and proof.
4. Build bank CSV parser and preview modal.
5. Add rejected-row correction and re-preview flow.
6. Add duplicate detection and staged import approval.
7. Build reconciliation match accept/reject buttons.
8. Build split payment UI and undo history.
9. Build reconciliation signoff and close-lock flow.
10. Add browser camera QR/barcode scan for equipment.
11. Add manual equipment code fallback with verifier reason.
12. Build custody timeline card for checkout/arrival/use/return/service.
13. Build Admin visual asset approval screen.
14. Build public route approval screen with title/meta/H1/proof checks.
15. Connect quote/contact intake form to Edge submit and DB lead rows.
16. Add spam/rate-limit/privacy acknowledgement to quote/contact intake.
17. Persist mobile offline conflict choices and local/server hashes.
18. Add Admin control-center scorecards above raw readiness tables.
19. Convert scorecard rails into drilldown links.
20. Add visual regression screenshots or CSS token tests for public polish.

## Schema 147 completed 20 — 2026-06-14a

1. Archived retired helper Markdown from the root.
2. Archived root `test_write` temporary files.
3. Created `docs/ACTIVE_PROJECT_HANDBOOK.md`.
4. Created `docs/NEXT_STEPS_AND_SANITY_CHECK.md`.
5. Added schema 147 Markdown consolidation registry.
6. Added schema 147 visual placeholder registry.
7. Added schema 147 competitive SEO enhancement queue.
8. Added schema 147 desktop/mobile polish queue.
9. Added schema 147 next-step sanity queue.
10. Added responsive public graphic-placeholder wall.
11. Added app-section visual placeholders for safety, jobs, equipment, and Admin areas.
12. Kept visual enrichment CSS-only to avoid broken/unapproved images.
13. Updated public cache marker to `2026-06-14a`.
14. Updated sitemap lastmod to 2026-06-14.
15. Preserved one-H1 public page discipline.
16. Preserved mobile quick navigation and desktop Admin shell.
17. Added Admin/API visibility hooks for schema 147 registries.
18. Updated docs README to point to the two main handoff files.
19. Added schema 147 doc.
20. Ran smoke and syntax checks after the pass.

## Next 20 after schema 147

1. Build real quote/contact submit Edge Function and DB write path.
2. Build payment application action write path with approval and reversal rules.
3. Build bank CSV preview screen with upload validation and rejected-row table.
4. Build reconciliation candidate matching, split, undo, and signoff actions.
5. Build equipment QR/barcode scan capture with manual fallback.
6. Build equipment custody timeline UI from checkout to return-to-service.
7. Create visual asset approval screen before adding real images.
8. Create public route approval screen before publishing more sitemap pages.
9. Add Admin scorecard/progress rail summary above readiness tables.
10. Add persistent runtime fallback event logging.
11. Add mobile offline conflict resolution storage and cards.
12. Add route-specific SEO smoke checks for title, meta, H1, internal link, CTA, and proof.
13. Add image placeholder-to-approved-image replacement workflow.
14. Add CSS overlap/visual regression smoke checks for the new placeholder sections.
15. Add accountant export packaging for unresolved payment/reconciliation exceptions.
16. Add month-end close lock/reopen proof controls.
17. Add HST/GST review and remittance proof screens.
18. Add payroll remittance proof/signoff screens.
19. Migrate remaining repeated JSON/catalog configuration into DB-backed registries.
20. Convert more passive schema queues into real Admin buttons with rollback/fallback.

---

## 2026-06-14b — Schema 148 Real Write-Action Layer

This pass shifts the app from readiness-only queues into real operational write paths.

Completed:

1. Added `sql/148_real_write_actions_quote_payment_bank_recon_equipment_assets_routes_mobile_scorecards.sql`.
2. Appended schema 148 to `sql/000_full_schema_reference.sql` and updated schema drift to expect 148.
3. Added public `quote_contact_requests` and `quote_contact_request_events` tables.
4. Added `quote-contact-submit` Edge Function with validation, spam scoring, and DB insert.
5. Converted the public quote/contact form from preview-only to live submit.
6. Added `YWIAPI.submitQuoteContact()`.
7. Added `operations-manage` Edge Function for authenticated write actions.
8. Added payment action request write target for apply/reverse/refund/write-off/overpayment workflows.
9. Added bank CSV preview tables for accepted/rejected/duplicate row review.
10. Added bank CSV preview parser helper in `js/api.js`.
11. Added reconciliation match/split/undo/signoff request table.
12. Added equipment manual/QR/barcode scan event table.
13. Added equipment custody timeline table from checkout/site/return/service stages.
14. Added visual asset approval item table before real galleries/images.
15. Added public route approval table before sitemap expansion.
16. Added mobile offline conflict card table.
17. Added Admin scorecard progress rail table.
18. Added Admin-readable views for schema 148 operational rows.
19. Added schema 148 safe-list loading in `admin-directory`.
20. Added `Schema 148 live action layer` public visual section with responsive CSS.

Next highest-value actions:

1. Add Admin UI button/form for payment action requests.
2. Add Admin UI bank CSV upload and preview screen.
3. Add accepted/rejected/duplicate row preview with import confirmation.
4. Add reconciliation match/split/undo/signoff UI connected to `operations-manage`.
5. Add mobile manual equipment scan card connected to `operations-manage`.
6. Add QR/barcode camera scan where browser support is available.
7. Add equipment custody timeline display on job/equipment pages.
8. Add visual asset approval screen with alt text, consent, compression, and route assignment.
9. Add public route approval screen with title/H1/meta/proof/CTA checks.
10. Add Admin scorecard dashboard cards using `v_admin_scorecard_progress_rails`.
11. Add email notification for new quote/contact request.
12. Add duplicate quote/contact suppression and follow-up owner assignment.
13. Add payment proof attachment references.
14. Add month-end lock checks before payment posting.
15. Add bank CSV import confirmation that promotes preview rows to reconciliation workbench.
16. Add accountant export inclusion for unresolved payment/reconciliation exceptions.
17. Add visual placeholder replacement only after asset approval.
18. Add sitemap generation from approved public routes only.
19. Add persistent runtime fallback events for failed write actions.
20. Add smoke checks for each new Edge Function deployment.

