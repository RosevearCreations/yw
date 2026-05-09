-- 060_session_role_normalization_guardrails.sql
-- Normalize legacy profile roles and align onboarding/account setup completion timestamps.

alter table if exists public.profiles
  alter column role set default 'employee';

update public.profiles
set role = 'employee'
where lower(coalesce(role, '')) in ('worker','staff','');

update public.profiles
set staff_tier = 'employee'
where lower(coalesce(staff_tier, '')) in ('worker','staff','');

update public.profiles
set onboarding_completed_at = coalesce(onboarding_completed_at, account_setup_completed_at),
    account_setup_completed_at = coalesce(account_setup_completed_at, onboarding_completed_at),
    updated_at = now()
where onboarding_completed_at is null or account_setup_completed_at is null;
