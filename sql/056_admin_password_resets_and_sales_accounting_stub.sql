-- File: sql/056_admin_password_resets_and_sales_accounting_stub.sql
-- Purpose:
-- - Allow audited admin password resets for any profile, including other admins.
-- - Add a minimal sales-order + accounting stub so each new order creates a first accounting record.

create table if not exists public.admin_password_resets (
  id bigserial primary key,
  target_profile_id uuid not null references public.profiles(id) on delete cascade,
  reset_by_profile_id uuid references public.profiles(id) on delete set null,
  reason text,
  force_password_change boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_admin_password_resets_target_created
  on public.admin_password_resets(target_profile_id, created_at desc);

create table if not exists public.sales_orders (
  id bigserial primary key,
  order_code text not null unique,
  customer_name text,
  customer_email text,
  order_status text not null default 'draft',
  currency_code text not null default 'CAD',
  subtotal_amount numeric(12,2) not null default 0,
  tax_amount numeric(12,2) not null default 0,
  total_amount numeric(12,2) not null default 0,
  notes text,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_sales_orders_created_at
  on public.sales_orders(created_at desc);
create index if not exists idx_sales_orders_status
  on public.sales_orders(order_status);

create table if not exists public.accounting_entries (
  id bigserial primary key,
  source_type text not null,
  source_id bigint,
  entry_type text not null,
  entry_status text not null default 'open',
  customer_name text,
  customer_email text,
  currency_code text not null default 'CAD',
  subtotal_amount numeric(12,2) not null default 0,
  tax_amount numeric(12,2) not null default 0,
  total_amount numeric(12,2) not null default 0,
  payload jsonb not null default '{}'::jsonb,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_accounting_entries_source
  on public.accounting_entries(source_type, source_id);
create index if not exists idx_accounting_entries_status
  on public.accounting_entries(entry_status, created_at desc);

create or replace view public.v_sales_order_accounting_summary as
select
  so.id,
  so.order_code,
  so.customer_name,
  so.customer_email,
  so.order_status,
  so.currency_code,
  so.subtotal_amount,
  so.tax_amount,
  so.total_amount,
  so.created_at,
  so.updated_at,
  ae.id as accounting_entry_id,
  ae.entry_type,
  ae.entry_status,
  ae.payload as accounting_payload,
  ae.created_at as accounting_created_at
from public.sales_orders so
left join public.accounting_entries ae
  on ae.source_type = 'sales_order'
 and ae.source_id = so.id;
