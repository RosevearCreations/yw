# YWI App Build

Current build marker: **2026-05-28a**  
Current schema marker: **122**

This build is the mobile-first field app/admin backend for Southern Ontario work. It keeps the public app shell to one clear H1, uses Ontario **OHSA** / workplace-safety language in visible copy, and continues moving long desktop-style workflows toward phone-friendly cards, staged panels, and safer fallbacks.

## Current pass

- Added schema **122** for mobile form steppers, local draft-resume chips, and phone-form quality gates.
- Added `js/mobile-form-helper.js` as a reusable helper for Toolbox Talk, PPE, First Aid, Incident / Near Miss, Site Inspection, and Drill forms.
- Added phone step chips, Back/Next navigation, Save Draft, Resume Draft, and Clear actions for common field forms.
- Added local-device draft counts to the Today dashboard and mobile quick-action badge totals.
- Updated `js/mobile-menu.js` and `js/mobile-today.js` so saved local drafts are visible beside queued submissions/actions.
- Updated Admin readiness loading and rendering for mobile form stepper registry and form quality gates.
- Updated `server-worker.js`, `index.html`, and cache marker to **2026-05-28a**.
- Kept visible Ontario **OHSA** / Ontario workplace-safety wording, while moving old root Markdown into archive.
- Reconfirmed one-H1 discipline, JavaScript syntax, CSS brace balance, and smoke-check coverage.

## Deploy order

1. Apply SQL through `sql/122_mobile_form_stepper_draft_resume_guardrails.sql`.
2. Redeploy `supabase/functions/admin-directory`.
3. Redeploy any still-stale Edge Functions from the previous pass if they are not current.
4. Hard refresh or clear/unregister the service worker so `2026-05-28a` assets load.
5. Test `#today`, `#toolbox`, `#incident`, `#ppe`, `#firstaid`, `#inspect`, `#drill`, and `#admin` at phone width.

## Active documentation

Keep these root files current on every pass: `README.md`, `PROJECT_STATE.md`, `NEW_CHAT_STATUS.md`, `DEVELOPMENT_ROADMAP.md`, `KNOWN_ISSUES_AND_GAPS.md`, `DATABASE_STRUCTURE.md`, `SYSTEM_ARCHITECTURE.md`, `DEPLOYMENT_GUIDE.md`, `TESTING_CHECKLIST.md`, `CHANGELOG.md`, and `AI_CONTEXT.md`.
