-- YW592: default-empty photo case triage, immutable dual-human decisions,
-- and source-verified Master ACK receipts. Never deletes, publishes or invoices photos.
begin;
create table public.ywi_592_case_proposals (
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null references public.ywi_companies(id) on delete restrict,
 attempt_id uuid not null unique references public.ywi_591_photo_attempts(id) on delete restrict,
 owner_user_id uuid not null references auth.users(id) on delete restrict,
 reviewer_user_id uuid not null references auth.users(id) on delete restrict,
 action text not null check(action in
  ('RETAIN_30_DAYS','RETAIN_90_DAYS','EXPIRY_REVIEW','LEGAL_HOLD_REVIEW')),
 reason_code text not null check(reason_code in
  ('CUSTOMER_REQUEST','ACTIVE_INCIDENT','NORMAL_EXPIRY','SOURCE_INTEGRITY')),
 proposed_at timestamptz not null default now(),
 review_expires_at timestamptz not null default (now()+interval '24 hours'),
 retention_until timestamptz,
 unique(company_id,id),
 check(owner_user_id<>reviewer_user_id),
 check(review_expires_at>proposed_at and review_expires_at<=proposed_at+interval '24 hours'),
 check((action='RETAIN_30_DAYS' or action='RETAIN_90_DAYS') = (retention_until is not null))
);
create table public.ywi_592_case_decisions (
 id uuid primary key default gen_random_uuid(),
 proposal_id uuid not null unique references public.ywi_592_case_proposals(id) on delete restrict,
 company_id uuid not null references public.ywi_companies(id) on delete restrict,
 attempt_id uuid not null references public.ywi_591_photo_attempts(id) on delete restrict,
 reviewer_user_id uuid not null references auth.users(id) on delete restrict,
 source_sha256 text not null check(source_sha256 ~ '^[0-9a-f]{64}$'),
 signed_at timestamptz not null,
 decision_payload_sha256 text not null check(decision_payload_sha256 ~ '^[0-9a-f]{64}$'),
 server_hmac_sha256 text not null check(server_hmac_sha256 ~ '^[0-9a-f]{64}$'),
 unique(company_id,attempt_id)
);
create table public.ywi_592_master_receipts (
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null references public.ywi_companies(id) on delete restrict,
 attempt_id uuid not null unique references public.ywi_591_photo_attempts(id) on delete restrict,
 device_actor_id uuid not null references auth.users(id) on delete restrict,
 master_receipt_id text not null unique check(length(master_receipt_id) between 8 and 128),
 request_nonce uuid not null unique,
 source_sha256 text not null check(source_sha256 ~ '^[0-9a-f]{64}$'),
 payload_sha256 text not null check(payload_sha256 ~ '^[0-9a-f]{64}$'),
 master_ack_hmac_sha256 text not null check(master_ack_hmac_sha256 ~ '^[0-9a-f]{64}$'),
 received_at timestamptz not null default now()
);
create index yw592_proposals_by_tenant on public.ywi_592_case_proposals(company_id,proposed_at desc);
create index yw592_receipts_by_tenant on public.ywi_592_master_receipts(company_id,received_at desc);
alter table public.ywi_592_case_proposals enable row level security;
alter table public.ywi_592_case_decisions enable row level security;
alter table public.ywi_592_master_receipts enable row level security;
revoke all on public.ywi_592_case_proposals,public.ywi_592_case_decisions,
 public.ywi_592_master_receipts from public,anon,authenticated;
grant select on public.ywi_592_case_proposals,public.ywi_592_case_decisions,
 public.ywi_592_master_receipts to authenticated;
create policy yw592_owner_proposal_read on public.ywi_592_case_proposals
 for select to authenticated using(exists(select 1 from public.ywi_companies c
  where c.id=company_id and c.owner_user_id=(select auth.uid())));
create policy yw592_owner_decision_read on public.ywi_592_case_decisions
 for select to authenticated using(exists(select 1 from public.ywi_companies c
  where c.id=company_id and c.owner_user_id=(select auth.uid())));
