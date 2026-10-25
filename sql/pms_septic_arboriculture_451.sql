-- YW 451: separate source-backed septic and tree-care workspaces.
-- Existing 428 disposal receipts are the only original disposal chain authority.
-- Permit, Safety, credential and equipment references are unverified operator labels.
begin;

-- Add arboriculture as a seventh independently audited offering, initially OFF.
alter table public.ywi_company_service_modules drop constraint ywi_company_service_modules_module_key_check;
alter table public.ywi_company_service_modules add constraint ywi_company_service_modules_module_key_check
 check(module_key in ('landscape','construction','water_parks','snow_removal','snow_plowing','septic','arboriculture'));
alter table public.ywi_company_service_module_audit drop constraint ywi_company_service_module_audit_module_key_check;
alter table public.ywi_company_service_module_audit add constraint ywi_company_service_module_audit_module_key_check
 check(module_key in ('landscape','construction','water_parks','snow_removal','snow_plowing','septic','arboriculture'));

create or replace function public.ywi_company_service_seed_420()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.ywi_company_service_modules(company_id,module_key,enabled)
 select new.id,k,false from unnest(array['landscape','construction','water_parks',
  'snow_removal','snow_plowing','septic','arboriculture']::text[]) as k;
 return null;
end $$;
-- Existing tenants keep all original values, with arboriculture explicitly disabled.
insert into public.ywi_company_service_modules(company_id,module_key,enabled)
select c.id,'arboriculture',false from public.ywi_companies c
on conflict(company_id,module_key) do nothing;

-- Preserve 422's active Jobs-create, owner, original canonical client/site guard.
create or replace function public.ywi_421_assert_company_new_work(
 p_company_id uuid,p_module text,p_client uuid,p_site uuid
) returns void language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();v_role text;v_level text;
begin
 if v_actor is null or p_company_id is null or p_module is null or p_module not in
  ('landscape','construction','water_parks','snow_removal','snow_plowing','septic','arboriculture')
 then raise exception '421 authenticated company and specialist service required';end if;
 select lower(role) into v_role from public.profiles where id=v_actor and is_active is true;
 if v_role is null then raise exception '421 active employee identity required';end if;
 select coalesce(
  (select access_level from public.app_profile_module_permissions
   where profile_id=v_actor and module_key='jobs'),
  (select access_level from public.app_role_module_permissions
   where role=v_role and module_key='jobs')) into v_level;
 if v_level not in ('create','approve','manage') or v_level is null
 then raise exception '421 Jobs create permission denied';end if;
 if not exists(select 1 from public.ywi_companies c
  join public.ywi_company_service_modules s on s.company_id=c.id
  where c.id=p_company_id and c.owner_user_id=v_actor and s.module_key=p_module and s.enabled is true)
 then raise exception '421 company service disabled or owner mismatch';end if;
 if p_client is distinct from null or p_site is distinct from null then
  perform public.ywi_422_assert_link(p_company_id,p_client,p_site);
 end if;
end $$;

create or replace function public.ywi_rpc_pms_navigation_443(p_company_id uuid)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_services jsonb;v_count integer;
begin
 perform public.ywi_422_assert_owner(p_company_id);
 select count(*),coalesce(jsonb_agg(jsonb_build_object(
  'company_id',s.company_id,'module_key',s.module_key,'enabled',s.enabled)
  order by s.module_key),'[]'::jsonb) into v_count,v_services
 from public.ywi_company_service_modules s where s.company_id=p_company_id
 and s.module_key in ('landscape','construction','water_parks','snow_removal',
  'snow_plowing','septic','arboriculture');
 if v_count<>7 then raise exception '451 incomplete seven-service company registry';end if;
 return jsonb_build_object('company_id',p_company_id,'captured_at',statement_timestamp(),
  'owner_guard','ywi_422_assert_owner','services',v_services,
  'jobs_new_work_guard','ywi_421_assert_company_new_work',
  'historical_audit_retained',true,'privacy_minimized',true,
  'synthetic',false,'mutation_authorized',false);
end $$;

