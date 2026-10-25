-- YW 449 — dedicated Lawn & Grounds planning and manual field evidence.
-- Original 420/421 company service entitlement and 422 canonical customer/site
-- remain the only authority for NEW work. Historical records survive service OFF.
-- Nothing here dispatches a crew, bills a client or posts to accounting.
begin;

create table if not exists public.ywi_pms_lawn_plans_449 (
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null references public.ywi_companies(id) on delete restrict,
 client_id uuid not null,
 site_id uuid not null,
 request_id uuid not null,
 service_kind text not null check(service_kind in
  ('mowing','edging','garden_care','leaf_cleanup','aeration','fertilizing','mixed_grounds')),
 recurrence text not null check(recurrence in ('weekly','biweekly','every_n_days','one_time')),
 interval_days integer check(interval_days between 1 and 60),
 anchor_date date not null,
 season_end_date date,
 estimated_minutes integer not null check(estimated_minutes between 15 and 1440),
 quoted_cents integer not null check(quoted_cents between 0 and 100000000),
 route_reference text,
 source_reference text not null,
 notes text,
 created_by uuid not null references auth.users(id) on delete restrict,
 created_at timestamptz not null default now(),
 unique(company_id,id),unique(company_id,request_id),
 foreign key(company_id,client_id,site_id) references
   public.ywi_company_site_links_422(company_id,client_id,client_site_id) on delete restrict,
 constraint ywi_449_plan_dates check(season_end_date is null or season_end_date>=anchor_date),
 constraint ywi_449_plan_interval check(
   (recurrence='every_n_days' and interval_days is not null) or
   (recurrence<>'every_n_days' and interval_days is null)),
 constraint ywi_449_plan_text check(char_length(source_reference) between 3 and 160 and
   char_length(coalesce(route_reference,''))<=100 and char_length(coalesce(notes,''))<=600)
);
create index if not exists ywi_449_plan_company_site
 on public.ywi_pms_lawn_plans_449(company_id,site_id,created_at desc);

create table if not exists public.ywi_pms_lawn_zones_449 (
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null,
 plan_id uuid not null,
 request_id uuid not null,
 zone_name text not null,
 area numeric(12,2) not null check(area between 0.01 and 1000000),
 area_unit text not null check(area_unit in ('sq_ft','sq_m')),
 surface text not null check(surface in ('turf','garden_bed','hardscape','mixed')),
 task_note text,
 source_reference text not null,
 created_by uuid not null references auth.users(id) on delete restrict,
 created_at timestamptz not null default now(),
 unique(company_id,id),unique(company_id,plan_id,id),unique(company_id,request_id),
 foreign key(company_id,plan_id) references public.ywi_pms_lawn_plans_449(company_id,id) on delete restrict,
 constraint ywi_449_zone_text check(char_length(zone_name) between 2 and 100 and
   char_length(source_reference) between 3 and 160 and char_length(coalesce(task_note,''))<=400)
);
create index if not exists ywi_449_zone_plan
 on public.ywi_pms_lawn_zones_449(company_id,plan_id,created_at desc);

