# Production Readiness Checklist

Last refreshed: **2026-05-15b**

## Current readiness foundations

- Schema drift table/view exists through schema 108.
- Production readiness checklist rows exist.
- Role permission matrix exists.
- Deployment gate table/view exists.
- Public SEO smoke-check table/view exists.
- Admin Health can log resolution notes.

## Remaining before production confidence

- Run role-by-role RLS and Edge Function permission tests.
- Add backup/restore rehearsal proof.
- Automate deployment gate updates.
- Add server-side pagination to large admin lists.
- Convert close overview into a write-enabled wizard.
