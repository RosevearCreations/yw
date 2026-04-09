> Last synchronized: April 9, 2026. Reviewed during the workflow rollups, payment posting, receiving-to-costing, and HSE packet closeout pass.

## 2026-04-09 workflow rollups, posting, receiving-costing, and HSE closeout pass

## Add these tests for the 063 pass
- Estimate line create/update/delete changes estimate subtotal, total, cost, and margin.
- Work-order line create/update/delete changes work-order subtotal, total, cost, and margin.
- Material receipt line create/update/delete changes receipt total and linked work-order received-cost totals.
- AR payment create/update/delete changes invoice amount-paid, balance-due, and partial/paid status.
- AP payment create/update/delete changes bill amount-paid, balance-due, and partial/paid status.
- Linked HSE packet checklist toggles change derived progress and ready-for-closeout / closed state.

- Added DB-first workflow logic so estimate, work-order, and material-receipt header totals can roll up from their line records instead of depending on manual entry.
- Added receivables/payables payment-application logic so invoices and bills can track paid amounts, remaining balance, and partial/paid status from posted payments.
- Added receiving-to-costing linkage so material receipt lines can feed received quantity / received cost visibility back into work-order execution.
- Extended linked HSE packets toward real progress and closeout handling with checklist-style completion fields, derived progress, and clearer Admin-side visibility.


## 2026-04-08 landscaping/construction/mobile/admin-ui pathway documentation pass
- Refreshed the Markdown set to move the product direction from schema-only groundwork into the next implementation phase: admin UI managers for estimates/work orders, materials/units, routes/service areas, subcontract dispatch, and AR/AP + chart of accounts.
- Added a clearer rationale for keeping HSE as a first-class standalone module that can later link to jobs, sites, and dispatches for landscaping, project, and subcontract work.
- Updated the docs to emphasize mobile-first field use, desktop-strong admin depth, DB-first shared data, and local SEO / one-H1 discipline on every public build pass.

> Last synchronized: April 8, 2026. Reviewed during the estimates/work-orders/routes/materials/subcontract/general-ledger foundation and documentation synchronization pass.

# Testing Checklist

## April 9, 2026 testing expansion
- Add admin tests for route stops, estimate/work-order lines, AR/AP payment posting, material receiving, and linked HSE packet CRUD.
- Add phone-sized viewport checks for all new admin-manager forms.


Last synchronized: April 8, 2026

## Session integrity tests
- sign in as Admin
- navigate across random screens
- confirm header identity remains Admin
- confirm Settings remains the same user
- sign out repeatedly from different screens
- confirm logout always works
- confirm no partial profile from another user appears

## Role tests
- Admin access to staff/dropdowns/equipment/jobs
- Supervisor scoped access
- Employee limited access
- legacy worker records still resolve safely

## HSE tests
- toolbox
- PPE
- first aid
- inspection
- emergency drill
- logbook/review-list
- standalone usage without full operations record

## Admin backbone tests
- staff create/edit/block/reset
- dropdown create/edit/delete
- equipment listing load/edit
- jobs/work orders load/edit
- assignments create/edit/delete

## Mobile tests
- phone-size layout
- touch target sizing
- save feedback visibility
- form scrolling
- empty states and validation clarity

## Next-wave testing priorities
- estimate/work-order create/edit/approve flows
- materials + unit CRUD and dropdown population
- route/service-area creation and stop ordering
- subcontract dispatch creation, operator/equipment pairing, and billing basis
- AR/AP record creation and chart-of-accounts mapping
- standalone HSE record creation and later linking into work orders/dispatches
- mobile field-use validation on phone-sized screens