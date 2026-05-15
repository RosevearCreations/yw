# Accounting Close End-to-End Workflow

Last refreshed: **2026-05-15a**

## Current foundation

The database and Admin UI now support visibility for:

- accounting period close status;
- AR/AP payment applications;
- bank reconciliation sessions/items;
- reconciliation review queue;
- sales tax filing review;
- payroll remittance review;
- accountant handoff exports/packages;
- package delivery attention;
- schema status.

Schema 106 adds Command Center and Task Inbox visibility over these areas.

## Remaining close workflow

1. Select close period.
2. Confirm AR invoices and payments.
3. Confirm AP bills and payments.
4. Confirm payment applications.
5. Import bank statement.
6. Match/review reconciliation items.
7. Review generated journal lines.
8. Confirm tax filing support.
9. Confirm payroll remittance support.
10. Lock period sections.
11. Generate accountant handoff package.
12. Deliver/export package.
13. Mark package confirmed.
14. Close period.
15. Reopen only with reason and audit trail.

## Next build target

Create a dedicated Close Center wizard that uses the existing tables/views and the new task inbox to guide these steps in order.
