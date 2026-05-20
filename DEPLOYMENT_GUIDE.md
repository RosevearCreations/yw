# Deployment Guide

Last refreshed: **2026-05-19a**

## Deploy order

1. Apply SQL through schema **116**.
2. Deploy Supabase functions:
   - `admin-directory`
   - `admin-manage`
   - `report-subscription-delivery-run` if the previous bundle fix is not live yet.
3. Deploy the site build.
4. Clear/unregister service worker cache or hard refresh.
5. Test Admin on desktop and mobile width.

## Live checks

- Admin loads without falling immediately to cached data.
- Health panel shows scope timing cards.
- Panel diagnostics drawer expands.
- Stale-data badges show either current age or retry/error state.
- Failed panel requests create rows in `admin_panel_load_diagnostics`.
- `v_schema_drift_status.expected_schema_version` returns `116`.
