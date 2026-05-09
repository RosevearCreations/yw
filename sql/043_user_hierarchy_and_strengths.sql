-- File: sql/043_user_hierarchy_and_strengths.sql
-- Brief description: Adds reporting hierarchy and richer personnel fields.
-- Supports default/override supervisor/admin chains, start date, strengths, and employee tracking.

alter table public.profiles add column if not exists employee_number text;
alter table public.profiles add column if not exists start_date date;
alter table public.profiles add column if not exists strengths text;
alter table public.profiles add column if not exists default_supervisor_profile_id uuid references public.profiles(id);
alter table public.profiles add column if not exists override_supervisor_profile_id uuid references public.profiles(id);
alter table public.profiles add column if not exists default_admin_profile_id uuid references public.profiles(id);
alter table public.profiles add column if not exists override_admin_profile_id uuid references public.profiles(id);

alter table public.sites add column if not exists admin_profile_id uuid references public.profiles(id);

alter table public.site_assignments add column if not exists reports_to_supervisor_profile_id uuid references public.profiles(id);
alter table public.site_assignments add column if not exists reports_to_admin_profile_id uuid references public.profiles(id);

create index if not exists idx_profiles_default_supervisor on public.profiles(default_supervisor_profile_id);
create index if not exists idx_profiles_default_admin on public.profiles(default_admin_profile_id);
create index if not exists idx_site_assignments_reports_to_supervisor on public.site_assignments(reports_to_supervisor_profile_id);
create index if not exists idx_site_assignments_reports_to_admin on public.site_assignments(reports_to_admin_profile_id);
