-- Adds observation annotations and stronger notification queue handling

begin;

create table if not exists public.observation_annotations (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  media_id uuid null,
  x_percent numeric(6,2) null,
  y_percent numeric(6,2) null,
  title text null,
  note text not null,
  visibility text not null default 'customer',
  created_by_type text not null default 'staff',
  created_by_name text null,
  created_by_email text null,
  created_at timestamptz not null default now()
);

create index if not exists idx_observation_annotations_booking_id on public.observation_annotations(booking_id, created_at desc);
create index if not exists idx_observation_annotations_media_id on public.observation_annotations(media_id);

alter table public.notification_events
  add column if not exists status text not null default 'queued';
alter table public.notification_events
  add column if not exists attempt_count integer not null default 0;
alter table public.notification_events
  add column if not exists last_error text null;
alter table public.notification_events
  add column if not exists processed_at timestamptz null;

update public.notification_events
   set status = coalesce(status, 'queued'),
       attempt_count = coalesce(attempt_count, 0)
 where true;

insert into public.app_management_settings (key, value)
select 'feature_flags', '{"image_annotations_enabled": true, "customer_chat_enabled": true, "picture_first_observations": true}'::jsonb
where not exists (select 1 from public.app_management_settings where key = 'feature_flags');

commit;
