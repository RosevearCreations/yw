# Known Issues and Gaps

Last refreshed: **2026-05-28a**

## Immediate issues

1. Live Admin must be tested after applying schema **122** and redeploying `admin-directory`.
2. Old service worker caches can hide `js/mobile-form-helper.js`, new draft badges, and `2026-05-28a` assets until the browser is hard refreshed or the service worker is cleared.
3. Historical migration filenames may still contain old wording; user-facing app copy should continue to use Ontario OHSA / Ontario workplace-safety wording.
4. Mobile form drafts are local-device only. File inputs cannot be restored by browsers, so photos still need to be re-selected before final submit.
5. The Today dashboard now shows draft counts, but DB-backed live Today cards still need deeper integration for supervisor/admin roles.
6. Mobile photo quality checks, compression, and upload retry progress are still outstanding.

## UX gaps

- Keep testing every form/Admin screen at phone width.
- Convert long Admin tables into action cards where users actually work on phones.
- Add photo/evidence previews and upload progress suitable for slow mobile connections.
- Add queue/detail drawers for pending submissions, local drafts, and admin/action items.

## SEO/local gaps

- Keep one H1 per public/exposed page.
- Continue page title, meta description, local wording, alt text, and mobile layout checks each pass.
- Add local service/location content only when it matches real service coverage.
- Add structured metadata, sitemap, robots, public route freshness, and image-alt checks to the smoke script.

## Fixed during this pass

- Added reusable mobile form stepper/draft helper.
- Added saved local draft counts to Today and quick badges.
- Added schema 122 and Admin readiness views for mobile form quality gates.
- Updated active Markdown and schema reference files.
- Removed retired root Markdown and temporary `test_write` files again.
