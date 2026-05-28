# Testing Checklist

Last refreshed: **2026-05-26a**

## Automated checks run for this pass

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

## Manual checks after deploy

1. Open the app on a phone-width viewport.
2. Confirm the main menu is compact and expandable.
3. Confirm the bottom quick-action bar shows Talk, Incident, Safety, Jobs, and Admin.
4. Confirm quick-action links change routes and the active state follows the current route.
5. Confirm visible safety wording uses Ontario OHSA / workplace safety wording.
6. Open Admin > Readiness and confirm schema 120 mobile/wording gates load.
7. Confirm no extra public H1 tags were introduced.
8. Clear service worker cache if older assets continue loading.
