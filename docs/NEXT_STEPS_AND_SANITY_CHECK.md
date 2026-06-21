# Next Steps and Sanity Check — build 2026-06-20a / schema 152

## Completed in this pass

1. Added schema `152_staging_proof_permissions_stripe_health_accountant_export.sql`.
2. Added server-calculated role capability data for the Operations Cockpit and visible restricted-action labels for queue actions.
3. Added a plain-language reconciliation review panel: bank amount, score components, allocation list, exact split total, and difference to the cent.
4. Added Stripe health cards showing configuration presence, recent processed/failed events, and last safe validation message.
5. Blocked the old manual paid-deposit path. Stripe test checkout and verified webhook events are now the only intended way to change hosted deposit payment status.
6. Added private accountant-package generation with formula-safe CSV files, ZIP manifest, SHA-256 tracking, short-lived signed download, and readiness status.
7. Added durable staging test-run/result tables and `scripts/operations-rpc-staging-e2e.mjs`.
8. Updated the Operations Cockpit, API client, Edge Function configuration, and responsive CSS for phone/tablet/desktop use.
9. Rebuilt the canonical full schema through migrations `030` to `152`.
10. Physically moved superseded Markdown into `archive/retired-markdown-2026-06-20a/`; only three Markdown files remain active.

## Sanity-check result

The highest-risk multi-row writes remain transactional in schema 151. Schema 152 adds release visibility and testability rather than another isolated feature layer. The payment lifecycle is now more consistent: a browser or admin screen cannot simply claim a hosted payment succeeded; Stripe signature/session/amount/currency validation must pass before a deposit is paid.

Static verification can prove source wiring, schema references, syntax, role-gate presence, archive consolidation, and build markers. It cannot prove that a deployed database, storage policy, Stripe webhook endpoint, mobile browser, or user role behaves correctly. Those require the staging steps below.

## Detailed staging test process

### A. Prepare a safe staging target

1. Create or identify a Supabase project used only for testing. Do **not** run these steps against production.
2. Back up or snapshot that staging database.
3. In Supabase SQL Editor or the chosen migration tool, apply migrations in numeric order through schema 152.
4. Confirm the schema marker:

```sql
select * from public.v_schema_drift_status;
```

Expected: `expected_schema_version = 152`, `latest_applied_schema_version >= 152`, and `drift_status = current`.

5. Deploy these Edge Functions from this build:

```bash
supabase functions deploy operations-manage
supabase functions deploy customer-portal
supabase functions deploy stripe-webhook
supabase functions deploy accountant-export
supabase functions deploy upload-public-asset
supabase functions deploy public-content
```

6. In the staging project only, set `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, and `STRIPE_WEBHOOK_SECRET`. Use Stripe **test-mode** credentials only.
7. Add the Stripe staging webhook endpoint for `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, and `checkout.session.expired`.

### B. Create test users and records

1. Create one active `job_admin` or `admin` test account and one active `worker` test account. Do not use personal production accounts.
2. Create one test customer, AR invoice, AP bill, open bank account, and a small quote package in staging. Label every test record with `STAGING-` so it is easy to identify and remove.
3. Create a bank CSV preview with at least one accepted row, then promote it to create a reconciliation item.
4. Record these values in a temporary local note, not source control:
   - job-admin profile UUID;
   - job-admin session JWT;
   - worker session JWT;
   - a staging reconciliation item UUID.
5. Use the customer portal to create one test quote acceptance and Stripe test Checkout session. Do not manually mark the deposit paid.

### C. Run automated checks

Run the no-credential checks first:

```bash
node scripts/operations-rpc-integration-test.mjs
node scripts/operations-rpc-staging-e2e.mjs
node scripts/repo-smoke-check.mjs
```

All static checks should pass. The staging harness should say it skipped live calls; that is normal without credentials.

For the live staging run, set environment variables in the same terminal. Replace the placeholder values with staging-only values; do not paste them into a GitHub issue, ZIP, or chat transcript.

