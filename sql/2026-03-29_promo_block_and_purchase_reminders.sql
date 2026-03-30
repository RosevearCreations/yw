-- 2026-03-29_promo_block_and_purchase_reminders.sql

alter table public.catalog_purchase_orders
  add column if not exists reminder_sent_at timestamptz null,
  add column if not exists reminder_last_channel text null;

create index if not exists catalog_purchase_orders_reminder_sent_at_idx
  on public.catalog_purchase_orders(reminder_sent_at);
