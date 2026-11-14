-- YW567: append-only ORIGINAL owner signed escalation reopen and source SLA
-- remediation audit. Requires YW553–566 authorized migrations in dependency order.
-- Source observations are never Master owner acceptance, CONNECTED or delivery.
create table if not exists public.ywi_landscape_master_remediation_audits_567 (
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null,
 request_id uuid not null,
 case_version integer not null check(case_version between 3 and 10000),
 provider_verified_receipt_id uuid not null references
  public.ywi_landscape_provider_verified_561(id) on delete restrict,
 source_reconciliation_id uuid references
  public.ywi_landscape_master_escalation_outcomes_566(id) on delete restrict,
 anchor_master_observation_id uuid references
  public.ywi_landscape_master_observations_563(id) on delete restrict,
 owner_user_id uuid not null references auth.users(id) on delete restrict,
 action text not null check(action in
  ('record_signed_source_reopen','audit_signed_source_remediation',
   'request_supervised_remediation_recheck')),
 source_status text not null,
 owner_note text not null check(char_length(btrim(owner_note)) between 15 and 500),
 idempotency_key uuid not null,
 recorded_at timestamptz not null default now(),
 foreign key(company_id,request_id) references
  public.ywi_landscape_recovery_cases_556(company_id,request_id) on delete restrict,
 unique(company_id,idempotency_key)
);
create index if not exists ywi_567_source_history on
 public.ywi_landscape_master_remediation_audits_567
 (company_id,request_id,provider_verified_receipt_id,recorded_at desc);
alter table public.ywi_landscape_master_remediation_audits_567 enable row level security;
revoke all on public.ywi_landscape_master_remediation_audits_567 from public,anon,authenticated;
grant select on public.ywi_landscape_master_remediation_audits_567 to authenticated,service_role;
drop policy if exists ywi_567_original_owner_read on
 public.ywi_landscape_master_remediation_audits_567;
create policy ywi_567_original_owner_read on
 public.ywi_landscape_master_remediation_audits_567 for select to authenticated
 using ((select auth.uid()) is not null and
  coalesce((auth.jwt()->>'is_anonymous')::boolean,false)=false and
  exists(select 1 from public.ywi_companies c
   where c.id=company_id and c.owner_user_id=(select auth.uid())));

