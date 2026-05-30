# Testing Checklist

Last refreshed: **2026-05-29a**

## Required local checks

- `node --check js/jobs-ui.js`
- `node --check app.js js/api.js js/admin-ui.js js/mobile-menu.js js/mobile-today.js js/mobile-form-helper.js`
- CSS brace-balance check on `style.css`
- Public H1 count check for `index.html`
- `node scripts/repo-smoke-check.mjs`

## Required live equipment test

1. Apply schema 123 and redeploy Edge Functions.
2. Save an equipment item with Home Site, Current Site, and Destination Site.
3. Check the item out to a job and confirm checkout test/status saves.
4. Use Verify Arrival / Site Test and confirm transfer history updates.
5. Return the item and confirm it appears as returned pending review or issue.
6. Use Mark Return Verified and confirm it clears from exceptions when tests pass.
7. Repeat with damage reported or failed test and confirm lockout/exception behavior.

## Required public/app shell checks

- One H1 only on exposed/public pages.
- Title and meta description remain clear.
- Cache marker shows **2026-05-29a** in `index.html` and `server-worker.js`.
- Phone-width forms and Equipment panel remain usable without horizontal page drift outside intended tables.

<!-- 2026-05-29a pass: Schema 123 equipment verification, accounting-depth, SEO/H1, CSS, fallback, and roadmap sanity refresh. -->
