# Testing Checklist

Last refreshed: **2026-06-01a**

## Required local/static checks before packaging

- `node --check app.js`
- `node --check js/api.js`
- `node --check js/admin-ui.js`
- `node --check js/jobs-ui.js`
- `node --check js/mobile-menu.js`
- `node --check js/mobile-today.js`
- `node --check js/mobile-form-helper.js`
- `node scripts/repo-smoke-check.mjs`

## Schema 125 checks

- Confirm `sql/125_deployment_bundle_parse_seo_fallback_guardrails.sql` exists.
- Confirm `sql/000_full_schema_reference.sql` includes schema 125.
- Confirm `v_schema_drift_status` expects schema 125.
- Confirm deployment, SEO, and fallback guardrail views are present.

## Edge Function checks

- `jobs-manage` must parse with TypeScript diagnostics clean.
- `jobs-manage` must contain `split(/[\n,]/)` in `normalizeJsonArray`.
- No Edge Function should have TypeScript parser errors in the smoke script.
- `jobs-directory` must not push comment attachments twice.

## Browser checks after deploy

- Hard-refresh or clear old service worker.
- Confirm **2026-06-01a** assets load.
- Open Jobs and Equipment screens.
- Test equipment checkout, arrival verification, return, and final return verification.
- Open Accounting Depth Workbench and confirm empty-state fallback still works when no rows exist.

<!-- 2026-06-01a pass: schema 125 deployment bundle parse repair, SEO/local checks, fallback guardrails, jobs-manage fix, jobs-directory attachment dedupe, cache marker, and roadmap refresh. -->
