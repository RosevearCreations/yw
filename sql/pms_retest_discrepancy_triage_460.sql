-- YW 460: immutable discrepancy triage and separate independent reassessment.
-- No pathway here closes the original 457 decision or authorizes real work.
begin;
create table if not exists public.ywi_retest_triages_460 (
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null references public.ywi_companies(id) on delete restrict,
 request_id uuid not null,
 comparison_id uuid not null unique references public.ywi_retest_comparisons_459(id) on delete restrict,
 owner_user_id uuid not null references auth.users(id) on delete restrict,
 reassessor_user_id uuid not null references auth.users(id) on delete restrict,
 triage_kind text not null check(triage_kind in ('investigate_difference','request_fresh_evidence','keep_on_hold')),
 source_reference text not null check(char_length(btrim(source_reference)) between 4 and 250),
 notes text check(notes is null or char_length(notes)<=500),
 created_at timestamptz not null default now(),
 unique(company_id,request_id),
 check(owner_user_id<>reassessor_user_id)
);
create index if not exists ywi_460_triage_reassessor on public.ywi_retest_triages_460(reassessor_user_id,created_at desc);
alter table public.ywi_retest_triages_460 enable row level security;
revoke all on public.ywi_retest_triages_460 from public,anon,authenticated;

create table if not exists public.ywi_retest_reassessments_460 (
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null references public.ywi_companies(id) on delete restrict,
 request_id uuid not null,
 triage_id uuid not null unique references public.ywi_retest_triages_460(id) on delete restrict,
 reassessor_user_id uuid not null references auth.users(id) on delete restrict,
 outcome text not null check(outcome in ('difference_confirmed','evidence_gap_confirmed','further_review_required')),
 source_reference text not null check(char_length(btrim(source_reference)) between 4 and 250),
 notes text check(notes is null or char_length(notes)<=500),
 created_at timestamptz not null default now(),
 unique(company_id,request_id)
);
alter table public.ywi_retest_reassessments_460 enable row level security;
revoke all on public.ywi_retest_reassessments_460 from public,anon,authenticated;

-- Only functions with DB ownership may call this internal source validator.
create or replace function public.ywi_460_assert_comparison_source(p_company_id uuid,p_comparison_id uuid)
returns text language plpgsql volatile security definer set search_path='' as $$
declare v record;v_job_company uuid;v_job_module text;v_client uuid;v_site uuid;v_enabled boolean;
begin
 select c.company_id,c.outcome,c.created_at comparison_at,c.reviewer_user_id comparison_reviewer,
  c.fresh_evidence_id,
  a.reviewer_user_id assigned_reviewer,a.owner_user_id,a.created_at assignment_at,
  f.created_at followup_at,f.followup_evidence_id,f.disposition followup_disposition,
  dec.decision,dec.created_at decision_at,h.owner_user_id handoff_owner,
  rev.review_outcome,rev.service_module_key,rev.target_table,rev.target_id,
  e.created_at fresh_at,e.checkpoint,e.disposition
 into v from public.ywi_retest_comparisons_459 c
 join public.ywi_retest_assignments_459 a on a.id=c.assignment_id and a.company_id=c.company_id
 join public.ywi_owner_independent_followups_458 f on f.id=a.owner_followup_id and f.company_id=c.company_id
 join public.ywi_first_service_decisions_457 dec on dec.id=f.independent_decision_id and dec.company_id=c.company_id
 join public.ywi_first_service_handoffs_457 h on h.id=dec.handoff_id and h.company_id=c.company_id
 join public.ywi_first_service_reviews_456 rev on rev.id=h.owner_review_id and rev.company_id=c.company_id
 join public.ywi_owner_first_use_entries_455 e on e.id=c.fresh_evidence_id and e.company_id=c.company_id
 where c.id=p_comparison_id and c.company_id=p_company_id
  and c.outcome in ('comparison_differs','insufficient_evidence');
 if not found or v.decision<>'returned_for_follow_up' or v.followup_disposition<>'retest_evidence_ready'
  or v.review_outcome<>'ready_for_independent_review'
  or v.comparison_reviewer is distinct from v.assigned_reviewer
  or v.owner_user_id is distinct from (select owner_user_id from public.ywi_companies where id=p_company_id)
  or v.owner_user_id is distinct from v.handoff_owner
  or v.owner_user_id=v.assigned_reviewer
  or v.followup_at<=v.decision_at or v.assignment_at<=v.followup_at
  or v.fresh_evidence_id=v.followup_evidence_id
  or v.fresh_at<=v.assignment_at or v.comparison_at<v.fresh_at
  or v.checkpoint<>'field_observation' or v.disposition<>'observed'
  or not exists(select 1 from public.ywi_owner_first_use_entries_455 original
   where original.id=v.followup_evidence_id and original.company_id=p_company_id
    and original.checkpoint='field_observation' and original.disposition='observed'
    and original.created_at>v.decision_at)
 then raise exception '460 source comparison lineage invalid';end if;
 select enabled into v_enabled from public.ywi_company_service_modules
  where company_id=p_company_id and module_key=v.service_module_key for share;
 if v_enabled is distinct from true then raise exception '460 service OFF: keep HOLD';end if;
 if not exists(select 1 from public.ywi_new_work_gate_receipts_421
  where company_id=p_company_id and service_module_key=v.service_module_key
   and target_table=v.target_table and target_id=v.target_id) then
  raise exception '460 original Jobs receipt absent';end if;
 if v.target_table='estimates' then
  select company_id,service_module_key,client_id,client_site_id into
   v_job_company,v_job_module,v_client,v_site from public.estimates where id=v.target_id;
 elsif v.target_table='work_orders' then
  select company_id,service_module_key,client_id,client_site_id into
   v_job_company,v_job_module,v_client,v_site from public.work_orders where id=v.target_id;
 else raise exception '460 invalid original Jobs target';end if;
 if not found or v_job_company is distinct from p_company_id
  or v_job_module is distinct from v.service_module_key
  or not exists(select 1 from public.ywi_company_site_links_422 l
   join public.clients cl on cl.id=l.client_id and cl.is_active is true
   join public.client_sites s on s.id=l.client_site_id and s.is_active is true
   where l.company_id=p_company_id and l.client_id=v_client and l.client_site_id=v_site) then
  raise exception '460 canonical company-property source invalid';end if;
 return v.service_module_key;
