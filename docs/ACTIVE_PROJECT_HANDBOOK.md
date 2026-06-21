# Active Project Handbook — build 2026-06-20a / schema 152

## Current build and purpose

**Repository build:** `2026-06-20a`  
**Database marker:** schema `152`  
**Core direction:** a mobile-first service-business platform combining public discovery, quoting, customer self-service, field work, equipment care, media, dispatch, job costing, accounting, and reconciliation.

Schema 151 moved high-risk multi-row business writes into transactional PostgreSQL RPCs and database transactions. Schema 152 turns that foundation into something we can safely prove in staging before treating it as production-ready.

## Active-document rule

Only these are active:

- `README.md`
- `docs/ACTIVE_PROJECT_HANDBOOK.md`
- `docs/NEXT_STEPS_AND_SANITY_CHECK.md`

All other Markdown is preserved in `archive/retired-markdown-2026-06-20a/` for traceability. Do not reinstate an archived roadmap as current direction without deliberately reviewing it against this handbook.

## Product and operational direction

The application should continue toward one connected workflow:

- **Public discovery:** service and location pages generated only from approved route records, with one visible H1, sensible title/meta/canonical data, approved images, alt text, structured data that matches visible content, and sitemap entries.
- **Leads and quotes:** intake, owner assignment, response alerts, follow-up history, customer acceptance, clear deposit request, and dispatch handoff.
- **Customer portal:** quote status, acceptance, deposit checkout, work-order/schedule visibility, request history, and receipts/status without exposing staff-only controls.
- **Field work:** mobile-friendly dispatch, equipment scanning and custody, failed-return service tasks, cost-recovery reviews, approved media capture, and live job-cost snapshots.
- **Financial controls:** approval queues, real AR/AP applications and balanced journals, period-aware posting, bank CSV review/promotion, explainable reconciliation, close readiness, and accountant-review exports.

The customer portal remains a protected, customer-facing part of that flow. The practical benchmark remains modern service-business software: customer self-service, prompt follow-up, clear status, dispatch discipline, payments, and estimate-versus-actual job-cost visibility. This build follows those patterns without copying another vendor’s pages or claims.

## Schema 151 transaction boundary

Schema 151 keeps multi-row outcomes atomic through PostgreSQL RPCs:

- `ywi_rpc_post_payment_action` — posts an approved payment action with AR/AP application and balanced journal entries.
- `ywi_rpc_promote_bank_csv_import` — converts accepted preview rows into statement, reconciliation session/items, and source links.
- `ywi_rpc_apply_reconciliation_action` — handles match, exact split, undo, signoff, and rejection with persisted explanation data.
- `ywi_rpc_accept_quote_package` — accepts a quote, reuses/creates one work order, updates package/estimate, and records portal activity.
- `ywi_rpc_prepare_deposit_request` and `ywi_rpc_attach_deposit_checkout` — calculate and attach a deposit checkout without duplicate requests.
- `ywi_rpc_record_portal_deposit_paid` and `ywi_rpc_mark_deposit_checkout_status` — update provider-controlled payment status safely.

The Edge Functions authenticate, normalize input, do friendly validation, then call these RPCs. The database owns all-or-nothing transaction behavior.

## Schema 152 release-proof layer

Schema 152 adds:

- `ywi_get_operations_capabilities` so the protected cockpit can explain why an action is unavailable while keeping server-side permission checks authoritative.
- `stripe_webhook_delivery_events` and `v_stripe_webhook_health`, which store safe delivery outcomes and the last validation result without saving raw provider payloads.
- a fail-closed `deposit_status_update` action: staff cannot manually mark hosted deposits paid; verified Stripe events own that lifecycle.
- detailed reconciliation review UI for bank amount, score components, split allocations, and exact-cent difference.
- `operations_staging_test_runs` and `operations_staging_test_results` plus a staging-only test harness.
- a private `accountant-exports` storage bucket, signed downloads, SHA-256 artifact metadata, formula-safe CSV output, and export-readiness checks.

## SEO, content, and visual rules

Keep these public-page rules non-negotiable:

1. Exactly one visible H1 per exposed page.
2. Use actual service/location wording people search for in the title, main heading, nearby copy, and internal links, without keyword stuffing.
3. Publish only approved route records and approved visual assets.
4. Use descriptive filenames, alt text, captions/nearby supporting text, and image roles; placeholders remain marked as placeholders until approved media replaces them.
5. Match structured data to visible content.
6. Generate sitemap entries only for approved/published paths; never allow route records to overwrite `/api`, `/docs`, `/js`, `/sql`, `/supabase`, `index.html`, or `sitemap.xml`.
7. Keep the public route, mobile portal, and main site functional without reliance on unapproved third-party images.

## Mobile and desktop rules

- The cockpit must remain readable at phone, tablet, and desktop widths.
- Queue cards, role notices, health cards, and reconciliation math collapse into one column on narrow screens.
- Avoid clipped controls, hidden focus targets, layout overlap, and mandatory horizontal scrolling.
- Preserve reduced-motion behavior and local retry/draft handling where already implemented.

## Required release commands

```bash
node scripts/operations-rpc-integration-test.mjs
node scripts/operations-rpc-staging-e2e.mjs
node scripts/repo-smoke-check.mjs
```

The second command is read-only/static by default. Its live mode is deliberately locked to an explicitly named staging environment. Detailed test instructions are in `docs/NEXT_STEPS_AND_SANITY_CHECK.md`.

## Deployment order

1. Back up the staging database and confirm the target is not production.
2. Apply migrations through schema 152, including `sql/152_staging_proof_permissions_stripe_health_accountant_export.sql`.
3. Deploy `operations-manage`, `stripe-webhook`, `accountant-export`, `customer-portal`, and the existing upload/public-content functions.
4. Configure staging-only Stripe keys and webhook secret. Do not reuse live secrets.
5. Verify `v_schema_drift_status` says expected and latest schema are at least `152`.
6. Run the static checks, then the live staging harness with test-role credentials.
7. Exercise the detailed browser tests below, including a phone/tablet/desktop pass.
8. Review test-run records, webhook health, reconciliation exceptions, and accountant-export readiness before production planning.
