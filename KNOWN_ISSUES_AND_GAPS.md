# Known Issues and Gaps

Build: **2026-06-13b**  
Schema: **146**

## Still needs depth

1. Payment/reconciliation queues are extensive, but payment apply/reverse/refund/write-off/overpayment write actions still need implementation.
2. Bank CSV preview, validation, match scoring, split matching, undo, and accountant exception export are still outstanding.
3. Equipment scan/custody is tracked, but camera/QR scanning, manual fallback, accessory templates, service-task closeout, and cost recovery still need real actions.
4. Public SEO is clean at the homepage level, but service-area/service pages should not be added to sitemap until route proof, one H1, title/meta, internal links, CTA, and approved visuals exist.
5. Visual polish is improving with CSS-only sections, but real image publishing needs an asset registry with proof/consent, alt text, compression, and route assignment.
6. Runtime fallback logic exists, but fallback events still need persistent logging, owner assignment, and resolution status.
7. Mobile offline drafts still need user-facing conflict cards: Retry sync, Keep local, Reload server, and Discard local after confirmation.
8. Month-end close, HST/GST, payroll remittance, accountant package, and close/reopen audit trail still need end-to-end proof.
9. Static sitemap/robots are present, but generation should eventually come from approved DB route rows.
10. Admin readiness tables are broad; the next value step is summary scorecards, filters, and action buttons.

## Recently repaired

- Schema 140 VALUES-list mismatch is repaired in the standalone migration and canonical full schema.
- Schema 141 proof-area/payment-area and SEO evidence row-length issues are repaired in standalone and canonical full schema paths.
- Root helper Markdown and temporary test files are archived during this pass.
- One-H1, CSS brace balance, cache markers, sitemap/robots, and schema/Admin wiring checks are preserved.

## Next focus

1. Build real payment application/reversal/refund/write-off/overpayment Edge write actions with proof, reason, reviewer, and period lock checks.
2. Build bank CSV upload preview with header/date/amount validation, duplicate detection, rejected-row reasons, and staging.
3. Build reconciliation match scoring, split matching, undo history, reviewer signoff, and accountant exception export.
4. Build equipment QR/barcode scan with BarcodeDetector where supported and manual-code fallback everywhere.
5. Build equipment custody timeline for checkout, site arrival, return, return-to-service, accessory exceptions, and service tasks.
6. Create DB-backed equipment accessory template editor by equipment pool/category.
7. Roll missing/damaged equipment and accessory costs into job profitability and accountant export.
8. Create public route registry with approved title, meta, one-H1, local proof, CTA, and sitemap inclusion status.
9. Create visual asset registry with source, consent/proof, alt text, route assignment, compression status, and publish state.
10. Add local SEO smoke checks for title/meta/H1/internal links/CTA target/image alt/route proof.
11. Add approved service-area/service-page candidate workflow before adding more sitemap URLs.
12. Add trust FAQ blocks connected to real service proof and quote/contact paths.
13. Add Admin dashboard scorecards and progress rails for accounting, equipment, SEO, runtime, and release readiness.
14. Add mobile offline conflict cards: Retry sync, Keep local, Reload server, Discard local after confirmation.
15. Persist runtime fallback events from UI and Edge Functions with owner action and resolution status.
16. Add public quote/request form with service choice, contact info, source route, and spam/fallback protection.
17. Add lightweight approved image/proof gallery after the visual asset registry is ready.
18. Add reduced-motion-safe micro-interactions for cards, buttons, status pills, and Admin scorecards.
19. Move repeated route/visual/checklist config out of static files and into DB registries where it controls publishing.
20. Package accountant export with payment applications, reconciliations, unresolved exceptions, HST/GST, payroll proof, and close/reopen audit trail.

## Build 2026-06-13b / Schema 146 — Highest-value execution layer

Implemented the next value-added layer from the sanity check: payment action workbench, bank CSV import preview, reconciliation match/split/undo/signoff scaffolding, equipment QR/barcode custody workbench, visual asset approval registry, public route registry, quote/contact intake shell, mobile offline conflict cards, and Admin scorecard/progress rails.

SEO/H1/CSS guardrails remain active: one public H1, sitemap/robots freshness, cache marker `2026-06-13b`, and CSS brace balance checks. The public shell gained quote/contact intake and mobile conflict preview sections without adding extra H1 headings.

Next priority: connect payment actions and quote/contact intake to real Edge write actions, then build bank CSV preview and reconciliation match buttons.

## Schema 146 remaining high-value gaps

Payment/reconciliation now has DB-backed workbench scaffolding, but it still needs real Edge write actions, approval enforcement, immutable audit events, and close-period locking. Bank CSV handling now has preview/reject/staging design, but it still needs the actual parser and upload UI. Equipment custody now has scan/timeline requirements, but it still needs browser camera scanning and live timeline rendering. Public growth now has route and visual registries, but real galleries and sitemap growth should wait until approvals, alt text, proof, compression, and conversion paths are in place. Quote/contact intake is visible on the public website, but live submission is intentionally not connected until spam/privacy and Edge write controls are added.

## Schema 147 sanity gaps — 2026-06-14a

The app now has stronger visual placeholders and compact handoff docs, but the highest value remains turning scaffolding into real actions. Outstanding gaps: quote/contact submit is still not a real write path; payment actions are still not live buttons; bank CSV preview and reconciliation match/split/undo/signoff need execution screens; equipment scan and custody timeline need camera/manual fallback; visual placeholders need an approval registry before real images replace them; public routes must stay draft until proof, title/meta, one H1, internal links, CTA, and visual fallback are complete.
