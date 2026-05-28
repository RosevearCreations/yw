# Database Structure

Last refreshed: **2026-05-27a**

## Latest schema marker

- **121** — `sql/121_mobile_today_dashboard_pwa_and_offline_badges.sql`

## New objects in schema 121

- `mobile_today_action_registry`
- `mobile_pwa_install_quality_gates`
- `v_mobile_today_action_registry`
- `v_mobile_pwa_install_quality_gates`
- additional rows in `app_mobile_first_quality_gates`
- updated `v_schema_drift_status` expected version to 121

## Existing tracking expectations

- `app_schema_versions` remains the schema marker table.
- `sql/000_full_schema_reference.sql` should remain the canonical schema reference.
- New migrations should be appended to the canonical reference and smoke check.
