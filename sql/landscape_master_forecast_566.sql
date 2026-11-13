-- YW566: source-bound risk watch and original-owner signed escalation outcome
-- reconciliation. Requires approved YW553–565 migrations before installation.
-- Not an AI probability estimate, customer deliverability proof or Master status.
create table if not exists public.ywi_landscape_master_escalation_outcomes_566 (
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null,
 request_id uuid not null,
 case_version integer not null check(case_version between 3 and 10000),
 provider_verified_receipt_id uuid not null references
  public.ywi_landscape_provider_verified_561(id) on delete restrict,
 source_escalation_id uuid references
  public.ywi_landscape_master_stability_reviews_565(id) on delete restrict,
 anchor_master_observation_id uuid references
  public.ywi_landscape_master_observations_563(id) on delete restrict,
 owner_user_id uuid not null references auth.users(id) on delete restrict,
 action text not null check(action in (
  'request_supervised_source_followup','record_source_escalation_open',
  'reconcile_signed_source_recovery')),
 forecast_classification text not null check(
  forecast_classification in ('HOLD_NO_SIGNED_SOURCE','SOURCE_SIGNED_RISK_ACTIVE',
   'SOURCE_SLA_BREACHED','SOURCE_SLA_DUE_SOON','SOURCE_RECEIPT_STALE',
   'SOURCE_SIGNED_RISK_WATCH','SOURCE_RENEWAL_RECOVERY_WATCH',
   'SOURCE_STABLE_OBSERVATION_WATCH')),
 source_escalation_outcome text not null check(source_escalation_outcome in
  ('SOURCE_ONLY_OPEN','SOURCE_RECOVERY_RECONCILED_MASTER_HOLD')),
 owner_note text not null check(char_length(btrim(owner_note)) between 15 and 500),
 idempotency_key uuid not null,
 recorded_at timestamptz not null default now(),
 foreign key(company_id,request_id) references
  public.ywi_landscape_recovery_cases_556(company_id,request_id) on delete restrict,
 unique(company_id,idempotency_key)
);
create index if not exists ywi_566_owner_history on
 public.ywi_landscape_master_escalation_outcomes_566
 (company_id,request_id,provider_verified_receipt_id,recorded_at desc);
alter table public.ywi_landscape_master_escalation_outcomes_566 enable row level security;
revoke all on public.ywi_landscape_master_escalation_outcomes_566
 from public,anon,authenticated;
grant select on public.ywi_landscape_master_escalation_outcomes_566
 to authenticated,service_role;
drop policy if exists ywi_566_original_owner_read on
 public.ywi_landscape_master_escalation_outcomes_566;
create policy ywi_566_original_owner_read on
 public.ywi_landscape_master_escalation_outcomes_566
 for select to authenticated using ((select auth.uid()) is not null and
  coalesce((auth.jwt()->>'is_anonymous')::boolean,false)=false and
  exists(select 1 from public.ywi_companies c where c.id=company_id
   and c.owner_user_id=(select auth.uid())));

