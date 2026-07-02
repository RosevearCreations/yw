# Next Steps and Sanity Check — build 2026-06-30a / schema 154

## Completed in this pass

1. Added schema 154: a human-reviewed release-readiness dashboard and captured evidence snapshots.
2. Combined the existing schema, security policy, staging test, backup/restore rehearsal, Stripe webhook, accountant-readiness, public-route/media, and SEO-signal checks into one Cockpit surface.
3. Added a protected snapshot flow that requires a job-admin role and the exact confirmation phrase `REVIEW ONLY`.
4. Kept snapshots evidence-only. They cannot deploy code, publish routes, charge customers, change payment state, or override failed checks.
5. Added responsive dashboard cards for phone, tablet, and desktop layouts using the existing accessible dark Cockpit visual system.
6. Added static checks for dashboard wiring, role protection, evidence-only language, mobile CSS, security policy coverage, and single request-body consumption in `operations-manage`.
7. Rebuilt the canonical schema reference through migrations 030–154.
8. Physically consolidated the repository to three active Markdown files and archived all historical Markdown material under `archive/retired-markdown-2026-06-30a/`.

## Current sanity result

The source package is internally checked. The release dashboard is useful only after schema 154 and the updated application are deployed to a dedicated staging environment. It reports evidence; it does not replace a human decision or make the application live.

## Required staging test process

These steps are required because this workspace does not have your staging Supabase or Stripe test credentials.

### A. Prepare a dedicated staging target

1. In Supabase, create or select a project that is clearly non-production.
2. Confirm that its project name and any environment labels visibly say `staging`.
3. Do **not** point the staging app at live customer, live Stripe, or production storage data.
4. Take a database backup/export according to your normal process before applying a new migration.
5. Confirm the current staging project has migrations through schema 153 before proceeding; schema 154 is the next migration to apply.

### B. Apply schema 154

1. Open **Supabase Dashboard → SQL Editor** for the staging project.
2. Open `sql/154_release_readiness_dashboard_and_evidence_snapshots.sql` from this build.
3. Paste the entire file into a new SQL query.
4. Run the query once.
5. Run this verification query:

```sql
select * from public.v_schema_drift_status;
```

Expected result:

- `expected_schema_version` is `154`.
- `latest_applied_schema_version` is `154` or higher.
- `drift_status` is `current`.

6. Then run:

```sql
select
  staging_evidence_status,
  public_content_status,
  policy_ready,
  backup_rehearsal_status,
  latest_staging_run_status,
  critical_webhook_alert_count
from public.v_release_readiness_dashboard;
```

Expected result: one row. Some values may correctly say `review required` or `not recorded` until the real staging proof is completed.

### C. Deploy the updated code to staging

Deploy these changed areas together so the front end, protected function, and schema agree:

- static `index.html`, `style.css`, `server-worker.js`, and `js/operations-cockpit.js`;
- `supabase/functions/operations-manage`;
- `supabase/functions/upload-public-asset`;
- `supabase/functions/stripe-webhook`;
- `supabase/functions/accountant-export`;
- `supabase/functions/customer-portal`;
- `supabase/functions/public-content`.

Use the same secret names already documented for staging. Keep service-role keys, Stripe secrets, and Resend keys in protected environment variables only. Never paste them into browser JavaScript, Git, a public route, or this document.

### D. Run source checks locally or in CI

From the extracted project folder, run:

```powershell
npm ci
npm run test:repo
npm run test:staging
```

Without staging credentials, `npm run test:staging` performs source checks and reports that live checks were skipped. That is expected.


### D.1 Optional GitHub Actions checks

The included `.github/workflows/staging-browser-integration.yml` runs repository checks and a public-shell browser contract on pull requests. Its guarded staging job runs only when manually requested and when the GitHub `staging` environment provides the dedicated staging secrets. Keep those secrets in GitHub Environment secrets, not in repository files.

### E. Run the guarded live staging harness

Only in a dedicated staging PowerShell session, set the values below for that session. Replace the placeholder values; do not commit them anywhere.

```powershell
$env:YWI_RUN_STAGING_RPC_TESTS = '1'
$env:YWI_STAGING_LABEL = 'staging'
$env:YWI_STAGING_CONFIRM = 'I_CONFIRM_STAGING_ONLY'
$env:SUPABASE_URL = 'https://YOUR-STAGING-PROJECT.supabase.co'
$env:SUPABASE_SERVICE_ROLE_KEY = 'YOUR_STAGING_SERVICE_ROLE_KEY'
$env:YWI_STAGING_JOB_ADMIN_PROFILE_ID = 'YOUR_STAGING_JOB_ADMIN_PROFILE_UUID'
```

Optional, only when you want the harness to create clearly labelled disposable records:

