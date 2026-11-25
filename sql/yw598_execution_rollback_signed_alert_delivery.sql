-- YW598 additive immutable original Master execution readback, separate physical
-- human witnesses, independently signed rollback drill and receiver ACK alert handoff.
-- No automatic key mutation, rollback, private source bytes or customer notification.
begin;
create table public.ywi_598_execution_receipts(
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null references public.ywi_companies(id) on delete restrict,
 approval_id uuid not null unique references public.ywi_597_cutover_approvals(id) on delete restrict,
 auditor_user_id uuid not null references auth.users(id) on delete restrict,
 request_nonce uuid not null unique,
 remote_receipt_id text not null unique check(length(remote_receipt_id) between 8 and 128),
 original_master_old_hmac text not null check(original_master_old_hmac ~ '^[0-9a-f]{64}$'),
 original_master_next_hmac text not null check(original_master_next_hmac ~ '^[0-9a-f]{64}$'),
 response_sha256 text not null check(response_sha256 ~ '^[0-9a-f]{64}$'),
 remote_executed_at timestamptz not null,
 verified_at timestamptz not null,
 receiver_claimed_state text not null check(receiver_claimed_state='NEXT_ACTIVE_OLD_ACCEPTED'),
 human_observation_not_yet_signed boolean not null default true check(human_observation_not_yet_signed=true),
 actual_remote_execution_reported boolean not null check(actual_remote_execution_reported=true),
 unique(company_id,id),
 check(remote_executed_at<=verified_at and remote_executed_at>=verified_at-interval '10 minutes')
);
create table public.ywi_598_execution_witnesses(
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null references public.ywi_companies(id) on delete restrict,
 execution_id uuid not null unique references public.ywi_598_execution_receipts(id) on delete restrict,
 owner_user_id uuid not null references auth.users(id) on delete restrict,
 observed_at timestamptz not null,
 evidence_sha256 text not null check(evidence_sha256 ~ '^[0-9a-f]{64}$'),
 local_hmac_sha256 text not null check(local_hmac_sha256 ~ '^[0-9a-f]{64}$'),
 self_attested_physical_observation boolean not null check(self_attested_physical_observation=true),
 hardware_attested boolean not null default false check(hardware_attested=false),
 unique(company_id,id)
);
create table public.ywi_598_rollback_drills(
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null references public.ywi_companies(id) on delete restrict,
 witness_id uuid not null unique references public.ywi_598_execution_witnesses(id) on delete restrict,
 auditor_user_id uuid not null references auth.users(id) on delete restrict,
 reviewer_user_id uuid not null references auth.users(id) on delete restrict,
 request_nonce uuid not null unique,
 remote_receipt_id text not null unique check(length(remote_receipt_id) between 8 and 128),
 old_master_hmac text not null check(old_master_hmac ~ '^[0-9a-f]{64}$'),
 next_master_hmac text not null check(next_master_hmac ~ '^[0-9a-f]{64}$'),
 response_sha256 text not null check(response_sha256 ~ '^[0-9a-f]{64}$'),
 observed_at timestamptz not null,
 remote_rollback_executed boolean not null check(remote_rollback_executed=true),
 reviewer_physically_witnessed boolean not null check(reviewer_physically_witnessed=true),
 receiver_reported_state text not null check(receiver_reported_state='OLD_ACTIVE_NEXT_AVAILABLE'),
 hardware_attested boolean not null default false check(hardware_attested=false),
 unique(company_id,id),
 check(auditor_user_id<>reviewer_user_id)
);
create table public.ywi_598_alert_consents(
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null unique references public.ywi_companies(id) on delete restrict,
 owner_user_id uuid not null references auth.users(id) on delete restrict,
 approved_channel text not null check(approved_channel='ORIGINAL_PINNED_MASTER_ACK_ONLY'),
 signed_at timestamptz not null,
 evidence_sha256 text not null check(evidence_sha256 ~ '^[0-9a-f]{64}$'),
 server_hmac_sha256 text not null check(server_hmac_sha256 ~ '^[0-9a-f]{64}$'),
 explicit_owner_consent boolean not null check(explicit_owner_consent=true),
 no_customer_notification boolean not null default true check(no_customer_notification=true),
 unique(company_id,id)
);
create table public.ywi_598_alert_deliveries(
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null references public.ywi_companies(id) on delete restrict,
 consent_id uuid not null references public.ywi_598_alert_consents(id) on delete restrict,
 alert_id uuid not null unique references public.ywi_597_health_alerts(id) on delete restrict,
 owner_user_id uuid not null references auth.users(id) on delete restrict,
 request_nonce uuid not null unique,
 original_master_receipt_id text not null unique check(length(original_master_receipt_id) between 8 and 128),
 source_event_sha256 text not null check(source_event_sha256 ~ '^[0-9a-f]{64}$'),
 receiver_ack_hmac text not null check(receiver_ack_hmac ~ '^[0-9a-f]{64}$'),
 delivered_at timestamptz not null,
 receiver_channel text not null check(receiver_channel='PINNED_MASTER_SIGNED_RECEIPT'),
 actual_customer_notification boolean not null default false check(actual_customer_notification=false),
 unique(company_id,id)
);
create index yw598_execution_company_time on public.ywi_598_execution_receipts(company_id,verified_at desc);
create index yw598_alert_delivery_company_time on public.ywi_598_alert_deliveries(company_id,delivered_at desc);
alter table public.ywi_598_execution_receipts enable row level security;
alter table public.ywi_598_execution_witnesses enable row level security;
alter table public.ywi_598_rollback_drills enable row level security;
alter table public.ywi_598_alert_consents enable row level security;
alter table public.ywi_598_alert_deliveries enable row level security;
revoke all on public.ywi_598_execution_receipts,public.ywi_598_execution_witnesses,
 public.ywi_598_rollback_drills,public.ywi_598_alert_consents,
 public.ywi_598_alert_deliveries from public,anon,authenticated;
