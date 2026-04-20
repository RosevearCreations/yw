<!-- Reviewed during schema 082 site activity audit / admin recent-activity pass on 2026-04-18. -->
<!-- Reviewed during schema 080 recurring agreements / payroll / asset history / login tracking pass on 2026-04-17. -->
## 2026-04-13 staff admin save verification pass
- Added visible inline create/save/reset/block/delete confirmations in the Staff Directory screen so staff actions no longer fail silently from the operator’s point of view.
- Added stronger front-end email and password validation plus busy-state feedback for staff actions.
- Updated `supabase/functions/admin-manage/index.ts` so staff-detail saves now persist email changes instead of leaving the visible Email field unsaved.
- No new SQL migration was added in this pass; schema files were reviewed and remain on the 074 baseline.

> Last synchronized: April 14, 2026 (landscaping job workflow, crew planning, and schema 075)

## 2026-04-12 schema synchronization note
- Added migration `sql/074_hse_control_cues_and_inspection_focus.sql`.
- `linked_hse_packets` and `hse_packet_events` now expose structured machinery/tool, lifting/posture, weather/heat, and chemical/public-interaction cue fields instead of relying only on broad notes.
- `public.v_hse_packet_progress`, `public.v_hse_packet_action_items`, and `public.v_hse_dashboard_summary` were refreshed so the HSE shell can keep those control categories visible.
- `sql/000_full_schema_reference.sql` has been synchronized forward through 074 for new chats and rebuilds.

> Last synchronized: April 12, 2026 (schema 074 appended to the reference snapshot)

> Last synchronized: April 12, 2026 (schema 073 appended to the reference snapshot)

> Last synchronized: April 11, 2026 (admin focus buttons, HSE action-item summaries, and monitor threshold pass)

## 2026-04-11 schema additions
- `linked_hse_packets` now supports packet scope, optional job/equipment linkage, unscheduled project fields, weather/heat/chemical/traffic workflow flags, and field signoff tracking.
- New `hse_packet_events` provides DB-backed workflow/event history for weather checks, heat checks, chemical handling, traffic/public interaction, signoff, closeout, reopen, and note/hazard events.
- `v_hse_packet_progress` now rolls packet events into the HSE progress model instead of relying only on proof rows and top-level booleans.

## 2026-04-11 journal sync exceptions and upload fallback pass
- Added migration `sql/068_journal_sync_exceptions_and_upload_failure_fallback.sql`.
- Added DB-backed `gl_journal_sync_exceptions` so stale, unbalanced, and missing-entry source batches are visible as first-class review items instead of hidden batch-state guesses.
- Added DB-backed `field_upload_failures` so failed job-comment and equipment-evidence uploads leave an auditable fallback trail for retry/resolution instead of failing silently.
- Extended Admin selectors/directory/manage/UI so sync exceptions and upload failures can be reviewed, resolved, or dismissed from the same backbone shell.
- Tightened job activity upload handling so comments can still save even when attachments fail, with clearer operator feedback and follow-up visibility.


## 2026-04-10 journal posting controls and material issue / usage pass
- Added migration `sql/066_journal_posting_controls_and_material_issue_usage.sql`.
- Added DB-side journal-batch rollups so line count, debit total, credit total, and balanced state are derived instead of tracked manually.
- Added DB-backed `material_issues` and `material_issue_lines` so receiving can progress into job usage, issued-cost totals, and variance visibility.
- Extended the Admin backbone so journal batches, journal entries, material issues, and material issue lines can be created and managed from the same operational shell.
- Continued the DB-first direction for shared operational data while keeping the next highest-value gaps visible: route execution lifecycle, HSE proof/reopen, and stronger source-to-journal automation.

## 2026-04-09 workflow rollups / posting / costing / HSE closeout pass
- Mirror the root database doc: the latest schema direction now includes rollup triggers, balance recalculation, receiving-to-costing linkage, and HSE completion/closeout state.
- Treat `063_workflow_rollups_posting_and_hse_closeout.sql` as the next required migration after 062.


## 2026-04-08 landscaping/construction/mobile/admin-ui pathway documentation pass
- Refreshed the Markdown set to move the product direction from schema-only groundwork into the next implementation phase: admin UI managers for estimates/work orders, materials/units, routes/service areas, subcontract dispatch, and AR/AP + chart of accounts.
- Added a clearer rationale for keeping HSE as a first-class standalone module that can later link to jobs, sites, and dispatches for landscaping, project, and subcontract work.
- Updated the docs to emphasize mobile-first field use, desktop-strong admin depth, DB-first shared data, and local SEO / one-H1 discipline on every public build pass.

# Database Structure

