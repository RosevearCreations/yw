-- Schema 159: Module boundaries and permission-gated navigation
-- Purpose:
-- - Split the authenticated application into Safety/OHSA, Finance, Jobs, and Admin modules.
-- - Keep role as an approval/action tier, but make module visibility independently assignable.
-- - Allow a profile to be Safety-only even if its role would historically have exposed Jobs.
-- - Provide one effective-permission source for browser navigation and Edge Function enforcement.
-- - Preserve server-side checks; hiding a menu item is never treated as authorization.

begin;

create table if not exists public.app_modules (
  module_key text primary key,
  module_name text not null,
  module_description text,
  default_section_id text not null,
  icon_key text,
  sort_order integer not null default 100,
  is_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint app_modules_key_check check (module_key in ('safety','finance','jobs','admin'))
);

create table if not exists public.app_module_routes (
  section_id text primary key,
  module_key text not null references public.app_modules(module_key) on delete cascade,
  section_label text not null,
  minimum_access_level text not null default 'view',
  sort_order integer not null default 100,
  is_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint app_module_routes_access_check check (minimum_access_level in ('view','create','approve','manage'))
);

create table if not exists public.app_role_module_permissions (
  role text not null,
  module_key text not null references public.app_modules(module_key) on delete cascade,
  access_level text not null default 'hidden',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (role, module_key),
  constraint app_role_module_permissions_level_check check (access_level in ('hidden','view','create','approve','manage'))
);

create table if not exists public.app_profile_module_permissions (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  module_key text not null references public.app_modules(module_key) on delete cascade,
  access_level text not null default 'hidden',
  permission_reason text,
  granted_by_profile_id uuid references public.profiles(id) on delete set null,
  granted_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (profile_id, module_key),
  constraint app_profile_module_permissions_level_check check (access_level in ('hidden','view','create','approve','manage'))
);

create table if not exists public.app_module_permission_audit (
  id uuid primary key default gen_random_uuid(),
  target_profile_id uuid not null references public.profiles(id) on delete cascade,
  module_key text not null references public.app_modules(module_key) on delete restrict,
  previous_access_level text,
  new_access_level text not null,
  change_reason text,
  actor_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint app_module_permission_audit_level_check check (new_access_level in ('hidden','view','create','approve','manage'))
);

create index if not exists idx_app_module_routes_module on public.app_module_routes(module_key, sort_order);
create index if not exists idx_app_profile_module_permissions_profile on public.app_profile_module_permissions(profile_id, module_key);
create index if not exists idx_app_module_permission_audit_target on public.app_module_permission_audit(target_profile_id, created_at desc);

insert into public.app_modules(module_key,module_name,module_description,default_section_id,icon_key,sort_order,is_enabled)
values
  ('safety','Safety / OHSA','Ontario safety workflows: toolbox talks, PPE, first aid, incidents, inspections, drills, logbook, and safety operations.','toolbox','shield',10,true),
  ('finance','Finance','Accounting, payment, bank reconciliation, close, tax/payroll review, and accountant handoff.','finance','calculator',20,true),
  ('jobs','Jobs','Today, crews, jobs, dispatch, field execution, equipment, proof, and closeout.','today','briefcase',30,true),
  ('admin','Admin','People, access, configuration, integrations, media/SEO approvals, release readiness, and system controls.','admin','settings',40,true)
on conflict(module_key) do update set
  module_name=excluded.module_name,
  module_description=excluded.module_description,
  default_section_id=excluded.default_section_id,
  icon_key=excluded.icon_key,
  sort_order=excluded.sort_order,
  is_enabled=excluded.is_enabled,
  updated_at=now();

insert into public.app_module_routes(section_id,module_key,section_label,minimum_access_level,sort_order,is_enabled)
values
  ('toolbox','safety','Toolbox Talk','create',10,true),
  ('ppe','safety','PPE Check','create',20,true),
  ('firstaid','safety','First Aid Kit','create',30,true),
  ('incident','safety','Incident / Near Miss','create',40,true),
  ('inspect','safety','Site Inspection','create',50,true),
  ('drill','safety','Emergency Drill','create',60,true),
  ('log','safety','Logbook','view',70,true),
  ('reports','safety','Safety Reports','approve',80,true),
  ('hseops','safety','Safety Operations','approve',90,true),
  ('finance','finance','Finance Home','view',10,true),
  ('today','jobs','Today','view',10,true),
  ('crew','jobs','Crew','approve',20,true),
  ('jobs','jobs','Jobs','view',30,true),
  ('equipment','jobs','Equipment','create',40,true),
  ('admin','admin','Admin Control Center','view',10,true)
