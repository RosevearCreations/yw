# Deployment Guide

Last refreshed: **2026-05-14b**

## Required order

1. Apply SQL migrations through `sql/107_admin_readiness_drilldowns_and_live_schema_fix.sql`.
2. Redeploy Supabase Edge Functions, especially `admin-directory` and `admin-selectors`.
3. Deploy the static app files.
4. Hard refresh the app or clear service worker cache.
5. Open Admin and verify:
   - Command Center renders.
   - Health shows schema 107/current.
   - Guided Close Center renders.
   - Evidence Manager renders.
   - Production Readiness and Permissions render.

## Console checks

- No `public.app_schema_versions does not exist` SQL error.
- No `jobs.job_status does not exist` SQL/API error.
- No reports timeout on `#admin`.
- No missing script/style/icon assets.
