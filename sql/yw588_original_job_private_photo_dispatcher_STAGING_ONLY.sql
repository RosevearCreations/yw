-- YW588: ORIGINAL REAL-JOB / PRIVATE PHOTO / DISPATCHER CASE staging candidate.
-- INDEPENDENT STAGING ONLY. NOT applied to production. Do not enable billing,
-- service entitlements, photo storage or customer contact with this file.
-- Requires YW422 original CRM links, YW581 private photo, YW582 bytes-read
-- receipts and YW587 original support incidents already independently enrolled.
-- Independently sign/verify real device and storage receipts BEFORE DBA inserts.
begin;
create table if not exists public.ywi_588_original_pilot_cases (
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null references public.ywi_companies(id) on delete restrict,
 client_id uuid not null,
 client_site_id uuid not null,
 work_order_id uuid not null references public.work_orders(id) on delete restrict,
 photo_id uuid not null references public.ywi_581_job_photo_evidence(id) on delete restrict,
 integrity_receipt_id uuid not null references public.ywi_582_photo_integrity_receipts(id) on delete restrict,
 original_support_case_id uuid not null references public.ywi_587_photo_support_cases(id) on delete restrict,
 private_bucket_id text not null default 'ywi-private-job-photos-581'
   check(private_bucket_id='ywi-private-job-photos-581'),
 owner_witness uuid not null references auth.users(id) on delete restrict,
 independent_reviewer uuid not null references auth.users(id) on delete restrict,
 original_crew uuid not null references auth.users(id) on delete restrict,
 tenant_dispatcher uuid not null references auth.users(id) on delete restrict,
 shell_support_actor uuid not null references auth.users(id) on delete restrict,
 original_device_receipt_sha256 text not null check(original_device_receipt_sha256 ~ '^[0-9a-f]{64}$'),
 original_storage_receipt_sha256 text not null check(original_storage_receipt_sha256 ~ '^[0-9a-f]{64}$'),
 source_commit text not null check(source_commit ~ '^[0-9a-f]{40}$'),
 original_job_count integer not null check(original_job_count=1),
 private_photo_count integer not null check(private_photo_count=1),
 invoice_before integer not null check(invoice_before>=0),
 invoice_after integer not null check(invoice_after=invoice_before),
 service_entitlement_checked boolean not null check(service_entitlement_checked=true),
 original_422_link_checked boolean not null check(original_422_link_checked=true),
 actual_bytes_checked_by_worker boolean not null check(actual_bytes_checked_by_worker=true),
 photo_documentation_consent boolean not null check(photo_documentation_consent=true),
 actual_crew_device_witnessed boolean not null check(actual_crew_device_witnessed=true),
 tenant_dispatcher_confirmed_at timestamptz not null,
 technical_shell_closed_at timestamptz not null,
 state text not null check(state in('independent_staging_accepted','original_live_witness_pending')),
 external_customer_notification_sent boolean not null default false
   check(external_customer_notification_sent=false),
 finance_activated boolean not null default false check(finance_activated=false),
 source_surface text not null default 'independent_staging' check(source_surface='independent_staging'),
 created_at timestamptz not null default statement_timestamp(),
 unique(company_id,work_order_id,photo_id,original_support_case_id),
 foreign key(company_id,client_id)
   references public.ywi_company_client_links_422(company_id,client_id) on delete restrict,
 foreign key(company_id,client_id,client_site_id)
   references public.ywi_company_site_links_422(company_id,client_id,client_site_id) on delete restrict,
 constraint ywi588_rosevear_test_only check(company_id='03bcf48e-a4f5-4427-9aba-b0f91f39b16b'::uuid
   and client_id='58700000-0000-4587-8587-000000000001'::uuid
   and client_site_id='58700000-0000-4587-8587-000000000002'::uuid),
 constraint ywi588_distinct_actors check(owner_witness<>independent_reviewer
   and original_crew<>tenant_dispatcher and original_crew<>shell_support_actor
   and tenant_dispatcher<>shell_support_actor),
 constraint ywi588_close_after_dispatch check(technical_shell_closed_at>=tenant_dispatcher_confirmed_at)
);
create index if not exists ywi588_case_company_read on public.ywi_588_original_pilot_cases(company_id,created_at desc);
alter table public.ywi_588_original_pilot_cases enable row level security;
revoke all on public.ywi_588_original_pilot_cases from public,anon,authenticated;
grant select on public.ywi_588_original_pilot_cases to authenticated;
drop policy if exists ywi588_original_company_owner_read on public.ywi_588_original_pilot_cases;
create policy ywi588_original_company_owner_read on public.ywi_588_original_pilot_cases
 for select to authenticated using(exists(
  select 1 from public.ywi_companies c
  where c.id=company_id and c.owner_user_id=(select auth.uid())));
-- IMPORTANT: no browser INSERT/UPDATE/DELETE. Only authorized independent
-- service/DBA custody, original byte verification and rollback plan may append.
create or replace function public.ywi_588_case_append_only()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
 raise exception 'YW588 immutable original case; corrections require separately reviewed reversal case';
end $$;
revoke all on function public.ywi_588_case_append_only() from public,anon,authenticated;
drop trigger if exists ywi588_no_mutation on public.ywi_588_original_pilot_cases;
create trigger ywi588_no_mutation before update or delete
 on public.ywi_588_original_pilot_cases for each row
 execute function public.ywi_588_case_append_only();

-- Vendor product Shell: only server-derived REDACTED counts, never select
-- original photo, customer, work order, email or finance data. Must be gated
-- by the original platform admin registry, not a client-supplied role.
create or replace function public.ywi_rpc_shell_photo_summary_588()
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_open bigint; v_closed bigint;
begin
 if (select public.ywi_is_platform_administrator_489()) is distinct from true
 then raise exception 'Independent platform administrator enrollment required'; end if;
 select count(*) filter(where state='original_live_witness_pending'),
  count(*) filter(where state='independent_staging_accepted')
 into v_open,v_closed from public.ywi_588_original_pilot_cases;
 return jsonb_build_object(
  'verifiedPlatformServerReceipt',true,'source','ywi_rpc_shell_photo_summary_588',
  'openCount',v_open,'closedCount',v_closed,
  'containsCustomerData',false,'containsFinancialData',false,
  'containsPhotoBytes',false);
end $$;
revoke all on function public.ywi_rpc_shell_photo_summary_588() from public,anon,authenticated;
grant execute on function public.ywi_rpc_shell_photo_summary_588() to authenticated;
-- Independent migration owner must also verify photo/work-order/receipt/company
-- joins at INSERT with a separate trusted server transaction; FK to individual
-- IDs alone does not certify that all referenced rows belong to same company.
-- This file is a proposed acceptance contract, not live production authority.
commit;
