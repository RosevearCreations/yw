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
