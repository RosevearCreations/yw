begin;

-- Schema 209 — Build 320 Operations Needs Attention.
-- Adds only durable operator disposition state for the cross-business attention queue.
-- Source business records remain owned by Jobs, Safety, Finance and existing Core identities.

create table if not exists public.operations_attention_states (
  source_key text primary key,
  source_module text not null,
  source_type text not null,
  source_id text not null,
  source_title text,
  source_context text,
  source_priority text,
  source_due_at timestamptz,
  state_status text not null default 'open',
  owner_profile_id uuid references public.profiles(id) on delete set null,
  deferred_until timestamptz,
  state_note text,
  resolved_at timestamptz,
  resolved_by_profile_id uuid references public.profiles(id) on delete set null,
  last_source_seen_at timestamptz,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  updated_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint operations_attention_states_module_chk check (source_module in ('safety','finance','jobs','admin')),
  constraint operations_attention_states_status_chk check (state_status in ('open','deferred','resolved')),
  constraint operations_attention_states_key_chk check (length(btrim(source_key)) between 3 and 240),
  constraint operations_attention_states_source_chk check (length(btrim(source_type)) between 1 and 100 and length(btrim(source_id)) between 1 and 180),
  constraint operations_attention_states_defer_chk check (
    (state_status='deferred' and deferred_until is not null and resolved_at is null)
    or (state_status='resolved' and resolved_at is not null)
    or (state_status='open' and resolved_at is null)
  )
);

create index if not exists operations_attention_states_status_due_idx
  on public.operations_attention_states(state_status,deferred_until,updated_at desc);
create index if not exists operations_attention_states_source_idx
  on public.operations_attention_states(source_module,source_type,source_id);

alter table public.operations_attention_states enable row level security;
revoke all on table public.operations_attention_states from public,anon,authenticated;
grant select,insert,update on table public.operations_attention_states to service_role;

insert into public.app_module_write_contracts(
  action_key,owner_module,minimum_access,boundary_mode,domain_key,event_key,cross_module_event,is_enabled,description
) values
  ('operations_attention_defer','admin','manage','write','operations_attention','admin.operations_attention.deferred',false,true,'Defer one management attention item without changing the source business record.'),
  ('operations_attention_resolve','admin','manage','write','operations_attention','admin.operations_attention.resolved',false,true,'Resolve one management attention item while preserving source-record authority and history.')
on conflict(action_key) do update set
  owner_module=excluded.owner_module,
  minimum_access=excluded.minimum_access,
  boundary_mode=excluded.boundary_mode,
  domain_key=excluded.domain_key,
  event_key=excluded.event_key,
  cross_module_event=excluded.cross_module_event,
  is_enabled=excluded.is_enabled,
  description=excluded.description,
  updated_at=now();

create or replace function public.ywi_module_write_boundary_security_assertions()
returns table(assertion_key text, assertion_status text, details text)
language sql
stable
security invoker
set search_path=public
as $$
  select 'operations_action_contract_count',
    case when (select count(*) from public.app_module_write_contracts where is_enabled)=37 then 'passed' else 'failed' end,
    'Exactly 37 explicitly handled operations-manage actions have enabled write-boundary contracts.'
  union all
  select 'cross_module_events_named',
    case when not exists (
      select 1 from public.app_module_write_contracts
      where is_enabled and cross_module_event and event_key is null
    ) then 'passed' else 'failed' end,
    'Every declared cross-module effect has a stable event key.'
  union all
  select 'manual_deposit_mutation_disabled',
    case when exists (
      select 1 from public.app_module_write_contracts
      where action_key='deposit_status_update' and owner_module='finance' and boundary_mode='disabled' and is_enabled
    ) then 'passed' else 'failed' end,
    'Hosted payment truth cannot be manually changed through operations-manage.'
  union all
  select 'boundary_control_plane_private',
    case when not exists (
      select 1 from information_schema.table_privileges
      where table_schema='public'
        and table_name in ('app_module_write_contracts','module_boundary_events','v_module_boundary_event_contract_status','operations_attention_states')
        and grantee in ('anon','authenticated','PUBLIC')
    ) then 'passed' else 'failed' end,
    'Boundary contracts, emitted events and attention disposition state remain private server control-plane data.';
