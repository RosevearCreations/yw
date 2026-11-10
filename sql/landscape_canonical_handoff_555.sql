-- YW 555: independently verified, owner-only bridge from a 554 booking proposal
-- to EXISTING canonical Jobs and original Crew/Dispatch evidence.
-- Requires 421/422/432/434/553/554 installed. Does not create, schedule,
-- dispatch, communicate, charge, or change original operational records.
-- Original Jobs/Dispatch retain their own separate creation/release authority.

create table if not exists public.ywi_landscape_canonical_handoffs_555 (
 company_id uuid not null references public.ywi_companies(id) on delete restrict,
 request_id uuid not null references public.ywi_landscape_booking_requests_552(id) on delete restrict,
 estimate_id uuid not null references public.estimates(id) on delete restrict,
 quote_package_id uuid not null references public.estimate_quote_packages(id) on delete restrict,
 work_order_id uuid references public.work_orders(id) on delete restrict,
 dispatch_id uuid references public.dispatch_schedule_items(id) on delete restrict,
 state text not null check(state in ('awaiting_original_job','awaiting_crew_dispatch','verified_crew_handoff')),
 handoff_version integer not null check(handoff_version between 1 and 10000),
 decision_version integer not null,
 source_accepted_at timestamptz not null,
 proposed_start timestamptz not null,
 proposed_end timestamptz not null,
 evidence_checked_at timestamptz not null default now(),
 actor_user_id uuid not null references auth.users(id) on delete restrict,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 primary key(company_id,request_id),
 unique(company_id,estimate_id),
 unique(company_id,quote_package_id),
 unique(company_id,work_order_id),
 unique(company_id,dispatch_id),
 check ((state='awaiting_original_job' and work_order_id is null and dispatch_id is null)
    or (state='awaiting_crew_dispatch' and work_order_id is not null and dispatch_id is null)
    or (state='verified_crew_handoff' and work_order_id is not null and dispatch_id is not null))
);
create table if not exists public.ywi_landscape_handoff_audit_555 (
 id bigint generated always as identity primary key,
 company_id uuid not null,
 request_id uuid not null,
 idempotency_key uuid not null,
 action text not null check(action in ('stage','link_job','verify_crew')),
 payload_hash text not null check(payload_hash ~ '^[0-9a-f]{32}$'),
 handoff_version integer not null,
 state_after jsonb not null check(jsonb_typeof(state_after)='object'),
 actor_user_id uuid not null references auth.users(id) on delete restrict,
 recorded_at timestamptz not null default now(),
 foreign key(company_id,request_id)
  references public.ywi_landscape_canonical_handoffs_555(company_id,request_id) on delete restrict,
 unique(company_id,idempotency_key)
);
create index if not exists ywi_landscape_555_handoff_queue
 on public.ywi_landscape_canonical_handoffs_555(company_id,state,updated_at desc);
create index if not exists ywi_landscape_555_audit_request
 on public.ywi_landscape_handoff_audit_555(company_id,request_id,id desc);

alter table public.ywi_landscape_canonical_handoffs_555 enable row level security;
alter table public.ywi_landscape_handoff_audit_555 enable row level security;
revoke all on public.ywi_landscape_canonical_handoffs_555 from public,anon,authenticated;
revoke all on public.ywi_landscape_handoff_audit_555 from public,anon,authenticated;
revoke all on sequence public.ywi_landscape_handoff_audit_555_id_seq from public,anon,authenticated;
grant select on public.ywi_landscape_canonical_handoffs_555 to authenticated;
grant select on public.ywi_landscape_handoff_audit_555 to authenticated;
drop policy if exists ywi_landscape_555_owner_handoff_read on public.ywi_landscape_canonical_handoffs_555;
create policy ywi_landscape_555_owner_handoff_read on public.ywi_landscape_canonical_handoffs_555
 for select to authenticated using (
 (select auth.uid()) is not null and coalesce((auth.jwt()->>'is_anonymous')::boolean,false)=false
 and exists(select 1 from public.ywi_companies c where c.id=company_id
  and c.owner_user_id=(select auth.uid())));
drop policy if exists ywi_landscape_555_owner_audit_read on public.ywi_landscape_handoff_audit_555;
create policy ywi_landscape_555_owner_audit_read on public.ywi_landscape_handoff_audit_555
 for select to authenticated using (
 (select auth.uid()) is not null and coalesce((auth.jwt()->>'is_anonymous')::boolean,false)=false
 and exists(select 1 from public.ywi_companies c where c.id=company_id
  and c.owner_user_id=(select auth.uid())));

