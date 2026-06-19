# Active Project Handbook — build 2026-06-17b / schema 150

This is the primary source of truth for the YWI application. A new AI or developer should read this file first, then `NEXT_STEPS_AND_SANITY_CHECK.md`. Superseded Markdown is archived and is not an active task list.

## 1. Product and business direction

YWI is a combined desktop administration website, mobile field application, public lead/SEO site, and customer portal for a Southern Ontario landscaping and service business. The product connects:

- public service pages and quote/contact intake;
- quote ownership, follow-up, approval, deposits, and customer communication;
- jobs, work orders, dispatch, crews, routes, time, materials, equipment, and evidence;
- OHSA/HSE inspections, incidents, training, corrective actions, and proof;
- AR/AP payment application, journals, bank import, reconciliation, tax/close controls, and job costing;
- mobile offline fallback, retry copies, conflict review, and release/schema health.

The competitive target is not a copy of one product. The application combines the customer lifecycle and field usability seen in Jobber, Aspire, and LMN with deeper safety, equipment custody, accounting evidence, and controlled publication.

## 2. Current release status

**Repository build:** `2026-06-17b`  
**Expected database schema:** `150`  
**Primary migration:** `sql/150_end_to_end_operations_customer_portal_media_route_publication.sql`  
**Canonical schema:** `sql/000_full_schema_reference.sql`  
**Primary Admin function:** `supabase/functions/operations-manage/index.ts`

The canonical schema now contains 121 ordered migration blocks from 030 through 150. The repository now contains an end-to-end implementation layer for the highest-value schema 149 gaps. It has not been applied to the live Supabase project merely by editing this ZIP. Migration, function deployment, secrets, Stripe webhook configuration, storage verification, and live tests are still required.

## 3. Implemented workflows

### Operations Cockpit and live queues

`js/operations-cockpit.js` renders live queue cards beneath each Admin form. Each queue has row-level actions appropriate to its state instead of only showing a request form.

Current queues include:

- payment application, approval, rejection, and posting;
- bank CSV previews and promotion;
- open bank reconciliation rows, suggestions, exact matching, splits, rejection, undo, and signoff;
- equipment scan resolution, failed-return service tasks, lockout, and cost recovery;
- uploaded visual review and placeholder replacement readiness;
- public route review, approval, and publication;
- quote/contact owner assignment, follow-up history, and due alerts;
- customer portal, deposit, dispatch, and live job-cost status.

Failed cockpit actions retain a local retry copy. Forms also retain draft values locally, excluding files and queue controls.

### Payment application and journals

Approved payment actions now require an explicit ledger side, transaction date, proof reference, amount, and bank account. Posting performs these checks:

1. authenticated Admin/Job Admin role;
2. approval status and idempotency;
3. open AR/AP/GL accounting period;
4. configured bank and control accounts;
5. exact balanced debit and credit lines;
6. linked AR or AP application record where the source invoice/bill exists;
7. journal and posting references written back to the request;
8. audit event retained for the action.

Supported action paths include application, reversal, refund, write-off, and overpayment handling. Posting now claims a request before writing, blocks concurrent/double posting and repeated reversal, prevents repeated overpayment recognition, and validates refund limits. Stripe deposits are first recognized as Customer Deposits and later released against AR, avoiding a second Cash debit. Because the Edge Function currently performs multiple database writes sequentially, a later hardening pass should convert the final posting path into a single transactional PostgreSQL RPC. Until that is done, use one test company record and confirm all linked rows after each live posting test.

### Bank import and reconciliation

Bank CSV preview validates transaction date, description, amount, and duplicate signature. Confirmation promotes accepted rows into real bank statement/import/session/item records.

Reconciliation now supports:

- candidate suggestions using amount, date, reference, and description signals;
- a visible percentage score and factor explanation;
- one-to-one matching;
- split allocations;
- exact source-balance validation in cents;
- rejection reasons;
- undo and signoff controls;
- audit history.

A split cannot be signed off unless allocation cents exactly equal the bank item cents.

### Equipment scan, service, and recovery

Camera scanning uses `BarcodeDetector` when the browser supports it. Manual code entry is always available. Codes resolve against real equipment identifiers and availability data.

Failed arrival/return checks can now:

- update custody and equipment condition;
- lock equipment out;
- create an equipment service task;
- create a cost-recovery action;
- retain condition/accessory notes and evidence references;
- create an approved job financial event when recovery is billable.

### Image upload and visual approval

`upload-public-asset` accepts authenticated image uploads from the cockpit. The browser creates an optimized display image and thumbnail before upload. The server then verifies:

- image MIME type and extension;
- byte size limits;
- optimized and thumbnail dimensions;
- SHA-256 checksum;
- descriptive alt text;
- consent status;
- route key and placeholder selector;
- public storage path and thumbnail path.

