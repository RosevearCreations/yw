# Mobile Navigation and Responsive UX

Last refreshed: **2026-05-16a**

## What changed

The mobile main menu is now compact by default. Instead of showing every route as a long list on phone screens, the header shows one **Menu** button with the current section name. Tapping it expands the navigation into touch-friendly links.

The Admin section navigation now follows the same idea on phones. It shows one **Admin sections** button with the current section name, then expands only when needed.

## Files involved

- `index.html`: adds `#mainMenuToggle` and `#mainNav`.
- `js/mobile-menu.js`: handles menu state, current label, route sync, Escape close, outside-click close, and mobile/desktop resize behavior.
- `style.css`: adds mobile collapsed/expanded menu styles.
- `js/admin-ui.js`: renders compact Admin section navigation on phones.
- `server-worker.js`: caches `js/mobile-menu.js` and uses cache version `2026-05-16a`.
- `sql/110_mobile_navigation_quality_gates.sql`: records frontend quality gates for mobile navigation and schema tracking.

## Manual test

1. Open the app at phone width, under about 760px.
2. Confirm the top navigation is one Menu button, not a long list.
3. Tap Menu and confirm the route buttons expand.
4. Tap a route and confirm the menu closes.
5. Open Admin under about 720px.
6. Confirm Admin section buttons are behind one expandable control.
7. Confirm the desktop menu still appears normally on wider screens.
