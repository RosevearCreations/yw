# AI Context



## Current pass snapshot

- Dropdown manager is wired on admin catalog/products for categories, colours, shipping codes, and tax codes.
- Inventory now speaks in both stock units and usage units.
- Resource linking now gives more operator-facing feedback for batch materials and end-of-lot planning.
- Public trust/conversion improvements should now be guided by the new craft-commerce benchmark notes.

## Current pass update

- Repaired the phone product-capture save route so it resolves the shared D1 binding through `DB` or `DD_DB` instead of assuming one binding name.
- The mobile save endpoint now returns structured JSON failures and records a runtime incident when the save path breaks unexpectedly.
- The phone product-capture page now parses failed responses safely, so HTML 500 pages no longer surface as `Unexpected token '<'` in the admin UI.
- Rechecked outward-facing HTML pages and the one-H1 rule remains intact across the current public page set.

## Current phase

This repo is in the payment, media, inventory, and public SEO hardening phase after the main storefront, auth, and admin foundations were already built.

## Important truths right now

- orders are created before payment handoff
- PayPal is a redirect, return, and webhook flow
- Stripe is now a hosted checkout and webhook flow
- webhook events are stored in `webhook_events` for idempotency and manual replay queueing
- product media is managed through ordered `product_images` plus `product_image_annotations`
- direct uploads now go into R2 and can be browsed from `media_assets` in admin
- local refund and dispute records now live in `payment_refunds` and `payment_disputes`
- inventory records now track reserved, incoming, supplier, and cost fields
- inventory changes now also write to `site_inventory_movements`
- public-facing pages are expected to maintain a one-H1 rule and a complete metadata baseline
- public search awareness now includes sitemap, robots intent, structured data, and the `/search/` page

## Best next priorities after this pass

1. webhook worker and scheduler hardening
2. provider-confirmed refund and dispute sync
3. richer media library management with variants, thumbnails, and replace flow
4. deeper inventory movement history UX and automation
5. dashboard and reporting polish
6. keep improving crawl, metadata, and search-awareness coverage each pass

## Files that matter most for the new pass

- `functions/api/checkout-prepare-payment.js`
- `functions/api/paypal-webhook.js`
- `functions/api/stripe-webhook.js`
- `functions/api/admin/webhook-events.js`
- `functions/api/admin/payment-actions.js`
- `functions/api/admin/media-upload.js`
- `functions/api/admin/media-assets.js`
- `functions/api/admin/site-item-inventory.js`
- `functions/api/site-search-event.js`
- `functions/sitemap.xml.js`
- `public/js/admin-product-images.js`
- `public/js/admin-webhook-events.js`
- `public/js/admin-site-item-inventory.js`
- `public/js/site-search.js`
- `database_payments_extension.sql`
- `database_growth_analytics_seo_extension.sql`
- `database_full_schema.sql`
- `database_upgrade_current_pass.sql`


- Shared layout currently depends on `main.js` for nav/footer and `site-auth-ui.js` for the floating account widget.
- Logged-out recovery links point to `/account-help/`, which records requests in `auth_recovery_requests`.


- Shared auth/session fixes should preserve sign-in visibility across admin and outward-facing pages.
- Keep the one-H1 rule intact on outward-facing pages while continuing incremental SEO/crawl improvements each pass.
- Shared footer and account widget are baseline layout requirements now.


- Current migration strategy: Tools, Supplies, and Featured Creations now have their seeded D1 catalog authority in place, while public pages keep graceful fallback behavior. Movies are seeded into D1 as well, but public movie reads remain hybrid until D1 parity is explicitly signed off.
- Current product import strategy: CSV-first mass upload with image fields optional during import.


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


## Current pass reminders

- Do not restore the movie catalog to the old placeholder `/assets/movies/...-front.jpg` sample paths; use the uploaded R2-backed enrichment JSON.
- Maintain the relationship between finished products and linked tools/supplies because it supports future storytelling, social content, and build-history features.


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


