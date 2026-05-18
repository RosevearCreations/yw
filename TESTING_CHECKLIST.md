# Testing Checklist

Last refreshed: **2026-05-17b**

## Automated

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

## Manual

- Confirm only one H1 in `index.html`.
- Confirm CSS brace count matches.
- Confirm mobile main menu collapses/expands.
- Confirm Admin section menu is compact on phone width.
- Confirm Staff panel-only refresh.
- Confirm Jobs panel-only refresh.
- Confirm Jobs review table row actions stack on mobile.
- Confirm old retired Markdown and test files are not active in the root.
