-- YW Item 456. Append-only, permission-safe first-service trial reconciliation.
-- A "ready for independent review" entry is a recommendation, NEVER approval.
-- Original 421 Jobs/estimate receipts, 422 CRM links and 455 owner reports stay authoritative.
begin;
create table if not exists public.ywi_first_service_reviews_456 (
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null references public.ywi_companies(id) on delete restrict,
 request_id uuid not null,
 service_module_key text not null check(service_module_key in
  ('landscape','construction','water_parks','snow_removal','snow_plowing','septic','arboriculture')),
 target_table text not null check(target_table in ('estimates','work_orders')),
 target_id uuid not null,
 evidence_id uuid references public.ywi_owner_first_use_entries_455(id) on delete restrict,
 review_outcome text not null check(review_outcome in
  ('blocked','needs_follow_up','ready_for_independent_review')),
 source_reference text not null check(char_length(btrim(source_reference)) between 4 and 250),
 notes text check(notes is null or char_length(notes)<=500),
 switch_enabled_at_review boolean not null,
 canonical_site_verified boolean not null,
 reviewer_user_id uuid not null references auth.users(id) on delete restrict,
 recorded_at timestamptz not null default now(),
 unique(company_id,request_id),
 foreign key(company_id,service_module_key)
  references public.ywi_company_service_modules(company_id,module_key) on delete restrict,
 constraint ywi_456_ready_evidence check(review_outcome<>'ready_for_independent_review'
  or (evidence_id is not null and switch_enabled_at_review and canonical_site_verified))
);
create index if not exists ywi_456_company_reviews_idx
 on public.ywi_first_service_reviews_456(company_id,recorded_at desc,id desc);
alter table public.ywi_first_service_reviews_456 enable row level security;
revoke all on public.ywi_first_service_reviews_456 from public,anon,authenticated;
drop policy if exists ywi_456_owner_read_defense on public.ywi_first_service_reviews_456;
create policy ywi_456_owner_read_defense on public.ywi_first_service_reviews_456
 for select to authenticated using(exists(select 1 from public.ywi_companies c
  where c.id=company_id and c.owner_user_id=(select auth.uid())));

create or replace function public.ywi_rpc_first_service_review_456(p_company_id uuid)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_nav jsonb;v_receipts jsonb;v_entries jsonb;v_reviews jsonb;
 v_receipt_total integer;v_evidence_total integer;v_review_total integer;
begin
 perform public.ywi_422_assert_owner(p_company_id);
 v_nav:=public.ywi_rpc_pms_navigation_443(p_company_id);
 select count(*) into v_receipt_total from public.ywi_new_work_gate_receipts_421
 where company_id=p_company_id;
 select coalesce(jsonb_agg(to_jsonb(s) order by s.checked_at desc,s.target_id desc),'[]'::jsonb)
 into v_receipts from (
  select company_id,service_module_key,target_table,target_id,checked_at
   from public.ywi_new_work_gate_receipts_421 where company_id=p_company_id
   order by checked_at desc,target_id desc limit 60
 ) s;
 select count(*) into v_evidence_total from public.ywi_owner_first_use_entries_455
 where company_id=p_company_id;
 select coalesce(jsonb_agg(to_jsonb(e) order by e.created_at desc,e.id desc),'[]'::jsonb)
 into v_entries from (
  select id,company_id,checkpoint,module_key,observed_enabled,source_reference,disposition,created_at
   from public.ywi_owner_first_use_entries_455 where company_id=p_company_id
   order by created_at desc,id desc limit 60
 ) e;
 select count(*) into v_review_total from public.ywi_first_service_reviews_456
 where company_id=p_company_id;
 select coalesce(jsonb_agg(to_jsonb(t) order by t.recorded_at desc,t.id desc),'[]'::jsonb)
 into v_reviews from (
  select id,company_id,service_module_key,target_table,target_id,evidence_id,review_outcome,
   source_reference,notes,switch_enabled_at_review,canonical_site_verified,recorded_at
   from public.ywi_first_service_reviews_456 where company_id=p_company_id
   order by recorded_at desc,id desc limit 60
 ) t;
 return jsonb_build_object('company_id',p_company_id,'owner_guard','ywi_422_assert_owner',
  'captured_at',statement_timestamp(),'services',v_nav->'services',
  'receipts',v_receipts,'receipt_total',v_receipt_total,'receipt_sample_capped',v_receipt_total>60,
  'owner_entries',v_entries,'owner_entry_total',v_evidence_total,'owner_entry_sample_capped',v_evidence_total>60,
  'reviews',v_reviews,'review_total',v_review_total,'review_sample_capped',v_review_total>60,
  'independent_approval_granted',false,'real_field_accepted',false,'release_green',false,
  'outbound_actions',false,'synthetic',false,'mutation_authorized',false);
end $$;

create or replace function public.ywi_rpc_append_first_service_review_456(
 p_company_id uuid,p_request_id uuid,p_service_module_key text,p_target_table text,
 p_target_id uuid,p_evidence_id uuid,p_review_outcome text,p_source_reference text,p_notes text
) returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_id uuid;v_old record;v_enabled boolean;v_client uuid;v_site uuid;
 v_source_company uuid;v_source_service text;v_verified_site boolean:=false;
 v_actor uuid:=auth.uid();v_role text;v_level text;
 v_ref text:=btrim(coalesce(p_source_reference,''));v_notes text:=nullif(btrim(coalesce(p_notes,'')),'');
