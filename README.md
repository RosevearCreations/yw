# Yard Weasels Inc. Operations Platform

**Current source handoff:** `2026-07-17a`  
**Database target:** schema `158`  
**Active documents:** this README, `docs/ACTIVE_PROJECT_HANDBOOK.md`, and `docs/NEXT_STEPS_AND_SANITY_CHECK.md`.

This build advances the field-service workflow from quote and service proof into a controlled supervisor closeout package. Approved execution proof can now feed a customer-safe closeout summary, before/after gallery, customer portal signoff, invoice-readiness status, review-request queue, and maintenance follow-up reminder.

## Current workflow

1. Public quote/contact intake and owner follow-up.
2. Customer portal quote review and acceptance.
3. Stripe-hosted deposit request with webhook-controlled paid status.
4. Dispatch scheduling, live job updates, and consent-controlled customer email notifications.
5. Service-execution proof with internal labour/material/equipment cost capture.
6. Supervisor closeout package, customer signoff, invoice readiness, review request, and maintenance follow-up.
7. Accountant export, staging evidence, and release-readiness review.
8. Approved public route pages and sitemap entries only after SEO/media gates pass.

## Important boundaries

- Customer portal closeout content is private portal content, not public SEO content.
- Internal costs, margin, staff notes, access details, customer emails, portal tokens, and private review media must not be exposed publicly.
- Stripe deposit status remains controlled by verified webhook events.
- Public SEO pages still require one clear H1, approved original imagery, descriptive alt text, useful local copy, canonical URLs, and sitemap approval.

Historical Markdown files are preserved under `archive/retired-markdown-2026-07-17a/`.
