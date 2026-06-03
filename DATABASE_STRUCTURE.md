# Database Structure

Last refreshed: **2026-06-02b**

Current schema marker: **127**.

Latest migration: `sql/127_public_route_seo_internal_link_css_mobile_guardrails.sql`.

Schema 127 adds:

- `app_public_route_seo_registry` / `v_app_public_route_seo_registry`
- `app_internal_link_suggestion_queue` / `v_app_internal_link_suggestion_queue`
- `app_css_component_token_inventory` / `v_app_css_component_token_inventory`
- `app_mobile_field_action_queue` / `v_app_mobile_field_action_queue`
- `app_release_manifest_checks` / `v_app_release_manifest_checks`

`v_schema_drift_status` now expects schema **127**. Apply schemas in order and redeploy Admin/Jobs Edge Functions after schema 127 is applied.
