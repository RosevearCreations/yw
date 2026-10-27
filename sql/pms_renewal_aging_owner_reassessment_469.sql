-- YW 469: immutable owner documentary reassessment of a genuine independent 468 renewal.
-- This does not confer field acceptance, Jobs/Safety approval, reassignment or release.
begin;
create table if not exists public.ywi_renewal_reassessments_469 (
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null references public.ywi_companies(id) on delete restrict,
 operation_id uuid not null,
 renewal_id uuid not null unique references public.ywi_followup_renewals_468(id) on delete restrict,
 owner_user_id uuid not null references auth.users(id) on delete restrict,
 decision text not null check (decision in ('request_updated_evidence','retain_owner_hold','document_reassessment_path')),
 source_reference text not null check (char_length(btrim(source_reference)) between 4 and 250),
 notes text check (notes is null or char_length(notes)<=500),
 created_at timestamptz not null default now(),
 unique(company_id,operation_id)
);
create index if not exists ywi_469_company_created on public.ywi_renewal_reassessments_469(company_id,created_at desc);
alter table public.ywi_renewal_reassessments_469 enable row level security;
revoke all on public.ywi_renewal_reassessments_469 from public,anon,authenticated;

create or replace function public.ywi_rpc_owner_reassess_469(
 p_company_id uuid,p_operation_id uuid,p_renewal_id uuid,p_decision text,p_source_reference text,p_notes text)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();v_role text;v_level text;v_base jsonb;v_source record;
 v_case jsonb;v_old record;v_id uuid;v_ref text:=btrim(coalesce(p_source_reference,''));
 v_notes text:=nullif(btrim(coalesce(p_notes,'')),'');
begin
 if v_actor is null or p_company_id is null or p_operation_id is null or p_renewal_id is null
  or p_decision not in ('request_updated_evidence','retain_owner_hold','document_reassessment_path')
  or char_length(v_ref) not between 4 and 250 or char_length(coalesce(v_notes,''))>500
 then raise exception '469 invalid owner reassessment: HOLD';end if;
 perform public.ywi_422_assert_owner(p_company_id);
 select lower(role) into v_role from public.profiles where id=v_actor and is_active is true;
 select coalesce((select access_level from public.app_profile_module_permissions where profile_id=v_actor and module_key='jobs'),
  (select access_level from public.app_role_module_permissions where role=v_role and module_key='jobs')) into v_level;
 if v_role is null or v_level not in ('approve','manage')
 then raise exception '469 owner Jobs approval denied: HOLD';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_company_id::text,469));
 v_base:=public.ywi_rpc_renewal_workspace_468(p_company_id);
 if (v_base->>'viewer_id')::uuid is distinct from v_actor
  or (v_base->'handoff_source'->>'is_owner') is distinct from 'true'
 then raise exception '469 owner source withheld: HOLD';end if;
 select n.id,n.company_id,n.followup_id,n.reviewer_user_id,n.source_reference renewal_ref,
  n.created_at renewed_at,f.owner_user_id,f.source_reference followup_ref,f.created_at followup_at,
  o.id outcome_id,o.source_reference outcome_ref,c.compared_source_reference compared_ref,
  h.reviewer_user_id handoff_reviewer,h.proposal_id
 into v_source from public.ywi_followup_renewals_468 n
 join public.ywi_comparison_followups_467 f on f.id=n.followup_id and f.company_id=n.company_id
 join public.ywi_reassigned_outcomes_466 o on o.id=f.outcome_id and o.company_id=f.company_id
 join public.ywi_reassigned_comparisons_466 c on c.id=o.comparison_id and c.company_id=o.company_id
 join public.ywi_reassignment_handoffs_465 h on h.id=c.handoff_id and h.company_id=c.company_id
 where n.id=p_renewal_id and n.company_id=p_company_id;
 if not found or v_source.owner_user_id is distinct from v_actor
  or v_source.reviewer_user_id is distinct from v_source.handoff_reviewer
  or v_source.reviewer_user_id=v_actor or v_source.renewed_at<v_source.followup_at
  or v_ref in (v_source.renewal_ref,v_source.followup_ref,v_source.outcome_ref,v_source.compared_ref)
  or public.ywi_465_assert_proposal(p_company_id,v_source.proposal_id) is distinct from v_source.reviewer_user_id
  or not exists(select 1 from pg_catalog.jsonb_array_elements(v_base->'renewals') q
    where (q.value->>'id')::uuid=p_renewal_id)
  or not exists(select 1 from pg_catalog.jsonb_array_elements(v_base->'followups') q
    where (q.value->>'id')::uuid=v_source.followup_id)
  or not exists(select 1 from pg_catalog.jsonb_array_elements(v_base->'outcomes') q
    where (q.value->>'id')::uuid=v_source.outcome_id)
 then raise exception '469 real independent renewal required: HOLD';end if;
 select q.value into v_case from pg_catalog.jsonb_array_elements(v_base->'handoff_source'->'cases') q
 where (q.value->>'proposal_id')::uuid=v_source.proposal_id;
 if v_case is null or (v_case->>'service_enabled') is distinct from 'true'
  or (v_case->>'owner_user_id') is distinct from v_actor::text
  or (v_case->>'proposed_reviewer_user_id') is distinct from v_source.reviewer_user_id::text
 then raise exception '469 original source or service changed: HOLD';end if;
 select * into v_old from public.ywi_renewal_reassessments_469
 where company_id=p_company_id and (operation_id=p_operation_id or renewal_id=p_renewal_id) for update;
 if found then
  if v_old.operation_id is distinct from p_operation_id or v_old.renewal_id is distinct from p_renewal_id
   or v_old.owner_user_id is distinct from v_actor or v_old.decision is distinct from p_decision
   or v_old.source_reference is distinct from v_ref or v_old.notes is distinct from v_notes
  then raise exception '469 reassessment replay differs: HOLD';end if;v_id:=v_old.id;
 else
  if (select count(*) from public.ywi_renewal_reassessments_469 where company_id=p_company_id)>=200
  then raise exception '469 reassessment capacity: HOLD';end if;
  insert into public.ywi_renewal_reassessments_469(company_id,operation_id,renewal_id,owner_user_id,decision,source_reference,notes)
  values(p_company_id,p_operation_id,p_renewal_id,v_actor,p_decision,v_ref,v_notes) returning id into v_id;
 end if;
 return pg_catalog.jsonb_build_object('id',v_id,'company_id',p_company_id,'recorded',true,
  'field_accepted',false,'service_authorized',false,'independent_reapproval',false,
  'reassignment_executed',false,'release_green',false,'outbound_actions',false);