create table if not exists public.ywi_pms_lawn_visits_449 (
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null,
 plan_id uuid not null,
 zone_id uuid,
 request_id uuid not null,
 service_date date not null,
 reported_status text not null check(reported_status in ('planned','completed','weather_hold','skipped','qc_followup')),
 route_reference text,
 crew_minutes integer not null check(crew_minutes between 0 and 1440),
 travel_minutes integer not null check(travel_minutes between 0 and 720),
 material_name text,
 material_quantity numeric(12,2),
 material_unit text check(material_unit in ('kg','litres','bags','units','cubic_m')),
 estimated_visit_cents integer not null check(estimated_visit_cents between 0 and 100000000),
 qc_status text not null check(qc_status in ('pending','pass_reported','followup_required')),
 qc_note text,
 photo_reference text,
 source_reference text not null,
 field_note text,
 recorded_by uuid not null references auth.users(id) on delete restrict,
 recorded_at timestamptz not null default now(),
 unique(company_id,request_id),
 foreign key(company_id,plan_id) references public.ywi_pms_lawn_plans_449(company_id,id) on delete restrict,
 foreign key(company_id,plan_id,zone_id) references public.ywi_pms_lawn_zones_449(company_id,plan_id,id) on delete restrict,
 constraint ywi_449_visit_material check(
   (material_name is null and material_quantity is null and material_unit is null) or
   (material_name is not null and char_length(material_name) between 2 and 100
    and material_quantity between 0.01 and 1000000 and material_unit is not null)),
 constraint ywi_449_visit_qc check(qc_status<>'followup_required' or nullif(btrim(coalesce(qc_note,'')),'') is not null),
 constraint ywi_449_visit_text check(char_length(source_reference) between 3 and 160 and
   char_length(coalesce(route_reference,''))<=100 and
   char_length(coalesce(field_note,''))<=600 and char_length(coalesce(qc_note,''))<=400 and
   char_length(coalesce(photo_reference,''))<=180),
 constraint ywi_449_visit_photo_ref check(photo_reference is null or
   photo_reference !~* '(^https?://|\.\.|[?&#])')
);
create index if not exists ywi_449_visit_plan_date
 on public.ywi_pms_lawn_visits_449(company_id,plan_id,service_date desc,recorded_at desc);

alter table public.ywi_pms_lawn_plans_449 enable row level security;
alter table public.ywi_pms_lawn_zones_449 enable row level security;
alter table public.ywi_pms_lawn_visits_449 enable row level security;
revoke all on public.ywi_pms_lawn_plans_449 from public,anon,authenticated;
revoke all on public.ywi_pms_lawn_zones_449 from public,anon,authenticated;
revoke all on public.ywi_pms_lawn_visits_449 from public,anon,authenticated;
-- Deliberately NO browser RLS policies or direct table access. Audited RPC only.

create or replace function public.ywi_rpc_pms_lawn_snapshot_449(p_company_id uuid)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_enabled boolean;v_plans jsonb;v_zones jsonb;v_visits jsonb;
        n_plans integer;n_zones integer;n_visits integer;
begin
 perform public.ywi_422_assert_owner(p_company_id);
 select enabled into v_enabled from public.ywi_company_service_modules
 where company_id=p_company_id and module_key='landscape';
 if v_enabled is null then raise exception '449 original Lawn entitlement unavailable';end if;
 select count(*) into n_plans from public.ywi_pms_lawn_plans_449 where company_id=p_company_id;
 select count(*) into n_zones from public.ywi_pms_lawn_zones_449 where company_id=p_company_id;
 select count(*) into n_visits from public.ywi_pms_lawn_visits_449 where company_id=p_company_id;
 if n_plans>100 or n_zones>200 or n_visits>250 then
   raise exception '449 history review cap exceeded; pagination required';end if;
 select coalesce(jsonb_agg(to_jsonb(t) order by t.created_at desc,t.id desc),'[]'::jsonb) into v_plans
 from (select p.id,p.company_id,p.client_id,p.site_id,c.legal_name as client_name,
       cs.site_name,p.service_kind,p.recurrence,p.interval_days,p.anchor_date,
       p.season_end_date,p.estimated_minutes,p.quoted_cents,p.route_reference,
       p.source_reference,p.notes,p.created_at
       from public.ywi_pms_lawn_plans_449 p
       join public.ywi_company_site_links_422 l on
         l.company_id=p.company_id and l.client_id=p.client_id and l.client_site_id=p.site_id
       join public.clients c on c.id=l.client_id
       join public.client_sites cs on cs.id=l.client_site_id
       where p.company_id=p_company_id
       order by p.created_at desc,p.id desc limit 100) t;
 select coalesce(jsonb_agg(to_jsonb(t) order by t.created_at desc,t.id desc),'[]'::jsonb) into v_zones
 from (select id,company_id,plan_id,zone_name,area,area_unit,surface,task_note,
              source_reference,created_at
       from public.ywi_pms_lawn_zones_449 where company_id=p_company_id
       order by created_at desc,id desc limit 200) t;
 select coalesce(jsonb_agg(to_jsonb(t) order by t.recorded_at desc,t.id desc),'[]'::jsonb) into v_visits
 from (select id,company_id,plan_id,zone_id,service_date,reported_status,
         route_reference,crew_minutes,travel_minutes,material_name,material_quantity,
         material_unit,estimated_visit_cents,qc_status,qc_note,photo_reference,
         source_reference,field_note,recorded_at
       from public.ywi_pms_lawn_visits_449 where company_id=p_company_id
       order by recorded_at desc,id desc limit 250) t;
 if jsonb_array_length(v_plans)<>n_plans or jsonb_array_length(v_zones)<>n_zones or
    jsonb_array_length(v_visits)<>n_visits then
   raise exception '449 site history changed during verified snapshot';end if;
 return jsonb_build_object('company_id',p_company_id,'captured_at',statement_timestamp(),
  'owner_guard','ywi_422_assert_owner','new_work_guard','ywi_421_assert_company_new_work',
  'module_key','landscape','enabled',v_enabled,'plans',v_plans,'zones',v_zones,'visits',v_visits,
  'plan_count',n_plans,'zone_count',n_zones,'visit_count',n_visits,
  'historical_read_retained',true,'dispatch_authorized',false,'invoice_posted',false,
  'qc_verified_independently',false,'mutation_authorized',false);
