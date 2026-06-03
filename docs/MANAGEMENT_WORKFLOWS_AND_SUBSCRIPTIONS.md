<!-- Reviewed during 2026-05-06 accounting close, reconciliation, and backend accounting coverage pass. -->
<!-- Reviewed during 2026-05-05 migration compatibility and commercial-schema sync pass. -->
# Management Workflows and Subscriptions

This pass moves the safety system from historical reporting into management workflow support.

## Added in migration 092
- Corrective-action reminder and escalation fields.
- Worker self-service training acknowledgements.
- Training verification / self-attestation tracking.
- SDS/product/job/route/equipment context fields.
- Report subscriptions and report delivery candidate views.
- Site safety scorecards.
- Supervisor scorecards.
- Overdue alert rollups.
- Equipment-specific JSA / hazard linkage.

## Why this matters
The strongest value of this application is linking safety activity to the operational backbone: jobs, work orders, routes, contracts, evidence review, scheduler runs, and payroll history. This pass continues that direction by making open work visible and manageable rather than storing more isolated forms.

## Main tables
- `corrective_action_tasks`
- `corrective_action_task_events`
- `training_courses`
- `training_records`
- `sds_acknowledgements`
- `report_subscriptions`
- `equipment_jsa_hazard_links`

## Main views
- `v_corrective_action_task_directory`
- `v_report_subscription_directory`
- `v_report_delivery_candidates`
- `v_site_safety_scorecards`
- `v_supervisor_scorecards`
- `v_overdue_action_alerts`
- `v_supervisor_safety_queue`
- `v_equipment_jsa_hazard_link_directory`

## Best next testing
1. Create or update a corrective action, record a reminder, then escalate it.
2. Submit a worker self-acknowledged training record and confirm it appears with verification pending when required.
3. Record an SDS acknowledgement with product/job/route/equipment context and confirm it appears in alerts and queue views.
4. Create a report subscription with a next send date in the past and confirm it appears in delivery candidates.
5. Create an equipment JSA / hazard link and confirm it appears in the queue and overdue alerts.

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

_Last refreshed: **2026-06-02b**_

_Reviewed in the 2026-05-17a pass for schema 112 documentation consistency._

<!-- 2026-05-29a pass: Schema 123 equipment verification, accounting-depth, SEO/H1, CSS, fallback, and roadmap sanity refresh. -->

<!-- 2026-06-02a pass: schema 126 roadmap depth, data migration candidates, SEO/CSS/fallback guardrails, Admin readiness visibility, archive hygiene, cache marker, and Markdown refresh. -->

<!-- 2026-06-02a pass: schema 126 roadmap depth, data migration candidates, SEO/CSS/fallback guardrails, Admin readiness visibility, archive hygiene, cache marker, and Markdown refresh. -->
<!-- 2026-06-02b pass: schema 127 public route SEO registry, internal links, CSS token inventory, mobile field actions, release manifest checks, Admin readiness visibility, scan fallback, archive hygiene, cache marker, and Markdown refresh. -->
