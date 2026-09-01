-- Schema 160: I.T. readiness and admin access integrity
-- Purpose:
-- - Add I.T. Readiness as a protected Admin-module sub-section.
-- - Make admin full-access a database invariant rather than only a UI convention.
-- - Provide one private readiness registry and admin access-integrity view.
-- - Provide one atomic service-role RPC for per-profile module permission changes.

begin;

insert into public.app_module_routes(
  section_id,module_key,section_label,minimum_access_level,sort_order,is_enabled
) values (
  'it','admin','I.T. Readiness','manage',20,true
)
on conflict(section_id) do update set
  module_key=excluded.module_key,
  section_label=excluded.section_label,
  minimum_access_level=excluded.minimum_access_level,
  sort_order=excluded.sort_order,
  is_enabled=excluded.is_enabled,
  updated_at=now();

-- Admin is a break-glass role. Keep the role defaults explicit even though
-- ywi_effective_module_access() already returns manage immediately for admin.
insert into public.app_role_module_permissions(role,module_key,access_level,notes)
values
  ('admin','safety','manage','Admin break-glass access; cannot be overridden per profile.'),
  ('admin','finance','manage','Admin break-glass access; cannot be overridden per profile.'),
  ('admin','jobs','manage','Admin break-glass access; cannot be overridden per profile.'),
  ('admin','admin','manage','Admin break-glass access; cannot be overridden per profile.')
on conflict(role,module_key) do update set
  access_level=excluded.access_level,
  notes=excluded.notes,
  updated_at=now();

-- Remove any stale/legacy per-profile override rows for current admins. They are
-- unnecessary because admin always resolves to manage, and retaining them creates
-- misleading UI/audit state.
delete from public.app_profile_module_permissions p
using public.profiles pr
where pr.id=p.profile_id
  and lower(coalesce(pr.role,''))='admin';

create or replace function public.ywi_prevent_admin_module_override()
returns trigger
language plpgsql
set search_path=public
as $$
begin
  if public.ywi_normalized_profile_role(new.profile_id)='admin' then
    raise exception 'Admin module access is break-glass manage and cannot be overridden.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_prevent_admin_module_override on public.app_profile_module_permissions;
create trigger trg_prevent_admin_module_override
before insert or update on public.app_profile_module_permissions
for each row execute function public.ywi_prevent_admin_module_override();

create table if not exists public.it_readiness_check_registry (
  check_key text primary key,
  check_group text not null,
  check_title text not null,
  severity_if_failed text not null default 'warning',
  action_hint text,
  route_hint text,
  sort_order integer not null default 100,
  is_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint it_readiness_check_registry_severity_check
    check (severity_if_failed in ('info','warning','error','critical'))
);

insert into public.it_readiness_check_registry(
  check_key,check_group,check_title,severity_if_failed,action_hint,route_hint,sort_order,is_enabled
) values
  ('schema_current','Database','Database schema matches the source release','critical','Apply missing migrations before dependent application code is promoted.','Database / schema drift',10,true),
  ('admin_access_integrity','Access','Every active admin resolves to manage on every module','critical','Repair the admin role/module defaults or remove stale admin overrides before continuing.','Admin > Modules',20,true),
  ('module_security_assertions','Access','Module RPC and RLS security assertions pass','critical','Review failed module security assertions before release.','Admin > I.T. Readiness',30,true),
  ('schema_preflight','Preflight','Schema preflight checks are current','error','Resolve failed schema preflight checks before deployment.','Admin > I.T. Readiness',40,true),
  ('deployment_checklist','Deployment','Deployment checklist has no blocking item','error','Complete blocking deployment checklist items.','Admin > I.T. Readiness',50,true),
  ('function_readiness','Functions','Required Edge Functions are ready','error','Redeploy stale/missing Edge Functions and rerun readiness.','Admin > I.T. Readiness',60,true),
  ('production_readiness','Release','Production readiness checklist is green','critical','Do not promote until release blockers are resolved.','Admin > I.T. Readiness',70,true),
  ('backup_restore','Recovery','Backup/restore preparedness is current','critical','Complete and record a backup/restore rehearsal.','Admin > I.T. Readiness',80,true),
  ('runtime_health','Runtime','Runtime/error health has no unresolved critical condition','error','Resolve critical runtime health items and rerun smoke checks.','Admin > I.T. Readiness',90,true),
  ('public_seo','SEO','Public SEO release checks are clean','warning','Resolve public page/SEO release issues without exposing private portal data.','Admin > I.T. Readiness',100,true),
  ('browser_smoke','Client','Authenticated browser smoke checks pass','error','Run the browser smoke check after deployment on desktop and mobile.','Admin > I.T. Readiness',110,true)
on conflict(check_key) do update set
  check_group=excluded.check_group,
  check_title=excluded.check_title,
  severity_if_failed=excluded.severity_if_failed,
  action_hint=excluded.action_hint,
  route_hint=excluded.route_hint,
  sort_order=excluded.sort_order,
  is_enabled=excluded.is_enabled,
  updated_at=now();

