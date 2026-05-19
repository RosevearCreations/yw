# Deployment Guide

Last refreshed: **2026-05-18b**

## Required order

1. Apply SQL migrations through `sql/115_admin_panel_retry_timing_and_command_scope.sql`.
2. Redeploy Supabase Edge Functions:
   - `admin-directory`
   - `admin-manage`
   - `report-subscription-delivery-run`
3. Deploy the static site.
4. Hard refresh the browser or unregister the service worker so `2026-05-18b` assets load.

## Post-deploy checks

- Open `#admin` and confirm no immediate cached-only fallback appears.
- Confirm Admin panel timing cards show Command Center, Health, People, Operations, and Accounting.
- Press Retry Command Center, Retry Health, Refresh Staff Only, Refresh Jobs Only, and Retry Accounting.
- Confirm `report-subscription-delivery-run` bundles without unterminated regexp/string literal errors.