-- Bounded, owner-scoped discovery from ORIGINAL Estimates/Quotes/Jobs/Dispatch.
-- This is only candidate evidence; the write RPC repeats every source check.
create or replace function public.ywi_rpc_landscape_handoff_candidates_555(
 p_company_id uuid,p_request_id uuid
) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_decision public.ywi_landscape_booking_decisions_554%rowtype;
 v_request public.ywi_landscape_booking_requests_552%rowtype;
 v_items jsonb;
begin
 perform public.ywi_422_assert_owner(p_company_id);
 select * into v_decision from public.ywi_landscape_booking_decisions_554
  where company_id=p_company_id and request_id=p_request_id;
 if not found or v_decision.decision_state<>'approved_pending_dispatch' then
  raise exception '555 approved company booking proposal unavailable';
 end if;
 perform public.ywi_422_assert_link(p_company_id,v_decision.client_id,v_decision.client_site_id);
 select * into v_request from public.ywi_landscape_booking_requests_552
  where company_id=p_company_id and id=p_request_id;
 select coalesce(jsonb_agg(to_jsonb(t) order by t.estimate_created_at desc),'[]'::jsonb)
 into v_items from (
  select e.id as estimate_id,e.estimate_number,e.created_at as estimate_created_at,
   q.id as quote_package_id,q.package_status as quote_state,q.accepted_at,
   nullif(btrim(coalesce(q.accepted_by_name,'')),'') is not null as customer_named,
   nullif(btrim(coalesce(q.portal_terms_version,'')),'') is not null as terms_recorded,
   w.id as work_order_id,w.work_order_number,w.status as job_state,
   d.id as dispatch_id,d.schedule_status as dispatch_state,
   d.scheduled_start as dispatch_start,d.scheduled_end as dispatch_end,
   d.crew_id is not null as crew_selected
  from public.estimates e
  join public.estimate_quote_packages q on q.estimate_id=e.id
  left join public.work_orders w on w.estimate_id=e.id and w.company_id=p_company_id
  left join public.dispatch_schedule_items d on d.work_order_id=w.id
  where e.company_id=p_company_id and e.service_module_key='landscape'
   and e.client_id=v_decision.client_id and e.client_site_id=v_decision.client_site_id
   and e.created_at>=v_request.created_at and e.status='accepted'
   and q.package_status='accepted' and q.accepted_at>=v_request.created_at
  order by e.created_at desc,q.accepted_at desc,d.scheduled_start desc nulls last
  limit 40
 ) t;
 return jsonb_build_object('company_id',p_company_id,'request_id',p_request_id,
  'retrieved_at',now(),'candidates',v_items,'source','original_213_421_422_434',
  'read_only',true,'authorizes_dispatch',false);
end $$;
revoke all on function public.ywi_rpc_landscape_handoff_candidates_555(uuid,uuid)
 from public,anon,authenticated;
grant execute on function public.ywi_rpc_landscape_handoff_candidates_555(uuid,uuid) to authenticated;

