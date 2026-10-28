-- YW 473: immutable owner documentary clarification after a verified independent 472 request.
-- A review-age ledger does not approve real work, release a hold, or trigger a reviewer reassignment.
begin;
create table if not exists public.ywi_recheck_owner_clarifications_473 (
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null references public.ywi_companies(id) on delete restrict,
 operation_id uuid not null,
 assignment_review_id uuid not null unique references public.ywi_independent_recheck_reviews_472(id) on delete restrict,
 owner_user_id uuid not null references auth.users(id) on delete restrict,
 decision text not null check(decision in ('submit_clarification_evidence','ask_for_independent_recheck','retain_followup_hold')),
 source_reference text not null check(char_length(btrim(source_reference)) between 4 and 250),
 notes text check(notes is null or char_length(notes)<=500),
 created_at timestamptz not null default now(),
 unique(company_id,operation_id)
);
create index if not exists ywi_473_company_created on public.ywi_recheck_owner_clarifications_473(company_id,created_at desc);
alter table public.ywi_recheck_owner_clarifications_473 enable row level security;
revoke all on public.ywi_recheck_owner_clarifications_473 from public,anon,authenticated;

create or replace function public.ywi_rpc_owner_clarification_473(
 p_company_id uuid,p_operation_id uuid,p_assignment_review_id uuid,p_decision text,p_source_reference text,p_notes text)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();v_role text;v_level text;v_base jsonb;v_src record;
 v_case jsonb;v_old record;v_id uuid;v_ref text:=btrim(coalesce(p_source_reference,''));
 v_notes text:=nullif(btrim(coalesce(p_notes,'')),'');
