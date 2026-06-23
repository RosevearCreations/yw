# Active Project Handbook — build 2026-06-22a / schema 153

## Purpose and operating direction

**Build:** `2026-06-22a`  
**Database marker:** schema `153`  
**Product direction:** a mobile-first service-business platform combining local discovery, quote intake, customer self-service, field work, equipment custody, media approval, dispatch, job costing, accounting, reconciliation, and accountant-review exports.

The platform is intentionally built as one connected workflow rather than separate admin screens:

1. A local customer finds a helpful service/location page.
2. A request is assigned, followed up, quoted, and accepted.
3. The customer uses a limited portal for status, deposit checkout, and scheduling visibility.
4. Staff dispatch work, scan equipment, capture approved media, and review job costs.
5. Finance staff approve/post payment work, promote bank records, reconcile, close review, and prepare private accountant packages.

## Active-document rule

Only these documents are active:

- `README.md`
- `docs/ACTIVE_PROJECT_HANDBOOK.md`
- `docs/NEXT_STEPS_AND_SANITY_CHECK.md`

All older plans live under `archive/retired-markdown-2026-06-22a/`. They are preserved so another AI or developer can understand historical decisions, but they are not current implementation authority.

## Schema 151: transactional business writes

The high-risk, multi-row outcomes are owned by PostgreSQL transactions:

- `ywi_rpc_post_payment_action` posts approved AR/AP actions, applications, and balanced journals.
- `ywi_rpc_promote_bank_csv_import` turns accepted CSV preview rows into statement/reconciliation records.
- `ywi_rpc_apply_reconciliation_action` handles match, exact split, reject, undo, and signoff with score explanation.
- `ywi_rpc_accept_quote_package` accepts a quote and reuses or creates one work order.
- `ywi_rpc_prepare_deposit_request` and `ywi_rpc_attach_deposit_checkout` calculate and attach deposits without duplicate requests.
- `ywi_rpc_record_portal_deposit_paid` and `ywi_rpc_mark_deposit_checkout_status` keep provider-controlled payment status inside verified flows.

Edge Functions authenticate, normalize, and give friendly messages. The database is the all-or-nothing source of truth.

## Schema 152: release proof and operational visibility

Schema 152 added:

- server-provided role capabilities for cockpit explanations;
- Stripe delivery-health records with safe validation status;
- fail-closed manual hosted-deposit status changes;
- accountant exports in a private bucket with signed links, SHA-256 record, and formula-safe CSV cells;
- staging test-run/result history;
- responsive role, health, reconciliation, and accountant readiness surfaces.

## Schema 153: repeatable proof, private media, and close controls

Schema 153 adds the current highest-value release safeguards:

### Staging fixtures and cleanup

- `operations_staging_fixture_sets` and `operations_staging_fixture_records` track only `STAGING-` labelled data.
- `ywi_rpc_create_staging_fixture_set` creates disposable customer, vendor, AR, AP, bank, quote/portal, and bank-preview records.
- `ywi_rpc_cleanup_staging_fixture_set` removes only the tracked fixture records.
- The Cockpit action is disabled unless the **staging deployment** has `YWI_ALLOW_STAGING_FIXTURES=true`.
- The command-line fixture tool has separate explicit interlocks: `YWI_STAGING_FIXTURES=1`, `YWI_STAGING_LABEL=staging`, and `YWI_STAGING_CONFIRM=I_CONFIRM_STAGING_ONLY`.

### Private media review and public publication

- New uploads enter the private `review-assets` bucket.
- Browser compression creates optimized image and thumbnail files; the Edge Function independently verifies MIME type, dimensions, sizes, and SHA-256.
- Review assets have no public URL.
- Approval through the protected Operations Cockpit copies the files to `public-assets` and records published paths/URLs.
- Public routes may use only approved, publication-ready assets. The UI marks private files as **Private review** rather than attempting to expose them.

### Security/policy evidence

