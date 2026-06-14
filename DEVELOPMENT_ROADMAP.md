# Development Roadmap

Build: **2026-06-13b**  
Schema: **146**

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
