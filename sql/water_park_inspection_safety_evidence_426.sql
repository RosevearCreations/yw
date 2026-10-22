-- Build 426: dated aquatic observations linked to original Jobs/Safety authority.
-- An operator report is NOT a licensed aquatic inspection, chemical dosing instruction,
-- facility closure command, reopening approval, or customer/invoice mutation.

create table if not exists public.ywi_aquatic_inspections_426 (
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null references public.ywi_companies(id) on delete restrict,
 work_order_id uuid not null references public.work_orders(id) on delete restrict,
 inspection_key text not null check (inspection_key ~ '^[a-z0-9_]{3,50}$'),
 area_label text not null check (length(btrim(area_label)) between 3 and 120),
 inspection_kind text not null check (inspection_kind in ('routine','post_incident','recheck')),
 inspected_on date not null,
 observed_issue text not null check (observed_issue in ('none_reported','concern_reported','closure_reported')),
 source_reference text not null check (length(btrim(source_reference)) between 8 and 400),
 observation_notes text not null check (length(btrim(observation_notes)) between 20 and 1000),
 observed_ph numeric(4,2) check (observed_ph between 0 and 14),
 observed_sanitizer_mg_l numeric(7,2) check (observed_sanitizer_mg_l between 0 and 100),
 observed_water_c numeric(5,2) check (observed_water_c between -5 and 60),
 original_safety_plan_id uuid references public.job_hazard_site_safety_plans(id) on delete restrict,
 original_source_fingerprint text not null check (length(original_source_fingerprint)=64),
 recorded_by uuid not null references auth.users(id) on delete restrict,
 recorded_at timestamptz not null default now(),
 unique(work_order_id,inspection_key)
);

create table if not exists public.ywi_aquatic_followups_426 (
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null references public.ywi_companies(id) on delete restrict,
 work_order_id uuid not null references public.work_orders(id) on delete restrict,
 inspection_id uuid not null references public.ywi_aquatic_inspections_426(id) on delete restrict,
 receipt_key text not null check (receipt_key ~ '^[a-z0-9_]{3,50}$'),
 observed_on date not null,
 action_reference text not null check (length(btrim(action_reference)) between 8 and 400),
 factual_notes text not null check (length(btrim(factual_notes)) between 20 and 1000),
 reported_state text not null check (reported_state in ('pending','operator_reports_addressed')),
 original_source_fingerprint text not null check (length(original_source_fingerprint)=64),
 recorded_by uuid not null references auth.users(id) on delete restrict,
 recorded_at timestamptz not null default now(),
 unique(inspection_id,receipt_key)
);

create index if not exists ywi_426_inspections_by_order
 on public.ywi_aquatic_inspections_426(company_id,work_order_id,inspected_on desc);
create index if not exists ywi_426_followups_by_inspection
 on public.ywi_aquatic_followups_426(company_id,inspection_id,observed_on desc);
alter table public.ywi_aquatic_inspections_426 enable row level security;
alter table public.ywi_aquatic_followups_426 enable row level security;
revoke all on public.ywi_aquatic_inspections_426 from public,anon,authenticated;
revoke all on public.ywi_aquatic_followups_426 from public,anon,authenticated;
grant select on public.ywi_aquatic_inspections_426 to authenticated;
grant select on public.ywi_aquatic_followups_426 to authenticated;
drop policy if exists ywi_426_owner_inspection_read on public.ywi_aquatic_inspections_426;
create policy ywi_426_owner_inspection_read on public.ywi_aquatic_inspections_426
 for select to authenticated using (exists (
  select 1 from public.ywi_companies c where c.id=company_id
   and c.owner_user_id=(select auth.uid())));
drop policy if exists ywi_426_owner_followup_read on public.ywi_aquatic_followups_426;
create policy ywi_426_owner_followup_read on public.ywi_aquatic_followups_426
 for select to authenticated using (exists (
  select 1 from public.ywi_companies c where c.id=company_id
   and c.owner_user_id=(select auth.uid())));

create or replace function public.ywi_426_reject_evidence_rewrite()
returns trigger language plpgsql security definer set search_path='' as $$
begin raise exception '426 aquatic evidence is append-only: use original Safety review for holds'; end $$;
revoke all on function public.ywi_426_reject_evidence_rewrite() from public,anon,authenticated;
drop trigger if exists ywi_426_inspections_immutable on public.ywi_aquatic_inspections_426;
create trigger ywi_426_inspections_immutable before update or delete on public.ywi_aquatic_inspections_426
 for each row execute function public.ywi_426_reject_evidence_rewrite();
