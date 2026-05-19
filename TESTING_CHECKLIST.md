# Testing Checklist

Last refreshed: **2026-05-18b**

## Automated checks run before ZIP handoff

```text
node --check js/mobile-menu.js
node --check js/api.js
node --check js/admin-ui.js
node --check js/reports-ui.js
node --check js/jobs-ui.js
node --check js/hse-ops-ui.js
node --check js/logbook-ui.js
node --check app.js
node --check server-worker.js
node scripts/repo-smoke-check.mjs
```

## Manual checks after deployment

- Confirm `index.html` has no more than one `<h1>`.
- Confirm the mobile main menu is compact and expandable.
- Confirm Admin opens with staged live panel calls instead of only cached data.
- Confirm the Health panel shows per-scope timing cards.
- Confirm the new panel retry buttons work on phone width.
- Confirm report delivery Edge Function deploys cleanly.
