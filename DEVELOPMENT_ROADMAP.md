# Development Roadmap


## Current pass update

- Repaired the phone product-capture save route so it resolves the shared D1 binding through `DB` or `DD_DB` instead of assuming one binding name.
- The mobile save endpoint now returns structured JSON failures and records a runtime incident when the save path breaks unexpectedly.
- The phone product-capture page now parses failed responses safely, so HTML 500 pages no longer surface as `Unexpected token '<'` in the admin UI.
- Rechecked outward-facing HTML pages and the one-H1 rule remains intact across the current public page set.

## Current completed foundations

- auth and session model
- member orders/downloads
- admin users/security tools
- checkout and order creation
- PayPal handoff
- PayPal return capture
- PayPal webhook reconciliation foundation
- analytics and visitor monitoring foundation
- product SEO tools
- product media workflow foundation
- site inventory/reorder foundation
- movie cover pipeline with R2-backed imagery
- movie shelf pagination foundation
- mobile finished-product capture foundation

## Strongest next steps after this pass

1. Stripe payment completion pass
2. webhook retry / replay / dispatch hardening
3. direct media upload workflow to R2 lifecycle completion
4. broader write-path fallback and replay coverage beyond admin order detail
5. deeper inventory operations for products, tools, and supplies
6. richer analytics dashboards and funnel reporting

## Media-specific roadmap

- direct upload endpoint hardening and broader reuse
- image delete/reorder UI polish
- thumbnail/variant handling
- tighter annotation-to-storefront usage
- stronger duplicate handling and media lifecycle audit coverage

## Payment-specific roadmap

- webhook replay safety
- idempotency improvements
- provider retry logging
- refund/dispute workflows
- provider-confirmed reconciliation flows
- invoice / refund / return receipt delivery

## Current pass completion update

- Repaired the movie shelf layout so cards no longer collapse into unusable one-character columns under grid pressure.
- Updated the movie API and page to use real paging metadata instead of treating the first batch as the whole catalog.
- Improved movie shelf usability with proper page counts, next/previous controls, and more honest result counts.
- Hardened key auth/payment/media JSON responses with safer baseline response headers.
- Improved admin media upload reliability by allowing same-site auth-cookie fallback in addition to bearer auth.
- Rewrote the Known Gaps and Risks document so it reflects the current state more honestly and can guide the next security/customer-experience passes.

## Still intentionally not marked complete

- Stripe completion
- worker-driven webhook retry/replay
- provider-confirmed refund/dispute sync
- full media lifecycle completion
- full authoritative inventory movement model
- richer funnel analytics
- trusted movie metadata/value enrichment


## Current pass update

- Rebuilt the public movie shelf layout with a dedicated card and pager structure so movie entries no longer collapse into unusable one-character columns.
- The movies page now uses the API paging metadata to show the real total catalog size, page number, page range, and next/previous navigation more honestly.
- Added a more defensive movie-specific CSS layer so future generic card/grid changes are less likely to break the movie shelf again.
- KNOWN_GAPS_AND_RISKS.md was rewritten to document the remaining payment, inventory, media, analytics, and metadata risks more clearly.


## Current pass completion update

- Added an `admin_action_audit` trail so privileged product, inventory, media, and webhook actions now have durable server-side records.
- Hardened account recovery requests with basic rate limiting and stored IP/user-agent context for safer review.
- Improved webhook processing bookkeeping by incrementing attempt counts and scheduling next retry timestamps for failed provider events.
- Added a read endpoint foundation for audit visibility at `/api/admin/audit-log`.

## Current pass completion update

- Addressed the payment/refund safety item with provider-aware refund sync attempts and queued receipt records.
- Addressed the webhook retry/replay item with a new admin webhook dispatch endpoint for due/failed event requeueing.
- Addressed the inventory-authority item with a rewritten inventory API that supports reserve/release/receive/reorder-request actions plus stronger movement logging.
- Addressed the media-lifecycle item with restore/replace metadata support and duplicate visibility in admin media assets.
- Addressed the analytics item with stronger funnel metrics in dashboard summary and visitor analytics.
- Addressed the draft-to-publish governance item with product readiness checks and storefront-readiness flags.
- The roadmap is not fully finished yet because Stripe checkout completion, real receipt delivery, deeper attribution, and trusted movie enrichment still remain open.



