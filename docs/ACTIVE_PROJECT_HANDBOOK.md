# Active Project Handbook

**Current build:** `2026-07-05a`  
**Current schema:** `155`  
**Primary handoff status:** active

## 1. Purpose and business direction

Yard Weasels Inc. is being built as an operational field-service platform, not merely a marketing site. The useful commercial path is:

`lead → quote → acceptance → deposit → dispatch → evidence of work → job cost → invoice/payment → reconciliation → accountant review → repeat work`

The product direction is intentionally practical:

- customer self-service for secure quote review, acceptance, deposit status, dispatch visibility, and selected service updates;
- one operations cockpit for role-aware queues rather than scattered administrative pages;
- transactional server-side database writes for financially sensitive operations;
- owner/supervisor controls for public content, customer communications, media approval, routes, and release evidence;
- staff workflows that work on a phone but remain readable and usable on desktop.

Current field-service products commonly combine job scheduling/dispatch, customer communication, invoices/payments, job costing, and a customer portal. The application should compete by making those connected flows reliable, local-service-friendly, and explainable rather than by copying superficial feature lists.

## 2. Current schema milestones

- **150:** end-to-end operations, customer portal, media approval, route publication, dispatch and job cost foundations.
- **151:** transactional PostgreSQL RPCs for accounting posting, reconciliation and quote/deposit conversion.
- **152:** durable staging proof, role checks, Stripe health, accountant package readiness.
- **153:** disposable staging fixtures, private-review media, policy assertions, mapping and webhook/SEO decision queues.
- **154:** human-reviewed release-readiness dashboard and evidence snapshots. It is not a deploy button.
- **155:** live work updates with staff/customer visibility, portal timeline rendering, approved-public-media protection, retraction, and auditable status.

The full ordered SQL handoff is `sql/000_full_schema_reference.sql`. It contains migrations 030–155. Apply individual migrations in order to a fresh target; use the canonical file only as a reference and audit artifact unless the deployment process explicitly supports it.

## 3. Schema 155: live work updates

### Roles

| Action | Minimum role | Enforcement |
|---|---:|---|
| Save a staff-only update | Site leader | server RPC + Cockpit permission data |
| Publish a customer-visible update | Supervisor | server RPC + Cockpit permission data |
| Retract any live update | Supervisor | server RPC + audited retraction |
| View customer-visible updates | Valid customer portal token | `customer-portal` Edge Function only |
| Direct browser query of live-update tables/views | Nobody | RLS and grants deny browser roles |

### Visibility model

- **Staff-only** is the default. These updates never appear in the customer portal.
- **Customer-visible** must be a deliberate supervisor action.
- Only `published` customer updates are shown to the portal.
- A retracted update is retained for audit history but is removed from portal output.
- Customer-visible media must be approved and have an approved public delivery URL.
- The portal response exposes only a constrained title, message, update type, time, progress percent, notification state, and approved asset metadata.
- Internal staff notes, retraction reason, source storage paths, internal cost data, author profile IDs, and review-stage assets do not go to the portal.

### Notification boundary

Schema 155 records whether a customer notification was requested or queued. It does not silently email or text a customer. Delivery should be connected only after a staging-tested communication provider and consent/notification policy are in place.

## 4. Public content and SEO rules

### Public pages

Public route generation remains separate from portal updates. Approved routes must have:

- one meaningful H1;
- unique, useful service and local-area content;
- a canonical URL;
- visible content that matches any structured data;
- an approved original visual with accurate alt text when an image is used;
- a correct sitemap entry only after approval;
- a clear local CTA.

Never generate a large set of thin location pages simply to target keywords. Search observations are a human-review queue, not an automatic publishing system.

### Portal pages

The customer portal is a secure service surface, not an SEO landing page. Do not add it to sitemaps, public route generation, or internal public navigation. Its job is trust, clarity, and privacy during an actual customer journey.

### Visual placeholders

Placeholders are intentionally labelled as placeholders. They should be replaced by original, consent-approved photos that accurately depict the service, crew, equipment, before/after state, or completed work. Do not use generic stock imagery as a substitute for evidence of work.

## 5. Technical architecture and controls

### Browser/static application

- `index.html`, `style.css`, `js/operations-cockpit.js`, `js/customer-portal.js`, `js/public-routes.js`
- Responsive CSS has dark Cockpit contrast controls, mobile stacking, keyboard focus states, and forced-colours fallbacks.
- Build/cache marker: `2026-07-05a`.

### Edge Functions

- `operations-manage`: authenticated operations queues and protected Cockpit actions.
- `customer-portal`: token validation, quote action workflow, and filtered live-update timeline.
- `upload-public-asset`: private-review upload, MIME/dimensions/checksum checking.
- `stripe-webhook`: verified payment events and operational alert refresh.
- `accountant-export`: private export packaging, signed URLs, and close/mapping snapshots.
- `public-content`: approved public route data only.

### Database boundaries

- Transactional RPCs own high-risk multi-row writes.
- Service-role Edge Functions authenticate portal tokens/staff JWTs and call protected RPCs.
- Browser roles do not receive direct live-update/RPC access.
- Private-review media remains private until an authorized approval path copies it to public delivery storage.
- Accountant exports stay private and use expiring signed downloads.

## 6. Required release evidence

The release dashboard is a human evidence screen. A job-admin can capture a snapshot only by typing `REVIEW ONLY`. That action records a review state; it never deploys code, publishes pages, changes payment status, or overrides failed checks.

Before production, staging evidence must cover:

1. schema/current state;
2. policy/RLS/storage checks;
3. backup/restore rehearsal;
4. role allow/deny checks;
5. Stripe test webhook delivery;
6. payment/reconciliation/quote conversion safety;
7. private media approval and public promotion;
8. accountant package and mapping review;
9. customer-portal privacy and live-update visibility;
10. phone/tablet/desktop browser review.

## 7. Sources consulted for direction

- Google Search Central: helpful, reliable, people-first content; image SEO; structured data; sitemaps and crawlability.
- Stripe: verified webhook fulfilment/status handling for checkout flows.
- Current field-service platform patterns: connected quoting, dispatch, client communication, payments, customer portal, and job costing.

Use official vendor documentation at test/deployment time because product APIs, policies, and feature names change.

## 8. Verifiable reference links

These are planning references, not implementation dependencies. Re-check them before changing public SEO or payment behavior.

- Google Search Essentials: https://developers.google.com/search/docs/essentials
- Google guidance on helpful, reliable, people-first content: https://developers.google.com/search/docs/fundamentals/creating-helpful-content
- Google image SEO guidance: https://developers.google.com/search/docs/appearance/google-images
- Google structured data overview: https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data
- Stripe webhook guidance: https://docs.stripe.com/webhooks
- Jobber Client Hub overview: https://www.getjobber.com/features/client-hub/
- Housecall Pro field-service platform overview: https://www.housecallpro.com/features/field-service-management-software/
