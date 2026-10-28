-- YW 476: age verified owner 475 renewal sources; one original independent
-- reviewer may issue a documentary follow-up receipt only. Operational HOLD.
begin;
create table if not exists public.ywi_renewal_reviewer_receipts_476 (
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null references public.ywi_companies(id) on delete restrict,
 operation_id uuid not null,
 owner_request_id uuid not null unique references public.ywi_continuity_owner_requests_475(id) on delete restrict,
 reviewer_user_id uuid not null references auth.users(id) on delete restrict,
 disposition text not null check(disposition in ('record_documentary_recheck','request_owner_source_refresh','retain_independent_hold')),
 source_reference text not null check(char_length(btrim(source_reference)) between 4 and 250),
 notes text check(notes is null or char_length(notes)<=500),
 created_at timestamptz not null default now(),
 unique(company_id,operation_id)
);
create index if not exists ywi_476_company_created on public.ywi_renewal_reviewer_receipts_476(company_id,created_at desc);
alter table public.ywi_renewal_reviewer_receipts_476 enable row level security;
revoke all on public.ywi_renewal_reviewer_receipts_476 from public,anon,authenticated;

create or replace function public.ywi_rpc_reviewer_renewal_receipt_476(
 p_company_id uuid,p_operation_id uuid,p_owner_request_id uuid,p_disposition text,p_source_reference text,p_notes text)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();v_role text;v_level text;v_base jsonb;v_src record;
 v_case jsonb;v_old record;v_id uuid;v_ref text:=btrim(coalesce(p_source_reference,''));
 v_notes text:=nullif(btrim(coalesce(p_notes,'')),'');
