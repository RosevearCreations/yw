
-- sql/2026-03-22_admin_notifications_and_settings_persistence.sql
--
-- Adds richer persistence for admin settings and notification queue handling.

begin;

alter table public.notification_events
  add column if not exists status text not null default 'queued';

alter table public.notification_events
  add column if not exists attempt_count integer not null default 0;

alter table public.notification_events
  add column if not exists last_error text null;

alter table public.notification_events
  add column if not exists processed_at timestamptz null;

create index if not exists idx_notification_events_status_created_at
  on public.notification_events (status, created_at desc);

insert into public.app_management_settings (key, value)
values
  ('visibility_matrix', '{"customer_detailer_notes": true, "customer_admin_notes_admin_only": true, "detailer_admin_notes_admin_only": true}'::jsonb),
  ('manual_scheduling_rules', '{"manual_schedule_admin_only": true, "blocking_admin_only": true, "notes": ""}'::jsonb),
  ('feature_flags', '{"live_updates_default": true, "customer_chat_enabled": true, "picture_first_observations": true, "tier_discount_badges": true}'::jsonb)
on conflict (key) do nothing;

commit;
