## 2026-04-08 landscaping/construction/mobile/admin-ui pathway documentation pass
- Refreshed the Markdown set to move the product direction from schema-only groundwork into the next implementation phase: admin UI managers for estimates/work orders, materials/units, routes/service areas, subcontract dispatch, and AR/AP + chart of accounts.
- Added a clearer rationale for keeping HSE as a first-class standalone module that can later link to jobs, sites, and dispatches for landscaping, project, and subcontract work.
- Updated the docs to emphasize mobile-first field use, desktop-strong admin depth, DB-first shared data, and local SEO / one-H1 discipline on every public build pass.

## 2026-04-07 estimates/work-orders/routes/materials/subcontract/GL foundation pass
- Added schema foundation migration `061_estimates_work_orders_routes_materials_and_gl_foundation.sql` and updated the development guidance so future passes build the admin/data backbone instead of circling older shell issues.

# Development Guide

Last synchronized: April 8, 2026

## Purpose of this guide

This guide reflects the practical direction for the project as a landscaping-led field operations, subcontract dispatch, project/construction, and HSE platform with a fully digital admin backbone.

## Guiding principles

1. **Session integrity remains non-negotiable**
   - never allow one user's identity, role, or profile to overwrite another's view
   - all protected screens must trust the same resolved actor

2. **Database-first shared data**
   - staff, dropdowns, equipment, jobs, work order statuses, materials, routes, costing categories, receivables, payables, and accounting structures should live in the database
   - JSON fallback should be transitional only

3. **Mobile-first field usability**
   - forms should work on phones first
   - reduce repeated typing
   - large controls, strong empty states, visible save feedback

4. **Desktop-strong admin depth**
   - admin users need denser views for staffing, approvals, costing, equipment, planning, and accounting

5. **Standalone HSE support must remain**
   - safety workflows must still work for unscheduled or ad hoc projects where no full job/work-order record exists yet

## Product tracks

### Track 1 — Admin backbone completion
Admin should become the source of truth for:
- staff directory
- role and employment status
- supervisor relationships
- dropdowns and shared catalogs
- equipment listings and equipment master data
- jobs and work orders
- route/service references
- materials and costing categories
- chart of accounts and accounting setup

### Track 2 — Landscaping operations model
Deepen the model for recurring and seasonal work:
- estimate
- approved work order
- scheduled visit / route stop
- crew assignment
- material allocation
- completion notes and client signoff
- recurring service templates

### Track 3 — Project / construction jobs
Support one-off and construction-style work:
- project estimate and scope
- phases / milestones
- work order packets
- site-specific safety requirements
- equipment reservations
- material and subcontract cost tracking

### Track 4 — Subcontract dispatch model
Support sending staff/equipment to another company:
- subcontract clients
- dispatch work orders
- operator/equipment pairing
- billing basis and rates
- time, billing, and cost capture
- linked HSE/jobsite paperwork

### Track 5 — Fully digital accounting direction
The accounting side should eventually cover:
- receivables
- payables
- chart of accounts
- journal entries and batch posting
- taxes
- standard costs
- project/job costing
- later financial statements and reconciliations

## Build rules
- update Markdown files on every pass
- update schema snapshot on every schema change
- keep public SEO moving forward every pass
- keep admin/token/private pages noindex
- keep one H1 per exposed page
- keep CSS/mobile QA active every pass

## Why this direction makes sense

The company is not only a recurring landscaping business. It also takes project/construction jobs and subcontract dispatch work. That means the system has to support three realities at once:
- recurring service operations
- project/work-order delivery
- standalone or linked HSE workflows

External planning references that support this direction:
- OSHA landscaping hazards and standards: machinery, heat/cold, lifting, pesticides/chemicals, maintenance work, and construction activity
- IRS small-business and depreciation guidance: ordinary expenses, tangible property handling, and equipment depreciation all support a digital, structured materials/equipment/accounting model

Planning references:
- https://www.osha.gov/landscaping/hazards
- https://www.osha.gov/landscaping
- https://www.irs.gov/publications/p334
- https://www.irs.gov/publications/p946
- https://www.irs.gov/businesses/small-businesses-self-employed/tangible-property-final-regulations

### Track 6 — Admin UI on new operations/accounting tables
The next implementation layer should expose the new schema through real admin screens:
- estimate/work-order manager
- materials + units manager
- route/service-area manager
- subcontract dispatch manager
- AR/AP + chart-of-accounts admin screens

Each manager should support:
- list/filter/search
- create/edit/archive
- populated dropdowns from shared DB-backed catalogs
- mobile-friendly forms for quick edits in the field
- desktop-dense tables for office/admin users