alter table public.it_readiness_check_registry enable row level security;
revoke all on table public.it_readiness_check_registry from anon, authenticated;
grant select on table public.it_readiness_check_registry to service_role;

create or replace view public.v_admin_module_access_integrity
with (security_invoker=true)
as
select
  p.id as profile_id,
  coalesce(nullif(p.full_name,''),nullif(p.username,''),nullif(p.email,''),p.id::text) as profile_label,
  lower(coalesce(p.role,'employee')) as role,
  public.ywi_effective_module_access(p.id,'safety') as safety_access,
  public.ywi_effective_module_access(p.id,'finance') as finance_access,
  public.ywi_effective_module_access(p.id,'jobs') as jobs_access,
  public.ywi_effective_module_access(p.id,'admin') as admin_access,
  (
    public.ywi_effective_module_access(p.id,'safety')='manage'
    and public.ywi_effective_module_access(p.id,'finance')='manage'
    and public.ywi_effective_module_access(p.id,'jobs')='manage'
    and public.ywi_effective_module_access(p.id,'admin')='manage'
  ) as all_modules_manage,
  case
    when lower(coalesce(p.role,''))='admin' and not (
      public.ywi_effective_module_access(p.id,'safety')='manage'
      and public.ywi_effective_module_access(p.id,'finance')='manage'
      and public.ywi_effective_module_access(p.id,'jobs')='manage'
      and public.ywi_effective_module_access(p.id,'admin')='manage'
    ) then 1
    else 0
  end as integrity_issue_count
from public.profiles p
where coalesce(p.is_active,true)=true
order by case when lower(coalesce(p.role,''))='admin' then 0 else 1 end,
  coalesce(nullif(p.full_name,''),nullif(p.username,''),nullif(p.email,''),p.id::text);

revoke all on table public.v_admin_module_access_integrity from anon, authenticated;
grant select on table public.v_admin_module_access_integrity to service_role;

create or replace function public.ywi_admin_set_profile_module_permissions(
  p_actor_profile_id uuid,
  p_target_profile_id uuid,
  p_changes jsonb,
  p_reason text default null
)
returns jsonb
language plpgsql
security invoker
set search_path=public
as $$
declare
  v_actor_role text;
  v_target_role text;
  v_item jsonb;
  v_module text;
  v_access text;
  v_previous text;
  v_new text;
  v_reason text := left(coalesce(nullif(trim(p_reason),''),'Updated from Admin module permissions.'),300);
  v_result jsonb;
begin
  select lower(coalesce(role,'')) into v_actor_role
  from public.profiles
  where id=p_actor_profile_id and coalesce(is_active,true)=true;

  if v_actor_role is distinct from 'admin' then
    raise exception 'Active admin role is required to manage module permissions.';
  end if;

  select public.ywi_normalized_profile_role(p_target_profile_id) into v_target_role;
  if not exists(select 1 from public.profiles where id=p_target_profile_id and coalesce(is_active,true)=true) then
    raise exception 'Target profile is missing or inactive.';
  end if;
  if v_target_role='admin' then
    raise exception 'Admin module access is break-glass manage and cannot be overridden.';
  end if;

  if jsonb_typeof(coalesce(p_changes,'[]'::jsonb)) <> 'array' then
    raise exception 'Module changes must be a JSON array.';
  end if;

  for v_item in select value from jsonb_array_elements(coalesce(p_changes,'[]'::jsonb))
  loop
    v_module := lower(coalesce(v_item->>'module_key',''));
    v_access := lower(coalesce(v_item->>'access_level','inherit'));

    if v_module not in ('safety','finance','jobs','admin') then
      raise exception 'Unknown module key: %', v_module;
    end if;
    if v_access not in ('inherit','hidden','view','create','approve','manage') then
      raise exception 'Invalid module access level: %', v_access;
    end if;

    v_previous := public.ywi_effective_module_access(p_target_profile_id,v_module);

    if v_access='inherit' then
      delete from public.app_profile_module_permissions
      where profile_id=p_target_profile_id and module_key=v_module;
    else
      insert into public.app_profile_module_permissions(
        profile_id,module_key,access_level,permission_reason,granted_by_profile_id,granted_at,updated_at
      ) values (
        p_target_profile_id,v_module,v_access,v_reason,p_actor_profile_id,now(),now()
      )
      on conflict(profile_id,module_key) do update set
        access_level=excluded.access_level,
        permission_reason=excluded.permission_reason,
        granted_by_profile_id=excluded.granted_by_profile_id,
        granted_at=now(),
        updated_at=now();
    end if;

    v_new := public.ywi_effective_module_access(p_target_profile_id,v_module);
    if v_previous is distinct from v_new then
      insert into public.app_module_permission_audit(
        target_profile_id,module_key,previous_access_level,new_access_level,change_reason,actor_profile_id
      ) values (
        p_target_profile_id,v_module,v_previous,v_new,v_reason,p_actor_profile_id
      );
    end if;
  end loop;

  select coalesce(jsonb_agg(jsonb_build_object(
    'module_key',m.module_key,
    'module_name',m.module_name,
    'effective_access_level',public.ywi_effective_module_access(p_target_profile_id,m.module_key),
    'override_access_level',o.access_level,
    'permission_source',case when o.access_level is null then 'role_default' else 'profile_override' end,
    'sort_order',m.sort_order
  ) order by m.sort_order),'[]'::jsonb)
  into v_result
  from public.app_modules m
  left join public.app_profile_module_permissions o
    on o.profile_id=p_target_profile_id and o.module_key=m.module_key
  where m.is_enabled=true;

  return v_result;
