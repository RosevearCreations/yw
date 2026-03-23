-- File: sql/045_directory_views_and_scope_helpers.sql
-- Brief description: Refreshes the people directory view with richer profile hierarchy fields
-- and adds simple jobs/equipment views for backend and admin screens.

drop view if exists public.v_people_directory;
create view public.v_people_directory as
select
  p.id,
  p.email,
  p.full_name,
  p.role,
  p.is_active,
  p.phone,
  p.current_position,
  p.trade_specialty,
  p.employee_number,
  p.start_date,
  p.strengths,
  p.phone_verified,
  p.previous_employee,
  p.default_supervisor_profile_id,
  ds.full_name as default_supervisor_name,
  p.override_supervisor_profile_id,
  os.full_name as override_supervisor_name,
  p.default_admin_profile_id,
  da.full_name as default_admin_name,
  p.override_admin_profile_id,
  oa.full_name as override_admin_name,
  s.id as primary_site_id,
  s.site_code as primary_site_code,
  s.site_name as primary_site_name
from public.profiles p
left join public.site_assignments sa on sa.profile_id = p.id and sa.is_primary = true
left join public.sites s on s.id = sa.site_id
left join public.profiles ds on ds.id = p.default_supervisor_profile_id
left join public.profiles os on os.id = p.override_supervisor_profile_id
left join public.profiles da on da.id = p.default_admin_profile_id
left join public.profiles oa on oa.id = p.override_admin_profile_id;

drop view if exists public.v_jobs_directory;
create view public.v_jobs_directory as
select
  j.id,
  j.job_code,
  j.job_name,
  j.job_type,
  j.status,
  j.priority,
  j.client_name,
  j.start_date,
  j.end_date,
  j.notes,
  s.site_code,
  s.site_name,
  sup.full_name as supervisor_name,
  signsup.full_name as signing_supervisor_name,
  adm.full_name as admin_name
from public.jobs j
left join public.sites s on s.id = j.site_id
left join public.profiles sup on sup.id = j.site_supervisor_profile_id
left join public.profiles signsup on signsup.id = j.signing_supervisor_profile_id
left join public.profiles adm on adm.id = j.admin_profile_id;

drop view if exists public.v_equipment_directory;
create view public.v_equipment_directory as
select
  e.id,
  e.equipment_code,
  e.equipment_name,
  e.category,
  e.status,
  e.serial_number,
  e.notes,
  s.site_code as home_site_code,
  s.site_name as home_site_name,
  j.job_code as current_job_code,
  sup.full_name as assigned_supervisor_name
from public.equipment_items e
left join public.sites s on s.id = e.home_site_id
left join lateral (
  select es.job_id, es.checked_out_to_supervisor_profile_id
  from public.equipment_signouts es
  where es.equipment_item_id = e.id and es.returned_at is null
  order by es.checked_out_at desc
  limit 1
) active_signout on true
left join public.jobs j on j.id = active_signout.job_id
left join public.profiles sup on sup.id = active_signout.checked_out_to_supervisor_profile_id;
