-- 2026-03-26_catalog_admin_vehicle_account_and_auth_cleanup.sql

alter table public.catalog_inventory_items
  add column if not exists subcategory text null,
  add column if not exists sort_key integer not null default 0,
  add column if not exists reuse_policy text not null default 'reorder' check (reuse_policy in ('reorder','single_use','never_reuse'));

create index if not exists catalog_inventory_items_category_idx on public.catalog_inventory_items(category);
create index if not exists catalog_inventory_items_subcategory_idx on public.catalog_inventory_items(subcategory);
create index if not exists catalog_inventory_items_sort_key_idx on public.catalog_inventory_items(sort_key);
create index if not exists catalog_inventory_items_reuse_policy_idx on public.catalog_inventory_items(reuse_policy);
