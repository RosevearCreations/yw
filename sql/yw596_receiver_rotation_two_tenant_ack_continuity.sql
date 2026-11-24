-- YW596: original receiver dual-key handshake, actual independently signed next-key
-- source canary ACK, dual-owner calendar consent and second-Sysop audit custody.
-- This does not itself rotate a receiver's live secret or move private photo bytes.
begin;
create table public.ywi_596_rotation_proofs(
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null references public.ywi_companies(id) on delete restrict,
 rotation_id uuid not null unique references public.ywi_595_rotation_proposals(id) on delete restrict,
 signoff_id uuid not null unique references public.ywi_595_rotation_signoffs(id) on delete restrict,
 owner_user_id uuid not null references auth.users(id) on delete restrict,
 request_nonce uuid not null unique,
 response_sha256 text not null check(response_sha256 ~ '^[0-9a-f]{64}$'),
 old_receiver_hmac text not null check(old_receiver_hmac ~ '^[0-9a-f]{64}$'),
 next_receiver_hmac text not null check(next_receiver_hmac ~ '^[0-9a-f]{64}$'),
 received_at timestamptz not null,
 actual_secret_rotated boolean not null default false check(actual_secret_rotated=false),
 observed_state text not null check(observed_state='DUAL_KEY_RECEIVER_VERIFIED_CUSTODY_ONLY'),
 unique(company_id,id)
);
create table public.ywi_596_canary_acks(
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null references public.ywi_companies(id) on delete restrict,
 rotation_proof_id uuid not null unique references public.ywi_596_rotation_proofs(id) on delete restrict,
 prior_ack_id uuid not null references public.ywi_592_master_receipts(id) on delete restrict,
 next_attempt_id uuid not null unique references public.ywi_591_photo_attempts(id) on delete restrict,
 source_actor_id uuid not null references auth.users(id) on delete restrict,
 master_receipt_id text not null unique check(length(master_receipt_id) between 8 and 128),
 request_nonce uuid not null unique,
 source_sha256 text not null check(source_sha256 ~ '^[0-9a-f]{64}$'),
 payload_sha256 text not null check(payload_sha256 ~ '^[0-9a-f]{64}$'),
 next_ack_hmac text not null check(next_ack_hmac ~ '^[0-9a-f]{64}$'),
 acknowledged_at timestamptz not null,
 no_private_object_transferred boolean not null check(no_private_object_transferred=true),
 unique(company_id,id)
);
create table public.ywi_596_slot_consents(
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null references public.ywi_companies(id) on delete restrict,
 optin_id uuid not null references public.ywi_595_fleet_optins(id) on delete restrict,
 slot_id uuid not null unique references public.ywi_593_witness_slots(id) on delete restrict,
 owner_user_id uuid not null references auth.users(id) on delete restrict,
 signed_at timestamptz not null,
 payload_sha256 text not null check(payload_sha256 ~ '^[0-9a-f]{64}$'),
 server_hmac_sha256 text not null check(server_hmac_sha256 ~ '^[0-9a-f]{64}$'),
 explicit_schedule_consent boolean not null check(explicit_schedule_consent=true),
 unique(company_id,id)
);
create table public.ywi_596_cross_tenant_pilots(
 id uuid primary key default gen_random_uuid(),
 company_a_id uuid not null references public.ywi_companies(id) on delete restrict,
 company_b_id uuid not null references public.ywi_companies(id) on delete restrict,
 consent_a_id uuid not null unique references public.ywi_596_slot_consents(id) on delete restrict,
 consent_b_id uuid not null unique references public.ywi_596_slot_consents(id) on delete restrict,
 coordinator_user_id uuid not null references auth.users(id) on delete restrict,
 scheduled_at timestamptz not null default now(),
 schedule_sha256 text not null check(schedule_sha256 ~ '^[0-9a-f]{64}$'),
 server_hmac_sha256 text not null check(server_hmac_sha256 ~ '^[0-9a-f]{64}$'),
 status text not null check(status='TWO_REAL_TENANTS_SCHEDULED_NOT_AUDITED'),
 unique(company_a_id,company_b_id),
 check(company_a_id<company_b_id),
 check(consent_a_id<>consent_b_id)
);
create table public.ywi_596_independent_continuity_audits(
 id uuid primary key default gen_random_uuid(),
 pair_id uuid not null unique references public.ywi_596_cross_tenant_pilots(id) on delete restrict,
 company_a_id uuid not null references public.ywi_companies(id) on delete restrict,
 company_b_id uuid not null references public.ywi_companies(id) on delete restrict,
 canary_a_id uuid not null unique references public.ywi_596_canary_acks(id) on delete restrict,
 canary_b_id uuid not null unique references public.ywi_596_canary_acks(id) on delete restrict,
 auditor_user_id uuid not null references auth.users(id) on delete restrict,
 audited_at timestamptz not null,
 payload_sha256 text not null check(payload_sha256 ~ '^[0-9a-f]{64}$'),
 server_hmac_sha256 text not null check(server_hmac_sha256 ~ '^[0-9a-f]{64}$'),
 human_original_ack_continuity_reviewed boolean not null check(human_original_ack_continuity_reviewed=true),
 hardware_attested boolean not null default false check(hardware_attested=false),
 check(company_a_id<company_b_id),
 check(canary_a_id<>canary_b_id)
);
create index yw596_rotation_company_time on public.ywi_596_rotation_proofs(company_id,received_at desc);
create index yw596_canary_company_time on public.ywi_596_canary_acks(company_id,acknowledged_at desc);
create index yw596_consent_company_time on public.ywi_596_slot_consents(company_id,signed_at desc);
alter table public.ywi_596_rotation_proofs enable row level security;
alter table public.ywi_596_canary_acks enable row level security;
alter table public.ywi_596_slot_consents enable row level security;
alter table public.ywi_596_cross_tenant_pilots enable row level security;
alter table public.ywi_596_independent_continuity_audits enable row level security;
revoke all on public.ywi_596_rotation_proofs,public.ywi_596_canary_acks,
 public.ywi_596_slot_consents,public.ywi_596_cross_tenant_pilots,
 public.ywi_596_independent_continuity_audits from public,anon,authenticated;
