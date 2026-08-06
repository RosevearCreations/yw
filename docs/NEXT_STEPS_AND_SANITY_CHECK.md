# Next Steps and Staging Sanity Check

**Release:** `2026-08-05a`  
**Schema:** `158`

This is a source/layout build. No new database migration is required if schema 158 has already been applied. Use a dedicated non-production Supabase project. Do not paste credentials into chat, screenshots, source files, or public logs.

## 1. Confirm the starting point

Run in Supabase SQL Editor:

```sql
select * from public.v_schema_drift_status;
```

The project should report schema 158. If schema 158 has not been applied yet, apply `sql/158_supervisor_closeout_customer_signoff_invoice_followup.sql` before testing closeout features.

## 2. Deploy matching files

Deploy the static files together so the browser gets the corrected shell and cache marker:

- `index.html`
- `style.css`
- `js/router.js`
- `js/mobile-menu.js`
- `server-worker.js`
- `manifest.json`

Deploy these functions with the same source package if they are not already current:

- `operations-manage`
- `customer-portal`
- `customer-notification-dispatch`
- `upload-public-asset`
- `stripe-webhook`
- `accountant-export`

## 3. Run source checks

From the project root:

```powershell
npm ci
npm run test:repo
npm run test:navigation
npm run test:contrast
npm run test:live-updates
npm run test:notifications
npm run test:execution-proof
npm run test:closeout
npm run test:staging
```

`test:staging` must run only against a clearly labelled staging project or skip live work.

## 4. Required top-menu navigation test

Use incognito or press `Ctrl + F5` after deployment so the old cached shell is not reused.

1. Sign in as an admin or supervisor test account.
2. Click **Toolbox Talk** in the top menu.
3. Confirm the **Toolbox Talk** card is the main visible content directly under the sticky header.
4. Confirm the large visual/value/quote support panels are no longer above Toolbox Talk.
5. Repeat with **PPE Check**, **First Aid Kit**, **Jobs**, **Equipment**, and **Admin**.
6. On a phone-width screen around 390px, open the menu dropdown, select **Talk**, and confirm the dropdown closes and the Toolbox Talk card is visible without scrolling past the old static panels.
7. Confirm the supporting visual panels still exist below the app workspace if you scroll past the active card.

## 5. Existing closeout staging test

Create or use one labelled staging quote/work order such as `STAGING-CLOSEOUT-001`.

1. Sign in as a site leader and submit arrival or completion proof.
2. Sign in as supervisor and approve the proof.
3. Confirm the internal cost dashboard updates.
4. Submit a supervisor closeout with a customer-safe summary.
5. Approve the closeout.
6. Open the staging customer portal token.
7. Confirm the closeout section shows only the customer-safe summary and approved gallery images.
8. Submit **Approve completed work**.
9. Confirm invoice readiness, review request, and maintenance follow-up states update in the Cockpit.

## 6. Mobile and desktop checks

Check Operations Cockpit, routed app cards, and customer portal at about 390px, 768px, and desktop width:

- no text blends into the background;
- menu dropdown closes after route selection;
- selected menu item appears first;
- closeout/gallery buttons stack instead of overlapping;
- before/after gallery cards stay inside the viewport;
- keyboard focus is visible;
- customer portal closeout does not expose internal cost fields.

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

After this navigation fix and schema 158 pass staging, the next highest-value build is invoice/review automation: generate an invoice draft from the signed closeout, queue a customer review request after payment, and schedule maintenance reminders without exposing internal costs.
