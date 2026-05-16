# Changelog

Last refreshed: **2026-05-16a**

## 2026-05-16a

1. Added a compact mobile main-menu toggle in `index.html` so phones no longer load a long list of navigation pills by default.
2. Added `js/mobile-menu.js` to manage open/close state, `aria-expanded`, current-section label, outside-click close, Escape close, and route-change sync.
3. Added mobile CSS for a two-column expanded menu, one-column fallback on very narrow screens, scroll-safe menu height, and touch-friendly 44px controls.
4. Updated the service worker app shell to cache `js/mobile-menu.js` and bumped the static cache to `2026-05-16a`.
5. Converted the Admin section menu into a compact expandable phone menu with a current-section label.
6. Kept the Admin section pills visible and wrapped on desktop while hiding them behind a single toggle on small screens.
7. Added mobile header polish so the title, session name, and buttons do not crowd the top of the screen.
8. Added schema 110 as a safe frontend quality-gate marker for mobile navigation, one-H1, cache version, and active Markdown readiness.
9. Added `app_frontend_quality_gates` and `v_mobile_navigation_quality_gates` for DB-backed UI quality tracking.
10. Updated `v_schema_drift_status` to expect schema 110.
11. Updated `admin-directory` to load `v_mobile_navigation_quality_gates` when schema 110 is present.
12. Updated the canonical schema reference through schema 110.
13. Updated the repo smoke check to require the mobile menu file, mobile menu script reference, mobile CSS collapse rules, compact Admin section toggle, schema 110, and the updated archive path.
14. Archived the current Markdown snapshot under `archive/markdown-current-snapshot-2026-05-16a/`.
15. Retired reintroduced root Markdown files back into `archive/markdown-retired-2026-05-16a/`.
16. Removed reintroduced `test_write` temporary files from the active root.
17. Verified the exposed app shell still has exactly one H1.
18. Kept the SEO title/description direction intact while improving mobile usability for mobile-first indexing.
19. Updated all active root Markdown handoff files for the mobile UX/schema 110 pass.
20. Updated docs with a mobile navigation/responsive UX note and refreshed the roadmap/gaps for the next pass.

## Deploy notes

- Apply SQL through schema **110**.
- Redeploy changed Supabase function: `admin-directory`.
- Clear/hard refresh the service worker cache after deployment.
- Test mobile layout under 760px and Admin section layout under 720px.
