-- Schema 122: Mobile form steppers, local draft resume chips, and phone-first form quality gates.
-- This migration is intentionally low-risk: it adds metadata/quality-gate tables and views
-- used by Admin readiness screens. It does not alter live form submission tables.

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

create table if not exists public.mobile_form_stepper_registry (
  form_key text primary key,
  form_title text not null,
  route_hint text not null,
  step_labels text[] not null default '{}'::text[],
  draft_policy text not null default 'local_device_only',
  offline_hint text,
  quality_status text not null default 'review',
  sort_order integer not null default 100,
  updated_at timestamptz not null default now()
);

create table if not exists public.mobile_form_quality_gates (
  gate_key text primary key,
  form_key text,
  gate_title text not null,
  gate_status text not null default 'review',
  route_hint text,
  test_hint text,
  failure_hint text,
  sort_order integer not null default 100,
  checked_at timestamptz,
  updated_at timestamptz not null default now()
);

insert into public.mobile_form_stepper_registry (
  form_key,
  form_title,
  route_hint,
  step_labels,
  draft_policy,
  offline_hint,
  quality_status,
  sort_order
)
values
  ('toolboxForm', 'Toolbox Talk', '#toolbox', array['Basics','Topic','Attendees','Photos','Submit'], 'local_device_only', 'Draft values are saved locally on the phone; file attachments still need to be re-selected before final submit.', 'passed', 10),
  ('ppeForm', 'PPE Check', '#ppe', array['Basics','Items','Notes','Submit'], 'local_device_only', 'Draft values are saved locally on the phone and the form can still queue through the outbox when offline.', 'passed', 20),
  ('faForm', 'First Aid Kit', '#firstaid', array['Basics','Items','Notes','Submit'], 'local_device_only', 'Draft values are saved locally on the phone and can be resumed before submission.', 'passed', 30),
  ('incidentForm', 'Incident / Near Miss', '#incident', array['Basics','Event','Actions','Photos','Submit'], 'local_device_only', 'Draft text is local; photos must be attached again before final submit if the browser clears file inputs.', 'passed', 40),
  ('inspForm', 'Site Inspection', '#inspect', array['Basics','Items','Photos','Submit'], 'local_device_only', 'Draft values are saved locally and inspection rows remain easier to reach with step chips.', 'passed', 50),
  ('drForm', 'Emergency Drill', '#drill', array['Basics','Scenario','Attendees','Submit'], 'local_device_only', 'Draft values are saved locally and attendee rows remain inside the normal form payload.', 'passed', 60)
on conflict (form_key) do update set
  form_title = excluded.form_title,
  route_hint = excluded.route_hint,
  step_labels = excluded.step_labels,
  draft_policy = excluded.draft_policy,
  offline_hint = excluded.offline_hint,
  quality_status = excluded.quality_status,
  sort_order = excluded.sort_order,
  updated_at = now();

insert into public.mobile_form_quality_gates (
  gate_key,
  form_key,
  gate_title,
  gate_status,
  route_hint,
  test_hint,
  failure_hint,
  sort_order,
  checked_at
)
values
  ('mobile_form_helper_script_loaded', null, 'Mobile form helper is loaded by the app shell', 'passed', '#today', 'Open the app and confirm js/mobile-form-helper.js is loaded with the current cache marker.', 'Hard refresh or clear the service worker if the helper does not load.', 10, now()),
  ('mobile_toolbox_stepper', 'toolboxForm', 'Toolbox Talk has mobile step chips and draft resume', 'passed', '#toolbox', 'Open Toolbox Talk at phone width and confirm Basics, Topic, Attendees, Photos, Submit chips appear.', 'Check js/mobile-form-helper.js and style.css mobile-form-assist rules.', 20, now()),
  ('mobile_incident_stepper', 'incidentForm', 'Incident / Near Miss has mobile step chips and draft resume', 'passed', '#incident', 'Open Incident / Near Miss at phone width and confirm Basics, Event, Actions, Photos, Submit chips appear.', 'Check the incidentForm config in js/mobile-form-helper.js.', 30, now()),
  ('mobile_safety_forms_stepper', null, 'PPE, First Aid, Inspection, and Drill have mobile step chips', 'passed', '#ppe', 'Open PPE, First Aid, Site Inspection, and Drill at phone width and confirm each form gets a mobile guide.', 'Check form IDs and MutationObserver enhancement timing.', 40, now()),
  ('mobile_draft_count_today', null, 'Today dashboard and quick badge include saved local drafts', 'passed', '#today', 'Save a draft on a form and confirm Today status/badge reflects the saved draft count.', 'Check ywi:mobile-drafts-updated events and mobile-menu badge sync.', 50, now())
on conflict (gate_key) do update set
  form_key = excluded.form_key,
  gate_title = excluded.gate_title,
  gate_status = excluded.gate_status,
  route_hint = excluded.route_hint,
  test_hint = excluded.test_hint,
  failure_hint = excluded.failure_hint,
  sort_order = excluded.sort_order,
  checked_at = excluded.checked_at,
  updated_at = now();

drop view if exists public.v_mobile_form_stepper_registry;
create view public.v_mobile_form_stepper_registry as
select
  form_key,
  form_title,
  route_hint,
  step_labels,
  draft_policy,
  offline_hint,
  quality_status,
  sort_order,
  updated_at
from public.mobile_form_stepper_registry
order by sort_order, form_key;

drop view if exists public.v_mobile_form_quality_gates;
create view public.v_mobile_form_quality_gates as
select
  gate_key,
  form_key,
  gate_title,
  gate_status,
  route_hint,
  test_hint,
  failure_hint,
  sort_order,
  checked_at,
  updated_at
from public.mobile_form_quality_gates
order by sort_order, gate_key;

drop view if exists public.v_schema_drift_status;
create view public.v_schema_drift_status as
select
  122::int as expected_schema_version,
  coalesce(max(schema_version) filter (where status = 'applied'), 0)::int as latest_applied_schema_version,
  case
    when coalesce(max(schema_version) filter (where status = 'applied'), 0) >= 122
      then 'current'
    else 'behind'
  end as drift_status,
  case
    when coalesce(max(schema_version) filter (where status = 'applied'), 0) >= 122
      then 'Live database is at or ahead of the repo schema marker.'
    else 'Live database is behind the deployed app. Apply migrations through schema 122.'
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
  122,
  '122_mobile_form_stepper_draft_resume_guardrails',
  '122_mobile_form_stepper_draft_resume_guardrails.sql',
  '2026-05-28a',
  'Adds mobile form stepper and local draft-resume quality gate tracking for phone-first field usage.',
  'applied',
  'Mobile-first pass focused on guided form chips, local draft saving/resume, Today draft badges, and Ontario OHSA field workflow usability.'
)
on conflict (schema_version) do update set
  migration_key = excluded.migration_key,
  schema_name = excluded.schema_name,
  release_label = excluded.release_label,
  description = excluded.description,
  status = excluded.status,
  notes = excluded.notes,
  applied_at = now();

grant select on public.mobile_form_stepper_registry to authenticated;
grant select on public.mobile_form_quality_gates to authenticated;
grant select on public.v_mobile_form_stepper_registry to authenticated;
grant select on public.v_mobile_form_quality_gates to authenticated;
grant select on public.v_schema_drift_status to authenticated;
