# Database Structure

Last synchronized: April 7, 2026

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
