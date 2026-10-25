-- YW Build 443: owner-bound, read-only PMS navigation snapshot.
-- Presentation cannot grant permissions or authorize new work. The 421 database
-- trigger and RPC continue to enforce Jobs/estimate creation independently.
begin;
create or replace function public.ywi_rpc_pms_navigation_443(p_company_id uuid)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_services jsonb; v_count integer;
begin
 perform public.ywi_422_assert_owner(p_company_id);
 select count(*),coalesce(jsonb_agg(jsonb_build_object(
   'company_id',s.company_id,'module_key',s.module_key,'enabled',s.enabled)
   order by s.module_key),'[]'::jsonb)
 into v_count,v_services from public.ywi_company_service_modules s
 where s.company_id=p_company_id and s.module_key in
  ('landscape','construction','water_parks','snow_removal','snow_plowing','septic');
 if v_count<>6 then raise exception '443 incomplete six-service company registry'; end if;
 return jsonb_build_object('company_id',p_company_id,
  'captured_at',statement_timestamp(),'owner_guard','ywi_422_assert_owner',
  'services',v_services,'jobs_new_work_guard','ywi_421_assert_company_new_work',
  'historical_audit_retained',true,'privacy_minimized',true,
  'synthetic',false,'mutation_authorized',false);
end $$;
revoke all on function public.ywi_rpc_pms_navigation_443(uuid) from public,anon,authenticated;
grant execute on function public.ywi_rpc_pms_navigation_443(uuid) to authenticated;
comment on function public.ywi_rpc_pms_navigation_443(uuid) is
 'Build 443: six existing company service flags for read-only, owner-verified PMS navigation; never a write authorization.';
commit;
