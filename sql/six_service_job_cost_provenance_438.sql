begin;

-- YW 438: bounded original-price/cost provenance across six distinct services.
-- NO Finance posting, payroll, inventory movement, quote changes or invoicing.
-- Approved execution proof is the ONLY candidate cost subtotal; other ledgers
-- are independent corroborating originals, never additive expenses.
create or replace function public.ywi_rpc_job_cost_provenance_438(
 p_company_id uuid,p_work_order_id uuid default null
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
 v_order public.work_orders%rowtype;
 v_estimate public.estimates%rowtype;
 v_orders jsonb:='[]'::jsonb;
 v_estimate_lines jsonb:='[]'::jsonb;
 v_order_lines jsonb:='[]'::jsonb;
 v_proofs jsonb:='[]'::jsonb;
 v_crew jsonb:='[]'::jsonb;
 v_issues jsonb:='[]'::jsonb;
 v_issue_lines jsonb:='[]'::jsonb;
 v_allocations jsonb:='[]'::jsonb;
 v_equipment jsonb:='[]'::jsonb;
 v_candidates jsonb:='[]'::jsonb;
 v_postings jsonb:='[]'::jsonb;
 v_invoices jsonb:='[]'::jsonb;
 v_count int;
begin
 perform public.ywi_422_assert_owner(p_company_id);
 select count(*) into v_count from public.work_orders
  where company_id=p_company_id and service_module_key in
    ('landscape','construction','water_parks','snow_removal','snow_plowing','septic');
 if v_count>60 then raise exception '438 owner original Jobs directory exceeds cap';end if;
 select coalesce(jsonb_agg(x),'[]'::jsonb) into v_orders from (
  select id,work_order_number as number,status,service_module_key as service
  from public.work_orders where company_id=p_company_id and service_module_key in
   ('landscape','construction','water_parks','snow_removal','snow_plowing','septic')
  order by created_at desc,id limit 60
 ) x;
 if p_work_order_id is null then
  return jsonb_build_object('company_id',p_company_id,'work_order_id',null,
   'orders',v_orders,'source_limit',120,'complete',true,'state','choose_order',
   'finance_mutation',false,'job_mutation',false,'payroll_mutation',false);
 end if;
 perform public.ywi_423_assert_order(p_company_id,p_work_order_id,false);
 select * into strict v_order from public.work_orders where id=p_work_order_id
  and company_id=p_company_id and service_module_key in
   ('landscape','construction','water_parks','snow_removal','snow_plowing','septic');
 if v_order.estimate_id is not null then
  select * into v_estimate from public.estimates where id=v_order.estimate_id;
 end if;
 select coalesce(jsonb_agg(x),'[]'::jsonb) into v_estimate_lines from (
  select id,estimate_id,quantity,cost_total,line_total from public.estimate_lines
  where estimate_id=v_order.estimate_id order by line_order,id limit 121
 ) x;
 select coalesce(jsonb_agg(x),'[]'::jsonb) into v_order_lines from (
  select id,work_order_id,quantity,cost_total,line_total,actual_material_cost,
   received_cost_total from public.work_order_lines
  where work_order_id=p_work_order_id order by line_order,id limit 121
 ) x;
 select coalesce(jsonb_agg(x),'[]'::jsonb) into v_proofs from (
  select id,work_order_id,proof_type,proof_status,occurred_at,approved_at,
   approved_by_profile_id,labour_minutes,labour_hourly_rate,
   labour_cost_total,material_cost_total,equipment_cost_total,other_cost_total,total_cost
  from public.work_order_execution_proofs where work_order_id=p_work_order_id
  order by occurred_at,id limit 121
 ) x;
 select coalesce(jsonb_agg(x),'[]'::jsonb) into v_crew from (
  select id,work_order_id,job_id,job_session_id,hours_worked,regular_hours,overtime_hours,
   time_entry_id,created_at from public.job_session_crew_hours
  where work_order_id=p_work_order_id order by created_at,id limit 121
 ) x;
 select coalesce(jsonb_agg(x),'[]'::jsonb) into v_issues from (
  select id,work_order_id,issue_status,issue_total,estimated_material_total,
   issue_date from public.material_issues where work_order_id=p_work_order_id
  order by issue_date,id limit 121
 ) x;
 select coalesce(jsonb_agg(x),'[]'::jsonb) into v_issue_lines from (
  select ml.id,ml.issue_id,mi.work_order_id as issue_work_order_id,
   ml.work_order_line_id,ml.usage_type,ml.quantity,ml.unit_cost,ml.line_total
  from public.material_issue_lines ml
  join public.material_issues mi on mi.id=ml.issue_id
  where mi.work_order_id=p_work_order_id
  order by ml.created_at,ml.id limit 121
 ) x;
 select coalesce(jsonb_agg(x),'[]'::jsonb) into v_equipment from (
  select id,work_order_id,job_id,equipment_item_id,checked_out_at,returned_at,
   verification_status,checkout_safety_test_status
  from public.equipment_signouts where work_order_id=p_work_order_id
  order by checked_out_at,id limit 121
 ) x;
 select coalesce(jsonb_agg(x),'[]'::jsonb) into v_allocations from (
  select p.id,p.company_id,p.work_order_id,p.material_issue_line_id,
   p.equipment_signout_id,p.recorded_at,
   (p.source_fingerprint=public.ywi_423_source_fingerprint(
    case when p.material_issue_line_id is not null then 'material' else 'equipment' end,
    coalesce(p.material_issue_line_id::text,p.equipment_signout_id::text))) as source_fresh
  from public.ywi_work_order_allocation_proofs_423 p
  where p.company_id=p_company_id and p.work_order_id=p_work_order_id
  order by p.recorded_at,p.id limit 121
 ) x;
 select coalesce(jsonb_agg(x),'[]'::jsonb) into v_candidates from (
  select id,work_order_id,estimate_id,candidate_status,subtotal,tax_total,total_amount
  from public.job_invoice_candidates where work_order_id=p_work_order_id
  order by created_at,id limit 121
 ) x;
 select coalesce(jsonb_agg(x),'[]'::jsonb) into v_postings from (
  select p.id,p.invoice_candidate_id,c.work_order_id as candidate_work_order_id,
   p.ar_invoice_id,p.posting_status,p.posted_at
  from public.job_invoice_postings p
  join public.job_invoice_candidates c on c.id=p.invoice_candidate_id
  where c.work_order_id=p_work_order_id
  order by p.created_at,p.id limit 121
 ) x;
 select coalesce(jsonb_agg(x),'[]'::jsonb) into v_invoices from (
  select id,work_order_id,invoice_status,invoice_source,subtotal,tax_total,
   total_amount,balance_due,amount_paid,created_at
  from public.ar_invoices where work_order_id=p_work_order_id
  order by created_at,id limit 121
 ) x;
 v_count=jsonb_array_length(v_estimate_lines)+jsonb_array_length(v_order_lines)+
  jsonb_array_length(v_proofs)+jsonb_array_length(v_crew)+
  jsonb_array_length(v_issues)+jsonb_array_length(v_issue_lines)+
  jsonb_array_length(v_equipment)+jsonb_array_length(v_allocations)+
  jsonb_array_length(v_candidates)+jsonb_array_length(v_postings)+
  jsonb_array_length(v_invoices);
 if v_count>120 then raise exception '438 original cost evidence exceeds bounded review cap';end if;
 return jsonb_build_object('company_id',p_company_id,'work_order_id',p_work_order_id,
  'orders',v_orders,'source_limit',120,'complete',true,'state','review_only',
  'order',jsonb_build_object('id',v_order.id,'estimate_id',v_order.estimate_id,
   'legacy_job_id',v_order.legacy_job_id,'subtotal',v_order.subtotal,
   'tax_total',v_order.tax_total,'total_amount',v_order.total_amount,
   'approval_status',v_order.approval_status,
   'estimate_baseline_cost_total',v_order.estimate_baseline_cost_total,
   'estimate_baseline_charge_total',v_order.estimate_baseline_charge_total),
  'estimate',case when v_estimate.id is null then null else jsonb_build_object(
   'id',v_estimate.id,'company_id',v_estimate.company_id,
   'service_module_key',v_estimate.service_module_key,
   'subtotal',v_estimate.subtotal,'total_amount',v_estimate.total_amount,
   'total_cost',v_estimate.total_cost,'status',v_estimate.status,
   'approval_status',v_estimate.approval_status,'approved_at',v_estimate.approved_at) end,
  'estimate_lines',v_estimate_lines,'order_lines',v_order_lines,
  'proofs',v_proofs,'crew_hours',v_crew,'material_issues',v_issues,
  'material_lines',v_issue_lines,'equipment',v_equipment,
  'allocations',v_allocations,'invoice_candidates',v_candidates,
  'invoice_postings',v_postings,'ar_invoices',v_invoices,
  'finance_mutation',false,'job_mutation',false,'payroll_mutation',false);
end $$;
revoke all on function public.ywi_rpc_job_cost_provenance_438(uuid,uuid)
 from public,anon,authenticated;
grant execute on function public.ywi_rpc_job_cost_provenance_438(uuid,uuid)
 to authenticated;
comment on function public.ywi_rpc_job_cost_provenance_438(uuid,uuid) is
 'YW 438 read-only owner and original Jobs scoped cost-source provenance, no duplicate expenses or Finance/posting authority.';
commit;