- Current pass added admin audit visibility and light recovery throttling; future security passes should build on those instead of duplicating them in parallel tables or logs.


Current-pass emphasis:
- Payment admin flow now attempts provider refund sync where possible.
- Inventory API now supports action-specific mutations and improved ledger notes.
- Product readiness is now a first-class admin concern.
- Notification outbox is now present for later email/SMS delivery work.



## Current pass update
- Stripe Checkout now has a dedicated return-finalize endpoint at `/api/stripe-return`, and the confirmation page calls it automatically when `session_id` is present.
- Stripe webhook handling now confirms and upserts local dispute records for `charge.dispute.*` events.
- `notification_outbox` is no longer queue-only; there is now a dispatch helper plus admin endpoint for queued/retry delivery.
- Shared admin step-up password confirmation now protects destructive actions.
- Public creations now load through `/api/creations` first so finished-creation reads can keep moving away from scattered JSON-only page logic.
- Production receipt and recovery delivery now expect mail credentials such as `RESEND_API_KEY` and `NOTIFICATION_FROM_EMAIL`.

## Current pass update
- Added governed product review actions at `/api/admin/product-review-actions` so approve, needs-changes, publish, and unpublish are now explicit audited operations instead of only status edits.
- Added `product_review_actions` as the durable review log for draft-to-publish governance.
- Added `/api/admin/product-cost-rollups` and expanded the product list so linked tools/supplies now surface estimated build cost, missing cost links, and rough margin visibility.
- Added supplier purchase-order draft support with `supplier_purchase_orders` and `supplier_purchase_order_items`, plus `/api/admin/purchase-orders` for grouped reorder workflow.
- Inventory responses now include supplier-grouped reorder suggestions so reorder work can move toward a more governed D1-first path.
- Visitor analytics now expose top referrers, top entry paths, and zero-result site searches to improve discovery and merchandising diagnostics.



## Current pass update
- Public tools and supplies now prefer centralized `/api/tools` and `/api/supplies` read paths with JSON fallback during migration.
- Gallery and creations now prefer centralized API reads instead of depending only on direct items-for-sale JSON reads.
- Supplier purchase orders now support ordered-to-incoming and received-to-on-hand inventory automation with per-line received quantity tracking.

- Product-level inventory reservation now has a shared admin action path so linked tools/supplies can be reserved or released together during build/publish prep.
- Public tools, supplies, and creations APIs now expose filter-group summaries for category/type discovery improvements.
- Mobile product bootstrap now uses the shared admin auth helper and corrected inventory reorder fields to avoid false bootstrap failures.


## Current pass update
- Admin refund/dispute actions now try to dispatch queued receipt emails immediately instead of relying only on later outbox processing.
- Stripe webhook reconciliation now queues and attempts provider-confirmed customer notices for refund/dispute events when customer email is present.
- `/api/products` now exposes `filter_groups` for category, colour, and product type discovery.
- Public tools and supplies pages now read through `/api/tools` and `/api/supplies` instead of the broader generic catalog endpoint, reducing another outward-facing duplication path.
- No new schema tables were required in this pass; the work used existing payments, notification, catalog, and storefront tables.

## Current pass update
- Bulk product import now validates and seeds newer finished-product fields more fully: product number, category, colour, shipping code, review status, SEO rows, tags, and extra product images can all be staged during import.
- Direct admin media upload can now attach an uploaded image directly into `product_images`/`product_image_annotations`, optionally set it as featured, and carry a simple variant-role note so the R2 upload path is more reusable across product-entry workflows.



## Current pass update
- Admin stock reporting now supports batch reserve/release actions for linked product resources from the frontend, not only the inventory API.
- Storefront product detail now includes grouped image data with variant-role awareness and annotated-image grouping.
- Admin media asset reads now expose derived variant URL suggestions to support later thumbnail/variant rollout.
- Visitor analytics now surface top product-detail paths and top ordered products for better merchandising diagnostics.
- Public supplies and tools-health reads now lean more consistently on centralized API authority instead of direct page-level JSON reads.


