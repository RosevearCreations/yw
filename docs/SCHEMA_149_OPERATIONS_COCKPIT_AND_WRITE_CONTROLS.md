# Schema 149 — Operations Cockpit and Write Controls

Build: **2026-06-17a**  
Schema: **149**

## Purpose

Schema 149 converts the schema 148 write targets into a usable desktop/mobile Admin Operations Cockpit. The pass adds write-audit events, role checks, idempotency, decision controls, bank import confirmation, route/asset readiness, quote duplicate suppression, QR/barcode scanning with manual fallback, and local retry storage.

## Implemented

- Payment action request form for apply, reversal, refund, write-off, and overpayment credit.
- Payment approval/rejection/post/cancel API actions with proof and period-lock checks.
- Bank CSV parser/upload preview with header checks, row validation, duplicate detection, rejected-row reasons, and confirmation action.
- Reconciliation match/split/undo/signoff/reject request form.
- Equipment custody form with BarcodeDetector camera support and manual fallback.
- Visual asset approval intake with source, alt text, consent, compression, route, and readiness score.
- Public route approval intake with title, one-H1, meta, local proof, CTA, and readiness score.
- Persistent write audit events and Admin-readable scorecard views.
- Local device retry copy when a write action fails.
- Quote/contact duplicate suppression and a 24-hour follow-up target.

## Competitive direction reviewed

The pass keeps YWI aligned with the strongest patterns found in current landscape-service platforms:

- Jobber: quote/request intake, mobile/office parity, customer self-service, scheduling, invoicing, and payments.
- LMN: lead/property tracking, estimating, crew scheduling, financial visibility, and communication history.
- Aspire: estimating, scheduling, purchasing, invoicing, real-time job costing, and mobile field execution.

YWI's differentiator remains combining those operational patterns with Ontario safety/HSE, equipment custody, accounting close, and robust offline/fallback controls.

## Deployment

1. Apply migrations through schema 149.
2. Deploy `operations-manage`.
3. Deploy `quote-contact-submit`.
4. Deploy `admin-directory`.
5. Redeploy jobs functions only when their live versions are behind.
6. Clear the old service worker and load cache marker `2026-06-17a`.
7. Test one action in each Operations Cockpit panel.
