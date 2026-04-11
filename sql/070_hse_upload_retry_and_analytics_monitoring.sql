-- 070_hse_upload_retry_and_analytics_monitoring.sql
-- Adds:
-- 1) HSE/route upload retry linkage and richer failure ownership fields
-- 2) DB-backed analytics traffic events
-- 3) DB-backed backend monitor incidents for failed requests/runtime issues
-- 4) Views so Admin can review recent traffic and open monitor incidents

create extension if not exists pgcrypto;

alter table if exists public.field_upload_failures
  add column if not exists execution_id uuid references public.route_stop_executions(id) on delete set null,
  add column if not exists packet_id uuid references public.linked_hse_packets(id) on delete set null,
  add column if not exists proof_id uuid references public.hse_packet_proofs(id) on delete set null,
  add column if not exists route_attachment_id uuid references public.route_stop_execution_attachments(id) on delete set null,
  add column if not exists upload_attempts integer not null default 0,
  add column if not exists retry_owner_profile_id uuid references public.profiles(id) on delete set null,
  add column if not exists retry_owner_notes text,
  add column if not exists last_retry_at timestamptz,
  add column if not exists next_retry_after timestamptz;

create index if not exists idx_field_upload_failures_execution_id on public.field_upload_failures(execution_id, created_at desc);
create index if not exists idx_field_upload_failures_packet_id on public.field_upload_failures(packet_id, created_at desc);
create index if not exists idx_field_upload_failures_retry_owner on public.field_upload_failures(retry_owner_profile_id, retry_status, created_at desc);

create table if not exists public.app_traffic_events (
  id uuid primary key default gen_random_uuid(),
  session_key text,
  visitor_key text,
  event_name text not null default 'page_view',
  route_name text,
  page_path text,
  page_title text,
  referrer text,
  source_medium text,
  user_agent text,
  profile_id uuid references public.profiles(id) on delete set null,
  role_label text,
  is_authenticated boolean not null default false,
  request_method text,
  endpoint_path text,
  http_status integer,
  duration_ms integer,
  event_value numeric(12,2),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  check (event_name in ('page_view','route_view','route_denied','admin_load','api_call','api_error','client_error','upload_success','upload_failure','smoke_check','session_health'))
);

create index if not exists idx_app_traffic_events_created_at on public.app_traffic_events(created_at desc);
create index if not exists idx_app_traffic_events_route on public.app_traffic_events(route_name, event_name, created_at desc);
create index if not exists idx_app_traffic_events_endpoint on public.app_traffic_events(endpoint_path, event_name, created_at desc);
create index if not exists idx_app_traffic_events_profile_id on public.app_traffic_events(profile_id, created_at desc);

create table if not exists public.backend_monitor_events (
  id uuid primary key default gen_random_uuid(),
  monitor_scope text not null default 'frontend',
  event_name text not null default 'api_error',
  severity text not null default 'warning',
  lifecycle_status text not null default 'open',
  route_name text,
  endpoint_path text,
  function_name text,
  error_code text,
  http_status integer,
  title text,
  message text,
  linked_failure_id uuid references public.field_upload_failures(id) on delete set null,
  details jsonb not null default '{}'::jsonb,
  occurrence_count integer not null default 1,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by_profile_id uuid references public.profiles(id) on delete set null,
  resolution_notes text,
  check (monitor_scope in ('frontend','backend','storage','auth','operations','hse','analytics')),
  check (severity in ('info','warning','error','critical')),
  check (lifecycle_status in ('open','investigating','resolved','dismissed'))
);

create index if not exists idx_backend_monitor_events_status on public.backend_monitor_events(lifecycle_status, severity, created_at desc);
create index if not exists idx_backend_monitor_events_scope on public.backend_monitor_events(monitor_scope, event_name, created_at desc);

