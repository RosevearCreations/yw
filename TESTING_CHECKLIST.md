> Last synchronized: April 11, 2026 (HSE upload retry, safety screens, and analytics/traffic monitoring pass)

## Add these tests for the 069 pass
- Create a standalone HSE packet and an unscheduled-project packet; confirm packet scope and status behave correctly.
- Add weather, heat, chemical, traffic, signoff, closeout, and reopen events; confirm packet progress rolls up correctly.
- Confirm field-signoff timestamps and signer fields populate when signoff is completed.
- Force a failed live admin load and confirm the cached admin fallback view appears with a clear warning.

## 2026-04-11 journal sync exceptions and upload fallback pass
- Added migration `sql/068_journal_sync_exceptions_and_upload_failure_fallback.sql`.
- Added DB-backed `gl_journal_sync_exceptions` so stale, unbalanced, and missing-entry source batches are visible as first-class review items instead of hidden batch-state guesses.
- Added DB-backed `field_upload_failures` so failed job-comment and equipment-evidence uploads leave an auditable fallback trail for retry/resolution instead of failing silently.
- Extended Admin selectors/directory/manage/UI so sync exceptions and upload failures can be reviewed, resolved, or dismissed from the same backbone shell.
- Tightened job activity upload handling so comments can still save even when attachments fail, with clearer operator feedback and follow-up visibility.


## 2026-04-10 journal posting controls and material issue / usage pass
- Added migration `sql/066_journal_posting_controls_and_material_issue_usage.sql`.
- Added DB-side journal-batch rollups so line count, debit total, credit total, and balanced state are derived instead of tracked manually.
- Added DB-backed `material_issues` and `material_issue_lines` so receiving can progress into job usage, issued-cost totals, and variance visibility.
- Extended the Admin backbone so journal batches, journal entries, material issues, and material issue lines can be created and managed from the same operational shell.
- Continued the DB-first direction for shared operational data while keeping the next highest-value gaps visible: route execution lifecycle, HSE proof/reopen, and stronger source-to-journal automation.

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

## April 10, 2026 testing expansion
- Create a receipt with mixed allocated and unallocated lines and confirm Admin shows the split correctly.
- Confirm work orders show receipt count, received material cost, and unallocated receipt cost after receipt edits.
- Confirm AR/AP records show posted amount, open amount, and posted percent after payment edits.
- Confirm smart defaults populate from selected materials, equipment, work-order lines, invoices, bills, and linked work orders/dispatches.

## April 9, 2026 testing expansion
- Add admin tests for route stops, estimate/work-order lines, AR/AP payment posting, material receiving, and linked HSE packet CRUD.
- Add phone-sized viewport checks for all new admin-manager forms.


Last synchronized: April 11, 2026 (journal sync exceptions / upload fallback pass)

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

## 2026-04-10 crew assignment, recurring jobs, and field activity pass
- Job creation now has a clearer ownership path: a crew can be assigned at the same time as an explicit supervisor so responsibility is visible from the start.
- Jobs now support standalone or recurring scheduling fields, with recurrence summary/rule storage in the database instead of leaving schedule logic only in draft UI state.
- Job comments now have a DB-backed activity trail with optional photo attachments and special-instruction flags so crews and supervisors can review site notes, uploaded images, and field changes in one place.
- This pass continues the DB-first direction for shared operational data and reduces duplication risk compared with keeping crew/job packet details only in local JSON or loosely coupled browser state.
- New testing priority: verify crew assignment + supervisor ownership on create/edit, comment/photo upload/delete flows, and recurring schedule persistence across reloads.


## Add these tests for the 066 pass
- Journal entry create/update/delete changes batch line count, debit total, credit total, and balanced state.
- Posting a balanced journal batch succeeds and an unbalanced batch is blocked with a clear error.
- Material issue line create/update/delete changes issue quantity total, issue total, and variance amount.
- Material issue lines inherit defaults correctly from selected materials and work-order lines.

## 2026-04-10 source-generated journals, route execution, and HSE proof pass
- Added migration `sql/067_source_journal_route_execution_and_hse_proof.sql`.
- Added source-generated draft journal batches for AR invoices, AP bills, material receipts, and material issues so review/posting can start from the originating record instead of manual batch creation.
- Added route-stop execution lifecycle records plus attachment rows so daily field work can track completed, skipped, delayed, and exception states with note/photo support.
- Added HSE proof rows plus reopen-aware linked packet fields so closeout evidence, reopen counts, and follow-up exceptions are visible in the Admin backbone.
- Continued the DB-first move for shared operational/accounting data and refreshed the docs so roadmap, risks, testing, and deployment all point to the same next state.
