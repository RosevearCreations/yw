# Deployment Guide

Last refreshed: **2026-05-17b**

1. Apply database migrations through schema **113**.
2. Redeploy Supabase Edge Functions:
   - `admin-directory`
   - `admin-manage`
3. Deploy static files.
4. Clear service worker/browser cache.
5. Run smoke checks.
6. Verify Admin on mobile width and desktop width.

## Post-deploy checks

- Admin Health reports schema 113 current.
- Refresh Staff Only works.
- Refresh Jobs Only works.
- Jobs row action Add Note works on a safe test job.
- Jobs Complete/Cancel are tested only on disposable/demo jobs first.
