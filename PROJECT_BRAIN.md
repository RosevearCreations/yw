> Current pass update — current focus is accountant handoff quality first: statement imports, auto-match, exceptions, lock rules, export bundle v2, sales-tax worksheet, fixed assets, vendor statements, then later full variants/catalog depth.

> Current pass update — sanity pass focused on product-creation multi-colour support, a compact catalog inventory column, and clearer next-step prioritization around accountant handoff, reconciliation depth, catalog UX, and local-search discovery.

## Current pass update — 2026-05-03
- Added a DB-backed/admin-managed community-content layer for public `Events` and `Pickup` pages so local-market dates, pickup guidance, and sales-channel notes are no longer limited to hard-coded page copy.
- Added `community_events` and `pickup_profiles` plus admin operations controls, a public `/api/community-content` endpoint, and runtime-safe fallbacks when the DB is unavailable.
- Kept this pass aligned with local-search trust/discovery work by surfacing Southern Ontario / Tillsonburg / Oxford County pickup and market language through admin-managed public content while preserving one public H1 per page.

## Current pass update — 2026-04-29
- Added customer-engagement automation timing rules so review-request and checkout-recovery flows can store send-after thresholds, max-age windows, and status filters instead of relying only on hard-coded automation timing.
- Added public `Events` and `Pickup` pages plus stronger internal links from Home, Shop, Product, Collections, Marketplaces, About, and Creations so local buyers can understand market/event context, pickup questions, and support paths sooner.
- Kept this pass small on schema shape: one new automation-settings table plus doc/schema sync, while storefront discovery/trust work stayed page-level.

# Current pass snapshot — 2026-04-25

## Current pass update — 2026-04-28
- Added dedicated public `Collections` and `Marketplaces` pages so handmade work, vintage/collectible stock, hybrid/external listings, and pickup/support questions are easier to understand before a shopper opens one product.
- Expanded shared navigation/footer plus Home, Shop, About, Creations, and product-detail trust links so collection paths, provenance/condition guidance, and sale-channel explanations stay visible earlier in the browse flow.
- Kept this pass schema-light on purpose: no new required tables were added, but the schema reference files were refreshed to record that this pass is a discovery/trust/local-SEO storefront pass rather than a DB-shape change pass.

Accounting focus moved one slow layer deeper:
- vendor directory
- recurring expense rules
- monthly reconciliation review storage
- year-end close bundle foundation
- GIFI review actor/timestamp tracking

This is intentionally still a staged internal-accounting system, not a finished accountant export.

# Current pass update — 2026-04-24

- Most important new accounting facts for a fresh chat: `general_ledger_accounts` now has GIFI staging fields, `/api/admin/accounting-gifi-summary` exists, and `/api/admin/db-sanity` checks the live D1 table/column shape.
- Current caution: older databases may still need a controlled migration for the journal table shape if they were created before this pass.

# Project Brain


## Current pass update — 2026-04-24
- Added a real phone-first basic draft wizard to `/admin/mobile-product/` so quick entries can be saved with just name, short description, price, quantity, and 1 to 5 pictures.
- Added a same-day draft review table on the phone capture screen so today’s entries can be reopened individually or updated in bulk before the desktop cleanup pass.
- Added mobile-capture metadata on `products` (`capture_entry_mode`, capture actor ids, start/save timestamps) so today filtering and phone workflow history are less dependent on loose `updated_at` guesses.
- Kept SEO/local-search hygiene in the pass by preserving one clear public H1 per page, keeping prominent title/main-heading wording aligned, and tightening docs/schema sync around the new phone/accounting workflow.


## Current pass focus

- Inventory and costing language was clarified:
  - stock unit = what you buy/store/count
  - usage unit = what a finished product actually consumes
- Batch-material planning is now easier to read in the resource-link UI.
- The next business-facing layer should be recommended prices, stronger trust blocks, reviews/social proof, and better shopper retention tools.

## Current pass update

