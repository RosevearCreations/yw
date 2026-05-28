# YWI Main App

Last refreshed: **2026-05-26a**

Current build label: `yw-main-130-updated-2026-05-26a-ontario-ohsa-mobile-first.zip`

Current schema marker: **120**

Current asset/cache version: `2026-05-26a`

## Current pass summary

This pass corrects the jurisdiction wording for Ontario and moves the app more strongly toward phone-first field usage. Visible app copy now uses **Ontario OHSA / Ontario workplace safety** wording instead of U.S. safety wording, and the mobile UI now includes a fixed quick-action bar for the routes most likely to be used on a phone.

## What changed

- Added `sql/120_ontario_ohsa_mobile_first_app_guardrails.sql`.
- Updated `sql/000_full_schema_reference.sql` through schema 120.
- Added mobile-first quality gates and Ontario jurisdiction wording gates.
- Updated `admin-directory` to return mobile and wording gate rows to Admin readiness.
- Added a fixed mobile quick-action bar for Toolbox Talk, Incident, Safety Ops, Jobs, and Admin.
- Updated app title, manifest, H1, HSE Ops labels, Admin hub labels, and Reports copy for Ontario wording.
- Added `docs/ONTARIO_OHSA_AND_MOBILE_FIRST_APP_PASS.md`.
- Updated active Markdown, archived the previous Markdown snapshot, and removed retired/temp root files again.

## Deploy checklist

1. Apply SQL through **schema 120**.
2. Redeploy Supabase function `admin-directory`.
3. Hard refresh or unregister the browser service worker so `2026-05-26a` assets load.
4. Test on a phone-width viewport and confirm the bottom quick-action bar works.
5. Open Admin > Readiness and confirm mobile-first and Ontario wording gate rows load.

## Active handoff files

- `PROJECT_STATE.md`
- `NEW_CHAT_STATUS.md`
- `DEVELOPMENT_ROADMAP.md`
- `KNOWN_ISSUES_AND_GAPS.md`
- `DATABASE_STRUCTURE.md`
- `SYSTEM_ARCHITECTURE.md`
- `DEPLOYMENT_GUIDE.md`
- `TESTING_CHECKLIST.md`
- `AI_CONTEXT.md`
- `CHANGELOG.md`
