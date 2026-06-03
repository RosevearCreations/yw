# Known Issues and Gaps

Last refreshed: **2026-06-02b**

## Immediate deployment issues

1. Apply schema **127** after schema 126.
2. Redeploy `admin-directory` so schema 127 readiness views load in Admin.
3. Redeploy `jobs-manage` and `jobs-directory` if the live project is not already on the repaired schema 126/127 code.
4. Hard-refresh or clear the old service worker so **2026-06-02b** assets load.
5. Run `node scripts/repo-smoke-check.mjs` before packaging or deploying Edge Functions.

## Accounting depth gaps

- Payment application still needs full apply/reverse/review actions for invoices, deposits, credits, discounts, write-offs, overpayments, refunds, and reversals.
- Bank reconciliation still needs CSV preview, scored matches, manual match, split match, undo, and reviewer notes.
- HST/GST review still needs source totals, adjustments, filing proof, filed date, remitted date, and lock status.
- Payroll remittance still needs source pay runs, deductions/employer-cost totals, proof, and reviewer signoff.
- Month-end close still needs final lock/reopen controls and posting blocks.
- Accountant exports still need generated package files, manifest, proof files, delivery status, and resend history.
- Job profitability still needs stronger rollups for repair, delay, equipment usage, replacement, fuel, disposal, material, and subcontractor costs.

## Equipment accountability gaps

- Equipment scan now has a manual fallback button, but real camera/BarcodeDetector scanning still needs to be added.
- Accessory checklist templates need to move from free text into reusable DB templates.
- Verifier-role enforcement needs server-side blocking for final returns, defect clearing, and return-to-service.
- Failed arrival/return tests should become assignable service work orders with proof and costs.
- Return-to-service signoff should be required before locked-out equipment becomes available again.

## SEO/local gaps

- Keep one H1 per exposed page.
- Schema 127 adds a route SEO registry, but future public routes still need to be populated and reviewed before publishing.
- Internal-link suggestions are now tracked, but approval/dismiss actions still need to be built.
- Add sitemap, robots, broken public link, structured data, and image-alt checks to smoke testing.
- Local wording must match real coverage and proof. Avoid thin or unsupported local pages.

## CSS/mobile/fallback gaps

- CSS brace balance passes and schema 127 adds a CSS token inventory, but repeated inline styles still need to be converted into reusable classes.
- Long Admin tables still need more phone-friendly cards.
- Offline conflict review needs clearer retry/keep/discard labels.
- Optional DB views should keep failing soft to empty arrays with visible gap messages.
- Browser cache/schema mismatch warnings should be added.

## Data migration/source-of-truth gaps

- Public route SEO data should move toward DB-reviewed rows with generated static fallback.
- Equipment accessory templates should become DB rows linked to equipment category/pool.
- Accounting close export manifests should become DB package rows with generated files.
- Bank CSV imports should use staging tables with rejection reasons and fallback export.
- Offline drafts should remain local-first but sync summaries and conflicts should be visible in Admin.

## Fixed during this pass

- Added schema 127 route SEO registry, internal-link queue, CSS token inventory, mobile field action queue, and release manifest checks.
- Exposed schema 127 views through `admin-directory` and Admin readiness tables.
- Added manual scan/enter fallback for equipment QR/barcode values.
- Repaired the uploaded zip root hygiene again by archiving retired Markdown and test_write files.
- Updated cache marker to **2026-06-02b**.
- Updated smoke checks for schema 127, Admin visibility, cache freshness, and archive hygiene.

<!-- 2026-06-02b pass: schema 127 public route SEO registry, internal links, CSS token inventory, mobile field actions, release manifest checks, Admin readiness visibility, scan fallback, archive hygiene, cache marker, and Markdown refresh. -->
