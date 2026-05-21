# Project State

Last refreshed: **2026-05-20b**

Current output label: `yw-main-129-updated-2026-05-20b-admin-action-preflight-retry.zip`

## Current state

The app is moving from one large Admin backend load into smaller, production-style Admin panels. Prior passes added staged scopes, diagnostics, stale-data badges, split accounting/evidence fast paths, confirmation guardrails, and DB-backed deployment/function readiness rows.

This pass adds the next safety layer: Admin now has DB-backed action permissions, schema preflight checks, and panel retry/backoff policy rows. These are visible in Production Readiness and are loaded from `admin-directory` with `actor_role` so the UI can disable known risky action buttons before click.

## Current schema

- Latest migration: `sql/119_admin_action_permissions_preflight_and_retry_rules.sql`
- Canonical schema: `sql/000_full_schema_reference.sql`
- Schema drift marker: expected schema version **119**

## Current frontend

- Cache version: `2026-05-20b`
- Main mobile menu remains compact/expandable.
- Admin sections remain compact/expandable on mobile.
- Production Readiness now includes:
  - readiness cards,
  - schema preflight rows,
  - production checks,
  - role permission matrix,
  - action permission registry,
  - deployment gates,
  - deployment checklist,
  - panel retry/backoff policy,
  - function readiness rows,
  - SEO smoke rows,
  - backup and audit helper rows.

## Current backend focus

- Keep Admin payloads smaller through fast paths.
- Keep schema drift visible before action buttons fail.
- Keep action buttons guarded by role and DB registry.
- Keep retry/backoff rules visible so failed panels do not keep hammering Edge Functions.
