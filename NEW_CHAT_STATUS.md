<!-- Reviewed during schema 082 site activity audit / admin recent-activity pass on 2026-04-18. -->
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
- Added migration `sql/082_site_activity_audit_and_admin_recent_events.sql`.
- Added estimate conversion candidates, service contract documents, payroll export generation, callback / warranty dashboard summaries, agreement profitability summaries, and snow invoice candidate views.
- Admin backbone is now wired so office flow can move estimate -> agreement -> printable contract, payroll review -> CSV export, and snow trigger -> draft invoice.
- `sql/000_full_schema_reference.sql` has been synchronized through 081.

## 2026-04-18 site activity audit and admin visibility pass

- Added DB-backed `site_activity_events`, `v_site_activity_recent`, and `v_site_activity_summary` so Admin can review durable activity for staff creation/updates, new jobs, equipment changes, agreements, payroll exports, contracts, and related operational changes.
- Admin now loads and renders a Recent Site Activity table directly from the backend instead of relying only on login traces or per-screen notices.
- `admin-manage`, `jobs-manage`, and `account-maintenance` now record key activity events while still failing safely if the audit trail insert itself has a problem.
- Current schema target is now 082.


### 2026-04-18 pass completed

- Added schema 082 for durable site activity auditing and admin recent-activity review.
- Logged critical events for jobs, staff, equipment, agreements, callbacks, contract docs, payroll exports, and account access.
- Admin shell now displays recent site activity with a small summary block for the last 24 hours.
