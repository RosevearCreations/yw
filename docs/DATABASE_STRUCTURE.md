# Database Structure

Last synchronized: April 7, 2026

## Current schema direction

The database is now expected to support two connected but separable domains:

1. **Operations platform**
   - staff
   - clients/sites
   - jobs
   - work orders
   - equipment
   - routes
   - materials
   - costing
   - approvals

2. **Standalone and linked HSE platform**
   - forms
   - inspections
   - drills
   - toolbox talks
   - PPE checks
   - first-aid checks
   - logbook/review records

## Current core tables already implied by the build

### Staff and access
- `profiles`
- site assignment/support tables
- role and visibility helpers
- account recovery / onboarding / identity change related tables

### Operations
- jobs
- job equipment requirements
- equipment assets, signout, maintenance, evidence
- orders/accounting stub tables
- dropdown/catalog reference tables

### HSE
- submissions and review-related tables
- notifications/signoff helpers
- logbook/review function inputs

## Recommended next schema expansion

### A) Landscaping operations tables
Recommended additions or deepening:
- `clients`
- `client_sites`
- `service_plans`
- `route_runs`
- `route_stops`
- `recurring_service_templates`
- `visit_material_usage`
- `visit_notes`

### B) Estimates and work orders
- `estimates`
- `estimate_lines`
- `work_orders`
- `work_order_lines`
- `work_order_status_history`
- `approvals`

### C) Materials and costing
- `materials_catalog`
- `material_units`
- `job_material_allocations`
- `job_material_actuals`
- `labour_entries`
- `equipment_cost_rates`
- `subcontract_cost_entries`

### D) Subcontract dispatch
- `subcontract_clients`
- `subcontract_work_orders`
- `operator_dispatches`
- `dispatch_time_entries`
- `dispatch_billing_rules`

### E) HSE linkage helpers
Recommended link strategy:
- allow HSE records to be standalone
- optionally attach them to:
  - job
  - work_order
  - site
  - client
  - route_stop

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

## Important rule

The database should increasingly become the **single source of truth** for shared operational records, while keeping the standalone HSE use case possible when operations records are absent.
