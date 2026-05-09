> Current pass update — storefront/catalog work in this pass adds public colour badges/filters and stronger catalog cleanup controls while the main implementation effort stayed on accountant-facing reconciliation/import work.

> Current pass update — sanity pass focused on product-creation multi-colour support, a compact catalog inventory column, and clearer next-step prioritization around accountant handoff, reconciliation depth, catalog UX, and local-search discovery.

## Current pass update — 2026-05-03
- Added a DB-backed/admin-managed community-content layer for public `Events` and `Pickup` pages so local-market dates, pickup guidance, and sales-channel notes are no longer limited to hard-coded page copy.
- Added `community_events` and `pickup_profiles` plus admin operations controls, a public `/api/community-content` endpoint, and runtime-safe fallbacks when the DB is unavailable.
- Kept this pass aligned with local-search trust/discovery work by surfacing Southern Ontario / Tillsonburg / Oxford County pickup and market language through admin-managed public content while preserving one public H1 per page.

## Current pass update — 2026-04-29
- Added customer-engagement automation timing rules so review-request and checkout-recovery flows can store send-after thresholds, max-age windows, and status filters instead of relying only on hard-coded automation timing.
- Added public `Events` and `Pickup` pages plus stronger internal links from Home, Shop, Product, Collections, Marketplaces, About, and Creations so local buyers can understand market/event context, pickup questions, and support paths sooner.
- Kept this pass small on schema shape: one new automation-settings table plus doc/schema sync, while storefront discovery/trust work stayed page-level.

# Current pass note — 2026-04-25

## Current pass update — 2026-04-28
- Added dedicated public `Collections` and `Marketplaces` pages so handmade work, vintage/collectible stock, hybrid/external listings, and pickup/support questions are easier to understand before a shopper opens one product.
- Expanded shared navigation/footer plus Home, Shop, About, Creations, and product-detail trust links so collection paths, provenance/condition guidance, and sale-channel explanations stay visible earlier in the browse flow.
- Kept this pass schema-light on purpose: no new required tables were added, but the schema reference files were refreshed to record that this pass is a discovery/trust/local-SEO storefront pass rather than a DB-shape change pass.

The roadmap continues to favor trust, policy clarity, image quality, and slow accounting hardening. This pass focused mainly on the accounting hardening layer so the next public-commerce pass can build on a cleaner backend.

# Current pass update — 2026-04-24

- This pass adds craft-commerce next steps drawn from Etsy/Shopify/Google guidance into the benchmark stack: clearer policy visibility, stronger first image + lifestyle mix, better About/process trust, and clearer accountant-facing operations support.

# Craft Commerce Benchmarks


## Current pass update — 2026-04-24
- Added a real phone-first basic draft wizard to `/admin/mobile-product/` so quick entries can be saved with just name, short description, price, quantity, and 1 to 5 pictures.
- Added a same-day draft review table on the phone capture screen so today’s entries can be reopened individually or updated in bulk before the desktop cleanup pass.
- Added mobile-capture metadata on `products` (`capture_entry_mode`, capture actor ids, start/save timestamps) so today filtering and phone workflow history are less dependent on loose `updated_at` guesses.
- Kept SEO/local-search hygiene in the pass by preserving one clear public H1 per page, keeping prominent title/main-heading wording aligned, and tightening docs/schema sync around the new phone/accounting workflow.


## What stronger craft and art storefronts tend to do well

- Put product photography first, especially the lead image and consistent image shape.
- Show clearer maker-story context so the shop feels personal and credible instead of generic.
- Use reviews, ratings, testimonials, and recent-customer trust signals.
- Offer wishlists, saved favorites, or back-in-stock style follow-up paths.
- Use gift cards and seasonal / launch collections to raise average order value.
- Explain shipping, turnaround, personalization, and materials in plain language.
- Reuse social proof and brand imagery across product, gallery, about, and homepage areas.

## Direct ideas to carry into Devil n Dove

1. Add a stronger homepage trust band:
   - handmade in Ontario
   - family-run / maker-led
   - custom and one-off pieces
   - shipping or pickup clarity

2. Add richer product-page sections:
   - materials used
   - making story / tools and supplies used
   - personalization / custom notes
   - turnaround time
   - care instructions

3. Add retention features:
   - wishlist / favorites
   - back-in-stock or notify-me
   - gift cards
   - launch / collection signup

4. Add stronger merchandising:
   - featured collections
   - new releases
   - seasonal collections
   - best sellers
   - low-stock / made-in-small-batches cues where truthful

5. Add stronger proof:
   - review requests and review display
   - short shop-story blocks on product and collection pages
   - gallery cross-links from product pages
   - social/short-video embeds where performance allows

## Inventory / costing interpretation for craft supplies

- Stock unit = the container or count you buy/store, such as a block, spool, bag, bottle, or bar.
- Usage unit = the amount a finished item consumes, such as a cup, wick, gram, or one use.
- Usage units per stock unit = how many usage units live inside one stock unit.

Examples:
- wax block: 1 block = 20 cups
- wick bag: 1 bag = 100 wicks
- PLA spool: 1 spool = 1000 grams

This model is the current recommended direction for Devil n Dove because it is understandable to operators and flexible enough for costing, planning, and future accounting rollups.

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


## Craft-site benchmark additions for this pass

- Keep the first product image extremely clear and use additional image slots for detail + lifestyle/context, not only repeated record shots.
- Put shipping, returns, custom-order timing, and FAQ answers closer to the product and cart flow instead of leaving them buried in standalone pages.
- Keep the About/process/workspace story current, with real photos of the makers, process, and workspace, because handmade shoppers use that to judge trust and authenticity.
- Use cohesive collections/category pages that tell a style story instead of only a flat catalog grid.
- Treat reviews, testimonials, and repeat-customer reassurance as merchandising blocks, not only as a single reviews page.
- Keep year-end accounting exports and mapping review visible inside admin so bookkeeping cleanup is not left to memory at tax time.


## Pass 99 benchmark note

Patterns now being implemented from handmade/crafter commerce review:
- keep shipping, returns/support, and custom-order timing closer to product and cart decisions
- keep maker/process/workshop context visible instead of only using generic catalog copy
- keep first-image quality strong while requiring at least one contextual/detail/process shot in fuller galleries
- keep collection/style/theme browsing visible so shoppers do not start from a blank grid every visit

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
