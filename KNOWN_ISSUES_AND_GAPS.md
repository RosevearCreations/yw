# Known Issues and Gaps

Last refreshed: **2026-05-27a**

## Immediate issues

1. Live Admin must be tested after applying schema 121 and redeploying `admin-directory`.
2. Old service worker caches can hide the new `#today` route, quick badges, and `js/mobile-today.js` until the browser is hard refreshed or the service worker is cleared.
3. Historical migration filenames may still contain old wording; user-facing app copy should continue to use Ontario OHSA / Ontario workplace safety wording.
4. The Today dashboard currently uses local role/security/outbox state. Live DB-backed Today cards from `v_mobile_today_action_registry` are exposed for Admin readiness but not yet used directly by the public Today screen.
5. The PWA install helper depends on browser support for `beforeinstallprompt`; iOS still requires manual Share → Add to Home Screen guidance.
6. Mobile forms still need stepper layouts, draft chips, and photo quality checks.

## UX gaps

- Keep testing every Admin and form screen at phone width.
- Add form steppers for the most-used phone forms.
- Replace long Admin tables with card views where mobile users do action work.
- Add Today dashboard live cards for supervisor/admin roles.
- Add a queue detail drawer so users can see what is waiting to sync.

## SEO/local gaps

- Keep one H1 per public page.
- Continue page title, meta description, local wording, alt text, and mobile layout checks each pass.
- Add local service/location content only when it matches real service coverage.
- Add structured metadata, sitemap, robots, and public route freshness checks to the smoke script.
- Add missing-image and missing-alt export rows for cleanup.

## Fixed during this pass

- Added the mobile Today dashboard route and made it the default app/PWA start screen.
- Added quick-action badges for queued form/admin action items.
- Added PWA install helper text for Android/iOS phone users.
- Added schema 121 and updated schema drift tracking to expected version 121.
- Updated service worker cache/app shell to include `js/mobile-today.js`.
- Removed retired root Markdown and temporary `test_write` files again.
