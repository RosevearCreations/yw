-- YW590: separately witnessed real-device claim, original server hash and
-- technical Shell case. Records are EMPTY until real authenticated actors use
-- the YW590 server API. No implicit customer, subscription or payment changes.
begin;
create table public.ywi_590_crew_challenges (
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null references public.ywi_companies(id) on delete restrict,
 work_order_id uuid not null references public.work_orders(id) on delete restrict,
 photo_id uuid not null references public.ywi_589_photo_receipts(id) on delete restrict,
 crew_user_id uuid not null references auth.users(id) on delete restrict,
 challenge_sha256 text not null check(challenge_sha256 ~ '^[0-9a-f]{64}$'),
 issued_at timestamptz not null default now(),
 expires_at timestamptz not null,
 check(expires_at>issued_at and expires_at<=issued_at+interval '10 minutes'),
 unique(photo_id,challenge_sha256)
);
create index yw590_challenges_scoped on public.ywi_590_crew_challenges(company_id,work_order_id,issued_at desc);
create table public.ywi_590_original_field_witnesses (
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null references public.ywi_companies(id) on delete restrict,
 work_order_id uuid not null references public.work_orders(id) on delete restrict,
 photo_id uuid not null unique references public.ywi_589_photo_receipts(id) on delete restrict,
 dispatcher_cert_id uuid not null unique references public.ywi_589_dispatcher_certifications(id) on delete restrict,
 challenge_id uuid not null unique references public.ywi_590_crew_challenges(id) on delete restrict,
 crew_user_id uuid not null references auth.users(id) on delete restrict,
 dispatcher_user_id uuid not null references auth.users(id) on delete restrict,
 witness_user_id uuid not null references auth.users(id) on delete restrict,
 observed_sha256 text not null check(observed_sha256 ~ '^[0-9a-f]{64}$'),
 server_read_hash_match boolean not null check(server_read_hash_match=true),
 saw_original_crew_device boolean not null check(saw_original_crew_device=true),
 examined_private_photo boolean not null check(examined_private_photo=true),
 physical_attestation_is_human_claim boolean not null default true
   check(physical_attestation_is_human_claim=true),
 created_at timestamptz not null default now(),
 check(crew_user_id<>dispatcher_user_id and crew_user_id<>witness_user_id
   and dispatcher_user_id<>witness_user_id)
);
create table public.ywi_590_shell_case_closures (
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null references public.ywi_companies(id) on delete restrict,
 work_order_id uuid not null references public.work_orders(id) on delete restrict,
 photo_id uuid not null unique references public.ywi_589_photo_receipts(id) on delete restrict,
 witness_id uuid not null unique references public.ywi_590_original_field_witnesses(id) on delete restrict,
 state text not null default 'AWAITING_INDEPENDENT_SYSOP'
   check(state in ('AWAITING_INDEPENDENT_SYSOP','ORIGINAL_CASE_CLOSED')),
 closed_by_sysop uuid references auth.users(id) on delete restrict,
 closed_at timestamptz,
 original_photo_sha256 text not null check(original_photo_sha256 ~ '^[0-9a-f]{64}$'),
 verified_server_download boolean not null check(verified_server_download=true),
 owner_job_count integer not null default 1 check(owner_job_count=1),
 service_charge_total numeric(12,2) not null default 0 check(service_charge_total=0),
 candidate_invoice_count integer not null default 0 check(candidate_invoice_count=0),
 ar_invoice_count integer not null default 0 check(ar_invoice_count=0),
 customer_notified boolean not null default false check(customer_notified=false),
 shell_customer_data_included boolean not null default false check(shell_customer_data_included=false),
 shell_photo_bytes_included boolean not null default false check(shell_photo_bytes_included=false),
 shell_finance_data_included boolean not null default false check(shell_finance_data_included=false),
 master_durable_ack_confirmed boolean not null default false check(master_durable_ack_confirmed=false),
 created_at timestamptz not null default now(),
 constraint yw590_closed_bound check(
  (state='AWAITING_INDEPENDENT_SYSOP' and closed_at is null and closed_by_sysop is null)
  or(state='ORIGINAL_CASE_CLOSED' and closed_at is not null and closed_by_sysop is not null))
);
create index yw590_case_by_tenant on public.ywi_590_shell_case_closures(company_id,state,created_at desc);
alter table public.ywi_590_crew_challenges enable row level security;
alter table public.ywi_590_original_field_witnesses enable row level security;
alter table public.ywi_590_shell_case_closures enable row level security;
revoke all on public.ywi_590_crew_challenges,
 public.ywi_590_original_field_witnesses,
 public.ywi_590_shell_case_closures from public,anon,authenticated;