create table if not exists public.ywi_pms_septic_sites_451(
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null references public.ywi_companies(id) on delete restrict,
 client_id uuid not null,site_id uuid not null,request_id uuid not null,
 tank_kind text not null check(tank_kind in ('septic','holding','pump_chamber','unknown')),
 capacity_l numeric(12,2) check(capacity_l>0 and capacity_l<=1000000),
 access_hazard text not null check(char_length(access_hazard) between 3 and 600),
 permit_source text,site_safety_source text,source_reference text not null,
 recorded_by uuid not null references auth.users(id) on delete restrict,
 created_at timestamptz not null default now(),
 unique(company_id,id),unique(company_id,request_id),
 foreign key(company_id,client_id,site_id) references
  public.ywi_company_site_links_422(company_id,client_id,client_site_id) on delete restrict,
 check(char_length(source_reference) between 3 and 160 and
  char_length(coalesce(permit_source,''))<=160 and char_length(coalesce(site_safety_source,''))<=160)
);
create table if not exists public.ywi_pms_septic_manifests_451(
 id uuid primary key default gen_random_uuid(),company_id uuid not null,
 profile_id uuid not null,request_id uuid not null,service_on date not null,
 waste_stream text not null check(waste_stream in ('septic','holding_tank','vacuum_waste')),
 reported_volume_l numeric(12,2) not null check(reported_volume_l>0 and reported_volume_l<=100000),
 measurement_source text not null check(char_length(measurement_source) between 3 and 160),
 facility_label text not null check(char_length(facility_label) between 3 and 180),
 manifest_reference text not null check(char_length(manifest_reference) between 3 and 160),
 original_receipt_428 uuid unique references public.ywi_septic_disposal_receipts_428(id) on delete restrict,
 disposal_review text not null check(disposal_review in ('awaiting_original','operator_reference','source_linked')),
 source_reference text not null check(char_length(source_reference) between 3 and 160),
 notes text check(char_length(notes)<=600),recorded_by uuid not null references auth.users(id) on delete restrict,
 recorded_at timestamptz not null default now(),
 unique(company_id,request_id),
 foreign key(company_id,profile_id) references public.ywi_pms_septic_sites_451(company_id,id) on delete restrict,
 check((original_receipt_428 is null and disposal_review<>'source_linked') or
  (original_receipt_428 is not null and disposal_review='source_linked'))
);
create table if not exists public.ywi_pms_arbor_trees_451(
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null references public.ywi_companies(id) on delete restrict,
 client_id uuid not null,site_id uuid not null,request_id uuid not null,
 tree_label text not null check(char_length(tree_label) between 2 and 100),
 species_label text not null check(char_length(species_label) between 2 and 100),
 approximate_height_m numeric(6,1) check(approximate_height_m>0 and approximate_height_m<=150),
 risk_zone text not null check(risk_zone in ('open_ground','structure','roadway','utility','unknown')),
 risk_notes text not null check(char_length(risk_notes) between 3 and 600),
 permit_state text not null check(permit_state in ('unreviewed','not_required_claim','required_unverified','source_provided')),
 permit_source text,source_reference text not null check(char_length(source_reference) between 3 and 160),
 recorded_by uuid not null references auth.users(id) on delete restrict,
 created_at timestamptz not null default now(),unique(company_id,id),unique(company_id,request_id),
 foreign key(company_id,client_id,site_id) references
  public.ywi_company_site_links_422(company_id,client_id,client_site_id) on delete restrict,
 check(char_length(coalesce(permit_source,''))<=160),
 check(permit_state<>'source_provided' or char_length(coalesce(permit_source,''))>=3)
);
create table if not exists public.ywi_pms_arbor_reviews_451(
 id uuid primary key default gen_random_uuid(),company_id uuid not null,
 tree_id uuid not null,request_id uuid not null,reviewed_on date not null,
 risk_level text not null check(risk_level in ('low','moderate','high','stop_work')),
 planned_method text not null check(planned_method in ('inspection','pruning','removal','stump','cabling','other')),
 equipment_source text,crew_credential_source text,safety_source text,permit_source text,
 review_state text not null check(review_state in ('plan_only','field_reported','hold')),
 evidence_reference text not null check(char_length(evidence_reference) between 3 and 160),
 notes text check(char_length(notes)<=600),recorded_by uuid not null references auth.users(id) on delete restrict,
 recorded_at timestamptz not null default now(),unique(company_id,request_id),
 foreign key(company_id,tree_id) references public.ywi_pms_arbor_trees_451(company_id,id) on delete restrict,
 check(char_length(coalesce(equipment_source,''))<=160 and
  char_length(coalesce(crew_credential_source,''))<=160 and
  char_length(coalesce(safety_source,''))<=160 and char_length(coalesce(permit_source,''))<=160),
 check(risk_level not in ('high','stop_work') or
  (char_length(coalesce(safety_source,''))>=3 and char_length(coalesce(crew_credential_source,''))>=3))
);
create index if not exists ywi_451_septic_site on public.ywi_pms_septic_sites_451(company_id,site_id,created_at desc);
create index if not exists ywi_451_manifest_site on public.ywi_pms_septic_manifests_451(company_id,profile_id,recorded_at desc);
create index if not exists ywi_451_arbor_site on public.ywi_pms_arbor_trees_451(company_id,site_id,created_at desc);
create index if not exists ywi_451_arbor_review on public.ywi_pms_arbor_reviews_451(company_id,tree_id,recorded_at desc);
alter table public.ywi_pms_septic_sites_451 enable row level security;
alter table public.ywi_pms_septic_manifests_451 enable row level security;
alter table public.ywi_pms_arbor_trees_451 enable row level security;
alter table public.ywi_pms_arbor_reviews_451 enable row level security;
revoke all on public.ywi_pms_septic_sites_451 from public,anon,authenticated;
revoke all on public.ywi_pms_septic_manifests_451 from public,anon,authenticated;
revoke all on public.ywi_pms_arbor_trees_451 from public,anon,authenticated;
revoke all on public.ywi_pms_arbor_reviews_451 from public,anon,authenticated;
-- Zero table API permissions or RLS policies; owner-checked RPCs only.

