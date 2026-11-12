-- YW563: independently signed Master receipt observation ledger, discrepancies and
-- owner-only source follow-up closure. Requires all YW553–562 migrations first.
-- This does NOT send a customer message or record Master owner acceptance.
-- Separate DBA custodian enrolls the controller PUBLIC signer only.
create table if not exists public.ywi_landscape_master_signer_pins_563 (
 issuer text not null check (issuer='ai-data-platform'),
 key_id text not null check (key_id ~ '^[A-Za-z0-9_.:-]{6,96}$'),
 public_key_b64 text not null check (public_key_b64 ~ '^[A-Za-z0-9+/]{43}=$'),
 public_key_sha256 text not null check (public_key_sha256 ~ '^[0-9a-f]{64}$'),
 custody_evidence_ref text not null check (custody_evidence_ref ~ '^[A-Za-z0-9_./:-]{10,160}$'),
 state text not null default 'HOLD' check (state in ('HOLD','ACTIVE','REVOKED')),
 valid_from timestamptz not null,
 valid_until timestamptz,
 recorded_at timestamptz not null default now(),
 primary key(issuer,key_id),
 check(valid_until is null or valid_until>valid_from)
);
alter table public.ywi_landscape_master_signer_pins_563 enable row level security;
revoke all on public.ywi_landscape_master_signer_pins_563 from public,anon,authenticated,service_role;
grant select on public.ywi_landscape_master_signer_pins_563 to service_role;

-- Master ACK observations are independently Ed25519 checked by the protected
-- Edge receiver before a service-role transaction. They do not establish an
-- external master owner ACCEPT decision nor recipient delivery.
create table if not exists public.ywi_landscape_master_observations_563 (
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null,
 request_id uuid not null,
 case_version integer not null check(case_version between 3 and 10000),
 provider_verified_receipt_id uuid not null references
  public.ywi_landscape_provider_verified_561(id) on delete restrict,
 source_pilot_decision_id uuid not null references
  public.ywi_landscape_provider_pilot_decisions_562(id) on delete restrict,
 issuer text not null check(issuer='ai-data-platform'),
 key_id text not null,
 controller_revision text not null check(controller_revision ~ '^[0-9a-f]{40}$'),
 master_receipt_ref text not null check(master_receipt_ref ~ '^[A-Za-z0-9_./:-]{10,160}$'),
 master_claimed_sha256 text not null check(master_claimed_sha256 ~ '^[0-9a-f]{64}$'),
 source_canonical_sha256 text not null check(source_canonical_sha256 ~ '^[0-9a-f]{64}$'),
 observed_state text not null check(observed_state in ('acknowledged','discrepancy','rejected')),
 comparison text not null check(comparison in
  ('MATCHED_RECEIPT_CLAIM','HASH_MISMATCH','MASTER_DISCREPANCY','MASTER_REJECTED')),
 replay_nonce uuid not null,
 issued_at timestamptz not null,
 canonical_sha256 text not null check(canonical_sha256 ~ '^[0-9a-f]{64}$'),
 signature_sha256 text not null check(signature_sha256 ~ '^[0-9a-f]{64}$'),
 verified_at timestamptz not null default now(),
 foreign key(company_id,request_id) references
  public.ywi_landscape_recovery_cases_556(company_id,request_id) on delete restrict,
 foreign key(issuer,key_id) references
  public.ywi_landscape_master_signer_pins_563(issuer,key_id) on delete restrict,
 unique(issuer,replay_nonce),
 unique(issuer,master_receipt_ref)
);
create index if not exists ywi_563_original_master_receipts on
 public.ywi_landscape_master_observations_563(company_id,request_id,provider_verified_receipt_id,verified_at desc);
