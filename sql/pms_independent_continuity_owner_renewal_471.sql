-- YW 471: immutable owner source renewal only for a real independent 470 exception.
-- No field acceptance, Jobs/Safety approval, external transfer or automatic notification.
begin;
create table if not exists public.ywi_continuity_owner_renewals_471 (
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null references public.ywi_companies(id) on delete restrict,
 operation_id uuid not null,
 confirmation_id uuid not null unique references public.ywi_continuity_confirmations_470(id) on delete restrict,
 owner_user_id uuid not null references auth.users(id) on delete restrict,
 decision text not null check (decision in ('record_new_owner_evidence','request_independent_recheck','retain_exception_hold')),
 source_reference text not null check (char_length(btrim(source_reference)) between 4 and 250),
 notes text check (notes is null or char_length(notes)<=500),
 created_at timestamptz not null default now(),
 unique(company_id,operation_id)
);
create index if not exists ywi_471_company_created on public.ywi_continuity_owner_renewals_471(company_id,created_at desc);
alter table public.ywi_continuity_owner_renewals_471 enable row level security;
revoke all on public.ywi_continuity_owner_renewals_471 from public,anon,authenticated;

create or replace function public.ywi_rpc_owner_followup_471(
 p_company_id uuid,p_operation_id uuid,p_confirmation_id uuid,p_decision text,p_source_reference text,p_notes text)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();v_role text;v_level text;v_base jsonb;v_src record;
 v_case jsonb;v_old record;v_id uuid;v_ref text:=btrim(coalesce(p_source_reference,''));
 v_notes text:=nullif(btrim(coalesce(p_notes,'')),'');
begin
 if v_actor is null or p_company_id is null or p_operation_id is null or p_confirmation_id is null
  or p_decision is null or p_decision not in ('record_new_owner_evidence','request_independent_recheck','retain_exception_hold')
  or char_length(v_ref) not between 4 and 250 or char_length(coalesce(v_notes,''))>500
 then raise exception '471 invalid owner documentary renewal: HOLD';end if;
 perform public.ywi_422_assert_owner(p_company_id);
 select lower(role) into v_role from public.profiles where id=v_actor and is_active is true;
 select coalesce((select access_level from public.app_profile_module_permissions where profile_id=v_actor and module_key='jobs'),
  (select access_level from public.app_role_module_permissions where role=v_role and module_key='jobs')) into v_level;
 if v_role is null or v_level not in ('approve','manage')
 then raise exception '471 owner Jobs permission denied: HOLD';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_company_id::text,471));
 v_base:=public.ywi_rpc_continuity_workspace_470(p_company_id);
 if (v_base->>'viewer_id')::uuid is distinct from v_actor
  or (v_base->'handoff_source'->>'is_owner') is distinct from 'true'
 then raise exception '471 owner source withheld: HOLD';end if;
 select k.id confirmation_id,k.finding,k.source_reference reviewer_continuity_ref,k.created_at confirmed_at,
  k.reviewer_user_id continuity_reviewer,a.owner_user_id,a.created_at reassessment_at,
  a.source_reference owner_reassessment_ref,n.id renewal_id,n.created_at renewed_at,
  n.reviewer_user_id renewal_reviewer,n.source_reference renewal_ref,f.source_reference followup_ref,
  o.source_reference outcome_ref,c.compared_source_reference compared_ref,
  h.source_reference handoff_ref,h.reviewer_user_id handoff_reviewer,h.proposal_id
 into v_src from public.ywi_continuity_confirmations_470 k
 join public.ywi_renewal_reassessments_469 a on a.id=k.reassessment_id and a.company_id=k.company_id
 join public.ywi_followup_renewals_468 n on n.id=a.renewal_id and n.company_id=a.company_id
 join public.ywi_comparison_followups_467 f on f.id=n.followup_id and f.company_id=n.company_id
 join public.ywi_reassigned_outcomes_466 o on o.id=f.outcome_id and o.company_id=f.company_id
 join public.ywi_reassigned_comparisons_466 c on c.id=o.comparison_id and c.company_id=o.company_id
 join public.ywi_reassignment_handoffs_465 h on h.id=c.handoff_id and h.company_id=c.company_id
 where k.id=p_confirmation_id and k.company_id=p_company_id;
 if not found or v_src.finding not in ('request_source_clarification','recommend_owner_followup')
  or v_src.owner_user_id is distinct from v_actor or v_src.continuity_reviewer=v_actor
  or v_src.continuity_reviewer is distinct from v_src.renewal_reviewer
  or v_src.continuity_reviewer is distinct from v_src.handoff_reviewer
  or v_src.confirmed_at<v_src.reassessment_at or v_src.reassessment_at<v_src.renewed_at
  or v_ref in (v_src.reviewer_continuity_ref,v_src.owner_reassessment_ref,v_src.renewal_ref,
    v_src.followup_ref,v_src.outcome_ref,v_src.compared_ref,v_src.handoff_ref)
  or public.ywi_465_assert_proposal(p_company_id,v_src.proposal_id) is distinct from v_src.continuity_reviewer
  or not exists(select 1 from pg_catalog.jsonb_array_elements(v_base->'confirmations') q
    where (q.value->>'id')::uuid=p_confirmation_id)
  or not exists(select 1 from pg_catalog.jsonb_array_elements(v_base->'reassessments') q
    where (q.value->>'id')::uuid=(select reassessment_id from public.ywi_continuity_confirmations_470 where id=p_confirmation_id))
 then raise exception '471 genuine independent continuity exception required: HOLD';end if;
 select q.value into v_case from pg_catalog.jsonb_array_elements(v_base->'handoff_source'->'cases') q
 where (q.value->>'proposal_id')::uuid=v_src.proposal_id;
 if v_case is null or (v_case->>'service_enabled') is distinct from 'true'
  or (v_case->>'owner_user_id') is distinct from v_actor::text
  or (v_case->>'proposed_reviewer_user_id') is distinct from v_src.continuity_reviewer::text
 then raise exception '471 original owner/reviewer/service source changed: HOLD';end if;
 select * into v_old from public.ywi_continuity_owner_renewals_471
 where company_id=p_company_id and (operation_id=p_operation_id or confirmation_id=p_confirmation_id) for update;
 if found then
  if v_old.operation_id is distinct from p_operation_id or v_old.confirmation_id is distinct from p_confirmation_id
   or v_old.owner_user_id is distinct from v_actor or v_old.decision is distinct from p_decision
   or v_old.source_reference is distinct from v_ref or v_old.notes is distinct from v_notes
  then raise exception '471 owner source replay differs: HOLD';end if;
  v_id:=v_old.id;
 else
  if (select count(*) from public.ywi_continuity_owner_renewals_471 where company_id=p_company_id)>=200
  then raise exception '471 owner renewal capacity: HOLD';end if;
  insert into public.ywi_continuity_owner_renewals_471(company_id,operation_id,confirmation_id,owner_user_id,decision,source_reference,notes)
  values(p_company_id,p_operation_id,p_confirmation_id,v_actor,p_decision,v_ref,v_notes) returning id into v_id;
 end if;
 return pg_catalog.jsonb_build_object('id',v_id,'company_id',p_company_id,'recorded',true,
  'field_accepted',false,'service_authorized',false,'independent_reapproval',false,
  'reassignment_executed',false,'release_green',false,'outbound_actions',false);
