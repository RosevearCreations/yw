# Deployment Guide

Last refreshed: **2026-05-28a**

## Deploy checklist

1. Apply all migrations through `sql/122_mobile_form_stepper_draft_resume_guardrails.sql`.
2. Confirm `sql/000_full_schema_reference.sql` includes schema **122**.
3. Redeploy `supabase/functions/admin-directory`.
4. Confirm `index.html`, `server-worker.js`, and `manifest.json` use cache marker **2026-05-28a**.
5. Hard refresh or clear/unregister the service worker after deploy.
6. Test Admin Command Center and Health scopes.
7. Test phone routes: `#today`, `#toolbox`, `#incident`, `#ppe`, `#firstaid`, `#inspect`, `#drill`, and `#jobs`.
8. Save and resume one mobile form draft before declaring the mobile pass complete.

## Rollback note

If the mobile helper causes trouble, remove the `js/mobile-form-helper.js` script tag and service-worker cache entry. Existing form submit/outbox modules should continue to work.
