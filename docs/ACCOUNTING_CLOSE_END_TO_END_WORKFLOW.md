<!-- Reviewed during 2026-05-09 accounting-close admin UI control pass. -->

# Accounting Close End-to-End Workflow

## Scope added in schema 102
This pass closes more of the gap between Jobs/commercial posting markers and a real accounting close workflow.

Main additions:
- AR payment application records and invoice balance recompute
- AP payment application records and bill balance recompute
- generated GL journal-line directory from journal candidate ledger summaries
- scored bank reconciliation match suggestions
- sales tax filing review flow
- payroll remittance review flow
- richer accountant handoff package structure and package directory
- payment application dashboard rollup

## Main new objects
- `ar_payment_applications`
- `ap_payment_applications`
- `v_ar_payment_application_directory`
- `v_ap_payment_application_directory`
- `v_gl_journal_generated_line_directory`
- `v_bank_reconciliation_match_scored_directory`
- `v_sales_tax_filing_review_directory`
- `v_payroll_remittance_review_directory`
- `v_accountant_handoff_package_directory`
- `v_accounting_payment_application_dashboard`

## What this now supports
1. applying customer payments against AR invoices
2. applying vendor payments against AP bills
3. recomputing invoice/bill balances after applications
4. recomputing payment unapplied balances and status
5. generating draft GL journal lines from candidate ledger summaries
6. scoring reconciliation match candidates instead of leaving them flat
7. moving sales tax filings through draft, prepared, reviewed, approved, filed, and paid
8. moving payroll remittances through draft, prepared, reviewed, approved, and remitted
9. building a more complete accountant handoff package from accounting-close datasets

## Remaining gaps originally identified after schema 102
The accounting-close workflow became stronger in schema 102, but was not final before the schema 103 Admin-control pass.

Still needed:
- invoice payment receipt UI and payment application screens
- vendor payment application UI and payment advice support
- fuller GL line generation rules from more source transaction types
- stronger reconciliation matching and manual-match review UX
- filing and remittance review approvals in the main admin/reports surface
- final accountant export packaging and delivery flow
- deeper period close lock/reopen controls

## Best next steps identified before schema 103
1. payment application UI for AR and AP
2. fuller journal-line automation and validation
3. stronger reconciliation matching and manual review workflow
4. filing/remittance review screens with approval controls
5. final accountant export packaging and delivery workflow
6. month-end close checklist and lock/reopen controls

## 2026-05-09 schema 103 + Admin UI control pass
- Added migration `sql/103_accounting_close_admin_ui_controls.sql` and appended it to `sql/000_full_schema_reference.sql`.
- Added admin-facing close/reopen audit fields, accountant handoff delivery status fields, and three review views: `v_accounting_close_admin_control_dashboard`, `v_accounting_reconciliation_manual_review_queue`, and `v_accounting_close_package_delivery_queue`.
- Exposed the schema-102 accounting-close workflow objects in the Admin Backbone manager: bank accounts, period close controls, sales-tax filings, payroll remittance runs, bank statement imports, reconciliation sessions/items, AR/AP payment applications, and accountant handoff packages.
- Extended `admin-manage` so sales-tax filings now advance through prepare, review, approve, file, and pay actions, matching the review statuses added in schema 102.
- Fixed the `admin-selectors` `admin_core` scope bug where selector rows were referenced before they were declared.
- Removed copied insight code from upload/bind handlers that could reference `cards` outside the insight renderer.

### Remaining follow-up after schema 103
- Expand generated GL journal-line automation beyond the current candidate ledger sources.
- Add true statement-file parsing/import mapping instead of manual statement import rows only.
- Add stricter period-lock enforcement across every AR/AP/GL/tax/payroll mutation.
- Add final accountant delivery integrations if email/provider delivery is required instead of manual/download delivery.