grant select on public.ywi_598_execution_receipts,public.ywi_598_execution_witnesses,
 public.ywi_598_rollback_drills,public.ywi_598_alert_consents,
 public.ywi_598_alert_deliveries to authenticated;
create policy yw598_receipt_owner_read on public.ywi_598_execution_receipts for select
 to authenticated using(exists(select 1 from public.ywi_companies c
 where c.id=company_id and c.owner_user_id=(select auth.uid())));
create policy yw598_witness_owner_read on public.ywi_598_execution_witnesses for select
 to authenticated using(exists(select 1 from public.ywi_companies c
 where c.id=company_id and c.owner_user_id=(select auth.uid())));
create policy yw598_rollback_owner_read on public.ywi_598_rollback_drills for select
 to authenticated using(exists(select 1 from public.ywi_companies c
 where c.id=company_id and c.owner_user_id=(select auth.uid())));
create policy yw598_alert_consent_owner_read on public.ywi_598_alert_consents for select
 to authenticated using(exists(select 1 from public.ywi_companies c
 where c.id=company_id and c.owner_user_id=(select auth.uid())));
create policy yw598_delivery_owner_read on public.ywi_598_alert_deliveries for select
 to authenticated using(exists(select 1 from public.ywi_companies c
 where c.id=company_id and c.owner_user_id=(select auth.uid())));
create trigger yw598_receipts_immutable before update or delete on public.ywi_598_execution_receipts
 for each row execute function public.ywi_591_forbid_change();
create trigger yw598_witnesses_immutable before update or delete on public.ywi_598_execution_witnesses
 for each row execute function public.ywi_591_forbid_change();
create trigger yw598_rollbacks_immutable before update or delete on public.ywi_598_rollback_drills
 for each row execute function public.ywi_591_forbid_change();
create trigger yw598_consents_immutable before update or delete on public.ywi_598_alert_consents
 for each row execute function public.ywi_591_forbid_change();
create trigger yw598_deliveries_immutable before update or delete on public.ywi_598_alert_deliveries
 for each row execute function public.ywi_591_forbid_change();

