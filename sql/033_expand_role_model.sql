-- =========================================================
-- Document 19: sql/033_expand_role_model.sql
-- Purpose:
-- - Expand the role model to support more security tiers
-- - Standardize roles across:
--   1) profiles.role
--   2) site_assignments.assignment_role
-- - Prepare the app for finer-grained access control
--
-- New supported roles:
--   admin
--   hse
--   supervisor
--   site_leader
--   worker
--
-- Run this in Supabase SQL Editor.
-- =========================================================

-- ---------------------------------------------------------
-- 1) Normalize any legacy values before constraints update
-- ---------------------------------------------------------
update public.profiles
set role = 'supervisor'
where role = 'foreman';

update public.site_assignments
set assignment_role = 'supervisor'
where assignment_role = 'foreman';

update public.profiles
set role = 'worker'
where role is null or btrim(role) = '';

update public.site_assignments
set assignment_role = 'worker'
where assignment_role is null or btrim(assignment_role) = '';

-- ---------------------------------------------------------
-- 2) Replace profiles role constraint
-- ---------------------------------------------------------
do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'profiles_role_check'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      drop constraint profiles_role_check;
  end if;
end $$;

alter table public.profiles
  add constraint profiles_role_check
  check (role in ('worker','site_leader','supervisor','hse','admin'));

-- ---------------------------------------------------------
-- 3) Replace site_assignments role constraint
-- ---------------------------------------------------------
do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'site_assignments_role_check'
      and conrelid = 'public.site_assignments'::regclass
  ) then
    alter table public.site_assignments
      drop constraint site_assignments_role_check;
  end if;
end $$;

alter table public.site_assignments
  add constraint site_assignments_role_check
  check (assignment_role in ('worker','site_leader','supervisor','hse','admin'));

-- ---------------------------------------------------------
-- 4) Helpful comments for clarity
-- ---------------------------------------------------------
comment on column public.profiles.role is
'Global application role. Supported values: worker, site_leader, supervisor, hse, admin.';

comment on column public.site_assignments.assignment_role is
'Role assigned to a user for a specific site. Supported values: worker, site_leader, supervisor, hse, admin.';

-- ---------------------------------------------------------
-- 5) Optional helper view for security rank
--    Higher rank = broader authority
-- ---------------------------------------------------------
create or replace view public.v_profile_role_rank as
select
  p.id,
  p.email,
  p.full_name,
  p.role,
  p.is_active,
  case p.role
    when 'worker' then 10
    when 'site_leader' then 20
    when 'supervisor' then 30
    when 'hse' then 40
    when 'admin' then 50
    else 0
  end as role_rank
from public.profiles p;

comment on view public.v_profile_role_rank is
'Helper view mapping profile roles to numeric rank for future access-control logic.';

create or replace view public.v_site_assignment_role_rank as
select
  sa.id,
  sa.site_id,
  sa.profile_id,
  sa.assignment_role,
  sa.is_primary,
  sa.created_at,
  case sa.assignment_role
    when 'worker' then 10
    when 'site_leader' then 20
    when 'supervisor' then 30
    when 'hse' then 40
    when 'admin' then 50
    else 0
  end as role_rank
from public.site_assignments sa;

comment on view public.v_site_assignment_role_rank is
'Helper view mapping site assignment roles to numeric rank for future access-control logic.';

-- ---------------------------------------------------------
-- 6) Grant read access to helper views for authenticated use
-- ---------------------------------------------------------
grant select on public.v_profile_role_rank to authenticated;
grant select on public.v_site_assignment_role_rank to authenticated;

-- ---------------------------------------------------------
-- 7) Verification
-- ---------------------------------------------------------
select
  conname,
  pg_get_constraintdef(oid) as definition
from pg_constraint
where conname in ('profiles_role_check', 'site_assignments_role_check')
order by conname;

select distinct role
from public.profiles
order by role;

select distinct assignment_role
from public.site_assignments
order by assignment_role;

select * from public.v_profile_role_rank limit 10;
select * from public.v_site_assignment_role_rank limit 10;
