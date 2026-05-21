# Admin Command Center and Health

Last refreshed: **2026-05-20b**

The Admin Command Center now includes DB-backed dashboard counts, saved admin views, App Health, schema drift, task inbox, Guided Close Center, Evidence Manager, deployment gates, and SEO smoke checks.

## Schema 108 additions

- Saved views can be created, used, and deleted through `admin-manage`.
- Health and evidence follow-ups create `admin_health_resolution_notes` records.
- Deployment gates can be marked passed by an admin.
- SEO smoke-check rows prepare the app for public-page scanning.

## Next

Add full filter replay, assignment/dismiss/reopen workflow for health items, and automated deployment-gate updates from CI scripts.

---

## 2026-05-15c update

Schema **109** added production-readiness foundations: admin list pagination settings, guided close step actions and event history, admin audit events, bank CSV import staging, evidence action queue, backup/restore rehearsal tracking, and worker/supervisor mobile action cards. Active roadmap and known gaps were refreshed, retired root Markdown was archived again, temp files were removed again, and the one-H1 rule was rechecked.


## 2026-05-16a update

- Added compact expandable mobile main navigation so the app no longer opens as a long route list on phones.
- Added compact expandable Admin section navigation for small screens.
- Added schema 110 frontend quality gates and updated active Markdown/schema references.

_Reviewed in the 2026-05-17a pass for schema 112 documentation consistency._
