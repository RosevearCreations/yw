-- YW591: private photo retry, recoverable uploaded-but-unreceipted objects,
-- real owner+independent-reviewer opt-in, tenant isolation and audit.
-- No seeded tenants, users, staff, photos, invoices or automatic access changes.
begin;
create table public.ywi_591_tenant_pilots (
 company_id uuid primary key references public.ywi_companies(id) on delete restrict,
 owner_user_id uuid not null references auth.users(id) on delete restrict,
 reviewer_user_id uuid not null references auth.users(id) on delete restrict,
 client_id uuid not null, client_site_id uuid not null,
 work_order_id uuid not null unique references public.work_orders(id) on delete restrict,
 state text not null default 'PROPOSED' check(state in ('PROPOSED','APPROVED','REVOKED')),
 proposed_at timestamptz not null default now(),
 approved_at timestamptz, revoked_at timestamptz,
 expires_at timestamptz not null,
 foreign key(company_id,client_id)
  references public.ywi_company_client_links_422(company_id,client_id) on delete restrict,
 foreign key(company_id,client_id,client_site_id)
  references public.ywi_company_site_links_422(company_id,client_id,client_site_id) on delete restrict,
 unique(company_id,work_order_id),
 check(owner_user_id<>reviewer_user_id),
 check(expires_at>proposed_at and expires_at<=proposed_at+interval '7 days'),
 check((state='PROPOSED' and approved_at is null and revoked_at is null)
  or (state='APPROVED' and approved_at is not null and revoked_at is null)
  or (state='REVOKED' and revoked_at is not null))
);
create table public.ywi_591_pilot_staff (
 company_id uuid not null references public.ywi_591_tenant_pilots(company_id) on delete restrict,
 user_id uuid not null references auth.users(id) on delete restrict,
 role text not null check(role in ('crew','dispatcher')),
 nominated_by uuid not null references auth.users(id) on delete restrict,
 reviewed_by uuid references auth.users(id) on delete restrict,
 state text not null default 'NOMINATED' check(state in ('NOMINATED','APPROVED','REVOKED')),
 created_at timestamptz not null default now(),
 approved_at timestamptz,
 primary key(company_id,user_id,role),
 check(nominated_by<>user_id),
 check((state='NOMINATED' and reviewed_by is null and approved_at is null)
  or (state='APPROVED' and reviewed_by is not null and reviewed_by<>user_id and approved_at is not null)
  or (state='REVOKED'))
);
create table public.ywi_591_photo_attempts (
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null,
 work_order_id uuid not null,
 request_id uuid not null,
 uploaded_by uuid not null references auth.users(id) on delete restrict,
 content_sha256 text not null check(content_sha256 ~ '^[0-9a-f]{64}$'),
 byte_count integer not null check(byte_count between 16 and 10485760),
 content_type text not null check(content_type in ('image/jpeg','image/png','image/webp')),
 object_key text not null unique,
 state text not null default 'RESERVED' check(state in ('RESERVED','VERIFIED','QUARANTINED')),
 reserved_at timestamptz not null default now(),
 lease_expires_at timestamptz not null,
 verified_at timestamptz,
 stored_sha256 text check(stored_sha256 ~ '^[0-9a-f]{64}$'),
 recovered_after_retry boolean not null default false,
 quarantine_code text,
 foreign key(company_id,work_order_id)
  references public.ywi_591_tenant_pilots(company_id,work_order_id) on delete restrict,
 unique(company_id,work_order_id),
 unique(company_id,request_id),
 check(lease_expires_at>reserved_at and lease_expires_at<=reserved_at+interval '24 hours'),
 check(object_key=company_id::text||'/'||work_order_id::text||'/'||request_id::text||
   case content_type when 'image/jpeg' then '.jpg' when 'image/png' then '.png' else '.webp' end),
 check((state='RESERVED' and verified_at is null and stored_sha256 is null and quarantine_code is null)
  or (state='VERIFIED' and verified_at is not null and stored_sha256=content_sha256 and quarantine_code is null)
  or (state='QUARANTINED' and verified_at is null and quarantine_code is not null))
);
create table public.ywi_591_transfer_events (
 id uuid primary key default gen_random_uuid(),
 attempt_id uuid not null references public.ywi_591_photo_attempts(id) on delete restrict,
 company_id uuid not null references public.ywi_companies(id) on delete restrict,
 event_code text not null check(event_code in
  ('RESERVED','SERVER_BYTES_VERIFIED','RECOVERED_STORED_OBJECT','QUARANTINED')),
 server_observed_sha256 text check(server_observed_sha256 ~ '^[0-9a-f]{64}$'),
 created_at timestamptz not null default now(),
 unique(attempt_id,event_code)
);
create index yw591_tenant_photo_event_ix on public.ywi_591_transfer_events(company_id,created_at desc);
alter table public.ywi_591_tenant_pilots enable row level security;
alter table public.ywi_591_pilot_staff enable row level security;
alter table public.ywi_591_photo_attempts enable row level security;
alter table public.ywi_591_transfer_events enable row level security;
revoke all on public.ywi_591_tenant_pilots,public.ywi_591_pilot_staff,
 public.ywi_591_photo_attempts,public.ywi_591_transfer_events from public,anon,authenticated;
