-- Item 432: read-only bridge to original Estimates, quote acceptance, Jobs and release proof.
-- Depends on 420/421/422. No second agreement, estimate, work order or approval authority.
-- Owner + Jobs permission + exact original customer/property link are always checked.
begin;

create or replace function public.ywi_rpc_estimate_job_handoff_432(
 p_company_id uuid,p_client_id uuid,p_site_id uuid
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
 v_est public.estimates%rowtype;
 v_job public.work_orders%rowtype;
 v_quote public.estimate_quote_packages%rowtype;
 v_release public.work_order_release_reviews%rowtype;
 v_estimates jsonb := '[]'::jsonb;
 v_jobs jsonb;
 v_est_lines jsonb;
 v_job_lines jsonb;
 v_count integer;
 v_job_count integer;
 v_enabled boolean;
 v_deposit_paid numeric;
 v_deposit_required numeric;
 v_est_gate boolean;
 v_job_gate boolean;
begin
 perform public.ywi_422_assert_link(p_company_id,p_client_id,p_site_id);
 select count(*) into v_count from public.estimates e
 where e.company_id=p_company_id and e.client_id=p_client_id and e.client_site_id=p_site_id;
 if v_count>50 then raise exception '432 estimate source exceeds 50-record audit limit'; end if;

 for v_est in select e.* from public.estimates e
  where e.company_id=p_company_id and e.client_id=p_client_id and e.client_site_id=p_site_id
  order by e.created_at desc,e.id desc limit 51
 loop
  select m.enabled into v_enabled from public.ywi_company_service_modules m
   where m.company_id=p_company_id and m.module_key=v_est.service_module_key;
  select exists(select 1 from public.ywi_new_work_gate_receipts_421 r
   where r.company_id=p_company_id and r.service_module_key=v_est.service_module_key
    and r.target_table='estimates' and r.target_id=v_est.id) into v_est_gate;
  select q.* into v_quote from public.estimate_quote_packages q
   where q.estimate_id=v_est.id limit 1;
  select coalesce(jsonb_agg(to_jsonb(l) order by l.line_order,l.id),'[]'::jsonb)
   into v_est_lines from (
    select id,line_order,description,quantity,unit_price,line_total from public.estimate_lines
    where estimate_id=v_est.id and client_visible is distinct from false
    order by line_order,id limit 51
   ) l;
  if jsonb_array_length(v_est_lines)>50 then raise exception '432 estimate line source capped'; end if;

  select coalesce(sum(d.paid_amount),0) into v_deposit_paid
    from public.customer_deposit_requests d
    where d.estimate_id=v_est.id and d.deposit_status='paid' and d.paid_at is not null;
  v_deposit_required:=greatest(coalesce(v_est.deposit_required_amount,0),
    round(coalesce(v_est.total_amount,0)*coalesce(v_est.deposit_required_percent,0)/100.0,2),
    coalesce(v_quote.deposit_required_amount,0));
  v_jobs:='[]'::jsonb;
  v_job_count:=0;
  -- A rogue cross-tenant estimate link must not reveal foreign job IDs or titles.
  -- Its absence still leaves the owner's source estimate explicitly unlinked/HOLD.
  for v_job in select w.* from public.work_orders w
    where w.estimate_id=v_est.id and w.company_id=p_company_id
      and w.client_id=p_client_id and w.client_site_id=p_site_id
    order by w.created_at,w.id limit 3
  loop
   v_job_count:=v_job_count+1;
   if v_job_count>2 then raise exception '432 job source exceeds duplicate audit limit'; end if;
   select r.* into v_release from public.work_order_release_reviews r
    where r.work_order_id=v_job.id limit 1;
   select exists(select 1 from public.ywi_new_work_gate_receipts_421 r
    where r.company_id=p_company_id and r.service_module_key=v_est.service_module_key
     and r.target_table='work_orders' and r.target_id=v_job.id) into v_job_gate;
   select coalesce(jsonb_agg(to_jsonb(l) order by l.line_order,l.id),'[]'::jsonb)
    into v_job_lines from (
     select id,line_order,description,quantity,unit_price,line_total from public.work_order_lines
     where work_order_id=v_job.id and change_order_id is null and client_visible is distinct from false
     order by line_order,id limit 51
    ) l;
   if jsonb_array_length(v_job_lines)>50 then raise exception '432 work-order line source capped'; end if;
   v_jobs:=v_jobs||jsonb_build_array(jsonb_build_object(
    'id',v_job.id,'number',v_job.work_order_number,'created_at',v_job.created_at,
    'status',v_job.status,'company_id',v_job.company_id,'service',v_job.service_module_key,
    -- Only equality flags leave the bridge; no foreign customer/site identifiers escape.
    'customer_property_matches',v_job.client_id=p_client_id and v_job.client_site_id=p_site_id,
    'estimate_id',v_job.estimate_id,'total_amount',v_job.total_amount,
    'approval_required',v_job.approval_required,'approval_status',v_job.approval_status,
    'approved_at',v_job.approved_at,'approved_by',v_job.approved_by_profile_id is not null,
    'new_work_gate_recorded',v_job_gate,'base_lines',v_job_lines,
    'release',case when v_release.id is null then null else jsonb_build_object(
     'status',v_release.release_status,'threshold',v_release.threshold_status,
     'signoff_at',v_release.signoff_at,'signoff_by',v_release.signoff_profile_id is not null)
    end));
  end loop;
  v_estimates:=v_estimates||jsonb_build_array(jsonb_build_object(
   'id',v_est.id,'number',v_est.estimate_number,'created_at',v_est.created_at,
   'updated_at',v_est.updated_at,'status',v_est.status,'service',v_est.service_module_key,
   'company_id',v_est.company_id,'client_id',v_est.client_id,'site_id',v_est.client_site_id,
   'title',v_est.quote_title,'scope_notes',v_est.scope_notes,'total_amount',v_est.total_amount,
   'pricing_basis',v_est.pricing_basis_label,'lines',v_est_lines,
   'approval_required',v_est.approval_required,'approval_status',v_est.approval_status,
   'approved_at',v_est.approved_at,'approved_by',v_est.approved_by_profile_id is not null,
   'quote',case when v_quote.id is null then null else jsonb_build_object(
     'status',v_quote.package_status,'accepted_at',v_quote.accepted_at,
     'accepted_by_recorded',nullif(btrim(coalesce(v_quote.accepted_by_name,'')),'') is not null,
     'terms_version_recorded',nullif(btrim(coalesce(v_quote.portal_terms_version,'')),'') is not null)
    end,'deposit_required',v_deposit_required,'deposit_paid_recorded',v_deposit_paid,
   'service_enabled',coalesce(v_enabled,false),'new_work_gate_recorded',v_est_gate,
   'converted_work_order_id',v_est.converted_work_order_id,'converted_at',v_est.converted_at,
   'jobs',v_jobs));
 end loop;
 return jsonb_build_object('company_id',p_company_id,'client_id',p_client_id,
  'site_id',p_site_id,'canonical_source','original_estimates_work_orders_213_421_422',
  'retrieved_at',now(),'estimate_limit',50,'historical_disabled_visible',true,
  'customer_agreement_created',false,'business_mutations',false,'estimates',v_estimates);
end $$;

revoke all on function public.ywi_rpc_estimate_job_handoff_432(uuid,uuid,uuid)
 from public,anon,authenticated;
grant execute on function public.ywi_rpc_estimate_job_handoff_432(uuid,uuid,uuid) to authenticated;
comment on function public.ywi_rpc_estimate_job_handoff_432(uuid,uuid,uuid) is
 'Read-only original 213/421/422 owner-linked estimate-to-job audit. Independent customer receipt, price, Jobs release and entitlement remain separate; no approvals are made.';
commit;
