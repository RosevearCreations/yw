> Last synchronized: March 30, 2026. Reviewed during the staff-session, time-flow identity, intake/media session hardening, booking/admin shell cleanup, and docs/schema synchronization pass.

> Last synchronized: March 28, 2026. Reviewed during the pricing chart zoom/modal, manufacturer callout, local SEO metadata, and current-build synchronization pass.


<!-- README.md -->

> Last synchronized: March 26, 2026. Reviewed during the booking add-on imagery, catalog autofill, low-stock reorder UI, Amazon-link intake, local SEO, and docs/schema refresh pass.

> Last synchronized: March 25, 2026. This file was reviewed during the recovery/moderation/docs/schema refresh pass.

# Rosie Dazzlers — Mobile Auto Detailing Platform
Cloudflare Pages + Supabase + Stripe/PayPal + R2

Rosie Dazzlers is now more than a brochure site. On the `dev` branch it is a role-aware operations platform for mobile detailing in Norfolk and Oxford Counties, with booking, gift certificates, customer progress, jobsite intake, staff/admin tools, recovery messaging, and catalog/inventory workflows.

---

## Last synchronized
- March 25, 2026
- This pass added session-aware internal workflow upgrades, DB-backed canonical pricing for checkout, mobile-friendly direct media upload, purchase-order receive/close actions, and another SEO/H1/doc/schema refresh.

---

## Stack
- Cloudflare Pages — static hosting + Pages Functions
- Supabase Postgres — core database
- Cloudflare R2 — media/assets
- Stripe — booking deposits and gift purchases
- PayPal — deposit checkout path
- DB-backed app settings now hold the canonical pricing catalog (`pricing_catalog`), with JSON still kept as the bundled fallback source

---

## Core customer flows
- Marketing pages: `/`, `/services`, `/pricing`, `/about`, `/contact`
- Booking flow: `/book`
- Gift certificates: `/gifts`
- Client account: `/login`, `/my-account`
- Customer progress page: `/progress.html?token=...`
- Public operational catalogs: `/gear`, `/consumables`

---

## Core admin flows
- Dashboard: `/admin.html`
- Bookings / scheduling: `/admin-booking.html`, `/admin-blocks.html`, `/admin-assign.html`
- Progress + moderation: `/admin-progress.html`
- Jobsite intake + moderation: `/admin-jobsite.html`
- Recovery rules/templates/testing: `/admin-recovery.html`, `/admin-app.html`, `/admin-analytics.html`
- Catalog / low stock / reorder workflow: `/admin-catalog.html`
- Staff / customer management: `/admin-staff.html`, `/admin-customers.html`, `/admin-account.html`

---

## Current architecture
Browser  
↓  
Cloudflare Pages static HTML  
↓  
Pages Functions in `/functions/api`  
↓  
Supabase Postgres  
↓  
Stripe / PayPal / provider dispatch integrations  
↓  
Cloudflare R2 assets + uploaded media

---

## Current direction
Highest-value work is no longer basic feature creation. The main need is consistency:
- real staff auth/session completion
- consistent staff identity across jobsite/progress/media/time flows
- gift redemption polish across all customer/account screens
- canonical pricing/add-on behavior everywhere
- stronger upload/mobile workflow
- continued SEO cleanup without exposing protected flows to indexing

---

## Source-of-truth docs
Read these first:
- `PROJECT_BRAIN.md`
- `CURRENT_IMPLEMENTATION_STATE.md`
- `KNOWN_GAPS_AND_RISKS.md`
- `DEVELOPMENT_ROADMAP.md`
- `REPO_GUIDE.md`
- `SUPABASE_SCHEMA.sql`

---

## Branch rule
Use `dev` as the active source of truth unless explicitly told otherwise.

## Last synchronized
- March 25, 2026
- This pass added a site-wide public account widget through the shared chrome, customer password reset + email verification token flows, lightweight public analytics tracking, and refreshed risk/docs/schema snapshots.

