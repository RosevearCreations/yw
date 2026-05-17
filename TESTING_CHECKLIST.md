# Testing Checklist

Last refreshed: **2026-05-17a**

## Automated checks

```bash
node --check js/admin-ui.js
node --check js/api.js
node --check js/reports-ui.js
node --check js/jobs-ui.js
node --check js/hse-ops-ui.js
node --check js/logbook-ui.js
node --check app.js
node --check server-worker.js
node scripts/repo-smoke-check.mjs
```

## Manual checks

1. Open Admin at desktop width.
2. Confirm Staff Directory sort and direction controls work.
3. Confirm Staff paging labels and buttons work.
4. Confirm Jobs/Operations toolbar is visible.
5. Confirm Jobs search, sort, direction, rows, previous, and next work.
6. Save an Admin view with Staff and Jobs filters.
7. Press **Use** on that saved view and confirm both toolbars restore.
8. Open at phone width and confirm controls stack cleanly.
9. Confirm there is only one H1 in the exposed app shell.
10. Confirm Admin Health shows schema 112 after SQL deploy.
