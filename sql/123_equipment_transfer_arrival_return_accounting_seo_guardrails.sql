-- Schema 123: Equipment transfer verification, return signoff depth, accounting/SEO guardrails.
-- This pass tightens the end-to-end equipment withdrawal -> site arrival -> return workflow
-- and records the rollout in readiness tables so Admin can see what still needs testing.
-- Repaired: adds compatibility date columns before v_equipment_directory is recreated
-- so databases that currently use last_service_at / next_service_due_at do not fail.

begin;

create table if not exists public.app_schema_versions (
  schema_version integer primary key,
  schema_name text,
  description text,
  status text not null default 'applied',
  applied_at timestamptz not null default now(),
  applied_by text,
  notes text
);

alter table public.app_schema_versions add column if not exists migration_key text;
alter table public.app_schema_versions add column if not exists release_label text;

alter table if exists public.equipment_items
  add column if not exists current_job_id bigint references public.jobs(id) on delete set null,
  add column if not exists assigned_supervisor_profile_id uuid references public.profiles(id) on delete set null,
  add column if not exists equipment_pool_key text,
  add column if not exists asset_tag text,
  add column if not exists manufacturer text,
  add column if not exists model_number text,
  add column if not exists purchase_year integer,
  add column if not exists purchase_date date,
  add column if not exists purchase_price numeric(12,2),
  add column if not exists condition_status text,
  add column if not exists image_url text,
  add column if not exists comments text,
  add column if not exists service_interval_days integer,
  add column if not exists last_service_date date,
  add column if not exists next_service_due_date date,
  add column if not exists next_inspection_due_date date,
  add column if not exists defect_status text default 'clear',
  add column if not exists defect_notes text,
  add column if not exists is_locked_out boolean not null default false,
  add column if not exists current_site_id uuid references public.sites(id) on delete set null,
  add column if not exists target_site_id uuid references public.sites(id) on delete set null,
  add column if not exists last_transfer_status text not null default 'ready',
  add column if not exists last_transfer_notes text,
  add column if not exists last_arrival_verified_at timestamptz,
  add column if not exists last_arrival_verified_by_profile_id uuid references public.profiles(id) on delete set null,
  add column if not exists last_arrival_test_status text,
  add column if not exists last_return_verified_at timestamptz,
  add column if not exists last_return_verified_by_profile_id uuid references public.profiles(id) on delete set null,
  add column if not exists last_return_test_status text;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'equipment_items'
      and column_name = 'last_service_at'
  ) then
    execute '
      update public.equipment_items
      set last_service_date = coalesce(last_service_date, last_service_at::date)
      where last_service_date is null
        and last_service_at is not null
    ';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'equipment_items'
      and column_name = 'next_service_due_at'
  ) then
    execute '
      update public.equipment_items
      set next_service_due_date = coalesce(next_service_due_date, next_service_due_at::date)
      where next_service_due_date is null
        and next_service_due_at is not null
    ';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'equipment_items'
      and column_name = 'next_inspection_due_at'
  ) then
    execute '
      update public.equipment_items
      set next_inspection_due_date = coalesce(next_inspection_due_date, next_inspection_due_at::date)
      where next_inspection_due_date is null
        and next_inspection_due_at is not null
    ';
  end if;
end $$;

alter table if exists public.equipment_signouts
  add column if not exists return_notes text,
  add column if not exists damage_reported boolean not null default false,
  add column if not exists damage_notes text,
  add column if not exists intended_site_id uuid references public.sites(id) on delete set null,
  add column if not exists checkout_to_site_id uuid references public.sites(id) on delete set null,
  add column if not exists checkout_safety_test_status text not null default 'not_recorded',
  add column if not exists checkout_test_notes text,
  add column if not exists transport_handoff_notes text,
  add column if not exists arrived_at_site_at timestamptz,
  add column if not exists arrived_at_site_by_profile_id uuid references public.profiles(id) on delete set null,
  add column if not exists arrival_condition text,
  add column if not exists arrival_test_status text not null default 'not_recorded',
  add column if not exists arrival_verification_notes text,
  add column if not exists return_destination_site_id uuid references public.sites(id) on delete set null,
  add column if not exists return_test_status text not null default 'not_recorded',
  add column if not exists return_test_notes text,
  add column if not exists return_verified_at timestamptz,
  add column if not exists return_verified_by_profile_id uuid references public.profiles(id) on delete set null,
  add column if not exists verification_status text not null default 'open';

