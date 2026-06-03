# Testing Checklist

Last refreshed: **2026-06-02b**

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
- Admin Production Readiness loads schema 127 tables.
- Equipment manual scan/enter fallback captures QR/barcode value.
- Service worker cache marker is **2026-06-02b**.