create function public.ywi_598_record_execution(
 p_company_id uuid,p_approval_id uuid,p_auditor_user_id uuid,
 p_nonce uuid,p_remote_receipt_id text,p_old_hmac text,p_next_hmac text,
 p_response_sha256 text,p_remote_executed_at timestamptz,p_verified_at timestamptz
) returns jsonb language plpgsql security definer set search_path='' as $fn$
declare approval record; i record; pr record; canary record; ident uuid;
begin
 perform public.ywi_591_source_role_assert();
 select * into approval from public.ywi_597_cutover_approvals
  where id=p_approval_id and company_id=p_company_id for share;
 select * into i from public.ywi_597_cutover_intents
  where id=approval.intent_id and company_id=p_company_id for share;
 select * into pr from public.ywi_596_rotation_proofs
  where id=i.proof_id and company_id=p_company_id for share;
 select * into canary from public.ywi_596_canary_acks
  where id=i.canary_id and company_id=p_company_id for share;
 if approval.id is null or i.id is null or pr.id is null or canary.id is null or
  i.expires_at<=now() or approval.approval_scope<>'MANUAL_CUTOVER_ALLOWED_NOT_EXECUTED' or
  approval.actually_cut_over or canary.rotation_proof_id<>pr.id or
  p_auditor_user_id in(i.owner_user_id,i.reviewer_user_id,canary.source_actor_id) or
  p_verified_at<now()-interval '2 minutes' or p_verified_at>now()+interval '30 seconds' or
  p_remote_executed_at>p_verified_at or
  p_remote_executed_at<p_verified_at-interval '10 minutes' or
  length(p_remote_receipt_id) not between 8 and 128 or
  p_old_hmac !~ '^[0-9a-f]{64}$' or p_next_hmac !~ '^[0-9a-f]{64}$' or
  p_response_sha256 !~ '^[0-9a-f]{64}$' or
  not exists(select 1 from public.profiles
    where id=p_auditor_user_id and role='admin' and is_active=true) or
  not exists(select 1 from public.ywi_platform_administrators_489
    where user_id=p_auditor_user_id) or
  not exists(select 1 from public.ywi_591_tenant_pilots
    where company_id=p_company_id and owner_user_id=i.owner_user_id
    and reviewer_user_id=i.reviewer_user_id and state='APPROVED' and expires_at>now())
 then raise exception 'YW598 independently signed genuine Master execution receipt HOLD'; end if;
 insert into public.ywi_598_execution_receipts
  (company_id,approval_id,auditor_user_id,request_nonce,remote_receipt_id,
   original_master_old_hmac,original_master_next_hmac,response_sha256,
   remote_executed_at,verified_at,receiver_claimed_state,actual_remote_execution_reported)
 values(p_company_id,approval.id,p_auditor_user_id,p_nonce,p_remote_receipt_id,
  p_old_hmac,p_next_hmac,p_response_sha256,p_remote_executed_at,p_verified_at,
  'NEXT_ACTIVE_OLD_ACCEPTED',true) returning id into ident;
 return jsonb_build_object('state','REMOTE_SIGNED_EXECUTION_REPORTED_AWAITING_HUMAN_WITNESS',
  'executionId',ident,'physicallyWitnessed',false,'automaticSecretMutation',false);
end;$fn$;
revoke all on function public.ywi_598_record_execution(uuid,uuid,uuid,uuid,text,text,text,text,timestamptz,timestamptz)
 from public,anon,authenticated;
grant execute on function public.ywi_598_record_execution(uuid,uuid,uuid,uuid,text,text,text,text,timestamptz,timestamptz) to service_role;

create function public.ywi_598_witness_execution(
 p_company_id uuid,p_execution_id uuid,p_owner_user_id uuid,
 p_observed_at timestamptz,p_evidence_sha256 text,p_hmac text
) returns jsonb language plpgsql security definer set search_path='' as $fn$
declare e record; ap record; i record; ident uuid;
begin
 perform public.ywi_591_source_role_assert();
 select * into e from public.ywi_598_execution_receipts
  where id=p_execution_id and company_id=p_company_id for share;
 select * into ap from public.ywi_597_cutover_approvals
  where id=e.approval_id and company_id=p_company_id for share;
 select * into i from public.ywi_597_cutover_intents
  where id=ap.intent_id and company_id=p_company_id for share;
 if e.id is null or ap.id is null or i.id is null or
  p_owner_user_id<>i.owner_user_id or p_owner_user_id=e.auditor_user_id or
  p_observed_at<e.remote_executed_at-interval '2 minutes' or
  p_observed_at>e.verified_at+interval '30 minutes' or
  p_observed_at<now()-interval '2 minutes' or p_observed_at>now()+interval '30 seconds' or
  p_evidence_sha256 !~ '^[0-9a-f]{64}$' or p_hmac !~ '^[0-9a-f]{64}$' or
  not exists(select 1 from public.ywi_591_tenant_pilots
   where company_id=p_company_id and owner_user_id=p_owner_user_id
   and state='APPROVED' and expires_at>now()) or
  not exists(select 1 from public.profiles where id=p_owner_user_id and is_active=true)
 then raise exception 'YW598 original company owner physical execution witness HOLD'; end if;
 insert into public.ywi_598_execution_witnesses
  (company_id,execution_id,owner_user_id,observed_at,evidence_sha256,
   local_hmac_sha256,self_attested_physical_observation)
 values(p_company_id,e.id,p_owner_user_id,p_observed_at,
  p_evidence_sha256,p_hmac,true) returning id into ident;
 return jsonb_build_object('state','ORIGINAL_OWNER_PHYSICAL_EXECUTION_WITNESSED',
  'witnessId',ident,'hardwareAttested',false,'independentSystemAttestation',false);
