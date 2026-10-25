-- YW 452: company-owned construction specialties and unverified field evidence.
-- Original 425 Jobs/Safety/Finance/permit workflows retain all approval authority.
begin;

create table public.ywi_pms_construction_projects_452 (
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null references public.ywi_companies(id) on delete restrict,
 work_order_id uuid not null references public.work_orders(id) on delete restrict,
 client_id uuid not null,site_id uuid not null,request_id uuid not null,
 specialty text not null check(specialty in
  ('light_construction','concrete','fibre_line','excavation','land_clearance','ditch_digging')),
 scope_label text not null check(char_length(btrim(scope_label)) between 3 and 140),
 scope_notes text not null check(char_length(btrim(scope_notes)) between 10 and 750),
 permit_state text not null check(permit_state in
  ('unreviewed','not_required_claim','required_unverified','source_provided')),
 permit_source text check(char_length(permit_source) between 3 and 160),
 utility_locate_source text check(char_length(utility_locate_source) between 3 and 160),
 site_hazard_source text not null check(char_length(btrim(site_hazard_source)) between 3 and 160),
 original_scope_source text not null check(char_length(btrim(original_scope_source)) between 3 and 160),
 recorded_by uuid not null references auth.users(id) on delete restrict,
 created_at timestamptz not null default now(),
 unique(company_id,id),unique(company_id,request_id),
 foreign key(company_id,client_id,site_id) references
  public.ywi_company_site_links_422(company_id,client_id,client_site_id) on delete restrict,
 check(permit_state<>'source_provided' or permit_source is not null)
);

create table public.ywi_pms_construction_evidence_452 (
 id uuid primary key default gen_random_uuid(),company_id uuid not null,
 project_id uuid not null,request_id uuid not null,observed_on date not null,
 activity text not null check(activity in
  ('site_review','permit_review','formwork','reinforcement','pour','cure','cable_route',
   'utility_locate','trench','conduit','backfill','shoring','dig','grading','clearing','ditch',
   'inspection','other')),
 reported_quantity numeric(14,3) check(reported_quantity>0 and reported_quantity<=10000000),
 quantity_unit text check(quantity_unit in ('m','m2','m3','hours','units')),
 field_state text not null check(field_state in ('plan_only','operator_reported','hold')),
 permit_source text check(char_length(permit_source) between 3 and 160),
 utility_locate_source text check(char_length(utility_locate_source) between 3 and 160),
 safety_source text check(char_length(safety_source) between 3 and 160),
 inspection_source text check(char_length(inspection_source) between 3 and 160),
 evidence_reference text not null check(char_length(btrim(evidence_reference)) between 3 and 160),
 notes text check(char_length(notes)<=750),
 recorded_by uuid not null references auth.users(id) on delete restrict,
 recorded_at timestamptz not null default now(),
 unique(company_id,request_id),
 foreign key(company_id,project_id) references public.ywi_pms_construction_projects_452(company_id,id) on delete restrict,
 check((reported_quantity is null and quantity_unit is null) or
       (reported_quantity is not null and quantity_unit is not null)),
 check(field_state<>'operator_reported' or safety_source is not null)
);
create index ywi_452_project_company_site on public.ywi_pms_construction_projects_452(company_id,site_id,created_at desc);
create index ywi_452_project_work_order on public.ywi_pms_construction_projects_452(work_order_id);
create index ywi_452_field_company_project on public.ywi_pms_construction_evidence_452(company_id,project_id,recorded_at desc);
alter table public.ywi_pms_construction_projects_452 enable row level security;
alter table public.ywi_pms_construction_evidence_452 enable row level security;
revoke all on public.ywi_pms_construction_projects_452 from public,anon,authenticated;
revoke all on public.ywi_pms_construction_evidence_452 from public,anon,authenticated;
-- No direct browser table grants or RLS policies: explicit owner/Jobs RPCs only.

create function public.ywi_rpc_pms_construction_snapshot_452(p_company_id uuid)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_projects jsonb;v_evidence jsonb;v_orders jsonb;v_enabled boolean;
 v_n integer;v_m integer;v_o integer;
