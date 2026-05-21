# Deployment Guide

Last refreshed: **2026-05-20b**

## Required deployment order

1. Apply SQL migrations through **schema 119**.
2. Redeploy Supabase Edge Function `admin-directory`.
3. Redeploy `admin-manage` if it is not already current.
4. Deploy the updated site bundle.
5. Hard refresh or unregister the service worker so `2026-05-20b` assets load.

## Important live checks

After deployment, open Admin > Readiness and confirm:

- Schema preflight table is visible.
- Action permission table is visible.
- Panel retry policy table is visible.
- Function readiness table includes last-checked/signoff columns.
- Known risky buttons disable for roles below the DB registry requirement.

## If Admin still shows cached data

- Confirm schema 119 was applied.
- Confirm `admin-directory` was redeployed after the schema change.
- Clear/unregister the service worker.
- Open the browser console and check whether the failed panel is named in Admin diagnostics.