end;$fn$;
revoke all on function public.ywi_598_witness_execution(uuid,uuid,uuid,timestamptz,text,text)
 from public,anon,authenticated;
grant execute on function public.ywi_598_witness_execution(uuid,uuid,uuid,timestamptz,text,text) to service_role;

create function public.ywi_598_record_rollback_drill(
 p_company_id uuid,p_witness_id uuid,p_auditor_user_id uuid,
 p_reviewer_user_id uuid,p_nonce uuid,p_receipt_id text,p_old_hmac text,
 p_next_hmac text,p_response_sha256 text,p_observed_at timestamptz
) returns jsonb language plpgsql security definer set search_path='' as $fn$
declare w record; e record; ap record; i record; ident uuid;
begin
 perform public.ywi_591_source_role_assert();
 select * into w from public.ywi_598_execution_witnesses
  where id=p_witness_id and company_id=p_company_id for share;
 select * into e from public.ywi_598_execution_receipts
  where id=w.execution_id and company_id=p_company_id for share;
 select * into ap from public.ywi_597_cutover_approvals
  where id=e.approval_id and company_id=p_company_id for share;
 select * into i from public.ywi_597_cutover_intents
  where id=ap.intent_id and company_id=p_company_id for share;
 if w.id is null or e.id is null or ap.id is null or i.id is null or
  p_reviewer_user_id<>i.reviewer_user_id or w.owner_user_id<>i.owner_user_id or
  p_auditor_user_id in(w.owner_user_id,p_reviewer_user_id) or
  p_observed_at<w.observed_at or p_observed_at<now()-interval '2 minutes' or
  p_observed_at>now()+interval '30 seconds' or
  length(p_receipt_id) not between 8 and 128 or
  p_old_hmac !~ '^[0-9a-f]{64}$' or p_next_hmac !~ '^[0-9a-f]{64}$' or
  p_response_sha256 !~ '^[0-9a-f]{64}$' or
  not exists(select 1 from public.profiles
   where id=p_auditor_user_id and role='admin' and is_active=true) or
  not exists(select 1 from public.ywi_platform_administrators_489
   where user_id=p_auditor_user_id) or
  not exists(select 1 from public.profiles
   where id=p_reviewer_user_id and is_active=true) or
  not exists(select 1 from public.ywi_591_tenant_pilots
   where company_id=p_company_id and owner_user_id=w.owner_user_id
   and reviewer_user_id=p_reviewer_user_id and state='APPROVED' and expires_at>now())
 then raise exception 'YW598 distinct original reviewer physical rollback drill and Master proof HOLD'; end if;
 insert into public.ywi_598_rollback_drills
  (company_id,witness_id,auditor_user_id,reviewer_user_id,request_nonce,
   remote_receipt_id,old_master_hmac,next_master_hmac,response_sha256,
   observed_at,remote_rollback_executed,reviewer_physically_witnessed,
   receiver_reported_state)
 values(p_company_id,w.id,p_auditor_user_id,p_reviewer_user_id,p_nonce,
  p_receipt_id,p_old_hmac,p_next_hmac,p_response_sha256,p_observed_at,
  true,true,'OLD_ACTIVE_NEXT_AVAILABLE') returning id into ident;
 return jsonb_build_object('state','HUMAN_WITNESSED_REMOTE_SIGNED_ROLLBACK_DRILL',
  'rollbackDrillId',ident,'hardwareAttested',false,
  'remoteOperatorActionWasExternal',true);
end;$fn$;
revoke all on function public.ywi_598_record_rollback_drill(uuid,uuid,uuid,uuid,uuid,text,text,text,text,timestamptz)
 from public,anon,authenticated;
grant execute on function public.ywi_598_record_rollback_drill(uuid,uuid,uuid,uuid,uuid,text,text,text,text,timestamptz) to service_role;

