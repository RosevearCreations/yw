-- YW589 original-device private-photo facility. Controlled deployment migration.
-- Source control and audit required before live execution. Existing company modules,
-- original jobs, invoice/accounting/customer tables and Auth users are NOT changed.
-- No tenant opt-in rows or staff roles are enabled by this migration.
begin;
create table if not exists public.ywi_589_pilot_authorizations (
 company_id uuid primary key references public.ywi_companies(id) on delete restrict,
 client_id uuid not null, client_site_id uuid not null,
 owner_user_id uuid not null references auth.users(id) on delete restrict,
 independent_reviewer_id uuid not null references auth.users(id) on delete restrict,
 approved boolean not null default false,
 approved_at timestamptz,
 expires_at timestamptz,
 created_at timestamptz not null default now(),
 foreign key(company_id,client_id) references public.ywi_company_client_links_422(company_id,client_id) on delete restrict,
 foreign key(company_id,client_id,client_site_id)
  references public.ywi_company_site_links_422(company_id,client_id,client_site_id) on delete restrict,
 constraint yw589_pilot_company check(company_id='03bcf48e-a4f5-4427-9aba-b0f91f39b16b'::uuid
  and client_id='58700000-0000-4587-8587-000000000001'::uuid
  and client_site_id='58700000-0000-4587-8587-000000000002'::uuid),
 constraint yw589_independent_approval check(owner_user_id<>independent_reviewer_id),
 constraint yw589_approval_bound check(
  (not approved) or (approved_at is not null and expires_at>approved_at
   and expires_at<=approved_at+interval '7 days'))
);
create table if not exists public.ywi_589_pilot_staff (
 company_id uuid not null references public.ywi_companies(id) on delete restrict,
 user_id uuid not null references auth.users(id) on delete restrict,
 role text not null check(role in ('crew','dispatcher')),
 enabled boolean not null default false,
 independently_reviewed_by uuid not null references auth.users(id) on delete restrict,
 expires_at timestamptz not null,
 created_at timestamptz not null default now(),
 primary key(company_id,user_id,role),
 foreign key(company_id) references public.ywi_589_pilot_authorizations(company_id) on delete restrict,
 constraint yw589_reviewer_not_actor check(independently_reviewed_by<>user_id)
);
create table if not exists public.ywi_589_photo_receipts (
 id uuid primary key,
 company_id uuid not null,
 client_id uuid not null,
 client_site_id uuid not null,
 work_order_id uuid not null references public.work_orders(id) on delete restrict,
 request_id uuid not null,
 uploaded_by uuid not null references auth.users(id) on delete restrict,
 stored_bucket text not null default 'ywi-private-device-evidence-589'
   check(stored_bucket='ywi-private-device-evidence-589'),
 object_key text not null unique,
 content_type text not null check(content_type in ('image/jpeg','image/png','image/webp')),
 observed_sha256 text not null check(observed_sha256 ~ '^[0-9a-f]{64}$'),
 byte_count integer not null check(byte_count between 16 and 10485760),
 server_download_hash_match boolean not null check(server_download_hash_match=true),
 consent_scope text not null check(consent_scope='original_job_documentation'),
 device_client_hash_sha256 text not null check(device_client_hash_sha256 ~ '^[0-9a-f]{64}$'),
 verified_at timestamptz not null default now(),
 created_at timestamptz not null default now(),
 foreign key(company_id,client_id) references public.ywi_company_client_links_422(company_id,client_id) on delete restrict,
 foreign key(company_id,client_id,client_site_id) references public.ywi_company_site_links_422(company_id,client_id,client_site_id) on delete restrict,
 unique(company_id,request_id),
 unique(company_id,work_order_id),
 constraint yw589_path_contract check(
  object_key=company_id::text||'/'||work_order_id::text||'/'||request_id::text||
    case content_type when 'image/jpeg' then '.jpg' when 'image/png' then '.png' else '.webp' end),
 constraint yw589_hash_coherence check(device_client_hash_sha256=observed_sha256)
);
create index if not exists yw589_photo_by_company on public.ywi_589_photo_receipts(company_id,created_at desc);
create table if not exists public.ywi_589_dispatcher_certifications (
 id uuid primary key default gen_random_uuid(),
 photo_id uuid not null unique references public.ywi_589_photo_receipts(id) on delete restrict,
 company_id uuid not null references public.ywi_companies(id) on delete restrict,
 work_order_id uuid not null references public.work_orders(id) on delete restrict,
 dispatcher_user_id uuid not null references auth.users(id) on delete restrict,
 source_photo_sha256 text not null check(source_photo_sha256 ~ '^[0-9a-f]{64}$'),
 original_job_count integer not null check(original_job_count=1),
 original_photo_count integer not null check(original_photo_count=1),
 invoice_count_before integer not null check(invoice_count_before=0),
 invoice_count_after integer not null check(invoice_count_after=invoice_count_before),
 dispatcher_reviewed_private_photo boolean not null check(dispatcher_reviewed_private_photo=true),
 device_attestation_recorded boolean not null check(device_attestation_recorded=true),
 witness_state text not null default 'ORIGINAL_DISPATCHER_CONFIRMATION_INDEPENDENT_WITNESS_PENDING'
  check(witness_state='ORIGINAL_DISPATCHER_CONFIRMATION_INDEPENDENT_WITNESS_PENDING'),
 confirmed_at timestamptz not null default now(),
 unique(company_id,work_order_id,photo_id)
);
-- Client/browser roles only see their own limited metadata. Edge service role
-- performs all writes AFTER independently checking original ACL/linkage.
alter table public.ywi_589_pilot_authorizations enable row level security;
alter table public.ywi_589_pilot_staff enable row level security;
alter table public.ywi_589_photo_receipts enable row level security;
alter table public.ywi_589_dispatcher_certifications enable row level security;
revoke all on public.ywi_589_pilot_authorizations,public.ywi_589_pilot_staff,
 public.ywi_589_photo_receipts,public.ywi_589_dispatcher_certifications from public,anon,authenticated;
