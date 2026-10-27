-- YW 467: owner documentary exception follow-up on the *existing* YW 466
-- independent comparison and exception journals. Do not duplicate or replace 466.
begin;
create table if not exists public.ywi_comparison_followups_467 (
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null references public.ywi_companies(id) on delete restrict,
 operation_id uuid not null,
 outcome_id uuid not null unique references public.ywi_reassigned_outcomes_466(id) on delete restrict,
 owner_user_id uuid not null references auth.users(id) on delete restrict,
 decision text not null check (decision in ('request_further_evidence','retain_exception_hold','documentary_closeout')),
 source_reference text not null check (char_length(btrim(source_reference)) between 4 and 250),
 notes text check (notes is null or char_length(notes)<=500),
 created_at timestamptz not null default now(),
 unique(company_id,operation_id)
);
create index if not exists ywi_467_company_created on public.ywi_comparison_followups_467(company_id,created_at desc);
alter table public.ywi_comparison_followups_467 enable row level security;
revoke all on public.ywi_comparison_followups_467 from public,anon,authenticated;

create or replace function public.ywi_rpc_followup_comparison_467(
 p_company_id uuid,p_operation_id uuid,p_outcome_id uuid,p_decision text,p_source_reference text,p_notes text)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_owner uuid:=auth.uid();v_role text;v_level text;v_base jsonb;v_source record;
 v_old record;v_id uuid;v_case jsonb;v_baseline jsonb;
 v_ref text:=btrim(coalesce(p_source_reference,''));v_notes text:=nullif(btrim(coalesce(p_notes,'')),'');
begin
 perform public.ywi_422_assert_owner(p_company_id);
 if p_operation_id is null or p_outcome_id is null
  or p_decision not in ('request_further_evidence','retain_exception_hold','documentary_closeout')
  or char_length(v_ref) not between 4 and 250 or char_length(coalesce(v_notes,''))>500
 then raise exception '467 invalid owner exception follow-up: HOLD';end if;
 select lower(role) into v_role from public.profiles where id=v_owner and is_active is true;
 select coalesce((select access_level from public.app_profile_module_permissions where profile_id=v_owner and module_key='jobs'),
  (select access_level from public.app_role_module_permissions where role=v_role and module_key='jobs')) into v_level;
 if v_role is null or v_level not in ('approve','manage') then raise exception '467 owner Jobs approval denied';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_company_id::text,467));
 -- Use the genuine 466 owner projection, which validates 465 and prior 455–464
 -- chain, tenant, bounded source and active Jobs view. No reviewer impersonation.
 v_base:=public.ywi_rpc_comparison_workspace_466(p_company_id);
 if (v_base->'handoff_source'->>'is_owner') is distinct from 'true'
  or (v_base->>'viewer_id')::uuid is distinct from v_owner
 then raise exception '467 foreign owner source: HOLD';end if;
 select o.id,o.company_id,o.comparison_id,o.reviewer_user_id,o.disposition,o.created_at outcome_at,
  c.handoff_id,c.receipt_id,c.original_source_reference,c.compared_source_reference,c.alignment,c.created_at compared_at,
  h.proposal_id,h.reviewer_user_id assigned_reviewer,h.created_at handoff_at,
  r.response,r.created_at receipt_at
 into v_source from public.ywi_reassigned_outcomes_466 o
 join public.ywi_reassigned_comparisons_466 c on c.id=o.comparison_id and c.company_id=o.company_id
 join public.ywi_reassignment_handoffs_465 h on h.id=c.handoff_id and h.company_id=c.company_id
 join public.ywi_reassignment_receipts_465 r on r.id=c.receipt_id and r.company_id=c.company_id and r.handoff_id=h.id
 where o.id=p_outcome_id and o.company_id=p_company_id;
 if not found or v_source.disposition not in ('exception_remains_open','request_source_clarification')
  or v_source.response<>'acknowledged_for_review'
  or v_source.reviewer_user_id is distinct from v_source.assigned_reviewer
  or v_source.compared_at<v_source.receipt_at or v_source.outcome_at<v_source.compared_at
  or v_source.handoff_at>v_source.receipt_at
  or v_source.alignment not in ('matches_recorded_chain','material_gap','additional_evidence_required')
  or v_source.original_source_reference=v_source.compared_source_reference
 then raise exception '467 genuine independent exception outcome required: HOLD';end if;
 if public.ywi_465_assert_proposal(p_company_id,v_source.proposal_id)<>v_source.reviewer_user_id
 then raise exception '467 separate reviewer lineage changed: HOLD';end if;
 select value into v_case from pg_catalog.jsonb_array_elements(v_base->'handoff_source'->'cases')
 where (value->>'proposal_id')::uuid=v_source.proposal_id;
 select value into v_baseline from pg_catalog.jsonb_array_elements(v_base->'original_baselines')
 where (value->>'proposal_id')::uuid=v_source.proposal_id;
 if v_case is null or (v_case->>'service_enabled') is distinct from 'true'
  or (v_case->>'owner_user_id') is distinct from v_owner::text
  or (v_case->>'proposed_reviewer_user_id') is distinct from v_source.reviewer_user_id::text
  or v_baseline is null or (v_baseline->>'original_source_reference') is distinct from v_source.original_source_reference
  or not exists (select 1 from pg_catalog.jsonb_array_elements(v_base->'outcomes') v
    where (v.value->>'id')::uuid=p_outcome_id)
 then raise exception '467 incomplete original comparison evidence: HOLD';end if;
 select * into v_old from public.ywi_comparison_followups_467
 where company_id=p_company_id and (operation_id=p_operation_id or outcome_id=p_outcome_id) for update;
 if found then
  if v_old.operation_id is distinct from p_operation_id or v_old.outcome_id is distinct from p_outcome_id
   or v_old.owner_user_id is distinct from v_owner or v_old.decision is distinct from p_decision
   or v_old.source_reference is distinct from v_ref or v_old.notes is distinct from v_notes
  then raise exception '467 owner follow-up replay differs: HOLD';end if;v_id:=v_old.id;
 else
  if (select count(*) from public.ywi_comparison_followups_467 where company_id=p_company_id)>=200
  then raise exception '467 owner follow-up capacity: HOLD';end if;
  insert into public.ywi_comparison_followups_467(company_id,operation_id,outcome_id,owner_user_id,decision,source_reference,notes)
  values(p_company_id,p_operation_id,p_outcome_id,v_owner,p_decision,v_ref,v_notes) returning id into v_id;
 end if;
 return pg_catalog.jsonb_build_object('id',v_id,'company_id',p_company_id,'recorded',true,
  'field_accepted',false,'service_authorized',false,'independent_reapproval',false,'reassignment_executed',false,
  'release_green',false,'outbound_actions',false);