grant select on public.ywi_596_rotation_proofs,public.ywi_596_canary_acks,
 public.ywi_596_slot_consents to authenticated;
create policy yw596_rotation_owner_read on public.ywi_596_rotation_proofs for select
 to authenticated using(exists(select 1 from public.ywi_companies c
 where c.id=company_id and c.owner_user_id=(select auth.uid())));
create policy yw596_canary_owner_read on public.ywi_596_canary_acks for select
 to authenticated using(exists(select 1 from public.ywi_companies c
 where c.id=company_id and c.owner_user_id=(select auth.uid())));
create policy yw596_consent_owner_read on public.ywi_596_slot_consents for select
 to authenticated using(exists(select 1 from public.ywi_companies c
 where c.id=company_id and c.owner_user_id=(select auth.uid())));
create trigger yw596_rotation_immutable before update or delete on public.ywi_596_rotation_proofs
 for each row execute function public.ywi_591_forbid_change();
create trigger yw596_canary_immutable before update or delete on public.ywi_596_canary_acks
 for each row execute function public.ywi_591_forbid_change();
create trigger yw596_consent_immutable before update or delete on public.ywi_596_slot_consents
 for each row execute function public.ywi_591_forbid_change();
create trigger yw596_pair_immutable before update or delete on public.ywi_596_cross_tenant_pilots
 for each row execute function public.ywi_591_forbid_change();
create trigger yw596_audit_immutable before update or delete on public.ywi_596_independent_continuity_audits
 for each row execute function public.ywi_591_forbid_change();

