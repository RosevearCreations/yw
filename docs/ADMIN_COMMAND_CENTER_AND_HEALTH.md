# Admin Command Center and Health Center

Last refreshed: **2026-05-15a**

## Added in schema 106

- Admin Home Command Center.
- App Health and Schema Center.
- Admin Task Inbox.
- Live schema version table and status view.
- Role dashboard preset view.

## Frontend files

- `js/admin-ui.js`
- `style.css`

## Backend files

- `supabase/functions/admin-directory/index.ts`
- `sql/106_admin_command_center_schema_tracking_and_health.sql`

## What the Command Center shows

- Open jobs.
- HSE/safety review count.
- Accounting close attention count.
- AR/AP payment application attention count.
- Bank reconciliation review count.
- Accountant package delivery attention count.
- Failed upload attention count.
- App health/schema summary.

## What the Health Center shows

- DB health rows.
- Local browser diagnostics.
- Schema version rows.
- Error/warning counts.

## What the Task Inbox shows

- Admin notification follow-up.
- Bank reconciliation exceptions.
- Accounting close tasks.
- Sales tax filing review.
- Payroll remittance review.
- Corrective action follow-up.
- Training expiry/review.

## Next improvement

Add exact drill-down filters and backend actions for each task type.