grant select on public.ywi_589_pilot_authorizations,public.ywi_589_pilot_staff,
 public.ywi_589_photo_receipts,public.ywi_589_dispatcher_certifications to authenticated;
create policy yw589_authorization_owner on public.ywi_589_pilot_authorizations
 for select to authenticated using(exists(select 1 from public.ywi_companies c
  where c.id=company_id and c.owner_user_id=(select auth.uid())));
create policy yw589_staff_owner on public.ywi_589_pilot_staff
 for select to authenticated using(exists(select 1 from public.ywi_companies c
  where c.id=company_id and c.owner_user_id=(select auth.uid())));
create policy yw589_photo_owner_or_uploader on public.ywi_589_photo_receipts
 for select to authenticated using(uploaded_by=(select auth.uid()) or exists(
 select 1 from public.ywi_companies c
 where c.id=company_id and c.owner_user_id=(select auth.uid())));
create policy yw589_cert_owner on public.ywi_589_dispatcher_certifications
 for select to authenticated using(exists(select 1 from public.ywi_companies c
  where c.id=company_id and c.owner_user_id=(select auth.uid())));
-- Only INSERT allowed through server-side service role. No authenticated write.
-- Immutable proof after insert; a rejected photo requires independent
-- reconciliation, NOT replacing the original object's evidence silently.
create or replace function public.ywi_589_reject_receipt_mutation()
returns trigger language plpgsql security invoker set search_path='' as $$
begin raise exception 'YW589 immutable custody evidence: append reviewed follow-up only'; end $$;
revoke all on function public.ywi_589_reject_receipt_mutation() from public,anon,authenticated;
create trigger yw589_no_photo_mutation before update or delete
 on public.ywi_589_photo_receipts for each row
 execute function public.ywi_589_reject_receipt_mutation();
create trigger yw589_no_cert_mutation before update or delete
 on public.ywi_589_dispatcher_certifications for each row
 execute function public.ywi_589_reject_receipt_mutation();
-- Supabase Storage is entirely private; all object operations use a strictly
-- authenticated, owner/reviewer-enrolled Edge function. No anon/authenticated
-- storage.objects SELECT/INSERT/UPDATE/DELETE policy for this new bucket.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('ywi-private-device-evidence-589','ywi-private-device-evidence-589',
  false,10485760,array['image/jpeg','image/png','image/webp'])
 on conflict(id) do nothing;
do $$
begin
 if not exists(select 1 from storage.buckets b where b.id='ywi-private-device-evidence-589'
   and b.public=false and b.file_size_limit<=10485760
   and b.allowed_mime_types<@array['image/jpeg','image/png','image/webp'])
 then raise exception 'YW589 private bucket misconfigured or widened'; end if;
end $$;
commit;
