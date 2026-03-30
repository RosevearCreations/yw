-- sql/2026-03-22_annotation_threading_and_dispatch_upgrade.sql
-- Adds richer annotation metadata and retry scheduling fields for notifications.

begin;

alter table public.observation_annotations
  add column if not exists category text not null default 'issue',
  add column if not exists severity text not null default 'medium',
  add column if not exists pin_color text not null default '#f59e0b';

alter table public.notification_events
  add column if not exists next_attempt_at timestamptz null default now(),
  add column if not exists max_attempts integer not null default 5;

create index if not exists idx_notification_events_status_next_attempt
  on public.notification_events (status, next_attempt_at);

update public.notification_events
   set next_attempt_at = coalesce(next_attempt_at, created_at, now()),
       max_attempts = coalesce(max_attempts, 5);

commit;
