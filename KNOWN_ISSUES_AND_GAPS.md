> Last synchronized: April 10, 2026. Reviewed during the journal posting controls, material issue / usage, Admin backbone, and schema synchronization pass.

## 2026-04-10 journal posting controls and material issue / usage pass
- Added migration `sql/066_journal_posting_controls_and_material_issue_usage.sql`.
- Added DB-side journal-batch rollups so line count, debit total, credit total, and balanced state are derived instead of tracked manually.
- Added DB-backed `material_issues` and `material_issue_lines` so receiving can progress into job usage, issued-cost totals, and variance visibility.
- Extended the Admin backbone so journal batches, journal entries, material issues, and material issue lines can be created and managed from the same operational shell.
- Continued the DB-first direction for shared operational data while keeping the next highest-value gaps visible: route execution lifecycle, HSE proof/reopen, and stronger source-to-journal automation.

## 2026-04-09 workflow rollups, posting, receiving-costing, and HSE closeout pass

## What moved forward in this pass
- manual header totals are no longer the only model for estimates, work orders, and receipts
- AR/AP records now have a stronger balance-driven direction
- HSE packets are moving from a simple link record toward a real progress/closeout packet

## Highest-value remaining gaps now
- GL posting remains incomplete even though AR/AP balance rollups are stronger
- inventory movement is still partial because receipt-to-on-hand / issue / usage is not yet complete
- route-stop execution and crew-day flow are still lighter than the costing/accounting side
- HSE packets still need attachments, proof capture, and richer closeout evidence

- Added DB-first workflow logic so estimate, work-order, and material-receipt header totals can roll up from their line records instead of depending on manual entry.
- Added receivables/payables payment-application logic so invoices and bills can track paid amounts, remaining balance, and partial/paid status from posted payments.
- Added receiving-to-costing linkage so material receipt lines can feed received quantity / received cost visibility back into work-order execution.
- Extended linked HSE packets toward real progress and closeout handling with checklist-style completion fields, derived progress, and clearer Admin-side visibility.


## 2026-04-08 landscaping/construction/mobile/admin-ui pathway documentation pass
- Refreshed the Markdown set to move the product direction from schema-only groundwork into the next implementation phase: admin UI managers for estimates/work orders, materials/units, routes/service areas, subcontract dispatch, and AR/AP + chart of accounts.
- Added a clearer rationale for keeping HSE as a first-class standalone module that can later link to jobs, sites, and dispatches for landscaping, project, and subcontract work.
- Updated the docs to emphasize mobile-first field use, desktop-strong admin depth, DB-first shared data, and local SEO / one-H1 discipline on every public build pass.

## 2026-04-07 estimates/work-orders/routes/materials/subcontract/GL foundation pass
- Added schema foundation migration `061_estimates_work_orders_routes_materials_and_gl_foundation.sql` so the repo now has concrete tables for the operations/accounting direction that had previously been only in roadmap notes.
- With the current build reported as stable, the biggest remaining risks shift from shell repair toward implementation depth, validation quality, and operational/accounting convergence.

# Known Issues and Gaps

## April 10, 2026 issue/gap refresh
- The schema snapshot gap is now corrected: the full reference file includes the newer workflow migrations instead of only referencing them in comments.
- Receipt allocation visibility is stronger, but true inventory issue/usage tracking is still incomplete.
- Posted/open amount visibility is stronger, but explicit journal posting and audit controls are still incomplete.
- Work-order operational state is now easier to see, but route execution and proof-heavy HSE closeout still need deeper workflow screens.

## April 9, 2026 issue/gap refresh
- Open implementation gaps now concentrate on deeper workflow use of the new tables, not on whether the tables exist.
- Priority open screens: estimate/work-order lines, route stops, AR/AP payments, material receiving, and linked HSE packet management.
- Keep tracking CSS/mobile drift on admin manager screens as they grow.
- Continue reducing duplicate JSON/shared-reference sources wherever DB-first selectors already exist.


Last synchronized: April 10, 2026

## 1) Admin backbone incompletion
### Risk
The admin side is growing, but it is not yet the complete source of truth for all shared operational data.

### Needed
- staff management depth
- equipment manager using equipment master data
- estimate/work-order manager
- materials/costing manager
- route and service-area manager
- receivables/payables/accounting setup manager
- shared dropdown/reference control for all major forms

## 2) Validation and repeat-save risk
### Risk
Some forms have shown “saves once, fails later” behavior or insufficient validation feedback.

### Needed
- repeat-save validation
- clearer success/failure messages
- idempotent update paths where appropriate
- stronger server-side validation for critical records

## 3) Landscaping workflow gap
### Risk
The current build has jobs/equipment/HSE foundations, but not yet the full landscaping operations lifecycle.

### Needed
- recurring service templates
- route stops and scheduling
- visit completion flow
- material usage and costing
- client/site history per property

## 4) Project/construction workflow gap
### Risk
One-off project work like splash pads, parks, and construction support is only partially represented.

