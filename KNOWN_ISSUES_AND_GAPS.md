# Known Issues and Gaps

Last refreshed: **2026-05-29a**

## Immediate issues

1. Live Admin must be tested after applying schema **123** and redeploying `jobs-directory` and `jobs-manage`.
2. Old service worker caches can hide `2026-05-29a` assets until the browser is hard refreshed or the service worker is cleared.
3. The equipment transfer workflow now captures destination, arrival, return, and final verification states, but it still needs live production testing with real equipment records, real sites, and real supervisors.
4. Equipment photo capture still needs compression, quality checks, upload progress, and mobile camera guidance.
5. Return exceptions are visible, but follow-up service tasks and repair-cost posting still need a deeper connection to accounting.
6. Mobile form drafts remain local-device only. File inputs cannot be restored by browsers, so photos still need to be re-selected before final submit.

## UX gaps

- Keep testing every form/Admin screen at phone width.
- Convert long Admin tables into action cards where users actually work on phones.
- Add photo/evidence previews and upload progress suitable for slow mobile connections.
- Add queue/detail drawers for pending submissions, local drafts, equipment exceptions, and admin/action items.
- Add scan-to-select equipment lookup to reduce typing errors on site.

## Equipment accountability gaps

- Arrival verification is now captured, but permission rules need to be tightened so the right site lead/supervisor performs the signoff.
- Return verification is now separate from simple return receipt, but repair/service follow-up tasks need to be automatically created when return tests fail.
- Accessories, batteries, chargers, safety guards, keys, and consumable kits should be tracked with equipment signout/return.
- Equipment cost depth still needs repair cost, delay cost, replacement cost, and job chargeback rules.

## Accounting depth gaps

- Payment application needs a clearer screen for applying payments to invoices, deposits, credits, discounts, write-offs, and overpayments.
- Journal-line automation needs posting validation against real account mappings.
- Reconciliation matching needs bank CSV import preview, confidence score review, manual match, and undo handling.
- HST/GST and payroll/remittance review flows need source totals, signoff, lock state, and accountant export proof.
- Month-end close needs period lock/reopen controls and a final accountant export package manifest.

## SEO/local gaps

- Keep one H1 per public/exposed page.
- Continue page title, meta description, local wording, alt text, and mobile layout checks each pass.
- Add local service/location content only when it matches real service coverage.
- Add structured metadata, sitemap, robots, public route freshness, and image-alt checks to the smoke script.

## Fixed during this pass

- Added equipment destination, arrival verification, return testing, and final return verification fields.
- Added transfer event history, return exception visibility, and operational-depth gates.
- Added schema 123 and updated the canonical schema reference.
- Updated Jobs UI, Jobs directory, Jobs manage, CSS, cache marker, smoke script, and active Markdown.
- Removed retired root Markdown and temporary `test_write` files again.

<!-- 2026-05-29a pass: Schema 123 equipment verification, accounting-depth, SEO/H1, CSS, fallback, and roadmap sanity refresh. -->