begin
 perform public.ywi_422_assert_owner(p_company_id);
 select enabled into v_enabled from public.ywi_company_service_modules
  where company_id=p_company_id and module_key='construction';
 if v_enabled is null then raise exception '452 construction registry unavailable';end if;
 select count(*) into v_n from public.ywi_pms_construction_projects_452 where company_id=p_company_id;
 select count(*) into v_m from public.ywi_pms_construction_evidence_452 where company_id=p_company_id;
 select count(*) into v_o from public.work_orders w
  join public.ywi_company_site_links_422 l on l.company_id=w.company_id
   and l.client_id=w.client_id and l.client_site_id=w.client_site_id
  where w.company_id=p_company_id and w.service_module_key='construction';
 if v_n>150 or v_m>300 or v_o>60 then raise exception '452 bounded source cap exceeded';end if;
 select coalesce(jsonb_agg(to_jsonb(o) order by o.id),'[]'::jsonb) into v_orders from (
  select w.id,w.company_id,w.client_id,w.client_site_id as site_id,
   w.work_order_number as number,w.status,c.legal_name as client_name,s.site_name
  from public.work_orders w join public.ywi_company_site_links_422 l on l.company_id=w.company_id
   and l.client_id=w.client_id and l.client_site_id=w.client_site_id
  join public.clients c on c.id=l.client_id join public.client_sites s on s.id=l.client_site_id
  where w.company_id=p_company_id and w.service_module_key='construction'
  order by w.created_at desc,w.id desc limit 60
 ) o;
 select coalesce(jsonb_agg(to_jsonb(p) order by p.created_at desc,p.id desc),'[]'::jsonb)
 into v_projects from (
  select x.id,x.company_id,x.work_order_id,x.client_id,x.site_id,
   c.legal_name as client_name,s.site_name,x.specialty,x.scope_label,x.scope_notes,
   x.permit_state,x.permit_source,x.utility_locate_source,x.site_hazard_source,
   x.original_scope_source,x.created_at
  from public.ywi_pms_construction_projects_452 x
  join public.ywi_company_site_links_422 l on l.company_id=x.company_id
   and l.client_id=x.client_id and l.client_site_id=x.site_id
  join public.clients c on c.id=l.client_id
  join public.client_sites s on s.id=l.client_site_id
  where x.company_id=p_company_id order by x.created_at desc,x.id desc limit 150
 ) p;
 select coalesce(jsonb_agg(to_jsonb(e) order by e.recorded_at desc,e.id desc),'[]'::jsonb)
 into v_evidence from (
  select id,company_id,project_id,observed_on,activity,reported_quantity,quantity_unit,
   field_state,permit_source,utility_locate_source,safety_source,inspection_source,
   evidence_reference,notes,recorded_at
  from public.ywi_pms_construction_evidence_452 where company_id=p_company_id
  order by recorded_at desc,id desc limit 300
 ) e;
 if jsonb_array_length(v_projects)<>v_n or jsonb_array_length(v_evidence)<>v_m or
  jsonb_array_length(v_orders)<>v_o
 then raise exception '452 original source changed during capture';end if;
 return jsonb_build_object('company_id',p_company_id,'captured_at',statement_timestamp(),
  'owner_guard','ywi_422_assert_owner','new_work_guard','ywi_421_assert_company_new_work',
  'original_order_guard','ywi_425_assert_construction_order','module_key','construction',
  'enabled',v_enabled,'orders',v_orders,'projects',v_projects,'evidence',v_evidence,
  'order_count',v_o,'project_count',v_n,'evidence_count',v_m,'historical_read_retained',true,
  'permit_verified',false,'utility_clearance_verified',false,'safety_cleared',false,
  'inspection_approved',false,'field_work_authorized',false,'dispatch_authorized',false,
  'finance_posted',false,'mutation_authorized',false);
end $$;

