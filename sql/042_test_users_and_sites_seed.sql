
-- File: sql/042_test_users_and_sites_seed.sql
-- Brief description: Inserts test profile/site/assignment rows for manual testing after auth users are created.
-- IMPORTANT: Create the auth users first in Supabase Auth with the same UUIDs or update these UUIDs to match real auth users.

-- Example UUIDs for testing. Replace if you already have auth users.
with seed_profiles as (
  select * from (values
    ('11111111-1111-1111-1111-111111111111'::uuid, 'employee.test@ywi.local', 'Eddie Employee', 'worker'),
    ('22222222-2222-2222-2222-222222222222'::uuid, 'supervisor.test@ywi.local', 'Sally Supervisor', 'supervisor'),
    ('33333333-3333-3333-3333-333333333333'::uuid, 'admin.test@ywi.local', 'Andy Admin', 'admin')
  ) as t(id, email, full_name, role)
)
insert into public.profiles (
  id, email, full_name, role, is_active, email_verified, phone_verified,
  phone, current_position, trade_specialty, years_employed, feature_preferences
)
select id, email, full_name, role, true, true, false,
       null,
       case when role='worker' then 'Labourer' when role='supervisor' then 'Site Supervisor' else 'Project Manager' end,
       case when role='admin' then 'Health and Safety' else 'General Construction' end,
       1,
       'default'
from seed_profiles
on conflict (id) do update set
  email = excluded.email,
  full_name = excluded.full_name,
  role = excluded.role,
  is_active = true;

insert into public.sites (id, site_code, site_name, address, region, client_name, project_code, project_status, is_active)
values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid, 'SITE-001', 'Main Yard', '100 Main Yard Rd', 'North', 'Internal', 'YWI-001', 'Active', true),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid, 'SITE-002', 'River Build', '200 River Rd', 'South', 'Demo Client', 'YWI-002', 'Active', true)
on conflict (id) do update set
  site_code = excluded.site_code,
  site_name = excluded.site_name,
  project_status = excluded.project_status,
  is_active = true;

insert into public.site_assignments (site_id, profile_id, assignment_role, is_primary)
values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid, '11111111-1111-1111-1111-111111111111'::uuid, 'worker', true),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid, '22222222-2222-2222-2222-222222222222'::uuid, 'supervisor', true),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid, '33333333-3333-3333-3333-333333333333'::uuid, 'admin', true),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid, '22222222-2222-2222-2222-222222222222'::uuid, 'supervisor', false)
on conflict do nothing;

update public.sites
set site_supervisor_profile_id = '22222222-2222-2222-2222-222222222222'::uuid,
    signing_supervisor_profile_id = '22222222-2222-2222-2222-222222222222'::uuid
where id in ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid, 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid);

-- AUTH SETUP NOTE:
-- Create these users in Supabase Auth using email/password so password login works immediately.
-- Suggested temporary passwords:
-- employee.test@ywi.local   / TempPass123!
-- supervisor.test@ywi.local / TempPass123!
-- admin.test@ywi.local      / TempPass123!
