# Known Issues and Gaps

Last refreshed: **2026-06-02a**

## Immediate deployment issues

1. Apply schema **126** after schema 126.
2. Redeploy `admin-directory` so the new readiness/roadmap/depth/data-migration views load in Admin.
3. Redeploy `jobs-manage` and `jobs-directory` if the live project is not already on the repaired schema 126/126 code.
4. Hard-refresh or clear the old service worker so **2026-06-02a** assets load.
5. Run `node scripts/repo-smoke-check.mjs` before packaging or deploying Edge Functions.

## Accounting depth gaps

- Payment application needs the full apply/reverse/review screen.
- Bank reconciliation needs CSV preview, scored matches, manual match, split match, undo, and reviewer notes.
- HST/GST review needs source totals, adjustments, filing proof, filed date, remitted date, and lock status.
- Payroll remittance needs source pay runs, deductions/employer-cost totals, proof, and reviewer signoff.
- Month-end close needs final lock/reopen controls and posting blocks.
- Accountant exports need a complete package manifest, proof files, delivery status, and resend history.
- Job profitability still needs stronger category rollups for repair, delay, equipment usage, replacement, fuel, disposal, material, and subcontractor costs.

## Equipment accountability gaps

- QR/barcode scan flow still needs to be added to the phone UI.
- Accessory checklist templates need to move from free-text/JSON patterns to reusable DB templates.
- Verifier-role enforcement needs to block lower-role users from final return verification and defect clearing.
- Failed arrival/return tests should create assignable service work orders with proof and costs.
- Return-to-service signoff should be required before locked-out equipment becomes available again.

## SEO/local gaps

- Keep one H1 per public/exposed page.
- Add a route-level SEO registry for title, H1, meta description, local wording, image alt, proof level, and internal links.
- Add sitemap, robots, broken public link, structured data, and image-alt checks to smoke testing.
- Avoid thin or unsupported local pages; local wording must match real service coverage and proof.
- Keep titles/headings plain and searchable without stuffing or repeated title-like blocks.

## CSS/mobile/fallback gaps

- CSS brace balance passes, but component-level drift still needs token inventory and mobile regression checks.
- Long Admin tables still need more phone-friendly card views.
- Offline conflict review needs clearer retry/keep/discard labels.
- Optional DB views should continue to fail soft to empty arrays with visible gap messages.
- Browser cache/schema mismatch warnings should be added.

## Data migration/source-of-truth gaps

- Public route SEO data should move toward DB-reviewed rows with generated static fallback.
- Equipment accessory templates should become DB rows linked to equipment category/pool.
- Accounting close export manifests should become DB package rows with generated files.
- Bank CSV imports should use staging tables with rejection reasons and fallback export.
- Offline drafts should remain local-first but sync summaries and conflicts should be visible in Admin.

## Fixed during this pass

- Added schema 126 roadmap/depth/data-migration/schema-doc sync tables and views.
- Exposed schema 126 and 126 guardrails through `admin-directory` and Admin readiness UI tables.
- Removed root `test_write` files from the active build.
- Added missing archive snapshots required by smoke checks.
- Updated cache marker to **2026-06-02a**.
- Updated smoke checks for schema 126, CSS brace balance, Admin guardrail visibility, and cache freshness.

<!-- 2026-06-02a pass: schema 126 roadmap depth, data migration candidates, SEO/CSS/fallback guardrails, Admin readiness visibility, archive hygiene, cache marker, and Markdown refresh. -->
