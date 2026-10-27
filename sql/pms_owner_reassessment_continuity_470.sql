-- YW 470: signed separate-reviewer confirmation of a real owner 469 reassessment.
-- Strictly documentary. No Jobs/Safety, field acceptance, reassignment or release.
begin;
create table if not exists public.ywi_continuity_confirmations_470 (
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null references public.ywi_companies(id) on delete restrict,
 operation_id uuid not null,
 reassessment_id uuid not null unique references public.ywi_renewal_reassessments_469(id) on delete restrict,
 reviewer_user_id uuid not null references auth.users(id) on delete restrict,
 finding text not null check (finding in ('continuity_hold_confirmed','request_source_clarification','recommend_owner_followup')),
 source_reference text not null check (char_length(btrim(source_reference)) between 4 and 250),
 notes text check (notes is null or char_length(notes)<=500),
 created_at timestamptz not null default now(),
 unique(company_id,operation_id)
);
create index if not exists ywi_470_company_created on public.ywi_continuity_confirmations_470(company_id,created_at desc);
alter table public.ywi_continuity_confirmations_470 enable row level security;
revoke all on public.ywi_continuity_confirmations_470 from public,anon,authenticated;

create or replace function public.ywi_rpc_reviewer_confirm_470(
 p_company_id uuid,p_operation_id uuid,p_reassessment_id uuid,p_finding text,p_source_reference text,p_notes text)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();v_role text;v_level text;v_base jsonb;v_src record;
 v_case jsonb;v_old record;v_id uuid;v_ref text:=btrim(coalesce(p_source_reference,''));
 v_notes text:=nullif(btrim(coalesce(p_notes,'')),'');
begin
 if v_actor is null or p_company_id is null or p_operation_id is null or p_reassessment_id is null
  or p_finding is null or p_finding not in ('continuity_hold_confirmed','request_source_clarification','recommend_owner_followup')
  or char_length(v_ref) not between 4 and 250 or char_length(coalesce(v_notes,''))>500
 then raise exception '470 invalid independent continuity confirmation: HOLD';end if;
 select lower(role) into v_role from public.profiles where id=v_actor and is_active is true;
 select coalesce((select access_level from public.app_profile_module_permissions where profile_id=v_actor and module_key='jobs'),
  (select access_level from public.app_role_module_permissions where role=v_role and module_key='jobs')) into v_level;
 if v_role is null or v_level not in ('approve','manage')
 then raise exception '470 reviewer Jobs privilege denied: HOLD';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_company_id::text,470));
 v_base:=public.ywi_rpc_reassessment_workspace_469(p_company_id);
 if (v_base->>'viewer_id')::uuid is distinct from v_actor
  or (v_base->'handoff_source'->>'is_reviewer') is distinct from 'true'
 then raise exception '470 independent reviewer source withheld: HOLD';end if;
 select a.id reassessment_id,a.company_id,a.owner_user_id,a.source_reference owner_ref,a.created_at reassessment_at,
  n.id renewal_id,n.reviewer_user_id,n.created_at renewal_at,n.source_reference renewal_ref,
  f.source_reference followup_ref,o.source_reference outcome_ref,c.compared_source_reference compared_ref,
  h.source_reference handoff_ref,h.reviewer_user_id handoff_reviewer,h.proposal_id
 into v_src from public.ywi_renewal_reassessments_469 a
 join public.ywi_followup_renewals_468 n on n.id=a.renewal_id and n.company_id=a.company_id
 join public.ywi_comparison_followups_467 f on f.id=n.followup_id and f.company_id=n.company_id
 join public.ywi_reassigned_outcomes_466 o on o.id=f.outcome_id and o.company_id=f.company_id
 join public.ywi_reassigned_comparisons_466 c on c.id=o.comparison_id and c.company_id=o.company_id
 join public.ywi_reassignment_handoffs_465 h on h.id=c.handoff_id and h.company_id=c.company_id
 where a.id=p_reassessment_id and a.company_id=p_company_id;
 if not found or v_src.reviewer_user_id is distinct from v_actor
  or v_src.handoff_reviewer is distinct from v_actor or v_src.owner_user_id=v_actor
  or v_src.reassessment_at<v_src.renewal_at
  or v_ref in (v_src.owner_ref,v_src.renewal_ref,v_src.followup_ref,v_src.outcome_ref,v_src.compared_ref,v_src.handoff_ref)
  or public.ywi_465_assert_proposal(p_company_id,v_src.proposal_id) is distinct from v_actor
  or not exists(select 1 from pg_catalog.jsonb_array_elements(v_base->'reassessments') q
    where (q.value->>'id')::uuid=p_reassessment_id)
  or not exists(select 1 from pg_catalog.jsonb_array_elements(v_base->'renewals') q
    where (q.value->>'id')::uuid=v_src.renewal_id)
 then raise exception '470 genuine independent 469 owner source required: HOLD';end if;
 select q.value into v_case from pg_catalog.jsonb_array_elements(v_base->'handoff_source'->'cases') q
 where (q.value->>'proposal_id')::uuid=v_src.proposal_id;
 if v_case is null or (v_case->>'service_enabled') is distinct from 'true'
  or (v_case->>'owner_user_id') is distinct from v_src.owner_user_id::text
  or (v_case->>'proposed_reviewer_user_id') is distinct from v_actor::text
 then raise exception '470 original owner/reviewer/service source changed: HOLD';end if;
 select * into v_old from public.ywi_continuity_confirmations_470
 where company_id=p_company_id and (operation_id=p_operation_id or reassessment_id=p_reassessment_id) for update;
 if found then
  if v_old.operation_id is distinct from p_operation_id or v_old.reassessment_id is distinct from p_reassessment_id
   or v_old.reviewer_user_id is distinct from v_actor or v_old.finding is distinct from p_finding
   or v_old.source_reference is distinct from v_ref or v_old.notes is distinct from v_notes
  then raise exception '470 continuity replay differs: HOLD';end if;
  v_id:=v_old.id;
 else
  if (select count(*) from public.ywi_continuity_confirmations_470 where company_id=p_company_id)>=200
  then raise exception '470 continuity capacity: HOLD';end if;
  insert into public.ywi_continuity_confirmations_470(company_id,operation_id,reassessment_id,reviewer_user_id,finding,source_reference,notes)
  values(p_company_id,p_operation_id,p_reassessment_id,v_actor,p_finding,v_ref,v_notes) returning id into v_id;
 end if;
 return pg_catalog.jsonb_build_object('id',v_id,'company_id',p_company_id,'recorded',true,
  'field_accepted',false,'service_authorized',false,'independent_reapproval',false,
  'reassignment_executed',false,'release_green',false,'outbound_actions',false);
