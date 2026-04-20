# Database Schema Reference


## Current pass update

- Repaired the phone product-capture save route so it resolves the shared D1 binding through `DB` or `DD_DB` instead of assuming one binding name.
- The mobile save endpoint now returns structured JSON failures and records a runtime incident when the save path breaks unexpectedly.
- The phone product-capture page now parses failed responses safely, so HTML 500 pages no longer surface as `Unexpected token '<'` in the admin UI.
- Rechecked outward-facing HTML pages and the one-H1 rule remains intact across the current public page set.

## Core auth

### users
- user_id
- email
- password_hash
- display_name
- role
- is_active
- created_at
- updated_at
- last_login_at

### sessions
- session_id
- user_id
- session_token
- token
- created_at
- expires_at
- ip_address
- user_agent

Client auth now uses the existing sessions table with a browser cookie fallback for the token so regular pages can resolve the same active session more reliably.

### admin_logs
Admin security and action logging.

## Profiles and tiers

### user_profiles
Customer and employee profile fields including phone, preferences, address, employee info, and emergency contact.

### access_tiers
### user_access_tiers
Business, customer, supporter, and employee tier assignments.

## Commerce

### tax_classes
### products
### product_images
### product_tags
### orders
Includes `payment_status` and `payment_method` in the current schema.

### order_items
### order_status_history
### payments
### payment_refunds
Local refund audit table for admin and provider reconciliation. Indexed by provider sync status and refund status for faster health/follow-up review.

### payment_disputes
Local dispute audit table for chargeback and admin follow-up. Indexed by dispute status and provider sync status for faster health/follow-up review.

## Growth, analytics, SEO, media, and inventory

### site_visitors
Unique visitor identity and country and device summary.

### site_visitor_sessions
Visitor session timeline, entry path, last path, checkout, and abandonment flags.

### site_page_views
Historical page view and event trail.

### site_search_events
Search terms and result counts.

### cart_activity
Cart add, update, checkout, and abandonment events.

### app_settings
App-wide saved settings.

### notification_jobs
### notification_dispatch_logs
Queued notification and dispatch tracking.

### product_seo
Meta title, description, keywords, H1, canonical, and Open Graph fields.

### product_image_annotations
Alt text, title, caption, focal points, and notes.

### media_assets
Uploaded R2-backed assets with product linkage, object key, sort order, optional variant role, and soft delete support.

### webhook_events
Provider event log with idempotency, status, replay request metadata, retry attempt fields, and dispatch notes.

### site_item_inventory
- now includes image_url, preferred_reorder_quantity, is_on_reorder_list, do_not_reorder, do_not_reuse, reuse_status

product_resource_links
- links a finished product to tools and supplies used in making it

movie_catalog
- public movie shelf table. Enrichment can be seeded from `/data/movies/movie_catalog_enriched.v2.json`
Operational inventory table for tools, supplies, and sellable items with on-hand, reserved, incoming, supplier, and cost fields.

### site_inventory_movements
Movement log for inventory creates, adjustments, reserves, releases, incoming changes, corrections, and deletes.
Fields include previous and new on-hand, reserved, and incoming quantities plus note and actor.


## auth_recovery_requests

Stores logged-out forgot-password and forgot-email requests for later admin review without revealing whether a matching account exists.


## catalog_items

Purpose: staged unified catalog storage for tools, supplies, and featured creations that were previously JSON-only. This supports cleaner public search, future analytics, and inventory automation.

Key columns:
- `item_kind` (`tool`, `supply`, `creation`, `other`)
- `source_key` (stable unique source identifier per kind)
- `slug`, `name`, `brand`, `category`, `subcategory`, `item_type`
- `short_description`, `notes`, `image_url`, `r2_object_key`, `amazon_url`
- `quantity_on_hand`, `reorder_point`, `storage_location`
- `source_record_json`, `source_json_path`

## Product CSV mass upload fields

Required fields:
- `name`
- `product_type` (`physical` or `digital`)
- `price_cents`

