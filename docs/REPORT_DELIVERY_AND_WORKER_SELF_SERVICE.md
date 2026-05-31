<!-- Reviewed during 2026-05-06 accounting close, reconciliation, and backend accounting coverage pass. -->
<!-- Reviewed during 2026-05-05 migration compatibility and commercial-schema sync pass. -->
# Report Delivery and Worker Self-Service

Latest pass focus:
- actual scheduled report-subscription delivery through a dedicated Edge Function and scheduler settings
- worker self-service training acknowledgements in My Profile
- worker SDS prompt queue and self-acknowledgement workflow
- preparation for the next Jobs commercial/accounting pass

## What was added

- `sql/093_report_delivery_and_worker_self_service.sql`
- `supabase/functions/report-subscription-delivery-run/`
- self-scope training and SDS datasets in `admin-directory`
- worker self-service training and SDS actions in `admin-manage`
- My Profile self-service UI for training and SDS acknowledgement
- report delivery run history and scheduler status views

## Deployment note

Scheduled report delivery reuses the same scheduler secret pattern already used by the service execution scheduler. After deploying the new Edge Function, set the new invoke URL in `report_delivery_scheduler_settings` and enable the default row.

## Best next Jobs move

After report delivery and worker self-service are live, move into the Jobs commercial/accounting pass:
- quote and estimate conversion discipline
- approvals and discount controls
- costing/completion review
- accounting-ready completion trigger
- closed-job financial evaluation queue

## Latest pass note (2026-04-25d)
- Synced for scheduled report delivery, worker self-service training/SDS acknowledgement, and Jobs commercial/accounting foundation planning.

## 2026-04-26 pass note

This pass moves the project into the Jobs commercial/accounting phase.
It adds the 094 Jobs commercial workflow foundation, updates the repo status toward estimate/work-order/completion/accounting readiness, and keeps the schema/docs aligned for the next phase.


## Pass 096 notes

This pass adds branded quote output, automatic threshold evaluation, closeout evidence linkage, invoice/journal posting-rule structures, accountant handoff exports, and profitability/variance scorecards for the Jobs commercial workflow.

---

## 2026-05-15c update

Schema **109** added production-readiness foundations: admin list pagination settings, guided close step actions and event history, admin audit events, bank CSV import staging, evidence action queue, backup/restore rehearsal tracking, and worker/supervisor mobile action cards. Active roadmap and known gaps were refreshed, retired root Markdown was archived again, temp files were removed again, and the one-H1 rule was rechecked.


## 2026-05-16a update

- Added compact expandable mobile main navigation so the app no longer opens as a long route list on phones.
- Added compact expandable Admin section navigation for small screens.
- Added schema 110 frontend quality gates and updated active Markdown/schema references.

_Last refreshed: **2026-05-20b**_

_Reviewed in the 2026-05-17a pass for schema 112 documentation consistency._

<!-- 2026-05-29a pass: Schema 123 equipment verification, accounting-depth, SEO/H1, CSS, fallback, and roadmap sanity refresh. -->

<!-- 2026-05-30a pass: schema 124 accounting depth, equipment accountability, SEO/H1/CSS/smoke, and roadmap refresh. -->
