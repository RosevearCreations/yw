# Known Gaps and Risks


## Current pass update

- Repaired the phone product-capture save route so it resolves the shared D1 binding through `DB` or `DD_DB` instead of assuming one binding name.
- The mobile save endpoint now returns structured JSON failures and records a runtime incident when the save path breaks unexpectedly.
- The phone product-capture page now parses failed responses safely, so HTML 500 pages no longer surface as `Unexpected token '<'` in the admin UI.
- Rechecked outward-facing HTML pages and the one-H1 rule remains intact across the current public page set.

## Current pass focus and what was actually improved

This pass concentrated on working down the open risk list in order instead of skipping ahead. The goal was to reduce operational risk with real code and schema changes, while staying honest about what still requires provider access, production credentials, or later UI polish.

### What improved in this pass
- Movie sync drift was reduced by moving catalog-sync movie imports to `movie_catalog_enriched.v2.json`, matching the JSON-first source already used by the public and admin movie flows.
- Schema-reference drift was reduced by updating the core/store schema files and the incremental upgrade SQL to include the richer movie overlay fields and current review/purchase-order governance tables.
- Public page SEO guardrails were checked again; exposed pages still keep a single H1 each.
- Payment/refund handling moved forward with provider-aware refund sync attempts for Stripe and PayPal when credentials and provider payment ids are available, plus queued receipt records for refund and dispute messages.
- Webhook operations moved forward with a new admin dispatch endpoint that can requeue due or failed webhook events in a controlled batch with audit logging.
- Inventory authority moved forward with a rewritten admin inventory endpoint that now supports create, update, reserve, release, receive, reorder-request, and catalog-sync actions while logging movements consistently.
- Media lifecycle moved forward with better admin media asset controls for restore, replace metadata, duplicate visibility, delete audit logging, and same-site admin auth.
- Analytics moved forward with stronger funnel metrics in both dashboard summary and visitor analytics.
- Draft-to-publish workflow moved forward with product readiness checks and readiness flags that are now exposed in admin product responses.
- Recovery and admin safety improvements from the prior pass remain in place, including IP/user-agent logging and admin action auditing.

## Gap-by-gap status

### 1. Payment and refund safety
#### Addressed in this pass
- Admin refund actions now attempt provider-side refund sync for Stripe and PayPal when enough provider information is present.
- Refund and dispute records now carry provider sync status, sync notes, and sync timestamps.
- Refund and dispute actions now queue local notification records in `notification_outbox` so receipt delivery can be processed more reliably later.
- Webhook bookkeeping already present from prior passes remains active.

#### Still open
- Stripe checkout is still not fully complete end to end.
- Provider-confirmed dispute sync is still not complete.
- Actual outbound receipt delivery by email or SMS is still queued/foundation-level, not a full sending system.

#### Remaining risk
- Payment state can still drift when providers send events after manual adjustments or when provider ids are missing on older payments.

### 2. Admin and operational security
#### Addressed in this pass
- More admin routes now rely on shared admin auth and audit helpers.
- Webhook batch requeue actions are now auditable.
- Inventory, media, and payment actions continue to feed the audit trail.
- Recovery request hardening from the prior pass remains in place.

#### Still open
- Verified delivery for account recovery is not complete.
- Step-up confirmation for sensitive destructive actions is still not complete.
- Permission granularity still needs deeper review.

#### Remaining risk
- Session misuse, weak recovery delivery, or overly broad admin powers can still create operator and trust problems.

### 3. Inventory authority
#### Addressed in this pass
- Inventory now has explicit reserve, release, receive, and reorder-request action paths.
- Supplier contact, reservation notes, last reorder requested at, and last counted at are now tracked.
- Inventory movement logging is used more consistently across actions.
- Catalog sync remains available as a maintenance and reseed bridge after the successful full migration run.

#### Still open
- Supplier purchase order workflows are still not complete.
- Build-cost rollups and full reservation governance are still incomplete.
- The final single authoritative movement-ledger design still needs more UI coverage.

#### Remaining risk
- Counts are safer than before, but drift can still happen where legacy workflows bypass the stronger action path.

### 4. Product/media workflow
#### Addressed in this pass
- Media assets now expose duplicate visibility information.
- Media asset restore and replace metadata actions now exist in the admin API.
- Media asset delete/replace operations now write clearer audit records.
- Same-site admin upload continuity remains better than before.

