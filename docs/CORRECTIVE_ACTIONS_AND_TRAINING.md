# Corrective Actions, Training, and SDS Tracking

This pass adds a management-focused safety layer on top of the incident and historical-reporting work.

## What is new

- First-class `corrective_action_tasks` tied back to incident / near-miss submissions.
- `corrective_action_task_events` so follow-up, escalation, and closeout history are visible.
- `training_courses` for a DB-backed catalog of recurring safety and certification requirements.
- `training_records` for worker training, certification, and expiry tracking.
- `sds_acknowledgements` for worker acknowledgement history tied to chemical / product review.
- Reporting views for open corrective actions, overdue work, expiring training, expiring SDS acknowledgements, and a supervisor safety queue.

## Practical value

This shifts reporting from passive history into a management tool:

- incidents can drive actionable follow-up tasks
- overdue follow-up work becomes visible
- worker training and certification expiry can be monitored centrally
- SDS acknowledgement can be tracked by worker and product
- supervisors can review one queue instead of hunting through separate tables

## Main schema objects

- `corrective_action_tasks`
- `corrective_action_task_events`
- `training_courses`
- `training_records`
- `sds_acknowledgements`
- `v_corrective_action_task_directory`
- `v_corrective_action_task_summary`
- `v_training_course_directory`
- `v_training_record_directory`
- `v_training_expiry_summary`
- `v_sds_acknowledgement_directory`
- `v_supervisor_safety_queue`

## UI impact

The Historical Reports screen now surfaces:

- supervisor safety queue
- corrective actions
- training / certification records
- SDS acknowledgements
- export-ready CSV outputs for corrective actions and training

## Next likely build steps

- turn corrective-action reminders into scheduled report delivery and escalation
- add training assignment workflows and worker self-acknowledgement
- connect SDS acknowledgement to chemical / product catalogs and HSE packet context
- add equipment-specific JSA / hazard-assessment linkage
- add OSHA recordkeeping helpers only if the workflow needs formal log support

## Latest pass note (2026-04-25d)
- Synced for scheduled report delivery, worker self-service training/SDS acknowledgement, and Jobs commercial/accounting foundation planning.
