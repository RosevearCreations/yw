# Repo Rules


## Current pass update

- Repaired the phone product-capture save route so it resolves the shared D1 binding through `DB` or `DD_DB` instead of assuming one binding name.
- The mobile save endpoint now returns structured JSON failures and records a runtime incident when the save path breaks unexpectedly.
- The phone product-capture page now parses failed responses safely, so HTML 500 pages no longer surface as `Unexpected token '<'` in the admin UI.
- Rechecked outward-facing HTML pages and the one-H1 rule remains intact across the current public page set.

- Keep all schema files and Markdown docs in sync with the current build state.
- When payment flow changes, update both code and the database and payment documentation together.
- When media workflow changes, update both admin UI notes and deployment binding notes together.
- Prefer additive changes that preserve working storefront and admin behavior.
- Keep checkout order creation separate from provider-specific payment preparation.
- Treat webhook processing as idempotent, reviewable, and safely replayable.
- Do not remove working PayPal paths when improving Stripe paths.
- Keep product media compatible with both pasted URLs and uploaded R2 assets.
- Keep refund and dispute logging local-first until provider sync is explicitly implemented.
- Keep inventory changes consistent across products, tools, and supplies.
- Inventory quantity changes should log a movement record whenever practical.
- Use full-file updates for schema and docs when making major pass changes.
- Every outward-facing page must have exactly one H1.
- Every outward-facing page must ship with a title, meta description, canonical URL, and clear robots intent.
- Private utility pages should normally remain `noindex`.
- Review sitemap, robots.txt, and public search visibility on every pass that touches public pages.
- Treat public search awareness as an ongoing improvement requirement for future updates.
- Keep a visible shared footer on every page unless a page is intentionally standalone.
- Keep the shared logged-in account widget available on every page.
- Logged-out account UI should continue to expose login, forgot-password, and forgot-email paths.

- A valid admin/member session should remain visible across both the admin area and the outward-facing site.
- Shared auth should not depend on one storage mechanism alone; keep a reliable session fallback for standard pages.
- Footer injection is part of baseline shared layout and should remain visible after every pass.
- Keep outward-facing pages visually consistent with uniform input, table, and card styling.

- Keep product mass upload template, field rules, and import validation aligned whenever import fields change.
- Continue staged migration of duplicated JSON collections into D1 when it reduces search, inventory, or analytics failure points.
- Outward-facing collection pages should prefer live database-backed catalog data when available, with JSON fallback only as a safety net during migration.
- Keep structured data aligned with visible page content and avoid marking up hidden or misleading content.
- Keep canonical intent, robots intent, favicon support, and public search discoverability aligned with current Google Search guidance on every outward-facing SEO pass.


## Current pass additions
- Session/auth now uses a stronger same-site continuity path: auth endpoints set a first-party `dd_auth_token` cookie in addition to returning the bearer token. Public pages can resolve the signed-in member/admin state more reliably.
- Added `movie_catalog` for staged migration of the legacy UPC-only movie JSON into D1. The public movies page now reads from `/api/movies`, which prefers D1 and falls back to `/data/catalog.json`.
- Catalog sync now supports movies in addition to tools, supplies, and featured creations.
- Public movie search UI now supports title, UPC, year, actor, and director fields when that data exists, while still working with legacy UPC-only data.
- Product CSV preview now renders as a structured validation table instead of loose JSON/text lines.

- Footer must render on every outward-facing and member/admin page through the shared layout unless a page explicitly documents why it is excluded.
- Continue improving search awareness every pass: strengthen crawl paths, keep one visible H1 on outward-facing pages, and prefer database-backed shared datasets over duplicated JSON whenever scope allows.


## Movie enrichment files
- Keep legacy `/data/catalog.json` untouched if needed for fallback, but place richer movie metadata in `/data/movies/movie_catalog_enriched.v2.json`.
- Use one record per movie and match by UPC where possible.

## Outward-facing SEO rule
- Every outward-facing page must continue to have exactly one H1.
- Each outward-facing pass should also improve crawl/discovery/search clarity where practical.


## Current pass update
- Movie catalog wiring now blends D1 `movie_catalog`, `/data/movies/movie_catalog_enriched.v2.json`, and the R2-hosted cover images more safely.
- Movie search now supports title, UPC, year, actor, director, genre, studio, format, and optional trailer-link filtering.
- `trailer_url` is now part of the movie enrichment path so trailer support can be stored directly when available.
- Storefront product detail now includes linked tools and supplies from `product_resource_links` so each finished product can tell a clearer “made with these materials and tools” story.
- Admin product-resource linking now supports usage notes for story-building and social-post context.
- Admin inventory can now sync tool and supply records from `catalog_items` into `site_item_inventory`, reducing duplicate maintenance between JSON, catalog, and inventory records.
- Continue the one-H1-per-exposed-page rule and continue improving page titles, descriptions, canonical tags, crawl paths, structured data relevance, and visible on-page content alignment on every outward-facing pass.


## Ongoing rule additions

- Keep every outward-facing page to a single H1 only.
- Continue improving crawl, discovery, and search intent on every outward-facing pass.
- When public media or catalog data already exists in R2 or D1, do not regress pages back to placeholder local paths or sample JSON records.


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


- Every security/admin pass should prefer durable audit trails over silent destructive actions.
- Recovery and privileged-action flows should capture only the minimum operational context needed for review (for example IP and user-agent) and must continue to return privacy-safe user-facing responses.


Current-pass rules added:
- Prefer DB-backed outbox records over immediate best-effort receipt sending when provider delivery is not yet fully wired.
- Prefer explicit inventory actions (reserve, release, receive, reorder-request) over silent count edits wherever practical.
- Expose storefront readiness as a computed/admin-visible state before broadening publish automation.