Optional fields:
- `slug` (auto-generated if omitted)
- `status`, `currency`, `sku`, `short_description`, `description`
- `compare_at_price_cents`, `taxable`, `tax_class_id`, `requires_shipping`, `weight_grams`
- `inventory_tracking`, `inventory_quantity`, `digital_file_url`, `featured_image_url`, `sort_order`

Images are optional during import and can be added during later review before activation.


## Current pass additions
- Session/auth now uses a stronger same-site continuity path: auth endpoints set a first-party `dd_auth_token` cookie in addition to returning the bearer token. Public pages can resolve the signed-in member/admin state more reliably.
- Added `movie_catalog` for staged migration of the legacy UPC-only movie JSON into D1. The public movies page now reads from `/api/movies`, which prefers D1 and falls back to `/data/catalog.json`.
- Catalog sync now supports movies in addition to tools, supplies, and featured creations.
- Public movie search UI now supports title, UPC, year, actor, and director fields when that data exists, while still working with legacy UPC-only data.
- Product CSV preview now renders as a structured validation table instead of loose JSON/text lines.


## Current pass update
- `movie_catalog` schema references now include the richer admin-overlay movie fields: `original_title`, `imdb_id`, `alternate_identifier`, `metadata_status`, `metadata_source`, estimated value fields, `rarity_notes`, `collection_notes`, and `value_search_url`.
- `database_schema.sql`, `database_store_schema.sql`, and `database_upgrade_current_pass.sql` were synchronized forward so older environments have a clearer upgrade path for the current movie/editor/admin flows.
- Movie catalog wiring now blends D1 `movie_catalog`, `/data/movies/movie_catalog_enriched.v2.json`, and the R2-hosted cover images more safely.
- Movie search now supports title, UPC, year, actor, director, genre, studio, format, and optional trailer-link filtering.
- `trailer_url` is now part of the movie enrichment path so trailer support can be stored directly when available.
- Storefront product detail now includes linked tools and supplies from `product_resource_links` so each finished product can tell a clearer “made with these materials and tools” story.
- Admin product-resource linking now supports usage notes for story-building and social-post context.
- Admin inventory can now sync tool and supply records from `catalog_items` into `site_item_inventory`, reducing duplicate maintenance between JSON, catalog, and inventory records.
- Continue the one-H1-per-exposed-page rule and continue improving page titles, descriptions, canonical tags, crawl paths, structured data relevance, and visible on-page content alignment on every outward-facing pass.


## Current pass notes

- `movie_catalog` remains the long-term home for enriched movie metadata, while `data/movies/movie_catalog_enriched.v2.json` currently provides the live R2-backed image bridge for front/back covers.
- `site_item_inventory` continues to be the operational inventory table for tools and supplies, including reorder, do-not-reorder, and do-not-reuse controls.
- `product_resource_links` remains the relationship table connecting finished products to the tools and supplies used during the build process.


## Current pass schema note

No brand-new core tables were required for this pass. The largest work was defensive compatibility around existing `products`, `catalog_items`, `site_item_inventory`, `movie_catalog`, analytics, and webhook tables so partially migrated databases do not break the admin/dashboard JSON endpoints.


## Current pass update

- Mobile finished-product capture page added at `/admin/mobile-product/` for phone-first product entry.
- The phone workflow now assigns the next available product number, supports category, colour, shipping code, tax code, SEO title/meta description, direct image upload to R2, and optional tool/supply links.
- Products created from the phone workflow are saved as draft items with `review_status = pending_review` so they can be reviewed before publishing.
- Product records now support `product_number`, `product_category`, `color_name`, `shipping_code`, and `review_status`.
- Storefront/admin product search can now match category and colour more directly.
- SEO guidance remains aligned with Google Search Central: one clear H1 per outward-facing page, descriptive title links, page-specific meta descriptions, crawlable internal links, and structured data that matches visible content.

## Current pass update

