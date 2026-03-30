
-- sql/2026-03-24_catalog_recovery_and_dispatch.sql
--
-- Adds:
-- - catalog_items table for systems/consumables maintenance and reordering
-- - notification retry/dispatch fields if missing
-- - analytics indexes
-- - optional provider response storage

begin;

create table if not exists public.catalog_items (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  catalog_type text not null check (catalog_type in ('systems','consumables')),
  title text not null,
  category text not null default 'general',
  image_url text null,
  supplier_url text null,
  sort_order integer not null default 0,
  quantity_on_hand integer not null default 0,
  reorder_level integer not null default 0,
  unit_cost_cents integer not null default 0,
  notes text null,
  is_active boolean not null default true
);

create index if not exists idx_catalog_items_type_sort on public.catalog_items (catalog_type, sort_order, updated_at desc);

alter table public.notification_events add column if not exists provider_response jsonb null;
alter table public.notification_events add column if not exists subject text null;
alter table public.notification_events add column if not exists body_text text null;
alter table public.notification_events add column if not exists body_html text null;
alter table public.notification_events add column if not exists next_attempt_at timestamptz null;
alter table public.notification_events add column if not exists max_attempts integer not null default 5;

create index if not exists idx_notification_events_status_next_attempt on public.notification_events (status, next_attempt_at);
create index if not exists idx_site_activity_events_session_created on public.site_activity_events (session_id, created_at);
create index if not exists idx_site_activity_events_event_created on public.site_activity_events (event_type, created_at);

commit;
