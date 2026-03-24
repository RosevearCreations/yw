-- File: sql/049_auth_delivery_attempts_and_dead_letters.sql
-- Brief description: Adds provider-specific email/SMS attempt counters and dead-letter tracking for notifications,
-- supporting retry handling and richer admin delivery visibility.

begin;

alter table if exists public.admin_notifications
  add column if not exists email_provider text,
  add column if not exists email_attempt_count integer not null default 0,
  add column if not exists email_last_attempt_at timestamptz,
  add column if not exists sms_provider text,
  add column if not exists sms_attempt_count integer not null default 0,
  add column if not exists sms_last_attempt_at timestamptz,
  add column if not exists dead_lettered_at timestamptz,
  add column if not exists dead_letter_reason text;

create index if not exists idx_admin_notifications_dead_lettered_at
  on public.admin_notifications(dead_lettered_at);

create index if not exists idx_admin_notifications_email_attempt_count
  on public.admin_notifications(email_attempt_count);

create index if not exists idx_admin_notifications_sms_attempt_count
  on public.admin_notifications(sms_attempt_count);

commit;
