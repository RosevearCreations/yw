-- YW 453: private company-level job-cost allocation and comparable planning reports.
-- Numbers are source-labelled operator claims, NOT approved original Job costs,
-- wage data, payroll, invoices, recognized revenue, tax or Finance postings.
begin;

create table public.ywi_pms_job_cost_lines_453 (
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null references public.ywi_companies(id) on delete restrict,
 work_order_id uuid not null references public.work_orders(id) on delete restrict,
 request_id uuid not null,
 category text not null check(category in
  ('revenue_plan','workforce_burden','material','equipment','subcontract','overhead')),
 amount_cents bigint not null check(amount_cents between 0 and 10000000000),
 source_reference text not null check(char_length(btrim(source_reference)) between 3 and 160),
 report_status text not null check(report_status in ('draft','for_review','disputed')),
 correction_of uuid,
 notes text check(notes is null or char_length(notes)<=500),
 recorded_at timestamptz not null default now(),
 recorded_by uuid not null references auth.users(id) on delete restrict,
 unique(company_id,id),unique(company_id,request_id),
 foreign key(company_id,correction_of)
  references public.ywi_pms_job_cost_lines_453(company_id,id) on delete restrict
);
create unique index ywi_453_one_successor on public.ywi_pms_job_cost_lines_453(company_id,correction_of)
 where correction_of is not null;
create index ywi_453_company_order on public.ywi_pms_job_cost_lines_453(company_id,work_order_id,recorded_at desc);
alter table public.ywi_pms_job_cost_lines_453 enable row level security;
revoke all on public.ywi_pms_job_cost_lines_453 from public,anon,authenticated;
-- No table grants or RLS allow policies. Security-definer RPCs verify real
-- company ownership AND independent Admin/Finance field access on every call.

create function public.ywi_453_reject_rewrite()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 raise exception '453 costing records are immutable; append an explicit correction';
end $$;
create trigger ywi_453_no_rewrite before update or delete
 on public.ywi_pms_job_cost_lines_453 for each row
 execute function public.ywi_453_reject_rewrite();

