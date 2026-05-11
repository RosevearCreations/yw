# AI Context

Last refreshed: **2026-05-10**

This is the concise AI handoff file. Older AI/context prompt history has been archived.

## Project identity

YWI HSE is a mobile-first HSE, jobs, operations, reporting, and backend accounting app for field/service work. The user wants steady practical progress, all Markdown updated each pass, schema files kept current, CSS drift checked, and no more than one H1 on exposed pages.

## Current build state

- Latest schema marker: `sql/105_repo_cleanup_and_roadmap_refresh.sql`
- Full schema: `sql/000_full_schema_reference.sql`
- Active roadmap: `DEVELOPMENT_ROADMAP.md`
- Active issues: `KNOWN_ISSUES_AND_GAPS.md`
- Fresh chat handoff: `NEW_CHAT_STATUS.md`

## Standing rules

- Update Markdown every pass.
- Update schema reference and migration files when DB shape changes.
- Keep local SEO direction active on public pages.
- Keep CSS/mobile layout checks active.
- Prefer DB-backed shared data over duplicated JSON where it reduces failure points.
- Keep operator-facing error messages and fallbacks visible.

## Recent cleanup

The Markdown set was cleaned on 2026-05-10. Older root/docs Markdown was archived under `archive/`, and the active docs were rebuilt as shorter current handoffs.

## Next work

Start with the 20-step roadmap in `DEVELOPMENT_ROADMAP.md`, especially:

1. Admin Home Command Center.
2. Error/Health Center.
3. Accounting Close Center.
4. Bank reconciliation import/matching.
5. Role-based dashboards.
