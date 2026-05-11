# Database Structure

Last refreshed: **2026-05-10**  
Canonical schema file: `sql/000_full_schema_reference.sql`  
Latest migration marker: `sql/105_repo_cleanup_and_roadmap_refresh.sql`

## Schema policy

- Keep numbered SQL migrations in `sql/`.
- Keep `sql/000_full_schema_reference.sql` synchronized with the latest applied schema direction.
- Add a new migration whenever DB tables, columns, views, policies, functions, or schema health markers change.
- Do not use old one-off verification files as the source of truth.

## Current major schema areas

| Area | Examples |
| --- | --- |
| Identity/profile | profiles, roles, account setup, login activity, account recovery |
| Sites/work context | sites, assignments, crews, supervisors, service areas |
| HSE | forms, inspections, incidents, PPE, first aid, emergency drills, linked HSE packets, corrective actions, training/SDS |
| Jobs/commercial | clients, sites, estimates, quote packages, work orders, sessions, crews, routes, service agreements |
| Equipment/materials | equipment, reservations, maintenance/lockout, materials, units, receipts, issues |
| Reporting | report presets, delivery subscriptions, historical rollups, management scorecards |
| Accounting | chart of accounts, GL batches/entries/lines, AR/AP invoices and payments, payment applications, reconciliation, tax/remittance reviews, close periods, accountant exports |
| Monitoring/fallbacks | upload failures, monitor incidents, scheduler settings/status, schema health marker views |

## Latest marker view

Schema 105 adds `public.v_repo_cleanup_and_roadmap_health` as a lightweight marker that confirms the cleanup/roadmap refresh has been applied.

## Archived schema helper

`sql/VerifyDB_24_04_2026.sql` was moved to `archive/sql-retired-2026-05-10/` because it is older than the current schema reference and should not be treated as the latest validation script.

## Next database improvements

1. Add an actual `app_schema_versions` table for migration visibility inside Admin.
2. Add stronger DB-level locked-period guards for accounting posting changes.
3. Add indexed reporting rollups for heavy report screens.
4. Add audit tables for close/reopen, export delivery, manual reconciliation override, and permission-sensitive admin actions.
5. Add a production backup/restore checklist tied to actual DB/export commands.