The visual stays in review until an authorized user approves it. A route cannot publish with an unapproved image. Placeholder replacement is controlled by the approved asset record rather than a hard-coded URL.

### Approved public routes and sitemap

A route must pass the following gate before publication:

- clean path;
- page title length check;
- one clear H1 value;
- useful meta description;
- local proof text;
- crawlable CTA path;
- approved assigned visual;
- approval and publication record.

`public-content` exposes only approved, published route records. `js/public-routes.js` is a runtime fallback. `scripts/generate-public-routes.mjs` is the preferred deployment path because it produces crawler-ready HTML with:

- exactly one H1;
- title and meta description;
- canonical URL;
- Open Graph metadata;
- approved image dimensions and alt text;
- Service JSON-LD;
- visible local proof and CTA;
- sitemap output from active approved records only.

Run the generator after route publication and before deploying the static site. Reserved application roots such as `/api`, `/docs`, `/js`, `/sql`, and `/supabase` cannot be registered or generated as public content, and canonical/image links are restricted to HTTP(S).

### Quote ownership, alerts, and history

Quote/contact requests now support:

- owner assignment;
- assigned-by and assigned-at fields;
- follow-up due date;
- response status and first-response time;
- event history;
- open/superseded alert records;
- Admin notifications;
- optional Resend email delivery when configured.

The queue exposes owner and follow-up actions. Customer portal follow-ups return to the same intake/event model rather than creating an unrelated message store.

### Customer portal, acceptance, deposits, dispatch, and job cost

A tokenized portal URL uses `?portal=<token>`. The public portal hides the protected staff application and displays only the customer package.

The portal supports:

- quote scope and totals;
- acceptance name, email, terms acknowledgement, timestamp, and privacy-preserving IP hash;
- single-claim estimate acceptance and deterministic work-order creation/linkage;
- server-calculated exact deposit balance and reusable Stripe-hosted Checkout;
- webhook-confirmed deposit state only after paid status, with session, amount, currency, quote, and estimate validation;
- receipt URLs restricted to HTTP(S);
- work-order dispatch status and scheduled window;
- customer follow-up/service requests.

The Admin queue can schedule an accepted work order, record deposit status for controlled testing, and refresh a live job-cost snapshot. Job costing compares estimate/revenue with labour, material, equipment, subcontract, other cost, margin amount, and margin percent.

## 4. Architecture and data ownership

### Front end

- `index.html` — protected app shell, public intake, visual placeholders, one homepage H1.
- `style.css` — desktop/mobile app, cockpit queues, portal, public routes, responsive and reduced-motion rules.
- `js/api.js` — centralized Edge Function requests.
- `js/operations-cockpit.js` — live Admin execution queues.
- `js/customer-portal.js` — token portal.
- `js/public-routes.js` — approved route runtime fallback.
- `server-worker.js` — app-shell cache `ywi-shell-v2026-06-17b`.

### Edge Functions added or expanded

- `operations-manage` — authenticated operational actions.
- `upload-public-asset` — authenticated media validation/storage.
- `customer-portal` — unauthenticated token-based customer actions.
- `public-content` — approved published public route/sitemap data.
- `stripe-webhook` — Stripe signature verification and deposit completion/expiry handling.

### Database

Schema 150 adds or extends:

- payment linkage, bank account/date fields, and workbench views;
- bank promotion fields and reconciliation allocations;
- equipment scan resolution and cost-recovery links;
- visual dimensions/storage/checksum fields;
- public sitemap entries;
- quote follow-up alerts and customer portal events;
- deposit requests, dispatch schedule, and job-cost snapshots;
- queue/readiness views and schema drift marker.

The application should write operational data through Edge Functions. Direct browser writes should remain limited and protected by RLS.

## 5. Deployment order

1. Back up the live database and record the current schema marker.
2. Review and apply `sql/150_end_to_end_operations_customer_portal_media_route_publication.sql`.
3. Confirm `v_schema_drift_status.expected_schema_version = 150`.
4. Confirm the `public-assets` storage bucket and its policies exist.
5. Deploy:
   - `operations-manage`
   - `upload-public-asset`
   - `customer-portal`
   - `public-content`
   - `stripe-webhook`
6. Verify `supabase/config.toml` JWT settings:
   - public/customer/webhook functions: JWT verification disabled;
   - cockpit/upload functions: JWT verification enabled.
7. Set required secrets.
8. Create the Stripe webhook endpoint for Checkout completion/expiry events.
9. Seed or confirm active AR, AP, bank/cash, write-off, refund, and overpayment accounts.
10. Test one successful and one blocked case for every cockpit panel.
11. Approve one real visual and one real route.
12. Run `node scripts/generate-public-routes.mjs` with deployment environment variables.
13. Deploy the static site and submit/refresh the sitemap in Search Console.

## 6. Environment variables

### Supabase/function basics

- `SUPABASE_URL` or `SB_URL`
- `SUPABASE_SERVICE_ROLE_KEY` or `SB_SERVICE_ROLE_KEY`
- browser public/anon key in `js/app-config.js`

