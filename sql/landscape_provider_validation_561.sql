-- YW561: independent provider Ed25519 proof custody, durable replay admission,
-- original YW556 reopened-case supervisor continuity, and shell-safe Master correlation.
-- Requires installation of YW553-560 SQL. This file NEVER sends customer messages,
-- mints a source signer or marks AI Data acceptance/connection as complete.

-- A separate database custodian enrolls only verified provider PUBLIC keys.
-- The receiver's service_role cannot enroll, replace or rotate trusted pins.
create table if not exists public.ywi_landscape_provider_signer_pins_561 (
 issuer text not null check(issuer='rosevear-comms-hub'),
 key_id text not null check(key_id ~ '^[A-Za-z0-9_.:-]{6,96}$'),
 public_key_b64 text not null check(public_key_b64 ~ '^[A-Za-z0-9+/]{43}=$'),
 public_key_sha256 text not null check(public_key_sha256 ~ '^[0-9a-f]{64}$'),
 state text not null check(state in ('ACTIVE','REVOKED','HOLD')) default 'HOLD',
 custody_evidence_ref text not null check(custody_evidence_ref ~ '^[A-Za-z0-9_./:-]{10,160}$'),
 valid_from timestamptz not null,
 valid_until timestamptz,
 recorded_at timestamptz not null default now(),
 primary key(issuer,key_id),
 check(valid_until is null or valid_until>valid_from)
);
alter table public.ywi_landscape_provider_signer_pins_561 enable row level security;
revoke all on public.ywi_landscape_provider_signer_pins_561 from public,anon,authenticated,service_role;
grant select on public.ywi_landscape_provider_signer_pins_561 to service_role;

-- Ed25519 is independently verified by the server receiver BEFORE this RPC.
-- Its service-role-only transaction then binds the exact original YW559/560
-- chain and makes provider nonce reuse durable (including conflicting retries).
create table if not exists public.ywi_landscape_provider_verified_561 (
 id uuid primary key default gen_random_uuid(),
 provider_report_id uuid not null unique references public.ywi_landscape_followup_provider_reports_560(id) on delete restrict,
 company_id uuid not null,
 request_id uuid not null,
 case_version integer not null check(case_version between 2 and 10000),
 followup_intent_id uuid not null references public.ywi_landscape_closure_evidence_559(id) on delete restrict,
 issuer text not null check(issuer='rosevear-comms-hub'),
 key_id text not null,
 replay_nonce uuid not null,
 provider_reported_state text not null check(provider_reported_state in ('queued','sent','delivered','failed','recalled')),
 issued_at timestamptz not null,
 canonical_sha256 text not null check(canonical_sha256 ~ '^[0-9a-f]{64}$'),
 signature_sha256 text not null check(signature_sha256 ~ '^[0-9a-f]{64}$'),
 verified_at timestamptz not null default now(),
 foreign key(company_id,request_id) references public.ywi_landscape_recovery_cases_556(company_id,request_id) on delete restrict,
 foreign key(issuer,key_id) references public.ywi_landscape_provider_signer_pins_561(issuer,key_id) on delete restrict,
 unique(issuer,replay_nonce)
);
create index if not exists ywi_landscape_561_verified_history on
 public.ywi_landscape_provider_verified_561(company_id,request_id,verified_at desc);
alter table public.ywi_landscape_provider_verified_561 enable row level security;
revoke all on public.ywi_landscape_provider_verified_561 from public,anon,authenticated;
grant select,insert on public.ywi_landscape_provider_verified_561 to service_role;
grant select on public.ywi_landscape_provider_verified_561 to authenticated;
drop policy if exists ywi_landscape_561_verified_owner_read on public.ywi_landscape_provider_verified_561;
create policy ywi_landscape_561_verified_owner_read on public.ywi_landscape_provider_verified_561
 for select to authenticated using (
 (select auth.uid()) is not null and
 coalesce((auth.jwt()->>'is_anonymous')::boolean,false)=false and
 exists(select 1 from public.ywi_companies c where c.id=company_id
  and c.owner_user_id=(select auth.uid())));

