-- YW 475: independent 474 continuity finding aging and owner-only documentary
-- evidence response. No Jobs/Safety, field, dispatch, communication or gateway release.
begin;
create table if not exists public.ywi_continuity_owner_requests_475 (
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null references public.ywi_companies(id) on delete restrict,
 operation_id uuid not null,
 continuity_review_id uuid not null unique references public.ywi_clarification_continuity_reviews_474(id) on delete restrict,
 owner_user_id uuid not null references auth.users(id) on delete restrict,
 decision text not null check(decision in ('submit_renewed_documentary_source','request_independent_continuity_recheck','retain_followup_hold')),
 source_reference text not null check(char_length(btrim(source_reference)) between 4 and 250),
 notes text check(notes is null or char_length(notes)<=500),
 created_at timestamptz not null default now(),
 unique(company_id,operation_id)
);
create index if not exists ywi_475_company_created on public.ywi_continuity_owner_requests_475(company_id,created_at desc);
alter table public.ywi_continuity_owner_requests_475 enable row level security;
revoke all on public.ywi_continuity_owner_requests_475 from public,anon,authenticated;

create or replace function public.ywi_rpc_owner_continuity_request_475(
 p_company_id uuid,p_operation_id uuid,p_continuity_review_id uuid,p_decision text,p_source_reference text,p_notes text)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();v_role text;v_level text;v_base jsonb;v_src record;
 v_case jsonb;v_old record;v_id uuid;v_ref text:=btrim(coalesce(p_source_reference,''));
 v_notes text:=nullif(btrim(coalesce(p_notes,'')),'');
