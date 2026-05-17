# Production Readiness Checklist

Last refreshed: **2026-05-16b**

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

---

## 2026-05-15c update

Schema **109** added production-readiness foundations: admin list pagination settings, guided close step actions and event history, admin audit events, bank CSV import staging, evidence action queue, backup/restore rehearsal tracking, and worker/supervisor mobile action cards. Active roadmap and known gaps were refreshed, retired root Markdown was archived again, temp files were removed again, and the one-H1 rule was rechecked.


## 2026-05-16a update

- Added compact expandable mobile main navigation so the app no longer opens as a long route list on phones.
- Added compact expandable Admin section navigation for small screens.
- Added schema 110 frontend quality gates and updated active Markdown/schema references.

_Reviewed in the 2026-05-16b pass for schema 111 documentation consistency._
