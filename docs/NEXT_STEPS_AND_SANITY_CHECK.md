# Next Steps and Sanity Check — build 2026-06-22a / schema 153

## Completed in this pass

1. Added `sql/153_release_fixture_policy_mapping_seo_alerts.sql`.
2. Added disposable, tracked `STAGING-` fixture creation/cleanup RPCs for a customer, vendor, AR invoice, AP bill, bank account, quote/portal package, and accepted bank-preview record.
3. Added deployment-level and command-line staging interlocks so fixture creation is never enabled by default.
4. Converted fresh image uploads to private `review-assets` storage. A protected approval decision now copies approved originals/thumbnails to the public delivery bucket.
5. Added independent server-side MIME/dimension/size/checksum verification and removed unsupported AVIF selection from the UI so browser/server claims match.
6. Added policy assertions for private review media, private accountant ZIPs, RLS coverage, public asset delivery, and non-public portal-RPC execution.
7. Added accountant mapping rules, mapping readiness, close-checklist snapshots, and export-function snapshot capture.
8. Added Search Console / Google Business Profile / manual analytics observation records and human content-decision queue.
9. Added repeated Stripe webhook failure and stale-delivery alert records, refresh logic, and Cockpit acknowledge/resolve actions.
10. Expanded the Operations Cockpit with release-proof cards, private-media status, staging fixture controls, route-signal decisions, and payment-provider alerts.
11. Added `scripts/staging-fixtures.mjs`, `scripts/security-policy-assertions.mjs`, revised static/live RPC proof, browser-contract test scaffolding, and a GitHub Actions workflow.
12. Updated cache build markers to `2026-06-22a` and schema markers to `153`.
13. Physically consolidated active Markdown to three files; **80** historical Markdown files were moved into `archive/retired-markdown-2026-06-22a/` and four temporary write files were archived.

## Current sanity result

The new release closes the next highest-value safety gaps in the roadmap. Accounting/reconciliation/quote writes remain transactional from schema 151; schema 153 makes staging evidence repeatable, makes unapproved media private by design, and captures financial/SEO/payment-provider decisions as reviewable records.

Static verification can prove source wiring, archive state, cache markers, syntax, build/schema references, and policy definitions. It cannot prove a deployed Supabase project, Edge Function secret configuration, storage policy behavior, Stripe endpoint delivery, or a rendered device/browser. Those are staging gates, not assumptions.

## Detailed staging test process

### 1. Prepare a dedicated non-production project

1. Create or select a Supabase project used only for testing. Confirm it is not the live project.
2. Snapshot/backup the staging database.
3. Apply migrations in numeric order through `153_release_fixture_policy_mapping_seo_alerts.sql`.
4. Confirm the marker in Supabase SQL Editor:

```sql
select * from public.v_schema_drift_status;
```

Expected:

- `expected_schema_version = 153`
- `latest_applied_schema_version >= 153`
- `drift_status = current`

5. Deploy the changed functions:

```powershell
supabase functions deploy operations-manage
supabase functions deploy upload-public-asset
supabase functions deploy stripe-webhook
supabase functions deploy accountant-export
supabase functions deploy customer-portal
supabase functions deploy public-content
```

6. In the **staging project only**, configure:

```text
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
YWI_ALLOW_STAGING_FIXTURES=true
```

Do not use live Stripe keys or a production service-role key.

7. Configure the staging Stripe webhook endpoint for:

```text
checkout.session.completed
checkout.session.async_payment_succeeded
checkout.session.async_payment_failed
checkout.session.expired
```

### 2. Create safe test identities

1. Create an active staging-only `job_admin` or `admin` user and one active `worker` user.
2. Record locally, not in Git/GitHub/chat:
   - job-admin profile UUID;
   - job-admin session JWT;
   - worker session JWT.
3. Use only `STAGING-` labels for manual records. Never run fixtures in production.

### 3. Run source/static checks first

From the repository root:

```powershell
node scripts/operations-rpc-integration-test.mjs
node scripts/security-policy-assertions.mjs
node scripts/operations-rpc-staging-e2e.mjs
node scripts/repo-smoke-check.mjs
```

Expected: all source checks pass. The staging harness says live calls were skipped without staging credentials; that is correct.

### 4. Create disposable fixtures in staging

Set these values in the **same PowerShell window**. Replace only the values in quotes:

```powershell
$env:YWI_STAGING_FIXTURES = '1'
$env:YWI_STAGING_LABEL = 'staging'
$env:YWI_STAGING_CONFIRM = 'I_CONFIRM_STAGING_ONLY'
$env:SUPABASE_URL = 'https://YOUR-STAGING-PROJECT.supabase.co'
$env:SUPABASE_SERVICE_ROLE_KEY = 'YOUR-STAGING-SERVICE-ROLE-KEY'
$env:YWI_STAGING_JOB_ADMIN_PROFILE_ID = 'JOB-ADMIN-PROFILE-UUID'
$env:YWI_STAGING_FIXTURE_LABEL = 'STAGING-RPC'
node scripts/staging-fixtures.mjs create
```

