# Admin Command Center and Health

Last refreshed: **2026-05-15b**

The Admin Command Center now includes DB-backed dashboard counts, saved admin views, App Health, schema drift, task inbox, Guided Close Center, Evidence Manager, deployment gates, and SEO smoke checks.

## Schema 108 additions

- Saved views can be created, used, and deleted through `admin-manage`.
- Health and evidence follow-ups create `admin_health_resolution_notes` records.
- Deployment gates can be marked passed by an admin.
- SEO smoke-check rows prepare the app for public-page scanning.

## Next

Add full filter replay, assignment/dismiss/reopen workflow for health items, and automated deployment-gate updates from CI scripts.
