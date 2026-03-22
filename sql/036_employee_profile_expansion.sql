-- =========================================================
-- sql/036_employee_profile_expansion.sql
-- Purpose:
-- - Expand public.profiles for richer employee, supervisor, and admin records
-- - Support contact details, employment history, vehicle info, preferences, and site-use notes
-- - Keep admin profile editing aligned with the current frontend
-- =========================================================

alter table public.profiles add column if not exists phone text;
alter table public.profiles add column if not exists phone_verified boolean not null default false;
alter table public.profiles add column if not exists address_line1 text;
alter table public.profiles add column if not exists address_line2 text;
alter table public.profiles add column if not exists city text;
alter table public.profiles add column if not exists province text;
alter table public.profiles add column if not exists postal_code text;
alter table public.profiles add column if not exists emergency_contact_name text;
alter table public.profiles add column if not exists emergency_contact_phone text;
alter table public.profiles add column if not exists vehicle_make_model text;
alter table public.profiles add column if not exists vehicle_plate text;
alter table public.profiles add column if not exists years_employed numeric(6,2);
alter table public.profiles add column if not exists current_position text;
alter table public.profiles add column if not exists previous_employee boolean not null default false;
alter table public.profiles add column if not exists trade_specialty text;
alter table public.profiles add column if not exists certifications text;
alter table public.profiles add column if not exists feature_preferences text;
alter table public.profiles add column if not exists notes text;
alter table public.profiles add column if not exists email_verified boolean not null default false;

comment on column public.profiles.feature_preferences is
'Future UI preferences and enabled feature notes for the user.';
