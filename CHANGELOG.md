# Changelog

## 2026-05-15a

- Added Admin Home Command Center.
- Added App Health and Schema Center.
- Added Admin Task Inbox.
- Added schema migration tracking table and schema status view.
- Added role dashboard presets view.
- Added schema `106_admin_command_center_schema_tracking_and_health.sql`.
- Updated canonical schema reference through schema 106.
- Updated `admin-directory` to return command/health/task/schema view data.
- Added frontend rendering for Command Center, Health Center, schema table, and task inbox.
- Added local diagnostic dispatch for API timeout/auth/network failures.
- Added mobile/admin dashboard CSS polish.
- Bumped frontend/service-worker cache version to `2026-05-15a`.
- Removed reintroduced active test-write files.
- Archived reintroduced root legacy Markdown.
- Retired active `sql/VerifyDB_24_04_2026.sql` back into archive.
- Updated smoke checks to verify schema 106 and cleanup guardrails.
- Refreshed active Markdown handoff docs and next 20-step roadmap.

## 2026-05-10a

- Cleaned active Markdown set.
- Archived old root and docs Markdown.
- Added schema 105 cleanup/roadmap marker.
- Removed temp test-write files.

## 2026-05-09b

- Stopped Reports from auto-loading on Admin.
- Added reporting lazy-load guardrails.
- Added schema 104 reporting health marker.