end $$;

create or replace function public.ywi_rpc_pms_lawn_plan_449(
 p_company_id uuid,p_client_id uuid,p_site_id uuid,p_request_id uuid,
 p_kind text,p_recurrence text,p_interval integer,p_anchor date,p_end date,
 p_minutes integer,p_price_cents integer,p_route_ref text,p_source_ref text,p_notes text
) returns uuid language plpgsql volatile security definer set search_path='' as $$
declare v_id uuid;v_old record;
begin
 perform public.ywi_421_assert_company_new_work(p_company_id,'landscape',p_client_id,p_site_id);
 if p_request_id is null or p_anchor is null or
    coalesce(char_length(btrim(p_source_ref)),0)<3 then raise exception '449 source-backed plan required';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_company_id::text,449));
 if (select count(*) from public.ywi_pms_lawn_plans_449 where company_id=p_company_id)>=100 and
   not exists(select 1 from public.ywi_pms_lawn_plans_449 where company_id=p_company_id and request_id=p_request_id) then
   raise exception '449 plan limit reached; review before more entries';end if;
 insert into public.ywi_pms_lawn_plans_449(company_id,client_id,site_id,request_id,
  service_kind,recurrence,interval_days,anchor_date,season_end_date,estimated_minutes,
  quoted_cents,route_reference,source_reference,notes,created_by)
 values(p_company_id,p_client_id,p_site_id,p_request_id,p_kind,p_recurrence,p_interval,
  p_anchor,p_end,p_minutes,p_price_cents,nullif(btrim(p_route_ref),''),btrim(p_source_ref),
  nullif(btrim(p_notes),''),auth.uid())
 on conflict(company_id,request_id) do nothing returning id into v_id;
 if v_id is null then
  select * into v_old from public.ywi_pms_lawn_plans_449 where company_id=p_company_id and request_id=p_request_id;
  if not found or v_old.client_id is distinct from p_client_id or v_old.site_id is distinct from p_site_id or
   v_old.service_kind is distinct from p_kind or v_old.recurrence is distinct from p_recurrence or
   v_old.interval_days is distinct from p_interval or v_old.anchor_date is distinct from p_anchor or
   v_old.season_end_date is distinct from p_end or v_old.estimated_minutes is distinct from p_minutes or
   v_old.quoted_cents is distinct from p_price_cents or
   v_old.route_reference is distinct from nullif(btrim(p_route_ref),'') or
   v_old.source_reference is distinct from btrim(p_source_ref) or
   v_old.notes is distinct from nullif(btrim(p_notes),'') or v_old.created_by is distinct from auth.uid() then
   raise exception '449 plan idempotency key reused with different content';end if;
  v_id:=v_old.id;
 end if;
 return v_id;
