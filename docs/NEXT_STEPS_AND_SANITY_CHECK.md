# Next Steps and Staging Sanity Check

**Release:** `2026-07-07a` · **Schema:** `156`

This is the active deployment and test guide. Use a dedicated non-production Supabase project and controlled test email addresses. Do not paste credentials into chat, source files, screenshots, or public GitHub Actions logs.

## 1. Confirm the starting point

In Supabase SQL Editor, confirm schema 155 is already present:

```sql
select * from public.v_schema_drift_status;
```

The current project must report at least schema 155 before applying schema 156.

## 2. Apply schema 156

1. Open `sql/156_customer_notification_consent_outbox_delivery.sql`.
2. Copy the complete file into **Supabase → SQL Editor** in the staging project.
3. Click **Run** once. Do not run it in production first.
4. Confirm the expected version:

```sql
select * from public.v_schema_drift_status;

select assertion_key, assertion_status, details
from public.ywi_security_policy_assertions()
where assertion_key like 'customer_notification%';
```

Expected result: `expected_schema_version = 156`, and the customer-notification policy assertions should be `passed` after RLS/grants are in place.

## 3. Deploy matching functions and static files

Deploy these together so the client UI, portal, RPCs, and dispatcher agree on schema 156:

- static site files including `index.html`, `style.css`, `js/operations-cockpit.js`, and `js/customer-portal.js`;
- `operations-manage`;
- `customer-portal`;
- `customer-notification-dispatch`;
- existing dependent functions: `upload-public-asset`, `stripe-webhook`, and `accountant-export`.

For Supabase CLI deployments, use your project’s normal process. The important point is that `customer-notification-dispatch` remains configured as `verify_jwt = false` **only because it independently requires the dedicated run token described below**. It is not a browser endpoint.

## 4. Configure staging-only secrets

Create staging-only values in Supabase Edge Function secrets. Use your own controlled test email address. Typical values are:

```text
YWI_CUSTOMER_NOTIFICATION_DELIVERY_ENABLED=true
YWI_CUSTOMER_NOTIFICATION_RUN_TOKEN=<a unique random value of at least 32 characters>
RESEND_API_KEY=<staging Resend key>
RESEND_FROM_EMAIL=Yard Weasels Staging <updates@your-verified-domain.example>
PUBLIC_SITE_URL=https://your-staging-site.example
```

Do not enable delivery until the no-consent and privacy checks below have passed. This feature sends email only; do not add SMS configuration.

## 5. Run source checks locally

From the project root:

```powershell
npm ci
npm run test:repo
npm run test:contrast
npm run test:live-updates
npm run test:notifications
npm run test:staging
```

`test:staging` should either run only against explicitly configured staging fixtures or report that live work was skipped. It must never target production.

## 6. Required role, privacy, and delivery test

Create a clearly labelled test customer, quote package, and work order such as `STAGING-NOTIFY-001`. Use a test email address controlled by the team.

### A. No consent means no email

1. Sign in as a site leader.
2. Create a staff-only update. Confirm it is not visible in the customer portal.
3. Attempt a customer-visible update. Confirm the server denies publication for a site leader.
4. Sign in as a supervisor. Create a customer-visible update and tick the email-request box.
5. Confirm the Cockpit shows **pending consent** or no queued email.
6. Confirm the test inbox receives nothing.

### B. Customer opt-in through the secure portal

1. Open the secure portal for `STAGING-NOTIFY-001`.
2. In **Service update email**, tick the opt-in box, enter the controlled test address, and save.
3. Refresh the portal. Confirm it says email updates are on, but does not display the saved address.
4. Publish a new customer-visible update as a supervisor and tick the email-request box.
5. In the Cockpit’s **Customer e-mail delivery** queue, confirm only status, consent, attempts, and error/review details are visible. The email address and portal token must not appear.

### C. Run one protected delivery batch

Set a local PowerShell variable without saving it in a script:

```powershell
$env:YWI_CUSTOMER_NOTIFICATION_RUN_TOKEN = '<your staging run token>'
$functionsUrl = 'https://<your-project-ref>.functions.supabase.co'
Invoke-RestMethod -Method Post `
  -Uri "$functionsUrl/customer-notification-dispatch" `
  -Headers @{ Authorization = "Bearer $env:YWI_CUSTOMER_NOTIFICATION_RUN_TOKEN" } `
  -ContentType 'application/json' `
  -Body '{"limit":5}'
```

Expected result: a short summary such as `sent`, `retry_scheduled`, `manual_review`, or `blocked`, with no recipient data in the response.

Then verify the test email:

- contains a customer-safe title/message and secure portal link only;
- contains no staff notes, internal costs, access codes, private image links, portal token as visible text, or other customer data;
- opens the existing secure portal.

### D. Opt-out and retraction protections

1. Queue a second controlled test update but do not dispatch yet.
2. In the portal, turn email updates off. Confirm the outbox item becomes `cancelled`; no new email is received.
3. Publish another update with consent on, then retract it before dispatch. Run the dispatcher. Confirm the item is cancelled/blocked and nothing is emailed.
4. For a `manual_review` or `failed` test item, confirm a site leader cannot retry it and a job admin can retry only after entering a staff-only note.

## 7. Mobile and desktop verification

Test at roughly 390px, 768px, and a normal desktop width:

- Operations Cockpit text, queue cards, permission chips, alerts, and email-delivery status remain readable against the dark background.
- Queue actions stack and remain within the page width.
- Portal preference panel has no horizontal overflow, checkbox is easy to use, and the button is full width on a phone.
- Keyboard focus is visible on all controls.
- Use a private/incognito window or `Ctrl + F5` to avoid stale CSS/JavaScript.

## 8. Go/no-go rule

Do not enable customer notification delivery in production until the staging release dashboard has current schema evidence, passed policy assertions, a successful backup/restore rehearsal, webhook health, accountant-readiness review, real role/privacy tests, and actual rendered browser/device checks.

## Recommended work after staging proof

After schema 156 passes staging, the next highest-value work is service-execution proof: capture approved arrival/completion evidence and labour/material/equipment use during dispatch, then compare job cost against the accepted estimate without exposing internal costing in the customer portal.


Stale delivery claims older than 15 minutes are moved to manual review; they are never resent automatically.
