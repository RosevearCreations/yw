<!-- Reviewed during 2026-05-06 accounting-close end-to-end workflow pass. -->

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

## Remaining gaps after schema 102
The accounting-close workflow is stronger, but still not final.

Still needed:
- invoice payment receipt UI and payment application screens
- vendor payment application UI and payment advice support
- fuller GL line generation rules from more source transaction types
- stronger reconciliation matching and manual-match review UX
- filing and remittance review approvals in the main admin/reports surface
- final accountant export packaging and delivery flow
- deeper period close lock/reopen controls

## Best next steps after schema 102
1. payment application UI for AR and AP
2. fuller journal-line automation and validation
3. stronger reconciliation matching and manual review workflow
4. filing/remittance review screens with approval controls
5. final accountant export packaging and delivery workflow
6. month-end close checklist and lock/reopen controls
