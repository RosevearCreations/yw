-- YW Build 450 · independent Snow Removal and Snow Plowing workspaces.
-- 420 company service entitlement / 421 Jobs create / 422 canonical property remain authoritative.
-- New records are source-labelled operator planning and field assertions only.
begin;

create table if not exists public.ywi_pms_winter_agreements_450 (
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null references public.ywi_companies(id) on delete restrict,
 client_id uuid not null,
 site_id uuid not null,
 request_id uuid not null,
 service_key text not null check(service_key in ('snow_removal','snow_plowing')),
 billing_mode text not null check(billing_mode in ('per_storm','seasonal_contract','per_visit')),
 starts_on date not null, ends_on date,
 trigger_cm numeric(5,1) not null check(trigger_cm between 0 and 250),
 trigger_kind text not null check(trigger_kind in ('accumulation','icing','manual_inspection')),
 deicing_policy text not null check(deicing_policy in ('none','optional','included')),
 estimated_charge_cents integer not null check(estimated_charge_cents between 0 and 100000000),
 route_reference text,
 site_restrictions text,
 source_reference text not null,
 created_by uuid not null references auth.users(id) on delete restrict,
 created_at timestamptz not null default now(),
 unique(company_id,id),unique(company_id,service_key,id),unique(company_id,request_id),
 foreign key(company_id,client_id,site_id) references
  public.ywi_company_site_links_422(company_id,client_id,client_site_id) on delete restrict,
 constraint ywi_450_agreement_date check(ends_on is null or ends_on>=starts_on),
 constraint ywi_450_agreement_text check(char_length(source_reference) between 3 and 160
  and char_length(coalesce(route_reference,''))<=100 and char_length(coalesce(site_restrictions,''))<=600)
);
create index if not exists ywi_450_agreement_company_site
 on public.ywi_pms_winter_agreements_450(company_id,service_key,site_id,created_at desc);

create table if not exists public.ywi_pms_winter_storm_reviews_450 (
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null,
 service_key text not null check(service_key in ('snow_removal','snow_plowing')),
 agreement_id uuid not null,
 request_id uuid not null,
 storm_reference text not null,
 observed_on date not null,
 reported_cm numeric(5,1) not null check(reported_cm between 0 and 250),
 hazard text not null check(hazard in ('snow','ice','freezing_rain','mixed','unknown')),
 route_review text not null check(route_review in ('watch','activation_requested','safety_hold')),
 weather_source text,
 safety_source text,
 fleet_source text,
 source_reference text not null,
 notes text,
 created_by uuid not null references auth.users(id) on delete restrict,
 created_at timestamptz not null default now(),
 unique(company_id,id),unique(company_id,service_key,agreement_id,id),unique(company_id,request_id),
 foreign key(company_id,service_key,agreement_id) references
  public.ywi_pms_winter_agreements_450(company_id,service_key,id) on delete restrict,
 constraint ywi_450_storm_text check(char_length(storm_reference) between 3 and 100
  and char_length(source_reference) between 3 and 160
  and char_length(coalesce(weather_source,''))<=160 and char_length(coalesce(safety_source,''))<=160
  and char_length(coalesce(fleet_source,''))<=160 and char_length(coalesce(notes,''))<=600),
 constraint ywi_450_activation_evidence check(route_review<>'activation_requested' or
  (char_length(coalesce(weather_source,''))>=3 and char_length(coalesce(safety_source,''))>=3
   and (service_key='snow_removal' or char_length(coalesce(fleet_source,''))>=3)))
);
create index if not exists ywi_450_storm_company
 on public.ywi_pms_winter_storm_reviews_450(company_id,service_key,agreement_id,observed_on desc);

