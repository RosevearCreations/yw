-- YW565: original-company source-only SLA recovery effectiveness and 1/7/30-day
-- signed Master receipt observation windows. Requires YW553-564 in order.
-- No customer-delivery, Master owner acceptance or CONNECTED authority.
create table if not exists public.ywi_landscape_master_stability_reviews_565 (
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null,
 request_id uuid not null,
 case_version integer not null check(case_version between 3 and 10000),
 provider_verified_receipt_id uuid not null references
  public.ywi_landscape_provider_verified_561(id) on delete restrict,
 anchor_master_observation_id uuid references
  public.ywi_landscape_master_observations_563(id) on delete restrict,
 owner_user_id uuid not null references auth.users(id) on delete restrict,
 action text not null check(action in (
  'request_fresh_independent_witness',
  'escalate_long_horizon_drift',
  'review_signed_source_recovery')),
 source_classification text not null,
 owner_note text not null check(char_length(btrim(owner_note)) between 15 and 500),
 idempotency_key uuid not null,
 recorded_at timestamptz not null default now(),
 foreign key(company_id,request_id) references
  public.ywi_landscape_recovery_cases_556(company_id,request_id) on delete restrict,
 unique(company_id,idempotency_key)
);
create index if not exists ywi_565_company_source_history on
 public.ywi_landscape_master_stability_reviews_565
 (company_id,request_id,provider_verified_receipt_id,recorded_at desc);
alter table public.ywi_landscape_master_stability_reviews_565 enable row level security;
revoke all on public.ywi_landscape_master_stability_reviews_565 from public,anon,authenticated;
grant select on public.ywi_landscape_master_stability_reviews_565 to authenticated,service_role;
drop policy if exists ywi_565_original_owner_only_read on
 public.ywi_landscape_master_stability_reviews_565;
create policy ywi_565_original_owner_only_read on
 public.ywi_landscape_master_stability_reviews_565 for select to authenticated
 using ((select auth.uid()) is not null and
  coalesce((auth.jwt()->>'is_anonymous')::boolean,false)=false and
  exists(select 1 from public.ywi_companies c
   where c.id=company_id and c.owner_user_id=(select auth.uid())));

