begin;

alter table public.customer_profiles add column if not exists preferred_contact_name text null;
alter table public.customer_profiles add column if not exists sms_phone text null;
alter table public.customer_profiles add column if not exists notify_on_progress_post boolean not null default true;
alter table public.customer_profiles add column if not exists notify_on_media_upload boolean not null default true;
alter table public.customer_profiles add column if not exists notify_on_comment_reply boolean not null default true;

alter table public.staff_users add column if not exists admin_level text null;
alter table public.staff_users add column if not exists department text null;
alter table public.staff_users add column if not exists permissions_profile text null;
alter table public.staff_users add column if not exists sms_phone text null;
alter table public.staff_users add column if not exists preferred_contact_name text null;

create table if not exists public.notification_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  sent_at timestamptz null,
  event_type text not null,
  channel text null,
  status text not null default 'queued',
  booking_id uuid null references public.bookings(id) on delete set null,
  customer_profile_id uuid null references public.customer_profiles(id) on delete set null,
  recipient_email text null,
  recipient_phone text null,
  payload jsonb not null default '{}'::jsonb
);
create index if not exists idx_notification_events_status_created on public.notification_events (status, created_at desc);
create index if not exists idx_notification_events_booking on public.notification_events (booking_id, created_at desc);

alter table public.progress_comments add column if not exists visibility text not null default 'internal';

commit;
