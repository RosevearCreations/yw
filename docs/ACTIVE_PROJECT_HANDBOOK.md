# Active Project Handbook — Yard Weasels Inc.

**Current release:** `2026-07-07a` · **Schema target:** `156` · **Status:** source-checked, pending live staging proof.

## What this platform is for

Yard Weasels Inc. is being built as a practical field-service system: lead to quote, quote to accepted work order, dispatch, proof of work, deposits and accounting, customer communication, and repeat maintenance. Public marketing pages remain separate from secure customer and staff surfaces.

## Current operating surfaces

### Public website

- Local service pages, one clear H1 per page, approved imagery, descriptive alt text, canonical URLs, structured data that matches visible content, and approved sitemap entries.
- Public routes are generated only after approval. Customer portals, job updates, internal queues, accounting, and private media do not enter sitemaps or public navigation.

### Customer portal

- Token-protected quote review and acceptance.
- Server-calculated deposit requests and Stripe Checkout handoff.
- Work-order schedule status, customer-safe live job timeline, and approved public images only.
- Schema 156 preference panel for explicit future live-update email opt-in/out.

### Operations Cockpit

- Role-aware accounting, reconciliation, equipment, media, route, quote, dispatch, job-cost, release-readiness, and live-work-update queues.
- Cockpit is dark-surface by design with explicit text/state colours and mobile stacking rules.
- Customer email delivery queue exposes status, attempts, consent state, and retry controls—not addresses, tokens, staff notes, or private media.

## Security and privacy boundaries

- Customer-visible live updates require supervisor authority; staff updates remain staff-only.
- Customer-visible update media must be approved for public delivery.
- Private review uploads remain in `review-assets` until approval copies them to public delivery.
- Schema 156 uses direct-table RLS, service-role-only notification RPCs, a token-protected portal preference action, and a separately protected scheduler endpoint.
- Opting out cancels unsent customer emails. A retracted update cannot dispatch. Provider/network uncertainty is placed in `manual_review` instead of silently retrying a possible duplicate email.
- Stripe payment status remains webhook-controlled. Do not manually mark hosted deposits paid.

## Current schema highlights

- **150**: transactional operations, portal, media approval, approved route generation.
- **151**: transactional accounting/reconciliation/quote-conversion RPCs.
- **152–154**: release evidence, policy assertions, accountant readiness, staging fixture support.
- **155**: live job updates with customer/staff visibility and retraction.
- **156**: explicit customer email preference, private delivery outbox, bounded retries, delivery audit, manual review, and protected dispatcher.

The canonical schema reference is `sql/000_full_schema_reference.sql`, containing migrations 030–156.

## Current release boundary

Source contracts and static checks can prove wiring, syntax, documentation alignment, and basic CSS contracts. They cannot prove live database migration behavior, Supabase RLS/storage enforcement, provider delivery, webhook receipt, or authenticated device rendering. Those remain staging gates.

## Documentation rule

Only `README.md`, this handbook, and `docs/NEXT_STEPS_AND_SANITY_CHECK.md` are active. All older Markdown is preserved in the dated archive for history and recovery.


Stale delivery claims older than 15 minutes are moved to manual review; they are never resent automatically.