begin
 if v_actor is null or p_company_id is null or p_operation_id is null or p_continuity_review_id is null
  or p_decision is null or p_decision not in ('submit_renewed_documentary_source','request_independent_continuity_recheck','retain_followup_hold')
  or char_length(v_ref) not between 4 and 250 or char_length(coalesce(v_notes,''))>500
 then raise exception '475 invalid owner renewal request: HOLD';end if;
 perform public.ywi_422_assert_owner(p_company_id);
 select lower(role) into v_role from public.profiles where id=v_actor and is_active is true;
 select coalesce((select access_level from public.app_profile_module_permissions where profile_id=v_actor and module_key='jobs'),
  (select access_level from public.app_role_module_permissions where role=v_role and module_key='jobs')) into v_level;
 if v_role is null or v_level not in ('approve','manage')
 then raise exception '475 owner Jobs permission denied: HOLD';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_company_id::text,475));
 v_base:=public.ywi_rpc_continuity_workspace_474(p_company_id);
 if (v_base->>'viewer_id')::uuid is distinct from v_actor
  or (v_base->'handoff_source'->>'is_owner') is distinct from 'true'
 then raise exception '475 company owner source withheld: HOLD';end if;
 select t.id continuity_review_id,t.disposition,t.source_reference continuity_source,t.created_at continuity_at,
  t.reviewer_user_id continuity_reviewer,p.id clarification_id,p.owner_user_id,p.source_reference clarification_source,
  p.created_at clarification_at,q.source_reference recheck_source,q.reviewer_user_id recheck_reviewer,q.created_at recheck_at,
  r.source_reference owner_renewal_source,r.owner_user_id original_owner,r.decision original_decision,r.created_at renewal_at,
  k.source_reference confirmation_source,k.reviewer_user_id confirmation_reviewer,k.created_at confirmation_at,
  a.source_reference reassessment_source,a.owner_user_id reassessment_owner,
  n.source_reference renewal_source,n.reviewer_user_id renewal_reviewer,
  f.source_reference followup_source,o.source_reference outcome_source,c.compared_source_reference comparison_source,
  h.source_reference handoff_source,h.reviewer_user_id handoff_reviewer,h.proposal_id
 into v_src from public.ywi_clarification_continuity_reviews_474 t
 join public.ywi_recheck_owner_clarifications_473 p on p.id=t.owner_clarification_id and p.company_id=t.company_id
 join public.ywi_independent_recheck_reviews_472 q on q.id=p.assignment_review_id and q.company_id=p.company_id
 join public.ywi_continuity_owner_renewals_471 r on r.id=q.owner_renewal_id and r.company_id=q.company_id
 join public.ywi_continuity_confirmations_470 k on k.id=r.confirmation_id and k.company_id=r.company_id
 join public.ywi_renewal_reassessments_469 a on a.id=k.reassessment_id and a.company_id=k.company_id
 join public.ywi_followup_renewals_468 n on n.id=a.renewal_id and n.company_id=a.company_id
 join public.ywi_comparison_followups_467 f on f.id=n.followup_id and f.company_id=n.company_id
 join public.ywi_reassigned_outcomes_466 o on o.id=f.outcome_id and o.company_id=f.company_id
 join public.ywi_reassigned_comparisons_466 c on c.id=o.comparison_id and c.company_id=o.company_id
 join public.ywi_reassignment_handoffs_465 h on h.id=c.handoff_id and h.company_id=c.company_id
 where t.id=p_continuity_review_id and t.company_id=p_company_id;
 if not found or v_src.disposition is distinct from 'request_refreshed_owner_evidence'
  or v_src.owner_user_id is distinct from v_actor or v_src.original_owner is distinct from v_actor
  or v_src.reassessment_owner is distinct from v_actor or v_src.continuity_reviewer=v_actor
  or v_src.continuity_reviewer is distinct from v_src.recheck_reviewer
  or v_src.continuity_reviewer is distinct from v_src.confirmation_reviewer
  or v_src.continuity_reviewer is distinct from v_src.renewal_reviewer
  or v_src.continuity_reviewer is distinct from v_src.handoff_reviewer
  or v_src.original_decision is distinct from 'request_independent_recheck'
  or v_src.clarification_at<v_src.recheck_at or v_src.continuity_at<v_src.clarification_at
  or v_src.renewal_at<v_src.confirmation_at or v_src.continuity_at>pg_catalog.now()
  or v_ref in (v_src.continuity_source,v_src.clarification_source,v_src.recheck_source,
   v_src.owner_renewal_source,v_src.confirmation_source,v_src.reassessment_source,v_src.renewal_source,
   v_src.followup_source,v_src.outcome_source,v_src.comparison_source,v_src.handoff_source)
  or public.ywi_465_assert_proposal(p_company_id,v_src.proposal_id) is distinct from v_src.continuity_reviewer
  or not exists(select 1 from pg_catalog.jsonb_array_elements(v_base->'continuity_reviews') x
    where (x.value->>'id')::uuid=p_continuity_review_id)
 then raise exception '475 original continuity, owner and evidence chain required: HOLD';end if;
 select x.value into v_case from pg_catalog.jsonb_array_elements(v_base->'handoff_source'->'cases') x
 where (x.value->>'proposal_id')::uuid=v_src.proposal_id;
 if v_case is null or (v_case->>'service_enabled') is distinct from 'true'
  or (v_case->>'owner_user_id') is distinct from v_actor::text
  or (v_case->>'proposed_reviewer_user_id') is distinct from v_src.continuity_reviewer::text
 then raise exception '475 company service or reviewer changed: HOLD';end if;
 select * into v_old from public.ywi_continuity_owner_requests_475
 where company_id=p_company_id and (operation_id=p_operation_id or continuity_review_id=p_continuity_review_id) for update;
 if found then
  if v_old.operation_id is distinct from p_operation_id or v_old.continuity_review_id is distinct from p_continuity_review_id
   or v_old.owner_user_id is distinct from v_actor or v_old.decision is distinct from p_decision
   or v_old.source_reference is distinct from v_ref or v_old.notes is distinct from v_notes
  then raise exception '475 owner renewal replay differs: HOLD';end if;
  v_id:=v_old.id;
 else
  if (select count(*) from public.ywi_continuity_owner_requests_475 where company_id=p_company_id)>=60
  then raise exception '475 owner renewal capacity: HOLD';end if;
  insert into public.ywi_continuity_owner_requests_475(company_id,operation_id,continuity_review_id,owner_user_id,decision,source_reference,notes)
  values(p_company_id,p_operation_id,p_continuity_review_id,v_actor,p_decision,v_ref,v_notes) returning id into v_id;
 end if;
 return pg_catalog.jsonb_build_object('id',v_id,'company_id',p_company_id,'recorded',true,
  'field_accepted',false,'service_authorized',false,'independent_reapproval',false,
  'reassignment_executed',false,'release_green',false,'outbound_actions',false);