create policy yw592_owner_receipt_read on public.ywi_592_master_receipts
 for select to authenticated using(exists(select 1 from public.ywi_companies c
  where c.id=company_id and c.owner_user_id=(select auth.uid())));
-- Immutable signed custody: even service role cannot silently replace an original receipt.
create trigger yw592_proposals_immutable before update or delete
 on public.ywi_592_case_proposals for each row
 execute function public.ywi_591_forbid_change();
create trigger yw592_decisions_immutable before update or delete
 on public.ywi_592_case_decisions for each row
 execute function public.ywi_591_forbid_change();
create trigger yw592_receipts_immutable before update or delete
 on public.ywi_592_master_receipts for each row
 execute function public.ywi_591_forbid_change();

create or replace function public.ywi_592_propose_case(
 p_company_id uuid,p_attempt_id uuid,p_owner_user_id uuid,
 p_action text,p_reason_code text)
returns jsonb language plpgsql security definer set search_path='' as $fn$
declare p record; a record; until_at timestamptz;
begin
 perform public.ywi_591_source_role_assert();
 select * into p from public.ywi_591_tenant_pilots
  where company_id=p_company_id and state='APPROVED' and expires_at>now() for share;
 if not found or p.owner_user_id<>p_owner_user_id or
  not exists(select 1 from public.profiles where id=p_owner_user_id and is_active=true)
 then raise exception 'YW592 real active company owner and approved pilot required'; end if;
 select * into a from public.ywi_591_photo_attempts
  where id=p_attempt_id and company_id=p_company_id and work_order_id=p.work_order_id for share;
 if not found then raise exception 'YW592 tenant-original photo attempt missing'; end if;
 if p_action not in('RETAIN_30_DAYS','RETAIN_90_DAYS','EXPIRY_REVIEW','LEGAL_HOLD_REVIEW')
  or p_reason_code not in('CUSTOMER_REQUEST','ACTIVE_INCIDENT','NORMAL_EXPIRY','SOURCE_INTEGRITY')
 then raise exception 'YW592 explicit bounded decision and reason required'; end if;
 if p_action='RETAIN_30_DAYS' then until_at:=now()+interval '30 days';
 elsif p_action='RETAIN_90_DAYS' then until_at:=now()+interval '90 days';
 else until_at:=null; end if;
 insert into public.ywi_592_case_proposals(
  company_id,attempt_id,owner_user_id,reviewer_user_id,action,reason_code,retention_until)
 values(p_company_id,p_attempt_id,p_owner_user_id,p.reviewer_user_id,
  p_action,p_reason_code,until_at);
 return (select jsonb_build_object('state','INDEPENDENT_REVIEW_PENDING',
  'proposalId',id,'reviewExpiresAt',review_expires_at,
  'retentionUntil',retention_until,'noObjectDeletion',true)
  from public.ywi_592_case_proposals where attempt_id=p_attempt_id);
end; $fn$;
revoke all on function public.ywi_592_propose_case(uuid,uuid,uuid,text,text)
 from public,anon,authenticated;
grant execute on function public.ywi_592_propose_case(uuid,uuid,uuid,text,text) to service_role;

create or replace function public.ywi_592_sign_decision(
 p_company_id uuid,p_proposal_id uuid,p_reviewer_user_id uuid,
 p_signed_at timestamptz,p_source_sha256 text,p_payload_sha256 text,p_server_hmac text)
