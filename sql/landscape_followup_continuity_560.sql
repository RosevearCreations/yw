-- YW560 — protected provider reports, original recovery reopening and supervisor continuity.
-- Install only after YW553–559. This file never sends a customer message, fabricates
-- a provider ACK, enrolls a master signer or directly changes Jobs/Dispatch.

grant select on public.ywi_landscape_closure_evidence_559 to service_role;

create table if not exists public.ywi_landscape_followup_provider_reports_560 (
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null,
 request_id uuid not null,
 case_version integer not null check(case_version between 2 and 10000),
 followup_intent_id uuid not null references public.ywi_landscape_closure_evidence_559(id) on delete restrict,
 provider text not null check(provider='rosevear-comms-hub'),
 provider_message_ref text not null check(provider_message_ref ~ '^[A-Za-z0-9_./:-]{6,160}$'),
 provider_receipt_sha256 text not null check(provider_receipt_sha256 ~ '^[0-9a-f]{64}$'),
 provider_reported_state text not null check(provider_reported_state in
  ('queued','sent','delivered','failed','recalled')),
 provider_reported_at timestamptz not null,
 received_at timestamptz not null default now(),
 idempotency_key uuid not null,
 payload_hash text not null check(payload_hash ~ '^[0-9a-f]{32}$'),
 foreign key(company_id,request_id) references public.ywi_landscape_recovery_cases_556(company_id,request_id) on delete restrict,
 unique(company_id,idempotency_key),
 unique(company_id,provider,provider_message_ref,provider_reported_state,provider_receipt_sha256)
);
create index if not exists ywi_landscape_560_provider_history on
 public.ywi_landscape_followup_provider_reports_560(company_id,request_id,received_at desc);
alter table public.ywi_landscape_followup_provider_reports_560 enable row level security;
revoke all on public.ywi_landscape_followup_provider_reports_560 from public,anon,authenticated;
grant select on public.ywi_landscape_followup_provider_reports_560 to authenticated;
grant select,insert on public.ywi_landscape_followup_provider_reports_560 to service_role;
drop policy if exists ywi_landscape_560_provider_owner_read on public.ywi_landscape_followup_provider_reports_560;
create policy ywi_landscape_560_provider_owner_read on public.ywi_landscape_followup_provider_reports_560
 for select to authenticated using (
 (select auth.uid()) is not null
 and coalesce((auth.jwt()->>'is_anonymous')::boolean,false)=false
 and exists(select 1 from public.ywi_companies c
  where c.id=company_id and c.owner_user_id=(select auth.uid())));

-- The transport receiver must validate its own provider signatures, issuer,
-- account, nonce, freshness and replay ledger BEFORE using this service-role
-- only import. This database records the provider's claim, not a master-verified
-- delivery decision. Browser/anon/owner clients cannot import provider reports.
create or replace function public.ywi_rpc_landscape_provider_report_560(
 p_company_id uuid,p_request_id uuid,p_case_version integer,
 p_followup_intent_id uuid,p_provider text,p_message_ref text,
 p_receipt_sha256 text,p_reported_state text,p_reported_at timestamptz,
 p_idempotency_key uuid
) returns jsonb language plpgsql security invoker set search_path='' as $$
declare v_intent public.ywi_landscape_closure_evidence_559%rowtype;
 v_existing public.ywi_landscape_followup_provider_reports_560%rowtype;
 v_saved public.ywi_landscape_followup_provider_reports_560%rowtype;
 v_hash text;