create or replace function public.ywi_rpc_pms_specialist_snapshot_451(p_company_id uuid)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_a jsonb;v_b jsonb;v_c jsonb;v_d jsonb;v_services jsonb;
 n_a int;n_b int;n_c int;n_d int;
begin
 perform public.ywi_422_assert_owner(p_company_id);
 select coalesce(jsonb_agg(jsonb_build_object('module_key',module_key,'enabled',enabled)
  order by module_key),'[]'::jsonb) into v_services
 from public.ywi_company_service_modules where company_id=p_company_id
  and module_key in ('septic','arboriculture');
 if jsonb_array_length(v_services)<>2 then raise exception '451 company specialist entitlement incomplete';end if;
 select count(*) into n_a from public.ywi_pms_septic_sites_451 where company_id=p_company_id;
 select count(*) into n_b from public.ywi_pms_septic_manifests_451 where company_id=p_company_id;
 select count(*) into n_c from public.ywi_pms_arbor_trees_451 where company_id=p_company_id;
 select count(*) into n_d from public.ywi_pms_arbor_reviews_451 where company_id=p_company_id;
 if n_a>100 or n_b>200 or n_c>100 or n_d>200 then raise exception '451 specialist source cap exceeded';end if;
 select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc,x.id desc),'[]'::jsonb) into v_a
 from (select p.id,p.company_id,p.client_id,p.site_id,c.legal_name as client_name,
  s.site_name,p.tank_kind,p.capacity_l,p.access_hazard,p.permit_source,p.site_safety_source,
  p.source_reference,p.created_at from public.ywi_pms_septic_sites_451 p
  join public.ywi_company_site_links_422 l on l.company_id=p.company_id and l.client_id=p.client_id and l.client_site_id=p.site_id
  join public.clients c on c.id=l.client_id join public.client_sites s on s.id=l.client_site_id
  where p.company_id=p_company_id order by p.created_at desc,p.id desc limit 100) x;
 select coalesce(jsonb_agg(to_jsonb(x) order by x.recorded_at desc,x.id desc),'[]'::jsonb) into v_b
 from (select id,company_id,profile_id,service_on,waste_stream,reported_volume_l,
  measurement_source,facility_label,manifest_reference,original_receipt_428,
  disposal_review,source_reference,notes,recorded_at from public.ywi_pms_septic_manifests_451
  where company_id=p_company_id order by recorded_at desc,id desc limit 200) x;
 select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc,x.id desc),'[]'::jsonb) into v_c
 from (select t.id,t.company_id,t.client_id,t.site_id,c.legal_name as client_name,
  s.site_name,t.tree_label,t.species_label,t.approximate_height_m,t.risk_zone,
  t.risk_notes,t.permit_state,t.permit_source,t.source_reference,t.created_at
  from public.ywi_pms_arbor_trees_451 t join public.ywi_company_site_links_422 l
   on l.company_id=t.company_id and l.client_id=t.client_id and l.client_site_id=t.site_id
  join public.clients c on c.id=l.client_id join public.client_sites s on s.id=l.client_site_id
  where t.company_id=p_company_id order by t.created_at desc,t.id desc limit 100) x;
 select coalesce(jsonb_agg(to_jsonb(x) order by x.recorded_at desc,x.id desc),'[]'::jsonb) into v_d
 from (select id,company_id,tree_id,reviewed_on,risk_level,planned_method,
  equipment_source,crew_credential_source,safety_source,permit_source,review_state,
  evidence_reference,notes,recorded_at from public.ywi_pms_arbor_reviews_451
  where company_id=p_company_id order by recorded_at desc,id desc limit 200) x;
 if jsonb_array_length(v_a)<>n_a or jsonb_array_length(v_b)<>n_b
  or jsonb_array_length(v_c)<>n_c or jsonb_array_length(v_d)<>n_d
 then raise exception '451 specialist snapshot changed concurrently';end if;
 return jsonb_build_object('company_id',p_company_id,'captured_at',statement_timestamp(),
  'owner_guard','ywi_422_assert_owner','new_work_guard','ywi_421_assert_company_new_work',
  'services',v_services,'septic_sites',v_a,'septic_manifests',v_b,'arbor_trees',v_c,'arbor_reviews',v_d,
  'septic_site_count',n_a,'septic_manifest_count',n_b,'arbor_tree_count',n_c,'arbor_review_count',n_d,
  'historical_read_retained',true,'regulatory_compliance_verified',false,
  'permit_authorized',false,'crew_certified',false,'safety_cleared',false,
  'dispatch_authorized',false,'disposal_certified',false,'invoice_posted',false,'mutation_authorized',false);
