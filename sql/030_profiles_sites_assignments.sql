-- =========================================================
-- Document 9: sql/030_profiles_sites_assignments.sql
-- Purpose:
-- - Create/standardize core admin tables:
--   1) profiles
--   2) sites
--   3) site_assignments
-- - Add constraints and indexes
-- - Add timestamp update trigger support
--
-- Run this in Supabase SQL Editor.
-- =========================================================

-- ---------------------------------------------------------
-- 1) updated_at helper trigger function
-- ---------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------
-- 2) profiles
-- ---------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key,
  email text unique,
  full_name text,
  role text not null default 'worker',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Add missing columns safely if table already exists
alter table public.profiles
  add column if not exists email text;

alter table public.profiles
  add column if not exists full_name text;

alter table public.profiles
  add column if not exists role text not null default 'worker';

alter table public.profiles
  add column if not exists is_active boolean not null default true;

alter table public.profiles
  add column if not exists created_at timestamptz not null default now();

alter table public.profiles
  add column if not exists updated_at timestamptz not null default now();

-- Unique email if not already present
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_email_key'
  ) then
    alter table public.profiles
      add constraint profiles_email_key unique (email);
  end if;
end $$;

-- Role constraint
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_role_check'
  ) then
    alter table public.profiles
      add constraint profiles_role_check
      check (role in ('worker','supervisor','hse','admin'));
  end if;
end $$;

-- ---------------------------------------------------------
-- 3) sites
-- ---------------------------------------------------------
create table if not exists public.sites (
  id bigserial primary key,
  site_code text not null unique,
  site_name text not null,
  address text,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.sites
  add column if not exists site_code text;

alter table public.sites
  add column if not exists site_name text;

alter table public.sites
  add column if not exists address text;

alter table public.sites
  add column if not exists notes text;

alter table public.sites
  add column if not exists is_active boolean not null default true;

alter table public.sites
  add column if not exists created_at timestamptz not null default now();

alter table public.sites
  add column if not exists updated_at timestamptz not null default now();

-- Ensure required text fields are populated if nulls exist
update public.sites
set site_code = coalesce(site_code, 'SITE-' || id::text)
where site_code is null;

update public.sites
set site_name = coalesce(site_name, site_code, 'Unnamed Site')
where site_name is null;

alter table public.sites
  alter column site_code set not null;

alter table public.sites
  alter column site_name set not null;

-- Unique site_code if not already present
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'sites_site_code_key'
  ) then
    alter table public.sites
      add constraint sites_site_code_key unique (site_code);
  end if;
end $$;

-- ---------------------------------------------------------
-- 4) site_assignments
-- ---------------------------------------------------------
create table if not exists public.site_assignments (
  id bigserial primary key,
  site_id bigint not null references public.sites(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  assignment_role text not null default 'worker',
  is_primary boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.site_assignments
  add column if not exists site_id bigint;

alter table public.site_assignments
  add column if not exists profile_id uuid;

alter table public.site_assignments
  add column if not exists assignment_role text not null default 'worker';

alter table public.site_assignments
  add column if not exists is_primary boolean not null default false;

alter table public.site_assignments
  add column if not exists created_at timestamptz not null default now();

-- Add FKs only if missing
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'site_assignments_site_id_fkey'
  ) then
    alter table public.site_assignments
      add constraint site_assignments_site_id_fkey
      foreign key (site_id) references public.sites(id) on delete cascade;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'site_assignments_profile_id_fkey'
  ) then
    alter table public.site_assignments
      add constraint site_assignments_profile_id_fkey
      foreign key (profile_id) references public.profiles(id) on delete cascade;
  end if;
end $$;

-- Role constraint
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'site_assignments_role_check'
  ) then
    alter table public.site_assignments
      add constraint site_assignments_role_check
      check (assignment_role in ('worker','supervisor','hse','admin'));
  end if;
end $$;

-- Prevent exact duplicate site/profile pairs
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'site_assignments_site_profile_unique'
  ) then
    alter table public.site_assignments
      add constraint site_assignments_site_profile_unique
      unique (site_id, profile_id);
  end if;
end $$;

-- ---------------------------------------------------------
-- 5) indexes
-- ---------------------------------------------------------
create index if not exists idx_profiles_role
  on public.profiles(role);

create index if not exists idx_profiles_is_active
  on public.profiles(is_active);

create index if not exists idx_profiles_email
  on public.profiles(email);

create index if not exists idx_sites_site_code
  on public.sites(site_code);

create index if not exists idx_sites_is_active
  on public.sites(is_active);

create index if not exists idx_site_assignments_site_id
  on public.site_assignments(site_id);

create index if not exists idx_site_assignments_profile_id
  on public.site_assignments(profile_id);

create index if not exists idx_site_assignments_role
  on public.site_assignments(assignment_role);

create index if not exists idx_site_assignments_is_primary
  on public.site_assignments(is_primary);

-- ---------------------------------------------------------
-- 6) updated_at triggers
-- ---------------------------------------------------------
drop trigger if exists trg_profiles_set_updated_at on public.profiles;
create trigger trg_profiles_set_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

drop trigger if exists trg_sites_set_updated_at on public.sites;
create trigger trg_sites_set_updated_at
before update on public.sites
for each row
execute function public.set_updated_at();

-- ---------------------------------------------------------
-- 7) row level security
-- Edge functions use service role, but we enable RLS now
-- for future safety and direct client reads if needed.
-- ---------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.sites enable row level security;
alter table public.site_assignments enable row level security;

-- ---------------------------------------------------------
-- 8) basic read policies
-- Admins can read everything.
-- Authenticated users can read their own profile.
-- Authenticated users can read active sites.
-- Authenticated users can read their own assignments.
-- ---------------------------------------------------------

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'profiles'
      and policyname = 'profiles_select_self_or_admin'
  ) then
    create policy profiles_select_self_or_admin
      on public.profiles
      for select
      to authenticated
      using (
        id = auth.uid()
        or exists (
          select 1
          from public.profiles p
          where p.id = auth.uid()
            and p.is_active = true
            and p.role = 'admin'
        )
      );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'sites'
      and policyname = 'sites_select_active_or_admin'
  ) then
    create policy sites_select_active_or_admin
      on public.sites
      for select
      to authenticated
      using (
        is_active = true
        or exists (
          select 1
          from public.profiles p
          where p.id = auth.uid()
            and p.is_active = true
            and p.role = 'admin'
        )
      );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'site_assignments'
      and policyname = 'site_assignments_select_self_or_admin'
  ) then
    create policy site_assignments_select_self_or_admin
      on public.site_assignments
      for select
      to authenticated
      using (
        profile_id = auth.uid()
        or exists (
          select 1
          from public.profiles p
          where p.id = auth.uid()
            and p.is_active = true
            and p.role = 'admin'
        )
      );
  end if;
end $$;

-- ---------------------------------------------------------
-- 9) verification
-- ---------------------------------------------------------
select to_regclass('public.profiles') as profiles_table;
select to_regclass('public.sites') as sites_table;
select to_regclass('public.site_assignments') as site_assignments_table;

select
  column_name,
  data_type
from information_schema.columns
where table_schema = 'public'
  and table_name in ('profiles', 'sites', 'site_assignments')
order by table_name, ordinal_position;
