-- Schema 152: Staging-proof harness, visible action permissions, Stripe health,
-- reconciliation review detail, and secure accountant export packaging.
-- Build 2026-06-22a.

begin;

-- ---------------------------------------------------------------------------
-- Visible Operations Cockpit permissions: the server remains authoritative,
-- while the interface can explain a disabled action before it is clicked.
-- ---------------------------------------------------------------------------
create or replace function public.ywi_get_operations_capabilities(p_actor_profile_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_role text := lower(coalesce((select role from public.profiles where id = p_actor_profile_id and coalesce(is_active,true) is true), ''));
  v_rank integer := coalesce(public.ywi_profile_rank(p_actor_profile_id), 0);
  v_actions jsonb;
begin
  select coalesce(jsonb_object_agg(action_key,
    jsonb_build_object(
      'label', label,
      'minimum_role', minimum_role,
      'minimum_rank', minimum_rank,
      'permitted', v_rank >= minimum_rank,
      'reason', case when v_rank >= minimum_rank then 'Allowed for your role.' else 'Requires ' || replace(minimum_role, '_', ' ') || ' or higher.' end
    )
  ), '{}'::jsonb)
  into v_actions
  from (values
    ('payment_action_request','Create payment action','job_admin',45),
    ('payment_action_decision','Approve, reject, or post payment','job_admin',45),
    ('bank_csv_preview','Parse bank CSV','job_admin',45),
    ('bank_csv_confirm_import','Promote confirmed bank rows','job_admin',45),
    ('reconciliation_action','Process reconciliation','job_admin',45),
    ('equipment_scan_event','Record equipment custody scan','site_leader',20),
    ('equipment_cost_recovery_decision','Approve equipment recovery','job_admin',45),
    ('visual_asset_register','Register visual asset','supervisor',30),
    ('visual_asset_decision','Approve or reject visual asset','job_admin',45),
    ('public_route_register','Save public route','job_admin',45),
    ('public_route_decision','Approve or reject public route','job_admin',45),
    ('public_route_publish','Publish public route and sitemap','job_admin',45),
    ('quote_owner_assign','Assign quote owner','supervisor',30),
    ('quote_followup_event','Record quote follow-up','supervisor',30),
    ('dispatch_schedule','Dispatch work order','supervisor',30),
    ('job_cost_refresh','Refresh live job cost','supervisor',30),
    ('accountant_export_prepare','Generate accountant package','job_admin',45)
  ) as permissions(action_key, label, minimum_role, minimum_rank);

  return jsonb_build_object(
    'actor_profile_id', p_actor_profile_id,
    'actor_role', coalesce(v_role,'unknown'),
    'actor_rank', v_rank,
    'actions', v_actions,
    'generated_at', now()
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Stripe delivery health: event outcomes are retained without storing raw
-- payment payloads. This lets staff see last success/failure safely.
-- ---------------------------------------------------------------------------
create table if not exists public.stripe_webhook_delivery_events (
  id uuid primary key default gen_random_uuid(),
  event_id text,
  event_type text,
  delivery_status text not null default 'received',
  validation_status text not null default 'pending',
  validation_reason text,
  deposit_request_id uuid references public.customer_deposit_requests(id) on delete set null,
  checkout_session_id text,
  amount_cents bigint,
  currency_code text,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists stripe_webhook_delivery_events_event_id_uidx
  on public.stripe_webhook_delivery_events(event_id)
  where event_id is not null;
create index if not exists stripe_webhook_delivery_events_health_idx
  on public.stripe_webhook_delivery_events(created_at desc, delivery_status, validation_status);

alter table public.stripe_webhook_delivery_events
  drop constraint if exists stripe_webhook_delivery_events_status_check;
alter table public.stripe_webhook_delivery_events
  add constraint stripe_webhook_delivery_events_status_check
  check (delivery_status in ('received','processed','failed','ignored'));
alter table public.stripe_webhook_delivery_events
  drop constraint if exists stripe_webhook_delivery_events_validation_check;
alter table public.stripe_webhook_delivery_events
  add constraint stripe_webhook_delivery_events_validation_check
  check (validation_status in ('pending','verified','failed','ignored'));

create or replace view public.v_stripe_webhook_health as
with latest as (
  select * from public.stripe_webhook_delivery_events order by created_at desc limit 1
), rollup as (
  select
    count(*) filter (where created_at >= now() - interval '24 hours')::int as received_24h,
    count(*) filter (where delivery_status='processed' and created_at >= now() - interval '24 hours')::int as processed_24h,
    count(*) filter (where delivery_status='failed' and created_at >= now() - interval '24 hours')::int as failed_24h,
    max(processed_at) filter (where delivery_status='processed') as last_processed_at,
    max(created_at) as last_received_at
  from public.stripe_webhook_delivery_events
)
select
  coalesce(r.received_24h,0) as received_24h,
  coalesce(r.processed_24h,0) as processed_24h,
  coalesce(r.failed_24h,0) as failed_24h,
  r.last_processed_at,
  r.last_received_at,
  l.event_type as last_event_type,
  l.delivery_status as last_delivery_status,
  l.validation_status as last_validation_status,
  l.validation_reason as last_validation_reason,
  l.deposit_request_id as last_deposit_request_id,
  l.created_at as latest_event_at
from rollup r
left join latest l on true;

-- ---------------------------------------------------------------------------
-- Staging test run history. It is intentionally a record of test outcomes,
-- not customer or card data. The runner is blocked unless explicitly enabled.
-- ---------------------------------------------------------------------------
create table if not exists public.operations_staging_test_runs (
  id uuid primary key default gen_random_uuid(),
  run_key text not null unique,
  environment_label text not null default 'staging',
  suite_name text not null default 'operations_rpc_e2e',
  run_status text not null default 'started',
  requested_by_profile_id uuid references public.profiles(id) on delete set null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  summary jsonb not null default '{}'::jsonb,
  failure_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (environment_label = 'staging'),
  check (run_status in ('started','passed','failed','skipped'))
);
create table if not exists public.operations_staging_test_results (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.operations_staging_test_runs(id) on delete cascade,
  case_key text not null,
  case_status text not null default 'pending',
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(run_id, case_key),
  check (case_status in ('pending','passed','failed','skipped'))
);
create index if not exists operations_staging_test_runs_recent_idx
  on public.operations_staging_test_runs(started_at desc, run_status);

create or replace view public.v_operations_staging_test_summary as
select r.id, r.run_key, r.environment_label, r.suite_name, r.run_status,
       r.started_at, r.finished_at, r.failure_reason,
       count(t.id)::int as case_count,
       count(t.id) filter (where t.case_status='passed')::int as passed_count,
       count(t.id) filter (where t.case_status='failed')::int as failed_count,
       count(t.id) filter (where t.case_status='skipped')::int as skipped_count,
       r.summary
from public.operations_staging_test_runs r
left join public.operations_staging_test_results t on t.run_id=r.id
group by r.id
order by r.started_at desc;

-- ---------------------------------------------------------------------------
-- Secure accountant package metadata. The artifact itself is a private
-- storage object; the Edge Function creates a short-lived signed download.
-- ---------------------------------------------------------------------------
alter table public.accountant_handoff_exports
  add column if not exists artifact_storage_path text,
  add column if not exists artifact_sha256 text,
  add column if not exists artifact_size_bytes bigint,
  add column if not exists artifact_content_type text,
  add column if not exists artifact_expires_at timestamptz,
  add column if not exists source_schema_version integer;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('accountant-exports','accountant-exports',false,26214400,array['application/zip'])
on conflict (id) do update set public=false, file_size_limit=excluded.file_size_limit, allowed_mime_types=excluded.allowed_mime_types;

create or replace view public.v_accountant_export_readiness as
with payments as (
  select count(*) filter (where action_status='approved' and posting_status <> 'posted')::int as approved_payment_actions_pending,
         count(*) filter (where posting_status='failed')::int as failed_payment_actions
  from public.payment_action_requests
), reconciliation as (
  select count(*) filter (where clearing_status='open')::int as open_bank_items,
         count(*) filter (where match_status in ('unmatched','exception'))::int as unresolved_bank_items
  from public.bank_reconciliation_items
), periods as (
  select count(*) filter (where close_status in ('in_review','closed'))::int as locked_period_count
  from public.accounting_period_closes
), latest as (
  select id, export_status, export_title, generated_at, artifact_storage_path, artifact_expires_at
  from public.accountant_handoff_exports order by generated_at desc nulls last, created_at desc limit 1
)
select
  p.approved_payment_actions_pending,
  p.failed_payment_actions,
  r.open_bank_items,
  r.unresolved_bank_items,
  pr.locked_period_count,
  l.id as latest_export_id,
  l.export_status as latest_export_status,
  l.export_title as latest_export_title,
  l.generated_at as latest_export_generated_at,
  l.artifact_storage_path as latest_export_storage_path,
  l.artifact_expires_at as latest_export_expires_at,
  case when p.approved_payment_actions_pending=0 and p.failed_payment_actions=0 and r.unresolved_bank_items=0 then true else false end as package_ready,
  case when p.approved_payment_actions_pending=0 and p.failed_payment_actions=0 and r.unresolved_bank_items=0
       then 'Accounting workbench has no unposted approved payment actions, failed posts, or unresolved bank exceptions.'
       else 'Resolve listed payment and reconciliation exceptions before treating the accountant package as final.' end as readiness_message
from payments p cross join reconciliation r cross join periods pr left join latest l on true;

-- Existing per-RPC permission definitions are also exposed as cockpit data.
insert into public.operation_rpc_permission_tests (
  test_key, rpc_name, minimum_role, minimum_rank, expected_allowed_roles, expected_blocked_roles, test_command, notes
) values
('operations_capabilities_ui','ywi_get_operations_capabilities','service_role',0,array['operations-manage'],array['browser_direct'],'node scripts/operations-rpc-staging-e2e.mjs --suite permissions','Server supplies visual capability explanations; Edge Function rank checks and RPC guards remain authoritative.'),
('stripe_webhook_health_logging','stripe_webhook_delivery_events','webhook_signature',0,array['valid_stripe_webhook'],array['invalid_signature','wrong_currency','wrong_amount'],'node scripts/operations-rpc-staging-e2e.mjs --suite stripe','Stores delivery outcome and last safe failure reason without retaining raw provider payloads.'),
('accountant_export_private_package','accountant-export','job_admin',45,array['job_admin','admin'],array['worker','staff','supervisor'],'node scripts/operations-rpc-staging-e2e.mjs --suite accountant','Creates a private ZIP and returns a short-lived signed download only after authenticated role checks.')
on conflict (test_key) do update set
  rpc_name=excluded.rpc_name, minimum_role=excluded.minimum_role, minimum_rank=excluded.minimum_rank,
  expected_allowed_roles=excluded.expected_allowed_roles, expected_blocked_roles=excluded.expected_blocked_roles,
  test_command=excluded.test_command, notes=excluded.notes, updated_at=now();

update public.admin_scorecard_progress_rails
set progress_percent = case rail_key
  when 'payment_actions_live' then greatest(progress_percent, 94)
  when 'bank_csv_preview_live' then greatest(progress_percent, 94)
  when 'operations_cockpit_live' then greatest(progress_percent, 94)
  when 'customer_portal_live' then greatest(progress_percent, 90)
  else progress_percent end,
  next_action_hint = case rail_key
    when 'payment_actions_live' then 'Run the seeded staging suite and resolve any failed journal or permission case before production posting.'
    when 'bank_csv_preview_live' then 'Run the seeded bank promotion, exact split, undo, and sign-off cases; then clear reconciliation exceptions.'
    when 'operations_cockpit_live' then 'Use role badges and Stripe health cards during staging acceptance testing.'
    when 'customer_portal_live' then 'Verify quote acceptance, hosted deposit checkout, webhook health, and customer status updates with Stripe test mode.'
    else next_action_hint end,
  metadata = coalesce(metadata,'{}'::jsonb) || '{"build":"2026-06-22a","schema":152,"staging_proof":true,"accountant_export":true}'::jsonb,
  updated_at = now()
where rail_key in ('payment_actions_live','bank_csv_preview_live','operations_cockpit_live','customer_portal_live');

-- Schema marker.
drop view if exists public.v_schema_drift_status;
create view public.v_schema_drift_status as
select 152::int as expected_schema_version,
  coalesce(max(schema_version) filter (where status = 'applied'), 0)::int as latest_applied_schema_version,
  case when coalesce(max(schema_version) filter (where status = 'applied'), 0) >= 152 then 'current' else 'behind' end as drift_status,
  case when coalesce(max(schema_version) filter (where status = 'applied'), 0) >= 152
       then 'Live database is at or ahead of the repo schema marker.'
       else 'Live database is behind the deployed app. Apply migrations through schema 152.' end as message,
  now() as checked_at
from public.app_schema_versions;

insert into public.app_schema_versions (
  schema_version, migration_key, schema_name, release_label, description, status, notes
) values (
  152,
  '152_staging_proof_permissions_stripe_health_accountant_export',
  '152_staging_proof_permissions_stripe_health_accountant_export.sql',
  '2026-06-22a',
  'Adds staging test-run records, visible action capability data, Stripe webhook health, reconciliation-review support, and private accountant export packaging metadata.',
  'applied',
  'This release makes testing repeatable and visible, blocks manual bypass of webhook-controlled deposits, and adds a private accountant export artifact path.'
)
on conflict (schema_version) do update set
  migration_key=excluded.migration_key, schema_name=excluded.schema_name,
  release_label=excluded.release_label, description=excluded.description,
  status=excluded.status, notes=excluded.notes, applied_at=now();

revoke all on function public.ywi_get_operations_capabilities(uuid) from public;
grant execute on function public.ywi_get_operations_capabilities(uuid) to service_role;
grant select on public.v_stripe_webhook_health to authenticated;
grant select on public.v_operations_staging_test_summary to authenticated;
grant select on public.v_accountant_export_readiness to authenticated;

commit;