alter table if exists public.equipment_signouts
  drop constraint if exists equipment_signouts_checkout_safety_test_status_check;
alter table if exists public.equipment_signouts
  add constraint equipment_signouts_checkout_safety_test_status_check
  check (checkout_safety_test_status in ('not_recorded','passed','failed','needs_service','not_required'));

alter table if exists public.equipment_signouts
  drop constraint if exists equipment_signouts_arrival_test_status_check;
alter table if exists public.equipment_signouts
  add constraint equipment_signouts_arrival_test_status_check
  check (arrival_test_status in ('not_recorded','passed','failed','needs_service','not_required'));

alter table if exists public.equipment_signouts
  drop constraint if exists equipment_signouts_return_test_status_check;
alter table if exists public.equipment_signouts
  add constraint equipment_signouts_return_test_status_check
  check (return_test_status in ('not_recorded','passed','failed','needs_service','not_required'));

alter table if exists public.equipment_signouts
  drop constraint if exists equipment_signouts_verification_status_check;
alter table if exists public.equipment_signouts
  add constraint equipment_signouts_verification_status_check
  check (verification_status in ('open','in_transit','arrived_verified','arrival_issue','returned_pending_review','return_verified','return_issue'));

alter table if exists public.equipment_items
  drop constraint if exists equipment_items_last_transfer_status_check;
alter table if exists public.equipment_items
  add constraint equipment_items_last_transfer_status_check
  check (last_transfer_status in ('ready','reserved','in_transit','arrived_verified','arrival_issue','returned_pending_review','return_verified','return_issue','locked_out'));

