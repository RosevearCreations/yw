# Active Project Handbook — build 2026-06-23a / schema 153

## Purpose and operating direction

**Build:** `2026-06-23a`  
**Database marker:** schema `153`  
**Product direction:** a mobile-first service-business platform combining local discovery, quote intake, customer self-service, field work, equipment custody, media approval, dispatch, job costing, accounting, reconciliation, and accountant-review exports.

The platform is intentionally one connected workflow:

1. A local customer finds a helpful service/location page.
2. A request is assigned, followed up, quoted, and accepted.
3. The customer uses a limited portal for status, deposit checkout, and schedule visibility.
4. Staff dispatch work, scan equipment, capture approved media, and review job costs.
5. Finance staff approve/post payment work, promote bank records, reconcile, review close controls, and prepare private accountant packages.

## Active-document rule

Only these documents are active:

- `README.md`
- `docs/ACTIVE_PROJECT_HANDBOOK.md`
- `docs/NEXT_STEPS_AND_SANITY_CHECK.md`

All older plans are preserved at `archive/retired-markdown-2026-06-23a/`. They provide historical context for another AI or developer, but do not override this handbook.

## Transactional and release-proof foundation

### Schema 151: high-risk business writes

PostgreSQL owns all-or-nothing outcomes for payment posting, bank CSV promotion, reconciliation match/split/reject/undo/signoff, quote conversion, deposit request creation, Checkout attachment, and verified provider deposit status. Edge Functions authenticate, normalize, and return friendly messages; they do not become the final source of accounting truth.

### Schema 152: operational proof

Role capabilities, Stripe delivery health, fail-closed hosted-deposit controls, private signed accountant packages, durable staging test records, responsive reconciliation math, and accountant readiness were added.

### Schema 153: repeatable proof and protected media

- `STAGING-` fixture creation/cleanup is gated to a non-production deployment.
- New media enters private `review-assets`; only protected approval promotes it to `public-assets`.
- Policy assertions cover private media, private accountant packages, RLS, public assets, and protected RPC grants.
- Accountant mapping rules and close snapshots travel with accountant-review exports.
- Search Console/GBP/manual observations produce human-review decisions, never automatic content changes.
- Repeated Stripe webhook failures and stale delivery are visible as actionable alerts without allowing a payment-status override.

## Build 2026-06-23a: Operations Cockpit visual system

The Cockpit is now visually aligned with the rest of the dark admin app instead of mixing a light content island with inherited light text. It has local design tokens and explicit contrast rules for:

- heading, explanatory, muted, and small text;
- form labels, inputs, select menus, file fields, placeholders, disabled controls, and keyboard focus;
- primary/secondary actions;
- queue, health, release-proof, reconciliation, accountant, scorecard, and private-media cards;
- approved, pending/review, and error/rejected badges;
- status/retry banners, warnings, progress, and forced-colors mode;
- phone-width single-column action layouts.

The source contrast check verifies a minimum 4.5:1 ratio for normal, supporting, muted, success, warning, and error text pairings. A live browser pass is still required after deployment because actual browser rendering and real data lengths cannot be proven by source inspection alone.

## Public discovery, SEO, and visual rules

1. Exactly one visible H1 per public route.
2. Use natural service/location language in title, H1, introduction, image alt text, and internal links; never use keyword lists or misleading geographic claims.
3. Structured data must describe information visibly present on the page.
4. Only approved route records and approved public media become crawlable pages or sitemap entries.
5. Image filenames, alt text, nearby context, and captions must be descriptive. Placeholders remain visibly labelled until replaced by original approved media.
6. System paths such as `/api`, `/docs`, `/js`, `/sql`, `/supabase`, `index.html`, `robots.txt`, and `sitemap.xml` are never database-generated routes.
7. Search Console and Google Business Profile observations produce a person-reviewed task; they never auto-publish SEO text.

Primary references for implementation decisions:

- Google Search Essentials: <https://developers.google.com/search/docs/essentials>
- Google people-first content: <https://developers.google.com/search/docs/fundamentals/creating-helpful-content>
- Google image SEO: <https://developers.google.com/search/docs/appearance/google-images>
- Google structured data: <https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data>
- Supabase Row Level Security: <https://supabase.com/docs/guides/database/postgres/row-level-security>
- Supabase Storage access control: <https://supabase.com/docs/guides/storage/security/access-control>
- Stripe webhook handling: <https://docs.stripe.com/webhooks>

## Customer and field-service experience rules

- Quote owner, response deadline, contact history, and next action are visible to staff.
- Portal customers see only their accepted quote/work order/deposit/schedule path; never staff controls or unrelated records.
- Hosted payment status comes from verified provider events, never a manual paid button.
- Equipment scans resolve to real records; failed returns create reviewable service/cost-recovery work.
- Dispatch and job-cost summaries remain usable on phone, tablet, and desktop.
- Staff queues retain proof, notes, auditability, and reversible actions.
- The competitive baseline remains self-service quote approval, scheduling visibility, online deposits/payments, dispatch, job costing, and customer history; do not add automation that hides the real operational state.

## Mobile and desktop quality rules

- No unexpected horizontal overflow at phone widths except deliberate data-table scroll regions.
- Queue, health, release-proof, reconciliation, and form cards collapse to one column on narrow screens.
- Actions keep a minimum usable touch height and become full width where wrapping would reduce readability.
- Text/background pairs must use explicit local Cockpit colours rather than inheriting from the app shell.
- Reduced-motion and forced-colours modes remain supported.

## Current release boundary

No new SQL migration is required for build `2026-06-23a`. Before production, deploy the static front-end/Edge Function build, verify schema 153 is current in staging, then complete the browser acceptance instructions in `NEXT_STEPS_AND_SANITY_CHECK.md`.
