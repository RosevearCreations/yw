# Testing Checklist

Last refreshed: **2026-05-16b**

## Automated checks

```bash
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

## Manual checks

- Mobile main menu is compact by default.
- Mobile Admin section menu is compact by default.
- Staff Directory search filters the returned people list.
- Staff Directory role filter works.
- Staff Directory page-size selector changes loaded row count.
- Previous/Next buttons update the page label.
- Saved admin view replays Staff Directory search/role/page size.
- Admin Health shows schema 111 after SQL is applied.
- `index.html` still has no more than one H1.

## CSS drift check

Confirm CSS brace counts match and mobile controls stack under 760px.
