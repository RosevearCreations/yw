# Testing Checklist

Last refreshed: **2026-05-15c**

## Code checks

- [ ] `node --check js/api.js`
- [ ] `node --check js/admin-ui.js`
- [ ] `node --check js/reports-ui.js`
- [ ] `node --check js/jobs-ui.js`
- [ ] `node --check js/hse-ops-ui.js`
- [ ] `node --check js/logbook-ui.js`
- [ ] `node --check app.js`
- [ ] `node --check server-worker.js`
- [ ] `node scripts/repo-smoke-check.mjs`

## Manual app checks

- [ ] Admin Command Center loads.
- [ ] Admin Health shows schema **109** after SQL is applied.
- [ ] Guided Close Center shows step detail rows.
- [ ] Complete/Reopen creates close-step event history.
- [ ] Evidence follow-up creates a health note and evidence action row.
- [ ] Readiness tables load for deployment gates, SEO checks, bank CSV import sessions, backup rehearsals, mobile action cards, permissions, and audit events.
- [ ] Service worker loads `2026-05-15c` assets after hard refresh.
- [ ] Exposed app shell still has one H1.