on conflict(section_id) do update set
  module_key=excluded.module_key,
  section_label=excluded.section_label,
  minimum_access_level=excluded.minimum_access_level,
  sort_order=excluded.sort_order,
  is_enabled=excluded.is_enabled,
  updated_at=now();

-- Role defaults preserve familiar day-to-day access, while profile overrides can make any
-- non-admin profile Safety-only, Jobs-only, Finance-only, or any combination.
insert into public.app_role_module_permissions(role,module_key,access_level,notes)
values
  ('worker','safety','create','Legacy worker alias.'),
  ('worker','finance','hidden','Finance is opt-in.'),
  ('worker','jobs','create','Legacy worker field access.'),
  ('worker','admin','hidden','Admin is restricted.'),
  ('employee','safety','create','Standard field safety access.'),
  ('employee','finance','hidden','Finance is opt-in.'),
  ('employee','jobs','create','Standard field job access.'),
  ('employee','admin','hidden','Admin is restricted.'),
  ('staff','safety','create','Legacy staff alias.'),
  ('staff','finance','hidden','Finance is opt-in.'),
  ('staff','jobs','create','Legacy staff field access.'),
  ('staff','admin','hidden','Admin is restricted.'),
  ('onsite_admin','safety','create','Onsite safety capture.'),
  ('onsite_admin','finance','hidden','Finance is opt-in.'),
  ('onsite_admin','jobs','create','Onsite field job access.'),
  ('onsite_admin','admin','hidden','System Admin is restricted.'),
  ('site_leader','safety','approve','May review field safety evidence.'),
  ('site_leader','finance','hidden','Finance is opt-in.'),
  ('site_leader','jobs','approve','May lead field execution.'),
  ('site_leader','admin','hidden','System Admin is restricted.'),
  ('supervisor','safety','approve','Supervisor safety review.'),
  ('supervisor','finance','view','Read-only finance visibility by default.'),
  ('supervisor','jobs','approve','Supervisor jobs and field execution.'),
  ('supervisor','admin','hidden','Admin is opt-in for supervisors.'),
  ('hse','safety','manage','HSE manages safety workflows.'),
  ('hse','finance','hidden','Finance is opt-in.'),
  ('hse','jobs','view','HSE may view job context needed for safety.'),
  ('hse','admin','hidden','Admin is opt-in.'),
  ('job_admin','safety','view','Job admin can review safety context.'),
  ('job_admin','finance','manage','Job admin manages commercial/accounting workflow.'),
  ('job_admin','jobs','manage','Job admin manages jobs.'),
  ('job_admin','admin','hidden','Admin is opt-in for job admins.'),
  ('admin','safety','manage','Admin break-glass access.'),
  ('admin','finance','manage','Admin break-glass access.'),
  ('admin','jobs','manage','Admin break-glass access.'),
  ('admin','admin','manage','Admin cannot be module-locked out.')
on conflict(role,module_key) do update set
  access_level=excluded.access_level,
  notes=excluded.notes,
  updated_at=now();

create or replace function public.ywi_module_access_rank(p_access_level text)
returns integer
language sql
immutable
as $$
  select case lower(coalesce(p_access_level,'hidden'))
    when 'view' then 10
    when 'create' then 20
    when 'approve' then 30
    when 'manage' then 40
    else 0
  end;
$$;

create or replace function public.ywi_normalized_profile_role(p_profile_id uuid)
returns text
language sql
stable
security definer
set search_path=public
as $$
  select case lower(coalesce((select role from public.profiles where id=p_profile_id and coalesce(is_active,true)=true),'employee'))
    when 'worker' then 'employee'
    when 'staff' then 'employee'
    else lower(coalesce((select role from public.profiles where id=p_profile_id and coalesce(is_active,true)=true),'employee'))
  end;
$$;

create or replace function public.ywi_effective_module_access(p_profile_id uuid, p_module_key text)
returns text
language plpgsql
stable
security definer
set search_path=public
as $$
declare
  v_module text := lower(coalesce(p_module_key,''));
  v_role text;
  v_override text;
  v_default text;
begin
  if p_profile_id is null or v_module not in ('safety','finance','jobs','admin') then
    return 'hidden';
  end if;
  v_role := public.ywi_normalized_profile_role(p_profile_id);
  if v_role='admin' then return 'manage'; end if;

  select access_level into v_override
  from public.app_profile_module_permissions
  where profile_id=p_profile_id and module_key=v_module;
  if v_override is not null then return v_override; end if;

  select access_level into v_default
  from public.app_role_module_permissions
  where role=v_role and module_key=v_module;
  return coalesce(v_default,'hidden');
