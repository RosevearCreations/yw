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
commit;
