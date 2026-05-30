# Database Structure

Last refreshed: **2026-05-29a**

Current schema marker: **123**

Schema 123 adds equipment-transfer and return-verification depth:

- `equipment_items.current_site_id`, `target_site_id`, transfer status/notes, arrival verification, and return verification fields.
- `equipment_signouts.intended_site_id`, checkout-to-site, checkout test, arrival test, return test, final return verification, and verification status fields.
- `equipment_transfer_verification_events` to keep an audit trail for checkout release, site arrival, return receipt, return verification, and return issues.
- `app_operational_depth_gates` to keep equipment, accounting, and SEO sanity gaps visible in the app.
- `v_equipment_directory`, `v_equipment_transfer_verification_directory`, `v_equipment_return_exception_directory`, `v_app_operational_depth_gates`, and `v_schema_drift_status` refreshed through expected schema **123**.

The canonical schema reference is `sql/000_full_schema_reference.sql`; apply migrations through `sql/123_equipment_transfer_arrival_return_accounting_seo_guardrails.sql` before deploying this app build.

<!-- 2026-05-29a pass: Schema 123 equipment verification, accounting-depth, SEO/H1, CSS, fallback, and roadmap sanity refresh. -->
