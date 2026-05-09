-- =========================================================
-- sql/039_directory_scope_helpers.sql
-- Purpose:
-- - Add helper views/functions to support self, crew, and all directory scopes
-- - Keep admin-directory and selector/backend logic simpler and more consistent
-- =========================================================

create or replace view public.v_people_directory as
select
  p.id,
  p.email,
  p.full_name,
  p.role,
  p.is_active,
  p.phone,
  p.phone_verified,
  p.email_verified,
  p.address_line1,
  p.address_line2,
  p.city,
  p.province,
  p.postal_code,
  p.emergency_contact_name,
  p.emergency_contact_phone,
  p.vehicle_make_model,
  p.vehicle_plate,
  p.years_employed,
  p.current_position,
  p.previous_employee,
  p.trade_specialty,
  p.certifications,
  p.feature_preferences,
  p.notes,
  sa.site_id as primary_site_id,
  s.site_code as primary_site_code,
  s.site_name as primary_site_name
from public.profiles p
left join public.site_assignments sa on sa.profile_id = p.id and sa.is_primary = true
left join public.sites s on s.id = sa.site_id;

create or replace function public.directory_scope(scope text default 'self')
returns setof public.v_people_directory
language sql
stable
as $$
  select *
  from public.v_people_directory d
  where case
    when scope = 'self' then d.id = auth.uid()
    when scope = 'crew' then public.can_view_profile(d.id)
    when scope = 'all' then public.current_profile_role() = 'admin'
    else false
  end;
$$;
