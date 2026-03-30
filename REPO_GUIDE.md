> Last synchronized: March 30, 2026. Reviewed during the staff-session, time-flow identity, intake/media session hardening, booking/admin shell cleanup, and docs/schema synchronization pass.

<!-- REPO_GUIDE.md -->

> Last synchronized: March 26, 2026. Reviewed during the booking add-on imagery, catalog autofill, low-stock reorder UI, Amazon-link intake, local SEO, and docs/schema refresh pass.

> Last synchronized: March 25, 2026. This file was reviewed during the recovery/moderation/docs/schema refresh pass.

# Rosie Dazzlers Repo Guide

## Last synchronized
- March 25, 2026

## What this repo contains
A Cloudflare Pages project with:
- static HTML screens for public, customer, and admin use
- Pages Functions under `/functions/api`
- JSON data under `/data` (now primarily bundled fallback content for pricing/catalog where DB-backed settings/tables exist)
- SQL migrations under `/sql`
- Markdown operating docs at repo root

---

## Main folders
### Root HTML
Public/customer pages:
- `index.html`
- `services.html` and `services/index.html` (cleanup still pending)
- `pricing.html` and `pricing/index.html` (cleanup still pending)
- `book.html`
- `gifts.html`
- `gear.html`
- `consumables.html`
- `progress.html`
- `login.html`, `my-account.html`
- `about.html`, `contact.html`, `privacy.html`, `terms.html`, `waiver.html`

Internal/admin pages:
- `admin.html`
- `admin-booking.html`
- `admin-blocks.html`
- `admin-progress.html`
- `admin-jobsite.html`
- `admin-recovery.html`
- `admin-app.html`
- `admin-analytics.html`
- `admin-catalog.html`
- `admin-staff.html`
- `admin-customers.html`
- `admin-account.html`

### `/assets`
- `site.css` — shared styling
- `site.js` — shared rendering/helpers
- `chrome.js` — nav/footer/branding
- auth/admin helper scripts as added by prior passes

### `/data`
Canonical/fallback static content such as:
- `rosie_services_pricing_and_packages.json`
- gear/consumables/system catalog JSON
- site feature content

### `/functions/api`
Key groupings:
- booking / availability / gifts / payments
- admin booking/staff/customer tools
- progress / jobsite / moderation
- recovery / analytics / notifications
- public catalog feed

### `/sql`
Ordered migration history. New SQL should be additive and keep `SUPABASE_SCHEMA.sql` synchronized.

---

## Preferred direction rules
- Prefer token-based progress over legacy/simple progress paths.
- Prefer DB-backed public catalog data with safe JSON fallback.
- Prefer role-aware/staff-aware endpoints over older bridge-style ones.
- Prefer additive changes over destructive rewrites.
- Keep protected/admin/token pages out of search indexing.

## March 25, 2026 notable files
- `functions/api/_lib/pricing-catalog.js` — canonical pricing loader (DB setting first, JSON fallback)
- `functions/api/admin/progress_upload_url.js` — signed upload URL generator using staff sessions
- `functions/api/admin/catalog_purchase_orders_list.js` — purchase-order list/reminder view
- `functions/api/admin/catalog_purchase_order_update.js` — purchase-order status workflow updates


### March 25, 2026 pass note
This doc was refreshed during the vehicle catalog, progress-session, layout, and public catalog filter pass. The repo now includes NHTSA-backed vehicle make/model endpoints, a DB cache table for vehicle catalog rows, progress moderation/enable session upgrades, and public search/filter cleanup on Gear and Consumables.

## March 27, 2026 repository note
- `/book.html` is now a mobile-first wizard page.
- `/assets/chrome.js` owns the public account widget behavior.
- `functions/api/progress/view.js` is now responsible for suppressing internal-only updates from the customer-facing feed.


## March 29, 2026 guide note
Prefer the session-aware admin/detailer endpoints over any older shared-password-only admin path. If two endpoints appear to overlap, treat the role-aware version that imports `requireStaffAccess` as the current preferred direction.


## March 29, 2026 gift / upload / endpoint pass
- moved more admin endpoints off direct shared-password checks and onto session-aware `requireStaffAccess`, including customer-profile tooling, booking customer linking, and unblock date/slot actions.
- improved customer gift/account polish by adding dashboard gift summary totals and a signed-in gift balance checker on My Account.
- hardened the signed upload endpoint with media-type and file-size validation plus customer-visible/public-url handling guidance.
- continued DB-first cleanup and doc/schema synchronization for the current dev build.


## March 29, 2026 promo / blocks / purchase reminder pass
- promo list/create/disable and block date/slot actions now prefer signed-in staff session access through the shared role-aware auth helper instead of direct shared-password checks.
- booking_update and assign now log actor-attributed booking events while using the resolved current staff actor.
- purchase-order reminder lifecycle moved forward with reminder logging fields, a reminder action endpoint, and overdue reminder reporting in the purchase-order list endpoint.
- this reduced more of the old/new endpoint overlap and shared-password bridge risk, but did not fully eliminate every remaining legacy-only admin path yet.

## March 29, 2026 pricing/session/recovery/moderation pass
- public pricing pages now have a DB-first `/api/pricing_catalog_public` endpoint so services, pricing, gifts, and booking can reduce hard-coded JSON drift while keeping bundled fallback behavior.
- more legacy fallback use was removed from signoff, recovery, notification, moderation, and low-stock endpoints by preferring session-only role-aware access.
- admin recovery now has a recovery audit list endpoint, and jobsite/progress detail endpoints now support visibility filtering to make moderation review more practical.
- purchase-order reminder logging now also creates an internal notification-event trail, moving reminder lifecycle closer to a fuller operational audit path.
- this pass continues to reduce the gaps, but the remaining work is still the final elimination of the last legacy-only screens/endpoints, broader mobile upload reuse, and complete operational convergence.


## March 30, 2026 promo compatibility pass
- Admin promo creation now sends the minimal canonical promo payload (`code`, `is_active`, `discount_type`, `discount_value`, `starts_at`, `ends_at`, `description`) to reduce schema drift against the live `promo_codes` table.
- This pass specifically removes older create-path dependence on legacy promo fields like `active`, `applies_to`, `percent_off`, and `amount_off_cents` during promo creation.


## March 30, 2026 repo note
The current pass mainly touches `admin-promos.html`, `book.html`, and a further batch of `functions/api/admin/*` session-access routes. The docs/schema files were refreshed again to reflect promo-schema reconciliation and continued session-first cleanup.

## March 30, 2026 session-first cleanup pass
- Reduced bridge risk again by removing legacy admin fallback from another active set of endpoints, including progress posting/upload, customer-profile save/list, booking customer linking, unblock actions, and app-settings access.
- Tightened browser-side admin calls so active internal pages send `x-admin-password` only when a transitional password is actually present instead of always attaching the header shape.
- Continued doc/schema synchronization and public-page SEO/H1 review for the current build.

## March 30, 2026 repo update
Current work in this pass focused on `functions/api/admin/*` convergence: more booking, customer, staff, promo companion, and time endpoints now require the resolved staff session path instead of permitting the old bridge fallback.