## Current pass completion update

- Restored and completed the Stripe return reconciliation path with `/api/stripe-return` plus confirmation-page finalize logic.
- Added provider-confirmed Stripe dispute sync through `charge.dispute.*` webhook handling.
- Added a real `notification_outbox` dispatch path with Resend-ready email delivery and admin processing controls.
- Added shared admin step-up confirmation for destructive actions.
- Added `/api/creations` so finished creations can move toward one public authority path instead of direct page-level JSON reads.

## Still intentionally not marked complete

- trusted movie metadata/value enrichment remains blocked on external metadata-source access
- full provider-confirmed dispute sync for every payment provider remains dependent on each provider's API coverage and credentials
- full attribution and decision-grade merchandising analytics still need another pass

## Current pass completion update
- Added governed product approval/publish actions with audited review history.
- Added product build-cost rollups so linked tool/supply costs can be checked before publishing.
- Added supplier purchase-order draft tables and API coverage to move reorder work beyond ad-hoc notes.
- Expanded analytics with top-referrer, entry-path, and zero-result search diagnostics.

## Still intentionally not marked complete
- fully automated worker-driven webhook retries beyond admin dispatch
- full multi-role permission granularity beyond current admin/member model
- fully trusted external movie enrichment and valuation data



## Current pass completion update
- Reduced another public JSON duplication point by adding centralized tools/supplies API reads for outward-facing pages and search.
- Moved purchase-order receiving closer to authority by applying ordered quantities to incoming stock and received quantities to on-hand stock.
- Remaining inventory work should now focus more on reservation governance and UI depth instead of basic supplier receiving math.

## Current pass completion update

- Added product-level reservation actions for linked tool/supply inventory.
- Product cost/reporting endpoints now expose buildable-unit and resource-shortage signals.
- Public catalog APIs now expose filter-group summaries for stronger category/discovery UX.
- Mobile quick-product bootstrap reliability improved by switching to shared admin auth and corrected inventory-field usage.


## Current pass completion update
- Receipt delivery is now more operational because admin refund/dispute actions and Stripe provider-confirmed webhook events both try to dispatch queued notifications immediately when delivery credentials exist.
- Storefront discovery moved forward with live `/api/products` filter summaries plus dedicated tool/supply public API usage on the outward-facing pages.
- Remaining strongest next steps are still deeper role segmentation, broader reservation UI coverage, fuller provider coverage beyond Stripe, and trusted movie enrichment from an accepted external source.

## Current pass completion update
- Product import preview now checks duplicate slugs, SKUs, and product numbers before insert, while also validating newer finished-product fields like category, colour, review status, SEO title/meta length, tags, and additional image URLs.
- Product bulk import now seeds richer finished-product records with product number, category, colour, shipping code, review status, SEO rows, tags, and optional additional product images instead of only creating minimal draft shells.
- Direct media upload can now attach uploaded files straight into product images/annotations, set featured images, and record variant-role notes in one step, which moves the R2 upload flow closer to a full operator-ready lifecycle.

## Still intentionally not marked complete
- thumbnail/variant file generation still needs an image-processing pass rather than only metadata/role handling
- worker-driven webhook replay remains a later hardening layer beyond current admin-triggered dispatch
- trusted external movie enrichment and valuation still depend on external data access



## Current pass completion update
- Extended product-level reservation governance into the admin stock-report UI so linked tools/supplies can be reserved or released from a real frontend path.
- Improved storefront/media readiness by exposing grouped product image data, variant-role awareness, and derived variant URL suggestions.
- Expanded analytics with top product-detail paths and top ordered products so merchandising diagnostics move closer to decision-grade reporting.
- Reduced another public JSON dependency by moving the public supplies page and the internal tools health screen onto centralized API reads.

## Still intentionally not marked complete
- actual generated thumbnail/variant files still need image-processing infrastructure
- broader multi-role permission granularity still remains for a future security pass
- trusted external movie enrichment still depends on the separate movie-data workflow and external source access