## April 10, 2026 schema direction update
- Added the 064 workflow rollup pass and corrected the full schema snapshot.
- Receipt, work-order, HSE, and AR/AP rollups are now intended to be shown directly in Admin through selector merges instead of living only in SQL.

## April 9, 2026 schema direction update
- Added direction for the deeper workflow layer on top of the 061 backbone.
- New workflow-level entities for the next pass are material receipts, material receipt lines, and linked HSE packets.
- Existing 061 tables `route_stops`, `estimate_lines`, `work_order_lines`, `ar_payments`, and `ap_payments` should now be treated as active Admin-manager targets rather than future placeholders.

### Admin managers implied by the schema
- `estimates` + `estimate_lines` -> estimate manager
- `work_orders` + `work_order_lines` -> work-order manager
- `routes` + `route_stops` + `service_areas` -> route/service-area manager
- `materials_catalog` + `material_receipts` + `material_receipt_lines` + `units_of_measure` -> materials/receiving manager
- `subcontract_dispatches` + `linked_hse_packets` -> dispatch + HSE packet manager
- `ar_invoices` + `ar_payments` and `ap_bills` + `ap_payments` -> receivables/payables posting manager


Last synchronized: April 11, 2026 (admin focus buttons, HSE action-item summaries, and monitor threshold pass)

## Current schema direction

The database is now expected to support three connected but separable domains:

1. **Operations platform**
   - staff
   - clients/sites
   - estimates
   - work orders
   - routes
   - materials
   - equipment
   - costing
   - approvals

2. **Subcontract and dispatch platform**
   - subcontract clients
   - operator/equipment dispatches
   - dispatch billing and cost capture

3. **Standalone and linked HSE platform**
   - forms
   - inspections
   - drills
   - toolbox talks
   - PPE checks
   - first-aid checks
   - logbook/review records

4. **Digital accounting backbone**
   - chart of accounts
   - receivables
   - payables
   - general-ledger journals
   - standard cost mapping

## Current core tables already implied by the build

### Staff and access
- `profiles`
- site assignment/support tables
- role and visibility helpers
- account recovery / onboarding / identity change related tables

### Operations
- `jobs`
- job equipment requirements
- equipment assets, signout, maintenance, evidence
- orders/accounting stub tables
- dropdown/catalog reference tables

### New foundation added in migration 061
- `units_of_measure`
- `cost_codes`
- `clients`
- `client_sites`
- `service_areas`
- `routes`
- `route_stops`
- `materials_catalog`
- `equipment_master`
- `estimates`
- `estimate_lines`
- `work_orders`
- `work_order_lines`
- `subcontract_clients`
- `subcontract_dispatches`
- `chart_of_accounts`
- `gl_journal_batches`
- `gl_journal_entries`
- `ar_invoices`
- `ar_payments`
- `ap_vendors`
- `ap_bills`
- `ap_payments`

## Data migration direction

Continue moving multi-use shared data from JSON fallback into database-backed reference tables where operational consistency matters.

Best candidates:
- equipment master data
- employee/staff lists
- job types and statuses
- material categories and units
- service categories
- recurring service templates
- safety categories and templates
- cost codes and account mappings

## Important rule

The database should increasingly become the **single source of truth** for shared operational records, while keeping the standalone HSE use case possible when operations records are absent.

## Admin UI mapping for the new tables

The next admin layer should expose these groups through manager screens:

### Estimate / work-order manager
- `estimates`
- `estimate_lines`
- `work_orders`
- `work_order_lines`

### Materials + units manager
- `materials_catalog`
- `units_of_measure`
- `cost_codes`

### Route / service-area manager
- `service_areas`
- `routes`
- `route_stops`
- `clients`
- `client_sites`

### Subcontract dispatch manager
- `subcontract_clients`
- `subcontract_dispatches`
- `equipment_master`

### AR/AP + chart-of-accounts admin screens
- `chart_of_accounts`
- `gl_journal_batches`
- `gl_journal_entries`
- `ar_invoices`
- `ar_payments`
- `ap_vendors`
- `ap_bills`
- `ap_payments`

## HSE linkage rule

The HSE side must stay usable as a standalone safety app for unscheduled work. When operations records exist, HSE records should be linkable to:
- clients
- client sites
- routes / route stops
- estimates
- work orders
- subcontract dispatches
- equipment

This keeps the safety workflows first-class without forcing every ad hoc safety event into a full operations record at creation time.

## April 8, 2026 database direction
The new operations/accounting tables should now be treated as the long-term backbone for landscaping, project work, construction-style jobs, subcontract dispatch, and digital accounting.