create function public.ywi_rpc_pms_construction_project_452(
 p_company_id uuid,p_order_id uuid,p_client_id uuid,p_site_id uuid,p_request_id uuid,
 p_specialty text,p_label text,p_notes text,p_permit_state text,p_permit_source text,
 p_utility_source text,p_hazard_source text,p_scope_source text
) returns uuid language plpgsql volatile security definer set search_path='' as $$
declare v_id uuid;v_old record;
 v_permit text:=nullif(btrim(p_permit_source),'');
 v_utility text:=nullif(btrim(p_utility_source),'');
begin
 perform public.ywi_421_assert_company_new_work(p_company_id,'construction',p_client_id,p_site_id);
 perform public.ywi_425_assert_construction_order(p_company_id,p_order_id,true);
 if not exists(select 1 from public.work_orders w where w.id=p_order_id and
  w.company_id=p_company_id and w.client_id=p_client_id and w.client_site_id=p_site_id)
 then raise exception '452 original company work order, customer and property mismatch';end if;
 if p_request_id is null or char_length(btrim(coalesce(p_scope_source,'')))<3
 then raise exception '452 original scope source required';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_company_id::text,452));
 if (select count(*) from public.ywi_pms_construction_projects_452 where company_id=p_company_id)>=150
  and not exists(select 1 from public.ywi_pms_construction_projects_452
   where company_id=p_company_id and request_id=p_request_id)
 then raise exception '452 project source cap reached';end if;
 insert into public.ywi_pms_construction_projects_452(company_id,work_order_id,client_id,site_id,
  request_id,specialty,scope_label,scope_notes,permit_state,permit_source,
  utility_locate_source,site_hazard_source,original_scope_source,recorded_by)
 values(p_company_id,p_order_id,p_client_id,p_site_id,p_request_id,p_specialty,btrim(p_label),
  btrim(p_notes),p_permit_state,v_permit,v_utility,btrim(p_hazard_source),
  btrim(p_scope_source),auth.uid())
 on conflict(company_id,request_id) do nothing returning id into v_id;
 if v_id is null then
  select * into v_old from public.ywi_pms_construction_projects_452
   where company_id=p_company_id and request_id=p_request_id;
  if not found or v_old.recorded_by is distinct from auth.uid() or
   v_old.work_order_id is distinct from p_order_id or v_old.client_id is distinct from p_client_id or
   v_old.site_id is distinct from p_site_id or v_old.specialty is distinct from p_specialty or
   v_old.scope_label is distinct from btrim(p_label) or v_old.scope_notes is distinct from btrim(p_notes) or
   v_old.permit_state is distinct from p_permit_state or v_old.permit_source is distinct from v_permit or
   v_old.utility_locate_source is distinct from v_utility or
   v_old.site_hazard_source is distinct from btrim(p_hazard_source) or
   v_old.original_scope_source is distinct from btrim(p_scope_source)
  then raise exception '452 changed project replay';end if;
  v_id:=v_old.id;
 end if;
 return v_id;
end $$;

create function public.ywi_rpc_pms_construction_evidence_452(
 p_company_id uuid,p_project_id uuid,p_request_id uuid,p_date date,p_activity text,
 p_quantity numeric,p_unit text,p_state text,p_permit_source text,p_utility_source text,
 p_safety_source text,p_inspection_source text,p_evidence_source text,p_notes text
) returns uuid language plpgsql volatile security definer set search_path='' as $$
declare v_project record;v_id uuid;v_old record;
 v_permit text:=nullif(btrim(p_permit_source),'');
 v_utility text:=nullif(btrim(p_utility_source),'');
 v_safety text:=nullif(btrim(p_safety_source),'');
 v_inspection text:=nullif(btrim(p_inspection_source),'');
 v_notes text:=nullif(btrim(p_notes),'');