drop trigger if exists ywi_426_followups_immutable on public.ywi_aquatic_followups_426;
create trigger ywi_426_followups_immutable before update or delete on public.ywi_aquatic_followups_426
 for each row execute function public.ywi_426_reject_evidence_rewrite();

create or replace function public.ywi_426_assert_water_park_order(
 p_company_id uuid,p_work_order_id uuid,p_write boolean default false
) returns void language plpgsql security definer set search_path='' as $$
begin
 perform public.ywi_423_assert_order(p_company_id,p_work_order_id,p_write);
 if not exists(select 1 from public.work_orders wo where wo.id=p_work_order_id
   and wo.company_id=p_company_id and wo.service_module_key='water_parks') then
  raise exception '426 original company aquatic work order required';
 end if;
end $$;
revoke all on function public.ywi_426_assert_water_park_order(uuid,uuid,boolean) from public,anon,authenticated;

create or replace function public.ywi_426_original_fingerprint(
 p_work_order_id uuid,p_safety_plan_id uuid
) returns text language plpgsql stable security definer set search_path='' as $$
declare v_payload jsonb;
begin
 select jsonb_build_object('work_order',jsonb_build_object(
  'id',wo.id,'company_id',wo.company_id,'service',wo.service_module_key,
  'client',wo.client_id,'site',wo.client_site_id,'status',wo.status,
  'approval_status',wo.approval_status,'approval_required',wo.approval_required),
  'safety',(select to_jsonb(sp) from public.job_hazard_site_safety_plans sp
   where sp.id=p_safety_plan_id))
 into v_payload from public.work_orders wo where wo.id=p_work_order_id;
 if v_payload is null then raise exception '426 original Jobs work order missing'; end if;
 return encode(extensions.digest(convert_to(v_payload::text,'UTF8'),'sha256'),'hex');
end $$;
revoke all on function public.ywi_426_original_fingerprint(uuid,uuid) from public,anon,authenticated;