create or replace function public.ywi_rpc_landscape_canonical_handoff_555(
 p_company_id uuid,p_request_id uuid,p_action text,p_idempotency_key uuid,
 p_expected_version integer,p_decision_version integer,p_estimate_id uuid,
 p_quote_package_id uuid,p_work_order_id uuid default null,p_dispatch_id uuid default null,
 p_owner_attested boolean default false
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
 v_request public.ywi_landscape_booking_requests_552%rowtype;
 v_decision public.ywi_landscape_booking_decisions_554%rowtype;
 v_previous public.ywi_landscape_canonical_handoffs_555%rowtype;
 v_repeat public.ywi_landscape_handoff_audit_555%rowtype;
 v_estimate public.estimates%rowtype;
 v_quote public.estimate_quote_packages%rowtype;
 v_job public.work_orders%rowtype;
 v_dispatch public.dispatch_schedule_items%rowtype;
 v_availability jsonb;
 v_preflight jsonb;
 v_dispatch_proof jsonb;
 v_hash text;
 v_version integer;
 v_state text;
 v_after jsonb;
 v_required numeric;
 v_paid numeric;
 v_other_pending_minutes integer;
begin
 perform public.ywi_422_assert_owner(p_company_id);
 perform public.ywi_422_assert_jobs_create();
 if p_request_id is null or p_estimate_id is null or p_quote_package_id is null or
    p_idempotency_key is null or p_action is null or
    p_action not in ('stage','link_job','verify_crew') or
    p_expected_version is null or p_expected_version not between 0 and 9999 or
    p_decision_version is null or p_decision_version not between 1 and 10000 or
    p_owner_attested is distinct from true then
   raise exception '555 owner action, expected version, source IDs or attestation invalid';
 end if;
 if (p_action='stage' and (p_work_order_id is not null or p_dispatch_id is not null)) or
    (p_action='link_job' and (p_work_order_id is null or p_dispatch_id is not null)) or
    (p_action='verify_crew' and (p_work_order_id is null or p_dispatch_id is null)) then
   raise exception '555 handoff stage cannot skip original Jobs/Dispatch verification';
 end if;
 v_hash:=md5(jsonb_build_object('action',p_action,'expected',p_expected_version,
  'decision',p_decision_version,'estimate',p_estimate_id,'quote',p_quote_package_id,
  'job',p_work_order_id,'dispatch',p_dispatch_id,'attested',p_owner_attested)::text);
 -- Lock the original request and proposal for concurrent idempotency/revision checks.
 select * into v_request from public.ywi_landscape_booking_requests_552
  where company_id=p_company_id and id=p_request_id for update;
 if not found then raise exception '555 original company booking request unavailable'; end if;
 select * into v_repeat from public.ywi_landscape_handoff_audit_555
  where company_id=p_company_id and idempotency_key=p_idempotency_key;
 if found then
  if v_repeat.request_id<>p_request_id or v_repeat.payload_hash<>v_hash then
   raise exception '555 idempotency key reused with changed payload';
  end if;
  return jsonb_build_object('company_id',p_company_id,'request_id',p_request_id,
   'state',v_repeat.state_after,'idempotent_replay',true,'original_source_writes',false);
 end if;
 select * into v_decision from public.ywi_landscape_booking_decisions_554
  where company_id=p_company_id and request_id=p_request_id for update;
 if not found or v_decision.decision_state<>'approved_pending_dispatch' or
    v_decision.decision_version<>p_decision_version or
    v_decision.proposed_start is null or v_decision.proposed_end is null or
    v_decision.client_id is null or v_decision.client_site_id is null or
    v_decision.owner_checked_site_safety is not true then
   raise exception '555 a current, owner-approved YW554 proposal is required';
 end if;
 perform public.ywi_421_assert_company_new_work(p_company_id,'landscape',
  v_decision.client_id,v_decision.client_site_id);
 perform public.ywi_422_assert_link(p_company_id,v_decision.client_id,v_decision.client_site_id);
 select * into v_previous from public.ywi_landscape_canonical_handoffs_555
  where company_id=p_company_id and request_id=p_request_id for update;
 v_version:=case when found then v_previous.handoff_version else 0 end;
 if v_version<>p_expected_version then
   raise exception '555 handoff state changed; refresh before acting';
 end if;
 if v_version=0 and p_action<>'stage' or
    v_version>0 and (p_estimate_id<>v_previous.estimate_id or
      p_quote_package_id<>v_previous.quote_package_id or
      p_decision_version<>v_previous.decision_version) then
   raise exception '555 immutable source pair or prior staged handoff missing';
 end if;
 if v_previous.state='verified_crew_handoff' or
    (v_previous.state='awaiting_original_job' and p_action<>'link_job' and v_version>0) or
    (v_previous.state='awaiting_crew_dispatch' and p_action<>'verify_crew') then
   raise exception '555 handoff already complete or phase order invalid';
 end if;
 -- An independently recorded, customer-accepted ORIGINAL estimate is required;
 -- owner checkbox or a 554 scheduling proposal cannot stand in for consent.
 select * into v_estimate from public.estimates where id=p_estimate_id for update;
 if not found or v_estimate.company_id is distinct from p_company_id or
    v_estimate.service_module_key is distinct from 'landscape' or
    v_estimate.client_id is distinct from v_decision.client_id or
    v_estimate.client_site_id is distinct from v_decision.client_site_id or
    v_estimate.status<>'accepted' or
    (v_estimate.approval_required and v_estimate.approval_status<>'approved') or
    v_estimate.created_at<v_request.created_at then
   raise exception '555 original accepted company landscape estimate/customer pair not verified';
 end if;
 select * into v_quote from public.estimate_quote_packages
  where id=p_quote_package_id and estimate_id=p_estimate_id for update;
 if not found or v_quote.package_status<>'accepted' or v_quote.accepted_at is null or
    v_quote.accepted_at<v_request.created_at or
    nullif(btrim(coalesce(v_quote.accepted_by_name,'')),'') is null or
    nullif(btrim(coalesce(v_quote.portal_terms_version,'')),'') is null then
   raise exception '555 original customer quote acceptance and terms proof unavailable';
 end if;
 v_required:=greatest(coalesce(v_estimate.deposit_required_amount,0),
  round(coalesce(v_estimate.total_amount,0)*coalesce(v_estimate.deposit_required_percent,0)/100.0,2),
  coalesce(v_quote.deposit_required_amount,0));
 select coalesce(sum(d.paid_amount) filter(where d.deposit_status='paid' and d.paid_at is not null),0)
   into v_paid from public.customer_deposit_requests d where d.estimate_id=p_estimate_id;
 if v_paid<v_required then raise exception '555 original required deposit not recorded as paid'; end if;
 if p_action='stage' then
   -- Re-evaluate current 553 and the 554 proposal under the same company/day lock.
   perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(p_company_id::text),
    pg_catalog.hashtext(((v_decision.proposed_start at time zone 'America/Toronto')::date)::text));
   v_availability:=public.ywi_rpc_landscape_availability_553(p_company_id,p_request_id,
    (v_decision.proposed_start at time zone 'America/Toronto')::date);
   select coalesce(sum(x.planned_minutes),0)::integer into v_other_pending_minutes
    from public.ywi_landscape_booking_decisions_554 x
    where x.company_id=p_company_id and x.request_id<>p_request_id
     and x.decision_state='approved_pending_dispatch'
     and (x.proposed_start at time zone 'America/Toronto')::date=
      (v_decision.proposed_start at time zone 'America/Toronto')::date;
   if v_decision.proposed_start<=now() or
      v_availability->>'availability_state'<>'review' or
      v_availability->>'coverage_state'<>'included' or
      v_availability->>'schedule_state'<>'company_dispatch_verified' or
      v_availability->>'capacity_state'<>'potential_headroom' or
      coalesce((v_availability->>'missing_crew_assignment_count')::integer,0)>0 or
      coalesce((v_availability->>'not_ready_asset_count')::integer,0)>0 or
      coalesce((v_availability->>'remaining_minutes_advisory')::integer,0)
       <v_decision.planned_minutes+v_other_pending_minutes then
     raise exception '555 company coverage, live crew capacity or original dispatch proof changed';
   end if;
   v_state:='awaiting_original_job';
 elsif p_action='link_job' then
   select * into v_job from public.work_orders where id=p_work_order_id for update;
   if not found or v_job.company_id is distinct from p_company_id or
      v_job.service_module_key is distinct from 'landscape' or
      v_job.estimate_id is distinct from p_estimate_id or
      v_job.client_id is distinct from v_decision.client_id or
      v_job.client_site_id is distinct from v_decision.client_site_id or
      lower(v_job.status) in ('cancelled','canceled','closed','completed') or
      v_estimate.converted_work_order_id is distinct from p_work_order_id or
      not exists (select 1 from public.ywi_new_work_gate_receipts_421 g where
       g.company_id=p_company_id and g.service_module_key='landscape' and
       g.target_table='work_orders' and g.target_id=p_work_order_id) then
     raise exception '555 original canonical Jobs lineage, CRM or new-work receipt missing';
   end if;
   if (select count(*) from public.work_orders where estimate_id=p_estimate_id)<>1 then
     raise exception '555 duplicate original work orders for one accepted estimate';
   end if;
   v_state:='awaiting_crew_dispatch';
 else
   if v_previous.work_order_id is distinct from p_work_order_id then
     raise exception '555 a verified linked canonical Job is required before crew handoff';
   end if;
   select * into v_job from public.work_orders where id=p_work_order_id for update;
   select * into v_dispatch from public.dispatch_schedule_items where id=p_dispatch_id for update;
   if v_job.id is null or v_job.company_id is distinct from p_company_id or
      v_job.estimate_id is distinct from p_estimate_id or
      v_job.client_id is distinct from v_decision.client_id or
      v_job.client_site_id is distinct from v_decision.client_site_id or
      v_job.legacy_job_id is null or v_dispatch.id is null or
      v_dispatch.work_order_id is distinct from p_work_order_id or
      v_dispatch.job_id is distinct from v_job.legacy_job_id or
      v_dispatch.client_site_id is distinct from v_decision.client_site_id or
      v_dispatch.scheduled_start is distinct from v_decision.proposed_start or
      v_dispatch.scheduled_end is distinct from v_decision.proposed_end or
      v_dispatch.schedule_status not in ('scheduled','dispatched') or
      v_dispatch.crew_id is null or
      jsonb_array_length(coalesce(v_dispatch.assigned_crew_profile_ids,'[]'::jsonb))=0 then
     raise exception '555 original Dispatch crew, job and approved slot do not match';
   end if;
   v_preflight:=public.ywi_rpc_job_dispatch_preflight_434(p_company_id,
    v_decision.client_id,v_decision.client_site_id,p_work_order_id);
   select d into v_dispatch_proof from jsonb_array_elements(coalesce(v_preflight->'dispatches','[]'::jsonb)) d
    where d->>'id'=p_dispatch_id::text limit 1;
   if v_preflight->>'service_enabled'<>'true' or
      v_preflight->>'release_signed'<>'true' or
      v_dispatch_proof is null or
      v_dispatch_proof->>'site_matches'<>'true' or
      coalesce((v_dispatch_proof->>'crew_members')::integer,0)=0 or
      v_dispatch_proof->>'lead_recorded'<>'true' or
      v_dispatch_proof->>'supervisor_recorded'<>'true' or
      coalesce(v_dispatch_proof->>'crew_status','') in ('','inactive','archived','suspended') or
      v_dispatch_proof->>'conflicts_checked'<>'true' or
      coalesce((v_dispatch_proof->>'conflict_count')::integer,-1)<>0 or
      coalesce(v_dispatch_proof->>'workability_state','') not in ('workable','caution') or
      exists(select 1 from jsonb_array_elements(coalesce(v_dispatch_proof->'equipment','[]'::jsonb)) a
        where coalesce((a->>'locked_out')::boolean,false)=true or
         lower(coalesce(a->>'status','')) ~ '(lockout|out.of.service|maintenance|unavailable)' or
         lower(coalesce(a->>'fleet_status','')) ~ '(blocked|unavailable|out.of.service)') then
      raise exception '555 original Jobs release, crew, Dispatch conflict or Safety preflight on HOLD';
   end if;
   v_state:='verified_crew_handoff';
 end if;
 insert into public.ywi_landscape_canonical_handoffs_555
  (company_id,request_id,estimate_id,quote_package_id,work_order_id,dispatch_id,
   state,handoff_version,decision_version,source_accepted_at,proposed_start,proposed_end,actor_user_id)
 values (p_company_id,p_request_id,p_estimate_id,p_quote_package_id,p_work_order_id,p_dispatch_id,
   v_state,v_version+1,p_decision_version,v_quote.accepted_at,
   v_decision.proposed_start,v_decision.proposed_end,auth.uid())
 on conflict(company_id,request_id) do update set
  work_order_id=excluded.work_order_id,dispatch_id=excluded.dispatch_id,state=excluded.state,
  handoff_version=excluded.handoff_version,evidence_checked_at=now(),
  actor_user_id=excluded.actor_user_id,updated_at=now();
 select to_jsonb(h) into v_after from public.ywi_landscape_canonical_handoffs_555 h
  where h.company_id=p_company_id and h.request_id=p_request_id;
 insert into public.ywi_landscape_handoff_audit_555
  (company_id,request_id,idempotency_key,action,payload_hash,handoff_version,state_after,actor_user_id)
 values (p_company_id,p_request_id,p_idempotency_key,p_action,v_hash,v_version+1,v_after,auth.uid());
 return jsonb_build_object('company_id',p_company_id,'request_id',p_request_id,
  'state',v_after,'idempotent_replay',false,'original_source_writes',false,
  'customer_message_sent',false,'crew_dispatched_by_555',false,
  'canonical_job_created_by_555',false);
end $$;
revoke all on function public.ywi_rpc_landscape_canonical_handoff_555(
 uuid,uuid,text,uuid,integer,integer,uuid,uuid,uuid,uuid,boolean
) from public,anon,authenticated;
grant execute on function public.ywi_rpc_landscape_canonical_handoff_555(
 uuid,uuid,text,uuid,integer,integer,uuid,uuid,uuid,uuid,boolean
) to authenticated;
comment on function public.ywi_rpc_landscape_canonical_handoff_555(
 uuid,uuid,text,uuid,integer,integer,uuid,uuid,uuid,uuid,boolean
) is 'YW555 independently verifies original accepted estimate/terms/deposit and later original Jobs/Dispatch crew receipts; no original source mutations, no auto scheduling or communication.';