create function public.ywi_596_record_dual_key_proof(
 p_company_id uuid,p_rotation_id uuid,p_signoff_id uuid,p_owner_user_id uuid,
 p_nonce uuid,p_response_sha256 text,p_old_hmac text,p_next_hmac text,p_received_at timestamptz
) returns jsonb language plpgsql security definer set search_path='' as $fn$
declare r record; signoff record; c record; ident uuid;
begin
 perform public.ywi_591_source_role_assert();
 select * into r from public.ywi_595_rotation_proposals
  where id=p_rotation_id and company_id=p_company_id for share;
 select * into signoff from public.ywi_595_rotation_signoffs
  where id=p_signoff_id and company_id=p_company_id and proposal_id=p_rotation_id for share;
 select * into c from public.ywi_593_receiver_contracts
  where id=r.candidate_contract_id and company_id=p_company_id for share;
 if r.id is null or signoff.id is null or c.id is null or
  r.owner_user_id<>p_owner_user_id or r.reviewer_user_id<>signoff.reviewer_user_id or
  r.owner_user_id=signoff.reviewer_user_id or c.expires_at<=now() or
  signoff.actual_secret_rotated or not r.custody_only or
  p_received_at<now()-interval '2 minutes' or p_received_at>now()+interval '30 seconds' or
  p_response_sha256 !~ '^[0-9a-f]{64}$' or
  p_old_hmac !~ '^[0-9a-f]{64}$' or p_next_hmac !~ '^[0-9a-f]{64}$' or
  not exists(select 1 from public.ywi_591_tenant_pilots
    where company_id=p_company_id and owner_user_id=p_owner_user_id
    and reviewer_user_id=r.reviewer_user_id and state='APPROVED' and expires_at>now()) or
  not exists(select 1 from public.profiles
    where id=p_owner_user_id and is_active=true)
 then raise exception 'YW596 original signed receiver rotation/custody HOLD'; end if;
 insert into public.ywi_596_rotation_proofs(
  company_id,rotation_id,signoff_id,owner_user_id,request_nonce,
  response_sha256,old_receiver_hmac,next_receiver_hmac,received_at,
  actual_secret_rotated,observed_state)
 values(p_company_id,r.id,signoff.id,p_owner_user_id,p_nonce,
  p_response_sha256,p_old_hmac,p_next_hmac,p_received_at,false,
  'DUAL_KEY_RECEIVER_VERIFIED_CUSTODY_ONLY') returning id into ident;
 return jsonb_build_object('state','DUAL_KEY_RECEIVER_VERIFIED_CUSTODY_ONLY',
  'proofId',ident,'actualSecretRotated',false,'noAutomaticPromotion',true);
end;$fn$;
revoke all on function public.ywi_596_record_dual_key_proof(uuid,uuid,uuid,uuid,uuid,text,text,text,timestamptz) from public,anon,authenticated;
grant execute on function public.ywi_596_record_dual_key_proof(uuid,uuid,uuid,uuid,uuid,text,text,text,timestamptz) to service_role;

