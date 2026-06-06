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