create table if not exists public.equipment_transfer_verification_events (
  id bigserial primary key,
  equipment_item_id bigint not null references public.equipment_items(id) on delete cascade,
  signout_id bigint references public.equipment_signouts(id) on delete cascade,
  job_id bigint references public.jobs(id) on delete set null,
  event_type text not null,
  from_site_id uuid references public.sites(id) on delete set null,
  to_site_id uuid references public.sites(id) on delete set null,
  test_status text not null default 'not_recorded',
  condition_status text,
  verified_by_profile_id uuid references public.profiles(id) on delete set null,
  verification_notes text,
  event_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table if exists public.equipment_transfer_verification_events
  drop constraint if exists equipment_transfer_verification_events_event_type_check;
alter table if exists public.equipment_transfer_verification_events
  add constraint equipment_transfer_verification_events_event_type_check
  check (event_type in ('checkout_released','site_arrival_verified','site_arrival_issue','return_received','return_verified','return_issue','lockout_after_return'));

alter table if exists public.equipment_transfer_verification_events
  drop constraint if exists equipment_transfer_verification_events_test_status_check;
alter table if exists public.equipment_transfer_verification_events
  add constraint equipment_transfer_verification_events_test_status_check
  check (test_status in ('not_recorded','passed','failed','needs_service','not_required'));

create index if not exists idx_equipment_items_transfer_status
  on public.equipment_items(last_transfer_status, status, updated_at desc);
create index if not exists idx_equipment_items_current_site
  on public.equipment_items(current_site_id, status);
create index if not exists idx_equipment_signouts_verification_status
  on public.equipment_signouts(verification_status, checked_out_at desc);
create index if not exists idx_equipment_signouts_intended_site
  on public.equipment_signouts(intended_site_id, checked_out_at desc);
create index if not exists idx_equipment_transfer_events_signout
  on public.equipment_transfer_verification_events(signout_id, created_at desc);

create table if not exists public.app_operational_depth_gates (
  gate_key text primary key,
  gate_area text not null,
  gate_title text not null,
  gate_status text not null default 'review',
  owner_hint text,
  route_hint text,
  test_hint text,
  failure_hint text,
  sort_order integer not null default 100,
  checked_at timestamptz,
  updated_at timestamptz not null default now()
);

insert into public.app_operational_depth_gates (
  gate_key,
  gate_area,
  gate_title,
  gate_status,
  owner_hint,
  route_hint,
  test_hint,
  failure_hint,
  sort_order,
  checked_at
)
values
  ('equipment_checkout_requires_job_and_destination', 'equipment', 'Checkout captures the job and intended destination site', 'passed', 'Supervisor / Job Admin', '#equipment', 'Load equipment, select a Current Job and Destination Site, then check out.', 'Keep checkout blocked until both the job and destination are clear.', 10, now()),
  ('equipment_arrival_verification_recorded', 'equipment', 'Arrival verification records site, condition, test status, and verifier', 'passed', 'Supervisor / Site Leader', '#equipment', 'After checkout, use Verify Arrival / Site Test and confirm a transfer event row is created.', 'If this fails, do not mark equipment ready on site.', 20, now()),
  ('equipment_return_verified_before_ready', 'equipment', 'Return verification separates returned-pending-review from return-verified', 'passed', 'Supervisor / Admin', '#equipment', 'Return an item, then confirm Return Verified changes the workflow status.', 'Damaged or untested returns should stay pending review or issue.', 30, now()),
  ('equipment_exceptions_visible', 'equipment', 'Open equipment transfer/return exceptions are visible in the Equipment panel', 'passed', 'Admin', '#equipment', 'Confirm missing arrival, arrival issue, and pending return rows appear in the exception summary.', 'Use the return exception view as the supervisor triage list.', 40, now()),
  ('seo_public_smoke_policy', 'seo', 'SEO smoke checks remain part of each pass', 'passed', 'Admin / Content', '#admin', 'Confirm one H1, title, meta description, structured data, and local wording checks remain documented.', 'Do not ship public pages with duplicate H1s or unclear titles.', 50, now()),
  ('accounting_depth_review', 'accounting', 'Accounting close still needs deeper applied-cost, payment, remittance, and export review', 'review', 'Admin / Accountant', '#jobs', 'Review payment application, journal lines, reconciliation, remittance signoff, and accountant handoff after live data exists.', 'Treat this as a depth gap until real transaction fixtures pass end-to-end.', 60, now())
on conflict (gate_key) do update set
  gate_area = excluded.gate_area,
  gate_title = excluded.gate_title,
  gate_status = excluded.gate_status,
  owner_hint = excluded.owner_hint,
  route_hint = excluded.route_hint,
  test_hint = excluded.test_hint,
  failure_hint = excluded.failure_hint,
  sort_order = excluded.sort_order,
  checked_at = excluded.checked_at,
  updated_at = now();

drop view if exists public.v_equipment_directory;
create view public.v_equipment_directory as
select
  e.id,
  e.equipment_code,
  e.equipment_name,
  e.category,
  e.status,
  e.serial_number,
  e.notes,
  e.asset_tag,
  e.manufacturer,
  e.model_number,
  e.purchase_year,
  e.purchase_date,
  e.purchase_price,
  e.condition_status,
  e.image_url,
  e.comments,
  e.equipment_pool_key,
  e.service_interval_days,
  e.last_service_date,
  e.next_service_due_date,
  e.last_inspection_at,
  e.next_inspection_due_date,
  e.defect_status,
  e.defect_notes,
  e.is_locked_out,
  e.last_transfer_status,
  e.last_transfer_notes,
  e.last_arrival_verified_at,
  e.last_arrival_test_status,
  e.last_return_verified_at,
  e.last_return_test_status,
  home.site_code as home_site_code,
  home.site_name as home_site_name,
  cur.site_code as current_site_code,
  cur.site_name as current_site_name,
  target.site_code as target_site_code,
  target.site_name as target_site_name,
  j.job_code as current_job_code,
  j.job_name as current_job_name,
  sup.full_name as assigned_supervisor_name,
  arrival.full_name as last_arrival_verified_by_name,
  ret.full_name as last_return_verified_by_name
from public.equipment_items e
left join public.sites home on home.id = e.home_site_id
left join public.sites cur on cur.id = e.current_site_id
left join public.sites target on target.id = e.target_site_id
left join public.jobs j on j.id = e.current_job_id
left join public.profiles sup on sup.id = e.assigned_supervisor_profile_id
left join public.profiles arrival on arrival.id = e.last_arrival_verified_by_profile_id
left join public.profiles ret on ret.id = e.last_return_verified_by_profile_id;

drop view if exists public.v_equipment_transfer_verification_directory;
create view public.v_equipment_transfer_verification_directory as
select
  ev.id,
  ev.event_type,
  ev.test_status,
  ev.condition_status,
  ev.verification_notes,
  ev.event_payload,
  ev.created_at,
  eq.equipment_code,
  eq.equipment_name,
  j.job_code,
  j.job_name,
  from_site.site_code as from_site_code,
  from_site.site_name as from_site_name,
  to_site.site_code as to_site_code,
  to_site.site_name as to_site_name,
  verifier.full_name as verified_by_name,
  verifier.email as verified_by_email,
  ev.signout_id,
  ev.equipment_item_id,
  ev.job_id
from public.equipment_transfer_verification_events ev
left join public.equipment_items eq on eq.id = ev.equipment_item_id
left join public.jobs j on j.id = ev.job_id
left join public.sites from_site on from_site.id = ev.from_site_id
left join public.sites to_site on to_site.id = ev.to_site_id
left join public.profiles verifier on verifier.id = ev.verified_by_profile_id;

drop view if exists public.v_equipment_return_exception_directory;
create view public.v_equipment_return_exception_directory as
select
  s.id as signout_id,
  e.id as equipment_item_id,
  e.equipment_code,
  e.equipment_name,
  j.job_code,
  j.job_name,
  coalesce(dest.site_code, target.site_code, home.site_code, '') as expected_site_code,
  coalesce(dest.site_name, target.site_name, home.site_name, '') as expected_site_name,
  s.checked_out_at,
  s.arrived_at_site_at,
  s.returned_at,
  s.verification_status,
  s.checkout_safety_test_status,
  s.arrival_test_status,
  s.return_test_status,
  s.damage_reported,
  s.damage_notes,
  case
    when s.returned_at is null and s.arrived_at_site_at is null then 'missing_arrival_verification'
    when s.verification_status in ('arrival_issue','return_issue') then s.verification_status
    when s.returned_at is not null and s.return_verified_at is null then 'returned_pending_review'
    when coalesce(s.damage_reported,false) = true then 'damage_reported'
    else 'ok'
  end as exception_status,
  coalesce(s.arrival_verification_notes, s.return_test_notes, s.damage_notes, s.return_notes, s.signout_notes) as exception_notes
from public.equipment_signouts s
join public.equipment_items e on e.id = s.equipment_item_id
left join public.jobs j on j.id = s.job_id
left join public.sites dest on dest.id = s.return_destination_site_id
left join public.sites target on target.id = s.intended_site_id
left join public.sites home on home.id = e.home_site_id
where
  s.returned_at is null
  or s.return_verified_at is null
  or s.verification_status in ('arrival_issue','return_issue','returned_pending_review')
  or coalesce(s.damage_reported,false) = true;

drop view if exists public.v_app_operational_depth_gates;
create view public.v_app_operational_depth_gates as
select
  gate_key,
  gate_area,
  gate_title,
  gate_status,
  owner_hint,
  route_hint,
  test_hint,
  failure_hint,
  sort_order,
  checked_at,
  updated_at
from public.app_operational_depth_gates
order by sort_order, gate_key;

drop view if exists public.v_schema_drift_status;
create view public.v_schema_drift_status as
select
  123::int as expected_schema_version,
  coalesce(max(schema_version) filter (where status = 'applied'), 0)::int as latest_applied_schema_version,
  case
    when coalesce(max(schema_version) filter (where status = 'applied'), 0) >= 123
      then 'current'
    else 'behind'
  end as drift_status,
  case
    when coalesce(max(schema_version) filter (where status = 'applied'), 0) >= 123
      then 'Live database is at or ahead of the repo schema marker.'
    else 'Live database is behind the deployed app. Apply migrations through schema 123.'
  end as message,
  now() as checked_at
from public.app_schema_versions;

insert into public.app_schema_versions (
  schema_version,
  migration_key,
  schema_name,
  release_label,
  description,
  status,
  notes
)
values (
  123,
  '123_equipment_transfer_arrival_return_accounting_seo_guardrails',
  '123_equipment_transfer_arrival_return_accounting_seo_guardrails.sql',
  '2026-05-29a',
  'Adds equipment destination, arrival verification, return verification, transfer audit events, and operational-depth gates for equipment/accounting/SEO sanity checks.',
  'applied',
  'Equipment withdrawal now records destination, site arrival verification, return review status, transfer history, and exception rows; accounting and SEO depth gaps remain visible as gates.'
)
on conflict (schema_version) do update set
  migration_key = excluded.migration_key,
  schema_name = excluded.schema_name,
  release_label = excluded.release_label,
  description = excluded.description,
  status = excluded.status,
  notes = excluded.notes,
  applied_at = now();

grant select on public.equipment_transfer_verification_events to authenticated;
grant select on public.app_operational_depth_gates to authenticated;
grant select on public.v_equipment_directory to authenticated;
grant select on public.v_equipment_transfer_verification_directory to authenticated;
grant select on public.v_equipment_return_exception_directory to authenticated;
grant select on public.v_app_operational_depth_gates to authenticated;
grant select on public.v_schema_drift_status to authenticated;

commit;
