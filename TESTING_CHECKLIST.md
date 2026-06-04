# Testing Checklist

Last refreshed: **2026-06-03a**

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
- Service worker cache marker is **2026-06-03a**.

## 2026-06-03a / Schema 128 update

- Added schema 128 execution queues for payment application, accounting close controls, equipment accountability, public SEO publication, and fallback observability.
- Updated Admin readiness to show the new queues.
- Updated cache marker to 2026-06-03a and refreshed active Markdown.
- Archived prior Markdown and retired uploaded test_write files.