```powershell
$env:YWI_RUN_STAGING_RPC_TESTS = '1'
$env:YWI_STAGING_LABEL = 'staging'
$env:YWI_STAGING_CONFIRM = 'I_CONFIRM_STAGING_ONLY'
$env:SUPABASE_URL = 'https://YOUR-STAGING-PROJECT.supabase.co'
$env:SUPABASE_SERVICE_ROLE_KEY = 'YOUR-STAGING-SERVICE-ROLE-KEY'
$env:YWI_STAGING_JOB_ADMIN_PROFILE_ID = 'JOB-ADMIN-PROFILE-UUID'
$env:YWI_STAGING_JOB_ADMIN_JWT = 'JOB-ADMIN-SESSION-JWT'
$env:YWI_STAGING_WORKER_JWT = 'WORKER-SESSION-JWT'
$env:YWI_STAGING_RPC_FIXTURES_JSON = '{"reconciliation_item_id":"RECONCILIATION-ITEM-UUID"}'
node scripts/operations-rpc-staging-e2e.mjs
```

Expected live outcome: schema health, permission matrix, capability snapshot, role allow/deny checks, and exact-cent rejection pass. Skipped cases mean a required staging-only input was not provided; they are not failures, but they should be completed before production approval.

### D. Manual browser acceptance test

Use a current browser on phone width, tablet width, and desktop width. Sign in as the job-admin test user.

1. **Role clarity:** Open Operations Cockpit. Verify the role strip identifies the test role and shows permitted/restricted actions. Sign in as worker and confirm restricted actions are blocked by the server, not only visually disabled.
2. **Payment posting:** Create a small `STAGING-` payment action with a proof reference. Approve it. Post it. Verify one AR/AP application and one balanced journal batch; retry the post and verify it does not create a duplicate batch.
3. **Bank promotion:** Upload a small test CSV. Preview it, confirm it, and verify a statement import, reconciliation session, and reconciliation items appear.
4. **Exact split:** Open a reconciliation row. Try a split whose allocations do not equal the bank row exactly; expect rejection. Then use a valid exact-cent split and verify the review card shows zero difference.
5. **Quote conversion:** From the customer portal, accept a staging quote twice. Verify only one work order is created or reused.
6. **Stripe deposit:** Complete checkout with a Stripe test card. Verify the webhook health card records a verified processed event and the deposit status updates only after that event. Try no manual paid-status action; it should be unavailable/blocked.
7. **Accountant package:** Resolve or note any readiness issues. Generate an accountant package as job admin. Verify it downloads through a short-lived link, opens as a ZIP, has the expected CSVs/manifest, and no spreadsheet cell starts as a live formula.
8. **Visual assets and routes:** Upload one approved staging image. Verify width/height, thumbnail, consent/approval gate, public route readiness, exactly one H1, canonical/meta data, and sitemap entry only after approval.
9. **Responsive pass:** On a narrow viewport, verify health cards, role notices, queues, math cards, buttons, and forms are readable without overlap or forced horizontal scrolling. Test reduced-motion preference.
10. **Cleanup:** Delete or archive all `STAGING-` financial, customer, portal, media, and export records according to the staging-retention rule.

## Release blockers

Do not promote to production until all are complete:

- schema 152 is deployed and current in staging;
- all changed Edge Functions are deployed with staging-only keys;
- job-admin allowed and worker denied checks pass;
- failed payment, locked period, duplicate post, invalid exact split, duplicate quote acceptance, wrong Stripe session/amount/currency, and webhook signature failures are verified;
- Stripe test webhooks show safe health outcomes;
- accountant export is checked by the intended accountant or bookkeeper for chart-of-accounts and tax-reporting suitability;
- actual phone/tablet/desktop browser verification is complete;
- actual approved images replace the most visible placeholders;
- real Search Console and Google Business Profile data are reviewed before changing public route priorities.

## Highest-value next work

1. Build a disposable full staging fixture creator/cleanup routine for AR, AP, bank, reconciliation, quote, portal, and Stripe test data, so the live harness can cover successful mutations without manual setup.
2. Add browser-based integration tests in CI against a temporary Supabase test project.
3. Add row-level storage and database-policy assertions for public assets, accountant ZIPs, portal tokens, and staff roles.
4. Connect accountant export packaging to a reviewed chart-of-accounts/tax mapping and period close checklist.
5. Replace approved placeholders with original workshop, vehicle, product, and before/after media, then review alt text and image roles.
6. Connect Search Console and Google Business Profile observations to the route and content decision queue.
7. Add verified payment-provider operational alerts for repeated webhook failures or stale test/live delivery health.
