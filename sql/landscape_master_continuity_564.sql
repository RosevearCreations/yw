-- YW564: protected signed Master observation replay signals, source-owner SLA
-- and independent cross-plane evidence renewal. Requires YW553–563 in order.
-- No migration here installs prior schema, enrolls signers or accepts a Master.
create table if not exists public.ywi_landscape_master_replay_signals_564 (
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null,
 request_id uuid not null,
 provider_verified_receipt_id uuid not null references
  public.ywi_landscape_provider_verified_561(id) on delete restrict,
 issuer text not null check(issuer='ai-data-platform'),
 key_id text not null,
 nonce_fingerprint text not null check(nonce_fingerprint ~ '^[0-9a-f]{64}$'),
 signature_sha256 text not null check(signature_sha256 ~ '^[0-9a-f]{64}$'),
 master_ref_fingerprint text not null check(master_ref_fingerprint ~ '^[0-9a-f]{64}$'),
 signal text not null check(signal='SIGNED_ADMISSION_REJECTED'),
 detected_at timestamptz not null default now(),
 foreign key(company_id,request_id) references
  public.ywi_landscape_recovery_cases_556(company_id,request_id) on delete restrict,
 foreign key(issuer,key_id) references
  public.ywi_landscape_master_signer_pins_563(issuer,key_id) on delete restrict,
 unique(issuer,nonce_fingerprint,signature_sha256)
);
create index if not exists ywi_564_original_replay_signals on
 public.ywi_landscape_master_replay_signals_564
 (company_id,request_id,provider_verified_receipt_id,detected_at desc);
alter table public.ywi_landscape_master_replay_signals_564 enable row level security;
revoke all on public.ywi_landscape_master_replay_signals_564
 from public,anon,authenticated;
grant select,insert on public.ywi_landscape_master_replay_signals_564 to service_role;
grant select on public.ywi_landscape_master_replay_signals_564 to authenticated;
drop policy if exists ywi_564_original_owner_signal_read on
 public.ywi_landscape_master_replay_signals_564;
create policy ywi_564_original_owner_signal_read on
 public.ywi_landscape_master_replay_signals_564 for select to authenticated
 using ((select auth.uid()) is not null and
  coalesce((auth.jwt()->>'is_anonymous')::boolean,false)=false and
  exists(select 1 from public.ywi_companies c
    where c.id=company_id and c.owner_user_id=(select auth.uid())));

-- Called ONLY after the YW563 backend verifies an independently pinned
-- Master Ed25519 signature but its protected source-admission RPC rejects it.
-- No raw signed message, token, customer identity or IP enters this ledger.
create or replace function public.ywi_rpc_landscape_master_replay_signal_564(
 p_company_id uuid,p_request_id uuid,p_provider_verified_receipt_id uuid,
 p_issuer text,p_key_id text,p_nonce_fingerprint text,
 p_signature_sha256 text,p_master_ref_fingerprint text
) returns jsonb language plpgsql security invoker set search_path='' as $$
declare
 v_record public.ywi_landscape_master_replay_signals_564%rowtype;
begin
 if current_user<>'service_role' then
  raise exception '564 protected signed-observation source required'; end if;
 if p_company_id is null or p_request_id is null or
  p_provider_verified_receipt_id is null or p_issuer<>'ai-data-platform' or
  p_nonce_fingerprint !~ '^[0-9a-f]{64}$' or
  p_signature_sha256 !~ '^[0-9a-f]{64}$' or
  p_master_ref_fingerprint !~ '^[0-9a-f]{64}$' or
  p_key_id !~ '^[A-Za-z0-9_.:-]{6,96}$' then
  raise exception '564 malformed protected replay fingerprint'; end if;
 if not exists(
  select 1 from public.ywi_landscape_master_signer_pins_563 k
  where k.issuer=p_issuer and k.key_id=p_key_id and k.state='ACTIVE'
    and k.valid_from<=now() and (k.valid_until is null or k.valid_until>now())) then
  raise exception '564 independent signer pin not current'; end if;
 if not exists(
  select 1 from public.ywi_landscape_provider_verified_561 v
  where v.id=p_provider_verified_receipt_id and v.company_id=p_company_id
    and v.request_id=p_request_id) then
  raise exception '564 original source correlation unavailable'; end if;
 perform pg_advisory_xact_lock(hashtextextended(
  'yw564:masterreplay:'||p_issuer||':'||p_nonce_fingerprint,0));
 insert into public.ywi_landscape_master_replay_signals_564(
  company_id,request_id,provider_verified_receipt_id,issuer,key_id,
  nonce_fingerprint,signature_sha256,master_ref_fingerprint,signal)
 values(p_company_id,p_request_id,p_provider_verified_receipt_id,p_issuer,p_key_id,
  p_nonce_fingerprint,p_signature_sha256,p_master_ref_fingerprint,
  'SIGNED_ADMISSION_REJECTED')
 on conflict(issuer,nonce_fingerprint,signature_sha256) do nothing
 returning * into v_record;
 return jsonb_build_object(
  'status','PROTECTED_SIGNED_ADMISSION_HOLD','recorded',v_record.id is not null,
  'master_owner_acceptance',false,'master_connected',false,
  'recipient_delivery_independently_verified',false);
