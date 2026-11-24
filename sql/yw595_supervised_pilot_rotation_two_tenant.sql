-- YW595: additive supervised original-device ceremony; receiver key/contract
-- rotation CUSTODY only; independent two-real-tenant review. No synthetic pilot.
-- All original YW591-594 tables remain immutable and unchanged.
begin;
create table public.ywi_595_ceremony_intents (
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null references public.ywi_companies(id) on delete restrict,
 slot_id uuid not null unique references public.ywi_593_witness_slots(id) on delete restrict,
 owner_user_id uuid not null references auth.users(id) on delete restrict,
 reviewer_user_id uuid not null references auth.users(id) on delete restrict,
 crew_user_id uuid not null references auth.users(id) on delete restrict,
 source_sha256 text not null check(source_sha256 ~ '^[0-9a-f]{64}$'),
 briefing_consent boolean not null check(briefing_consent=true),
 proposed_at timestamptz not null default now(),
 unique(company_id,id),
 check(owner_user_id<>reviewer_user_id and owner_user_id<>crew_user_id
   and reviewer_user_id<>crew_user_id)
);
create table public.ywi_595_ceremony_closures (
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null references public.ywi_companies(id) on delete restrict,
 intent_id uuid not null unique references public.ywi_595_ceremony_intents(id) on delete restrict,
 field_certificate_id uuid not null unique references public.ywi_594_field_certificates(id) on delete restrict,
 master_receipt_id uuid not null references public.ywi_592_master_receipts(id) on delete restrict,
 reviewer_user_id uuid not null references auth.users(id) on delete restrict,
 source_sha256 text not null check(source_sha256 ~ '^[0-9a-f]{64}$'),
 closed_at timestamptz not null,
 evidence_sha256 text not null check(evidence_sha256 ~ '^[0-9a-f]{64}$'),
 server_hmac_sha256 text not null check(server_hmac_sha256 ~ '^[0-9a-f]{64}$')
);
create table public.ywi_595_rotation_proposals (
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null references public.ywi_companies(id) on delete restrict,
 prior_contract_id uuid not null references public.ywi_593_receiver_contracts(id) on delete restrict,
 candidate_contract_id uuid not null references public.ywi_593_receiver_contracts(id) on delete restrict,
 owner_user_id uuid not null references auth.users(id) on delete restrict,
 reviewer_user_id uuid not null references auth.users(id) on delete restrict,
 reason text not null check(reason in('PLANNED_ROTATION','RECEIVER_CONTRACT_CHANGE','EXPIRED_BASELINE_REVIEW')),
 custody_only boolean not null default true check(custody_only=true),
 proposed_at timestamptz not null default now(),
 unique(company_id,id),unique(prior_contract_id,candidate_contract_id),
 check(prior_contract_id<>candidate_contract_id),
 check(owner_user_id<>reviewer_user_id)
);
create table public.ywi_595_rotation_signoffs (
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null references public.ywi_companies(id) on delete restrict,
 proposal_id uuid not null unique references public.ywi_595_rotation_proposals(id) on delete restrict,
 reviewer_user_id uuid not null references auth.users(id) on delete restrict,
 signed_at timestamptz not null,
 payload_sha256 text not null check(payload_sha256 ~ '^[0-9a-f]{64}$'),
 server_hmac_sha256 text not null check(server_hmac_sha256 ~ '^[0-9a-f]{64}$'),
 actual_secret_rotated boolean not null default false check(actual_secret_rotated=false)
);
create table public.ywi_595_fleet_optins (
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null unique references public.ywi_companies(id) on delete restrict,
 ceremony_closure_id uuid not null unique references public.ywi_595_ceremony_closures(id) on delete restrict,
 owner_user_id uuid not null references auth.users(id) on delete restrict,
 reviewer_user_id uuid not null references auth.users(id) on delete restrict,
 signed_at timestamptz not null,
 payload_sha256 text not null check(payload_sha256 ~ '^[0-9a-f]{64}$'),
 server_hmac_sha256 text not null check(server_hmac_sha256 ~ '^[0-9a-f]{64}$'),
 opt_in_consent boolean not null check(opt_in_consent=true),
 check(owner_user_id<>reviewer_user_id)
);
create table public.ywi_595_fleet_reviews (
 id uuid primary key default gen_random_uuid(),
 company_a_id uuid not null references public.ywi_companies(id) on delete restrict,
 company_b_id uuid not null references public.ywi_companies(id) on delete restrict,
 optin_a_id uuid not null references public.ywi_595_fleet_optins(id) on delete restrict,
 optin_b_id uuid not null references public.ywi_595_fleet_optins(id) on delete restrict,
 sysop_user_id uuid not null references auth.users(id) on delete restrict,
 observed_at timestamptz not null,
 review_scope text not null check(review_scope='TWO_ORIGINAL_TENANT_HUMAN_EVIDENCE'),
 payload_sha256 text not null check(payload_sha256 ~ '^[0-9a-f]{64}$'),
 server_hmac_sha256 text not null check(server_hmac_sha256 ~ '^[0-9a-f]{64}$'),
 created_at timestamptz not null default now(),
 unique(optin_a_id,optin_b_id),
 check(company_a_id<company_b_id and optin_a_id<>optin_b_id)
);
create index yw595_ceremony_company_time on public.ywi_595_ceremony_intents(company_id,proposed_at desc);
create index yw595_rotation_company_time on public.ywi_595_rotation_proposals(company_id,proposed_at desc);
create index yw595_fleet_review_created on public.ywi_595_fleet_reviews(created_at desc);
alter table public.ywi_595_ceremony_intents enable row level security;
alter table public.ywi_595_ceremony_closures enable row level security;
alter table public.ywi_595_rotation_proposals enable row level security;
alter table public.ywi_595_rotation_signoffs enable row level security;
alter table public.ywi_595_fleet_optins enable row level security;
alter table public.ywi_595_fleet_reviews enable row level security;
revoke all on public.ywi_595_ceremony_intents,public.ywi_595_ceremony_closures,
 public.ywi_595_rotation_proposals,public.ywi_595_rotation_signoffs,
 public.ywi_595_fleet_optins,public.ywi_595_fleet_reviews from public,anon,authenticated;
