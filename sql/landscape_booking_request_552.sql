-- YW 552: company-isolated public landscaping quote REQUEST intake.
-- Install only after company_booking_catalogue_551.sql under reviewed DB change control.
-- Public submit is through the validated Edge Function using server credentials;
-- neither anon nor authenticated users may write this table directly.
create table if not exists public.ywi_company_booking_public_settings_552 (
  company_id uuid primary key references public.ywi_companies(id) on delete restrict,
  public_enabled boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.ywi_company_booking_public_settings_552 enable row level security;
revoke all on public.ywi_company_booking_public_settings_552 from public, anon, authenticated;
grant select on public.ywi_company_booking_public_settings_552 to authenticated;
grant insert(company_id,public_enabled) on public.ywi_company_booking_public_settings_552 to authenticated;
grant update(public_enabled) on public.ywi_company_booking_public_settings_552 to authenticated;
drop policy if exists ywi_booking_public_owner_read_552 on public.ywi_company_booking_public_settings_552;
create policy ywi_booking_public_owner_read_552 on public.ywi_company_booking_public_settings_552
 for select to authenticated using (exists (select 1 from public.ywi_companies c
 where c.id=company_id and c.owner_user_id=(select auth.uid())));
drop policy if exists ywi_booking_public_owner_insert_552 on public.ywi_company_booking_public_settings_552;
create policy ywi_booking_public_owner_insert_552 on public.ywi_company_booking_public_settings_552
 for insert to authenticated with check (
 (select auth.uid()) is not null
 and coalesce((auth.jwt()->>'is_anonymous')::boolean,false)=false
 and exists (select 1 from public.ywi_companies c where c.id=company_id and c.owner_user_id=(select auth.uid())));
drop policy if exists ywi_booking_public_owner_update_552 on public.ywi_company_booking_public_settings_552;
create policy ywi_booking_public_owner_update_552 on public.ywi_company_booking_public_settings_552
 for update to authenticated
 using (exists (select 1 from public.ywi_companies c where c.id=company_id and c.owner_user_id=(select auth.uid())))
 with check (exists (select 1 from public.ywi_companies c where c.id=company_id and c.owner_user_id=(select auth.uid())));

create table if not exists public.ywi_landscape_booking_requests_552 (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.ywi_companies(id) on delete restrict,
  idempotency_key uuid not null,
  request_status text not null default 'owner_review' check (request_status = 'owner_review'),
  full_name text not null check (char_length(full_name) between 2 and 140),
  contact_value text not null check (char_length(contact_value) between 3 and 180),
  preferred_contact_method text not null check (preferred_contact_method in ('email','phone')),
  service_area text not null check (char_length(service_area) between 2 and 160),
  requested_date date,
  customer_message text not null default '' check (char_length(customer_message) <= 2000),
  privacy_consent boolean not null check (privacy_consent = true),
  notification_opt_in boolean not null default false,
  pricing_season text not null check (pricing_season in ('spring','summer','fall','winter')),
  estimated_subtotal_cents integer not null check (estimated_subtotal_cents between 0 and 100000000),
  estimated_disposal_cents integer not null check (estimated_disposal_cents between 0 and estimated_subtotal_cents),
  quote_digest text not null check (quote_digest ~ '^[0-9a-f]{64}$'),
  quotation_snapshot jsonb not null check (jsonb_typeof(quotation_snapshot) = 'object'),
  created_at timestamptz not null default now(),
  unique (company_id, idempotency_key)
);
create index if not exists ywi_landscape_booking_requests_552_owner_queue
  on public.ywi_landscape_booking_requests_552(company_id,created_at desc);

alter table public.ywi_landscape_booking_requests_552 enable row level security;
revoke all on public.ywi_landscape_booking_requests_552 from public, anon, authenticated;
grant select on public.ywi_landscape_booking_requests_552 to authenticated;
drop policy if exists ywi_landscape_request_owner_read_552 on public.ywi_landscape_booking_requests_552;
create policy ywi_landscape_request_owner_read_552
 on public.ywi_landscape_booking_requests_552 for select to authenticated
 using (
   (select auth.uid()) is not null
   and coalesce((auth.jwt()->>'is_anonymous')::boolean,false)=false
   and exists (
     select 1 from public.ywi_companies c
     where c.id=company_id and c.owner_user_id=(select auth.uid())
   )
 );
comment on table public.ywi_landscape_booking_requests_552 is
 'YW552: owner-only review queue for public landscaping requests; no reservation, job, payment, dispatch or Comms send.';