alter table public.ywi_landscape_master_observations_563 enable row level security;
revoke all on public.ywi_landscape_master_observations_563 from public,anon,authenticated;
grant select,insert on public.ywi_landscape_master_observations_563 to service_role;
grant select on public.ywi_landscape_master_observations_563 to authenticated;
drop policy if exists ywi_563_master_original_owner_read on public.ywi_landscape_master_observations_563;
create policy ywi_563_master_original_owner_read on public.ywi_landscape_master_observations_563
 for select to authenticated using ((select auth.uid()) is not null and
 coalesce((auth.jwt()->>'is_anonymous')::boolean,false)=false and
 exists(select 1 from public.ywi_companies c
  where c.id=company_id and c.owner_user_id=(select auth.uid())));

-- Serialized provider+Master source binding. Never trust a browser to perform
-- the signed verification; token and signature are checked before this RPC.
create or replace function public.ywi_rpc_landscape_master_observation_admit_563(
 p_company_id uuid,p_request_id uuid,p_case_version integer,
 p_provider_verified_receipt_id uuid,p_source_pilot_decision_id uuid,
 p_issuer text,p_key_id text,p_controller_revision text,p_master_receipt_ref text,
 p_master_claimed_sha256 text,p_observed_state text,p_nonce uuid,
 p_issued_at timestamptz,p_canonical_sha256 text,p_signature_sha256 text
) returns jsonb language plpgsql security invoker set search_path='' as $$
declare
 v_pin public.ywi_landscape_master_signer_pins_563%rowtype;
 v_source public.ywi_landscape_provider_verified_561%rowtype;
 v_pilot public.ywi_landscape_provider_pilot_decisions_562%rowtype;
 v_case public.ywi_landscape_recovery_cases_556%rowtype;
 v_prior public.ywi_landscape_master_observations_563%rowtype;
 v_saved public.ywi_landscape_master_observations_563%rowtype;
 v_compare text;