create function public.ywi_453_assert_cost_scope(p_company_id uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
 perform public.ywi_447_assert_accounting_scope(p_company_id,'costs');
 perform public.ywi_447_assert_accounting_scope(p_company_id,'reports');
end $$;

create function public.ywi_rpc_pms_job_cost_snapshot_453(p_company_id uuid)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_orders jsonb;v_lines jsonb;v_order_count integer;v_line_count integer;
 v_revenue bigint;v_cost bigint;v_accepted integer;
begin
 perform public.ywi_453_assert_cost_scope(p_company_id);
 select count(*) into v_order_count from public.work_orders w
 join public.ywi_company_site_links_422 s on s.company_id=w.company_id
  and s.client_id=w.client_id and s.client_site_id=w.client_site_id
 where w.company_id=p_company_id;
 select count(*) into v_line_count from public.ywi_pms_job_cost_lines_453 where company_id=p_company_id;
 if v_order_count>60 or v_line_count>200 then
  raise exception '453 complete original order/cost review cap exceeded';end if;
 if exists (select 1 from public.ywi_pms_job_cost_lines_453 l
  left join public.work_orders w on w.id=l.work_order_id and w.company_id=l.company_id
  left join public.ywi_company_site_links_422 s on s.company_id=w.company_id
   and s.client_id=w.client_id and s.client_site_id=w.client_site_id
  where l.company_id=p_company_id and s.company_id is null) then
  raise exception '453 original source no longer matches company/property';end if;
 select coalesce(jsonb_agg(to_jsonb(x) order by x.id),'[]'::jsonb) into v_orders from (
  select w.id,w.company_id,w.client_id,w.client_site_id as site_id,
   w.work_order_number as number,w.service_module_key as service,w.status
  from public.work_orders w
  join public.ywi_company_site_links_422 s on s.company_id=w.company_id
   and s.client_id=w.client_id and s.client_site_id=w.client_site_id
  where w.company_id=p_company_id order by w.created_at desc,w.id desc limit 60
 ) x;
 select coalesce(jsonb_agg(to_jsonb(x) order by x.recorded_at desc,x.id desc),'[]'::jsonb)
 into v_lines from (
  select id,company_id,work_order_id,category,amount_cents,source_reference,
   report_status,correction_of,notes,recorded_at
  from public.ywi_pms_job_cost_lines_453 where company_id=p_company_id
  order by recorded_at desc,id desc limit 200
 ) x;
 -- Include only the latest leaf in each correction chain. Draft/disputed
 -- amounts remain visible with their source but are never counted as reports.
 select coalesce(sum(l.amount_cents) filter(where l.category='revenue_plan'),0),
        coalesce(sum(l.amount_cents) filter(where l.category<>'revenue_plan'),0),
        count(*)
 into v_revenue,v_cost,v_accepted
 from public.ywi_pms_job_cost_lines_453 l
 where l.company_id=p_company_id and l.report_status='for_review'
 and not exists(select 1 from public.ywi_pms_job_cost_lines_453 successor
  where successor.company_id=l.company_id and successor.correction_of=l.id);
 return jsonb_build_object('company_id',p_company_id,'captured_at',statement_timestamp(),
  'owner_guard','ywi_453_assert_cost_scope','accounting_fields',jsonb_build_array('costs','reports'),
  'orders',v_orders,'order_count',v_order_count,'lines',v_lines,'line_count',v_line_count,
  'report',jsonb_build_object('currency','CAD','revenue_cents',v_revenue,
   'cost_cents',v_cost,'difference_cents',v_revenue-v_cost,'included_count',v_accepted),
  'source_kind','operator_plan_only','original_438_costs_not_duplicated',true,
  'wages_exposed',false,'individual_rates_exposed',false,'payroll_executed',false,
  'ledger_posted',false,'verified_profit',false,'invoice_created',false,
  'cross_company_grant',false,'mutation_authorized',false);
end $$;

create function public.ywi_rpc_pms_job_cost_append_453(
 p_company_id uuid,p_work_order_id uuid,p_request_id uuid,p_category text,
 p_amount_cents bigint,p_source_reference text,p_status text,
 p_correction_of uuid default null,p_notes text default null)
returns uuid language plpgsql volatile security definer set search_path='' as $$
declare v_existing record;v_prior record;v_id uuid;
 v_ref text:=btrim(coalesce(p_source_reference,''));
 v_notes text:=nullif(btrim(coalesce(p_notes,'')),'');
begin
 perform public.ywi_453_assert_cost_scope(p_company_id);
 if p_work_order_id is null or p_request_id is null or
  p_category not in ('revenue_plan','workforce_burden','material','equipment','subcontract','overhead') or
  p_category is null or p_amount_cents not between 0 and 10000000000 or
  p_amount_cents is null or char_length(v_ref) not between 3 and 160 or
  p_status not in ('draft','for_review','disputed') or p_status is null or
  char_length(coalesce(v_notes,''))>500 then
  raise exception '453 invalid non-posting cost source';end if;
 if not exists(select 1 from public.work_orders w
  join public.ywi_company_site_links_422 s on s.company_id=w.company_id
    and s.client_id=w.client_id and s.client_site_id=w.client_site_id
  where w.company_id=p_company_id and w.id=p_work_order_id) then
  raise exception '453 original Jobs company and site link required';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('job-cost:'||p_company_id::text,453));
 select * into v_existing from public.ywi_pms_job_cost_lines_453
  where company_id=p_company_id and request_id=p_request_id;
 if found then
  if v_existing.work_order_id is distinct from p_work_order_id or
   v_existing.category is distinct from p_category or
   v_existing.amount_cents is distinct from p_amount_cents or
   v_existing.source_reference is distinct from v_ref or
   v_existing.report_status is distinct from p_status or
   v_existing.correction_of is distinct from p_correction_of or
   v_existing.notes is distinct from v_notes then
   raise exception '453 changed request replay denied';end if;
  return v_existing.id;
 end if;
 if p_correction_of is not null then
  select * into v_prior from public.ywi_pms_job_cost_lines_453
   where company_id=p_company_id and id=p_correction_of;
  if not found or v_prior.work_order_id<>p_work_order_id or
   v_prior.category<>p_category or
   exists(select 1 from public.ywi_pms_job_cost_lines_453
    where company_id=p_company_id and correction_of=p_correction_of) then
   raise exception '453 correction must match original company/order/category and remain unbranched';end if;
 end if;
 if (select count(*) from public.ywi_pms_job_cost_lines_453 where company_id=p_company_id)>=200 then
  raise exception '453 bounded report history cap reached';end if;
 insert into public.ywi_pms_job_cost_lines_453(company_id,work_order_id,request_id,
  category,amount_cents,source_reference,report_status,correction_of,notes,recorded_by)
 values(p_company_id,p_work_order_id,p_request_id,p_category,p_amount_cents,
  v_ref,p_status,p_correction_of,v_notes,auth.uid()) returning id into v_id;
 return v_id;
end $$;

revoke all on function public.ywi_453_reject_rewrite() from public,anon,authenticated;
revoke all on function public.ywi_453_assert_cost_scope(uuid) from public,anon,authenticated;
revoke all on function public.ywi_rpc_pms_job_cost_snapshot_453(uuid) from public,anon,authenticated;
revoke all on function public.ywi_rpc_pms_job_cost_append_453(uuid,uuid,uuid,text,bigint,text,text,uuid,text)
 from public,anon,authenticated;
grant execute on function public.ywi_rpc_pms_job_cost_snapshot_453(uuid) to authenticated;
grant execute on function public.ywi_rpc_pms_job_cost_append_453(uuid,uuid,uuid,text,bigint,text,text,uuid,text)
 to authenticated;
commit;
