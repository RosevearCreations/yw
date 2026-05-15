# Testing Checklist

Last refreshed: **2026-05-15a**

## Static checks

```bash
node --check js/api.js
node --check js/admin-ui.js
node --check js/reports-ui.js
node --check js/jobs-ui.js
node --check js/hse-ops-ui.js
node --check app.js
node --check server-worker.js
node scripts/repo-smoke-check.mjs
```

## App shell checks

- `index.html` has no more than one `<h1>`.
- All script/style references use `2026-05-15a`.
- Service worker cache name is `ywi-shell-v2026-05-15a`.
- No retired root Markdown is active in the root.
- No `test_write*` files exist in active root.
- Old `VerifyDB_24_04_2026.sql` is archived, not active in `sql/`.

## Admin checks

- Admin loads without reports timeout.
- Command Center cards render.
- Health and Schema Center shows schema 106 after migration.
- Admin Task Inbox renders rows or clear empty state.
- Clear Local Diagnostics button works.
- Reload button still refreshes admin data.
- Accounting manager still opens payment applications, close controls, reconciliation, and package queues.

## SEO checks for exposed pages

- One visible H1 per page.
- Descriptive title.
- Helpful meta description.
- Local/service terms in title or main heading only where accurate.
- Image alt text for meaningful images.
- No broken assets.
