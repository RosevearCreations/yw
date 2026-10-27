-- YW 468: independent documentary renewal of actual 467 owner follow-ups.
-- This is an append-only evidence review, never a release, field or Jobs approval.
begin;
create table if not exists public.ywi_followup_renewals_468 (
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null references public.ywi_companies(id) on delete restrict,
 operation_id uuid not null,
 followup_id uuid not null unique references public.ywi_comparison_followups_467(id) on delete restrict,
 reviewer_user_id uuid not null references auth.users(id) on delete restrict,
 decision text not null check (decision in ('refreshed_reference_needs_owner_review','evidence_still_insufficient','independent_escalation_recommended')),
 source_reference text not null check (char_length(btrim(source_reference)) between 4 and 250),
 notes text check (notes is null or char_length(notes)<=500),
 created_at timestamptz not null default now(),
 unique(company_id,operation_id)
);
create index if not exists ywi_468_company_created on public.ywi_followup_renewals_468(company_id,created_at desc);
alter table public.ywi_followup_renewals_468 enable row level security;
revoke all on public.ywi_followup_renewals_468 from public,anon,authenticated;

create or replace function public.ywi_rpc_review_followup_468(
 p_company_id uuid,p_operation_id uuid,p_followup_id uuid,p_decision text,p_source_reference text,p_notes text)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();v_base jsonb;v_ref text:=btrim(coalesce(p_source_reference,''));
 v_notes text:=nullif(btrim(coalesce(p_notes,'')),'');v_source record;v_old record;v_id uuid;
 v_case jsonb;
begin
 if v_actor is null or p_company_id is null or p_operation_id is null or p_followup_id is null
  or p_decision not in ('refreshed_reference_needs_owner_review','evidence_still_insufficient','independent_escalation_recommended')
  or char_length(v_ref) not between 4 and 250 or char_length(coalesce(v_notes,''))>500
 then raise exception '468 invalid independent renewal: HOLD';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_company_id::text,468));
 -- Reuse 467/466's signed-in, scoped Jobs and 455–465 source-chain validation.
 v_base:=public.ywi_rpc_comparison_workspace_467(p_company_id);
 if (v_base->>'viewer_id')::uuid is distinct from v_actor
  or (v_base->'handoff_source'->>'is_reviewer') is distinct from 'true'
 then raise exception '468 independent reviewer source denied: HOLD';end if;
 select f.id,f.company_id,f.owner_user_id,f.outcome_id,f.source_reference owner_ref,f.created_at followup_at,
  o.source_reference outcome_ref,o.created_at outcome_at,c.compared_source_reference compared_ref,
  c.reviewer_user_id,h.reviewer_user_id handoff_reviewer,h.proposal_id
 into v_source from public.ywi_comparison_followups_467 f
 join public.ywi_reassigned_outcomes_466 o on o.id=f.outcome_id and o.company_id=f.company_id
 join public.ywi_reassigned_comparisons_466 c on c.id=o.comparison_id and c.company_id=o.company_id
 join public.ywi_reassignment_handoffs_465 h on h.id=c.handoff_id and h.company_id=c.company_id
 where f.id=p_followup_id and f.company_id=p_company_id;
 if not found or v_source.reviewer_user_id is distinct from v_actor
  or v_source.handoff_reviewer is distinct from v_actor or v_source.owner_user_id=v_actor
  or v_source.followup_at<v_source.outcome_at
  or v_ref in (v_source.owner_ref,v_source.outcome_ref,v_source.compared_ref)
  or public.ywi_465_assert_proposal(p_company_id,v_source.proposal_id) is distinct from v_actor
  or not exists(select 1 from pg_catalog.jsonb_array_elements(v_base->'followups') q
    where (q.value->>'id')::uuid=p_followup_id)
  or not exists(select 1 from pg_catalog.jsonb_array_elements(v_base->'outcomes') q
    where (q.value->>'id')::uuid=v_source.outcome_id)
 then raise exception '468 real separate reviewer and owner follow-up required: HOLD';end if;
 select q.value into v_case from pg_catalog.jsonb_array_elements(v_base->'handoff_source'->'cases') q
 where (q.value->>'proposal_id')::uuid=v_source.proposal_id;
 if v_case is null or (v_case->>'service_enabled') is distinct from 'true'
  or (v_case->>'owner_user_id') is distinct from v_source.owner_user_id::text
  or (v_case->>'proposed_reviewer_user_id') is distinct from v_actor::text
 then raise exception '468 case or active service changed: HOLD';end if;
 select * into v_old from public.ywi_followup_renewals_468
 where company_id=p_company_id and (operation_id=p_operation_id or followup_id=p_followup_id) for update;
 if found then
  if v_old.operation_id is distinct from p_operation_id or v_old.followup_id is distinct from p_followup_id
   or v_old.reviewer_user_id is distinct from v_actor or v_old.decision is distinct from p_decision
   or v_old.source_reference is distinct from v_ref or v_old.notes is distinct from v_notes
  then raise exception '468 renewal replay differs: HOLD';end if;v_id:=v_old.id;
 else
  if (select count(*) from public.ywi_followup_renewals_468 where company_id=p_company_id)>=200
  then raise exception '468 renewal capacity: HOLD';end if;
  insert into public.ywi_followup_renewals_468(company_id,operation_id,followup_id,reviewer_user_id,decision,source_reference,notes)
  values(p_company_id,p_operation_id,p_followup_id,v_actor,p_decision,v_ref,v_notes) returning id into v_id;
 end if;
 return pg_catalog.jsonb_build_object('id',v_id,'company_id',p_company_id,'recorded',true,
  'field_accepted',false,'service_authorized',false,'independent_reapproval',false,
  'reassignment_executed',false,'release_green',false,'outbound_actions',false);
