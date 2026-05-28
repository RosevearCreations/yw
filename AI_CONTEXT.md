# AI Context

Last refreshed: **2026-05-26a**

## Current build context

The latest pass is `2026-05-26a`. Current schema marker is **120**.

This project is moving toward a mobile-first field operations app. Continue to avoid one giant Admin load and continue to favour staged fast paths, DB-backed registries, and phone-friendly workflows.

## Important current rules

- Keep active Markdown fresh on every build pass.
- Keep `sql/000_full_schema_reference.sql` updated with the latest schema file.
- Keep retired root Markdown out of the active root; archive it instead.
- Remove recurring `test_write` files from the active root.
- Keep exposed/public pages to one H1.
- Keep CSS mobile-friendly and verify braces.
- Use Ontario OHSA / Ontario workplace safety wording for Ontario safety procedures.
- Prefer DB-backed registries/checks over hard-coded frontend assumptions.

## Latest additions

- `app_mobile_first_quality_gates`
- `app_jurisdiction_wording_gates`
- mobile bottom quick-action navigation
- Ontario OHSA / workplace safety wording refresh

## Next pass direction

Use `DEVELOPMENT_ROADMAP.md` and `KNOWN_ISSUES_AND_GAPS.md`. The next strongest work is a role-aware mobile Today dashboard, offline queue badges, and mobile form steppers for field submissions.
