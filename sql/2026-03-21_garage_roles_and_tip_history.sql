-- Adds garage vehicles, richer client/staff fields, and tip payout history.
begin;

alter table public.customer_profiles add column if not exists preferred_contact_name text null;
alter table public.customer_profiles add column if not exists sms_phone text null;
alter table public.customer_profiles add column if not exists alternate_service_address text null;
alter table public.customer_profiles add column if not exists client_private_notes text null;
alter table public.customer_profiles add column if not exists notify_on_progress_post boolean not null default true;
alter table public.customer_profiles add column if not exists notify_on_media_upload boolean not null default true;
alter table public.customer_profiles add column if not exists notify_on_comment_reply boolean not null default true;

alter table public.staff_users add column if not exists preferred_contact_name text null;
alter table public.staff_users add column if not exists sms_phone text null;
alter table public.staff_users add column if not exists admin_level smallint null;
alter table public.staff_users add column if not exists supervisor_staff_user_id uuid null references public.staff_users(id) on delete set null;
alter table public.staff_users add column if not exists pay_schedule text null;
alter table public.staff_users add column if not exists hourly_rate_cents integer null;
alter table public.staff_users add column if not exists preferred_work_hours text null;
alter table public.staff_users add column if not exists total_tips_cents integer not null default 0;
alter table public.staff_users add column if not exists admin_private_notes text null;

create table if not exists public.customer_vehicles (
  id uuid primary key default gen_random_uuid(),
  customer_profile_id uuid not null references public.customer_profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  display_order integer not null default 0,
  is_primary boolean not null default false,
  vehicle_name text null,
  model_year integer null,
  make text null,
  model text null,
  color text null,
  mileage_km integer null,
  last_wash_at date null,
  parking_location text null,
  alternate_service_address text null,
  notes_for_team text null,
  detailer_visible_notes text null,
  admin_private_notes text null,
  has_water_hookup boolean not null default false,
  has_power_hookup boolean not null default false,
  live_updates_opt_in boolean not null default true,
  save_billing_on_file boolean not null default false
);
create index if not exists idx_customer_vehicles_customer_profile_id on public.customer_vehicles(customer_profile_id);

create table if not exists public.staff_tip_payouts (
  id uuid primary key default gen_random_uuid(),
  staff_user_id uuid not null references public.staff_users(id) on delete cascade,
  created_at timestamptz not null default now(),
  payout_date date not null default current_date,
  amount_cents integer not null default 0,
  note text null,
  processed_by_staff_user_id uuid null references public.staff_users(id) on delete set null
);
create index if not exists idx_staff_tip_payouts_staff_user_id on public.staff_tip_payouts(staff_user_id, payout_date desc);

create or replace function public.set_customer_vehicles_updated_at()
returns trigger language plpgsql as $$ begin new.updated_at := now(); return new; end; $$;
drop trigger if exists trg_customer_vehicles_updated_at on public.customer_vehicles;
create trigger trg_customer_vehicles_updated_at before update on public.customer_vehicles for each row execute function public.set_customer_vehicles_updated_at();

commit;
