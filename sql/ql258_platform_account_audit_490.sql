-- Build 490: read-only account audit for the independently curated platform
-- administrator. Does not grant legacy admin accounts platform-wide tenant reads.
begin;
create or replace function public.ywi_platform_account_audit_490()
returns table(profile_id uuid,account_name text,account_email text,global_role text,
  staff_tier text,active boolean,curated_platform_admin boolean,
  owned_company_count bigint,profile_email_matches_auth boolean)
language plpgsql stable security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null or
      not (select public.ywi_is_platform_administrator_489()) then
    raise exception 'PLATFORM_ADMIN_REQUIRED' using errcode='42501';
  end if;
  return query
    select p.id,p.full_name,u.email,p.role,p.staff_tier,p.is_active,
      exists(select 1 from public.ywi_platform_administrators_489 a
             where a.user_id=p.id),
      (select count(*) from public.ywi_companies c where c.owner_user_id=p.id),
      lower(coalesce(p.email,''))=lower(coalesce(u.email,''))
    from public.profiles p join auth.users u on u.id=p.id
    where p.role='admin' or exists (
      select 1 from public.ywi_companies c where c.owner_user_id=p.id)
    order by p.role='admin' desc,p.full_name,p.id;
end $$;
revoke all on function public.ywi_platform_account_audit_490() from public,anon,authenticated;
grant execute on function public.ywi_platform_account_audit_490() to authenticated;
comment on function public.ywi_platform_account_audit_490() is
  'Read-only, curated primary admin audit. Legacy global admin flags are NOT consent to modify accounts.';
commit;
