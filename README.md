# Devil n Dove Website


## Current pass update

- Repaired the phone product-capture save route so it resolves the shared D1 binding through `DB` or `DD_DB` instead of assuming one binding name.
- The mobile save endpoint now returns structured JSON failures and records a runtime incident when the save path breaks unexpectedly.
- The phone product-capture page now parses failed responses safely, so HTML 500 pages no longer surface as `Unexpected token '<'` in the admin UI.
- Rechecked outward-facing HTML pages and the one-H1 rule remains intact across the current public page set.

Devil n Dove is a public website, storefront, member area, and admin management system for the workshop.

## Current state

The current build includes:

- public storefront and product detail pages
- member login, registration, account tools, orders, and downloads
- admin dashboard for users, products, orders, analytics, inventory, SEO, notifications, and media
- checkout and order creation
- PayPal handoff, PayPal return capture, and PayPal webhook reconciliation
- Stripe hosted checkout preparation and Stripe webhook reconciliation
- webhook event logging for provider idempotency and audit trail
- admin webhook review and safe replay queue controls
- live visitor/session analytics and historical website data by path and country
- product SEO fields, product image annotations, and product media workflow tools
- direct image upload endpoint for R2-backed product media
- uploaded asset browsing and delete actions in admin
- public site search page with structured data support and search-event logging
- shared footer-driven site search and crawl-discovery links on every page
- floating logged-in account widget available sitewide
- shared auth token persistence now uses localStorage plus a sitewide cookie fallback so public pages can detect active sign-in more reliably
- shared footer injection hardened so the footer remains visible across standard site pages
- admin dashboard layout pass with cleaner summary cards, more uniform inputs/tables, and a live activity feed
- account-help page for forgot-password and forgot-email request logging
- site inventory and reorder tracking for tools, supplies, and sellable products
- inventory movement history logging for stock changes
- local refund and dispute workflow logging for orders and payments
- live admin activity feed for recent searches, visitor sessions, cart events, orders, and webhook activity
- runtime incident logging now covers more admin order/payment write paths and surfaces them in the phone dashboard health view
- admin order detail now preserves failed order-status, payment, and refund/dispute writes locally for manual retry in the same browser

## Main payment status

Implemented now:

- order creation
- payment preparation
- PayPal redirect handoff
- PayPal return capture
- PayPal webhook reconciliation endpoint
- Stripe Checkout session creation
- Stripe webhook reconciliation endpoint
- webhook event storage for duplicate-event safety
- admin manual payment recording
- admin webhook review and requeue controls
- refund and dispute local tracking tables and admin actions

Still to deepen later:

- actual provider-side refund execution and sync-back confirmation
- provider dispute evidence upload and response workflow
- webhook worker retry scheduling beyond manual replay queueing
- optional Stripe customer portal and saved customer records later

## Main product and media status

Implemented now:

- create, edit, archive, and delete products
- bulk update products
- import preview and import tools with duplicate slug checks
- product SEO editor
- product image annotation editor
- product image workflow editor for ordered images, alt text, captions, focal points, and featured image sync
- direct admin upload endpoint for product images to R2
- uploaded asset library browsing and delete actions in admin
- storefront search page spanning products, tools, supplies, creations, and key pages
- inventory tracking on products and site inventory records
- inventory movement history foundation

## Public SEO and search policy now in force

For every future public-facing update:

- every outward-facing page must have exactly one H1
- no outward-facing page may ship without a title, meta description, canonical URL, and index/follow or noindex/follow decision
- social tags should exist for outward-facing pages: Open Graph and Twitter card tags
- public pages should use structured data where practical
- private utility pages such as login, register, cart, checkout, members, bootstrap, and health pages should stay `noindex`
- sitemap and robots.txt must be reviewed whenever public pages are added or removed
- search visibility and crawl awareness should be improved a little every pass, not treated as a one-time task
- every shared-layout pass should preserve the shared footer, shared account widget, and search-discovery links sitewide
- shared auth/session UI must remain consistent between admin and outward-facing pages so an active admin session is visible across the regular site too
- formatting passes should keep forms, tables, widgets, and dashboard cards visually consistent rather than page-specific

## Database files

- `database_schema.sql`
- `database_store_schema.sql`
- `database_access_tiers.sql`
- `database_payments_extension.sql`
- `database_profiles_extension.sql`
- `database_growth_analytics_seo_extension.sql`
- `database_full_schema.sql`
- `database_upgrade_current_pass.sql`
- `database_admin_seed_template.sql`

