-- YW593: default-empty, append-only original witness scheduling, reviewer approval,
-- tenant-scoped expiry escalations and verified receiver compatibility evidence.
-- No automatic deletion, no customer communication, no invented device witness/ACK.
begin;
create table public.ywi_593_witness_slots (
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null references public.ywi_companies(id) on delete restrict,
 attempt_id uuid not null unique references public.ywi_591_photo_attempts(id) on delete restrict,
 owner_user_id uuid not null references auth.users(id) on delete restrict,
 reviewer_user_id uuid not null references auth.users(id) on delete restrict,
 crew_user_id uuid not null references auth.users(id) on delete restrict,
 starts_at timestamptz not null,
 ends_at timestamptz not null,
 proposed_at timestamptz not null default now(),
 check(owner_user_id<>reviewer_user_id and owner_user_id<>crew_user_id and reviewer_user_id<>crew_user_id),
 check(ends_at>starts_at and ends_at<=starts_at+interval '3 hours'),
 check(starts_at>=proposed_at+interval '30 minutes' and starts_at<=proposed_at+interval '14 days')
);
create table public.ywi_593_witness_approvals (
 id uuid primary key default gen_random_uuid(),
 slot_id uuid not null unique references public.ywi_593_witness_slots(id) on delete restrict,
 company_id uuid not null references public.ywi_companies(id) on delete restrict,
 reviewer_user_id uuid not null references auth.users(id) on delete restrict,
 signed_at timestamptz not null,
 payload_sha256 text not null check(payload_sha256 ~ '^[0-9a-f]{64}$'),
 server_hmac_sha256 text not null check(server_hmac_sha256 ~ '^[0-9a-f]{64}$')
);
create table public.ywi_593_expiry_escalations (
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null references public.ywi_companies(id) on delete restrict,
 attempt_id uuid not null references public.ywi_591_photo_attempts(id) on delete restrict,
 proposal_id uuid not null references public.ywi_592_case_proposals(id) on delete restrict,
 reviewer_user_id uuid not null references auth.users(id) on delete restrict,
 reason_code text not null check(reason_code in ('RETENTION_DUE','LEASE_EXPIRED','LEGAL_HOLD_REVIEW')),
 escalated_at timestamptz not null default now(),
 unique(company_id,attempt_id,reason_code)
);
create table public.ywi_593_receiver_contracts (
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null references public.ywi_companies(id) on delete restrict,
 owner_user_id uuid not null references auth.users(id) on delete restrict,
 request_nonce uuid not null unique,
 contract_id text not null check(contract_id ~ '^[A-Za-z0-9_-]{8,128}$'),
 source_schema text not null check(source_schema='rosevear.yw.source-photo-telemetry.v1'),
 ack_schema text not null check(ack_schema='YW592-ACK'),
 receiver_response_sha256 text not null check(receiver_response_sha256 ~ '^[0-9a-f]{64}$'),
 receiver_signature text not null check(receiver_signature ~ '^[0-9a-f]{64}$'),
 observed_at timestamptz not null default now(),
 expires_at timestamptz not null,
 check(expires_at>observed_at and expires_at<=observed_at+interval '24 hours')
);
create index ywi593_slots_company_time on public.ywi_593_witness_slots(company_id,starts_at);
create index ywi593_expiry_company_time on public.ywi_593_expiry_escalations(company_id,escalated_at desc);
create index ywi593_receiver_company_time on public.ywi_593_receiver_contracts(company_id,observed_at desc);
alter table public.ywi_593_witness_slots enable row level security;
alter table public.ywi_593_witness_approvals enable row level security;
alter table public.ywi_593_expiry_escalations enable row level security;
alter table public.ywi_593_receiver_contracts enable row level security;
revoke all on public.ywi_593_witness_slots,public.ywi_593_witness_approvals,
 public.ywi_593_expiry_escalations,public.ywi_593_receiver_contracts from public,anon,authenticated;
grant select on public.ywi_593_witness_slots,public.ywi_593_witness_approvals,
 public.ywi_593_expiry_escalations,public.ywi_593_receiver_contracts to authenticated;
create policy ywi593_slots_owner_read on public.ywi_593_witness_slots
 for select to authenticated using(exists(select 1 from public.ywi_companies c
 where c.id=company_id and c.owner_user_id=(select auth.uid())));
create policy ywi593_approvals_owner_read on public.ywi_593_witness_approvals
 for select to authenticated using(exists(select 1 from public.ywi_companies c
 where c.id=company_id and c.owner_user_id=(select auth.uid())));
create policy ywi593_escalations_owner_read on public.ywi_593_expiry_escalations
 for select to authenticated using(exists(select 1 from public.ywi_companies c
 where c.id=company_id and c.owner_user_id=(select auth.uid())));
create policy ywi593_receiver_owner_read on public.ywi_593_receiver_contracts
 for select to authenticated using(exists(select 1 from public.ywi_companies c
 where c.id=company_id and c.owner_user_id=(select auth.uid())));
