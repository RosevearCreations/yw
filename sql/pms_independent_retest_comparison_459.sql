-- YW Item 459: separate reviewer retest assignment and immutable comparison.
-- Comparison is documentary only, not field, Safety, or operational approval.
begin;
create table if not exists public.ywi_retest_assignments_459 (
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null references public.ywi_companies(id) on delete restrict,
 request_id uuid not null,
 owner_followup_id uuid not null unique references public.ywi_owner_independent_followups_458(id) on delete restrict,
 reviewer_user_id uuid not null references auth.users(id) on delete restrict,
 owner_user_id uuid not null references auth.users(id) on delete restrict,
 source_reference text not null check(char_length(btrim(source_reference)) between 4 and 250),
 notes text check(notes is null or char_length(notes)<=500),
 created_at timestamptz not null default now(),
 unique(company_id,request_id),
 check(reviewer_user_id<>owner_user_id)
);
create index if not exists ywi_459_assignment_inbox
 on public.ywi_retest_assignments_459(reviewer_user_id,created_at desc);
alter table public.ywi_retest_assignments_459 enable row level security;
revoke all on public.ywi_retest_assignments_459 from public,anon,authenticated;

create table if not exists public.ywi_retest_comparisons_459 (
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null references public.ywi_companies(id) on delete restrict,
 request_id uuid not null,
 assignment_id uuid not null unique references public.ywi_retest_assignments_459(id) on delete restrict,
 fresh_evidence_id uuid not null references public.ywi_owner_first_use_entries_455(id) on delete restrict,
 outcome text not null check(outcome in ('comparison_matches','comparison_differs','insufficient_evidence')),
 source_reference text not null check(char_length(btrim(source_reference)) between 4 and 250),
 notes text check(notes is null or char_length(notes)<=500),
 reviewer_user_id uuid not null references auth.users(id) on delete restrict,
 created_at timestamptz not null default now(),
 unique(company_id,request_id)
);
create index if not exists ywi_459_comparison_company
 on public.ywi_retest_comparisons_459(company_id,created_at desc);
alter table public.ywi_retest_comparisons_459 enable row level security;
revoke all on public.ywi_retest_comparisons_459 from public,anon,authenticated;

create or replace function public.ywi_rpc_retest_inbox_459()
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();v_total integer;v_rows jsonb;
begin
 if v_actor is null or not exists(select 1 from public.profiles
  where id=v_actor and is_active is true) then raise exception '459 active sign-in required';end if;
 select count(*) into v_total from public.ywi_companies c
  where c.owner_user_id=v_actor or exists(select 1 from public.ywi_retest_assignments_459 a
   where a.company_id=c.id and a.reviewer_user_id=v_actor);
 select coalesce(jsonb_agg(to_jsonb(s) order by s.name,s.id),'[]'::jsonb) into v_rows from (
  select c.id,c.name,(c.owner_user_id=v_actor) is_owner,
    exists(select 1 from public.ywi_retest_assignments_459 a
     where a.company_id=c.id and a.reviewer_user_id=v_actor) is_assigned_reviewer
  from public.ywi_companies c where c.owner_user_id=v_actor
   or exists(select 1 from public.ywi_retest_assignments_459 a
    where a.company_id=c.id and a.reviewer_user_id=v_actor)
  order by c.name,c.id limit 60) s;
 return jsonb_build_object('captured_at',statement_timestamp(),'companies',v_rows,
  'total',v_total,'sample_capped',v_total>60,'outbound_actions',false,'release_green',false);
end $$;

create or replace function public.ywi_rpc_independent_retest_459(p_company_id uuid)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();v_owner boolean;v_reviewer boolean;
 v_services jsonb;v_followups jsonb;v_assignments jsonb;v_comparisons jsonb;v_evidence jsonb;
 v_followups_total integer;v_assignments_total integer;v_comparisons_total integer;v_evidence_total integer;