$$;
revoke all on function public.ywi_module_write_boundary_security_assertions() from public,anon,authenticated;
grant execute on function public.ywi_module_write_boundary_security_assertions() to service_role;

create or replace function public.ywi_operations_attention_security_assertions()
returns table(assertion_key text,assertion_status text,assertion_detail text)
language sql
stable
security invoker
set search_path=public
as $$
  select 'attention_state_rls_enabled',
    case when coalesce((select relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='operations_attention_states'),false)
      then 'passed' else 'failed' end,
    'Build 320 disposition state has RLS enabled.'
  union all
  select 'attention_state_browser_private',
    case when not exists(
      select 1 from information_schema.table_privileges
      where table_schema='public' and table_name='operations_attention_states'
        and grantee in ('anon','authenticated','PUBLIC')
    ) then 'passed' else 'failed' end,
    'Attention state is not directly readable or writable from public browser roles.'
  union all
  select 'attention_actions_registered',
    case when (select count(*) from public.app_module_write_contracts
      where action_key in ('operations_attention_defer','operations_attention_resolve')
        and owner_module='admin' and minimum_access='manage' and boundary_mode='write' and is_enabled)=2
      then 'passed' else 'failed' end,
    'Defer and resolve are explicit Admin-manage server write contracts.'
  union all
  select 'finance_provider_execution_off',
    case when not exists(
      select 1 from public.finance_job_completion_posting_execution_controls
      where execution_enabled=true or provider_mutation_enabled=true
    ) then 'passed' else 'failed' end,
    'Build 320 does not enable Finance posting or payment-provider mutation.';
$$;
revoke all on function public.ywi_operations_attention_security_assertions() from public,anon,authenticated;
grant execute on function public.ywi_operations_attention_security_assertions() to service_role;

insert into public.app_schema_versions(
  schema_version,schema_name,description,status,applied_at,applied_by,notes,migration_key,release_label
) values (
  209,'209_operations_needs_attention',
  'Adds private durable defer/resolve state and registered Admin management actions for Build 320 Operations Needs Attention.',
  'applied',now(),'schema209',
  'Source Jobs, Safety, Finance, workforce, equipment and customer records remain authoritative. No Finance/provider/staging/customer/Production promotion mutation.',
  '209_operations_needs_attention.sql','schema209'
)
on conflict(schema_version) do update set
  schema_name=excluded.schema_name,description=excluded.description,status='applied',applied_at=now(),
  applied_by=excluded.applied_by,notes=excluded.notes,migration_key=excluded.migration_key,release_label=excluded.release_label;

create or replace view public.v_schema_drift_status
with (security_invoker=true)
as
select
  209 as expected_schema_version,
  coalesce(max(schema_version) filter(where status='applied'),0) as latest_applied_schema_version,
  case
    when coalesce(max(schema_version) filter(where status='applied'),0)=209 then 'current'
    when coalesce(max(schema_version) filter(where status='applied'),0)>209 then 'ahead'
    else 'drift'
  end as drift_status,
  case
    when coalesce(max(schema_version) filter(where status='applied'),0)=209 then 'Live database matches the repository schema marker.'
    when coalesce(max(schema_version) filter(where status='applied'),0)>209 then 'Live database is ahead of the repository schema marker.'
    else 'Live database is behind the repository schema marker.'
  end as message,
  now() as checked_at
from public.app_schema_versions;
revoke all on table public.v_schema_drift_status from public,anon,authenticated;
grant select on table public.v_schema_drift_status to service_role;

commit;