end;
$$;

create or replace function public.ywi_profile_has_module_access(p_profile_id uuid, p_module_key text, p_minimum_level text default 'view')
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select public.ywi_module_access_rank(public.ywi_effective_module_access(p_profile_id,p_module_key))
       >= public.ywi_module_access_rank(p_minimum_level);
$$;

create or replace function public.ywi_get_my_module_permissions()
returns table(
  module_key text,
  module_name text,
  module_description text,
  default_section_id text,
  access_level text,
  access_rank integer,
  permission_source text,
  is_visible boolean,
  sort_order integer
)
language sql
stable
security definer
set search_path=public
as $$
  select
    m.module_key,
    m.module_name,
    m.module_description,
    m.default_section_id,
    public.ywi_effective_module_access(auth.uid(),m.module_key) as access_level,
    public.ywi_module_access_rank(public.ywi_effective_module_access(auth.uid(),m.module_key)) as access_rank,
    case
      when public.ywi_normalized_profile_role(auth.uid())='admin' then 'admin_break_glass'
      when exists(select 1 from public.app_profile_module_permissions p where p.profile_id=auth.uid() and p.module_key=m.module_key) then 'profile_override'
      else 'role_default'
    end as permission_source,
    public.ywi_module_access_rank(public.ywi_effective_module_access(auth.uid(),m.module_key)) > 0 as is_visible,
    m.sort_order
  from public.app_modules m
  where m.is_enabled=true
  order by m.sort_order,m.module_key;
$$;

create or replace function public.ywi_get_profile_module_permissions(p_profile_id uuid)
returns table(
  module_key text,
  module_name text,
  default_access_level text,
  override_access_level text,
  effective_access_level text,
  permission_source text,
  sort_order integer
)
language sql
stable
security definer
set search_path=public
as $$
  select
    m.module_key,
    m.module_name,
    coalesce(r.access_level,'hidden') as default_access_level,
    o.access_level as override_access_level,
    public.ywi_effective_module_access(p_profile_id,m.module_key) as effective_access_level,
    case
      when public.ywi_normalized_profile_role(p_profile_id)='admin' then 'admin_break_glass'
      when o.access_level is not null then 'profile_override'
      else 'role_default'
    end as permission_source,
    m.sort_order
  from public.app_modules m
  left join public.app_role_module_permissions r
    on r.role=public.ywi_normalized_profile_role(p_profile_id) and r.module_key=m.module_key
  left join public.app_profile_module_permissions o
    on o.profile_id=p_profile_id and o.module_key=m.module_key
  where m.is_enabled=true
  order by m.sort_order,m.module_key;
$$;

create or replace view public.v_app_module_route_registry as
select
  r.section_id,
  r.section_label,
  r.minimum_access_level,
  r.sort_order as section_sort_order,
  m.module_key,
  m.module_name,
  m.default_section_id,
  m.sort_order as module_sort_order
from public.app_module_routes r
join public.app_modules m on m.module_key=r.module_key
where r.is_enabled=true and m.is_enabled=true
order by m.sort_order,r.sort_order;

alter table public.app_modules enable row level security;
alter table public.app_module_routes enable row level security;
alter table public.app_role_module_permissions enable row level security;
alter table public.app_profile_module_permissions enable row level security;
alter table public.app_module_permission_audit enable row level security;

drop policy if exists app_modules_authenticated_read on public.app_modules;
create policy app_modules_authenticated_read on public.app_modules for select to authenticated using (is_enabled=true);

drop policy if exists app_module_routes_authenticated_read on public.app_module_routes;
create policy app_module_routes_authenticated_read on public.app_module_routes for select to authenticated using (is_enabled=true);

drop policy if exists app_profile_module_permissions_self_read on public.app_profile_module_permissions;
create policy app_profile_module_permissions_self_read on public.app_profile_module_permissions for select to authenticated using (profile_id=auth.uid());

-- Effective permissions are intentionally fetched through RPC. Direct browser writes are denied.
revoke all on table public.app_role_module_permissions from anon, authenticated;
revoke insert, update, delete on table public.app_profile_module_permissions from anon, authenticated;
revoke all on table public.app_module_permission_audit from anon, authenticated;

