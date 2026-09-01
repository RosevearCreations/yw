-- Schema 164: Cross-module event and write boundaries
-- Build 2026-09-01f
--
-- Purpose:
-- - Make every operations-manage action explicitly owned by Safety, Finance, Jobs or Admin.
-- - Eliminate permissive unknown-action authorization fallbacks.
-- - Record minimum access, read/write/disabled mode, domain, and event contract per action.
-- - Emit private boundary events for declared cross-module effects through the protected server path.
-- - Preserve Shared Core canonical storage; no customer/job/person/site/equipment/asset/document tables are created here.

begin;

create table if not exists public.app_module_write_contracts (
  action_key text primary key,
  owner_module text not null,
  minimum_access text not null,
  boundary_mode text not null,
  domain_key text not null,
  event_key text,
  cross_module_event boolean not null default false,
  is_enabled boolean not null default true,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint app_module_write_contracts_owner_check check (owner_module in ('safety','finance','jobs','admin')),
  constraint app_module_write_contracts_access_check check (minimum_access in ('view','create','approve','manage')),
  constraint app_module_write_contracts_mode_check check (boundary_mode in ('read','write','disabled')),
  constraint app_module_write_contracts_cross_event_check check (cross_module_event=false or event_key is not null)
);

alter table public.app_module_write_contracts enable row level security;
revoke all on table public.app_module_write_contracts from public, anon, authenticated;
grant select on table public.app_module_write_contracts to service_role;

