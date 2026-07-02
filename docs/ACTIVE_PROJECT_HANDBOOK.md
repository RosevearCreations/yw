# Active Project Handbook — build 2026-06-30a / schema 154

**Build:** `2026-06-30a`  
**Database marker:** schema `154`  
**Deployment state:** source-checked package; staging deployment and live evidence are still required.

## Purpose and operating direction

YWI is a mobile-first field-service and operations application. The operating path is:

**lead → quote → acceptance → deposit → dispatch → work proof → job costing → invoice/payment → reconciliation → accountant handoff → repeat service.**

The design goal is not a large collection of disconnected forms. Every high-value record should move safely from customer communication to work execution, financial review, and repeat business with clear permission boundaries, evidence, and audit history.

The public-facing direction remains local, useful, and original: approved service/location routes, clear contact or quote calls-to-action, original consent-approved work media, and human-reviewed improvement decisions. The app must not create mass low-value pages or publish unapproved images simply to target search traffic.

## Active-document rule

Only these files are active:

1. `README.md`
2. `docs/ACTIVE_PROJECT_HANDBOOK.md`
3. `docs/NEXT_STEPS_AND_SANITY_CHECK.md`

All other Markdown files were moved to `archive/retired-markdown-2026-06-30a/`. They remain useful historical context for another AI, developer, or future handoff but are not current requirements.

## Transactional and release-proof foundation

### Schema 151: high-risk business writes

- Transactional PostgreSQL RPCs for approved payment posting, confirmed bank-import promotion, reconciliation actions/split validation, quote acceptance/work-order creation, deposit requests, Checkout attachment, and verified deposit updates.
- Exact-cent reconciliation validation, balanced journal validation, idempotency, duplicate-post prevention, lock-period controls, and protected service-role grants.

### Schema 152: operational proof

- Durable staging-test run/results records.
- Server-provided capability cues for staff roles.
- Stripe configuration and webhook health data.
- Private accountant ZIP packages with formula-safe CSV generation, manifests, hashes, signed downloads, mapping/close snapshots, and readiness warnings.

### Schema 153: repeatable proof and protected media

- Disposable `STAGING-` fixtures and cleanup RPCs.
- Private review-media storage; only approved copies are promoted to public delivery storage.
- Security-policy assertions for private buckets, RLS, sensitive records, and protected RPC access.
- Search Console/Google Business Profile/manual observations with human route-content decisions.
- Stripe delivery alerts, accountant mapping readiness, and release-proof Cockpit controls.

### Schema 154: release-readiness evidence dashboard

- Read-only dashboard combining schema state, policy assertions, latest staging proof, backup/restore rehearsal, Stripe delivery health, accountant readiness, approved route/media readiness, and unresolved content signals.
- Authorized job admins can capture an auditable review snapshot after typing `REVIEW ONLY`.
- The dashboard is deliberately **not** a production-release button. It cannot deploy, publish, change payments, or override any failed control.
- The Cockpit now includes responsive release cards that remain readable at phone, tablet, and desktop widths.

## Current app architecture and permission boundary

- **Static front end:** Cloudflare Pages-compatible static files with cache marker `2026-06-30a`.
- **Database/auth/storage:** Supabase Postgres, Auth, Storage, RLS, and Edge Functions.
- **Operations writes:** protected `operations-manage` Edge Function delegates high-risk writes to SQL RPCs.
- **Customer portal:** restricted to the supplied customer/quote token context; it cannot expose staff controls.
- **Payments:** Stripe checkout/webhook data is validated server-side; staff cannot manually mark hosted deposits paid.
- **Media:** browser compression plus server-side MIME, size, dimension, and checksum checks; private review first, approval before public promotion.
- **Accounting exports:** private bucket plus short-lived signed download; accountant mapping and close readiness must be reviewed before relying on a package.
- **Release evidence:** dashboard/snapshots are service-role-only behind an authenticated, role-checked Edge Function.
- **CI/browser contracts:** the repository includes a GitHub Actions workflow for source checks, public phone/tablet/desktop shell checks, and an explicitly gated staging-evidence job.

## SEO and public-content rules

1. Keep exactly one clear H1 on each public page.
2. Put phrases that real local customers use into the title, H1, visible introductory copy, internal links, and image alt text naturally—not through repetition or keyword stuffing.
3. Publish service/location routes only after title, H1, meta description, useful local proof, CTA, clean URL, approved visual support, and sitemap checks pass.
4. Keep structured data consistent with visible page content. Never use markup to claim unavailable reviews, prices, services, or locations.
5. Use original, consent-approved images with useful alt text; review-stage media remains private.
6. Treat Search Console and Google Business Profile observations as review evidence. A human records the decision before changing public content.
7. Keep mobile content and desktop content equivalent in meaning and access, with no hidden staff data on public routes.

This aligns with Google’s people-first content, mobile-first indexing, crawlable-link, visible structured-data, and image-context guidance. It also avoids scaled low-value AI page generation.

## Customer and field-service experience rules

- One customer record should show relevant quote, booking, job, payment, communication, media, and job-cost history.
- Customers can review quotes, accept them, pay deposits, and see only their own scheduling/progress information.
- Dispatch must show the assigned work order, timing, and operational notes without leaking accounting or staff-only data.
- Field users need readable phone controls, saved drafts, recovery from temporary connection loss, and clear evidence/photo workflows.
- Quotes, work orders, payments, and job-cost refreshes must retain traceable source records; manual shortcuts must not bypass transactional controls.

## Mobile and desktop quality rules

- Controls must remain within the viewport at approximately 390px phone, 768px tablet, and desktop widths.
- Mobile actions use larger hit targets and stacked queue actions; desktop can use multi-column cards.
- Dark Cockpit surfaces use explicit readable text, muted text, approved/warning/error badges, and visible keyboard focus—not inherited colours.
- Respect reduced-motion and forced-colour preferences.
- Any visual placeholder must state what original approved image should replace it; it must never masquerade as a completed customer image.

## Current release boundary

This source build passed static repository checks. It has **not** been deployed to a live or staging Supabase/Stripe environment in this workspace. Real database migration behavior, RLS/storage enforcement, payment delivery, customer tokens, media promotion, and browser rendering remain staging gates.

Before production use, apply schema 154 to a dedicated staging project, deploy the updated static build and Edge Functions, run the recorded fixture/policy/browser proof, and capture a release-readiness snapshot that reflects the actual staging evidence.
