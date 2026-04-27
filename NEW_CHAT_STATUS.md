## 2026-04-23 handoff update
- Latest repo pass hardened scheduler repeat-run behavior: the Edge Function now writes a calculated `next_run_at`, and the SQL dispatcher suppresses rows that were already queued in the last 10 minutes.
- Canonical schema files are `sql/088_scheduler_cron_media_review_payroll_close_receipts.sql` and `sql/000_full_schema_reference.sql`; the stray fixed copy has been removed.
- Next tests should focus on one full scheduled cycle, evidence approve/reject/follow-up, signed-contract kickoff, and payroll delivered -> confirmed -> closed.

<!-- Reviewed during 2026-04-22 workflow guardrail, portable scheduler sync, and repo-alignment pass. -->
<!-- Reviewed during 2026-04-21 scheduler Vault sync, evidence review, signed-contract kickoff, and payroll-close repo alignment pass. -->
## Latest pass: 2026-04-22 workflow guardrail and repo alignment
- Re-tightened evidence review so rejected/follow-up outcomes require notes.
- Re-tightened payroll workflow so delivery requires a reference and close requires a signoff note.
- Signed-contract kickoff feedback now states whether job/work-order/session records were created or linked.
- Removed the stray fixed full-schema helper copy again so the repo keeps one canonical full schema file.

## Latest pass: schema 087 evidence review, scheduler settings, payroll-close, and signed-contract kickoff
- Live scheduler plumbing now works end-to-end using `pg_cron` + `pg_net` + `service-execution-scheduler-run` with the shared secret stored in Supabase Vault.
- Repo files were brought back into line with the live database fix: canonical schema 088/full-schema dispatcher now prefers `vault.decrypted_secrets` but falls back cleanly where Vault is unavailable, and the scheduler-run function has committed `verify_jwt = false` config.
- The next chat should focus on operational testing and polish for evidence review, signed-contract kickoff, payroll close, and scheduler duplicate/invoice staging safeguards.

- Added Admin evidence review tables for attendance photos and HSE packet proof rows.
- Added service execution scheduler settings/status DB support and lighter `admin_core` selector loading.
- Added signed-contract live-job kickoff support plus payroll-close review summaries.
- Renamed stray `test_write.txt` to `test_write2_OLD.txt`.

### Best next steps
1. wire the scheduler to a real timer/cron
2. turn evidence tables into richer review/approval flows
3. deepen signed-contract kickoff into work-order and first-session orchestration
4. add payroll-close signoff and provider delivery acknowledgement

<!-- Reviewed during schema 086 HSE ops performance and site-activity rollup pass on 2026-04-20. -->
<!-- Reviewed during schema 080 recurring agreements / payroll / asset history / login tracking pass on 2026-04-17. -->
## Fresh-chat handoff: schema 080 pass
This repo now includes:
- recurring service agreements with per-visit pricing and snow-trigger logs
- change orders for job scope/cost/charge deltas
- customer assets plus per-asset job/service history links
- warranty/callback tracking
- payroll export runs and burden-aware payroll review summaries
- login-event auditing with `profiles.last_login_at` updates for Admin visibility
- material-to-job auto-costing from receipts/issues and route profitability summaries

Next highest-value implementation steps:
1. estimate -> agreement -> contract document conversion
2. richer crew split / emergency reassignment UX
3. payroll export file generation and accounting close-the-loop posting
4. dashboard cards for recurring agreement pressure, callback cost leakage, and route profitability

## 2026-04-13 staff admin save verification pass
- Added visible inline create/save/reset/block/delete confirmations in the Staff Directory screen so staff actions no longer fail silently from the operator’s point of view.
- Added stronger front-end email and password validation plus busy-state feedback for staff actions.
- Updated `supabase/functions/admin-manage/index.ts` so staff-detail saves now persist email changes instead of leaving the visible Email field unsaved.
- No new SQL migration was added in this pass; schema files were reviewed and remain on the 074 baseline.

> Last synchronized: April 14, 2026 (landscaping job workflow, crew planning, and schema 075)

## 2026-04-12 handoff status
- Latest code pass added `sql/074_hse_control_cues_and_inspection_focus.sql`.
- HSE packets and HSE events now carry structured machinery/tool, lifting/posture, weather/heat, and chemical/public-interaction cue fields.
- HSE Ops summary cards now surface machinery/lifting pressure plus chemical/public/cones follow-up more clearly.
- Site Inspection now offers category-focused hazard rows and preset add buttons for the four requested OSHA-oriented themes.
- `sql/000_full_schema_reference.sql` was synchronized forward through 074 and `scripts/repo-smoke-check.mjs` was updated through 074.