create or replace function public.ywi_rpc_landscape_provider_verify_561(
 p_provider_report_id uuid,p_company_id uuid,p_request_id uuid,
 p_case_version integer,p_followup_intent_id uuid,p_issuer text,p_key_id text,
 p_nonce uuid,p_message_ref text,p_receipt_sha256 text,p_reported_state text,
 p_reported_at timestamptz,p_issued_at timestamptz,
 p_canonical_sha256 text,p_signature_sha256 text
) returns jsonb language plpgsql security invoker set search_path='' as $$
declare v_pin public.ywi_landscape_provider_signer_pins_561%rowtype;
 v_report public.ywi_landscape_followup_provider_reports_560%rowtype;
 v_prior public.ywi_landscape_provider_verified_561%rowtype;
 v_saved public.ywi_landscape_provider_verified_561%rowtype;
begin
 if current_user<>'service_role' then raise exception '561 protected service role required'; end if;
 if p_provider_report_id is null or p_company_id is null or p_request_id is null or
  p_followup_intent_id is null or p_nonce is null or p_case_version not between 2 and 10000 or
  p_issuer<>'rosevear-comms-hub' or p_key_id !~ '^[A-Za-z0-9_.:-]{6,96}$' or
  p_message_ref !~ '^[A-Za-z0-9_./:-]{6,160}$' or p_receipt_sha256 !~ '^[0-9a-f]{64}$' or
  p_canonical_sha256 !~ '^[0-9a-f]{64}$' or p_signature_sha256 !~ '^[0-9a-f]{64}$' or
  p_reported_state not in ('queued','sent','delivered','failed','recalled') or
  p_issued_at is null or p_issued_at<now()-interval '10 minutes' or
  p_issued_at>now()+interval '2 minutes' or
  p_reported_at is null or p_reported_at>p_issued_at+interval '2 minutes' or
  p_reported_at<p_issued_at-interval '1 day' then
  raise exception '561 malformed or stale protected provider receipt'; end if;
 perform pg_advisory_xact_lock(hashtextextended('yw561:'||p_issuer||':'||p_nonce::text,0));
 select * into v_pin from public.ywi_landscape_provider_signer_pins_561
  where issuer=p_issuer and key_id=p_key_id and state='ACTIVE'
   and valid_from<=now() and (valid_until is null or valid_until>now())
   and char_length(custody_evidence_ref)>10;
 if not found then raise exception '561 independent public signer pin not enrolled'; end if;
 select * into v_report from public.ywi_landscape_followup_provider_reports_560
  where id=p_provider_report_id and company_id=p_company_id and request_id=p_request_id
   and case_version=p_case_version and followup_intent_id=p_followup_intent_id
   and provider=p_issuer and provider_message_ref=p_message_ref
   and provider_receipt_sha256=p_receipt_sha256
   and provider_reported_state=p_reported_state and provider_reported_at=p_reported_at;
 if not found then raise exception '561 original protected YW560 provider claim mismatch'; end if;
 perform 1 from public.ywi_landscape_closure_evidence_559 e
  where e.id=p_followup_intent_id and e.company_id=p_company_id
   and e.request_id=p_request_id and e.case_version=p_case_version
   and e.action='customer_followup_requested';
 if not found then raise exception '561 original 559 owner intent mismatch'; end if;
 select * into v_prior from public.ywi_landscape_provider_verified_561
  where issuer=p_issuer and replay_nonce=p_nonce;
 if found then
  if v_prior.provider_report_id<>p_provider_report_id or
   v_prior.company_id<>p_company_id or v_prior.request_id<>p_request_id or
   v_prior.key_id<>p_key_id or v_prior.canonical_sha256<>p_canonical_sha256 or
   v_prior.signature_sha256<>p_signature_sha256 then
   raise exception '561 conflicting nonce replay rejected'; end if;
  return jsonb_build_object('receipt_id',v_prior.id,'signature_verified',true,
   'replayed',true,'replay_committed',true,'master_delivery_accepted',false);
 end if;
 insert into public.ywi_landscape_provider_verified_561
  (provider_report_id,company_id,request_id,case_version,followup_intent_id,
   issuer,key_id,replay_nonce,provider_reported_state,issued_at,
   canonical_sha256,signature_sha256)
 values(p_provider_report_id,p_company_id,p_request_id,p_case_version,p_followup_intent_id,
   p_issuer,p_key_id,p_nonce,p_reported_state,p_issued_at,
   p_canonical_sha256,p_signature_sha256) returning * into v_saved;
 return jsonb_build_object('receipt_id',v_saved.id,'signature_verified',true,
  'replayed',false,'replay_committed',true,'master_delivery_accepted',false,
  'customer_delivery_independently_verified',false);