end $$;
revoke all on function public.ywi_rpc_landscape_master_replay_signal_564(
 uuid,uuid,uuid,text,text,text,text,text)
 from public,anon,authenticated;
grant execute on function public.ywi_rpc_landscape_master_replay_signal_564(
 uuid,uuid,uuid,text,text,text,text,text) to service_role;

-- Owner renewal actions are immutable source requests, NOT independent
-- evidence. A later separately signed YW563 Master observation is required.
create table if not exists public.ywi_landscape_master_renewal_requests_564 (
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null,
 request_id uuid not null,
 case_version integer not null check(case_version between 3 and 10000),
 provider_verified_receipt_id uuid not null references
  public.ywi_landscape_provider_verified_561(id) on delete restrict,
 baseline_master_observation_id uuid references
  public.ywi_landscape_master_observations_563(id) on delete restrict,
 owner_user_id uuid not null references auth.users(id) on delete restrict,
 action text not null check(action in (
  'request_signed_cross_plane_renewal',
  'acknowledge_resolution_sla_breach',
  'review_independently_renewed_source')),
 owner_note text not null check(char_length(btrim(owner_note)) between 15 and 500),
 idempotency_key uuid not null,
 recorded_at timestamptz not null default now(),
 foreign key(company_id,request_id) references
  public.ywi_landscape_recovery_cases_556(company_id,request_id) on delete restrict,
 unique(company_id,idempotency_key)
);
create index if not exists ywi_564_original_owner_renewal on
 public.ywi_landscape_master_renewal_requests_564
 (company_id,request_id,provider_verified_receipt_id,recorded_at desc);
alter table public.ywi_landscape_master_renewal_requests_564 enable row level security;
revoke all on public.ywi_landscape_master_renewal_requests_564
 from public,anon,authenticated;
grant select on public.ywi_landscape_master_renewal_requests_564 to authenticated,service_role;
drop policy if exists ywi_564_original_owner_renewal_read on
 public.ywi_landscape_master_renewal_requests_564;
create policy ywi_564_original_owner_renewal_read on
 public.ywi_landscape_master_renewal_requests_564 for select to authenticated
 using ((select auth.uid()) is not null and
  coalesce((auth.jwt()->>'is_anonymous')::boolean,false)=false and
  exists(select 1 from public.ywi_companies c
    where c.id=company_id and c.owner_user_id=(select auth.uid())));

