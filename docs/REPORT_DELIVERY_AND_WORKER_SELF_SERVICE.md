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