- The creations page now uses explicit white-card contrast styling so the text, buttons, and filter controls match the rest of the site instead of showing pale text on pale cards.
- The movie system now prefers `movie_catalog_enriched.v2.json`, and the uploaded v2 file has been copied into `/data/movies/` so the public API reads the newer enrichment file first.
- The mobile finished-product capture workflow now includes a stock-aware lookup for tools and supplies, with filters for tools-only, supplies-only, and in-stock-only browsing while you build a product from a phone.
- The public tools page now mirrors the supplies-page reorder workflow with local reorder-list actions: add to reorder, show reorder-needed only, copy reorder text, and clear the list.
- Search-engine wording guidance for outward-facing pages continues to emphasize high-intent phrases around handmade jewelry, custom rings, necklaces, polymer clay earrings, laser engraved gifts, CNC components, 3D printed items, workshop tools, and workshop supplies for Ontario and Canada shoppers.


## Current pass

- Movie shelf layout and pagination were repaired.
- No new schema tables were introduced in this pass; the focus was stability, layout repair, safer headers, and clearer risk documentation.


## Current pass update

- Rebuilt the public movie shelf layout with a dedicated card and pager structure so movie entries no longer collapse into unusable one-character columns.
- The movies page now uses the API paging metadata to show the real total catalog size, page number, page range, and next/previous navigation more honestly.
- Added a more defensive movie-specific CSS layer so future generic card/grid changes are less likely to break the movie shelf again.
- KNOWN_GAPS_AND_RISKS.md was rewritten to document the remaining payment, inventory, media, analytics, and metadata risks more clearly.


### admin_action_audit
Server-side audit trail for privileged operator actions such as product create/update/delete, inventory edits, media uploads, and webhook review actions.

### auth_recovery_requests additions
Now stores `ip_address` and `user_agent` for safer manual review and light abuse throttling.


### notification_outbox
Durable local queue for outbound receipts and related customer/admin notifications.

### payment_refunds / payment_disputes sync fields
`provider_sync_status`, `provider_sync_note`, and `provider_sync_at` record whether the local action was also pushed to the provider or is still local/manual only.

### products readiness fields
`is_ready_for_storefront` and `ready_check_notes` help govern draft-to-publish workflow.

### site_item_inventory authority fields
`supplier_contact`, `reservation_notes`, `last_reorder_requested_at`, and `last_counted_at` support more trustworthy inventory operations.



## Current pass operational notes

- No new required tables were added in this pass.
- Existing `notification_outbox` is now actively used by a real dispatch helper and admin processing endpoint.
- Existing `payment_disputes` is now updated from Stripe dispute webhook events, not only manual admin entry.
- Existing schema now supports stronger admin step-up confirmation without another table because password confirmation is checked against the current admin session.

## Current pass schema additions

### `supplier_purchase_orders`
Draft reorder header records grouped by supplier so inventory reorder work can be staged, reviewed, and later submitted.

### `supplier_purchase_order_items`
Line items for supplier purchase-order drafts, linked back to `site_item_inventory` where possible.

### `product_review_actions`
Durable audit trail of governed product review actions such as approve, needs changes, publish, and unpublish.



## Current pass update
- `supplier_purchase_orders` now includes ordered/received lifecycle timestamps.
- `supplier_purchase_order_items` now track `quantity_received`, `incoming_applied_at`, and `received_at` to support inventory receiving automation.

- No new tables were required in this pass. Inventory governance improvements were implemented through action-path logic and existing `site_item_inventory`, `site_inventory_movements`, and `product_resource_links` tables.


## Current pass update
- No new schema objects were required in this pass.
- Existing `notification_outbox` is now used more actively because refund/dispute admin actions and provider-confirmed Stripe webhook events both attempt immediate delivery processing.
- Existing storefront/product tables now support richer outward-facing discovery through API-level filter summaries without additional schema changes.

## Current pass schema note
- No new tables were added in this pass.
- This pass instead increased use of existing schema paths: `products`, `product_images`, `product_tags`, `product_seo`, `product_image_annotations`, and `media_assets` are now used more fully by bulk import and direct media-upload flows.



