# Deployment Guide

Last refreshed: **2026-05-16b**

## Deploy checklist

1. Apply SQL through `sql/111_admin_directory_pagination_saved_view_replay.sql`.
2. Deploy Supabase Edge Function changes:
   - `admin-directory`
   - `admin-manage` if the live function is behind the saved-filter support pass.
3. Deploy static files to the hosting target.
4. Clear/unregister the service worker or hard refresh.
5. Confirm frontend assets load with `?v=2026-05-16b`.

## Smoke test

```bash
node scripts/repo-smoke-check.mjs
```

## Manual browser test

- Open the app on desktop.
- Open Admin > People and Access.
- Search Staff Directory.
- Change role filter.
- Change page size.
- Use Previous/Next.
- Save a view and press Use to confirm Staff filters replay.
- Open the same Admin screen at phone width and confirm the controls stack cleanly.