## Current pass update
- Admin product list now exposes reserve/release actions for linked product resources, extending reservation governance beyond the stock-report-only path.
- The public toolshed page now depends on `/api/tools` as its main authority path instead of chaining through multiple direct JSON fallbacks.
- Storefront product detail now returns `build_summary` and lightweight `variant_urls` hints for each image so later media-variant rollout has a cleaner contract.


- Current pass update: mobile finished-product capture now allows partial draft intake with a `capture_reference`, so one photo or temporary identifier is enough to save a draft and continue.
- Current pass update: admin now has a movie catalog detail editor backed by `movie_catalog` for title/year/actor/UPC/IMDb-id/manual-note editing.
- Current pass update: `/data/finished_products_import_template.csv` is now the detailed CSV template for bulk finished-product uploads.


## Current pass update
- Movie workflow is now explicitly JSON-first again: `data/movies/movie_catalog_enriched.v2.json` remains the movie base truth for the public shelf and admin listing.
- D1 `movie_catalog` is now treated as a manual edit overlay for movie details rather than the primary source of truth. This lets admin add missing title, year, actor, director, UPC, metadata-source, rarity, value, and notes fields without breaking the live movie shelf.
- The movie admin editor is expected to show front and back covers plus the richer metadata already present in the JSON rows, then allow manual edits on top of those fields.
- The movie save route now needs to harden old-table compatibility by ensuring late-added columns such as `imdb_id`, `metadata_source`, value fields, and notes fields exist before writes.
- Mobile finished-product capture now needs to preserve a true partial-draft workflow: photo-only, name-only, or reference-only records must be savable without the later mandatory publish fields.
- A detailed finished-product CSV template is now a repo requirement so most completed products can be imported in bulk while partial rows can still enter as draft records.

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
- The repo currently favors a lighter Admin launcher plus department pages.
- Mobile-first quick actions are being moved upward so the phone dashboard can handle more real daily use without loading long desktop-oriented screens.


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
- Treat `/admin/mobile-product/` as the primary phone-first draft intake and draft-continuation workflow.
- Treat `/api/admin/accounting-item-costing` as the current rough full-unit-cost reporting source.

## Current pass addendum
- Fixed a live accounting schema/code drift: monthly rough P&L now reads the real `amount` / `tax_amount` fields from `accounting_expenses` and the real `amount` field from `accounting_writeoffs` instead of non-existent cents columns.
- Fixed the estimated item-costing source so it now matches the real `product_costs` table shape (`product_number` + `cost_per_unit`) before blending in linked-resource cost and allocated overhead.
- Mobile product draft continuation is stronger because saved SEO fields now reload with the draft and updated drafts stay open in the same phone screen after save.
- The phone dashboard now includes a live month snapshot for revenue, overhead, costing warnings, and draft-product visibility without forcing a jump to the full accounting page.

## 2026-04-10 deploy hotfix

- Fixed a Cloudflare Pages build blocker in the accounting CSV export helpers by replacing the regex-based CSV quoting check with a simpler string-contains check.
- This hotfix does not change the database shape. Schema files remain current for this pass because no SQL migration was required.

## Current pass context note
- Public tools and gallery/creations pages moved further toward centralized API reads (`/api/tools`, `/api/creations`) instead of page-level direct JSON fetches.
- Phone admin now includes open accounting snapshot cards for paid, outstanding, and tax-liability visibility.
- `accounting-summary` now shares the common accounting schema helper to reduce drift.

## Current pass completion update
- Added `/api/social-feed` as the public authority path for social profile/video feed reads.
- Added browser snapshot fallback on shop, movies, socials, and phone dashboard so public/admin continuity is safer during live endpoint drift.
- Added `/api/admin/runtime-incidents` for reviewing records stored in the existing `runtime_incidents` table.