end $$;

create or replace function public.ywi_rpc_pms_lawn_zone_449(
 p_company_id uuid,p_plan_id uuid,p_request_id uuid,p_name text,p_area numeric,
 p_unit text,p_surface text,p_note text,p_source_ref text
) returns uuid language plpgsql volatile security definer set search_path='' as $$
declare v_id uuid;v_old record;v_client uuid;v_site uuid;
begin
 select client_id,site_id into v_client,v_site from public.ywi_pms_lawn_plans_449
 where company_id=p_company_id and id=p_plan_id;
 if v_client is null then raise exception '449 linked plan unavailable';end if;
 perform public.ywi_421_assert_company_new_work(p_company_id,'landscape',v_client,v_site);
 if p_request_id is null or coalesce(char_length(btrim(p_source_ref)),0)<3 then
  raise exception '449 measured zone source required';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_company_id::text,449));
 if (select count(*) from public.ywi_pms_lawn_zones_449 where company_id=p_company_id)>=200 and
    not exists(select 1 from public.ywi_pms_lawn_zones_449 where company_id=p_company_id and request_id=p_request_id) then
  raise exception '449 zone limit reached';end if;
 insert into public.ywi_pms_lawn_zones_449(company_id,plan_id,request_id,zone_name,
  area,area_unit,surface,task_note,source_reference,created_by)
 values(p_company_id,p_plan_id,p_request_id,btrim(p_name),p_area,p_unit,p_surface,
  nullif(btrim(p_note),''),btrim(p_source_ref),auth.uid())
 on conflict(company_id,request_id) do nothing returning id into v_id;
 if v_id is null then
  select * into v_old from public.ywi_pms_lawn_zones_449 where company_id=p_company_id and request_id=p_request_id;
  if not found or v_old.plan_id is distinct from p_plan_id or v_old.zone_name is distinct from btrim(p_name) or
   v_old.area is distinct from p_area or v_old.area_unit is distinct from p_unit or
   v_old.surface is distinct from p_surface or v_old.task_note is distinct from nullif(btrim(p_note),'') or
   v_old.source_reference is distinct from btrim(p_source_ref) or v_old.created_by is distinct from auth.uid() then
   raise exception '449 zone idempotency key reused with different content';end if;
  v_id:=v_old.id;
 end if;
 return v_id;
end $$;

