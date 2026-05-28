# Deployment Guide

Last refreshed: **2026-05-27a**

## Required order

1. Apply SQL migrations through schema 121.
2. Redeploy `supabase/functions/admin-directory`.
3. Deploy the static app assets.
4. Clear/unregister the browser service worker or hard refresh.
5. Confirm `server-worker.js` and `index.html` reference `2026-05-27a`.

## Post-deploy checks

- `/#today` loads as the default route.
- Mobile quick nav shows Today, Talk, Incident, Safety, Jobs, and Admin.
- Queue badges appear after a failed/queued submission or action.
- PWA install helper appears when not installed.
- Admin still loads staged scopes and shows retry/timing status.
- Exposed app shell has one H1.