## Current pass schema note
- No new mandatory tables were added in this pass.
- Current-pass code uses existing schema more fully, especially `site_item_inventory`, `site_inventory_movements`, `product_resource_links`, `product_images`, `product_image_annotations`, `media_assets`, `site_page_views`, and `order_items`.
- Dashboard/reporting now also leans on duplicate-media counts and product build-risk calculations derived from existing tables rather than new schema additions.


## Current pass schema note
- No new tables were required in this pass.
- This pass extended the use of existing product/resource/media tables by exposing richer reservation and product-detail payloads rather than adding new schema objects.


## Current pass additions
- `products.capture_reference` stores a temporary phone-first intake identifier for partial product drafts.
- `movie_catalog` now supports `imdb_id`, `alternate_identifier`, `metadata_status`, and `collection_notes` so admin can curate or review movie metadata directly in D1.


## Current pass schema note

### movie_catalog
Current practical role:
- manual/admin overlay table for movie metadata edits
- not yet the primary authoritative source for the live movie shelf

Important compatibility note:
Older databases may have an early `movie_catalog` shape that is missing later columns such as:
- `imdb_id`
- `alternate_identifier`
- `metadata_source`
- `estimated_value_low_cents`
- `estimated_value_high_cents`
- `estimated_value_currency`
- `rarity_notes`
- `collection_notes`
- `value_search_url`
- `original_title`

Admin movie write routes should therefore ensure column compatibility before insert/update operations.

### products partial-intake note
Products now need to support a real partial-draft intake path for phone-first capture and CSV-first bulk entry. Publish-time validation can remain stricter, but early draft-save validation must stay light.


## Pass 16 additions
- `membership_tier_policies`: member-facing Bronze/Silver/Gold descriptions, benefits, visibility, and badge styling.
- `general_ledger_accounts`: starter chart of accounts for operating costs and sales grouping.
- `accounting_expenses`: operating expenses such as electricity, water, gas, rent, internet, software, and advertising.
- `accounting_writeoffs`: damaged, obsolete, gifted, lost, or other write-off events.
- `product_costs`: point-in-time per-unit cost entries used to grow toward fuller cost-of-goods and profit-and-loss reporting.


## Current pass addendum
- Fixed the Members department so Access Tiers render as a visible standalone interface instead of only a hidden modal dependency.
- Rewired Tier Policy admin/member JSON contracts so the admin editor and member account views use the same DB-backed field names.
- Strengthened the Accounting department with visible starter forms plus month-end, quarter-end, and year-end CSV export presets.
- Added a new phone-first Admin Dashboard at `/admin/mobile/` with Today, Quick Add, receiving, and export-oriented shortcuts.
- Continued moving the admin shell toward dashboard-style department buttons instead of long scroll-heavy interfaces.


## accounting_overhead_allocations
Monthly overhead allocation rows used to move real operating costs like rent, hydro, gas, water, and internet into a rough P&L view and later into fuller cost allocation logic.


## Current pass note
- No new table was added in this pass.
- Estimated item costing uses existing `product_costs`, `product_resource_links`, `site_item_inventory`, and `accounting_overhead_allocations`.

## Current pass addendum
- `accounting_expenses` remains a real-dollar table (`amount`, `tax_amount`) rather than a cents table. Repo code must convert to cents only at reporting time.
- `accounting_writeoffs` likewise remains a real-dollar table (`amount`) and should be treated the same way in rough P&L/reporting code.
- `product_costs` currently keys product costing by `product_number` and stores `cost_per_unit` as a real-dollar amount. Costing/reporting code should not assume `product_id` or `cost_per_unit_cents` in this table.
- Added supporting indexes for `accounting_expenses`, `accounting_writeoffs`, `product_costs`, and `accounting_overhead_allocations` so the phone dashboard and accounting overview can query the current schema more reliably.

## 2026-04-10 deploy hotfix