begin
 if current_user<>'service_role' then raise exception '563 protected source required'; end if;
 if p_company_id is null or p_request_id is null or
  p_provider_verified_receipt_id is null or p_source_pilot_decision_id is null or
  p_case_version not between 3 and 10000 or p_nonce is null or
  p_issuer<>'ai-data-platform' or p_key_id !~ '^[A-Za-z0-9_.:-]{6,96}$' or
  p_controller_revision !~ '^[0-9a-f]{40}$' or
  p_master_receipt_ref !~ '^[A-Za-z0-9_./:-]{10,160}$' or
  p_master_claimed_sha256 !~ '^[0-9a-f]{64}$' or
  p_observed_state not in ('acknowledged','discrepancy','rejected') or
  p_canonical_sha256 !~ '^[0-9a-f]{64}$' or
  p_signature_sha256 !~ '^[0-9a-f]{64}$' or
  p_issued_at is null or p_issued_at<now()-interval '10 minutes' or
  p_issued_at>now()+interval '2 minutes' then
  raise exception '563 invalid or stale signed Master observation'; end if;
 perform pg_advisory_xact_lock(hashtextextended('yw563:'||p_issuer||':'||p_nonce::text,0));
 select * into v_pin from public.ywi_landscape_master_signer_pins_563
  where issuer=p_issuer and key_id=p_key_id and state='ACTIVE' and
   valid_from<=now() and (valid_until is null or valid_until>now())
   and char_length(custody_evidence_ref)>=10;
 if not found then raise exception '563 independent Master signer pin HOLD'; end if;
 select * into v_case from public.ywi_landscape_recovery_cases_556
  where company_id=p_company_id and request_id=p_request_id;
 if not found or v_case.case_version<>p_case_version then
  raise exception '563 original case version mismatch'; end if;
 select * into v_source from public.ywi_landscape_provider_verified_561
  where id=p_provider_verified_receipt_id and company_id=p_company_id and
   request_id=p_request_id and case_version=p_case_version;
 if not found then raise exception '563 signed provider source mismatch'; end if;
 select * into v_pilot from public.ywi_landscape_provider_pilot_decisions_562
  where id=p_source_pilot_decision_id and company_id=p_company_id and
   request_id=p_request_id and case_version=p_case_version and
   provider_verified_receipt_id=p_provider_verified_receipt_id and
   source_decision='approve_for_master_review';
 if not found then raise exception '563 independently owner-approved source pilot missing'; end if;
 v_compare:=case when p_observed_state='rejected' then 'MASTER_REJECTED'
  when p_master_claimed_sha256<>v_source.canonical_sha256 then 'HASH_MISMATCH'
  when p_observed_state='discrepancy' then 'MASTER_DISCREPANCY'
  else 'MATCHED_RECEIPT_CLAIM' end;
 select * into v_prior from public.ywi_landscape_master_observations_563
  where issuer=p_issuer and replay_nonce=p_nonce;
 if found then
  if v_prior.company_id<>p_company_id or v_prior.request_id<>p_request_id or
   v_prior.case_version<>p_case_version or
   v_prior.provider_verified_receipt_id<>p_provider_verified_receipt_id or
   v_prior.source_pilot_decision_id<>p_source_pilot_decision_id or
   v_prior.key_id<>p_key_id or v_prior.controller_revision<>p_controller_revision or
   v_prior.master_receipt_ref<>p_master_receipt_ref or
   v_prior.master_claimed_sha256<>p_master_claimed_sha256 or
   v_prior.observed_state<>p_observed_state or
   v_prior.issued_at<>p_issued_at or v_prior.canonical_sha256<>p_canonical_sha256 or
   v_prior.signature_sha256<>p_signature_sha256 then
   raise exception '563 conflicting Master signed nonce replay'; end if;
  return jsonb_build_object('observation_id',v_prior.id,'comparison',v_prior.comparison,
   'replayed',true,'master_owner_accepted',false,'customer_delivery_verified',false);
 end if;
 if exists(select 1 from public.ywi_landscape_master_observations_563
  where issuer=p_issuer and master_receipt_ref=p_master_receipt_ref) then
  raise exception '563 Master receipt identity reused with different nonce'; end if;
 insert into public.ywi_landscape_master_observations_563(
  company_id,request_id,case_version,provider_verified_receipt_id,source_pilot_decision_id,
  issuer,key_id,controller_revision,master_receipt_ref,master_claimed_sha256,
  source_canonical_sha256,observed_state,comparison,replay_nonce,issued_at,
  canonical_sha256,signature_sha256)
 values(p_company_id,p_request_id,p_case_version,p_provider_verified_receipt_id,p_source_pilot_decision_id,
  p_issuer,p_key_id,p_controller_revision,p_master_receipt_ref,p_master_claimed_sha256,
  v_source.canonical_sha256,p_observed_state,v_compare,p_nonce,p_issued_at,
  p_canonical_sha256,p_signature_sha256)
 returning * into v_saved;
 return jsonb_build_object('observation_id',v_saved.id,'comparison',v_saved.comparison,
  'replayed',false,'master_owner_accepted',false,'customer_delivery_verified',false);
end $$;
revoke all on function public.ywi_rpc_landscape_master_observation_admit_563(
 uuid,uuid,integer,uuid,uuid,text,text,text,text,text,text,uuid,timestamptz,text,text)
 from public,anon,authenticated;
grant execute on function public.ywi_rpc_landscape_master_observation_admit_563(
 uuid,uuid,integer,uuid,uuid,text,text,text,text,text,text,uuid,timestamptz,text,text)
 to service_role;

-- Source-level owner follow-up events, immutable and receipt-specific.
create table if not exists public.ywi_landscape_followup_decisions_563 (
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null,
 request_id uuid not null,
 case_version integer not null check(case_version between 3 and 10000),
 provider_verified_receipt_id uuid not null references
  public.ywi_landscape_provider_verified_561(id) on delete restrict,
 master_observation_id uuid references
  public.ywi_landscape_master_observations_563(id) on delete restrict,
 action text not null check(action in (
  'request_master_recheck','escalate_receipt_discrepancy','approve_source_followup_closure')),
 owner_user_id uuid not null references auth.users(id) on delete restrict,
 owner_note text not null check(char_length(btrim(owner_note)) between 15 and 500),
 idempotency_key uuid not null,
 recorded_at timestamptz not null default now(),
 foreign key(company_id,request_id) references
  public.ywi_landscape_recovery_cases_556(company_id,request_id) on delete restrict,
 unique(company_id,idempotency_key),
 unique(company_id,request_id,case_version,provider_verified_receipt_id,action)
);
create index if not exists ywi_563_original_followup_history on
 public.ywi_landscape_followup_decisions_563(company_id,request_id,recorded_at desc);