create function public.ywi_598_consent_alert_channel(
 p_company_id uuid,p_owner_user_id uuid,p_signed_at timestamptz,
 p_evidence_sha256 text,p_hmac text
) returns jsonb language plpgsql security definer set search_path='' as $fn$
declare ident uuid;
begin
 perform public.ywi_591_source_role_assert();
 if p_signed_at<now()-interval '2 minutes' or p_signed_at>now()+interval '30 seconds' or
  p_evidence_sha256 !~ '^[0-9a-f]{64}$' or p_hmac !~ '^[0-9a-f]{64}$' or
  not exists(select 1 from public.ywi_companies
   where id=p_company_id and owner_user_id=p_owner_user_id) or
  not exists(select 1 from public.profiles
   where id=p_owner_user_id and is_active=true) or
  not exists(select 1 from public.ywi_591_tenant_pilots
   where company_id=p_company_id and owner_user_id=p_owner_user_id
   and state='APPROVED' and expires_at>now())
 then raise exception 'YW598 original owner explicit private Master health alert consent HOLD'; end if;
 insert into public.ywi_598_alert_consents
  (company_id,owner_user_id,approved_channel,signed_at,
   evidence_sha256,server_hmac_sha256,explicit_owner_consent)
 values(p_company_id,p_owner_user_id,'ORIGINAL_PINNED_MASTER_ACK_ONLY',
  p_signed_at,p_evidence_sha256,p_hmac,true) returning id into ident;
 return jsonb_build_object('state','ORIGINAL_OWNER_PINNED_MASTER_ALERT_HANDOFF_OPTED_IN',
  'consentId',ident,'customerMessageSent',false);
end;$fn$;
revoke all on function public.ywi_598_consent_alert_channel(uuid,uuid,timestamptz,text,text)
 from public,anon,authenticated;
grant execute on function public.ywi_598_consent_alert_channel(uuid,uuid,timestamptz,text,text) to service_role;

create function public.ywi_598_record_alert_delivery(
 p_company_id uuid,p_consent_id uuid,p_alert_id uuid,p_owner_user_id uuid,
 p_nonce uuid,p_receipt_id text,p_event_sha256 text,p_receiver_hmac text,
 p_delivered_at timestamptz
) returns jsonb language plpgsql security definer set search_path='' as $fn$
declare con record; alert record; enrollment record; ident uuid;
begin
 perform public.ywi_591_source_role_assert();
 select * into con from public.ywi_598_alert_consents
  where id=p_consent_id and company_id=p_company_id for share;
 select * into alert from public.ywi_597_health_alerts
  where id=p_alert_id and company_id=p_company_id for share;
 select * into enrollment from public.ywi_597_health_enrollments
  where id=alert.enrollment_id and company_id=p_company_id for share;
 if con.id is null or alert.id is null or enrollment.id is null or
  con.owner_user_id<>p_owner_user_id or
  enrollment.owner_user_id<>p_owner_user_id or
  con.approved_channel<>'ORIGINAL_PINNED_MASTER_ACK_ONLY' or
  not con.explicit_owner_consent or
  alert.detected_at>p_delivered_at or
  p_delivered_at<now()-interval '2 minutes' or p_delivered_at>now()+interval '30 seconds' or
  length(p_receipt_id) not between 8 and 128 or
  p_event_sha256 !~ '^[0-9a-f]{64}$' or
  p_receiver_hmac !~ '^[0-9a-f]{64}$' or
  not exists(select 1 from public.profiles
    where id=p_owner_user_id and is_active=true)
 then raise exception 'YW598 real source-signed health alert remote receiver receipt HOLD'; end if;
 insert into public.ywi_598_alert_deliveries
 (company_id,consent_id,alert_id,owner_user_id,request_nonce,
  original_master_receipt_id,source_event_sha256,receiver_ack_hmac,
  delivered_at,receiver_channel)
 values(p_company_id,con.id,alert.id,p_owner_user_id,p_nonce,p_receipt_id,
  p_event_sha256,p_receiver_hmac,p_delivered_at,'PINNED_MASTER_SIGNED_RECEIPT')
 returning id into ident;
 return jsonb_build_object('state','ORIGINAL_MASTER_SIGNED_ALERT_RECEIPT_DELIVERED',
  'deliveryId',ident,'customerMessageSent',false,
  'sourceHealthWasRealAlert',true);
end;$fn$;
revoke all on function public.ywi_598_record_alert_delivery(uuid,uuid,uuid,uuid,uuid,text,text,text,timestamptz)
 from public,anon,authenticated;
grant execute on function public.ywi_598_record_alert_delivery(uuid,uuid,uuid,uuid,uuid,text,text,text,timestamptz) to service_role;
commit;
