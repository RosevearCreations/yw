> Last synchronized: April 10, 2026. Reviewed during the journal posting controls, material issue / usage, Admin backbone, and schema synchronization pass.

## 2026-04-10 journal posting controls and material issue / usage pass
- Added migration `sql/066_journal_posting_controls_and_material_issue_usage.sql`.
- Added DB-side journal-batch rollups so line count, debit total, credit total, and balanced state are derived instead of tracked manually.
- Added DB-backed `material_issues` and `material_issue_lines` so receiving can progress into job usage, issued-cost totals, and variance visibility.
- Extended the Admin backbone so journal batches, journal entries, material issues, and material issue lines can be created and managed from the same operational shell.
- Continued the DB-first direction for shared operational data while keeping the next highest-value gaps visible: route execution lifecycle, HSE proof/reopen, and stronger source-to-journal automation.

## 2026-04-09 workflow rollups, posting, receiving-costing, and HSE closeout pass

## New schema behavior added in this pass
- `estimates` now support derived line counts, rolled-up cost totals, and margin visibility.
- `work_orders` now support derived line counts, rolled-up cost totals, and received-cost visibility from linked material receipts.
- `work_order_lines` now support received quantity / received cost feedback from material receipt lines.
- `material_receipts` now support derived line counts and total receipt value.
- `ar_invoices` and `ap_bills` now support `amount_paid` plus payment-applied balance logic.
- `linked_hse_packets` now support required/completed checklist counts plus closeout-oriented state fields.

### DB-first logic now preferred
The new 063 pass intentionally moves business logic downward into SQL triggers/functions so the browser becomes a helper surface instead of the only source of totals or statuses.

- Added DB-first workflow logic so estimate, work-order, and material-receipt header totals can roll up from their line records instead of depending on manual entry.
- Added receivables/payables payment-application logic so invoices and bills can track paid amounts, remaining balance, and partial/paid status from posted payments.
- Added receiving-to-costing linkage so material receipt lines can feed received quantity / received cost visibility back into work-order execution.
- Extended linked HSE packets toward real progress and closeout handling with checklist-style completion fields, derived progress, and clearer Admin-side visibility.


## 2026-04-08 landscaping/construction/mobile/admin-ui pathway documentation pass
- Refreshed the Markdown set to move the product direction from schema-only groundwork into the next implementation phase: admin UI managers for estimates/work orders, materials/units, routes/service areas, subcontract dispatch, and AR/AP + chart of accounts.
- Added a clearer rationale for keeping HSE as a first-class standalone module that can later link to jobs, sites, and dispatches for landscaping, project, and subcontract work.
- Updated the docs to emphasize mobile-first field use, desktop-strong admin depth, DB-first shared data, and local SEO / one-H1 discipline on every public build pass.

# Database Structure

## April 10, 2026 schema direction update
- Added migration `064_receipt_rollups_work_order_operational_status_and_posted_amounts.sql`.
- `v_material_receipt_rollups` now exposes allocated vs unallocated receipt cost and linked work-order-line counts.
- `v_work_order_rollups` now exposes receipt count, received material cost, unallocated receipt cost, and rough operational status.
- `v_account_balance_rollups` now exposes posted amount, open amount, and posted percent for AR invoices and AP bills.
- `sql/000_full_schema_reference.sql` now truly includes the later workflow migrations.

## April 9, 2026 schema direction update
- Added direction for the deeper workflow layer on top of the 061 backbone.
- New workflow-level entities for the next pass are material receipts, material receipt lines, and linked HSE packets.
- Existing 061 tables `route_stops`, `estimate_lines`, `work_order_lines`, `ar_payments`, and `ap_payments` should now be treated as active Admin-manager targets rather than future placeholders.

### Admin managers implied by the schema
- `estimates` + `estimate_lines` -> estimate manager
- `work_orders` + `work_order_lines` -> work-order manager
- `routes` + `route_stops` + `service_areas` -> route/service-area manager
- `materials_catalog` + `material_receipts` + `material_receipt_lines` + `units_of_measure` -> materials/receiving manager
- `subcontract_dispatches` + `linked_hse_packets` -> dispatch + HSE packet manager
- `ar_invoices` + `ar_payments` and `ap_bills` + `ap_payments` -> receivables/payables posting manager


Last synchronized: April 10, 2026

## Current schema direction

The database is now expected to support three connected but separable domains:

1. **Operations platform**
   - staff
   - clients/sites
   - estimates
   - work orders
   - routes
   - materials
   - equipment
   - costing
   - approvals

2. **Subcontract and dispatch platform**
   - subcontract clients
   - operator/equipment dispatches
   - dispatch billing and cost capture

