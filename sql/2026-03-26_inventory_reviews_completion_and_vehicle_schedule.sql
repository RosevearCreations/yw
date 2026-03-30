
-- 2026-03-26_inventory_reviews_completion_and_vehicle_schedule.sql

alter table public.customer_vehicles
  add column if not exists next_cleaning_due_at date null,
  add column if not exists service_interval_days integer null,
  add column if not exists auto_schedule_opt_in boolean not null default false,
  add column if not exists last_package_code text null,
  add column if not exists last_addons jsonb not null default '[]'::jsonb;

create table if not exists public.catalog_inventory_movements (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  item_id uuid null references public.catalog_inventory_items(id) on delete set null,
  item_key text null,
  booking_id uuid null references public.bookings(id) on delete set null,
  movement_type text not null check (movement_type in ('adjustment','job_use','receive','recount','waste','return')),
  qty_delta numeric(12,2) not null default 0,
  previous_qty numeric(12,2) null,
  new_qty numeric(12,2) null,
  unit_label text null,
  note text null,
  actor_name text null,
  actor_staff_user_id uuid null references public.staff_users(id) on delete set null,
  actor_customer_profile_id uuid null references public.customer_profiles(id) on delete set null
);
create index if not exists catalog_inventory_movements_item_key_idx on public.catalog_inventory_movements(item_key);
create index if not exists catalog_inventory_movements_booking_id_idx on public.catalog_inventory_movements(booking_id);

create table if not exists public.job_completion_checklists (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  booking_id uuid not null unique references public.bookings(id) on delete cascade,
  keys_returned boolean not null default false,
  water_disconnected boolean not null default false,
  electricity_disconnected boolean not null default false,
  debrief_completed boolean not null default false,
  suggested_next_steps text null,
  suggested_interval_days integer null,
  auto_schedule_requested boolean not null default false,
  completed_by_name text null,
  completed_by_staff_user_id uuid null references public.staff_users(id) on delete set null,
  completed_at timestamptz null,
  notes text null
);

create table if not exists public.customer_reviews (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  customer_profile_id uuid null references public.customer_profiles(id) on delete set null,
  booking_id uuid null references public.bookings(id) on delete set null,
  vehicle_id uuid null references public.customer_vehicles(id) on delete set null,
  review_source text not null default 'app' check (review_source in ('app','google')),
  rating integer not null check (rating between 1 and 5),
  review_title text null,
  review_text text null,
  is_public boolean not null default false,
  status text not null default 'submitted' check (status in ('submitted','approved','rejected')),
  google_review_url text null,
  reviewer_name text null
);
create index if not exists customer_reviews_booking_id_idx on public.customer_reviews(booking_id);
create index if not exists customer_reviews_customer_profile_id_idx on public.customer_reviews(customer_profile_id);

insert into public.app_management_settings (key, value, updated_at)
values ('public_review_links', '{"google_review_url":"","reviews_enabled":true}'::jsonb, now())
on conflict (key) do update
set value = excluded.value, updated_at = now();
