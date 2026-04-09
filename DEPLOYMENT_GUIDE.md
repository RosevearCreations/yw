## 2026-04-08 landscaping/construction/mobile/admin-ui pathway documentation pass
- Refreshed the Markdown set to move the product direction from schema-only groundwork into the next implementation phase: admin UI managers for estimates/work orders, materials/units, routes/service areas, subcontract dispatch, and AR/AP + chart of accounts.
- Added a clearer rationale for keeping HSE as a first-class standalone module that can later link to jobs, sites, and dispatches for landscaping, project, and subcontract work.
- Updated the docs to emphasize mobile-first field use, desktop-strong admin depth, DB-first shared data, and local SEO / one-H1 discipline on every public build pass.

> Last synchronized: April 8, 2026. Reviewed during the estimates/work-orders/routes/materials/subcontract/general-ledger foundation and documentation synchronization pass.

# Deployment Guide

Last synchronized: April 8, 2026

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