begin
 if current_user<>'service_role' then raise exception '560 protected receiver service-role required'; end if;
 if p_company_id is null or p_request_id is null or p_followup_intent_id is null or
  p_idempotency_key is null or p_case_version not between 2 and 10000 or
  p_provider<>'rosevear-comms-hub' or p_message_ref !~ '^[A-Za-z0-9_./:-]{6,160}$' or
  p_receipt_sha256 !~ '^[0-9a-f]{64}$' or
  p_reported_state not in ('queued','sent','delivered','failed','recalled') or
  p_reported_at is null or p_reported_at>now()+interval '5 minutes' then
  raise exception '560 malformed provider receipt or source binding'; end if;
 select * into v_intent from public.ywi_landscape_closure_evidence_559
  where id=p_followup_intent_id and company_id=p_company_id and
   request_id=p_request_id and case_version=p_case_version and
   action='customer_followup_requested';
 if not found or p_reported_at < v_intent.recorded_at - interval '2 minutes' then
  raise exception '560 original owner follow-up intent missing or stale'; end if;
 v_hash:=md5(jsonb_build_object('company',p_company_id,'request',p_request_id,
  'version',p_case_version,'intent',p_followup_intent_id,'provider',p_provider,
  'message_ref',p_message_ref,'digest',p_receipt_sha256,
  'state',p_reported_state,'reported_at',p_reported_at)::text);
 select * into v_existing from public.ywi_landscape_followup_provider_reports_560
  where company_id=p_company_id and idempotency_key=p_idempotency_key;
 if found then
  if v_existing.payload_hash<>v_hash then raise exception '560 changed replay payload'; end if;
  return jsonb_build_object('status','PROVIDER_REPORT_RECORDED_MASTER_UNVERIFIED',
   'receipt_id',v_existing.id,'replayed',true,'delivery_independently_verified',false);
 end if;
 insert into public.ywi_landscape_followup_provider_reports_560
  (company_id,request_id,case_version,followup_intent_id,provider,
   provider_message_ref,provider_receipt_sha256,provider_reported_state,
   provider_reported_at,idempotency_key,payload_hash)
 values(p_company_id,p_request_id,p_case_version,p_followup_intent_id,p_provider,
  p_message_ref,p_receipt_sha256,p_reported_state,p_reported_at,p_idempotency_key,v_hash)
 returning * into v_saved;
 return jsonb_build_object('status','PROVIDER_REPORT_RECORDED_MASTER_UNVERIFIED',
  'receipt_id',v_saved.id,'replayed',false,'delivery_independently_verified',false,
  'customer_message_sent_verified',false,'owner_acceptance_in_master',false);
end $$;
revoke all on function public.ywi_rpc_landscape_provider_report_560(uuid,uuid,integer,uuid,text,text,text,text,timestamptz,uuid)
 from public,anon,authenticated;
grant execute on function public.ywi_rpc_landscape_provider_report_560(uuid,uuid,integer,uuid,text,text,text,text,timestamptz,uuid)
 to service_role;

create table if not exists public.ywi_landscape_reopen_links_560 (
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null,
 request_id uuid not null,
 original_closed_version integer not null check(original_closed_version between 2 and 9999),
 reopened_version integer not null check(reopened_version=original_closed_version+1),
 followup_intent_id uuid not null references public.ywi_landscape_closure_evidence_559(id) on delete restrict,
 original_reopen_audit_id bigint not null references public.ywi_landscape_recovery_audit_556(id) on delete restrict,
 original_dispatch_signature text not null check(original_dispatch_signature ~ '^[0-9a-f]{32}$'),
 owner_user_id uuid not null references auth.users(id) on delete restrict,
 reason text not null check(reason in ('crew_unavailable','schedule_conflict','weather','equipment','access','other')),
 owner_note text not null check(char_length(btrim(owner_note)) between 10 and 500),
 idempotency_key uuid not null,
 recorded_at timestamptz not null default now(),
 foreign key(company_id,request_id) references public.ywi_landscape_recovery_cases_556(company_id,request_id) on delete restrict,
 unique(company_id,request_id,original_closed_version),
 unique(company_id,idempotency_key)
);
create index if not exists ywi_landscape_560_reopen_history on
 public.ywi_landscape_reopen_links_560(company_id,request_id,recorded_at desc);