## Important endpoints

Auth:
- `/api/auth/register`
- `/api/auth/login`
- `/api/auth/logout`
- `/api/auth/logout-all`
- `/api/auth/me`
- `/api/auth/change-password`
- `/api/auth/session-info`
- `/api/auth/bootstrap-admin`
- `/api/auth/bootstrap-status`

Storefront and checkout:
- `/api/products`
- `/api/product-detail`
- `/api/checkout-create-order`
- `/api/checkout-prepare-payment`
- `/api/paypal-return`
- `/api/paypal-webhook`
- `/api/stripe-webhook`
- `/api/site-search-event`

Admin operations added or deepened in the recent passes:
- `/api/admin/live-activity`
- `/api/admin/webhook-events`
- `/api/admin/payment-actions`
- `/api/admin/media-assets`
- `/api/admin/site-item-inventory`
- `/api/admin/product-resources`
- `/api/movies`
- `/api/admin/import-products-preview`


## Current caution

JSON-backed collections still exist for some public sections such as tools, supplies, and creations. The site search works across them today, but a staged move of those collections into D1 would make future search, inventory, analytics, and admin tooling much stronger.


## Latest pass additions

- CSV-first mass upload workflow for products with a downloadable template. Required fields are `name`, `product_type`, and `price_cents`; `slug` is optional and auto-generated when omitted.
- Featured images remain optional during import and can be added later during product review before store-ready status is applied.
- Began staged D1 migration for tools, supplies, and featured creations through the new `catalog_items` table and admin sync tooling.
- Public search, tools, and supplies pages now prefer database-backed catalog items when available and fall back to JSON when a sync has not been run yet.


## SEO operating note

Public SEO passes should stay aligned with current Google Search guidance: strong title links, useful meta descriptions, one clear H1 per outward-facing page, crawlable canonicals/robots intent, and structured data that matches visible content.


## Current pass additions
- Session/auth now uses a stronger same-site continuity path: auth endpoints set a first-party `dd_auth_token` cookie in addition to returning the bearer token. Public pages can resolve the signed-in member/admin state more reliably.
- Added `movie_catalog` for staged migration of the legacy UPC-only movie JSON into D1. The public movies page now reads from `/api/movies`, which prefers D1 and falls back to `/data/catalog.json`.
- Catalog sync now supports movies in addition to tools, supplies, and featured creations.
- Public movie search UI now supports title, UPC, year, actor, and director fields when that data exists, while still working with legacy UPC-only data.
- Product CSV preview now renders as a structured validation table instead of loose JSON/text lines.


## Current pass update
- Movie catalog wiring now blends D1 `movie_catalog`, `/data/movies/movie_catalog_enriched.v2.json`, and the R2-hosted cover images more safely.
- Movie search now supports title, UPC, year, actor, director, genre, studio, format, and optional trailer-link filtering.
- `trailer_url` is now part of the movie enrichment path so trailer support can be stored directly when available.
- Storefront product detail now includes linked tools and supplies from `product_resource_links` so each finished product can tell a clearer “made with these materials and tools” story.
- Admin product-resource linking now supports usage notes for story-building and social-post context.
- Admin inventory can now sync tool and supply records from `catalog_items` into `site_item_inventory`, reducing duplicate maintenance between JSON, catalog, and inventory records.
- Continue the one-H1-per-exposed-page rule and continue improving page titles, descriptions, canonical tags, crawl paths, structured data relevance, and visible on-page content alignment on every outward-facing pass.


## Current pass highlights

- Replaced the sample movie enrichment file with the real R2-backed `movie_catalog_enriched.v2.json` so the movie page can resolve live front/back cover URLs instead of placeholder `/assets/movies` paths.
- Hardened `/api/movies` to blend D1, enriched JSON, and legacy rows more safely, including derived R2 cover fallbacks and trailer-search links when a stored trailer URL is not available yet.
- Added a new admin product stock report for finished products so the dashboard can show what is on hand, what is running low, and which linked tools/supplies are causing build-risk or reorder pressure.
- Tightened admin site inventory controls with filter views (`low`, `reorder`, `do_not_reuse`) and one-click sync buttons for tools and supplies from the D1-backed catalog sync layer.
- Continued the D1 relationship model for “how this was made” storytelling by keeping finished products linked to tools and supplies with usage notes for future social/story output.


