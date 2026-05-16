# Testing Checklist

Last refreshed: **2026-05-16a**

## Code checks

- [ ] `node --check js/mobile-menu.js`
- [ ] `node --check js/api.js`
- [ ] `node --check js/admin-ui.js`
- [ ] `node --check js/reports-ui.js`
- [ ] `node --check js/jobs-ui.js`
- [ ] `node --check js/hse-ops-ui.js`
- [ ] `node --check js/logbook-ui.js`
- [ ] `node --check app.js`
- [ ] `node --check server-worker.js`
- [ ] `node scripts/repo-smoke-check.mjs`

## Manual mobile checks

- [ ] At phone width, the main nav is collapsed behind one Menu button.
- [ ] Menu expands and closes after choosing a route.
- [ ] Current route label updates in the Menu button.
- [ ] Escape key and outside click close the menu.
- [ ] Admin section menu is collapsed on phones and expands cleanly.
- [ ] Header session name and buttons do not overflow.
- [ ] Service worker loads `2026-05-16a` assets after hard refresh.
- [ ] Exposed app shell still has one H1.

## Admin/backend checks

- [ ] Apply schema **110**.
- [ ] Admin Health shows schema **110** current.
- [ ] `v_mobile_navigation_quality_gates` returns rows.
- [ ] Existing schema 109 panels still load.
