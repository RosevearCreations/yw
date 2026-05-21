# Known Issues and Gaps

Last refreshed: **2026-05-20b**

## Immediate issues

1. Live Admin must be tested after applying schema 119 and redeploying `admin-directory`; old cached scripts can hide the new action/preflight/retry tables.
2. `admin_schema_preflight_checks.live_status` is currently a visible checklist row, not an automatic metadata verifier yet.
3. `admin_panel_retry_policy` is visible in Admin but browser retry counters still need to be wired to enforce cooldown/backoff.
4. Action permission rows can disable known buttons, but the registry still needs a full Admin edit UI.
5. Function readiness rows now have signoff fields, but signoff buttons are not wired yet.
6. The broad Admin `all` and `accounting` fallback scopes still exist and should be retired only after split scopes pass production testing.

## UX gaps

- Keep testing Admin on phone-width screens after every table/card addition.
- Add stronger skeleton placeholders for individual tables and cards.
- Add visible retry/backoff countdown state for panels that fail repeatedly.
- Add offline queue badges beside action buttons.
- Keep replacing long tables with paged/filterable panel views.

## SEO/local gaps

- Keep one H1 per public page.
- Continue page title, meta description, local wording, alt text, and mobile layout checks each pass.
- Add local service/location content only when it matches real service coverage.
- Add structured metadata, sitemap, robots, and public route freshness checks to the smoke script.
- Add missing-image and missing-alt export rows for cleanup.

## Fixed during this pass

- Added DB-backed Admin action permission registry.
- Added DB-backed Admin schema preflight rows.
- Added DB-backed Admin panel retry/backoff policy rows.
- Added role-aware disabled states for known risky Admin action buttons.
- Added schema 119 and updated schema drift tracking to expected version 119.
- Removed retired root Markdown and temporary `test_write` files again.