### Public site and portal

- `PUBLIC_SITE_URL=https://yardweasels.ca`
- `PORTAL_HASH_SALT=<long random secret>`

### Stripe

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`

### Optional email alerts

- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL` or `EMAIL_FROM`
- `ADMIN_NOTIFICATION_TO` as fallback recipient

### Static route generator

- `PUBLIC_CONTENT_ENDPOINT=https://<project>.supabase.co/functions/v1/public-content`
- `SUPABASE_ANON_KEY`
- `PUBLIC_SITE_URL`

Never place service-role, Stripe secret, webhook secret, Resend key, or portal salt in browser JavaScript.

## 7. SEO and public-content rules

- One exposed H1 per public page.
- Titles should identify the service and useful location context without stuffing.
- Meta descriptions should describe the real page and CTA, not repeat a keyword list.
- Every published route must be reachable through a crawlable internal link as well as the sitemap.
- Use real local proof only: service area, completed work, credentials, process, photos, reviews, or specific capability.
- Approved images need descriptive filenames, dimensions, compression, nearby relevant text, and useful alt text.
- Structured data must describe content visible on the page.
- Do not create doorway pages that merely swap town names.
- Do not promise first-page rankings. Search performance also depends on competition, distance, prominence, reviews, links, and user behaviour.

### Current official reference set

- Google image guidance: https://developers.google.com/search/docs/appearance/google-images
- Google sitemap guidance: https://developers.google.com/search/docs/crawling-indexing/sitemaps/overview
- Google structured data introduction: https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data
- Stripe Checkout Session creation: https://docs.stripe.com/api/checkout/sessions/create
- Jobber landscaping workflow: https://www.getjobber.com/industries/landscaping-software/
- Aspire landscape software: https://www.youraspire.com/industries/landscape-business-software
- LMN by Granum: https://granum.com/lmn/

## 8. Mobile and desktop rules

### Mobile

- minimum 44–48px action targets;
- single-column queues and forms below tablet widths;
- manual scan fallback always visible;
- local draft/retry protection;
- no horizontal page overflow;
- image previews constrained to viewport;
- status and recovery action visible without hover.

### Desktop

- two-column cockpit cards where space permits;
- clear queue status and row actions;
- side-by-side quote document and portal controls;
- sticky public route header only on wider screens;
- tables remain inside scroll containers.

Reduced-motion preferences disable nonessential animation and transitions.

## 9. Visual placeholder policy

Placeholders are intentional release-safe surfaces, not fake proof. They may be used where no approved image exists. They must:

- say what approved image belongs there;
- remain readable on mobile and desktop;
- not imply a completed customer job;
- be replaced only through the visual approval workflow;
- keep surrounding copy useful even if the image never loads.

## 10. Testing commands

From the repository root:

```bash
node scripts/repo-smoke-check.mjs
node --check js/api.js
node --check js/operations-cockpit.js
node --check js/customer-portal.js
node --check js/public-routes.js
node --check scripts/generate-public-routes.mjs
```

The smoke check verifies current files, build/schema markers, one-H1 homepage, CSS balance, queue/action tokens, portal/public route wiring, function TypeScript syntax, migration/full-schema synchronization, active Markdown consolidation, and removal of temporary files.

## 11. Known limitations that must not be hidden

- This ZIP does not prove the migration or functions are live.
- Payment posting and several multi-row workflows are sequential Edge writes, not yet a single database transaction.
- Stripe must be tested in test mode with a real webhook before any live deposit is accepted.
- Email alerts require Resend configuration; otherwise the in-app notification remains queued/pending.
- Static public pages are generated only when the deployment script runs against approved published records.
- Search indexing and ranking are never guaranteed by sitemap or structured data.
- Real labour, material, equipment, overhead, tax, and bank mappings must be checked before margin or accounting output is relied on.

## 12. Markdown policy

Only two detailed Markdown files are active:

1. `docs/ACTIVE_PROJECT_HANDBOOK.md`
2. `docs/NEXT_STEPS_AND_SANITY_CHECK.md`

`README.md` is only a pointer. All older detailed Markdown was moved to `archive/retired-markdown-2026-06-17b/`. Do not restore archived files to the root as active roadmaps.


## 13. Verification results

Repository verification completed for this package:

- repository smoke suite passes all 74 checks;
- JavaScript syntax passes for the app, API, cockpit, portal, public routes, service worker, and generator;
- TypeScript transpilation syntax passes for all five changed/new Edge Functions;
- static table/column references in the Edge Functions match the canonical schema audit;
- mock static-route generation produced one H1 and the correct sitemap entry;
- a reserved `/docs/...` mock route was rejected before any file was written.

These checks do not replace staging database migrations, RLS testing, Stripe test-mode webhooks, browser/device visual testing, or transactional failure testing.
