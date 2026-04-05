-- 2026-04-04d staff directory, hierarchy roles, and admin user lifecycle pass

alter table if exists public.profiles
  add column if not exists seniority_level text,
  add column if not exists employment_status text not null default 'active',
  add column if not exists staff_tier text;

create index if not exists idx_profiles_employment_status on public.profiles (employment_status);
create index if not exists idx_profiles_staff_tier on public.profiles (staff_tier);
create index if not exists idx_profiles_seniority_level on public.profiles (seniority_level);