end $$;

create or replace function public.ywi_rpc_pms_septic_site_451(
 p_company_id uuid,p_client_id uuid,p_site_id uuid,p_request_id uuid,p_kind text,
 p_capacity numeric,p_access text,p_permit_ref text,p_safety_ref text,p_source_ref text
) returns uuid language plpgsql volatile security definer set search_path='' as $$
declare v_old record;v_id uuid;
begin
 perform public.ywi_421_assert_company_new_work(p_company_id,'septic',p_client_id,p_site_id);
 if p_request_id is null or char_length(btrim(coalesce(p_source_ref,'')))<3
 then raise exception '451 original septic source required';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_company_id::text,451));
 if (select count(*) from public.ywi_pms_septic_sites_451 where company_id=p_company_id)>=100
  and not exists(select 1 from public.ywi_pms_septic_sites_451 where company_id=p_company_id and request_id=p_request_id)
 then raise exception '451 septic site cap reached';end if;
 insert into public.ywi_pms_septic_sites_451(company_id,client_id,site_id,request_id,
  tank_kind,capacity_l,access_hazard,permit_source,site_safety_source,source_reference,recorded_by)
 values(p_company_id,p_client_id,p_site_id,p_request_id,p_kind,p_capacity,btrim(p_access),
  nullif(btrim(p_permit_ref),''),nullif(btrim(p_safety_ref),''),btrim(p_source_ref),auth.uid())
 on conflict(company_id,request_id) do nothing returning id into v_id;
 if v_id is null then
  select * into v_old from public.ywi_pms_septic_sites_451 where company_id=p_company_id and request_id=p_request_id;
  if not found or v_old.recorded_by is distinct from auth.uid() or v_old.client_id is distinct from p_client_id
   or v_old.site_id is distinct from p_site_id or v_old.tank_kind is distinct from p_kind
   or v_old.capacity_l is distinct from p_capacity or v_old.access_hazard is distinct from btrim(p_access)
   or v_old.permit_source is distinct from nullif(btrim(p_permit_ref),'')
   or v_old.site_safety_source is distinct from nullif(btrim(p_safety_ref),'')
   or v_old.source_reference is distinct from btrim(p_source_ref)
  then raise exception '451 septic idempotency changed';end if;
  v_id:=v_old.id;
 end if;
 return v_id;