end $$;

create or replace function public.ywi_rpc_reassessment_workspace_469(p_company_id uuid)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();v_base jsonb;v_aging jsonb;v_reassessments jsonb;
 v_count integer;v_as_of timestamptz;
begin
 v_base:=public.ywi_rpc_renewal_workspace_468(p_company_id);
 if v_actor is null or (v_base->>'viewer_id')::uuid is distinct from v_actor
 then raise exception '469 actor mismatch: HOLD';end if;
 v_as_of:=(v_base->>'captured_at')::timestamptz;
 if exists(select 1 from pg_catalog.jsonb_array_elements(v_base->'renewals') q
    where (q.value->>'created_at')::timestamptz>v_as_of)
 then raise exception '469 renewal after evidence capture: HOLD';end if;
 select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
  'renewal_id',q.value->>'id','followup_id',q.value->>'followup_id',
  'age_days',greatest(0,pg_catalog.floor(extract(epoch from (v_as_of-(q.value->>'created_at')::timestamptz))/86400)::integer),
  'band',case when v_as_of-(q.value->>'created_at')::timestamptz>=interval '15 days' then 'overdue'
       when v_as_of-(q.value->>'created_at')::timestamptz>=interval '8 days' then 'aging' else 'current' end
 ) order by (q.value->>'created_at')::timestamptz desc),'[]'::jsonb)
 into v_aging from pg_catalog.jsonb_array_elements(v_base->'renewals') q;
 select count(*) into v_count from public.ywi_renewal_reassessments_469 a
 where a.company_id=p_company_id and exists(select 1 from pg_catalog.jsonb_array_elements(v_base->'renewals') q
  where (q.value->>'id')::uuid=a.renewal_id);
 if v_count>60 then raise exception '469 reassessment sample capped: HOLD';end if;
 select coalesce(pg_catalog.jsonb_agg(to_jsonb(q) order by q.created_at desc,q.id desc),'[]'::jsonb)
 into v_reassessments from (
  select a.id,a.company_id,a.renewal_id,a.owner_user_id,a.decision,a.source_reference,a.created_at
  from public.ywi_renewal_reassessments_469 a
  where a.company_id=p_company_id and exists(select 1 from pg_catalog.jsonb_array_elements(v_base->'renewals') x
    where (x.value->>'id')::uuid=a.renewal_id)
  order by a.created_at desc,a.id desc limit 60) q;
 return v_base||pg_catalog.jsonb_build_object('renewal_as_of',v_as_of,'renewal_aging',v_aging,
  'reassessments',v_reassessments,'reassessment_total',v_count,'reassessment_sample_capped',false);
end $$;
revoke all on function public.ywi_rpc_owner_reassess_469(uuid,uuid,uuid,text,text,text) from public,anon,authenticated;
revoke all on function public.ywi_rpc_reassessment_workspace_469(uuid) from public,anon,authenticated;
grant execute on function public.ywi_rpc_owner_reassess_469(uuid,uuid,uuid,text,text,text) to authenticated;
grant execute on function public.ywi_rpc_reassessment_workspace_469(uuid) to authenticated;
comment on table public.ywi_renewal_reassessments_469 is 'One owner documentary reassessment per genuine separate-reviewer 468 renewal; no operational release.';
commit;
