-- YW 442: strict owner-only, no-PII, bounded first-recorded Jobs cohort source review.
-- Each first Job is the earliest canonical company+service+customer work order;
-- existence of a receipt, session, QC or invoice is NOT evidence of acceptance.
begin;
create or replace function public.ywi_rpc_cross_service_learning_442(p_company_id uuid)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare
 v_end timestamptz:=date_trunc('day',statement_timestamp() at time zone 'UTC') at time zone 'UTC';
 v_middle timestamptz;v_start timestamptz;v_company_jobs integer;v_module_count integer;
 v_module record;v_period record;v_first integer;v_linked integer;v_unlinked integer;
 v_dispatch integer;v_production integer;v_proofs integer;v_qc integer;
 v_invoice integer;v_specialist integer;v_services jsonb:='[]'::jsonb;
 v_row jsonb;
begin
 perform public.ywi_422_assert_owner(p_company_id);
 v_middle:=v_end-interval '14 days';v_start:=v_end-interval '28 days';
 select count(*) into v_module_count from public.ywi_company_service_modules
  where company_id=p_company_id and module_key in
   ('landscape','construction','water_parks','snow_removal','snow_plowing','septic');
 if v_module_count<>6 then raise exception '442 incomplete six-service company registry';end if;
 select count(*) into v_company_jobs from public.work_orders where company_id=p_company_id;
 if v_company_jobs>2000 then raise exception '442 original Jobs population over review cap';end if;
 for v_module in select module_key,enabled from public.ywi_company_service_modules
    where company_id=p_company_id and module_key in
      ('landscape','construction','water_parks','snow_removal','snow_plowing','septic')
    order by module_key loop
  if v_module.module_key not in
   ('landscape','construction','water_parks','snow_removal','snow_plowing','septic')
   or v_module.enabled is null then raise exception '442 malformed service entitlement';end if;
  v_row:=jsonb_build_object('service',v_module.module_key,'enabled',v_module.enabled);
  for v_period in select * from (values
   ('previous'::text,v_start,v_middle),('current'::text,v_middle,v_end))
   as bounds(label,starts,ends) loop
   -- Rows with no customer or valid company-owned site are separately counted;
   -- they cannot establish a trusted first customer job or be silently dropped.
   select count(*) into v_unlinked from public.work_orders w
    where w.company_id=p_company_id and w.service_module_key=v_module.module_key
      and w.created_at>=v_period.starts and w.created_at<v_period.ends and
      (w.client_id is null or w.client_site_id is null or not exists (
        select 1 from public.ywi_company_client_links_422 c
        join public.ywi_company_site_links_422 s
         on s.company_id=c.company_id and s.client_id=c.client_id
        join public.clients cl on cl.id=c.client_id and cl.is_active
        join public.client_sites cs on cs.id=s.client_site_id
         and cs.client_id=c.client_id and cs.is_active
        where c.company_id=p_company_id and c.client_id=w.client_id
         and s.client_site_id=w.client_site_id));
   with first_orders as (
     select w.id,w.client_id,w.client_site_id,w.created_at,
      row_number() over(partition by w.client_id order by w.created_at,w.id) as first_rank
     from public.work_orders w where w.company_id=p_company_id
       and w.service_module_key=v_module.module_key
       and w.created_at<v_period.ends
   ), cohort as (
     select f.* from first_orders f
      where f.first_rank=1 and f.created_at>=v_period.starts
        and f.created_at<v_period.ends
   ), evidence as (
     select c.id,
      exists (select 1 from public.ywi_company_client_links_422 l
       join public.ywi_company_site_links_422 s
        on s.company_id=l.company_id and s.client_id=l.client_id
       join public.clients cl on cl.id=l.client_id and cl.is_active
       join public.client_sites cs on cs.id=s.client_site_id
        and cs.client_id=l.client_id and cs.is_active
       where l.company_id=p_company_id and l.client_id=c.client_id
        and s.client_site_id=c.client_site_id) as linked,
      exists (select 1 from public.dispatch_schedule_items d where d.work_order_id=c.id) as dispatched,
      exists (select 1 from public.job_sessions j where j.work_order_id=c.id) as produced,
      exists (select 1 from public.work_order_execution_proofs p where p.work_order_id=c.id) as proved,
      exists (select 1 from public.work_order_quality_control_runs q where q.work_order_id=c.id) as qc,
      exists (select 1 from public.ar_invoices i where i.work_order_id=c.id and i.client_id=c.client_id) as invoiced,
      case v_module.module_key
       when 'landscape' then exists (select 1 from public.ywi_landscape_field_receipts_424 x where x.company_id=p_company_id and x.work_order_id=c.id)
       when 'construction' then exists (select 1 from public.ywi_construction_permit_notes_425 x where x.company_id=p_company_id and x.work_order_id=c.id)
       when 'water_parks' then exists (select 1 from public.ywi_aquatic_inspections_426 x where x.company_id=p_company_id and x.work_order_id=c.id)
       when 'snow_removal' then exists (select 1 from public.ywi_snow_service_receipts_427 x where x.company_id=p_company_id and x.work_order_id=c.id and x.service_module_key='snow_removal')
       when 'snow_plowing' then exists (select 1 from public.ywi_snow_service_receipts_427 x where x.company_id=p_company_id and x.work_order_id=c.id and x.service_module_key='snow_plowing')
       when 'septic' then exists (select 1 from public.ywi_septic_disposal_receipts_428 x where x.company_id=p_company_id and x.work_order_id=c.id)
       else false end as specialist
     from cohort c
   )
   select count(*),count(*) filter(where linked),count(*) filter(where dispatched),
    count(*) filter(where produced),count(*) filter(where proved),
    count(*) filter(where qc),count(*) filter(where invoiced),
    count(*) filter(where specialist)
   into v_first,v_linked,v_dispatch,v_production,v_proofs,v_qc,v_invoice,v_specialist
   from evidence;
   v_row:=v_row || jsonb_build_object(v_period.label,jsonb_build_object(
    'first_jobs',v_first,'verified_customer_site',v_linked,
    'unlinked_original_jobs',v_unlinked,'dispatch_present',v_dispatch,
    'production_present',v_production,'execution_proof_present',v_proofs,
    'qc_present',v_qc,'invoice_present',v_invoice,'specialist_receipt_present',v_specialist));
  end loop;
  v_services:=v_services||jsonb_build_array(v_row);
 end loop;
 return jsonb_build_object('company_id',p_company_id,
  'captured_at',statement_timestamp(),'owner_guard','ywi_422_assert_owner',
  'periods',jsonb_build_object('previous',jsonb_build_object('start',v_start,'end',v_middle),
   'current',jsonb_build_object('start',v_middle,'end',v_end)),
  'source_coverage','complete','capped',false,'max_original_jobs',2000,
  'total_company_jobs',v_company_jobs,'minimum_per_service_period',10,
  'services',v_services,'privacy_minimized',true,'synthetic',false,
  'comparison_accepted',false,'roi',null,'employee_ranking',null,
  'causal_improvement',null,'mutation_authorized',false);
end $$;
revoke all on function public.ywi_rpc_cross_service_learning_442(uuid)
 from public,anon,authenticated;
grant execute on function public.ywi_rpc_cross_service_learning_442(uuid)
 to authenticated;
comment on function public.ywi_rpc_cross_service_learning_442(uuid) is
 '442 owner-only capped aggregate, first-recorded Jobs by customer/service in two past UTC 14-day cohorts; only source presence, no employee/customer identities, approvals, ROI or writes.';
commit;