end $$;

create or replace function public.ywi_rpc_comparison_workspace_467(p_company_id uuid)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();v_base jsonb;v_followups jsonb;v_count integer;
begin
 v_base:=public.ywi_rpc_comparison_workspace_466(p_company_id);
 if (v_base->>'viewer_id')::uuid is distinct from v_actor then raise exception '467 viewer changed';end if;
 select count(*) into v_count from public.ywi_comparison_followups_467 f
 join public.ywi_reassigned_outcomes_466 o on o.id=f.outcome_id and o.company_id=f.company_id
 join public.ywi_reassigned_comparisons_466 c on c.id=o.comparison_id and c.company_id=o.company_id
 join public.ywi_reassignment_handoffs_465 h on h.id=c.handoff_id and h.company_id=c.company_id
 where f.company_id=p_company_id and ((v_base->'handoff_source'->>'is_owner')::boolean or h.reviewer_user_id=v_actor);
 if v_count>60 then raise exception '467 owner outcome sample capped: HOLD';end if;
 select coalesce(jsonb_agg(to_jsonb(q) order by q.created_at desc,q.id desc),'[]'::jsonb)
 into v_followups from (
  select f.id,f.company_id,f.outcome_id,f.owner_user_id,f.decision,f.source_reference,f.created_at
  from public.ywi_comparison_followups_467 f
  join public.ywi_reassigned_outcomes_466 o on o.id=f.outcome_id and o.company_id=f.company_id
  join public.ywi_reassigned_comparisons_466 c on c.id=o.comparison_id and c.company_id=o.company_id
  join public.ywi_reassignment_handoffs_465 h on h.id=c.handoff_id and h.company_id=c.company_id
  where f.company_id=p_company_id and ((v_base->'handoff_source'->>'is_owner')::boolean or h.reviewer_user_id=v_actor)
  order by f.created_at desc,f.id desc limit 60) q;
 return v_base||pg_catalog.jsonb_build_object('followups',v_followups,'followup_total',v_count,'followup_sample_capped',false);
end $$;
revoke all on function public.ywi_rpc_followup_comparison_467(uuid,uuid,uuid,text,text,text) from public,anon,authenticated;
revoke all on function public.ywi_rpc_comparison_workspace_467(uuid) from public,anon,authenticated;
grant execute on function public.ywi_rpc_followup_comparison_467(uuid,uuid,uuid,text,text,text) to authenticated;
grant execute on function public.ywi_rpc_comparison_workspace_467(uuid) to authenticated;
comment on table public.ywi_comparison_followups_467 is 'Owner documentary exception follow-up to existing 466 reviewer outcome; never field/Jobs/Safety or Production approval.';
commit;
