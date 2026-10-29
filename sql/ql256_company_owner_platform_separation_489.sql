-- Build 489: a company owner is NOT a platform administrator.
-- Review and apply to the Yard Workers Supabase project with a privileged
-- migration connection. This does not create a nonproduction integration tenant.
begin;

create table if not exists public.ywi_platform_administrators_489 (
  user_id uuid primary key references auth.users(id) on delete restrict,
  assigned_at timestamptz not null default now(),
  assignment_reference text not null
);
alter table public.ywi_platform_administrators_489 enable row level security;
revoke all on public.ywi_platform_administrators_489 from public, anon, authenticated;

-- The independently verified existing primary administrator, and nobody else.
insert into public.ywi_platform_administrators_489(user_id,assignment_reference)
select p.id,'Owner-requested primary administrator — Build 489'
from public.profiles p join auth.users u on u.id=p.id
where lower(p.email)='veardev@live.ca'
  and lower(u.email)='veardev@live.ca' and p.role='admin'
on conflict (user_id) do nothing;

-- Only privileged server paths may change global application roles. Existing
-- self-update RLS alone permits editing role and staff_tier, so guard both.
create or replace function public.ywi_profile_role_guard_489()
returns trigger language plpgsql set search_path = '' as $$
begin
  if (select auth.uid()) is not null then
    if tg_op = 'INSERT' then
      if lower(coalesce(new.role,'')) in ('admin','hse','supervisor','site_leader','job_admin','onsite_admin')
        or lower(coalesce(new.staff_tier,'')) in ('admin','hse','supervisor','site_leader','job_admin','onsite_admin') then
        raise exception 'Global access requires trusted administrator provisioning';
      end if;
    elsif new.role is distinct from old.role or new.staff_tier is distinct from old.staff_tier then
      raise exception 'Global role and staff tier cannot be changed by a user session';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists ywi_profile_role_guard_489 on public.profiles;
create trigger ywi_profile_role_guard_489
before insert or update on public.profiles
for each row execute function public.ywi_profile_role_guard_489();

create or replace function public.ywi_is_platform_administrator_489()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.ywi_platform_administrators_489 a
    join public.profiles p on p.id=a.user_id
    where a.user_id=(select auth.uid()) and p.role='admin' and p.is_active=true
  );
$$;
revoke all on function public.ywi_is_platform_administrator_489() from public,anon,authenticated;
grant execute on function public.ywi_is_platform_administrator_489() to authenticated;

-- Read-only oversight is an explicit RPC, NOT an RLS bypass for company owners.
-- Ordinary ywi_companies reads and service writes remain strictly owner-bound.
create or replace function public.ywi_platform_company_directory_489()
returns table(company_id uuid,company_name text,owner_user_id uuid,
  owner_email text,enabled_services bigint,registered_services bigint)
language sql stable security definer set search_path = '' as $$
  select c.id,c.name,c.owner_user_id,p.email,
    (select count(*) from public.ywi_company_service_modules m
      where m.company_id=c.id and m.enabled=true),
    (select count(*) from public.ywi_company_service_modules m
      where m.company_id=c.id)
  from public.ywi_companies c join public.profiles p on p.id=c.owner_user_id
  where (select public.ywi_is_platform_administrator_489())
  order by c.created_at,c.id;
$$;
revoke all on function public.ywi_platform_company_directory_489() from public,anon,authenticated;
grant execute on function public.ywi_platform_company_directory_489() to authenticated;
commit;
