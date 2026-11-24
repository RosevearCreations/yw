-- YW597 signed, independent cutover authorization, passive rollback proof,
-- append-only Master ACK samples and actual scheduled 15-minute stale-evidence watcher.
-- No source photos, secrets, receipt replacements, automatic key switching or rollback.
begin;
create table public.ywi_597_cutover_intents(
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null references public.ywi_companies(id) on delete restrict,
 proof_id uuid not null unique references public.ywi_596_rotation_proofs(id) on delete restrict,
 canary_id uuid not null unique references public.ywi_596_canary_acks(id) on delete restrict,
 owner_user_id uuid not null references auth.users(id) on delete restrict,
 reviewer_user_id uuid not null references auth.users(id) on delete restrict,
 consent_at timestamptz not null default now(),
 expires_at timestamptz not null default(now()+interval '24 hours'),
 actual_key_changed boolean not null default false check(actual_key_changed=false),
 unique(company_id,id),
 check(owner_user_id<>reviewer_user_id and expires_at<=consent_at+interval '24 hours' and expires_at>consent_at)
);
create table public.ywi_597_rollback_proofs(
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null references public.ywi_companies(id) on delete restrict,
 intent_id uuid not null unique references public.ywi_597_cutover_intents(id) on delete restrict,
 auditor_user_id uuid not null references auth.users(id) on delete restrict,
 challenge_nonce uuid not null unique,
 prior_hmac text not null check(prior_hmac ~ '^[0-9a-f]{64}$'),
 next_hmac text not null check(next_hmac ~ '^[0-9a-f]{64}$'),
 remote_response_sha256 text not null check(remote_response_sha256 ~ '^[0-9a-f]{64}$'),
 observed_at timestamptz not null,
 readiness_only boolean not null default true check(readiness_only=true),
 actual_rollback_performed boolean not null default false check(actual_rollback_performed=false),
 unique(company_id,id)
);
create table public.ywi_597_cutover_approvals(
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null references public.ywi_companies(id) on delete restrict,
 intent_id uuid not null unique references public.ywi_597_cutover_intents(id) on delete restrict,
 rollback_proof_id uuid not null unique references public.ywi_597_rollback_proofs(id) on delete restrict,
 reviewer_user_id uuid not null references auth.users(id) on delete restrict,
 signed_at timestamptz not null,
 payload_sha256 text not null check(payload_sha256 ~ '^[0-9a-f]{64}$'),
 server_hmac_sha256 text not null check(server_hmac_sha256 ~ '^[0-9a-f]{64}$'),
 approval_scope text not null check(approval_scope='MANUAL_CUTOVER_ALLOWED_NOT_EXECUTED'),
 actually_cut_over boolean not null default false check(actually_cut_over=false),
 unique(company_id,id)
);
create table public.ywi_597_health_enrollments(
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null references public.ywi_companies(id) on delete restrict,
 approval_id uuid not null unique references public.ywi_597_cutover_approvals(id) on delete restrict,
 owner_user_id uuid not null references auth.users(id) on delete restrict,
 started_at timestamptz not null default now(),
 expires_at timestamptz not null default(now()+interval '7 days'),
 sample_period_minutes int not null default 15 check(sample_period_minutes=15),
 passive_monitor_only boolean not null default true check(passive_monitor_only=true),
 unique(company_id,id),
 check(expires_at>started_at and expires_at<=started_at+interval '7 days')
);
create table public.ywi_597_health_samples(
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null references public.ywi_companies(id) on delete restrict,
 enrollment_id uuid not null references public.ywi_597_health_enrollments(id) on delete restrict,
 challenge_nonce uuid not null unique,
 source_actor_id uuid not null references auth.users(id) on delete restrict,
 prior_hmac text,
 next_hmac text,
 receiver_response_sha256 text not null check(receiver_response_sha256 ~ '^[0-9a-f]{64}$'),
 verified_at timestamptz not null,
 receiver_state text not null check(receiver_state in ('SIGNED_OLD_AND_NEXT_MATCH','REMOTE_UNVERIFIED_HOLD')),
 local_event_sha256 text not null check(local_event_sha256 ~ '^[0-9a-f]{64}$'),
 local_event_hmac text not null check(local_event_hmac ~ '^[0-9a-f]{64}$'),
 actual_key_changed boolean not null default false check(actual_key_changed=false),
 unique(company_id,id),
 check((receiver_state='SIGNED_OLD_AND_NEXT_MATCH' and
  prior_hmac ~ '^[0-9a-f]{64}$' and next_hmac ~ '^[0-9a-f]{64}$')
  or (receiver_state='REMOTE_UNVERIFIED_HOLD' and prior_hmac is null and next_hmac is null))
);
create table public.ywi_597_health_alerts(
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null references public.ywi_companies(id) on delete restrict,
 enrollment_id uuid not null references public.ywi_597_health_enrollments(id) on delete restrict,
 issue_code text not null check(issue_code in ('NO_SIGNED_MASTER_ACK_30M','RECEIVER_UNVERIFIED_HOLD')),
 period_start timestamptz not null,
 detected_at timestamptz not null default now(),
 observed_sample_id uuid references public.ywi_597_health_samples(id) on delete restrict,
 source text not null default 'DB_CRON_15_MINUTE_EVIDENCE_WATCH' check(source='DB_CRON_15_MINUTE_EVIDENCE_WATCH'),
 unique(enrollment_id,issue_code,period_start)
);
create index yw597_health_company_time on public.ywi_597_health_samples(company_id,verified_at desc);
create index yw597_health_enrollment_time on public.ywi_597_health_samples(enrollment_id,verified_at desc);
create index yw597_alerts_company_time on public.ywi_597_health_alerts(company_id,detected_at desc);
alter table public.ywi_597_cutover_intents enable row level security;
alter table public.ywi_597_rollback_proofs enable row level security;
alter table public.ywi_597_cutover_approvals enable row level security;
alter table public.ywi_597_health_enrollments enable row level security;
alter table public.ywi_597_health_samples enable row level security;
alter table public.ywi_597_health_alerts enable row level security;
revoke all on public.ywi_597_cutover_intents,public.ywi_597_rollback_proofs,
 public.ywi_597_cutover_approvals,public.ywi_597_health_enrollments,
 public.ywi_597_health_samples,public.ywi_597_health_alerts from public,anon,authenticated;