begin
 if v_actor is null or p_company_id is null or p_operation_id is null or p_owner_request_id is null
  or p_disposition is null or p_disposition not in ('record_documentary_recheck','request_owner_source_refresh','retain_independent_hold')
  or char_length(v_ref) not between 4 and 250 or char_length(coalesce(v_notes,''))>500
 then raise exception '476 invalid reviewer follow-up receipt: HOLD';end if;
 select lower(role) into v_role from public.profiles where id=v_actor and is_active is true;
 select coalesce((select access_level from public.app_profile_module_permissions where profile_id=v_actor and module_key='jobs'),
  (select access_level from public.app_role_module_permissions where role=v_role and module_key='jobs')) into v_level;
 if v_role is null or v_level not in ('approve','manage')
 then raise exception '476 reviewer Jobs permission denied: HOLD';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_company_id::text,476));
 v_base:=public.ywi_rpc_owner_renewal_workspace_475(p_company_id);
 if (v_base->>'viewer_id')::uuid is distinct from v_actor
  or (v_base->'handoff_source'->>'is_reviewer') is distinct from 'true'
 then raise exception '476 independent reviewer source withheld: HOLD';end if;
 select p.id owner_request_id,p.owner_user_id,p.decision owner_decision,p.source_reference owner_request_source,
  p.created_at owner_request_at,t.id continuity_id,t.disposition original_continuity_disposition,
  t.source_reference continuity_source,t.reviewer_user_id continuity_reviewer,t.created_at continuity_at,
  w.source_reference clarification_source,w.owner_user_id clarification_owner,w.created_at clarification_at,
  q.source_reference recheck_source,q.reviewer_user_id recheck_reviewer,q.created_at recheck_at,
  r.source_reference original_owner_renewal_source,r.owner_user_id original_owner,r.decision original_decision,
  k.source_reference confirmation_source,k.reviewer_user_id confirmation_reviewer,
  a.source_reference reassessment_source,a.owner_user_id reassessment_owner,
  n.source_reference renewal_source,n.reviewer_user_id renewal_reviewer,
  f.source_reference followup_source,o.source_reference outcome_source,c.compared_source_reference comparison_source,
  h.source_reference handoff_source,h.reviewer_user_id handoff_reviewer,h.proposal_id
 into v_src from public.ywi_continuity_owner_requests_475 p
 join public.ywi_clarification_continuity_reviews_474 t on t.id=p.continuity_review_id and t.company_id=p.company_id
 join public.ywi_recheck_owner_clarifications_473 w on w.id=t.owner_clarification_id and w.company_id=t.company_id
 join public.ywi_independent_recheck_reviews_472 q on q.id=w.assignment_review_id and q.company_id=w.company_id
 join public.ywi_continuity_owner_renewals_471 r on r.id=q.owner_renewal_id and r.company_id=q.company_id
 join public.ywi_continuity_confirmations_470 k on k.id=r.confirmation_id and k.company_id=r.company_id
 join public.ywi_renewal_reassessments_469 a on a.id=k.reassessment_id and a.company_id=k.company_id
 join public.ywi_followup_renewals_468 n on n.id=a.renewal_id and n.company_id=a.company_id
 join public.ywi_comparison_followups_467 f on f.id=n.followup_id and f.company_id=n.company_id
 join public.ywi_reassigned_outcomes_466 o on o.id=f.outcome_id and o.company_id=f.company_id
 join public.ywi_reassigned_comparisons_466 c on c.id=o.comparison_id and c.company_id=o.company_id
 join public.ywi_reassignment_handoffs_465 h on h.id=c.handoff_id and h.company_id=c.company_id
 where p.id=p_owner_request_id and p.company_id=p_company_id;
 if not found or v_src.owner_decision not in ('submit_renewed_documentary_source','request_independent_continuity_recheck')
  or v_src.original_continuity_disposition is distinct from 'request_refreshed_owner_evidence'
  or v_src.continuity_reviewer is distinct from v_actor or v_src.recheck_reviewer is distinct from v_actor
  or v_src.confirmation_reviewer is distinct from v_actor or v_src.renewal_reviewer is distinct from v_actor
  or v_src.handoff_reviewer is distinct from v_actor
  or v_src.owner_user_id=v_actor or v_src.owner_user_id is distinct from v_src.original_owner
  or v_src.owner_user_id is distinct from v_src.clarification_owner
  or v_src.owner_user_id is distinct from v_src.reassessment_owner
  or v_src.original_decision is distinct from 'request_independent_recheck'
  or v_src.clarification_at<v_src.recheck_at or v_src.continuity_at<v_src.clarification_at
  or v_src.owner_request_at<v_src.continuity_at or v_src.owner_request_at>pg_catalog.now()
  or v_ref in (v_src.owner_request_source,v_src.continuity_source,v_src.clarification_source,
   v_src.recheck_source,v_src.original_owner_renewal_source,v_src.confirmation_source,v_src.reassessment_source,
   v_src.renewal_source,v_src.followup_source,v_src.outcome_source,v_src.comparison_source,v_src.handoff_source)
  or public.ywi_465_assert_proposal(p_company_id,v_src.proposal_id) is distinct from v_actor
  or not exists(select 1 from pg_catalog.jsonb_array_elements(v_base->'owner_renewal_requests') x
   where (x.value->>'id')::uuid=p_owner_request_id)
 then raise exception '476 real owner renewal and original reviewer chain required: HOLD';end if;
 select x.value into v_case from pg_catalog.jsonb_array_elements(v_base->'handoff_source'->'cases') x
 where (x.value->>'proposal_id')::uuid=v_src.proposal_id;
 if v_case is null or (v_case->>'service_enabled') is distinct from 'true'
  or (v_case->>'owner_user_id') is distinct from v_src.owner_user_id::text
  or (v_case->>'proposed_reviewer_user_id') is distinct from v_actor::text
 then raise exception '476 company service or original reviewer changed: HOLD';end if;
 select * into v_old from public.ywi_renewal_reviewer_receipts_476
 where company_id=p_company_id and (operation_id=p_operation_id or owner_request_id=p_owner_request_id) for update;
 if found then
  if v_old.operation_id is distinct from p_operation_id or v_old.owner_request_id is distinct from p_owner_request_id
   or v_old.reviewer_user_id is distinct from v_actor or v_old.disposition is distinct from p_disposition
   or v_old.source_reference is distinct from v_ref or v_old.notes is distinct from v_notes
  then raise exception '476 independent reviewer replay differs: HOLD';end if;
  v_id:=v_old.id;
 else
  if (select count(*) from public.ywi_renewal_reviewer_receipts_476 where company_id=p_company_id)>=60
  then raise exception '476 reviewer receipt capacity: HOLD';end if;
  insert into public.ywi_renewal_reviewer_receipts_476(company_id,operation_id,owner_request_id,reviewer_user_id,disposition,source_reference,notes)
  values(p_company_id,p_operation_id,p_owner_request_id,v_actor,p_disposition,v_ref,v_notes) returning id into v_id;
 end if;
 return pg_catalog.jsonb_build_object('id',v_id,'company_id',p_company_id,'recorded',true,
  'field_accepted',false,'service_authorized',false,'independent_reapproval',false,
  'reassignment_executed',false,'release_green',false,'outbound_actions',false);
