# Deployment Guide

Last refreshed: **2026-05-18a**

## Required steps

1. Apply SQL through schema 114.
2. Redeploy Supabase functions:
   - `admin-directory`
   - `admin-manage`
   - `admin-selectors` if selectors were changed in the previous deployment
3. Deploy the static site.
4. Clear/unregister the service worker or hard refresh until files load with `?v=2026-05-18a`.
5. Open `/#admin` and confirm the live Admin load does not immediately show cached fallback data.

## Live Admin smoke test

- Open Admin.
- Confirm staged requests return for `health`, `people`, `operations`, and `accounting`.
- Confirm Staff and Jobs pagination still work.
- Confirm panel-only refresh buttons work.
- Confirm cached fallback only appears if live requests truly fail.
