# Testing Checklist

Last refreshed: **2026-05-19a**

## Automated checks

Run from repo root when local tools are available:

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

- Open Admin on desktop.
- Open Admin on phone-width viewport.
- Confirm the compact mobile menu expands/collapses.
- Confirm Admin section menu does not become one long phone list.
- Expand App Health diagnostics drawer.
- Confirm stale-data badges wrap cleanly.
- Use Retry Health, Refresh Staff Only, Refresh Jobs Only, and Retry Accounting.
- Confirm one H1 remains on the exposed app shell.