create function public.ywi_596_record_next_canary(
 p_company_id uuid,p_proof_id uuid,p_prior_ack_id uuid,p_next_attempt_id uuid,
 p_actor_id uuid,p_receipt_id text,p_nonce uuid,p_source_sha256 text,
 p_payload_sha256 text,p_ack_hmac text,p_acknowledged_at timestamptz
) returns jsonb language plpgsql security definer set search_path='' as $fn$
declare proof record; oldack record; a record; r record; pilot record; ident uuid;
begin
 perform public.ywi_591_source_role_assert();
 select * into proof from public.ywi_596_rotation_proofs
  where id=p_proof_id and company_id=p_company_id for share;
 select * into r from public.ywi_595_rotation_proposals
  where id=proof.rotation_id and company_id=p_company_id for share;
 select * into oldack from public.ywi_592_master_receipts
  where id=p_prior_ack_id and company_id=p_company_id for share;
 select * into pilot from public.ywi_591_tenant_pilots
  where company_id=p_company_id and state='APPROVED' and expires_at>now() for share;
 select * into a from public.ywi_591_photo_attempts
  where id=p_next_attempt_id and company_id=p_company_id
    and work_order_id=pilot.work_order_id for share;
 if proof.id is null or r.id is null or oldack.id is null or a.id is null or
  pilot.company_id is null or pilot.owner_user_id<>r.owner_user_id or
  a.id=oldack.attempt_id or a.uploaded_by<>p_actor_id or
  a.state<>'VERIFIED' or a.stored_sha256<>a.content_sha256 or
  a.content_sha256<>p_source_sha256 or a.content_sha256=oldack.source_sha256 or
  oldack.device_actor_id<>p_actor_id or p_acknowledged_at<=oldack.received_at or
  p_acknowledged_at<proof.received_at or
  p_acknowledged_at<now()-interval '2 minutes' or p_acknowledged_at>now()+interval '30 seconds' or
  length(p_receipt_id) not between 8 and 128 or
  p_source_sha256 !~ '^[0-9a-f]{64}$' or
  p_payload_sha256 !~ '^[0-9a-f]{64}$' or
  p_ack_hmac !~ '^[0-9a-f]{64}$' or
  not exists(select 1 from public.ywi_591_pilot_staff
   where company_id=p_company_id and user_id=p_actor_id and role='crew' and state='APPROVED') or
  not exists(select 1 from public.profiles where id=p_actor_id and is_active=true)
 then raise exception 'YW596 genuinely separate source, original old ACK and new key canary HOLD'; end if;
 insert into public.ywi_596_canary_acks(
  company_id,rotation_proof_id,prior_ack_id,next_attempt_id,source_actor_id,
  master_receipt_id,request_nonce,source_sha256,payload_sha256,next_ack_hmac,
  acknowledged_at,no_private_object_transferred)
 values(p_company_id,p_proof_id,p_prior_ack_id,p_next_attempt_id,p_actor_id,
  p_receipt_id,p_nonce,p_source_sha256,p_payload_sha256,p_ack_hmac,
  p_acknowledged_at,true) returning id into ident;
 return jsonb_build_object('state','INDEPENDENT_NEXT_KEY_SOURCE_DIGEST_ACK_VERIFIED',
  'canaryId',ident,'previousAckOriginal',true,
  'privateObjectTransferred',false,'hardwareAttested',false);
end;$fn$;
revoke all on function public.ywi_596_record_next_canary(uuid,uuid,uuid,uuid,uuid,text,uuid,text,text,text,timestamptz) from public,anon,authenticated;
grant execute on function public.ywi_596_record_next_canary(uuid,uuid,uuid,uuid,uuid,text,uuid,text,text,text,timestamptz) to service_role;

create function public.ywi_596_consent_slot(
 p_company_id uuid,p_optin_id uuid,p_slot_id uuid,p_owner_user_id uuid,
 p_signed_at timestamptz,p_payload_sha256 text,p_server_hmac text
) returns jsonb language plpgsql security definer set search_path='' as $fn$
declare opt record; s record; pilot record; ident uuid;
begin
 perform public.ywi_591_source_role_assert();
 select * into opt from public.ywi_595_fleet_optins
  where id=p_optin_id and company_id=p_company_id for share;
 select * into s from public.ywi_593_witness_slots
  where id=p_slot_id and company_id=p_company_id for share;
 select * into pilot from public.ywi_591_tenant_pilots
  where company_id=p_company_id and state='APPROVED' and expires_at>now() for share;
 if opt.id is null or s.id is null or pilot.company_id is null or
  opt.owner_user_id<>p_owner_user_id or opt.owner_user_id<>s.owner_user_id or
  pilot.owner_user_id<>p_owner_user_id or s.reviewer_user_id<>opt.reviewer_user_id or
  s.reviewer_user_id=p_owner_user_id or not opt.opt_in_consent or
  s.starts_at<=now()+interval '30 minutes' or
  s.starts_at>now()+interval '14 days' or
  not exists(select 1 from public.ywi_593_witness_approvals
   where slot_id=s.id and company_id=p_company_id and reviewer_user_id=s.reviewer_user_id) or
  p_signed_at<now()-interval '2 minutes' or p_signed_at>now()+interval '30 seconds' or
  p_payload_sha256 !~ '^[0-9a-f]{64}$' or p_server_hmac !~ '^[0-9a-f]{64}$' or
  not exists(select 1 from public.profiles where id=p_owner_user_id and is_active=true)
 then raise exception 'YW596 separate owner-consented live original pilot slot HOLD'; end if;
 insert into public.ywi_596_slot_consents(
  company_id,optin_id,slot_id,owner_user_id,signed_at,
  payload_sha256,server_hmac_sha256,explicit_schedule_consent)
 values(p_company_id,p_optin_id,p_slot_id,p_owner_user_id,
  p_signed_at,p_payload_sha256,p_server_hmac,true) returning id into ident;
 return jsonb_build_object('state','ORIGINAL_OWNER_SLOT_CONSENT_SIGNED',
  'slotConsentId',ident,'crossTenantIdentityDisclosed',false);
