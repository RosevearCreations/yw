# Testing Checklist

Last refreshed: **2026-05-15b**

## Automated checks

- [ ] `node --check js/api.js`
- [ ] `node --check js/admin-ui.js`
- [ ] `node --check js/reports-ui.js`
- [ ] `node --check js/jobs-ui.js`
- [ ] `node --check js/hse-ops-ui.js`
- [ ] `node --check js/logbook-ui.js`
- [ ] `node --check app.js`
- [ ] `node --check server-worker.js`
- [ ] `node scripts/repo-smoke-check.mjs`

## Manual checks after deploy

- [ ] Admin page loads with no fatal console error.
- [ ] Admin Health shows schema 108 current.
- [ ] Saved admin view can be created.
- [ ] Saved admin view can be used/touched.
- [ ] Saved admin view can be deleted by owner/admin.
- [ ] Guided Close Center cards and step cards render.
- [ ] Evidence Manager Follow up creates a resolution note.
- [ ] Deployment Gate Mark Pass works for admin.
- [ ] SEO smoke row shows current app shell with one H1.
- [ ] No exposed page has more than one H1.
