# Active Project Handbook

**Release:** `2026-07-17a`  
**Schema target:** `158`  
**Business model:** local field-service operations with quote intake, customer portal, deposits, dispatch, live proof, internal job costing, customer signoff, invoice readiness, review generation, maintenance follow-up, accountant handoff, and approved local SEO pages.

## Current direction

The platform is becoming one controlled service lifecycle:

1. Quote request and owner follow-up.
2. Customer portal quote review and acceptance.
3. Stripe-hosted deposit request with webhook-controlled paid status.
4. Dispatch scheduling and live staff/customer updates.
5. Consent-controlled customer email notifications.
6. Service-execution proof with arrival/completion evidence and internal cost capture.
7. Supervisor closeout package with customer-safe summary and before/after gallery.
8. Customer portal closeout signoff or follow-up request.
9. Invoice-readiness, review-request, and maintenance-follow-up queues.
10. Accountant-ready export and release-readiness evidence.
11. Approved public route pages and sitemap entries only after SEO and media gates pass.

## Schema 158 supervisor closeout

Schema 158 adds:

- `work_order_closeout_packages` for final closeout state, customer signoff, invoice readiness, review request, and maintenance follow-up.
- `work_order_closeout_gallery_items` for approved before/after public gallery images.
- `work_order_customer_closeout_signoffs` for portal signoff or follow-up requests.
- `work_order_review_requests` for review-request readiness after signoff.
- `work_order_maintenance_followups` for future customer-care reminders.
- `v_work_order_closeout_queue` for the Operations Cockpit.
- `v_customer_portal_closeout_packages` for customer-safe portal output only.
- `ywi_rpc_submit_work_order_closeout_package`, `ywi_rpc_decide_work_order_closeout_package`, and `ywi_rpc_customer_sign_work_order_closeout`.

Customer portal closeout is private. It must never expose internal labour, material, equipment, margin, staff notes, access details, customer email storage, portal tokens, or private review media.

## SEO direction

Public SEO remains separate from customer portal content. Public pages need one clear H1, useful local-service copy, approved original images, descriptive alt text, canonical URLs, visible content matching structured data, and sitemap entries only after approval. Do not mass-publish thin automated pages.

## Security and payment boundaries

- Stripe deposit status remains webhook-controlled.
- Customer notification delivery requires explicit portal opt-in and a protected dispatcher token.
- Review assets stay private until approved and copied to public delivery.
- Accountant exports stay private and use signed links.
- Service-execution cost and closeout cost data are internal only.
- Closeout signoff is token-validated through the customer portal function.

## Active documentation rule

Only this handbook, `README.md`, and `docs/NEXT_STEPS_AND_SANITY_CHECK.md` are active. Historical Markdown is archived for recovery.
