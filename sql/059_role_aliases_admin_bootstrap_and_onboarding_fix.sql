-- 059_role_aliases_admin_bootstrap_and_onboarding_fix.sql
-- Purpose:
-- - allow employee as the standard personnel role while remaining compatible with older worker rows
-- - normalize legacy worker profiles to employee for staff-directory clarity
-- - keep assignment_role compatible with worker and employee values
-- - make onboarding completion less likely to stay visually stuck in older data sets

alter table if exists public.profiles
  alter column role set default 'employee';

alter table if exists public.profiles
  drop constraint if exists profiles_role_check;

alter table if exists public.profiles
  add constraint profiles_role_check
  check (role in ('worker','employee','staff','onsite_admin','site_leader','supervisor','hse','job_admin','admin'));

alter table if exists public.site_assignments
  drop constraint if exists site_assignments_assignment_role_check;

alter table if exists public.site_assignments
  add constraint site_assignments_assignment_role_check
  check (assignment_role in ('worker','employee','site_leader','supervisor','hse','job_admin','admin'));

update public.profiles
set role = 'employee',
    staff_tier = coalesce(nullif(staff_tier, ''), 'employee'),
    updated_at = now()
where role = 'worker';

update public.profiles
set onboarding_completed_at = coalesce(onboarding_completed_at, account_setup_completed_at, now()),
    account_setup_completed_at = coalesce(account_setup_completed_at, onboarding_completed_at, now()),
    updated_at = now()
where is_active = true
  and coalesce(trim(email), '') <> ''
  and coalesce(onboarding_completed_at, account_setup_completed_at) is null;
