-- =========================================================
-- Document 10: sql/031_profile_bootstrap_trigger.sql
-- Purpose:
-- - Automatically create a public.profiles row when a new
--   auth.users record is created
-- - Keep profile email aligned at creation time
-- - Prevent missing-profile problems after magic link login
--
-- Run this in Supabase SQL Editor.
-- =========================================================

-- ---------------------------------------------------------
-- 1) Create trigger function
-- ---------------------------------------------------------
create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (
    id,
    email,
    full_name,
    role,
    is_active,
    created_at,
    updated_at
  )
  values (
    new.id,
    new.email,
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      split_part(coalesce(new.email, ''), '@', 1),
      'User'
    ),
    'worker',
    true,
    now(),
    now()
  )
  on conflict (id) do update
    set email = excluded.email,
        updated_at = now();

  return new;
end;
$$;

-- ---------------------------------------------------------
-- 2) Drop existing trigger if present
-- ---------------------------------------------------------
drop trigger if exists on_auth_user_created on auth.users;

-- ---------------------------------------------------------
-- 3) Create trigger on auth.users
-- ---------------------------------------------------------
create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user_profile();

-- ---------------------------------------------------------
-- 4) Optional backfill for existing auth users
--    Creates missing profiles for users who already exist
-- ---------------------------------------------------------
insert into public.profiles (
  id,
  email,
  full_name,
  role,
  is_active,
  created_at,
  updated_at
)
select
  u.id,
  u.email,
  coalesce(
    u.raw_user_meta_data ->> 'full_name',
    u.raw_user_meta_data ->> 'name',
    split_part(coalesce(u.email, ''), '@', 1),
    'User'
  ) as full_name,
  'worker' as role,
  true as is_active,
  now() as created_at,
  now() as updated_at
from auth.users u
left join public.profiles p
  on p.id = u.id
where p.id is null;

-- ---------------------------------------------------------
-- 5) Verification
-- ---------------------------------------------------------
select
  tgname as trigger_name,
  tgrelid::regclass as table_name
from pg_trigger
where tgname = 'on_auth_user_created';

select
  count(*) as auth_user_count
from auth.users;

select
  count(*) as profile_count
from public.profiles;
