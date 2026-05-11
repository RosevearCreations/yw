# New Chat Status

Use this file to restart work in a fresh chat.

## Build identity

- Current refreshed build: **YWI main 115 cleanup/roadmap pass**
- Date: **2026-05-10**
- Latest schema marker: `sql/105_repo_cleanup_and_roadmap_refresh.sql`
- Canonical schema reference: `sql/000_full_schema_reference.sql`

## What just happened

- Archived old/redundant Markdown into `archive/markdown-current-snapshot-2026-05-10/` and `archive/markdown-retired-2026-05-10/`.
- Replaced active root Markdown with fresh, shorter handoff documents.
- Retired obvious temp test files from the ZIP.
- Added schema marker 105 for repo cleanup and roadmap refresh tracking.
- Updated smoke checks so schema 105 and the new archive/readme structure are verified.
- Bumped frontend cache version strings to `2026-05-10a`.

## Important context from recent passes

- Reports were fixed to lazy-load instead of timing out from the Admin route.
- Accounting-close admin UI/control records were added before this cleanup pass.
- The next practical work should turn raw admin-manager records into dashboard-style workflows: Close Center, Reconciliation Center, Jobs Center, HSE Review Center, and Error/Health Center.

## Start here next

1. Apply SQL migrations through 105.
2. Deploy/redeploy Supabase functions if changed.
3. Deploy frontend.
4. Test `#admin`, `#reports`, `#jobs`, `#hseops`, `#settings`, and login.
5. Begin the first item in `DEVELOPMENT_ROADMAP.md`: Admin Home Command Center.

## Do not lose these standing rules

- Update Markdown every pass.
- Keep schema reference synchronized every pass.
- Keep exposed pages to one clear H1.
- Continue improving local SEO wording and proof content.
- Continue checking CSS drift and mobile layout.
- Favor DB-backed shared data when JSON would create duplicate sources of truth.
