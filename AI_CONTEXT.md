# AI Context

Last refreshed: **2026-05-20a**

The user is iteratively hardening the YWI main app. Every pass should update code, SQL schema files, and active Markdown. Keep public SEO hygiene in mind: one H1 per exposed page, clear titles/meta, local wording, mobile usability, and image/alt text checks.

## Current build

- Asset/cache version: `2026-05-20a`.
- Latest schema marker: **118**.
- Main feature: Admin preflight/readiness visibility.
- New SQL: `sql/118_admin_preflight_registry_deployment_checklist_ui.sql`.

## Current Admin direction

Admin should keep moving away from one large backend payload. It now loads Command Center first, reads the DB-backed fast-path scope registry when available, and renders readiness/deployment/function status directly in Admin.

## Next priority

Add role-aware disabled states and per-panel retry/backoff controls.
