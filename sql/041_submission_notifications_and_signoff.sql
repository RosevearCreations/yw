
-- File: sql/041_submission_notifications_and_signoff.sql
-- Brief description: Adds supervisor sign-off fields and an admin notification queue.

alter table public.submissions add column if not exists site_id uuid references public.sites(id);
alter table public.submissions add column if not exists signed_off_by_profile_id uuid references public.profiles(id);
alter table public.submissions add column if not exists signed_off_by_name text;
alter table public.submissions add column if not exists signed_off_role text;
alter table public.submissions add column if not exists signed_off_at timestamptz;
alter table public.submissions add column if not exists requires_admin_review boolean not null default false;

create table if not exists public.admin_notifications (
  id bigint generated always as identity primary key,
  event_type text not null,
  submission_id uuid null,
  site_id uuid null,
  actor_profile_id uuid null,
  actor_name text,
  actor_role text,
  recipient_profile_id uuid null references public.profiles(id) on delete set null,
  title text not null,
  message text not null,
  payload jsonb not null default '{}'::jsonb,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_admin_notifications_recipient_created
  on public.admin_notifications(recipient_profile_id, is_read, created_at desc);