## Current pass completion update

- Extended product-resource reservation controls into the main admin products list so linked tools/supplies can be reserved or released from another real day-to-day workflow.
- Hardened the toolshed and supplies discovery pages around centralized API reads and shared filter-group metadata rather than page-local JSON assumptions.
- Storefront product detail now ships lightweight variant-url hints plus build-summary context to support later media-variant rollout and richer product storytelling.


## Current pass completion update

- Mobile product capture now supports partial draft intake using a new `capture_reference` field, so a phone-first session can save a photo, a name, or a temporary identifier before the product is ready for full storefront data.
- Added a detailed finished-products CSV template at `/data/finished_products_import_template.csv` for larger batch seeding.
- Added an admin movie catalog editor so staff can update title/year/actors/UPC/IMDb id and notes directly in D1 while the movie-enrichment pipeline is still being built out.


## Current pass movie and product-entry update
- Keep `movie_catalog_enriched.v2.json` as the active movie base truth until the movie enrichment pipeline is stable enough to prove a clean sync/import path.
- Treat `movie_catalog` in D1 as an edit overlay for manual corrections and contributed metadata, not as the primary movie source yet.
- Finish the admin movie editor so it visibly loads the front cover, back cover, title, year, summary, actor names, director names, studio, runtime, metadata source/status, rarity notes, value fields, and collection notes from the JSON-first movie payload.
- Harden the movie save path against legacy D1 schemas by auto-adding missing columns before writes.
- Keep improving the mobile finished-product workflow so partial drafts can be captured quickly in sequence before later review and publishing.
- Keep expanding the finished-product CSV import path so completed products can be loaded in bulk with SEO, media, tags, category, colour, shipping, readiness, and draft-review support.

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


## Current pass addendum
- Continued mobile-first admin polish with a stronger phone dashboard, clearer quick-action launch cards, and direct anchors into accounting tasks like expenses, write-offs, product costs, and export presets.
- Continued admin shell cleanup by reinforcing the departmental launcher model so the main dashboard stays lighter and department pages act more like standalone work surfaces.
- Continued docs/schema synchronization for the current build while keeping the main open items focused on deeper accounting logic, remaining mixed JSON/D1 cleanup, and broader real-device stress testing.


## Current pass addendum
- Replaced the long phone Admin link list with a grouped tree-style mobile menu so the phone workflow uses collapsible sections instead of one uninterrupted list.
- Continued mobile-first workflow tuning by surfacing Today, quick expense, quick write-off, product cost, and export actions closer to the top of the phone dashboard.
- Continued docs/current-build synchronization for the present mobile-navigation and admin-usability pass.


## Current pass addendum
- Customer-facing home/shop flow was made friendlier and clearer on phone and desktop with stronger exploration sections and clearer action cards.
- Accounting moved forward with monthly overhead allocations and a rough net-after-overhead view in the accounting report so operating costs can start flowing toward fuller P&L reporting.
- Mobile admin moved forward again with a direct overhead-allocation shortcut from the phone dashboard.
- Schema and template files were updated for the new overhead allocation layer.


## Current pass addendum
- Mobile product capture can now continue an existing saved draft in the same phone-first screen instead of forcing staff back to a separate admin workflow.
- Accounting now includes an estimated item-costing view that blends direct unit cost, linked-resource cost, and allocated overhead into a fuller rough unit cost.
- Mobile accounting quick links now surface item-costing review alongside expense, write-off, overhead, and export workflows.
- This pass did not add a new table; it moved forward the workflow and reporting layer on top of the current accounting schema.

## Current pass completion update
- Corrected accounting-reporting drift so the rough P&L and item-costing views now match the live accounting table shapes instead of newer assumed cents/id columns.
- Improved phone workflow again by keeping updated product drafts open in the same mobile capture screen and by restoring saved SEO fields when a draft is reopened.
- Added a live phone-dashboard accounting snapshot so quick daily admin/accounting review no longer depends on opening the full accounting department page.
- Continued local-search tuning by tightening Southern Ontario copy on key public pages and by reinforcing LocalBusiness-style structured data on About and Contact.

