-- 2026-03-24_paypal_gift_checkout_and_admin_controls.sql

alter table public.bookings
  add column if not exists payment_provider text null,
  add column if not exists paypal_order_id text null,
  add column if not exists paypal_capture_id text null;

create index if not exists bookings_payment_provider_idx
  on public.bookings(payment_provider);

create index if not exists bookings_paypal_order_id_idx
  on public.bookings(paypal_order_id);

alter table public.catalog_low_stock_alerts
  add column if not exists resolved_by_name text null,
  add column if not exists resolution_notes text null;

alter table public.observation_annotations
  add column if not exists thread_status text not null default 'visible',
  add column if not exists moderated_at timestamptz null,
  add column if not exists moderated_by_staff_user_id uuid null references public.staff_users(id) on delete set null,
  add column if not exists moderated_by_name text null,
  add column if not exists moderation_reason text null;

create index if not exists observation_annotations_thread_status_idx
  on public.observation_annotations(thread_status);

insert into public.app_management_settings (key, value, updated_at)
values
  (
    'payment_methods',
    '{"stripe": true, "paypal": true, "gift_only_confirm": true}'::jsonb,
    now()
  )
on conflict (key) do update
set
  value = excluded.value,
  updated_at = now();