create or replace function public.ywi_rpc_landscape_master_remediation_review_567(
 p_company_id uuid,p_request_id uuid,p_provider_verified_receipt_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare
 v_source jsonb;
 v_reconciled public.ywi_landscape_master_escalation_outcomes_566%rowtype;
 v_reopened public.ywi_landscape_master_remediation_audits_567%rowtype;
 v_audited public.ywi_landscape_master_remediation_audits_567%rowtype;
 v_last_action public.ywi_landscape_master_remediation_audits_567%rowtype;
 v_observation public.ywi_landscape_master_observations_563%rowtype;
 v_last_risk timestamptz;
 v_case_version integer;
 v_status text:='NO_SOURCE_RECONCILIATION_HOLD';
 v_signed_risk_reopen boolean:=false;
 v_sla_breached boolean:=false;
 v_stale boolean:=true;
 v_audit_ready boolean:=false;
 v_audit_current boolean:=false;
 v_risk_after_close boolean:=false;
begin
 perform public.ywi_422_assert_owner(p_company_id);
 if p_request_id is null or p_provider_verified_receipt_id is null then
  raise exception '567 exact original source receipt required'; end if;
 v_source:=public.ywi_rpc_landscape_master_drift_forecast_review_566(
  p_company_id,p_request_id,p_provider_verified_receipt_id);
 if v_source->>'company_id'<>p_company_id::text or
  v_source->>'request_id'<>p_request_id::text or
  v_source->>'provider_verified_receipt_id'<>p_provider_verified_receipt_id::text or
  v_source->>'forecast_is_deterministic_watch_not_prediction'<>'true' or
  v_source->>'master_connected'<>'false' or
  v_source->>'master_owner_acceptance'<>'false' then
   raise exception '567 original company and independent source HOLD changed'; end if;
 v_case_version:=(v_source->>'case_version')::integer;
 select * into v_reconciled from public.ywi_landscape_master_escalation_outcomes_566
 where company_id=p_company_id and request_id=p_request_id
  and case_version=v_case_version
  and provider_verified_receipt_id=p_provider_verified_receipt_id
  and action='reconcile_signed_source_recovery'
 order by recorded_at desc,id desc limit 1;
 select * into v_reopened from public.ywi_landscape_master_remediation_audits_567
 where company_id=p_company_id and request_id=p_request_id
  and case_version=v_case_version
  and provider_verified_receipt_id=p_provider_verified_receipt_id
  and action='record_signed_source_reopen'
 order by recorded_at desc,id desc limit 1;
 select * into v_audited from public.ywi_landscape_master_remediation_audits_567
 where company_id=p_company_id and request_id=p_request_id
  and case_version=v_case_version
  and provider_verified_receipt_id=p_provider_verified_receipt_id
  and action='audit_signed_source_remediation'
 order by recorded_at desc,id desc limit 1;
 select * into v_last_action from public.ywi_landscape_master_remediation_audits_567
 where company_id=p_company_id and request_id=p_request_id
  and case_version=v_case_version
  and provider_verified_receipt_id=p_provider_verified_receipt_id
 order by recorded_at desc,id desc limit 1;
 select * into v_observation from public.ywi_landscape_master_observations_563
 where company_id=p_company_id and request_id=p_request_id
  and case_version=v_case_version
  and provider_verified_receipt_id=p_provider_verified_receipt_id
 order by verified_at desc,id desc limit 1;
 v_last_risk:=nullif(v_source->>'last_signed_risk_at','')::timestamptz;
 v_signed_risk_reopen:=v_reconciled.id is not null and
  v_last_risk is not null and v_last_risk>v_reconciled.recorded_at and
  (v_reopened.id is null or v_last_risk>v_reopened.recorded_at) and
  (v_audited.id is null or v_last_risk>v_audited.recorded_at);
 v_sla_breached:=v_source->>'source_resolution_sla_state'='BREACHED';
 v_stale:=v_observation.id is null or
  v_observation.comparison<>'MATCHED_RECEIPT_CLAIM' or
  v_observation.verified_at<now()-interval '24 hours';
 v_risk_after_close:=v_audited.id is not null and
  v_last_risk is not null and v_last_risk>v_audited.recorded_at;
 v_audit_ready:=v_reopened.id is not null and
  (v_audited.id is null or v_audited.recorded_at<v_reopened.recorded_at) and
  v_observation.id is not null and
  v_observation.comparison='MATCHED_RECEIPT_CLAIM' and
  v_observation.verified_at>v_reopened.recorded_at and
  v_observation.verified_at>=now()-interval '24 hours' and
  v_observation.verified_at<=now()+interval '2 minutes' and
  (v_last_risk is null or v_observation.verified_at>v_last_risk) and
  v_source->>'source_recovery_effective_after_escalation'='true' and
  v_source->>'forecast_classification'='SOURCE_STABLE_OBSERVATION_WATCH' and
  not v_sla_breached;
 v_audit_current:=v_audited.id is not null and
  v_audited.anchor_master_observation_id=v_observation.id and
  (v_reopened.id is null or v_audited.recorded_at>v_reopened.recorded_at) and
  not v_risk_after_close and not v_stale and not v_sla_breached;
 v_status:=case
  when v_reconciled.id is null then 'NO_SOURCE_RECONCILIATION_HOLD'
  when v_signed_risk_reopen then 'REOPEN_NEW_INDEPENDENT_SIGNED_RISK'
  when v_sla_breached and not v_audit_current then 'SOURCE_SLA_BREACH_REMEDIATION_REQUIRED'
  when v_stale and not v_audit_current then 'STALE_SIGNED_RECEIPT_RECHECK'
  when v_audit_current then 'SOURCE_REMEDIATION_AUDITED_MASTER_HOLD'
  when v_audit_ready then 'FRESH_SIGNED_SOURCE_REMEDIATION_READY'
  when v_reopened.id is not null and
   (v_audited.id is null or v_audited.recorded_at<v_reopened.recorded_at)
   then 'REOPEN_PENDING_INDEPENDENT_REMEDIATION'
  else 'SOURCE_RECONCILIATION_MONITORING_HOLD'
 end;
 return jsonb_build_object(
  'company_id',p_company_id,'request_id',p_request_id,
  'case_version',v_case_version,
  'provider_verified_receipt_id',p_provider_verified_receipt_id,
  'canonical_sha256',v_source->>'canonical_sha256',
  'source_reconciliation_id',v_reconciled.id,
  'source_reconciled_at',v_reconciled.recorded_at,
  'source_reopen_id',v_reopened.id,'source_reopened_at',v_reopened.recorded_at,
  'latest_source_remediation_audit_id',v_audited.id,
  'last_owner_action',coalesce(v_last_action.action,'HOLD'),
  'last_owner_action_id',v_last_action.id,
  'master_observation_id',v_observation.id,
  'master_observation_verified_at',v_observation.verified_at,
  'last_signed_risk_at',v_last_risk,
  'signed_risk_after_reconciliation',v_signed_risk_reopen,
  'source_sla_state',v_source->>'source_resolution_sla_state',
  'source_sla_due_at',v_source->'source_resolution_sla_due_at',
  'source_sla_breached',v_sla_breached,
  'source_receipt_stale',v_stale,
  'independent_source_remediation_ready',v_audit_ready,
  'remediation_audit_current',v_audit_current,
  'remediation_classification',v_status,
  'source_only_not_continuous_uptime',true,
  'recipient_delivery_independently_verified',false,
  'customer_message_sent',false,
  'master_owner_acceptance',false,'master_connected',false,
  'company_scope_only',true,'read_only',true,'checked_at',now());
end $$;
revoke all on function public.ywi_rpc_landscape_master_remediation_review_567(uuid,uuid,uuid)
 from public,anon,authenticated;
grant execute on function public.ywi_rpc_landscape_master_remediation_review_567(uuid,uuid,uuid)
 to authenticated;

create or replace function public.ywi_rpc_landscape_master_remediation_decide_567(
 p_company_id uuid,p_request_id uuid,p_provider_verified_receipt_id uuid,
 p_expected_case_version integer,p_expected_reconciliation_id uuid,
 p_expected_observation_id uuid,p_action text,p_note text,
 p_idempotency_key uuid,p_owner_attested boolean)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 v_case public.ywi_landscape_recovery_cases_556%rowtype;
 v_review jsonb;
 v_prior public.ywi_landscape_master_remediation_audits_567%rowtype;
 v_saved public.ywi_landscape_master_remediation_audits_567%rowtype;
begin
 perform public.ywi_422_assert_owner(p_company_id);
 perform public.ywi_422_assert_jobs_create();
 if auth.uid() is null or
  coalesce((auth.jwt()->>'is_anonymous')::boolean,false)=true or
  p_request_id is null or p_provider_verified_receipt_id is null or
  p_expected_case_version not between 3 and 10000 or
  p_action not in ('record_signed_source_reopen','audit_signed_source_remediation',
   'request_supervised_remediation_recheck') or
  char_length(btrim(coalesce(p_note,''))) not between 15 and 500 or
  p_idempotency_key is null or p_owner_attested is distinct from true then
  raise exception '567 original owner signed source attestation required'; end if;
 perform pg_advisory_xact_lock(hashtextextended(
  'yw567:owner:'||p_company_id::text||':'||p_request_id::text,0));
 select * into v_case from public.ywi_landscape_recovery_cases_556
  where company_id=p_company_id and request_id=p_request_id for update;
 if not found or v_case.case_version<>p_expected_case_version then
  raise exception '567 original case version drift'; end if;
 v_review:=public.ywi_rpc_landscape_master_remediation_review_567(
  p_company_id,p_request_id,p_provider_verified_receipt_id);
 select * into v_prior from public.ywi_landscape_master_remediation_audits_567
  where company_id=p_company_id and idempotency_key=p_idempotency_key;
 if found then
  if v_prior.request_id<>p_request_id or
   v_prior.case_version<>p_expected_case_version or
   v_prior.provider_verified_receipt_id<>p_provider_verified_receipt_id or
   v_prior.source_reconciliation_id is distinct from p_expected_reconciliation_id or
   v_prior.anchor_master_observation_id is distinct from p_expected_observation_id or
   v_prior.action<>p_action or v_prior.owner_note<>btrim(p_note) or
   v_prior.owner_user_id is distinct from auth.uid() then
   raise exception '567 conflicting owner idempotency replay'; end if;
  return jsonb_build_object('status','SOURCE_REMEDIATION_ACTION_RECORDED_MASTER_HOLD',
   'audit_id',v_prior.id,'replayed',true,'master_owner_acceptance',false);
 end if;
 if p_expected_reconciliation_id is distinct from
   nullif(v_review->>'source_reconciliation_id','')::uuid or
   p_expected_observation_id is distinct from
   nullif(v_review->>'master_observation_id','')::uuid then
   raise exception '567 original signed source reconciliation or receipt changed'; end if;
 if p_action='record_signed_source_reopen' and
  (p_expected_reconciliation_id is null or
   (v_review->>'signed_risk_after_reconciliation'<>'true' and
    v_review->>'source_sla_breached'<>'true') or
   v_review->>'remediation_classification'='SOURCE_REMEDIATION_AUDITED_MASTER_HOLD')
  then raise exception '567 new signed risk or breached source SLA required'; end if;
 if p_action='audit_signed_source_remediation' and
  (p_expected_reconciliation_id is null or
   v_review->>'independent_source_remediation_ready'<>'true') then
   raise exception '567 new independently signed remediation after reopen required'; end if;
 if p_action='request_supervised_remediation_recheck' and
  exists(select 1 from public.ywi_landscape_master_remediation_audits_567 a
   where a.company_id=p_company_id and a.request_id=p_request_id
    and a.case_version=p_expected_case_version
    and a.provider_verified_receipt_id=p_provider_verified_receipt_id
    and a.action=p_action and a.recorded_at>now()-interval '30 minutes') then
  raise exception '567 supervised remediation recheck requested recently'; end if;
 if p_action in ('record_signed_source_reopen','audit_signed_source_remediation') and
  exists(select 1 from public.ywi_landscape_master_remediation_audits_567 a
   where a.company_id=p_company_id and a.request_id=p_request_id
    and a.case_version=p_expected_case_version
    and a.provider_verified_receipt_id=p_provider_verified_receipt_id
    and a.source_reconciliation_id is not distinct from p_expected_reconciliation_id
    and a.anchor_master_observation_id is not distinct from p_expected_observation_id
    and a.action=p_action) then
  raise exception '567 exact original signed source action already recorded'; end if;
 insert into public.ywi_landscape_master_remediation_audits_567(
  company_id,request_id,case_version,provider_verified_receipt_id,
  source_reconciliation_id,anchor_master_observation_id,owner_user_id,
  action,source_status,owner_note,idempotency_key)
 values(p_company_id,p_request_id,p_expected_case_version,p_provider_verified_receipt_id,
  p_expected_reconciliation_id,p_expected_observation_id,auth.uid(),
  p_action,v_review->>'remediation_classification',btrim(p_note),p_idempotency_key)
 returning * into v_saved;
 return jsonb_build_object('status','SOURCE_REMEDIATION_ACTION_RECORDED_MASTER_HOLD',
  'audit_id',v_saved.id,'action',v_saved.action,'replayed',false,
  'recipient_delivery_independently_verified',false,
  'customer_message_sent',false,'master_owner_acceptance',false,
  'master_connected',false);
end $$;
revoke all on function public.ywi_rpc_landscape_master_remediation_decide_567(
 uuid,uuid,uuid,integer,uuid,uuid,text,text,uuid,boolean)
 from public,anon,authenticated;
grant execute on function public.ywi_rpc_landscape_master_remediation_decide_567(
 uuid,uuid,uuid,integer,uuid,uuid,text,text,uuid,boolean)
 to authenticated;

create or replace function public.ywi_rpc_landscape_master_remediation_summary_567()
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare v_reopens bigint;v_audits bigint;v_rechecks bigint;
begin
 if current_user<>'service_role' then
  raise exception '567 protected platform source aggregate required'; end if;
 select count(*) filter(where action='record_signed_source_reopen'),
  count(*) filter(where action='audit_signed_source_remediation'),
  count(*) filter(where action='request_supervised_remediation_recheck')
 into v_reopens,v_audits,v_rechecks
 from public.ywi_landscape_master_remediation_audits_567;
 return jsonb_build_object('schema','rosevear.yw.source-remediation-summary.v1',
  'source_id','yw','source_role','platform_shell','tenant_boundary','platform_shell',
  'owner_source_reopen_records',v_reopens,
  'owner_signed_remediation_audits',v_audits,
  'supervised_source_recheck_requests',v_rechecks,
  'recipient_delivery_independently_verified',false,
  'master_owner_acceptance',false,'master_connected',false,
  'source_only_not_continuous_uptime',true,
  'tenant_export',false,'checked_at',now());
end $$;
revoke all on function public.ywi_rpc_landscape_master_remediation_summary_567()
 from public,anon,authenticated;
grant execute on function public.ywi_rpc_landscape_master_remediation_summary_567()
 to service_role;
comment on table public.ywi_landscape_master_remediation_audits_567 is
 'Original owner immutable signed source reopen/remediation audit. Does not change Master receiver or customer delivery.';
