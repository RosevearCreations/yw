# Yard Weasels Inc. Operations Platform

**Current source release:** `2026-07-07a` · **Database target:** schema `156`

This repository contains the public site, secure customer portal, protected Operations Cockpit, Supabase migrations, Edge Functions, and static validation scripts for Yard Weasels Inc. The active documentation is intentionally limited to this README plus the two handoff files below.

## Active handoff

- `docs/ACTIVE_PROJECT_HANDBOOK.md` — product scope, security boundaries, current architecture, and release state.
- `docs/NEXT_STEPS_AND_SANITY_CHECK.md` — exact staging deployment and test steps.

Historical Markdown has been preserved under `archive/retired-markdown-2026-07-07a/`; it is reference material, not an active instruction set.

## Current customer-to-cash workflow

1. Lead / quote intake and owner follow-up.
2. Customer portal review, quote acceptance, and server-calculated deposit checkout.
3. Dispatch, secure live job updates, staff-only operational notes, and approved customer-visible images.
4. Optional customer email alerts for future customer-visible updates **only after explicit portal opt-in**.
5. Payment posting, reconciliation, accountant package readiness, review request, and repeat service.

## Schema 156: customer notification delivery

Schema 156 adds a private, consent-controlled email outbox for customer-visible live job updates. The feature is email-only. It does not send customer messages until all of the following are true:

- a supervisor publishes a customer-visible update;
- the customer has explicitly opted in through the secure portal;
- a current email address and portal link exist;
- the protected dispatcher has been configured in staging or production.

The staff queue never displays customer email addresses or portal tokens. Unsent items are cancelled on opt-out; retracted/non-customer-visible updates cannot be sent; uncertain network/provider outcomes are held for manual review.

## Commands

```powershell
npm run test:repo
npm run test:contrast
npm run test:live-updates
npm run test:notifications
npm run test:staging
```

`test:staging` intentionally does not write to any database unless explicit staging-only environment configuration is supplied.

## Non-negotiable release rules

- Never place Supabase service-role, Stripe secret, Resend, or run-token values in browser code, commits, public files, or chat.
- Keep exactly one meaningful H1 on each public page.
- Publish public routes only after the approval workflow passes; customer portals, live updates, outbox data, and staff notes are not SEO pages.
- Treat schemas 150–156 as a staging-first transaction chain. Confirm real RLS, storage, Stripe webhook, and rendered-device behavior before production.


Stale delivery claims older than 15 minutes are moved to manual review; they are never resent automatically.