grant select on public.ywi_595_ceremony_intents,public.ywi_595_ceremony_closures,
 public.ywi_595_rotation_proposals,public.ywi_595_rotation_signoffs,
 public.ywi_595_fleet_optins to authenticated;
create policy yw595_ceremony_owner_read on public.ywi_595_ceremony_intents
 for select to authenticated using(exists(select 1 from public.ywi_companies c
  where c.id=company_id and c.owner_user_id=(select auth.uid())));
create policy yw595_closure_owner_read on public.ywi_595_ceremony_closures
 for select to authenticated using(exists(select 1 from public.ywi_companies c
  where c.id=company_id and c.owner_user_id=(select auth.uid())));
create policy yw595_rotation_owner_read on public.ywi_595_rotation_proposals
 for select to authenticated using(exists(select 1 from public.ywi_companies c
  where c.id=company_id and c.owner_user_id=(select auth.uid())));
create policy yw595_rotation_signoff_owner_read on public.ywi_595_rotation_signoffs
 for select to authenticated using(exists(select 1 from public.ywi_companies c
  where c.id=company_id and c.owner_user_id=(select auth.uid())));
create policy yw595_fleet_optin_owner_read on public.ywi_595_fleet_optins
 for select to authenticated using(exists(select 1 from public.ywi_companies c
  where c.id=company_id and c.owner_user_id=(select auth.uid())));
-- Cross-tenant aggregate is NOT directly readable via the client Data API.
create trigger yw595_ceremony_immutable before update or delete on public.ywi_595_ceremony_intents
 for each row execute function public.ywi_591_forbid_change();
create trigger yw595_closure_immutable before update or delete on public.ywi_595_ceremony_closures
 for each row execute function public.ywi_591_forbid_change();
create trigger yw595_rotation_immutable before update or delete on public.ywi_595_rotation_proposals
 for each row execute function public.ywi_591_forbid_change();
create trigger yw595_signoff_immutable before update or delete on public.ywi_595_rotation_signoffs
 for each row execute function public.ywi_591_forbid_change();
create trigger yw595_optin_immutable before update or delete on public.ywi_595_fleet_optins
 for each row execute function public.ywi_591_forbid_change();