#### Still open
- Thumbnail and variant generation are still not complete.
- Bulk reorder/replace UI polish is still incomplete.
- Storefront use of annotations still needs more polish.

#### Remaining risk
- Media handling is stronger, but the full lifecycle is still not fully operator-proof.

### 5. Analytics and funnel reporting
#### Addressed in this pass
- Dashboard summary now exposes more funnel-oriented counts.
- Visitor analytics now includes order and paid-order funnel metrics and per-day funnel breakdown data.
- The app has a better basis for checking where visitor traffic turns into checkout and paid orders.

#### Still open
- Attribution, campaign analysis, and decision-grade merchandising diagnostics still need more work.
- Build/readiness-to-sales analytics are still not complete.

#### Remaining risk
- The analytics story is improving, but it is still not a full decision-grade BI layer.

### 6. Movie catalog enrichment
#### Addressed in this pass
- No new metadata source was added in this pass.
- The gap remains documented so it is not mistaken for a solved area.

#### Still open
- Trusted title, cast, director, runtime, rarity, and valuation enrichment still depends on IMDb/AWS or another accepted metadata source.

#### Remaining risk
- The movie shelf is usable, but collection credibility and valuation depth are still limited.

## Data-model risks

### JSON and D1 overlap
#### Addressed in this pass
- Inventory operations are more D1-native now.
- Notification/outbox and readiness state are now DB-backed instead of implied only in UI logic.

#### Still open
- Products, movies, tools, supplies, and featured creations still use mixed JSON and D1 paths in places.

#### Remaining risk
- Duplicate points of truth still exist and should continue to be reduced pass by pass.

### Catalog sync bridge
#### Addressed in this pass
- The bridge remains usable and inventory sync is more operationally useful.

#### Still open
- It is still a bridge and not the final authority model.

#### Remaining risk
- Sync drift and operator confusion remain possible until the final authority model is simplified.

## Customer-experience risks

### Search and product discovery
#### Addressed in this pass
- Product readiness signals now help the app know when items are closer to being storefront-ready.
- SEO/search guidance remains active across the docs.

#### Still open
- Broader category/filter depth and stronger discovery landing pages still need more work.

### Mobile and small-screen layout
#### Addressed in this pass
- Another CSS pass improved grid shrink behavior, table wrapping, and small-screen admin controls.

#### Still open
- Real-device testing still needs to continue for admin-heavy screens.

### Draft-to-publish workflow
#### Addressed in this pass
- Products now expose readiness checks and ready/not-ready flags.
- This gives the app a clearer basis for pending review vs storefront-ready behavior.

#### Still open
- Full governed approval/publish workflow is still incomplete.

## Security-forward next steps
1. Finish Stripe checkout completion and provider-confirmed reconciliation.
2. Turn notification outbox into actual receipt delivery.
3. Add stronger privileged-action confirmation for destructive operations.
4. Continue moving inventory and catalog operations toward a single D1 authority model.
5. Expand analytics into deeper attribution and conversion diagnostics.
6. Resume trusted movie metadata enrichment once IMDb/AWS access is available.


## Current pass completion update

### 1. Payment and refund safety
#### Addressed in this pass
- Added `/api/stripe-return` so Stripe Checkout can reconcile the local order and payment record when the customer lands on the confirmation page.
- Updated the confirmation page client so Stripe sessions are finalized on return instead of waiting only for webhook timing.
- Stripe webhook handling now upserts local `payment_disputes` rows for `charge.dispute.*` events, which closes the provider-confirmed dispute-sync gap on the Stripe side.
- `notification_outbox` can now be actively processed through a dispatch helper and admin endpoint instead of acting only as a passive queue.

#### Still open
- Full provider-confirmed dispute sync for non-Stripe providers still depends on provider-specific API coverage and credentials.
- Receipt delivery still depends on configured mail credentials such as Resend before it can operate in production.

#### Remaining risk
- Old historical payments that are missing provider ids can still require manual cleanup.

### 2. Admin and operational security
#### Addressed in this pass
- Sensitive destructive actions now require password confirmation via a shared admin step-up check.
- Product deletion, user deactivate/delete, media deletion, and notification cancellation/dispatch now use stronger privileged confirmation.
- Account-help requests now queue both admin-review and request-received notifications.

