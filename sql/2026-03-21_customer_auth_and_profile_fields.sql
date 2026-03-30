-- sql/2026-03-21_customer_auth_and_profile_fields.sql
-- Customer/staff profile enrichment + client auth sessions.

begin;

alter table public.customer_profiles
  add column if not exists password_hash text null,
  add column if not exists address_line1 text null,
  add column if not exists address_line2 text null,
  add column if not exists city text null,
  add column if not exists province text null,
  add column if not exists postal_code text null,
  add column if not exists vehicle_notes text null,
  add column if not exists is_active boolean not null default true;

alter table public.staff_users
  add column if not exists phone text null,
  add column if not exists address_line1 text null,
  add column if not exists address_line2 text null,
  add column if not exists city text null,
  add column if not exists province text null,
  add column if not exists postal_code text null,
  add column if not exists employee_code text null,
  add column if not exists position_title text null,
  add column if not exists hire_date date null,
  add column if not exists emergency_contact_name text null,
  add column if not exists emergency_contact_phone text null,
  add column if not exists vehicle_notes text null;

create table if not exists public.customer_auth_sessions (
  id uuid primary key default gen_random_uuid(),
  customer_profile_id uuid not null references public.customer_profiles(id) on delete cascade,
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz null,
  last_seen_at timestamptz null,
  ip_address text null,
  user_agent text null
);

create index if not exists idx_customer_auth_sessions_customer_profile_id on public.customer_auth_sessions (customer_profile_id);
create index if not exists idx_customer_auth_sessions_expires_at on public.customer_auth_sessions (expires_at);
create index if not exists idx_customer_auth_sessions_revoked_at on public.customer_auth_sessions (revoked_at);

create or replace function public.set_customer_auth_sessions_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_customer_auth_sessions_updated_at on public.customer_auth_sessions;
create trigger trg_customer_auth_sessions_updated_at
before update on public.customer_auth_sessions
for each row
execute function public.set_customer_auth_sessions_updated_at();

commit;