- Fixed a Cloudflare Pages build blocker in the accounting CSV export helpers by replacing the regex-based CSV quoting check with a simpler string-contains check.
- This hotfix does not change the database shape. Schema files remain current for this pass because no SQL migration was required.

## Current pass schema note
- Added `catalog_items` lookup indexes for centralized public catalog reads: `idx_catalog_items_public_sort` and `idx_catalog_items_grouping`.
- `database_upgrade_current_pass.sql` now includes unified-catalog support creation/index statements so older environments can safely move toward the same public catalog lookup path.



## Current pass update - runtime and fallback hardening
- Added `runtime_incidents` for lightweight server-side fallback/error visibility when public catalog reads or admin summary reads drift.
- New columns tracked: `incident_scope`, `incident_code`, `severity`, `endpoint_path`, `request_method`, `message`, `details_json`, `related_user_id`, `ip_address`, `user_agent`, and `created_at`.
- This table is intentionally simple and operational. It is meant for fast incident review, not a full observability platform.
- Public tools, supplies, and creations endpoints now expose `fallback_used`, `summary.authority`, and `diagnostics.warnings` so pages can stay usable while clearly signaling fallback mode.

## Current pass note
- No new table was required in this pass. The new runtime-incident review endpoint (`/api/admin/runtime-incidents`) reuses the existing `runtime_incidents` table that was added in the prior fallback-hardening pass.
- Current fallback coverage now depends on both server-side `runtime_incidents` logging and client-side last-good snapshot storage on the shop, movie shelf, social hub, and phone dashboard.

## Current pass note

`runtime_incidents` now has an additional `(incident_code, endpoint_path, created_at)` index so the admin fallback/error trail stays queryable as order/payment incident coverage expands.


### runtime_incidents
Stores fallback and error events from public/admin paths. Current write-path coverage now includes order-status updates, manual payment records, and refund/dispute follow-up warnings.

## Latest pass update

- Added `admin_pending_actions` as the shared cross-device replay queue for failed admin writes.
- Key columns include `client_action_id`, `action_scope`, `order_id`, `endpoint_path`, `http_method`, `payload_json`, `queue_status`, `attempt_count`, and replay timing fields.
- Matching indexes now cover client-action dedupe and queue/order status lookup paths.

## Current pass update
- Added `idx_admin_pending_actions_scope_status` so shared pending admin actions can be filtered and reviewed by action scope more efficiently.
- `admin_pending_actions` should now be read as the shared replay queue for both order/payment writes and product review/publish writes.

## Current pass completion update
- Added `accounting_overhead_product_allocations` so monthly overhead can now be assigned directly to specific products by ledger code instead of relying only on pool-wide share logic.
- Added a rough journal foundation with `accounting_journal_entries` and `accounting_journal_lines`, plus `/api/admin/accounting-journal` to sync and review month-level double-entry style bookkeeping.
- Expanded shared replay coverage from order/payment and product review into product edit/update failures through the same `admin_pending_actions` queue, with browser-local storage kept only as the last safety net.
- Strengthened the public movies API merge logic so D1 overlay rows can match JSON rows by UPC, slug, or title/year instead of only one identifier path.
- Updated the phone dashboard and accounting overview to show journal health, explicit overhead overrides, and queued product-edit actions more honestly.

## Current pass note
- Catalog migration sync now accepts both `collections` and legacy `item_kinds` payloads for maintenance/reseed use after the completed full migration.
- Tool, supply, and featured creation syncs continue to upsert into `catalog_items`.
- Movie sync now upserts into `movie_catalog` so hybrid JSON + D1 movie authority can move forward without crashing `catalog_items`.
- The admin catalog sync tooling now remains maintenance-only. The main Catalog department page no longer shows the migration panel after the successful full sync run, but the backend route is still available for maintenance or reseed recovery.

## Current Pass Note — 2026-04-12