The output returns `fixture_set_id`, AR/AP IDs, bank-preview ID, and quote package ID. The portal token is masked unless `YWI_REVEAL_STAGING_TOKENS=1`; only reveal it in a private local staging test session.

### 5. Run the live proof harness

Continue in the same PowerShell window:

```powershell
$env:YWI_RUN_STAGING_RPC_TESTS = '1'
$env:YWI_STAGING_JOB_ADMIN_JWT = 'JOB-ADMIN-SESSION-JWT'
$env:YWI_STAGING_WORKER_JWT = 'WORKER-SESSION-JWT'
$env:YWI_STAGING_CREATE_FIXTURES = '1'
$env:YWI_STAGING_CLEANUP_FIXTURE = '0'
node scripts/operations-rpc-staging-e2e.mjs
```

Expected checks:

- schema 153 current;
- policy assertions pass;
- accountant mapping readiness view reachable;
- role-capability snapshot includes schema 153 actions;
- job admin receives Operations Cockpit data;
- worker receives server-side denial;
- a disposable fixture set is created.

The exact-split rejection check is optional because it needs a dedicated promoted reconciliation item UUID. Once one exists, set:

```powershell
$env:YWI_STAGING_RPC_FIXTURES_JSON = '{"reconciliation_item_id":"RECONCILIATION-ITEM-UUID"}'
node scripts/operations-rpc-staging-e2e.mjs
```

A deliberately wrong split must be rejected. A successful wrong split is a production blocker.

### 6. Manual browser acceptance test

Use a current browser at phone width, tablet width, and desktop width. Start as staging job admin.

1. **Policy/role evidence** — Operations Cockpit must show the role capability strip and policy evidence. Sign in as worker and confirm server rejection, not just a disabled button.
2. **Private media** — Upload a JPEG/PNG/WebP. Verify the Cockpit says **Private review**, with no public preview URL. Approve it and verify the file is copied to the public bucket, the asset becomes publication-ready, and only then may it satisfy a route visual gate.
3. **Payment posting** — Create a small `STAGING-` payment action with proof. Approve/post it. Verify a single application and balanced journal batch. Repost must not duplicate it.
4. **Bank promotion/reconciliation** — Preview/confirm a staging CSV. Verify import/session/items exist. Try a split that is off by one cent; it must fail. Use a valid exact split and verify zero difference.
5. **Quote and portal** — Accept a staging quote twice. Verify one work order is reused, not duplicated. Create a test-mode Stripe checkout. Verify payment is recorded only after a verified webhook event.
6. **Webhook alerts** — Send safe test failure/expiry events as appropriate. Confirm that repeated delivery failures produce an alert and that acknowledge/resolve actions add no paid-status override.
7. **Accountant package** — Check mapping readiness. Generate a private package. Verify the ZIP opens from a short-lived signed URL, has CSV/manifest/README, records a SHA-256, includes mapping snapshot metadata, and does not contain active spreadsheet formulas from imported data.
8. **SEO signal decision** — Record one Search Console/GBP/manual observation. Confirm it appears in the decision queue. Mark review/actioned with a human note. Verify it does not auto-publish content.
9. **Responsive behavior** — Confirm no unexpected horizontal overflow; queue cards, release cards, forms, exact-math cards, and actions remain readable; reduced-motion setting behaves cleanly.
10. **Public route** — Confirm exactly one H1, proper canonical/meta, original approved image/alt text, and a sitemap entry only after route approval/publish.

### 7. Cleanup staging fixtures

After browser testing, use the **fixture set ID** returned earlier:

```powershell
$env:YWI_STAGING_FIXTURE_SET_ID = 'FIXTURE-SET-UUID'
node scripts/staging-fixtures.mjs cleanup
```

Confirm `cleaned: true`. Do not leave test customer, financial, portal, or bank data in staging without a documented reason.

## Release blockers

Do not move toward production until all are true:

- schema 153 is current in a dedicated staging project;
- all changed functions are deployed;
- staging-only Stripe keys/webhook secret are configured;
- job-admin allow and worker deny tests pass;
- storage/policy assertion summary passes;
- private review media cannot be fetched publicly before approval;
- duplicate posts, locked periods, invalid exact splits, duplicate quote acceptance, wrong Stripe session/amount/currency, and invalid webhook signatures are verified to fail safely;
- accountant or bookkeeper approves chart-of-accounts/tax mapping before reliance on export data;
- actual phone/tablet/desktop browser checks are completed;
- original approved vehicle/workshop/before-after media replaces visible placeholders;
- Search Console and Google Business Profile data are reviewed by a person before route-priority changes.

## Highest-value next work after staging proof

1. Run schema 153 in staging and fix every real migration/RLS/storage discrepancy found there.
2. Add CI secrets only in a protected staging environment and enable the optional deployed-staging workflow after one manual proof run succeeds.
3. Add actual original media and consent records to replace the highest-value visual placeholders.
4. Have the accountant/bookkeeper approve required mapping rules and define the exact month-end close checklist.
5. Connect real Search Console/GBP exports or a controlled manual import process; do not store third-party credentials in app tables.
6. Add a deliberate release dashboard showing schema status, last backup, RLS assertion status, Stripe endpoint health, and latest staging proof result.
