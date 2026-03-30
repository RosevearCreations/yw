-- 2026-03-25_vehicle_catalog_and_staff_flow.sql

alter table public.bookings
  add column if not exists address_line2 text null,
  add column if not exists vehicle_year integer null,
  add column if not exists vehicle_make text null,
  add column if not exists vehicle_model text null,
  add column if not exists vehicle_body_style text null,
  add column if not exists vehicle_category text null,
  add column if not exists vehicle_plate text null,
  add column if not exists vehicle_mileage_km numeric null,
  add column if not exists vehicle_photo_url text null;

alter table public.customer_vehicles
  add column if not exists vehicle_size text null,
  add column if not exists body_style text null,
  add column if not exists vehicle_category text null,
  add column if not exists is_exotic boolean not null default false,
  add column if not exists detailer_visible_notes text null,
  add column if not exists admin_private_notes text null,
  add column if not exists preferred_contact_name text null,
  add column if not exists contact_email text null,
  add column if not exists contact_phone text null,
  add column if not exists text_updates_opt_in boolean not null default false,
  add column if not exists live_updates_opt_in boolean not null default true,
  add column if not exists has_water_hookup boolean not null default false,
  add column if not exists has_power_hookup boolean not null default false,
  add column if not exists save_billing_on_file boolean not null default false,
  add column if not exists billing_label text null,
  add column if not exists display_order integer not null default 0,
  add column if not exists last_wash_at date null;

create table if not exists public.vehicle_catalog_cache (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  model_year integer not null,
  make text not null,
  model text not null,
  vehicle_type text not null default '' ,
  size_bucket text null,
  is_exotic boolean not null default false,
  source text not null default 'nhtsa_vpic',
  last_seen_at timestamptz not null default now(),
  unique (model_year, make, model, vehicle_type)
);

create index if not exists vehicle_catalog_cache_year_make_idx on public.vehicle_catalog_cache(model_year, make);
create index if not exists vehicle_catalog_cache_make_model_idx on public.vehicle_catalog_cache(make, model);