create or replace function public.ywi_rpc_record_aquatic_inspection_426(
 p_company_id uuid,p_work_order_id uuid,p_key text,p_area text,p_kind text,
 p_inspected_on date,p_issue text,p_source_reference text,p_notes text,
 p_ph numeric default null,p_sanitizer_mg_l numeric default null,
 p_water_c numeric default null,p_safety_plan_id uuid default null
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_old public.ywi_aquatic_inspections_426;v_id uuid;v_hash text;
 v_key text:=lower(btrim(coalesce(p_key,'')));
 v_area text:=btrim(coalesce(p_area,''));v_source text:=btrim(coalesce(p_source_reference,''));
 v_notes text:=btrim(coalesce(p_notes,''));
begin
 perform public.ywi_426_assert_water_park_order(p_company_id,p_work_order_id,true);
 if v_key !~ '^[a-z0-9_]{3,50}$' or length(v_area) not between 3 and 120 or
  p_kind not in ('routine','post_incident','recheck') or
  p_issue not in ('none_reported','concern_reported','closure_reported') or
  p_inspected_on is null or p_inspected_on<date '2000-01-01' or p_inspected_on>current_date or
  length(v_source) not between 8 and 400 or length(v_notes) not between 20 and 1000 or
  (p_ph is not null and p_ph not between 0 and 14) or
  (p_sanitizer_mg_l is not null and p_sanitizer_mg_l not between 0 and 100) or
  (p_water_c is not null and p_water_c not between -5 and 60) then
  raise exception '426 date, site area, original reading source and factual observations required'; end if;
 if p_safety_plan_id is not null and not exists (
  select 1 from public.job_hazard_site_safety_plans sp
  join public.work_orders wo on wo.id=p_work_order_id
  where sp.id=p_safety_plan_id and sp.work_order_id=p_work_order_id
   and sp.client_site_id=wo.client_site_id) then
  raise exception '426 Safety plan must belong to the original work order and property'; end if;
 v_hash:=public.ywi_426_original_fingerprint(p_work_order_id,p_safety_plan_id);
 select * into v_old from public.ywi_aquatic_inspections_426
  where work_order_id=p_work_order_id and inspection_key=v_key;
 if found then
  if v_old.company_id=p_company_id and v_old.area_label=v_area and
   v_old.inspection_kind=p_kind and v_old.inspected_on=p_inspected_on and
   v_old.observed_issue=p_issue and v_old.source_reference=v_source and
   v_old.observation_notes=v_notes and v_old.observed_ph is not distinct from p_ph and
   v_old.observed_sanitizer_mg_l is not distinct from p_sanitizer_mg_l and
   v_old.observed_water_c is not distinct from p_water_c and
   v_old.original_safety_plan_id is not distinct from p_safety_plan_id and
   v_old.original_source_fingerprint=v_hash then return v_old.id; end if;
  raise exception '426 inspection key already exists or original source changed: manual Safety review';
 end if;
 insert into public.ywi_aquatic_inspections_426(company_id,work_order_id,
  inspection_key,area_label,inspection_kind,inspected_on,observed_issue,
  source_reference,observation_notes,observed_ph,observed_sanitizer_mg_l,
  observed_water_c,original_safety_plan_id,original_source_fingerprint,recorded_by)
 values(p_company_id,p_work_order_id,v_key,v_area,p_kind,p_inspected_on,p_issue,
  v_source,v_notes,p_ph,p_sanitizer_mg_l,p_water_c,p_safety_plan_id,v_hash,auth.uid())
 returning id into v_id;
 return v_id;
end $$;
revoke all on function public.ywi_rpc_record_aquatic_inspection_426(uuid,uuid,text,text,text,date,text,text,text,numeric,numeric,numeric,uuid) from public,anon,authenticated;
grant execute on function public.ywi_rpc_record_aquatic_inspection_426(uuid,uuid,text,text,text,date,text,text,text,numeric,numeric,numeric,uuid) to authenticated;

create or replace function public.ywi_rpc_append_aquatic_followup_426(
 p_company_id uuid,p_work_order_id uuid,p_inspection_id uuid,p_receipt_key text,
 p_observed_on date,p_action_reference text,p_notes text,p_reported_state text
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_original public.ywi_aquatic_inspections_426;
 v_old public.ywi_aquatic_followups_426;v_id uuid;v_hash text;
 v_key text:=lower(btrim(coalesce(p_receipt_key,'')));
 v_action text:=btrim(coalesce(p_action_reference,''));v_notes text:=btrim(coalesce(p_notes,''));
begin
 perform public.ywi_426_assert_water_park_order(p_company_id,p_work_order_id,true);
 select * into v_original from public.ywi_aquatic_inspections_426
  where id=p_inspection_id and company_id=p_company_id and work_order_id=p_work_order_id;
 if not found then raise exception '426 original aquatic inspection missing or foreign'; end if;
 if v_key !~ '^[a-z0-9_]{3,50}$' or
  p_observed_on is null or p_observed_on<v_original.inspected_on or p_observed_on>current_date or
  length(v_action) not between 8 and 400 or length(v_notes) not between 20 and 1000 or
  p_reported_state not in ('pending','operator_reports_addressed') then
  raise exception '426 dated follow-up and original action reference required'; end if;
 v_hash:=public.ywi_426_original_fingerprint(p_work_order_id,v_original.original_safety_plan_id);
 if v_hash<>v_original.original_source_fingerprint then
  raise exception '426 original Safety/Jobs source changed: inspection HOLD, manual review required'; end if;
 select * into v_old from public.ywi_aquatic_followups_426
  where inspection_id=p_inspection_id and receipt_key=v_key;
 if found then
  if v_old.company_id=p_company_id and v_old.work_order_id=p_work_order_id and
   v_old.observed_on=p_observed_on and v_old.action_reference=v_action and
   v_old.factual_notes=v_notes and v_old.reported_state=p_reported_state and
   v_old.original_source_fingerprint=v_hash then return v_old.id; end if;
  raise exception '426 follow-up key already exists with different evidence';
 end if;
 insert into public.ywi_aquatic_followups_426(company_id,work_order_id,inspection_id,
  receipt_key,observed_on,action_reference,factual_notes,reported_state,
  original_source_fingerprint,recorded_by)
 values(p_company_id,p_work_order_id,p_inspection_id,v_key,p_observed_on,v_action,
  v_notes,p_reported_state,v_hash,auth.uid()) returning id into v_id;
 return v_id;
end $$;
revoke all on function public.ywi_rpc_append_aquatic_followup_426(uuid,uuid,uuid,text,date,text,text,text) from public,anon,authenticated;
grant execute on function public.ywi_rpc_append_aquatic_followup_426(uuid,uuid,uuid,text,date,text,text,text) to authenticated;

create or replace function public.ywi_rpc_aquatic_dashboard_426(
 p_company_id uuid,p_work_order_id uuid default null
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_orders jsonb:='[]'::jsonb;v_safety jsonb:='[]'::jsonb;
 v_inspections jsonb:='[]'::jsonb;v_followups jsonb:='[]'::jsonb;v_count int;
begin
 perform public.ywi_422_assert_owner(p_company_id);
 select count(*) into v_count from public.work_orders
  where company_id=p_company_id and service_module_key='water_parks';
 if v_count>60 then raise exception '426 aquatic work order list exceeds audited limit'; end if;
 select coalesce(jsonb_agg(x),'[]'::jsonb) into v_orders from (
  select id,work_order_number as number,status from public.work_orders
  where company_id=p_company_id and service_module_key='water_parks'
  order by created_at desc,id limit 60) x;
 if p_work_order_id is null then return jsonb_build_object(
  'company_id',p_company_id,'work_order_id',null,'orders',v_orders,
  'safety',v_safety,'inspections',v_inspections,'followups',v_followups,
  'source_limit',80,'complete',true,'no_automatic_reopening',true,'state','choose_order'); end if;
 perform public.ywi_426_assert_water_park_order(p_company_id,p_work_order_id,false);
 select (select count(*) from public.ywi_aquatic_inspections_426 where work_order_id=p_work_order_id)
  +(select count(*) from public.ywi_aquatic_followups_426 where work_order_id=p_work_order_id)
  +(select count(*) from public.job_hazard_site_safety_plans where work_order_id=p_work_order_id)
 into v_count;
 if v_count>80 then raise exception '426 original source/evidence cap reached'; end if;
 select coalesce(jsonb_agg(x),'[]'::jsonb) into v_safety from (
  select sp.id,sp.plan_number,sp.field_date,sp.plan_status,sp.supervisor_review_status,
   sp.stop_work_required from public.job_hazard_site_safety_plans sp
  join public.work_orders wo on wo.id=sp.work_order_id
  where wo.id=p_work_order_id and sp.client_site_id=wo.client_site_id
  order by sp.field_date desc,sp.id) x;
 select coalesce(jsonb_agg(x),'[]'::jsonb) into v_inspections from (
  select i.id,i.inspection_key,i.area_label,i.inspection_kind,i.inspected_on,
   i.observed_issue,i.source_reference,i.observation_notes,i.observed_ph,
   i.observed_sanitizer_mg_l,i.observed_water_c,i.original_safety_plan_id,
   i.recorded_at,
   case when i.original_source_fingerprint is distinct from
    public.ywi_426_original_fingerprint(i.work_order_id,i.original_safety_plan_id)
    then 'source_changed_hold' else 'recorded_unverified' end as evidence_state,
   case when i.observed_issue<>'none_reported' or sp.id is null or
    sp.stop_work_required or sp.supervisor_review_status<>'approved' or
    sp.plan_status not in ('ready_for_signoff','closed') or
    i.original_source_fingerprint is distinct from
     public.ywi_426_original_fingerprint(i.work_order_id,i.original_safety_plan_id)
    then 'hold' else 'independent_safety_review_still_required' end as closure_gate
  from public.ywi_aquatic_inspections_426 i
  left join public.job_hazard_site_safety_plans sp on sp.id=i.original_safety_plan_id
  where i.company_id=p_company_id and i.work_order_id=p_work_order_id
  order by i.inspected_on desc,i.id) x;
 select coalesce(jsonb_agg(x),'[]'::jsonb) into v_followups from (
  select f.id,f.inspection_id,f.receipt_key,f.observed_on,f.action_reference,
   f.factual_notes,f.reported_state,f.recorded_at,
   case when f.original_source_fingerprint is distinct from
    public.ywi_426_original_fingerprint(f.work_order_id,i.original_safety_plan_id)
    then 'source_changed_hold' else 'recorded_unverified' end as evidence_state,
   'hold_until_independent_safety_authority'::text as reopening_gate
  from public.ywi_aquatic_followups_426 f
  join public.ywi_aquatic_inspections_426 i on i.id=f.inspection_id and
   i.company_id=f.company_id and i.work_order_id=f.work_order_id
  where f.company_id=p_company_id and f.work_order_id=p_work_order_id
  order by f.observed_on desc,f.id) x;
 return jsonb_build_object('company_id',p_company_id,'work_order_id',p_work_order_id,
  'orders',v_orders,'safety',v_safety,'inspections',v_inspections,'followups',v_followups,
  'source_limit',80,'complete',true,'no_automatic_reopening',true,'state','review_only');
end $$;
revoke all on function public.ywi_rpc_aquatic_dashboard_426(uuid,uuid) from public,anon,authenticated;
grant execute on function public.ywi_rpc_aquatic_dashboard_426(uuid,uuid) to authenticated;