## Newly advanced in this pass
- public login/account status widget injected across public pages
- forgot password + email verification resend + token verification flows
- analytics tracking for page views, heartbeats, cart snapshots, and simple live-session reporting
- stronger public login/reset screen
- docs/schema refresh aligned to the current dev branch


### March 25, 2026 late-pass notes

This build now includes a dual-path public sign-in experience (client first, staff fallback in the UI), a restored signed-in identity panel on the main admin dashboard, and a stronger analytics screen for live online activity, daily traffic, countries, referrers, carts, and abandoned checkout review.

## Latest pass summary
This pass focused on staff-session consistency in progress flows, booking vehicle catalog normalization, form/layout cleanup, richer public gear/consumables filtering, and another schema/doc refresh. Vehicle year/make/model selection is now designed around official NHTSA vPIC data with an internal cache path for future DB-first use.


## March 26, 2026 inventory/review/layout pass
- Added DB-backed inventory movement logging for adjustments, receive events, and detail-product usage.
- Added after-detail checklist persistence for keys/water/power/debrief and suggested next-service cadence.
- Extended customer garage vehicles with next-cleaning due date, interval days, and auto-schedule preference.
- Added in-app customer review capture plus a Google review handoff link.
- Hardened Gear/Consumables search inputs against browser email autofill and expanded sorting/filter controls.
- Updated logo references to use brand/untitled.png.
- Continue removing legacy admin-password fallback and continue route-by-route SEO cleanup with one H1 per exposed page.


### March 26, 2026 pass highlights
- Fixed public brand references to the new `brand/Untitled.png` logo asset.
- Continued local SEO cleanup for Oxford County and Norfolk County public pages.
- Added stronger admin catalog movement-history and booking usage UI on top of the existing inventory movement endpoints.
- Continued reducing shared-password dependence by letting newer progress tooling trust the signed-in staff session first.


### Latest pass
This pass repaired booking add-on imagery, continued local SEO tuning for Oxford and Norfolk counties, hardened public catalog search inputs against credential autofill, and expanded Admin Catalog with low-stock reorder visibility and Amazon-link draft intake.


## March 26, 2026 customer-flow and advanced inventory pass
- fixed booking add-on image sizing so package assets no longer blow out the add-ons grid.
- continued customer journey coverage by surfacing account/feed/signoff entry points more clearly and exposing checklist + products-used data on customer-facing progress/completion pages.
- extended inventory admin for purchase date and estimated jobs-per-unit so the team can track longevity of bulk supplies and hardware.
- continued DB-first inventory direction while keeping one-H1 public pages and local SEO focus on Oxford County and Norfolk County.

## Latest pass note
This build continues the mobile-first booking, staff workflow, inventory, and local SEO direction. The newest user-facing changes are the mobile booking wizard, shared public account widget, and tighter customer/private progress separation.


## Latest pass summary
This pass focused on booking wizard usability, two-way live job communication, mobile-safe layout behavior, and documentation/schema synchronization.

## March 29, 2026 update
This pass focused on reducing the biggest active operational risks rather than adding new data tables: more admin/detailer endpoints now trust the signed-in staff session first, actor attribution is stronger across booking/time/intake/media flows, and several internal pages now load from session state instead of demanding a password-first workflow.


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


## March 30, 2026 current-pass note
This pass stabilized promo management against the live database shape, reduced guest booking console noise by checking customer auth before dashboard-prefill calls, and continued moving active internal workflows toward signed-in staff-session access instead of the legacy shared-password bridge.

## March 30, 2026 session-first cleanup pass
- Reduced bridge risk again by removing legacy admin fallback from another active set of endpoints, including progress posting/upload, customer-profile save/list, booking customer linking, unblock actions, and app-settings access.
- Tightened browser-side admin calls so active internal pages send `x-admin-password` only when a transitional password is actually present instead of always attaching the header shape.
- Continued doc/schema synchronization and public-page SEO/H1 review for the current build.

## March 30, 2026 update
This build continues the session-first admin transition by removing another large batch of legacy admin fallback allowances across booking, customer, staff, promo companion, and time-management endpoints. Documentation and schema notes were refreshed in the same pass.
