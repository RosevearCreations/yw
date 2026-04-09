## 2026-04-08 landscaping/construction/mobile/admin-ui pathway documentation pass
- Refreshed the Markdown set to move the product direction from schema-only groundwork into the next implementation phase: admin UI managers for estimates/work orders, materials/units, routes/service areas, subcontract dispatch, and AR/AP + chart of accounts.
- Added a clearer rationale for keeping HSE as a first-class standalone module that can later link to jobs, sites, and dispatches for landscaping, project, and subcontract work.
- Updated the docs to emphasize mobile-first field use, desktop-strong admin depth, DB-first shared data, and local SEO / one-H1 discipline on every public build pass.

# Database Structure

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
