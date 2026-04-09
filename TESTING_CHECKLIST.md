## 2026-04-08 landscaping/construction/mobile/admin-ui pathway documentation pass
- Refreshed the Markdown set to move the product direction from schema-only groundwork into the next implementation phase: admin UI managers for estimates/work orders, materials/units, routes/service areas, subcontract dispatch, and AR/AP + chart of accounts.
- Added a clearer rationale for keeping HSE as a first-class standalone module that can later link to jobs, sites, and dispatches for landscaping, project, and subcontract work.
- Updated the docs to emphasize mobile-first field use, desktop-strong admin depth, DB-first shared data, and local SEO / one-H1 discipline on every public build pass.

> Last synchronized: April 8, 2026. Reviewed during the estimates/work-orders/routes/materials/subcontract/general-ledger foundation and documentation synchronization pass.

# Testing Checklist

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
