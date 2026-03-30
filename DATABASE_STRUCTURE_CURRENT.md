> Last synchronized: March 30, 2026. Reviewed during the staff-session, time-flow identity, intake/media session hardening, booking/admin shell cleanup, and docs/schema synchronization pass.

March 28, 2026 sync note: no new tables were required for this pass; this refresh mainly aligns UI readability, catalog presentation, and documentation with the current build.

> Last synchronized: March 28, 2026. Reviewed during the image-fit, booking-slot readability, dark-text contrast, and current-build documentation/schema sync pass.


> Last synchronized: March 28, 2026. Reviewed during the pricing chart zoom/modal, manufacturer callout, local SEO metadata, and current-build synchronization pass.


# Database Structure Current

> Last synchronized: March 26, 2026. Reviewed during the booking add-on imagery, catalog autofill, low-stock reorder UI, Amazon-link intake, local SEO, and docs/schema refresh pass.

## Snapshot note
This file is the human-readable companion to `SUPABASE_SCHEMA.sql`.
Last synchronized: March 25, 2026.
No new tables were introduced in this UI/docs pass, but the descriptions below were refreshed to match the current feature set.

---

## bookings
Core operational booking record.
Important fields now include:
- service date / slot / duration
- package code / vehicle size / addons
- price/deposit totals
- Stripe + PayPal references
- progress token + progress enabled
- assigned staff references
- customer profile/tier linkage
- waiver acknowledgements

## app_management_settings
Key/value JSON settings storage used for:
- feature flags
- moderation defaults
- recovery rules
- recovery provider rules
- payment method toggles
- canonical pricing catalog (`pricing_catalog`)
- other admin policy settings

## gift_certificates / gift_products
Gift sale and redemption model.
Includes:
- product definitions
- issued gift codes
- remaining balance / status
- purchaser/recipient fields
- payment references

## job_updates / job_media / job_signoffs
Token-based progress model.
Includes:
- visibility
- thread status / moderation metadata
- media URLs/captions
- signoff metadata

## progress_comments
Two-sided threaded comments for booking progress.
Includes:
- parent_type / parent_id
- author type/name/email
- visibility
- thread status
- moderation metadata

## observation_annotations
Picture-first observation markers tied to media.
Includes:
- booking/media linkage
- x/y coordinates
- title / note / category / severity / pin color
- visibility
- thread status
- moderation metadata

## jobsite_intake / job_time_entries
Field workflow tables for:
- pre-inspection intake
- acknowledgements
- valuables/conditions/prep notes
- time tracking and work state history

## recovery_message_templates
Persisted message templates for recovery flows.
Includes:
- template key
- channel
- provider
- active state
- subject/body templates
- variables
- per-template rules
- notes

## notification_events
Queue/dispatch table for outbound notifications.
Includes:
- event type/channel
- recipient targets
- subject/body payloads
- retry state
- provider response/error tracking

## catalog_inventory_items
DB-backed public/admin inventory for tools and consumables.
Includes:
- item key/type/name/category
- public/active flags
- image/Amazon links
- quantity / reorder point / reorder qty
- vendor and cost data
- public rating fields
- notes

## catalog_low_stock_alerts
Operational low-stock tracking.
Includes:
- item linkage
- qty/reorder snapshots
- resolution fields

## catalog_purchase_orders
Purchasing/reorder workflow foundation.
Includes:
- item linkage
- vendor / qty / cost
- status
- reminder / ordered / received timestamps
- purchase URL / note

## Newer auth + tracking structures
### customer_profiles
Customer account/profile record now also carries password + verification-adjacent fields used by the public account widget and recovery flows.

### customer_auth_sessions
Cookie/session backing table for logged-in customer sessions.

### customer_auth_tokens
Short-lived token store for password reset and email verification links.

### site_activity_events
Public analytics event stream for page views, heartbeats, referrers, session journeys, cart signals, and checkout progress.

### notification_events
Queued notification log used by customer/recovery communication flows.


## Analytics note

The current public tracking implementation continues to use `site_activity_events` as the raw event stream. Historical daily traffic, live-online session estimates, cart signals, and checkout-state summaries are now computed from that table inside the admin analytics layer rather than through a separate reporting table.