grant select on public.ywi_597_cutover_intents,public.ywi_597_rollback_proofs,
 public.ywi_597_cutover_approvals,public.ywi_597_health_enrollments,
 public.ywi_597_health_samples,public.ywi_597_health_alerts to authenticated;
create policy yw597_owner_intents_read on public.ywi_597_cutover_intents
 for select to authenticated using(exists(select 1 from public.ywi_companies c
 where c.id=company_id and c.owner_user_id=(select auth.uid())));
create policy yw597_owner_rollback_read on public.ywi_597_rollback_proofs
 for select to authenticated using(exists(select 1 from public.ywi_companies c
 where c.id=company_id and c.owner_user_id=(select auth.uid())));
create policy yw597_owner_approvals_read on public.ywi_597_cutover_approvals
 for select to authenticated using(exists(select 1 from public.ywi_companies c
 where c.id=company_id and c.owner_user_id=(select auth.uid())));
create policy yw597_owner_enrollment_read on public.ywi_597_health_enrollments
 for select to authenticated using(exists(select 1 from public.ywi_companies c
 where c.id=company_id and c.owner_user_id=(select auth.uid())));
create policy yw597_owner_samples_read on public.ywi_597_health_samples
 for select to authenticated using(exists(select 1 from public.ywi_companies c
 where c.id=company_id and c.owner_user_id=(select auth.uid())));
create policy yw597_owner_alerts_read on public.ywi_597_health_alerts
 for select to authenticated using(exists(select 1 from public.ywi_companies c
 where c.id=company_id and c.owner_user_id=(select auth.uid())));
create trigger yw597_intents_immutable before update or delete on public.ywi_597_cutover_intents
 for each row execute function public.ywi_591_forbid_change();
create trigger yw597_rollback_immutable before update or delete on public.ywi_597_rollback_proofs
 for each row execute function public.ywi_591_forbid_change();
create trigger yw597_approvals_immutable before update or delete on public.ywi_597_cutover_approvals
 for each row execute function public.ywi_591_forbid_change();
create trigger yw597_enrollments_immutable before update or delete on public.ywi_597_health_enrollments
 for each row execute function public.ywi_591_forbid_change();
create trigger yw597_samples_immutable before update or delete on public.ywi_597_health_samples
 for each row execute function public.ywi_591_forbid_change();
create trigger yw597_alerts_immutable before update or delete on public.ywi_597_health_alerts
 for each row execute function public.ywi_591_forbid_change();