create table if not exists public.ywi_pms_winter_passes_450 (
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null,
 service_key text not null check(service_key in ('snow_removal','snow_plowing')),
 agreement_id uuid not null,
 storm_review_id uuid not null,
 request_id uuid not null,
 reported_on date not null,
 surface text not null check(surface in ('walkway','steps','driveway','parking','road','mixed')),
 reported_passes integer not null check(reported_passes between 1 and 30),
 outcome text not null check(outcome in ('reported_complete','partial','weather_hold','skipped')),
 deicer_name text,
 deicer_quantity numeric(10,2),
 deicer_unit text check(deicer_unit in ('kg','bags','litres')),
 qc_status text not null check(qc_status in ('pending','operator_pass','followup_required')),
 qc_note text,
 source_reference text not null,
 private_photo_label text,
 field_notes text,
 recorded_by uuid not null references auth.users(id) on delete restrict,
 recorded_at timestamptz not null default now(),
 unique(company_id,request_id),
 foreign key(company_id,service_key,agreement_id,storm_review_id) references
  public.ywi_pms_winter_storm_reviews_450(company_id,service_key,agreement_id,id) on delete restrict,
 constraint ywi_450_pass_deicer check(
  (deicer_name is null and deicer_quantity is null and deicer_unit is null) or
  (char_length(coalesce(deicer_name,'')) between 2 and 100 and deicer_quantity between 0.01 and 100000
   and deicer_unit is not null)),
 constraint ywi_450_pass_qc check(qc_status<>'followup_required' or
  char_length(coalesce(qc_note,''))>=3),
 constraint ywi_450_pass_text check(char_length(source_reference) between 3 and 160
  and char_length(coalesce(qc_note,''))<=400 and char_length(coalesce(field_notes,''))<=600
  and char_length(coalesce(private_photo_label,''))<=160),
 constraint ywi_450_pass_photo check(private_photo_label is null or
  private_photo_label !~* '(^https?://|\.\.|[?&#])')
);
create index if not exists ywi_450_pass_storm
 on public.ywi_pms_winter_passes_450(company_id,service_key,storm_review_id,reported_on desc);

alter table public.ywi_pms_winter_agreements_450 enable row level security;
alter table public.ywi_pms_winter_storm_reviews_450 enable row level security;
alter table public.ywi_pms_winter_passes_450 enable row level security;
revoke all on public.ywi_pms_winter_agreements_450 from public,anon,authenticated;
revoke all on public.ywi_pms_winter_storm_reviews_450 from public,anon,authenticated;
revoke all on public.ywi_pms_winter_passes_450 from public,anon,authenticated;
-- No browser RLS policies: access is exclusively via independently owner-checking RPCs.

create or replace function public.ywi_rpc_pms_winter_snapshot_450(p_company_id uuid)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_services jsonb;v_agreements jsonb;v_storms jsonb;v_passes jsonb;
 n_a integer;n_s integer;n_p integer;
begin
 perform public.ywi_422_assert_owner(p_company_id);
 select coalesce(jsonb_agg(jsonb_build_object('module_key',s.module_key,'enabled',s.enabled)
  order by s.module_key),'[]'::jsonb) into v_services
 from public.ywi_company_service_modules s where s.company_id=p_company_id
  and s.module_key in ('snow_removal','snow_plowing');
 if jsonb_array_length(v_services)<>2 then raise exception '450 original winter entitlement incomplete';end if;
 select count(*) into n_a from public.ywi_pms_winter_agreements_450 where company_id=p_company_id;
 select count(*) into n_s from public.ywi_pms_winter_storm_reviews_450 where company_id=p_company_id;
 select count(*) into n_p from public.ywi_pms_winter_passes_450 where company_id=p_company_id;
 if n_a>100 or n_s>200 or n_p>250 then raise exception '450 review cap exceeded; pagination needed';end if;
 select coalesce(jsonb_agg(to_jsonb(t) order by t.created_at desc,t.id desc),'[]'::jsonb) into v_agreements
 from (select a.id,a.company_id,a.client_id,a.site_id,a.service_key,a.billing_mode,
   c.legal_name as client_name,cs.site_name,a.starts_on,a.ends_on,a.trigger_cm,a.trigger_kind,
   a.deicing_policy,a.estimated_charge_cents,a.route_reference,a.site_restrictions,
   a.source_reference,a.created_at
  from public.ywi_pms_winter_agreements_450 a
  join public.ywi_company_site_links_422 l on l.company_id=a.company_id
   and l.client_id=a.client_id and l.client_site_id=a.site_id
  join public.clients c on c.id=l.client_id
  join public.client_sites cs on cs.id=l.client_site_id
  where a.company_id=p_company_id order by a.created_at desc,a.id desc limit 100) t;
 select coalesce(jsonb_agg(to_jsonb(t) order by t.created_at desc,t.id desc),'[]'::jsonb) into v_storms
 from (select id,company_id,service_key,agreement_id,storm_reference,observed_on,reported_cm,
  hazard,route_review,weather_source,safety_source,fleet_source,source_reference,notes,created_at
  from public.ywi_pms_winter_storm_reviews_450 where company_id=p_company_id
  order by created_at desc,id desc limit 200) t;
 select coalesce(jsonb_agg(to_jsonb(t) order by t.recorded_at desc,t.id desc),'[]'::jsonb) into v_passes
 from (select id,company_id,service_key,agreement_id,storm_review_id,reported_on,surface,
  reported_passes,outcome,deicer_name,deicer_quantity,deicer_unit,qc_status,qc_note,
  source_reference,private_photo_label,field_notes,recorded_at
  from public.ywi_pms_winter_passes_450 where company_id=p_company_id
  order by recorded_at desc,id desc limit 250) t;
 if jsonb_array_length(v_agreements)<>n_a or jsonb_array_length(v_storms)<>n_s
  or jsonb_array_length(v_passes)<>n_p then raise exception '450 concurrent snapshot changed';end if;
 return jsonb_build_object('company_id',p_company_id,'captured_at',statement_timestamp(),
  'owner_guard','ywi_422_assert_owner','new_work_guard','ywi_421_assert_company_new_work',
  'services',v_services,'agreements',v_agreements,'storms',v_storms,'passes',v_passes,
  'agreement_count',n_a,'storm_count',n_s,'pass_count',n_p,
  'historical_read_retained',true,'activation_authorized',false,
  'safety_verified',false,'fleet_verified',false,'weather_verified',false,
  'dispatch_authorized',false,'invoice_posted',false,'mutation_authorized',false);