grant select on public.ywi_590_original_field_witnesses,
 public.ywi_590_shell_case_closures to authenticated;
-- Tenant-owner-only read metadata. Crew, witness, and platform Shell use
-- independently authorized service endpoints; no public direct storage read.
create policy yw590_original_owner_witness_review on public.ywi_590_original_field_witnesses
 for select to authenticated using(exists(select 1 from public.ywi_companies c
 where c.id=company_id and c.owner_user_id=(select auth.uid())));
create policy yw590_original_owner_case_review on public.ywi_590_shell_case_closures
 for select to authenticated using(exists(select 1 from public.ywi_companies c
 where c.id=company_id and c.owner_user_id=(select auth.uid())));
create or replace function public.ywi_590_forbid_immutable_changes()
returns trigger language plpgsql security invoker set search_path='' as $$
begin raise exception 'YW590 immutable original-device witness/custody evidence'; end $$;
revoke all on function public.ywi_590_forbid_immutable_changes() from public,anon,authenticated;
create trigger yw590_challenge_immutable before update or delete
 on public.ywi_590_crew_challenges for each row
 execute function public.ywi_590_forbid_immutable_changes();
create trigger yw590_witness_immutable before update or delete
 on public.ywi_590_original_field_witnesses for each row
 execute function public.ywi_590_forbid_immutable_changes();
-- The technical case is single-transition append-certified: never mutate the
-- source receipt, grant, witness, job, invoice or tenant financial records.
create or replace function public.ywi_590_case_transition_guard()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if tg_op='DELETE' then
  raise exception 'YW590 technical case deletion prohibited';
 end if;
 if old.state<>'AWAITING_INDEPENDENT_SYSOP'
 or new.state<>'ORIGINAL_CASE_CLOSED'
 or new.closed_by_sysop is null or new.closed_at is null
 or (to_jsonb(new)-'state'-'closed_by_sysop'-'closed_at')
   <> (to_jsonb(old)-'state'-'closed_by_sysop'-'closed_at') then
  raise exception 'YW590 case may only close once with original records immutable';
 end if;
 return new;
end $$;
revoke all on function public.ywi_590_case_transition_guard() from public,anon,authenticated;
create trigger yw590_case_single_close before update or delete
 on public.ywi_590_shell_case_closures for each row
 execute function public.ywi_590_case_transition_guard();
-- Invoked by the authenticated, independently verified YW590 service-role
-- Edge handler. The atomic RPC is NOT accessible to anon/authenticated.
create or replace function public.ywi_590_record_original_witness(
 p_company_id uuid,p_work_order_id uuid,p_photo_id uuid,
 p_challenge_id uuid,p_witness_user_id uuid,p_observed_sha256 text)
returns jsonb language plpgsql security definer set search_path='' as $fn$
declare
 g record; p record; d record; ch record; w_id uuid; c_id uuid;
