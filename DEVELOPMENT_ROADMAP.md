# Development Roadmap

Last refreshed: **2026-05-30a**

## Completed in this pass

1. Added schema **124** and app schema marker for accounting depth and equipment accountability.
2. Added job-cost depth columns for repair, delay, equipment usage, replacement, fuel, disposal, material, subcontract, write-off, and billable-charge status tracking.
3. Added the `v_job_cost_depth_directory` view so job profitability can show known revenue, known cost, equipment cost, fuel/disposal cost, material/subcontract cost, and open financial events.
4. Added AR/AP payment application depth fields for credits, discounts, write-offs, overpayments, review status, review signoff, reconciliation source, and payload metadata.
5. Added the `v_payment_application_workbench_directory` view for payment application review.
6. Added bank reconciliation review depth fields for raw CSV import row, suggested match table/id/score/reason, manual review status, reviewer, undo chain, and notes.
7. Added the `v_bank_reconciliation_review_workbench` view for reconciliation review.
8. Added HST/GST filing review depth fields for source totals, adjustment notes, proof URL, signoff, filed reference, and review step.
9. Added payroll remittance review depth fields for source totals, adjustment notes, proof URL, signoff, filing/remittance reference, and review step.
10. Added the `v_remittance_filing_review_workbench` view for HST/GST and payroll review.
11. Added month-end close lock/reopen fields for AR/AP/GL/payroll/tax locks, close checklist, package manifest, reopen reason, and accountant package reference.
12. Added the `v_month_end_close_workbench` view for period close/reopen review.
13. Added accountant export package depth fields for source close, exported file manifest, delivery reference, finalized/delivered signoff, and delivery status.
14. Added equipment QR code, barcode, required verifier role, and accessory checklist requirement fields.
15. Added `equipment_accessory_checklists` and equipment signout accessory checklist/status fields for checkout, arrival, and return.
16. Added `equipment_service_tasks` so failed arrival/return tests or damaged returns can create follow-up service tasks.
17. Added the `v_equipment_accountability_workbench` and `v_equipment_service_task_directory` views.
18. Updated `jobs-directory`, `jobs-manage`, and `admin-manage` for the new accounting/equipment depth rows and review actions.
19. Updated `js/jobs-ui.js` with Accounting Depth Workbench tables, review buttons, QR/barcode fields, accessory checklist fields, equipment accountability rows, and service-task rows.
20. Updated canonical schema, cache marker, smoke checks, Markdown, and sanity checks for the schema 124 pass.

## Next logical 20 steps

1. Live-test schema **124** on Supabase and confirm all columns, constraints, and views deploy cleanly on production data.
2. Add per-row action buttons to the Accounting Depth Workbench instead of using the first pending row.
3. Add a full payment application editor with invoice/bill lookup, payment lookup, credit/discount/write-off fields, and validation preview.
4. Add CSV bank import preview with duplicate detection before records enter reconciliation review.
5. Add reconciliation match suggestions that compare amount, date, invoice/payment number, party name, and memo text.
6. Add reconciliation undo history display so manual corrections are clearly reversible.
7. Add HST/GST source-total drilldown rows from invoices, payments, sales-tax codes, and adjustments.
8. Add payroll remittance source-total drilldown rows from time entries, payroll exports, employer costs, and deductions.
9. Add a month-end close checklist wizard with required blockers and signoff steps.
10. Add accountant export packaging that builds CSV/JSON/Markdown manifests from close, AR, AP, GL, payroll, tax, and reconciliation rows.
11. Add QR/barcode scan lookup on mobile so equipment can be loaded by camera or typed scan value.
12. Add accessory checklist templates per equipment category/pool.
13. Add required verifier-role enforcement for arrival and return verification.
14. Add service-task assignment, due dates, status changes, and completion signoff.
15. Add automatic job financial events from failed equipment return tests, repair estimates, or replacement decisions.
16. Add equipment chargeback rules so repair/replacement/delay costs can be billable, waived, or internal.
17. Add public SEO smoke checks for sitemap, robots, title, H1, meta description, alt text, structured data, and local wording.
18. Add local service-area proof fields so public location pages only mention places the business truly serves.
19. Split `js/jobs-ui.js` into smaller modules for jobs, commercial/accounting, equipment, evidence, and shared helpers.
20. Add a release comparison report that summarizes schema/docs/code changes per build.

## Following 20 steps after that

1. Build a true mobile worker task inbox with Today, overdue, drafts, pending-sync, and equipment-return tabs.
2. Add route/job start checklist shortcuts with large tap targets.
3. Add weather/context cards on the Today dashboard where they support safety decisions.
4. Add mobile signature-capture review improvements.
5. Add accessibility checks for touch target size, contrast, labels, and keyboard focus.
6. Add server-side page/sort/filter preferences per Admin user.
7. Normalize job/equipment/accounting statuses into lookup tables and migrate legacy status variants.
8. Add undo-safe job and equipment action history.
9. Add payroll close blockers to the Guided Close Center.
10. Add tax filing preview/signoff screens with export proof upload.
11. Add accountant handoff package delivery history.
12. Add evidence attachment counts and source previews to Admin row cards.
13. Add customer-facing service FAQs with one-H1 checks.
14. Add local review/testimonial proof blocks for public location pages.
15. Add image completeness scoring for public gallery/service images.
16. Add staging-vs-production schema drift comparison notes.
17. Add per-role onboarding checklists for phone users.
18. Add app install analytics events for installed vs browser sessions.
19. Add module-level JS splitting for Today, Admin, Jobs, Reports, and Safety Ops.
20. Add release snapshots that show schema, docs, and code changes per build.

<!-- 2026-05-30a pass: schema 124 accounting depth, equipment accountability, SEO/H1/CSS/smoke, and roadmap refresh. -->
