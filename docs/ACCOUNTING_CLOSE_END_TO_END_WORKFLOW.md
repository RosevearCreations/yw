# Accounting Close End-to-End Workflow

Last refreshed: **2026-05-10**

## Goal

Create a practical close workflow that an operator can follow monthly without needing to understand every raw accounting table.

## Target flow

1. Select accounting period.
2. Confirm period is open.
3. Review AR invoices and customer payments.
4. Apply payments to invoices.
5. Review AP bills and vendor payments.
6. Apply payments to bills.
7. Generate/post journal lines from approved source records.
8. Review unposted, unbalanced, or exception journal candidates.
9. Import or enter bank statement lines.
10. Auto-match bank items to payments/journals where possible.
11. Manually review unmatched/partial/exception matches.
12. Review sales tax filing support.
13. Review payroll remittance support.
14. Review trial balance and close dashboard.
15. Lock the period when ready.
16. Generate accountant handoff package.
17. Track package delivery and confirmation.
18. Reopen only with required reason/audit trail.

## Current status

Schemas 100–104 created much of the foundation. Schema 105 is a cleanup marker. The next build work should focus on UI polish and live verification, not just more tables.

## Required UI centers

- Accounting Close Center
- Payment Application screen
- Reconciliation screen
- Filing/Remittance review screen
- Accountant Export screen
- Close/Reopen controls

## Guardrails

- Do not post into a locked period.
- Require balanced journal entries.
- Keep every manual override auditable.
- Separate preparation, review, approval, filing/payment, and final close states.
- Make exports reviewable before delivery.

## Accountant caution

This app can prepare support records and export packages, but a qualified accountant should review tax filings, corporate filings, and year-end adjustments.
