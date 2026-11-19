-- YW583: READ ONLY, SAFE on the identified YardWeasels project.
-- DO NOT apply to any database as a migration; no DDL/DML in this file.
-- Compare *live current* semantics with historic 420,421,443 and later 451.
-- The 451 migration already evolves the six-service historical state to seven.
-- No tenant values, personal records, secrets or photos are returned.
with r as (
 select count(*)::integer as company_count from public.ywi_companies
), grouped as (
 select count(*)::integer as row_count,
 count(*) filter(where enabled is true)::integer as enabled_count,
 count(distinct company_id)::integer as companies_with_registry,
 count(*) filter(where module_key='arboriculture')::integer as arboriculture_rows
 from public.ywi_company_service_modules
), checks as (
 select
 exists(select 1 from pg_constraint c
  where c.conrelid='public.ywi_company_service_modules'::regclass
   and c.conname='ywi_company_service_modules_module_key_check'
   and pg_get_constraintdef(c.oid) like '%arboriculture%') as registry_allows_arboriculture,
 exists(select 1 from pg_constraint c
  where c.conrelid='public.ywi_company_service_module_audit'::regclass
   and c.conname='ywi_company_service_module_audit_module_key_check'
   and pg_get_constraintdef(c.oid) like '%arboriculture%') as audit_allows_arboriculture,
 exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='ywi_company_service_seed_420'
   and pg_get_functiondef(p.oid) like '%arboriculture%') as seed_has_seventh,
 exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='ywi_421_assert_company_new_work'
   and pg_get_functiondef(p.oid) like '%arboriculture%'
   and pg_get_functiondef(p.oid) like '%Jobs create permission denied%'
  ) as new_work_guard_is_seven_and_permission_checked,
 exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='ywi_rpc_pms_navigation_443'
   and pg_get_functiondef(p.oid) like '%arboriculture%'
   and pg_get_functiondef(p.oid) like '%v_count<>7%'
  ) as navigation_requires_seven
)
select 'YW583_LIVE_READ_ONLY'::text as audit_source,
 r.company_count, grouped.row_count, grouped.enabled_count,
 grouped.companies_with_registry, grouped.arboriculture_rows,
 checks.*,
 to_regclass('public.ywi_company_specialty_modules_580') is not null as specialty_580_enrolled,
 to_regclass('public.ywi_581_service_acceptance') is not null as photo_staging_581_enrolled,
 to_regclass('public.ywi_582_photo_integrity_receipts') is not null as photo_custody_582_enrolled
from r cross join grouped cross join checks;