grant select on public.ywi_591_tenant_pilots,public.ywi_591_pilot_staff,
 public.ywi_591_photo_attempts,public.ywi_591_transfer_events to authenticated;
create policy yw591_owner_pilot_read on public.ywi_591_tenant_pilots for select to authenticated
 using(owner_user_id=(select auth.uid()));
create policy yw591_owner_staff_read on public.ywi_591_pilot_staff for select to authenticated
 using(exists(select 1 from public.ywi_companies c
  where c.id=company_id and c.owner_user_id=(select auth.uid())));
create policy yw591_owner_attempt_read on public.ywi_591_photo_attempts for select to authenticated
 using(exists(select 1 from public.ywi_companies c
  where c.id=company_id and c.owner_user_id=(select auth.uid())));
create policy yw591_owner_event_read on public.ywi_591_transfer_events for select to authenticated
 using(exists(select 1 from public.ywi_companies c
  where c.id=company_id and c.owner_user_id=(select auth.uid())));
create or replace function public.ywi_591_source_role_assert()
returns void language plpgsql security invoker set search_path='' as $fn$
begin
 if coalesce(nullif(current_setting('request.jwt.claim.role',true),''),
  (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'role'))
  is distinct from 'service_role'
 then raise exception 'YW591 service-only original custody transition'; end if;
end; $fn$;
revoke all on function public.ywi_591_source_role_assert() from public,anon,authenticated;
grant execute on function public.ywi_591_source_role_assert() to service_role;
create or replace function public.ywi_591_forbid_change()
returns trigger language plpgsql security invoker set search_path='' as $fn$
begin raise exception 'YW591 immutable source event'; end; $fn$;
revoke all on function public.ywi_591_forbid_change() from public,anon,authenticated;
create trigger yw591_events_immutable before update or delete
 on public.ywi_591_transfer_events for each row
 execute function public.ywi_591_forbid_change();
create or replace function public.ywi_591_attempt_state_gate()
returns trigger language plpgsql security invoker set search_path='' as $fn$
begin
 if tg_op='DELETE' then raise exception 'YW591 no evidence deletion'; end if;
 if old.state<>'RESERVED'
  or new.state not in ('VERIFIED','QUARANTINED')
  or (to_jsonb(new)-'state'-'verified_at'-'stored_sha256'-'recovered_after_retry'-'quarantine_code')
    <>(to_jsonb(old)-'state'-'verified_at'-'stored_sha256'-'recovered_after_retry'-'quarantine_code')
 then raise exception 'YW591 one-way original attempt state'; end if;
 return new;
end; $fn$;
revoke all on function public.ywi_591_attempt_state_gate() from public,anon,authenticated;
create trigger yw591_attempt_one_way before update or delete
 on public.ywi_591_photo_attempts for each row
 execute function public.ywi_591_attempt_state_gate();