### Needed
- estimate -> approved work order -> phase tracking
- milestone/progress structure
- job packet / forms bundle
- equipment and materials planning

## 5) Subcontract dispatch gap
### Risk
Sending an employee or operator+machine to another company needs dedicated operational support.

### Needed
- subcontract client records
- dispatch work orders
- operator/equipment pairing
- time/billing/cost capture
- linked safety requirements

## 6) Digital accounting gap
### Risk
The repo now has schema foundations for AR/AP/GL, but not yet the complete admin workflow.

### Needed
- chart of accounts manager
- invoice and bill manager
- payments received and payments made
- journal batch/posting controls
- tax mapping and standard cost mapping
- later financial statements and reconciliation

## 7) Standalone HSE linkage gap
### Risk
The HSE app must stay usable alone, but later linking those records to jobs/sites/clients/work orders should be smoother.

### Needed
- standalone mode remains first-class
- optional link-back to operations records later
- shared safety templates and categories

## 8) CSS/mobile drift risk
### Risk
The UI continues to drift visually across screens and devices.

### Needed
- routine CSS QA
- mobile-first control sizing
- stronger empty states and loading states
- keep admin screens usable on desktop and acceptable on tablet/mobile

## Highest-priority summary
1. admin backbone completion
2. validation and repeat-save reliability
3. landscaping/project/subcontract workflow depth
4. digital accounting implementation
5. standalone HSE continuity

## Why this direction still matters

The business model mixes recurring landscaping, project/construction work, subcontract dispatch, and standalone HSE activity. Because of that, the highest-value remaining work is no longer just shell stability. It is converging the admin backbone, shared DB-backed catalogs, mobile field use, and digital accounting support into one coherent operations platform.

Reference links:
- OSHA landscaping hazards: https://www.osha.gov/landscaping/hazards
- OSHA landscaping overview/standards: https://www.osha.gov/landscaping
- IRS Publication 334: https://www.irs.gov/publications/p334
- IRS Publication 946: https://www.irs.gov/publications/p946
- IRS Tangible Property Regulations FAQ: https://www.irs.gov/businesses/small-businesses-self-employed/tangible-property-final-regulations

## Highest-value next implementation pass
- estimate / work-order manager
- materials + units manager
- route / service-area manager
- subcontract dispatch manager
- AR/AP + chart-of-accounts admin screens
- tighter HSE linking from standalone records into jobs/sites/work orders/dispatches when appropriate

## April 8, 2026 implementation focus
- Complete the Admin UI around the new backbone tables with stronger validation, record linking, and mobile-safe editing.
- Keep HSE standalone while also supporting direct linkage from work orders, routes, dispatches, and equipment.
- Continue retiring duplicate JSON fallback points when the DB-backed managers become stable enough for daily use.

### OSHA / HSE outstanding interfaces to keep visible
- linked HSE packet manager for work orders and subcontract dispatches
- heat / weather exposure workflow for landscaping and project crews
- chemical handling / SDS / pesticide-use linkage where applicable
- traffic / public-interaction controls for parks, roadsides, and municipal work
- equipment-specific JSA / inspection linkage
- field signoff and closeout flow that can work both standalone and attached to a formal job

### Mobile-friendly direction to keep pushing
- large tap targets for supervisors and crew leads in the field
- condensed line-entry forms with sticky save actions
- camera-first attachments and scan-to-link for receipts / equipment / HSE packets
- offline-safe draft saving for route stops, line items, and site safety checks
- simplified worker-facing packet progress views that avoid desktop-only layouts

- 2026-04-10 hotfix: corrected migration 064 view column order so PostgreSQL can apply it on top of migration 063 without `CREATE OR REPLACE VIEW` rename errors.

## 2026-04-10 crew assignment, recurring jobs, and field activity pass
- Job creation now has a clearer ownership path: a crew can be assigned at the same time as an explicit supervisor so responsibility is visible from the start.
- Jobs now support standalone or recurring scheduling fields, with recurrence summary/rule storage in the database instead of leaving schedule logic only in draft UI state.
- Job comments now have a DB-backed activity trail with optional photo attachments and special-instruction flags so crews and supervisors can review site notes, uploaded images, and field changes in one place.
- This pass continues the DB-first direction for shared operational data and reduces duplication risk compared with keeping crew/job packet details only in local JSON or loosely coupled browser state.
- Remaining gap: recurring schedules are stored and editable, but automatic future instance generation and calendar-grade recurrence expansion still need a dedicated follow-up pass.


## April 10, 2026 update after 066
- The repo now has explicit journal-batch controls and material issue / usage records, so the next operational blind spots are route-stop execution, HSE proof/reopen, and automatic source-to-journal drafting.
- Validation risk remains important because posting should be blocked on imbalance and issue/usage flows still need live field testing with real work-order data.
- CSS/mobile drift remains active because the Admin backbone is carrying more dense controls in a single screen.
