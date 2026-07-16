# Next Steps and Staging Sanity Check

**Release:** `2026-07-12a`  
**Schema:** `157`

Use a dedicated non-production Supabase project. Do not paste credentials into chat, screenshots, source files, or public logs.

## 1. Confirm the starting point

Run in Supabase SQL Editor:

```sql
select * from public.v_schema_drift_status;
```

The project should already be at schema 156 before applying schema 157.

## 2. Apply schema 157

1. Open `sql/157_service_execution_proof_cost_capture.sql`.
2. Copy the entire migration into Supabase SQL Editor.
3. Run it once in staging only.
4. Confirm:

```sql
select * from public.v_schema_drift_status;

select assertion_key, assertion_status, details
from public.ywi_security_policy_assertions()
where assertion_key like '%execution_proof%';
```

Expected: schema 157 is current and execution-proof RPC/privacy assertions pass after grants/RLS are active.

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
npm run test:staging
```

`test:staging` must run only against a clearly labelled staging project or skip live work.

## 5. Required service-execution proof test

Create or use one labelled staging quote/work order such as `STAGING-PROOF-001`.

### A. Capture proof as site leader

1. Sign in as a site leader.
2. Open **Admin → Operations Cockpit → Service-execution proof and internal job cost**.
3. Choose the staging work order.
4. Submit an **Arrival** proof with:
   - proof title;
   - staff note;
   - optional approved public image;
   - labour minutes and labour hourly cost;
   - material/equipment/other cost if appropriate.
5. Confirm the proof appears as `submitted`.
6. Confirm the customer portal does not show it yet.

### B. Approve proof as supervisor

1. Sign in as supervisor or job admin.
2. Approve the submitted proof.
3. Confirm the cost card updates accepted estimate, actual cost, margin, and cost status.
4. Confirm a customer-visible proof appears in the secure portal only if a customer-safe summary was entered and the proof was marked customer-visible.
5. Confirm the portal does **not** show staff notes, labour cost, material cost, equipment cost, total cost, margin, or private-media paths.

### C. Reject proof

1. Submit a second proof with a deliberate test error.
2. Reject it with a note.
3. Confirm rejected proof is excluded from actual job cost.

## 6. Mobile and desktop checks

Check Operations Cockpit and customer portal at about 390px, 768px, and desktop width:

- no text blends into the background;
- action buttons stack instead of overlapping;
- proof cards stay inside the viewport;
- keyboard focus is visible;
- customer proof cards do not expose cost fields.

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

After schema 157 passes staging, the next highest-value work is a supervisor closeout package: customer sign-off, final approved before/after gallery, invoice readiness, review request, and follow-up maintenance reminder from the same proof and cost records.