- RLS is enabled on sensitive review/export/portal/fixture/mapping/alert tables.
- Browser clients do not receive direct access to operational security, mapping, alert, or fixture views; protected Edge Functions supply necessary staff data.
- `ywi_security_policy_assertions()` checks private review media, private accountant exports, public-asset presence, sensitive-table RLS, and non-public portal RPC permissions.
- `v_security_policy_assertion_summary` drives the release-proof display and staging checks.

### Accountant close mapping

- `accountant_export_mapping_rules` holds chart-of-accounts/tax/close mapping review records.
- `v_accountant_mapping_readiness` exposes unresolved required mappings.
- `ywi_rpc_capture_accountant_close_snapshot` stores the mapping and close checklist state with every generated package.
- An export is an accountant-review artifact, never a tax return or automatic filing authorization.

### SEO and local performance decisions

- `content_signal_observations` records manual Search Console, Google Business Profile, or analytics evidence without storing credentials.
- `v_route_content_decision_queue` gives staff human-reviewed next actions; it does not auto-rewrite pages from a metric.
- Suggested actions emphasize useful page answers, local proof, internal links, CTA relevance, and approved original imagery. They explicitly reject keyword stuffing.

### Verified payment-provider operations

- The webhook records safe delivery outcomes after signature validation.
- `ywi_refresh_stripe_webhook_alerts()` opens alerts for repeated validation/processing failures and stale delivery health.
- Cockpit staff may acknowledge or resolve alerts, but they cannot override a hosted deposit as paid.

## Public discovery, SEO, and visual rules

Keep these rules mandatory for every exposed public route:

1. Exactly one visible H1 per page.
2. The title, H1, intro, and internal links should use natural service and location terms people search for; do not use keyword lists or misleading location claims.
3. Structured data must reflect visible content.
4. Only approved route records and approved public media may become crawlable pages or sitemap entries.
5. Descriptive filenames, alt text, nearby context, captions where useful, and clear image roles are required; placeholders remain labelled until replaced by original approved media.
6. Reserved system paths such as `/api`, `/docs`, `/js`, `/sql`, `/supabase`, `index.html`, `robots.txt`, and `sitemap.xml` are never valid database-generated routes.
7. Search Console/GBP signals prompt a human review; they never automatically publish changes.

Useful primary references for deployment decisions:

- Google Search Essentials: <https://developers.google.com/search/docs/essentials>
- Google image SEO guidance: <https://developers.google.com/search/docs/appearance/google-images>
- Google structured-data guidance: <https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data>
- Google sitemap overview: <https://developers.google.com/search/docs/crawling-indexing/sitemaps/overview>
- Supabase row-level security: <https://supabase.com/docs/guides/database/postgres/row-level-security>
- Stripe webhook fulfilment/status handling: <https://docs.stripe.com/webhooks>

## Customer and field-service experience rules

- Quote owner, response deadline, contact history, and next action must be visible to staff.
- Portal customers can see their own accepted quote/work order/deposit/schedule path, not staff controls or unrelated records.
- Hosted payment status comes from verified provider events, never a manual “paid” button.
- Equipment scans resolve against real records; failed returns create reviewable service/cost-recovery work.
- Dispatch and job-cost summaries must remain readable on phone, tablet, and desktop.
- Staff-visible queues must preserve proof, notes, and reversibility rather than silently mutating history.

## Mobile/desktop and CSS rules

- No horizontal overflow at phone widths except deliberate data-table scroll regions.
- Queue cards, release-proof cards, health cards, exact-math cards, and forms collapse to one column on narrow screens.
- Buttons retain readable labels and touch-safe height.
- Reduced-motion preference remains respected.
- New visual placeholders clarify what original image will improve the page; they do not pretend to be customer work or approved photographs.

## Required local source checks

```bash
node scripts/operations-rpc-integration-test.mjs
node scripts/security-policy-assertions.mjs
node scripts/operations-rpc-staging-e2e.mjs
node scripts/repo-smoke-check.mjs
```

`operations-rpc-staging-e2e.mjs` is source-only by default. Live calls require the explicit staging interlocks in the next-step guide.
