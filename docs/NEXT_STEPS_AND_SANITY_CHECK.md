# Next Steps and Staging Sanity Check

**Release:** `2026-07-17a`  
**Schema:** `158`

Use a dedicated non-production Supabase project. Do not paste credentials into chat, screenshots, source files, or public logs.

## 1. Confirm the starting point

Run in Supabase SQL Editor:

```sql
select * from public.v_schema_drift_status;
```

The project should already be at schema 157 before applying schema 158.

## 2. Apply schema 158

1. Open `sql/158_supervisor_closeout_customer_signoff_invoice_followup.sql`.
2. Copy the entire migration into Supabase SQL Editor.
3. Run it once in staging only.
4. Confirm:

```sql
select * from public.v_schema_drift_status;

select assertion_key, assertion_status, details
from public.ywi_security_policy_assertions()
where assertion_key like '%closeout%';
```

Expected: schema 158 is current and closeout tables/RPCs are private.

## 3. Deploy matching files

Deploy static files and these functions together:

- `operations-manage`
- `customer-portal`
- `customer-notification-dispatch`
- `upload-public-asset`
- `stripe-webhook`
- `accountant-export`

## 4. Run source checks

From the project root:

```powershell
npm ci
npm run test:repo
npm run test:contrast
npm run test:live-updates
npm run test:notifications
npm run test:execution-proof
npm run test:closeout
npm run test:staging
```

`test:staging` must run only against a clearly labelled staging project or skip live work.

## 5. Required closeout test

Create or use one labelled staging quote/work order such as `STAGING-CLOSEOUT-001`.

### A. Prepare approved proof

1. Sign in as a site leader and submit arrival or completion proof.
2. Sign in as supervisor and approve the proof.
3. Confirm the internal cost dashboard updates.

### B. Submit supervisor closeout

1. Open **Admin → Operations Cockpit → Supervisor closeout, signoff, invoice readiness, and follow-up**.
2. Select the staging work order.
3. Add a customer-safe closeout summary.
4. Optionally select approved before and after public images.
5. Check invoice-readiness and review-request options.
6. Add a maintenance follow-up date.
7. Submit the closeout package.

### C. Approve closeout

1. In the closeout queue, approve the package.
2. Confirm the queue shows customer signoff requested.
3. Confirm invoice readiness is blocked or waiting until customer signoff if signoff is required.

### D. Customer portal signoff

1. Open the staging customer portal token.
2. Confirm the closeout section shows only the customer-safe summary and approved gallery images.
3. Confirm there are no labour, material, equipment, margin, staff-note, access-detail, private-media, email-storage, or portal-token fields.
4. Submit **Approve completed work**.
5. Refresh the Cockpit and confirm customer signoff is `signed`, invoice readiness becomes `ready` if requested, review request becomes queued, and maintenance follow-up remains scheduled.

### E. Follow-up request path

1. Repeat with another staging closeout or reset the fixture.
2. Use **Request follow-up** in the portal.
3. Confirm the closeout becomes rework required and invoice readiness is blocked.

## 6. Mobile and desktop checks

Check Operations Cockpit and customer portal at about 390px, 768px, and desktop width:

- no text blends into the background;
- closeout/gallery buttons stack instead of overlapping;
- before/after gallery cards stay inside the viewport;
- keyboard focus is visible;
- customer portal closeout does not expose internal cost fields.

Use incognito or `Ctrl + F5` to avoid stale CSS/JavaScript.

## 7. Existing checks still required

Keep the previous staging gates:

- customer notification opt-in/out and protected dispatcher;
- Stripe test checkout and webhook health;
- private review image approval;
- accounting/reconciliation RPC checks;
- accountant export package;
- approved route generation and sitemap;
- backup/restore rehearsal;
- release-readiness dashboard snapshot.

## Recommended next work after staging proof

After schema 158 passes staging, the next highest-value build is invoice/review automation: generate an invoice draft from the signed closeout, queue a customer review request after payment, and schedule maintenance reminders without exposing internal costs.