end $$;

create or replace function public.ywi_rpc_owner_renewal_workspace_475(p_company_id uuid)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();v_base jsonb;v_clock timestamptz;
 v_aging jsonb;v_requests jsonb;v_count integer;v_reviews integer;
begin
 v_base:=public.ywi_rpc_continuity_workspace_474(p_company_id);
 if v_actor is null or (v_base->>'viewer_id')::uuid is distinct from v_actor
 then raise exception '475 viewer mismatch: HOLD';end if;
 v_clock:=(v_base->>'captured_at')::timestamptz;
 if exists(select 1 from pg_catalog.jsonb_array_elements(v_base->'continuity_reviews') x
  where (x.value->>'created_at')::timestamptz>v_clock)
 then raise exception '475 future continuity finding timestamp: HOLD';end if;
 select count(*) into v_reviews from pg_catalog.jsonb_array_elements(v_base->'continuity_reviews');
 select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
  'continuity_review_id',x.value->>'id','owner_clarification_id',x.value->>'owner_clarification_id',
  'age_days',greatest(0,pg_catalog.floor(extract(epoch from (v_clock-(x.value->>'created_at')::timestamptz))/86400)::integer),
  'band',case when v_clock-(x.value->>'created_at')::timestamptz>=interval '15 days' then 'overdue'
       when v_clock-(x.value->>'created_at')::timestamptz>=interval '8 days' then 'aging' else 'current' end
 ) order by (x.value->>'created_at')::timestamptz desc),'[]'::jsonb)
 into v_aging from pg_catalog.jsonb_array_elements(v_base->'continuity_reviews') x;
 select count(*) into v_count from public.ywi_continuity_owner_requests_475 r
 where r.company_id=p_company_id and exists(select 1 from pg_catalog.jsonb_array_elements(v_base->'continuity_reviews') x
  where (x.value->>'id')::uuid=r.continuity_review_id);
 if v_count>60 then raise exception '475 owner request sample capped: HOLD';end if;
 select coalesce(pg_catalog.jsonb_agg(to_jsonb(x) order by x.created_at desc,x.id desc),'[]'::jsonb)
 into v_requests from (
  select r.id,r.company_id,r.continuity_review_id,r.owner_user_id,r.decision,r.source_reference,r.created_at
  from public.ywi_continuity_owner_requests_475 r where r.company_id=p_company_id
  and exists(select 1 from pg_catalog.jsonb_array_elements(v_base->'continuity_reviews') k
   where (k.value->>'id')::uuid=r.continuity_review_id)
  order by r.created_at desc,r.id desc limit 60) x;
 return v_base||pg_catalog.jsonb_build_object('owner_renewal_as_of',v_clock,
  'continuity_finding_aging',v_aging,'continuity_finding_age_total',v_reviews,
  'owner_renewal_requests',v_requests,'owner_renewal_request_total',v_count,'owner_renewal_request_sample_capped',false);
end $$;
revoke all on function public.ywi_rpc_owner_continuity_request_475(uuid,uuid,uuid,text,text,text) from public,anon,authenticated;
revoke all on function public.ywi_rpc_owner_renewal_workspace_475(uuid) from public,anon,authenticated;
grant execute on function public.ywi_rpc_owner_continuity_request_475(uuid,uuid,uuid,text,text,text) to authenticated;
grant execute on function public.ywi_rpc_owner_renewal_workspace_475(uuid) to authenticated;
comment on table public.ywi_continuity_owner_requests_475 is
 'Company owner documentary response to original independent 474 source renewal request; immutable, no operational approval or cross-application authority.';
commit;
