## 2026-04-07 estimates/work-orders/routes/materials/subcontract/GL foundation pass
- Added schema foundation migration `061_estimates_work_orders_routes_materials_and_gl_foundation.sql` and updated the development guidance so future passes build the admin/data backbone instead of circling older shell issues.

# Development Guide

Last synchronized: April 7, 2026

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