```powershell
$env:YWI_STAGING_CREATE_FIXTURES = '1'
$env:YWI_STAGING_FIXTURE_LABEL = 'STAGING-E2E'
$env:YWI_STAGING_CLEANUP_FIXTURE = '1'
```

Then run:

```powershell
npm run test:staging
```

The harness should confirm schema 154, policy assertions, accountant mapping view availability, release dashboard availability, capability snapshot, job-admin allow/worker deny when test JWTs are supplied, and optional disposable fixture creation/cleanup.

### F. Browser acceptance test: Operations Cockpit

1. Open the deployed staging site in a private/incognito browser window.
2. Sign in as a job-admin test user.
3. Open **Admin → Operations Cockpit**.
4. Confirm the new **Release readiness dashboard** appears below payment/accountant health cards.
5. Verify that each category has readable text and an understandable state:
   - Schema
   - Policy
   - Staging tests
   - Recovery proof
   - Webhook health
   - Public content
6. Confirm a yellow/review card does not look like a failure to deploy. It means evidence is incomplete or needs human review.
7. At phone width around **390px**, confirm cards stack one per row and there is no horizontal scrolling.
8. At tablet width around **768px**, confirm the cards fit in two columns without overlapping.
9. At desktop width around **1440px**, confirm the cards use three columns and controls remain readable.
10. Use the keyboard `Tab` key to move through dashboard and form controls. Focus must remain visible.

### G. Capture a release-evidence snapshot

This confirms the dashboard’s audit behavior; it does not release anything.

1. In **Release proof**, find **Capture evidence snapshot**.
2. Choose `Staging evidence` unless you are doing a human production-candidate review after all staging proof is complete.
3. Write a short note such as: `Reviewed schema, policy, backup rehearsal, staging run, payment health, and content approvals on YYYY-MM-DD.`
4. Type exactly:

```text
REVIEW ONLY
```

5. Select **Capture evidence snapshot**.
6. Confirm the status message says that a snapshot was captured and that no deployment was performed.
7. Refresh the Cockpit. The dashboard footer should show the latest snapshot time and scope.
8. Test the negative path: enter any different confirmation text. The action must be rejected and no snapshot should be created.

### H. Required workflow checks before production

- **Permissions:** a job-admin can load the Cockpit; a worker receives a denial for job-admin operations.
- **Policy:** `v_security_policy_assertion_summary` reports all required assertions as passed.
- **Media:** upload a test image; confirm it remains in private review storage until approval; confirm only approved copies resolve in public delivery storage.
- **Accounting:** submit/approve/post one disposable payment action and confirm the balanced journal/application records appear once only.
- **Reconciliation:** confirm a bank CSV, test a valid exact-cent match, then test a deliberately invalid one-cent split and confirm it is rejected.
- **Quotes/deposits:** accept a disposable quote, confirm only one work order is created, and test Stripe in test mode. Verify the webhook—not a browser button—marks the deposit paid.
- **Accountant package:** generate one private package in staging, confirm the signed download expires, and have the accountant/bookkeeper review mapping assumptions before relying on it.
- **SEO/public content:** create one approved route with real useful copy and approved image; verify one H1, canonical URL, sitemap entry, visible content matching structured data, and no staff controls on its public URL.
- **Recovery:** record a successful non-production backup/restore rehearsal, including evidence and next action.

## Release blockers

Do not move toward production until all are true:

- schema 154 is current in dedicated staging;
- protected functions and static build are deployed together;
- job-admin allow and worker deny checks pass;
- private review media cannot be fetched publicly;
- Stripe test webhook processing is verified and no critical webhook alert remains unresolved;
- payment, bank, reconciliation, quote, and deposit safety checks fail closed when given invalid input;
- a successful backup/restore rehearsal is recorded;
- accountant/bookkeeper approves chart-of-accounts, tax, and export mapping rules;
- the dashboard’s staging evidence is complete enough for human review;
- original consent-approved public work/service images replace visible placeholders;
- human review has considered Search Console/GBP observations before altering route priorities;
- the Cockpit and customer/public pages have been inspected at phone, tablet, and desktop widths.

## Highest-value next work

1. Deploy schema 154 and this static/function build to staging, then run the evidence and browser process above.
2. Resolve every live RLS, storage, migration, function, payment-webhook, or browser discrepancy found in staging before adding more features.
3. Replace the highest-value public placeholders with original approved before/after/service images, descriptive alt text, and clear local proof.
4. Have the accountant/bookkeeper finalize mapping rules and the exact month-end close/review checklist.
5. Add controlled manual import/review of real Search Console and Google Business Profile observations; keep third-party credentials outside application tables.
6. After successful staging proof, carry forward only the next bottleneck revealed by real usage—typically customer scheduling/dispatch polish, visual approval throughput, or reporting—not another speculative feature set.
