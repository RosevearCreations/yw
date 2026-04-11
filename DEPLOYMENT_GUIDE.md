> Last synchronized: April 10, 2026. Reviewed during the receipt rollups, work-order operational status, posted/open amount visibility, and admin workflow sync pass.

## 2026-04-09 workflow rollups, posting, receiving-costing, and HSE closeout pass

## Deployment note for this pass
After deploying this pass, validate migration 063 before trusting Admin totals:
- create/update estimate lines and confirm estimate header rollups change
- create/update work-order lines and confirm work-order rollups change
- add receipt lines against a work order and confirm received-cost visibility changes
- post AR/AP payments and confirm amount-paid / balance-due update
- toggle HSE packet completion fields and confirm status/progress transitions

- Added DB-first workflow logic so estimate, work-order, and material-receipt header totals can roll up from their line records instead of depending on manual entry.
- Added receivables/payables payment-application logic so invoices and bills can track paid amounts, remaining balance, and partial/paid status from posted payments.
- Added receiving-to-costing linkage so material receipt lines can feed received quantity / received cost visibility back into work-order execution.
- Extended linked HSE packets toward real progress and closeout handling with checklist-style completion fields, derived progress, and clearer Admin-side visibility.


## 2026-04-08 landscaping/construction/mobile/admin-ui pathway documentation pass
- Refreshed the Markdown set to move the product direction from schema-only groundwork into the next implementation phase: admin UI managers for estimates/work orders, materials/units, routes/service areas, subcontract dispatch, and AR/AP + chart of accounts.
- Added a clearer rationale for keeping HSE as a first-class standalone module that can later link to jobs, sites, and dispatches for landscaping, project, and subcontract work.
- Updated the docs to emphasize mobile-first field use, desktop-strong admin depth, DB-first shared data, and local SEO / one-H1 discipline on every public build pass.

> Last synchronized: April 8, 2026. Reviewed during the estimates/work-orders/routes/materials/subcontract/general-ledger foundation and documentation synchronization pass.

# Deployment Guide

## April 10, 2026 deployment note
- Apply `sql/064_receipt_rollups_work_order_operational_status_and_posted_amounts.sql` after 063.
- Deploy the updated `admin-selectors` and `admin-manage` edge functions together with the frontend so the new rollup fields and smart defaults stay aligned.
- Run the repo smoke check after deploy and verify the new migration file exists in the deployed repo snapshot.

Last synchronized: April 10, 2026

## Deployment principles

Deployments should now be treated as operations-critical because session integrity and role trust are central to the app.

## Always deploy together when changed
- frontend shell/assets
- Supabase Edge Functions
- SQL migrations
- Markdown/schema notes for the same pass

## High-risk deployment areas
- auth/session logic
- role evaluation
- logout flow
- review-list and other CORS-sensitive functions
- admin selectors / protected directory functions

## Required post-deploy checks
1. confirm the new shell version is loaded
2. sign in as Admin
3. move through multiple screens
4. confirm the header identity stays correct
5. confirm Settings still shows the same account data
6. confirm logout works every time
7. confirm Logbook/review-list works without CORS failure
8. confirm Admin dropdowns, staff, equipment, and jobs still load

## Current deployment focus
- keep public pages SEO-clean with one H1 each
- verify the newest shell version after each deploy
- deploy schema changes before the admin screens that depend on them
- treat admin managers for estimates, materials, routes, dispatch, and AR/AP as the next major rollout wave

## 2026-04-10 crew assignment, recurring jobs, and field activity pass
- Job creation now has a clearer ownership path: a crew can be assigned at the same time as an explicit supervisor so responsibility is visible from the start.
- Jobs now support standalone or recurring scheduling fields, with recurrence summary/rule storage in the database instead of leaving schedule logic only in draft UI state.
- Job comments now have a DB-backed activity trail with optional photo attachments and special-instruction flags so crews and supervisors can review site notes, uploaded images, and field changes in one place.
- This pass continues the DB-first direction for shared operational data and reduces duplication risk compared with keeping crew/job packet details only in local JSON or loosely coupled browser state.
- After deploy, verify the upload-job-comment-attachment function is published and the `submission-images` bucket allows the expected signed upload/read flow.
