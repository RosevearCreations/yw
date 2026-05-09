-- 075_landscaping_job_workflow_and_crew_planning.sql
-- Expands the job model for one-time landscaping, recurring route/service work,
-- and larger custom project work while making crew leadership and equipment
-- planning windows first-class fields.

create extension if not exists pgcrypto;

alter table if exists public.crews
  add column if not exists crew_kind text not null default 'general',
  add column if not exists lead_profile_id uuid references public.profiles(id) on delete set null,
  add column if not exists service_area_id uuid references public.service_areas(id) on delete set null,
  add column if not exists default_equipment_notes text;

alter table if exists public.crews
  drop constraint if exists crews_crew_kind_check;
alter table if exists public.crews
  add constraint crews_crew_kind_check
  check (crew_kind in ('general','installation','maintenance','snow','parks','construction','custom'));

alter table if exists public.crew_members
  drop constraint if exists crew_members_member_role_check;
alter table if exists public.crew_members
  add constraint crew_members_member_role_check
  check (member_role in ('member','lead','supervisor','operator','labourer','installer','maintenance','hse'));

alter table if exists public.jobs
  add column if not exists job_family text not null default 'landscaping_standard',
  add column if not exists project_scope text not null default 'property_service',
  add column if not exists service_pattern text not null default 'one_time',
  add column if not exists recurrence_basis text not null default 'calendar_rule',
  add column if not exists recurrence_custom_days text,
  add column if not exists custom_schedule_notes text,
  add column if not exists crew_lead_profile_id uuid references public.profiles(id) on delete set null,
  add column if not exists equipment_planning_status text not null default 'draft',
  add column if not exists reservation_window_start date,
  add column if not exists reservation_window_end date,
  add column if not exists reservation_notes text,
  add column if not exists estimated_visit_minutes integer,
  add column if not exists equipment_readiness_required boolean not null default true;

alter table if exists public.jobs
  drop constraint if exists jobs_job_family_check;
alter table if exists public.jobs
  add constraint jobs_job_family_check
  check (job_family in ('landscaping_standard','landscaping_recurring','custom_project','park_project','park_maintenance','snow','home_modification','construction'));

alter table if exists public.jobs
  drop constraint if exists jobs_project_scope_check;
alter table if exists public.jobs
  add constraint jobs_project_scope_check
  check (project_scope in ('property_service','park','home_modification','construction','maintenance','snow'));

alter table if exists public.jobs
  drop constraint if exists jobs_service_pattern_check;
alter table if exists public.jobs
  add constraint jobs_service_pattern_check
  check (service_pattern in ('one_time','weekly','biweekly','monthly','seasonal','custom'));

alter table if exists public.jobs
  drop constraint if exists jobs_recurrence_basis_check;
alter table if exists public.jobs
  add constraint jobs_recurrence_basis_check
  check (recurrence_basis in ('calendar_rule','custom_cycle','event_driven'));

alter table if exists public.jobs
  drop constraint if exists jobs_equipment_planning_status_check;
alter table if exists public.jobs
  add constraint jobs_equipment_planning_status_check
  check (equipment_planning_status in ('draft','planned','reserved','partial','ready'));

create index if not exists idx_crews_lead_profile_id on public.crews(lead_profile_id);
create index if not exists idx_crews_service_area_id on public.crews(service_area_id);
create index if not exists idx_jobs_job_family on public.jobs(job_family);
create index if not exists idx_jobs_service_pattern on public.jobs(service_pattern);
create index if not exists idx_jobs_equipment_planning_status on public.jobs(equipment_planning_status);
create index if not exists idx_jobs_reservation_window on public.jobs(reservation_window_start, reservation_window_end);
create index if not exists idx_jobs_crew_lead_profile_id on public.jobs(crew_lead_profile_id);

