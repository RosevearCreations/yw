# Testing Checklist

Last refreshed: **2026-06-04b**

Run before packaging/deploying:

- `node --check app.js`
- `node --check js/api.js`
- `node --check js/admin-ui.js`
- `node --check js/jobs-ui.js`
- `node --check js/mobile-menu.js`
- `node --check js/mobile-today.js`
- `node --check js/mobile-form-helper.js`
- `node --check server-worker.js`
- `node scripts/repo-smoke-check.mjs`

Manual checks:

- One H1 in `index.html`.
- CSS brace balance passes.
- Admin Production Readiness loads schema 130 payment/reconciliation/equipment/SEO/fallback drill tables.
- Service worker cache marker is **2026-06-04b**.
- No active root `test_write` files remain.

## Schema 130 testing

- Confirm `v_schema_drift_status` expects schema 130.
- Confirm `admin-directory` returns `v_app_payment_execution_queue` and `v_app_fallback_drill_queue`.
- Confirm Admin UI contains `ad_payment_execution_queue_table` and fallback drill table markup.