#### Still open
- Permission granularity still needs a broader role-by-role review beyond the current admin/member split.

#### Remaining risk
- The step-up layer is stronger than before, but broader role segmentation is still a future hardening step.

### 4. Product/media workflow
#### Addressed in this pass
- Media delete now requires step-up confirmation.
- Public creations now have a centralized `/api/creations` read path, reducing another JSON-only duplicate read path.

### 7. Reality check on "complete everything"
All code-side items that were realistically actionable inside this repo pass were moved forward in code. The one area that still cannot be honestly marked fully complete is trusted movie enrichment, because that depends on an accepted external metadata source and credentials rather than a missing local code path.

## Current pass completion update

### 3. Inventory authority
#### Addressed in this pass
- Added grouped supplier reorder suggestions directly to the inventory response so reorder work can be turned into actual supplier draft orders.
- Added `supplier_purchase_orders` and `supplier_purchase_order_items` plus `/api/admin/purchase-orders` for draft purchase-order workflow.
- Reorder drafts now stamp `last_reorder_requested_at` and keep inventory items on the reorder list.

#### Still open
- Full receiving automation that writes back ordered quantities into incoming stock is still not complete.
- Final end-to-end reservation governance across every legacy workflow still needs more UI coverage.

### 5. Analytics and funnel reporting
#### Addressed in this pass
- Visitor analytics now expose top referrers, top entry paths, and zero-result site searches.
- Dashboard summary now exposes publish-ready products, pending-review products, and active purchase-order draft counts.
- Product cost rollups now give admin a stronger basis for build-readiness-to-margin checks.

#### Still open
- Campaign attribution is stronger than before, but still not a full ad-platform attribution layer.

### Draft-to-publish workflow
#### Addressed in this pass
- Added `/api/admin/product-review-actions` for approve, needs-changes, publish, and unpublish operations.
- Added `product_review_actions` so review history is durable and auditable.
- Product list now exposes linked resource cost, rough margin, and missing-cost warnings to support better publish decisions.

#### Still open
- Role-by-role review authority is still limited by the current broad admin/member split.



## Current pass completion update

### 3. Inventory authority
#### Addressed in this pass
- Supplier purchase-order workflow now moves ordered quantities into `incoming_quantity` when a draft is marked ordered.
- Supplier purchase-order receiving now moves received quantities from incoming stock into on-hand stock and records received quantity per line item.
- Purchase-order rows now expose ordered-vs-received totals for safer receiving review.

#### Still open
- Reservation governance still needs broader UI coverage across every legacy path that can consume inventory.

### Data-model risks
#### Addressed in this pass
- Public tools and supplies now have centralized read endpoints (`/api/tools` and `/api/supplies`) that prefer D1-backed catalog rows before falling back to legacy JSON.
- Public gallery/creations reads now prefer centralized API paths before using the legacy items-for-sale JSON.

#### Remaining risk
- Mixed authority still exists in some areas, but another outward-facing JSON duplication point has been reduced.


## Current pass completion update

### 3. Inventory authority
#### Addressed in this pass
- Added product-level reservation actions so admin can reserve or release all linked tool/supply inventory for a product in one request instead of adjusting every item manually.
- Product cost rollups and product-list responses now expose `buildable_units_from_resources` and `resource_shortage_links` to make resource pressure and reservation risk more visible before publish/build decisions.
- The quick mobile-product bootstrap endpoint now uses the shared admin auth path and the correct inventory reorder field, which reduces false 500s during phone-first product entry.

#### Still open
- Reservation controls still need broader frontend coverage so every legacy UI path uses the stronger product-level reservation workflow.

### 4. Product/media workflow
#### Addressed in this pass
- Fixed the admin media asset patch route so it no longer references an undefined step-up variable.
- Added bulk media metadata/sort updates through the media-assets patch route so reorder and variant-role cleanup can be applied in batches instead of one image at a time.

### Customer-experience risks
#### Addressed in this pass
- Public tools, supplies, and creations APIs now return filter-group summaries for categories/types, which gives the storefront a stronger base for broader discovery filters and landing-page navigation.


## Current pass completion update

### 1. Payment and refund safety
#### Addressed in this pass
- Admin refund and dispute actions now try to dispatch queued receipt emails immediately after recording the local event instead of leaving all delivery to a later manual outbox sweep.
- Stripe webhook reconciliation now queues and attempts provider-confirmed dispute and refund/customer-notice emails when a matching customer email is available.