begin
 if v_actor is null or not exists(select 1 from public.profiles where id=v_actor and is_active is true)
  then raise exception '459 active profile required';end if;
 select owner_user_id=v_actor into v_owner from public.ywi_companies where id=p_company_id;
 v_owner:=coalesce(v_owner,false);
 select exists(select 1 from public.ywi_retest_assignments_459
  where company_id=p_company_id and reviewer_user_id=v_actor) into v_reviewer;
 if not v_owner and not v_reviewer then raise exception '459 company/reviewer scope denied';end if;
 select coalesce(jsonb_agg(to_jsonb(s) order by s.module_key),'[]'::jsonb) into v_services
 from (select company_id,module_key,enabled from public.ywi_company_service_modules
  where company_id=p_company_id order by module_key) s;
 select count(*) into v_followups_total from public.ywi_owner_independent_followups_458 f
  where f.company_id=p_company_id and f.disposition='retest_evidence_ready' and
   (v_owner or exists(select 1 from public.ywi_retest_assignments_459 a
    where a.owner_followup_id=f.id and a.reviewer_user_id=v_actor));
 select coalesce(jsonb_agg(to_jsonb(s) order by s.created_at desc,s.id desc),'[]'::jsonb)
  into v_followups from (select f.id,f.company_id,f.independent_decision_id,f.followup_evidence_id,
   f.source_reference,f.created_at,d.decision,d.created_at as decision_at,r.service_module_key,
   r.target_table,r.target_id
   from public.ywi_owner_independent_followups_458 f
   join public.ywi_first_service_decisions_457 d on d.id=f.independent_decision_id
   join public.ywi_first_service_handoffs_457 h on h.id=d.handoff_id
   join public.ywi_first_service_reviews_456 r on r.id=h.owner_review_id
   where f.company_id=p_company_id and f.disposition='retest_evidence_ready' and
    (v_owner or exists(select 1 from public.ywi_retest_assignments_459 a
     where a.owner_followup_id=f.id and a.reviewer_user_id=v_actor))
   order by f.created_at desc,f.id desc limit 60) s;
 select count(*) into v_assignments_total from public.ywi_retest_assignments_459 a
  where a.company_id=p_company_id and (v_owner or a.reviewer_user_id=v_actor);
 select coalesce(jsonb_agg(to_jsonb(s) order by s.created_at desc,s.id desc),'[]'::jsonb)
  into v_assignments from (select a.id,a.company_id,a.owner_followup_id,a.reviewer_user_id,
   a.source_reference,a.notes,a.created_at from public.ywi_retest_assignments_459 a
   where a.company_id=p_company_id and (v_owner or a.reviewer_user_id=v_actor)
   order by a.created_at desc,a.id desc limit 60) s;
 select count(*) into v_comparisons_total from public.ywi_retest_comparisons_459 c
  join public.ywi_retest_assignments_459 a on a.id=c.assignment_id
  where c.company_id=p_company_id and (v_owner or a.reviewer_user_id=v_actor);
 select coalesce(jsonb_agg(to_jsonb(s) order by s.created_at desc,s.id desc),'[]'::jsonb)
  into v_comparisons from (select c.id,c.company_id,c.assignment_id,c.fresh_evidence_id,
   c.outcome,c.source_reference,c.notes,c.created_at from public.ywi_retest_comparisons_459 c
   join public.ywi_retest_assignments_459 a on a.id=c.assignment_id
   where c.company_id=p_company_id and (v_owner or a.reviewer_user_id=v_actor)
   order by c.created_at desc,c.id desc limit 60) s;
 select count(*) into v_evidence_total from public.ywi_owner_first_use_entries_455 e
  where e.company_id=p_company_id and e.checkpoint='field_observation' and e.disposition='observed'
   and exists(select 1 from public.ywi_retest_assignments_459 a
    where a.company_id=p_company_id and (v_owner or a.reviewer_user_id=v_actor)
     and e.created_at>a.created_at);
 select coalesce(jsonb_agg(to_jsonb(s) order by s.created_at desc,s.id desc),'[]'::jsonb)
  into v_evidence from (select e.id,e.company_id,e.created_at,e.source_reference,
   e.checkpoint,e.disposition from public.ywi_owner_first_use_entries_455 e
   where e.company_id=p_company_id and e.checkpoint='field_observation' and e.disposition='observed'
    and exists(select 1 from public.ywi_retest_assignments_459 a
     where a.company_id=p_company_id and (v_owner or a.reviewer_user_id=v_actor)
      and e.created_at>a.created_at)
   order by e.created_at desc,e.id desc limit 60) s;
 return jsonb_build_object('company_id',p_company_id,'captured_at',statement_timestamp(),
  'viewer_id',v_actor,'is_owner',v_owner,'is_assigned_reviewer',v_reviewer,
  'services',v_services,'followups',v_followups,'followup_total',v_followups_total,
  'followup_sample_capped',v_followups_total>60,'assignments',v_assignments,
  'assignment_total',v_assignments_total,'assignment_sample_capped',v_assignments_total>60,
  'comparisons',v_comparisons,'comparison_total',v_comparisons_total,
  'comparison_sample_capped',v_comparisons_total>60,
  'fresh_evidence',v_evidence,'fresh_evidence_total',v_evidence_total,
  'fresh_evidence_sample_capped',v_evidence_total>60,
  'independent_reapproval',false,'field_accepted',false,'service_authorized',false,
  'release_green',false,'outbound_actions',false,'synthetic',false,'mutation_authorized',false);
