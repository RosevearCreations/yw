> Last synchronized: April 11, 2026 (HSE upload retry, safety screens, and analytics/traffic monitoring pass)

## 2026-04-11 risk update after 069
- The HSE packet model is now wider and more realistic, but the new risk is execution quality on phones/tablets: weather/heat/chemical/traffic/signoff flows need live field validation.
- Admin now has a last-good cached fallback for directory/backbone loads, which reduces total failure risk, but stale cached reads still need clear operator awareness.
- Upload reliability is still uneven because route execution and HSE proof uploads need the same failure-trail depth as job-comment and equipment uploads.

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

## April 11, 2026 risk update after 068
- Source-generated journal batches now have first-class exception visibility, but the next risk is operator workflow: office staff still need a guided rebuild/review path for stale batches.
- Upload failures now leave a DB-backed trail, which reduces silent loss, but route execution and HSE proof uploads still need the same end-to-end fallback behavior.
- Partial-success handling improved for job comments, yet broader repeat-save and retry clarity is still a top Admin/mobile risk.

## April 10, 2026 risk update after 067
- The biggest risk is now mobile/live execution quality rather than missing structures: route-stop execution, HSE proof, and source-generated journals are in the schema/admin layer, but they still need real-device validation and clearer upload/error fallback.
- Source-generated batches reduce manual accounting setup, but posted-source drift now becomes the next audit visibility risk.
- Receiving -> clearing -> AP and issue/use -> expense flows are more complete, but reconciliation and review UX still need tightening.

## April 9, 2026 risk update
- The main gap is no longer the existence of operations/accounting tables; it is getting the Admin UI to use them deeply and consistently.
- Highest-priority open workflow risks now are: estimate/work-order lines, route stops, AR/AP payment posting, material receiving, and linked HSE packet completion.
- The HSE side must avoid becoming secondary to the operations backbone; it still needs a strong standalone entry path for unscheduled jobs and public/municipal work.
- Mobile field UX remains a live risk area until the deeper workflow screens are tested under real phone/tablet use.

### Why this direction makes sense
- OSHA landscaping hazard guidance supports first-class HSE linkage to work, equipment, routes, and dispatches.
- IRS recordkeeping and depreciation requirements support digital, structured materials/equipment/accounting records.


Last synchronized: April 11, 2026 (journal sync exceptions / upload fallback pass)

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

## 2026-04-10 crew assignment, recurring jobs, and field activity pass
- Job creation now has a clearer ownership path: a crew can be assigned at the same time as an explicit supervisor so responsibility is visible from the start.
- Jobs now support standalone or recurring scheduling fields, with recurrence summary/rule storage in the database instead of leaving schedule logic only in draft UI state.
- Job comments now have a DB-backed activity trail with optional photo attachments and special-instruction flags so crews and supervisors can review site notes, uploaded images, and field changes in one place.
- This pass continues the DB-first direction for shared operational data and reduces duplication risk compared with keeping crew/job packet details only in local JSON or loosely coupled browser state.
- Risk to keep watching: photo/comment workflows need live bucket policy and signed-URL verification after deploy so field uploads fail gracefully instead of silently.


## April 10, 2026 update after 066
- The repo now has explicit journal-batch controls and material issue / usage records, so the next operational blind spots are route-stop execution, HSE proof/reopen, and automatic source-to-journal drafting.
- Validation risk remains important because posting should be blocked on imbalance and issue/usage flows still need live field testing with real work-order data.
- CSS/mobile drift remains active because the Admin backbone is carrying more dense controls in a single screen.

## 2026-04-10 source-generated journals, route execution, and HSE proof pass
- Added migration `sql/067_source_journal_route_execution_and_hse_proof.sql`.
- Added source-generated draft journal batches for AR invoices, AP bills, material receipts, and material issues so review/posting can start from the originating record instead of manual batch creation.
- Added route-stop execution lifecycle records plus attachment rows so daily field work can track completed, skipped, delayed, and exception states with note/photo support.
- Added HSE proof rows plus reopen-aware linked packet fields so closeout evidence, reopen counts, and follow-up exceptions are visible in the Admin backbone.
- Continued the DB-first move for shared operational/accounting data and refreshed the docs so roadmap, risks, testing, and deployment all point to the same next state.


## April 11, 2026 update after 070
- The remaining HSE interface gap is no longer missing packet/event/proof structures. The main gap is now dashboard polish, alert thresholds, and mobile supervisor speed for repeat field closeout.
- Upload-failure handling is now broader because job comments, equipment evidence, route execution attachments, and HSE proofs all have a DB-backed failure trail and retry ownership path.
- The new analytics/monitoring layer reduces the risk that traffic drops, API failures, upload failures, or client-side runtime issues go unseen, but it still needs dashboard-style summaries and alerting thresholds.
