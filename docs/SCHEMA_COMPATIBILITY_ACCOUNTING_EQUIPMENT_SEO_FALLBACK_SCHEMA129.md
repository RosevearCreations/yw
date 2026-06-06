# Schema 129 Compatibility, Accounting Evidence, Equipment Return-to-Service, SEO Asset, and Recovery Playbook Pass

Build: **2026-06-04a**  
Schema: **129**

## What this pass fixes

- Repairs the canonical `sql/000_full_schema_reference.sql` copy of schema 128 so it uses the real schema 126 roadmap columns: `source_doc`, `route_hint`, and `implementation_notes`.
- Adds smoke checks to prevent the old `source_document`, `target_route_hint`, and `completion_note` roadmap insert pattern from returning.
- Keeps the standalone schema 128 file and the canonical full schema aligned.

## New schema 129 queues/views

- `app_schema_migration_compatibility_checks` / `v_app_schema_migration_compatibility_checks`
- `app_accounting_evidence_package_queue` / `v_app_accounting_evidence_package_queue`
- `app_equipment_return_to_service_rules` / `v_app_equipment_return_to_service_rules`
- `app_public_asset_smoke_checks` / `v_app_public_asset_smoke_checks`
- `app_error_recovery_playbook` / `v_app_error_recovery_playbook`

## Admin readiness additions

Admin readiness now has DB-visible rows for:

1. Schema migration compatibility checks.
2. Accounting evidence/proof packaging.
3. Equipment return-to-service blocking rules.
4. Public asset and SEO smoke checks.
5. Error recovery playbooks for repeated deployment/runtime failures.

## Deployment order

1. Apply schema 128 if it has not already been applied, using the repaired standalone file.
2. Apply schema 129.
3. Redeploy `admin-directory`.
4. Hard-refresh or clear the old service worker so `2026-06-04a` assets load.

## Important validation

Run:

```bash
node scripts/repo-smoke-check.mjs
```

The smoke script now verifies that schema 128 and the canonical full schema do not contain the bad legacy roadmap insert/update pattern.


## Schema 134 pass marker

Reviewed during build **2026-06-06a / schema 134**. Keep this document aligned with the active roadmap and known gaps.