create or replace function public.ywi_rpc_pms_lawn_visit_449(
 p_company_id uuid,p_plan_id uuid,p_zone_id uuid,p_request_id uuid,p_date date,
 p_status text,p_route_ref text,p_crew_minutes integer,p_travel_minutes integer,
 p_material text,p_qty numeric,p_unit text,p_estimate_cents integer,p_qc text,
 p_qc_note text,p_photo_ref text,p_source_ref text,p_note text
) returns uuid language plpgsql volatile security definer set search_path='' as $$
declare v_id uuid;v_old record;v_client uuid;v_site uuid;
begin
 select client_id,site_id into v_client,v_site from public.ywi_pms_lawn_plans_449
 where company_id=p_company_id and id=p_plan_id;
 if v_client is null then raise exception '449 linked plan unavailable';end if;
 perform public.ywi_421_assert_company_new_work(p_company_id,'landscape',v_client,v_site);
 if p_zone_id is not null and not exists(select 1 from public.ywi_pms_lawn_zones_449
   where company_id=p_company_id and plan_id=p_plan_id and id=p_zone_id) then
  raise exception '449 field zone belongs to another plan';end if;
 if p_request_id is null or p_date is null or
    coalesce(char_length(btrim(p_source_ref)),0)<3 or p_date>current_date+366 then
  raise exception '449 sourced, bounded manual visit required';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_company_id::text,449));
 if (select count(*) from public.ywi_pms_lawn_visits_449 where company_id=p_company_id)>=250 and
    not exists(select 1 from public.ywi_pms_lawn_visits_449 where company_id=p_company_id and request_id=p_request_id) then
  raise exception '449 visit limit reached';end if;
 insert into public.ywi_pms_lawn_visits_449(company_id,plan_id,zone_id,request_id,service_date,
  reported_status,route_reference,crew_minutes,travel_minutes,material_name,material_quantity,
  material_unit,estimated_visit_cents,qc_status,qc_note,photo_reference,source_reference,
  field_note,recorded_by)
 values(p_company_id,p_plan_id,p_zone_id,p_request_id,p_date,p_status,
  nullif(btrim(p_route_ref),''),p_crew_minutes,p_travel_minutes,nullif(btrim(p_material),''),
  p_qty,p_unit,p_estimate_cents,p_qc,nullif(btrim(p_qc_note),''),
  nullif(btrim(p_photo_ref),''),btrim(p_source_ref),nullif(btrim(p_note),''),auth.uid())
 on conflict(company_id,request_id) do nothing returning id into v_id;
 if v_id is null then
  select * into v_old from public.ywi_pms_lawn_visits_449 where company_id=p_company_id and request_id=p_request_id;
  if not found or v_old.plan_id is distinct from p_plan_id or v_old.zone_id is distinct from p_zone_id or
   v_old.service_date is distinct from p_date or v_old.reported_status is distinct from p_status or
   v_old.route_reference is distinct from nullif(btrim(p_route_ref),'') or
   v_old.crew_minutes is distinct from p_crew_minutes or v_old.travel_minutes is distinct from p_travel_minutes or
   v_old.material_name is distinct from nullif(btrim(p_material),'') or
   v_old.material_quantity is distinct from p_qty or v_old.material_unit is distinct from p_unit or
   v_old.estimated_visit_cents is distinct from p_estimate_cents or v_old.qc_status is distinct from p_qc or
   v_old.qc_note is distinct from nullif(btrim(p_qc_note),'') or
   v_old.photo_reference is distinct from nullif(btrim(p_photo_ref),'') or
   v_old.source_reference is distinct from btrim(p_source_ref) or
   v_old.field_note is distinct from nullif(btrim(p_note),'') or v_old.recorded_by is distinct from auth.uid() then
   raise exception '449 visit idempotency key reused with different content';end if;
  v_id:=v_old.id;
 end if;
 return v_id;
end $$;

revoke all on function public.ywi_rpc_pms_lawn_snapshot_449(uuid) from public,anon,authenticated;
revoke all on function public.ywi_rpc_pms_lawn_plan_449(uuid,uuid,uuid,uuid,text,text,integer,date,date,integer,integer,text,text,text) from public,anon,authenticated;
revoke all on function public.ywi_rpc_pms_lawn_zone_449(uuid,uuid,uuid,text,numeric,text,text,text,text) from public,anon,authenticated;
revoke all on function public.ywi_rpc_pms_lawn_visit_449(uuid,uuid,uuid,uuid,date,text,text,integer,integer,text,numeric,text,integer,text,text,text,text,text) from public,anon,authenticated;
grant execute on function public.ywi_rpc_pms_lawn_snapshot_449(uuid) to authenticated;
grant execute on function public.ywi_rpc_pms_lawn_plan_449(uuid,uuid,uuid,uuid,text,text,integer,date,date,integer,integer,text,text,text) to authenticated;
grant execute on function public.ywi_rpc_pms_lawn_zone_449(uuid,uuid,uuid,text,numeric,text,text,text,text) to authenticated;
grant execute on function public.ywi_rpc_pms_lawn_visit_449(uuid,uuid,uuid,uuid,date,text,text,integer,integer,text,numeric,text,integer,text,text,text,text,text) to authenticated;
comment on table public.ywi_pms_lawn_plans_449 is 'Source-backed, company-site-linked Lawn plans; recurrence forecast, not executed contract or dispatch.';
comment on table public.ywi_pms_lawn_visits_449 is 'Append-only manual field report and QC claim; no invoice or independently verified completion.';
commit;
