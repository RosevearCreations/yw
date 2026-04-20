# Local SEO Playbook (Devil n Dove)


## Current pass update

- Repaired the phone product-capture save route so it resolves the shared D1 binding through `DB` or `DD_DB` instead of assuming one binding name.
- The mobile save endpoint now returns structured JSON failures and records a runtime incident when the save path breaks unexpectedly.
- The phone product-capture page now parses failed responses safely, so HTML 500 pages no longer surface as `Unexpected token '<'` in the admin UI.
- Rechecked outward-facing HTML pages and the one-H1 rule remains intact across the current public page set.

This checklist focuses on **local discovery** without risky keyword stuffing. It is meant to be used alongside the site's existing SEO fields.

## Quick wins (1–2 hours)

1. **Google Business Profile (GBP)**
   - Claim/verify it
   - Use accurate categories
   - Add photos regularly (workshop, finished pieces, behind-the-scenes)
   - Ensure hours, phone, and website are consistent

2. **Consistency (NAP)**
   - NAP = Name, Address, Phone.
   - Keep this consistent across GBP, website contact page, Facebook page, and listings.

3. **Local landing content (no stuffing)**
   - Add 1–2 short paragraphs on the contact/about pages describing:
     - where you are (region, not full address if home-based)
     - what you make (jewelry, custom work, casting, engraving)
     - what customers can do next (contact, shop, request custom)

4. **Site basics**
   - Ensure every page has:
     - one clear H1
     - a unique title and meta description
     - fast image loading (avoid oversized images)

## Next layer (half day)

1. **Add a location/service area section**
   - Example: “Serving Southern Ontario, including …”
   - Keep it short and real.

2. **Structured data (JSON-LD)**
   - If you have a public storefront address, you can add LocalBusiness schema.
   - If you are home-based, use a service-area approach and avoid publishing a private address.

3. **Reviews workflow**
   - Ask for reviews after delivery.
   - Reply to every review.

## Search engine criteria tuning in this repo

- Use product SEO fields (`product_seo`) for:
  - descriptive titles (what it is + material + style)
  - plain-language descriptions
  - keywords that match how people search

Examples of safe keyword patterns:
- “sterling silver ring”, “custom engraved pendant”, “lost wax casting”, “wax carving”, “laser engraving”

Avoid:
- repeating city names everywhere
- copying the same meta description across pages

## Measurement

- Track:
  - impressions/clicks from Search Console
  - GBP searches and actions
  - top pages and queries

## Notes

Local SEO is mostly consistency + trust + relevance. The site can support that, but GBP + reviews + strong product pages are usually the biggest drivers.


## Current pass local SEO reminder
- Keep page titles and meta descriptions localized and natural for Southern Ontario intent rather than stuffing repeated city names.
- Continue using dedicated public landing pages and clean department/admin separation so private routes stay non-indexed and public content remains easier for crawlers to understand.


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
- Continue prioritizing clear mobile entry points and task-oriented navigation because better mobile experience improves engagement and local conversion signals.

## Current pass addendum
- Reinforced Southern Ontario / Canada relevance in key public-page descriptions so the public copy stays closer to the real regional service/workshop identity.
- About and Contact now carry a stronger Organization/LocalBusiness structured-data graph tied to the public site identity, region, and social profiles.
- Keep validating structured data against visible page content and avoid adding location precision that the public pages do not actually support.

## 2026-04-10 deploy hotfix

- Fixed a Cloudflare Pages build blocker in the accounting CSV export helpers by replacing the regex-based CSV quoting check with a simpler string-contains check.
- This hotfix does not change the database shape. Schema files remain current for this pass because no SQL migration was required.

## Current pass note

- Continue preferring centralized API-backed public catalog reads over page-local JSON reads because consistent shared content sources reduce title/body drift and make future local-search improvements easier to manage across pages.



## Current pass update
- SEO work remains paired with reliability work: if a page can keep rendering with a safe fallback, search users and direct visitors are less likely to hit dead-end empty experiences.
- Continue keeping one clear H1 per exposed page, descriptive titles/meta, and locally relevant wording while the fallback/runtime hardening work continues underneath.

## Current pass SEO note
- This pass kept the one-clear-title pattern on exposed pages while improving runtime resilience, which helps avoid blank/failed catalog screens that can hurt user trust and crawl usefulness.
- Shop and movie shelf fallback now preserve descriptive page content more reliably during temporary endpoint problems.

## Current pass note

This pass was mostly admin-resiliency work. Keep the usual one-H1, descriptive title, and local-service wording habits unchanged while order/payment fallback hardening continues in the back office.

## Latest pass note

- SEO work this pass stayed focused on preserving one clear H1 per public page and avoiding layout/fallback regressions while the admin resilience layer was expanded.

## Current pass note
- The public social hub now uses API-backed thumbnail cards for YouTube content, which keeps the page more stable and more descriptive for visitors while preserving the one-clear-title rule on exposed pages.

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

- The public-page audit for this pass still shows one H1 per exposed HTML page.
- The offline fallback page now includes a description/canonical/Open Graph block so even non-indexed fallback shells stay structurally tidy and easier to maintain.
- Continue prioritizing clear page titles, visible main headings, and Southern Ontario wording that matches how real shoppers search.


## Current pass addendum
- Another exposed-page audit confirmed the current HTML pages still keep the one-H1 rule.
- Continue matching page titles, main headings, and visible copy to plain-language product and local-intent terms rather than stacked or repetitive headings.

## 2026-04-13 pass update
- Repaired the phone capture next-number display so the admin UI now shows `DD1000`-style labels instead of a bare numeric value when the next product number is loaded.
- Restored stronger public social discovery by adding the Socials route back into the shared navigation/footer and hydrating the footer profile list from `/api/social-feed` instead of keeping another hard-coded duplicate set of links.
- Added a catalog-side **Brand, Socials & Creations** helper so reusable brand images can be uploaded as standalone brand assets and the current public social links can be verified from admin.
- Confirmed that public gallery and creations are still fed through the finished-product plus catalog-sync flow; a fully separate creations-only editor remains a next-step item rather than a completed interface.

## Current pass note
- Public HTML pages were rechecked for the one-H1 rule in this pass and the current exposed pages still return one main heading each.
- Keep continuing the existing pattern of descriptive titles, concise meta descriptions, and Southern Ontario wording on public collection and company pages.

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