end $$;

create or replace function public.ywi_rpc_pms_septic_manifest_451(
 p_company_id uuid,p_profile_id uuid,p_request_id uuid,p_date date,p_stream text,
 p_volume numeric,p_measure_ref text,p_facility text,p_manifest_ref text,
 p_original_receipt uuid,p_disposal_state text,p_source_ref text,p_notes text
) returns uuid language plpgsql volatile security definer set search_path='' as $$
declare v_old record;v_id uuid;v_site record;
begin
 select client_id,site_id into v_site from public.ywi_pms_septic_sites_451
 where company_id=p_company_id and id=p_profile_id;
 if not found then raise exception '451 foreign septic profile';end if;
 perform public.ywi_421_assert_company_new_work(p_company_id,'septic',v_site.client_id,v_site.site_id);
 if p_request_id is null or p_date is null or p_date>current_date+366 or
  char_length(btrim(coalesce(p_source_ref,'')))<3 then raise exception '451 source-backed manifest required';end if;
 if p_original_receipt is not null and not exists (
  select 1 from public.ywi_septic_disposal_receipts_428 r
  join public.work_orders w on w.id=r.work_order_id
  where r.id=p_original_receipt and r.company_id=p_company_id and w.company_id=p_company_id
   and w.client_id=v_site.client_id and w.client_site_id=v_site.site_id
   and r.waste_stream=p_stream and r.measured_volume_l=p_volume
   and lower(btrim(r.disposal_facility))=lower(btrim(p_facility))
 ) then raise exception '451 original 428 disposal receipt mismatch';end if;
 if (p_original_receipt is null) is distinct from (p_disposal_state<>'source_linked')
 then raise exception '451 source-linked status requires exact original receipt';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_company_id::text,451));
 if (select count(*) from public.ywi_pms_septic_manifests_451 where company_id=p_company_id)>=200
  and not exists(select 1 from public.ywi_pms_septic_manifests_451 where company_id=p_company_id and request_id=p_request_id)
 then raise exception '451 manifest cap reached';end if;
 insert into public.ywi_pms_septic_manifests_451(company_id,profile_id,request_id,
  service_on,waste_stream,reported_volume_l,measurement_source,facility_label,
  manifest_reference,original_receipt_428,disposal_review,source_reference,notes,recorded_by)
 values(p_company_id,p_profile_id,p_request_id,p_date,p_stream,p_volume,btrim(p_measure_ref),
  btrim(p_facility),btrim(p_manifest_ref),p_original_receipt,p_disposal_state,btrim(p_source_ref),
  nullif(btrim(p_notes),''),auth.uid()) on conflict(company_id,request_id) do nothing returning id into v_id;
 if v_id is null then
  select * into v_old from public.ywi_pms_septic_manifests_451 where company_id=p_company_id and request_id=p_request_id;
  if not found or v_old.recorded_by is distinct from auth.uid() or v_old.profile_id is distinct from p_profile_id
   or v_old.service_on is distinct from p_date or v_old.waste_stream is distinct from p_stream
   or v_old.reported_volume_l is distinct from p_volume or v_old.measurement_source is distinct from btrim(p_measure_ref)
   or v_old.facility_label is distinct from btrim(p_facility) or v_old.manifest_reference is distinct from btrim(p_manifest_ref)
   or v_old.original_receipt_428 is distinct from p_original_receipt or v_old.disposal_review is distinct from p_disposal_state
   or v_old.source_reference is distinct from btrim(p_source_ref) or v_old.notes is distinct from nullif(btrim(p_notes),'')
  then raise exception '451 manifest idempotency changed';end if;
  v_id:=v_old.id;
 end if;
 return v_id;
