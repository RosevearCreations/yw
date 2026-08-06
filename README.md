# Yard Weasels Inc. Operations Platform

**Current source handoff:** `2026-08-05a`  
**Database target:** schema `158`  
**Active documents:** this README, `docs/ACTIVE_PROJECT_HANDBOOK.md`, and `docs/NEXT_STEPS_AND_SANITY_CHECK.md`.

This build keeps schema 158 intact, preserves the supervisor closeout workflow, and fixes the routed app shell so top-menu choices such as **Toolbox Talk**, **PPE Check**, **Jobs**, and **Admin** appear as the main visible section immediately under the header. The large visual/value/quote support panels no longer sit between the menu and the selected app screen. They are preserved below the app workspace for reference and SEO-safe supporting copy, but they do not block daily navigation.

## Current workflow

1. Public quote/contact intake and owner follow-up.
2. Customer portal quote review and acceptance.
3. Stripe-hosted deposit request with webhook-controlled paid status.
4. Dispatch scheduling, live job updates, and consent-controlled customer email notifications.
5. Service-execution proof with internal labour/material/equipment cost capture.
6. Supervisor closeout package, customer signoff, invoice readiness, review request, and maintenance follow-up.
7. Accountant export, staging evidence, and release-readiness review.
8. Approved public route pages and sitemap entries only after SEO/media gates pass.

## Navigation and layout repair

- Routed app sections now come before supporting panels in the document flow.
- The router scrolls directly to the allowed active section instead of always returning to the very top of the page.
- Active cards use sticky-header scroll margins so section headings are not hidden behind the nav.
- The mobile dropdown menu remains intact and closes after a selection.
- Section-level visual placeholders remain inside the app screens.

## Important boundaries

- Customer portal closeout content is private portal content, not public SEO content.
- Internal costs, margin, staff notes, access details, customer emails, portal tokens, and private review media must not be exposed publicly.
- Stripe deposit status remains controlled by verified webhook events.
- Public SEO pages still require one clear H1, approved original imagery, descriptive alt text, useful local copy, canonical URLs, and sitemap approval.

Historical Markdown files are preserved under `archive/retired-markdown-2026-08-05a/`.
