> Last synchronized: March 30, 2026. Reviewed during the staff-session, time-flow identity, intake/media session hardening, booking/admin shell cleanup, and docs/schema synchronization pass.

> Last synchronized: March 28, 2026. Reviewed during the pricing chart zoom/modal, manufacturer callout, local SEO metadata, and current-build synchronization pass.


<!-- DEVELOPMENT_ROADMAP.md -->

> Last synchronized: March 26, 2026. Reviewed during the booking add-on imagery, catalog autofill, low-stock reorder UI, Amazon-link intake, local SEO, and docs/schema refresh pass.

> Last synchronized: March 25, 2026. This file was reviewed during the recovery/moderation/docs/schema refresh pass.

# Rosie Dazzlers — Development Roadmap

This is the practical implementation order for the `dev` branch after the March 25, 2026 documentation and UI refresh.

---

## Immediate priorities

### 1) Real staff auth/session completion
Finish the transition away from shared-password dependence.
- continue converting older endpoints/screens to session-aware auth
- keep the legacy bridge as fallback only
- resolved actor trusted across all internal screens

### 2) Staff identity consistency cleanup
Ensure the same actor model is used across:
- jobsite intake
- progress updates
- media
- comments / annotations
- time entries
- signoff / assignment

### 3) Gift redemption polish
Booking checkout is much better, but still needs:
- consistent customer-facing gift balance messaging
- account-side gift checker/history
- final webhook-safe reconciliation review

### 4) Canonical pricing and add-ons
Continue removing pricing drift.
- booking checkout
- admin reporting references
- future invoices / summaries
- tests against `data/rosie_services_pricing_and_packages.json`

### 5) Mobile upload completion
Complete direct upload flow.
- signed upload URLs or direct storage flow
- mobile-friendly jobsite/progress upload UX
- save media cleanly into operational tables

---

## Secondary priorities

### 6) Recovery operations hardening
- provider-backed send logging
- retry/test history visibility
- provider-specific template/rule validation
- optional recovery audit trail in admin

### 7) Catalog purchasing workflow
- reorder reminders
- ordered / received / cancelled states surfaced clearly
- low-stock alert resolution flow
- optional vendor reminder notifications

### 8) Internal shell cohesion
- unify admin/detailer navigation
- reduce screen-to-screen fragmentation
- improve field/mobile usage

### 9) Route and endpoint cleanup
- finalize canonical public route structure
- retire duplicate/legacy endpoint patterns
- document preferred replacements clearly

### 10) Ongoing SEO pass
On every build:
- review page title/H1/meta
- keep admin/token/private pages noindex
- continue public support-page cleanup
- maintain sitemap/robots consistency


## Newly moved forward

- public/client login flow now hands off to staff auth when the credentials belong to staff
- public account widget now recognizes staff sessions as well as customer sessions
- admin dashboard has a live analytics summary surface again
- analytics view has stronger historical + live monitoring detail


## March 25, 2026 update
- moved forward: canonical pricing now has a DB-backed setting source with JSON fallback
- moved forward: mobile-friendly direct upload page now uses the signed-in staff session
- moved forward: purchase-order receive/cancel workflow now exists in admin catalog
- move up next: finish the same session-aware conversion on the remaining legacy admin endpoints and screens


### March 25, 2026 pass note
This doc was refreshed during the vehicle catalog, progress-session, layout, and public catalog filter pass. The repo now includes NHTSA-backed vehicle make/model endpoints, a DB cache table for vehicle catalog rows, progress moderation/enable session upgrades, and public search/filter cleanup on Gear and Consumables.


## Newly moved forward (2026-03-26)
- Admin-side gear/consumables editing for rating, stock, reorder rules, vendor, category, and saved order.
- Receive/close purchase workflow now updates inventory quantities.
- My Account vehicle editor upgraded to live year/make/model lookups.
- Book page booking-data error fixed.

## Move up next
- Remove the final legacy fallback flags from the remaining admin endpoints now that the env gate is in place.
- Continue moving public catalog content from JSON fallback into DB-first inventory content.
- Add structured-data coverage route by route after the remaining content cleanup pass.


## March 26, 2026 inventory/review/layout pass
- Added DB-backed inventory movement logging for adjustments, receive events, and detail-product usage.
- Added after-detail checklist persistence for keys/water/power/debrief and suggested next-service cadence.
- Extended customer garage vehicles with next-cleaning due date, interval days, and auto-schedule preference.
- Added in-app customer review capture plus a Google review handoff link.
- Hardened Gear/Consumables search inputs against browser email autofill and expanded sorting/filter controls.
- Updated logo references to use brand/untitled.png.
- Continue removing legacy admin-password fallback and continue route-by-route SEO cleanup with one H1 per exposed page.


## March 26, 2026 search/inventory/admin UX pass
- Continued DB-first inventory work by extending public sorting/filtering and admin movement-history visibility.
- Added booking-level product usage recording UI in admin progress and admin catalog.
- Continued session-aware progress tooling so signed-in staff can work without depending on the fallback password on newer flows.
- Continued local SEO work for Norfolk County and Oxford County with structured-data and page-metadata cleanup.
- Move up next: gift/account polish, final legacy fallback removal, broader structured-data coverage route by route, and a fuller purchase reminder lifecycle.

