# Repo Base Guide


## Current pass update

- Repaired the phone product-capture save route so it resolves the shared D1 binding through `DB` or `DD_DB` instead of assuming one binding name.
- The mobile save endpoint now returns structured JSON failures and records a runtime incident when the save path breaks unexpectedly.
- The phone product-capture page now parses failed responses safely, so HTML 500 pages no longer surface as `Unexpected token '<'` in the admin UI.
- Rechecked outward-facing HTML pages and the one-H1 rule remains intact across the current public page set.

## Purpose

This repo runs the Devil n Dove website as:

- brand and public site
- storefront
- member area
- admin dashboard
- payment and webhook layer
- analytics and operations layer
- SEO and crawl-awareness layer

## Important folders

- `functions/api/` — Cloudflare API endpoints
- `functions/` — Cloudflare Pages Functions such as the sitemap
- `public/js/` — browser-side logic for auth, admin, checkout, analytics, and search
- `admin/` — admin dashboard page
- `checkout/` — checkout and confirmation pages
- `shop/` — storefront pages
- `search/` — public site search page
- `data/` — catalog and site JSON content
- `assets/` and `css/` — static design assets and styling

## Key current API groups

### Auth
Session-based user login and account controls.

### Storefront and checkout
Order creation, payment preparation, PayPal return, and provider webhooks.

### Admin
Products, users, orders, SEO, inventory, notifications, analytics, media upload, media library browsing, webhook review, and refund and dispute logging.

### Tracking
Visitor, cart, and search behavior logging.

## Database files to keep aligned

- `database_schema.sql`
- `database_store_schema.sql`
- `database_access_tiers.sql`
- `database_profiles_extension.sql`
- `database_payments_extension.sql`
- `database_growth_analytics_seo_extension.sql`
- `database_full_schema.sql`
- `database_upgrade_current_pass.sql`

## Cloudflare bindings and secrets expected now

### D1
- `DB`

### R2
- `PRODUCT_MEDIA_BUCKET`

