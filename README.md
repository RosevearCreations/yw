> Last synchronized: April 9, 2026. Reviewed during the workflow rollups, payment posting, receiving-to-costing, and HSE packet closeout pass.

## 2026-04-09 workflow rollups, posting, receiving-costing, and HSE closeout pass

### Current direction after this pass
- The Admin backbone is no longer just a placeholder master-data shell. It now has matching DB logic for derived totals, payment application, receiving-linked costing, and HSE packet progress/closeout.
- Shared operational truth should continue moving into the database whenever the same totals or statuses would otherwise be entered in multiple places.
- Public-page SEO remains a maintenance rule each pass: one H1 per exposed page, descriptive titles/meta, useful headings, crawlable app shell assets, and continued local-intent wording where public marketing pages exist.

- Added DB-first workflow logic so estimate, work-order, and material-receipt header totals can roll up from their line records instead of depending on manual entry.
- Added receivables/payables payment-application logic so invoices and bills can track paid amounts, remaining balance, and partial/paid status from posted payments.
- Added receiving-to-costing linkage so material receipt lines can feed received quantity / received cost visibility back into work-order execution.
- Extended linked HSE packets toward real progress and closeout handling with checklist-style completion fields, derived progress, and clearer Admin-side visibility.


## 2026-04-08 landscaping/construction/mobile/admin-ui pathway documentation pass
- Refreshed the Markdown set to move the product direction from schema-only groundwork into the next implementation phase: admin UI managers for estimates/work orders, materials/units, routes/service areas, subcontract dispatch, and AR/AP + chart of accounts.
- Added a clearer rationale for keeping HSE as a first-class standalone module that can later link to jobs, sites, and dispatches for landscaping, project, and subcontract work.
- Updated the docs to emphasize mobile-first field use, desktop-strong admin depth, DB-first shared data, and local SEO / one-H1 discipline on every public build pass.

## 2026-04-07 estimates/work-orders/routes/materials/subcontract/GL foundation pass
- Added schema foundation migration `061_estimates_work_orders_routes_materials_and_gl_foundation.sql` for clients, client sites, service areas, routes, route stops, materials catalog, units of measure, equipment master data, estimates, work orders, subcontract dispatch, chart of accounts, AR, AP, and general-ledger journals.
- Refreshed the schema reference snapshot so the repo now documents a digital operations + accounting direction instead of leaving that work only in roadmap notes.
- Updated the Markdown set to treat the current auth/session stabilization as substantially complete and move the main forward direction into admin backbone depth, landscaping/project/subcontract workflows, and fully digital receivables/payables/accounting.

# YW Operations + HSE Platform

## April 9, 2026 deeper workflow polish direction
- The next strongest implementation pass is now deeper workflow polish on top of the new Admin backbone manager.
- Priority UI managers: estimate/work-order lines, route stops, AR/AP payment posting, material receiving, and linked HSE packets for work orders and dispatches.
- The HSE side must remain standalone-capable for unscheduled work while also linking cleanly into routes, work orders, dispatches, sites, equipment, and client records whenever a formal job exists.
- The most efficient data direction continues to be DB-first for shared dropdowns, equipment, materials, job costing, AR/AP, and GL scaffolding, with JSON retained only where a bundled fallback is still operationally useful.

### Why this direction makes sense
- OSHA landscaping guidance emphasizes recurring hazards around machinery/tools, lifting, slips/trips/falls, vehicles, chemicals, and heat stress, which supports keeping the HSE side first-class and linkable to jobs, sites, routes, equipment, and dispatches.
- Project-based landscaping/construction operations depend on job costing, progress invoicing, purchase/material receiving, and inventory tracking, which aligns with estimates, work orders, AR/AP, and a general ledger backbone.
- IRS small-business and depreciation guidance supports keeping materials, equipment, expenses, receivables, payables, and asset records digital and structured so operational and tax records do not drift apart.


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

## April 8, 2026 direction update
- The platform direction is now a landscaping / construction / subcontract operations system with a standalone-capable HSE safety core.
- The Admin backbone is expected to be the source of truth for dropdowns, equipment listings, employee listings, job/work-order records, materials, routes, dispatches, and accounting masters.
- The next implementation step after this pass is to use the new operations/accounting tables directly from the Admin UI end to end.
- The HSE side remains usable on unscheduled work even when no formal estimate/work-order exists.

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
