# Active Project Handbook — build 2026-06-18a / schema 151

## Current build

**Repository build:** `2026-06-18a`  
**Database marker:** schema `151`  
**Primary product direction:** a mobile-first operations, quoting, customer portal, equipment, media, route-publication, accounting, and reconciliation platform for the service-business workflow we are building.

This pass keeps schema 150’s customer portal, media, sitemap, queue, dispatch, and live job-cost foundation, then adds the schema 151 transactional RPC layer. The goal is to stop fragile multi-row business transactions from living only in Edge Function code.

## Active Markdown policy

Only these files are active:

- `README.md`
- `docs/ACTIVE_PROJECT_HANDBOOK.md`
- `docs/NEXT_STEPS_AND_SANITY_CHECK.md`

All older Markdown is archived under `archive/retired-markdown-2026-06-18a/`. Do not restore archived roadmap files as active files unless deliberately re-opening an old decision.

## Business and competitive direction

The product should continue moving toward a practical small-service-business system:

- quote intake, owner assignment, reminders, and follow-up history;
- customer portal with quote acceptance, deposit flow, service requests, schedule visibility, and receipt/status history;
- field operations with dispatch, live job cost, evidence/media capture, equipment custody, scan resolution, service tasks, and cost recovery;
- accounting work queues with AR/AP applications, journals, refunds, reversals, bank imports, and reconciliation;
- SEO-safe approved public route pages, canonical URLs, sitemap entries, descriptive approved visuals, and one clear H1 per generated page.

The competitive pattern remains: Jobber-style customer self-service and job lifecycle, Aspire-style signed-contract/work-ticket/job-cost visibility, and LMN-style lead follow-up, scheduling, payments, and estimate-vs-actual operational discipline.

## Schema 151 transactional RPC layer

This pass adds a transactional PostgreSQL RPC layer for accounting, reconciliation, and quote conversion so multi-row writes succeed or fail as one unit.

Schema 151 adds these PostgreSQL RPCs:

- `ywi_rpc_post_payment_action` — posts approved payment actions to AR/AP applications and balanced GL journals inside one database transaction.
- `ywi_rpc_promote_bank_csv_import` — promotes accepted CSV preview rows into statement imports, reconciliation sessions, reconciliation items, and preview-row links atomically.
- `ywi_rpc_apply_reconciliation_action` — records match, split, undo, signoff, and rejection actions with exact-cent split validation and persisted explanations.
- `ywi_rpc_accept_quote_package` — accepts a portal quote, creates/reuses one work order, updates the estimate/package, and records portal events atomically.
- `ywi_rpc_prepare_deposit_request` — calculates the exact remaining deposit and creates/reuses one deposit request.
- `ywi_rpc_attach_deposit_checkout` — attaches a Stripe Checkout session to a deposit and records the portal event.
- `ywi_rpc_record_portal_deposit_paid` — records paid deposits, creates/updates AR payment credit records, creates the matching payment action, and updates portal/package status atomically.
- `ywi_rpc_mark_deposit_checkout_status` — records non-paid checkout states without overwriting paid deposits.

The RPCs use role/rank helpers, accounting-period lock checks, exact-cent money helpers, balanced journal validation, and explicit execute grants. Multi-row failures now raise exceptions so the whole call rolls back instead of leaving half-written workbench data.

## Edge Function responsibilities

Edge Functions should now do five things:

1. authenticate or validate the public token/webhook signature;
2. normalize request values and perform friendly front-door validation;
3. call the appropriate schema 151 RPC for multi-row writes;
4. write non-blocking audit/notification records where safe;
5. return a compact response for the cockpit, portal, or webhook.

The most important delegated paths are:

- `operations-manage` → payment posting, bank CSV promotion, reconciliation actions;
- `customer-portal` → quote acceptance, deposit request preparation, checkout attachment;
- `stripe-webhook` → paid/processing/failed/expired deposit state changes.

## SEO and public-page rules

Public pages should continue to follow these rules:

- exactly one visible H1 per exposed page;
- clear title/canonical/meta fields;
- approved route records only;
- approved visual assets only;
- descriptive alt text and nearby relevant text for images;
- structured data that matches visible page content;
- sitemap entries generated from approved published routes only;
- no generated route may overwrite reserved application paths such as `/docs`, `/api`, `/js`, `/sql`, `/supabase`, `index.html`, or `sitemap.xml`.

## Mobile and desktop rules

The protected cockpit, customer portal, and generated public routes must remain usable on phone and desktop. Keep queue cards readable, avoid overlapping controls, preserve reduced-motion support, and avoid layouts that require horizontal scrolling on narrow screens.

## Verification commands

Run these before packaging:

```bash
node scripts/operations-rpc-integration-test.mjs
node scripts/repo-smoke-check.mjs
```

The RPC integration script runs static checks without credentials. With `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`, it also checks the deployed staging permission matrix. Seeded live transaction scenarios still require staging data.

## Deployment order

1. Apply migrations through schema 151.
2. Deploy updated Edge Functions: `operations-manage`, `customer-portal`, and `stripe-webhook`.
3. Confirm `v_schema_drift_status.expected_schema_version = 151`.
4. Confirm `v_operation_rpc_permission_matrix` has the schema 151 test rows.
5. Run staging tests for AR, AP, write-off, overpayment credit, refund, reversal, bank CSV promotion, reconciliation match/split/undo/signoff, quote acceptance, deposit checkout, and Stripe webhook completion.
6. Run public route generation and inspect one generated service/location page on phone and desktop.