end;$fn$;
revoke all on function public.ywi_596_consent_slot(uuid,uuid,uuid,uuid,timestamptz,text,text) from public,anon,authenticated;
grant execute on function public.ywi_596_consent_slot(uuid,uuid,uuid,uuid,timestamptz,text,text) to service_role;

create function public.ywi_596_schedule_cross_tenant(
 p_consent_a_id uuid,p_consent_b_id uuid,p_coordinator_user_id uuid,
 p_payload_sha256 text,p_server_hmac text
) returns jsonb language plpgsql security definer set search_path='' as $fn$
declare a record; b record; sa record; sb record; pa record; pb record; ident uuid;
begin
 perform public.ywi_591_source_role_assert();
 select * into a from public.ywi_596_slot_consents where id=p_consent_a_id for share;
 select * into b from public.ywi_596_slot_consents where id=p_consent_b_id for share;
 select * into sa from public.ywi_593_witness_slots where id=a.slot_id and company_id=a.company_id for share;
 select * into sb from public.ywi_593_witness_slots where id=b.slot_id and company_id=b.company_id for share;
 select * into pa from public.ywi_591_tenant_pilots
  where company_id=a.company_id and state='APPROVED' and expires_at>now() for share;
 select * into pb from public.ywi_591_tenant_pilots
  where company_id=b.company_id and state='APPROVED' and expires_at>now() for share;
 if a.id is null or b.id is null or sa.id is null or sb.id is null or
  pa.company_id is null or pb.company_id is null or
  a.company_id>=b.company_id or a.owner_user_id=b.owner_user_id or
  pa.reviewer_user_id=pb.reviewer_user_id or
  a.owner_user_id in(pa.reviewer_user_id,pb.reviewer_user_id) or
  b.owner_user_id in(pa.reviewer_user_id,pb.reviewer_user_id) or
  p_coordinator_user_id in(a.owner_user_id,b.owner_user_id,pa.reviewer_user_id,pb.reviewer_user_id) or
  sa.owner_user_id<>a.owner_user_id or sb.owner_user_id<>b.owner_user_id or
  sa.reviewer_user_id<>pa.reviewer_user_id or sb.reviewer_user_id<>pb.reviewer_user_id or
  sa.starts_at<=now() or sb.starts_at<=now() or
  not (sa.ends_at<=sb.starts_at or sb.ends_at<=sa.starts_at) or
  not exists(select 1 from public.profiles where id=p_coordinator_user_id and role='admin' and is_active=true) or
  not exists(select 1 from public.ywi_platform_administrators_489 where user_id=p_coordinator_user_id) or
  p_payload_sha256 !~ '^[0-9a-f]{64}$' or p_server_hmac !~ '^[0-9a-f]{64}$'
 then raise exception 'YW596 two real nonoverlapping independently authorized tenant windows HOLD'; end if;
 insert into public.ywi_596_cross_tenant_pilots(
  company_a_id,company_b_id,consent_a_id,consent_b_id,
  coordinator_user_id,schedule_sha256,server_hmac_sha256,status)
 values(a.company_id,b.company_id,a.id,b.id,p_coordinator_user_id,
  p_payload_sha256,p_server_hmac,'TWO_REAL_TENANTS_SCHEDULED_NOT_AUDITED')
 returning id into ident;
 return jsonb_build_object('state','TWO_REAL_TENANTS_SCHEDULED_NOT_AUDITED',
  'pairId',ident,'crossTenantPrivateMediaShared',false,'actualFieldCertificate',false);
