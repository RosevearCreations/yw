# Deployment Guide

Last refreshed: **2026-05-19b**

## Required deployment order

1. Apply SQL through schema 117.
2. Redeploy Supabase Edge Functions:
   - `admin-directory`
   - `admin-manage`
3. Deploy the static site files.
4. Hard refresh or unregister the service worker.
5. Test `#admin` on desktop and mobile.

## Live checks

- Admin should load staged panels instead of immediately using cached fallback.
- Accounting Close, Banking, Tax/Payroll, and Evidence should have separate status cards.
- Evidence Manager should have a Retry Evidence button and age badge.
- Job Complete/Cancel, close step Complete/Reopen, health Resolve, deployment gate update, and evidence Follow up should all ask for confirmation.
