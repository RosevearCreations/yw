-- Item 424: company-owner field attestations about EXISTING landscaping quantities.
-- Job sessions, measured quantities, site zones, execution proofs and QC stay canonical.
-- This append-only receipt neither completes a job nor approves QC or Finance.

create table if not exists public.ywi_landscape_field_receipts_424 (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.ywi_companies(id) on delete restrict,
  work_order_id uuid not null references public.work_orders(id) on delete restrict,
  job_session_id uuid not null references public.job_sessions(id) on delete restrict,
  production_quantity_id uuid not null unique references public.job_session_production_quantities(id) on delete restrict,
  site_zone_id uuid not null references public.client_site_zones(id) on delete restrict,
  execution_proof_id uuid references public.work_order_execution_proofs(id) on delete restrict,
  qc_run_id uuid references public.work_order_quality_control_runs(id) on delete restrict,
  source_fingerprint text not null check (length(source_fingerprint)=64),
  field_observation text not null check (length(btrim(field_observation)) between 20 and 1000),
  source_session_date date not null,
  source_operator_profile_id uuid not null references public.profiles(id) on delete restrict,
  attested_by uuid not null references auth.users(id) on delete restrict,
  attested_at timestamptz not null default now()
);
create index if not exists ywi_424_company_order_receipts_idx
 on public.ywi_landscape_field_receipts_424(company_id,work_order_id,attested_at desc);
alter table public.ywi_landscape_field_receipts_424 enable row level security;
revoke all on public.ywi_landscape_field_receipts_424 from public,anon,authenticated;
grant select on public.ywi_landscape_field_receipts_424 to authenticated;
drop policy if exists ywi_424_owner_receipts_read on public.ywi_landscape_field_receipts_424;
create policy ywi_424_owner_receipts_read on public.ywi_landscape_field_receipts_424
 for select to authenticated using (exists(
  select 1 from public.ywi_companies c where c.id=company_id and c.owner_user_id=(select auth.uid())
 ));
create or replace function public.ywi_424_reject_receipt_edit()
returns trigger language plpgsql security definer set search_path='' as $$
begin raise exception '424 field evidence is append-only; correct the canonical quantity and review the hold'; end $$;
revoke all on function public.ywi_424_reject_receipt_edit() from public,anon,authenticated;
drop trigger if exists ywi_424_no_receipt_rewrite on public.ywi_landscape_field_receipts_424;
create trigger ywi_424_no_receipt_rewrite before update or delete
 on public.ywi_landscape_field_receipts_424 for each row execute function public.ywi_424_reject_receipt_edit();

create or replace function public.ywi_424_fingerprint(p_quantity_id uuid)
returns text language plpgsql stable security definer set search_path='' as $$
declare v_payload jsonb;
begin
 select jsonb_build_object('quantity',to_jsonb(q),'session',jsonb_build_object(
  'id',s.id,'order',s.work_order_id,'date',s.session_date,'status',s.session_status,
  'started',s.started_at,'ended',s.ended_at),'zone',jsonb_build_object(
  'id',z.id,'property',z.client_site_id,'active',z.is_active,'name',z.zone_name))
 into v_payload from public.job_session_production_quantities q
 join public.job_sessions s on s.id=q.job_session_id
 left join public.client_site_zones z on z.id=q.client_site_zone_id
 where q.id=p_quantity_id;
 if v_payload is null then raise exception '424 original measured quantity missing'; end if;
 return encode(extensions.digest(convert_to(v_payload::text,'UTF8'),'sha256'),'hex');
end $$;
revoke all on function public.ywi_424_fingerprint(uuid) from public,anon,authenticated;

create or replace function public.ywi_424_assert_landscape_order(
 p_company_id uuid,p_work_order_id uuid,p_write boolean default false
) returns void language plpgsql security definer set search_path='' as $$
begin
 perform public.ywi_423_assert_order(p_company_id,p_work_order_id,p_write);
 if not exists(select 1 from public.work_orders wo where wo.id=p_work_order_id
  and wo.company_id=p_company_id and wo.service_module_key='landscape') then
  raise exception '424 only original landscaping company work orders accepted';
 end if;
end $$;
revoke all on function public.ywi_424_assert_landscape_order(uuid,uuid,boolean) from public,anon,authenticated;