## Current pass note

When continuing from this build, treat the admin orders area as partially hardened: list/detail/payment reads now prefer safe partial responses and browser snapshots, but write-path recovery still remains open work.

## Latest pass context

- Failed admin order/payment writes are no longer only browser-local. The repo now includes a D1-backed `admin_pending_actions` queue plus API endpoints for listing and updating queued actions.
- `public/js/admin-order-detail.js` should be treated as the current frontend authority for queue save/retry/dismiss behavior.

## Current pass update
- `/api/admin/accounting-item-costing` now uses the shared `_costing.js` engine so item costing reflects basis-aware overhead pools, sold-unit recognition, and rough recognized COGS instead of the older flat revenue-share-only view.
- The public social hub now returns derived YouTube thumbnail URLs and fallback candidates through `/api/social-feed`, and the browser renders thumbnail cards instead of relying on fragile iframe-only embeds.
- Shared `admin_pending_actions` queue coverage now includes product review actions from the catalog/products screen, with browser-local storage kept only as the last safety net.

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

- Treat `DD1000` as the minimum finished-product number for new product capture unless the database already has a higher product number.
- The shared product-number rule now applies to the phone-first capture flow and the standard admin create-product API.
- When older databases do not yet have the app setting row, runtime code must still fall back safely to `1000`.


## Current pass update
- Admin bulk product tooling now supports controlled price updates by selected product IDs, by product category, or across the full catalog.
- Bulk price changes can preview affected rows before save, which makes tariff, packaging, and broad selling-price revisions safer.
- The earlier bulk-tool risk where shipping/tax flags could be overwritten unintentionally during unrelated edits was corrected by switching those controls to explicit “No change / Yes / No” choices.
- Public exposed HTML pages were checked again and still keep the one-H1-per-page rule.

## 2026-04-13 pass update
- Repaired the phone capture next-number display so the admin UI now shows `DD1000`-style labels instead of a bare numeric value when the next product number is loaded.
- Restored stronger public social discovery by adding the Socials route back into the shared navigation/footer and hydrating the footer profile list from `/api/social-feed` instead of keeping another hard-coded duplicate set of links.
- Added a catalog-side **Brand, Socials & Creations** helper so reusable brand images can be uploaded as standalone brand assets and the current public social links can be verified from admin.
- Confirmed that public gallery and creations are still fed through the finished-product plus catalog-sync flow; a fully separate creations-only editor remains a next-step item rather than a completed interface.

## Current pass note
- Added a new admin endpoint and frontend path for bulk unit-cost updates on `site_item_inventory`.
- Selection scope now covers selected inventory ids, category, source type, or the entire site inventory.
- The workflow includes preview-before-apply, audit logging, and movement-note logging for tariff, shipping, packaging, or supplier cost changes.

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

## Current pass — inventory operations, pricing suggestions, and retention groundwork
- Strengthened the tools and supplies inventory console so daily stock work can now be handled from the main table with receive, reserve, release, consume, reorder-request, delete, and load-into-form actions.
- Kept the stock-unit / usage-unit model active for batch materials so wax, wicks, PLA, and similar inputs can be tracked as lots instead of only as one-item-per-finished-product deductions.
- Added admin product price suggestions using linked resource cost, manual unit-cost snapshots, packaging pressure, shipping pressure, and overhead assumptions.
- Added member wishlist groundwork plus public back-in-stock request capture so retention can begin moving beyond basic account/order history.
- Extended the public product page maker-story block so shoppers can see stronger build context, usage mode, stock-unit interpretation, and clearer trust signals.
- Development roadmap and known-gap follow-up should continue from: inventory operator polish, wishlist/back-in-stock admin review tools, recommended-price write-back, and richer public trust/review layers.

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