alter table public.ywi_landscape_followup_decisions_563 enable row level security;
revoke all on public.ywi_landscape_followup_decisions_563 from public,anon,authenticated;
grant select on public.ywi_landscape_followup_decisions_563 to authenticated,service_role;
drop policy if exists ywi_563_followup_owner_select on public.ywi_landscape_followup_decisions_563;
create policy ywi_563_followup_owner_select on public.ywi_landscape_followup_decisions_563
 for select to authenticated using ((select auth.uid()) is not null and
 coalesce((auth.jwt()->>'is_anonymous')::boolean,false)=false and
 exists(select 1 from public.ywi_companies c
  where c.id=company_id and c.owner_user_id=(select auth.uid())));

create or replace function public.ywi_rpc_landscape_master_receipt_review_563(
 p_company_id uuid,p_request_id uuid,p_provider_verified_receipt_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare
 v_source jsonb;
 v_case public.ywi_landscape_recovery_cases_556%rowtype;
 v_ack public.ywi_landscape_master_observations_563%rowtype;
 v_prior public.ywi_landscape_followup_decisions_563%rowtype;
 v_ready boolean:=false;
 v_pilot boolean:=false;
begin
 perform public.ywi_422_assert_owner(p_company_id);
 if p_request_id is null or p_provider_verified_receipt_id is null then
  raise exception '563 original provider receipt required'; end if;
 v_source:=public.ywi_rpc_landscape_provider_pilot_review_562(
  p_company_id,p_request_id,p_provider_verified_receipt_id);
 if v_source->>'company_id'<>p_company_id::text or
  v_source->>'request_id'<>p_request_id::text or
  v_source->>'verified_receipt_id'<>p_provider_verified_receipt_id::text then
  raise exception '563 original pilot source changed'; end if;
 select * into v_case from public.ywi_landscape_recovery_cases_556
  where company_id=p_company_id and request_id=p_request_id;
 if not found then raise exception '563 original recovery case unavailable'; end if;
 v_pilot:=v_source->>'source_owner_decision'='approve_for_master_review';
 select * into v_ack from public.ywi_landscape_master_observations_563
  where company_id=p_company_id and request_id=p_request_id and
   case_version=v_case.case_version and provider_verified_receipt_id=p_provider_verified_receipt_id
  order by verified_at desc,id desc limit 1;
 v_ready:=v_pilot and v_source->>'source_pilot_ready'='true' and
  v_ack.id is not null and v_ack.comparison='MATCHED_RECEIPT_CLAIM' and
  v_ack.source_canonical_sha256=v_source->>'canonical_sha256' and
  v_ack.verified_at>=now()-interval '24 hours' and
  v_ack.verified_at<=now()+interval '2 minutes';
 select * into v_prior from public.ywi_landscape_followup_decisions_563
  where company_id=p_company_id and request_id=p_request_id and
   case_version=v_case.case_version and provider_verified_receipt_id=p_provider_verified_receipt_id
  order by recorded_at desc,id desc limit 1;
 return jsonb_build_object(
  'company_id',p_company_id,'request_id',p_request_id,
  'case_version',v_case.case_version,'provider_verified_receipt_id',p_provider_verified_receipt_id,
  'canonical_sha256',v_source->>'canonical_sha256',
  'source_pilot_approved',v_pilot,'source_pilot_current',v_source->'source_pilot_ready',
  'master_observation_id',v_ack.id,'master_observation_verified_at',v_ack.verified_at,
  'master_comparison',coalesce(v_ack.comparison,'HOLD_NO_INDEPENDENT_MASTER_RECEIPT'),
  'master_claimed_sha256',v_ack.master_claimed_sha256,
  'controller_revision',v_ack.controller_revision,
  'source_followup_closure_ready',v_ready,
  'latest_owner_action',coalesce(v_prior.action,'HOLD'),
  'latest_owner_action_id',v_prior.id,
  'source_followup_gate',case
   when v_prior.action='approve_source_followup_closure' then 'SOURCE_FOLLOWUP_CLOSED_MASTER_ACCEPTANCE_HOLD'
   when not v_pilot then 'HOLD_NO_SOURCE_OWNER_PILOT_APPROVAL'
   when v_ack.id is null then 'HOLD_NO_INDEPENDENT_MASTER_RECEIPT'
   when v_ack.comparison<>'MATCHED_RECEIPT_CLAIM' then 'DISCREPANCY_OWNER_TRIAGE_REQUIRED'
   when v_ready then 'READY_FOR_SOURCE_OWNER_FOLLOWUP_CLOSURE'
   else 'HOLD_STALE_MASTER_ACK_OR_ORIGINAL_CLOSURE' end,
  'recipient_delivery_independently_verified',false,'customer_message_sent',false,
  'master_owner_acceptance',false,'master_connected',false,
  'company_scope_only',true,'read_only',true,'checked_at',now());
end $$;
revoke all on function public.ywi_rpc_landscape_master_receipt_review_563(uuid,uuid,uuid)
 from public,anon,authenticated;
grant execute on function public.ywi_rpc_landscape_master_receipt_review_563(uuid,uuid,uuid)
 to authenticated;

create or replace function public.ywi_rpc_landscape_followup_decide_563(
 p_company_id uuid,p_request_id uuid,p_provider_verified_receipt_id uuid,
 p_expected_case_version integer,p_master_observation_id uuid,
 p_action text,p_note text,p_idempotency_key uuid,p_owner_attested boolean)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 v_case public.ywi_landscape_recovery_cases_556%rowtype;
 v_review jsonb;
 v_existing public.ywi_landscape_followup_decisions_563%rowtype;
 v_saved public.ywi_landscape_followup_decisions_563%rowtype;
begin
 perform public.ywi_422_assert_owner(p_company_id);
 perform public.ywi_422_assert_jobs_create();
 if auth.uid() is null or
  coalesce((auth.jwt()->>'is_anonymous')::boolean,false)=true or
  p_request_id is null or p_provider_verified_receipt_id is null or
  p_expected_case_version not between 3 and 10000 or
  p_action not in ('request_master_recheck','escalate_receipt_discrepancy','approve_source_followup_closure') or
  p_idempotency_key is null or p_owner_attested is distinct from true or
  char_length(btrim(coalesce(p_note,''))) not between 15 and 500 then
  raise exception '563 original owner and attestation required'; end if;
 perform pg_advisory_xact_lock(hashtextextended('yw563owner:'||
  p_company_id::text||':'||p_request_id::text,0));
 select * into v_case from public.ywi_landscape_recovery_cases_556
  where company_id=p_company_id and request_id=p_request_id for update;
 if not found or v_case.case_version<>p_expected_case_version then
  raise exception '563 original case version changed'; end if;
 v_review:=public.ywi_rpc_landscape_master_receipt_review_563(
  p_company_id,p_request_id,p_provider_verified_receipt_id);
 select * into v_existing from public.ywi_landscape_followup_decisions_563
  where company_id=p_company_id and idempotency_key=p_idempotency_key;
 if found then
  if v_existing.request_id<>p_request_id or
   v_existing.case_version<>p_expected_case_version or
   v_existing.provider_verified_receipt_id<>p_provider_verified_receipt_id or
   v_existing.master_observation_id is distinct from p_master_observation_id or
   v_existing.action<>p_action or v_existing.owner_note<>btrim(p_note) or
   v_existing.owner_user_id is distinct from auth.uid() then
   raise exception '563 conflicting owner follow-up replay'; end if;
  return jsonb_build_object('status','SOURCE_FOLLOWUP_DECISION_RECORDED_MASTER_HOLD',
   'decision_id',v_existing.id,'replayed',true,'master_owner_acceptance',false);
 end if;
 if p_master_observation_id is distinct from nullif(v_review->>'master_observation_id','')::uuid then
  raise exception '563 Master observation identity or freshness changed'; end if;
 if p_action='approve_source_followup_closure' and
   (v_review->>'source_followup_closure_ready'<>'true' or
    v_review->>'latest_owner_action'='approve_source_followup_closure') then
  raise exception '563 source closure requires fresh matching independent Master claim'; end if;
 if p_action='escalate_receipt_discrepancy' and
   (p_master_observation_id is null or
    v_review->>'master_comparison' not in
     ('HASH_MISMATCH','MASTER_DISCREPANCY','MASTER_REJECTED')) then
  raise exception '563 independently recorded discrepancy required'; end if;
 if p_action='request_master_recheck' and
    v_review->>'latest_owner_action'='approve_source_followup_closure' then
  raise exception '563 source follow-up already closed'; end if;
 if exists(select 1 from public.ywi_landscape_followup_decisions_563 a
  where a.company_id=p_company_id and a.request_id=p_request_id and
   a.case_version=p_expected_case_version and
   a.provider_verified_receipt_id=p_provider_verified_receipt_id and a.action=p_action) then
  raise exception '563 owner follow-up action already recorded for source version'; end if;
 insert into public.ywi_landscape_followup_decisions_563(
  company_id,request_id,case_version,provider_verified_receipt_id,master_observation_id,
  action,owner_user_id,owner_note,idempotency_key)
 values(p_company_id,p_request_id,p_expected_case_version,p_provider_verified_receipt_id,
  p_master_observation_id,p_action,auth.uid(),btrim(p_note),p_idempotency_key)
 returning * into v_saved;
 return jsonb_build_object('status','SOURCE_FOLLOWUP_DECISION_RECORDED_MASTER_HOLD',
  'decision_id',v_saved.id,'action',v_saved.action,'replayed',false,
  'customer_message_sent',false,'recipient_delivery_independently_verified',false,
  'master_owner_acceptance',false,'master_connected',false);
end $$;
revoke all on function public.ywi_rpc_landscape_followup_decide_563(
 uuid,uuid,uuid,integer,uuid,text,text,uuid,boolean) from public,anon,authenticated;
grant execute on function public.ywi_rpc_landscape_followup_decide_563(
 uuid,uuid,uuid,integer,uuid,text,text,uuid,boolean) to authenticated;

-- Protected platform-shell aggregate only. Never export company IDs, original
-- case IDs, signing key material or customer data.
create or replace function public.ywi_rpc_landscape_master_receipt_summary_563()
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare v_matched bigint;v_discrepancy bigint;v_closed bigint;
begin
 if current_user<>'service_role' then
  raise exception '563 protected platform-shell source only'; end if;
 select count(*) filter(where comparison='MATCHED_RECEIPT_CLAIM'),
  count(*) filter(where comparison<>'MATCHED_RECEIPT_CLAIM')
 into v_matched,v_discrepancy from public.ywi_landscape_master_observations_563;
 select count(*) into v_closed from public.ywi_landscape_followup_decisions_563
  where action='approve_source_followup_closure';
 return jsonb_build_object('schema','rosevear.yw.master-receipt-triage-aggregate.v1',
  'source_id','yw','source_role','platform_shell','tenant_boundary','platform_shell',
  'matched_master_receipt_claims',v_matched,'master_discrepancies',v_discrepancy,
  'source_owner_followup_closures',v_closed,
  'recipient_delivery_independently_verified',false,
  'master_owner_acceptance',false,'master_connected',false,
  'handoff','INDEPENDENT_MASTER_OWNER_DECISION_REQUIRED','checked_at',now());
end $$;
revoke all on function public.ywi_rpc_landscape_master_receipt_summary_563()
 from public,anon,authenticated;
grant execute on function public.ywi_rpc_landscape_master_receipt_summary_563()
 to service_role;

comment on table public.ywi_landscape_master_observations_563 is
 'Independently verified AI Data Platform receipt claim. Not a Master owner acceptance.';
comment on table public.ywi_landscape_followup_decisions_563 is
 'Immutable owner source follow-up closure only; cannot send customer messages or change Master connection.';
