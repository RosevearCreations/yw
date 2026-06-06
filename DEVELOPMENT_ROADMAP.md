# Development Roadmap

Build: **2026-06-05c**  
Schema: **133**

## Completed this pass

1. Added schema 133 migration.
2. Updated the canonical full schema reference to schema 133.
3. Added Admin-visible payment write-path queue.
4. Added Admin-visible reconciliation scoring rule queue.
5. Added Admin-visible equipment accessory template queue.
6. Added Admin-visible local SEO generation queue.
7. Added Admin-visible mobile offline conflict resolution queue.
8. Loaded schema 133 views through `admin-directory` with safe optional-view fallbacks.
9. Added Admin readiness table bindings for schema 133 queues.
10. Updated cache marker to `2026-06-05c`.
11. Updated smoke checks to expect schema 133.
12. Preserved one-H1 public page check.
13. Preserved Edge Function TypeScript parse checks.
14. Preserved CSS brace-balance check.
15. Preserved sitemap.xml and robots.txt baseline assets.
16. Retired active `test_write` files into archive.
17. Archived active Markdown snapshot.
18. Added schema 133 documentation.
19. Kept schema 128 roadmap-column compatibility repair in the full schema path.
20. Replaced completed/next-step lists for the next build pass.

## Next 20 steps

1. Create payment application base tables and Edge write action.
2. Create payment reversal, credit, refund, write-off, and overpayment actions.
3. Create bank CSV upload preview and staging write path.
4. Create reconciliation score rows and manual match/split/undo UI.
5. Create DB accessory template tables and editor.
6. Add BarcodeDetector camera scan with manual fallback and mismatch handling.
7. Enforce return-to-service proof and verifier role server-side.
8. Roll equipment service costs into job profitability.
9. Generate sitemap and robots from approved DB route registry.
10. Add JSON-LD, image-alt, broken-link, and local-proof smoke checks.
11. Add offline conflict resolution choices to mobile forms.
12. Create fallback drill result write UI.
13. Store runtime fallback telemetry counts.
14. Build HST/GST source totals, proof, filed, and remitted screens.
15. Build payroll remittance proof and signoff screens.
16. Build month-end close lock/reopen and accountant export delivery.
17. Promote repeated JSON route/action config into DB registries.
18. Add component drift and mobile overflow smoke checks.
19. Add SQL compatibility linter for roadmap/status column drift.
20. Keep all active Markdown, schema, cache, and smoke checks synchronized each pass.

## Direction

Keep every pass tied to working deployment guardrails: update SQL migrations, `sql/000_full_schema_reference.sql`, active Markdown, cache markers, Admin readiness views, CSS/H1 checks, and smoke checks together. Continue moving repeated JSON/checklist-style data into DB-backed registries when the data needs Admin visibility, sorting, review status, or future workflow actions.
