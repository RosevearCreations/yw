-- sql/2026-03-20_staff_auth_sessions.sql
--
-- Staff auth session table
--
-- What this file does:
-- - creates staff_auth_sessions
-- - links sessions to staff_users
-- - stores opaque token hashes only
-- - supports revocation, expiry, and activity tracking
-- - adds useful indexes for current-session lookups and cleanup jobs
--
-- Notes:
-- - run this in Supabase SQL editor or your normal migration flow
-- - assumes public.staff_users already exists
-- - token_hash should store a sha256 hex string, not the raw cookie token

begin;

create table if not exists public.staff_auth_sessions (
  id uuid primary key default gen_random_uuid(),
  staff_user_id uuid not null references public.staff_users(id) on delete cascade,
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz null,
  last_seen_at timestamptz null,
  ip_address text null,
  user_agent text null
);

create index if not exists idx_staff_auth_sessions_staff_user_id
  on public.staff_auth_sessions (staff_user_id);

create index if not exists idx_staff_auth_sessions_expires_at
  on public.staff_auth_sessions (expires_at);

create index if not exists idx_staff_auth_sessions_revoked_at
  on public.staff_auth_sessions (revoked_at);

create index if not exists idx_staff_auth_sessions_last_seen_at
  on public.staff_auth_sessions (last_seen_at);

create index if not exists idx_staff_auth_sessions_staff_active
  on public.staff_auth_sessions (staff_user_id, revoked_at, expires_at);

create or replace function public.set_staff_auth_sessions_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_staff_auth_sessions_updated_at on public.staff_auth_sessions;

create trigger trg_staff_auth_sessions_updated_at
before update on public.staff_auth_sessions
for each row
execute function public.set_staff_auth_sessions_updated_at();

commit;
