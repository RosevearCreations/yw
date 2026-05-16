# YWI HSE / Operations App

Last refreshed: **2026-05-16a**  
Latest schema: **110**

This build moves the app another step toward a production-style operations backend while fixing the immediate mobile usability issue: the main menu no longer opens as a long list on phones. The mobile header and Admin section navigation now use compact expandable controls.

## Current status

- Frontend cache/build version: `2026-05-16a`
- Latest migration: `sql/110_mobile_navigation_quality_gates.sql`
- Main UX fix: compact expandable mobile main menu and Admin section menu.
- Exposed app shell has one `<h1>`.
- Retired root Markdown and temporary test files were removed from the active root again.
- Active docs and schema references are current through schema **110**.

## Deploy order

1. Apply SQL migrations through schema **110**.
2. Redeploy changed Supabase function: `admin-directory`.
3. Deploy the static app files.
4. Hard refresh or clear the service worker cache if older assets keep loading.
5. Run `node scripts/repo-smoke-check.mjs` before treating the build as ready.

## SEO rule kept each pass

Keep one clear H1 per exposed public page. Use normal search terms in titles, headings, alt text, and helpful links. Local discovery work should keep relevance, distance, and prominence signals clear. Mobile layout matters because Google uses mobile-first indexing.

References:
- Google Search Essentials: https://developers.google.com/search/docs/essentials
- Google title-link guidance: https://developers.google.com/search/docs/appearance/title-link
- Google Business Profile local ranking: https://support.google.com/business/answer/7091
- Google mobile-first indexing: https://developers.google.com/search/docs/crawling-indexing/mobile/mobile-sites-mobile-first-indexing