create trigger ywi593_slots_immutable before update or delete on public.ywi_593_witness_slots
 for each row execute function public.ywi_591_forbid_change();
create trigger ywi593_approvals_immutable before update or delete on public.ywi_593_witness_approvals
 for each row execute function public.ywi_591_forbid_change();
create trigger ywi593_escalations_immutable before update or delete on public.ywi_593_expiry_escalations
 for each row execute function public.ywi_591_forbid_change();
create trigger ywi593_receivers_immutable before update or delete on public.ywi_593_receiver_contracts
 for each row execute function public.ywi_591_forbid_change();

create function public.ywi_593_schedule_witness(
 p_company_id uuid,p_attempt_id uuid,p_owner_user_id uuid,
 p_crew_user_id uuid,p_starts_at timestamptz,p_ends_at timestamptz
) returns jsonb language plpgsql security definer set search_path='' as $fn$
declare pilot record; a record; slot uuid;
begin
 perform public.ywi_591_source_role_assert();
 select * into pilot from public.ywi_591_tenant_pilots where company_id=p_company_id
  and state='APPROVED' and expires_at>now() for share;
 select * into a from public.ywi_591_photo_attempts where id=p_attempt_id
  and company_id=p_company_id and work_order_id=pilot.work_order_id for share;
 if pilot.company_id is null or a.id is null or
  pilot.owner_user_id<>p_owner_user_id or
  p_crew_user_id<>a.uploaded_by or p_owner_user_id=pilot.reviewer_user_id or
  p_owner_user_id=p_crew_user_id or p_crew_user_id=pilot.reviewer_user_id or
  not exists(select 1 from public.ywi_companies where id=p_company_id and owner_user_id=p_owner_user_id) or
  not exists(select 1 from public.profiles where id=p_owner_user_id and is_active=true) or
  not exists(select 1 from public.ywi_591_pilot_staff where company_id=p_company_id
   and user_id=p_crew_user_id and role='crew' and state='APPROVED') or
  p_starts_at<now()+interval '30 minutes' or p_starts_at>now()+interval '14 days' or
  p_ends_at<=p_starts_at+interval '29 minutes' or p_ends_at>p_starts_at+interval '3 hours'
 then raise exception 'YW593 original owner, enrolled uploader, date or scope HOLD'; end if;
 insert into public.ywi_593_witness_slots
  (company_id,attempt_id,owner_user_id,reviewer_user_id,crew_user_id,starts_at,ends_at)
 values(p_company_id,p_attempt_id,p_owner_user_id,pilot.reviewer_user_id,
  p_crew_user_id,p_starts_at,p_ends_at) returning id into slot;
 return jsonb_build_object('state','WITNESS_PROPOSED_PENDING_DISTINCT_REVIEW',
  'slotId',slot,'physicalFieldWitnessCertified',false,'noAutomaticAction',true);
end; $fn$;
revoke all on function public.ywi_593_schedule_witness(uuid,uuid,uuid,uuid,timestamptz,timestamptz)
 from public,anon,authenticated;
grant execute on function public.ywi_593_schedule_witness(uuid,uuid,uuid,uuid,timestamptz,timestamptz)
 to service_role;

create function public.ywi_593_approve_witness(
 p_company_id uuid,p_slot_id uuid,p_reviewer_user_id uuid,p_signed_at timestamptz,
 p_payload_sha256 text,p_server_hmac text
) returns jsonb language plpgsql security definer set search_path='' as $fn$
declare s record; pilot record;
begin
 perform public.ywi_591_source_role_assert();
 select * into s from public.ywi_593_witness_slots
  where id=p_slot_id and company_id=p_company_id for share;
 select * into pilot from public.ywi_591_tenant_pilots where company_id=p_company_id
  and state='APPROVED' and expires_at>now() for share;
 if s.id is null or pilot.company_id is null or
  s.reviewer_user_id<>p_reviewer_user_id or pilot.reviewer_user_id<>p_reviewer_user_id or
  s.owner_user_id=p_reviewer_user_id or s.crew_user_id=p_reviewer_user_id or
  s.starts_at<=now() or
  not exists(select 1 from public.profiles where id=p_reviewer_user_id and is_active=true) or
  p_signed_at<now()-interval '2 minutes' or p_signed_at>now()+interval '30 seconds' or
  p_payload_sha256 !~ '^[0-9a-f]{64}$' or p_server_hmac !~ '^[0-9a-f]{64}$'
 then raise exception 'YW593 independent original reviewer or time HOLD'; end if;
 insert into public.ywi_593_witness_approvals
  (slot_id,company_id,reviewer_user_id,signed_at,payload_sha256,server_hmac_sha256)
 values(p_slot_id,p_company_id,p_reviewer_user_id,p_signed_at,p_payload_sha256,p_server_hmac);
 return jsonb_build_object('state','WITNESS_WINDOW_APPROVED_NOT_OBSERVED',
  'slotId',s.id,'physicalFieldWitnessCertified',false,'noAutomaticAction',true);
