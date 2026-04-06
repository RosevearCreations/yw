-- 2026-04-05c session role normalization and onboarding guardrails
-- Purpose:
-- - Normalize legacy worker/staff values to employee at write time
-- - Keep onboarding/account-setup timestamps aligned once either completion flag is set

create or replace function public.normalize_profile_role_guardrails()
returns trigger
language plpgsql
as $$
begin
  if new.role is not null then
    new.role := lower(trim(new.role));
    if new.role in ('worker', 'staff') then
      new.role := 'employee';
    end if;
  end if;

  if new.staff_tier is not null then
    new.staff_tier := lower(trim(new.staff_tier));
    if new.staff_tier in ('worker', 'staff') then
      new.staff_tier := 'employee';
    end if;
  end if;

  if new.onboarding_completed_at is not null and new.account_setup_completed_at is null then
    new.account_setup_completed_at := new.onboarding_completed_at;
  end if;

  if new.account_setup_completed_at is not null and new.onboarding_completed_at is null then
    new.onboarding_completed_at := new.account_setup_completed_at;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_profiles_role_guardrails on public.profiles;
create trigger trg_profiles_role_guardrails
before insert or update on public.profiles
for each row
execute function public.normalize_profile_role_guardrails();

update public.profiles
set
  role = case when lower(trim(coalesce(role, 'employee'))) in ('worker', 'staff') then 'employee' else lower(trim(coalesce(role, 'employee'))) end,
  staff_tier = case when lower(trim(coalesce(staff_tier, ''))) in ('worker', 'staff') then 'employee' else nullif(lower(trim(coalesce(staff_tier, ''))), '') end,
  onboarding_completed_at = coalesce(onboarding_completed_at, account_setup_completed_at),
  account_setup_completed_at = coalesce(account_setup_completed_at, onboarding_completed_at),
  updated_at = now()
where
  lower(trim(coalesce(role, 'employee'))) in ('worker', 'staff')
  or lower(trim(coalesce(staff_tier, ''))) in ('worker', 'staff')
  or (onboarding_completed_at is null and account_setup_completed_at is not null)
  or (account_setup_completed_at is null and onboarding_completed_at is not null);