begin
 if current_setting('request.jwt.claim.role',true) is distinct from 'service_role'
 then raise exception 'YW590 service-role-only custody procedure'; end if;
 if p_company_id<>'03bcf48e-a4f5-4427-9aba-b0f91f39b16b'::uuid
 then raise exception 'YW590 original tenant scope'; end if;
 select * into g from public.ywi_589_pilot_authorizations
  where company_id=p_company_id and approved=true and approved_at<=now()
   and expires_at>now() for share;
 if not found or p_witness_user_id<>g.independent_reviewer_id
  or p_witness_user_id=g.owner_user_id
 then raise exception 'YW590 independent pilot witness/owner gate'; end if;
 if not exists(select 1 from public.profiles
    where id=p_witness_user_id and is_active=true)
 then raise exception 'YW590 witness profile disabled'; end if;
 if (select count(*) from public.work_orders
  where company_id=p_company_id and client_id=g.client_id
   and client_site_id=g.client_site_id)<>1
 then raise exception 'YW590 original job uniqueness failed'; end if;
 if not exists(select 1 from public.work_orders
    where id=p_work_order_id and company_id=p_company_id
     and client_id=g.client_id and client_site_id=g.client_site_id
     and service_module_key='landscape' and subtotal=0 and tax_total=0
     and total_amount=0 and completion_ready_for_accounting=false)
 then raise exception 'YW590 zero-charge original work order failed'; end if;
 if exists(select 1 from public.job_invoice_candidates where work_order_id=p_work_order_id)
  or exists(select 1 from public.ar_invoices where work_order_id=p_work_order_id)
 then raise exception 'YW590 finance isolation failed'; end if;
 select * into p from public.ywi_589_photo_receipts
  where id=p_photo_id and company_id=p_company_id
   and work_order_id=p_work_order_id and observed_sha256=p_observed_sha256
   and server_download_hash_match=true for share;
 if not found then raise exception 'YW590 source photo/hash failed'; end if;
 select * into d from public.ywi_589_dispatcher_certifications
  where photo_id=p.id and company_id=p_company_id
   and work_order_id=p_work_order_id
   and source_photo_sha256=p_observed_sha256 for share;
 if not found or d.dispatcher_user_id=p.uploaded_by
    or d.dispatcher_user_id=p_witness_user_id
    or p.uploaded_by=p_witness_user_id
 then raise exception 'YW590 separate dispatcher/crew/witness failed'; end if;
 select * into ch from public.ywi_590_crew_challenges
  where id=p_challenge_id and company_id=p_company_id
   and work_order_id=p_work_order_id and photo_id=p.id
   and crew_user_id=p.uploaded_by and expires_at>now() for share;
 if not found then raise exception 'YW590 original crew device challenge expired'; end if;
 insert into public.ywi_590_original_field_witnesses(
  company_id,work_order_id,photo_id,dispatcher_cert_id,challenge_id,
  crew_user_id,dispatcher_user_id,witness_user_id,observed_sha256,
  server_read_hash_match,saw_original_crew_device,examined_private_photo)
 values(p_company_id,p_work_order_id,p.id,d.id,ch.id,p.uploaded_by,
  d.dispatcher_user_id,p_witness_user_id,p_observed_sha256,true,true,true)
 returning id into w_id;
 insert into public.ywi_590_shell_case_closures(
  company_id,work_order_id,photo_id,witness_id,original_photo_sha256,
  verified_server_download,owner_job_count,service_charge_total)
 values(p_company_id,p_work_order_id,p.id,w_id,p_observed_sha256,
  true,1,0)
 returning id into c_id;
 return jsonb_build_object('state','AWAITING_INDEPENDENT_SYSOP',
  'human_claim_registered',true,'case_received',c_id is not null);
