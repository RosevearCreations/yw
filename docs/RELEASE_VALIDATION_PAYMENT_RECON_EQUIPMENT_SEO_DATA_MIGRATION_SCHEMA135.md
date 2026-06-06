# Schema 135 — release validation, payment/reconciliation, equipment scan, local SEO, fallback messages, and JSON/DB migration controls

Build: `2026-06-06b`

## What changed

Schema 135 adds Admin-visible queues that make the next execution work easier to track without losing the current safety guardrails. It does not replace the live accounting or equipment flows; it adds validation rows that define what must be true before those flows become deeper write actions.

## New queues

- `app_release_validation_queue` / `v_app_release_validation_queue`
- `app_payment_reconciliation_execution_queue` / `v_app_payment_reconciliation_execution_queue`
- `app_equipment_mobile_scan_validation_queue` / `v_app_equipment_mobile_scan_validation_queue`
- `app_local_seo_release_validation_queue` / `v_app_local_seo_release_validation_queue`
- `app_runtime_fallback_message_queue` / `v_app_runtime_fallback_message_queue`
- `app_json_db_migration_execution_queue` / `v_app_json_db_migration_execution_queue`

## Why it matters

The previous passes exposed many readiness lists. This pass ties the next practical work to release validation: payment writes, bank reconciliation, equipment scan/template enforcement, local SEO publication controls, runtime fallback copy, and JSON/DB migration candidates.

## Deploy order

1. Apply schema 135.
2. Redeploy `admin-directory`.
3. Redeploy `jobs-manage` and `jobs-directory` only if the live versions are behind the current build.
4. Hard-refresh or clear the old service worker so `2026-06-06b` assets load.

## Smoke expectations

The smoke script now checks the schema 135 marker, drift view, Admin Edge Function view names, Admin UI table names, sitemap/robots, cache marker, one H1, CSS brace balance, and Edge Function parse safety.