end $$;

create or replace function public.ywi_rpc_exception_workspace_471(p_company_id uuid)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();v_base jsonb;v_aging jsonb;v_renewals jsonb;
 v_count integer;v_as_of timestamptz;v_exception_count integer;
begin
 v_base:=public.ywi_rpc_continuity_workspace_470(p_company_id);
 if v_actor is null or (v_base->>'viewer_id')::uuid is distinct from v_actor
 then raise exception '471 actor mismatch: HOLD';end if;
 v_as_of:=(v_base->>'captured_at')::timestamptz;
 if exists(select 1 from pg_catalog.jsonb_array_elements(v_base->'confirmations') q
    where (q.value->>'created_at')::timestamptz>v_as_of)
 then raise exception '471 independent exception after capture: HOLD';end if;
 select count(*) into v_exception_count from pg_catalog.jsonb_array_elements(v_base->'confirmations') q
 where q.value->>'finding' in ('request_source_clarification','recommend_owner_followup');
 select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
  'confirmation_id',q.value->>'id','reassessment_id',q.value->>'reassessment_id',
  'age_days',greatest(0,pg_catalog.floor(extract(epoch from (v_as_of-(q.value->>'created_at')::timestamptz))/86400)::integer),
  'band',case when v_as_of-(q.value->>'created_at')::timestamptz>=interval '15 days' then 'overdue'
       when v_as_of-(q.value->>'created_at')::timestamptz>=interval '8 days' then 'aging' else 'current' end
 ) order by (q.value->>'created_at')::timestamptz desc),'[]'::jsonb)
 into v_aging from pg_catalog.jsonb_array_elements(v_base->'confirmations') q
 where q.value->>'finding' in ('request_source_clarification','recommend_owner_followup');
 select count(*) into v_count from public.ywi_continuity_owner_renewals_471 o
 where o.company_id=p_company_id and exists(select 1 from pg_catalog.jsonb_array_elements(v_base->'confirmations') q
  where (q.value->>'id')::uuid=o.confirmation_id and q.value->>'finding' in ('request_source_clarification','recommend_owner_followup'));
 if v_count>60 then raise exception '471 owner renewal sample capped: HOLD';end if;
 select coalesce(pg_catalog.jsonb_agg(to_jsonb(q) order by q.created_at desc,q.id desc),'[]'::jsonb)
 into v_renewals from (
  select o.id,o.company_id,o.confirmation_id,o.owner_user_id,o.decision,o.source_reference,o.created_at
  from public.ywi_continuity_owner_renewals_471 o
  where o.company_id=p_company_id and exists(select 1 from pg_catalog.jsonb_array_elements(v_base->'confirmations') k
    where (k.value->>'id')::uuid=o.confirmation_id and k.value->>'finding' in ('request_source_clarification','recommend_owner_followup'))
  order by o.created_at desc,o.id desc limit 60) q;
 return v_base||pg_catalog.jsonb_build_object('exception_as_of',v_as_of,'exception_aging',v_aging,'exception_total',v_exception_count,
  'owner_renewals',v_renewals,'owner_renewal_total',v_count,'owner_renewal_sample_capped',false);
end $$;
revoke all on function public.ywi_rpc_owner_followup_471(uuid,uuid,uuid,text,text,text) from public,anon,authenticated;
revoke all on function public.ywi_rpc_exception_workspace_471(uuid) from public,anon,authenticated;
grant execute on function public.ywi_rpc_owner_followup_471(uuid,uuid,uuid,text,text,text) to authenticated;
grant execute on function public.ywi_rpc_exception_workspace_471(uuid) to authenticated;
comment on table public.ywi_continuity_owner_renewals_471 is 'One owner documentary source renewal per genuine 470 independent exception; no field/Jobs/Safety/remote approvals.';
commit;