create trigger yw595_fleet_review_immutable before update or delete on public.ywi_595_fleet_reviews
 for each row execute function public.ywi_591_forbid_change();

create function public.ywi_595_begin_ceremony(
 p_company_id uuid,p_slot_id uuid,p_owner_user_id uuid,p_source_sha256 text
) returns jsonb language plpgsql security definer set search_path='' as $fn$
declare s record; a record; pilot record; ident uuid;
begin
 perform public.ywi_591_source_role_assert();
 select * into s from public.ywi_593_witness_slots
  where id=p_slot_id and company_id=p_company_id for share;
 select * into pilot from public.ywi_591_tenant_pilots where company_id=p_company_id
  and state='APPROVED' and expires_at>now() for share;
 select * into a from public.ywi_591_photo_attempts
  where id=s.attempt_id and company_id=p_company_id
  and work_order_id=pilot.work_order_id for share;
 if s.id is null or a.id is null or pilot.company_id is null or
  s.owner_user_id<>p_owner_user_id or pilot.owner_user_id<>p_owner_user_id or
  s.reviewer_user_id<>pilot.reviewer_user_id or a.uploaded_by<>s.crew_user_id or
  a.content_sha256<>p_source_sha256 or a.stored_sha256<>p_source_sha256 or
  a.state<>'VERIFIED' or p_owner_user_id in(s.reviewer_user_id,s.crew_user_id) or
  s.crew_user_id=s.reviewer_user_id or now()>s.ends_at or
  not exists(select 1 from public.ywi_593_witness_approvals
   where slot_id=s.id and company_id=p_company_id and reviewer_user_id=s.reviewer_user_id) or
  not exists(select 1 from public.profiles where id=p_owner_user_id and is_active=true) or
  not exists(select 1 from public.ywi_591_pilot_staff
   where company_id=p_company_id and user_id=s.crew_user_id
   and role='crew' and state='APPROVED')
 then raise exception 'YW595 approved original ceremony/owner/crew source HOLD'; end if;
 insert into public.ywi_595_ceremony_intents
  (company_id,slot_id,owner_user_id,reviewer_user_id,crew_user_id,source_sha256,briefing_consent)
 values(p_company_id,s.id,p_owner_user_id,s.reviewer_user_id,s.crew_user_id,
  p_source_sha256,true) returning id into ident;
 return jsonb_build_object('state','SUPERVISED_ORIGINAL_FIELD_CEREMONY_BRIEFED',
  'ceremonyId',ident,'humanFieldCertified',false,'hardwareAttested',false);