## Current pass rule reminder

- Keep outward-facing pages on the one-H1 rule. Current scan shows the exposed `index.html` pages still meet that requirement.
- Prefer centralized API reads over direct page-level JSON when a D1-aware endpoint already exists.
- For destructive admin actions, keep the shared step-up confirmation path in place rather than duplicating weaker one-off checks.

## Current pass rule additions
- Product publish actions should go through governed review endpoints rather than ad-hoc status edits whenever possible.
- When linked resource cost data exists, keep publish/readiness decisions aligned with that cost visibility rather than ignoring it.
- Reorder workflow should prefer supplier purchase-order drafts over scattered manual notes when the D1 tables are available.



## Current pass reminder
- Keep outward-facing supplies/tools reads on centralized APIs when touching those pages.
- Keep stock-report reservation controls aligned with site-item-inventory product-resource actions.
- Keep one H1 per exposed page and continue incremental search/discovery improvements on every pass.


## Current pass reminder
- Keep public tools/supplies/creations discovery on centralized API paths whenever possible instead of adding new direct JSON reads.
- Preserve the one-H1-per-exposed-page rule and continue documenting every reservation-governance and media-lifecycle change in the repo markdown files.


- Bulk finished-product import work should stay aligned with `data/finished_products_import_template.csv` so CSV headers match the preview/import endpoints.
- Mobile product capture must continue to allow partial draft intake; do not reintroduce storefront-level mandatory fields into the phone-first save path.


## Current pass addendum
- Marked the previous admin preview, products fallback, movie save, and accordion issues as completed/fixed in the documentation.
- Departmentalized Admin into standalone interfaces: Members, Catalog, Orders, Accounting, Analytics, Operations, and Movies, reducing the size and risk of the main dashboard file.
- Added real starter routes/UI for tier policy, general ledger accounts, expenses, write-offs, product unit costs, and monthly accounting CSV export.
- Added accounting templates (CSV + XLSX) so GL and month-end bookkeeping can be seeded faster.
- Continued mobile direction by making the lighter departmental pages easier to use on smaller screens than the former all-in-one Admin page.
- Continued JSON-to-DB convergence by moving tier policy and accounting records into D1-backed tables instead of temporary page-only assumptions.

## Current pass note
- Keep accounting/reporting changes aligned to the actual SQL files before changing admin JS/API code. Recent drift came from code assuming cents/id columns that the repo schema did not define.
- Keep mobile workflow changes in sync across HTML, JS, SQL references, and handoff docs in the same pass.

## 2026-04-10 deploy hotfix

- Fixed a Cloudflare Pages build blocker in the accounting CSV export helpers by replacing the regex-based CSV quoting check with a simpler string-contains check.
- This hotfix does not change the database shape. Schema files remain current for this pass because no SQL migration was required.

## Current pass rules addendum
- When a centralized public API already contains its own fallback logic, do not keep a second page-level direct JSON fallback in the HTML unless there is a clearly documented reason.
- Keep phone-first admin improvements focused on fewer taps for daily accounting visibility, not only launch links into larger department screens.

## Current pass rule note
- Prefer the API path (`/api/social-feed`) over direct browser reads of `data/site/social-feed.json`.
- Keep using runtime-incident capture plus client-side snapshot fallback together when hardening public/admin pages.
- Do not remove the movie JSON-first base truth yet; that area is still intentionally JSON-first with D1 overlay.

## Current pass note

For admin order/payment work, prefer partial success plus a warning over whole-screen failure whenever a supporting table or summary query is missing.

## Latest pass note

- Keep failed admin write actions on the shared `admin_pending_actions` queue when possible, and only fall back to browser-local saved actions when the queue itself is unavailable.

## Current pass note
- When extending admin replay coverage, prefer the shared `admin_pending_actions` queue first and browser-local storage only as the last safety net. This now applies to product review actions too, not only order detail writes.
- When changing the social hub, prefer thumbnail/image cards with graceful fallback over brittle iframe-only presentation.

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

## Current pass rule addendum — 2026-04-12

- Treat `DD1000` as the minimum finished-product number unless the database already has a higher product number.
- Any new product-entry workflow must use the shared numbering helper or the same app-setting-backed logic, not its own local counter.
- When docs or schema seeds change around numbering or SEO policy, update the handoff markdown files in the same pass.


## Current pass rule additions
- Bulk admin controls must never overwrite shipping/tax/inventory flags just because a form field had a default value; every optional bulk change needs a true no-change path.
- Wide catalog price changes should prefer preview-first workflows before commit whenever the scope is a category or the full product list.

## 2026-04-13 pass update
- Repaired the phone capture next-number display so the admin UI now shows `DD1000`-style labels instead of a bare numeric value when the next product number is loaded.
- Restored stronger public social discovery by adding the Socials route back into the shared navigation/footer and hydrating the footer profile list from `/api/social-feed` instead of keeping another hard-coded duplicate set of links.
- Added a catalog-side **Brand, Socials & Creations** helper so reusable brand images can be uploaded as standalone brand assets and the current public social links can be verified from admin.
- Confirmed that public gallery and creations are still fed through the finished-product plus catalog-sync flow; a fully separate creations-only editor remains a next-step item rather than a completed interface.

## Current pass note
- Keep `site_item_inventory` cost changes going through the admin API paths so audit logging and movement-note history remain intact.
- Avoid bypassing the new bulk inventory cost endpoint when mass supplier/tariff changes are needed.

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
