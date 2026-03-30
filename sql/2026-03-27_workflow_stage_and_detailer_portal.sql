-- 2026-03-27_workflow_stage_and_detailer_portal.sql

alter table public.bookings
  add column if not exists current_workflow_stage text null,
  add column if not exists detailer_response_status text null,
  add column if not exists detailer_response_reason text null,
  add column if not exists dispatched_at timestamptz null,
  add column if not exists arrived_at timestamptz null,
  add column if not exists detailing_started_at timestamptz null,
  add column if not exists detailing_paused_at timestamptz null,
  add column if not exists detailing_completed_at timestamptz null;

create index if not exists bookings_current_workflow_stage_idx on public.bookings(current_workflow_stage);
create index if not exists bookings_detailer_response_status_idx on public.bookings(detailer_response_status);
