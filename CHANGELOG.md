# Changelog

## 2026-05-17a

- Added Staff Directory sort and direction controls.
- Added Jobs/Operations search, sort, direction, page-size, previous, and next controls.
- Sent Staff and Jobs sort/paging metadata to `admin-directory`.
- Added sanitized sort allowlists in `admin-directory`.
- Added `scope: people` and `scope: operations` fast paths in `admin-directory`.
- Extended saved admin views to replay Staff and Jobs filters.
- Added schema `112_admin_operations_pagination_sorting_panel_refresh.sql`.
- Updated `sql/000_full_schema_reference.sql` through schema 112.
- Updated smoke checks for Staff sorting, Jobs paging, Edge Function sorting, and schema 112.
- Bumped static/cache version to `2026-05-17a`.
- Archived Markdown snapshot and removed retired root Markdown/temp files.

## Previous active baseline

- 2026-05-16b added Staff Directory pagination and saved-view replay foundations.
- 2026-05-16a added compact mobile main/Admin menus.
- 2026-05-15c added production-readiness foundations for close steps, audit, backup rehearsal, CSV staging, and mobile action cards.
