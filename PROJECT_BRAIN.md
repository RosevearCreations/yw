## 2026-04-08 landscaping/construction/mobile/admin-ui pathway documentation pass
- Refreshed the Markdown set to move the product direction from schema-only groundwork into the next implementation phase: admin UI managers for estimates/work orders, materials/units, routes/service areas, subcontract dispatch, and AR/AP + chart of accounts.
- Added a clearer rationale for keeping HSE as a first-class standalone module that can later link to jobs, sites, and dispatches for landscaping, project, and subcontract work.
- Updated the docs to emphasize mobile-first field use, desktop-strong admin depth, DB-first shared data, and local SEO / one-H1 discipline on every public build pass.

# Project Brain

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