begin
 select * into v_project from public.ywi_pms_construction_projects_452
 where company_id=p_company_id and id=p_project_id;
 if not found then raise exception '452 foreign construction project';end if;
 perform public.ywi_421_assert_company_new_work(p_company_id,'construction',v_project.client_id,v_project.site_id);
 perform public.ywi_425_assert_construction_order(p_company_id,v_project.work_order_id,true);
 if p_request_id is null or p_date is null or p_date<date '2000-01-01' or p_date>current_date+366 or
  char_length(btrim(coalesce(p_evidence_source,'')))<3
 then raise exception '452 dated original field evidence required';end if;
 if p_state='operator_reported' and
  (v_safety is null or (v_project.specialty in ('fibre_line','excavation','ditch_digging') and v_utility is null))
 then raise exception '452 Safety and excavation/utility locate source labels required; not clearance';end if;
 if p_activity not in ('site_review','permit_review','inspection','other') and not (
  (v_project.specialty='concrete' and p_activity in ('formwork','reinforcement','pour','cure')) or
  (v_project.specialty='fibre_line' and p_activity in ('cable_route','utility_locate','trench','conduit','backfill')) or
  (v_project.specialty='excavation' and p_activity in ('utility_locate','shoring','dig','backfill','grading')) or
  (v_project.specialty='ditch_digging' and p_activity in ('utility_locate','shoring','ditch','grading')) or
  (v_project.specialty='land_clearance' and p_activity in ('clearing','grading')) or
  (v_project.specialty='light_construction' and p_activity in ('formwork','grading','clearing'))
 ) then raise exception '452 activity incompatible with original specialty';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_company_id::text,452));
 if (select count(*) from public.ywi_pms_construction_evidence_452 where company_id=p_company_id)>=300
  and not exists(select 1 from public.ywi_pms_construction_evidence_452
   where company_id=p_company_id and request_id=p_request_id)
 then raise exception '452 field evidence cap reached';end if;
 insert into public.ywi_pms_construction_evidence_452(company_id,project_id,request_id,
  observed_on,activity,reported_quantity,quantity_unit,field_state,permit_source,
  utility_locate_source,safety_source,inspection_source,evidence_reference,notes,recorded_by)
 values(p_company_id,p_project_id,p_request_id,p_date,p_activity,p_quantity,p_unit,
  p_state,v_permit,v_utility,v_safety,v_inspection,btrim(p_evidence_source),v_notes,auth.uid())
 on conflict(company_id,request_id) do nothing returning id into v_id;
 if v_id is null then
  select * into v_old from public.ywi_pms_construction_evidence_452
   where company_id=p_company_id and request_id=p_request_id;
  if not found or v_old.recorded_by is distinct from auth.uid() or
   v_old.project_id is distinct from p_project_id or v_old.observed_on is distinct from p_date or
   v_old.activity is distinct from p_activity or v_old.reported_quantity is distinct from p_quantity or
   v_old.quantity_unit is distinct from p_unit or v_old.field_state is distinct from p_state or
   v_old.permit_source is distinct from v_permit or v_old.utility_locate_source is distinct from v_utility or
   v_old.safety_source is distinct from v_safety or v_old.inspection_source is distinct from v_inspection or
   v_old.evidence_reference is distinct from btrim(p_evidence_source) or v_old.notes is distinct from v_notes
  then raise exception '452 changed field evidence replay';end if;
  v_id:=v_old.id;
 end if;
 return v_id;
end $$;

revoke all on function public.ywi_rpc_pms_construction_snapshot_452(uuid) from public,anon,authenticated;
revoke all on function public.ywi_rpc_pms_construction_project_452(uuid,uuid,uuid,uuid,uuid,text,text,text,text,text,text,text,text) from public,anon,authenticated;
revoke all on function public.ywi_rpc_pms_construction_evidence_452(uuid,uuid,uuid,date,text,numeric,text,text,text,text,text,text,text,text) from public,anon,authenticated;
grant execute on function public.ywi_rpc_pms_construction_snapshot_452(uuid) to authenticated;
grant execute on function public.ywi_rpc_pms_construction_project_452(uuid,uuid,uuid,uuid,uuid,text,text,text,text,text,text,text,text) to authenticated;
grant execute on function public.ywi_rpc_pms_construction_evidence_452(uuid,uuid,uuid,date,text,numeric,text,text,text,text,text,text,text,text) to authenticated;
commit;
