# Known Issues and Gaps

Last refreshed: **2026-06-04a**

## Immediate deployment issues

1. Apply the repaired schema **128** if it has not already applied successfully.
2. Apply schema **129** after schema 128.
3. Redeploy `admin-directory` so schema 129 readiness rows load in Admin.
4. Hard-refresh or clear the old service worker so **2026-06-04a** assets load.
5. Run `node scripts/repo-smoke-check.mjs` before packaging or deploying Edge Functions.

## Recently fixed

- The standalone schema 128 file now uses the correct roadmap columns.
- The canonical `000_full_schema_reference.sql` copy of schema 128 has also been repaired.
- Smoke checks now block the legacy schema 128 roadmap insert pattern.
- Schema 129 adds DB-visible recovery playbooks so repeated deploy errors have a clear operator path.

## Accounting depth gaps

- Payment application actions are tracked, but the working apply/reverse/approve UI still needs to be built.
- Accounting evidence packages are now queued, but generated package files still need implementation.
- Bank reconciliation still needs CSV preview, scored matches, manual match, split match, undo, and reviewer notes.
- HST/GST review still needs source totals, adjustments, filing proof, filed date, remitted date, and lock status.
- Payroll remittance still needs source pay runs, deductions/employer-cost totals, proof, and reviewer signoff.
- Month-end close still needs final lock/reopen controls and posting blocks.
- Accountant exports still need generated package files, manifest, proof files, delivery status, and resend history.

## Equipment accountability gaps

- Equipment scan still uses manual fallback; real camera/BarcodeDetector scanning is not finished.
- Manual fallback needs actor/reason/timestamp audit when camera scan is unsupported.
- Accessory checklist templates need DB tables and auto-load by equipment category/pool.
- Verifier-role enforcement needs server-side blocking for final returns, defect clearing, and return-to-service.
- Failed arrival/return tests should become assignable service work orders with proof and costs.
- Return-to-service signoff should be required before locked-out equipment becomes available again.

## SEO/local gaps

- Keep one H1 per exposed page.
- Route SEO registry exists, but future public routes still need to be populated and reviewed before publishing.
- Sitemap/robots generation still needs implementation from approved route rows.
- Broken-link, broken-asset, structured-data, and image-alt automation still needs to be built.
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
