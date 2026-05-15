# AI Context

Last refreshed: **2026-05-15a**

## How to work on this repo

- Keep code changes reflected in Markdown.
- Keep schema changes reflected in both a numbered migration and `sql/000_full_schema_reference.sql`.
- Keep smoke checks current.
- Do not keep retired root Markdown active in the root.
- Do not keep temp test files in the active build.
- Keep exposed pages to one H1.
- Keep SEO wording clear, local, and useful when public pages exist.

## Current build priority

The project is moving toward a real operations app. The Admin experience should be workflow-first, not raw table-first.

Current active dashboard pieces:

- Admin Home Command Center.
- App Health and Schema Center.
- Admin Task Inbox.
- Accounting close and reconciliation managers.
- Jobs and operations manager.
- HSE Ops and evidence review.
- Reports with lazy-load guardrails.

## Latest migration

`sql/106_admin_command_center_schema_tracking_and_health.sql`

Adds:

- `app_schema_versions`
- schema status view
- role dashboard presets view
- command center view
- health center view
- admin task inbox view

## Next best work

Start with the next 20-step roadmap in `DEVELOPMENT_ROADMAP.md`. The most valuable next build is deeper drill-down filtering from Command Center cards, then a real Close Center wizard.