#### Still open
- Non-Stripe provider-confirmed dispute syncing still depends on provider-specific API coverage and credentials.
- Production delivery still depends on working mail credentials such as `RESEND_API_KEY` and `NOTIFICATION_FROM_EMAIL`.

### Data-model risks
#### Addressed in this pass
- Public storefront product reads now expose live filter-group summaries for category, colour, and product type directly from `/api/products`, reducing more page-level discovery guesswork.
- Public tools and supplies pages now consume their dedicated centralized APIs (`/api/tools` and `/api/supplies`) instead of the broader generic catalog endpoint, which reduces another outward-facing duplication path.

#### Remaining risk
- Products themselves are still D1-backed, but some storefront and admin workflows still need more shared API-first authority to fully retire legacy mixed paths.

### Customer-experience risks
#### Addressed in this pass
- Shop results now expose clearer discovery context from live category/colour counts.
- Outward-facing tool and supply discovery now leans on the dedicated centralized public APIs that already expose filter summaries.

## Current pass completion update

### Product/media workflow
#### Addressed in this pass
- Direct media upload can now attach an uploaded file directly into `product_images` and `product_image_annotations`, optionally set the featured image, and carry simple variant-role notes in the media record.
- Bulk product import now seeds richer finished-product records, including SEO rows, tags, category/colour/shipping fields, and extra product-image rows.
- Import preview now catches duplicate slugs, SKUs, and product numbers before insert, which reduces failed batches and cleanup work.

#### Still open
- True thumbnail/variant file generation is still not complete; this pass improved metadata/attachment lifecycle rather than image processing.



## Current pass completion update

### 3. Inventory authority
#### Addressed in this pass
- Product stock reporting now exposes `buildable_units_from_resources` and `resource_shortage_links` directly in the stock-report endpoint so build pressure is visible without switching reports.
- The admin product stock report UI now lets admin reserve or release all linked tool/supply inventory for a product in one workflow, which extends reservation governance into another real frontend path instead of leaving it API-only.

#### Still open
- Reservation controls still need to appear in every older admin workflow that can consume inventory.

### 4. Product/media workflow
#### Addressed in this pass
- Admin media asset reads now expose derived variant URL suggestions (`thumb`, `medium`, `large`, `webp`) so the storefront/media workflow has a clearer path for later variant-file rollout.
- Storefront product detail now returns grouped image data with variant-role awareness plus annotated-image grouping, which improves annotation-to-storefront usage.

#### Still open
- True generated thumbnails/variants still need actual image-processing infrastructure rather than metadata alone.

### 5. Analytics and funnel reporting
#### Addressed in this pass
- Visitor analytics now include top product-detail paths and top ordered products, giving admin stronger merchandising diagnostics around what is being viewed versus what is actually selling.
- Dashboard summary now exposes `product_build_risk_count` and duplicate-media counts for faster operational triage.

#### Still open
- Campaign attribution still is not a full ad-platform attribution layer.

### Data-model risks
#### Addressed in this pass
- Public supplies discovery now uses the centralized `/api/supplies` path end to end on the outward-facing page instead of falling back to page-level JSON reads.
- The internal tools health page now reads from `/api/tools`, which reduces another direct JSON dependency during the migration period.

#### Remaining risk
- Some mixed JSON/D1 authority still remains, especially around movies and a few legacy admin/read paths.


## Current pass completion update

### 3. Inventory authority
#### Addressed in this pass
- The admin product list now lets staff reserve or release all linked tool/supply inventory for a product directly from the main products screen, not only from the stock-report view.
- Storefront product detail now returns `build_summary` so buildable-unit pressure and shortage counts can be surfaced without a separate admin-only lookup.

#### Still open
- Some older admin and import-oriented workflows still do not expose the stronger reservation actions inline.

### 4. Product/media workflow
#### Addressed in this pass
- Storefront product detail now returns lightweight `variant_urls` hints with each storefront image so later real thumbnail/variant rollout has a cleaner contract.
- Annotated/grouped image responses now ship with build-summary context in the same payload, which reduces extra product-detail lookups in later UI work.

#### Still open
- Real generated thumbnail/variant files still require image-processing infrastructure rather than URL/metadata hints alone.

