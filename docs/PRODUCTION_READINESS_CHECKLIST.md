# Production Readiness Checklist

Last refreshed: **2026-06-02b**

## Schema 123 readiness

- Apply `sql/123_equipment_transfer_arrival_return_accounting_seo_guardrails.sql`.
- Confirm `v_schema_drift_status.expected_schema_version` is **123**.
- Confirm `v_equipment_directory` includes current/destination site and transfer status fields.
- Confirm `v_equipment_transfer_verification_directory` returns audit rows.
- Confirm `v_equipment_return_exception_directory` returns pending/issue rows.
- Confirm `v_app_operational_depth_gates` returns equipment/accounting/SEO gate rows.

## Edge Function readiness

- Deploy `jobs-directory`.
- Deploy `jobs-manage`.
- Test checkout, arrival verification, return, and final return verification.
- Confirm new notifications appear for arrival verification, return verification, and return exceptions.

## Frontend readiness

- Confirm `index.html` and `server-worker.js` use **2026-05-29a**.
- Confirm the Equipment panel works at phone width.
- Confirm exception/history/depth-gate tables render without breaking the page.
- Run repository smoke check before shipping.

<!-- 2026-05-29a pass: Schema 123 equipment verification, accounting-depth, SEO/H1, CSS, fallback, and roadmap sanity refresh. -->

<!-- 2026-06-02a pass: schema 126 roadmap depth, data migration candidates, SEO/CSS/fallback guardrails, Admin readiness visibility, archive hygiene, cache marker, and Markdown refresh. -->

<!-- 2026-06-02a pass: schema 126 roadmap depth, data migration candidates, SEO/CSS/fallback guardrails, Admin readiness visibility, archive hygiene, cache marker, and Markdown refresh. -->
<!-- 2026-06-02b pass: schema 127 public route SEO registry, internal links, CSS token inventory, mobile field actions, release manifest checks, Admin readiness visibility, scan fallback, archive hygiene, cache marker, and Markdown refresh. -->