end $$;

create or replace function public.ywi_rpc_renewal_workspace_468(p_company_id uuid)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();v_base jsonb;v_renewals jsonb;v_aging jsonb;
 v_count integer;v_as_of timestamptz;
begin
 v_base:=public.ywi_rpc_comparison_workspace_467(p_company_id);
 if v_actor is null or (v_base->>'viewer_id')::uuid is distinct from v_actor
 then raise exception '468 actor mismatch: HOLD';end if;
 v_as_of:=(v_base->>'captured_at')::timestamptz;
 if exists(select 1 from pg_catalog.jsonb_array_elements(v_base->'followups') q
    where (q.value->>'created_at')::timestamptz>v_as_of)
 then raise exception '468 follow-up after evidence capture: HOLD';end if;
 select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
   'followup_id',q.value->>'id','outcome_id',q.value->>'outcome_id',
   'age_days',greatest(0,pg_catalog.floor(extract(epoch from (v_as_of-(q.value->>'created_at')::timestamptz))/86400)::integer),
   'band',case when v_as_of-(q.value->>'created_at')::timestamptz>=interval '15 days' then 'overdue'
        when v_as_of-(q.value->>'created_at')::timestamptz>=interval '8 days' then 'aging' else 'current' end
 ) order by (q.value->>'created_at')::timestamptz desc),'[]'::jsonb)
 into v_aging from pg_catalog.jsonb_array_elements(v_base->'followups') q;
 select count(*) into v_count from public.ywi_followup_renewals_468 n
 where n.company_id=p_company_id and exists(select 1 from pg_catalog.jsonb_array_elements(v_base->'followups') q
   where (q.value->>'id')::uuid=n.followup_id);
 if v_count>60 then raise exception '468 renewal sample capped: HOLD';end if;
 select coalesce(pg_catalog.jsonb_agg(to_jsonb(q) order by q.created_at desc,q.id desc),'[]'::jsonb)
 into v_renewals from (
  select n.id,n.company_id,n.followup_id,n.reviewer_user_id,n.decision,n.source_reference,n.created_at
  from public.ywi_followup_renewals_468 n
  where n.company_id=p_company_id and exists(select 1 from pg_catalog.jsonb_array_elements(v_base->'followups') x
    where (x.value->>'id')::uuid=n.followup_id)
  order by n.created_at desc,n.id desc limit 60) q;
 return v_base||pg_catalog.jsonb_build_object('aging_as_of',v_as_of,'aging',v_aging,
  'renewals',v_renewals,'renewal_total',v_count,'renewal_sample_capped',false);
end $$;
revoke all on function public.ywi_rpc_review_followup_468(uuid,uuid,uuid,text,text,text) from public,anon,authenticated;
revoke all on function public.ywi_rpc_renewal_workspace_468(uuid) from public,anon,authenticated;
grant execute on function public.ywi_rpc_review_followup_468(uuid,uuid,uuid,text,text,text) to authenticated;
grant execute on function public.ywi_rpc_renewal_workspace_468(uuid) to authenticated;
comment on table public.ywi_followup_renewals_468 is 'Independent, immutable documentary follow-up renewal; HOLD all operational authority.';
commit;