Priority UI mappings:
- `units_of_measure`, `cost_codes` -> Admin reference data manager
- `service_areas`, `routes`, `route_stops` -> route/service-area manager
- `clients`, `client_sites` -> client/site manager
- `materials_catalog`, `equipment_master` -> material/equipment manager
- `estimates`, `estimate_lines`, `work_orders`, `work_order_lines` -> estimate/work-order manager
- `subcontract_clients`, `subcontract_dispatches` -> subcontract dispatch manager
- `chart_of_accounts`, `ar_invoices`, `ap_vendors`, `ap_bills` -> accounting backbone manager

## 066 schema direction update
- `gl_journal_batches` now carry derived line-count, debit, credit, balanced, and posted-by metadata.
- `gl_journal_entries` now support line numbering and optional source-record linkage.
- `material_issues` and `material_issue_lines` now carry actual usage/issue movement after receiving so work can be tracked beyond purchase.

## 2026-04-10 source-generated journals, route execution, and HSE proof pass
- Added migration `sql/067_source_journal_route_execution_and_hse_proof.sql`.
- Added source-generated draft journal batches for AR invoices, AP bills, material receipts, and material issues so review/posting can start from the originating record instead of manual batch creation.
- Added route-stop execution lifecycle records plus attachment rows so daily field work can track completed, skipped, delayed, and exception states with note/photo support.
- Added HSE proof rows plus reopen-aware linked packet fields so closeout evidence, reopen counts, and follow-up exceptions are visible in the Admin backbone.
- Continued the DB-first move for shared operational/accounting data and refreshed the docs so roadmap, risks, testing, and deployment all point to the same next state.


## 070 HSE upload retry and analytics / traffic monitoring
- `field_upload_failures` now carries execution/packet/proof linkage plus retry ownership/attempt fields.
- `app_traffic_events` records page views, route views, API errors, upload successes/failures, and session-health style telemetry.
- `backend_monitor_events` records frontend/backend incidents for admin review and resolution.

## 2026-04-11 HSE operations hub and admin section-button pass
- Added a separate **HSE Operations** screen outside the long Admin page so safety workflows, OSHA-oriented reminders, and linked-packet shortcuts can be reached more quickly on desktop and mobile.
- Split the Admin experience into section buttons so people/access, jobs/operations, safety/monitoring, accounting, and messaging/diagnostics can be opened without one long scroll.
- Added migration `sql/072_hse_hub_and_accounting_review_summaries.sql` plus summary views for HSE follow-up and accounting review pressure.
- Corrected Admin selector/view alignment for traffic daily summary and HSE action-item ordering so the newer safety and monitoring shortcuts stay usable.
- Continued the DB-first direction while keeping HSE standalone-capable and easier to connect to jobs, work orders, routes, equipment, dispatches, sites, and subcontract work.


## April 14, 2026 note
- No new schema migration in this pass.
- Operational schema remains aligned through 075.
- Ontario/CAD accounting rules are documented as guardrails for the next accounting migration set.


## Latest structure note
Schema now extends beyond parent jobs into session-level execution:
- `job_sessions`
- `job_session_crew_hours`
- `job_reassignment_events`
These records support recurring service visit tracking, supervisor signoff, crew-hour capture, and operational reassignment history.

## 2026-04-16 schema note
New accounting-facing additions include:
- `job_financial_events`
- profile labor-rate fields for costing/billing assumptions
- `v_job_labor_rollups`
- `v_job_financial_event_rollups`
- `v_job_financial_rollups`
- expanded `v_jobs_directory` and `v_accounting_review_summary`
> Synchronized for the 2026-04-16 accounting-profitability and job-financial-rollup pass.

## 2026-04-17 schema 081 additions
- `service_contract_documents` for printable contract / application outputs tied to estimates, agreements, and jobs.
- `v_estimate_conversion_candidates` to identify estimates ready to become recurring agreements or contract-backed service starts.
- `v_service_agreement_profitability_summary` for agreement-level profitability and invoice/snow-event review.
- `v_snow_event_invoice_candidates` for threshold-met snow events that can be turned into invoices.
- `payroll_export_runs` now store generated export metadata and file content for payroll handoff.
- `v_callback_warranty_dashboard_summary` gives Admin a quick callback / warranty pressure snapshot.

## 2026-04-18 site activity audit and admin visibility pass

- Added DB-backed `site_activity_events`, `v_site_activity_recent`, and `v_site_activity_summary` so Admin can review durable activity for staff creation/updates, new jobs, equipment changes, agreements, payroll exports, contracts, and related operational changes.
- Admin now loads and renders a Recent Site Activity table directly from the backend instead of relying only on login traces or per-screen notices.
- `admin-manage`, `jobs-manage`, and `account-maintenance` now record key activity events while still failing safely if the audit trail insert itself has a problem.
- Current schema target is now 082.
