-- =========================================================
-- sql/038_profile_visibility_rls.sql
-- Purpose:
-- - Add real helper functions and row-level security policies for profile visibility
-- - Workers see themselves only
-- - Supervisors see workers/employees/site leaders
-- - HSE and Job Admin see all non-admin profiles
-- - Admins see and manage all profiles, sites, assignments, and submissions
-- =========================================================

create or replace function public.current_profile_role()
returns text
language sql
stable
as $$
  select coalesce((select p.role from public.profiles p where p.id = auth.uid()), 'worker');
$$;

create or replace function public.current_profile_rank()
returns integer
language sql
stable
as $$
  select coalesce(public.role_rank(public.current_profile_role()), 0);
$$;

create or replace function public.can_view_profile(target_profile_id uuid)
returns boolean
language sql
stable
as $$
  with me as (
    select auth.uid() as my_id, public.current_profile_role() as my_role, public.current_profile_rank() as my_rank
  ), target as (
    select p.id, p.role, public.role_rank(p.role) as target_rank
    from public.profiles p
    where p.id = target_profile_id
  )
  select case
    when exists(select 1 from me where my_id = target_profile_id) then true
    when exists(select 1 from me where my_role = 'admin') then true
    when exists(select 1 from me, target where my_role = 'supervisor' and target_rank < public.role_rank('supervisor')) then true
    when exists(select 1 from me, target where my_role in ('hse','job_admin') and target_rank < public.role_rank('admin')) then true
    else false
  end;
$$;

alter table public.profiles enable row level security;
alter table public.sites enable row level security;
alter table public.site_assignments enable row level security;
alter table public.submissions enable row level security;

drop policy if exists profiles_select_visible on public.profiles;
create policy profiles_select_visible on public.profiles
for select
using (public.can_view_profile(id));

drop policy if exists profiles_update_self_or_admin on public.profiles;
create policy profiles_update_self_or_admin on public.profiles
for update
using (id = auth.uid() or public.current_profile_role() = 'admin')
with check (id = auth.uid() or public.current_profile_role() = 'admin');

drop policy if exists sites_select_supervisor_plus on public.sites;
create policy sites_select_supervisor_plus on public.sites
for select
using (public.current_profile_rank() >= public.role_rank('supervisor'));

drop policy if exists sites_admin_write on public.sites;
create policy sites_admin_write on public.sites
for all
using (public.current_profile_role() = 'admin')
with check (public.current_profile_role() = 'admin');

drop policy if exists site_assignments_select_supervisor_plus on public.site_assignments;
create policy site_assignments_select_supervisor_plus on public.site_assignments
for select
using (public.current_profile_rank() >= public.role_rank('supervisor'));

drop policy if exists site_assignments_admin_write on public.site_assignments;
create policy site_assignments_admin_write on public.site_assignments
for all
using (public.current_profile_role() = 'admin')
with check (public.current_profile_role() = 'admin');

drop policy if exists submissions_select_self_or_supervisor_plus on public.submissions;
create policy submissions_select_self_or_supervisor_plus on public.submissions
for select
using (
  submitted_by_profile_id = auth.uid()
  or public.current_profile_rank() >= public.role_rank('supervisor')
);