returns jsonb language plpgsql security definer set search_path='' as $fn$
declare p record; a record; pilot record;
begin
 perform public.ywi_591_source_role_assert();
 select * into p from public.ywi_592_case_proposals
  where id=p_proposal_id and company_id=p_company_id for share;
 select * into pilot from public.ywi_591_tenant_pilots
  where company_id=p_company_id and state='APPROVED' and expires_at>now() for share;
 if p.id is null or pilot.company_id is null or
  p.reviewer_user_id<>p_reviewer_user_id or pilot.reviewer_user_id<>p_reviewer_user_id
  or p.owner_user_id=p_reviewer_user_id or p.review_expires_at<=now()
  or not exists(select 1 from public.profiles where id=p_reviewer_user_id and is_active=true)
  or p_signed_at<now()-interval '2 minutes' or p_signed_at>now()+interval '30 seconds'
 then raise exception 'YW592 distinct current reviewer or proposal lease HOLD'; end if;
 select * into a from public.ywi_591_photo_attempts
  where id=p.attempt_id and company_id=p_company_id
   and work_order_id=pilot.work_order_id for share;
 if not found or a.content_sha256<>p_source_sha256
  or p_payload_sha256 !~ '^[0-9a-f]{64}$'
  or p_server_hmac !~ '^[0-9a-f]{64}$'
 then raise exception 'YW592 source digest or server signature HOLD'; end if;
 insert into public.ywi_592_case_decisions(
  proposal_id,company_id,attempt_id,reviewer_user_id,source_sha256,
  signed_at,decision_payload_sha256,server_hmac_sha256)
 values(p.id,p_company_id,p.attempt_id,p_reviewer_user_id,p_source_sha256,
  p_signed_at,p_payload_sha256,p_server_hmac);
 return jsonb_build_object('state','SIGNED_REVIEW_RECORDED',
  'attemptId',p.attempt_id,'noObjectDeletion',true,'serverSigned',true);
end; $fn$;
revoke all on function public.ywi_592_sign_decision(
 uuid,uuid,uuid,timestamptz,text,text,text) from public,anon,authenticated;
grant execute on function public.ywi_592_sign_decision(
 uuid,uuid,uuid,timestamptz,text,text,text) to service_role;

create or replace function public.ywi_592_record_master_receipt(
 p_company_id uuid,p_attempt_id uuid,p_actor_id uuid,p_receipt_id text,
 p_nonce uuid,p_source_sha256 text,p_payload_sha256 text,p_ack_hmac text)
returns jsonb language plpgsql security definer set search_path='' as $fn$
declare a record; pilot record;
begin
 perform public.ywi_591_source_role_assert();
 select * into pilot from public.ywi_591_tenant_pilots
  where company_id=p_company_id and state='APPROVED' and expires_at>now() for share;
 select * into a from public.ywi_591_photo_attempts
  where id=p_attempt_id and company_id=p_company_id and state='VERIFIED' for share;
 if pilot.company_id is null or a.id is null or
  pilot.work_order_id<>a.work_order_id or a.uploaded_by<>p_actor_id or
  a.content_sha256<>p_source_sha256 or a.stored_sha256<>p_source_sha256 or
  not exists(select 1 from public.ywi_591_pilot_staff where
   company_id=p_company_id and user_id=p_actor_id and role='crew' and state='APPROVED')
  or p_receipt_id !~ '^[A-Za-z0-9_-]{8,128}$' or
  p_payload_sha256 !~ '^[0-9a-f]{64}$' or p_ack_hmac !~ '^[0-9a-f]{64}$'
 then raise exception 'YW592 original crew, bytes, tenant or Master signature HOLD'; end if;
 insert into public.ywi_592_master_receipts(
  company_id,attempt_id,device_actor_id,master_receipt_id,
  request_nonce,source_sha256,payload_sha256,master_ack_hmac_sha256)
 values(p_company_id,p_attempt_id,p_actor_id,p_receipt_id,p_nonce,
  p_source_sha256,p_payload_sha256,p_ack_hmac);
 return jsonb_build_object('state','MASTER_ACK_CRYPTO_VERIFIED_STORED',
  'receiptId',p_receipt_id,'sourceVerified',true,'liveHardwareAttested',false);
end; $fn$;
revoke all on function public.ywi_592_record_master_receipt(
 uuid,uuid,uuid,text,uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.ywi_592_record_master_receipt(
 uuid,uuid,uuid,text,uuid,text,text,text) to service_role;
commit;