# Known Issues and Gaps

Last refreshed: **2026-06-01a**

## Immediate issues

1. Live Supabase still needs schema **125** applied after schema 124.
2. `jobs-manage` must be redeployed and confirmed to bundle cleanly after the regex repair.
3. `jobs-directory` should be redeployed so the duplicate comment-attachment push repair reaches production.
4. Old service worker caches can hide **2026-06-01a** assets until the browser is hard refreshed or the service worker is cleared.
5. The new deployment/SEO/fallback guardrail views are schema-ready, but a visible Admin panel for them still needs to be built.
6. Payment application still needs a full editor; current schema/workbench support is deeper than the UI.
7. Bank reconciliation still needs CSV preview, real match scoring, manual match, undo display, and review notes.
8. HST/GST and payroll remittance still need source-total drilldown screens and export-proof upload flow.
9. Month-end close still needs the guided wizard, blocker list, lock/reopen confirmation, and final accountant package builder.
10. Equipment QR/barcode scan lookup, accessory templates, verifier-role enforcement, and service-task completion workflow still need UI depth.

## Deployment/bundling gaps

- Keep running `node scripts/repo-smoke-check.mjs` before every Supabase Edge Function deploy.
- Keep TypeScript parse diagnostics in the smoke script so Supabase bundling is not the first syntax check.
- Add live deploy-status storage once deployment logs can be captured.
- Add a visible Admin deployment-readiness panel from `v_app_deployment_bundle_checks`.

## UX gaps

- Keep testing every form/Admin screen at phone width.
- Convert long Admin tables into action cards where users actually work on phones.
- Add photo/evidence previews and upload progress suitable for slow mobile connections.
- Add queue/detail drawers for pending submissions, local drafts, equipment exceptions, accounting review rows, and Admin action items.
- Add scan-to-select equipment lookup to reduce typing errors on site.

## Equipment accountability gaps

- Enforce verifier role rules before arrival or final return signoff.
- Add mobile QR/barcode scan lookup for equipment code.
- Add accessory checklist templates per equipment pool/category.
- Add missing/damaged accessory exception rows with assignment and resolution.
- Connect failed return tests to repair/replacement job financial events.
- Add service-task completion signoff before locked-out equipment returns to available status.

## Accounting depth gaps

- Payment application needs a full screen for applying payments to invoices, deposits, credits, discounts, write-offs, refunds, reversals, and overpayments.
- Journal-line automation needs posting validation against real account mappings.
- Reconciliation matching needs bank CSV import preview, confidence score review, manual match, and undo handling.
- HST/GST and payroll/remittance review flows need deeper source totals, signoff, lock state, and accountant export proof.
- Month-end close needs a guided checklist and final accountant export package manifest.

## SEO/local gaps

- Keep one H1 per public/exposed page.
- Continue page title, meta description, local wording, alt text, structured data, and mobile layout checks each pass.
- Add local service/location content only when it matches real service coverage.
- Add structured metadata, sitemap, robots, public route freshness, and image-alt checks to the smoke script.
- Add a visible public SEO checklist from `v_app_public_seo_checks`.

## Fixed during this pass

- Repaired the `jobs-manage` unterminated-regexp deploy failure.
- Added Edge Function TypeScript parse diagnostics to the repo smoke check.
- Added schema 125 deployment bundle, public SEO, and runtime fallback guardrail tables/views.
- Fixed duplicate job comment attachment rows in `jobs-directory`.
- Improved service-worker install fallback so one stale shell asset does not block installation.
- Updated cache marker, canonical schema reference, roadmap, known gaps, changelog, and deployment/testing notes.

<!-- 2026-06-01a pass: schema 125 deployment bundle parse repair, SEO/local checks, fallback guardrails, jobs-manage fix, jobs-directory attachment dedupe, cache marker, and roadmap refresh. -->
