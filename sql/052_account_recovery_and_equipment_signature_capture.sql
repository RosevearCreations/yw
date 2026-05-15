-- File: sql/052_account_recovery_and_equipment_signature_capture.sql
-- Brief description:
-- Adds account recovery fields and logging, enables username-based sign-in lookup,
-- and stores real signature image captures for equipment checkout/return history.

begin;

alter table if exists public.profiles
  add column if not exists username text,
  add column if not exists recovery_email text,
  add column if not exists password_changed_at timestamptz,
  add column if not exists last_login_at timestamptz;

create unique index if not exists idx_profiles_username_unique
  on public.profiles (lower(username))
  where username is not null and btrim(username) <> '';

create table if not exists public.account_recovery_requests (
  id bigserial primary key,
  lookup_kind text not null default 'lookup',
  employee_number text,
  phone_last4 text,
  last_name text,
  matched_profile_id uuid references public.profiles(id) on delete set null,
  masked_email text,
  masked_username text,
  request_status text not null default 'pending',
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists idx_account_recovery_requests_created_at
  on public.account_recovery_requests(created_at desc);

create index if not exists idx_account_recovery_requests_profile
  on public.account_recovery_requests(matched_profile_id, created_at desc);

alter table if exists public.equipment_signouts
  add column if not exists checkout_worker_signature_png text,
  add column if not exists checkout_supervisor_signature_png text,
  add column if not exists checkout_admin_signature_png text,
  add column if not exists return_worker_signature_png text,
  add column if not exists return_supervisor_signature_png text,
  add column if not exists return_admin_signature_png text;

commit;
