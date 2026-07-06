# Yard Weasels Inc. Operations Platform

**Current source build:** `2026-07-05a`  
**Current database marker:** `schema 155`  
**Release state:** source-checked, ready for a dedicated staging deployment; not verified against a live Supabase, Stripe, storage, or browser session from this workspace.

## What this application now does

The application supports one operational path instead of disconnected admin screens:

`lead → quote → customer acceptance → deposit → dispatch → live work updates → job-cost evidence → invoice/payment → reconciliation → accountant package → repeat service`

Schema 155 adds controlled live job updates:

- Site leaders can save staff-only arrival, progress, access, delay, completion, and service notes.
- Supervisors can deliberately publish customer-safe updates to the existing token-protected customer portal.
- Customer-visible updates can attach only approved public delivery assets.
- Staff-only notes, review-stage images, access information, costing, private storage paths, and internal controls are never returned by the portal view.
- Retraction is auditable and removes a published update from the portal rather than deleting the record.
- A visible portal placeholder remains until a customer-safe update is actually shared.

## Active handoff documents

Only these Markdown files are active:

1. `README.md` — current release marker and operating scope.
2. `docs/ACTIVE_PROJECT_HANDBOOK.md` — architecture, permission boundaries, business/SEO rules, and the current feature map.
3. `docs/NEXT_STEPS_AND_SANITY_CHECK.md` — exact staging, role, portal, mobile/desktop, and post-deployment test steps.

Historical plans, tests, and handoffs are preserved under:

`archive/retired-markdown-2026-07-05a/`

Do not treat archived documents as current instructions when they conflict with these three active files.

## Non-negotiable safety and SEO rules

- Keep one clear H1 on every public route.
- Publish public routes only after copy, service area, CTA, image consent, approval, canonical URL, structured data, and sitemap checks pass.
- Do not auto-publish routes from analytics observations or create thin location pages.
- Use original, consent-approved images with descriptive, truthful alt text. Placeholders are visual scaffolding, not proof of completed work.
- Keep customer portal data token-protected and out of sitemaps, public route generation, and search indexing.
- Keep staff notes, internal costs, security/access details, private review media, accounting exports, secrets, and service-role credentials out of customer and public surfaces.
- Preserve server-side role checks and transactional RPCs for accounting, reconciliation, quote conversion, deposits, work updates, and other multi-row writes.

## Current next milestone

Deploy schema 155 and the matching updated static/Edge Function files to a **dedicated staging project**. Then complete the detailed role, privacy, portal, media, and responsive browser tests in `docs/NEXT_STEPS_AND_SANITY_CHECK.md` before moving toward production.