end $$;
revoke all on function public.ywi_460_assert_comparison_source(uuid,uuid) from public,anon,authenticated;

create or replace function public.ywi_rpc_discrepancy_inbox_460()
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();v_total integer;v_rows jsonb;
begin
 if v_actor is null or not exists(select 1 from public.profiles
  where id=v_actor and is_active is true) then raise exception '460 active sign-in required';end if;
 select count(*) into v_total from public.ywi_companies c where c.owner_user_id=v_actor
  or exists(select 1 from public.ywi_retest_triages_460 t where t.company_id=c.id and t.reassessor_user_id=v_actor);
 select coalesce(jsonb_agg(to_jsonb(q) order by q.name,q.id),'[]'::jsonb) into v_rows from (
  select c.id,c.name,(c.owner_user_id=v_actor) is_owner,
   exists(select 1 from public.ywi_retest_triages_460 t
    where t.company_id=c.id and t.reassessor_user_id=v_actor) is_reassessor
  from public.ywi_companies c where c.owner_user_id=v_actor
   or exists(select 1 from public.ywi_retest_triages_460 t
    where t.company_id=c.id and t.reassessor_user_id=v_actor)
  order by c.name,c.id limit 60) q;
 return jsonb_build_object('captured_at',statement_timestamp(),'companies',v_rows,'total',v_total,
  'sample_capped',v_total>60,'field_accepted',false,'service_authorized',false,'release_green',false);
end $$;

