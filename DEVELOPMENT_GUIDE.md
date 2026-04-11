> Last synchronized: April 10, 2026. Reviewed during the receipt rollups, work-order operational status, posted/open amount visibility, and admin workflow sync pass.

## 2026-04-09 workflow rollups, posting, receiving-costing, and HSE closeout pass

## Developer note for this pass
When adding future workflow managers, prefer this implementation order:
1. add or adjust tables/columns
2. add DB-side rollup / derivation logic
3. expose through selectors/manage functions
4. add Admin UI helpers / previews
5. update docs + schema snapshot in the same pass

- Added DB-first workflow logic so estimate, work-order, and material-receipt header totals can roll up from their line records instead of depending on manual entry.
- Added receivables/payables payment-application logic so invoices and bills can track paid amounts, remaining balance, and partial/paid status from posted payments.
- Added receiving-to-costing linkage so material receipt lines can feed received quantity / received cost visibility back into work-order execution.
- Extended linked HSE packets toward real progress and closeout handling with checklist-style completion fields, derived progress, and clearer Admin-side visibility.


## 2026-04-08 landscaping/construction/mobile/admin-ui pathway documentation pass
- Refreshed the Markdown set to move the product direction from schema-only groundwork into the next implementation phase: admin UI managers for estimates/work orders, materials/units, routes/service areas, subcontract dispatch, and AR/AP + chart of accounts.
- Added a clearer rationale for keeping HSE as a first-class standalone module that can later link to jobs, sites, and dispatches for landscaping, project, and subcontract work.
- Updated the docs to emphasize mobile-first field use, desktop-strong admin depth, DB-first shared data, and local SEO / one-H1 discipline on every public build pass.

## 2026-04-07 estimates/work-orders/routes/materials/subcontract/GL foundation pass
- Added schema foundation migration `061_estimates_work_orders_routes_materials_and_gl_foundation.sql` and updated the development guidance so future passes build the admin/data backbone instead of circling older shell issues.

# Development Guide

## April 10, 2026 implementation guide update
- Run migration 064 after 063.
- After deploy, verify material receipt totals, allocated/unallocated cost, work-order rollups, and AR/AP posted/open values from the Admin backbone manager.
- Treat the new rollup fields as read-only visibility driven by DB views, not hand-edited values.

## April 9, 2026 implementation guide update
- Treat `063_workflow_rollups_posting_and_hse_closeout.sql` as the current schema step after the 061/062 foundation passes.
- When building the next Admin screens, prioritize create/edit/delete flows for route stops, estimate lines, work-order lines, AR/AP payments, material receiving, and linked HSE packets.
- Keep DB-first selectors as the source of truth for units, cost codes, service areas, routes, materials, equipment, clients, sites, and staff.
- Preserve standalone HSE entry points for unscheduled work even while linked HSE packets are added for formal work orders and dispatches.


Last synchronized: April 10, 2026

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

## Admin backbone completion target
The primary office interface should let Admin users maintain:
- units of measure
- cost codes
- service areas and routes
- clients and client sites
- materials and equipment masters
- estimates and work orders
- subcontract clients and dispatches
- chart of accounts, vendors, AR invoices, and AP bills

The primary field interface should remain the HSE workflow group:
- Toolbox Talk
- PPE Check
- First Aid Kit
- Site Inspection
- Emergency Drill
- Logbook / review

These must remain usable on phones and on unscheduled work that does not start from a formal estimate/work-order.

## 2026-04-10 crew assignment, recurring jobs, and field activity pass
- Job creation now has a clearer ownership path: a crew can be assigned at the same time as an explicit supervisor so responsibility is visible from the start.
- Jobs now support standalone or recurring scheduling fields, with recurrence summary/rule storage in the database instead of leaving schedule logic only in draft UI state.
- Job comments now have a DB-backed activity trail with optional photo attachments and special-instruction flags so crews and supervisors can review site notes, uploaded images, and field changes in one place.
- This pass continues the DB-first direction for shared operational data and reduces duplication risk compared with keeping crew/job packet details only in local JSON or loosely coupled browser state.
- Field workflow expectation: supervisors and crews should be able to review special instructions and site photos without needing to hunt across separate pages.
