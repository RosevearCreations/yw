-- Adds visitor analytics/event logging foundation and feature flags for security/SEO-oriented admin insights.

begin;

create table if not exists public.site_activity_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  visitor_id text not null,
  session_id text not null,
  event_type text not null,
  page_path text not null,
  page_title text null,
  referrer text null,
  country text null,
  ip_address text null,
  user_agent text null,
  locale text null,
  timezone text null,
  screen text null,
  source text null,
  campaign text null,
  checkout_state text null,
  payload jsonb not null default '{}'::jsonb
);

create index if not exists idx_site_activity_events_created_at on public.site_activity_events(created_at desc);
create index if not exists idx_site_activity_events_event_type on public.site_activity_events(event_type, created_at desc);
create index if not exists idx_site_activity_events_page_path on public.site_activity_events(page_path, created_at desc);
create index if not exists idx_site_activity_events_visitor_id on public.site_activity_events(visitor_id, created_at desc);
create index if not exists idx_site_activity_events_country on public.site_activity_events(country, created_at desc);

insert into public.app_management_settings (key, value)
select 'feature_flags', '{"analytics_tracking_enabled": true, "customer_chat_enabled": true, "picture_first_observations": true, "image_annotations_enabled": true, "notifications_retry_enabled": true, "annotation_lightbox_enabled": true, "annotation_thread_replies_enabled": true}'::jsonb
where not exists (select 1 from public.app_management_settings where key = 'feature_flags');

commit;
