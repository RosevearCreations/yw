# Database Structure

Last refreshed: **2026-05-15c**

## Latest migration

`sql/109_pagination_close_wizard_audit_backup_mobile_foundations.sql`

## New schema 109 areas

- `admin_close_step_events`: event history for guided close complete/reopen/update actions.
- Added owner/due/blocker/completion fields to `admin_close_workflow_steps`.
- `admin_audit_events`: central audit event log.
- `admin_list_pagination_settings`: DB-backed page-size/sort defaults for large admin lists.
- `bank_csv_import_sessions` and `bank_csv_import_rows`: staging foundation for bank CSV import and duplicate detection.
- `admin_backup_restore_rehearsals`: restore rehearsal and rollback proof tracking.
- `admin_evidence_action_queue`: queue for evidence follow-up, retry, replace, archive, and blocked proof work.
- `admin_mobile_action_cards`: worker/supervisor mobile dashboard planning cards.

## New or replaced views

- `v_admin_close_wizard_steps`
- `v_admin_audit_event_directory`
- `v_admin_list_pagination_settings`
- `v_bank_csv_import_session_directory`
- `v_admin_backup_restore_rehearsal_directory`
- `v_admin_evidence_action_queue`
- `v_admin_mobile_action_card_directory`
- `v_schema_drift_status` now expects schema **109**

## Apply order

Apply all migrations in order through schema **109**. The canonical reference is `sql/000_full_schema_reference.sql`.
