# Project State

Last refreshed: **2026-05-28a**

## Current status

- Repo build marker: **2026-05-28a**
- Latest schema marker: **122**
- Current priority: mobile-first field usage, staged Admin loading, production-readiness checks, and Ontario OHSA-friendly safety workflow language.
- Latest mobile improvement: reusable mobile form stepper/draft helper for the main field forms.

## Stable expectations

- Public/exposed app shell should keep one H1.
- Mobile screens should avoid long unstructured scrolls where a stepper/card layout is safer.
- Admin should load through staged fast paths first and fall back gracefully.
- Schema files and Markdown must be refreshed every pass.
- Retired root Markdown belongs in `archive/`, not active root.

## Immediate deployment checks

1. Apply SQL through schema **122**.
2. Redeploy `admin-directory`.
3. Clear service worker cache and confirm `2026-05-28a` scripts are loaded.
4. On a phone-width viewport, save/resume a Toolbox or Incident draft.
5. Confirm Today status includes saved draft counts and queued items.