create function public.ywi_597_begin_cutover(p_company_id uuid,p_proof_id uuid,
 p_canary_id uuid,p_owner_user_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $fn$
declare proof record; c record; rot record; pilot record; ident uuid;
begin
 perform public.ywi_591_source_role_assert();
 select * into proof from public.ywi_596_rotation_proofs
  where id=p_proof_id and company_id=p_company_id for share;
 select * into c from public.ywi_596_canary_acks
  where id=p_canary_id and company_id=p_company_id for share;
 select * into rot from public.ywi_595_rotation_proposals
  where id=proof.rotation_id and company_id=p_company_id for share;
 select * into pilot from public.ywi_591_tenant_pilots
  where company_id=p_company_id and state='APPROVED' and expires_at>now() for share;
 if proof.id is null or c.id is null or rot.id is null or pilot.company_id is null or
  c.rotation_proof_id<>proof.id or c.acknowledged_at<=proof.received_at or
  proof.owner_user_id<>p_owner_user_id or rot.owner_user_id<>p_owner_user_id or
  pilot.owner_user_id<>p_owner_user_id or pilot.reviewer_user_id<>rot.reviewer_user_id or
  rot.reviewer_user_id=p_owner_user_id or proof.actual_secret_rotated or
  not c.no_private_object_transferred or
  c.acknowledged_at<now()-interval '72 hours' or
  not exists(select 1 from public.ywi_595_rotation_signoffs
   where id=proof.signoff_id and company_id=p_company_id
    and proposal_id=rot.id and reviewer_user_id=rot.reviewer_user_id) or
  not exists(select 1 from public.profiles where id=p_owner_user_id and is_active=true)
 then raise exception 'YW597 original two-key signed canary, active pilot, independent owner HOLD'; end if;
 insert into public.ywi_597_cutover_intents
  (company_id,proof_id,canary_id,owner_user_id,reviewer_user_id)
 values(p_company_id,proof.id,c.id,p_owner_user_id,rot.reviewer_user_id)
 returning id into ident;
 return jsonb_build_object('state','OWNER_INTENT_CUTOVER_NOT_EXECUTED',
   'intentId',ident,'actualKeyChanged',false);
end;$fn$;
revoke all on function public.ywi_597_begin_cutover(uuid,uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.ywi_597_begin_cutover(uuid,uuid,uuid,uuid) to service_role;

create function public.ywi_597_record_rollback(p_company_id uuid,p_intent_id uuid,
 p_auditor_user_id uuid,p_nonce uuid,p_old_hmac text,p_next_hmac text,
 p_response_sha256 text,p_observed_at timestamptz)
returns jsonb language plpgsql security definer set search_path='' as $fn$
declare i record; r record; a record; ident uuid;
begin
 perform public.ywi_591_source_role_assert();
 select * into i from public.ywi_597_cutover_intents
  where id=p_intent_id and company_id=p_company_id for share;
 select * into r from public.ywi_596_rotation_proofs
  where id=i.proof_id and company_id=p_company_id for share;
 select * into a from public.ywi_596_canary_acks
  where id=i.canary_id and company_id=p_company_id for share;
 if i.id is null or r.id is null or a.id is null or
  i.expires_at<=now() or a.rotation_proof_id<>r.id or
  p_auditor_user_id in(i.owner_user_id,i.reviewer_user_id,a.source_actor_id) or
  p_observed_at<now()-interval '2 minutes' or p_observed_at>now()+interval '30 seconds' or
  p_old_hmac !~ '^[0-9a-f]{64}$' or p_next_hmac !~ '^[0-9a-f]{64}$' or
  p_response_sha256 !~ '^[0-9a-f]{64}$' or
  not exists(select 1 from public.profiles
   where id=p_auditor_user_id and role='admin' and is_active=true) or
  not exists(select 1 from public.ywi_platform_administrators_489 where user_id=p_auditor_user_id)
 then raise exception 'YW597 independent platform rollback-readiness reviewer HOLD'; end if;
 insert into public.ywi_597_rollback_proofs
  (company_id,intent_id,auditor_user_id,challenge_nonce,
   prior_hmac,next_hmac,remote_response_sha256,observed_at)
 values(p_company_id,i.id,p_auditor_user_id,p_nonce,
  p_old_hmac,p_next_hmac,p_response_sha256,p_observed_at)
 returning id into ident;
 return jsonb_build_object('state','SIGNED_RECEIVER_ROLLBACK_READINESS_ONLY',
  'rollbackProofId',ident,'actualRollbackPerformed',false);
end;$fn$;
revoke all on function public.ywi_597_record_rollback(uuid,uuid,uuid,uuid,text,text,text,timestamptz) from public,anon,authenticated;
grant execute on function public.ywi_597_record_rollback(uuid,uuid,uuid,uuid,text,text,text,timestamptz) to service_role;

create function public.ywi_597_authorize_cutover(p_company_id uuid,p_intent_id uuid,
 p_rollback_proof_id uuid,p_reviewer_user_id uuid,p_signed_at timestamptz,
 p_payload_sha256 text,p_server_hmac text)
returns jsonb language plpgsql security definer set search_path='' as $fn$
declare i record; rb record; ident uuid;
begin
 perform public.ywi_591_source_role_assert();
 select * into i from public.ywi_597_cutover_intents where id=p_intent_id and company_id=p_company_id for share;
 select * into rb from public.ywi_597_rollback_proofs
  where id=p_rollback_proof_id and company_id=p_company_id for share;
 if i.id is null or rb.id is null or rb.intent_id<>i.id or
  i.expires_at<=now() or rb.observed_at<now()-interval '15 minutes' or
  p_reviewer_user_id<>i.reviewer_user_id or p_reviewer_user_id=i.owner_user_id or
  rb.auditor_user_id in(i.owner_user_id,i.reviewer_user_id) or
  p_signed_at<now()-interval '2 minutes' or p_signed_at>now()+interval '30 seconds' or
  p_payload_sha256 !~ '^[0-9a-f]{64}$' or p_server_hmac !~ '^[0-9a-f]{64}$' or
  not exists(select 1 from public.ywi_591_tenant_pilots
   where company_id=p_company_id and owner_user_id=i.owner_user_id
   and reviewer_user_id=p_reviewer_user_id and state='APPROVED' and expires_at>now()) or
  not exists(select 1 from public.profiles
   where id=p_reviewer_user_id and is_active=true)
 then raise exception 'YW597 current independent signed cutover authorization HOLD'; end if;
 insert into public.ywi_597_cutover_approvals
  (company_id,intent_id,rollback_proof_id,reviewer_user_id,signed_at,
   payload_sha256,server_hmac_sha256,approval_scope)
 values(p_company_id,i.id,rb.id,p_reviewer_user_id,p_signed_at,
  p_payload_sha256,p_server_hmac,'MANUAL_CUTOVER_ALLOWED_NOT_EXECUTED')
 returning id into ident;
 return jsonb_build_object('state','MANUAL_CUTOVER_AUTHORIZED_NOT_EXECUTED',
  'approvalId',ident,'secretChanged',false,'originalReceiverStillOwnedElsewhere',true);
end;$fn$;
revoke all on function public.ywi_597_authorize_cutover(uuid,uuid,uuid,uuid,timestamptz,text,text)
 from public,anon,authenticated;
grant execute on function public.ywi_597_authorize_cutover(uuid,uuid,uuid,uuid,timestamptz,text,text)
 to service_role;

create function public.ywi_597_enroll_health(p_company_id uuid,p_approval_id uuid,p_owner_user_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $fn$
declare ap record; i record; ident uuid;
begin
 perform public.ywi_591_source_role_assert();
 select * into ap from public.ywi_597_cutover_approvals
  where id=p_approval_id and company_id=p_company_id for share;
 select * into i from public.ywi_597_cutover_intents
  where id=ap.intent_id and company_id=p_company_id for share;
 if ap.id is null or i.id is null or i.owner_user_id<>p_owner_user_id or
  i.expires_at<=now() or ap.approval_scope<>'MANUAL_CUTOVER_ALLOWED_NOT_EXECUTED' or
  ap.actually_cut_over or
  not exists(select 1 from public.ywi_591_tenant_pilots
   where company_id=p_company_id and owner_user_id=p_owner_user_id
   and state='APPROVED' and expires_at>now()) or
  not exists(select 1 from public.profiles where id=p_owner_user_id and is_active=true)
 then raise exception 'YW597 original owner and independently signed manual cutover consent required'; end if;
 insert into public.ywi_597_health_enrollments(company_id,approval_id,owner_user_id)
 values(p_company_id,ap.id,p_owner_user_id) returning id into ident;
 return jsonb_build_object('state','CONTINUOUS_MASTER_ACK_EVIDENCE_WATCH_ENROLLED',
   'enrollmentId',ident,'actualReceiverCutover',false,'intervalMinutes',15);
end;$fn$;
revoke all on function public.ywi_597_enroll_health(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.ywi_597_enroll_health(uuid,uuid,uuid) to service_role;

create function public.ywi_597_record_health(p_company_id uuid,p_enrollment_id uuid,
 p_actor_user_id uuid,p_nonce uuid,p_old_hmac text,p_next_hmac text,
 p_remote_sha256 text,p_verified_at timestamptz,p_receiver_state text,
 p_event_sha256 text,p_event_hmac text)
returns jsonb language plpgsql security definer set search_path='' as $fn$
declare e record; ap record; ident uuid;
begin
 perform public.ywi_591_source_role_assert();
 select * into e from public.ywi_597_health_enrollments
  where id=p_enrollment_id and company_id=p_company_id for share;
 select * into ap from public.ywi_597_cutover_approvals
  where id=e.approval_id and company_id=p_company_id for share;
 if e.id is null or ap.id is null or e.expires_at<=now() or
  p_actor_user_id<>e.owner_user_id or
  p_verified_at<now()-interval '2 minutes' or p_verified_at>now()+interval '30 seconds' or
  p_remote_sha256 !~ '^[0-9a-f]{64}$' or p_event_sha256 !~ '^[0-9a-f]{64}$' or
  p_event_hmac !~ '^[0-9a-f]{64}$' or
  p_receiver_state not in('SIGNED_OLD_AND_NEXT_MATCH','REMOTE_UNVERIFIED_HOLD') or
  not exists(select 1 from public.profiles where id=p_actor_user_id and is_active=true)
 then raise exception 'YW597 live owner original receiver evidence check HOLD'; end if;
 insert into public.ywi_597_health_samples
  (company_id,enrollment_id,challenge_nonce,source_actor_id,prior_hmac,next_hmac,
   receiver_response_sha256,verified_at,receiver_state,local_event_sha256,local_event_hmac)
 values(p_company_id,e.id,p_nonce,p_actor_user_id,p_old_hmac,p_next_hmac,
  p_remote_sha256,p_verified_at,p_receiver_state,p_event_sha256,p_event_hmac)
 returning id into ident;
 return jsonb_build_object('state',p_receiver_state,'sampleId',ident,
   'sourceReceiverProbeOnly',true,'actualSecretChanged',false);
end;$fn$;
revoke all on function public.ywi_597_record_health(uuid,uuid,uuid,uuid,text,text,text,timestamptz,text,text,text)
 from public,anon,authenticated;
grant execute on function public.ywi_597_record_health(uuid,uuid,uuid,uuid,text,text,text,timestamptz,text,text,text)
 to service_role;

-- Server-side periodic evidence sweep; never contacts Master or presents itself as remote proof.
create function public.ywi_597_sweep_health()
returns integer language plpgsql security definer set search_path='' as $fn$
declare e record; recent record; issue text; slot timestamptz; written integer:=0;
begin
 slot:=date_bin(interval '1 hour',now(),timestamptz '2000-01-01 00:00:00+00');
 for e in select * from public.ywi_597_health_enrollments
  where started_at<=now()-interval '30 minutes' and expires_at>now()
 loop
  select * into recent from public.ywi_597_health_samples
   where enrollment_id=e.id and company_id=e.company_id
   order by verified_at desc limit 1;
  issue:=null;
  if recent.id is null or recent.verified_at<now()-interval '30 minutes'
    then issue:='NO_SIGNED_MASTER_ACK_30M';
  elsif recent.receiver_state<>'SIGNED_OLD_AND_NEXT_MATCH'
    then issue:='RECEIVER_UNVERIFIED_HOLD';
  end if;
  if issue is not null then
   insert into public.ywi_597_health_alerts
    (company_id,enrollment_id,issue_code,period_start,observed_sample_id)
   values(e.company_id,e.id,issue,slot,recent.id)
   on conflict (enrollment_id,issue_code,period_start) do nothing;
   if found then written:=written+1;end if;
  end if;
 end loop;
 return written;
end;$fn$;
revoke all on function public.ywi_597_sweep_health() from public,anon,authenticated;
grant execute on function public.ywi_597_sweep_health() to service_role;
-- Supabase project already has pg_cron; owner-authorized, real recurring query.
select cron.schedule('yw597-master-ack-evidence-watch-15m','*/15 * * * *',
 'select public.ywi_597_sweep_health();');
commit;
