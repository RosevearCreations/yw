## 2026-04-08 landscaping/construction/mobile/admin-ui pathway documentation pass
- Refreshed the Markdown set to move the product direction from schema-only groundwork into the next implementation phase: admin UI managers for estimates/work orders, materials/units, routes/service areas, subcontract dispatch, and AR/AP + chart of accounts.
- Added a clearer rationale for keeping HSE as a first-class standalone module that can later link to jobs, sites, and dispatches for landscaping, project, and subcontract work.
- Updated the docs to emphasize mobile-first field use, desktop-strong admin depth, DB-first shared data, and local SEO / one-H1 discipline on every public build pass.

## 2026-04-07 estimates/work-orders/routes/materials/subcontract/GL foundation pass
- Added schema foundation migration `061_estimates_work_orders_routes_materials_and_gl_foundation.sql` for clients, client sites, service areas, routes, route stops, materials catalog, units of measure, equipment master data, estimates, work orders, subcontract dispatch, chart of accounts, AR, AP, and general-ledger journals.
- Refreshed the schema reference snapshot so the repo now documents a digital operations + accounting direction instead of leaving that work only in roadmap notes.
- Updated the Markdown set to treat the current auth/session stabilization as substantially complete and move the main forward direction into admin backbone depth, landscaping/project/subcontract workflows, and fully digital receivables/payables/accounting.

# YW Operations + HSE Platform

Last synchronized: April 8, 2026

## What this project is

This repository is the working build of a role-aware operations platform for a landscaping and field-services company with a connected HSE safety application.

The platform now has four connected business modes:

1. **Landscaping and grounds maintenance**
   - recurring property maintenance
   - seasonal cleanup
   - planting, mulching, pruning, edging, irrigation checks
   - route-based crew scheduling

2. **Project and construction-style work**
   - splash pads
   - children's parks
   - site upgrades and small civil/building support
   - estimate-to-work-order delivery

3. **Subcontract / operator-and-equipment dispatch**
   - backhoe + operator or similar machine dispatch to another firm
   - client-specific site, billing, and safety requirements
   - time, cost, and invoicing by dispatch

4. **Standalone HSE / safety operations**
   - toolbox, inspection, first-aid, PPE, drill, and logbook workflows
   - can run without a full operations job when the project is unscheduled or ad hoc
   - can later be linked to jobs/sites/clients/work orders

## Core product direction

The product direction is now:
- mobile-first for field workers
- desktop-strong for office/admin users
- role-aware for Admin, Supervisor, and Employee users
- database-first for shared dropdowns, staff lists, equipment, jobs, work orders, materials, routes, and accounting structures
- validation-first so saves are repeatable and one user's identity never cross-contaminates another user's view

## Why this direction makes sense

This direction fits the real work mix the company performs:
- recurring landscaping and grounds maintenance
- project / construction-style jobs such as splash pads and children's parks
- subcontract operator-and-equipment dispatch to other firms
- standalone HSE workflows for unscheduled or ad hoc work

It also fits the external guidance that most strongly affects the business model:
- **OSHA landscaping guidance** emphasizes machinery, heat and cold stress, lifting/awkward postures, pesticides/chemicals, and both maintenance and construction activity, which supports keeping HSE linkable to jobs, sites, routes, and dispatches.
- **IRS small-business and depreciation guidance** supports keeping materials, equipment, expenses, and accounting records structured and digital so ordinary business expenses, inventory/material treatment, and depreciable equipment are easier to track.
- For project-based landscaping/construction work, the practical next layer is estimates, work orders, materials, AR/AP, and general-ledger structure so costing, billing, and profitability can be managed in one system.

Reference links for future planning:
- OSHA landscaping hazards: https://www.osha.gov/landscaping/hazards
- OSHA landscaping overview/standards: https://www.osha.gov/landscaping
- IRS Publication 334, Tax Guide for Small Business: https://www.irs.gov/publications/p334
- IRS Publication 946, How To Depreciate Property: https://www.irs.gov/publications/p946
- IRS Tangible Property Regulations FAQ: https://www.irs.gov/businesses/small-businesses-self-employed/tangible-property-final-regulations

## Next strongest build pass

The next strongest build pass after the current schema-and-docs phase is to make the Admin UI actually use the new tables:
- estimate / work-order manager
- materials + units manager
- route / service-area manager
- subcontract dispatch manager
- AR/AP + chart-of-accounts admin screens

## Admin backbone goals

The admin backbone is intended to become the single source of truth for:
- staff directory and hierarchy
- permissions and role assignment
- equipment catalog and master data
- shared dropdown/reference values
- clients and sites
- estimates and work orders
- routes and crew assignments
- materials usage and costing
- receivables and payables
- general-ledger setup and digital accounting controls
- safety templates and required forms

## Current major modules

### 1) Auth and staff identity
- session-based login/logout
- onboarding completion
- profile and staff metadata
- password reset and admin password control
- staff roles: Admin / Supervisor / Employee

### 2) HSE / field safety
- toolbox talks
- PPE checks
- first aid kit checks
- site inspections
- emergency drills
- logbook and review flows

### 3) Operations and admin
- staff directory
- dropdown/catalog manager
- assignment workbench
- jobs/equipment workflows
- accounting/order scaffolding

### 4) New schema foundation now in repo
- estimates
- work orders
- materials catalog + units
- routes + service areas
- subcontract clients + dispatches
- equipment master data
- chart of accounts
- AR invoices/payments
- AP vendors/bills/payments
- journal batches and entries

## Current priority

The app is now stable enough that the main build priority shifts from shell repair toward **deepening the operations and accounting backbone** while keeping the HSE side standalone-capable.