end $$;

create or replace function public.ywi_rpc_pms_arbor_tree_451(
 p_company_id uuid,p_client_id uuid,p_site_id uuid,p_request_id uuid,p_label text,
 p_species text,p_height numeric,p_zone text,p_risk_notes text,p_permit_state text,
 p_permit_ref text,p_source_ref text
) returns uuid language plpgsql volatile security definer set search_path='' as $$
declare v_old record;v_id uuid;
begin
 perform public.ywi_421_assert_company_new_work(p_company_id,'arboriculture',p_client_id,p_site_id);
 if p_request_id is null or char_length(btrim(coalesce(p_source_ref,'')))<3
 then raise exception '451 original tree inventory source required';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_company_id::text,451));
 if (select count(*) from public.ywi_pms_arbor_trees_451 where company_id=p_company_id)>=100
  and not exists(select 1 from public.ywi_pms_arbor_trees_451 where company_id=p_company_id and request_id=p_request_id)
 then raise exception '451 arbor tree cap reached';end if;
 insert into public.ywi_pms_arbor_trees_451(company_id,client_id,site_id,request_id,
  tree_label,species_label,approximate_height_m,risk_zone,risk_notes,permit_state,permit_source,
  source_reference,recorded_by)
 values(p_company_id,p_client_id,p_site_id,p_request_id,btrim(p_label),btrim(p_species),p_height,
  p_zone,btrim(p_risk_notes),p_permit_state,nullif(btrim(p_permit_ref),''),btrim(p_source_ref),auth.uid())
 on conflict(company_id,request_id) do nothing returning id into v_id;
 if v_id is null then
  select * into v_old from public.ywi_pms_arbor_trees_451 where company_id=p_company_id and request_id=p_request_id;
  if not found or v_old.recorded_by is distinct from auth.uid() or v_old.client_id is distinct from p_client_id
   or v_old.site_id is distinct from p_site_id or v_old.tree_label is distinct from btrim(p_label)
   or v_old.species_label is distinct from btrim(p_species) or v_old.approximate_height_m is distinct from p_height
   or v_old.risk_zone is distinct from p_zone or v_old.risk_notes is distinct from btrim(p_risk_notes)
   or v_old.permit_state is distinct from p_permit_state or v_old.permit_source is distinct from nullif(btrim(p_permit_ref),'')
   or v_old.source_reference is distinct from btrim(p_source_ref)
  then raise exception '451 arbor idempotency changed';end if;
  v_id:=v_old.id;
 end if;
 return v_id;
end $$;

