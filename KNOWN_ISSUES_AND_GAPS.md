# Known Issues and Gaps

Last refreshed: **2026-05-26a**

## Immediate issues

1. Live Admin must be tested after applying schema 120 and redeploying `admin-directory`.
2. Old service worker caches can hide the new mobile quick-action bar until the browser is hard refreshed or the service worker is cleared.
3. Historical migration filenames may still contain old wording; user-facing app copy now uses Ontario OHSA / workplace safety wording.
4. `admin_schema_preflight_checks.live_status` is still a visible checklist row, not a live metadata verifier yet.
5. `admin_panel_retry_policy` is visible in Admin, but browser retry counters still need to enforce cooldown/backoff.
6. Mobile quick actions are now present, but there is not yet a full role-aware mobile Today dashboard.

## UX gaps

- Keep testing every Admin and form screen at phone width.
- Add a role-aware mobile Today dashboard.
- Add offline queue badges beside mobile quick actions.
- Add stronger form steppers for field submissions.
- Keep replacing long tables with paged/filterable card views.

## SEO/local gaps

- Keep one H1 per public page.
- Continue page title, meta description, local wording, alt text, and mobile layout checks each pass.
- Add local service/location content only when it matches real service coverage.
- Add structured metadata, sitemap, robots, and public route freshness checks to the smoke script.
- Add missing-image and missing-alt export rows for cleanup.

## Fixed during this pass

- Added Ontario OHSA / workplace safety wording gates.
- Added mobile-first quality gates.
- Added bottom mobile quick-action navigation.
- Updated visible safety wording away from U.S. safety wording.
- Added schema 120 and updated schema drift tracking to expected version 120.
- Removed retired root Markdown and temporary `test_write` files again.
