# AI Context

Last refreshed: **2026-05-20b**

## Current build context

The latest pass is `2026-05-20b`. Current schema marker is **119**.

This project has been moving Admin from one giant load into staged fast paths. Continue to avoid broad payloads unless they are an emergency fallback.

## Important current rules

- Keep active Markdown fresh on every build pass.
- Keep `sql/000_full_schema_reference.sql` updated with the latest schema file.
- Keep retired root Markdown out of the active root; archive it instead.
- Remove recurring `test_write` files from the active root.
- Keep exposed/public pages to one H1.
- Keep CSS mobile-friendly and verify braces.
- Prefer DB-backed registries/checks over hard-coded frontend assumptions.

## Latest additions

- `admin_action_permission_registry`
- `admin_panel_retry_policy`
- `admin_schema_preflight_checks`
- role-aware Admin action disabled states
- function readiness signoff metadata

## Next pass direction

Use `DEVELOPMENT_ROADMAP.md` and `KNOWN_ISSUES_AND_GAPS.md`. The next logical work is to make the registry rows writable/reviewable from Admin, add CSV exports, and expand the public SEO smoke checker.
