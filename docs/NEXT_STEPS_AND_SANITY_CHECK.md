# Next Steps and Sanity Check — build 2026-06-17a / schema 149

## Sanity check

The application has crossed from planning/readiness into usable operational write flows. The foundation is broad and technically disciplined: schema history, Admin fallback, desktop/mobile surfaces, safety/HSE depth, accounting structures, SEO guardrails, visual placeholders, and smoke tests are all established.

The main risk is now breadth without enough end-to-end completion. The highest value comes from completing a smaller number of workflows all the way through posting, customer communication, field execution, reporting, and audit evidence.

## Completed this pass

1. Archived retired root helper Markdown and temporary test files.
2. Added schema 149 and updated the canonical full schema.
3. Added persistent operation write-audit events.
4. Added quote/contact duplicate suppression and follow-up due date.
5. Added payment request idempotency and decision controls.
6. Added payment proof and accounting-period checks before posting.
7. Added bank CSV header/date/amount validation and confirmation.
8. Added reconciliation idempotency and signoff actions.
9. Added equipment scan idempotency and custody write controls.
10. Added visual asset approval/readiness fields and view.
11. Added public route SEO readiness validation and view.
12. Added Operations Cockpit scorecard metrics.
13. Added action-specific role enforcement to `operations-manage`.
14. Added payment approve/reject/post/cancel actions.
15. Added bank preview confirmation action.
16. Added visual and route approval decision logic.
17. Added offline-conflict resolution actions.
18. Added responsive Admin Operations Cockpit forms.
19. Added BarcodeDetector camera scanning, manual fallback, and local retry storage.
20. Updated docs, cache marker, sitemap date, Admin loading, CSS, and smoke checks.

## Next 20 highest-value steps

1. Render live queue tables beneath each Operations Cockpit form with approve/reject/post buttons.
2. Add quote/contact owner assignment, follow-up events, email alerts, and response-time scorecard.
3. Add proof attachment uploads for payment and reconciliation actions.
4. Post approved payment actions into real AR/AP application and journal tables.
5. Promote confirmed bank preview rows into the bank-statement/reconciliation workbench.
6. Add automatic reconciliation match suggestions with visible scoring explanations.
7. Validate split reconciliation rows balance exactly to the source bank amount.
8. Resolve equipment scan codes against `equipment_master` and show equipment identity/availability.
9. Add DB-backed accessory templates and stage-specific checklists.
10. Create service work orders and cost-recovery decisions directly from failed equipment returns.
11. Add approved visual upload/storage, image dimensions, compression, and thumbnail generation.
12. Replace placeholders only with approved route-assigned assets and useful alt text.
13. Generate public service/location pages from approved route registry data.
14. Generate sitemap entries only from approved, publication-ready routes.
15. Add a customer portal for quote approval, job details, invoices, receipts, and new requests.
16. Add online quote acceptance, deposits, and payment receipts.
17. Add drag/drop scheduling and dispatch with crew/mobile notifications.
18. Add live job-costing dashboards comparing estimate, labour, materials, equipment, and margin.
19. Add offline outbox conflict merge choices and supervisor review history.
20. Add end-to-end tests covering public intake, payment actions, bank import, reconciliation, scanning, asset approval, and route publication.

## Current release recommendation

Deploy schema 149 and the three affected Edge Functions, then test one successful and one rejected operation for each cockpit panel. Do not expand public sitemap routes or replace visual placeholders until the route and asset approval gates are passing with real evidence.
