# Known Issues and Gaps

Last refreshed: **2026-06-03a**

## Immediate deployment issues

1. Apply schema **128** after schema 127.
2. Redeploy `admin-directory` so schema 128 readiness queues load in Admin.
3. Redeploy `jobs-manage` and `jobs-directory` if the live project is not already on the repaired schema 126/127 code.
4. Hard-refresh or clear the old service worker so **2026-06-03a** assets load.
5. Run `node scripts/repo-smoke-check.mjs` before packaging or deploying Edge Functions.

## Accounting depth gaps

- Schema 128 now tracks payment application actions, but the working apply/reverse/approve UI still needs to be built.
- Bank reconciliation still needs CSV preview, scored matches, manual match, split match, undo, and reviewer notes.
- HST/GST review still needs source totals, adjustments, filing proof, filed date, remitted date, and lock status.
- Payroll remittance still needs source pay runs, deductions/employer-cost totals, proof, and reviewer signoff.
- Month-end close still needs final lock/reopen controls and posting blocks.
- Accountant exports still need generated package files, manifest, proof files, delivery status, and resend history.
- Job profitability still needs stronger live rollups for repair, delay, equipment usage, replacement, fuel, disposal, material, and subcontractor costs.

## Equipment accountability gaps

- Equipment scan still uses manual fallback; real camera/BarcodeDetector scanning is not finished.
- Accessory checklist templates need DB tables and auto-load by equipment category/pool.
- Verifier-role enforcement needs server-side blocking for final returns, defect clearing, and return-to-service.
- Failed arrival/return tests should become assignable service work orders with proof and costs.
- Return-to-service signoff should be required before locked-out equipment becomes available again.

## SEO/local gaps

- Keep one H1 per exposed page.
- Route SEO registry exists, but future public routes still need to be populated and reviewed before publishing.
- Schema 128 adds public SEO publication gates, but sitemap/robots/link/structured-data/image-alt automation still needs to be built.
- Internal-link suggestions are tracked, but approval/dismiss actions still need UI.
- Local wording must match real coverage and proof. Avoid thin or unsupported local pages.

## CSS/mobile/fallback gaps

- CSS brace balance passes, but repeated inline styles still need to be converted into reusable classes.
- Long Admin tables still need more phone-friendly cards.
- Offline conflict review needs clearer retry/keep/discard labels.
- Optional DB views should keep failing soft to empty arrays with visible gap messages.
- Browser cache/schema mismatch warnings should be added.

## Data migration/source-of-truth gaps

- Payment application action rows are now tracked, but actual payment tables still need working UI actions.
- Equipment accessory templates should become DB rows linked to equipment category/pool.
- Accounting close export manifests should become DB package rows with generated files.
- Bank CSV imports should use staging tables with rejection reasons and fallback export.
- Offline drafts should remain local-first but sync summaries and conflicts should be visible in Admin.

## Fixed during this pass

- Added schema 128 execution queues for payment actions, accounting close controls, equipment accountability, public SEO publication, and fallback observability.
- Exposed schema 128 views through `admin-directory` and Admin readiness tables.
- Archived prior root Markdown and retired uploaded `test_write` files.
- Updated cache marker to **2026-06-03a**.
- Updated smoke checks for schema 128, Admin visibility, cache freshness, and archive hygiene.

<!-- 2026-06-03a pass: schema 128 accounting/equipment/SEO/fallback execution queues, Admin readiness visibility, archive hygiene, cache marker, smoke updates, and Markdown refresh. -->
