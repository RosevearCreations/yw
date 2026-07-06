# Next Steps and Sanity Check

**Build:** `2026-07-05a`  
**Schema:** `155`  
**Purpose:** exact staging and acceptance process for the current build.

## 1. Completed in this build

- Added schema 155 live job updates with staff-only/customer-visible separation.
- Added a portal timeline that returns only published customer-visible updates and approved public media.
- Added supervisor-only customer publication and retraction safeguards.
- Added a staff Cockpit form and live update history queue.
- Added portal visual placeholders and responsive styles for empty and populated update states.
- Preserved accounting, reconciliation, quote/deposit, Stripe, media-approval, route, release-evidence, and policy safeguards from schemas 150–154.
- Rebuilt the canonical schema reference through migrations 030–155.
- Physically reduced active documentation to three files; archived 80 older Markdown files under `archive/retired-markdown-2026-07-05a/`.

## 2. Source checks to run before staging

From the extracted project folder:

```powershell
npm ci
npm run test:repo
npm run test:staging
npm run test:contrast
node scripts/live-work-updates-check.mjs
```

Expected behavior without staging credentials:

- repository/static checks pass;
- the staging harness reports that live database checks were skipped;
- no business records are created;
- no deployment occurs.

## 3. Apply schema 155 in a dedicated staging database

Do not run this in production first.

1. In Supabase, choose a project whose name clearly identifies it as staging.
2. Confirm schema 154 is already applied:

```sql
select * from public.v_schema_drift_status;
```

Before schema 155, the expected marker is 154/current.

3. Take or verify your non-production backup/export procedure.
4. In **Supabase Dashboard → SQL Editor**, open:

```text
sql/155_live_job_updates_customer_timeline_and_visibility.sql
```

5. Paste the entire file into a new query and run it once.
6. Verify the migration:

```sql
select * from public.v_schema_drift_status;

select
  assertion_key,
  assertion_status,
  details
from public.ywi_security_policy_assertions()
order by assertion_key;

select public.ywi_get_operations_capabilities('YOUR_STAGING_JOB_ADMIN_PROFILE_UUID');
```

Confirm the returned JSON contains the live-update capability entries below.

Confirm the JSON contains:

- `work_order_live_update` with minimum role `site_leader`;
- `work_order_live_update_retract` with minimum role `supervisor`.

7. Confirm the new objects exist:

```sql
select to_regclass('public.work_order_live_updates') as updates_table,
       to_regclass('public.work_order_live_update_media') as update_media_table,
       to_regclass('public.v_customer_portal_live_updates') as portal_view,
       to_regclass('public.v_work_order_live_update_queue') as staff_queue;
```

Expected: all four cells contain their public object name rather than `NULL`.

## 4. Deploy matching application files together

Deploy the schema and these code/static changes as one staging release:

- `index.html`
- `style.css`
- `server-worker.js`
- `js/operations-cockpit.js`
- `js/customer-portal.js`
- `js/public-routes.js`
- `scripts/generate-public-routes.mjs`
- `supabase/functions/operations-manage/index.ts`
- `supabase/functions/customer-portal/index.ts`
- `sql/155_live_job_updates_customer_timeline_and_visibility.sql`

Do not put Supabase service-role keys, Stripe secrets, portal tokens, or mail-provider credentials in browser JavaScript, Git, public route content, screenshots, or chat messages.

## 5. Prepare a safe test work order

Use a clearly labelled staging record, never a real customer or live work order.

1. Create/accept a staging quote using the existing fixture flow or current customer portal test flow.
2. Confirm it creates a work order.
3. In the Operations Cockpit queue, note the work order number and verify it starts with a staging/testing identifier or is otherwise unmistakably non-production.
4. Upload a small original test image through the normal review-media workflow.
5. Leave one image **pending review** and approve/promote a second image through the authorized media approval flow. Do not hand-copy files into the public bucket.

## 6. Role and visibility acceptance test

### A. Site leader: staff-only allowed

1. Sign in as a staging **site leader**.
2. Open **Admin → Operations Cockpit → Live job updates**.
3. Choose the safe test work order.
4. Choose **Staff only**.
5. Enter title: `STAGING: crew arrival note`.
6. Enter a message that would be useful internally, such as equipment or access preparation information.
7. Save the update.
8. Expected result: it appears in the Cockpit live update history with `Staff only` visibility.
9. Open the matching customer portal link in a private/incognito browser. Expected result: this update does **not** appear.

### B. Site leader: customer publication denied