-- The server authenticates the real user against Auth and forwards only that
-- verified identity. SQL independently validates ownership, active profile,
-- original links, zero-charge original job and distinct reviewer.
create or replace function public.ywi_591_pilot_action(
 p_company_id uuid,p_actor_user_id uuid,p_action text,
 p_client_id uuid default null,p_site_id uuid default null,
 p_work_order_id uuid default null,p_reviewer_user_id uuid default null,
 p_staff_user_id uuid default null,p_staff_role text default null)
returns jsonb language plpgsql security definer set search_path='' as $fn$
declare
 c record; p record; s record; job record; n int;
begin
 perform public.ywi_591_source_role_assert();
 select * into c from public.ywi_companies where id=p_company_id for share;
 if not found then raise exception 'YW591 tenant unknown'; end if;
 if not exists(select 1 from public.profiles
  where id=p_actor_user_id and is_active=true)
 then raise exception 'YW591 active actor required'; end if;
 select * into p from public.ywi_591_tenant_pilots
  where company_id=p_company_id for update;
 if p_action='propose' then
  if p.company_id is not null or c.owner_user_id<>p_actor_user_id
   or p_actor_user_id=p_reviewer_user_id or p_reviewer_user_id is null
   or not exists(select 1 from public.profiles where id=p_reviewer_user_id and is_active=true)
  then raise exception 'YW591 owner and independent reviewer required'; end if;
  if not exists(select 1 from public.ywi_company_client_links_422
   where company_id=p_company_id and client_id=p_client_id)
   or not exists(select 1 from public.ywi_company_site_links_422
   where company_id=p_company_id and client_id=p_client_id and client_site_id=p_site_id)
  then raise exception 'YW591 client/site not linked to company'; end if;
  select * into job from public.work_orders where id=p_work_order_id
    and company_id=p_company_id and client_id=p_client_id and client_site_id=p_site_id
    and service_module_key='landscape' and status in ('draft','scheduled','in_progress','open')
    and subtotal=0 and tax_total=0 and total_amount=0
    and completion_ready_for_accounting=false;
  if not found then raise exception 'YW591 original scoped zero-charge job missing'; end if;
  if not exists(select 1 from public.ywi_company_service_modules
    where company_id=p_company_id and module_key='landscape' and enabled=true)
   or exists(select 1 from public.job_invoice_candidates where work_order_id=p_work_order_id)
   or exists(select 1 from public.ar_invoices where work_order_id=p_work_order_id)
  then raise exception 'YW591 service entitlement or finance isolation HOLD'; end if;
  insert into public.ywi_591_tenant_pilots(
    company_id,owner_user_id,reviewer_user_id,client_id,client_site_id,
    work_order_id,expires_at)
   values(p_company_id,p_actor_user_id,p_reviewer_user_id,p_client_id,
    p_site_id,p_work_order_id,now()+interval '7 days');
  return jsonb_build_object('state','PROPOSED','independent_review_required',true);
 end if;
 if p.company_id is null or p.owner_user_id<>c.owner_user_id
   or p.expires_at<=now() then raise exception 'YW591 original pilot missing/expired'; end if;
 if p_action='approve' then
  if p.state<>'PROPOSED' or p_actor_user_id<>p.reviewer_user_id
  then raise exception 'YW591 independent proposal review required'; end if;
  update public.ywi_591_tenant_pilots set state='APPROVED',approved_at=now()
   where company_id=p_company_id and state='PROPOSED';
  return jsonb_build_object('state','APPROVED','staff_enrollment_required',true);
 elsif p_action='revoke' then
  if p.state='REVOKED' or p_actor_user_id not in(p.owner_user_id,p.reviewer_user_id)
  then raise exception 'YW591 owner/reviewer revocation required'; end if;
  update public.ywi_591_tenant_pilots set state='REVOKED',revoked_at=now()
   where company_id=p_company_id and state<>'REVOKED';
  return jsonb_build_object('state','REVOKED','capture_allowed',false);
 elsif p_action='nominate-staff' then
  if p.state<>'APPROVED' or p_actor_user_id<>p.owner_user_id
   or p_staff_role not in('crew','dispatcher')
   or p_staff_user_id in (p.reviewer_user_id,p.owner_user_id)
   or not exists(select 1 from public.profiles where id=p_staff_user_id and is_active=true)
  then raise exception 'YW591 owner staff nomination HOLD'; end if;
  insert into public.ywi_591_pilot_staff(company_id,user_id,role,nominated_by)
   values(p_company_id,p_staff_user_id,p_staff_role,p_actor_user_id);
  return jsonb_build_object('state','STAFF_NOMINATED','independent_review_required',true);
 elsif p_action='approve-staff' then
  select * into s from public.ywi_591_pilot_staff
   where company_id=p_company_id and user_id=p_staff_user_id
    and role=p_staff_role for update;
  if not found or p.state<>'APPROVED'
   or p_actor_user_id<>p.reviewer_user_id
   or s.state is distinct from 'NOMINATED'
   or s.user_id=p_actor_user_id or s.nominated_by=p_actor_user_id
   or exists(select 1 from public.ywi_591_pilot_staff other
     where other.company_id=p_company_id and other.user_id=p_staff_user_id
      and other.role<>p_staff_role and other.state in('NOMINATED','APPROVED'))
  then raise exception 'YW591 separate staff approval HOLD'; end if;
  update public.ywi_591_pilot_staff set state='APPROVED',
    reviewed_by=p_actor_user_id,approved_at=now()
   where company_id=p_company_id and user_id=p_staff_user_id
    and role=p_staff_role and state='NOMINATED';
  return jsonb_build_object('state','STAFF_APPROVED');
 elsif p_action='revoke-staff' then
  select * into s from public.ywi_591_pilot_staff where
    company_id=p_company_id and user_id=p_staff_user_id
    and role=p_staff_role for update;
  if not found or p_actor_user_id not in(p.owner_user_id,p.reviewer_user_id)
   or s.state is null or s.state not in('NOMINATED','APPROVED')
  then raise exception 'YW591 staff revocation HOLD'; end if;
  update public.ywi_591_pilot_staff set state='REVOKED'
   where company_id=p_company_id and user_id=p_staff_user_id
    and role=p_staff_role;
  return jsonb_build_object('state','STAFF_REVOKED','capture_allowed',false);
 end if;
 raise exception 'YW591 unknown owner action';
