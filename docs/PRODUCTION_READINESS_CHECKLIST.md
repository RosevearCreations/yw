# Production Readiness Checklist

Last refreshed: **2026-05-14b**

Schema 107 adds the first DB-backed readiness checklist. The Admin UI now shows the checklist plus schema drift and permission rows.

## Required before real production use

- Schema drift shows current.
- RLS reviewed role-by-role.
- Backups and restore test completed.
- Error/health center monitored after deploy.
- Accounting close blockers clear before period lock.
- Public pages, if added, pass SEO/H1/asset checks.
