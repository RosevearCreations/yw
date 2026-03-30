-- sql/2026-03-24_recovery_threads_catalog_alerts.sql
-- Adds provider-specific recovery rules, thread moderation fields,
-- and low-stock alert/reorder tracking.

begin;

alter table public.progress_comments
  add column if not exists thread_status text not null default 'visible';

alter table public.progress_comments
  add column if not exists moderated_at timestamptz null;

alter table public.progress_comments
  add column if not exists moderated_by_staff_user_id uuid null references public.staff_users(id) on delete set null;

alter table public.progress_comments
  add column if not exists moderated_by_name text null;

alter table public.progress_comments
  add column if not exists moderation_reason text null;

create index if not exists idx_progress_comments_thread_status on public.progress_comments(thread_status, created_at desc);

alter table public.observation_annotations
  add column if not exists thread_status text not null default 'visible';

alter table public.observation_annotations
  add column if not exists moderated_at timestamptz null;

alter table public.observation_annotations
  add column if not exists moderated_by_staff_user_id uuid null references public.staff_users(id) on delete set null;

alter table public.observation_annotations
  add column if not exists moderated_by_name text null;

alter table public.observation_annotations
  add column if not exists moderation_reason text null;

create index if not exists idx_observation_annotations_thread_status on public.observation_annotations(thread_status, created_at desc);

alter table public.catalog_items
  add column if not exists last_reorder_requested_at timestamptz null;

alter table public.catalog_items
  add column if not exists last_reorder_note text null;

create table if not exists public.catalog_low_stock_alerts (
  id uuid primary key default gen_random_uuid(),
  catalog_item_id uuid not null references public.catalog_items(id) on delete cascade,
  status text not null default 'open',
  quantity_snapshot integer not null default 0,
  reorder_level_snapshot integer not null default 0,
  notes text null,
  resolution_notes text null,
  last_notified_at timestamptz null,
  resolved_at timestamptz null,
  resolved_by_name text null,
  created_at timestamptz not null default now()
);

create index if not exists idx_catalog_low_stock_alerts_item on public.catalog_low_stock_alerts(catalog_item_id, created_at desc);
create index if not exists idx_catalog_low_stock_alerts_status on public.catalog_low_stock_alerts(status, created_at desc);

insert into public.app_management_settings (key, value)
values
  ('recovery_provider_rules', jsonb_build_object(
    'email', jsonb_build_object(
      'enabled', true,
      'provider_key', 'default_email',
      'send_test_to', '',
      'recovery_webhook_url', '',
      'auth_token', ''
    ),
    'sms', jsonb_build_object(
      'enabled', false,
      'provider_key', 'default_sms',
      'send_test_to', '',
      'recovery_webhook_url', '',
      'auth_token', ''
    )
  )),
  ('moderation_rules', jsonb_build_object(
    'annotation_customer_visibility_default', true,
    'comment_customer_visibility_default', true,
    'client_reply_depth_limit', 4,
    'staff_reply_depth_limit', 8,
    'allow_client_annotation_replies', true,
    'allow_staff_hide_without_delete', true
  ))
on conflict (key) do update
set value = excluded.value,
    updated_at = now();

insert into public.app_management_settings (key, value)
values (
  'feature_flags',
  jsonb_build_object(
    'live_updates_default', false,
    'customer_chat_enabled', true,
    'picture_first_observations', true,
    'tier_discount_badges', true,
    'image_annotations_enabled', true,
    'annotation_lightbox_enabled', true,
    'annotation_thread_replies_enabled', true,
    'annotation_moderation_enabled', true,
    'two_sided_thread_controls_enabled', true,
    'notifications_retry_enabled', true,
    'catalog_management_enabled', true,
    'analytics_journeys_enabled', true,
    'abandoned_recovery_enabled', true,
    'seo_structured_data_enabled', true,
    'analytics_tracking_enabled', true,
    'public_catalog_db_enabled', true,
    'recovery_templates_enabled', true,
    'low_stock_alerts_enabled', true
  )
)
on conflict (key) do update
set value = public.app_management_settings.value || excluded.value,
    updated_at = now();

commit;
