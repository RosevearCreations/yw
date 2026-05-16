# Known Issues and Gaps

Last refreshed: **2026-05-15b**

## Highest priority after this pass

1. **Apply schema 108 live.** The new saved-filter, close wizard, health resolution, deployment gate, and SEO smoke views need to exist before the new Admin UI can fully populate.
2. **Redeploy `admin-directory` and `admin-manage`.** Admin now loads schema 108 views and writes saved filters / health notes / deployment gate updates.
3. **Saved filters are now writable, but not full state replay yet.** They save the current section and key UI fields; next pass should restore exact table filters and pagination.
4. **Guided Close Center has DB-backed steps, but the wizard is still not a full write workflow.** It needs owner, due date, completion, and blocker drill-down actions.
5. **Evidence Manager can create follow-up records, but retry/replace/archive actions are still next.**
6. **Deployment gates can be marked passed, but they are not fully automated yet.** CI/deploy automation should update these rows from scripts later.
7. **SEO smoke table exists, but public-page scanning is not automated yet.** This should be wired once public marketing pages are added.
8. **Large admin tables still need server-side pagination.** This remains the main performance priority.
9. **Health resolution queue needs assignment/dismiss/reopen controls.** Current pass adds create/resolve foundations only.
10. **Accounting-close posting validation is still next.** Generated lines, locked periods, approvals, and source links need a full preview/post workflow.

## Recently addressed

- Added schema 108.
- Fixed Admin Health `drift` rendering bug.
- Added saved-view UI and write endpoint support.
- Added close step metadata and rendered close step cards.
- Added health/evidence follow-up logging.
- Added deployment gate and SEO smoke-check foundations.
- Removed active temp files and retired old root Markdown again.
- Updated smoke checks and active Markdown.

## Watch items after deploy

- Confirm Admin Health shows schema 108 current.
- Confirm saved filter create/use/delete works for a supervisor/admin user.
- Confirm deployment gate Mark Pass works for an admin user.
- Confirm Evidence Manager follow-up creates a health resolution note.
- Confirm browser cache is not still loading older `2026-05-14b` assets.
