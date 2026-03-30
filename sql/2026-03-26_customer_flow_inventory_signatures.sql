-- 2026-03-26_customer_flow_inventory_signatures.sql
alter table public.catalog_inventory_items
  add column if not exists purchase_date date null,
  add column if not exists estimated_jobs_per_unit numeric(12,2) null;
