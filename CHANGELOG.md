# Changelog

## 2026-06-04b / Schema 130

- Added schema 130 payment execution, bank reconciliation execution, equipment scan/template, local SEO execution, and fallback drill queues.
- Updated Admin readiness and `admin-directory` to load schema 130 views.
- Updated `sql/000_full_schema_reference.sql` through schema 130 and moved schema drift to expected schema 130.
- Restored the missing 2026-05-29a archive snapshot required by legacy smoke checks.
- Updated cache marker to 2026-06-04b, refreshed active Markdown, and retired active `test_write` files.

## 2026-06-04a / Schema 129

- Repaired the canonical full schema copy of schema 128 so it no longer references missing `app_roadmap_action_steps.source_document`, `target_route_hint`, or `completion_note` columns.
- Added schema 129 compatibility checks, accounting evidence package queue, equipment return-to-service rules, public asset smoke checks, and error recovery playbooks.
- Updated Admin readiness and `admin-directory` to load schema 129 views.
- Updated cache marker to 2026-06-04a and refreshed active Markdown.
