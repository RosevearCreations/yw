# Development Roadmap

Last refreshed: **2026-06-01a**

## Completed in this pass

1. Repaired `supabase/functions/jobs-manage/index.ts` so `normalizeJsonArray` uses an escaped newline regexp: `split(/[\n,]/)`.
2. Added TypeScript parser diagnostics to `scripts/repo-smoke-check.mjs` for all Supabase Edge Function `index.ts` files.
3. Added a specific smoke check to block literal-newline regexp split patterns before Supabase bundling.
4. Fixed `supabase/functions/jobs-directory/index.ts` so each job comment attachment is pushed only once.
5. Added schema **125** with deployment bundle, public SEO/local wording, and runtime fallback guardrail tables.
6. Added `v_app_deployment_bundle_checks` for deploy-readiness rows such as Edge Function parse checks and schema marker checks.
7. Added `v_app_public_seo_checks` for one-H1, local wording, title/meta, and cache-version review rows.
8. Added `v_app_runtime_fallback_checks` for safe-select, optional schema, and service-worker fallback checks.
9. Updated `v_schema_drift_status` so the expected live database schema is now **125**.
10. Added schema 125 operational-depth gates for Edge Function parse checks, `jobs-manage` regex repair, SEO/local wording, and fallback behaviour.
11. Updated `sql/000_full_schema_reference.sql` so the canonical schema reference includes schema 125.
12. Improved `server-worker.js` so the app shell caches assets one by one with fallback instead of failing the entire install when one static file is stale.
13. Updated the public asset/cache marker to **2026-06-01a** in `index.html` and `server-worker.js`.
14. Archived active Markdown snapshots for this pass and created legacy README placeholders expected by smoke checks.
15. Retired older root Markdown files into `archive/retired-root-markdown-2026-06-01a/`.
16. Removed temporary `test_write` files from the active root.
17. Updated active Markdown files for schema 125 and the deployment repair pass.
18. Added `docs/DEPLOYMENT_BUNDLE_PARSE_SEO_FALLBACK_GUARDRAILS_SCHEMA125.md`.
19. Kept the one-H1 public shell check active.
20. Re-ran smoke checks, JavaScript syntax checks, CSS brace checks, and Edge Function parse checks before packaging.

## Next logical 20 steps

1. Apply schema **125** on Supabase and confirm `v_schema_drift_status` reports current.
2. Redeploy `jobs-manage` and confirm the previous unterminated-regexp bundle error is gone.
3. Redeploy `jobs-directory` and confirm job comment attachments no longer duplicate.
4. Add an Admin deployment-readiness panel that displays `v_app_deployment_bundle_checks`, `v_app_public_seo_checks`, and `v_app_runtime_fallback_checks`.
5. Add live deploy result fields so each Edge Function can show last deployed time, status, and failure note.
6. Add a public SEO smoke pass for sitemap, robots, title, meta description, one H1, structured data, local wording, image alt text, and broken public links.
7. Add cache/schema mismatch banners when a browser is running older assets against newer database schema.
8. Add a full payment application editor with invoice/bill lookup, deposit lookup, credit, discount, write-off, overpayment, refund, and reversal validation.
9. Add bank CSV import preview with duplicate detection before reconciliation rows are created.
10. Add reconciliation match scoring using amount, date, party, memo, invoice/payment number, and confidence reason.
11. Add reconciliation undo history display and manual correction comments.
12. Add HST/GST source-total drilldowns from invoices, sales-tax codes, payment applications, and adjustments.
13. Add payroll remittance source-total drilldowns from time entries, payroll exports, employer costs, deductions, and adjustments.
14. Add a month-end close wizard with blocker checks, step signoffs, lock, reopen, and accountant package creation.
15. Add accountant export package builder that generates CSV/JSON/Markdown manifest entries from AR, AP, GL, payroll, tax, and reconciliation rows.
16. Add mobile QR/barcode equipment scan lookup with typed fallback.
17. Add accessory checklist templates per equipment category/pool and missing-accessory exception rows.
18. Enforce verifier-role rules before equipment arrival and final return signoff.
19. Add service-task assignment, due dates, status changes, completion proof, and return-to-service signoff.
20. Split `js/jobs-ui.js` into smaller modules for jobs, accounting, equipment, evidence, and shared helpers.

## Following 20 steps after that

1. Build a true mobile worker task inbox with Today, overdue, drafts, pending-sync, equipment-return, and accounting-review tabs.
2. Add route/job start checklist shortcuts with large tap targets.
3. Add weather/context cards only where they support safety or scheduling decisions.
4. Add mobile signature-capture review improvements.
5. Add accessibility checks for touch targets, contrast, labels, reduced motion, and keyboard focus.
6. Add server-side page/sort/filter preferences per Admin user.
7. Normalize job, equipment, accounting, and reconciliation statuses into lookup tables.
8. Add undo-safe job and equipment action history.
9. Add payroll close blockers to the Guided Close Center.
10. Add tax filing preview/signoff screens with export proof upload.
11. Add accountant handoff package delivery history and resend notes.
12. Add evidence attachment counts and previews to Admin row cards.
13. Add customer-facing service FAQs with one-H1 checks.
14. Add local review/testimonial proof blocks for public location pages.
15. Add image completeness scoring for public gallery/service images.
16. Add staging-vs-production schema drift comparison notes.
17. Add per-role onboarding checklists for phone users.
18. Add app install analytics events for installed vs browser sessions.
19. Add module-level JS splitting for Today, Admin, Jobs, Reports, and Safety Ops.
20. Add release snapshots that show schema, docs, and code changes per build.

<!-- 2026-06-01a pass: schema 125 deployment bundle parse repair, SEO/local checks, fallback guardrails, jobs-manage fix, jobs-directory attachment dedupe, cache marker, and roadmap refresh. -->