- Repaired the phone product-capture save route so it resolves the shared D1 binding through `DB` or `DD_DB` instead of assuming one binding name.
- The mobile save endpoint now returns structured JSON failures and records a runtime incident when the save path breaks unexpectedly.
- The phone product-capture page now parses failed responses safely, so HTML 500 pages no longer surface as `Unexpected token '<'` in the admin UI.
- Rechecked outward-facing HTML pages and the one-H1 rule remains intact across the current public page set.

## Core mental model

This repo is now a combined:

- public brand site
- ecommerce storefront
- member account system
- admin operations panel
- analytics and growth data layer
- payment and webhook processing layer
- product media upload and asset layer
- public SEO and search-awareness layer

## Important current architecture

### Auth
Uses `users` and `sessions` with bearer token auth.

### Commerce
Uses `products`, `product_images`, `product_tags`, `orders`, `order_items`, `order_status_history`, and `payments`.

### Profiles and tiers
Uses `user_profiles`, `access_tiers`, and `user_access_tiers`.

### Growth, SEO, monitoring, and search
Uses:

- `site_visitors`
- `site_visitor_sessions`
- `site_page_views`
- `site_search_events`
- `cart_activity`
- `app_settings`
- `notification_jobs`
- `notification_dispatch_logs`
- `product_seo`
- `product_image_annotations`
- `site_item_inventory`
- `site_inventory_movements`

### Payments, webhook, and media additions
Uses:

- `webhook_events`
- `payment_refunds`
- `payment_disputes`
- `media_assets`

## Key newer additions

- admin webhook review and requeue endpoint and dashboard tooling
- admin refund and dispute endpoint and order-detail UI foundation
- admin media asset browser and delete tooling
- public search page for products, tools, supplies, creations, and key pages
- sitewide public SEO refresh with one-H1-per-page enforcement target
- inventory model now includes reserved, incoming, supplier, and cost fields
- inventory movement history foundation for stock changes
- import preview now validates duplicate slugs and media URL format

## Where we are now

The platform is still in an integration and hardening phase.

Most important next layers after this pass are:

- webhook worker retry and replay execution
- provider-confirmed refund and dispute status sync
- richer media library management around uploaded R2 assets
- direct media replace, thumbnail, and featured-image suggestion flow
- deeper inventory operations and movement history UX
- funnel dashboards and analytics polish
- ongoing crawl, metadata, and public search-awareness improvements each pass


## Latest UX additions

- shared floating account widget across the site
- shared footer with search/discovery links on every page
- account-help page and request logging for forgot-password and forgot-email flows


## Latest pass focus

- Fixed shared session visibility between admin and the outward-facing site by adding cookie-backed client token fallback.
- Hardened shared nav/footer behavior so the footer stays visible on standard pages.
- Refreshed admin dashboard presentation and added a live activity feed driven by recent analytics/order/webhook data.


## Latest architectural note

- High-duplication workshop collections are beginning to move into D1 through `catalog_items`. This is the first stage toward unified search, analytics, inventory automation, and fewer JSON-only failure points.
- Product import now supports CSV-first mass upload with optional images at import time.


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


## Current pass update

- Movies now depend on the real R2-backed enrichment file rather than the starter placeholder record. The page/API are aligned around `front_image_url` and `back_image_url`, with trailer-ready search support.
- Admin now has a dedicated product stock and build-readiness report, bridging finished-product inventory with linked tool/supply inventory pressure.
- Site inventory operations continue moving away from scattered JSON maintenance by syncing from `catalog_items` into `site_item_inventory`, then surfacing reorder/do-not-reuse status directly in admin views.


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


### Current pass additions
- `admin_action_audit` for privileged operator visibility.
- `auth_recovery_requests` now capture `ip_address` and `user_agent` for safer triage.


Current pass emphasis: risk reduction through payment safety, inventory authority, media lifecycle controls, funnel analytics, and draft readiness rather than only visual polish.



## Current pass update
- Added `/api/stripe-return` for customer-return reconciliation on Stripe Checkout.
- Added `notification_outbox` dispatch processing so queued receipts and recovery notices can actually move toward delivery.
- Added shared admin step-up confirmation for destructive admin actions.
- Added `/api/creations` as the centralized public creations read path during the JSON-to-D1 migration.
- Stripe webhook flow now confirms local dispute records from provider events instead of leaving dispute sync fully manual.