end $$;

create or replace function public.ywi_rpc_assign_retest_459(
 p_company_id uuid,p_request_id uuid,p_owner_followup_id uuid,p_reviewer_user_id uuid,
 p_source_reference text,p_notes text)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_owner uuid:=auth.uid();v_id uuid;v_old record;v_follow record;v_decision record;
 v_handoff record;v_ready record;v_role text;v_level text;v_reviewer_role text;v_reviewer_level text;
 v_enabled boolean;v_source_company uuid;v_source_service text;v_client uuid;v_site uuid;
 v_ref text:=btrim(coalesce(p_source_reference,''));v_notes text:=nullif(btrim(coalesce(p_notes,'')),'');
begin
 perform public.ywi_422_assert_owner(p_company_id);
 if p_request_id is null or p_owner_followup_id is null or p_reviewer_user_id is null
  or p_reviewer_user_id=v_owner or char_length(v_ref) not between 4 and 250
  or char_length(coalesce(v_notes,''))>500 then raise exception '459 invalid retest assignment';end if;
 select lower(role) into v_role from public.profiles where id=v_owner and is_active is true;
 select coalesce((select access_level from public.app_profile_module_permissions
  where profile_id=v_owner and module_key='jobs'),
  (select access_level from public.app_role_module_permissions where role=v_role and module_key='jobs')) into v_level;
 if v_level is null or v_level not in ('approve','manage') then raise exception '459 owner Jobs permission denied';end if;
 select lower(role) into v_reviewer_role from public.profiles
  where id=p_reviewer_user_id and is_active is true;
 select coalesce((select access_level from public.app_profile_module_permissions
  where profile_id=p_reviewer_user_id and module_key='jobs'),
  (select access_level from public.app_role_module_permissions
   where role=v_reviewer_role and module_key='jobs')) into v_reviewer_level;
 if v_reviewer_role is null or v_reviewer_level is null or v_reviewer_level not in ('approve','manage')
  then raise exception '459 separate active reviewer with Jobs approve/manage required';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_company_id::text,459));
 select * into v_follow from public.ywi_owner_independent_followups_458
  where id=p_owner_followup_id and company_id=p_company_id and disposition='retest_evidence_ready';
 if not found then raise exception '459 owner retest follow-up source missing';end if;
 select * into v_decision from public.ywi_first_service_decisions_457
  where id=v_follow.independent_decision_id and company_id=p_company_id
   and decision='returned_for_follow_up';
 if not found then raise exception '459 independent return source missing';end if;
 select * into v_handoff from public.ywi_first_service_handoffs_457
  where id=v_decision.handoff_id and company_id=p_company_id and owner_user_id=v_owner;
 if not found then raise exception '459 reviewer handoff lineage missing';end if;
 select * into v_ready from public.ywi_first_service_reviews_456
  where id=v_handoff.owner_review_id and company_id=p_company_id
   and review_outcome='ready_for_independent_review';
 if not found then raise exception '459 original readiness missing';end if;
 if not exists(select 1 from public.ywi_owner_first_use_entries_455 e
  where e.id=v_follow.followup_evidence_id and e.company_id=p_company_id
   and e.checkpoint='field_observation' and e.disposition='observed'
   and e.created_at>v_decision.created_at) then
  raise exception '459 post-return owner evidence missing';end if;
 select enabled into v_enabled from public.ywi_company_service_modules
  where company_id=p_company_id and module_key=v_ready.service_module_key for share;
 if v_enabled is distinct from true then raise exception '459 service OFF; assignment HOLD';end if;
 if not exists(select 1 from public.ywi_new_work_gate_receipts_421
  where company_id=p_company_id and service_module_key=v_ready.service_module_key
   and target_table=v_ready.target_table and target_id=v_ready.target_id) then
  raise exception '459 original Jobs source missing';end if;
 if v_ready.target_table='estimates' then
  select company_id,service_module_key,client_id,client_site_id into
   v_source_company,v_source_service,v_client,v_site from public.estimates where id=v_ready.target_id;
 else
  select company_id,service_module_key,client_id,client_site_id into
   v_source_company,v_source_service,v_client,v_site from public.work_orders where id=v_ready.target_id;
 end if;
 if not found or v_source_company is distinct from p_company_id
  or v_source_service is distinct from v_ready.service_module_key then
  raise exception '459 Jobs source ownership mismatch';end if;
 if not exists(select 1 from public.ywi_company_site_links_422 l
  join public.clients c on c.id=l.client_id and c.is_active is true
  join public.client_sites s on s.id=l.client_site_id and s.is_active is true
  where l.company_id=p_company_id and l.client_id=v_client and l.client_site_id=v_site) then
  raise exception '459 active canonical customer/property missing';end if;
 if (select count(*) from public.ywi_retest_assignments_459 where company_id=p_company_id)>=200 then
  raise exception '459 assignment journal capacity reached';end if;
 insert into public.ywi_retest_assignments_459(company_id,request_id,owner_followup_id,
  reviewer_user_id,owner_user_id,source_reference,notes)
 values(p_company_id,p_request_id,p_owner_followup_id,p_reviewer_user_id,v_owner,v_ref,v_notes)
 on conflict(company_id,request_id) do nothing returning id into v_id;
 if v_id is null then
  select * into v_old from public.ywi_retest_assignments_459
   where company_id=p_company_id and request_id=p_request_id;
  if not found or v_old.owner_followup_id is distinct from p_owner_followup_id
   or v_old.reviewer_user_id is distinct from p_reviewer_user_id
   or v_old.owner_user_id is distinct from v_owner or v_old.source_reference is distinct from v_ref
   or v_old.notes is distinct from v_notes then raise exception '459 assignment replay differs';end if;
  v_id:=v_old.id;
 end if;
 return jsonb_build_object('id',v_id,'company_id',p_company_id,'recorded',true,
  'field_accepted',false,'service_authorized',false,'independent_reapproval',false,'outbound_actions',false);