### Data-model risks
#### Addressed in this pass
- The toolshed page now reads from the centralized `/api/tools` endpoint only, instead of falling back through multiple direct JSON paths.
- Supplies discovery now uses API-provided filter groups more consistently, reducing another page-level derivation path.

#### Remaining risk
- Mixed JSON/D1 authority still remains in movies and a few legacy admin/read flows.


## Current pass completion update

### Product/mobile workflow
#### Addressed in this pass
- Mobile finished-product capture now supports partial draft entry so staff can save only a photo, a temporary name, or another identifier and move on without filling every storefront field first.
- Products now support `capture_reference`, which gives intake and follow-up work a safer temporary identifier during phone-first capture.
- Added a detailed finished-products CSV template at `/data/finished_products_import_template.csv` so large batches can be prepared with the same field names the bulk import endpoints expect.

### Movie catalog enrichment
#### Addressed in this pass
- Added an admin movie-details editor backed by `movie_catalog`, so title, year, actors, UPC, IMDb id, and alternate identifiers can now be reviewed and updated in-app instead of only through source JSON edits.
- Movie catalog rows now support `imdb_id`, `alternate_identifier`, `metadata_status`, and `collection_notes`, which creates a better path for staff-curated or visitor-contributed metadata before external enrichment is complete.

#### Still open
- Trusted bulk movie enrichment still depends on an accepted external metadata source or on locally processed enrichment files.


## Current pass completion update

### 6. Movie catalog enrichment
#### Addressed in this pass
- Reconfirmed that `movie_catalog_enriched.v2.json` remains the current movie base truth for the live shelf while local/manual movie edits are layered through D1 as an overlay rather than a full migration.
- The admin movie editing workflow now targets richer manual curation fields, including title, year, actor names, director names, metadata source/status, collection notes, rarity notes, value fields, UPC, IMDb id, alternate identifier, trailer URL, and front/back cover URLs.
- The movie handoff direction is now clearer: do not force full D1 authority for movies until the enrichment pipeline is stable and verified against the live collection file.

#### Still open
- The movie edit screen still needs to visually show every important JSON-backed field consistently, especially cover previews, summary, source/value fields, and existing metadata already present in `movie_catalog_enriched.v2.json`.
- Old D1 `movie_catalog` tables can still fail writes until compatibility upgrades finish adding every later movie column automatically.
- Trusted external movie enrichment remains dependent on the local/offline processing workflow rather than a finished in-repo provider integration.

#### Remaining risk
- If movie reads drift away from the JSON-first source too early, the live shelf can lose already-curated metadata or show incomplete cards.

### Draft-to-publish workflow
#### Addressed in this pass
- The intended phone-first product-entry direction is now explicit: new finished products must be savable as partial drafts with only a photo, only a name, only a capture reference, or any small subset of fields while the operator moves on to the next item.
- The finished-product CSV requirement is now clearer: the repo needs a detailed import template for bulk entry of completed products while still allowing draft-like partial intake where appropriate.

#### Still open
- The mobile product screen still needs to enforce the “save partial draft now, complete later” flow consistently before publish-time validation rules are applied.
- Bulk import still needs continued tuning so draft and ready-for-review rows are both handled cleanly.


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
- Mobile/admin workflow risk is reduced again because phone users now have clearer quick-action routes into Today, inventory, expenses, write-offs, product costs, and export presets instead of depending on longer department pages.
- UI cohesion risk is reduced again because the departmental launcher model is reinforced and accounting actions now have direct anchors/buttons, which lowers scroll friction on both desktop and phone screens.
- Mixed JSON/D1 authority still remains in older areas, but this pass focused on workflow usability, lighter admin navigation, and current-build synchronization rather than a deeper schema expansion.


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
- The mobile finished-product workflow is stronger because saved drafts can now be reopened and continued from the same capture screen.
- Rough per-item costing moved forward by blending direct product cost, linked resource cost, and allocated overhead into a fuller estimated unit cost view.
- Still honestly open: final true per-item overhead allocation rules, fuller P&L/reporting depth, and broader real-device stress testing on phone and desktop.

## Current pass addendum