- Movie catalog sync was changed from one-row-at-a-time D1 writes to chunked `db.batch(...)` upserts so large movie imports stay under the Worker invocation API-request ceiling.
- `/api/admin/products` was hardened to detect optional table availability and fall back to a simpler products query instead of failing the full admin page with a 500 during staged migration.
- `_headers` now explicitly allows `https://static.cloudflareinsights.com` in `script-src` so the Cloudflare Insights beacon is no longer blocked by the current CSP.
- The initial catalog migration has now been run successfully for Tools, Supplies, Movies, and Featured Creations. The everyday admin catalog sync panel was retired from the main Catalog page, while `/api/admin/catalog-sync` remains available for maintenance or reseed work. Movies still remain hybrid on the public read path while D1 overlay parity continues.


- Current pass: the main Catalog admin page no longer shows the day-to-day migration panel after the full D1 catalog sync completed successfully. The sync route remains available only for maintenance or reseed recovery, and the docs now treat catalog migration as completed rather than an active daily admin step.

## Current pass update — 2026-04-12

- `app_settings` now carries `site.catalog.product_number_start = 1000` as the default DD-series starting point for finished products.
- Product entry code now reads this setting when available and safely falls back to `1000` for older databases that have not yet been upgraded.
- Schema and upgrade SQL should keep this setting seeded so mobile and desktop product creation stay aligned.


## Current pass schema status
- No brand-new required tables were added for the bulk price-adjustment pass.
- Product price adjustments continue to use the existing `products` table (`price_cents`, `compare_at_price_cents`, `product_category`, `updated_at`).
- `app_settings` remains the place for repo-wide catalog defaults such as `site.catalog.product_number_start`.
- This pass was mainly code-path hardening and admin workflow expansion rather than a structural D1 migration.

## 2026-04-13 pass update
- Repaired the phone capture next-number display so the admin UI now shows `DD1000`-style labels instead of a bare numeric value when the next product number is loaded.
- Restored stronger public social discovery by adding the Socials route back into the shared navigation/footer and hydrating the footer profile list from `/api/social-feed` instead of keeping another hard-coded duplicate set of links.
- Added a catalog-side **Brand, Socials & Creations** helper so reusable brand images can be uploaded as standalone brand assets and the current public social links can be verified from admin.
- Confirmed that public gallery and creations are still fed through the finished-product plus catalog-sync flow; a fully separate creations-only editor remains a next-step item rather than a completed interface.

## Current pass note
- No new tables were required in this pass.
- Existing `site_item_inventory` and `site_inventory_movements` structures now support bulk unit-cost changes through new API/frontend logic rather than schema expansion.
- `site_inventory_movements.movement_type` is now also used for `cost_update` entries written by the new bulk inventory cost workflow.

## Pass 20 note — mobile capture compatibility repair
- Repaired the phone capture save path so it no longer hard-fails when the live `products` table is missing newer mobile-capture columns such as `capture_reference`.
- The mobile save endpoint now checks the live table columns first and only writes optional mobile fields that actually exist in the current database.
- The mobile drafts endpoint now also tolerates missing optional product columns so older partially-migrated databases can still load saved drafts instead of failing on select/search.
- Follow-up priority: run the current schema upgrade on production so mobile capture can use the full metadata set, but the app now degrades safely until that migration is finished.

## Current Pass Note — 2026-04-14
- Added approval-required field guidance to the mobile product capture flow, with green outlined required fields for approval readiness.
- Approval-required checks now update live for name, category, price, first photo, short description, SEO title, and SEO meta description.
- Product approval is now blocked until storefront readiness passes, and the admin products table disables Approve/Publish until required fields are complete.


## Current Pass Note — 2026-04-15
- Added an admin dropdown manager for product categories, colours, shipping codes, and tax codes so these lists can now be maintained without code edits.
- Phone product bootstrap now reads dropdown option sets from `app_settings`, while tax classes continue to come from the `tax_classes` table.
- Product resource search now includes inventory-only tools and supplies, so materials like wax can appear even before a matching `catalog_items` row exists.
- Product resource links now support `per_unit`, `end_of_lot`, and `story_only` inventory-use modes.
- `end_of_lot` is intended for materials such as wax, resin, clay, or similar lot/container supplies where one inventory lot can cover many finished products.
- Cost rollups, product stock math, and resource shortage checks now account for end-of-lot usage, while automatic reserve/release skips those links so inventory is not consumed one finished product at a time.
- Follow-up priority: surface the same dropdown-managed values in every desktop create/edit product form once the full desktop editor is consolidated into one stable screen.


