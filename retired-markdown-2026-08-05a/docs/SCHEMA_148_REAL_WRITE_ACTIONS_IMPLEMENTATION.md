# Schema 148 — Real Write Actions Implementation

Build: `2026-06-14b`  
Schema: `148`

## Purpose

This pass moves the application beyond readiness queues by adding real write-action targets and Edge Function scaffolding for the highest-value next modifications:

1. Quote/contact submit Edge Function + DB write.
2. Payment application/reversal/refund/write-off/overpayment request actions.
3. Bank CSV import preview with validation and rejected-row handling.
4. Reconciliation match/split/undo/signoff request workflow.
5. Equipment QR/barcode/manual scan with custody timeline.
6. Visual asset approval registry before real galleries.
7. Public route approval registry before sitemap expansion.
8. Mobile offline conflict cards.
9. Admin scorecards and progress rails.

## Real write paths added

### Public quote/contact intake

- Table: `quote_contact_requests`
- Events: `quote_contact_request_events`
- View: `v_quote_contact_requests`
- Edge Function: `quote-contact-submit`
- Frontend: `#publicQuoteContactForm`
- API helper: `YWIAPI.submitQuoteContact()`

The public form now submits to an Edge Function instead of remaining preview-only. The function validates name/contact/message/service, applies a simple honeypot/spam score, writes the request, and logs a created event.

### Admin operations write path

- Edge Function: `operations-manage`
- API helper: `YWIAPI.manageOperations()`

Supported actions:

- `payment_action_request`
- `bank_csv_preview`
- `reconciliation_action`
- `equipment_scan_event`
- `visual_asset_register`
- `public_route_register`
- `offline_conflict_card`
- `scorecard_update`

These actions write to the schema 148 tables and are designed to become the basis for Admin buttons, mobile scan screens, CSV import preview screens, and route/asset approval workflows.

## Admin-ready views added

- `v_payment_action_requests`
- `v_bank_csv_import_previews`
- `v_bank_csv_import_preview_rows`
- `v_reconciliation_action_requests`
- `v_equipment_scan_events`
- `v_equipment_custody_timeline_events`
- `v_visual_asset_approval_items`
- `v_public_route_approval_items`
- `v_mobile_offline_conflict_cards`
- `v_admin_scorecard_progress_rails`

`admin-directory` now safe-loads these views so Admin can display them without hard failing if deployment order is imperfect.

## Visual and mobile/desktop work

The public shell now includes a `Schema 148 live action layer` proof strip. It shows that the app is moving from planning to operational writes while preserving:

- one public H1,
- responsive desktop/mobile layout,
- CSS-only visual placeholders,
- route/visual approval before adding real images or new sitemap pages.

## SEO guardrails

Schema 148 continues the SEO approach:

- One clear H1 per exposed page.
- Local wording only where the service/location is real and proof-backed.
- Quote/contact intake as the public conversion path.
- Route approval before sitemap expansion.
- Visual asset approval before replacing placeholders.

## Next implementation layer

The strongest next pass should add the actual Admin UI forms/buttons for:

1. Payment action entry and approval.
2. Bank CSV file upload and preview screen.
3. Reconciliation split/match/undo/signoff screen.
4. Equipment manual scan card and custody timeline display.
5. Visual asset approval table.
6. Public route approval table.
7. Scorecard progress rail dashboard cards.


This document explicitly covers real write actions for quote/contact, payment, bank CSV, reconciliation, equipment, visual assets, routes, mobile conflicts, and scorecards.
