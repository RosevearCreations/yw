-- 082_site_activity_audit_and_admin_recent_events.sql
-- Adds a durable admin-visible activity trail for operational and accounting changes.

create extension if not exists pgcrypto;

create table if not exists public.site_activity_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  entity_type text not null,
  entity_id text,
  severity text not null default 'info',
  title text not null,
  summary text,
  metadata jsonb not null default '{}'::jsonb,
  related_job_id bigint references public.jobs(id) on delete set null,
  related_profile_id uuid references public.profiles(id) on delete set null,
  related_equipment_id uuid references public.equipment_master(id) on delete set null,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table if exists public.site_activity_events drop constraint if exists site_activity_events_type_check;
alter table if exists public.site_activity_events
  add constraint site_activity_events_type_check
  check (
    event_type in (
      'job_created','job_updated','job_session_created','job_session_updated','crew_hours_logged','job_reassignment_created','job_financial_event_created',
      'staff_created','staff_updated','staff_status_changed','staff_deleted',
      'equipment_created','equipment_updated','equipment_deleted',
      'agreement_created','agreement_updated','snow_trigger_created','change_order_created',
      'customer_asset_created','callback_created','payroll_export_created','contract_document_created',
      'order_created','account_login'
    )
  );

alter table if exists public.site_activity_events drop constraint if exists site_activity_events_severity_check;
alter table if exists public.site_activity_events
  add constraint site_activity_events_severity_check
  check (severity in ('info','success','warning','error'));

create index if not exists idx_site_activity_events_occurred_at on public.site_activity_events(occurred_at desc);
create index if not exists idx_site_activity_events_entity on public.site_activity_events(entity_type, entity_id, occurred_at desc);
create index if not exists idx_site_activity_events_job on public.site_activity_events(related_job_id, occurred_at desc);
create index if not exists idx_site_activity_events_actor on public.site_activity_events(created_by_profile_id, occurred_at desc);

create or replace view public.v_site_activity_recent as
select
  sae.id,
  sae.event_type,
  sae.entity_type,
  sae.entity_id,
  sae.severity,
  sae.title,
  sae.summary,
  sae.metadata,
  sae.related_job_id,
  j.job_code,
  j.job_name,
  sae.related_profile_id,
  rp.full_name as related_profile_name,
  sae.related_equipment_id,
  em.equipment_code as related_equipment_code,
  em.item_name as related_equipment_name,
  sae.created_by_profile_id,
  cp.full_name as created_by_name,
  sae.occurred_at,
  sae.created_at
from public.site_activity_events sae
left join public.jobs j on j.id = sae.related_job_id
left join public.profiles rp on rp.id = sae.related_profile_id
left join public.equipment_master em on em.id = sae.related_equipment_id
left join public.profiles cp on cp.id = sae.created_by_profile_id;

create or replace view public.v_site_activity_summary as
select
  count(*)::int as total_event_count,
  count(*) filter (where occurred_at >= now() - interval '24 hours')::int as last_24h_event_count,
  count(*) filter (where event_type = 'job_created' and occurred_at >= now() - interval '24 hours')::int as last_24h_job_created_count,
  count(*) filter (where event_type = 'staff_created' and occurred_at >= now() - interval '24 hours')::int as last_24h_staff_created_count,
  count(*) filter (where event_type = 'equipment_created' and occurred_at >= now() - interval '24 hours')::int as last_24h_equipment_created_count,
  count(*) filter (where severity in ('warning','error') and occurred_at >= now() - interval '24 hours')::int as last_24h_attention_count,
  max(occurred_at) as last_activity_at
from public.site_activity_events;