create or replace function public.ywi_before_backend_monitor_event()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  new.last_seen_at := coalesce(new.last_seen_at, now());
  if coalesce(new.lifecycle_status, 'open') in ('resolved', 'dismissed') and new.resolved_at is null then
    new.resolved_at := now();
  end if;
  if coalesce(new.lifecycle_status, 'open') in ('open', 'investigating') then
    new.resolved_at := null;
  end if;
  if coalesce(new.occurrence_count, 0) <= 0 then
    new.occurrence_count := 1;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_ywi_before_backend_monitor_event on public.backend_monitor_events;
create trigger trg_ywi_before_backend_monitor_event
before insert or update on public.backend_monitor_events
for each row execute function public.ywi_before_backend_monitor_event();

create or replace function public.ywi_before_app_traffic_event()
returns trigger
language plpgsql
as $$
begin
  if new.created_at is null then
    new.created_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_ywi_before_app_traffic_event on public.app_traffic_events;
create trigger trg_ywi_before_app_traffic_event
before insert on public.app_traffic_events
for each row execute function public.ywi_before_app_traffic_event();

create or replace view public.v_field_upload_failure_rollups as
select
  fuf.id,
  fuf.failure_scope,
  fuf.linked_record_type,
  fuf.linked_record_id,
  fuf.job_id,
  fuf.comment_id,
  fuf.signout_id,
  fuf.execution_id,
  fuf.packet_id,
  fuf.proof_id,
  fuf.route_attachment_id,
  fuf.file_name,
  fuf.content_type,
  fuf.file_size_bytes,
  fuf.storage_bucket,
  fuf.storage_path,
  fuf.failure_stage,
  fuf.failure_reason,
  fuf.retry_status,
  fuf.upload_attempts,
  fuf.retry_owner_profile_id,
  fuf.retry_owner_notes,
  fuf.last_retry_at,
  fuf.next_retry_after,
  fuf.client_context,
  fuf.created_by_profile_id,
  fuf.created_at,
  fuf.updated_at,
  fuf.resolved_at,
  fuf.resolved_by_profile_id,
  fuf.resolution_notes,
  extract(epoch from (now() - fuf.created_at))::bigint as age_seconds,
  j.job_code,
  jc.job_id as comment_job_id,
  es.job_id as signout_job_id,
  rse.execution_status,
  lhp.packet_number,
  hpp.file_name as proof_file_name
from public.field_upload_failures fuf
left join public.jobs j on j.id = fuf.job_id
left join public.job_comments jc on jc.id = fuf.comment_id
left join public.equipment_signouts es on es.id = fuf.signout_id
left join public.route_stop_executions rse on rse.id = fuf.execution_id
left join public.linked_hse_packets lhp on lhp.id = fuf.packet_id
left join public.hse_packet_proofs hpp on hpp.id = fuf.proof_id;

create or replace view public.v_app_traffic_recent as
select
  ate.id,
  ate.session_key,
  ate.visitor_key,
  ate.event_name,
  ate.route_name,
  ate.page_path,
  ate.page_title,
  ate.referrer,
  ate.source_medium,
  ate.user_agent,
  ate.profile_id,
  ate.role_label,
  ate.is_authenticated,
  ate.request_method,
  ate.endpoint_path,
  ate.http_status,
  ate.duration_ms,
  ate.event_value,
  ate.details,
  ate.created_at
from public.app_traffic_events ate;

create or replace view public.v_backend_monitor_recent as
select
  bme.id,
  bme.monitor_scope,
  bme.event_name,
  bme.severity,
  bme.lifecycle_status,
  bme.route_name,
  bme.endpoint_path,
  bme.function_name,
  bme.error_code,
  bme.http_status,
  bme.title,
  bme.message,
  bme.linked_failure_id,
  bme.details,
  bme.occurrence_count,
  bme.first_seen_at,
  bme.last_seen_at,
  bme.created_at,
  bme.updated_at,
  bme.resolved_at,
  bme.resolved_by_profile_id,
  bme.resolution_notes
from public.backend_monitor_events bme;
