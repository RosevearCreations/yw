# YWI App Build Handoff

Last refreshed: **2026-05-19a**

This build continues the staged Admin production-readiness work. It adds an Admin diagnostics drawer, stale-data age badges, and persisted failed-panel load diagnostics.

## What changed in this build

- Added schema **116**.
- Added mobile-safe Admin diagnostics drawer.
- Added stale-data age badges for staged Admin panels.
- Added `admin_panel_load_diagnostic` write support in `admin-manage`.
- Updated `admin-directory` to load persisted diagnostics.
- Updated active Markdown, schema reference, smoke checks, and cache version.

## Required deployment steps

1. Apply SQL migrations through `sql/116_admin_diagnostics_drawer_and_stale_data_badges.sql`.
2. Redeploy Supabase functions:
   - `admin-directory`
   - `admin-manage`
3. Clear or unregister the service worker and hard refresh.
4. Open Admin, expand App Health diagnostics, and confirm badges show current or stale state.
