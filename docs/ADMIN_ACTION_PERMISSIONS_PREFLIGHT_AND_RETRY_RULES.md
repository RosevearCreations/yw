# Admin Action Permissions, Preflight, and Retry Rules

Last refreshed: **2026-06-02b**

## Purpose

Schema 119 gives Admin a safer production-readiness layer:

- action buttons can be disabled by DB-backed role rules,
- schema requirements are listed before operators click risky buttons,
- panel retry/backoff policies are visible in Admin,
- function readiness rows can now track last-checked and signoff metadata.

## New schema objects

- `admin_action_permission_registry`
- `admin_panel_retry_policy`
- `admin_schema_preflight_checks`
- `v_admin_action_permission_registry`
- `v_admin_panel_retry_policy`
- `v_admin_schema_preflight_checks`

## Frontend behavior

`js/admin-ui.js` reads the permission registry and disables known risky buttons when the current actor role does not meet the configured `required_role`.

Currently guarded buttons include:

- job complete/cancel,
- job note,
- close step complete/reopen,
- deployment gate mark-pass,
- evidence follow-up.

## Edge Function behavior

`admin-directory` now returns `actor_role` and the new registry/checklist arrays in Command Center, Health, and broad fallback payloads.

## Next work

The next pass should add edit/signoff controls so operators can maintain these rows without writing SQL.

<!-- 2026-05-29a pass: Schema 123 equipment verification, accounting-depth, SEO/H1, CSS, fallback, and roadmap sanity refresh. -->

<!-- 2026-06-02a pass: schema 126 roadmap depth, data migration candidates, SEO/CSS/fallback guardrails, Admin readiness visibility, archive hygiene, cache marker, and Markdown refresh. -->

<!-- 2026-06-02a pass: schema 126 roadmap depth, data migration candidates, SEO/CSS/fallback guardrails, Admin readiness visibility, archive hygiene, cache marker, and Markdown refresh. -->
<!-- 2026-06-02b pass: schema 127 public route SEO registry, internal links, CSS token inventory, mobile field actions, release manifest checks, Admin readiness visibility, scan fallback, archive hygiene, cache marker, and Markdown refresh. -->


## Schema 133 pass marker

Reviewed during build **2026-06-05c / schema 133**. Keep this document aligned with the active roadmap and known gaps.
