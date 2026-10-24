begin;

-- YW Build 437 — original QC/closeout/customer-portal provenance, read only.
-- No operator QC approval, customer signature, notice, reopen, billing or Jobs write.
-- The exact company is asserted before SECURITY DEFINER inspects protected tables.
create or replace function public.ywi_rpc_quality_customer_handoff_437(
  p_company_id uuid, p_work_order_id uuid default null
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_orders jsonb := '[]'::jsonb;
  v_run public.work_order_quality_control_runs%rowtype;
  v_closeout public.work_order_closeout_packages%rowtype;
  v_items jsonb := '[]'::jsonb;
  v_deficiencies jsonb := '[]'::jsonb;
  v_rework jsonb := '[]'::jsonb;
  v_evidence jsonb := '[]'::jsonb;
  v_signoffs jsonb := '[]'::jsonb;
  v_count integer;
begin
  perform public.ywi_422_assert_owner(p_company_id);
  select count(*) into v_count from public.work_orders
    where company_id = p_company_id and
      service_module_key in ('landscape','construction','water_parks','snow_removal','snow_plowing','septic');
  if v_count > 60 then raise exception '437 original Jobs directory exceeds the bounded owner review limit'; end if;
  select coalesce(jsonb_agg(x),'[]'::jsonb) into v_orders from (
    select wo.id, wo.work_order_number as number, wo.status, wo.service_module_key as service
    from public.work_orders wo
    where wo.company_id = p_company_id and
      wo.service_module_key in ('landscape','construction','water_parks','snow_removal','snow_plowing','septic')
    order by wo.created_at desc, wo.id limit 60
  ) x;
  if p_work_order_id is null then
    return jsonb_build_object('company_id',p_company_id,'work_order_id',null,
      'orders',v_orders,'source_limit',80,'complete',true,'state','choose_order',
      'approval_or_signature_write',false);
  end if;
  perform public.ywi_423_assert_order(p_company_id,p_work_order_id,false);
  if not exists(select 1 from public.work_orders
    where id=p_work_order_id and company_id=p_company_id and
      service_module_key in ('landscape','construction','water_parks','snow_removal','snow_plowing','septic')) then
    raise exception '437 original work order is not an owned six-service work order';
  end if;
  select * into v_run from public.work_order_quality_control_runs
    where work_order_id=p_work_order_id;
  select * into v_closeout from public.work_order_closeout_packages
    where work_order_id=p_work_order_id;
  select
    (select count(*) from public.work_order_quality_control_items where qc_run_id=v_run.id)
    +(select count(*) from public.work_order_quality_control_deficiencies where qc_run_id=v_run.id)
    +(select count(*) from public.work_order_quality_control_rework_events e
        join public.work_order_quality_control_deficiencies d on d.id=e.deficiency_id
        where d.qc_run_id=v_run.id)
    +(select count(*) from public.work_order_quality_control_evidence_links where qc_run_id=v_run.id)
    +(select count(*) from public.work_order_customer_closeout_signoffs where closeout_package_id=v_closeout.id)
    into v_count;
  if v_count>80 then raise exception '437 QC, objection or customer evidence exceeds the audited cap'; end if;
  select coalesce(jsonb_agg(x),'[]'::jsonb) into v_items from (
    select id,qc_run_id,is_required,result_status,evidence_requirement,completed_at
    from public.work_order_quality_control_items where qc_run_id=v_run.id
    order by sort_order,id
  ) x;
  select coalesce(jsonb_agg(x),'[]'::jsonb) into v_deficiencies from (
    select id,qc_run_id,qc_item_id,severity,deficiency_status,opened_at,resolved_at
    from public.work_order_quality_control_deficiencies where qc_run_id=v_run.id
    order by opened_at,id
  ) x;
  select coalesce(jsonb_agg(x),'[]'::jsonb) into v_rework from (
    select e.id,e.deficiency_id,e.event_type,e.recorded_at,e.resolution_execution_proof_id,
      p.work_order_id as resolution_proof_work_order_id,p.proof_status as resolution_proof_status
    from public.work_order_quality_control_rework_events e
    join public.work_order_quality_control_deficiencies d on d.id=e.deficiency_id
    left join public.work_order_execution_proofs p on p.id=e.resolution_execution_proof_id
    where d.qc_run_id=v_run.id order by e.recorded_at,e.id
  ) x;
  select coalesce(jsonb_agg(x),'[]'::jsonb) into v_evidence from (
    select e.id,e.qc_run_id,e.qc_item_id,e.execution_proof_id,
      e.evidence_role,e.customer_safe,e.linked_at,
      p.work_order_id as proof_work_order_id,p.proof_status,p.customer_visible
    from public.work_order_quality_control_evidence_links e
    left join public.work_order_execution_proofs p on p.id=e.execution_proof_id
    where e.qc_run_id=v_run.id order by e.linked_at,e.id
  ) x;
  select coalesce(jsonb_agg(x),'[]'::jsonb) into v_signoffs from (
    select s.id,s.closeout_package_id,s.signoff_status,s.created_at
    from public.work_order_customer_closeout_signoffs s
    where s.closeout_package_id=v_closeout.id order by s.created_at,s.id
  ) x;
  return jsonb_build_object(
    'company_id',p_company_id,'work_order_id',p_work_order_id,
    'orders',v_orders,'source_limit',80,'complete',true,'state','review_only',
    'qc',case when v_run.id is null then null else jsonb_build_object(
      'id',v_run.id,'work_order_id',v_run.work_order_id,'run_status',v_run.run_status,
      'review_status',v_run.review_status,'reviewed_by_profile_id',v_run.reviewed_by_profile_id,
      'reviewed_at',v_run.reviewed_at,'crew_completed_at',v_run.crew_completed_at
    ) end,
    'items',v_items,'deficiencies',v_deficiencies,'rework',v_rework,'evidence',v_evidence,
    'closeout',case when v_closeout.id is null then null else jsonb_build_object(
      'id',v_closeout.id,'work_order_id',v_closeout.work_order_id,
      'closeout_status',v_closeout.closeout_status,
      'approved_by_profile_id',v_closeout.approved_by_profile_id,
      'approved_at',v_closeout.approved_at,
      'customer_signoff_required',v_closeout.customer_signoff_required,
      'customer_signoff_status',v_closeout.customer_signoff_status,
      'signed_off_at',v_closeout.signed_off_at,
      'customer_change_requested',nullif(btrim(coalesce(v_closeout.customer_change_request_note,'')),'') is not null,
      'invoice_readiness_status',v_closeout.invoice_readiness_status
    ) end,
    'signoffs',v_signoffs,
    'approval_or_signature_write',false,'customer_message_sent',false,'site_reopened',false
  );
end $$;
revoke all on function public.ywi_rpc_quality_customer_handoff_437(uuid,uuid)
  from public,anon,authenticated;
grant execute on function public.ywi_rpc_quality_customer_handoff_437(uuid,uuid)
  to authenticated;
comment on function public.ywi_rpc_quality_customer_handoff_437(uuid,uuid) is
  'YW 437 owner-verified bounded read of original QC, rework, supervisor closeout and customer-portal signoff evidence; no approval or signature authority.';
commit;
