# Backup and Restore Plan

Last refreshed: **2026-05-15a**

## What must be backed up

- Supabase Postgres database.
- Supabase storage/media buckets.
- HSE evidence files.
- Job/route/equipment attachments.
- Accounting exports and handoff packages.
- Environment variable names and deployment settings.

## Minimum restore test

1. Export database.
2. Export storage metadata and files.
3. Restore to a test Supabase project.
4. Apply migrations through latest schema.
5. Deploy Edge Functions.
6. Deploy static app.
7. Confirm login, Admin, Jobs, HSE Ops, Reports, and accounting views load.
8. Confirm media links/signatures are reachable.

## Next automation step

Create a script or checklist that records export time, schema version, storage bucket list, and restore test result.