end; $fn$;
revoke all on function public.ywi_591_pilot_action(
 uuid,uuid,text,uuid,uuid,uuid,uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.ywi_591_pilot_action(
 uuid,uuid,text,uuid,uuid,uuid,uuid,uuid,text) to service_role;

-- Atomic unique work-order reservation precedes any private Storage upload.
-- A failed ledger commit therefore leaves a recoverable reservation, not an
-- untracked object. A different request, actor, tenant or hash never replaces it.
create or replace function public.ywi_591_reserve_attempt(
 p_company_id uuid,p_work_order_id uuid,p_actor_user_id uuid,
 p_request_id uuid,p_content_sha256 text,p_byte_count integer,p_content_type text,
 p_object_key text)
returns jsonb language plpgsql security definer set search_path='' as $fn$
declare p record; w record; a record; expected_key text;
begin
 perform public.ywi_591_source_role_assert();
 select * into p from public.ywi_591_tenant_pilots where company_id=p_company_id
  and work_order_id=p_work_order_id and state='APPROVED'
  and approved_at<=now() and expires_at>now() for share;
 if not found then raise exception 'YW591 approved tenant pilot missing'; end if;
 if not exists(select 1 from public.ywi_companies
   where id=p_company_id and owner_user_id=p.owner_user_id)
  or not exists(select 1 from public.profiles
   where id=p_actor_user_id and is_active=true)
  or not exists(select 1 from public.ywi_591_pilot_staff
   where company_id=p_company_id and user_id=p_actor_user_id
    and role='crew' and state='APPROVED')
 then raise exception 'YW591 tenant crew authorization HOLD'; end if;
 select * into w from public.work_orders where id=p_work_order_id
  and company_id=p_company_id and client_id=p.client_id
  and client_site_id=p.client_site_id and service_module_key='landscape'
  and status in ('draft','scheduled','in_progress','open')
  and subtotal=0 and tax_total=0 and total_amount=0
  and completion_ready_for_accounting=false for share;
 if not found or not exists(select 1 from public.ywi_company_service_modules
    where company_id=p_company_id and module_key='landscape' and enabled=true)
  or exists(select 1 from public.job_invoice_candidates where work_order_id=p_work_order_id)
  or exists(select 1 from public.ar_invoices where work_order_id=p_work_order_id)
 then raise exception 'YW591 zero-charge original work order finance HOLD'; end if;
 expected_key:=p_company_id::text||'/'||p_work_order_id::text||'/'||
  p_request_id::text||(
   case when p_content_type='image/jpeg' then '.jpg'
        when p_content_type='image/png' then '.png' else '.webp' end
  );
 if p_content_sha256 !~ '^[0-9a-f]{64}$'
  or p_byte_count not between 16 and 10485760
  or p_content_type not in('image/jpeg','image/png','image/webp')
  or p_object_key is distinct from expected_key
 then raise exception 'YW591 original file hash/size/path HOLD'; end if;
 insert into public.ywi_591_photo_attempts(
  company_id,work_order_id,request_id,uploaded_by,
  content_sha256,byte_count,content_type,object_key,lease_expires_at)
 values(p_company_id,p_work_order_id,p_request_id,p_actor_user_id,
  p_content_sha256,p_byte_count,p_content_type,p_object_key,now()+interval '24 hours')
 on conflict(company_id,work_order_id) do nothing;
 select * into a from public.ywi_591_photo_attempts where
  company_id=p_company_id and work_order_id=p_work_order_id for update;
 if not found or a.request_id<>p_request_id or a.uploaded_by<>p_actor_user_id
  or a.content_sha256<>p_content_sha256 or a.byte_count<>p_byte_count
  or a.content_type<>p_content_type or a.object_key<>p_object_key
  or a.state='QUARANTINED' or
  (a.state='RESERVED' and a.lease_expires_at<=now())
 then raise exception 'YW591 idempotent request or lease mismatch'; end if;
 if a.state='RESERVED' then
  insert into public.ywi_591_transfer_events(attempt_id,company_id,event_code)
  values(a.id,p_company_id,'RESERVED') on conflict do nothing;
 end if;
 return jsonb_build_object('state',a.state,'attemptId',a.id,
  'leaseExpiresAt',a.lease_expires_at,'verified',a.state='VERIFIED');
end; $fn$;
revoke all on function public.ywi_591_reserve_attempt(
 uuid,uuid,uuid,uuid,text,integer,text,text) from public,anon,authenticated;
grant execute on function public.ywi_591_reserve_attempt(
 uuid,uuid,uuid,uuid,text,integer,text,text) to service_role;

create or replace function public.ywi_591_finalize_attempt(
 p_company_id uuid,p_work_order_id uuid,p_attempt_id uuid,
 p_actor_user_id uuid,p_server_sha256 text,p_recovered boolean)
returns jsonb language plpgsql security definer set search_path='' as $fn$
declare a record; p record;
begin
 perform public.ywi_591_source_role_assert();
 select * into p from public.ywi_591_tenant_pilots
 where company_id=p_company_id and work_order_id=p_work_order_id
  and state='APPROVED' and approved_at<=now() and expires_at>now() for share;
 if not found then raise exception 'YW591 pilot revoked or expired'; end if;
 if not exists(select 1 from public.profiles where id=p_actor_user_id and is_active=true)
  or not exists(select 1 from public.ywi_591_pilot_staff
   where company_id=p_company_id and user_id=p_actor_user_id
    and role='crew' and state='APPROVED')
 then raise exception 'YW591 original approved crew required'; end if;
 select * into a from public.ywi_591_photo_attempts
  where id=p_attempt_id and company_id=p_company_id
   and work_order_id=p_work_order_id for update;
 if not found or a.uploaded_by<>p_actor_user_id or
  a.content_sha256<>p_server_sha256 then
  raise exception 'YW591 private hash and original attempt mismatch'; end if;
 if a.state='VERIFIED' then
  return jsonb_build_object('state','VERIFIED','idempotent',true,'attemptId',a.id); end if;
 if a.state<>'RESERVED' or a.lease_expires_at<=now()
 then raise exception 'YW591 reservation expired or quarantined'; end if;
 if not exists(select 1 from public.work_orders where id=p_work_order_id
    and company_id=p_company_id and client_id=p.client_id
    and client_site_id=p.client_site_id and service_module_key='landscape'
    and total_amount=0 and subtotal=0 and tax_total=0
    and completion_ready_for_accounting=false)
  or exists(select 1 from public.job_invoice_candidates where work_order_id=p_work_order_id)
  or exists(select 1 from public.ar_invoices where work_order_id=p_work_order_id)
 then raise exception 'YW591 finance isolation changed before verified receipt'; end if;
 update public.ywi_591_photo_attempts set state='VERIFIED',
  verified_at=now(),stored_sha256=p_server_sha256,
  recovered_after_retry=p_recovered where id=a.id and state='RESERVED';
 insert into public.ywi_591_transfer_events(
   attempt_id,company_id,event_code,server_observed_sha256)
 values(a.id,p_company_id,
  case when p_recovered then 'RECOVERED_STORED_OBJECT' else 'SERVER_BYTES_VERIFIED' end,
  p_server_sha256);
 return jsonb_build_object('state','VERIFIED','attemptId',a.id,
  'recoveredAfterRetry',p_recovered,'serverHashVerified',true);
end; $fn$;
revoke all on function public.ywi_591_finalize_attempt(
 uuid,uuid,uuid,uuid,text,boolean) from public,anon,authenticated;
grant execute on function public.ywi_591_finalize_attempt(
 uuid,uuid,uuid,uuid,text,boolean) to service_role;

-- Quarantine is an explicitly separate signed REVIEWER action. It preserves
-- the private object and immutable mismatch audit for supervised disposition;
-- no delete, overwrite or automatic reassignment to another company.
create or replace function public.ywi_591_quarantine_attempt(
 p_company_id uuid,p_work_order_id uuid,p_attempt_id uuid,
 p_reviewer_user_id uuid,p_observed_sha256 text)
returns jsonb language plpgsql security definer set search_path='' as $fn$
declare p record; a record;
begin
 perform public.ywi_591_source_role_assert();
 select * into p from public.ywi_591_tenant_pilots
  where company_id=p_company_id and work_order_id=p_work_order_id
  and reviewer_user_id=p_reviewer_user_id and state='APPROVED'
  and expires_at>now() for share;
 if not found or p.reviewer_user_id=p.owner_user_id
  or not exists(select 1 from public.profiles where id=p_reviewer_user_id and is_active=true)
 then raise exception 'YW591 independent quarantine reviewer HOLD'; end if;
 select * into a from public.ywi_591_photo_attempts
  where id=p_attempt_id and company_id=p_company_id
  and work_order_id=p_work_order_id for update;
 if not found or a.state<>'RESERVED'
  or p_observed_sha256 !~ '^[0-9a-f]{64}
  or p_observed_sha256=a.content_sha256
 then raise exception 'YW591 signed mismatch quarantine requires different observed digest'; end if;
 update public.ywi_591_photo_attempts set state='QUARANTINED',
  quarantine_code='INDEPENDENT_REVIEWER_SIGNED_BYTE_HASH_MISMATCH'
  where id=a.id and state='RESERVED';
 insert into public.ywi_591_transfer_events(
  attempt_id,company_id,event_code,server_observed_sha256)
 values(a.id,p_company_id,'QUARANTINED',p_observed_sha256);
 return jsonb_build_object('state','QUARANTINED',
  'humanReviewRecorded',true,'objectDeleted',false);
end; $fn$;
revoke all on function public.ywi_591_quarantine_attempt(
 uuid,uuid,uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.ywi_591_quarantine_attempt(
 uuid,uuid,uuid,uuid,text) to service_role;

commit;
