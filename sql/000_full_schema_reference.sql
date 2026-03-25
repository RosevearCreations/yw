-- =========================================================
-- YWI HSE Full Schema Reference
-- Purpose:
-- - Up-to-date schema reference for the current app direction
-- - Includes user hierarchy, validation workflow, jobs, equipment, reservations, signouts,
--   notifications, reference data, and helper views expected by the frontend/backend
-- =========================================================

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  full_name text,
  role text not null default 'worker',
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

create table if not exists public.site_assignments (
  id bigserial primary key,
  site_id uuid not null references public.sites(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  assignment_role text not null default 'worker',
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
  id bigserial primary key,
  position_name text not null unique,
  is_active boolean not null default true
);

create table if not exists public.trade_catalog (
  id bigserial primary key,
  trade_name text not null unique,
  is_active boolean not null default true
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
  return_worker_signature_name text,
  return_supervisor_signature_name text,
  return_admin_signature_name text,
  checkout_condition text,
  return_condition text,
  signout_notes text,
  return_notes text
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
  j.*,
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

create or replace view public.v_equipment_directory as
select
  e.*,
  s.site_code as home_site_code,
  s.site_name as home_site_name,
  j.job_code as current_job_code,
  j.job_name as current_job_name,
  sup.full_name as assigned_supervisor_name
from public.equipment_items e
left join public.sites s on s.id = e.home_site_id
left join public.jobs j on j.id = e.current_job_id
left join public.profiles sup on sup.id = e.assigned_supervisor_profile_id;

create or replace view public.v_equipment_pool_availability as
select
  e.equipment_pool_key,
  min(e.category) as category,
  count(*)::int as total_qty,
  count(*) filter (where e.status = 'available')::int as available_qty,
  count(*) filter (where e.status = 'reserved')::int as reserved_qty,
  count(*) filter (where e.status = 'checked_out')::int as checked_out_qty,
  array_agg(e.equipment_code order by e.equipment_code) as equipment_codes
from public.equipment_items e
where e.equipment_pool_key is not null
group by e.equipment_pool_key;


create or replace view public.v_equipment_signout_history as
select
  s.*,
  e.equipment_code,
  e.equipment_name,
  j.job_code,
  j.job_name
from public.equipment_signouts s
left join public.equipment_items e on e.id = s.equipment_item_id
left join public.jobs j on j.id = s.job_id;

create or replace view public.v_admin_notifications as
select
  n.id,
  n.notification_type,
  coalesce(n.title, 'Notification') as title,
  coalesce(n.body, n.message, '') as message,
  n.recipient_role,
  n.target_profile_id,
  n.target_table,
  n.target_id,
  n.payload,
  n.status,
  n.decision_status,
  n.decision_notes,
  n.created_at,
  n.read_at,
  n.decided_at,
  n.sent_at,
  n.email_to,
  n.email_subject,
  n.email_status,
  n.email_error,
  n.created_by_profile_id
from public.admin_notifications n;