end;
$$;

revoke all on function public.ywi_admin_set_profile_module_permissions(uuid,uuid,jsonb,text) from public, anon, authenticated;
grant execute on function public.ywi_admin_set_profile_module_permissions(uuid,uuid,jsonb,text) to service_role;

create or replace function public.ywi_it_readiness_security_assertions()
returns table(assertion_key text, assertion_status text, details text)
language sql
stable
security invoker
set search_path=public
as $$
  select 'it_route_admin_manage',
    case when exists(
      select 1 from public.app_module_routes
      where section_id='it' and module_key='admin' and minimum_access_level='manage' and is_enabled=true
    ) then 'passed' else 'failed' end,
    'I.T. Readiness is an Admin/manage route.'
  union all
  select 'all_active_admins_manage_all_modules',
    case when not exists(
      select 1 from public.v_admin_module_access_integrity
      where role='admin' and all_modules_manage=false
    ) then 'passed' else 'failed' end,
    'Every active admin resolves to manage across Safety, Finance, Jobs, and Admin.'
  union all
  select 'admin_override_trigger_present',
    case when exists(
      select 1 from pg_trigger
      where tgname='trg_prevent_admin_module_override' and not tgisinternal
    ) then 'passed' else 'failed' end,
    'Database blocks per-profile module overrides for admin profiles.'
  union all
  select 'admin_permission_rpc_not_public',
    case when not exists(
      select 1 from information_schema.routine_privileges
      where routine_schema='public'
        and routine_name='ywi_admin_set_profile_module_permissions'
        and grantee in ('anon','authenticated','PUBLIC')
        and privilege_type='EXECUTE'
    ) then 'passed' else 'failed' end,
    'Module permission write RPC is service-role only.';
$$;

revoke all on function public.ywi_it_readiness_security_assertions() from public, anon, authenticated;
grant execute on function public.ywi_it_readiness_security_assertions() to service_role;

insert into public.admin_scorecard_progress_rails(
  rail_key,rail_area,rail_title,rail_status,progress_percent,current_value,target_value,
  next_action_hint,owner_hint,sort_order,metadata
) values (
  'schema160_it_readiness','security','I.T. readiness and admin access integrity','active',95,5,6,
  'Deploy admin-it-control and prove the final Admin account can load profiles, sees manage on all modules, and opens I.T. Readiness on desktop/mobile.',
  'I.T. / Admin',75,
  '{"build":"2026-09-01b","schema":160,"it_route":"admin/manage","admin_break_glass":true}'::jsonb
)
on conflict(rail_key) do update set
  rail_area=excluded.rail_area,
  rail_title=excluded.rail_title,
  rail_status=excluded.rail_status,
  progress_percent=excluded.progress_percent,
  current_value=excluded.current_value,
  target_value=excluded.target_value,
  next_action_hint=excluded.next_action_hint,
  owner_hint=excluded.owner_hint,
  sort_order=excluded.sort_order,
  metadata=excluded.metadata,
  updated_at=now();

insert into public.app_schema_versions(
  schema_version,migration_key,schema_name,release_label,description,status,notes
) values (
  160,
  '160_it_readiness_admin_access_integrity',
  '160_it_readiness_admin_access_integrity.sql',
  '2026-09-01b',
  'Adds Admin/I.T. readiness routing, admin full-access invariants, readiness registry, access-integrity view, and atomic service-role module permission writes.',
  'applied',
  'I.T. Readiness is an Admin/manage sub-section, not a fifth top-level module. Active admins always resolve to manage across all four modules and cannot receive per-profile overrides.'
)
on conflict(schema_version) do update set
  migration_key=excluded.migration_key,
  schema_name=excluded.schema_name,
  release_label=excluded.release_label,
  description=excluded.description,
  status=excluded.status,
  notes=excluded.notes,
  applied_at=now();

create or replace view public.v_schema_drift_status as
select 160::int as expected_schema_version,
  coalesce(max(schema_version) filter (where status='applied'),0)::int as latest_applied_schema_version,
  case when coalesce(max(schema_version) filter (where status='applied'),0)>=160 then 'current' else 'behind' end as drift_status,
  case when coalesce(max(schema_version) filter (where status='applied'),0)>=160
    then 'Live database is at or ahead of the repo schema marker.'
    else 'Live database is behind the deployed app. Apply migrations through schema 160.' end as message,
  now() as checked_at
from public.app_schema_versions;

commit;
