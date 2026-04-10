> Last synchronized: April 9, 2026. Reviewed during the workflow rollups, posting logic, receiving-to-costing, and HSE closeout pass.

## 2026-04-09 workflow rollups / posting / costing / HSE closeout pass
- The app is now best understood as a DB-first operations + HSE platform where Admin is gradually becoming the single operational control surface.
- Current center of gravity: estimate/work-order rollups, AR/AP balance movement, receiving tied to costing, and HSE packet progress/closeout linked back to formal work records.


## 2026-04-08 landscaping/construction/mobile/admin-ui pathway documentation pass
- Refreshed the Markdown set to move the product direction from schema-only groundwork into the next implementation phase: admin UI managers for estimates/work orders, materials/units, routes/service areas, subcontract dispatch, and AR/AP + chart of accounts.
- Added a clearer rationale for keeping HSE as a first-class standalone module that can later link to jobs, sites, and dispatches for landscaping, project, and subcontract work.
- Updated the docs to emphasize mobile-first field use, desktop-strong admin depth, DB-first shared data, and local SEO / one-H1 discipline on every public build pass.

# Project Brain

## April 9, 2026 project-brain refresh
- The company direction is landscaping-led but must support project/construction work, municipal/public jobs, and subcontract dispatches.
- Admin is the source of truth for shared dropdowns, staff, equipment, routes, clients, sites, materials, estimates, work orders, dispatches, AR/AP, and chart-of-accounts structures.
- HSE is not a side module; it is a parallel first-class workflow that must work standalone and linked.


Last synchronized: April 8, 2026

## Product summary

This project is a **field operations platform with an integrated HSE safety application** for a landscaping-led company that also performs project work, construction-style work, and subcontract machine/operator dispatch.

## Business reality the app must support

### A) Recurring landscaping operations
- mowing and trimming routes
- spring and fall cleanup
- bed maintenance
- pruning and planting
- property visits with repeating schedules

### B) One-off project work
- splash pads
- children's park work
- local construction support
- hardscape/site enhancement jobs
- small building or site-related jobs

### C) Subcontract dispatch work
- backhoe + operator for a fibre optic contractor
- employee sent to another firm for a day or project
- client-specific site, safety, and billing requirements

### D) Standalone HSE usage
- unscheduled project where only the safety module is needed
- project-specific inspection or toolbox flow without a formal work order
- ad hoc site documentation when operations-side records are not yet created

## Identity and role model
- **Admin**: full access to staff, jobs, equipment, dropdowns, approvals, work orders, accounting, and configuration
- **Supervisor**: oversight of assigned crews, jobs, routes, equipment, and field workflows within scope
- **Employee**: assigned work, field forms, job updates, limited self-profile access

## Data backbone that should be database-first
- staff directory
- positions/trades
- staff tiers and seniority
- employment statuses
- equipment classes and equipment items
- job types and work order statuses
- material catalog and units
- route/service area references
- recurring task templates
- HSE form templates and safety categories
- chart of accounts and standard cost mappings

## Core linked modules
- Staff
- Equipment
- Estimates
- Work orders
- Routes and visits
- Subcontract dispatch
- HSE
- Receivables / Payables / General ledger

## Next admin screen layer
- estimate / work-order manager
- materials + units manager
- route / service-area manager
- subcontract dispatch manager
- AR/AP + chart-of-accounts admin screens

These screens should be mobile-friendly for quick field edits and desktop-strong for office/admin work.

## April 8, 2026 project brain update
Treat the product as a landscaping / project-work / subcontract dispatch platform with a first-class HSE app inside it. The HSE side must always be able to run on its own for unscheduled work, but Admin should still be able to connect safety records back to routes, sites, work orders, dispatches, equipment, and accounting later.

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
