-- Build 494: exact service-switch counts for the signed-in owner only.
-- SECURITY INVOKER preserves the table RLS boundary; this is read-only.
begin;

create or replace function public.ywi_company_service_audit_summary_494(p_company_id uuid)
returns table (
  module_key text,
  enabled boolean,
  initialized_events bigint,
  enabled_events bigint,
  disabled_events bigint,
  last_action text,
  last_event_at timestamptz
)
language plpgsql stable security invoker set search_path = '' as $$
begin
  if (select auth.uid()) is null or
     coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false) then
    raise exception 'AUTHENTICATED_OWNER_REQUIRED' using errcode='42501';
  end if;

  if p_company_id is null or not exists (
    select 1 from public.ywi_companies c
     where c.id = p_company_id and c.owner_user_id = (select auth.uid())
  ) then
    raise exception 'COMPANY_OWNER_REQUIRED' using errcode='42501';
  end if;

  return query
    select m.module_key, m.enabled,
      stats.initialized_events, stats.enabled_events, stats.disabled_events,
      stats.last_action, stats.last_event_at
    from public.ywi_company_service_modules m
    left join lateral (
      select count(*) filter (where a.action = 'initialized') as initialized_events,
        count(*) filter (where a.action = 'enabled') as enabled_events,
        count(*) filter (where a.action = 'disabled') as disabled_events,
        (array_agg(a.action order by a.recorded_at desc, a.id desc))[1] as last_action,
        max(a.recorded_at) as last_event_at
      from public.ywi_company_service_module_audit a
      where a.company_id = m.company_id and a.module_key = m.module_key
    ) stats on true
    where m.company_id = p_company_id
    order by m.module_key;
end $$;

revoke all on function public.ywi_company_service_audit_summary_494(uuid)
  from public, anon, authenticated;
grant execute on function public.ywi_company_service_audit_summary_494(uuid)
  to authenticated;
comment on function public.ywi_company_service_audit_summary_494(uuid) is
  'Read-only exact owner-scoped service-switch summaries; RLS and owner identity required; no service changes.';

commit;
