# Development Roadmap

Build: **2026-06-05a**  
Schema: **131**

## Completed this pass

1. Added schema 131 execution-control migration.
2. Updated canonical full schema reference to schema 131.
3. Added DB-visible payment UI validation queue.
4. Added DB-visible reconciliation import validation queue.
5. Added DB-visible equipment service closeout queue.
6. Added DB-visible SEO asset publication queue.
7. Added DB-visible runtime recovery telemetry queue.
8. Loaded schema 131 views through `admin-directory` with safe optional-view fallbacks.
9. Added Admin readiness table bindings for schema 131 queues.
10. Updated cache marker to `2026-06-05a`.
11. Updated smoke checks to expect schema 131.
12. Preserved one-H1 public page check.
13. Preserved Edge Function parse checks.
14. Preserved CSS brace-balance check.
15. Restored missing legacy Markdown archive snapshots.
16. Retired active `test_write` files into archive.
17. Updated active root Markdown files.
18. Added schema 131 documentation.
19. Kept schema 128 compatibility repair in the full schema path.
20. Replaced completed/next-step lists for the next build pass.

## Next 20 steps

1. Build the real Apply Payment form and staged save action.
2. Add payment reversal and adjustment actions with proof gates.
3. Create bank CSV preview/import staging screen.
4. Create match scoring and manual match/split/undo controls.
5. Add camera scan using BarcodeDetector with manual fallback.
6. Create accessory template tables and editor.
7. Enforce verifier roles server-side for return-to-service.
8. Build equipment service closeout screen with proof and costs.
9. Generate sitemap.xml and robots.txt from approved public routes.
10. Add broken-link, image-alt, and JSON-LD validation to smoke checks.
11. Build HST/GST source totals and proof review UI.
12. Build payroll remittance source totals and proof UI.
13. Build month-end lock/reopen and accountant export package.
14. Add offline conflict resolution choices to forms.
15. Store fallback drill run history and pass/fail notes.
16. Add runtime recovery telemetry summary cards.
17. Promote repeated route/SEO/action JSON data into DB-backed registries.
18. Add CSS component drift snapshot and mobile overflow check.
19. Add schema deploy order and function redeploy checklist for schema 131+.
20. Keep all active Markdown and schema references synced each pass.

## Direction

Keep every pass tied to working deployment guardrails: update SQL migrations, `sql/000_full_schema_reference.sql`, active Markdown, cache markers, Admin readiness views, CSS/H1 checks, and smoke checks together. Continue moving repeated JSON/checklist-style data into DB-backed registries when the data needs Admin visibility, sorting, review status, or future workflow actions.
