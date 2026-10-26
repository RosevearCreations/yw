-- YW 461: owner-only documentary follow-up of genuine independent 460 reassessments.
-- This records internal evidence requests; it never sends messages or changes operational gates.
begin;
create table if not exists public.ywi_reassessment_evidence_requests_461 (
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null references public.ywi_companies(id) on delete restrict,
 request_id uuid not null,
 reassessment_id uuid not null unique references public.ywi_retest_reassessments_460(id) on delete restrict,
 owner_user_id uuid not null references auth.users(id) on delete restrict,
 request_kind text not null check(request_kind in ('request_new_field_observation','request_source_clarification','keep_on_hold')),
 source_reference text not null check(char_length(btrim(source_reference)) between 4 and 250),
 notes text check(notes is null or char_length(notes)<=500),
 created_at timestamptz not null default now(),
 unique(company_id,request_id)
);
create index if not exists ywi_461_owner_created on public.ywi_reassessment_evidence_requests_461(company_id,created_at desc);
alter table public.ywi_reassessment_evidence_requests_461 enable row level security;
revoke all on public.ywi_reassessment_evidence_requests_461 from public,anon,authenticated;

create or replace function public.ywi_rpc_reassessment_owner_inbox_461()
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();v_total integer;v_rows jsonb;
begin
 if v_actor is null or not exists(select 1 from public.profiles where id=v_actor and is_active is true)
 then raise exception '461 active owner sign-in required';end if;
 select count(*) into v_total from public.ywi_companies where owner_user_id=v_actor;
 select coalesce(jsonb_agg(to_jsonb(q) order by q.name,q.id),'[]'::jsonb) into v_rows from (
  select id,name from public.ywi_companies where owner_user_id=v_actor order by name,id limit 60) q;
 return jsonb_build_object('captured_at',statement_timestamp(),'viewer_id',v_actor,
  'companies',v_rows,'total',v_total,'sample_capped',v_total>60,
  'field_accepted',false,'service_authorized',false,'release_green',false,'outbound_actions',false);
end $$;

create or replace function public.ywi_rpc_reassessment_followups_461(p_company_id uuid)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();v_role text;v_level text;v_services jsonb;v_cases jsonb;v_requests jsonb;
 v_total integer;v_request_total integer;v_case record;
begin
 perform public.ywi_422_assert_owner(p_company_id);
 select lower(role) into v_role from public.profiles where id=v_actor and is_active is true;
 select coalesce((select access_level from public.app_profile_module_permissions
  where profile_id=v_actor and module_key='jobs'),
  (select access_level from public.app_role_module_permissions where role=v_role and module_key='jobs')) into v_level;
 if v_role is null or v_level not in ('view','edit','approve','manage') then
  raise exception '461 owner Jobs viewing permission required';end if;
 select coalesce(jsonb_agg(to_jsonb(q) order by q.module_key),'[]'::jsonb) into v_services from (
  select company_id,module_key,enabled from public.ywi_company_service_modules
  where company_id=p_company_id order by module_key) q;
 select count(*) into v_total from public.ywi_retest_reassessments_460 where company_id=p_company_id;
 if v_total>60 then raise exception '461 reassessment source sample capped: HOLD';end if;
 for v_case in select t.comparison_id from public.ywi_retest_reassessments_460 r
  join public.ywi_retest_triages_460 t on t.id=r.triage_id and t.company_id=r.company_id
  where r.company_id=p_company_id loop
  perform public.ywi_460_assert_comparison_source(p_company_id,v_case.comparison_id);
 end loop;
 select coalesce(jsonb_agg(to_jsonb(q) order by q.reassessed_at desc,q.reassessment_id desc),'[]'::jsonb) into v_cases from (
  select r.id reassessment_id,r.company_id,r.triage_id,r.reassessor_user_id,
   r.outcome reassessment_outcome,r.source_reference reassessment_reference,r.created_at reassessed_at,
   t.comparison_id,t.owner_user_id,t.triage_kind,t.created_at triaged_at,
   c.outcome comparison_outcome,c.created_at compared_at,
   rev.service_module_key,rev.target_table,rev.target_id,
   greatest(0,floor(extract(epoch from (statement_timestamp()-r.created_at))/86400))::integer age_days
  from public.ywi_retest_reassessments_460 r
  join public.ywi_retest_triages_460 t on t.id=r.triage_id and t.company_id=r.company_id
  join public.ywi_retest_comparisons_459 c on c.id=t.comparison_id and c.company_id=r.company_id
  join public.ywi_retest_assignments_459 a on a.id=c.assignment_id and a.company_id=r.company_id
  join public.ywi_owner_independent_followups_458 f on f.id=a.owner_followup_id and f.company_id=r.company_id
  join public.ywi_first_service_decisions_457 d on d.id=f.independent_decision_id and d.company_id=r.company_id
  join public.ywi_first_service_handoffs_457 h on h.id=d.handoff_id and h.company_id=r.company_id
  join public.ywi_first_service_reviews_456 rev on rev.id=h.owner_review_id and rev.company_id=r.company_id
  where r.company_id=p_company_id order by r.created_at desc,r.id desc limit 60) q;
 select count(*) into v_request_total from public.ywi_reassessment_evidence_requests_461 where company_id=p_company_id;
 if v_request_total>60 then raise exception '461 evidence request sample capped: HOLD';end if;
 select coalesce(jsonb_agg(to_jsonb(q) order by q.created_at desc,q.id desc),'[]'::jsonb) into v_requests from (
  select id,company_id,reassessment_id,owner_user_id,request_kind,source_reference,notes,created_at
  from public.ywi_reassessment_evidence_requests_461 where company_id=p_company_id
  order by created_at desc,id desc limit 60) q;
 return jsonb_build_object('company_id',p_company_id,'viewer_id',v_actor,'is_owner',true,
  'captured_at',statement_timestamp(),'services',v_services,
  'reassessments',v_cases,'reassessment_total',v_total,'reassessment_sample_capped',false,
  'requests',v_requests,'request_total',v_request_total,'request_sample_capped',false,
  'aging_attention_days',7,'field_accepted',false,'service_authorized',false,
  'independent_reapproval',false,'release_green',false,'outbound_actions',false,
  'mutation_authorized',false,'synthetic',false);