create or replace view public.v_crew_directory as
select
  c.id,
  c.crew_code,
  c.crew_name,
  c.supervisor_profile_id,
  c.crew_status,
  c.notes,
  c.created_by_profile_id,
  c.created_at,
  c.updated_at,
  sup.full_name as supervisor_name,
  count(cm.id)::int as member_count,
  coalesce(jsonb_agg(jsonb_build_object(
    'id', p.id,
    'full_name', p.full_name,
    'email', p.email,
    'member_role', cm.member_role,
    'is_primary', cm.is_primary
  ) order by cm.is_primary desc, p.full_name) filter (where cm.id is not null), '[]'::jsonb) as members_json,
  c.lead_profile_id,
  c.service_area_id,
  c.crew_kind,
  c.default_equipment_notes,
  leadp.full_name as lead_name,
  sa.name as service_area_name
from public.crews c
left join public.profiles sup on sup.id = c.supervisor_profile_id
left join public.profiles leadp on leadp.id = c.lead_profile_id
left join public.service_areas sa on sa.id = c.service_area_id
left join public.crew_members cm on cm.crew_id = c.id
left join public.profiles p on p.id = cm.profile_id
group by c.id, sup.full_name, leadp.full_name, sa.name;

create or replace view public.v_jobs_directory as
select
  j.id,
  j.job_code,
  j.job_name,
  j.site_id,
  j.job_type,
  j.status,
  j.priority,
  j.client_name,
  j.start_date,
  j.end_date,
  j.site_supervisor_profile_id,
  j.signing_supervisor_profile_id,
  j.admin_profile_id,
  j.notes,
  j.created_by_profile_id,
  j.approval_status,
  j.approval_requested_at,
  j.approved_at,
  j.approved_by_profile_id,
  j.approval_notes,
  j.created_at,
  j.updated_at,
  s.site_code,
  s.site_name,
  sup.full_name as supervisor_name,
  signsup.full_name as signing_supervisor_name,
  adm.full_name as admin_name,
  j.crew_id,
  j.assigned_supervisor_profile_id,
  j.schedule_mode,
  j.recurrence_rule,
  j.recurrence_summary,
  j.recurrence_interval,
  j.recurrence_anchor_date,
  j.special_instructions,
  j.last_activity_at,
  crew.crew_name,
  assignedsup.full_name as assigned_supervisor_name,
  coalesce(crew_rollup.member_count, 0) as crew_member_count,
  coalesce(comment_rollup.comment_count, 0) as comment_count,
  coalesce(comment_rollup.photo_count, 0) as photo_count,
  crew.crew_code,
  j.job_family,
  j.project_scope,
  j.service_pattern,
  j.recurrence_basis,
  j.recurrence_custom_days,
  j.custom_schedule_notes,
  j.crew_lead_profile_id,
  j.equipment_planning_status,
  j.reservation_window_start,
  j.reservation_window_end,
  j.reservation_notes,
  j.estimated_visit_minutes,
  j.equipment_readiness_required,
  crew.crew_kind,
  crew.service_area_id,
  crew.default_equipment_notes,
  leadp.full_name as crew_lead_name,
  service_area.name as service_area_name
from public.jobs j
left join public.sites s on s.id = j.site_id
left join public.profiles sup on sup.id = j.site_supervisor_profile_id
left join public.profiles signsup on signsup.id = j.signing_supervisor_profile_id
left join public.profiles adm on adm.id = j.admin_profile_id
left join public.crews crew on crew.id = j.crew_id
left join public.profiles assignedsup on assignedsup.id = j.assigned_supervisor_profile_id
left join public.profiles leadp on leadp.id = j.crew_lead_profile_id
left join public.service_areas service_area on service_area.id = crew.service_area_id
left join (
  select crew_id, count(*)::int as member_count
  from public.crew_members
  group by crew_id
) crew_rollup on crew_rollup.crew_id = j.crew_id
left join (
  select jc.job_id, count(*)::int as comment_count, coalesce(sum(v.photo_count), 0)::int as photo_count
  from public.job_comments jc
  left join public.v_job_comment_activity v on v.id = jc.id
  group by jc.job_id
) comment_rollup on comment_rollup.job_id = j.id;
