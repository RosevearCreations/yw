# Known Issues and Gaps

Last refreshed: **2026-06-04b**

## Immediate deployment issues

1. Apply schema **130** after the repaired schema 128 and schema 129 migrations are already successful.
2. Redeploy `admin-directory` so schema 130 execution queues load in Admin.
3. Hard-refresh or clear the old service worker so **2026-06-04b** assets load.
4. Run `node scripts/repo-smoke-check.mjs` before packaging or deploying Edge Functions.
5. Confirm Admin Production Readiness shows the schema 130 payment, reconciliation, equipment scan/template, local SEO, and fallback drill queues.

## Recently fixed

- Restored the missing `archive/markdown-current-snapshot-2026-05-29a/README.md` compatibility snapshot so legacy smoke checks pass.
- Added schema **130** execution queues for the next payment, reconciliation, equipment, SEO, and fallback work.
- Updated Admin directory/UI visibility for schema 130 readiness rows.
- Updated canonical schema, cache marker, and smoke checks to schema 130 / **2026-06-04b**.
- Retired active `test_write` files and old helper Markdown from the root.

## Accounting depth gaps

- Payment application actions are queued, but the actual apply/reverse/discount/write-off/overpayment/refund buttons still need write actions.
- Payment proof packages still need generated files and downloadable manifests.
- Bank reconciliation still needs CSV preview UI, match scoring, split matching, undo, reviewer notes, and signoff.
- HST/GST and payroll remittance still need proof screens, filed/remitted dates, reviewer signoff, and lock status.
- Month-end close still needs live lock/reopen enforcement and generated accountant packages.

## Equipment accountability gaps

- Camera scan is still planned; manual QR/barcode entry remains the fallback.
- Accessory checklist templates need DB-backed auto-loading by equipment pool/category.
- Verifier-role enforcement needs server-side blocking for final return, defect clear, and return-to-service.
- Failed arrival/return tests should become assigned service work orders with proof, due date, cost, and closeout.

## SEO/local gaps

- Keep one H1 per exposed public page.
- Sitemap/robots generation from approved route rows still needs implementation.
- Broken-link, broken-asset, JSON-LD, and image-alt/local proof checks still need automated smoke coverage.
- Continue using truthful local service wording and avoid overclaiming areas or services.

## Fallback gaps

- Offline draft conflict handling still needs a user-facing resolve screen.
- Optional-view-missing, stale-cache, scan-unsupported, and accounting-blocked fallback drills need run history and pass/fail notes.
