# AI Context

Last refreshed: **2026-05-16b**

## Project

YWI operations/HSE/admin app using a static frontend, Supabase Edge Functions, and Postgres schema migrations.

## Current state

The latest pass is `2026-05-16b`. It advances Admin toward production readiness by adding Staff Directory pagination controls, Edge Function pagination metadata, and saved-view replay for staff filters.

## Must preserve in future passes

- Update Markdown and schema files every pass.
- Keep retired root Markdown in `archive/`, not active root.
- Remove recurring `test_write` temp files.
- Keep one H1 in exposed app shell.
- Keep mobile navigation compact.
- Bump cache/script version each frontend pass.
- Apply SQL before deploying functions that depend on new views/tables.

## Current latest schema

`111_admin_directory_pagination_saved_view_replay.sql`