end; $fn$;
revoke all on function public.ywi_593_approve_witness(uuid,uuid,uuid,timestamptz,text,text)
 from public,anon,authenticated;
grant execute on function public.ywi_593_approve_witness(uuid,uuid,uuid,timestamptz,text,text)
 to service_role;

create function public.ywi_593_escalate_expiry(
 p_company_id uuid,p_attempt_id uuid,p_proposal_id uuid,
 p_reviewer_user_id uuid,p_reason_code text
) returns jsonb language plpgsql security definer set search_path='' as $fn$
declare pilot record; p record; a record; d record;
begin
 perform public.ywi_591_source_role_assert();
 select * into pilot from public.ywi_591_tenant_pilots
  where company_id=p_company_id and state='APPROVED' and expires_at>now() for share;
 select * into p from public.ywi_592_case_proposals
  where id=p_proposal_id and company_id=p_company_id and attempt_id=p_attempt_id for share;
 select * into a from public.ywi_591_photo_attempts
  where id=p_attempt_id and company_id=p_company_id and work_order_id=pilot.work_order_id for share;
 select * into d from public.ywi_592_case_decisions
  where company_id=p_company_id and attempt_id=p_attempt_id and proposal_id=p_proposal_id for share;
 if pilot.company_id is null or p.id is null or a.id is null or d.id is null
  or pilot.reviewer_user_id<>p_reviewer_user_id or p.reviewer_user_id<>p_reviewer_user_id
  or p.owner_user_id=p_reviewer_user_id or d.source_sha256<>a.content_sha256
  or not exists(select 1 from public.profiles where id=p_reviewer_user_id and is_active=true)
  or not(
   (p_reason_code='LEASE_EXPIRED' and p.action='EXPIRY_REVIEW' and a.lease_expires_at<=now()) or
   (p_reason_code='RETENTION_DUE' and p.action in('RETAIN_30_DAYS','RETAIN_90_DAYS')
    and p.retention_until<=now()) or
   (p_reason_code='LEGAL_HOLD_REVIEW' and p.action='LEGAL_HOLD_REVIEW'))
 then raise exception 'YW593 original signed source decision not due or reviewer HOLD'; end if;
 insert into public.ywi_593_expiry_escalations
  (company_id,attempt_id,proposal_id,reviewer_user_id,reason_code)
 values(p_company_id,p_attempt_id,p_proposal_id,p_reviewer_user_id,p_reason_code);
 return jsonb_build_object('state','TENANT_EXPIRY_ESCALATED_FOR_HUMAN_REVIEW',
  'attemptId',p_attempt_id,'noAutomaticDeletion',true,'noCustomerNotice',true);
end; $fn$;
revoke all on function public.ywi_593_escalate_expiry(uuid,uuid,uuid,uuid,text)
 from public,anon,authenticated;
grant execute on function public.ywi_593_escalate_expiry(uuid,uuid,uuid,uuid,text)
 to service_role;

create function public.ywi_593_record_receiver_contract(
 p_company_id uuid,p_owner_user_id uuid,p_nonce uuid,p_contract_id text,
 p_response_sha256 text,p_receiver_signature text
) returns jsonb language plpgsql security definer set search_path='' as $fn$
declare pilot record; ident uuid;
begin
 perform public.ywi_591_source_role_assert();
 select * into pilot from public.ywi_591_tenant_pilots
  where company_id=p_company_id and owner_user_id=p_owner_user_id
  and state='APPROVED' and expires_at>now() for share;
 if pilot.company_id is null or pilot.reviewer_user_id=p_owner_user_id
  or not exists(select 1 from public.profiles where id=p_owner_user_id and is_active=true)
  or p_contract_id !~ '^[A-Za-z0-9_-]{8,128}$'
  or p_response_sha256 !~ '^[0-9a-f]{64}$'
  or p_receiver_signature !~ '^[0-9a-f]{64}$'
 then raise exception 'YW593 original owner or signed receiver contract HOLD'; end if;
 insert into public.ywi_593_receiver_contracts(
  company_id,owner_user_id,request_nonce,contract_id,source_schema,ack_schema,
  receiver_response_sha256,receiver_signature,expires_at)
 values(p_company_id,p_owner_user_id,p_nonce,p_contract_id,
  'rosevear.yw.source-photo-telemetry.v1','YW592-ACK',
  p_response_sha256,p_receiver_signature,now()+interval '24 hours') returning id into ident;
 return jsonb_build_object('state','RECEIVER_CONTRACT_CRYPTO_VERIFIED',
  'contractRecordId',ident,'notOriginalMasterSourceAck',true,
  'physicalFieldWitnessCertified',false);
end; $fn$;
revoke all on function public.ywi_593_record_receiver_contract(uuid,uuid,uuid,text,text,text)
 from public,anon,authenticated;
grant execute on function public.ywi_593_record_receiver_contract(uuid,uuid,uuid,text,text,text)
 to service_role;
commit;