begin
 if v_actor is null or p_company_id is null or p_operation_id is null or p_assignment_review_id is null
  or p_decision is null or p_decision not in ('submit_clarification_evidence','ask_for_independent_recheck','retain_followup_hold')
  or char_length(v_ref) not between 4 and 250 or char_length(coalesce(v_notes,''))>500
 then raise exception '473 invalid owner clarification: HOLD';end if;
 perform public.ywi_422_assert_owner(p_company_id);
 select lower(role) into v_role from public.profiles where id=v_actor and is_active is true;
 select coalesce((select access_level from public.app_profile_module_permissions where profile_id=v_actor and module_key='jobs'),
  (select access_level from public.app_role_module_permissions where role=v_role and module_key='jobs')) into v_level;
 if v_role is null or v_level not in ('approve','manage')
 then raise exception '473 owner Jobs permission denied: HOLD';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_company_id::text,473));
 v_base:=public.ywi_rpc_recheck_workspace_472(p_company_id);
 if (v_base->>'viewer_id')::uuid is distinct from v_actor
  or (v_base->'handoff_source'->>'is_owner') is distinct from 'true'
 then raise exception '473 owner source withheld: HOLD';end if;
 select q.id review_id,q.company_id,q.disposition,q.source_reference reviewer_source,q.reviewer_user_id,
  q.created_at reviewer_at,r.id owner_renewal_id,r.owner_user_id,r.decision owner_request,
  r.source_reference owner_source,r.created_at owner_renewal_at,
  k.id confirmation_id,k.created_at continuity_at,k.source_reference continuity_source,k.reviewer_user_id continuity_reviewer,
  a.source_reference reassessment_source,n.source_reference renewal_source,n.reviewer_user_id renewal_reviewer,
  f.source_reference followup_source,o.source_reference outcome_source,c.compared_source_reference comparison_source,
  h.source_reference handoff_source,h.reviewer_user_id handoff_reviewer,h.proposal_id
 into v_src from public.ywi_independent_recheck_reviews_472 q
 join public.ywi_continuity_owner_renewals_471 r on r.id=q.owner_renewal_id and r.company_id=q.company_id
 join public.ywi_continuity_confirmations_470 k on k.id=r.confirmation_id and k.company_id=r.company_id
 join public.ywi_renewal_reassessments_469 a on a.id=k.reassessment_id and a.company_id=k.company_id
 join public.ywi_followup_renewals_468 n on n.id=a.renewal_id and n.company_id=a.company_id
 join public.ywi_comparison_followups_467 f on f.id=n.followup_id and f.company_id=n.company_id
 join public.ywi_reassigned_outcomes_466 o on o.id=f.outcome_id and o.company_id=f.company_id
 join public.ywi_reassigned_comparisons_466 c on c.id=o.comparison_id and c.company_id=o.company_id
 join public.ywi_reassignment_handoffs_465 h on h.id=c.handoff_id and h.company_id=c.company_id
 where q.id=p_assignment_review_id and q.company_id=p_company_id;
 if not found or v_src.disposition is distinct from 'request_owner_source_clarification'
  or v_src.owner_request is distinct from 'request_independent_recheck'
  or v_src.owner_user_id is distinct from v_actor or v_src.reviewer_user_id=v_actor
  or v_src.reviewer_user_id is distinct from v_src.continuity_reviewer
  or v_src.reviewer_user_id is distinct from v_src.renewal_reviewer
  or v_src.reviewer_user_id is distinct from v_src.handoff_reviewer
  or v_src.reviewer_at<v_src.owner_renewal_at or v_src.owner_renewal_at<v_src.continuity_at
  or v_ref in (v_src.reviewer_source,v_src.owner_source,v_src.continuity_source,
   v_src.reassessment_source,v_src.renewal_source,v_src.followup_source,
   v_src.outcome_source,v_src.comparison_source,v_src.handoff_source)
  or public.ywi_465_assert_proposal(p_company_id,v_src.proposal_id) is distinct from v_src.reviewer_user_id
  or not exists(select 1 from pg_catalog.jsonb_array_elements(v_base->'assignment_reviews') q
   where (q.value->>'id')::uuid=p_assignment_review_id)
  or not exists(select 1 from pg_catalog.jsonb_array_elements(v_base->'owner_renewals') q
   where (q.value->>'id')::uuid=v_src.owner_renewal_id)
 then raise exception '473 genuine independent reviewer clarification request required: HOLD';end if;
 select q.value into v_case from pg_catalog.jsonb_array_elements(v_base->'handoff_source'->'cases') q
 where (q.value->>'proposal_id')::uuid=v_src.proposal_id;
 if v_case is null or (v_case->>'service_enabled') is distinct from 'true'
  or (v_case->>'owner_user_id') is distinct from v_actor::text
  or (v_case->>'proposed_reviewer_user_id') is distinct from v_src.reviewer_user_id::text
 then raise exception '473 source owner/reviewer/service changed: HOLD';end if;
 select * into v_old from public.ywi_recheck_owner_clarifications_473
 where company_id=p_company_id and (operation_id=p_operation_id or assignment_review_id=p_assignment_review_id) for update;
 if found then
  if v_old.operation_id is distinct from p_operation_id
   or v_old.assignment_review_id is distinct from p_assignment_review_id
   or v_old.owner_user_id is distinct from v_actor or v_old.decision is distinct from p_decision
   or v_old.source_reference is distinct from v_ref or v_old.notes is distinct from v_notes
  then raise exception '473 owner clarification replay differs: HOLD';end if;
  v_id:=v_old.id;
 else
  if (select count(*) from public.ywi_recheck_owner_clarifications_473 where company_id=p_company_id)>=60
  then raise exception '473 owner clarification capacity: HOLD';end if;
  insert into public.ywi_recheck_owner_clarifications_473(company_id,operation_id,assignment_review_id,owner_user_id,decision,source_reference,notes)
  values(p_company_id,p_operation_id,p_assignment_review_id,v_actor,p_decision,v_ref,v_notes) returning id into v_id;
 end if;
 return pg_catalog.jsonb_build_object('id',v_id,'company_id',p_company_id,'recorded',true,
  'field_accepted',false,'service_authorized',false,'independent_reapproval',false,
  'reassignment_executed',false,'release_green',false,'outbound_actions',false);