## Current pass update
- Draft-to-publish governance is now more explicit: review actions are handled through `/api/admin/product-review-actions` and logged in `product_review_actions`.
- Supplier reorder work now has first-class draft documents through `supplier_purchase_orders` and `supplier_purchase_order_items`.
- Product operations now include build-cost visibility from linked tools and supplies, which helps pricing, readiness, and margin checks.
- Analytics now expose referrers, entry paths, and zero-result search terms for clearer discovery diagnostics.



## Current pass update
- Public tools and supplies now have centralized public API read paths that prefer D1-backed catalog records before JSON fallback.
- Gallery/creations reads are more centralized as migration continues away from scattered direct JSON fetches.
- Purchase-order lifecycle now feeds inventory state more directly by applying ordered quantities to incoming stock and received quantities to on-hand stock.

- Inventory authority now includes product-level reservation/release actions that operate across linked tool/supply records, not only one inventory row at a time.
- Public catalog APIs now expose category/type filter summaries to support richer discovery UX without returning to scattered JSON parsing.


## Current pass update
- Payment notification flow is no longer only a passive queue: admin refund/dispute actions and Stripe provider-confirmed webhook events now attempt immediate outbox delivery when mail credentials are configured.
- Storefront product reads now expose discovery summaries for category, colour, and product type.
- Public tools and supplies pages now rely on their dedicated centralized APIs instead of the generic catalog endpoint, which continues the migration away from scattered outward-facing data paths.

## Current pass update
- The import pipeline is less shell-only now: admin preview/import can validate and create richer finished-product records, including SEO rows, tags, and extra image rows during product seeding.
- The direct R2 media upload path is no longer only an asset drop. It can now attach uploaded images directly to a product gallery and featured-image flow, which reduces one more manual step between upload and storefront readiness.



## Current pass update
- Product stock readiness is no longer only a read-only report: admin can now reserve or release linked tool/supply inventory directly from the stock-report UI.
- Product-detail media responses now include grouped storefront image structures that blend product images, annotations, and media variant-role hints more cleanly.
- Analytics now include top product page paths and top ordered products so the dashboard can better compare discovery versus sales pressure.
- The public supplies page and the tools health screen both moved farther toward centralized API-first reads during the JSON-to-D1 transition.


## Current pass update
- Reservation governance now appears in another operational admin surface: the main products list can reserve or release linked tool/supply inventory per product.
- Toolshed discovery now leans on the centralized tools API path rather than multiple direct JSON fallbacks.
- Storefront product detail now carries grouped image, annotation, variant-role, and build-summary context in one payload.


## Current pass update
- The phone-first finished-product flow no longer assumes every draft is storefront-ready. Partial intake is now allowed through `capture_reference` plus draft-mode saving.
- Admin now includes a movie catalog editing workflow so the movie system can accept staff-curated and future visitor-contributed metadata directly into D1 without depending only on source JSON edits.


## Current pass update
- Movie operations are now split into two distinct layers: JSON-first read authority from `movie_catalog_enriched.v2.json`, and D1 overlay writes for manual/admin movie corrections and visitor-contributed metadata.
- This means the public movie shelf and admin movie list should always be able to recover from the JSON base truth even while the manual movie editor is still being hardened.
- The admin movie editor is expected to function more like a “movie card editor” than a minimal metadata form: cover previews, existing summary/details, source/value fields, and collection notes must all be visible for manual enrichment.
- The mobile finished-product workflow remains intentionally draft-heavy: partial product entries should be captured quickly and safely before later review/publish completion.

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


## Current pass direction
- Keep Admin split into department pages instead of rebuilding a giant all-in-one dashboard.
- Keep moving the phone dashboard toward daily real-use actions: Today, inventory, expense entry, write-offs, product intake, and exports.
- Keep accounting focused on growing from capture/export structure into fuller P&L and overhead allocation later.


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
- Phone capture now supports reopening draft products in the same workflow.
- Accounting now has an estimated fully loaded item-costing view based on direct costs, linked resources, and overhead allocation.