## Still intentionally not marked complete
- final per-item overhead allocation logic remains rough revenue-share rather than a finished costing/accounting rule set
- full deeper P&L / double-entry accounting remains future work beyond the current rough reporting layer
- broader mixed JSON/D1 cleanup in older paths still remains open

## 2026-04-10 deploy hotfix

- Fixed a Cloudflare Pages build blocker in the accounting CSV export helpers by replacing the regex-based CSV quoting check with a simpler string-contains check.
- This hotfix does not change the database shape. Schema files remain current for this pass because no SQL migration was required.

## Current pass addendum
- Reduced another duplicate-truth risk by moving the public gallery and tools pages to rely on their centralized API endpoints instead of page-level direct JSON fetches.
- Strengthened phone-first accounting visibility by adding open-record, paid, outstanding, and tax-liability snapshot cards to `/admin/mobile/`.
- Removed one more internal schema drift point by making `accounting-summary` rely on the shared accounting schema helper instead of its own private table definition copy.
- Added catalog-item lookup indexes in the schema/upgrade files to better support centralized public tools and creations reads as D1 authority continues to expand.

## Strongest next steps after this pass
1. Keep removing remaining page-level JSON reads from outward-facing pages where centralized APIs already exist.
2. Expand the phone dashboard from snapshot cards into a real day-close/month-end checklist surface.
3. Continue turning rough accounting views into governed ledger workflows without pretending the current layer is final double-entry accounting.

## Current pass completion update
- Added API-backed social hub reads at `/api/social-feed` so the public social page no longer reads its JSON file directly in the browser.
- Added cached client-side fallback for the shop, movie shelf, social hub, and phone dashboard so the last successful snapshot can still render when a live endpoint drifts or D1 is temporarily unavailable.
- Added `/api/admin/runtime-incidents` and surfaced recent runtime-incident counts in the admin summary / phone dashboard so fallback and queue health are more visible during day-to-day operations.
- Hardened `/api/products` and `/api/movies` with safer diagnostics and runtime-incident capture instead of failing silently.

## Strongest next steps after this pass
1. Extend runtime-incident review into a fuller admin operations screen with retry guidance and acknowledge / resolve actions.
2. Continue spreading cached fallback and partial-load handling through more admin-heavy payment and order screens.
3. Keep reducing public JSON duplication by moving remaining direct file reads behind APIs where practical.
4. Continue deeper accounting authority work beyond the current rough-overhead / rough-P&L layer.

## Current pass completion update

- Added partial-fallback coverage to admin orders, order detail, and order-payment reads so those screens can keep working with safe empty sections or cached snapshots instead of failing all at once.
- Added browser snapshot fallback for the admin orders list and admin order detail modal.
- Expanded the phone dashboard health block with order/payment incident counts, outstanding order counts, and provider refund-sync failure counts.
- Added another runtime-incidents index to keep the growing fallback/error log queryable as the incident trail expands.

## Still intentionally not marked complete

- final per-item overhead allocation rules still need another accounting pass
- deeper P&L / double-entry workflow is still incomplete
- movies remain intentionally JSON-first with D1 overlay until trusted enrichment lands
- broader admin/payment/order write-path fallback and replay still need another pass
- real phone and desktop stress testing still needs a fuller run


## Current pass completion update
- Extended admin order resilience from read-only fallback into write-path preservation.
- Order status updates, manual payment recording, and refund/dispute actions now log runtime incidents more defensively instead of only failing silently or hard.
- The admin order-detail screen can now preserve failed write attempts in browser storage so operators can retry them later without retyping the whole action.
- The phone dashboard now exposes both server-side admin write incident counts and browser-local pending fallback actions for quicker follow-up.

## Still intentionally not marked complete
- automatic replay/dispatch of saved client-side fallback actions across browsers or staff devices
- deeper double-entry accounting and final overhead allocation rules
- movie authority simplification beyond the current JSON-first plus D1 overlay model
- broader real-device stress testing across phone and desktop admin screens

## Latest pass update

