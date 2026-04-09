## 2026-04-08 landscaping/construction/mobile/admin-ui pathway documentation pass
- Refreshed the Markdown set to move the product direction from schema-only groundwork into the next implementation phase: admin UI managers for estimates/work orders, materials/units, routes/service areas, subcontract dispatch, and AR/AP + chart of accounts.
- Added a clearer rationale for keeping HSE as a first-class standalone module that can later link to jobs, sites, and dispatches for landscaping, project, and subcontract work.
- Updated the docs to emphasize mobile-first field use, desktop-strong admin depth, DB-first shared data, and local SEO / one-H1 discipline on every public build pass.

## 2026-04-07 estimates/work-orders/routes/materials/subcontract/GL foundation pass
- Added schema foundation migration `061_estimates_work_orders_routes_materials_and_gl_foundation.sql` so the repo now has first-class tables for estimates, work orders, routes, materials, subcontract dispatch, receivables, payables, and general-ledger journals.
- Reframed the roadmap so the next implementation phase is no longer “prove the shell exists” but “complete the digital admin/operations/accounting backbone”.

# Development Roadmap

Last synchronized: April 8, 2026

## Immediate priorities

### 1) Admin UI on new operations/accounting tables
Turn the new foundation tables into working admin tools.
- estimate / work-order manager
- materials + units manager
- route / service-area manager
- subcontract dispatch manager
- AR/AP + chart-of-accounts admin screens
- equipment master manager under the same admin backbone


### 2) Admin backbone completion
Make Admin the true operational source of truth.
- staff directory and hierarchy
- dropdown/reference manager
- equipment master data + equipment listings
- jobs and work orders
- materials and costing categories
- service areas and route references
- estimate approval and conversion workflow

### 3) Estimates and work orders
Move from schema foundation into working admin UI and workflows.
- estimate create/edit/list/approve
- estimate lines for labour/material/equipment/subcontract items
- convert approved estimate to work order
- work-order line management
- work-order status history and approvals
- printable and mobile-friendly work packets

### 4) Materials and costing
Complete the digital cost backbone.
- materials catalog CRUD
- unit-of-measure management
- estimated vs actual material usage per work order/job
- labour, equipment, and subcontract cost capture
- standard cost and bill-rate maintenance
- profitability reporting later

### 5) Routes and service areas
Deepen the landscaping service model.
- service-area manager
- route manager
- route stop sequencing
- recurring service template to route stop generation
- supervisor/crew assignment by route
- mobile visit completion flow

### 6) Subcontract dispatch workflow
Support operator + equipment assignments to another firm.
- subcontract client records
- dispatch create/edit/list
- operator/equipment pairing
- dispatch time and cost capture
- dispatch billing and invoice generation
- optional HSE packet linking

### 7) Digital accounting foundation
Move toward a fully digital receivables/payables/general-ledger system.
- chart of accounts manager
- invoice and bill CRUD
- payments received / payments made
- journal batch posting workflow
- tax handling rules
- standard cost account mapping
- later bank reconciliation and financial statements

### 8) Standalone HSE continuity
Keep HSE operational without requiring a full operations job.
- standalone forms remain first-class
- optional later linking to jobs/sites/clients/work orders/routes
- shared safety categories and templates from admin backbone

## Secondary priorities

### 9) Mobile-first field optimization
- quicker mobile navigation
- progressive disclosure on forms
- camera/upload friendly steps
- offline-safe drafts and retries
- faster repeat data entry from shared dropdowns
- route-stop quick-complete actions

### 9) Validation and save reliability
- repeat-save safe endpoints
- stronger input validation
- clearer save success/failure messages
- protect against stale async overwrites

### 10) Ongoing public SEO pass
On every build:
- one H1 on exposed pages
- refine local-service titles/meta for landscaping, construction support, and subcontract equipment/operator terms
- keep private/admin pages noindex
- continue route-by-route cleanup for local search visibility

## Move up next
- admin UI for estimates/work orders/materials/routes/subcontract dispatch
- complete database-first replacement of remaining shared JSON operational data
- start AR/AP and chart-of-accounts admin surfaces