## Current pass update

- Replaced the placeholder movie enrichment file with the uploaded R2-backed `movie_catalog_enriched.v2.json` so the public movie page reads real cover URLs.
- Hardened `/api/products`, `/api/admin/dashboard-summary`, `/api/admin/site-item-inventory`, `/api/admin/product-stock-report`, `/api/admin/visitor-analytics`, `/api/admin/live-activity`, `/api/admin/webhook-events`, and `/api/admin/catalog-sync` so incomplete seed data or partially-migrated tables return safe JSON instead of HTML error pages.
- Updated the movie page to render cover images from `/api/movies` and show richer metadata when it exists, while showing a clear enrichment-pending message when titles and credits are still blank in the source JSON.
- Product image annotations now default to a clean empty array UI instead of example JSON pasted into the textarea itself.
- SEO/search guidance remains aligned with Google Search Central guidance around clear title links, useful meta descriptions, JSON-LD structured data, and visible-content alignment. 


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


## Current pass update

- Rebuilt the public movie shelf layout with a dedicated card and pager structure so movie entries no longer collapse into unusable one-character columns.
- The movies page now uses the API paging metadata to show the real total catalog size, page number, page range, and next/previous navigation more honestly.
- Added a more defensive movie-specific CSS layer so future generic card/grid changes are less likely to break the movie shelf again.
- KNOWN_GAPS_AND_RISKS.md was rewritten to document the remaining payment, inventory, media, analytics, and metadata risks more clearly.


## Current pass highlights

- Admin action audit logging added for product, inventory, media, and webhook operations.
- Account-recovery requests now capture IP/user-agent and apply light abuse throttling.
- Webhook processing records now advance retry metadata more consistently.

## Current pass update

- Added provider-aware refund sync attempts for Stripe and PayPal in the admin payment workflow.
- Added `notification_outbox` as a durable local queue for refund/dispute receipt messages.
- Rewrote the admin inventory API to support create, reserve, release, receive, reorder-request, and catalog-sync operations with stronger movement logging.
- Expanded admin media controls with restore/replace metadata support and duplicate visibility.
- Expanded dashboard and visitor analytics with funnel-style metrics.
- Added product readiness checks so draft/publish workflow has clearer storefront-readiness signals.



## Current pass update

- Added `/api/stripe-return` for Stripe Checkout return reconciliation.
- Added `/api/creations` for centralized finished-creations reads.
- Added `/api/admin/notification-outbox` for queued-notification review, retry, cancel, and dispatch.
- Added shared admin password-confirmation step-up protection on destructive actions.
- Added Stripe dispute upserts from webhook events.

### Mail-related environment variables now expected for live delivery
- `RESEND_API_KEY`
- `NOTIFICATION_FROM_EMAIL`
- `NOTIFICATION_ADMIN_TO` or `ACCOUNT_HELP_REVIEW_EMAIL`

## Current pass additions
- Governed product review and publish actions
- Product build-cost rollups from linked tools and supplies
- Supplier purchase-order draft workflow
- Expanded analytics for referrers, entry paths, and zero-result searches



## Current pass update
- Public tools and supplies pages now have centralized API read paths (`/api/tools`, `/api/supplies`) with JSON fallback during migration.
- Purchase-order receiving can now apply ordered quantities into incoming stock and received quantities into on-hand stock.

- Added shared product-level inventory reservation/release actions for linked resource governance.
- Public `/api/tools`, `/api/supplies`, and `/api/creations` now include filter-group summaries for discovery/filter UX.
- Hardened `/api/admin/product-mobile-bootstrap` by switching it to shared admin auth and corrected inventory reorder fields.


## Current pass update
- Refund/dispute actions now attempt immediate queued receipt delivery when mail credentials are configured.
- Stripe webhook reconciliation now also queues and attempts provider-confirmed refund/dispute customer notices.
- `/api/products` now returns discovery-friendly filter summaries for category, colour, and product type.
- Public tools and supplies pages now consume their dedicated centralized APIs instead of the broader generic catalog endpoint.

## Current pass update
- Bulk product import is now more production-friendly: preview checks duplicate slugs, SKUs, and product numbers, and import can seed richer finished-product fields, SEO rows, tags, and extra product images.
- Admin media upload can now attach uploads directly to product galleries and optionally set the featured image, making the R2 upload flow more reusable during product-entry work.



