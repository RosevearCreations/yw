-- Adds the current screen-by-screen fields needed for Customer, Detailer, and Admin screens.
begin;

alter table public.customer_profiles add column if not exists preferred_contact_name text;
alter table public.customer_profiles add column if not exists sms_phone text;
alter table public.customer_profiles add column if not exists alternate_address_label text;
alter table public.customer_profiles add column if not exists alternate_address_line1 text;
alter table public.customer_profiles add column if not exists alternate_address_line2 text;
alter table public.customer_profiles add column if not exists alternate_city text;
alter table public.customer_profiles add column if not exists alternate_province text;
alter table public.customer_profiles add column if not exists alternate_postal_code text;
alter table public.customer_profiles add column if not exists client_private_notes text;
alter table public.customer_profiles add column if not exists detailer_visible_notes text;
alter table public.customer_profiles add column if not exists admin_private_notes text;
alter table public.customer_profiles add column if not exists notify_on_progress_post boolean not null default true;
alter table public.customer_profiles add column if not exists notify_on_media_upload boolean not null default true;
alter table public.customer_profiles add column if not exists notify_on_comment_reply boolean not null default true;
alter table public.customer_profiles add column if not exists has_water_hookup boolean not null default false;
alter table public.customer_profiles add column if not exists has_power_hookup boolean not null default false;
alter table public.customer_profiles add column if not exists live_updates_enabled boolean not null default true;
alter table public.customer_profiles add column if not exists billing_profile_enabled boolean not null default false;

alter table public.customer_vehicles add column if not exists preferred_contact_name text;
alter table public.customer_vehicles add column if not exists contact_email text;
alter table public.customer_vehicles add column if not exists contact_phone text;
alter table public.customer_vehicles add column if not exists text_updates_opt_in boolean not null default false;
alter table public.customer_vehicles add column if not exists billing_label text;

alter table public.staff_users add column if not exists vehicle_info text;
alter table public.staff_users add column if not exists preferred_contact_name text;
alter table public.staff_users add column if not exists sms_phone text;
alter table public.staff_users add column if not exists department text;
alter table public.staff_users add column if not exists admin_level integer;
alter table public.staff_users add column if not exists detailer_level integer;
alter table public.staff_users add column if not exists permissions_profile text;
alter table public.staff_users add column if not exists preferred_work_hours text;
alter table public.staff_users add column if not exists pay_schedule text;
alter table public.staff_users add column if not exists hourly_rate_cents integer;
alter table public.staff_users add column if not exists personal_admin_notes text;
alter table public.staff_users add column if not exists tips_payout_notes text;
alter table public.staff_users add column if not exists supervisor_staff_user_id uuid;

create table if not exists public.app_management_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

commit;
