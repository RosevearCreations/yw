# Active Project Handbook — build 2026-06-17a / schema 149

This is the primary project source of truth. A new AI/chat should read this file first, then `NEXT_STEPS_AND_SANITY_CHECK.md`. Older Markdown is retained as reference/history, not as the current task list.

## Product position

YWI is a combined desktop Admin website and mobile field application for a Southern Ontario landscaping/service business. It covers public lead intake, customers/sites, estimates, jobs, crews, safety/HSE, equipment custody, reporting, accounting close, reconciliation, payroll/tax evidence, offline behavior, and release/schema health.

## Current implementation

- Public quote/contact requests write through an Edge Function, suppress near-duplicate requests, and receive a follow-up target.
- Admin Operations Cockpit provides usable forms for payment actions, bank CSV preview, reconciliation actions, equipment scans/custody, visual assets, and public routes.
- Payment actions support request, approval, rejection, posting, cancellation, proof requirements, idempotency, and accounting-period confirmation.
- Bank CSV preview validates headers/dates/amounts, identifies duplicate/rejected rows, and supports confirmation.
- Equipment capture supports browser QR/barcode scanning where available plus manual-code fallback everywhere.
- Visual assets and public routes stay gated until approval/readiness requirements are met.
- Failed Operations Cockpit writes save a local retry copy instead of silently losing work.
- Desktop emphasizes Admin, accounting, route/asset approval, reporting, and scorecards. Mobile emphasizes Today actions, field forms, scanning, custody, and fallback.

## SEO rules

- Keep exactly one H1 on every exposed public page.
- Use clear service and location wording in the title, H1, introduction, internal links, and CTA without unsupported locality claims.
- Publish service/location routes only after title, H1, meta, local proof, CTA, visual fallback, and sitemap checks pass.
- Keep crawlable internal links descriptive and useful.
- Do not promise first-page ranking; improve relevance, proof, conversion, reviews/prominence, and technical quality each pass.

## Competitive direction

Current official product positioning reviewed for Jobber, LMN/Granum, and Aspire confirms that competitive landscape software combines lead capture, quoting, scheduling, mobile crew work, customer communication, invoicing/payments, and job costing. YWI should continue toward that integrated lifecycle while retaining its stronger safety, equipment, closeout, and offline evidence controls.

## Markdown policy

Primary working files:

1. `docs/ACTIVE_PROJECT_HANDBOOK.md`
2. `docs/NEXT_STEPS_AND_SANITY_CHECK.md`

Core reference files remain in the repository root for architecture, deployment, database, testing, changelog, AI handoff, and history. Temporary/helper Markdown belongs under `archive/`.
