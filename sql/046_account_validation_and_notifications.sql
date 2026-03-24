-- File: sql/046_account_validation_and_notifications.sql
-- Brief description: Adds account validation support and notification queue helpers.

alter table public.profiles
  add column if not exists email_verified boolean not null default false;

create table if not exists public.admin_notifications (
  id bigserial primary key,
  notification_type text not null,
  recipient_role text not null default 'admin',
  target_table text,
  target_id text,
  subject text,
  body text,
  status text not null default 'queued',
  created_by_profile_id uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

create index if not exists idx_admin_notifications_status on public.admin_notifications(status);
create index if not exists idx_admin_notifications_type on public.admin_notifications(notification_type);
