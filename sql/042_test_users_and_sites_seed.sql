-- File: sql/042_test_users_and_sites_seed.sql
-- Brief description: Fully corrected seed file for mixed-schema projects.
-- Uses real auth.users records for profiles, avoids fake UUIDs, and lets bigint IDs auto-generate.

begin;

-- =====================================================
-- STEP 1: CHECK WHICH AUTH USERS ALREADY EXIST
-- =====================================================
-- Run this select first if you want to confirm your test users exist.
-- Replace the emails below everywhere in this file with your real test emails.

select
  id,
  email,
  created_at
from auth.users
where lower(email) in (
  lower('admin@example.com'),
  lower('supervisor@example.com'),
  lower('employee@example.com')
)
order by created_at desc;

-- =====================================================
-- STEP 2: CREATE OR UPDATE TEST SITES
-- =====================================================

insert into public.sites (
  site_code,
  site_name,
  address,
  notes,
  is_active
)
values
  (
    'SITE-HQ',
    'Head Office',
    '100 Main St, Tillsonburg, ON',
    'Main office test site',
    true
  ),
  (
    'SITE-YARD',
    'Equipment Yard',
    '200 Yard Rd, Tillsonburg, ON',
    'Yard and staging area',
    true
  )
on conflict (site_code) do update
set
  site_name = excluded.site_name,
  address = excluded.address,
  notes = excluded.notes,
  is_active = excluded.is_active;

-- =====================================================
-- STEP 3: UPSERT PROFILES FROM REAL AUTH USERS
-- =====================================================
-- IMPORTANT:
-- profiles.id must match auth.users.id.
-- These emails MUST already exist in Supabase Authentication.

with wanted_users as (
  select
    id,
    email
  from auth.users
  where lower(email) in (
    lower('admin@example.com'),
    lower('supervisor@example.com'),
    lower('employee@example.com')
  )
)
insert into public.profiles (
  id,
  email,
  full_name,
  role,
  is_active,
  phone,
  phone_verified,
  address_line1,
  city,
  province,
  postal_code,
  emergency_contact_name,
  emergency_contact_phone,
  vehicle_make_model,
  vehicle_plate,
  years_employed,
  current_position,
  previous_employee,
  trade_specialty,
  certifications,
  feature_preferences
)
select
  wu.id,
  wu.email,
  case
    when lower(wu.email) = lower('admin@example.com') then 'Test Admin'
    when lower(wu.email) = lower('supervisor@example.com') then 'Test Supervisor'
    when lower(wu.email) = lower('employee@example.com') then 'Test Employee'
    else wu.email
  end as full_name,
  case
    when lower(wu.email) = lower('admin@example.com') then 'admin'
    when lower(wu.email) = lower('supervisor@example.com') then 'supervisor'
    when lower(wu.email) = lower('employee@example.com') then 'worker'
    else 'worker'
  end as role,
  true as is_active,
  case
    when lower(wu.email) = lower('admin@example.com') then '519-555-1000'
    when lower(wu.email) = lower('supervisor@example.com') then '519-555-2000'
    when lower(wu.email) = lower('employee@example.com') then '519-555-3000'
    else null
  end as phone,
  false as phone_verified,
  '123 Demo Street' as address_line1,
  'Tillsonburg' as city,
  'ON' as province,
  'N4G 0A1' as postal_code,
  'Emergency Contact' as emergency_contact_name,
  '519-555-9999' as emergency_contact_phone,
  'Ford F150' as vehicle_make_model,
  'ABC123' as vehicle_plate,
  2 as years_employed,
  case
    when lower(wu.email) = lower('admin@example.com') then 'Administrator'
    when lower(wu.email) = lower('supervisor@example.com') then 'Site Supervisor'
    when lower(wu.email) = lower('employee@example.com') then 'Labourer'
    else 'Employee'
  end as current_position,
  false as previous_employee,
  case
    when lower(wu.email) = lower('employee@example.com') then 'General Construction'
    else 'Operations'
  end as trade_specialty,
  'WHMIS, First Aid' as certifications,
  '{"theme":"default","showTips":true}'::jsonb as feature_preferences
from wanted_users wu
on conflict (id) do update
set
  email = excluded.email,
  full_name = excluded.full_name,
  role = excluded.role,
  is_active = excluded.is_active,
  phone = excluded.phone,
  phone_verified = excluded.phone_verified,
  address_line1 = excluded.address_line1,
  city = excluded.city,
  province = excluded.province,
  postal_code = excluded.postal_code,
  emergency_contact_name = excluded.emergency_contact_name,
  emergency_contact_phone = excluded.emergency_contact_phone,
  vehicle_make_model = excluded.vehicle_make_model,
  vehicle_plate = excluded.vehicle_plate,
  years_employed = excluded.years_employed,
  current_position = excluded.current_position,
  previous_employee = excluded.previous_employee,
  trade_specialty = excluded.trade_specialty,
  certifications = excluded.certifications,
  feature_preferences = excluded.feature_preferences;

-- =====================================================
-- STEP 4: CREATE SITE ASSIGNMENTS
-- =====================================================
-- This version assumes:
-- - site_assignments.id is bigint/autonumber
-- - site_id and profile_id are the real foreign keys
-- - duplicate assignments should be avoided if they already exist

insert into public.site_assignments (
  site_id,
  profile_id,
  assignment_role,
  is_primary
)
select *
from (
  with
  site_hq as (
    select id from public.sites where site_code = 'SITE-HQ' limit 1
  ),
  site_yard as (
    select id from public.sites where site_code = 'SITE-YARD' limit 1
  ),
  admin_user as (
    select id from public.profiles where lower(email) = lower('admin@example.com') limit 1
  ),
  supervisor_user as (
    select id from public.profiles where lower(email) = lower('supervisor@example.com') limit 1
  ),
  employee_user as (
    select id from public.profiles where lower(email) = lower('employee@example.com') limit 1
  )
  select
    site_hq.id as site_id,
    admin_user.id as profile_id,
    'admin'::text as assignment_role,
    true as is_primary
  from site_hq, admin_user
  where site_hq.id is not null and admin_user.id is not null

  union all

  select
    site_hq.id as site_id,
    supervisor_user.id as profile_id,
    'supervisor'::text as assignment_role,
    true as is_primary
  from site_hq, supervisor_user
  where site_hq.id is not null and supervisor_user.id is not null

  union all

  select
    site_yard.id as site_id,
    employee_user.id as profile_id,
    'worker'::text as assignment_role,
    true as is_primary
  from site_yard, employee_user
  where site_yard.id is not null and employee_user.id is not null
) seed_rows
where not exists (
  select 1
  from public.site_assignments sa
  where sa.site_id = seed_rows.site_id
    and sa.profile_id = seed_rows.profile_id
    and sa.assignment_role = seed_rows.assignment_role
);

-- =====================================================
-- STEP 5: OPTIONAL CHECKS
-- =====================================================

select
  p.id,
  p.email,
  p.full_name,
  p.role,
  p.is_active
from public.profiles p
where lower(p.email) in (
  lower('admin@example.com'),
  lower('supervisor@example.com'),
  lower('employee@example.com')
)
order by p.email;

select
  s.site_code,
  s.site_name,
  p.email,
  sa.assignment_role,
  sa.is_primary
from public.site_assignments sa
join public.sites s on s.id = sa.site_id
join public.profiles p on p.id = sa.profile_id
where lower(p.email) in (
  lower('admin@example.com'),
  lower('supervisor@example.com'),
  lower('employee@example.com')
)
order by s.site_code, p.email;

commit;
