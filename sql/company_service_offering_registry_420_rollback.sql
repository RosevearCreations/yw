-- Item 420 manual rollback plan: NEVER execute automatically.
-- Reversible only while registry contains zero companies/active toggles/audit entries.
-- Requires reviewed migration/Production administrator approval.
do $$
begin
 if (select count(*) from public.ywi_companies)>0 or
    (select count(*) from public.ywi_company_service_modules)>0 or
    (select count(*) from public.ywi_company_service_module_audit)>0 then
   raise exception 'Rollback refused: registry has owner/business history; preserve records and use forward repair';
 end if;
end $$;
drop table if exists public.ywi_company_service_module_audit;
drop table if exists public.ywi_company_service_modules;
drop table if exists public.ywi_companies;
drop function if exists public.ywi_company_service_seed_420();
drop function if exists public.ywi_company_service_audit_420();
drop function if exists public.ywi_company_service_touch_420();
drop function if exists public.ywi_company_registry_touch_420();
