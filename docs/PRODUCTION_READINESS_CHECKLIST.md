# Production Readiness Checklist

Last refreshed: **2026-05-15a**

## Before production use

- Apply all migrations through latest schema.
- Confirm `app_schema_versions` shows latest schema.
- Verify Supabase RLS policies for every sensitive table.
- Verify Edge Function auth checks.
- Verify environment variables.
- Verify CORS behaviour.
- Verify backups and restore test.
- Verify service worker cache version.
- Verify no stale app files deploy.
- Verify Admin Health Center is clean or has expected warnings only.
- Verify role permission matrix.
- Verify accounting close/reopen audit trail.
- Verify export package contents.
- Verify report subscription delivery and scheduler logs.
- Verify upload failure retry path.
- Verify mobile field-worker screens.

## Production definition

The app should not be treated as production-ready until security, backup, restore, schema drift, role permissions, and accounting close/export flows are all verified with live records.
