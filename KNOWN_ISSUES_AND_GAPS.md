# Known Issues and Gaps

Last refreshed: **2026-05-30a**

## Immediate issues

1. Live Admin must be tested after applying schema **124** and redeploying `jobs-directory`, `jobs-manage`, and `admin-manage`.
2. Old service worker caches can hide `2026-05-30a` assets until the browser is hard refreshed or the service worker is cleared.
3. Schema 124 adds accounting and equipment-accountability depth, but the new views must be validated against real Supabase data.
4. Accounting Depth Workbench buttons currently operate on the first pending row; per-row buttons should be added next.
5. Payment application now has stronger schema and basic review actions, but still needs a dedicated editor with lookup/search.
6. Reconciliation now has review fields and a workbench view, but bank CSV preview and real match scoring still need more depth.
7. HST/GST and payroll remittance now have signoff/proof fields, but source-total drilldowns still need to be built.
8. Month-end close now has lock/reopen fields, but the wizard/checklist and accountant package build flow still need UI depth.
9. Equipment QR/barcode/accessory fields now exist, but camera scan lookup and verifier-role enforcement still need to be added.
10. Failed equipment tests can create service tasks, but task assignment, due date workflow, and completion signoff need more depth.

## UX gaps

- Keep testing every form/Admin screen at phone width.
- Convert long Admin tables into action cards where users actually work on phones.
- Add photo/evidence previews and upload progress suitable for slow mobile connections.
- Add queue/detail drawers for pending submissions, local drafts, equipment exceptions, accounting review rows, and admin/action items.
- Add scan-to-select equipment lookup to reduce typing errors on site.

## Equipment accountability gaps

- Enforce verifier role rules before arrival or final return signoff.
- Add mobile QR/barcode scan lookup for equipment code.
- Add accessory checklist templates per equipment pool/category.
- Add missing/damaged accessory exception rows with assignment and resolution.
- Connect failed return tests to repair/replacement job financial events.
- Add service-task completion signoff before locked-out equipment returns to available status.

## Accounting depth gaps

- Payment application needs a full screen for applying payments to invoices, deposits, credits, discounts, write-offs, and overpayments.
- Journal-line automation needs posting validation against real account mappings.
- Reconciliation matching needs bank CSV import preview, confidence score review, manual match, and undo handling.
- HST/GST and payroll/remittance review flows need deeper source totals, signoff, lock state, and accountant export proof.
- Month-end close needs a guided checklist and final accountant export package manifest.

## SEO/local gaps

- Keep one H1 per public/exposed page.
- Continue page title, meta description, local wording, alt text, and mobile layout checks each pass.
- Add local service/location content only when it matches real service coverage.
- Add structured metadata, sitemap, robots, public route freshness, and image-alt checks to the smoke script.

## Fixed during this pass

- Added schema 124 and updated the canonical schema reference.
- Added job cost depth, payment application review, reconciliation review, HST/GST/payroll remittance review, month-end close, and accountant package fields/views.
- Added equipment QR/barcode, verifier role, accessory checklist, service-task, and accountability views.
- Updated Jobs UI, Jobs directory, Jobs manage, Admin manage, cache marker, smoke script, and active Markdown.

<!-- 2026-05-30a pass: schema 124 accounting depth, equipment accountability, SEO/H1/CSS/smoke, and roadmap refresh. -->