3. **Standalone and linked HSE platform**
   - forms
   - inspections
   - drills
   - toolbox talks
   - PPE checks
   - first-aid checks
   - logbook/review records

4. **Digital accounting backbone**
   - chart of accounts
   - receivables
   - payables
   - general-ledger journals
   - standard cost mapping

## Current core tables already implied by the build

### Staff and access
- `profiles`
- site assignment/support tables
- role and visibility helpers
- account recovery / onboarding / identity change related tables

### Operations
- `jobs`
- job equipment requirements
- equipment assets, signout, maintenance, evidence
- orders/accounting stub tables
- dropdown/catalog reference tables

### New foundation added in migration 061
- `units_of_measure`
- `cost_codes`
- `clients`
- `client_sites`
- `service_areas`
- `routes`
- `route_stops`
- `materials_catalog`
- `equipment_master`
- `estimates`
- `estimate_lines`
- `work_orders`
- `work_order_lines`
- `subcontract_clients`
- `subcontract_dispatches`
- `chart_of_accounts`
- `gl_journal_batches`
- `gl_journal_entries`
- `ar_invoices`
- `ar_payments`
- `ap_vendors`
- `ap_bills`
- `ap_payments`

## Data migration direction

Continue moving multi-use shared data from JSON fallback into database-backed reference tables where operational consistency matters.

Best candidates:
- equipment master data
- employee/staff lists
- job types and statuses
- material categories and units
- service categories
- recurring service templates
- safety categories and templates
- cost codes and account mappings

## Important rule

The database should increasingly become the **single source of truth** for shared operational records, while keeping the standalone HSE use case possible when operations records are absent.

## Admin UI mapping for the new tables

The next admin layer should expose these groups through manager screens:

### Estimate / work-order manager
- `estimates`
- `estimate_lines`
- `work_orders`
- `work_order_lines`

### Materials + units manager
- `materials_catalog`
- `units_of_measure`
- `cost_codes`

### Route / service-area manager
- `service_areas`
- `routes`
- `route_stops`
- `clients`
- `client_sites`

### Subcontract dispatch manager
- `subcontract_clients`
- `subcontract_dispatches`
- `equipment_master`

### AR/AP + chart-of-accounts admin screens
- `chart_of_accounts`
- `gl_journal_batches`
- `gl_journal_entries`
- `ar_invoices`
- `ar_payments`
- `ap_vendors`
- `ap_bills`
- `ap_payments`

## HSE linkage rule

The HSE side must stay usable as a standalone safety app for unscheduled work. When operations records exist, HSE records should be linkable to:
- clients
- client sites
- routes / route stops
- estimates
- work orders
- subcontract dispatches
- equipment

This keeps the safety workflows first-class without forcing every ad hoc safety event into a full operations record at creation time.

## April 8, 2026 database direction
The new operations/accounting tables should now be treated as the long-term backbone for landscaping, project work, construction-style jobs, subcontract dispatch, and digital accounting.

Priority UI mappings:
- `units_of_measure`, `cost_codes` -> Admin reference data manager
- `service_areas`, `routes`, `route_stops` -> route/service-area manager
- `clients`, `client_sites` -> client/site manager
- `materials_catalog`, `equipment_master` -> material/equipment manager
- `estimates`, `estimate_lines`, `work_orders`, `work_order_lines` -> estimate/work-order manager
- `subcontract_clients`, `subcontract_dispatches` -> subcontract dispatch manager
- `chart_of_accounts`, `ar_invoices`, `ap_vendors`, `ap_bills` -> accounting backbone manager

## 2026-04-10 crew assignment, recurring jobs, and field activity pass
- Job creation now has a clearer ownership path: a crew can be assigned at the same time as an explicit supervisor so responsibility is visible from the start.
- Jobs now support standalone or recurring scheduling fields, with recurrence summary/rule storage in the database instead of leaving schedule logic only in draft UI state.
- Job comments now have a DB-backed activity trail with optional photo attachments and special-instruction flags so crews and supervisors can review site notes, uploaded images, and field changes in one place.
- This pass continues the DB-first direction for shared operational data and reduces duplication risk compared with keeping crew/job packet details only in local JSON or loosely coupled browser state.
- Added tables/views in this pass: `crews`, `crew_members`, `job_comments`, `job_comment_attachments`, `v_crew_directory`, `v_job_comment_activity`, and the expanded `v_jobs_directory`.


## 066 schema direction update
- `gl_journal_batches` now carry derived line-count, debit, credit, balanced, and posted-by metadata.
- `gl_journal_entries` now support line numbering and optional source-record linkage.
- `material_issues` and `material_issue_lines` now carry actual usage/issue movement after receiving so work can be tracked beyond purchase.
