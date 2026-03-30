-- adds current UI/profile fields for tier discounts and richer staff/customer screens.
begin;

alter table public.customer_tiers
  add column if not exists discount_pct numeric(5,2) null;

alter table public.customer_profiles
  add column if not exists detailer_visible_notes text null,
  add column if not exists admin_private_notes text null,
  add column if not exists has_water_hookup boolean not null default false,
  add column if not exists has_power_hookup boolean not null default false,
  add column if not exists live_updates_opt_in boolean not null default true,
  add column if not exists save_billing_on_file boolean not null default false;

alter table public.staff_users
  add column if not exists total_tips_cents integer not null default 0,
  add column if not exists tip_payout_total_cents integer not null default 0;

create table if not exists public.staff_tip_payouts (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  staff_user_id uuid not null references public.staff_users(id) on delete cascade,
  paid_at timestamptz not null default now(),
  amount_cents integer not null default 0,
  notes text null
);

create index if not exists idx_staff_tip_payouts_staff_user_id
  on public.staff_tip_payouts (staff_user_id, paid_at desc);

commit;
