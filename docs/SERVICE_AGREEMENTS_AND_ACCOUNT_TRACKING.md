<!-- Reviewed during schema 082 site activity audit / admin recent-activity pass on 2026-04-18. -->
<!-- Reviewed during schema 080 recurring agreements / payroll / asset history / login tracking pass on 2026-04-17. -->
# Service agreements, payroll review, asset history, and account tracking

## What this pass adds
- Estimate-to-agreement conversion candidates plus printable contract / application document records.
- Payroll export file generation support and agreement-profitability summaries.
- Snow-event invoice candidates for threshold-met agreement work.
- Recurring service agreements for repeat work such as mowing, snow, foliage clearing, and other visit-based service.
- Snow-event trigger logs for agreements that start work only after a threshold or event.
- Change orders for custom-project scope drift and approved charge/cost deltas.
- Customer assets plus asset-to-job history so repeat properties can keep equipment/feature service records.
- Warranty and callback events so post-job return work is visible as cost leakage or warranty-covered follow-up.
- Payroll export runs and burden-aware payroll review views.
- Admin-visible account login auditing with `profiles.last_login_at` plus per-profile login event counts.

## Why it fits this business model
This app is moving toward a landscaping + recurring service + custom project + accounting backbone. Repeat property work, emergency snow work, scope-change jobs, and warranty/callback costs all need to be first-class records so quoting, invoicing, and profitability can be measured instead of guessed from notes.

## Accounting implications
- Material receipts and material issues now have a clearer path into job-cost rollups.
- Payroll review is now separable from invoice timing so labor burden can be reviewed before export/close.
- Route profitability can now be reviewed by route, crew, and service area.
- Login tracking gives Admin stronger accountability over who last accessed the system.

## Strongest next implementation steps
1. Add signed acceptance and document lifecycle controls on top of the new estimate -> agreement -> printable contract flow.
2. Turn payroll export generation into provider-specific exports and accounting handoff summaries.
3. Surface callback / warranty pressure more aggressively on Admin home cards and route unresolved items into crew follow-up.
4. Tighten agreement profitability and snow-event invoicing into seasonal billing review and posting workflows.

## 2026-04-18 site activity audit and admin visibility pass

- Added DB-backed `site_activity_events`, `v_site_activity_recent`, and `v_site_activity_summary` so Admin can review durable activity for staff creation/updates, new jobs, equipment changes, agreements, payroll exports, contracts, and related operational changes.
- Admin now loads and renders a Recent Site Activity table directly from the backend instead of relying only on login traces or per-screen notices.
- `admin-manage`, `jobs-manage`, and `account-maintenance` now record key activity events while still failing safely if the audit trail insert itself has a problem.
- Current schema target is now 082.
