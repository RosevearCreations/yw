> Last synchronized: April 10, 2026. Reviewed during the receipt rollups, work-order operational status, posted/open amount visibility, and admin workflow sync pass.

## 2026-04-09 workflow rollups, posting, receiving-costing, and HSE closeout pass

## Risk shift after this pass
The main risk is no longer just whether Admin can see the new records. The risk is now whether every downstream operational stage is carried through with enough audit depth.

### Most important remaining risk clusters
- payment rollups without full GL posting could create a false sense of accounting completeness
- receiving-linked cost visibility exists, but without full inventory movement there is still room for costing blind spots
- HSE progress/closeout fields exist, but proof/attachment workflows are still needed for stronger defensibility
- route operations still need closer linkage to actual field completion and exceptions

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

# Known Gaps and Risks

## April 10, 2026 risk update
- The biggest risk is no longer missing tables; it is incomplete end-to-end movement from receive -> allocate -> issue/use -> close/bill/post.
- Posted/open amount visibility reduces manual accounting mistakes, but journal controls and stronger audit history are still needed.
- Receipt allocation still needs discipline because unallocated cost can now be seen more easily but not yet automatically resolved.

## April 9, 2026 risk update
- The main gap is no longer the existence of operations/accounting tables; it is getting the Admin UI to use them deeply and consistently.
- Highest-priority open workflow risks now are: estimate/work-order lines, route stops, AR/AP payment posting, material receiving, and linked HSE packet completion.
- The HSE side must avoid becoming secondary to the operations backbone; it still needs a strong standalone entry path for unscheduled jobs and public/municipal work.
- Mobile field UX remains a live risk area until the deeper workflow screens are tested under real phone/tablet use.

### Why this direction makes sense
- OSHA landscaping hazard guidance supports first-class HSE linkage to work, equipment, routes, and dispatches.
- IRS recordkeeping and depreciation requirements support digital, structured materials/equipment/accounting records.


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

## April 8, 2026 risk update
- HSE/OSHA outstanding interfaces should still be tracked explicitly: linked equipment/JSA workflow, linked dispatch HSE packet, linked heat/weather workflow, chemical handling workflow, public-traffic interaction workflow, and safety closeout tied to work-order completion.
- The new Admin backbone now needs deeper validation and record-linking so client, site, estimate, work-order, route, dispatch, and accounting records cannot drift apart.
- The remaining architectural risk is no longer lack of tables; it is completing the end-to-end UI, validation rules, and mobile-safe workflows on top of those tables.

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