### Accounting/reporting drift
#### Addressed in this pass
- Fixed the rough P&L drift where reporting code had been reading non-existent cents columns from `accounting_expenses` and `accounting_writeoffs`.
- Fixed the item-costing drift where reporting code had been assuming `product_costs` used `product_id` and `cost_per_unit_cents` instead of the current `product_number` and `cost_per_unit` structure.
- Added read-performance indexes for the current accounting/reporting tables so the newer phone/admin summary paths are less fragile under repeated refreshes.

#### Still open
- The current accounting layer is still intentionally rough and should not be mistaken for finished double-entry accounting.
- Overhead allocation is still revenue-share based and not a final per-item costing rule.

### Draft-to-publish workflow
#### Addressed in this pass
- Mobile draft continuation is stronger because reopened drafts now restore saved SEO fields and updated drafts stay in the same screen instead of forcing a choose-it-again loop.
- The phone dashboard now shows live draft-product visibility so staff can spot unfinished intake faster.

#### Still open
- Broader real-device stress testing is still needed on phone and desktop.
- Bulk import still needs more tuning so draft-like rows and fuller review-ready rows behave consistently.

## 2026-04-10 deploy hotfix

- Fixed a Cloudflare Pages build blocker in the accounting CSV export helpers by replacing the regex-based CSV quoting check with a simpler string-contains check.
- This hotfix does not change the database shape. Schema files remain current for this pass because no SQL migration was required.

## Current pass addendum

### Data-model risks
#### Addressed in this pass
- The public gallery and creations flows now lean on `/api/creations` instead of maintaining another direct page-level JSON read path.
- The public tools page now treats `/api/tools` as its page authority instead of loading the legacy tools JSON directly inside the page.
- `accounting-summary` now reuses the shared accounting schema helper, which removes another internal code/schema duplication point.

#### Still open
- Mixed JSON/D1 authority still remains in movies, social feed content, and a few older admin/read flows.

### Mobile and small-screen layout
#### Addressed in this pass
- The phone dashboard now shows open accounting-record counts plus paid, outstanding, and tax-liability snapshot values without forcing a jump to the full accounting department first.

#### Still open
- Real-device stress testing still needs a fuller pass on phone and desktop, especially around long admin lists, reorder actions, and accounting-heavy views.

## Current pass completion update

### 1. Runtime resilience and fallback
#### Addressed in this pass
- The shop, movie shelf, social hub, and phone dashboard now keep a last-good client snapshot so temporary API or D1 issues do not always leave a blank page.
- Added `/api/admin/runtime-incidents` so fallback/error visibility is no longer limited to raw DB inspection.
- Public products and movies now emit clearer diagnostics and runtime-incident records when their richer live query path drifts.

#### Still open
- Cached fallback is stronger on the public side than before, but broader admin/order/payment coverage still needs another pass.
- Runtime incidents are visible, but there is not yet a full acknowledge/resolve/retry workflow in the admin UI.

#### Remaining risk
- Cached snapshots keep the site usable, but they are still snapshots and can become stale until live reads recover.

### Data-model risks
#### Addressed in this pass
- The social hub now reads through `/api/social-feed` rather than fetching its JSON file directly in the browser.

#### Still open
- Movies remain intentionally JSON-first with D1 overlay.
- Mixed JSON and D1 authority still remains in older/internal paths and should keep shrinking pass by pass.

## Current pass completion update

### 1. Admin order and payment fallback coverage
#### Addressed in this pass
- Admin orders now has a fallback query if the richer payment-rollup query fails.
- Admin order detail now returns partial data instead of failing the whole modal when item or history reads drift.
- Admin order payments now returns safe empty refunds/disputes/payments sections when one supporting table fails.
- The browser now keeps last-good order list and order-detail snapshots so day-to-day admin work can continue during API drift.

#### Still open
- destructive/write paths such as refunds, disputes, and payment-entry flows still need broader replay/fallback coverage
- operator-facing retry flows for partial-write failures still need another pass

#### Remaining risk
- admin work is safer than before, but stale cached order data can still require a manual refresh once the live endpoint recovers


### Admin order/payment write resilience
#### Addressed in this pass
- Order status updates, manual payment recording, and refund/dispute actions now capture more server-side runtime incidents with clearer scope codes.
- The admin order-detail screen now keeps failed write attempts locally so staff can retry them without re-entering everything.
- Phone health summary now surfaces admin write incident counts plus local saved fallback actions in the current browser.