end $$;

create or replace function public.ywi_rpc_pms_winter_agreement_450(
 p_company_id uuid,p_client_id uuid,p_site_id uuid,p_request_id uuid,p_service text,
 p_billing text,p_start date,p_end date,p_trigger numeric,p_trigger_kind text,
 p_deicing text,p_price_cents integer,p_route_ref text,p_restrictions text,p_source_ref text
) returns uuid language plpgsql volatile security definer set search_path='' as $$
declare v_id uuid;v_old record;
begin
 if p_service not in ('snow_removal','snow_plowing') then raise exception '450 unknown service';end if;
 perform public.ywi_421_assert_company_new_work(p_company_id,p_service,p_client_id,p_site_id);
 if p_request_id is null or p_start is null or char_length(coalesce(btrim(p_source_ref),''))<3 then
  raise exception '450 original-source winter plan required';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_company_id::text,450));
 if (select count(*) from public.ywi_pms_winter_agreements_450 where company_id=p_company_id)>=100
  and not exists(select 1 from public.ywi_pms_winter_agreements_450 where company_id=p_company_id and request_id=p_request_id)
 then raise exception '450 agreement cap reached';end if;
 insert into public.ywi_pms_winter_agreements_450(company_id,client_id,site_id,request_id,
  service_key,billing_mode,starts_on,ends_on,trigger_cm,trigger_kind,deicing_policy,
  estimated_charge_cents,route_reference,site_restrictions,source_reference,created_by)
 values(p_company_id,p_client_id,p_site_id,p_request_id,p_service,p_billing,p_start,p_end,p_trigger,
  p_trigger_kind,p_deicing,p_price_cents,nullif(btrim(p_route_ref),''),
  nullif(btrim(p_restrictions),''),btrim(p_source_ref),auth.uid())
 on conflict(company_id,request_id) do nothing returning id into v_id;
 if v_id is null then
  select * into v_old from public.ywi_pms_winter_agreements_450 where company_id=p_company_id and request_id=p_request_id;
  if not found or v_old.created_by is distinct from auth.uid() or
   v_old.client_id is distinct from p_client_id or v_old.site_id is distinct from p_site_id or
   v_old.service_key is distinct from p_service or v_old.billing_mode is distinct from p_billing or
   v_old.starts_on is distinct from p_start or v_old.ends_on is distinct from p_end or
   v_old.trigger_cm is distinct from p_trigger or v_old.trigger_kind is distinct from p_trigger_kind or
   v_old.deicing_policy is distinct from p_deicing or v_old.estimated_charge_cents is distinct from p_price_cents or
   v_old.route_reference is distinct from nullif(btrim(p_route_ref),'') or
   v_old.site_restrictions is distinct from nullif(btrim(p_restrictions),'') or
   v_old.source_reference is distinct from btrim(p_source_ref) then
    raise exception '450 agreement idempotency key changed';end if;
  v_id:=v_old.id;
 end if;
 return v_id;
end $$;

