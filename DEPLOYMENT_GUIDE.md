> Last synchronized: April 7, 2026. Reviewed during the estimates/work-orders/routes/materials/subcontract/general-ledger foundation and documentation synchronization pass.

# Deployment Guide

Last synchronized: April 7, 2026

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