## Current pass addendum
- The current accounting truth is still rough, but the repo now correctly treats `accounting_expenses` / `accounting_writeoffs` as real-dollar tables and `product_costs` as a `product_number` + `cost_per_unit` table.
- Treat the phone dashboard as a fast operational shell for daily accounting visibility, not just a launcher.
- Treat the mobile product capture screen as the preferred place to reopen and continue unfinished finished-product drafts.

## 2026-04-10 deploy hotfix

- Fixed a Cloudflare Pages build blocker in the accounting CSV export helpers by replacing the regex-based CSV quoting check with a simpler string-contains check.
- This hotfix does not change the database shape. Schema files remain current for this pass because no SQL migration was required.

## Current pass note
- Public catalog cleanup continued by moving gallery/creations and tools farther onto shared API authority.
- Mobile admin/accounting usability moved forward again with a stronger phone snapshot for open records and outstanding values.

## Current pass completion update
- Social hub is now API-backed via `/api/social-feed`.
- Public shop and movies plus admin phone snapshot now keep last-good client fallback state.
- Runtime incidents now have a read endpoint for admin review and count-level visibility in dashboard summary.

## Current pass note

Operational priority moved to admin resiliency this pass: order list, order detail, and payment detail screens now degrade more gracefully, and the phone dashboard now surfaces order/payment incident pressure for quicker triage.

## Latest pass update

- Admin resilience now has two layers for failed writes: a shared D1-backed queue first and browser-local fallback second.
- The main day-to-day surface for this queue is the order-detail modal plus the phone dashboard health block.

## Current pass update
- Social hub YouTube cards now prefer derived thumbnail URLs/fallbacks through `/api/social-feed` instead of fragile iframe-only presentation.
- Shared admin replay queue coverage now reaches the product review workflow in addition to order/payment order-detail actions.
- Accounting item costing now relies on the shared costing helper for basis-aware overhead pool allocation.

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

- Finished products now assume a DD-series numbering floor of `DD1000`.
- The phone-first product capture path and the regular create-product path now share the same numbering helper logic.
- Older databases may not have the app setting row yet, so the runtime fallback to `1000` is intentional and should remain in place until every environment is upgraded.


## Latest pass additions
- Catalog pricing control is now split into two safe paths: per-item edit for precise single-product changes and bulk scope controls for selected IDs, one category, or the full product list.
- Bulk repricing now supports preview-first review plus compare-at handling, which gives the repo a better base for tariff, shipping, packaging, or other broad selling-price changes.
- Public exposed-page H1 count was rechecked and remains aligned with the one-H1 rule.

## 2026-04-13 pass update
- Repaired the phone capture next-number display so the admin UI now shows `DD1000`-style labels instead of a bare numeric value when the next product number is loaded.
- Restored stronger public social discovery by adding the Socials route back into the shared navigation/footer and hydrating the footer profile list from `/api/social-feed` instead of keeping another hard-coded duplicate set of links.
- Added a catalog-side **Brand, Socials & Creations** helper so reusable brand images can be uploaded as standalone brand assets and the current public social links can be verified from admin.
- Confirmed that public gallery and creations are still fed through the finished-product plus catalog-sync flow; a fully separate creations-only editor remains a next-step item rather than a completed interface.

## Current pass note
- Inventory operations now cover both stock movement and bulk unit-cost changes.
- Use the catalog department page inventory block for tariffs, packaging increases, supplier changes, or shipping-related cost corrections before repricing products.

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


## Current pass update (Pass 31)
- Added webhook-side gift card activation when Stripe or PayPal marks an order paid.
- Tightened publish gating so low publish/image scores now need an explicit override publish path.
- Added deeper customer engagement automation controls with cooldown rules, exclusions, and run logs.
- Added upload-side listing image validation and stronger photo workflow warnings.
- Extended featured testimonial output and synced schema/docs for this pass.