create or replace function public.ywi_rpc_pms_winter_storm_450(
 p_company_id uuid,p_agreement_id uuid,p_request_id uuid,p_storm_ref text,p_date date,
 p_reported_cm numeric,p_hazard text,p_route_review text,p_weather_ref text,
 p_safety_ref text,p_fleet_ref text,p_source_ref text,p_notes text
) returns uuid language plpgsql volatile security definer set search_path='' as $$
declare v_id uuid;v_old record;v_plan record;
begin
 select client_id,site_id,service_key,starts_on,ends_on into v_plan from public.ywi_pms_winter_agreements_450
 where company_id=p_company_id and id=p_agreement_id;
 if not found then raise exception '450 foreign winter agreement';end if;
 perform public.ywi_421_assert_company_new_work(p_company_id,v_plan.service_key,v_plan.client_id,v_plan.site_id);
 if p_request_id is null or p_date is null or p_date<v_plan.starts_on or
  (v_plan.ends_on is not null and p_date>v_plan.ends_on) or p_date>current_date+366 or
  char_length(coalesce(btrim(p_storm_ref),''))<3 or char_length(coalesce(btrim(p_source_ref),''))<3 then
  raise exception '450 bounded source-backed storm review required';end if;
 if p_route_review='activation_requested' and (char_length(coalesce(btrim(p_weather_ref),''))<3 or
  char_length(coalesce(btrim(p_safety_ref),''))<3 or
  (v_plan.service_key='snow_plowing' and char_length(coalesce(btrim(p_fleet_ref),''))<3)) then
  raise exception '450 weather Safety and plowing Fleet references required for route review';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_company_id::text,450));
 if (select count(*) from public.ywi_pms_winter_storm_reviews_450 where company_id=p_company_id)>=200
  and not exists(select 1 from public.ywi_pms_winter_storm_reviews_450 where company_id=p_company_id and request_id=p_request_id)
 then raise exception '450 storm review cap reached';end if;
 insert into public.ywi_pms_winter_storm_reviews_450(company_id,service_key,agreement_id,request_id,
  storm_reference,observed_on,reported_cm,hazard,route_review,weather_source,safety_source,
  fleet_source,source_reference,notes,created_by)
 values(p_company_id,v_plan.service_key,p_agreement_id,p_request_id,btrim(p_storm_ref),p_date,
  p_reported_cm,p_hazard,p_route_review,nullif(btrim(p_weather_ref),''),
  nullif(btrim(p_safety_ref),''),nullif(btrim(p_fleet_ref),''),btrim(p_source_ref),
  nullif(btrim(p_notes),''),auth.uid())
 on conflict(company_id,request_id) do nothing returning id into v_id;
 if v_id is null then
  select * into v_old from public.ywi_pms_winter_storm_reviews_450 where company_id=p_company_id and request_id=p_request_id;
  if not found or v_old.created_by is distinct from auth.uid() or v_old.service_key is distinct from v_plan.service_key or
   v_old.agreement_id is distinct from p_agreement_id or v_old.storm_reference is distinct from btrim(p_storm_ref) or
   v_old.observed_on is distinct from p_date or v_old.reported_cm is distinct from p_reported_cm or
   v_old.hazard is distinct from p_hazard or v_old.route_review is distinct from p_route_review or
   v_old.weather_source is distinct from nullif(btrim(p_weather_ref),'') or
   v_old.safety_source is distinct from nullif(btrim(p_safety_ref),'') or
   v_old.fleet_source is distinct from nullif(btrim(p_fleet_ref),'') or
   v_old.source_reference is distinct from btrim(p_source_ref) or
   v_old.notes is distinct from nullif(btrim(p_notes),'') then
   raise exception '450 storm idempotency key changed';end if;
  v_id:=v_old.id;
 end if;
 return v_id;
end $$;

