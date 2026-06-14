# Development Roadmap

Build: **2026-06-13a**  
Schema: **145**

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
