# Schema 142 deploy repair, proof closeout, equipment exception, SEO prominence, runtime observability, and source migration controls

Build: **2026-06-11a**  
Schema: **142**

This pass repairs the canonical full schema copy of schema 141, keeps the standalone schema 141 repair intact, and adds schema 142 queues for the next execution layer.

## Added

- `app_schema_deploy_repair_queue`
- `app_payment_reconciliation_proof_closeout_queue`
- `app_equipment_return_exception_action_queue`
- `app_local_search_prominence_evidence_queue`
- `app_runtime_fallback_observability_queue`
- `app_json_db_source_migration_queue`

## Deployment order

1. Apply repaired schema 141 if the live database did not complete it.
2. Apply schema 142.
3. Redeploy `admin-directory`.
4. Redeploy `jobs-manage` and `jobs-directory` only if live versions are behind.
5. Clear the service worker/cache so `2026-06-11a` assets load.