end $$;
revoke all on function public.ywi_rpc_landscape_provider_verify_561(uuid,uuid,uuid,integer,uuid,text,text,uuid,text,text,text,timestamptz,timestamptz,text,text)
 from public,anon,authenticated;
grant execute on function public.ywi_rpc_landscape_provider_verify_561(uuid,uuid,uuid,integer,uuid,text,text,uuid,text,text,text,timestamptz,timestamptz,text,text)
 to service_role;

-- Original supervisor must authenticate using the existing YW557 operation;
-- a company owner only attests/reviews the result, never impersonates signer.
create table if not exists public.ywi_landscape_reopen_supervision_561 (
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null,
 request_id uuid not null,
 reopened_version integer not null check(reopened_version between 3 and 10000),
 original_reopen_id uuid not null references public.ywi_landscape_reopen_links_560(id) on delete restrict,
 current_case_version integer not null check(current_case_version between 3 and 10000),
 original_supervisor_ack_id uuid references public.ywi_landscape_supervisor_acknowledgements_557(id) on delete restrict,
 decision text not null check(decision in ('continuity_reviewed','exception_escalated')),
 owner_note text not null check(char_length(btrim(owner_note)) between 10 and 500),
 owner_user_id uuid not null references auth.users(id) on delete restrict,
 idempotency_key uuid not null,
 recorded_at timestamptz not null default now(),
 foreign key(company_id,request_id) references public.ywi_landscape_recovery_cases_556(company_id,request_id) on delete restrict,
 -- An open-case escalation and a later verified closure review are distinct
 -- immutable decisions within the SAME original reopened recovery cycle.
 unique(company_id,request_id,reopened_version,decision),unique(company_id,idempotency_key)
);
create index if not exists ywi_landscape_561_supervision_history on
 public.ywi_landscape_reopen_supervision_561(company_id,request_id,recorded_at desc);
alter table public.ywi_landscape_reopen_supervision_561 enable row level security;
revoke all on public.ywi_landscape_reopen_supervision_561 from public,anon,authenticated;
grant select on public.ywi_landscape_reopen_supervision_561 to authenticated;
drop policy if exists ywi_landscape_561_supervision_owner_read on public.ywi_landscape_reopen_supervision_561;
create policy ywi_landscape_561_supervision_owner_read on public.ywi_landscape_reopen_supervision_561
 for select to authenticated using ((select auth.uid()) is not null
 and coalesce((auth.jwt()->>'is_anonymous')::boolean,false)=false
 and exists(select 1 from public.ywi_companies c where c.id=company_id
  and c.owner_user_id=(select auth.uid())));