- Added a shared `admin_pending_actions` queue so failed admin order/payment writes can be replayed across devices instead of living only inside one browser.
- `/api/admin/pending-actions` and `/api/admin/pending-actions-status` now provide the queue foundation for cross-device retry, dismissal, and status tracking.
- `admin-order-detail.js` now tries the shared queue first and falls back to browser-local storage only if the queue itself cannot be reached.
- The next strongest step after this pass is broader write-path coverage beyond order detail plus a worker-driven or admin-triggered replay center for the shared queue.

## Current pass completion update
- Repaired the social hub YouTube presentation by deriving thumbnail fallbacks in `/api/social-feed` and rendering thumbnail cards instead of depending on fragile embeds.
- Extended shared write-path replay beyond order detail by queueing failed product review actions from the catalog/products screen into `admin_pending_actions`.
- Upgraded `/api/admin/accounting-item-costing` to the shared costing engine so overhead pools can follow basis-aware logic (`manual`, `revenue`, `units`, `orders`) and expose rough recognized COGS.

## Still intentionally not marked complete
- full double-entry accounting and deeper P&L layers remain open beyond the rough costing/reporting layer
- movies still remain JSON-first with D1 overlay
- broader write-path queue coverage beyond order detail and product review still needs another pass
- real phone and desktop stress testing still needs a fuller run

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

### Completed in this pass
- Fixed the phone-first next-product number so the DD sequence starts at `DD1000` instead of `1` on empty or low-number catalogs.
- Unified product-number generation across the mobile bootstrap, phone save flow, and standard admin create-product API.
- Added a safer bootstrap fallback for the mobile product screen so core entry fields remain usable even if optional lookup data has a temporary issue.

### Next strongest follow-up
- Extend the same DD-series guardrails to any CSV/import or backfill workflow that can still inject lower manual product numbers.
- Surface the configurable `site.catalog.product_number_start` setting in the admin settings UI once the current creation path is fully verified.


## Current pass completion update
- Verified that single-item pricing already exists through the normal product edit workflow.
- Expanded bulk product tools so pricing can now be adjusted by selected items, by category, or across the full product inventory.
- Added preview-first bulk pricing so wide catalog changes can be checked before save when tariffs, packaging, or other cost pressures require repricing.
- Corrected a real admin safety risk where older bulk controls could overwrite `requires_shipping` and `taxable` even when the operator did not intend to change those fields.
- Reconfirmed the public one-H1 rule across exposed HTML pages during this pass.

## Strongest next steps after this pass
1. Add bulk unit-cost adjustment support for `site_item_inventory` so raw material and packaging cost changes can be applied with the same by-item / by-category / all-items pattern.
2. Push cost-change visibility deeper into product costing so margin warnings react faster after supplier or tariff shifts.
3. Continue reducing mixed JSON/D1 authority paths where the same public/admin data still has duplicate truth risks.

## 2026-04-13 pass update
- Repaired the phone capture next-number display so the admin UI now shows `DD1000`-style labels instead of a bare numeric value when the next product number is loaded.
- Restored stronger public social discovery by adding the Socials route back into the shared navigation/footer and hydrating the footer profile list from `/api/social-feed` instead of keeping another hard-coded duplicate set of links.
- Added a catalog-side **Brand, Socials & Creations** helper so reusable brand images can be uploaded as standalone brand assets and the current public social links can be verified from admin.
- Confirmed that public gallery and creations are still fed through the finished-product plus catalog-sync flow; a fully separate creations-only editor remains a next-step item rather than a completed interface.

## Current pass completion update
- Added bulk unit-cost update coverage for tools, supplies, products, and other site inventory so tariff, shipping, packaging, or supplier increases can be previewed and applied by ids, category, source type, or the whole inventory.
- Strengthened the inventory admin screen with a dedicated preview/apply workflow for cost changes and expanded quick-update prompts so one-off unit-cost fixes are easier during live operations.

## Strongest next steps after this pass
1. Connect bulk inventory cost changes more directly into finished-product repricing suggestions and margin warnings.
2. Continue reducing JSON/D1 overlap around creations, featured content, and reusable brand assets.
3. Keep hardening fallback behavior for admin-heavy workflows that rely on long-lived catalog data.

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
