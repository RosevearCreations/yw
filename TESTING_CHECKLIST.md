# Testing Checklist

Last refreshed: **2026-05-30a**

## Smoke checks run in this pass

- `node --check js/jobs-ui.js`
- `node --check app.js`
- `node --check js/api.js`
- `node --check js/admin-ui.js`
- `node --check js/mobile-menu.js`
- `node --check js/mobile-today.js`
- `node --check js/mobile-form-helper.js`
- CSS brace-balance check
- public H1 count check
- `node scripts/repo-smoke-check.mjs`

## Live tests still required

1. Apply schema 124 in Supabase.
2. Deploy `jobs-directory`, `jobs-manage`, and `admin-manage`.
3. Hard-refresh browser/service worker after the `2026-05-30a` cache marker deploys.
4. Load Jobs and confirm Accounting Depth Workbench tables render.
5. Create/review a payment application row.
6. Review a bank reconciliation item.
7. Sign off one HST/GST or payroll remittance row.
8. Soft-lock and reopen a month-end period row.
9. Save equipment with QR/barcode/accessory checklist fields.
10. Check out equipment, verify arrival, return equipment, and confirm failed tests create service-task rows.

<!-- 2026-05-30a pass: schema 124 accounting depth, equipment accountability, SEO/H1/CSS/smoke, and roadmap refresh. -->