1. Still signed in as the site leader, choose **Customer visible (supervisor)**.
2. Use title: `STAGING: customer-visible progress attempt`.
3. Submit.
4. Expected result: the application rejects the action with a permission message. No customer update is created.

### C. Supervisor: customer publication allowed

1. Sign in as a staging **supervisor**.
2. Open the same work order.
3. Choose **Customer visible (supervisor)**.
4. Choose type **Arrival** or **Progress**.
5. Use title: `STAGING: crew has arrived`.
6. Use a customer-safe message. Do not include access codes, names of staff members, internal costing, private equipment issues, or security details.
7. Set progress to `20` or another reasonable number.
8. Select only the **approved public** test image.
9. Optionally check the notification-request box. This should only queue the request; it does not prove that email/text delivery is configured.
10. Save.
11. Expected result: the Cockpit lists it as `Customer visible` and shows the approved media count.

### D. Customer portal: only safe content appears

1. Open the matching secure customer portal URL in a private/incognito browser.
2. Refresh the page.
3. Expected result: the **Live service updates** section shows the supervisor update with time, progress, customer-safe message, and approved image.
4. Confirm the staff-only update is absent.
5. Confirm no author profile ID, internal cost, private storage path, retraction reason, internal note, or pending-review image is visible in the browser page.
6. View page source/devtools network response only if you are comfortable doing so. The `live_updates` payload must not contain staff-only rows.

### E. Pending-review image cannot be used for customer display

1. As supervisor, attempt to choose the pending-review image for a customer-visible update.
2. The Cockpit selector should not offer it.
3. If a direct test payload is used, the server must reject it because it lacks approved status/public delivery URL.
4. Confirm the pending-review image remains outside public storage until the normal approval/promotion process completes.

### F. Retraction is auditable and removes portal output

1. As supervisor, choose **Retract** on the customer-visible staging update.
2. Enter reason: `STAGING retraction test`.
3. Expected result: the update remains in Cockpit history as retracted, with no delete action.
4. Refresh the customer portal.
5. Expected result: the retracted update no longer appears.
6. Confirm the staff-only update is still not visible.

## 7. Mobile and desktop test

Test both an empty portal and a portal containing one customer-visible update.

1. Open the staging Operations Cockpit as a supervisor.
2. At about **390px** browser width, verify:
   - live update form fields stack cleanly;
   - select boxes and Save button remain within the viewport;
   - history cards have no clipped text or horizontal page scroll;
   - dark Cockpit text and state badges remain readable.
3. At about **768px**, verify form fields and update cards do not overlap.
4. At about **1440px**, verify the Cockpit fits naturally with the existing dashboard/queue layout.
5. Open the customer portal at the same three widths and verify:
   - empty placeholder is readable and does not look like completed work;
   - timeline marker, timestamp, progress bar, and approved images scale without overlap;
   - image links work and remain inside their cards;
   - keyboard `Tab` focus stays visible.

## 8. SEO sanity check

Schema 155 should not create public SEO pages from job updates.

Confirm:

- customer portal URLs are not added to the sitemap;
- live update messages do not appear in generated public route pages;
- approved public route generation remains a separate human-reviewed process;
- public route pages still have one H1, canonical URL, useful local copy, and approved imagery;
- any before/after or service image used publicly has consent and truthful descriptive alt text.

## 9. Release blockers

Do not move this build to production until all are true:

- schema 155 is current in dedicated staging;
- customer/staff visibility tests pass;
- site-leader denial and supervisor allow checks pass;
- pending media cannot reach the portal or public bucket;
- customer-visible updates show only approved media;
- retracted updates disappear from portal output but remain auditable;
- existing payment, quote, reconciliation, media, accountant, Stripe-webhook, RLS, backup/restore, and release-evidence checks still pass;
- Cockpit and portal have been inspected at phone, tablet, and desktop widths;
- an authorized human has reviewed the release dashboard evidence.

## 10. Highest-value next work after staging proof

1. Run schema 155 and this live-update workflow in staging; fix any real RLS/storage/permission differences before more feature work.
2. Connect customer-notification delivery only after consent, provider configuration, retry handling, and test delivery evidence exist.
3. Replace the most valuable public placeholders with original approved service, crew, equipment, and completed-work images.
4. Use real customer/service activity to polish dispatch timing, job-cost capture, and quote follow-up rather than adding speculative modules.
5. Review real Search Console and Google Business Profile observations manually before changing public route priorities or copy.
