# Development Roadmap

Last refreshed: **2026-06-04b**

## Completed in this pass

1. Added schema 130 execution playbooks
2. Added payment execution queue
3. Added reconciliation execution queue
4. Added equipment scan/template execution queue
5. Added local SEO execution queue
6. Added fallback drill queue
7. Loaded schema 130 views in admin-directory
8. Rendered schema 130 tables in Admin UI
9. Updated active Markdown files to schema 130
10. Added schema 130 documentation
11. Updated canonical full schema through schema 130
12. Updated smoke checks for schema 130
13. Updated static/cache marker to 2026-06-04b
14. Verified one public H1 remains in index
15. Verified CSS brace balance
16. Verified Edge Function TypeScript parse checks
17. Restored 2026-05-29a Markdown archive snapshot
18. Retired active test_write files
19. Replaced completed/next 20 Markdown lists
20. Updated Known Issues and Gaps

## Next 20 steps

1. Build real payment application form and buttons
2. Create payment proof package generator
3. Build bank CSV preview importer
4. Build reconciliation match/split/undo/signoff UI
5. Add match confidence scoring
6. Build HST/GST review package screen
7. Build payroll remittance review screen
8. Build month-end close lock/reopen controls
9. Generate accountant export package files
10. Implement camera BarcodeDetector scan
11. Add accessory template DB tables
12. Enforce verifier roles server-side
13. Turn failed tests into assignable service work orders
14. Add return-to-service proof upload
15. Generate sitemap.xml and robots.txt
16. Add broken-link and broken-asset smoke checks
17. Add JSON-LD validation queue
18. Add image alt/local proof scoring
19. Add offline conflict resolution UI
20. Add fallback drill run history

## Direction

Keep every pass tied to working deployment guardrails: update SQL migrations, `sql/000_full_schema_reference.sql`, active Markdown, cache markers, Admin readiness views, CSS/H1 checks, and smoke checks together. Continue moving repeated JSON/checklist-style data into DB-backed registries when the data needs Admin visibility, sorting, review status, or future workflow actions.
