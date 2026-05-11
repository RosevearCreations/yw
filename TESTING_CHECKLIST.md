# Testing Checklist

Last refreshed: **2026-05-10**

## Automated checks

```bash
node --check js/api.js
node --check js/reports-ui.js
node --check js/admin-ui.js
node --check js/jobs-ui.js
node --check js/hse-ops-ui.js
node --check js/logbook-ui.js
node --check app.js
node --check server-worker.js
node scripts/repo-smoke-check.mjs
```

## Browser smoke test

| Area | What to check |
| --- | --- |
| App shell | Loads without missing CSS/JS/icon errors |
| Header/nav | Only one visible app-shell H1 exists |
| Login | Sign in, sign out, settings/profile access |
| Admin | Opens without Reports timeout |
| Reports | Lazy-loads only on `#reports` or Reload Reports |
| Jobs | Jobs screen opens and handles empty/error state |
| HSE Ops | HSE dashboard opens and handles empty/error state |
| Forms | Toolbox, PPE, First Aid, Incident, Inspection, Drill open on phone width |
| Offline/outbox | Failed save is visible and recoverable |
| Service worker | Cache version is current and stale files are not served |

## Accounting workflow test data

Create or verify sample records for:

- one customer invoice;
- one customer payment;
- one vendor bill;
- one vendor payment;
- one GL batch with balanced lines;
- one bank reconciliation session;
- one sales tax review period;
- one payroll remittance review period;
- one accountant handoff export package;
- one close period lock/reopen test.

## CSS/mobile drift checks

- Test at phone width, tablet width, and desktop width.
- Check long admin forms for overflow, unreadable dropdowns, and excessive vertical spacing.
- Check sticky headers/buttons do not cover form fields.
- Check contrast on cards, dropdowns, warning messages, and disabled buttons.

## SEO checks for exposed pages

- One H1 per exposed page.
- Unique, clear page title.
- Meta description present where a public page exists.
- Local service wording appears naturally in title/headings/body when relevant.
- Images have useful alt text where public-facing.
