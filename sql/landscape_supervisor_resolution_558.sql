-- YW558: original Dispatch escalation resolution intent and customer reconfirmation gate.
-- Requires YW553-557 and the original 421/422/434/435 Dispatch authority.
-- No original Job, Dispatch, assignment, customer confirmation or message is changed.

create table if not exists public.ywi_landscape_resolution_events_558 (
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null,
 request_id uuid not null,
 case_version integer not null check(case_version between 1 and 10000),
 dispatch_id uuid not null references public.dispatch_schedule_items(id) on delete restrict,
 dispatch_signature text not null check(dispatch_signature ~ '^[0-9a-f]{32}$'),
 supervisor_ack_id uuid not null references public.ywi_landscape_supervisor_acknowledgements_557(id) on delete restrict,
 action text not null check(action in ('escalation_reviewed','reconfirmation_requested')),
 owner_note text not null check(char_length(btrim(owner_note)) between 10 and 500),
 owner_user_id uuid not null references auth.users(id) on delete restrict,
 idempotency_key uuid not null,
 payload_hash text not null check(payload_hash ~ '^[0-9a-f]{32}$'),
 recorded_at timestamptz not null default now(),
 foreign key(company_id,request_id) references public.ywi_landscape_recovery_cases_556(company_id,request_id) on delete restrict,
 unique(company_id,request_id,case_version,action),
 unique(company_id,idempotency_key)
);
create index if not exists ywi_landscape_558_timeline
 on public.ywi_landscape_resolution_events_558(company_id,request_id,recorded_at desc);
alter table public.ywi_landscape_resolution_events_558 enable row level security;
revoke all on public.ywi_landscape_resolution_events_558 from public,anon,authenticated;
grant select on public.ywi_landscape_resolution_events_558 to authenticated;
drop policy if exists ywi_landscape_558_owner_read on public.ywi_landscape_resolution_events_558;
create policy ywi_landscape_558_owner_read on public.ywi_landscape_resolution_events_558
 for select to authenticated using (
 (select auth.uid()) is not null
 and coalesce((auth.jwt()->>'is_anonymous')::boolean,false)=false
 and exists(select 1 from public.ywi_companies c
   where c.id=company_id and c.owner_user_id=(select auth.uid())));

