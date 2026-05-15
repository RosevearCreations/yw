-- 062_deeper_workflow_polish_admin_foundation.sql
-- Deeper workflow polish on top of 061:
-- estimate/work-order lines, route stops, AR/AP payment posting,
-- purchase/material receiving, and linked HSE packets for work orders/dispatches.

create extension if not exists pgcrypto;

create table if not exists public.material_receipts (
  id uuid primary key default gen_random_uuid(),
  receipt_number text not null unique,
  vendor_id uuid references public.ap_vendors(id) on delete set null,
  client_site_id uuid references public.client_sites(id) on delete set null,
  work_order_id uuid references public.work_orders(id) on delete set null,
  receipt_status text not null default 'draft',
  receipt_date date not null default current_date,
  received_by_profile_id uuid references public.profiles(id) on delete set null,
  notes text,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.material_receipt_lines (
  id uuid primary key default gen_random_uuid(),
  receipt_id uuid not null references public.material_receipts(id) on delete cascade,
  line_order integer not null default 0,
  material_id uuid references public.materials_catalog(id) on delete set null,
  description text not null,
  unit_id uuid references public.units_of_measure(id) on delete set null,
  quantity numeric(12,2) not null default 0,
  unit_cost numeric(12,2) not null default 0,
  line_total numeric(12,2) not null default 0,
  cost_code_id uuid references public.cost_codes(id) on delete set null,
  work_order_line_id uuid references public.work_order_lines(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.linked_hse_packets (
  id uuid primary key default gen_random_uuid(),
  packet_number text not null unique,
  packet_type text not null default 'work_order',
  packet_status text not null default 'draft',
  work_order_id uuid references public.work_orders(id) on delete set null,
  dispatch_id uuid references public.subcontract_dispatches(id) on delete set null,
  client_site_id uuid references public.client_sites(id) on delete set null,
  route_id uuid references public.routes(id) on delete set null,
  supervisor_profile_id uuid references public.profiles(id) on delete set null,
  briefing_required boolean not null default true,
  inspection_required boolean not null default true,
  emergency_review_required boolean not null default false,
  completion_percent numeric(5,2) not null default 0,
  packet_notes text,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (packet_type in ('work_order','dispatch','standalone_hse')),
  check (completion_percent >= 0 and completion_percent <= 100)
);

create index if not exists idx_route_stops_route_id on public.route_stops(route_id);
create index if not exists idx_estimate_lines_estimate_id on public.estimate_lines(estimate_id);
create index if not exists idx_work_order_lines_work_order_id on public.work_order_lines(work_order_id);
create index if not exists idx_ar_payments_invoice_id on public.ar_payments(invoice_id);
create index if not exists idx_ap_payments_bill_id on public.ap_payments(bill_id);
create index if not exists idx_material_receipts_vendor_id on public.material_receipts(vendor_id);
create index if not exists idx_material_receipts_work_order_id on public.material_receipts(work_order_id);
create index if not exists idx_material_receipt_lines_receipt_id on public.material_receipt_lines(receipt_id);
create index if not exists idx_linked_hse_packets_work_order_id on public.linked_hse_packets(work_order_id);
create index if not exists idx_linked_hse_packets_dispatch_id on public.linked_hse_packets(dispatch_id);

insert into public.cost_codes (code, name, category)
values
  ('REC', 'Material Receiving', 'overhead'),
  ('WOH', 'Work Order HSE Packet', 'overhead'),
  ('DSH', 'Dispatch HSE Packet', 'overhead')
on conflict (code) do nothing;