> Last synchronized: April 12, 2026 (HSE control cues, inspection focus, and schema 074)

## Main files changed
- `index.html`
- `style.css`
- `js/hse-ops-ui.js`
- `js/admin-ui.js`
- `js/forms-inspection.js`
- `sql/074_hse_control_cues_and_inspection_focus.sql`
- `sql/000_full_schema_reference.sql`
- `scripts/repo-smoke-check.mjs`
- `README.md`
- `CHANGELOG.md`
- `DATABASE_STRUCTURE.md`
- `docs/DATABASE_STRUCTURE.md`
- `DEVELOPMENT_ROADMAP.md`
- `KNOWN_GAPS_AND_RISKS.md`
- `KNOWN_ISSUES_AND_GAPS.md`
- `PROJECT_STATE.md`
- `PROJECT_BRAIN.md`
- `AI_CONTEXT.md`
- `DEVELOPMENT_GUIDE.md`
- `REPO_BASE.md`
- `SYSTEM_ARCHITECTURE.md`
- `TESTING_CHECKLIST.md`
- `AI_START_PROMPT.md`
- `DEPLOYMENT_GUIDE.md`
- `RUNBOOK_AUTH_BOOTSTRAP.md`

## Best next pass
1. Add create/open-linked-packet actions directly from Jobs, Equipment, and Dispatch screens.
2. Add filtered landing and resolve/snooze/assign actions for monitor lanes.
3. Bring the same lane-style shortcut treatment to accounting review pressure.
4. Tighten HSE closeout and signoff speed on phones.

- Latest pass: fixed the stuck Create Staff User flow by adding `api/auth/admin-manage.js` and a fallback path in `js/api.js`. No schema changes were introduced in this pass; schema was reviewed and remains aligned through migration 074.

# New Chat Status

## Current pass
- Added a landscaping-oriented operations step that distinguishes standard one-time landscaping jobs, recurring service jobs, snow/seasonal jobs, park work, and larger custom project work.
- Added crew-planning fields for crew kind, optional crew lead, service-area context, and default equipment notes.
- Added job-planning fields for service pattern, recurrence basis/custom-day notes, visit duration, reservation windows, and equipment-planning status.
- Updated `supabase/functions/jobs-manage/index.ts`, `js/jobs-ui.js`, `sql/075_landscaping_job_workflow_and_crew_planning.sql`, `sql/000_full_schema_reference.sql`, and the main Markdown docs.

## Next best step
1. Generate recurring job instances/day sheets from the stored cadence fields.
2. Add a crew board showing lead, supervisor, members, equipment readiness, and linked HSE status.
3. Add a reservation calendar across jobs, routes, and dispatches for shared equipment.

## Latest pass: profile route recovery and Ontario accounting guidance
- Fixed the main `#me` profile-screen fragility by initializing profile/crew async counters, re-running profile layout on route show, and adding a visible fallback shell so the profile route does not appear blank during module startup.
- Added a practical Ontario HST helper in the Admin order/accounting stub and documented Ontario/CAD accounting guardrails for the next accounting-heavy passes.
- No new SQL migration in this pass; schema remains aligned through 075.
- Next strongest step: move Ontario tax handling from helper notes into DB-backed business tax settings and tax codes, while continuing to connect jobs, crews, equipment reservations, and finance.


## Latest pass handoff
The latest pass added migration `076_job_pricing_profitability_and_schedule_logic.sql` and updated the jobs UI plus `supabase/functions/jobs-manage/index.ts` so job pricing and schedule logic save together. Next chat should focus on estimate/contract conversion, reusable pricing catalogs, and Ontario tax/accounting rules wired into posting.

## Fresh-chat handoff update
- The pricing/tax pass is now fully surfaced in Admin: Tax Codes, Business Tax Settings, and Service Pricing Templates are editable from the backbone manager.
- Jobs already consume template/tax data; the next logical build is estimate/contract generation plus deeper Ontario accounting posting/reporting.