-- Writes are via owner-only RPC. A mitigation acknowledgement remains HOLD;
-- reconfirmation is only a readiness intent, never a customer response.
create or replace function public.ywi_rpc_landscape_resolution_558(
 p_company_id uuid,p_request_id uuid,p_expected_case_version integer,
 p_expected_dispatch_signature text,p_action text,p_note text,
 p_idempotency_key uuid,p_owner_attested boolean
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_case public.ywi_landscape_recovery_cases_556%rowtype;
 v_ack public.ywi_landscape_supervisor_acknowledgements_557%rowtype;
 v_dispatch public.dispatch_schedule_items%rowtype;
 v_customer public.ywi_landscape_customer_confirmations_556%rowtype;
 v_event public.ywi_landscape_resolution_events_558%rowtype;
 v_review jsonb;v_payload_hash text;v_result text;
begin
 perform public.ywi_422_assert_owner(p_company_id);
 perform public.ywi_422_assert_jobs_create();
 if p_request_id is null or p_idempotency_key is null or
  p_expected_case_version is null or p_expected_case_version not between 1 and 10000 or
  p_expected_dispatch_signature !~ '^[0-9a-f]{32}$' or
  p_action not in ('escalation_reviewed','reconfirmation_requested') or
  char_length(btrim(coalesce(p_note,''))) not between 10 and 500 or
  p_owner_attested is distinct from true then
  raise exception '558 owner, original source or attestation invalid'; end if;
 perform pg_advisory_xact_lock(hashtextextended('yw556:'||p_company_id::text||':'||p_request_id::text,0));
 select * into v_case from public.ywi_landscape_recovery_cases_556
  where company_id=p_company_id and request_id=p_request_id for update;
 if not found or v_case.case_version is distinct from p_expected_case_version or
  v_case.state='closed_verified' then
  raise exception '558 original recovery case changed or closed; refresh'; end if;
 select * into v_dispatch from public.dispatch_schedule_items
  where id=coalesce(v_case.replacement_dispatch_id,v_case.original_dispatch_id);
 if not found or v_dispatch.work_order_id is distinct from v_case.work_order_id or
  v_dispatch.schedule_status not in ('scheduled','dispatched') or
  exists(select 1 from public.dispatch_schedule_items newer where newer.supersedes_dispatch_id=v_dispatch.id) or
  public.ywi_landscape_dispatch_signature_557(v_dispatch.id) is distinct from p_expected_dispatch_signature or
  not exists(select 1 from public.work_orders w where w.id=v_case.work_order_id and w.company_id=p_company_id) then
  raise exception '558 original company Dispatch or current signature changed'; end if;
 select * into v_ack from public.ywi_landscape_supervisor_acknowledgements_557
  where company_id=p_company_id and request_id=p_request_id and case_version=v_case.case_version;
 if not found or v_ack.dispatch_id is distinct from v_dispatch.id or
  v_ack.dispatch_signature is distinct from p_expected_dispatch_signature or
  v_ack.supervisor_profile_id is distinct from v_dispatch.assigned_supervisor_profile_id then
  raise exception '558 current independently authenticated original supervisor receipt required'; end if;
 v_payload_hash:=md5(jsonb_build_object('company',p_company_id,'request',p_request_id,
  'case_version',p_expected_case_version,'signature',p_expected_dispatch_signature,
  'action',p_action,'note',btrim(p_note))::text);
 select * into v_event from public.ywi_landscape_resolution_events_558
  where company_id=p_company_id and idempotency_key=p_idempotency_key;
 if found then
  if v_event.request_id<>p_request_id or v_event.case_version<>p_expected_case_version or
   v_event.payload_hash<>v_payload_hash or v_event.owner_user_id is distinct from auth.uid() then
   raise exception '558 idempotency key reused with different action'; end if;
  return jsonb_build_object('status',case when v_event.action='escalation_reviewed'
    then 'ESCALATION_REVIEWED_HOLD' else 'RECONFIRMATION_GATE_READY_ONLY' end,
   'receipt_id',v_event.id,'case_version',v_event.case_version,
   'customer_confirmed',false,'dispatch_authorized',false,'replayed',true);
 end if;
 if p_action='escalation_reviewed' then
  if v_ack.acknowledgement<>'escalated' then
   raise exception '558 only an original supervisor escalation may be reviewed'; end if;
  v_result:='ESCALATION_REVIEWED_HOLD';
 else
  if v_ack.acknowledgement<>'reviewed' or v_case.state<>'replacement_pending_customer' or
   v_case.replacement_dispatch_id is distinct from v_dispatch.id then
   raise exception '558 fresh original supervisor review and replacement customer gate required'; end if;
  select * into v_customer from public.ywi_landscape_customer_confirmations_556
   where company_id=p_company_id and request_id=p_request_id and case_version=v_case.case_version;
  if found then raise exception '558 customer already decided; cannot request duplicate confirmation'; end if;
  -- Recheck real replacement crew, time, safety, and source Dispatch preflight.
  perform public.ywi_landscape_replacement_proof_556(p_company_id,p_request_id,v_dispatch.id);
  v_review:=public.ywi_rpc_landscape_recovery_review_557(p_company_id,p_request_id);
  if v_review->>'status'<>'ACKNOWLEDGED_REVIEW_ONLY' or
   v_review->>'current_dispatch_signature'<>p_expected_dispatch_signature then
   raise exception '558 original capacity or supervisor review HOLD'; end if;
  v_result:='RECONFIRMATION_GATE_READY_ONLY';
 end if;
 if exists(select 1 from public.ywi_landscape_resolution_events_558 r
  where r.company_id=p_company_id and r.request_id=p_request_id
   and r.case_version=p_expected_case_version and r.action=p_action) then
  raise exception '558 current-version disposition already recorded'; end if;
 insert into public.ywi_landscape_resolution_events_558
  (company_id,request_id,case_version,dispatch_id,dispatch_signature,
   supervisor_ack_id,action,owner_note,owner_user_id,idempotency_key,payload_hash)
 values(p_company_id,p_request_id,p_expected_case_version,v_dispatch.id,
  p_expected_dispatch_signature,v_ack.id,p_action,btrim(p_note),auth.uid(),
  p_idempotency_key,v_payload_hash) returning * into v_event;
 return jsonb_build_object('status',v_result,'receipt_id',v_event.id,
  'case_version',p_expected_case_version,'customer_confirmed',false,
  'dispatch_authorized',false,'customer_message_sent',false,
  'original_dispatch_mutated',false,'replayed',false);
end $$;
revoke all on function public.ywi_rpc_landscape_resolution_558(uuid,uuid,integer,text,text,text,uuid,boolean)
 from public,anon,authenticated;
grant execute on function public.ywi_rpc_landscape_resolution_558(uuid,uuid,integer,text,text,text,uuid,boolean)
 to authenticated;

-- Company-owner-only read model. Immutable source timeline; no customer PII.
create or replace function public.ywi_rpc_landscape_audit_timeline_558(
 p_company_id uuid,p_request_id uuid
) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_case public.ywi_landscape_recovery_cases_556%rowtype;
 v_review jsonb;v_events jsonb;v_customer jsonb;v_ack jsonb;
begin
 perform public.ywi_422_assert_owner(p_company_id);
 select * into v_case from public.ywi_landscape_recovery_cases_556
  where company_id=p_company_id and request_id=p_request_id;
 if not found then raise exception '558 recovery case missing in owned company'; end if;
 v_review:=public.ywi_rpc_landscape_recovery_review_557(p_company_id,p_request_id);
 select coalesce(jsonb_agg(jsonb_build_object('type',e.kind,'at',e.at,
  'action',e.action,'version',e.case_version,'receipt_id',e.receipt_id)
  order by e.at,e.sort_id),'[]'::jsonb) into v_events from (
  select 'recovery'::text kind,a.recorded_at at,a.action,a.case_version,
   a.id::text receipt_id,a.id sort_id
  from public.ywi_landscape_recovery_audit_556 a
  where a.company_id=p_company_id and a.request_id=p_request_id
  union all select 'supervisor',s.recorded_at,s.acknowledgement,s.case_version,
   s.id::text,0 from public.ywi_landscape_supervisor_acknowledgements_557 s
  where s.company_id=p_company_id and s.request_id=p_request_id
  union all select 'owner_resolution',r.recorded_at,r.action,r.case_version,
   r.id::text,0 from public.ywi_landscape_resolution_events_558 r
  where r.company_id=p_company_id and r.request_id=p_request_id
  union all select 'customer_portal',c.recorded_at,c.decision,c.case_version,
   c.id::text,0 from public.ywi_landscape_customer_confirmations_556 c
  where c.company_id=p_company_id and c.request_id=p_request_id
 ) e;
 select jsonb_build_object('decision',c.decision,'recorded_at',c.recorded_at,'receipt_id',c.id)
  into v_customer from public.ywi_landscape_customer_confirmations_556 c
  where c.company_id=p_company_id and c.request_id=p_request_id
   and c.case_version=v_case.case_version;
 v_ack:=v_review->'acknowledgement';
 return jsonb_build_object('company_id',p_company_id,'request_id',p_request_id,
  'case_version',v_case.case_version,'case_state',v_case.state,
  'current_dispatch_id',v_review->'current_dispatch_id',
  'current_dispatch_signature',v_review->'current_dispatch_signature',
  'original_review_status',v_review->'status','supervisor_kind',v_ack->>'kind',
  'customer_reconfirmation',case when v_customer is not null then v_customer
   when v_case.state='replacement_pending_customer' then jsonb_build_object('decision','PENDING_ORIGINAL_PORTAL')
   else jsonb_build_object('decision','NOT_APPLICABLE') end,
  'events',v_events,'read_only',true,'company_scope_only',true,
  'dispatch_authorized',false,'customer_confirmation_authorized',false,
  'master_shell_connection_proven',false,'checked_at',now());
end $$;
revoke all on function public.ywi_rpc_landscape_audit_timeline_558(uuid,uuid) from public,anon,authenticated;
grant execute on function public.ywi_rpc_landscape_audit_timeline_558(uuid,uuid) to authenticated;

comment on table public.ywi_landscape_resolution_events_558 is
 'Owner resolution intent is not original Dispatch authorization or a customer reconfirmation. Only original token-validated service-role portal can record the decision.';