create or replace function public.ywi_rpc_discrepancy_queue_460(p_company_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();v_owner boolean;v_assigned boolean;v_role text;v_level text;
 v_services jsonb;v_cases jsonb;v_triages jsonb;v_reviews jsonb;
 v_case_total integer;v_triage_total integer;v_review_total integer;
begin
 select lower(role) into v_role from public.profiles where id=v_actor and is_active is true;
 select coalesce((select access_level from public.app_profile_module_permissions
  where profile_id=v_actor and module_key='jobs'),
  (select access_level from public.app_role_module_permissions where role=v_role and module_key='jobs')) into v_level;
 if v_actor is null or v_role is null or v_level is null or v_level not in ('view','edit','approve','manage')
  then raise exception '460 active Jobs access required';end if;
 select exists(select 1 from public.ywi_companies where id=p_company_id and owner_user_id=v_actor) into v_owner;
 select exists(select 1 from public.ywi_retest_triages_460
  where company_id=p_company_id and reassessor_user_id=v_actor) into v_assigned;
 if not v_owner and not v_assigned then raise exception '460 foreign company access denied';end if;
 select coalesce(jsonb_agg(to_jsonb(s) order by s.module_key),'[]'::jsonb) into v_services
 from (select company_id,module_key,enabled from public.ywi_company_service_modules
  where company_id=p_company_id order by module_key) s;
 select count(*) into v_case_total from public.ywi_retest_comparisons_459 c
  where c.company_id=p_company_id and c.outcome in ('comparison_differs','insufficient_evidence')
   and (v_owner or exists(select 1 from public.ywi_retest_triages_460 t
    where t.company_id=p_company_id and t.comparison_id=c.id and t.reassessor_user_id=v_actor));
 select coalesce(jsonb_agg(to_jsonb(q) order by q.comparison_at desc,q.comparison_id desc),'[]'::jsonb) into v_cases from (
  select c.id comparison_id,c.company_id,c.assignment_id,c.outcome comparison_outcome,
   c.created_at comparison_at,c.source_reference comparison_reference,
   a.reviewer_user_id comparing_reviewer_id,a.owner_user_id,a.created_at assignment_at,
   f.id followup_id,f.independent_decision_id original_decision_id,
   f.followup_evidence_id original_evidence_id,f.disposition followup_disposition,
   d.decision original_decision,r.review_outcome,
   r.service_module_key,r.target_table,r.target_id,e.id fresh_evidence_id,e.created_at fresh_at,
   e.checkpoint fresh_checkpoint,e.disposition fresh_disposition
  from public.ywi_retest_comparisons_459 c
  join public.ywi_retest_assignments_459 a on a.id=c.assignment_id and a.company_id=c.company_id
  join public.ywi_owner_independent_followups_458 f on f.id=a.owner_followup_id and f.company_id=c.company_id
  join public.ywi_first_service_decisions_457 d on d.id=f.independent_decision_id and d.company_id=c.company_id
  join public.ywi_first_service_handoffs_457 h on h.id=d.handoff_id and h.company_id=c.company_id
  join public.ywi_first_service_reviews_456 r on r.id=h.owner_review_id and r.company_id=c.company_id
  join public.ywi_owner_first_use_entries_455 e on e.id=c.fresh_evidence_id and e.company_id=c.company_id
  where c.company_id=p_company_id and c.outcome in ('comparison_differs','insufficient_evidence')
   and (v_owner or exists(select 1 from public.ywi_retest_triages_460 t
    where t.company_id=p_company_id and t.comparison_id=c.id and t.reassessor_user_id=v_actor))
  order by c.created_at desc,c.id desc limit 60) q;
 select count(*) into v_triage_total from public.ywi_retest_triages_460
  where company_id=p_company_id and (v_owner or reassessor_user_id=v_actor);
 select coalesce(jsonb_agg(to_jsonb(q) order by q.created_at desc,q.id desc),'[]'::jsonb) into v_triages from (
  select id,company_id,comparison_id,reassessor_user_id,triage_kind,source_reference,notes,created_at
  from public.ywi_retest_triages_460 where company_id=p_company_id
   and (v_owner or reassessor_user_id=v_actor)
  order by created_at desc,id desc limit 60) q;
 select count(*) into v_review_total from public.ywi_retest_reassessments_460 r
  join public.ywi_retest_triages_460 t on t.id=r.triage_id and t.company_id=r.company_id
  where r.company_id=p_company_id and (v_owner or t.reassessor_user_id=v_actor);
 select coalesce(jsonb_agg(to_jsonb(q) order by q.created_at desc,q.id desc),'[]'::jsonb) into v_reviews from (
  select r.id,r.company_id,r.triage_id,r.outcome,r.source_reference,r.notes,r.created_at
  from public.ywi_retest_reassessments_460 r
  join public.ywi_retest_triages_460 t on t.id=r.triage_id and t.company_id=r.company_id
  where r.company_id=p_company_id and (v_owner or t.reassessor_user_id=v_actor)
  order by r.created_at desc,r.id desc limit 60) q;
 return jsonb_build_object('company_id',p_company_id,'captured_at',statement_timestamp(),
  'viewer_id',v_actor,'is_owner',v_owner,'is_reassessor',v_assigned,
  'services',v_services,'cases',v_cases,'case_total',v_case_total,'case_sample_capped',v_case_total>60,
  'triages',v_triages,'triage_total',v_triage_total,'triage_sample_capped',v_triage_total>60,
  'reassessments',v_reviews,'reassessment_total',v_review_total,'reassessment_sample_capped',v_review_total>60,
  'independent_reapproval',false,'field_accepted',false,'service_authorized',false,
  'release_green',false,'outbound_actions',false,'synthetic',false,'mutation_authorized',false);
end $$;

create or replace function public.ywi_rpc_triage_retest_discrepancy_460(
 p_company_id uuid,p_request_id uuid,p_comparison_id uuid,p_reassessor_user_id uuid,
 p_triage_kind text,p_source_reference text,p_notes text)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_owner uuid:=auth.uid();v_role text;v_level text;v_other_role text;v_other_level text;
 v_comparer uuid;v_id uuid;v_old record;v_ref text:=btrim(coalesce(p_source_reference,''));
 v_notes text:=nullif(btrim(coalesce(p_notes,'')),'');
begin
 perform public.ywi_422_assert_owner(p_company_id);
 if p_request_id is null or p_comparison_id is null or p_reassessor_user_id is null
  or p_triage_kind not in ('investigate_difference','request_fresh_evidence','keep_on_hold')
  or char_length(v_ref) not between 4 and 250 or char_length(coalesce(v_notes,''))>500 then
  raise exception '460 invalid owner triage input';end if;
 select lower(role) into v_role from public.profiles where id=v_owner and is_active is true;
 select coalesce((select access_level from public.app_profile_module_permissions
  where profile_id=v_owner and module_key='jobs'),
  (select access_level from public.app_role_module_permissions where role=v_role and module_key='jobs')) into v_level;
 if v_role is null or v_level is null or v_level not in ('approve','manage') then raise exception '460 owner Jobs permission denied';end if;
 select lower(role) into v_other_role from public.profiles
  where id=p_reassessor_user_id and is_active is true;
 select coalesce((select access_level from public.app_profile_module_permissions
  where profile_id=p_reassessor_user_id and module_key='jobs'),
  (select access_level from public.app_role_module_permissions
   where role=v_other_role and module_key='jobs')) into v_other_level;
 if v_other_role is null or v_other_level is null or v_other_level not in ('approve','manage') then
  raise exception '460 independent active reassessor Jobs approve/manage required';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_company_id::text,460));
 perform public.ywi_460_assert_comparison_source(p_company_id,p_comparison_id);
 select a.reviewer_user_id into v_comparer from public.ywi_retest_comparisons_459 c
  join public.ywi_retest_assignments_459 a on a.id=c.assignment_id and a.company_id=c.company_id
  where c.id=p_comparison_id and c.company_id=p_company_id;
 if p_reassessor_user_id in (v_owner,v_comparer) then
  raise exception '460 reassessor must differ from owner and initial comparing reviewer';end if;
 if (select count(*) from public.ywi_retest_triages_460 where company_id=p_company_id)>=200 then
  raise exception '460 triage journal capacity reached';end if;
 insert into public.ywi_retest_triages_460(company_id,request_id,comparison_id,
  owner_user_id,reassessor_user_id,triage_kind,source_reference,notes)
 values(p_company_id,p_request_id,p_comparison_id,v_owner,p_reassessor_user_id,p_triage_kind,v_ref,v_notes)
 on conflict(company_id,request_id) do nothing returning id into v_id;
 if v_id is null then
  select * into v_old from public.ywi_retest_triages_460
   where company_id=p_company_id and request_id=p_request_id;
  if not found or v_old.comparison_id is distinct from p_comparison_id
   or v_old.owner_user_id is distinct from v_owner
   or v_old.reassessor_user_id is distinct from p_reassessor_user_id
   or v_old.triage_kind is distinct from p_triage_kind
   or v_old.source_reference is distinct from v_ref or v_old.notes is distinct from v_notes then
   raise exception '460 triage replay differs';end if;
  v_id:=v_old.id;
 end if;
 return jsonb_build_object('id',v_id,'company_id',p_company_id,'recorded',true,
  'independent_reapproval',false,'field_accepted',false,'service_authorized',false,'outbound_actions',false);