end $$;

create or replace function public.ywi_rpc_clarification_workspace_473(p_company_id uuid)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();v_base jsonb;v_clock timestamptz;
 v_aging jsonb;v_owner jsonb;v_count integer;v_reviews integer;
begin
 v_base:=public.ywi_rpc_recheck_workspace_472(p_company_id);
 if v_actor is null or (v_base->>'viewer_id')::uuid is distinct from v_actor
 then raise exception '473 actor mismatch: HOLD';end if;
 v_clock:=(v_base->>'captured_at')::timestamptz;
 if exists(select 1 from pg_catalog.jsonb_array_elements(v_base->'assignment_reviews') q
  where (q.value->>'created_at')::timestamptz>v_clock)
 then raise exception '473 future independent review timestamp: HOLD';end if;
 select count(*) into v_reviews from pg_catalog.jsonb_array_elements(v_base->'assignment_reviews');
 select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
  'assignment_review_id',q.value->>'id','owner_renewal_id',q.value->>'owner_renewal_id',
  'age_days',greatest(0,pg_catalog.floor(extract(epoch from (v_clock-(q.value->>'created_at')::timestamptz))/86400)::integer),
  'band',case when v_clock-(q.value->>'created_at')::timestamptz>=interval '15 days' then 'overdue'
       when v_clock-(q.value->>'created_at')::timestamptz>=interval '8 days' then 'aging' else 'current' end
 ) order by (q.value->>'created_at')::timestamptz desc),'[]'::jsonb)
 into v_aging from pg_catalog.jsonb_array_elements(v_base->'assignment_reviews') q;
 select count(*) into v_count from public.ywi_recheck_owner_clarifications_473 r
 where r.company_id=p_company_id and exists(select 1 from pg_catalog.jsonb_array_elements(v_base->'assignment_reviews') q
  where (q.value->>'id')::uuid=r.assignment_review_id
   and q.value->>'disposition'='request_owner_source_clarification');
 if v_count>60 then raise exception '473 owner clarification sample capped: HOLD';end if;
 select coalesce(pg_catalog.jsonb_agg(to_jsonb(q) order by q.created_at desc,q.id desc),'[]'::jsonb)
 into v_owner from (
  select r.id,r.company_id,r.assignment_review_id,r.owner_user_id,r.decision,r.source_reference,r.created_at
  from public.ywi_recheck_owner_clarifications_473 r
  where r.company_id=p_company_id and exists(select 1 from pg_catalog.jsonb_array_elements(v_base->'assignment_reviews') k
   where (k.value->>'id')::uuid=r.assignment_review_id
    and k.value->>'disposition'='request_owner_source_clarification')
  order by r.created_at desc,r.id desc limit 60) q;
 return v_base||pg_catalog.jsonb_build_object('outcome_as_of',v_clock,
  'outcome_aging',v_aging,'review_outcome_total',v_reviews,
  'owner_clarifications',v_owner,'clarification_total',v_count,'clarification_sample_capped',false);
end $$;
revoke all on function public.ywi_rpc_owner_clarification_473(uuid,uuid,uuid,text,text,text) from public,anon,authenticated;
revoke all on function public.ywi_rpc_clarification_workspace_473(uuid) from public,anon,authenticated;
grant execute on function public.ywi_rpc_owner_clarification_473(uuid,uuid,uuid,text,text,text) to authenticated;
grant execute on function public.ywi_rpc_clarification_workspace_473(uuid) to authenticated;
comment on table public.ywi_recheck_owner_clarifications_473 is
 'Private owner documentary clarification per distinct 472 reviewer request; does not approve work, reassign staff, or emit communications.';
commit;