create or replace function public.ywi_rpc_record_landscape_field_evidence_424(
 p_company_id uuid,p_work_order_id uuid,p_quantity_id uuid,p_observation text,
 p_execution_proof_id uuid default null,p_qc_run_id uuid default null
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_source record; v_old public.ywi_landscape_field_receipts_424;
 v_hash text;v_id uuid;v_note text:=btrim(coalesce(p_observation,''));
begin
 perform public.ywi_424_assert_landscape_order(p_company_id,p_work_order_id,true);
 if length(v_note) not between 20 and 1000 then raise exception '424 field observation must be 20–1000 characters'; end if;
 select q.id,q.job_session_id,q.work_order_id,q.client_site_zone_id,q.record_type,
  q.activity_type,q.actual_quantity,q.metric_label,q.unit_label,q.created_by_profile_id,
  q.is_active,s.session_date,s.session_status,z.client_site_id,z.is_active as zone_active,
  wo.client_site_id as order_site
 into v_source from public.job_session_production_quantities q
 join public.job_sessions s on s.id=q.job_session_id
 join public.work_orders wo on wo.id=s.work_order_id
 left join public.client_site_zones z on z.id=q.client_site_zone_id
 where q.id=p_quantity_id for share of q,s,wo;
 if not found or v_source.work_order_id is distinct from p_work_order_id or
  v_source.record_type<>'production' or v_source.activity_type not in
  ('mowing','edging','trimming','garden_bed','hedge_shrub','tree_brush','cleanup',
   'aeration','fertilizing','seeding','sod','planting','mulch','soil','gravel_stone') or
  v_source.actual_quantity<=0 or not v_source.is_active or
  nullif(btrim(coalesce(v_source.metric_label,'')),'') is null or
  nullif(btrim(coalesce(v_source.unit_label,'')),'') is null or
  v_source.client_site_zone_id is null or v_source.client_site_id is distinct from v_source.order_site or
  v_source.zone_active is distinct from true or v_source.created_by_profile_id is null or
  v_source.session_date>current_date or v_source.session_status='cancelled' then
  raise exception '424 original session, operator, zone or measured landscaping quantity unverified';
 end if;
 if p_execution_proof_id is not null and not exists(
  select 1 from public.work_order_execution_proofs e where e.id=p_execution_proof_id
   and e.work_order_id=p_work_order_id and e.job_session_id=v_source.job_session_id
   and e.proof_status<>'retracted') then
  raise exception '424 execution evidence is foreign, retracted or belongs to another session';
 end if;
 if p_qc_run_id is not null and not exists(
  select 1 from public.work_order_quality_control_runs qc where qc.id=p_qc_run_id
   and qc.work_order_id=p_work_order_id and qc.job_session_id=v_source.job_session_id) then
  raise exception '424 QC run is foreign or belongs to another session';
 end if;
 v_hash:=public.ywi_424_fingerprint(p_quantity_id);
 select * into v_old from public.ywi_landscape_field_receipts_424
  where production_quantity_id=p_quantity_id;
 if found then
  if v_old.company_id=p_company_id and v_old.work_order_id=p_work_order_id and
   v_old.source_fingerprint=v_hash and v_old.field_observation=v_note and
   v_old.execution_proof_id is not distinct from p_execution_proof_id and
   v_old.qc_run_id is not distinct from p_qc_run_id then return v_old.id; end if;
  raise exception '424 quantity already attested, changed or reattributed; manual review required';
 end if;
 insert into public.ywi_landscape_field_receipts_424(
  company_id,work_order_id,job_session_id,production_quantity_id,site_zone_id,
  execution_proof_id,qc_run_id,source_fingerprint,field_observation,
  source_session_date,source_operator_profile_id,attested_by)
 values(p_company_id,p_work_order_id,v_source.job_session_id,p_quantity_id,
  v_source.client_site_zone_id,p_execution_proof_id,p_qc_run_id,v_hash,v_note,
  v_source.session_date,v_source.created_by_profile_id,auth.uid()) returning id into v_id;
 return v_id;
end $$;
revoke all on function public.ywi_rpc_record_landscape_field_evidence_424(uuid,uuid,uuid,text,uuid,uuid) from public,anon,authenticated;
grant execute on function public.ywi_rpc_record_landscape_field_evidence_424(uuid,uuid,uuid,text,uuid,uuid) to authenticated;

create or replace function public.ywi_rpc_landscape_field_dashboard_424(
 p_company_id uuid,p_work_order_id uuid default null
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_orders jsonb;v_sources jsonb:='[]'::jsonb;v_receipts jsonb:='[]'::jsonb;v_count integer;
begin
 perform public.ywi_422_assert_owner(p_company_id);
 select count(*) into v_count from public.work_orders
 where company_id=p_company_id and service_module_key='landscape';
 if v_count>60 then raise exception '424 landscaping work-order list exceeds safe limit'; end if;
 select coalesce(jsonb_agg(x),'[]'::jsonb) into v_orders from (
  select id,work_order_number as number,status from public.work_orders
  where company_id=p_company_id and service_module_key='landscape'
  order by created_at desc,id limit 60) x;
 if p_work_order_id is null then return jsonb_build_object('company_id',p_company_id,
  'work_order_id',null,'orders',v_orders,'sources',v_sources,'receipts',v_receipts,
  'complete',true,'source_limit',80,'review_only',true,'state','choose_order'); end if;
 perform public.ywi_424_assert_landscape_order(p_company_id,p_work_order_id,false);
 select count(*) into v_count from public.job_session_production_quantities
 where work_order_id=p_work_order_id;
 if v_count>80 then raise exception '424 measured production list exceeds safe limit'; end if;
 select coalesce(jsonb_agg(x order by x.session_date desc,x.id),'[]'::jsonb) into v_sources from (
  select q.id,q.activity_type,q.metric_label,q.actual_quantity,q.unit_label,
   s.session_date,z.zone_name,q.client_site_zone_id as zone_id,
   (q.record_type='production' and q.activity_type in
    ('mowing','edging','trimming','garden_bed','hedge_shrub','tree_brush','cleanup',
     'aeration','fertilizing','seeding','sod','planting','mulch','soil','gravel_stone')
    and q.actual_quantity>0 and q.is_active and q.created_by_profile_id is not null
    and nullif(btrim(coalesce(q.metric_label,'')),'') is not null
    and nullif(btrim(coalesce(q.unit_label,'')),'') is not null
    and z.client_site_id=wo.client_site_id and z.is_active
    and s.session_date<=current_date and s.session_status<>'cancelled') as eligible,
   (r.id is not null) as already_attested,
   coalesce((select jsonb_agg(e.id order by e.occurred_at desc,e.id) from
    (select id,occurred_at from public.work_order_execution_proofs e
     where e.work_order_id=p_work_order_id and e.job_session_id=q.job_session_id
     and e.proof_status<>'retracted' order by e.occurred_at desc,id limit 10) e),'[]'::jsonb) as execution_proof_ids,
   coalesce((select jsonb_agg(qc.id) from public.work_order_quality_control_runs qc
    where qc.work_order_id=p_work_order_id and qc.job_session_id=q.job_session_id),'[]'::jsonb) as qc_run_ids
  from public.job_session_production_quantities q
  join public.job_sessions s on s.id=q.job_session_id
  join public.work_orders wo on wo.id=s.work_order_id
  left join public.client_site_zones z on z.id=q.client_site_zone_id
  left join public.ywi_landscape_field_receipts_424 r on r.production_quantity_id=q.id
  where q.work_order_id=p_work_order_id and s.work_order_id=p_work_order_id
 ) x;
 select count(*) into v_count from public.ywi_landscape_field_receipts_424
 where company_id=p_company_id and work_order_id=p_work_order_id;
 if v_count>80 then raise exception '424 field evidence list exceeds safe limit'; end if;
 select coalesce(jsonb_agg(x order by x.attested_at,x.id),'[]'::jsonb) into v_receipts from (
  select r.id,r.production_quantity_id,r.source_session_date,r.attested_at,
   r.field_observation,r.source_operator_profile_id,r.execution_proof_id,r.qc_run_id,
   case when r.source_fingerprint=public.ywi_424_fingerprint(r.production_quantity_id)
    then 'recorded_unreviewed' else 'hold' end as state
  from public.ywi_landscape_field_receipts_424 r
  where r.company_id=p_company_id and r.work_order_id=p_work_order_id) x;
 return jsonb_build_object('company_id',p_company_id,'work_order_id',p_work_order_id,
  'orders',v_orders,'sources',v_sources,'receipts',v_receipts,'complete',true,
  'source_limit',80,'review_only',true,'state',case when
   exists(select 1 from public.ywi_landscape_field_receipts_424 r
    where r.company_id=p_company_id and r.work_order_id=p_work_order_id and
    r.source_fingerprint<>public.ywi_424_fingerprint(r.production_quantity_id))
   then 'hold' else 'review_only' end);
end $$;
revoke all on function public.ywi_rpc_landscape_field_dashboard_424(uuid,uuid) from public,anon,authenticated;
grant execute on function public.ywi_rpc_landscape_field_dashboard_424(uuid,uuid) to authenticated;