end $$;

create or replace function public.ywi_rpc_request_reassessment_evidence_461(
 p_company_id uuid,p_request_id uuid,p_reassessment_id uuid,p_request_kind text,
 p_source_reference text,p_notes text)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();v_role text;v_level text;v_case record;v_id uuid;v_old record;
 v_ref text:=btrim(coalesce(p_source_reference,''));v_notes text:=nullif(btrim(coalesce(p_notes,'')),'');
begin
 perform public.ywi_422_assert_owner(p_company_id);
 if p_request_id is null or p_reassessment_id is null
  or p_request_kind not in ('request_new_field_observation','request_source_clarification','keep_on_hold')
  or char_length(v_ref) not between 4 and 250 or char_length(coalesce(v_notes,''))>500
 then raise exception '461 invalid owner evidence request';end if;
 select lower(role) into v_role from public.profiles where id=v_actor and is_active is true;
 select coalesce((select access_level from public.app_profile_module_permissions
  where profile_id=v_actor and module_key='jobs'),
  (select access_level from public.app_role_module_permissions where role=v_role and module_key='jobs')) into v_level;
 if v_role is null or v_level not in ('approve','manage') then raise exception '461 owner Jobs approval permission denied';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_company_id::text,461));
 select r.id,r.created_at,t.comparison_id,t.owner_user_id into v_case
  from public.ywi_retest_reassessments_460 r
  join public.ywi_retest_triages_460 t on t.id=r.triage_id and t.company_id=r.company_id
  where r.id=p_reassessment_id and r.company_id=p_company_id and t.owner_user_id=v_actor;
 if not found then raise exception '461 genuine independent reassessment required';end if;
 perform public.ywi_460_assert_comparison_source(p_company_id,v_case.comparison_id);
 if v_case.created_at>statement_timestamp() then raise exception '461 future reassessment denied';end if;
 if (select count(*) from public.ywi_reassessment_evidence_requests_461 where company_id=p_company_id)>=200 then
  raise exception '461 evidence journal capacity reached';end if;
 insert into public.ywi_reassessment_evidence_requests_461(company_id,request_id,reassessment_id,
  owner_user_id,request_kind,source_reference,notes)
 values(p_company_id,p_request_id,p_reassessment_id,v_actor,p_request_kind,v_ref,v_notes)
 on conflict(company_id,request_id) do nothing returning id into v_id;
 if v_id is null then
  select * into v_old from public.ywi_reassessment_evidence_requests_461
   where company_id=p_company_id and request_id=p_request_id;
  if not found or v_old.reassessment_id is distinct from p_reassessment_id
   or v_old.owner_user_id is distinct from v_actor or v_old.request_kind is distinct from p_request_kind
   or v_old.source_reference is distinct from v_ref or v_old.notes is distinct from v_notes
  then raise exception '461 request replay differs';end if;
  v_id:=v_old.id;
 end if;
 return jsonb_build_object('id',v_id,'company_id',p_company_id,'recorded',true,
  'field_accepted',false,'service_authorized',false,'independent_reapproval',false,
  'outbound_actions',false,'release_green',false);
end $$;

revoke all on function public.ywi_rpc_reassessment_owner_inbox_461() from public,anon,authenticated;
revoke all on function public.ywi_rpc_reassessment_followups_461(uuid) from public,anon,authenticated;
revoke all on function public.ywi_rpc_request_reassessment_evidence_461(uuid,uuid,uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.ywi_rpc_reassessment_owner_inbox_461() to authenticated;
grant execute on function public.ywi_rpc_reassessment_followups_461(uuid) to authenticated;
grant execute on function public.ywi_rpc_request_reassessment_evidence_461(uuid,uuid,uuid,text,text,text) to authenticated;
comment on table public.ywi_reassessment_evidence_requests_461 is 'Owner-only internal documentary follow-up. Never an outbound request, review closure, Safety clearance or field work authorization.';
commit;