## Current pass update
- Added frontend product-resource reservation controls in the admin stock report.
- Expanded storefront product detail media payloads with grouped image data and variant-role hints.
- Expanded analytics with top product page paths and top ordered products.
- Continued reducing public JSON duplication by moving more reads onto `/api/supplies` and `/api/tools`.


## Current pass highlights
- Added reserve/release linked-resource controls to the main admin products list.
- Moved toolshed discovery more firmly behind the centralized `/api/tools` authority path.
- Expanded storefront product detail to return build-summary context and lightweight image variant-url hints.


## Current pass additions
- `data/finished_products_import_template.csv` provides a detailed starter format for bulk finished-product uploads.
- `/admin/mobile-product/` now supports partial draft saves using `capture_reference` plus optional photos.
- Admin now includes a movie catalog editor backed by `/api/admin/movies`.


## Current movie workflow note
- The live movie collection currently remains JSON-first, with `data/movies/movie_catalog_enriched.v2.json` acting as the base truth.
- D1 `movie_catalog` is presently used as a manual overlay for edits and added metadata rather than a complete authoritative replacement.
- The admin movie editor should therefore load the JSON-backed movie card details first, then save manual updates into the overlay path.

## Current finished-product intake note
- Phone-first product capture must continue supporting partial drafts so workshop intake can happen quickly even when only a photo, temporary reference, or partial description is available.
- Bulk finished-product entry should use the detailed CSV template as the preferred mass-upload path for more complete product records.

## Current pass update
- Catalog sync now uses `movie_catalog_enriched.v2.json` for movie imports so repo-side sync matches the JSON-first movie source already used elsewhere.
- Schema references and upgrade SQL were aligned with the current movie overlay/editor fields and the governed review/reorder tables already present in the codebase.
- Exposed HTML pages were checked again and continue to keep a single H1 per page.


## Current pass addendum
- Marked the previous admin preview, products fallback, movie save, and accordion issues as completed/fixed in the documentation.
- Departmentalized Admin into standalone interfaces: Members, Catalog, Orders, Accounting, Analytics, Operations, and Movies, reducing the size and risk of the main dashboard file.
- Added real starter routes/UI for tier policy, general ledger accounts, expenses, write-offs, product unit costs, and monthly accounting CSV export.
- Added accounting templates (CSV + XLSX) so GL and month-end bookkeeping can be seeded faster.
- Continued mobile direction by making the lighter departmental pages easier to use on smaller screens than the former all-in-one Admin page.
- Continued JSON-to-DB convergence by moving tier policy and accounting records into D1-backed tables instead of temporary page-only assumptions.


## Current pass addendum
- Fixed the Members department so Access Tiers render as a visible standalone interface instead of only a hidden modal dependency.
- Rewired Tier Policy admin/member JSON contracts so the admin editor and member account views use the same DB-backed field names.
- Strengthened the Accounting department with visible starter forms plus month-end, quarter-end, and year-end CSV export presets.
- Added a new phone-first Admin Dashboard at `/admin/mobile/` with Today, Quick Add, receiving, and export-oriented shortcuts.
- Continued moving the admin shell toward dashboard-style department buttons instead of long scroll-heavy interfaces.


## Current pass note
This pass continued the lighter departmental admin shell, improved phone-first quick actions, and tightened accounting navigation with direct anchors for ledger, expense, write-off, cost, and export workflows.


## Current pass addendum
- Replaced the long phone Admin link list with a grouped tree-style mobile menu so the phone workflow uses collapsible sections instead of one uninterrupted list.
- Continued mobile-first workflow tuning by surfacing Today, quick expense, quick write-off, product cost, and export actions closer to the top of the phone dashboard.
- Continued docs/current-build synchronization for the present mobile-navigation and admin-usability pass.


## Current pass addendum
- Customer-facing home/shop flow was made friendlier and clearer on phone and desktop with stronger exploration sections and clearer action cards.
- Accounting moved forward with monthly overhead allocations and a rough net-after-overhead view in the accounting report so operating costs can start flowing toward fuller P&L reporting.
- Mobile admin moved forward again with a direct overhead-allocation shortcut from the phone dashboard.
- Schema and template files were updated for the new overhead allocation layer.


## Current pass note
- Added in-place mobile draft continuation for product capture.
- Added estimated item-costing reporting inside Accounting.
- Continued mobile-first admin quick-action refinement.