## catalog_purchase_orders
Tracks reorder and purchasing workflow for tools/consumables.
Important fields include:
- item link fields (`item_id`, `item_key`, `item_name`)
- vendor name / purchase URL
- ordered quantity / unit cost
- status (`draft`, `requested`, `ordered`, `received`, `cancelled`)
- reminder date plus ordered/received timestamps

## staff_auth_sessions
Opaque staff session table used by internal pages and newer role-aware endpoints.
This is now the preferred auth model for internal workflows, while the shared admin password remains a temporary bridge.

## March 25, 2026 additions
- `bookings` now tracks normalized vehicle fields such as `vehicle_year`, `vehicle_make`, `vehicle_model`, `vehicle_body_style`, `vehicle_category`, `vehicle_plate`, `vehicle_mileage_km`, and `vehicle_photo_url`.
- `customer_vehicles` now carries richer operational and communication fields plus `vehicle_size`, `body_style`, `vehicle_category`, and `is_exotic`.
- `vehicle_catalog_cache` stores year/make/model rows fetched from NHTSA vPIC for later DB-backed reuse.


## Catalog inventory additions (2026-03-26)
- `catalog_inventory_items.subcategory` — second-level display/type label for admin and public filtering.
- `catalog_inventory_items.sort_key` — saved manual sort order.
- `catalog_inventory_items.reuse_policy` — `reorder`, `single_use`, or `never_reuse`.


## March 26, 2026 inventory/review/layout pass
- Added DB-backed inventory movement logging for adjustments, receive events, and detail-product usage.
- Added after-detail checklist persistence for keys/water/power/debrief and suggested next-service cadence.
- Extended customer garage vehicles with next-cleaning due date, interval days, and auto-schedule preference.
- Added in-app customer review capture plus a Google review handoff link.
- Hardened Gear/Consumables search inputs against browser email autofill and expanded sorting/filter controls.
- Updated logo references to use brand/untitled.png.
- Continue removing legacy admin-password fallback and continue route-by-route SEO cleanup with one H1 per exposed page.


## March 26, 2026 note
No new table was required in this pass. The operational focus moved to UI coverage over the existing catalog inventory, movement, and booking-linked usage tables while continuing the JSON-to-DB reduction direction.

## Pass note — March 26, 2026
No new tables were required in this pass. The current work was focused on using the existing inventory, movement, and pricing structures more consistently in the UI and documentation.


## March 26, 2026 customer-flow and advanced inventory pass
- fixed booking add-on image sizing so package assets no longer blow out the add-ons grid.
- continued customer journey coverage by surfacing account/feed/signoff entry points more clearly and exposing checklist + products-used data on customer-facing progress/completion pages.
- extended inventory admin for purchase date and estimated jobs-per-unit so the team can track longevity of bulk supplies and hardware.
- continued DB-first inventory direction while keeping one-H1 public pages and local SEO focus on Oxford County and Norfolk County.

## March 27, 2026 note
No new table or column was required in this pass. The main change was behavioral: customer progress views now rely on existing visibility data to suppress internal-only updates, and booking now uses the existing vehicle / pricing / availability structures in a more mobile-friendly way.



## 2026-03-28 note
No new schema objects were required in this pass. This pass focused on frontend/admin-shell stabilization, asset-path repair, and staff-auth build compatibility.


March 29, 2026 sync note: no new tables were required for this pass; the main changes were endpoint/session hardening and actor-attribution improvements using the existing schema.


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


## March 30, 2026 database note
The meaningful database change in this pass is promo-code reconciliation: the live `promo_codes` structure and constraints were aligned with the canonical `discount_type` / `discount_value` model so admin promo create/list behavior matches the real table shape.

## March 30, 2026 session-first cleanup pass
- Reduced bridge risk again by removing legacy admin fallback from another active set of endpoints, including progress posting/upload, customer-profile save/list, booking customer linking, unblock actions, and app-settings access.
- Tightened browser-side admin calls so active internal pages send `x-admin-password` only when a transitional password is actually present instead of always attaching the header shape.
- Continued doc/schema synchronization and public-page SEO/H1 review for the current build.

## March 30, 2026 structure note
No new tables or columns were introduced in this pass. The work was focused on endpoint/auth convergence and keeping the schema snapshot aligned with the current build.