create or replace function public.ywi_rpc_pms_arbor_review_451(
 p_company_id uuid,p_tree_id uuid,p_request_id uuid,p_date date,p_risk text,
 p_method text,p_equipment_ref text,p_crew_ref text,p_safety_ref text,p_permit_ref text,
 p_state text,p_evidence_ref text,p_notes text
) returns uuid language plpgsql volatile security definer set search_path='' as $$
declare v_old record;v_id uuid;v_site record;
begin
 select client_id,site_id into v_site from public.ywi_pms_arbor_trees_451
 where company_id=p_company_id and id=p_tree_id;
 if not found then raise exception '451 foreign tree';end if;
 perform public.ywi_421_assert_company_new_work(p_company_id,'arboriculture',v_site.client_id,v_site.site_id);
 if p_request_id is null or p_date is null or p_date>current_date+366 or
  char_length(btrim(coalesce(p_evidence_ref,'')))<3 then raise exception '451 arbor review source required';end if;
 if p_risk in ('high','stop_work') and
  (char_length(btrim(coalesce(p_crew_ref,'')))<3 or char_length(btrim(coalesce(p_safety_ref,'')))<3)
 then raise exception '451 high-risk work requires crew and Safety reference labels, never authorization';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_company_id::text,451));
 if (select count(*) from public.ywi_pms_arbor_reviews_451 where company_id=p_company_id)>=200
  and not exists(select 1 from public.ywi_pms_arbor_reviews_451 where company_id=p_company_id and request_id=p_request_id)
 then raise exception '451 review cap reached';end if;
 insert into public.ywi_pms_arbor_reviews_451(company_id,tree_id,request_id,reviewed_on,
  risk_level,planned_method,equipment_source,crew_credential_source,safety_source,permit_source,
  review_state,evidence_reference,notes,recorded_by)
 values(p_company_id,p_tree_id,p_request_id,p_date,p_risk,p_method,
  nullif(btrim(p_equipment_ref),''),nullif(btrim(p_crew_ref),''),nullif(btrim(p_safety_ref),''),
  nullif(btrim(p_permit_ref),''),p_state,btrim(p_evidence_ref),nullif(btrim(p_notes),''),auth.uid())
 on conflict(company_id,request_id) do nothing returning id into v_id;
 if v_id is null then
  select * into v_old from public.ywi_pms_arbor_reviews_451 where company_id=p_company_id and request_id=p_request_id;
  if not found or v_old.recorded_by is distinct from auth.uid() or v_old.tree_id is distinct from p_tree_id
   or v_old.reviewed_on is distinct from p_date or v_old.risk_level is distinct from p_risk
   or v_old.planned_method is distinct from p_method or v_old.equipment_source is distinct from nullif(btrim(p_equipment_ref),'')
   or v_old.crew_credential_source is distinct from nullif(btrim(p_crew_ref),'')
   or v_old.safety_source is distinct from nullif(btrim(p_safety_ref),'')
   or v_old.permit_source is distinct from nullif(btrim(p_permit_ref),'')
   or v_old.review_state is distinct from p_state or v_old.evidence_reference is distinct from btrim(p_evidence_ref)
   or v_old.notes is distinct from nullif(btrim(p_notes),'')
  then raise exception '451 arbor review idempotency changed';end if;
  v_id:=v_old.id;
 end if;
 return v_id;
end $$;

revoke all on function public.ywi_rpc_pms_specialist_snapshot_451(uuid) from public,anon,authenticated;
revoke all on function public.ywi_rpc_pms_septic_site_451(uuid,uuid,uuid,uuid,text,numeric,text,text,text,text) from public,anon,authenticated;
revoke all on function public.ywi_rpc_pms_septic_manifest_451(uuid,uuid,uuid,date,text,numeric,text,text,text,uuid,text,text,text) from public,anon,authenticated;
revoke all on function public.ywi_rpc_pms_arbor_tree_451(uuid,uuid,uuid,uuid,text,text,numeric,text,text,text,text,text) from public,anon,authenticated;
revoke all on function public.ywi_rpc_pms_arbor_review_451(uuid,uuid,uuid,date,text,text,text,text,text,text,text,text,text) from public,anon,authenticated;
grant execute on function public.ywi_rpc_pms_specialist_snapshot_451(uuid) to authenticated;
grant execute on function public.ywi_rpc_pms_septic_site_451(uuid,uuid,uuid,uuid,text,numeric,text,text,text,text) to authenticated;
grant execute on function public.ywi_rpc_pms_septic_manifest_451(uuid,uuid,uuid,date,text,numeric,text,text,text,uuid,text,text,text) to authenticated;
grant execute on function public.ywi_rpc_pms_arbor_tree_451(uuid,uuid,uuid,uuid,text,text,numeric,text,text,text,text,text) to authenticated;
grant execute on function public.ywi_rpc_pms_arbor_review_451(uuid,uuid,uuid,date,text,text,text,text,text,text,text,text,text) to authenticated;
commit;
