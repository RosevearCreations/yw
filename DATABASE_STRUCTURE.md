> Last synchronized: April 9, 2026. Reviewed during the workflow rollups, posting logic, receiving-to-costing, and HSE closeout pass.

## 2026-04-09 workflow rollups / posting / costing / HSE closeout pass
- Added schema support for `work_order_lines.actual_quantity_received`, `work_order_lines.actual_material_cost`, `work_orders.actual_material_cost_total`, and linked HSE packet completion/closeout fields.
- Added rollup and progress views so routes, estimates, work orders, receipts, account balances, and HSE packets now have clearer database-level summary surfaces.


## 2026-04-08 landscaping/construction/mobile/admin-ui pathway documentation pass
- Refreshed the Markdown set to move the product direction from schema-only groundwork into the next implementation phase: admin UI managers for estimates/work orders, materials/units, routes/service areas, subcontract dispatch, and AR/AP + chart of accounts.
- Added a clearer rationale for keeping HSE as a first-class standalone module that can later link to jobs, sites, and dispatches for landscaping, project, and subcontract work.
- Updated the docs to emphasize mobile-first field use, desktop-strong admin depth, DB-first shared data, and local SEO / one-H1 discipline on every public build pass.

# Database Structure

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


Last synchronized: April 8, 2026

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