create or replace function public.ywi_rpc_landscape_master_continuity_review_564(
 p_company_id uuid,p_request_id uuid,p_provider_verified_receipt_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare
 v_base jsonb;
 v_case public.ywi_landscape_recovery_cases_556%rowtype;
 v_pilot public.ywi_landscape_provider_pilot_decisions_562%rowtype;
 v_observation public.ywi_landscape_master_observations_563%rowtype;
 v_replay public.ywi_landscape_master_replay_signals_564%rowtype;
 v_last_request public.ywi_landscape_master_renewal_requests_564%rowtype;
 v_last_renewal public.ywi_landscape_master_renewal_requests_564%rowtype;
 v_anchor timestamptz;
 v_due timestamptz;
 v_sla text;
 v_class text;
 v_renewed boolean:=false;
begin
 perform public.ywi_422_assert_owner(p_company_id);
 if p_request_id is null or p_provider_verified_receipt_id is null then
  raise exception '564 original signed source receipt required'; end if;
 v_base:=public.ywi_rpc_landscape_master_receipt_review_563(
  p_company_id,p_request_id,p_provider_verified_receipt_id);
 if v_base->>'company_id'<>p_company_id::text or
    v_base->>'request_id'<>p_request_id::text or
    v_base->>'provider_verified_receipt_id'<>p_provider_verified_receipt_id::text then
  raise exception '564 original source revision changed'; end if;
 select * into v_case from public.ywi_landscape_recovery_cases_556
  where company_id=p_company_id and request_id=p_request_id;
 if not found or v_case.case_version<>(v_base->>'case_version')::integer then
  raise exception '564 original case version changed'; end if;
 select * into v_pilot from public.ywi_landscape_provider_pilot_decisions_562
  where company_id=p_company_id and request_id=p_request_id
   and provider_verified_receipt_id=p_provider_verified_receipt_id
   and case_version=v_case.case_version and source_decision='approve_for_master_review'
  order by recorded_at desc limit 1;
 select * into v_observation from public.ywi_landscape_master_observations_563
  where company_id=p_company_id and request_id=p_request_id
   and case_version=v_case.case_version
   and provider_verified_receipt_id=p_provider_verified_receipt_id
  order by verified_at desc,id desc limit 1;
 select * into v_replay from public.ywi_landscape_master_replay_signals_564
  where company_id=p_company_id and request_id=p_request_id
   and provider_verified_receipt_id=p_provider_verified_receipt_id
  order by detected_at desc,id desc limit 1;
 select * into v_last_request from public.ywi_landscape_master_renewal_requests_564
  where company_id=p_company_id and request_id=p_request_id
   and case_version=v_case.case_version
   and provider_verified_receipt_id=p_provider_verified_receipt_id
  order by recorded_at desc,id desc limit 1;
 select * into v_last_renewal from public.ywi_landscape_master_renewal_requests_564
  where company_id=p_company_id and request_id=p_request_id
   and case_version=v_case.case_version
   and provider_verified_receipt_id=p_provider_verified_receipt_id
   and action='request_signed_cross_plane_renewal'
  order by recorded_at desc,id desc limit 1;
 v_renewed:=v_last_renewal.id is not null and
   v_observation.id is not null and
   v_observation.verified_at>v_last_renewal.recorded_at and
   v_observation.comparison='MATCHED_RECEIPT_CLAIM' and
   v_base->>'source_followup_closure_ready'='true';
 v_class:=case
  when v_pilot.id is null then 'SOURCE_PILOT_HOLD'
  when v_replay.id is not null and
   (v_observation.id is null or v_replay.detected_at>=v_observation.verified_at)
   then 'SIGNED_REPLAY_OR_ADMISSION_EXCEPTION'
  when v_observation.id is null then 'MISSING_INDEPENDENT_MASTER_RECEIPT'
  when v_observation.comparison<>'MATCHED_RECEIPT_CLAIM'
   then 'CROSS_PLANE_DISCREPANCY'
  when v_base->>'source_followup_closure_ready'<>'true'
   then 'ORIGINAL_CLOSURE_OR_STALE_RECEIPT_HOLD'
  else 'MATCHED_INDEPENDENT_SOURCE_CLAIM' end;
 v_anchor:=case
  when v_class='SIGNED_REPLAY_OR_ADMISSION_EXCEPTION' then v_replay.detected_at
  when v_class='CROSS_PLANE_DISCREPANCY' then v_observation.verified_at
  else coalesce(v_observation.verified_at,v_pilot.recorded_at) end;
 v_due:=case
  when v_class='SIGNED_REPLAY_OR_ADMISSION_EXCEPTION' then v_anchor+interval '1 hour'
  when v_class='CROSS_PLANE_DISCREPANCY' then v_anchor+interval '4 hours'
  when v_class='MATCHED_INDEPENDENT_SOURCE_CLAIM' then v_anchor+interval '24 hours'
  else v_anchor+interval '24 hours' end;
 v_sla:=case
  when v_anchor is null then 'HOLD_NO_ORIGINAL_SOURCE'
  when v_due<now() then 'BREACHED'
  when v_due<=now()+interval '1 hour' then 'DUE_SOON'
  else 'WITHIN_TARGET' end;
 return jsonb_build_object(
  'company_id',p_company_id,'request_id',p_request_id,
  'case_version',v_case.case_version,'provider_verified_receipt_id',p_provider_verified_receipt_id,
  'canonical_sha256',v_base->>'canonical_sha256',
  'master_observation_id',v_observation.id,
  'master_observation_comparison',coalesce(v_observation.comparison,'HOLD'),
  'master_observation_verified_at',v_observation.verified_at,
  'latest_signed_replay_signal_at',v_replay.detected_at,
  'signed_replay_exception_count',(
   select count(*) from public.ywi_landscape_master_replay_signals_564 rs
   where rs.company_id=p_company_id and rs.request_id=p_request_id
    and rs.provider_verified_receipt_id=p_provider_verified_receipt_id),
  'continuity_classification',v_class,
  'resolution_sla_state',v_sla,'resolution_sla_due_at',v_due,
  'last_owner_renewal_action',coalesce(v_last_request.action,'HOLD'),
  'last_owner_renewal_action_id',v_last_request.id,
  'latest_renewal_request_at',v_last_renewal.recorded_at,
  'independent_renewal_evidence_current',v_renewed,
  'source_followup_closure_ready',v_base->'source_followup_closure_ready',
  'recipient_delivery_independently_verified',false,'customer_message_sent',false,
  'master_owner_acceptance',false,'master_connected',false,
  'company_scope_only',true,'read_only',true,'checked_at',now());
end $$;
revoke all on function public.ywi_rpc_landscape_master_continuity_review_564(uuid,uuid,uuid)
 from public,anon,authenticated;
grant execute on function public.ywi_rpc_landscape_master_continuity_review_564(uuid,uuid,uuid)
 to authenticated;

create or replace function public.ywi_rpc_landscape_master_renewal_decide_564(
 p_company_id uuid,p_request_id uuid,p_provider_verified_receipt_id uuid,
 p_expected_case_version integer,p_expected_master_observation_id uuid,
 p_action text,p_note text,p_idempotency_key uuid,p_owner_attested boolean)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 v_case public.ywi_landscape_recovery_cases_556%rowtype;
 v_review jsonb;
 v_prior public.ywi_landscape_master_renewal_requests_564%rowtype;
 v_saved public.ywi_landscape_master_renewal_requests_564%rowtype;
begin
 perform public.ywi_422_assert_owner(p_company_id);
 perform public.ywi_422_assert_jobs_create();
 if auth.uid() is null or
  coalesce((auth.jwt()->>'is_anonymous')::boolean,false)=true or
  p_request_id is null or p_provider_verified_receipt_id is null or
  p_expected_case_version not between 3 and 10000 or
  p_action not in ('request_signed_cross_plane_renewal',
   'acknowledge_resolution_sla_breach','review_independently_renewed_source') or
  char_length(btrim(coalesce(p_note,''))) not between 15 and 500 or
  p_idempotency_key is null or p_owner_attested is distinct from true then
  raise exception '564 owner attestation and source action required'; end if;
 perform pg_advisory_xact_lock(hashtextextended(
  'yw564:owner:'||p_company_id::text||':'||p_request_id::text,0));
 select * into v_case from public.ywi_landscape_recovery_cases_556
  where company_id=p_company_id and request_id=p_request_id for update;
 if not found or v_case.case_version<>p_expected_case_version then
  raise exception '564 original case revision drift'; end if;
 v_review:=public.ywi_rpc_landscape_master_continuity_review_564(
  p_company_id,p_request_id,p_provider_verified_receipt_id);
 select * into v_prior from public.ywi_landscape_master_renewal_requests_564
  where company_id=p_company_id and idempotency_key=p_idempotency_key;
 if found then
  if v_prior.request_id<>p_request_id or
   v_prior.case_version<>p_expected_case_version or
   v_prior.provider_verified_receipt_id<>p_provider_verified_receipt_id or
   v_prior.baseline_master_observation_id is distinct from p_expected_master_observation_id or
   v_prior.action<>p_action or v_prior.owner_note<>btrim(p_note) or
   v_prior.owner_user_id is distinct from auth.uid() then
   raise exception '564 conflicting owner renewal replay'; end if;
  return jsonb_build_object('status','SOURCE_RENEWAL_ACTION_RECORDED_MASTER_HOLD',
   'action_id',v_prior.id,'replayed',true,'master_owner_acceptance',false);
 end if;
 if p_expected_master_observation_id is distinct from
   nullif(v_review->>'master_observation_id','')::uuid then
  raise exception '564 signed Master observation changed'; end if;
 if p_action='acknowledge_resolution_sla_breach' and
  v_review->>'resolution_sla_state'<>'BREACHED' then
  raise exception '564 only actual source resolution SLA breach can be acknowledged'; end if;
 if p_action='review_independently_renewed_source' and
  v_review->>'independent_renewal_evidence_current'<>'true' then
  raise exception '564 fresh independently signed Master renewal required'; end if;
 if p_action='request_signed_cross_plane_renewal' and
  exists(select 1 from public.ywi_landscape_master_renewal_requests_564 d
   where d.company_id=p_company_id and d.request_id=p_request_id
    and d.case_version=p_expected_case_version
    and d.provider_verified_receipt_id=p_provider_verified_receipt_id
    and d.action=p_action and d.recorded_at>now()-interval '30 minutes') then
  raise exception '564 renewal requested recently; avoid repeated requests'; end if;
 if p_action='review_independently_renewed_source' and
  exists(select 1 from public.ywi_landscape_master_renewal_requests_564 d
   where d.company_id=p_company_id and d.request_id=p_request_id
    and d.case_version=p_expected_case_version
    and d.provider_verified_receipt_id=p_provider_verified_receipt_id
    and d.action=p_action and d.baseline_master_observation_id is not distinct from
     p_expected_master_observation_id) then
  raise exception '564 owner already reviewed this exact independent renewal'; end if;
 insert into public.ywi_landscape_master_renewal_requests_564(
  company_id,request_id,case_version,provider_verified_receipt_id,
  baseline_master_observation_id,owner_user_id,action,owner_note,idempotency_key)
 values(p_company_id,p_request_id,p_expected_case_version,p_provider_verified_receipt_id,
  p_expected_master_observation_id,auth.uid(),p_action,btrim(p_note),p_idempotency_key)
 returning * into v_saved;
 return jsonb_build_object('status','SOURCE_RENEWAL_ACTION_RECORDED_MASTER_HOLD',
  'action_id',v_saved.id,'action',v_saved.action,'replayed',false,
  'recipient_delivery_independently_verified',false,
  'customer_message_sent',false,'master_owner_acceptance',false,'master_connected',false);
end $$;
revoke all on function public.ywi_rpc_landscape_master_renewal_decide_564(
 uuid,uuid,uuid,integer,uuid,text,text,uuid,boolean)
 from public,anon,authenticated;
grant execute on function public.ywi_rpc_landscape_master_renewal_decide_564(
 uuid,uuid,uuid,integer,uuid,text,text,uuid,boolean) to authenticated;

-- Platform-shell aggregate only; never expose original tenant/case identifiers.
create or replace function public.ywi_rpc_landscape_master_continuity_summary_564()
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare v_signals bigint;v_requests bigint;v_renewed bigint;
begin
 if current_user<>'service_role' then
  raise exception '564 protected platform-shell monitoring only'; end if;
 select count(*) into v_signals from public.ywi_landscape_master_replay_signals_564;
 select count(*) into v_requests from public.ywi_landscape_master_renewal_requests_564
  where action='request_signed_cross_plane_renewal';
 select count(*) into v_renewed from public.ywi_landscape_master_renewal_requests_564
  where action='review_independently_renewed_source';
 return jsonb_build_object(
  'schema','rosevear.yw.master-replay-sla-aggregate.v1',
  'source_id','yw','source_role','platform_shell','tenant_boundary','platform_shell',
  'independent_signed_admission_exceptions',v_signals,
  'source_owner_renewal_requests',v_requests,
  'source_owner_independent_renewal_reviews',v_renewed,
  'recipient_delivery_independently_verified',false,
  'master_owner_acceptance',false,'master_connected',false,
  'handoff','INDEPENDENT_NEW_SIGNED_MASTER_OBSERVATION_REQUIRED',
  'checked_at',now());
end $$;
revoke all on function public.ywi_rpc_landscape_master_continuity_summary_564()
 from public,anon,authenticated;
grant execute on function public.ywi_rpc_landscape_master_continuity_summary_564()
 to service_role;

comment on table public.ywi_landscape_master_replay_signals_564 is
 'Hashed exception telemetry after protected independent Master signature verification; no private evidence';
comment on table public.ywi_landscape_master_renewal_requests_564 is
 'Immutable source-owner renewal requests and acknowledgments; not Master acceptance or customer delivery';