create or replace function public.ywi_rpc_pms_winter_pass_450(
 p_company_id uuid,p_storm_id uuid,p_request_id uuid,p_date date,p_surface text,
 p_passes integer,p_outcome text,p_deicer text,p_qty numeric,p_unit text,
 p_qc text,p_qc_note text,p_source_ref text,p_photo text,p_notes text
) returns uuid language plpgsql volatile security definer set search_path='' as $$
declare v_id uuid;v_old record;v_plan record;
begin
 select a.client_id,a.site_id,a.service_key,a.id as agreement_id,a.starts_on,a.ends_on
 into v_plan from public.ywi_pms_winter_storm_reviews_450 s
 join public.ywi_pms_winter_agreements_450 a on a.company_id=s.company_id and a.id=s.agreement_id
  and a.service_key=s.service_key where s.company_id=p_company_id and s.id=p_storm_id;
 if not found then raise exception '450 foreign or mismatched storm review';end if;
 perform public.ywi_421_assert_company_new_work(p_company_id,v_plan.service_key,v_plan.client_id,v_plan.site_id);
 if p_request_id is null or p_date is null or p_date<v_plan.starts_on or
  (v_plan.ends_on is not null and p_date>v_plan.ends_on) or p_date>current_date+366 or
  char_length(coalesce(btrim(p_source_ref),''))<3 then
  raise exception '450 bounded source-backed pass required';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_company_id::text,450));
 if (select count(*) from public.ywi_pms_winter_passes_450 where company_id=p_company_id)>=250
  and not exists(select 1 from public.ywi_pms_winter_passes_450 where company_id=p_company_id and request_id=p_request_id)
 then raise exception '450 pass cap reached';end if;
 insert into public.ywi_pms_winter_passes_450(company_id,service_key,agreement_id,storm_review_id,request_id,
  reported_on,surface,reported_passes,outcome,deicer_name,deicer_quantity,deicer_unit,qc_status,qc_note,
  source_reference,private_photo_label,field_notes,recorded_by)
 values(p_company_id,v_plan.service_key,v_plan.agreement_id,p_storm_id,p_request_id,p_date,p_surface,
  p_passes,p_outcome,nullif(btrim(p_deicer),''),p_qty,p_unit,p_qc,nullif(btrim(p_qc_note),''),
  btrim(p_source_ref),nullif(btrim(p_photo),''),nullif(btrim(p_notes),''),auth.uid())
 on conflict(company_id,request_id) do nothing returning id into v_id;
 if v_id is null then
  select * into v_old from public.ywi_pms_winter_passes_450 where company_id=p_company_id and request_id=p_request_id;
  if not found or v_old.recorded_by is distinct from auth.uid() or v_old.service_key is distinct from v_plan.service_key or
   v_old.agreement_id is distinct from v_plan.agreement_id or v_old.storm_review_id is distinct from p_storm_id or
   v_old.reported_on is distinct from p_date or v_old.surface is distinct from p_surface or
   v_old.reported_passes is distinct from p_passes or v_old.outcome is distinct from p_outcome or
   v_old.deicer_name is distinct from nullif(btrim(p_deicer),'') or
   v_old.deicer_quantity is distinct from p_qty or v_old.deicer_unit is distinct from p_unit or
   v_old.qc_status is distinct from p_qc or v_old.qc_note is distinct from nullif(btrim(p_qc_note),'') or
   v_old.source_reference is distinct from btrim(p_source_ref) or
   v_old.private_photo_label is distinct from nullif(btrim(p_photo),'') or
   v_old.field_notes is distinct from nullif(btrim(p_notes),'') then
    raise exception '450 pass idempotency key changed';end if;
  v_id:=v_old.id;
 end if;
 return v_id;
end $$;

revoke all on function public.ywi_rpc_pms_winter_snapshot_450(uuid) from public,anon,authenticated;
revoke all on function public.ywi_rpc_pms_winter_agreement_450(uuid,uuid,uuid,uuid,text,text,date,date,numeric,text,text,integer,text,text,text) from public,anon,authenticated;
revoke all on function public.ywi_rpc_pms_winter_storm_450(uuid,uuid,uuid,text,date,numeric,text,text,text,text,text,text,text) from public,anon,authenticated;
revoke all on function public.ywi_rpc_pms_winter_pass_450(uuid,uuid,uuid,date,text,integer,text,text,numeric,text,text,text,text,text,text) from public,anon,authenticated;
grant execute on function public.ywi_rpc_pms_winter_snapshot_450(uuid) to authenticated;
grant execute on function public.ywi_rpc_pms_winter_agreement_450(uuid,uuid,uuid,uuid,text,text,date,date,numeric,text,text,integer,text,text,text) to authenticated;
grant execute on function public.ywi_rpc_pms_winter_storm_450(uuid,uuid,uuid,text,date,numeric,text,text,text,text,text,text,text) to authenticated;
grant execute on function public.ywi_rpc_pms_winter_pass_450(uuid,uuid,uuid,date,text,integer,text,text,numeric,text,text,text,text,text,text) to authenticated;
comment on table public.ywi_pms_winter_storm_reviews_450 is 'Winter route activation review request only: never dispatch or verified weather/Safety/Fleet clearance.';
comment on table public.ywi_pms_winter_passes_450 is 'Immutable operator-reported snow passes/de-icing; actual Jobs, dispatch, verified QC and invoices remain separate.';
commit;