end $$;

create or replace function public.ywi_rpc_continuity_workspace_470(p_company_id uuid)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();v_base jsonb;v_aging jsonb;v_confirmations jsonb;
 v_count integer;v_as_of timestamptz;
begin
 v_base:=public.ywi_rpc_reassessment_workspace_469(p_company_id);
 if v_actor is null or (v_base->>'viewer_id')::uuid is distinct from v_actor
 then raise exception '470 actor mismatch: HOLD';end if;
 v_as_of:=(v_base->>'captured_at')::timestamptz;
 if exists(select 1 from pg_catalog.jsonb_array_elements(v_base->'reassessments') q
    where (q.value->>'created_at')::timestamptz>v_as_of)
 then raise exception '470 reassessment after evidence capture: HOLD';end if;
 select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
  'reassessment_id',q.value->>'id','renewal_id',q.value->>'renewal_id',
  'age_days',greatest(0,pg_catalog.floor(extract(epoch from (v_as_of-(q.value->>'created_at')::timestamptz))/86400)::integer),
  'band',case when v_as_of-(q.value->>'created_at')::timestamptz>=interval '15 days' then 'overdue'
       when v_as_of-(q.value->>'created_at')::timestamptz>=interval '8 days' then 'aging' else 'current' end
 ) order by (q.value->>'created_at')::timestamptz desc),'[]'::jsonb)
 into v_aging from pg_catalog.jsonb_array_elements(v_base->'reassessments') q;
 select count(*) into v_count from public.ywi_continuity_confirmations_470 k
 where k.company_id=p_company_id and exists(select 1 from pg_catalog.jsonb_array_elements(v_base->'reassessments') q
  where (q.value->>'id')::uuid=k.reassessment_id);
 if v_count>60 then raise exception '470 continuity sample capped: HOLD';end if;
 select coalesce(pg_catalog.jsonb_agg(to_jsonb(q) order by q.created_at desc,q.id desc),'[]'::jsonb)
 into v_confirmations from (
  select k.id,k.company_id,k.reassessment_id,k.reviewer_user_id,k.finding,k.source_reference,k.created_at
  from public.ywi_continuity_confirmations_470 k
  where k.company_id=p_company_id and exists(select 1 from pg_catalog.jsonb_array_elements(v_base->'reassessments') x
    where (x.value->>'id')::uuid=k.reassessment_id)
  order by k.created_at desc,k.id desc limit 60) q;
 return v_base||pg_catalog.jsonb_build_object('continuity_as_of',v_as_of,'reassessment_aging',v_aging,
  'confirmations',v_confirmations,'confirmation_total',v_count,'confirmation_sample_capped',false);
end $$;
revoke all on function public.ywi_rpc_reviewer_confirm_470(uuid,uuid,uuid,text,text,text) from public,anon,authenticated;
revoke all on function public.ywi_rpc_continuity_workspace_470(uuid) from public,anon,authenticated;
grant execute on function public.ywi_rpc_reviewer_confirm_470(uuid,uuid,uuid,text,text,text) to authenticated;
grant execute on function public.ywi_rpc_continuity_workspace_470(uuid) to authenticated;
comment on table public.ywi_continuity_confirmations_470 is 'One independent reviewer continuity confirmation per real 469 owner reassessment; field/Jobs/Safety approvals remain HOLD.';
commit;
