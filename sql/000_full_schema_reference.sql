-- Last synchronized: April 15, 2026. Reviewed during the landscaping pricing, profitability, and scheduling logic pass.
-- Current reference remains aligned through 076_job_pricing_profitability_and_schedule_logic.sql.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  full_name text,
  username text,
  recovery_email text,
  pending_email text,
  pending_username text,
  password_login_ready boolean not null default false,
  account_setup_completed_at timestamptz,
  onboarding_completed_at timestamptz,
  role text not null default 'employee',
  is_active boolean not null default true,
  phone text,
  phone_verified boolean not null default false,
  email_verified boolean not null default false,
  address_line1 text,
  address_line2 text,
  city text,
  province text,
  postal_code text,
  emergency_contact_name text,
  emergency_contact_phone text,
  vehicle_make_model text,
  vehicle_plate text,
  years_employed integer,
  seniority_level text,
  employment_status text not null default 'active',
  staff_tier text,
  start_date date,
  employee_number text,
  current_position text,
  previous_employee boolean not null default false,
  trade_specialty text,
  strengths text,
  certifications text,
  feature_preferences jsonb,
  default_supervisor_profile_id uuid references public.profiles(id) on delete set null,
  override_supervisor_profile_id uuid references public.profiles(id) on delete set null,
  default_admin_profile_id uuid references public.profiles(id) on delete set null,
  override_admin_profile_id uuid references public.profiles(id) on delete set null,
  notes text,
  password_changed_at timestamptz,
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sites (
  id uuid primary key default gen_random_uuid(),
  site_code text not null unique,
  site_name text not null,
  address text,
  region text,
  client_name text,
  project_code text,
  project_status text,
  site_supervisor_profile_id uuid references public.profiles(id) on delete set null,
  signing_supervisor_profile_id uuid references public.profiles(id) on delete set null,
  admin_profile_id uuid references public.profiles(id) on delete set null,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.account_recovery_requests (
  id bigserial primary key,
  lookup_kind text not null default 'lookup',
  employee_number text,
  phone_last4 text,
  last_name text,
  matched_profile_id uuid references public.profiles(id) on delete set null,
  masked_email text,
  masked_username text,
  request_status text not null default 'pending',
  notes text,
  created_at timestamptz not null default now()
);


create table if not exists public.account_identity_change_requests (
  id bigserial primary key,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  current_email text,
  current_username text,
  requested_email text,
  requested_username text,
  request_status text not null default 'pending',
  notes text,
  reviewed_by_profile_id uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.site_assignments (
  id bigserial primary key,
  site_id uuid not null references public.sites(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  assignment_role text not null default 'employee',
  is_primary boolean not null default false,
  reports_to_supervisor_profile_id uuid references public.profiles(id) on delete set null,
  reports_to_admin_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  unique(site_id, profile_id)
);

create table if not exists public.submissions (
  id bigserial primary key,
  site text,
  site_id uuid references public.sites(id) on delete set null,
  form_type text not null,
  date date not null,
  submitted_by text,
  submitted_by_profile_id uuid references public.profiles(id) on delete set null,
  supervisor_profile_id uuid references public.profiles(id) on delete set null,
  signing_supervisor_profile_id uuid references public.profiles(id) on delete set null,
  admin_profile_id uuid references public.profiles(id) on delete set null,
  status text not null default 'submitted',
  admin_notes text,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.toolbox_attendees (
  id bigserial primary key,
  submission_id bigint not null references public.submissions(id) on delete cascade,
  name text not null,
  role_on_site text,
  company text,
  signature_png_base64 text,
  created_at timestamptz not null default now()
);

create table if not exists public.submission_reviews (
  id bigserial primary key,
  submission_id bigint not null references public.submissions(id) on delete cascade,
  reviewer_id uuid references public.profiles(id) on delete set null,
  review_action text not null,
  review_note text,
  created_at timestamptz not null default now()
);

create table if not exists public.submission_images (
  id bigserial primary key,
  submission_id bigint not null references public.submissions(id) on delete cascade,
  image_type text not null default 'status',
  file_name text not null,
  file_path text not null,
  file_size_bytes bigint,
  content_type text,
  caption text,
  uploaded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.position_catalog (
  id bigint generated always as identity primary key,
  name text not null unique,
  sort_order integer not null default 100,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.trade_catalog (
  id bigint generated always as identity primary key,
  name text not null unique,
  sort_order integer not null default 100,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.staff_tier_catalog (
  id bigint generated always as identity primary key,
  name text not null unique,
  sort_order integer not null default 100,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.seniority_level_catalog (
  id bigint generated always as identity primary key,
  name text not null unique,
  sort_order integer not null default 100,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.employment_status_catalog (
  id bigint generated always as identity primary key,
  name text not null unique,
  sort_order integer not null default 100,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.job_type_catalog (
  id bigint generated always as identity primary key,
  name text not null unique,
  sort_order integer not null default 100,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.jobs (
  id bigserial primary key,
  job_code text not null unique,
  job_name text not null,
  site_id uuid references public.sites(id),
  job_type text,
  status text not null default 'planned',
  priority text not null default 'normal',
  client_name text,
  start_date date,
  end_date date,
  site_supervisor_profile_id uuid references public.profiles(id),
  signing_supervisor_profile_id uuid references public.profiles(id),
  admin_profile_id uuid references public.profiles(id),
  notes text,
  created_by_profile_id uuid references public.profiles(id),
  approval_status text not null default 'not_requested',
  approval_requested_at timestamptz,
  approved_at timestamptz,
  approved_by_profile_id uuid references public.profiles(id),
  approval_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.equipment_items (
  id bigserial primary key,
  equipment_code text not null unique,
  equipment_name text not null,
  category text,
  home_site_id uuid references public.sites(id),
  status text not null default 'available',
  current_job_id bigint references public.jobs(id) on delete set null,
  assigned_supervisor_profile_id uuid references public.profiles(id) on delete set null,
  equipment_pool_key text,
  serial_number text,
  asset_tag text,
  manufacturer text,
  model_number text,
  purchase_year integer,
  purchase_date date,
  purchase_price numeric(12,2),
  condition_status text,
  image_url text,
  service_interval_days integer,
  last_service_date date,
  next_service_due_date date,
  last_inspection_at date,
  next_inspection_due_date date,
  defect_status text default 'clear',
  defect_notes text,
  is_locked_out boolean not null default false,
  locked_out_at timestamptz,
  locked_out_by_profile_id uuid references public.profiles(id),
  comments text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.job_equipment_requirements (
  id bigserial primary key,
  job_id bigint not null references public.jobs(id) on delete cascade,
  equipment_item_id bigint references public.equipment_items(id) on delete set null,
  equipment_code text,
  equipment_name text not null,
  equipment_pool_key text,
  needed_qty integer not null default 1,
  reserved_qty integer not null default 0,
  reservation_status text not null default 'needed',
  approval_status text not null default 'not_required',
  approval_notes text,
  approved_at timestamptz,
  approved_by_profile_id uuid references public.profiles(id),
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.equipment_signouts (
  id bigserial primary key,
  equipment_item_id bigint not null references public.equipment_items(id) on delete cascade,
  job_id bigint references public.jobs(id) on delete set null,
  checked_out_by_profile_id uuid references public.profiles(id),
  checked_out_to_supervisor_profile_id uuid references public.profiles(id),
  checked_out_at timestamptz not null default now(),
  returned_at timestamptz,
  checkout_worker_signature_name text,
  checkout_supervisor_signature_name text,
  checkout_admin_signature_name text,
  checkout_worker_signature_png text,
  checkout_supervisor_signature_png text,
  checkout_admin_signature_png text,
  return_worker_signature_name text,
  return_supervisor_signature_name text,
  return_admin_signature_name text,
  return_worker_signature_png text,
  return_supervisor_signature_png text,
  return_admin_signature_png text,
  checkout_condition text,
  return_condition text,
  signout_notes text,
  return_notes text,
  checkout_photos_json jsonb not null default '[]'::jsonb,
  return_photos_json jsonb not null default '[]'::jsonb,
  damage_reported boolean not null default false,
  damage_notes text
);



create table if not exists public.equipment_evidence_assets (
  id bigserial primary key,
  signout_id bigint not null references public.equipment_signouts(id) on delete cascade,
  equipment_item_id bigint references public.equipment_items(id) on delete cascade,
  job_id bigint references public.jobs(id) on delete set null,
  stage text not null default 'checkout',
  evidence_kind text not null default 'photo',
  signer_role text,
  storage_bucket text not null default 'equipment-evidence',
  storage_path text not null,
  preview_url text,
  file_name text,
  content_type text,
  file_size_bytes bigint,
  caption text,
  uploaded_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);


create table if not exists public.equipment_inspection_history (
  id bigserial primary key,
  equipment_item_id bigint not null references public.equipment_items(id) on delete cascade,
  inspected_by_profile_id uuid references public.profiles(id) on delete set null,
  inspected_at timestamptz not null default now(),
  inspection_status text not null default 'pass',
  notes text,
  next_due_date date,
  created_at timestamptz not null default now()
);

create table if not exists public.equipment_maintenance_history (
  id bigserial primary key,
  equipment_item_id bigint not null references public.equipment_items(id) on delete cascade,
  performed_by_profile_id uuid references public.profiles(id) on delete set null,
  performed_at timestamptz not null default now(),
  maintenance_type text not null default 'service',
  provider_name text,
  cost_amount numeric(12,2),
  notes text,
  next_due_date date,
  created_at timestamptz not null default now()
);

create table if not exists public.admin_notifications (
  id bigserial primary key,
  notification_type text not null,
  recipient_role text not null default 'admin',
  target_profile_id uuid references public.profiles(id),
  target_table text,
  target_id text,
  title text,
  body text,
  message text,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'queued',
  decision_status text not null default 'pending',
  decision_notes text,
  decided_by_profile_id uuid references public.profiles(id),
  decided_at timestamptz,
  email_to text,
  email_subject text,
  email_status text not null default 'pending',
  email_provider text,
  email_attempt_count integer not null default 0,
  email_last_attempt_at timestamptz,
  email_error text,
  sms_provider text,
  sms_attempt_count integer not null default 0,
  sms_last_attempt_at timestamptz,
  dead_lettered_at timestamptz,
  dead_letter_reason text,
  created_by_profile_id uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  read_at timestamptz,
  sent_at timestamptz
);

create or replace view public.v_people_directory as
select
  p.*,
  sup.full_name as default_supervisor_name,
  supo.full_name as override_supervisor_name,
  adm.full_name as default_admin_name,
  admo.full_name as override_admin_name
from public.profiles p
left join public.profiles sup on sup.id = p.default_supervisor_profile_id
left join public.profiles supo on supo.id = p.override_supervisor_profile_id
left join public.profiles adm on adm.id = p.default_admin_profile_id
left join public.profiles admo on admo.id = p.override_admin_profile_id;

create or replace view public.v_assignments_directory as
select
  sa.*,
  s.site_code,
  s.site_name,
  p.email,
  p.full_name,
  p.role as profile_role
from public.site_assignments sa
join public.sites s on s.id = sa.site_id
join public.profiles p on p.id = sa.profile_id;

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
  service_area.name as service_area_name,
  j.estimated_cost_total,
  j.quoted_charge_total,
  j.pricing_method,
  j.markup_percent,
  j.discount_mode,
  j.discount_value,
  j.tiered_discount_notes,
  j.estimated_profit_total,
  j.estimated_margin_percent,
  j.estimated_duration_hours,
  j.estimated_duration_days,
  j.open_end_date,
  j.delayed_schedule,
  j.delay_reason,
  j.delay_cost_total,
  j.equipment_repair_cost_total,
  j.actual_cost_total,
  j.actual_charge_total,
  j.actual_profit_total,
  j.actual_margin_percent
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



-- 076_job_pricing_profitability_and_schedule_logic.sql
-- Adds job pricing, discount, profitability, open-end scheduling, delay, and repair-loss fields.

alter table if exists public.jobs
  add column if not exists estimated_cost_total numeric(12,2) not null default 0,
  add column if not exists quoted_charge_total numeric(12,2) not null default 0,
  add column if not exists pricing_method text not null default 'manual',
  add column if not exists markup_percent numeric(7,2),
  add column if not exists discount_mode text not null default 'none',
  add column if not exists discount_value numeric(12,2) not null default 0,
  add column if not exists tiered_discount_notes text,
  add column if not exists estimated_profit_total numeric(12,2) not null default 0,
  add column if not exists estimated_margin_percent numeric(7,2) not null default 0,
  add column if not exists estimated_duration_hours numeric(10,2),
  add column if not exists estimated_duration_days integer,
  add column if not exists open_end_date boolean not null default false,
  add column if not exists delayed_schedule boolean not null default false,
  add column if not exists delay_reason text,
  add column if not exists delay_cost_total numeric(12,2) not null default 0,
  add column if not exists equipment_repair_cost_total numeric(12,2) not null default 0,
  add column if not exists actual_cost_total numeric(12,2) not null default 0,
  add column if not exists actual_charge_total numeric(12,2) not null default 0,
  add column if not exists actual_profit_total numeric(12,2) not null default 0,
  add column if not exists actual_margin_percent numeric(7,2) not null default 0;

alter table if exists public.jobs drop constraint if exists jobs_pricing_method_check;
alter table if exists public.jobs
  add constraint jobs_pricing_method_check
  check (pricing_method in ('manual','markup_percent','discount_from_charge','tiered_discount'));

alter table if exists public.jobs drop constraint if exists jobs_discount_mode_check;
alter table if exists public.jobs
  add constraint jobs_discount_mode_check
  check (discount_mode in ('none','percent','fixed','tiered'));

create index if not exists idx_jobs_open_end_date on public.jobs(open_end_date);
create index if not exists idx_jobs_delayed_schedule on public.jobs(delayed_schedule);
create index if not exists idx_jobs_pricing_method on public.jobs(pricing_method);

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
  service_area.name as service_area_name,
  j.estimated_cost_total,
  j.quoted_charge_total,
  j.pricing_method,
  j.markup_percent,
  j.discount_mode,
  j.discount_value,
  j.tiered_discount_notes,
  j.estimated_profit_total,
  j.estimated_margin_percent,
  j.estimated_duration_hours,
  j.estimated_duration_days,
  j.open_end_date,
  j.delayed_schedule,
  j.delay_reason,
  j.delay_cost_total,
  j.equipment_repair_cost_total,
  j.actual_cost_total,
  j.actual_charge_total,
  j.actual_profit_total,
  j.actual_margin_percent
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
