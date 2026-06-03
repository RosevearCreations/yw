# Development Roadmap

Last refreshed: **2026-06-02a**

## Completed in this pass

1. Created Markdown archive snapshots for the current pass and legacy smoke expectations.
2. Retired temporary `test_write` files from the active root into `archive/retired-test-files-2026-06-02a/`.
3. Added schema **126**: `126_roadmap_depth_data_migration_seo_css_fallback_guardrails.sql`.
4. Updated `sql/000_full_schema_reference.sql` so the canonical schema reference is aligned through schema 126.
5. Updated `v_schema_drift_status` to expect schema **126**.
6. Added `app_roadmap_action_steps` and `v_app_roadmap_action_steps` to track completed work and the next 20 steps in the database.
7. Added `app_depth_review_queue` and `v_app_depth_review_queue` for accounting, equipment, SEO, CSS, mobile, and fallback depth gaps.
8. Added `app_data_migration_candidates` and `v_app_data_migration_candidates` for JSON/DB duplication and source-of-truth review.
9. Added `app_schema_documentation_sync_checks` and `v_app_schema_documentation_sync_checks` so schema/docs/cache/smoke sync is DB-visible.
10. Updated `admin-directory` to load schema 126 and schema 126 guardrail views on the `command_center` and `health` scopes.
11. Updated `admin-ui` to show build guardrails, SEO guardrails, runtime fallback rows, roadmap rows, depth review rows, data migration rows, and schema/doc sync rows.
12. Updated the public cache marker from **2026-06-02a** to **2026-06-02a** in `index.html` and `server-worker.js`.
13. Kept Edge Function TypeScript parse checks active in `scripts/repo-smoke-check.mjs`.
14. Added a CSS brace-balance smoke check to reduce CSS drift mistakes.
15. Kept the one-H1 public shell guard active.
16. Refreshed SEO/local wording guidance around truthful local coverage, one clear main heading, and plain search terms in titles/headings/body copy.
17. Carried accounting depth gaps forward as DB-visible review rows.
18. Carried equipment scan/signoff/accessory/verifier gaps forward as DB-visible review rows.
19. Updated active Markdown files for build **2026-06-02a / schema 126**.
20. Updated smoke checks so stale schema/cache/docs/admin-readiness packages fail before packaging.

## Next 20 steps

1. Build the full payment application screen for invoices, deposits, credits, discounts, write-offs, overpayments, refunds, and reversals.
2. Add bank CSV preview with header validation, duplicate detection, bad date checks, and amount sign review.
3. Add reconciliation manual match, split match, unmatch/undo, review notes, and reviewer signoff.
4. Add HST/GST filing review with source totals, adjustments, proof upload, filed date, remitted date, and lock status.
5. Add payroll remittance review/signoff with source pay runs, proof, payment date, and close-period link.
6. Finish month-end close lock/reopen controls and posting blocks for closed periods.
7. Finish accountant export packaging with manifest, CSV/JSON/Markdown summaries, proof files, and delivery status.
8. Add QR/barcode scan flow for equipment checkout, arrival verification, return receipt, and final return verification.
9. Add reusable accessory checklist templates per equipment category/pool.
10. Tighten verifier permissions for final returns, defect clearing, and return-to-service signoff.
11. Convert failed equipment arrival/return tests into service work orders with assignment, due date, cost, and completion proof.
12. Link repair, delay, equipment usage, replacement, fuel, disposal, material, and subcontractor costs into job profitability rollups.
13. Tighten quote acceptance to invoice candidate flow so accepted terms carry forward without retyping.
14. Add a public route SEO registry for title, H1, meta, local terms, image alt, proof level, and status.
15. Add internal-link suggestion queue between service, location, proof, gallery, and contact pages.
16. Add phone-first scan/proof buttons to the Today dashboard.
17. Improve offline conflict labels and retry/keep/discard messages.
18. Introduce a small CSS component token inventory to slow one-off CSS drift.
19. Auto-seed schema preflight rows for new migrations.
20. Create a live Supabase deployment smoke runbook for users who cannot run Node locally.

## Following 20 steps after that

1. Turn the Admin readiness views into compact mobile cards.
2. Add per-role checklist cards for supervisors, HSE, accounting, and Admin users.
3. Add visual proof previews to equipment return exceptions.
4. Add receipt/photo/proof counts to accounting close rows.
5. Add route-level public SEO proof snapshots.
6. Add location/service wording review before publishing public pages.
7. Add image-alt completeness checks to the smoke script.
8. Add sitemap/robots/public-link smoke checks.
9. Add local testimonial/recent-work proof blocks only where real proof exists.
10. Add mobile accessibility checks for tap targets, labels, and contrast.
11. Split `js/jobs-ui.js` into smaller jobs/accounting/equipment/evidence modules.
12. Split Admin readiness rendering into a smaller module.
13. Add exportable support snapshots for deployment failures.
14. Add live function deploy status rows when deployment logs are available.
15. Add schema-vs-function compatibility checks before redeploying Edge Functions.
16. Add backup/restore rehearsal evidence upload.
17. Add seeded demo data for safe accounting/equipment workflow testing.
18. Add customer-facing FAQ route checks if public pages expand.
19. Add browser cache mismatch banners when old assets meet newer schema.
20. Add release manifest files that summarize schema, docs, code, and smoke results per build.

<!-- 2026-06-02a pass: schema 126 roadmap depth, data migration candidates, SEO/CSS/fallback guardrails, Admin readiness visibility, archive hygiene, cache marker, and Markdown refresh. -->
