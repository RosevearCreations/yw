-- Expands current role/profile structures for the next Customer / Detailer / Admin screens.
begin;

alter table public.customer_vehicles add column if not exists contact_email text null;
alter table public.customer_vehicles add column if not exists contact_phone text null;
alter table public.customer_vehicles add column if not exists contact_sms_phone text null;
alter table public.customer_vehicles add column if not exists billing_profile_label text null;
alter table public.customer_vehicles add column if not exists last_wash_score smallint null;
alter table public.customer_vehicles add column if not exists notification_opt_in boolean not null default true;

alter table public.staff_users add column if not exists detailer_level smallint null;
alter table public.staff_users add column if not exists department text null;
alter table public.staff_users add column if not exists permissions_profile jsonb not null default '{}'::jsonb;
alter table public.staff_users add column if not exists personal_admin_notes text null;
alter table public.staff_users add column if not exists vehicle_info text null;
alter table public.staff_users add column if not exists tips_payout_notes text null;

create table if not exists public.app_management_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by_staff_user_id uuid null references public.staff_users(id) on delete set null
);

insert into public.app_management_settings(key, value)
values
  ('role_visibility_defaults', jsonb_build_object(
    'client', jsonb_build_object('manual_scheduling', false, 'block_time', false),
    'detailer', jsonb_build_object('manual_scheduling', false, 'block_time', false),
    'senior_detailer', jsonb_build_object('manual_scheduling', false, 'block_time', false),
    'admin', jsonb_build_object('manual_scheduling', true, 'block_time', true)
  ))
on conflict (key) do nothing;

commit;