alter table public.ywi_landscape_reopen_links_560 enable row level security;
revoke all on public.ywi_landscape_reopen_links_560 from public,anon,authenticated;
grant select on public.ywi_landscape_reopen_links_560 to authenticated;
drop policy if exists ywi_landscape_560_reopen_owner_read on public.ywi_landscape_reopen_links_560;
create policy ywi_landscape_560_reopen_owner_read on public.ywi_landscape_reopen_links_560
 for select to authenticated using (
 (select auth.uid()) is not null
 and coalesce((auth.jwt()->>'is_anonymous')::boolean,false)=false
 and exists(select 1 from public.ywi_companies c
  where c.id=company_id and c.owner_user_id=(select auth.uid())));

-- Reopening uses ONLY the existing YW556 owner-signed, version-checked source
-- operation. This function cannot assign crew, change original Dispatch or
-- create any customer contact. The owner must deliberately attest a new reason.
create or replace function public.ywi_rpc_landscape_reopen_560(
 p_company_id uuid,p_request_id uuid,p_expected_closed_version integer,
 p_expected_dispatch_signature text,p_reason text,p_note text,
 p_idempotency_key uuid,p_owner_attested boolean
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_case public.ywi_landscape_recovery_cases_556%rowtype;
 v_intent public.ywi_landscape_closure_evidence_559%rowtype;
 v_link public.ywi_landscape_reopen_links_560%rowtype;
 v_audit public.ywi_landscape_recovery_audit_556%rowtype;
 v_after jsonb;
begin
 perform public.ywi_422_assert_owner(p_company_id);
 perform public.ywi_422_assert_jobs_create();
 if p_request_id is null or p_idempotency_key is null or
  p_expected_closed_version not between 2 and 9999 or
  p_expected_dispatch_signature !~ '^[0-9a-f]{32}$' or
  p_reason not in ('crew_unavailable','schedule_conflict','weather','equipment','access','other') or
  char_length(btrim(coalesce(p_note,''))) not between 10 and 500 or
  p_owner_attested is distinct from true then
  raise exception '560 original owner, reason or attestation invalid'; end if;
 perform pg_advisory_xact_lock(hashtextextended('yw556:'||p_company_id::text||':'||p_request_id::text,0));
 select * into v_link from public.ywi_landscape_reopen_links_560
  where company_id=p_company_id and idempotency_key=p_idempotency_key;
 if found then
  if v_link.request_id<>p_request_id or
   v_link.original_closed_version<>p_expected_closed_version or
   v_link.original_dispatch_signature<>p_expected_dispatch_signature or
   v_link.reason<>p_reason or v_link.owner_note<>btrim(p_note) or
   v_link.owner_user_id is distinct from auth.uid() then
   raise exception '560 idempotency key reused with different payload'; end if;
  return jsonb_build_object('status','ORIGINAL_556_EXCEPTION_REOPENED_SUPERVISOR_HOLD',
   'receipt_id',v_link.id,'original_reopen_audit_id',v_link.original_reopen_audit_id,
   'reopened_version',v_link.reopened_version,'replayed',true,
   'dispatch_authorized',false,'customer_message_sent_verified',false);
 end if;
 select * into v_case from public.ywi_landscape_recovery_cases_556
  where company_id=p_company_id and request_id=p_request_id for update;
 if not found or v_case.state<>'closed_verified' or
  v_case.case_version is distinct from p_expected_closed_version or
  v_case.replacement_dispatch_id is null or
  public.ywi_landscape_dispatch_signature_557(v_case.replacement_dispatch_id)
   is distinct from p_expected_dispatch_signature then
  raise exception '560 original source closure or Dispatch changed'; end if;
 select * into v_intent from public.ywi_landscape_closure_evidence_559
  where company_id=p_company_id and request_id=p_request_id and
   case_version=p_expected_closed_version and action='customer_followup_requested';
 if not found then raise exception '560 prior verified 559 follow-up intent required'; end if;
 if exists(select 1 from public.ywi_landscape_reopen_links_560
  where company_id=p_company_id and request_id=p_request_id and
   original_closed_version=p_expected_closed_version) then
  raise exception '560 original closure already reopened'; end if;
 v_after:=public.ywi_rpc_landscape_recovery_556(p_company_id,p_request_id,'open',
  p_idempotency_key,p_expected_closed_version,p_reason,btrim(p_note),null,true);
 if v_after->>'state'<>'exception_open' or
  (v_after->>'case_version')::integer<>p_expected_closed_version+1 or
  v_after->>'authorizes_original_dispatch_mutation'<>'false' then
  raise exception '560 original 556 reopen did not verify'; end if;
 select * into v_audit from public.ywi_landscape_recovery_audit_556
  where company_id=p_company_id and idempotency_key=p_idempotency_key
   and action='open' and case_version=p_expected_closed_version+1;
 if not found then raise exception '560 original 556 immutable reopen audit absent'; end if;
 insert into public.ywi_landscape_reopen_links_560
  (company_id,request_id,original_closed_version,reopened_version,followup_intent_id,
   original_reopen_audit_id,original_dispatch_signature,owner_user_id,reason,owner_note,idempotency_key)
 values(p_company_id,p_request_id,p_expected_closed_version,p_expected_closed_version+1,
  v_intent.id,v_audit.id,p_expected_dispatch_signature,auth.uid(),p_reason,btrim(p_note),p_idempotency_key)
 returning * into v_link;
 return jsonb_build_object('status','ORIGINAL_556_EXCEPTION_REOPENED_SUPERVISOR_HOLD',
  'receipt_id',v_link.id,'original_reopen_audit_id',v_audit.id,
  'reopened_version',v_link.reopened_version,'replayed',false,
  'dispatch_authorized',false,'customer_message_sent_verified',false,
  'owner_acceptance_in_master',false);
end $$;
revoke all on function public.ywi_rpc_landscape_reopen_560(uuid,uuid,integer,text,text,text,uuid,boolean)
 from public,anon,authenticated;
grant execute on function public.ywi_rpc_landscape_reopen_560(uuid,uuid,integer,text,text,text,uuid,boolean)
 to authenticated;

-- Owner-only PII-free projection. A provider-reported 'delivered' event is
-- NOT independently verified delivery. Fresh 557 reviewer evidence must be
-- recorded by the original supervisor at the new 556 case version after reopen.
create or replace function public.ywi_rpc_landscape_continuity_review_560(
 p_company_id uuid,p_request_id uuid
) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_case public.ywi_landscape_recovery_cases_556%rowtype;
 v_intent public.ywi_landscape_closure_evidence_559%rowtype;
 v_dispatch public.dispatch_schedule_items%rowtype;
 v_ack public.ywi_landscape_supervisor_acknowledgements_557%rowtype;
 v_signature text;v_providers jsonb;v_reopens jsonb;
 v_eligible boolean:=false;v_fresh boolean:=false;
begin
 perform public.ywi_422_assert_owner(p_company_id);
 select * into v_case from public.ywi_landscape_recovery_cases_556
  where company_id=p_company_id and request_id=p_request_id;
 if not found then raise exception '560 original owned recovery case unavailable'; end if;
 select * into v_dispatch from public.dispatch_schedule_items
  where id=coalesce(v_case.replacement_dispatch_id,v_case.original_dispatch_id);
 if not found or v_dispatch.work_order_id is distinct from v_case.work_order_id or
  not exists(select 1 from public.work_orders w
   where w.id=v_case.work_order_id and w.company_id=p_company_id) then
  raise exception '560 original company Dispatch lineage unavailable'; end if;
 v_signature:=public.ywi_landscape_dispatch_signature_557(v_dispatch.id);
 select * into v_intent from public.ywi_landscape_closure_evidence_559
  where company_id=p_company_id and request_id=p_request_id and
   case_version=v_case.case_version and action='customer_followup_requested';
 v_eligible:=v_case.state='closed_verified' and v_intent.id is not null and
  v_case.replacement_dispatch_id=v_dispatch.id and
  v_dispatch.schedule_status in ('scheduled','dispatched') and
  not exists(select 1 from public.dispatch_schedule_items d
   where d.supersedes_dispatch_id=v_dispatch.id) and
  v_intent.dispatch_signature=v_signature and
  not exists(select 1 from public.ywi_landscape_reopen_links_560 r
   where r.company_id=p_company_id and r.request_id=p_request_id and
    r.original_closed_version=v_case.case_version);
 select * into v_ack from public.ywi_landscape_supervisor_acknowledgements_557
  where company_id=p_company_id and request_id=p_request_id and
   case_version=v_case.case_version and acknowledgement='reviewed';
 v_fresh:=v_ack.id is not null and v_ack.dispatch_id=v_dispatch.id and
  v_ack.dispatch_signature=v_signature and
  v_ack.supervisor_profile_id=v_dispatch.assigned_supervisor_profile_id;
 select coalesce(jsonb_agg(jsonb_build_object('receipt_id',q.id,
  'provider',q.provider,'provider_reported_state',q.provider_reported_state,
  'provider_message_ref',q.provider_message_ref,'received_at',q.received_at,
  'provider_reported_at',q.provider_reported_at,
  'delivery_independently_verified',false)
  order by q.received_at desc,q.id),'[]'::jsonb) into v_providers
 from (select * from public.ywi_landscape_followup_provider_reports_560 p
  where p.company_id=p_company_id and p.request_id=p_request_id
  order by p.received_at desc limit 20) q;
 select coalesce(jsonb_agg(jsonb_build_object('receipt_id',r.id,
  'original_closed_version',r.original_closed_version,
  'reopened_version',r.reopened_version,'original_reopen_audit_id',r.original_reopen_audit_id,
  'reason',r.reason,'recorded_at',r.recorded_at)
  order by r.recorded_at desc,r.id),'[]'::jsonb) into v_reopens
 from (select * from public.ywi_landscape_reopen_links_560 e
  where e.company_id=p_company_id and e.request_id=p_request_id
  order by e.recorded_at desc limit 20) r;
 return jsonb_build_object('company_id',p_company_id,'request_id',p_request_id,
  'case_version',v_case.case_version,'case_state',v_case.state,
  'current_dispatch_id',v_dispatch.id,'current_dispatch_signature',v_signature,
  'reopen_eligible',v_eligible,'followup_intent_id',v_intent.id,
  'fresh_supervisor_acknowledged',v_fresh,
  'supervisor_continuity',case when v_fresh then 'FRESH_ORIGINAL_557_ACK_REVIEWED'
   else 'HOLD_FRESH_ORIGINAL_SUPERVISOR_ACK' end,
  'provider_reports',v_providers,'reopen_events',v_reopens,
  'delivery_independently_verified',false,
  'customer_message_sent_verified',false,'customer_contact_authorized',false,
  'dispatch_authorized',false,'master_shell_connection_proven',false,
  'owner_acceptance_in_master',false,'company_scope_only',true,'read_only',true,
  'checked_at',now());
end $$;
revoke all on function public.ywi_rpc_landscape_continuity_review_560(uuid,uuid)
 from public,anon,authenticated;
grant execute on function public.ywi_rpc_landscape_continuity_review_560(uuid,uuid)
 to authenticated;

comment on table public.ywi_landscape_followup_provider_reports_560 is
 'Service-role-only imported claims from independently verified receiver flow; unverified at master until separate signed acceptance.';
comment on table public.ywi_landscape_reopen_links_560 is
 'Immutable owner attestation linking original 559 follow-up intent to original 556 reopen audit. No direct Dispatch or customer message write.';