insert into public.app_module_write_contracts(
  action_key,owner_module,minimum_access,boundary_mode,domain_key,event_key,cross_module_event,is_enabled,description
) values
  ('operations_queue_list','admin','view','read','operations_control_plane',null,false,true,'Read the protected Operations queue snapshot.'),

  ('payment_action_request','finance','create','write','payments','finance.payment_action.requested',false,true,'Create a controlled payment-action request.'),
  ('payment_action_decision','finance','approve','write','payments','finance.payment_action.decided',false,true,'Approve, reject, post or cancel a payment-action request.'),
  ('bank_csv_preview','finance','create','write','banking','finance.bank_import.previewed',false,true,'Create a validated bank CSV preview.'),
  ('bank_csv_confirm_import','finance','approve','write','banking','finance.bank_import.promoted',false,true,'Promote an approved bank CSV preview into reconciliation.'),
  ('reconciliation_suggest','finance','view','read','reconciliation',null,false,true,'Read reconciliation match suggestions.'),
  ('reconciliation_action','finance','approve','write','reconciliation','finance.reconciliation.changed',false,true,'Apply an approved reconciliation action.'),
  ('job_cost_refresh','finance','view','write','job_costing','finance.job_cost.refreshed',true,true,'Refresh Finance job-cost projections from canonical Jobs execution evidence.'),
  ('deposit_status_update','finance','manage','disabled','payments','finance.deposit.manual_update_blocked',false,true,'Manual hosted-payment lifecycle mutation is intentionally disabled.'),

  ('equipment_scan_event','jobs','create','write','equipment_custody','jobs.equipment.scanned',false,true,'Record field equipment custody/condition evidence.'),
  ('equipment_cost_recovery_decision','jobs','approve','write','equipment_cost_recovery','jobs.equipment.cost_recovery_decided',true,true,'Decide equipment cost recovery and expose a declared Finance-facing event.'),
  ('quote_owner_assign','jobs','approve','write','quote_operations','jobs.quote.owner_assigned',false,true,'Assign operational quote ownership.'),
  ('quote_followup_event','jobs','approve','write','quote_operations','jobs.quote.followup_recorded',false,true,'Record an operational quote follow-up event.'),
  ('dispatch_schedule','jobs','approve','write','dispatch','jobs.dispatch.scheduled',false,true,'Schedule or update dispatch.'),
  ('work_order_live_update_create','jobs','create','write','work_order_updates','jobs.work_order.update_created',true,true,'Create a work-order update consumed by customer/shared surfaces.'),
  ('work_order_live_update_retract','jobs','approve','write','work_order_updates','jobs.work_order.update_retracted',true,true,'Retract a published work-order update and emit the declared boundary event.'),
  ('work_order_execution_proof_submit','jobs','create','write','execution_proof','jobs.execution_proof.submitted',true,true,'Submit execution evidence used by downstream closeout/costing surfaces.'),
  ('work_order_execution_proof_decision','jobs','approve','write','execution_proof','jobs.execution_proof.decided',true,true,'Approve or reject execution evidence and emit the declared boundary event.'),
  ('work_order_closeout_submit','jobs','approve','write','closeout','jobs.closeout.submitted',true,true,'Submit a closeout package used by customer/Finance follow-up surfaces.'),
  ('work_order_closeout_decision','jobs','approve','write','closeout','jobs.closeout.decided',true,true,'Decide a closeout package and emit the declared boundary event.'),
  ('customer_notification_retry','jobs','manage','write','customer_notifications','jobs.customer_notification.retried',true,true,'Retry a Jobs-owned customer notification through the protected delivery contract.'),

  ('visual_asset_register','admin','manage','write','public_content','admin.visual_asset.registered',false,true,'Register a private/review visual asset record.'),
  ('visual_asset_decision','admin','manage','write','public_content','admin.visual_asset.decided',false,true,'Approve or reject a visual asset.'),
  ('public_route_register','admin','manage','write','public_content','admin.public_route.registered',false,true,'Register a public route candidate.'),
  ('public_route_decision','admin','manage','write','public_content','admin.public_route.decided',false,true,'Approve or reject a public route candidate.'),
  ('public_route_publish','admin','manage','write','public_content','admin.public_route.published',false,true,'Publish an approved public route.'),
  ('offline_conflict_card','admin','manage','write','offline_sync','admin.offline_conflict.recorded',false,true,'Record a mobile/offline synchronization conflict.'),
  ('offline_conflict_resolve','admin','manage','write','offline_sync','admin.offline_conflict.resolved',false,true,'Resolve a mobile/offline synchronization conflict.'),
  ('scorecard_update','admin','manage','write','scorecard','admin.scorecard.updated',false,true,'Update an Admin progress rail.'),
  ('staging_fixture_create','admin','manage','write','staging_control','admin.staging_fixture.created',false,true,'Create explicitly enabled staging-only fixtures.'),
  ('staging_fixture_cleanup','admin','manage','write','staging_control','admin.staging_fixture.cleaned',false,true,'Remove staging-only fixtures.'),
  ('content_signal_record','admin','manage','write','content_signals','admin.content_signal.recorded',false,true,'Record a controlled SEO/content signal observation.'),
  ('content_signal_decision','admin','manage','write','content_signals','admin.content_signal.decided',false,true,'Record an Admin content-signal decision.'),
  ('stripe_webhook_alert_decision','admin','manage','write','payment_operations','admin.stripe_alert.decided',false,true,'Acknowledge or resolve a Stripe operational alert without mutating payment truth.'),
  ('release_readiness_capture','admin','manage','write','release_readiness','admin.release_readiness.captured',false,true,'Capture a protected release-readiness evidence snapshot.')
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

alter table public.operation_write_audit_events
  add column if not exists boundary_owner_module text,
  add column if not exists boundary_minimum_access text,
  add column if not exists boundary_mode text,
  add column if not exists boundary_event_key text,
  add column if not exists cross_module_event boolean not null default false;

create index if not exists operation_write_audit_events_boundary_idx
  on public.operation_write_audit_events(boundary_owner_module, operation_action, created_at desc);

create table if not exists public.module_boundary_events (
  id uuid primary key default gen_random_uuid(),
  event_key text not null,
  source_module text not null,
  operation_action text not null,
  domain_key text not null,
  entity_type text,
  entity_id uuid,
  actor_profile_id uuid,
  event_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint module_boundary_events_source_check check (source_module in ('safety','finance','jobs','admin'))
);
create index if not exists module_boundary_events_event_created_idx
  on public.module_boundary_events(event_key, created_at desc);
create index if not exists module_boundary_events_source_created_idx
  on public.module_boundary_events(source_module, created_at desc);

alter table public.module_boundary_events enable row level security;
revoke all on table public.module_boundary_events from public, anon, authenticated;
grant select, insert on table public.module_boundary_events to service_role;

create or replace view public.v_operation_write_audit_events as
select id, event_key, operation_action, operation_status, entity_type, entity_id,
       actor_profile_id, error_message, created_at,
       boundary_owner_module, boundary_minimum_access, boundary_mode,
       boundary_event_key, cross_module_event