create or replace function public.ywi_rpc_landscape_reopen_review_561(
 p_company_id uuid,p_request_id uuid
) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_case public.ywi_landscape_recovery_cases_556%rowtype;
 v_link public.ywi_landscape_reopen_links_560%rowtype;
 v_dispatch public.dispatch_schedule_items%rowtype;
 v_ack public.ywi_landscape_supervisor_acknowledgements_557%rowtype;
 v_decision public.ywi_landscape_reopen_supervision_561%rowtype;
 v_closure jsonb;v_receipts jsonb;v_ack_version integer;v_reopen_version integer;
 v_fresh boolean:=false;v_ready boolean:=false;
begin
 perform public.ywi_422_assert_owner(p_company_id);
 select * into v_case from public.ywi_landscape_recovery_cases_556
  where company_id=p_company_id and request_id=p_request_id;
 if not found then raise exception '561 owned original recovery case unavailable'; end if;
 -- YW556 transitions are open vN, verify_replacement vN+1, close vN+2.
 -- YW557 acknowledges the replacement-pending version (the close version -1).
 v_reopen_version:=case when v_case.state='closed_verified' then v_case.case_version-2
  when v_case.state='replacement_pending_customer' then v_case.case_version-1
  else v_case.case_version end;
 v_ack_version:=case when v_case.state='closed_verified'
  then v_case.case_version-1 else v_case.case_version end;
 select * into v_link from public.ywi_landscape_reopen_links_560
  where company_id=p_company_id and request_id=p_request_id
   and reopened_version=v_reopen_version;
 select * into v_dispatch from public.dispatch_schedule_items
  where id=coalesce(v_case.replacement_dispatch_id,v_case.original_dispatch_id);
 if not found or v_dispatch.work_order_id is distinct from v_case.work_order_id or
  not exists(select 1 from public.work_orders w where w.id=v_case.work_order_id
   and w.company_id=p_company_id) then
  raise exception '561 original company Dispatch boundary unavailable'; end if;
 select * into v_ack from public.ywi_landscape_supervisor_acknowledgements_557
  where company_id=p_company_id and request_id=p_request_id
   and case_version=v_ack_version and acknowledgement='reviewed';
 v_fresh:=v_link.id is not null and v_ack.id is not null and
  v_ack.dispatch_id=v_dispatch.id and
  v_ack.dispatch_signature=public.ywi_landscape_dispatch_signature_557(v_dispatch.id) and
  v_ack.supervisor_profile_id=v_dispatch.assigned_supervisor_profile_id and
  v_ack.recorded_at>=v_link.recorded_at;
 if v_link.id is not null and v_case.state='closed_verified' and v_fresh then
  v_closure:=public.ywi_rpc_landscape_closure_review_559(p_company_id,p_request_id);
  v_ready:=v_closure->>'closure_ready'='true' and
   (v_closure->>'case_version')::integer=v_case.case_version;
 end if;
 select * into v_decision from public.ywi_landscape_reopen_supervision_561
  where company_id=p_company_id and request_id=p_request_id
   and reopened_version=v_reopen_version
  order by recorded_at desc,id desc limit 1;
 select coalesce(jsonb_agg(jsonb_build_object('receipt_id',v.id,
  'provider_state',v.provider_reported_state,'key_id',v.key_id,
  'verified_at',v.verified_at,'replay_committed',true,
  'signature_verified',true,'customer_delivery_independently_verified',false)
  order by v.verified_at desc,v.id),'[]'::jsonb) into v_receipts
 from (select * from public.ywi_landscape_provider_verified_561 r
  where r.company_id=p_company_id and r.request_id=p_request_id
  order by r.verified_at desc limit 20) v;
 return jsonb_build_object('company_id',p_company_id,'request_id',p_request_id,
  'case_state',v_case.state,'case_version',v_case.case_version,
  'reopened_version',v_link.reopened_version,
  'original_reopen_audit_id',v_link.original_reopen_audit_id,
  'original_supervisor_ack_id',case when v_fresh then v_ack.id else null end,
  'fresh_original_supervisor_verified',v_fresh,
  'closure_source_verified',v_ready,
  'owner_decision',coalesce(v_decision.decision,'HOLD'),
  'owner_decision_receipt_id',v_decision.id,
  'supervision_gate',case when v_decision.decision='continuity_reviewed' then 'RECORDED_SOURCE_ONLY'
   when v_ready then 'READY_OWNER_REVIEW'
   when v_link.id is null then 'HOLD_NO_ORIGINAL_REOPEN'
   when v_decision.decision='exception_escalated' then 'RECORDED_ESCALATION_SOURCE_ONLY'
   else 'HOLD_ORIGINAL_SUPERVISOR_OR_CUSTOMER_RECONFIRMATION' end,
  'provider_signed_receipts',v_receipts,
  'provider_signature_validation','INDEPENDENT_ED25519_ONLY_WHEN_RECEIPT_PRESENT',
  'customer_delivery_independently_verified',false,'customer_message_sent',false,
  'master_delivery_accepted',false,'master_connection_proven',false,
  'company_scope_only',true,'read_only',true,'checked_at',now());