## Current pass note
- Corrected the accounting-reporting layer so rough P&L and estimated item costing now align with the actual current schema.
- Added a live month snapshot to the phone dashboard for revenue, overhead, costing warnings, and draft visibility.
- Improved mobile product continuation so saved SEO fields reload and updated drafts stay open in the same capture workflow.
- Continued public SEO tuning on key pages with stronger Southern Ontario / Canada copy and reinforced About/Contact structured data.

## 2026-04-10 deploy hotfix

- Fixed a Cloudflare Pages build blocker in the accounting CSV export helpers by replacing the regex-based CSV quoting check with a simpler string-contains check.
- This hotfix does not change the database shape. Schema files remain current for this pass because no SQL migration was required.

## Current pass update

- Public gallery and creations now rely on `/api/creations` instead of keeping another direct page-level JSON read path.
- Public tools now treat `/api/tools` as the page authority instead of fetching the legacy tools JSON file directly in the page.
- The phone admin dashboard now exposes open accounting-record count plus paid, outstanding, and tax-liability snapshot values for faster daily review.
- Schema/upgrade SQL now includes extra `catalog_items` lookup indexes to support centralized public catalog reads as D1 authority expands.

## Current pass completion update
- Added API-backed social feed reads plus last-good snapshot fallback for the shop, movie shelf, social hub, and phone dashboard.
- Added `/api/admin/runtime-incidents` for lightweight admin review of fallback/error records already stored in `runtime_incidents`.
- Strengthened `/api/products` and `/api/movies` diagnostics so operator-facing pages can degrade more honestly instead of failing silently.

## Current pass note

This pass hardens the admin orders area with partial API fallbacks, cached browser snapshots, and expanded phone health counts so order/payment work can continue during query drift instead of collapsing into a blank admin state.

## Latest pass update

- Added a shared replay queue for failed admin order/payment writes so status changes, manual payments, and refund/dispute actions can survive beyond a single browser.
- Browser-local saved actions still remain as the last fallback if the shared queue cannot be reached.
- Docs, schema files, and the phone dashboard were updated to reflect the new queue-health layer.

## Current pass update
- Added stronger public social-hub fallback by deriving YouTube thumbnails and rotating through fallback thumbnail URLs.
- Added shared replay coverage for failed product review actions in the admin products workflow.
- Upgraded rough item costing to use the shared costing engine so overhead basis and recognized rough COGS are more honest.

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

- Mobile product capture now treats the DD series as the authority for finished-product numbering, starting at `DD1000` when the catalog is empty or when older numbering is lower.
- Product-number generation is now shared between the mobile bootstrap, mobile save flow, and general create-product API so numbering does not drift between entry paths.
- The mobile capture screen now shows the next DD number more clearly and keeps default category/shipping choices available even if the bootstrap payload has a temporary problem.
- `offline.html` now carries a fuller fallback head block so the offline shell stays structurally consistent with the one-H1 / title / description / canonical discipline used elsewhere.


## Latest pass update

Implemented now:
- product price editing by individual item through the standard admin edit workflow
- bulk price adjustments by selected product IDs, by product category, or across the entire product catalog
- preview-first bulk repricing with optional compare-at handling for safer tariff/packaging-driven changes
- safer bulk controls so shipping and taxable flags only change when explicitly selected
- another public H1 audit pass with exposed pages still holding to one H1 each

Still to deepen later:
- bulk unit-cost adjustments on `site_item_inventory`
- margin-target or cost-delta-driven price automation

## 2026-04-13 pass update
- Repaired the phone capture next-number display so the admin UI now shows `DD1000`-style labels instead of a bare numeric value when the next product number is loaded.
- Restored stronger public social discovery by adding the Socials route back into the shared navigation/footer and hydrating the footer profile list from `/api/social-feed` instead of keeping another hard-coded duplicate set of links.
- Added a catalog-side **Brand, Socials & Creations** helper so reusable brand images can be uploaded as standalone brand assets and the current public social links can be verified from admin.
- Confirmed that public gallery and creations are still fed through the finished-product plus catalog-sync flow; a fully separate creations-only editor remains a next-step item rather than a completed interface.

## Current pass note
- Added bulk site-inventory cost update tooling in the admin catalog workflow.
- This makes it easier to handle tariff changes, packaging increases, and supplier cost changes without editing every supply or tool one by one.

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