end $$;

create or replace function public.ywi_rpc_reassess_retest_discrepancy_460(
 p_company_id uuid,p_request_id uuid,p_triage_id uuid,p_outcome text,
 p_source_reference text,p_notes text)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();v_role text;v_level text;v_triage record;v_comparison_outcome text;
 v_id uuid;v_old record;v_ref text:=btrim(coalesce(p_source_reference,''));
 v_notes text:=nullif(btrim(coalesce(p_notes,'')),'');
begin
 if v_actor is null or p_request_id is null or p_triage_id is null
  or p_outcome not in ('difference_confirmed','evidence_gap_confirmed','further_review_required')
  or char_length(v_ref) not between 4 and 250 or char_length(coalesce(v_notes,''))>500 then
  raise exception '460 invalid independent reassessment input';end if;
 select lower(role) into v_role from public.profiles where id=v_actor and is_active is true;
 select coalesce((select access_level from public.app_profile_module_permissions
  where profile_id=v_actor and module_key='jobs'),
  (select access_level from public.app_role_module_permissions where role=v_role and module_key='jobs')) into v_level;
 if v_role is null or v_level is null or v_level not in ('approve','manage') then
  raise exception '460 reviewer Jobs permission denied';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_company_id::text,460));
 select * into v_triage from public.ywi_retest_triages_460
  where id=p_triage_id and company_id=p_company_id and reassessor_user_id=v_actor
   and owner_user_id<>v_actor;
 if not found then raise exception '460 assigned independent reassessor required';end if;
 perform public.ywi_460_assert_comparison_source(p_company_id,v_triage.comparison_id);
 select outcome into v_comparison_outcome from public.ywi_retest_comparisons_459
  where id=v_triage.comparison_id and company_id=p_company_id;
 if (p_outcome='difference_confirmed' and v_comparison_outcome<>'comparison_differs')
  or (p_outcome='evidence_gap_confirmed' and v_comparison_outcome<>'insufficient_evidence') then
  raise exception '460 outcome does not match original discrepancy';end if;
 if (select count(*) from public.ywi_retest_reassessments_460 where company_id=p_company_id)>=200 then
  raise exception '460 reassessment journal capacity reached';end if;
 insert into public.ywi_retest_reassessments_460(company_id,request_id,triage_id,
  reassessor_user_id,outcome,source_reference,notes)
 values(p_company_id,p_request_id,p_triage_id,v_actor,p_outcome,v_ref,v_notes)
 on conflict(company_id,request_id) do nothing returning id into v_id;
 if v_id is null then
  select * into v_old from public.ywi_retest_reassessments_460
   where company_id=p_company_id and request_id=p_request_id;
  if not found or v_old.triage_id is distinct from p_triage_id
   or v_old.reassessor_user_id is distinct from v_actor or v_old.outcome is distinct from p_outcome
   or v_old.source_reference is distinct from v_ref or v_old.notes is distinct from v_notes then
   raise exception '460 reassessment replay differs';end if;
  v_id:=v_old.id;
 end if;
 return jsonb_build_object('id',v_id,'company_id',p_company_id,'recorded',true,
  'independent_reapproval',false,'field_accepted',false,'service_authorized',false,'outbound_actions',false);
end $$;

revoke all on function public.ywi_rpc_discrepancy_inbox_460() from public,anon,authenticated;
revoke all on function public.ywi_rpc_discrepancy_queue_460(uuid) from public,anon,authenticated;
revoke all on function public.ywi_rpc_triage_retest_discrepancy_460(uuid,uuid,uuid,uuid,text,text,text)
 from public,anon,authenticated;
revoke all on function public.ywi_rpc_reassess_retest_discrepancy_460(uuid,uuid,uuid,text,text,text)
 from public,anon,authenticated;
grant execute on function public.ywi_rpc_discrepancy_inbox_460() to authenticated;
grant execute on function public.ywi_rpc_discrepancy_queue_460(uuid) to authenticated;
grant execute on function public.ywi_rpc_triage_retest_discrepancy_460(uuid,uuid,uuid,uuid,text,text,text) to authenticated;
grant execute on function public.ywi_rpc_reassess_retest_discrepancy_460(uuid,uuid,uuid,text,text,text) to authenticated;
comment on table public.ywi_retest_reassessments_460 is 'Independent documentary reassessment only: original 457 hold and all operational/Safety/business gates remain unchanged.';
commit;