from public.operation_write_audit_events
order by created_at desc;

create or replace view public.v_module_boundary_event_contract_status
with (security_invoker=true)
as
select
  action_key,
  owner_module,
  minimum_access,
  boundary_mode,
  domain_key,
  event_key,
  cross_module_event,
  is_enabled,
  (is_enabled and owner_module in ('safety','finance','jobs','admin')
    and minimum_access in ('view','create','approve','manage')
    and boundary_mode in ('read','write','disabled')
    and (not cross_module_event or event_key is not null)) as contract_ready
from public.app_module_write_contracts
order by owner_module, action_key;

revoke all on table public.v_module_boundary_event_contract_status from public, anon, authenticated;
grant select on table public.v_module_boundary_event_contract_status to service_role;

create or replace function public.ywi_module_write_boundary_security_assertions()
returns table(assertion_key text, assertion_status text, details text)
language sql
stable
security invoker
set search_path=public
as $$
  select 'operations_action_contract_count',
    case when (select count(*) from public.app_module_write_contracts where is_enabled)=35 then 'passed' else 'failed' end,
    'Exactly 35 explicitly handled operations-manage actions have enabled write-boundary contracts.'
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
        and table_name in ('app_module_write_contracts','module_boundary_events','v_module_boundary_event_contract_status')
        and grantee in ('anon','authenticated','PUBLIC')
    ) then 'passed' else 'failed' end,
    'Boundary contracts and emitted boundary events remain private server control-plane data.';
$$;

revoke all on function public.ywi_module_write_boundary_security_assertions() from public, anon, authenticated;
grant execute on function public.ywi_module_write_boundary_security_assertions() to service_role;

insert into public.it_readiness_check_registry(
  check_key,check_group,check_title,severity_if_failed,action_hint,route_hint,sort_order,is_enabled
) values (
  'cross_module_write_boundaries','Architecture','Cross-module writes use explicit action and event contracts','critical',
  'Keep every operations-manage action in the fail-closed module write-boundary registry. Unknown actions must be rejected before business handlers run; cross-module effects require a named event key.',
  'Admin > I.T. Readiness',39,true
)
on conflict(check_key) do update set
  check_group=excluded.check_group,
  check_title=excluded.check_title,
  severity_if_failed=excluded.severity_if_failed,
  action_hint=excluded.action_hint,
  route_hint=excluded.route_hint,
  sort_order=excluded.sort_order,
  is_enabled=excluded.is_enabled,
  updated_at=now();

update public.admin_scorecard_progress_rails
set rail_status='complete', progress_percent=100, current_value=10, target_value=10,
    next_action_hint='Schema 164 now owns the next architecture checkpoint: explicit server-side write and event boundaries.',
    updated_at=now()
where rail_key='schema163_core_data_service';

insert into public.admin_scorecard_progress_rails(
  rail_key,rail_area,rail_title,rail_status,progress_percent,current_value,target_value,
  next_action_hint,owner_hint,sort_order,metadata
) values (
  'schema164_cross_module_write_boundaries','architecture','Cross-module event and write boundaries','active',90,9,10,
  'Complete source/runtime acceptance proving all 35 operations actions are explicitly contracted and unknown actions fail closed.',
  'I.T. / Architecture',79,
  '{"build":"2026-09-01f","schema":164,"action_contracts":35,"unknown_actions":"fail_closed","cross_module_events":"private"}'::jsonb
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
  164,
  '164_cross_module_event_write_boundaries',
  '164_cross_module_event_write_boundaries.sql',
  '2026-09-01f',
  'Registers fail-closed server write contracts and private named boundary events for the 35 operations-manage actions.',
  'applied',
  'Control-plane and event-boundary release only. Shared Core canonical business identity storage is unchanged.'
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
select 164::int as expected_schema_version,
  coalesce(max(schema_version) filter (where status='applied'),0)::int as latest_applied_schema_version,
  case when coalesce(max(schema_version) filter (where status='applied'),0)>=164 then 'current' else 'behind' end as drift_status,
  case when coalesce(max(schema_version) filter (where status='applied'),0)>=164
    then 'Live database is at or ahead of the repo schema marker.'
    else 'Live database is behind the deployed app. Apply migrations through schema 164.' end as message,
  now() as checked_at
from public.app_schema_versions;

commit;