end; $fn$;
revoke all on function public.ywi_595_begin_ceremony(uuid,uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.ywi_595_begin_ceremony(uuid,uuid,uuid,text) to service_role;

create function public.ywi_595_close_ceremony(
 p_company_id uuid,p_intent_id uuid,p_certificate_id uuid,p_reviewer_user_id uuid,
 p_signed_at timestamptz,p_payload_sha256 text,p_server_hmac text
) returns jsonb language plpgsql security definer set search_path='' as $fn$
declare i record; cert record; s record; ack record; ident uuid;
begin
 perform public.ywi_591_source_role_assert();
 select * into i from public.ywi_595_ceremony_intents
  where id=p_intent_id and company_id=p_company_id for share;
 select * into cert from public.ywi_594_field_certificates
  where id=p_certificate_id and company_id=p_company_id for share;
 select * into s from public.ywi_593_witness_slots
  where id=i.slot_id and company_id=p_company_id for share;
 select * into ack from public.ywi_592_master_receipts
  where id=cert.master_receipt_id and company_id=p_company_id
  and attempt_id=s.attempt_id for share;
 if i.id is null or cert.id is null or s.id is null or ack.id is null or
  cert.slot_id<>s.id or cert.reviewer_user_id<>p_reviewer_user_id or
  i.reviewer_user_id<>p_reviewer_user_id or
  i.owner_user_id<>s.owner_user_id or i.crew_user_id<>s.crew_user_id or
  p_reviewer_user_id in(i.owner_user_id,i.crew_user_id) or
  cert.source_sha256<>i.source_sha256 or ack.source_sha256<>i.source_sha256 or
  ack.device_actor_id<>i.crew_user_id or
  not cert.human_field_attested or cert.hardware_attested or
  p_signed_at<now()-interval '2 minutes' or p_signed_at>now()+interval '30 seconds' or
  now()>cert.certified_at+interval '72 hours' or
  p_payload_sha256 !~ '^[0-9a-f]{64}$' or p_server_hmac !~ '^[0-9a-f]{64}$' or
  not exists(select 1 from public.ywi_591_tenant_pilots
   where company_id=p_company_id and reviewer_user_id=p_reviewer_user_id
   and state='APPROVED' and expires_at>now()) or
  not exists(select 1 from public.profiles
   where id=p_reviewer_user_id and is_active=true)
 then raise exception 'YW595 independent certificate/actual ACK ceremony HOLD'; end if;
 insert into public.ywi_595_ceremony_closures
  (company_id,intent_id,field_certificate_id,master_receipt_id,
   reviewer_user_id,source_sha256,closed_at,evidence_sha256,server_hmac_sha256)
 values(p_company_id,i.id,cert.id,ack.id,p_reviewer_user_id,i.source_sha256,
  p_signed_at,p_payload_sha256,p_server_hmac) returning id into ident;
 return jsonb_build_object('state','SUPERVISED_HUMAN_FIELD_CEREMONY_CLOSED',
  'closureId',ident,'hardwareAttested',false,'notAutomatedPilotEnrolment',true);
end; $fn$;
revoke all on function public.ywi_595_close_ceremony(uuid,uuid,uuid,uuid,timestamptz,text,text)
 from public,anon,authenticated;
grant execute on function public.ywi_595_close_ceremony(uuid,uuid,uuid,uuid,timestamptz,text,text)
 to service_role;

create function public.ywi_595_propose_rotation(
 p_company_id uuid,p_prior_contract_id uuid,p_candidate_contract_id uuid,
 p_owner_user_id uuid,p_reason text
) returns jsonb language plpgsql security definer set search_path='' as $fn$
declare oldc record; newc record; pilot record; ident uuid;
begin
 perform public.ywi_591_source_role_assert();
 select * into oldc from public.ywi_593_receiver_contracts
  where id=p_prior_contract_id and company_id=p_company_id for share;
 select * into newc from public.ywi_593_receiver_contracts
  where id=p_candidate_contract_id and company_id=p_company_id for share;
 select * into pilot from public.ywi_591_tenant_pilots
  where company_id=p_company_id and state='APPROVED' and expires_at>now() for share;
 if oldc.id is null or newc.id is null or pilot.company_id is null or
  oldc.id=newc.id or oldc.owner_user_id<>p_owner_user_id or
  newc.owner_user_id<>p_owner_user_id or pilot.owner_user_id<>p_owner_user_id or
  newc.observed_at<=oldc.observed_at or newc.expires_at<=now() or
  oldc.contract_id=newc.contract_id or newc.source_schema<>oldc.source_schema or
  newc.ack_schema<>oldc.ack_schema or
  p_owner_user_id=pilot.reviewer_user_id or
  p_reason not in('PLANNED_ROTATION','RECEIVER_CONTRACT_CHANGE','EXPIRED_BASELINE_REVIEW') or
  not exists(select 1 from public.profiles where id=p_owner_user_id and is_active=true)
 then raise exception 'YW595 two genuine signed receiver contracts/owner HOLD'; end if;
 insert into public.ywi_595_rotation_proposals
  (company_id,prior_contract_id,candidate_contract_id,owner_user_id,reviewer_user_id,reason)
 values(p_company_id,oldc.id,newc.id,p_owner_user_id,pilot.reviewer_user_id,p_reason)
 returning id into ident;
 return jsonb_build_object('state','RECEIVER_ROTATION_CUSTODY_REVIEW_ONLY',
  'rotationId',ident,'actualSecretRotated',false,'automaticContractActivation',false);
end; $fn$;
revoke all on function public.ywi_595_propose_rotation(uuid,uuid,uuid,uuid,text)
 from public,anon,authenticated;
grant execute on function public.ywi_595_propose_rotation(uuid,uuid,uuid,uuid,text)
 to service_role;

create function public.ywi_595_approve_rotation(
 p_company_id uuid,p_rotation_id uuid,p_reviewer_user_id uuid,
 p_signed_at timestamptz,p_payload_sha256 text,p_server_hmac text
) returns jsonb language plpgsql security definer set search_path='' as $fn$
declare r record; c record; pilot record; ident uuid;
begin
 perform public.ywi_591_source_role_assert();
 select * into r from public.ywi_595_rotation_proposals
  where id=p_rotation_id and company_id=p_company_id for share;
 select * into c from public.ywi_593_receiver_contracts
  where id=r.candidate_contract_id and company_id=p_company_id for share;
 select * into pilot from public.ywi_591_tenant_pilots
  where company_id=p_company_id and state='APPROVED' and expires_at>now() for share;
 if r.id is null or c.id is null or pilot.company_id is null or
  r.reviewer_user_id<>p_reviewer_user_id or pilot.reviewer_user_id<>p_reviewer_user_id or
  r.owner_user_id=p_reviewer_user_id or
  c.expires_at<=now() or now()>r.proposed_at+interval '24 hours' or
  p_signed_at<now()-interval '2 minutes' or p_signed_at>now()+interval '30 seconds' or
  p_payload_sha256 !~ '^[0-9a-f]{64}$' or p_server_hmac !~ '^[0-9a-f]{64}$' or
  not exists(select 1 from public.profiles
   where id=p_reviewer_user_id and is_active=true)
 then raise exception 'YW595 original independent contract reviewer HOLD'; end if;
 insert into public.ywi_595_rotation_signoffs
  (company_id,proposal_id,reviewer_user_id,signed_at,payload_sha256,server_hmac_sha256)
 values(p_company_id,r.id,p_reviewer_user_id,p_signed_at,p_payload_sha256,p_server_hmac)
 returning id into ident;
 return jsonb_build_object('state','INDEPENDENT_ROTATION_CUSTODY_SIGNED_NOT_APPLIED',
  'signoffId',ident,'actualSecretRotated',false,'noRemoteMutation',true);
end; $fn$;
revoke all on function public.ywi_595_approve_rotation(uuid,uuid,uuid,timestamptz,text,text)
 from public,anon,authenticated;
grant execute on function public.ywi_595_approve_rotation(uuid,uuid,uuid,timestamptz,text,text)
 to service_role;

create function public.ywi_595_optin_fleet(
 p_company_id uuid,p_closure_id uuid,p_owner_user_id uuid,
 p_signed_at timestamptz,p_payload_sha256 text,p_server_hmac text
) returns jsonb language plpgsql security definer set search_path='' as $fn$
declare c record; i record; ident uuid;
begin
 perform public.ywi_591_source_role_assert();
 select * into c from public.ywi_595_ceremony_closures
  where id=p_closure_id and company_id=p_company_id for share;
 select * into i from public.ywi_595_ceremony_intents
  where id=c.intent_id and company_id=p_company_id for share;
 if c.id is null or i.id is null or i.owner_user_id<>p_owner_user_id or
  i.reviewer_user_id<>c.reviewer_user_id or
  p_owner_user_id=i.reviewer_user_id or
  p_signed_at<now()-interval '2 minutes' or p_signed_at>now()+interval '30 seconds' or
  p_payload_sha256 !~ '^[0-9a-f]{64}$' or p_server_hmac !~ '^[0-9a-f]{64}$' or
  not exists(select 1 from public.ywi_591_tenant_pilots
   where company_id=p_company_id and owner_user_id=p_owner_user_id
   and state='APPROVED' and expires_at>now()) or
  not exists(select 1 from public.profiles
   where id=p_owner_user_id and is_active=true)
 then raise exception 'YW595 real owner/closed supervised ceremony required'; end if;
 insert into public.ywi_595_fleet_optins
  (company_id,ceremony_closure_id,owner_user_id,reviewer_user_id,
   signed_at,payload_sha256,server_hmac_sha256,opt_in_consent)
 values(p_company_id,c.id,p_owner_user_id,c.reviewer_user_id,
  p_signed_at,p_payload_sha256,p_server_hmac,true) returning id into ident;
 return jsonb_build_object('state','TENANT_FLEET_REVIEW_OPTED_IN_NOT_YET_REVIEWED',
  'optinId',ident,'crossTenantEvidenceDisclosed',false);
end; $fn$;
revoke all on function public.ywi_595_optin_fleet(uuid,uuid,uuid,timestamptz,text,text)
 from public,anon,authenticated;
grant execute on function public.ywi_595_optin_fleet(uuid,uuid,uuid,timestamptz,text,text)
 to service_role;

create function public.ywi_595_review_fleet(
 p_optin_a_id uuid,p_optin_b_id uuid,p_sysop_user_id uuid,
 p_signed_at timestamptz,p_payload_sha256 text,p_server_hmac text
) returns jsonb language plpgsql security definer set search_path='' as $fn$
declare a record; b record; ac record; bc record; ident uuid;
begin
 perform public.ywi_591_source_role_assert();
 select * into a from public.ywi_595_fleet_optins where id=p_optin_a_id for share;
 select * into b from public.ywi_595_fleet_optins where id=p_optin_b_id for share;
 select * into ac from public.ywi_595_ceremony_closures
  where id=a.ceremony_closure_id and company_id=a.company_id for share;
 select * into bc from public.ywi_595_ceremony_closures
  where id=b.ceremony_closure_id and company_id=b.company_id for share;
 if a.id is null or b.id is null or ac.id is null or bc.id is null or
  a.company_id>=b.company_id or a.owner_user_id=b.owner_user_id or
  a.reviewer_user_id=b.reviewer_user_id or
  a.owner_user_id in(a.reviewer_user_id,b.reviewer_user_id) or
  b.owner_user_id in(b.reviewer_user_id,a.reviewer_user_id) or
  p_sysop_user_id in(a.owner_user_id,b.owner_user_id,
   a.reviewer_user_id,b.reviewer_user_id) or
  ac.reviewer_user_id<>a.reviewer_user_id or
  bc.reviewer_user_id<>b.reviewer_user_id or
  not a.opt_in_consent or not b.opt_in_consent or
  not exists(select 1 from public.profiles
   where id=p_sysop_user_id and is_active=true and role='admin') or
  not exists(select 1 from public.ywi_platform_administrators_489
   where user_id=p_sysop_user_id) or
  not exists(select 1 from public.profiles
   where id=a.owner_user_id and is_active=true) or
  not exists(select 1 from public.profiles
   where id=b.owner_user_id and is_active=true) or
  not exists(select 1 from public.profiles
   where id=a.reviewer_user_id and is_active=true) or
  not exists(select 1 from public.profiles
   where id=b.reviewer_user_id and is_active=true) or
  not exists(select 1 from public.ywi_591_tenant_pilots
   where company_id=a.company_id and owner_user_id=a.owner_user_id
   and state='APPROVED' and expires_at>now()) or
  not exists(select 1 from public.ywi_591_tenant_pilots
   where company_id=b.company_id and owner_user_id=b.owner_user_id
   and state='APPROVED' and expires_at>now()) or
  p_signed_at<now()-interval '2 minutes' or p_signed_at>now()+interval '30 seconds' or
  p_payload_sha256 !~ '^[0-9a-f]{64}$' or p_server_hmac !~ '^[0-9a-f]{64}$'
 then raise exception 'YW595 two distinct original companies, staff and platform sysop HOLD'; end if;
 insert into public.ywi_595_fleet_reviews
  (company_a_id,company_b_id,optin_a_id,optin_b_id,sysop_user_id,
   observed_at,review_scope,payload_sha256,server_hmac_sha256)
 values(a.company_id,b.company_id,a.id,b.id,p_sysop_user_id,
  p_signed_at,'TWO_ORIGINAL_TENANT_HUMAN_EVIDENCE',p_payload_sha256,p_server_hmac)
 returning id into ident;
 return jsonb_build_object('state','TWO_DISTINCT_TENANT_HUMAN_EVIDENCE_REVIEW_SIGNED',
  'reviewId',ident,'tenantCount',2,'hardwareAttested',false,
  'tenantIdentifiersDisclosed',false,'notFleetWideDeploymentCertification',true);
end; $fn$;
revoke all on function public.ywi_595_review_fleet(uuid,uuid,uuid,timestamptz,text,text)
 from public,anon,authenticated;
grant execute on function public.ywi_595_review_fleet(uuid,uuid,uuid,timestamptz,text,text)
 to service_role;
commit;
