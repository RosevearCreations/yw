# Changelog

## 2026-05-10 — Markdown cleanup, archive reset, and roadmap refresh

- Archived current root/docs Markdown snapshots into `archive/markdown-current-snapshot-2026-05-10/`.
- Moved retired root Markdown into `archive/markdown-retired-2026-05-10/root/`.
- Moved older pass-specific docs into `archive/markdown-retired-2026-05-10/docs/`.
- Removed obvious temp test-write files from the active build.
- Retired `sql/VerifyDB_24_04_2026.sql` into `archive/sql-retired-2026-05-10/`.
- Rebuilt the active root Markdown set as fresh, concise project handoff files.
- Added the next logical 20-step roadmap in `DEVELOPMENT_ROADMAP.md`.
- Added schema marker `sql/105_repo_cleanup_and_roadmap_refresh.sql`.
- Updated `sql/000_full_schema_reference.sql` and `scripts/repo-smoke-check.mjs` for schema 105.
- Bumped app-shell cache/query versions to `2026-05-10a`.

## 2026-05-09 — Reporting timeout guardrails

- Reports were changed to lazy-load only when the Reports route opens or Reload Reports is pressed.
- Added admin-directory reporting fast path and lighter initial reporting payload.
- Added `sql/104_reporting_loader_timeout_guardrails.sql`.

## 2026-05-09 — Accounting close admin UI controls

- Added schema/UI direction for accounting period close/reopen controls, reconciliation review, filing/remittance review, payment application, and accountant package delivery.
- Added `sql/103_accounting_close_admin_ui_controls.sql`.
