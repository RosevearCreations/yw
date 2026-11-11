-- YW559: immutable, owner-scoped post-closure review and customer follow-up intent.
-- Requires original 553-558 SQL and 422 owner authority. This NEVER closes
-- the original recovery case, dispatches a crew, confirms a customer or sends a message.

create table if not exists public.ywi_landscape_closure_evidence_559 (
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null,
 request_id uuid not null,
 case_version integer not null check(case_version between 2 and 10000),
 dispatch_id uuid not null references public.dispatch_schedule_items(id) on delete restrict,
 dispatch_signature text not null check(dispatch_signature ~ '^[0-9a-f]{32}$'),
 supervisor_ack_id uuid not null references public.ywi_landscape_supervisor_acknowledgements_557(id) on delete restrict,
 customer_receipt_id uuid not null references public.ywi_landscape_customer_confirmations_556(id) on delete restrict,
 original_close_audit_id bigint not null references public.ywi_landscape_recovery_audit_556(id) on delete restrict,
 action text not null check(action in
  ('closure_reviewed','supervisor_outcome_reviewed','customer_followup_requested')),
 owner_note text not null check(char_length(btrim(owner_note)) between 10 and 500),
 owner_user_id uuid not null references auth.users(id) on delete restrict,
 idempotency_key uuid not null,
 payload_hash text not null check(payload_hash ~ '^[0-9a-f]{32}$'),
 recorded_at timestamptz not null default now(),
 foreign key(company_id,request_id) references public.ywi_landscape_recovery_cases_556(company_id,request_id) on delete restrict,
 unique(company_id,request_id,case_version,action),
 unique(company_id,idempotency_key)
);
create index if not exists ywi_landscape_559_timeline on
 public.ywi_landscape_closure_evidence_559(company_id,request_id,recorded_at desc);
alter table public.ywi_landscape_closure_evidence_559 enable row level security;
revoke all on public.ywi_landscape_closure_evidence_559 from public,anon,authenticated;
grant select on public.ywi_landscape_closure_evidence_559 to authenticated;
drop policy if exists ywi_landscape_559_owner_read on public.ywi_landscape_closure_evidence_559;
create policy ywi_landscape_559_owner_read on public.ywi_landscape_closure_evidence_559
 for select to authenticated using (
 (select auth.uid()) is not null
 and coalesce((auth.jwt()->>'is_anonymous')::boolean,false)=false
 and exists (select 1 from public.ywi_companies c
  where c.id=company_id and c.owner_user_id=(select auth.uid())));

