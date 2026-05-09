-- 083_employee_time_clock_and_break_tracking.sql
-- Adds employee self-service site/job time clock tracking with unpaid breaks,
-- payroll-linked hour sync, and admin-visible attendance rollups.

create extension if not exists pgcrypto;

create table if not exists public.employee_time_entries (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  crew_id uuid references public.crews(id) on delete set null,
  job_id bigint not null references public.jobs(id) on delete cascade,
  job_session_id uuid references public.job_sessions(id) on delete set null,
  site_id uuid references public.sites(id) on delete set null,
  clock_status text not null default 'active',
  signed_in_at timestamptz not null default now(),
  last_status_at timestamptz not null default now(),
  signed_out_at timestamptz,
  total_elapsed_minutes integer not null default 0,
  unpaid_break_minutes integer not null default 0,
  paid_work_minutes integer not null default 0,
  notes text,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Repair older partial runs where employee_time_entries.site_id may have been created as bigint.
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'employee_time_entries'
      and column_name = 'site_id'
      and udt_name = 'int8'
  ) then
    alter table public.employee_time_entries
      drop constraint if exists employee_time_entries_site_id_fkey;

    alter table public.employee_time_entries
      alter column site_id type uuid using null::uuid;

    alter table public.employee_time_entries
      add constraint employee_time_entries_site_id_fkey
      foreign key (site_id) references public.sites(id) on delete set null;
  end if;
end
$$;

alter table if exists public.employee_time_entries
  drop constraint if exists employee_time_entries_status_check;

alter table if exists public.employee_time_entries
  add constraint employee_time_entries_status_check
  check (clock_status in ('active','paused','signed_out','cancelled'));

create index if not exists idx_employee_time_entries_profile
  on public.employee_time_entries(profile_id, signed_in_at desc);

create index if not exists idx_employee_time_entries_job
  on public.employee_time_entries(job_id, signed_in_at desc);

create unique index if not exists idx_employee_time_entries_one_open_per_profile
  on public.employee_time_entries(profile_id)
  where signed_out_at is null and clock_status in ('active','paused');

create table if not exists public.employee_time_entry_breaks (
  id uuid primary key default gen_random_uuid(),
  time_entry_id uuid not null references public.employee_time_entries(id) on delete cascade,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  duration_minutes integer not null default 0,
  unpaid boolean not null default true,
  notes text,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_employee_time_entry_breaks_entry
  on public.employee_time_entry_breaks(time_entry_id, started_at desc);

alter table if exists public.job_session_crew_hours
  add column if not exists time_entry_id uuid references public.employee_time_entries(id) on delete set null,
  add column if not exists break_minutes integer not null default 0,
  add column if not exists pay_code text not null default 'regular';

alter table if exists public.job_session_crew_hours
  drop constraint if exists job_session_crew_hours_pay_code_check;

alter table if exists public.job_session_crew_hours
  add constraint job_session_crew_hours_pay_code_check
  check (pay_code in ('regular','overtime','mixed','manual'));

create unique index if not exists idx_job_session_crew_hours_time_entry_id
  on public.job_session_crew_hours(time_entry_id)
  where time_entry_id is not null;

alter table if exists public.site_activity_events
  drop constraint if exists site_activity_events_type_check;

alter table if exists public.site_activity_events
  add constraint site_activity_events_type_check
  check (
    event_type in (
      'job_created','job_updated','job_session_created','job_session_updated','crew_hours_logged','job_reassignment_created','job_financial_event_created',
      'staff_created','staff_updated','staff_status_changed','staff_deleted',
      'equipment_created','equipment_updated','equipment_deleted',
      'agreement_created','agreement_updated','snow_trigger_created','change_order_created',
      'customer_asset_created','callback_created','payroll_export_created','contract_document_created',
      'order_created','account_login',
      'employee_clock_in','employee_break_started','employee_break_ended','employee_clock_out'
    )
  );

create or replace view public.v_employee_time_entry_break_rollups as
select
  b.time_entry_id,
  count(*)::int as break_count,
  count(*) filter (where b.ended_at is null)::int as open_break_count,
  coalesce(sum(coalesce(b.duration_minutes, 0)), 0)::int as unpaid_break_minutes,
  max(b.started_at) as last_break_started_at,
  max(b.ended_at) as last_break_ended_at
from public.employee_time_entry_breaks b
where coalesce(b.unpaid, true) = true
group by b.time_entry_id;

create or replace view public.v_employee_time_clock_entries as
select
  te.id,
  te.profile_id,
  p.full_name,
  p.employee_number,
  te.crew_id,
  c.crew_name,
  c.crew_code,
  te.job_id,
  j.job_code,
  j.job_name,
  te.site_id,
  s.site_code,
  s.site_name,
  te.job_session_id,
  js.session_date,
  js.session_status,
  te.clock_status,
  te.signed_in_at,
  te.last_status_at,
  te.signed_out_at,
  te.total_elapsed_minutes,
  coalesce(br.unpaid_break_minutes, te.unpaid_break_minutes, 0)::int as unpaid_break_minutes,
  te.paid_work_minutes,
  te.notes,
  te.created_by_profile_id,
  actor.full_name as created_by_name,
  coalesce(br.break_count, 0)::int as break_count,
  coalesce(br.open_break_count, 0)::int as open_break_count,
  br.last_break_started_at,
  br.last_break_ended_at,
  to_char(te.signed_in_at at time zone 'America/Toronto', 'YYYY-MM-DD HH24:MI') as signed_in_at_local,
  to_char(te.signed_out_at at time zone 'America/Toronto', 'YYYY-MM-DD HH24:MI') as signed_out_at_local,
  te.created_at,
  te.updated_at
from public.employee_time_entries te
left join public.profiles p on p.id = te.profile_id
left join public.crews c on c.id = te.crew_id
left join public.jobs j on j.id = te.job_id
left join public.sites s on s.id = te.site_id
left join public.job_sessions js on js.id = te.job_session_id
left join public.profiles actor on actor.id = te.created_by_profile_id
left join public.v_employee_time_entry_break_rollups br on br.time_entry_id = te.id;

create or replace view public.v_employee_time_clock_current as
select *
from public.v_employee_time_clock_entries
where signed_out_at is null
  and clock_status in ('active','paused');

create or replace view public.v_employee_time_clock_summary as
select
  count(*)::int as total_entry_count,
  count(*) filter (where signed_in_at >= now() - interval '24 hours')::int as last_24h_clock_event_count,
  count(*) filter (where signed_in_at >= now() - interval '24 hours')::int as last_24h_clock_in_count,
  count(*) filter (where signed_out_at >= now() - interval '24 hours')::int as last_24h_clock_out_count,
  count(*) filter (where clock_status = 'paused' and signed_out_at is null)::int as currently_on_break_count,
  count(*) filter (where clock_status = 'active' and signed_out_at is null)::int as currently_clocked_in_count,
  coalesce(sum(case when signed_in_at >= now() - interval '24 hours' then paid_work_minutes else 0 end), 0)::int as last_24h_paid_minutes,
  max(greatest(coalesce(signed_out_at, signed_in_at), signed_in_at)) as last_activity_at
from public.employee_time_entries;