end $$;

create or replace function public.ywi_rpc_reviewer_renewal_workspace_476(p_company_id uuid)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();v_base jsonb;v_clock timestamptz;
 v_aging jsonb;v_receipts jsonb;v_count integer;v_requests integer;
begin
 v_base:=public.ywi_rpc_owner_renewal_workspace_475(p_company_id);
 if v_actor is null or (v_base->>'viewer_id')::uuid is distinct from v_actor
 then raise exception '476 viewer mismatch: HOLD';end if;
 v_clock:=(v_base->>'captured_at')::timestamptz;
 if exists(select 1 from pg_catalog.jsonb_array_elements(v_base->'owner_renewal_requests') x
  where (x.value->>'created_at')::timestamptz>v_clock)
 then raise exception '476 future owner renewal evidence: HOLD';end if;
 select count(*) into v_requests from pg_catalog.jsonb_array_elements(v_base->'owner_renewal_requests');
 select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
  'owner_request_id',x.value->>'id','continuity_review_id',x.value->>'continuity_review_id',
  'age_days',greatest(0,pg_catalog.floor(extract(epoch from (v_clock-(x.value->>'created_at')::timestamptz))/86400)::integer),
  'band',case when v_clock-(x.value->>'created_at')::timestamptz>=interval '15 days' then 'overdue'
       when v_clock-(x.value->>'created_at')::timestamptz>=interval '8 days' then 'aging' else 'current' end
 ) order by (x.value->>'created_at')::timestamptz desc),'[]'::jsonb)
 into v_aging from pg_catalog.jsonb_array_elements(v_base->'owner_renewal_requests') x;
 select count(*) into v_count from public.ywi_renewal_reviewer_receipts_476 r
 where r.company_id=p_company_id and exists(select 1 from pg_catalog.jsonb_array_elements(v_base->'owner_renewal_requests') x
  where (x.value->>'id')::uuid=r.owner_request_id);
 if v_count>60 then raise exception '476 independent reviewer sample capped: HOLD';end if;
 select coalesce(pg_catalog.jsonb_agg(to_jsonb(x) order by x.created_at desc,x.id desc),'[]'::jsonb)
 into v_receipts from (
  select r.id,r.company_id,r.owner_request_id,r.reviewer_user_id,r.disposition,r.source_reference,r.created_at
  from public.ywi_renewal_reviewer_receipts_476 r where r.company_id=p_company_id
   and exists(select 1 from pg_catalog.jsonb_array_elements(v_base->'owner_renewal_requests') k
    where (k.value->>'id')::uuid=r.owner_request_id)
  order by r.created_at desc,r.id desc limit 60) x;
 return v_base||pg_catalog.jsonb_build_object('reviewer_renewal_as_of',v_clock,
  'owner_renewal_evidence_aging',v_aging,'owner_renewal_evidence_age_total',v_requests,
  'reviewer_followup_receipts',v_receipts,'reviewer_followup_receipt_total',v_count,'reviewer_followup_receipt_sample_capped',false);
end $$;
revoke all on function public.ywi_rpc_reviewer_renewal_receipt_476(uuid,uuid,uuid,text,text,text) from public,anon,authenticated;
revoke all on function public.ywi_rpc_reviewer_renewal_workspace_476(uuid) from public,anon,authenticated;
grant execute on function public.ywi_rpc_reviewer_renewal_receipt_476(uuid,uuid,uuid,text,text,text) to authenticated;
grant execute on function public.ywi_rpc_reviewer_renewal_workspace_476(uuid) to authenticated;
comment on table public.ywi_renewal_reviewer_receipts_476 is
 'Original separate reviewer immutable documentary follow-up to verified 475 owner renewal evidence. All operational/communication/integration actions HOLD.';
commit;