end $$;
revoke all on function public.ywi_rpc_landscape_reopen_review_561(uuid,uuid) from public,anon,authenticated;
grant execute on function public.ywi_rpc_landscape_reopen_review_561(uuid,uuid) to authenticated;

create or replace function public.ywi_rpc_landscape_supervision_decide_561(
 p_company_id uuid,p_request_id uuid,p_expected_case_version integer,
 p_decision text,p_note text,p_idempotency_key uuid,p_owner_attested boolean
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_review jsonb;v_case public.ywi_landscape_recovery_cases_556%rowtype;
 v_link public.ywi_landscape_reopen_links_560%rowtype;
 v_previous public.ywi_landscape_reopen_supervision_561%rowtype;
 v_saved public.ywi_landscape_reopen_supervision_561%rowtype;
 v_ack_id uuid;
begin
 perform public.ywi_422_assert_owner(p_company_id);
 perform public.ywi_422_assert_jobs_create();
 if p_request_id is null or p_idempotency_key is null or
  p_expected_case_version not between 3 and 10000 or
  p_decision not in ('continuity_reviewed','exception_escalated') or
  char_length(btrim(coalesce(p_note,''))) not between 10 and 500 or
  p_owner_attested is distinct from true then
  raise exception '561 original owner or attestation invalid'; end if;
 perform pg_advisory_xact_lock(hashtextextended('yw556:'||p_company_id::text||':'||p_request_id::text,0));
 select * into v_case from public.ywi_landscape_recovery_cases_556
  where company_id=p_company_id and request_id=p_request_id for update;
 if not found or v_case.case_version<>p_expected_case_version then
  raise exception '561 original recovery source version changed'; end if;
 v_review:=public.ywi_rpc_landscape_reopen_review_561(p_company_id,p_request_id);
 if v_review->>'reopened_version' is null then
  raise exception '561 no original YW556 reopen link'; end if;
 select * into v_link from public.ywi_landscape_reopen_links_560
  where company_id=p_company_id and request_id=p_request_id
   and reopened_version=(v_review->>'reopened_version')::integer;
 select * into v_previous from public.ywi_landscape_reopen_supervision_561
  where company_id=p_company_id and idempotency_key=p_idempotency_key;
 if found then
  if v_previous.request_id<>p_request_id or
   v_previous.current_case_version<>p_expected_case_version or
   v_previous.decision<>p_decision or v_previous.owner_note<>btrim(p_note) or
   v_previous.owner_user_id is distinct from auth.uid() then
   raise exception '561 conflicting owner decision replay'; end if;
  return jsonb_build_object('status','ORIGINAL_REOPEN_SUPERVISION_RECORDED_MASTER_HOLD',
   'receipt_id',v_previous.id,'replayed',true,'master_delivery_accepted',false);
 end if;
 if p_decision='continuity_reviewed' and
  (v_case.state<>'closed_verified' or
   v_review->>'closure_source_verified'<>'true' or
   v_review->>'fresh_original_supervisor_verified'<>'true') then
  raise exception '561 original fresh supervisor and customer closure HOLD'; end if;
 if p_decision='exception_escalated' and v_case.state<>'exception_open' then
  raise exception '561 only open original exceptions may be escalated'; end if;
 if exists(select 1 from public.ywi_landscape_reopen_supervision_561 x
  where x.company_id=p_company_id and x.request_id=p_request_id
  and x.reopened_version=v_link.reopened_version and x.decision=p_decision) then
  raise exception '561 original reopened version action already decided'; end if;
 v_ack_id:=nullif(v_review->>'original_supervisor_ack_id','')::uuid;
 insert into public.ywi_landscape_reopen_supervision_561
  (company_id,request_id,reopened_version,original_reopen_id,current_case_version,
   original_supervisor_ack_id,decision,owner_note,owner_user_id,idempotency_key)
 values(p_company_id,p_request_id,v_link.reopened_version,v_link.id,p_expected_case_version,
  v_ack_id,p_decision,btrim(p_note),auth.uid(),p_idempotency_key)
 returning * into v_saved;
 return jsonb_build_object('status','ORIGINAL_REOPEN_SUPERVISION_RECORDED_MASTER_HOLD',
  'receipt_id',v_saved.id,'decision',v_saved.decision,'replayed',false,
  'original_supervisor_ack_id',v_saved.original_supervisor_ack_id,
  'dispatch_authorized',false,'customer_message_sent',false,
  'master_delivery_accepted',false,'owner_acceptance_in_master',false);
end $$;
revoke all on function public.ywi_rpc_landscape_supervision_decide_561(uuid,uuid,integer,text,text,uuid,boolean)
 from public,anon,authenticated;
grant execute on function public.ywi_rpc_landscape_supervision_decide_561(uuid,uuid,integer,text,text,uuid,boolean)
 to authenticated;

-- Read-only platform-shell aggregate: intentionally NO tenant IDs, customer
-- details, keys, dispatch IDs, case IDs or individual receipt identifiers.
create or replace function public.ywi_rpc_landscape_master_summary_561()
 returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare v_provider_count bigint;v_signed_delivered bigint;v_reopens bigint;v_reviews bigint;
begin
 if current_user<>'service_role' then raise exception '561 protected Master source only'; end if;
 select count(*),count(*) filter(where provider_reported_state='delivered')
  into v_provider_count,v_signed_delivered
  from public.ywi_landscape_provider_verified_561;
 select count(*) into v_reopens from public.ywi_landscape_reopen_links_560;
 select count(*) into v_reviews from public.ywi_landscape_reopen_supervision_561;
 return jsonb_build_object('schema','rosevear.yw.delivery-evidence-aggregate.v1',
  'source_id','yw','source_role','platform_shell','tenant_boundary','platform_shell',
  'provider_signed_receipts',v_provider_count,
  'provider_signed_delivered_claims',v_signed_delivered,
  'original_case_reopens',v_reopens,'supervisor_decisions',v_reviews,
  'customer_delivery_independently_verified',false,
  'master_delivery_accepted',false,'connection','HOLD','owner_accepted',false,
  'checked_at',now());
end $$;
revoke all on function public.ywi_rpc_landscape_master_summary_561() from public,anon,authenticated;
grant execute on function public.ywi_rpc_landscape_master_summary_561() to service_role;

comment on table public.ywi_landscape_provider_verified_561 is
 'Independently cryptographically authenticated provider-reported metadata, not recipient delivery or Master owner acceptance.';
comment on table public.ywi_landscape_reopen_supervision_561 is
 'Owner-visible original reopened 556 case supervision with fresh original 557 signoff gates. No customer or Dispatch mutation.';