create or replace function public.ywi_rpc_landscape_master_stability_review_565(
 p_company_id uuid,p_request_id uuid,p_provider_verified_receipt_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare
 v_source jsonb;
 v_case public.ywi_landscape_recovery_cases_556%rowtype;
 v_latest public.ywi_landscape_master_observations_563%rowtype;
 v_last_request public.ywi_landscape_master_renewal_requests_564%rowtype;
 v_owner public.ywi_landscape_master_stability_reviews_565%rowtype;
 v_last_risk timestamptz;
 v_first_match timestamptz;
 v_last_match timestamptz;
 v_match24 bigint:=0;v_match7 bigint:=0;v_match30 bigint:=0;
 v_exception24 bigint:=0;v_exception7 bigint:=0;v_exception30 bigint:=0;
 v_discrepancy24 bigint:=0;v_discrepancy7 bigint:=0;v_discrepancy30 bigint:=0;
 v_postrenew boolean:=false;v_fresh boolean:=false;v_recovery boolean:=false;
 v_class text:='HOLD_NO_INDEPENDENT_SIGNED_RENEWAL';
begin
 perform public.ywi_422_assert_owner(p_company_id);
 if p_request_id is null or p_provider_verified_receipt_id is null then
  raise exception '565 original signed receipt required'; end if;
 v_source:=public.ywi_rpc_landscape_master_continuity_review_564(
  p_company_id,p_request_id,p_provider_verified_receipt_id);
 if v_source->>'company_id'<>p_company_id::text or
  v_source->>'request_id'<>p_request_id::text or
  v_source->>'provider_verified_receipt_id'<>p_provider_verified_receipt_id::text then
  raise exception '565 original source scope mismatch'; end if;
 select * into v_case from public.ywi_landscape_recovery_cases_556
  where company_id=p_company_id and request_id=p_request_id;
 if not found or v_case.case_version<>(v_source->>'case_version')::integer then
  raise exception '565 original case version mismatch'; end if;
 select * into v_latest from public.ywi_landscape_master_observations_563
  where company_id=p_company_id and request_id=p_request_id
   and case_version=v_case.case_version
   and provider_verified_receipt_id=p_provider_verified_receipt_id
  order by verified_at desc,id desc limit 1;
 select * into v_last_request from public.ywi_landscape_master_renewal_requests_564
  where company_id=p_company_id and request_id=p_request_id
   and case_version=v_case.case_version and
   provider_verified_receipt_id=p_provider_verified_receipt_id
   and action='request_signed_cross_plane_renewal'
  order by recorded_at desc,id desc limit 1;
 -- Observations are controller-signed Master ACK claims, not real customer delivery.
 select count(*) filter(where verified_at>=now()-interval '24 hours'),
  count(*) filter(where verified_at>=now()-interval '7 days'),
  count(*) filter(where verified_at>=now()-interval '30 days'),
  min(verified_at),max(verified_at)
 into v_match24,v_match7,v_match30,v_first_match,v_last_match
 from public.ywi_landscape_master_observations_563
 where company_id=p_company_id and request_id=p_request_id
  and case_version=v_case.case_version and
  provider_verified_receipt_id=p_provider_verified_receipt_id
  and comparison='MATCHED_RECEIPT_CLAIM';
 select count(*) filter(where detected_at>=now()-interval '24 hours'),
  count(*) filter(where detected_at>=now()-interval '7 days'),
  count(*) filter(where detected_at>=now()-interval '30 days'),
  max(detected_at)
 into v_exception24,v_exception7,v_exception30,v_last_risk
 from public.ywi_landscape_master_replay_signals_564
 where company_id=p_company_id and request_id=p_request_id
  and provider_verified_receipt_id=p_provider_verified_receipt_id;
 select count(*) filter(where verified_at>=now()-interval '24 hours'),
  count(*) filter(where verified_at>=now()-interval '7 days'),
  count(*) filter(where verified_at>=now()-interval '30 days')
 into v_discrepancy24,v_discrepancy7,v_discrepancy30
 from public.ywi_landscape_master_observations_563
 where company_id=p_company_id and request_id=p_request_id
  and case_version=v_case.case_version
  and provider_verified_receipt_id=p_provider_verified_receipt_id
  and comparison<>'MATCHED_RECEIPT_CLAIM';
 select greatest(v_last_risk,max(verified_at)) into v_last_risk
 from public.ywi_landscape_master_observations_563
 where company_id=p_company_id and request_id=p_request_id
  and case_version=v_case.case_version and
  provider_verified_receipt_id=p_provider_verified_receipt_id
  and comparison<>'MATCHED_RECEIPT_CLAIM';
 v_postrenew:=v_last_request.id is not null and v_latest.id is not null and
  v_latest.comparison='MATCHED_RECEIPT_CLAIM' and
  v_latest.verified_at>v_last_request.recorded_at;
 v_fresh:=v_latest.id is not null and v_latest.comparison='MATCHED_RECEIPT_CLAIM' and
  v_latest.verified_at>=now()-interval '24 hours' and
  v_latest.verified_at<=now()+interval '2 minutes';
 v_recovery:=v_postrenew and v_fresh and
  v_source->>'independent_renewal_evidence_current'='true' and
  v_source->>'source_followup_closure_ready'='true' and
  (v_last_risk is null or v_latest.verified_at>v_last_risk) and
  v_source->>'continuity_classification'='MATCHED_INDEPENDENT_SOURCE_CLAIM';
 v_class:=case
  when v_source->>'continuity_classification'='SOURCE_PILOT_HOLD'
   then 'HOLD_ORIGINAL_SOURCE_PILOT'
  when v_latest.id is null then 'HOLD_NO_INDEPENDENT_MASTER_RECEIPT'
  when v_last_risk is not null and v_latest.verified_at<=v_last_risk
   then 'OPEN_SIGNED_ADMISSION_OR_DISCREPANCY'
  when not v_fresh then 'STALE_INDEPENDENT_MASTER_RECEIPT'
  when not v_recovery then 'HOLD_NO_VERIFIED_RENEWAL_RECOVERY'
  when v_first_match<=now()-interval '30 days' and v_match30>=2
   and v_exception30=0 and v_discrepancy30=0
   then 'THIRTY_DAY_OBSERVED_RECEIPT_SPAN'
  when v_first_match<=now()-interval '7 days' and v_match7>=2
   and v_exception7=0 and v_discrepancy7=0
   then 'SEVEN_DAY_OBSERVED_RECEIPT_SPAN'
  else 'FRESH_SIGNED_SOURCE_RECOVERY_OBSERVED' end;
 select * into v_owner from public.ywi_landscape_master_stability_reviews_565
  where company_id=p_company_id and request_id=p_request_id
   and case_version=v_case.case_version
   and provider_verified_receipt_id=p_provider_verified_receipt_id
  order by recorded_at desc,id desc limit 1;
 return jsonb_build_object(
  'company_id',p_company_id,'request_id',p_request_id,
  'case_version',v_case.case_version,
  'provider_verified_receipt_id',p_provider_verified_receipt_id,
  'canonical_sha256',v_source->>'canonical_sha256',
  'master_observation_id',v_latest.id,
  'master_observation_verified_at',v_latest.verified_at,
  'source_resolution_sla_state',v_source->>'resolution_sla_state',
  'source_resolution_sla_due_at',v_source->'resolution_sla_due_at',
  'signed_post_renewal_receipt_current',v_postrenew and v_fresh,
  'source_recovery_evidence_effective',v_recovery,
  'last_signed_risk_at',v_last_risk,
  'last_matched_receipt_at',v_last_match,
  'first_matched_receipt_at',v_first_match,
  'matched_receipts_24h',v_match24,'matched_receipts_7d',v_match7,
  'matched_receipts_30d',v_match30,
  'signed_admission_exceptions_24h',v_exception24,
  'signed_admission_exceptions_7d',v_exception7,
  'signed_admission_exceptions_30d',v_exception30,
  'signed_discrepancies_24h',v_discrepancy24,
  'signed_discrepancies_7d',v_discrepancy7,
  'signed_discrepancies_30d',v_discrepancy30,
  'stability_classification',v_class,
  'continuity_is_observational_not_uptime',true,
  'last_owner_stability_action',coalesce(v_owner.action,'HOLD'),
  'last_owner_stability_action_id',v_owner.id,
  'recipient_delivery_independently_verified',false,
  'customer_message_sent',false,'master_owner_acceptance',false,
  'master_connected',false,'company_scope_only',true,'read_only',true,'checked_at',now());
end $$;
revoke all on function public.ywi_rpc_landscape_master_stability_review_565(uuid,uuid,uuid)
 from public,anon,authenticated;
grant execute on function public.ywi_rpc_landscape_master_stability_review_565(uuid,uuid,uuid)
 to authenticated;

create or replace function public.ywi_rpc_landscape_master_stability_decide_565(
 p_company_id uuid,p_request_id uuid,p_provider_verified_receipt_id uuid,
 p_expected_case_version integer,p_expected_observation_id uuid,
 p_action text,p_note text,p_idempotency_key uuid,p_owner_attested boolean)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 v_case public.ywi_landscape_recovery_cases_556%rowtype;
 v_review jsonb;
 v_prior public.ywi_landscape_master_stability_reviews_565%rowtype;
 v_saved public.ywi_landscape_master_stability_reviews_565%rowtype;
begin
 perform public.ywi_422_assert_owner(p_company_id);
 perform public.ywi_422_assert_jobs_create();
 if auth.uid() is null or
  coalesce((auth.jwt()->>'is_anonymous')::boolean,false)=true or
  p_request_id is null or p_provider_verified_receipt_id is null or
  p_expected_case_version not between 3 and 10000 or
  p_action not in ('request_fresh_independent_witness',
   'escalate_long_horizon_drift','review_signed_source_recovery') or
  char_length(btrim(coalesce(p_note,''))) not between 15 and 500 or
  p_idempotency_key is null or p_owner_attested is distinct from true then
  raise exception '565 explicit original source owner required'; end if;
 perform pg_advisory_xact_lock(hashtextextended(
  'yw565:owner:'||p_company_id::text||':'||p_request_id::text,0));
 select * into v_case from public.ywi_landscape_recovery_cases_556
  where company_id=p_company_id and request_id=p_request_id for update;
 if not found or v_case.case_version<>p_expected_case_version then
  raise exception '565 original case version drift'; end if;
 v_review:=public.ywi_rpc_landscape_master_stability_review_565(
  p_company_id,p_request_id,p_provider_verified_receipt_id);
 select * into v_prior from public.ywi_landscape_master_stability_reviews_565
  where company_id=p_company_id and idempotency_key=p_idempotency_key;
 if found then
  if v_prior.request_id<>p_request_id or
   v_prior.case_version<>p_expected_case_version or
   v_prior.provider_verified_receipt_id<>p_provider_verified_receipt_id or
   v_prior.anchor_master_observation_id is distinct from p_expected_observation_id or
   v_prior.action<>p_action or v_prior.owner_note<>btrim(p_note) or
   v_prior.owner_user_id is distinct from auth.uid() then
   raise exception '565 conflicting owner idempotency replay'; end if;
  return jsonb_build_object('status','SOURCE_STABILITY_REVIEW_RECORDED_MASTER_HOLD',
   'action_id',v_prior.id,'replayed',true,'master_owner_acceptance',false);
 end if;
 if p_expected_observation_id is distinct from
   nullif(v_review->>'master_observation_id','')::uuid then
  raise exception '565 exact signed Master observation changed'; end if;
 if p_action='review_signed_source_recovery' and
  v_review->>'source_recovery_evidence_effective'<>'true' then
  raise exception '565 current independently signed source recovery required'; end if;
 if p_action='escalate_long_horizon_drift' and
  v_review->>'stability_classification' in
  ('FRESH_SIGNED_SOURCE_RECOVERY_OBSERVED',
   'SEVEN_DAY_OBSERVED_RECEIPT_SPAN','THIRTY_DAY_OBSERVED_RECEIPT_SPAN') then
  raise exception '565 no current source stability drift to escalate'; end if;
 if p_action='request_fresh_independent_witness' and
  exists(select 1 from public.ywi_landscape_master_stability_reviews_565 a
   where a.company_id=p_company_id and a.request_id=p_request_id
    and a.case_version=p_expected_case_version
    and a.provider_verified_receipt_id=p_provider_verified_receipt_id
    and a.action=p_action and a.recorded_at>now()-interval '30 minutes') then
  raise exception '565 fresh witness was requested recently'; end if;
 if p_action='review_signed_source_recovery' and
  exists(select 1 from public.ywi_landscape_master_stability_reviews_565 a
   where a.company_id=p_company_id and a.request_id=p_request_id
    and a.case_version=p_expected_case_version
    and a.provider_verified_receipt_id=p_provider_verified_receipt_id
    and a.anchor_master_observation_id is not distinct from p_expected_observation_id
    and a.action=p_action) then
  raise exception '565 exact independently signed receipt already reviewed'; end if;
 insert into public.ywi_landscape_master_stability_reviews_565(
  company_id,request_id,case_version,provider_verified_receipt_id,
  anchor_master_observation_id,owner_user_id,action,source_classification,
  owner_note,idempotency_key)
 values(p_company_id,p_request_id,p_expected_case_version,p_provider_verified_receipt_id,
  p_expected_observation_id,auth.uid(),p_action,
  v_review->>'stability_classification',btrim(p_note),p_idempotency_key)
 returning * into v_saved;
 return jsonb_build_object('status','SOURCE_STABILITY_REVIEW_RECORDED_MASTER_HOLD',
  'action_id',v_saved.id,'action',v_saved.action,'replayed',false,
  'recipient_delivery_independently_verified',false,
  'customer_message_sent',false,'master_owner_acceptance',false,'master_connected',false);
end $$;
revoke all on function public.ywi_rpc_landscape_master_stability_decide_565(
 uuid,uuid,uuid,integer,uuid,text,text,uuid,boolean) from public,anon,authenticated;
grant execute on function public.ywi_rpc_landscape_master_stability_decide_565(
 uuid,uuid,uuid,integer,uuid,text,text,uuid,boolean) to authenticated;

-- Protected platform-shell safe aggregate only (never exports tenant or case IDs).
create or replace function public.ywi_rpc_landscape_master_stability_summary_565()
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare v_reviews bigint;v_requests bigint;v_escalations bigint;
begin
 if current_user<>'service_role' then
  raise exception '565 protected platform shell service only'; end if;
 select count(*) filter(where action='review_signed_source_recovery'),
  count(*) filter(where action='request_fresh_independent_witness'),
  count(*) filter(where action='escalate_long_horizon_drift')
 into v_reviews,v_requests,v_escalations
 from public.ywi_landscape_master_stability_reviews_565;
 return jsonb_build_object('schema','rosevear.yw.source-stability-summary.v1',
  'source_id','yw','source_role','platform_shell','tenant_boundary','platform_shell',
  'source_owner_signed_recovery_reviews',v_reviews,
  'independent_witness_requests',v_requests,'source_owner_drift_escalations',v_escalations,
  'continuous_uptime_proven',false,'recipient_delivery_independently_verified',false,
  'master_owner_acceptance',false,'master_connected',false,
  'handoff','SOURCE_OBSERVATIONS_ONLY_INDEPENDENT_MASTER_OWNER_GATE',
  'checked_at',now());
end $$;
revoke all on function public.ywi_rpc_landscape_master_stability_summary_565()
 from public,anon,authenticated;
grant execute on function public.ywi_rpc_landscape_master_stability_summary_565()
 to service_role;
comment on table public.ywi_landscape_master_stability_reviews_565 is
 'Original owner immutable source-only review. No Master owner acceptance, customer delivery or continuous uptime proof.';
