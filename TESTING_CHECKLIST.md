# Testing Checklist

Last refreshed: **2026-05-28a**

## Smoke tests

- `node --check js/mobile-menu.js`
- `node --check js/mobile-today.js`
- `node --check js/mobile-form-helper.js`
- `node --check js/outbox.js`
- `node --check js/router.js`
- `node --check js/security.js`
- `node --check js/api.js`
- `node --check js/admin-ui.js`
- `node --check app.js`
- `node --check server-worker.js`
- `node scripts/repo-smoke-check.mjs`

## Manual mobile tests

1. Open `#today` at phone width.
2. Open Toolbox Talk, enter a site/topic, and press Save Draft.
3. Return to Today and confirm saved draft count appears.
4. Reopen Toolbox Talk and press Resume Draft.
5. Repeat a quick draft/resume check on Incident / Near Miss.
6. Confirm the quick-action bar remains usable and does not cover submit buttons.
7. Confirm visible copy uses Ontario OHSA / Ontario workplace-safety wording.
8. Confirm exposed app shell still has one H1.