## Pass 32 update - support, quality gate, and engagement depth (2026-04-20)

This pass moved the store further into provider-confirmed fulfillment, listing-quality control, and customer engagement operations.

What changed in code this pass:
- Gift cards now continue through provider-confirmed fulfillment more cleanly, including purchaser and recipient notification timing and admin resend/history visibility.
- Listing-quality control is stricter with stronger publish gating, explicit override notes, image-dimension history support, and stronger media completeness scoring.
- Customer engagement automation now supports cooldown rules, exclusions, suppression, run logging, retry/cancel controls, and richer queue visibility.
- Pricing decision support now goes further into receiving-cost pressure, packaging/shipping pressure, markup targets, and planned increase guidance.
- Footer/social support paths now include the live Buy Me a Coffee link: https://buymeacoffee.com/devilndovel

Recommended next direction after this pass:
- tighten provider-confirmed gift-card delivery and resend auditing further
- deepen listing photo validation and first-image scoring
- expand testimonial placement and merchandised trust blocks
- continue pricing decision support into receiving, shipping, and margin planning

## Pass 33 update
- Deepened gift card delivery history and resend controls with recipient/purchaser audit support.
- Strengthened listing-photo readiness with crop history, first-image scoring, and richer media-quality checks.
- Expanded public trust/testimonial placement and support CTA coverage.
- Pushed pricing toward a fuller operating console with receiving/packaging/shipping assumptions and save-time warnings.

---

## Current Pass Update — Gift Card History, Upload Validation, Trust Blocks, and Save-Time Pricing

This pass moved four areas forward together:

- Gift card delivery audit now reaches clearer order-history views for members and storefront confirmation paths.
- First-image validation is stronger at upload/save time, not just later during review.
- Featured testimonials/trust messaging were expanded into more merchandised public browsing flows.
- Save-time pricing guidance was tightened in the main product editor so receiving-cost pressure, planned increases, and below-target pricing are more visible before save.

Key implementation notes:
- Member order history now surfaces gift-card counts and delivery timing summary where available.
- Member order detail now includes purchased gift cards and delivery audit history for buyer/recipient communication.
- Order confirmation now shows gift-card delivery details when present.
- Product media save now blocks weak first-listing images when orientation, dimensions, alt text, or first-image score are too weak.
- Pricing console assumptions persist locally in-browser and the save path now warns more clearly when current price is below target or under landed cost.
- Public trust/support blocks were broadened so testimonials and support cues are visible in more browsing flows.


## Pass 99 quick brain note

The current accounting direction is intentionally gradual: add GIFI review structure, Schedule 141 notes, and month locking first; then add reconciliation, attachments, recurring rules, and export packaging later. Storefront trust work now places policy/support/process context closer to buyer decisions instead of leaving it buried in isolated pages.

## Pass note — 2026-04-25 accounting handoff step
- Extended the slow T2/GIFI path with stronger GL review completion support, including reviewed/finalized starter mappings and bulk review/finalize actions for mapped active accounts.
- Added accounting attachments for bills, receipts, statements, and workpapers so files can be tied to vendors, expenses, reconciliation periods, and year-end handoff bundles.
- Deepened reconciliation storage with statement references, difference reasons, detail JSON, and attachment counts for sales tax, processor fees, and shipping reviews.
- Expanded the year-end close bundle so the accountant handoff now includes GL review summary, attachment coverage, reconciliation coverage, and missing-item prompts.

## Current pass: accounting handoff depth
- moved GL review closer to final GIFI state with starter mapping helpers, final-review blockers, and safer reviewed-to-finalized bulk actions
- expanded accounting attachments with status, document date, and reconciliation scope metadata so bills, receipts, statements, and workpapers are easier to tie into month-end and year-end review
- deepened reconciliation storage for statement/book amounts, tolerances, expected versus observed rates, and unresolved item counts
- expanded the year-end close bundle so accountant handoff now summarizes GL blockers, reconciliation coverage, attachment coverage by kind/month, and missing support items

> Current pass sync: 2026-05-05 recurring events, vendor applications, and event-image support were reviewed against this document.
