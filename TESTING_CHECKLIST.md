# Testing Checklist

Last refreshed: **2026-05-18a**

## Automated checks run this pass

- `node --check js/admin-ui.js`
- `node --check js/api.js`
- `node --check js/reports-ui.js`
- `node --check js/jobs-ui.js`
- `node --check js/hse-ops-ui.js`
- `node --check js/logbook-ui.js`
- `node --check app.js`
- `node --check server-worker.js`
- `node scripts/repo-smoke-check.mjs`
- Checked Edge Function newline escaping for `admin-manage` and `report-subscription-delivery-run`
- One-H1 check on `index.html`
- CSS brace balance check on `style.css`

## Manual checks after deploy

1. Admin loads live data without immediately using cached fallback.
2. Staff Directory search/filter/sort/paging works on desktop and mobile.
3. Jobs/Operations search/filter/sort/paging works on desktop and mobile.
4. Refresh Staff Only and Refresh Jobs Only work.
5. Command Center and Health panels can be refreshed separately.
6. Mobile main menu remains compact and expandable.
