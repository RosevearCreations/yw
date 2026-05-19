# Project State

Last refreshed: **2026-05-18a**

## Current state

The app has a growing Admin backend with staff accounts, approvals, jobs/operations, accounting close workflows, health/schema checks, saved filters, and mobile-friendly controls. The main production concern addressed in this pass was Admin load reliability.

## Completed this pass

- Changed the initial Admin loader to request `health`, `people`, `operations`, and `accounting` scopes in stages.
- Kept the old `scope: all` Admin request only as an emergency fallback with a longer timeout.
- Added visible partial-load warning text when one panel needs retry.
- Added schema 114 to track the staged Admin load guardrails.
- Updated cache/script version to `2026-05-18a`.
- Re-archived retired Markdown and removed recurring temp files.
- Fixed escaped newline strings in `report-subscription-delivery-run` so that Edge Function bundles cleanly.
- Verified JavaScript syntax, smoke checks, CSS brace balance, and one-H1 rule.

## Current risk

The live Admin page can still show cached data if the deployed Edge Function is old, if SQL through schema 114 is not applied, or if the browser is still running older cached assets.
