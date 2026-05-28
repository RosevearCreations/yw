# Testing Checklist

Last refreshed: **2026-05-27a**

## Automated checks

Run:

```text
node --check js/mobile-menu.js
node --check js/mobile-today.js
node --check js/outbox.js
node --check js/router.js
node --check js/security.js
node --check js/api.js
node --check js/admin-ui.js
node --check app.js
node --check server-worker.js
node scripts/repo-smoke-check.mjs
```

## Manual mobile checks

- Open `/#today` on phone width.
- Confirm Today cards are stacked and easy to tap.
- Confirm quick nav remains compact and fixed at the bottom.
- Confirm queued forms/actions show badges.
- Confirm PWA install helper appears when the app is not installed.
- Confirm Today, Talk, Incident, Safety, Jobs, and Admin quick links route correctly.
- Confirm old service worker cache does not keep older `2026-05-26a` assets.