end;$fn$;
revoke all on function public.ywi_596_schedule_cross_tenant(uuid,uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.ywi_596_schedule_cross_tenant(uuid,uuid,uuid,text,text) to service_role;

create function public.ywi_596_independent_audit(
 p_pair_id uuid,p_canary_a_id uuid,p_canary_b_id uuid,p_auditor_user_id uuid,
 p_signed_at timestamptz,p_payload_sha256 text,p_server_hmac text
) returns jsonb language plpgsql security definer set search_path='' as $fn$
declare pair record; a record; b record; ca record; cb record; ia record; ib record; ident uuid;
begin
 perform public.ywi_591_source_role_assert();
 select * into pair from public.ywi_596_cross_tenant_pilots where id=p_pair_id for share;
 select * into a from public.ywi_596_canary_acks
  where id=p_canary_a_id and company_id=pair.company_a_id for share;
 select * into b from public.ywi_596_canary_acks
  where id=p_canary_b_id and company_id=pair.company_b_id for share;
 select * into ca from public.ywi_596_slot_consents where id=pair.consent_a_id for share;
 select * into cb from public.ywi_596_slot_consents where id=pair.consent_b_id for share;
 select * into ia from public.ywi_595_fleet_optins where id=ca.optin_id and company_id=ca.company_id for share;
 select * into ib from public.ywi_595_fleet_optins where id=cb.optin_id and company_id=cb.company_id for share;
 if pair.id is null or a.id is null or b.id is null or
  ca.id is null or cb.id is null or ia.id is null or ib.id is null or
  pair.company_a_id<>a.company_id or pair.company_b_id<>b.company_id or
  pair.company_a_id<>ca.company_id or pair.company_b_id<>cb.company_id or
  ca.owner_user_id<>ia.owner_user_id or cb.owner_user_id<>ib.owner_user_id or
  a.acknowledged_at<=pair.scheduled_at or b.acknowledged_at<=pair.scheduled_at or
  a.acknowledged_at<=now()-interval '72 hours' or b.acknowledged_at<=now()-interval '72 hours' or
  p_auditor_user_id in(pair.coordinator_user_id,ia.owner_user_id,ib.owner_user_id,
   ia.reviewer_user_id,ib.reviewer_user_id,a.source_actor_id,b.source_actor_id) or
  not exists(select 1 from public.profiles where id=p_auditor_user_id and role='admin' and is_active=true) or
  not exists(select 1 from public.ywi_platform_administrators_489 where user_id=p_auditor_user_id) or
  p_signed_at<now()-interval '2 minutes' or p_signed_at>now()+interval '30 seconds' or
  p_payload_sha256 !~ '^[0-9a-f]{64}$' or p_server_hmac !~ '^[0-9a-f]{64}$'
 then raise exception 'YW596 second independent platform auditor + two genuine signed source canaries HOLD'; end if;
 insert into public.ywi_596_independent_continuity_audits(
  pair_id,company_a_id,company_b_id,canary_a_id,canary_b_id,auditor_user_id,
  audited_at,payload_sha256,server_hmac_sha256,human_original_ack_continuity_reviewed,hardware_attested)
 values(pair.id,pair.company_a_id,pair.company_b_id,a.id,b.id,p_auditor_user_id,
  p_signed_at,p_payload_sha256,p_server_hmac,true,false)
 returning id into ident;
 return jsonb_build_object('state','INDEPENDENT_TWO_TENANT_ACK_CONTINUITY_REVIEWED',
  'auditId',ident,'tenantCount',2,'receiverSecretRotated',false,'hardwareAttested',false,
  'fleetWideCertified',false,'rawTenantRecordsDisclosed',false);
end;$fn$;
revoke all on function public.ywi_596_independent_audit(uuid,uuid,uuid,uuid,timestamptz,text,text) from public,anon,authenticated;
grant execute on function public.ywi_596_independent_audit(uuid,uuid,uuid,uuid,timestamptz,text,text) to service_role;
commit;
