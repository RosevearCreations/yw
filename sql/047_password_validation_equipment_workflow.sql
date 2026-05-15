-- File: sql/047_password_validation_equipment_workflow.sql
-- Brief description: Adds missing workflow columns for direct reporting and equipment lifecycle.

alter table public.profiles
  add column if not exists override_supervisor_profile_id uuid references public.profiles(id) on delete set null,
  add column if not exists override_admin_profile_id uuid references public.profiles(id) on delete set null;

alter table public.site_assignments
  add column if not exists reports_to_supervisor_profile_id uuid references public.profiles(id) on delete set null,
  add column if not exists reports_to_admin_profile_id uuid references public.profiles(id) on delete set null,
  add column if not exists updated_at timestamptz;

alter table public.equipment_items
  add column if not exists current_job_id bigint references public.jobs(id) on delete set null,
  add column if not exists assigned_supervisor_profile_id uuid references public.profiles(id) on delete set null;

alter table public.job_equipment_requirements
  add column if not exists equipment_item_id bigint references public.equipment_items(id) on delete set null,
  add column if not exists equipment_code text;

create index if not exists idx_equipment_items_current_job_id on public.equipment_items(current_job_id);
create index if not exists idx_site_assignments_reports_to_supervisor on public.site_assignments(reports_to_supervisor_profile_id);
create index if not exists idx_site_assignments_reports_to_admin on public.site_assignments(reports_to_admin_profile_id);