end $$;

create or replace function public.ywi_rpc_record_retest_comparison_459(
 p_company_id uuid,p_request_id uuid,p_assignment_id uuid,p_fresh_evidence_id uuid,
 p_outcome text,p_source_reference text,p_notes text)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();v_id uuid;v_old record;v_assignment record;
 v_follow record;v_decision record;v_ready record;v_role text;v_level text;v_enabled boolean;
 v_source_company uuid;v_source_service text;v_client uuid;v_site uuid;
 v_ref text:=btrim(coalesce(p_source_reference,''));v_notes text:=nullif(btrim(coalesce(p_notes,'')),'');
begin
 if v_actor is null or p_request_id is null or p_assignment_id is null or p_fresh_evidence_id is null
  or p_outcome not in ('comparison_matches','comparison_differs','insufficient_evidence')
  or char_length(v_ref) not between 4 and 250 or char_length(coalesce(v_notes,''))>500 then
  raise exception '459 invalid reviewer comparison';end if;
 select lower(role) into v_role from public.profiles where id=v_actor and is_active is true;
 select coalesce((select access_level from public.app_profile_module_permissions
  where profile_id=v_actor and module_key='jobs'),
  (select access_level from public.app_role_module_permissions where role=v_role and module_key='jobs')) into v_level;
 if v_role is null or v_level is null or v_level not in ('approve','manage') then
  raise exception '459 reviewer Jobs permission denied';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_company_id::text,459));
 select * into v_assignment from public.ywi_retest_assignments_459
  where id=p_assignment_id and company_id=p_company_id and reviewer_user_id=v_actor
   and owner_user_id<>v_actor;
 if not found then raise exception '459 assigned separate reviewer required';end if;
 select * into v_follow from public.ywi_owner_independent_followups_458
  where id=v_assignment.owner_followup_id and company_id=p_company_id
   and disposition='retest_evidence_ready';
 if not found then raise exception '459 original owner follow-up missing';end if;
 select * into v_decision from public.ywi_first_service_decisions_457
  where id=v_follow.independent_decision_id and company_id=p_company_id
   and decision='returned_for_follow_up';
 if not found then raise exception '459 original independent return missing';end if;
 select * into v_ready from public.ywi_first_service_reviews_456
  where id=(select owner_review_id from public.ywi_first_service_handoffs_457
   where id=v_decision.handoff_id and company_id=p_company_id)
   and company_id=p_company_id and review_outcome='ready_for_independent_review';
 if not found then raise exception '459 original readiness mismatch';end if;
 if p_fresh_evidence_id=v_follow.followup_evidence_id or not exists(
  select 1 from public.ywi_owner_first_use_entries_455 e
  where e.id=p_fresh_evidence_id and e.company_id=p_company_id
   and e.checkpoint='field_observation' and e.disposition='observed'
   and e.created_at>v_assignment.created_at and e.created_at>v_follow.created_at) then
  raise exception '459 fresh observed post-assignment evidence required';end if;
 select enabled into v_enabled from public.ywi_company_service_modules
  where company_id=p_company_id and module_key=v_ready.service_module_key for share;
 if v_enabled is distinct from true then raise exception '459 service OFF; comparison HOLD';end if;
 if not exists(select 1 from public.ywi_new_work_gate_receipts_421
  where company_id=p_company_id and service_module_key=v_ready.service_module_key
   and target_table=v_ready.target_table and target_id=v_ready.target_id) then
  raise exception '459 original Jobs receipt missing';end if;
 if v_ready.target_table='estimates' then
  select company_id,service_module_key,client_id,client_site_id into
   v_source_company,v_source_service,v_client,v_site from public.estimates where id=v_ready.target_id;
 else
  select company_id,service_module_key,client_id,client_site_id into
   v_source_company,v_source_service,v_client,v_site from public.work_orders where id=v_ready.target_id;
 end if;
 if not found or v_source_company is distinct from p_company_id
  or v_source_service is distinct from v_ready.service_module_key
  or not exists(select 1 from public.ywi_company_site_links_422 l
   join public.clients c on c.id=l.client_id and c.is_active is true
   join public.client_sites s on s.id=l.client_site_id and s.is_active is true
   where l.company_id=p_company_id and l.client_id=v_client and l.client_site_id=v_site) then
  raise exception '459 canonical source mismatch';end if;
 if (select count(*) from public.ywi_retest_comparisons_459 where company_id=p_company_id)>=200 then
  raise exception '459 comparison journal capacity reached';end if;
 insert into public.ywi_retest_comparisons_459(company_id,request_id,assignment_id,
  fresh_evidence_id,outcome,source_reference,notes,reviewer_user_id)
 values(p_company_id,p_request_id,p_assignment_id,p_fresh_evidence_id,p_outcome,v_ref,v_notes,v_actor)
 on conflict(company_id,request_id) do nothing returning id into v_id;
 if v_id is null then
  select * into v_old from public.ywi_retest_comparisons_459
   where company_id=p_company_id and request_id=p_request_id;
  if not found or v_old.assignment_id is distinct from p_assignment_id
   or v_old.fresh_evidence_id is distinct from p_fresh_evidence_id
   or v_old.outcome is distinct from p_outcome or v_old.source_reference is distinct from v_ref
   or v_old.notes is distinct from v_notes or v_old.reviewer_user_id is distinct from v_actor then
    raise exception '459 reviewer comparison replay differs';end if;
  v_id:=v_old.id;
 end if;
 return jsonb_build_object('id',v_id,'company_id',p_company_id,'recorded',true,
  'independent_reapproval',false,'field_accepted',false,'service_authorized',false,'outbound_actions',false);
end $$;

revoke all on function public.ywi_rpc_retest_inbox_459() from public,anon,authenticated;
revoke all on function public.ywi_rpc_independent_retest_459(uuid) from public,anon,authenticated;
revoke all on function public.ywi_rpc_assign_retest_459(uuid,uuid,uuid,uuid,text,text)
 from public,anon,authenticated;
revoke all on function public.ywi_rpc_record_retest_comparison_459(uuid,uuid,uuid,uuid,text,text,text)
 from public,anon,authenticated;
grant execute on function public.ywi_rpc_retest_inbox_459() to authenticated;
grant execute on function public.ywi_rpc_independent_retest_459(uuid) to authenticated;
grant execute on function public.ywi_rpc_assign_retest_459(uuid,uuid,uuid,uuid,text,text)
 to authenticated;
grant execute on function public.ywi_rpc_record_retest_comparison_459(uuid,uuid,uuid,uuid,text,text,text)
 to authenticated;
comment on table public.ywi_retest_comparisons_459 is
 'Independent assigned reviewer compares genuine new 455 observations; never approves service, Safety or field acceptance.';
commit;
