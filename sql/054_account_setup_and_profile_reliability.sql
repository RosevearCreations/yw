-- File: sql/054_account_setup_and_profile_reliability.sql
-- Brief description:
-- Adds account-setup readiness flags and profile reliability fields so
-- magic-link validation, password setup, and richer settings/contact updates
-- can be tracked cleanly in the database.

begin;

alter table if exists public.profiles
  add column if not exists password_login_ready boolean not null default false,
  add column if not exists account_setup_completed_at timestamptz;

update public.profiles
set password_login_ready = true
where coalesce(password_login_ready, false) = false
  and password_changed_at is not null;

create index if not exists idx_profiles_password_login_ready
  on public.profiles(password_login_ready);

create index if not exists idx_profiles_account_setup_completed_at
  on public.profiles(account_setup_completed_at desc);

commit;