-- Source proofs are recomputed under a per-case advisory lock on every write.
-- An original 556 close event and genuine portal acceptance are prerequisites.
create or replace function public.ywi_rpc_landscape_closure_record_559(
 p_company_id uuid,p_request_id uuid,p_expected_case_version integer,
 p_expected_dispatch_signature text,p_action text,p_note text,
 p_idempotency_key uuid,p_owner_attested boolean
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_case public.ywi_landscape_recovery_cases_556%rowtype;
 v_dispatch public.dispatch_schedule_items%rowtype;
 v_ack public.ywi_landscape_supervisor_acknowledgements_557%rowtype;
 v_customer public.ywi_landscape_customer_confirmations_556%rowtype;
 v_close public.ywi_landscape_recovery_audit_556%rowtype;
 v_gate public.ywi_landscape_resolution_events_558%rowtype;
 v_event public.ywi_landscape_closure_evidence_559%rowtype;
 v_hash text;v_result text;
begin
 perform public.ywi_422_assert_owner(p_company_id);
 perform public.ywi_422_assert_jobs_create();
 if p_request_id is null or p_idempotency_key is null or
  p_expected_case_version is null or p_expected_case_version not between 2 and 10000 or
  p_expected_dispatch_signature !~ '^[0-9a-f]{32}$' or
  p_action not in ('closure_reviewed','supervisor_outcome_reviewed','customer_followup_requested') or
  char_length(btrim(coalesce(p_note,''))) not between 10 and 500 or
  p_owner_attested is distinct from true then
  raise exception '559 owner, original closure or attestation invalid'; end if;
 perform pg_advisory_xact_lock(hashtextextended(
  'yw556:'||p_company_id::text||':'||p_request_id::text,0));
 select * into v_case from public.ywi_landscape_recovery_cases_556
  where company_id=p_company_id and request_id=p_request_id for update;
 if not found or v_case.state<>'closed_verified' or
  v_case.case_version is distinct from p_expected_case_version or
  v_case.replacement_dispatch_id is null then
  raise exception '559 original 556 closure not verified at current version'; end if;
 select * into v_dispatch from public.dispatch_schedule_items
  where id=v_case.replacement_dispatch_id;
 if not found or v_dispatch.work_order_id is distinct from v_case.work_order_id or
  v_dispatch.schedule_status not in ('scheduled','dispatched') or
  exists(select 1 from public.dispatch_schedule_items newer
   where newer.supersedes_dispatch_id=v_dispatch.id) or
  not exists(select 1 from public.work_orders w
   where w.id=v_case.work_order_id and w.company_id=p_company_id) or
  public.ywi_landscape_dispatch_signature_557(v_dispatch.id)
    is distinct from p_expected_dispatch_signature then
  raise exception '559 original Dispatch identity, status or signature changed'; end if;
 select * into v_ack from public.ywi_landscape_supervisor_acknowledgements_557
  where company_id=p_company_id and request_id=p_request_id
   and case_version=v_case.case_version-1 and acknowledgement='reviewed';
 if not found or v_ack.dispatch_id is distinct from v_dispatch.id or
  v_ack.dispatch_signature is distinct from p_expected_dispatch_signature or
  v_ack.supervisor_profile_id is distinct from v_dispatch.assigned_supervisor_profile_id then
  raise exception '559 original independently authenticated supervisor review absent'; end if;
 select * into v_customer from public.ywi_landscape_customer_confirmations_556
  where company_id=p_company_id and request_id=p_request_id
   and case_version=v_case.case_version-1 and decision='accepted';
 if not found or v_customer.replacement_dispatch_id is distinct from v_dispatch.id or
  v_customer.quote_package_id is distinct from v_case.quote_package_id then
  raise exception '559 original token-validated customer acceptance missing'; end if;
 select * into v_close from public.ywi_landscape_recovery_audit_556
  where company_id=p_company_id and request_id=p_request_id
   and case_version=v_case.case_version and action='close' order by id desc limit 1;
 if not found or v_close.result->>'customer_confirmation_verified'<>'true' or
  v_close.result->>'authorizes_original_dispatch_mutation'<>'false' or
  v_close.result->>'state'<>'closed_verified' then
  raise exception '559 original immutable close audit not verified'; end if;
 select * into v_gate from public.ywi_landscape_resolution_events_558
  where company_id=p_company_id and request_id=p_request_id
   and case_version=v_case.case_version-1 and action='reconfirmation_requested';
 if not found or v_gate.dispatch_id is distinct from v_dispatch.id or
  v_gate.dispatch_signature is distinct from p_expected_dispatch_signature or
  v_gate.supervisor_ack_id is distinct from v_ack.id then
  raise exception '559 original reconfirmation gate evidence missing'; end if;
 v_hash:=md5(jsonb_build_object('company',p_company_id,'request',p_request_id,
  'case_version',p_expected_case_version,'signature',p_expected_dispatch_signature,
  'action',p_action,'note',btrim(p_note))::text);
 select * into v_event from public.ywi_landscape_closure_evidence_559
  where company_id=p_company_id and idempotency_key=p_idempotency_key;
 if found then
  if v_event.request_id<>p_request_id or
   v_event.case_version<>p_expected_case_version or v_event.payload_hash<>v_hash or
   v_event.owner_user_id is distinct from auth.uid() then
   raise exception '559 idempotency key reused with different action'; end if;
  return jsonb_build_object('status',case v_event.action
   when 'closure_reviewed' then 'CLOSURE_REVIEWED_SOURCE_LINKED'
   when 'supervisor_outcome_reviewed' then 'SUPERVISOR_OUTCOME_REVIEWED'
   else 'FOLLOWUP_REVIEW_INTENT_ONLY' end,
   'receipt_id',v_event.id,'replayed',true,'customer_message_sent',false,
   'dispatch_authorized',false,'owner_acceptance_in_master',false);
 end if;
 if p_action in ('supervisor_outcome_reviewed','customer_followup_requested') and
  not exists(select 1 from public.ywi_landscape_closure_evidence_559 e
    where e.company_id=p_company_id and e.request_id=p_request_id
     and e.case_version=p_expected_case_version and e.action='closure_reviewed') then
  raise exception '559 owner must review the original closure first'; end if;
 if p_action='customer_followup_requested' and
  not exists(select 1 from public.ywi_landscape_closure_evidence_559 e
   where e.company_id=p_company_id and e.request_id=p_request_id
    and e.case_version=p_expected_case_version and e.action='supervisor_outcome_reviewed') then
  raise exception '559 supervisor outcome review required before follow-up intent'; end if;
 if exists(select 1 from public.ywi_landscape_closure_evidence_559 e
  where e.company_id=p_company_id and e.request_id=p_request_id
   and e.case_version=p_expected_case_version and e.action=p_action) then
  raise exception '559 current-version closure action already recorded'; end if;
 insert into public.ywi_landscape_closure_evidence_559
  (company_id,request_id,case_version,dispatch_id,dispatch_signature,
   supervisor_ack_id,customer_receipt_id,original_close_audit_id,
   action,owner_note,owner_user_id,idempotency_key,payload_hash)
 values(p_company_id,p_request_id,p_expected_case_version,v_dispatch.id,
  p_expected_dispatch_signature,v_ack.id,v_customer.id,v_close.id,
  p_action,btrim(p_note),auth.uid(),p_idempotency_key,v_hash)
 returning * into v_event;
 v_result:=case p_action when 'closure_reviewed' then 'CLOSURE_REVIEWED_SOURCE_LINKED'
  when 'supervisor_outcome_reviewed' then 'SUPERVISOR_OUTCOME_REVIEWED'
  else 'FOLLOWUP_REVIEW_INTENT_ONLY' end;
 return jsonb_build_object('status',v_result,'receipt_id',v_event.id,
  'case_version',p_expected_case_version,'original_customer_receipt_id',v_customer.id,
  'original_supervisor_receipt_id',v_ack.id,'original_close_audit_id',v_close.id,
  'customer_message_sent',false,'dispatch_authorized',false,
  'original_dispatch_mutated',false,'owner_acceptance_in_master',false,
  'replayed',false);
end $$;
revoke all on function public.ywi_rpc_landscape_closure_record_559(uuid,uuid,integer,text,text,text,uuid,boolean)
 from public,anon,authenticated;
grant execute on function public.ywi_rpc_landscape_closure_record_559(uuid,uuid,integer,text,text,text,uuid,boolean)
 to authenticated;

-- Read model exposes receipt IDs and status only: never names, email, tokens or IP.
create or replace function public.ywi_rpc_landscape_closure_review_559(
 p_company_id uuid,p_request_id uuid
) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_case public.ywi_landscape_recovery_cases_556%rowtype;
 v_dispatch public.dispatch_schedule_items%rowtype;
 v_customer public.ywi_landscape_customer_confirmations_556%rowtype;
 v_ack public.ywi_landscape_supervisor_acknowledgements_557%rowtype;
 v_close public.ywi_landscape_recovery_audit_556%rowtype;
 v_gate public.ywi_landscape_resolution_events_558%rowtype;
 v_signature text;v_ready boolean:=false;v_events jsonb;
begin
 perform public.ywi_422_assert_owner(p_company_id);
 select * into v_case from public.ywi_landscape_recovery_cases_556
  where company_id=p_company_id and request_id=p_request_id;
 if not found then raise exception '559 original owned company case absent'; end if;
 select * into v_dispatch from public.dispatch_schedule_items
  where id=coalesce(v_case.replacement_dispatch_id,v_case.original_dispatch_id);
 if not found or v_dispatch.work_order_id is distinct from v_case.work_order_id or
  not exists(select 1 from public.work_orders w
   where w.id=v_case.work_order_id and w.company_id=p_company_id) then
  raise exception '559 original company Dispatch lineage absent'; end if;
 v_signature:=public.ywi_landscape_dispatch_signature_557(v_dispatch.id);
 select * into v_customer from public.ywi_landscape_customer_confirmations_556
  where company_id=p_company_id and request_id=p_request_id
   and case_version=v_case.case_version-1 and decision='accepted';
 select * into v_ack from public.ywi_landscape_supervisor_acknowledgements_557
  where company_id=p_company_id and request_id=p_request_id
   and case_version=v_case.case_version-1 and acknowledgement='reviewed';
 select * into v_close from public.ywi_landscape_recovery_audit_556
  where company_id=p_company_id and request_id=p_request_id
   and case_version=v_case.case_version and action='close' order by id desc limit 1;
 select * into v_gate from public.ywi_landscape_resolution_events_558
  where company_id=p_company_id and request_id=p_request_id
   and case_version=v_case.case_version-1 and action='reconfirmation_requested';
 v_ready:=v_case.state='closed_verified' and v_case.replacement_dispatch_id=v_dispatch.id
  and v_dispatch.schedule_status in ('scheduled','dispatched')
  and not exists(select 1 from public.dispatch_schedule_items newer
   where newer.supersedes_dispatch_id=v_dispatch.id)
  and v_customer.id is not null and v_customer.replacement_dispatch_id=v_dispatch.id
  and v_customer.quote_package_id=v_case.quote_package_id
  and v_ack.id is not null and v_ack.dispatch_id=v_dispatch.id
  and v_ack.supervisor_profile_id=v_dispatch.assigned_supervisor_profile_id
  and v_ack.dispatch_signature=v_signature
  and v_close.id is not null and v_close.result->>'customer_confirmation_verified'='true'
  and v_close.result->>'authorizes_original_dispatch_mutation'='false'
  and v_close.result->>'state'='closed_verified'
  and v_gate.id is not null and v_gate.dispatch_id=v_dispatch.id
  and v_gate.dispatch_signature=v_signature and v_gate.supervisor_ack_id=v_ack.id;
 select coalesce(jsonb_agg(jsonb_build_object('action',e.action,'at',e.recorded_at,
  'receipt_id',e.id,'case_version',e.case_version)
  order by e.recorded_at,e.id),'[]'::jsonb) into v_events
 from public.ywi_landscape_closure_evidence_559 e
 where e.company_id=p_company_id and e.request_id=p_request_id
  and e.case_version=v_case.case_version;
 return jsonb_build_object('company_id',p_company_id,'request_id',p_request_id,
  'case_state',v_case.state,'case_version',v_case.case_version,
  'current_dispatch_id',v_dispatch.id,'current_dispatch_signature',v_signature,
  'closure_ready',v_ready,'source_gate',case when v_ready
   then 'ORIGINAL_CLOSURE_EVIDENCE_VERIFIED_READ_ONLY' else 'HOLD_ORIGINAL_CLOSURE_SOURCE' end,
  'original_customer_decision',case when v_customer.id is not null then v_customer.decision else 'HOLD' end,
  'original_customer_receipt_id',v_customer.id,
  'original_customer_recorded_at',v_customer.recorded_at,
  'original_supervisor_receipt_id',v_ack.id,'original_close_audit_id',v_close.id,
  'events',v_events,'company_scope_only',true,'read_only',true,
  'customer_message_sent',false,'dispatch_authorized',false,
  'master_shell_connection_proven',false,'owner_acceptance_in_master',false,
  'checked_at',now());
end $$;
revoke all on function public.ywi_rpc_landscape_closure_review_559(uuid,uuid)
 from public,anon,authenticated;
grant execute on function public.ywi_rpc_landscape_closure_review_559(uuid,uuid) to authenticated;
comment on table public.ywi_landscape_closure_evidence_559 is
 'Post-close owner intent receipts, not original closure, customer communication, independent supervisor signature or master owner acceptance.';
