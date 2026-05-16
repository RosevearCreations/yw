# Database Structure

Last refreshed: **2026-05-15c**

## Latest schema

Latest active migration: `sql/107_admin_readiness_drilldowns_and_live_schema_fix.sql`.

## Important schema notes

- `public.app_schema_versions` is created before schema/health views read it.
- `public.v_schema_drift_status` reports whether live DB is behind the repo marker.
- `public.v_admin_home_command_center` uses `jobs.status`, avoiding the previous `jobs.job_status` live error.
- `public.admin_saved_filters` is the foundation for admin saved views.
- `public.admin_production_readiness_checks` seeds production sign-off checks.
- `public.admin_role_permission_matrix` provides a visible role/workflow matrix.
- `public.v_admin_close_center_overview` summarizes close blockers.
- `public.v_evidence_manager_directory` unifies failed uploads, attendance photo review, and HSE evidence review.

Apply SQL through schema 107 before treating this build as synced.

---

## 2026-05-15c update

Schema **109** added production-readiness foundations: admin list pagination settings, guided close step actions and event history, admin audit events, bank CSV import staging, evidence action queue, backup/restore rehearsal tracking, and worker/supervisor mobile action cards. Active roadmap and known gaps were refreshed, retired root Markdown was archived again, temp files were removed again, and the one-H1 rule was rechecked.
