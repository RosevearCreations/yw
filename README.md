# YWI App Build

Current build marker: **2026-05-29a**  
Current schema marker: **123**

This build is the mobile-first field app/admin backend for Southern Ontario work. It keeps the public app shell to one clear H1, uses Ontario **OHSA** / workplace-safety language in visible copy, and continues moving long desktop-style workflows toward phone-friendly cards, staged panels, safer fallbacks, and clearer equipment accountability.

## Current pass

- Added schema **123** for equipment withdrawal, intended destination, site-arrival verification, return testing, final return verification, transfer audit events, return exceptions, and operational-depth gates.
- Added Current Site and Destination Site fields to the Equipment panel so withdrawal/return location is explicit.
- Added checkout safety test, arrival/site test, return test, return verification, and exception visibility in `js/jobs-ui.js`.
- Updated `supabase/functions/jobs-manage` with `verify_arrival` and `verify_return_complete` actions plus transfer/return notifications.
- Updated `supabase/functions/jobs-directory` to return transfer history, return exceptions, and operational-depth gate rows.
- Updated `sql/000_full_schema_reference.sql` and added `sql/123_equipment_transfer_arrival_return_accounting_seo_guardrails.sql`.
- Updated the smoke script so schema 123, the equipment verification UI, Edge Function handlers, one-H1 checks, and the current cache marker are checked before shipping.
- Updated `server-worker.js`, `index.html`, and cache marker to **2026-05-29a**.
- Reconfirmed JavaScript syntax, CSS brace balance, one-H1 discipline, and archive cleanup.

## Deploy order

1. Apply SQL through `sql/123_equipment_transfer_arrival_return_accounting_seo_guardrails.sql`.
2. Redeploy `supabase/functions/jobs-directory`.
3. Redeploy `supabase/functions/jobs-manage`.
4. Redeploy any still-stale Admin/Upload Edge Functions from the previous pass if they are not current.
5. Hard refresh or clear/unregister the service worker so `2026-05-29a` assets load.
6. Test `#jobs` and `#equipment` at phone width: save item, check out to destination, verify arrival/site test, return, mark return verified, and confirm exception/history rows update.

## Active documentation

Keep these root files current on every pass: `README.md`, `PROJECT_STATE.md`, `NEW_CHAT_STATUS.md`, `DEVELOPMENT_ROADMAP.md`, `KNOWN_ISSUES_AND_GAPS.md`, `DATABASE_STRUCTURE.md`, `SYSTEM_ARCHITECTURE.md`, `DEPLOYMENT_GUIDE.md`, `TESTING_CHECKLIST.md`, `CHANGELOG.md`, and `AI_CONTEXT.md`.

<!-- 2026-05-29a pass: Schema 123 equipment verification, accounting-depth, SEO/H1, CSS, fallback, and roadmap sanity refresh. -->
