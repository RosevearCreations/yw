# AI Context

Last refreshed: **2026-05-15b**

## Current task pattern

Every build pass must update code, SQL schema files, and active Markdown together. Keep old Markdown snapshots in `archive/` and keep active root Markdown clear.

## Current technical state

- Latest schema: 108.
- Latest cache/version string: `2026-05-15b`.
- Main changed files this pass: `js/admin-ui.js`, `style.css`, `server-worker.js`, `index.html`, `supabase/functions/admin-directory/index.ts`, `supabase/functions/admin-manage/index.ts`, `sql/108_saved_filters_close_wizard_health_and_seo_gates.sql`, `sql/000_full_schema_reference.sql`, `scripts/repo-smoke-check.mjs`.

## Important constraints

- No more than one H1 per exposed page.
- Keep SEO titles/headings locally relevant when public pages are added.
- Move retired root Markdown to archive.
- Remove temporary test files from active root.
- Update schema reference and smoke check for every schema pass.

## Next recommended work

Server-side pagination and true saved-filter state replay should come next, then a write-enabled Guided Close Center wizard.