### Variables and secrets
- `PUBLIC_SITE_URL`
- `PAYPAL_CLIENT_ID`
- `PAYPAL_SECRET`
- `PAYPAL_ENV`
- `PAYPAL_WEBHOOK_ID`
- `STRIPE_SECRET_KEY`
- `STRIPE_PUBLISHABLE_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `PRODUCT_MEDIA_PUBLIC_BASE_URL`
- optional `PRODUCT_MEDIA_BUCKET_NAME`

## Public SEO rule of thumb

When a public page is touched, review:

- exactly one H1
- title and meta description
- canonical URL
- Open Graph and Twitter tags
- robots intent
- sitemap impact
- whether the page should contribute to public search awareness


## Shared layout expectations

- `/js/main.js` owns shared nav and footer injection
- `/public/js/site-auth-ui.js` owns the floating account widget
- `/account-help/` provides logged-out recovery request entry points


## Shared layout and auth notes

- `/js/main.js` owns the shared nav and footer injection and now also ensures the standard auth/site scripts are present on normal pages.
- `/public/js/auth.js` is the shared client auth layer and now persists the session token with both localStorage and a sitewide cookie fallback.
- `/public/js/site-auth-ui.js` remains the shared account widget/nav visibility layer used by both the public site and protected areas.
- `/functions/api/admin/live-activity.js` provides the admin dashboard live feed using recent analytics, cart, order, and webhook data.


## New admin/data routes

- `/api/admin/catalog-sync` seeds tools, supplies, and featured creations from existing JSON into `catalog_items`.
- `/api/catalog-items` serves public unified catalog reads for tools, supplies, and featured creations.
- `/public/products-import-template.csv` is the mass-upload starter template for products.


## Current pass additions
- Session/auth now uses a stronger same-site continuity path: auth endpoints set a first-party `dd_auth_token` cookie in addition to returning the bearer token. Public pages can resolve the signed-in member/admin state more reliably.
- Added `movie_catalog` for staged migration of the legacy UPC-only movie JSON into D1. The public movies page now reads from `/api/movies`, which prefers D1 and falls back to `/data/
  - `/data/movies/movie_catalog_enriched.v2.json` is now the supported repo file for richer movie metadata, front/back cover URLs, summary, cast, director, and yearcatalog.json`.
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


## Current pass operational note

- The movie cover source of truth for public image URLs is now the uploaded `data/movies/movie_catalog_enriched.v2.json`, backed by public R2 URLs under the `movies/` prefix.
- Admin operators now have two inventory lenses: `site_item_inventory` for tools/supplies and the product stock report for finished-product readiness.


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


- `/functions/api/admin/audit-log.js` — read endpoint for recent privileged admin actions.
- `/functions/api/_lib/adminAudit.js` — shared helper for admin cookie/bearer auth resolution and audit logging.


New current-pass backend additions:
- `functions/api/admin/webhook-dispatch.js` — batch requeues due/failed webhook events with audit logging.
- `functions/api/admin/product-readiness.js` — returns storefront-readiness checks for a product.
- `notification_outbox` — durable local queue for receipt and operational message intents.



## Current pass endpoint additions

- `functions/api/stripe-return.js` — finalizes a Stripe Checkout session on customer return.
- `functions/api/creations.js` — centralized public finished-creations read path.
- `functions/api/admin/notification-outbox.js` — review and process queued notification delivery.
- `functions/api/_lib/notificationOutbox.js` — shared queue/dispatch helper for receipts and recovery notices.
- `functions/api/_lib/adminStepUp.js` — shared password-confirmation step-up helper for destructive admin actions.
- `functions/api/_lib/passwordHash.js` — shared password-hash verification helper.

## Current pass additions
- `/api/admin/product-review-actions` for governed review/publish flow
- `/api/admin/product-cost-rollups` for build-cost and rough margin visibility
- `/api/admin/purchase-orders` for supplier reorder draft workflow



## Current pass update
- Added public read endpoints: `/functions/api/tools.js` and `/functions/api/supplies.js`.
- Updated purchase-order handling so status changes can move inventory into incoming and on-hand states.

- `functions/api/admin/site-item-inventory.js` now supports product-level reservation/release actions across linked resources.
- `functions/api/admin/product-mobile-bootstrap.js` is part of the phone-first product entry path and now relies on shared admin auth helpers.


## Current pass update
- `functions/api/admin/payment-actions.js` now queues and attempts immediate customer receipt delivery for refund/dispute admin actions.
- `functions/api/stripe-webhook.js` now also queues provider-confirmed Stripe refund/dispute customer notices when a local order email is present.
- `functions/api/products.js` now returns product filter summaries for category/colour/type.
- `tools/index.html` and `supplies/index.html` now consume `/api/tools` and `/api/supplies` directly instead of the generic catalog-items endpoint.

## Current pass update
- `functions/api/admin/import-products-preview.js` now performs broader draft-import validation, including duplicate slug/SKU/product-number checks and validation for newer finished-product/SEO/image fields.
- `functions/api/admin/import-products.js` now seeds richer finished-product records, tags, SEO rows, and extra gallery rows instead of only minimal core product fields.
- `functions/api/admin/media-upload.js` now supports one-step attachment from R2 upload into `product_images` and `product_image_annotations`, including optional featured-image updates.



## Current pass update
- `functions/api/admin/product-stock-report.js` and `public/js/admin-product-stock-report.js` now form a fuller reservation-governance path from report view to inventory reservation action.
- `functions/api/product-detail.js` now shapes grouped storefront image data using product images, annotations, and media variant-role hints.
- `functions/api/admin/visitor-analytics.js` now adds merchandising diagnostics for top product-detail paths and top ordered products.
- `supplies/index.html` and `tools/health/index.html` now rely more directly on centralized public API reads.


## Current pass note
- `public/js/admin-products.js` now covers another reservation-governance path by calling `/api/admin/site-item-inventory` for product-level reserve/release actions.
- `toolshed/index.html` now relies on `/api/tools` as the primary discovery authority instead of direct JSON fallback chaining.
- `functions/api/product-detail.js` now returns `build_summary` and lightweight image `variant_urls` hints alongside grouped image/annotation data.


## Current pass additions
- `data/finished_products_import_template.csv` is the detailed CSV template for bulk finished-product imports.
- `functions/api/admin/movies.js` powers admin-side movie detail editing against `movie_catalog`.
- `public/js/admin-movie-catalog.js` mounts the movie catalog editor inside `/admin/`.


## Current repo guide update
- `data/movies/movie_catalog_enriched.v2.json` remains the current movie source-of-truth file for public reads.
- `functions/api/movies.js` should stay JSON-first with optional D1 overlay merge logic, not D1-first, until movie migration is explicitly signed off.
- `functions/api/admin/movies.js` is the manual movie overlay editor route and must remain backward-compatible with older `movie_catalog` table shapes.
- `public/js/admin-movie-catalog.js` should expose the richer movie-card editing view, including cover previews and existing JSON metadata, not just a minimal subset of fields.
- `data/finished_products_import_template.csv` is now part of the expected bulk finished-product workflow.

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

## Current pass note
- When continuing accounting work, do not assume cents-based expense/write-off tables. The current schema still stores those rows in real-dollar columns and reporting converts them as needed.
- When continuing product-cost work, do not assume `product_costs` is keyed by `product_id`; the current repo schema still keys that table by `product_number`.

## 2026-04-10 deploy hotfix

- Fixed a Cloudflare Pages build blocker in the accounting CSV export helpers by replacing the regex-based CSV quoting check with a simpler string-contains check.
- This hotfix does not change the database shape. Schema files remain current for this pass because no SQL migration was required.

## Current pass addendum
- `/tools/` now treats `/api/tools` as the page authority instead of directly loading the legacy tools JSON file in the page.
- `/gallery/` and `/creations/` now rely on `/api/creations` rather than carrying another page-level JSON-read path.
- `functions/api/admin/accounting-summary.js` now shares the central accounting schema helper so the accounting shadow table shape is not maintained in two places.

## Current pass completion update
- Public social data should now be loaded through `/api/social-feed` instead of direct browser reads from `data/site/social-feed.json`.
- Shop, movie shelf, social hub, and phone dashboard each keep a last-good client snapshot for fallback continuity.
- Runtime incident review now has a dedicated admin endpoint: `/api/admin/runtime-incidents`.

## Current pass note

The admin orders stack now has both server-side partial fallbacks and client-side cached snapshots. Future work in this area should preserve both layers instead of returning to single-point hard failures.

## Latest pass update

- New admin API files: `/functions/api/admin/pending-actions.js` and `/functions/api/admin/pending-actions-status.js`.
- New schema authority item: `admin_pending_actions` in the main schema files and current-pass upgrade SQL.

## Current pass note
- Treat `/api/social-feed` as the authority for YouTube thumbnail URLs and fallback candidates on the public social page.
- Treat `admin_pending_actions` as shared replay coverage for product review actions as well as order/payment writes.
- Treat `/api/admin/accounting-item-costing` as a thin endpoint over `_costing.js`, not as a separate standalone costing model.

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

Touched areas in this pass:
- `functions/api/admin/_product-numbering.js`
- `functions/api/admin/product-mobile-bootstrap.js`
- `functions/api/admin/mobile-create-product.js`
- `functions/api/admin/create-product.js`
- `public/js/admin-mobile-product.js`
- `admin/mobile-product/index.html`
- `offline.html`
- main schema/upgrade SQL files and handoff docs


## Current pass repo note
- `functions/api/admin/bulk-update-products.js` now handles scope-aware repricing by IDs, category, or all products.
- `public/js/admin-product-bulk-tools.js` now exposes preview-first repricing and safer no-change handling for shipping/tax flags.
- Public H1 counts were rechecked during this pass and remain within the one-H1 rule for exposed pages.

## 2026-04-13 pass update
- Repaired the phone capture next-number display so the admin UI now shows `DD1000`-style labels instead of a bare numeric value when the next product number is loaded.
- Restored stronger public social discovery by adding the Socials route back into the shared navigation/footer and hydrating the footer profile list from `/api/social-feed` instead of keeping another hard-coded duplicate set of links.
- Added a catalog-side **Brand, Socials & Creations** helper so reusable brand images can be uploaded as standalone brand assets and the current public social links can be verified from admin.
- Confirmed that public gallery and creations are still fed through the finished-product plus catalog-sync flow; a fully separate creations-only editor remains a next-step item rather than a completed interface.

## Current pass note
- New admin API file: `functions/api/admin/bulk-update-site-inventory.js`
- Updated frontend file: `public/js/admin-site-item-inventory.js`
- These files now own the new preview/apply bulk cost workflow for `site_item_inventory`.

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