begin
 perform public.ywi_422_assert_owner(p_company_id);
 perform public.ywi_422_assert_jobs_create();
 if p_request_id is null or p_target_id is null or p_service_module_key is null or
  p_service_module_key not in ('landscape','construction','water_parks','snow_removal',
   'snow_plowing','septic','arboriculture') or p_target_table is null or
  p_target_table not in ('estimates','work_orders') or p_review_outcome is null or
  p_review_outcome not in ('blocked','needs_follow_up','ready_for_independent_review') or
  char_length(v_ref) not between 4 and 250 or char_length(coalesce(v_notes,''))>500 then
  raise exception '456 invalid reconciliation request';
 end if;
 -- Serialize owner-review and exact switch truth before writing a recommendation.
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_company_id::text,456));
 select enabled into v_enabled from public.ywi_company_service_modules
  where company_id=p_company_id and module_key=p_service_module_key for share;
 if not found then raise exception '456 company module is missing';end if;
 if not exists(select 1 from public.ywi_new_work_gate_receipts_421 r
  where r.company_id=p_company_id and r.service_module_key=p_service_module_key
   and r.target_table=p_target_table and r.target_id=p_target_id) then
  raise exception '456 original Jobs/estimate gate receipt missing or foreign';
 end if;
 if p_target_table='estimates' then
  select company_id,service_module_key,client_id,client_site_id
   into v_source_company,v_source_service,v_client,v_site from public.estimates
   where id=p_target_id;
 else
  select company_id,service_module_key,client_id,client_site_id
   into v_source_company,v_source_service,v_client,v_site from public.work_orders
   where id=p_target_id;
 end if;
 if not found or v_source_company is distinct from p_company_id or
  v_source_service is distinct from p_service_module_key then
  raise exception '456 canonical original source does not match receipt';
 end if;
 if v_client is not null and v_site is not null and exists(
  select 1 from public.ywi_company_site_links_422 l
  join public.clients c on c.id=l.client_id and c.is_active is true
  join public.client_sites s on s.id=l.client_site_id and s.is_active is true
  where l.company_id=p_company_id and l.client_id=v_client and l.client_site_id=v_site
 ) then v_verified_site:=true;end if;
 if p_evidence_id is not null and not exists(
  select 1 from public.ywi_owner_first_use_entries_455 e
  where e.id=p_evidence_id and e.company_id=p_company_id
    and e.checkpoint in ('field_observation','jobs_draft_reviewed')) then
  raise exception '456 first-use evidence is foreign or not trial-related';
 end if;
 if p_review_outcome='ready_for_independent_review' then
  select lower(role) into v_role from public.profiles where id=v_actor and is_active is true;
  select coalesce((select access_level from public.app_profile_module_permissions
    where profile_id=v_actor and module_key='jobs'),
    (select access_level from public.app_role_module_permissions
    where role=v_role and module_key='jobs')) into v_level;
  if v_level not in ('approve','manage') or v_level is null then
   raise exception '456 Jobs approve/manage permission required for review readiness';
  end if;
  if not v_enabled or not v_verified_site or p_evidence_id is null or not exists(
   select 1 from public.ywi_owner_first_use_entries_455 e
   where e.id=p_evidence_id and e.company_id=p_company_id
    and e.checkpoint='field_observation' and e.disposition='observed'
  ) then
   raise exception '456 source-linked field observation, ON module and canonical property required';
  end if;
 end if;
 if (select count(*) from public.ywi_first_service_reviews_456 where company_id=p_company_id)>=200 then
  raise exception '456 reconciliation capacity reached; pagination required';
 end if;
 insert into public.ywi_first_service_reviews_456
 (company_id,request_id,service_module_key,target_table,target_id,evidence_id,review_outcome,
  source_reference,notes,switch_enabled_at_review,canonical_site_verified,reviewer_user_id)
 values(p_company_id,p_request_id,p_service_module_key,p_target_table,p_target_id,p_evidence_id,
  p_review_outcome,v_ref,v_notes,v_enabled,v_verified_site,v_actor)
 on conflict(company_id,request_id) do nothing returning id into v_id;
 if v_id is null then
  select * into v_old from public.ywi_first_service_reviews_456
   where company_id=p_company_id and request_id=p_request_id;
  if not found or v_old.service_module_key is distinct from p_service_module_key or
   v_old.target_table is distinct from p_target_table or v_old.target_id is distinct from p_target_id or
   v_old.evidence_id is distinct from p_evidence_id or v_old.review_outcome is distinct from p_review_outcome or
   v_old.source_reference is distinct from v_ref or v_old.notes is distinct from v_notes or
   v_old.switch_enabled_at_review is distinct from v_enabled or
   v_old.canonical_site_verified is distinct from v_verified_site or
   v_old.reviewer_user_id is distinct from v_actor then
   raise exception '456 replay request differs from original review';
  end if;
  v_id:=v_old.id;
 end if;
 return jsonb_build_object('id',v_id,'company_id',p_company_id,'review_outcome',p_review_outcome,
  'recorded',true,'independent_approval_granted',false,'real_field_accepted',false,
  'outbound_actions',false);
end $$;
revoke all on function public.ywi_rpc_first_service_review_456(uuid) from public,anon,authenticated;
revoke all on function public.ywi_rpc_append_first_service_review_456(uuid,uuid,text,text,uuid,uuid,text,text,text)
 from public,anon,authenticated;
grant execute on function public.ywi_rpc_first_service_review_456(uuid) to authenticated;
grant execute on function public.ywi_rpc_append_first_service_review_456(uuid,uuid,text,text,uuid,uuid,text,text,text)
 to authenticated;
comment on table public.ywi_first_service_reviews_456 is
 'First-service source reconciliation and permission-safe review recommendations; never final field or safety approval.';
commit;
