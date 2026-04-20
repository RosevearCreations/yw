# Craft Commerce Benchmarks

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