## Latest pass: job sessions + crew hours + reassignments
- Added `sql/078_job_sessions_reassignments_and_admin_sorting.sql`.
- Jobs now support sortable admin review by client, transaction, invoice, date, duration, recurrence, status, and financial value.
- Added DB-backed job session tracking, crew-hour tracking, and reassignment logging.
- Clicking a saved job row now loads it back into the editor, and quick row actions can record sessions, hours, and reassignments.

## Fresh-chat handoff after schema 079
- Latest build adds labor-rate-aware accounting rollups for jobs.
- New DB items: `job_financial_events`, `v_job_labor_rollups`, `v_job_financial_event_rollups`, `v_job_financial_rollups`.
- Jobs directory now exposes actual rollup cost/charge/profit, unsigned-session pressure, and financial-event counts.
- Staff records now include hourly/overtime cost and bill rates plus payroll burden percentage.
- Next strongest continuation: estimate/contract generation, recurring agreement billing, payroll export, and Ontario tax posting rules.
> Synchronized for the 2026-04-16 accounting-profitability and job-financial-rollup pass.

## Handoff update - 2026-04-17 schema 081
- Added migration `sql/083_employee_time_clock_and_break_tracking.sql`.
- Added estimate conversion candidates, service contract documents, payroll export generation, callback / warranty dashboard summaries, agreement profitability summaries, and snow invoice candidate views.
- Admin backbone is now wired so office flow can move estimate -> agreement -> printable contract, payroll review -> CSV export, and snow trigger -> draft invoice.
- `sql/000_full_schema_reference.sql` has been synchronized through 081.

## 2026-04-19 employee time clock and attendance pass

- Added DB-backed `site_activity_events`, `v_site_activity_recent`, and `v_site_activity_summary` so Admin can review durable activity for staff creation/updates, new jobs, equipment changes, agreements, payroll exports, contracts, and related operational changes.
- Admin now loads and renders a Recent Site Activity table directly from the backend instead of relying only on login traces or per-screen notices.
- `admin-manage`, `jobs-manage`, and `account-maintenance` now record key activity events while still failing safely if the audit trail insert itself has a problem.
- Current schema target is now 082.


### 2026-04-18 pass completed

- Added schema 082 for durable site activity auditing and admin recent-activity review.
- Logged critical events for jobs, staff, equipment, agreements, callbacks, contract docs, payroll exports, and account access.
- Admin shell now displays recent site activity with a small summary block for the last 24 hours.


## 083 Employee site time clock pass
- Added employee site/job sign-in, unpaid break, resume, and sign-out flow tied to job sessions and payroll-linked crew-hour rows.
- Added admin-visible employee time entry records and recent attendance summary data.
- Added site activity audit coverage for clock in, break start, break end, and clock out.
- Next direction: supervisor approval for employee clock exceptions, geofence/photo proof on arrival, payroll export file generation, and contract/estimate conversion polish.


Latest pass moved the app into supervisor attendance review and execution-candidate workflow. Focus areas added: attendance exceptions, geolocation/photo-note capture, payroll export generation, and stronger operations dashboard counts.

## Latest handoff - 085 pass
The repo now includes attendance photo upload metadata, geofence distance/status rules, provider-specific payroll export output, signed-contract invoice generation, and scheduler-run tracking for recurring agreement execution candidates. The next chat should focus on deployment-ready scheduler invocation, contract-signature capture polish, and richer Admin dashboard surfacing of the new scheduler/invoice states.


## Current repo handoff
- Latest repo state: schema 086 HSE ops performance and site-activity rollup pass.
- Key fix in this pass: HSE Ops no longer requests the full Admin selector payload just to render shortcut cards, which should reduce avoidable runtime work and repeated route-open cost.
- Key repo hygiene step: the stray `test_write.txt` file was renamed to `test_write_OLD.txt`.
- Next strongest steps: automate scheduler runs, finish attendance media review, harden signed-contract-to-live-job kickoff, and complete provider-ready payroll output.

## Current repo handoff


## 2026-04-21 handoff snapshot

### What changed this pass
- Added schema `088_scheduler_cron_media_review_payroll_close_receipts.sql` and synced `sql/000_full_schema_reference.sql` to 088.
- Added service execution scheduler cron/dispatch plumbing, richer scheduler status fields, and settings-backed execution behavior.
- Added `media_review_actions` and upgraded evidence review views plus Admin approve/reject/follow-up controls.
- Added signed-contract kickoff action that creates/links a job, creates a work order, and creates the first planned job session.
- Added payroll delivery confirmation and payroll close signoff fields/actions after export generation.
- Fixed payroll export provider normalization for QuickBooks Time / SimplePay / ADP paths.
- Updated docs/roadmap/issues/changelog and bumped cache-busting version strings.