## Current pass note — 2026-04-16
- Wired the admin dropdown manager so categories, colours, shipping codes, and tax codes are now accessible from the Products and Catalog admin pages after admin auth resolves.
- Added inventory usage-unit support for backend costing: each stock item can now define a usage unit label such as cup, wick, gram, or spool, plus how many usage units exist in one stock unit.
- Product resource links now save inventory mode details consistently across desktop resource linking and phone capture drafts: per product, end of lot, and story only.
- End-of-lot and cost/buildable calculations now use usage-unit math so supplies such as wax, wicks, resin, clay, and PLA can contribute to pricing and planning without forcing per-item depletion when the lot should be consumed manually.
- Remaining next-step focus: surface these same usage-unit fields in every remaining desktop product edit path and keep tightening margin warnings / repricing suggestions from the new cost model.

---

## Current Pass Update — 2026-04-17

This pass added and/or stabilized:
- a modern mobile navigation drawer for phone layouts, replacing the plain stacked menu list with a toggle + panel pattern
- an admin customer engagement dashboard for wishlist demand, back-in-stock requests, checkout recovery leads, gift cards, and reviews/testimonials
- public/member review and testimonial collection flows, plus approved product review display on product pages
- checkout recovery lead capture, gift-card validation during checkout, and notification outbox support for checkout recovery, gift card issue, and review request emails
- recommended-price suggestion actions that can now load pricing into the product editor and apply pricing live

Public-page verification completed this pass:
- public `index.html` routes were rechecked and continue to return one H1 per exposed page

Roadmap emphasis after this pass:
- finish the admin side for processing engagement queues at larger scale
- add storefront wishlist / favorites UI surfacing beyond the member area
- expand testimonial display onto Home, Gallery, and About
- continue pricing write-back and margin-warning refinement inside the main product edit workflow
- keep schema compatibility hardening in place for older live D1 tables before assuming newer columns

## Current pass update: customer engagement workflow depth, gift-card recipient support, and storefront testimonial placement
- Customer engagement admin now supports larger queue handling for back-in-stock requests, abandoned checkout recovery leads, review/testimonial moderation, and recent order review-request email queuing.
- Gift cards now support purchaser and recipient as separate people in the data model and admin issuance flow.
- The main product editor now accepts live price-suggestion write-back with clearer landed-cost and target-margin warnings before save.
- Featured testimonials are now designed to surface beyond product detail pages so storefront trust signals can appear on broader public pages.
- Current schema intent for this pass includes gift-card purchaser/recipient fields and no change to the one-H1 rule on public pages.

## Pass 29 - footer socials, engagement depth, and editor price write-back
- Restored footer social visibility with static links plus live social-feed hydration and local JSON fallback.
- Deepened the admin customer engagement board with filters, bulk gift card actions, and notification retry controls.
- Added direct price-preset write-back buttons inside the main product editor pricing insight card.
- Gift cards continue to support purchaser and recipient as separate people, with stronger admin resend/activate/deactivate workflow.
- Next recommended direction after this pass: storefront gift-card purchase flow, richer testimonial placement, and engagement queue automation polish.


## Current pass note (Pass 30)
- Added storefront gift-card purchase UX from the shop into checkout with purchaser and recipient fields.
- Storefront gift-card purchases now create `pending_activation` gift cards tied to the order so purchaser and recipient can be different people without auto-issuing unpaid cards.
- Expanded featured testimonial placement onto more public templates.
- Added automated engagement processing from the admin board for back-in-stock, recovery, review requests, and notification dispatch.
- Added stronger publish-readiness and photo-completeness scoring before publish, including photo-count warnings and image scoring in admin.
