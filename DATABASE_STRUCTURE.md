# Database Structure

Last refreshed: **2026-05-15a**

Canonical schema file: `sql/000_full_schema_reference.sql`.

Latest migration: **106** — `sql/106_admin_command_center_schema_tracking_and_health.sql`.

## Current schema areas

- Profiles, sites, assignments, roles, access rollups.
- HSE submissions, reviews, images, logbook history.
- Jobs, routes, route stops, work orders, estimates, service agreements, snow triggers, customer assets.
- Equipment, signouts, evidence, maintenance, lockout/history.
- Attendance/time clock, payroll review, payroll exports.
- Reports, report presets, report subscriptions, report delivery scheduler.
- Corrective actions, training, SDS acknowledgements, supervisor safety queues.
- Accounting foundation: tax codes, business tax settings, chart of accounts, AR/AP, GL, bank accounts, reconciliation, close, tax filing, payroll remittance, accountant handoff packages.
- Admin monitoring: site activity, traffic/monitor events where available, upload failures where available, task/health rollups.

## Schema 106 additions

- `public.app_schema_versions`
- `public.v_app_schema_version_status`
- `public.v_role_dashboard_presets`
- `public.v_admin_home_command_center`
- `public.v_admin_error_health_center`
- `public.v_admin_task_inbox`
- `public.v_schema_106_admin_command_center_health`

## Why schema 106 matters

The app can now show a live schema marker in Admin instead of relying only on file names. This makes deploy drift easier to spot when the frontend has been deployed but Supabase migrations are behind.

## Deploy order

1. Apply SQL through 106.
2. Redeploy Edge Functions.
3. Deploy static files.
4. Open Admin Health and Schema Center and confirm the latest schema row is 106.
