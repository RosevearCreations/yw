# Database Structure

Last refreshed: **2026-05-30a**

Canonical schema reference: `sql/000_full_schema_reference.sql` through **schema 124**.

Latest migration: `sql/124_accounting_cost_payment_reconciliation_remittance_equipment_depth.sql`.

Schema 124 adds or extends these areas:

- `job_financial_events` for cost category, billable-charge status, linked equipment/signout, close period, posting status, and profitability notes.
- AR/AP payment application tables for credits, discounts, write-offs, overpayments, review status, reviewer, source reconciliation item, and payload metadata.
- `bank_reconciliation_items` for raw CSV/import context, suggested match, match score, manual review, reviewer, undo link, and notes.
- `sales_tax_filings` and `payroll_remittance_runs` for source totals, proof URL, signoff, filed/remitted references, and review steps.
- `accounting_period_closes` for AR/AP/GL/payroll/tax lock state, close checklist, package manifest, close signoff, and reopen reason.
- `accountant_handoff_exports` for package source period, exported file manifest, finalization, delivery reference, and delivery status.
- `equipment_items`, `equipment_signouts`, `equipment_accessory_checklists`, and `equipment_service_tasks` for QR/barcode tracking, accessory checks, verifier role, and failed-test follow-up.

New schema 124 views include:

- `v_job_cost_depth_directory`
- `v_payment_application_workbench_directory`
- `v_bank_reconciliation_review_workbench`
- `v_remittance_filing_review_workbench`
- `v_month_end_close_workbench`
- `v_equipment_accountability_workbench`
- `v_equipment_service_task_directory`

<!-- 2026-05-30a pass: schema 124 accounting depth, equipment accountability, SEO/H1/CSS/smoke, and roadmap refresh. -->
