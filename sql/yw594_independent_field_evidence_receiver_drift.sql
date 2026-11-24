-- YW594: immutable three-principal field evidence and signed receiver drift.
-- Human-observed proof is not hardware attestation. No seed, delete, or customer action.
begin;
create table public.ywi_594_attendance_challenges (
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null references public.ywi_companies(id) on delete restrict,
 slot_id uuid not null unique references public.ywi_593_witness_slots(id) on delete restrict,
 attempt_id uuid not null references public.ywi_591_photo_attempts(id) on delete restrict,
 crew_user_id uuid not null references auth.users(id) on delete restrict,
 nonce uuid not null unique,
 source_sha256 text not null check(source_sha256 ~ '^[0-9a-f]{64}$'),
 issued_at timestamptz not null default now(),
 expires_at timestamptz not null default (now()+interval '8 minutes'),
 check(expires_at>issued_at and expires_at<=issued_at+interval '8 minutes')
);
create table public.ywi_594_attendance_proofs (
 id uuid primary key default gen_random_uuid(),
 challenge_id uuid not null unique references public.ywi_594_attendance_challenges(id) on delete restrict,
 company_id uuid not null references public.ywi_companies(id) on delete restrict,
 slot_id uuid not null unique references public.ywi_593_witness_slots(id) on delete restrict,
 crew_user_id uuid not null references auth.users(id) on delete restrict,
 signed_at timestamptz not null,
 challenge_message_sha256 text not null check(challenge_message_sha256 ~ '^[0-9a-f]{64}$'),
 key_fingerprint_sha256 text not null check(key_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
 public_jwk jsonb not null check(public_jwk ?& array['kty','crv','x','y']),
 device_signature_b64url text not null check(device_signature_b64url ~ '^[A-Za-z0-9_-]{80,100}$'),
 hardware_attested boolean not null default false check(hardware_attested=false)
);
create table public.ywi_594_owner_observations (
 id uuid primary key default gen_random_uuid(),
 proof_id uuid not null unique references public.ywi_594_attendance_proofs(id) on delete restrict,
 company_id uuid not null references public.ywi_companies(id) on delete restrict,
 slot_id uuid not null unique references public.ywi_593_witness_slots(id) on delete restrict,
 owner_user_id uuid not null references auth.users(id) on delete restrict,
 observed_at timestamptz not null,
 co_presence_attested boolean not null check(co_presence_attested=true),
 payload_sha256 text not null check(payload_sha256 ~ '^[0-9a-f]{64}$'),
 server_hmac_sha256 text not null check(server_hmac_sha256 ~ '^[0-9a-f]{64}$')
);
create table public.ywi_594_receiver_drift_alerts (
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null references public.ywi_companies(id) on delete restrict,
 baseline_contract_id uuid not null references public.ywi_593_receiver_contracts(id) on delete restrict,
 owner_user_id uuid not null references auth.users(id) on delete restrict,
 request_nonce uuid not null unique,
 finding text not null check(finding in
  ('MATCH','VERIFIED_CONTRACT_CHANGED','UNVERIFIED_RESPONSE_HOLD','UNAVAILABLE_HOLD')),
 response_sha256 text not null check(response_sha256 ~ '^[0-9a-f]{64}$'),
 observed_at timestamptz not null,
 payload_sha256 text not null check(payload_sha256 ~ '^[0-9a-f]{64}$'),
 local_hmac_sha256 text not null check(local_hmac_sha256 ~ '^[0-9a-f]{64}$'),
 check(finding<>'MATCH' or response_sha256<>'0000000000000000000000000000000000000000000000000000000000000000')
);
create table public.ywi_594_field_certificates (
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null references public.ywi_companies(id) on delete restrict,
 slot_id uuid not null unique references public.ywi_593_witness_slots(id) on delete restrict,
 proof_id uuid not null unique references public.ywi_594_attendance_proofs(id) on delete restrict,
 owner_observation_id uuid not null unique references public.ywi_594_owner_observations(id) on delete restrict,
 reviewer_user_id uuid not null references auth.users(id) on delete restrict,
 master_receipt_id uuid not null references public.ywi_592_master_receipts(id) on delete restrict,
 receiver_contract_id uuid not null references public.ywi_593_receiver_contracts(id) on delete restrict,
 receiver_drift_id uuid not null references public.ywi_594_receiver_drift_alerts(id) on delete restrict,
 source_sha256 text not null check(source_sha256 ~ '^[0-9a-f]{64}$'),
 certified_at timestamptz not null,
 human_field_attested boolean not null check(human_field_attested=true),
 hardware_attested boolean not null default false check(hardware_attested=false),
 payload_sha256 text not null check(payload_sha256 ~ '^[0-9a-f]{64}$'),
 server_hmac_sha256 text not null check(server_hmac_sha256 ~ '^[0-9a-f]{64}$')
);
create index yw594_challenge_tenant_time on public.ywi_594_attendance_challenges(company_id,issued_at desc);
create index yw594_alert_tenant_time on public.ywi_594_receiver_drift_alerts(company_id,observed_at desc);
create index yw594_certificate_tenant_time on public.ywi_594_field_certificates(company_id,certified_at desc);
alter table public.ywi_594_attendance_challenges enable row level security;
alter table public.ywi_594_attendance_proofs enable row level security;
alter table public.ywi_594_owner_observations enable row level security;
alter table public.ywi_594_receiver_drift_alerts enable row level security;
alter table public.ywi_594_field_certificates enable row level security;
revoke all on public.ywi_594_attendance_challenges,public.ywi_594_attendance_proofs,
 public.ywi_594_owner_observations,public.ywi_594_receiver_drift_alerts,
 public.ywi_594_field_certificates from public,anon,authenticated;
grant select on public.ywi_594_attendance_challenges,public.ywi_594_attendance_proofs,
 public.ywi_594_owner_observations,public.ywi_594_receiver_drift_alerts,
 public.ywi_594_field_certificates to authenticated;
create policy yw594_challenge_owner_read on public.ywi_594_attendance_challenges
 for select to authenticated using(exists(select 1 from public.ywi_companies c
 where c.id=company_id and c.owner_user_id=(select auth.uid())));
create policy yw594_proof_owner_read on public.ywi_594_attendance_proofs
 for select to authenticated using(exists(select 1 from public.ywi_companies c
 where c.id=company_id and c.owner_user_id=(select auth.uid())));
create policy yw594_observation_owner_read on public.ywi_594_owner_observations
 for select to authenticated using(exists(select 1 from public.ywi_companies c
 where c.id=company_id and c.owner_user_id=(select auth.uid())));
create policy yw594_drift_owner_read on public.ywi_594_receiver_drift_alerts
 for select to authenticated using(exists(select 1 from public.ywi_companies c
 where c.id=company_id and c.owner_user_id=(select auth.uid())));
create policy yw594_certificate_owner_read on public.ywi_594_field_certificates
 for select to authenticated using(exists(select 1 from public.ywi_companies c
 where c.id=company_id and c.owner_user_id=(select auth.uid())));
create trigger yw594_challenge_immutable before update or delete on public.ywi_594_attendance_challenges
 for each row execute function public.ywi_591_forbid_change();
create trigger yw594_proof_immutable before update or delete on public.ywi_594_attendance_proofs
 for each row execute function public.ywi_591_forbid_change();
create trigger yw594_observation_immutable before update or delete on public.ywi_594_owner_observations
 for each row execute function public.ywi_591_forbid_change();
create trigger yw594_alert_immutable before update or delete on public.ywi_594_receiver_drift_alerts
 for each row execute function public.ywi_591_forbid_change();
create trigger yw594_certificate_immutable before update or delete on public.ywi_594_field_certificates
 for each row execute function public.ywi_591_forbid_change();

create function public.ywi_594_issue_attendance(
 p_company_id uuid,p_slot_id uuid,p_crew_user_id uuid,p_nonce uuid)
returns jsonb language plpgsql security definer set search_path='' as $fn$
declare s record; pilot record; a record; new_id uuid; expiry timestamptz;
begin
 perform public.ywi_591_source_role_assert();
 select * into s from public.ywi_593_witness_slots where id=p_slot_id and company_id=p_company_id for share;
 select * into pilot from public.ywi_591_tenant_pilots where company_id=p_company_id
  and state='APPROVED' and expires_at>now() for share;
 select * into a from public.ywi_591_photo_attempts
  where id=s.attempt_id and company_id=p_company_id and work_order_id=pilot.work_order_id for share;
 if s.id is null or pilot.company_id is null or a.id is null
  or s.owner_user_id<>pilot.owner_user_id or s.reviewer_user_id<>pilot.reviewer_user_id
  or s.crew_user_id<>p_crew_user_id or a.uploaded_by<>p_crew_user_id
  or a.state<>'VERIFIED' or a.stored_sha256<>a.content_sha256
  or p_crew_user_id in(s.owner_user_id,s.reviewer_user_id)
  or now()<s.starts_at or now()>s.ends_at or
  not exists(select 1 from public.ywi_593_witness_approvals ap
   where ap.slot_id=s.id and ap.company_id=p_company_id and ap.reviewer_user_id=s.reviewer_user_id) or
  not exists(select 1 from public.profiles where id=p_crew_user_id and is_active=true) or
  not exists(select 1 from public.ywi_591_pilot_staff
   where company_id=p_company_id and user_id=p_crew_user_id and role='crew' and state='APPROVED')
 then raise exception 'YW594 original live crew/window/source/review HOLD'; end if;
 expiry:=least(now()+interval '8 minutes',s.ends_at);
 if expiry<=now() then raise exception 'YW594 expired attendance window'; end if;
 insert into public.ywi_594_attendance_challenges
  (company_id,slot_id,attempt_id,crew_user_id,nonce,source_sha256,expires_at)
 values(p_company_id,s.id,a.id,p_crew_user_id,p_nonce,a.content_sha256,expiry)
 returning id into new_id;
 return jsonb_build_object('state','CREW_CHALLENGE_ISSUED_NOT_ATTESTED',
   'challengeId',new_id,'nonce',p_nonce,'expiresAt',expiry,
   'sourceSha256',a.content_sha256,'hardwareAttested',false);
end; $fn$;
revoke all on function public.ywi_594_issue_attendance(uuid,uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.ywi_594_issue_attendance(uuid,uuid,uuid,uuid) to service_role;

create function public.ywi_594_record_attendance(
 p_company_id uuid,p_challenge_id uuid,p_crew_user_id uuid,
 p_signed_at timestamptz,p_message_sha256 text,p_fingerprint_sha256 text,
 p_jwk jsonb,p_signature text)
returns jsonb language plpgsql security definer set search_path='' as $fn$
declare c record; s record; ident uuid;
begin
 perform public.ywi_591_source_role_assert();
 select * into c from public.ywi_594_attendance_challenges
  where id=p_challenge_id and company_id=p_company_id for share;
 select * into s from public.ywi_593_witness_slots where id=c.slot_id and company_id=p_company_id for share;
 if c.id is null or s.id is null or c.crew_user_id<>p_crew_user_id or
  s.crew_user_id<>p_crew_user_id or p_signed_at>now()+interval '30 seconds' or
  p_signed_at<now()-interval '2 minutes' or now()>c.expires_at or now()>s.ends_at or
  p_message_sha256 !~ '^[0-9a-f]{64}$' or p_fingerprint_sha256 !~ '^[0-9a-f]{64}$'
  or p_jwk->>'kty'<>'EC' or p_jwk->>'crv'<>'P-256'
  or p_signature !~ '^[A-Za-z0-9_-]{80,100}$'
  or not exists(select 1 from public.profiles where id=p_crew_user_id and is_active=true)
 then raise exception 'YW594 one-use original crew challenge HOLD'; end if;
 insert into public.ywi_594_attendance_proofs
  (challenge_id,company_id,slot_id,crew_user_id,signed_at,
   challenge_message_sha256,key_fingerprint_sha256,public_jwk,device_signature_b64url)
 values(c.id,p_company_id,s.id,p_crew_user_id,p_signed_at,
  p_message_sha256,p_fingerprint_sha256,p_jwk,p_signature) returning id into ident;
 return jsonb_build_object('state','ORIGINAL_CREW_BROWSER_SIGNATURE_VERIFIED',
  'proofId',ident,'hardwareAttested',false,'physicalAttendanceCertified',false);
end; $fn$;
revoke all on function public.ywi_594_record_attendance(uuid,uuid,uuid,timestamptz,text,text,jsonb,text) from public,anon,authenticated;
grant execute on function public.ywi_594_record_attendance(uuid,uuid,uuid,timestamptz,text,text,jsonb,text) to service_role;

create function public.ywi_594_owner_observe(
 p_company_id uuid,p_proof_id uuid,p_owner_user_id uuid,p_observed_at timestamptz,
 p_payload_sha256 text,p_server_hmac text)
returns jsonb language plpgsql security definer set search_path='' as $fn$
declare pf record; s record; pilot record; ident uuid;
begin
 perform public.ywi_591_source_role_assert();
 select * into pf from public.ywi_594_attendance_proofs
  where id=p_proof_id and company_id=p_company_id for share;
 select * into s from public.ywi_593_witness_slots
  where id=pf.slot_id and company_id=p_company_id for share;
 select * into pilot from public.ywi_591_tenant_pilots
  where company_id=p_company_id and state='APPROVED' and expires_at>now() for share;
 if pf.id is null or s.id is null or pilot.company_id is null or
  s.owner_user_id<>p_owner_user_id or pilot.owner_user_id<>p_owner_user_id
  or p_owner_user_id in(s.crew_user_id,s.reviewer_user_id) or
  now()<s.starts_at or now()>s.ends_at+interval '15 minutes' or
  p_observed_at<now()-interval '2 minutes' or p_observed_at>now()+interval '30 seconds' or
  p_payload_sha256 !~ '^[0-9a-f]{64}$' or p_server_hmac !~ '^[0-9a-f]{64}$'
  or not exists(select 1 from public.profiles where id=p_owner_user_id and is_active=true)
 then raise exception 'YW594 independent owner observation HOLD'; end if;
 insert into public.ywi_594_owner_observations
  (proof_id,company_id,slot_id,owner_user_id,observed_at,co_presence_attested,
  payload_sha256,server_hmac_sha256)
 values(pf.id,p_company_id,s.id,p_owner_user_id,p_observed_at,true,
  p_payload_sha256,p_server_hmac) returning id into ident;
 return jsonb_build_object('state','HUMAN_OWNER_COPRESENCE_ATTESTED',
  'observationId',ident,'hardwareAttested',false,'independentReviewPending',true);
end; $fn$;
revoke all on function public.ywi_594_owner_observe(uuid,uuid,uuid,timestamptz,text,text) from public,anon,authenticated;
grant execute on function public.ywi_594_owner_observe(uuid,uuid,uuid,timestamptz,text,text) to service_role;

create function public.ywi_594_record_receiver_drift(
 p_company_id uuid,p_contract_id uuid,p_owner_user_id uuid,p_nonce uuid,
 p_finding text,p_response_sha256 text,p_observed_at timestamptz,
 p_payload_sha256 text,p_local_hmac text)
returns jsonb language plpgsql security definer set search_path='' as $fn$
declare c record; ident uuid;
begin
 perform public.ywi_591_source_role_assert();
 select * into c from public.ywi_593_receiver_contracts
  where id=p_contract_id and company_id=p_company_id and owner_user_id=p_owner_user_id for share;
 if c.id is null or p_finding not in('MATCH','VERIFIED_CONTRACT_CHANGED',
    'UNVERIFIED_RESPONSE_HOLD','UNAVAILABLE_HOLD') or
  p_response_sha256 !~ '^[0-9a-f]{64}$' or
  p_payload_sha256 !~ '^[0-9a-f]{64}$' or p_local_hmac !~ '^[0-9a-f]{64}$' or
  p_observed_at<now()-interval '2 minutes' or p_observed_at>now()+interval '30 seconds' or
  not exists(select 1 from public.ywi_591_tenant_pilots where company_id=p_company_id
   and owner_user_id=p_owner_user_id and state='APPROVED' and expires_at>now()) or
  not exists(select 1 from public.profiles where id=p_owner_user_id and is_active=true) or
  exists(select 1 from public.ywi_594_receiver_drift_alerts
   where company_id=p_company_id and observed_at>now()-interval '5 minutes')
 then raise exception 'YW594 original owner, probe throttle or baseline HOLD'; end if;
 insert into public.ywi_594_receiver_drift_alerts
  (company_id,baseline_contract_id,owner_user_id,request_nonce,finding,
   response_sha256,observed_at,payload_sha256,local_hmac_sha256)
 values(p_company_id,c.id,p_owner_user_id,p_nonce,p_finding,
   p_response_sha256,p_observed_at,p_payload_sha256,p_local_hmac) returning id into ident;
 return jsonb_build_object('state',case when p_finding='MATCH' then
  'SIGNED_RECEIVER_CONTRACT_MATCH' else 'SIGNED_LOCAL_RECEIVER_ANOMALY_HOLD' end,
  'finding',p_finding,'alertId',ident,'notMasterAcknowledgement',true);
end; $fn$;
revoke all on function public.ywi_594_record_receiver_drift(uuid,uuid,uuid,uuid,text,text,timestamptz,text,text)
 from public,anon,authenticated;
grant execute on function public.ywi_594_record_receiver_drift(uuid,uuid,uuid,uuid,text,text,timestamptz,text,text)
 to service_role;

create function public.ywi_594_certify_field(
 p_company_id uuid,p_proof_id uuid,p_observation_id uuid,p_reviewer_user_id uuid,
 p_master_receipt_id uuid,p_receiver_contract_id uuid,p_receiver_drift_id uuid,
 p_source_sha256 text,p_certified_at timestamptz,p_payload_sha256 text,p_server_hmac text)
returns jsonb language plpgsql security definer set search_path='' as $fn$
declare pf record; o record; s record; pilot record; a record; ack record;
 c record; d record; ident uuid;
begin
 perform public.ywi_591_source_role_assert();
 select * into pf from public.ywi_594_attendance_proofs
  where id=p_proof_id and company_id=p_company_id for share;
 select * into o from public.ywi_594_owner_observations
  where id=p_observation_id and company_id=p_company_id and proof_id=p_proof_id for share;
 select * into s from public.ywi_593_witness_slots
  where id=pf.slot_id and company_id=p_company_id for share;
 select * into pilot from public.ywi_591_tenant_pilots
  where company_id=p_company_id and state='APPROVED' and expires_at>now() for share;
 select * into a from public.ywi_591_photo_attempts
  where id=s.attempt_id and company_id=p_company_id and work_order_id=pilot.work_order_id for share;
 select * into ack from public.ywi_592_master_receipts
  where id=p_master_receipt_id and company_id=p_company_id and attempt_id=a.id for share;
 select * into c from public.ywi_593_receiver_contracts
  where id=p_receiver_contract_id and company_id=p_company_id for share;
 select * into d from public.ywi_594_receiver_drift_alerts
  where id=p_receiver_drift_id and company_id=p_company_id
    and baseline_contract_id=p_receiver_contract_id for share;
 if pf.id is null or o.id is null or s.id is null or pilot.company_id is null
  or a.id is null or ack.id is null or c.id is null or d.id is null or
  s.owner_user_id<>pilot.owner_user_id or s.reviewer_user_id<>pilot.reviewer_user_id
  or s.reviewer_user_id<>p_reviewer_user_id or
  o.owner_user_id<>s.owner_user_id or pf.crew_user_id<>s.crew_user_id
  or p_reviewer_user_id in(s.owner_user_id,s.crew_user_id) or
  not o.co_presence_attested or pf.hardware_attested or
  a.uploaded_by<>s.crew_user_id or a.state<>'VERIFIED' or
  a.stored_sha256<>p_source_sha256 or a.content_sha256<>p_source_sha256 or
  ack.source_sha256<>p_source_sha256 or ack.device_actor_id<>s.crew_user_id or
  c.expires_at<=now() or d.finding<>'MATCH' or
  d.observed_at<c.observed_at or d.observed_at>now()+interval '30 seconds' or
  d.id<>(select da.id from public.ywi_594_receiver_drift_alerts da
    where da.company_id=p_company_id order by da.observed_at desc,da.id desc limit 1) or
  now()>s.ends_at+interval '24 hours' or now()<s.starts_at or
  p_certified_at<now()-interval '2 minutes' or p_certified_at>now()+interval '30 seconds' or
  p_payload_sha256 !~ '^[0-9a-f]{64}$' or p_server_hmac !~ '^[0-9a-f]{64}$' or
  not exists(select 1 from public.profiles where id=p_reviewer_user_id and is_active=true)
 then raise exception 'YW594 independent reviewer, bytes, signed ACK or drift HOLD'; end if;
 insert into public.ywi_594_field_certificates(
  company_id,slot_id,proof_id,owner_observation_id,reviewer_user_id,
  master_receipt_id,receiver_contract_id,receiver_drift_id,
  source_sha256,certified_at,human_field_attested,hardware_attested,
  payload_sha256,server_hmac_sha256)
 values(p_company_id,s.id,pf.id,o.id,p_reviewer_user_id,
  ack.id,c.id,d.id,p_source_sha256,p_certified_at,true,false,
  p_payload_sha256,p_server_hmac) returning id into ident;
 return jsonb_build_object('state','INDEPENDENT_HUMAN_FIELD_CERTIFIED',
  'certificateId',ident,'hardwareAttested',false,
  'originalSourceMasterAckBound',true,'twoTenantFleetCertified',false);
end; $fn$;
revoke all on function public.ywi_594_certify_field(uuid,uuid,uuid,uuid,uuid,uuid,uuid,text,timestamptz,text,text)
 from public,anon,authenticated;
grant execute on function public.ywi_594_certify_field(uuid,uuid,uuid,uuid,uuid,uuid,uuid,text,timestamptz,text,text)
 to service_role;
commit;