create or replace function public.ywi_rpc_landscape_master_drift_forecast_review_566(
 p_company_id uuid,p_request_id uuid,p_provider_verified_receipt_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare
 v_source jsonb;
 v_escalation public.ywi_landscape_master_stability_reviews_565%rowtype;
 v_observation public.ywi_landscape_master_observations_563%rowtype;
 v_owner public.ywi_landscape_master_escalation_outcomes_566%rowtype;
 v_class text:='HOLD_NO_SIGNED_SOURCE';
 v_outcome text:='SOURCE_ONLY_OPEN';
 v_last_risk timestamptz;
 v_latest_observed_at timestamptz;
 v_sla_due timestamptz;
 v_obs_expiry timestamptz;
 v_alert_by timestamptz;
 v_current_signed boolean:=false;
 v_post_escalation boolean:=false;
 v_effective boolean:=false;
 v_newer_risk boolean:=true;
 v_reconciled boolean:=false;
 v_risk24 bigint:=0;v_risk7 bigint:=0;
begin
 perform public.ywi_422_assert_owner(p_company_id);
 if p_request_id is null or p_provider_verified_receipt_id is null then
  raise exception '566 original signed source receipt required'; end if;
 v_source:=public.ywi_rpc_landscape_master_stability_review_565(
  p_company_id,p_request_id,p_provider_verified_receipt_id);
 if v_source->>'company_id'<>p_company_id::text or
  v_source->>'request_id'<>p_request_id::text or
  v_source->>'provider_verified_receipt_id'<>p_provider_verified_receipt_id::text or
  v_source->>'continuity_is_observational_not_uptime'<>'true' or
  v_source->>'master_owner_acceptance'<>'false' or
  v_source->>'master_connected'<>'false' then
  raise exception '566 protected original source or Master HOLD changed'; end if;
 select * into v_escalation from public.ywi_landscape_master_stability_reviews_565
  where company_id=p_company_id and request_id=p_request_id
   and case_version=(v_source->>'case_version')::integer
   and provider_verified_receipt_id=p_provider_verified_receipt_id
   and action='escalate_long_horizon_drift'
  order by recorded_at desc,id desc limit 1;
 select * into v_observation from public.ywi_landscape_master_observations_563
  where company_id=p_company_id and request_id=p_request_id
   and case_version=(v_source->>'case_version')::integer
   and provider_verified_receipt_id=p_provider_verified_receipt_id
  order by verified_at desc,id desc limit 1;
 v_latest_observed_at:=v_observation.verified_at;
 v_last_risk:=nullif(v_source->>'last_signed_risk_at','')::timestamptz;
 v_sla_due:=nullif(v_source->>'source_resolution_sla_due_at','')::timestamptz;
 v_risk24:=coalesce((v_source->>'signed_admission_exceptions_24h')::bigint,0)+
  coalesce((v_source->>'signed_discrepancies_24h')::bigint,0);
 v_risk7:=coalesce((v_source->>'signed_admission_exceptions_7d')::bigint,0)+
  coalesce((v_source->>'signed_discrepancies_7d')::bigint,0);
 v_current_signed:=v_observation.id is not null and
  v_observation.comparison='MATCHED_RECEIPT_CLAIM' and
  v_latest_observed_at>=now()-interval '24 hours' and
  v_latest_observed_at<=now()+interval '2 minutes';
 v_post_escalation:=v_escalation.id is not null and
  v_current_signed and v_latest_observed_at>v_escalation.recorded_at;
 v_newer_risk:=v_last_risk is not null and
  (v_latest_observed_at is null or v_last_risk>=v_latest_observed_at);
 v_effective:=v_post_escalation and
  v_source->>'source_recovery_evidence_effective'='true' and not v_newer_risk and
  v_source->>'stability_classification' in
   ('FRESH_SIGNED_SOURCE_RECOVERY_OBSERVED',
    'SEVEN_DAY_OBSERVED_RECEIPT_SPAN','THIRTY_DAY_OBSERVED_RECEIPT_SPAN');
 v_obs_expiry:=case when v_current_signed then v_latest_observed_at+interval '24 hours'
  else null end;
 v_alert_by:=case when v_sla_due is null then v_obs_expiry
  when v_obs_expiry is null then v_sla_due
  else least(v_sla_due,v_obs_expiry) end;
 v_class:=case
  when v_observation.id is null or v_source->>'stability_classification' in
   ('HOLD_ORIGINAL_SOURCE_PILOT','HOLD_NO_INDEPENDENT_MASTER_RECEIPT')
   then 'HOLD_NO_SIGNED_SOURCE'
  when v_newer_risk or v_source->>'stability_classification'='OPEN_SIGNED_ADMISSION_OR_DISCREPANCY'
   then 'SOURCE_SIGNED_RISK_ACTIVE'
  when v_source->>'source_resolution_sla_state'='BREACHED'
   then 'SOURCE_SLA_BREACHED'
  when v_source->>'source_resolution_sla_state'='DUE_SOON'
   then 'SOURCE_SLA_DUE_SOON'
  when not v_current_signed then 'SOURCE_RECEIPT_STALE'
  when v_risk24>0 then 'SOURCE_SIGNED_RISK_WATCH'
  when v_risk7>0 then 'SOURCE_RENEWAL_RECOVERY_WATCH'
  else 'SOURCE_STABLE_OBSERVATION_WATCH'
 end;
 select * into v_owner from public.ywi_landscape_master_escalation_outcomes_566
  where company_id=p_company_id and request_id=p_request_id
   and case_version=(v_source->>'case_version')::integer
   and provider_verified_receipt_id=p_provider_verified_receipt_id
  order by recorded_at desc,id desc limit 1;
 v_reconciled:=v_owner.id is not null and
  v_owner.action='reconcile_signed_source_recovery' and
  v_owner.anchor_master_observation_id=v_observation.id and
  v_owner.source_escalation_id=v_escalation.id and v_effective;
 v_outcome:=case when v_reconciled
  then 'SOURCE_RECOVERY_RECONCILED_MASTER_HOLD'
  else 'SOURCE_ONLY_OPEN' end;
 return jsonb_build_object(
  'company_id',p_company_id,'request_id',p_request_id,
  'case_version',(v_source->>'case_version')::integer,
  'provider_verified_receipt_id',p_provider_verified_receipt_id,
  'canonical_sha256',v_source->>'canonical_sha256',
  'source_escalation_id',v_escalation.id,
  'source_escalation_recorded_at',v_escalation.recorded_at,
  'master_observation_id',v_observation.id,
  'master_observation_verified_at',v_latest_observed_at,
  'last_signed_risk_at',v_last_risk,
  'signed_risk_events_24h',v_risk24,'signed_risk_events_7d',v_risk7,
  'forecast_classification',v_class,
  'forecast_is_deterministic_watch_not_prediction',true,
  'forecast_horizon_hours',24,
  'next_evidence_recheck_by',v_alert_by,
  'source_resolution_sla_due_at',v_sla_due,
  'source_resolution_sla_state',v_source->>'source_resolution_sla_state',
  'post_escalation_signed_evidence_current',v_post_escalation,
  'source_recovery_effective_after_escalation',v_effective,
  'source_escalation_outcome',v_outcome,
  'latest_owner_outcome_action',coalesce(v_owner.action,'HOLD'),
  'latest_owner_outcome_id',v_owner.id,
  'recipient_delivery_independently_verified',false,
  'customer_message_sent',false,'master_owner_acceptance',false,
  'master_connected',false,'company_scope_only',true,
  'read_only',true,'checked_at',now());
end $$;
revoke all on function public.ywi_rpc_landscape_master_drift_forecast_review_566(uuid,uuid,uuid)
 from public,anon,authenticated;
grant execute on function public.ywi_rpc_landscape_master_drift_forecast_review_566(uuid,uuid,uuid)
 to authenticated;

create or replace function public.ywi_rpc_landscape_master_escalation_outcome_decide_566(
 p_company_id uuid,p_request_id uuid,p_provider_verified_receipt_id uuid,
 p_expected_case_version integer,p_expected_master_observation_id uuid,
 p_expected_source_escalation_id uuid,p_action text,
 p_note text,p_idempotency_key uuid,p_owner_attested boolean)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 v_case public.ywi_landscape_recovery_cases_556%rowtype;
 v_review jsonb;
 v_prior public.ywi_landscape_master_escalation_outcomes_566%rowtype;
 v_saved public.ywi_landscape_master_escalation_outcomes_566%rowtype;
begin
 perform public.ywi_422_assert_owner(p_company_id);
 perform public.ywi_422_assert_jobs_create();
 if auth.uid() is null or
  coalesce((auth.jwt()->>'is_anonymous')::boolean,false)=true or
  p_request_id is null or p_provider_verified_receipt_id is null or
  p_expected_case_version not between 3 and 10000 or
  p_action not in ('request_supervised_source_followup',
   'record_source_escalation_open','reconcile_signed_source_recovery') or
  char_length(btrim(coalesce(p_note,''))) not between 15 and 500 or
  p_idempotency_key is null or p_owner_attested is distinct from true then
  raise exception '566 original owner outcome attestation required'; end if;
 perform pg_advisory_xact_lock(hashtextextended(
  'yw566:owner:'||p_company_id::text||':'||p_request_id::text,0));
 select * into v_case from public.ywi_landscape_recovery_cases_556
  where company_id=p_company_id and request_id=p_request_id for update;
 if not found or v_case.case_version<>p_expected_case_version then
  raise exception '566 original case version changed'; end if;
 v_review:=public.ywi_rpc_landscape_master_drift_forecast_review_566(
  p_company_id,p_request_id,p_provider_verified_receipt_id);
 select * into v_prior from public.ywi_landscape_master_escalation_outcomes_566
  where company_id=p_company_id and idempotency_key=p_idempotency_key;
 if found then
  if v_prior.request_id<>p_request_id or
   v_prior.case_version<>p_expected_case_version or
   v_prior.provider_verified_receipt_id<>p_provider_verified_receipt_id or
   v_prior.source_escalation_id is distinct from p_expected_source_escalation_id or
   v_prior.anchor_master_observation_id is distinct from p_expected_master_observation_id or
   v_prior.action<>p_action or v_prior.owner_note<>btrim(p_note) or
   v_prior.owner_user_id is distinct from auth.uid() then
   raise exception '566 conflicting owner idempotency replay'; end if;
  return jsonb_build_object('status','SOURCE_ESCALATION_OUTCOME_RECORDED_MASTER_HOLD',
   'outcome_id',v_prior.id,'replayed',true,'master_owner_acceptance',false);
 end if;
 if p_expected_master_observation_id is distinct from
   nullif(v_review->>'master_observation_id','')::uuid or
   p_expected_source_escalation_id is distinct from
   nullif(v_review->>'source_escalation_id','')::uuid then
  raise exception '566 original signed observation or escalation changed'; end if;
 if p_action='record_source_escalation_open' and
  (p_expected_source_escalation_id is null or
   v_review->>'source_escalation_outcome'<>'SOURCE_ONLY_OPEN') then
  raise exception '566 original open source escalation required'; end if;
 if p_action='reconcile_signed_source_recovery' and
  (p_expected_source_escalation_id is null or
   v_review->>'post_escalation_signed_evidence_current'<>'true' or
   v_review->>'source_recovery_effective_after_escalation'<>'true' or
   v_review->>'source_escalation_outcome'<>'SOURCE_ONLY_OPEN') then
  raise exception '566 new independently signed recovery after escalation required'; end if;
 if p_action='request_supervised_source_followup' and
  exists(select 1 from public.ywi_landscape_master_escalation_outcomes_566 a
   where a.company_id=p_company_id and a.request_id=p_request_id
    and a.case_version=p_expected_case_version and
    a.provider_verified_receipt_id=p_provider_verified_receipt_id
    and a.action=p_action and a.recorded_at>now()-interval '30 minutes') then
  raise exception '566 supervised source follow-up requested recently'; end if;
 if p_action='reconcile_signed_source_recovery' and
  exists(select 1 from public.ywi_landscape_master_escalation_outcomes_566 a
   where a.company_id=p_company_id and a.request_id=p_request_id
    and a.case_version=p_expected_case_version and
    a.provider_verified_receipt_id=p_provider_verified_receipt_id and a.action=p_action
    and a.source_escalation_id=p_expected_source_escalation_id
    and a.anchor_master_observation_id=p_expected_master_observation_id) then
  raise exception '566 signed source outcome already reconciled for exact evidence'; end if;
 insert into public.ywi_landscape_master_escalation_outcomes_566(
  company_id,request_id,case_version,provider_verified_receipt_id,
  source_escalation_id,anchor_master_observation_id,owner_user_id,action,
  forecast_classification,source_escalation_outcome,owner_note,idempotency_key)
 values(p_company_id,p_request_id,p_expected_case_version,p_provider_verified_receipt_id,
  p_expected_source_escalation_id,p_expected_master_observation_id,auth.uid(),
  p_action,v_review->>'forecast_classification',
  case when p_action='reconcile_signed_source_recovery'
   then 'SOURCE_RECOVERY_RECONCILED_MASTER_HOLD' else 'SOURCE_ONLY_OPEN' end,
  btrim(p_note),p_idempotency_key)
 returning * into v_saved;
 return jsonb_build_object('status','SOURCE_ESCALATION_OUTCOME_RECORDED_MASTER_HOLD',
  'outcome_id',v_saved.id,'action',v_saved.action,'replayed',false,
  'source_escalation_outcome',v_saved.source_escalation_outcome,
  'recipient_delivery_independently_verified',false,'customer_message_sent',false,
  'master_owner_acceptance',false,'master_connected',false);
end $$;
revoke all on function public.ywi_rpc_landscape_master_escalation_outcome_decide_566(
 uuid,uuid,uuid,integer,uuid,uuid,text,text,uuid,boolean)
 from public,anon,authenticated;
grant execute on function public.ywi_rpc_landscape_master_escalation_outcome_decide_566(
 uuid,uuid,uuid,integer,uuid,uuid,text,text,uuid,boolean) to authenticated;

create or replace function public.ywi_rpc_landscape_master_forecast_summary_566()
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare v_open bigint;v_reconciled bigint;v_followup bigint;
begin
 if current_user<>'service_role' then
  raise exception '566 protected platform shell required'; end if;
 select count(*) filter(where action='record_source_escalation_open'),
  count(*) filter(where action='reconcile_signed_source_recovery'),
  count(*) filter(where action='request_supervised_source_followup')
 into v_open,v_reconciled,v_followup
 from public.ywi_landscape_master_escalation_outcomes_566;
 return jsonb_build_object('schema','rosevear.yw.source-forecast-aggregate.v1',
  'source_id','yw','source_role','platform_shell','tenant_boundary','platform_shell',
  'source_open_escalation_reviews',v_open,
  'source_signed_recovery_reconciliations',v_reconciled,
  'source_supervised_followups',v_followup,
  'forecast_is_deterministic_watch_not_prediction',true,
  'recipient_delivery_independently_verified',false,
  'master_owner_acceptance',false,'master_connected',false,
  'tenant_export',false,
  'handoff','INDEPENDENT_SIGNED_MASTER_AND_OWNER_GATE_REQUIRED',
  'checked_at',now());
end $$;
revoke all on function public.ywi_rpc_landscape_master_forecast_summary_566()
 from public,anon,authenticated;
grant execute on function public.ywi_rpc_landscape_master_forecast_summary_566()
 to service_role;
comment on table public.ywi_landscape_master_escalation_outcomes_566 is
 'Original company owner signed-source forecast classification and escalation outcome only. Neither customer delivery nor Master acceptance.';