#### Still open
- Saved local fallback actions are browser-local and still need a broader replay/queue model if the same work should move across devices or staff sessions.
- More admin write flows outside order detail still need the same preserved-intent fallback pattern.

#### Remaining risk
- This is safer than a pure hard-fail flow, but it is not yet a full durable cross-device operations queue.

## Latest pass update

- The earlier browser-only fallback-action limitation has been reduced: failed admin order/payment writes can now be saved into a shared D1-backed queue and replayed from another signed-in device.
- Browser-local fallback still remains intentionally as the last safety net when the shared queue itself cannot be reached, so the old limitation is not completely gone yet.
- Remaining honest open items still include rough overhead allocation, incomplete deeper accounting, movie JSON-first authority, and real phone/desktop stress testing.

## Current pass update

### 7. Public social hub reliability
#### Addressed in this pass
- `/api/social-feed` now derives YouTube thumbnail URLs and fallback candidates from each video id.
- The social hub page now renders thumbnail cards with image fallback rotation instead of depending only on embedded iframes.

#### Still open
- The social feed is still a curated/manual source rather than a provider-approved auto-ingest.

### 8. Shared admin replay queue coverage
#### Addressed in this pass
- Shared replay coverage now includes failed product review actions (`approve`, `request_changes`, `publish`) from the catalog/products workflow.
- The products screen now keeps shared queued review actions visible and retryable, with browser-local fallback kept only when the shared queue cannot be reached.

#### Still open
- Broader write-path replay still needs to spread into more admin workflows such as media, inventory, and supplier operations.

### 9. Rough accounting realism
#### Addressed in this pass
- `/api/admin/accounting-item-costing` now uses the shared costing engine so overhead can follow basis-aware pools and expose sold-unit/order context plus rough recognized COGS.

#### Still open
- This is still rough operational accounting rather than final per-item accounting or true double-entry.

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

### Product numbering drift
#### Addressed in this pass
- The phone-first capture path no longer starts at `1`; it now respects a DD-series floor of `1000`.
- The standard create-product API now uses the same next-number rule instead of leaving product numbers blank unless supplied manually.

#### Still open
- Imports and any external/manual backfill workflow still need the same DD-series guardrail review so older numbering cannot be reintroduced by batch operations.


## Current pass update

### Product pricing controls
#### Addressed in this pass
- Single-item price edits remain available in the standard product editor.
- Bulk pricing now supports three scopes: selected product IDs, one product category, or the entire product catalog.
- Bulk pricing now supports preview-before-save so broad repricing can be checked safely before commit.
- The previous bulk-control risk where shipping/tax flags could be changed accidentally during unrelated bulk edits was corrected.

#### Still open
- Bulk cost updates for `site_item_inventory` are still not in the same category/all-items pattern yet.
- Product-price automation based on cost deltas, tariff percentages, or target margin rules is still future work.

#### Remaining risk
- Selling-price control is materially better now, but cost-side repricing still needs another pass before the full price-to-cost workflow can be called mature.

## 2026-04-13 pass update
- Repaired the phone capture next-number display so the admin UI now shows `DD1000`-style labels instead of a bare numeric value when the next product number is loaded.
- Restored stronger public social discovery by adding the Socials route back into the shared navigation/footer and hydrating the footer profile list from `/api/social-feed` instead of keeping another hard-coded duplicate set of links.
- Added a catalog-side **Brand, Socials & Creations** helper so reusable brand images can be uploaded as standalone brand assets and the current public social links can be verified from admin.
- Confirmed that public gallery and creations are still fed through the finished-product plus catalog-sync flow; a fully separate creations-only editor remains a next-step item rather than a completed interface.

## Current pass completion update

### 3. Inventory authority
#### Addressed in this pass
- Added a bulk unit-cost update workflow for `site_item_inventory` with preview support before save.
- Inventory costs can now be updated by selected ids, by category, by source type, or across the whole inventory for tariff, shipping, packaging, or supplier cost increases.
- The new cost-update path writes admin audit records and movement-log notes so pricing-side and costing-side changes are easier to trace later.

#### Still open
- Finished-product repricing is still a separate workflow from resource-cost updates, so full automatic margin re-evaluation is not complete yet.

#### Remaining risk
- Cost authority is stronger than before, but operator judgement is still required to decide when inventory cost changes should also trigger storefront price changes.

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