end $fn$;
revoke all on function public.ywi_590_record_original_witness(
 uuid,uuid,uuid,uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.ywi_590_record_original_witness(
 uuid,uuid,uuid,uuid,uuid,text) to service_role;

-- One-way closure with trusted server-read SHA checked by the Edge function
-- *and* cross-checked against the immutable original Postgres photo ledger.
create or replace function public.ywi_590_close_original_technical_case(
 p_company_id uuid,p_work_order_id uuid,p_photo_id uuid,
 p_sysop_user_id uuid,p_sha256 text)
returns jsonb language plpgsql security definer set search_path='' as $fn$
declare
 g record; p record; d record; w record; c record;
begin
 if current_setting('request.jwt.claim.role',true) is distinct from 'service_role'
 then raise exception 'YW590 service role required'; end if;
 if p_company_id<>'03bcf48e-a4f5-4427-9aba-b0f91f39b16b'::uuid
 then raise exception 'YW590 wrong tenant'; end if;
 if not exists(select 1 from public.ywi_platform_administrators_489 a
   join public.profiles pr on pr.id=a.user_id
   where a.user_id=p_sysop_user_id and pr.role='admin' and pr.is_active=true)
 then raise exception 'YW590 real platform Sysop required'; end if;
 select * into g from public.ywi_589_pilot_authorizations
   where company_id=p_company_id and approved=true
    and approved_at<=now() and expires_at>now() for share;
 if not found then raise exception 'YW590 original pilot expired'; end if;
 select * into p from public.ywi_589_photo_receipts
  where id=p_photo_id and company_id=p_company_id
   and work_order_id=p_work_order_id
   and observed_sha256=p_sha256 and server_download_hash_match=true for share;
 if not found then raise exception 'YW590 original source receipt failed'; end if;
 select * into d from public.ywi_589_dispatcher_certifications
  where photo_id=p.id and company_id=p_company_id
   and work_order_id=p_work_order_id and source_photo_sha256=p_sha256 for share;
 if not found then raise exception 'YW590 dispatcher receipt missing'; end if;
 select * into w from public.ywi_590_original_field_witnesses
  where photo_id=p.id and company_id=p_company_id
   and work_order_id=p_work_order_id and witness_user_id=g.independent_reviewer_id
   and observed_sha256=p_sha256 and server_read_hash_match=true for share;
 if not found then raise exception 'YW590 original reviewer witness missing'; end if;
 if p_sysop_user_id=p.uploaded_by or p_sysop_user_id=d.dispatcher_user_id
  or p_sysop_user_id=w.witness_user_id
 then raise exception 'YW590 separate technical closer required'; end if;
 if (select count(*) from public.work_orders
  where company_id=p_company_id and client_id=g.client_id
   and client_site_id=g.client_site_id)<>1
 then raise exception 'YW590 original job count changed'; end if;
 if not exists(select 1 from public.work_orders
    where id=p_work_order_id and company_id=p_company_id
     and client_id=g.client_id and client_site_id=g.client_site_id
     and service_module_key='landscape'
     and subtotal=0 and tax_total=0 and total_amount=0
     and completion_ready_for_accounting=false)
 then raise exception 'YW590 real job finance or readiness changed'; end if;
 if exists(select 1 from public.job_invoice_candidates where work_order_id=p_work_order_id)
  or exists(select 1 from public.ar_invoices where work_order_id=p_work_order_id)
 then raise exception 'YW590 candidate or A/R invoice exists'; end if;
 select * into c from public.ywi_590_shell_case_closures
  where company_id=p_company_id and work_order_id=p_work_order_id
   and photo_id=p_photo_id and witness_id=w.id for update;
 if not found then raise exception 'YW590 technical case missing'; end if;
 if c.state='ORIGINAL_CASE_CLOSED' then
   if c.closed_by_sysop<>p_sysop_user_id
   then raise exception 'YW590 case already closed by another operator'; end if;
   return jsonb_build_object('state','ORIGINAL_CASE_CLOSED',
      'already_closed',true);
 end if;
 update public.ywi_590_shell_case_closures
  set state='ORIGINAL_CASE_CLOSED',
   closed_by_sysop=p_sysop_user_id,closed_at=now()
 where id=c.id and state='AWAITING_INDEPENDENT_SYSOP';
 if not found then raise exception 'YW590 atomic one-way closure failed'; end if;
 return jsonb_build_object('state','ORIGINAL_CASE_CLOSED',
   'finance_zero_as_of_closure',true,'redacted_shell_only',true);
end $fn$;
revoke all on function public.ywi_590_close_original_technical_case(
 uuid,uuid,uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.ywi_590_close_original_technical_case(
 uuid,uuid,uuid,uuid,text) to service_role;

commit;