## March 26, 2026 booking/catalog/local SEO pass
- moved forward: booking add-on images now come from the canonical pricing/add-on JSON source instead of a separate page-only map.
- moved forward: admin catalog now has a stronger low-stock and reorder candidate surface plus Amazon-link draft intake.
- moved forward: public catalog filters now expose category/type sorting more clearly.
- move up next: finish the detailer-side products-used picker polish and continue DB-first replacement of remaining JSON fallback content.


## March 26, 2026 customer-flow and advanced inventory pass
- fixed booking add-on image sizing so package assets no longer blow out the add-ons grid.
- continued customer journey coverage by surfacing account/feed/signoff entry points more clearly and exposing checklist + products-used data on customer-facing progress/completion pages.
- extended inventory admin for purchase date and estimated jobs-per-unit so the team can track longevity of bulk supplies and hardware.
- continued DB-first inventory direction while keeping one-H1 public pages and local SEO focus on Oxford County and Norfolk County.


## March 27, 2026 booking wizard + detailer workflow pass
- moved forward: booking now has a visible 5-step wizard flow for date/slot, main service, add-ons, vehicle verification, and final review/payment.
- moved forward: add-on imagery now uses local packaged assets so the remaining missing cards no longer render blank.
- moved forward: detailer jobs now have a dedicated signed-in screen for accept/decline, dispatch, arrival, start/pause/resume, and complete-to-billing actions.
- moved forward: customer progress now shows a clearer workflow timeline in addition to photos, comments, signoff, checklist, and products used.
- move up next: final legacy fallback removal, customer-facing checklist/signoff history in My Account, invoice/receipt design, and fuller notification delivery wiring.

## March 27, 2026 mobile booking + public account widget pass
- moved forward: booking now uses a more phone-friendly wizard with step validation, quick available-date choices, and smoother scroll behavior.
- moved forward: public site chrome now shows a real login / create account / garage / admin widget depending on the resolved session.
- moved forward: customer progress feed now filters out internal-only updates so admin/detailer private notes stay private.
- move up next: finish session-only cleanup on the last legacy admin screens, complete end-to-end notification delivery, and continue DB-first inventory consolidation.


## March 27, 2026 wizard cleanup + two-way communication pass
- moved forward: booking wizard header is now non-sticky so step fields remain reachable on mobile.
- moved forward: step transitions now scroll to the active content panel instead of the wizard header.
- moved forward: customer progress now supports customer-posted live messages through the progress token path.
- moved forward: detailer jobs now supports posting customer-visible updates and internal staff notes directly from the assigned-jobs screen.
- move up next: notification fan-out for new notes, richer customer history in My Account, and final removal of shared-password compatibility on the oldest internal screens.


## 2026-03-28 late pass moved forward
- Stabilize deploy/build path by finishing the shared staff auth helper normalization.
- Continue admin UX polish with persistent return navigation and cleaner loading states.
- Continue route-by-route visual QA for asset path drift, contrast drift, and mobile layout regressions.

## Roadmap movement — March 29, 2026
- Advanced the auth/session completion track by converting another batch of admin endpoints away from direct shared-password-only checks.
- Advanced the identity-consistency track by using the resolved signed-in actor in time/intake/media and booking-event flows.
- Advanced UI cohesion by making Bookings, Blocks, and Staff pages load from the real staff session instead of requiring a password-first flow.
- Move up next: remaining legacy-only admin endpoints (`bookings/assign/blocks` companion actions, intake edge routes, and any pages still hard-coded around `x-admin-password`) plus notification delivery and upload hardening.


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


## March 30, 2026 movement
- moved forward: promo management is now more stable against the live database shape after reconciling the promo table and constraint model.
- moved forward: the admin promo screen now renders operational promo data instead of a raw JSON dump in the main workflow area.
- moved forward: guest booking now avoids unnecessary customer-dashboard calls until customer auth is confirmed, reducing false console noise during public booking use.
- move up next: finish the remaining session-only cleanup on older admin endpoints, normalize stale CORS/header comments that still describe the bridge as primary behavior, and continue upload-flow reuse across the remaining field screens.

## March 30, 2026 session-first cleanup pass
- Reduced bridge risk again by removing legacy admin fallback from another active set of endpoints, including progress posting/upload, customer-profile save/list, booking customer linking, unblock actions, and app-settings access.
- Tightened browser-side admin calls so active internal pages send `x-admin-password` only when a transitional password is actually present instead of always attaching the header shape.
- Continued doc/schema synchronization and public-page SEO/H1 review for the current build.

## March 30, 2026 roadmap movement
- moved forward: booking management, customer/customer-tier management, promo companion routes, and staff/time endpoints were pushed further toward session-first access by removing another batch of legacy fallback allowances.
- move up next: retire the remaining explicit bridge-only bootstrap/utility routes, continue route comment/header normalization, and reuse the signed upload flow across the remaining field screens.