### Deployment / verify next
1. Apply SQL through 088.
2. Configure scheduler secret and invoke URL for the scheduler settings row in each environment.
3. Verify pg_cron + pg_net are available and dispatching.
4. Test Admin evidence approve/reject/follow-up buttons.
5. Test signed contract -> kickoff -> work order -> first session.
6. Test payroll export -> confirm delivery -> close payroll run.

### Known follow-up
- Scheduler currently records invoice candidates but does not yet auto-create invoices from those candidates.
- Evidence review notes are prompt-driven in the current Admin UI.

## Latest pass: 2026-04-22 portable scheduler fallback and workflow polish
- Canonical schema files no longer require the unavailable `vault` extension; scheduler dispatch now prefers Vault when available and falls back cleanly when it is not.
- Admin evidence review now prompts for optional notes more clearly, signed-contract kickoff returns richer completion messaging, and payroll export actions now step through delivered -> confirmed -> closed.
- Image-rating guidance is now documented as a rule-based completeness score rather than an AI quality rating.

## 2026-04-24 auth wall, historical reports, and OSHA reporting pass
- Fixed the public auth wall so logged-out users no longer see the live Toolbox Talk, PPE Check, First Aid Kit, Site Inspection, or Emergency Drill screens underneath the sign-in interface.
- Added a supervisor/admin **Historical Reports** screen with export-ready HSE form history, site/form rollups, and cross-workflow history covering submissions, HSE packet events, evidence review, scheduler runs, payroll exports, and signed contracts.
- Added migration `sql/089_historical_reporting_and_auth_wall_support.sql` and synced the full schema reference so reporting stays DB-backed instead of drifting into browser-only JSON snapshots.
- Continued the OSHA-facing direction by keeping the five field forms first-class while making their historical retrieval and review more usable for office and supervisor follow-up.
- Next strongest follow-up: add incident / near-miss reporting, saved report presets, richer trend charts, and deeper drill-down exports by site, worker, route, and work-order context.

## 2026-04-24 incident reporting, DB-backed report presets, and richer HSE analytics pass
- Added a new **Incident / Near Miss** field form so workers and supervisors can capture injuries, close calls, damage, witness names, immediate actions, and corrective-action ownership without waiting for office follow-up.
- Added migration `sql/090_incident_reporting_saved_report_presets_and_trends.sql`.
- Added DB-backed reporting presets (`report_presets`) so supervisors and admins can reuse saved report filters without depending on local browser storage.
- Expanded reporting with DB-backed views for incident history, monthly trends, worker rollups, and site/job/route context rollups.
- Reworked the historical reports screen to use the richer DB-backed datasets and added incident CSV export.
- Added a dedicated incident quick link in the public nav, HSE Ops, and Admin hub so the OSHA-facing workflows stay easy to reach on mobile and desktop.
- Next strongest follow-up: training history + certification expiry, SDS acknowledgement tracking, OSHA 300/300A/301-oriented recordkeeping helpers, and corrective-action task assignment from incident rows.

- Current strongest next work after this pass: training/certification expiry, SDS acknowledgement, OSHA log helpers, and corrective-action assignment with reminders.

## 2026-04-25 corrective actions + training pass
- Synced the repo to include first-class corrective-action tasks, training / certification expiry tracking, SDS acknowledgement history, and management-focused reporting.
- See `docs/CORRECTIVE_ACTIONS_AND_TRAINING.md` and the new `sql/091_corrective_actions_training_and_sds_tracking.sql` migration.


Latest completed pass: management workflows and subscriptions (092). Ask next about notification delivery wiring, worker-facing acknowledgement UI, or deeper JSA form linkage.

## Latest pass note (2026-04-25d)
- Synced for scheduled report delivery, worker self-service training/SDS acknowledgement, and Jobs commercial/accounting foundation planning.

## Ready-to-continue status
The repo now includes:
- report subscription delivery scheduler plumbing
- report delivery Edge Function scaffold
- worker self-service training acknowledgements in My Profile
- worker SDS prompt queue and self-ack flow

Next major phase: expand the Jobs section into a fuller quoting / estimate / approval / costing / completion-to-accounting workflow.