revoke all on function public.ywi_effective_module_access(uuid,text) from public;
revoke all on function public.ywi_profile_has_module_access(uuid,text,text) from public;
revoke all on function public.ywi_get_profile_module_permissions(uuid) from public;
grant execute on function public.ywi_effective_module_access(uuid,text) to service_role;
grant execute on function public.ywi_profile_has_module_access(uuid,text,text) to service_role;
grant execute on function public.ywi_get_profile_module_permissions(uuid) to service_role;

revoke all on function public.ywi_get_my_module_permissions() from public;
grant execute on function public.ywi_get_my_module_permissions() to authenticated;

-- Extend the security proof surface so staging can confirm module tables and RPC exposure.
create or replace function public.ywi_module_security_assertions()
returns table(assertion_key text, assertion_status text, details text)
language sql
stable
security definer
set search_path=public
as $$
  select 'module_registry_present', case when to_regclass('public.app_modules') is not null then 'passed' else 'failed' end,
    'Module registry exists.'
  union all
  select 'profile_module_override_present', case when to_regclass('public.app_profile_module_permissions') is not null then 'passed' else 'failed' end,
    'Per-profile module override table exists.'
  union all
  select 'effective_module_access_not_public', case when not exists(
    select 1 from information_schema.routine_privileges rp
    where rp.routine_schema='public' and rp.routine_name='ywi_effective_module_access'
      and rp.grantee in ('anon','authenticated') and rp.privilege_type='EXECUTE'
  ) then 'passed' else 'failed' end,
    'The arbitrary-profile effective permission helper is service-role only.'
  union all
  select 'my_module_permissions_authenticated_only', case when exists(
    select 1 from information_schema.routine_privileges rp
    where rp.routine_schema='public' and rp.routine_name='ywi_get_my_module_permissions'
      and rp.grantee='authenticated' and rp.privilege_type='EXECUTE'
  ) and not exists(
    select 1 from information_schema.routine_privileges rp
    where rp.routine_schema='public' and rp.routine_name='ywi_get_my_module_permissions'
      and rp.grantee='anon' and rp.privilege_type='EXECUTE'
  ) then 'passed' else 'failed' end,
    'A signed-in user can retrieve only their effective module matrix.';
$$;

revoke all on function public.ywi_module_security_assertions() from public;
grant execute on function public.ywi_module_security_assertions() to service_role;

insert into public.admin_scorecard_progress_rails (
  rail_key, rail_area, rail_title, rail_status, progress_percent,
  current_value, target_value, next_action_hint, owner_hint, sort_order, metadata
) values (
  'schema159_module_permissions','security','Module boundaries and per-profile access','active',92,4,5,
  'In staging, assign one profile Safety-only and prove Finance, Jobs, and Admin are absent from navigation and denied server-side while Safety forms remain usable.',
  'Admin / HSE / Operations',70,'{"build":"2026-09-01a","schema":159,"modules":["safety","finance","jobs","admin"],"server_enforced":true}'::jsonb
)
on conflict (rail_key) do update set
  rail_area=excluded.rail_area, rail_title=excluded.rail_title, rail_status=excluded.rail_status,
  progress_percent=excluded.progress_percent, current_value=excluded.current_value, target_value=excluded.target_value,
  next_action_hint=excluded.next_action_hint, owner_hint=excluded.owner_hint, sort_order=excluded.sort_order,
  metadata=excluded.metadata, updated_at=now();

insert into public.app_schema_versions(
  schema_version,migration_key,schema_name,release_label,description,status,notes
) values (
  159,
  '159_module_boundaries_permission_gated_navigation',
  '159_module_boundaries_permission_gated_navigation.sql',
  '2026-09-01a',
  'Adds Safety/OHSA, Finance, Jobs, and Admin module registry, role defaults, per-profile overrides, effective permission RPCs, route registry, audit trail, and staging assertions.',
  'applied',
  'Module visibility is independent from approval role. Admin remains break-glass manage. Hiding a route is never authorization; Edge Functions must enforce effective module access.'
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
select 159::int as expected_schema_version,
  coalesce(max(schema_version) filter (where status='applied'),0)::int as latest_applied_schema_version,
  case when coalesce(max(schema_version) filter (where status='applied'),0)>=159 then 'current' else 'behind' end as drift_status,
  case when coalesce(max(schema_version) filter (where status='applied'),0)>=159
    then 'Live database is at or ahead of the repo schema marker.'
    else 'Live database is behind the deployed app. Apply migrations through schema 159.' end as message,
  now() as checked_at
from public.app_schema_versions;

commit;
