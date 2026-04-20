-- Last synchronized: April 19, 2026. Reviewed during the supervisor attendance review and execution-candidates pass.
-- Current reference remains aligned through 084_supervisor_attendance_review_and_execution_candidates.sql.

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


-- 077_service_pricing_templates_and_ontario_tax_codes.sql
-- Adds DB-backed Ontario tax codes, business tax settings, and reusable service pricing templates.

create table if not exists public.tax_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  tax_type text not null default 'hst',
  province_code text default 'ON',
  country_code text default 'CA',
  rate_percent numeric(7,3) not null default 0,
  applies_to text not null default 'sale',
  is_default boolean not null default false,
  is_active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists public.tax_codes drop constraint if exists tax_codes_tax_type_check;
alter table if exists public.tax_codes add constraint tax_codes_tax_type_check
check (tax_type in ('hst','gst','pst','zero_rated','exempt','custom'));

alter table if exists public.tax_codes drop constraint if exists tax_codes_applies_to_check;
alter table if exists public.tax_codes add constraint tax_codes_applies_to_check
check (applies_to in ('sale','purchase','both'));

create index if not exists idx_tax_codes_active on public.tax_codes(is_active, applies_to, province_code);

insert into public.tax_codes (code, name, tax_type, province_code, country_code, rate_percent, applies_to, is_default, notes)
values
  ('ON_HST_13', 'Ontario HST 13%', 'hst', 'ON', 'CA', 13, 'sale', true, 'Default Ontario HST for taxable services and jobs.'),
  ('ON_PURCHASE_HST_13', 'Ontario HST 13% (Purchase)', 'hst', 'ON', 'CA', 13, 'purchase', true, 'Default Ontario purchase-side HST for taxable vendor bills.'),
  ('ZERO_RATED', 'Zero-rated', 'zero_rated', 'ON', 'CA', 0, 'both', false, 'Taxable at 0%.'),
  ('EXEMPT', 'Exempt', 'exempt', 'ON', 'CA', 0, 'both', false, 'Exempt supply or transaction.')
on conflict (code) do update set
  name = excluded.name,
  tax_type = excluded.tax_type,
  province_code = excluded.province_code,
  country_code = excluded.country_code,
  rate_percent = excluded.rate_percent,
  applies_to = excluded.applies_to,
  is_default = excluded.is_default,
  notes = excluded.notes,
  is_active = true,
  updated_at = now();

create table if not exists public.business_tax_settings (
  id uuid primary key default gen_random_uuid(),
  profile_name text not null unique,
  province_code text not null default 'ON',
  country_code text not null default 'CA',
  currency_code text not null default 'CAD',
  default_sales_tax_code_id uuid references public.tax_codes(id) on delete set null,
  default_purchase_tax_code_id uuid references public.tax_codes(id) on delete set null,
  hst_registration_number text,
  fiscal_year_end_mmdd text,
  small_supplier_flag boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.business_tax_settings (
  profile_name, province_code, country_code, currency_code, default_sales_tax_code_id, default_purchase_tax_code_id, fiscal_year_end_mmdd, small_supplier_flag, notes
)
select
  'Ontario Default',
  'ON',
  'CA',
  'CAD',
  (select id from public.tax_codes where code = 'ON_HST_13' limit 1),
  (select id from public.tax_codes where code = 'ON_PURCHASE_HST_13' limit 1),
  '12-31',
  false,
  'Default Ontario business tax guardrails for landscaping, recurring service, construction, and maintenance work.'
where not exists (select 1 from public.business_tax_settings where profile_name = 'Ontario Default');

create table if not exists public.service_pricing_templates (
  id uuid primary key default gen_random_uuid(),
  template_code text not null unique,
  template_name text not null,
  job_family text,
  project_scope text,
  service_pattern text,
  default_schedule_mode text not null default 'standalone',
  default_estimated_visit_minutes integer,
  default_estimated_duration_hours numeric(10,2),
  default_estimated_duration_days integer,
  default_estimated_cost_total numeric(12,2) not null default 0,
  default_quoted_charge_total numeric(12,2) not null default 0,
  default_pricing_method text not null default 'manual',
  default_markup_percent numeric(7,2),
  default_discount_mode text not null default 'none',
  default_discount_value numeric(12,2) not null default 0,
  sales_tax_code_id uuid references public.tax_codes(id) on delete set null,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists public.service_pricing_templates drop constraint if exists service_pricing_templates_schedule_mode_check;
alter table if exists public.service_pricing_templates add constraint service_pricing_templates_schedule_mode_check
check (default_schedule_mode in ('standalone','recurring','project_phase'));

alter table if exists public.service_pricing_templates drop constraint if exists service_pricing_templates_pricing_method_check;
alter table if exists public.service_pricing_templates add constraint service_pricing_templates_pricing_method_check
check (default_pricing_method in ('manual','markup_percent','discount_from_charge','tiered_discount'));

alter table if exists public.service_pricing_templates drop constraint if exists service_pricing_templates_discount_mode_check;
alter table if exists public.service_pricing_templates add constraint service_pricing_templates_discount_mode_check
check (default_discount_mode in ('none','percent','fixed','tiered'));

create index if not exists idx_service_pricing_templates_active on public.service_pricing_templates(is_active, job_family, service_pattern);

insert into public.service_pricing_templates (
  template_code, template_name, job_family, project_scope, service_pattern, default_schedule_mode,
  default_estimated_visit_minutes, default_estimated_duration_hours, default_estimated_duration_days,
  default_estimated_cost_total, default_quoted_charge_total, default_pricing_method, default_markup_percent,
  default_discount_mode, default_discount_value, sales_tax_code_id, notes
)
values
  ('MOW_WEEKLY', 'Weekly Lawn Mowing', 'landscaping_recurring', 'maintenance', 'weekly', 'recurring', 90, 1.50, 0, 55.00, 85.00, 'manual', null, 'none', 0, (select id from public.tax_codes where code = 'ON_HST_13' limit 1), 'Recurring lawn mowing baseline template.'),
  ('SNOW_PLOW', 'Snow Plowing Visit', 'snow', 'snow', 'seasonal', 'recurring', 120, 2.00, 0, 95.00, 145.00, 'manual', null, 'none', 0, (select id from public.tax_codes where code = 'ON_HST_13' limit 1), 'Per-visit snow plowing baseline template.'),
  ('SOD_INSTALL', 'Sod Installation', 'landscaping_standard', 'property_service', 'one_time', 'standalone', null, 12.00, 2, 850.00, 1250.00, 'manual', null, 'none', 0, (select id from public.tax_codes where code = 'ON_HST_13' limit 1), 'One-time sod installation baseline template.'),
  ('PARK_MAINT', 'Park Maintenance Visit', 'park_maintenance', 'park', 'weekly', 'recurring', 180, 3.00, 0, 180.00, 265.00, 'manual', null, 'none', 0, (select id from public.tax_codes where code = 'ON_HST_13' limit 1), 'Recurring park maintenance baseline template.')
on conflict (template_code) do update set
  template_name = excluded.template_name,
  job_family = excluded.job_family,
  project_scope = excluded.project_scope,
  service_pattern = excluded.service_pattern,
  default_schedule_mode = excluded.default_schedule_mode,
  default_estimated_visit_minutes = excluded.default_estimated_visit_minutes,
  default_estimated_duration_hours = excluded.default_estimated_duration_hours,
  default_estimated_duration_days = excluded.default_estimated_duration_days,
  default_estimated_cost_total = excluded.default_estimated_cost_total,
  default_quoted_charge_total = excluded.default_quoted_charge_total,
  default_pricing_method = excluded.default_pricing_method,
  default_markup_percent = excluded.default_markup_percent,
  default_discount_mode = excluded.default_discount_mode,
  default_discount_value = excluded.default_discount_value,
  sales_tax_code_id = excluded.sales_tax_code_id,
  notes = excluded.notes,
  is_active = true,
  updated_at = now();

alter table if exists public.jobs
  add column if not exists service_pricing_template_id uuid references public.service_pricing_templates(id) on delete set null,
  add column if not exists sales_tax_code_id uuid references public.tax_codes(id) on delete set null,
  add column if not exists estimated_tax_rate_percent numeric(7,3) not null default 0,
  add column if not exists estimated_tax_total numeric(12,2) not null default 0,
  add column if not exists estimated_total_with_tax numeric(12,2) not null default 0,
  add column if not exists pricing_basis_label text;

create index if not exists idx_jobs_service_pricing_template_id on public.jobs(service_pricing_template_id);
create index if not exists idx_jobs_sales_tax_code_id on public.jobs(sales_tax_code_id);

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
  j.actual_margin_percent,
  j.service_pricing_template_id,
  spt.template_code as service_pricing_template_code,
  spt.template_name as service_pricing_template_name,
  j.sales_tax_code_id,
  tc.code as sales_tax_code,
  tc.name as sales_tax_name,
  tc.tax_type as sales_tax_type,
  j.estimated_tax_rate_percent,
  j.estimated_tax_total,
  j.estimated_total_with_tax,
  j.pricing_basis_label
from public.jobs j
left join public.sites s on s.id = j.site_id
left join public.profiles sup on sup.id = j.site_supervisor_profile_id
left join public.profiles signsup on signsup.id = j.signing_supervisor_profile_id
left join public.profiles adm on adm.id = j.admin_profile_id
left join public.crews crew on crew.id = j.crew_id
left join public.profiles assignedsup on assignedsup.id = j.assigned_supervisor_profile_id
left join public.profiles leadp on leadp.id = j.crew_lead_profile_id
left join public.service_areas service_area on service_area.id = crew.service_area_id
left join public.service_pricing_templates spt on spt.id = j.service_pricing_template_id
left join public.tax_codes tc on tc.id = j.sales_tax_code_id
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
create extension if not exists pgcrypto;

alter table if exists public.jobs
  add column if not exists client_reference text,
  add column if not exists service_contract_reference text,
  add column if not exists billing_transaction_number text,
  add column if not exists invoice_number text;

create table if not exists public.job_sessions (
  id uuid primary key default gen_random_uuid(),
  job_id bigint not null references public.jobs(id) on delete cascade,
  session_date date not null default current_date,
  session_kind text not null default 'field_service',
  session_status text not null default 'completed',
  service_frequency_label text,
  scheduled_start_at timestamptz,
  started_at timestamptz,
  ended_at timestamptz,
  duration_minutes integer,
  delay_minutes integer not null default 0,
  notes text,
  site_supervisor_profile_id uuid references public.profiles(id) on delete set null,
  site_supervisor_signoff_name text,
  site_supervisor_signed_off_at timestamptz,
  site_supervisor_signoff_notes text,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists public.job_sessions drop constraint if exists job_sessions_status_check;
alter table if exists public.job_sessions
  add constraint job_sessions_status_check check (session_status in ('planned','in_progress','completed','delayed','paused','cancelled'));

create index if not exists idx_job_sessions_job_id on public.job_sessions(job_id, session_date desc, started_at desc);
create index if not exists idx_job_sessions_supervisor on public.job_sessions(site_supervisor_profile_id, session_date desc);

create table if not exists public.job_session_crew_hours (
  id uuid primary key default gen_random_uuid(),
  job_session_id uuid references public.job_sessions(id) on delete set null,
  job_id bigint not null references public.jobs(id) on delete cascade,
  crew_id uuid references public.crews(id) on delete set null,
  profile_id uuid references public.profiles(id) on delete set null,
  worker_name text,
  started_at timestamptz,
  ended_at timestamptz,
  hours_worked numeric(10,2) not null default 0,
  regular_hours numeric(10,2) not null default 0,
  overtime_hours numeric(10,2) not null default 0,
  notes text,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_job_session_crew_hours_job_id on public.job_session_crew_hours(job_id, created_at desc);
create index if not exists idx_job_session_crew_hours_session_id on public.job_session_crew_hours(job_session_id, created_at desc);
create index if not exists idx_job_session_crew_hours_profile_id on public.job_session_crew_hours(profile_id, created_at desc);

create table if not exists public.job_reassignment_events (
  id uuid primary key default gen_random_uuid(),
  source_job_id bigint references public.jobs(id) on delete set null,
  target_job_id bigint references public.jobs(id) on delete cascade,
  crew_id uuid references public.crews(id) on delete set null,
  profile_id uuid references public.profiles(id) on delete set null,
  equipment_item_id bigint references public.equipment_items(id) on delete set null,
  reassignment_type text not null default 'temporary_split',
  reason text,
  emergency_override boolean not null default false,
  service_contract_reference text,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  notes text,
  reassigned_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists public.job_reassignment_events drop constraint if exists job_reassignment_events_type_check;
alter table if exists public.job_reassignment_events
  add constraint job_reassignment_events_type_check check (reassignment_type in ('temporary_split','emergency_override','service_contract_support','equipment_redirect'));

create index if not exists idx_job_reassignment_events_source on public.job_reassignment_events(source_job_id, started_at desc);
create index if not exists idx_job_reassignment_events_target on public.job_reassignment_events(target_job_id, started_at desc);
create index if not exists idx_job_reassignment_events_profile on public.job_reassignment_events(profile_id, started_at desc);
create index if not exists idx_job_reassignment_events_equipment on public.job_reassignment_events(equipment_item_id, started_at desc);

create or replace view public.v_job_session_directory as
select
  js.id,
  js.job_id,
  j.job_code,
  j.job_name,
  js.session_date,
  js.session_kind,
  js.session_status,
  js.service_frequency_label,
  js.scheduled_start_at,
  js.started_at,
  js.ended_at,
  coalesce(
    js.duration_minutes,
    case when js.started_at is not null and js.ended_at is not null then greatest(0, floor(extract(epoch from (js.ended_at - js.started_at)) / 60))::int else 0 end
  ) as duration_minutes,
  concat(
    floor(coalesce(js.duration_minutes, case when js.started_at is not null and js.ended_at is not null then greatest(0, floor(extract(epoch from (js.ended_at - js.started_at)) / 60))::int else 0 end) / 60),
    'h ',
    (coalesce(js.duration_minutes, case when js.started_at is not null and js.ended_at is not null then greatest(0, floor(extract(epoch from (js.ended_at - js.started_at)) / 60))::int else 0 end) % 60),
    'm'
  ) as duration_label,
  js.delay_minutes,
  js.notes,
  js.site_supervisor_profile_id,
  sup.full_name as site_supervisor_name,
  js.site_supervisor_signoff_name,
  js.site_supervisor_signed_off_at,
  js.site_supervisor_signoff_notes,
  js.created_by_profile_id,
  creator.full_name as created_by_name,
  to_char(js.started_at at time zone 'America/Toronto', 'YYYY-MM-DD HH24:MI') as started_at_local,
  to_char(js.ended_at at time zone 'America/Toronto', 'YYYY-MM-DD HH24:MI') as ended_at_local,
  js.created_at,
  js.updated_at
from public.job_sessions js
left join public.jobs j on j.id = js.job_id
left join public.profiles sup on sup.id = js.site_supervisor_profile_id
left join public.profiles creator on creator.id = js.created_by_profile_id;

create or replace view public.v_job_crew_hours_directory as
select
  jh.id,
  jh.job_session_id,
  jh.job_id,
  j.job_code,
  j.job_name,
  jh.crew_id,
  c.crew_name,
  c.crew_code,
  jh.profile_id,
  p.full_name as profile_name,
  coalesce(jh.worker_name, p.full_name, p.email) as worker_name,
  jh.started_at,
  jh.ended_at,
  to_char(jh.started_at at time zone 'America/Toronto', 'YYYY-MM-DD HH24:MI') as started_at_local,
  to_char(jh.ended_at at time zone 'America/Toronto', 'YYYY-MM-DD HH24:MI') as ended_at_local,
  jh.hours_worked,
  jh.regular_hours,
  jh.overtime_hours,
  jh.notes,
  js.session_date,
  jh.created_at,
  jh.updated_at
from public.job_session_crew_hours jh
left join public.jobs j on j.id = jh.job_id
left join public.job_sessions js on js.id = jh.job_session_id
left join public.crews c on c.id = jh.crew_id
left join public.profiles p on p.id = jh.profile_id;

create or replace view public.v_job_reassignment_directory as
select
  re.id,
  re.source_job_id,
  src.job_code as source_job_code,
  src.job_name as source_job_name,
  re.target_job_id,
  tgt.job_code as target_job_code,
  tgt.job_name as target_job_name,
  re.crew_id,
  c.crew_name,
  c.crew_code,
  re.profile_id,
  p.full_name as profile_name,
  re.equipment_item_id,
  eq.equipment_code,
  eq.equipment_name,
  re.reassignment_type,
  re.reason,
  re.emergency_override,
  re.service_contract_reference,
  re.started_at,
  re.ended_at,
  to_char(re.started_at at time zone 'America/Toronto', 'YYYY-MM-DD HH24:MI') as started_at_local,
  to_char(re.ended_at at time zone 'America/Toronto', 'YYYY-MM-DD HH24:MI') as ended_at_local,
  re.notes,
  re.reassigned_by_profile_id,
  actor.full_name as reassigned_by_name,
  re.created_at,
  re.updated_at
from public.job_reassignment_events re
left join public.jobs src on src.id = re.source_job_id
left join public.jobs tgt on tgt.id = re.target_job_id
left join public.crews c on c.id = re.crew_id
left join public.profiles p on p.id = re.profile_id
left join public.equipment_items eq on eq.id = re.equipment_item_id
left join public.profiles actor on actor.id = re.reassigned_by_profile_id;

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
  j.actual_margin_percent,
  j.service_pricing_template_id,
  spt.template_code as service_pricing_template_code,
  spt.template_name as service_pricing_template_name,
  j.sales_tax_code_id,
  tc.code as sales_tax_code,
  tc.name as sales_tax_name,
  tc.tax_type as sales_tax_type,
  j.estimated_tax_rate_percent,
  j.estimated_tax_total,
  j.estimated_total_with_tax,
  j.pricing_basis_label,
  j.client_reference,
  j.service_contract_reference,
  j.billing_transaction_number,
  j.invoice_number,
  coalesce(session_rollup.session_count, 0)::int as session_count,
  coalesce(session_rollup.total_logged_minutes, 0)::int as total_logged_minutes,
  round(coalesce(session_rollup.total_logged_minutes, 0) / 60.0, 2) as total_logged_hours,
  session_rollup.last_session_started_at,
  session_rollup.last_session_ended_at,
  session_rollup.last_supervisor_signoff_at,
  coalesce(reassignment_rollup.reassignment_count, 0)::int as reassignment_count,
  coalesce(crew_hours_rollup.logged_hours_total, 0)::numeric(10,2) as logged_hours_total
from public.jobs j
left join public.sites s on s.id = j.site_id
left join public.profiles sup on sup.id = j.site_supervisor_profile_id
left join public.profiles signsup on signsup.id = j.signing_supervisor_profile_id
left join public.profiles adm on adm.id = j.admin_profile_id
left join public.crews crew on crew.id = j.crew_id
left join public.profiles assignedsup on assignedsup.id = j.assigned_supervisor_profile_id
left join public.profiles leadp on leadp.id = j.crew_lead_profile_id
left join public.service_areas service_area on service_area.id = crew.service_area_id
left join public.service_pricing_templates spt on spt.id = j.service_pricing_template_id
left join public.tax_codes tc on tc.id = j.sales_tax_code_id
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
) comment_rollup on comment_rollup.job_id = j.id
left join (
  select job_id,
    count(*)::int as session_count,
    sum(coalesce(duration_minutes, 0))::int as total_logged_minutes,
    max(started_at) as last_session_started_at,
    max(ended_at) as last_session_ended_at,
    max(site_supervisor_signed_off_at) as last_supervisor_signoff_at
  from public.v_job_session_directory
  group by job_id
) session_rollup on session_rollup.job_id = j.id
left join (
  select job_id, sum(coalesce(hours_worked, 0))::numeric(10,2) as logged_hours_total
  from public.job_session_crew_hours
  group by job_id
) crew_hours_rollup on crew_hours_rollup.job_id = j.id
left join (
  select source_job_id as job_id, count(*)::int as reassignment_count
  from public.job_reassignment_events
  group by source_job_id
) reassignment_rollup on reassignment_rollup.job_id = j.id;


-- Synced from sql/079_job_financial_rollups_and_profit_review.sql
-- 079_job_financial_rollups_and_profit_review.sql
-- Adds labor-rate-aware job financial tracking, adjustment events, and accounting review rollups
-- for landscaping, recurring service, and custom project work.

create extension if not exists pgcrypto;

alter table if exists public.profiles
  add column if not exists hourly_cost_rate numeric(10,2),
  add column if not exists overtime_cost_rate numeric(10,2),
  add column if not exists hourly_bill_rate numeric(10,2),
  add column if not exists overtime_bill_rate numeric(10,2),
  add column if not exists payroll_burden_percent numeric(7,2);

create table if not exists public.job_financial_events (
  id uuid primary key default gen_random_uuid(),
  job_id bigint not null references public.jobs(id) on delete cascade,
  job_session_id uuid references public.job_sessions(id) on delete set null,
  event_date date not null default current_date,
  event_type text not null default 'other',
  cost_amount numeric(12,2) not null default 0,
  revenue_amount numeric(12,2) not null default 0,
  quantity numeric(12,2),
  unit_cost numeric(12,2),
  unit_price numeric(12,2),
  is_billable boolean not null default false,
  vendor_id uuid references public.ap_vendors(id) on delete set null,
  tax_code_id uuid references public.tax_codes(id) on delete set null,
  gl_account_id uuid references public.chart_of_accounts(id) on delete set null,
  reference_number text,
  notes text,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists public.job_financial_events drop constraint if exists job_financial_events_type_check;
alter table if exists public.job_financial_events
  add constraint job_financial_events_type_check
  check (event_type in (
    'material',
    'equipment_repair',
    'delay',
    'fuel',
    'travel',
    'subcontract',
    'disposal',
    'permit',
    'revenue_adjustment',
    'discount_adjustment',
    'other'
  ));

create index if not exists idx_job_financial_events_job_id on public.job_financial_events(job_id, event_date desc, created_at desc);
create index if not exists idx_job_financial_events_session_id on public.job_financial_events(job_session_id, event_date desc);
create index if not exists idx_job_financial_events_type on public.job_financial_events(event_type, event_date desc);

create or replace view public.v_job_labor_rollups as
select
  jh.job_id,
  count(*)::int as labor_entry_count,
  coalesce(sum(jh.regular_hours), 0)::numeric(10,2) as regular_hours_total,
  coalesce(sum(jh.overtime_hours), 0)::numeric(10,2) as overtime_hours_total,
  coalesce(sum(jh.hours_worked), 0)::numeric(10,2) as hours_worked_total,
  coalesce(sum(
    (coalesce(jh.regular_hours, 0) * coalesce(p.hourly_cost_rate, 0) * (1 + (coalesce(p.payroll_burden_percent, 0) / 100.0)))
    + (coalesce(jh.overtime_hours, 0) * coalesce(p.overtime_cost_rate, p.hourly_cost_rate * 1.5, 0) * (1 + (coalesce(p.payroll_burden_percent, 0) / 100.0)))
  ), 0)::numeric(12,2) as labor_cost_total,
  coalesce(sum(
    (coalesce(jh.regular_hours, 0) * coalesce(p.hourly_bill_rate, 0))
    + (coalesce(jh.overtime_hours, 0) * coalesce(p.overtime_bill_rate, p.hourly_bill_rate * 1.5, 0))
  ), 0)::numeric(12,2) as labor_bill_total,
  max(jh.created_at) as last_labor_entry_at
from public.job_session_crew_hours jh
left join public.profiles p on p.id = jh.profile_id
group by jh.job_id;

create or replace view public.v_job_financial_event_rollups as
select
  jfe.job_id,
  count(*)::int as financial_event_count,
  count(*) filter (where coalesce(jfe.cost_amount, 0) > 0)::int as cost_event_count,
  count(*) filter (where coalesce(jfe.revenue_amount, 0) > 0)::int as revenue_event_count,
  count(*) filter (where jfe.is_billable = true and coalesce(jfe.revenue_amount, 0) > 0)::int as billable_event_count,
  coalesce(sum(coalesce(jfe.cost_amount, 0)), 0)::numeric(12,2) as cost_total,
  coalesce(sum(coalesce(jfe.revenue_amount, 0)), 0)::numeric(12,2) as revenue_total,
  max(jfe.event_date) as last_event_date,
  max(jfe.updated_at) as last_event_updated_at
from public.job_financial_events jfe
group by jfe.job_id;

create or replace view public.v_job_financial_rollups as
with session_rollup as (
  select
    js.job_id,
    count(*)::int as session_count,
    count(*) filter (where coalesce(js.session_status, '') in ('planned','in_progress','delayed','paused'))::int as open_session_count,
    count(*) filter (where js.site_supervisor_signed_off_at is null and coalesce(js.site_supervisor_signoff_name, '') = '')::int as unsigned_session_count,
    max(js.started_at) as last_session_started_at,
    max(js.ended_at) as last_session_ended_at,
    max(js.site_supervisor_signed_off_at) as last_supervisor_signoff_at
  from public.job_sessions js
  group by js.job_id
)
select
  j.id as job_id,
  coalesce(labor.labor_entry_count, 0)::int as labor_entry_count,
  coalesce(labor.regular_hours_total, 0)::numeric(10,2) as regular_hours_total,
  coalesce(labor.overtime_hours_total, 0)::numeric(10,2) as overtime_hours_total,
  coalesce(labor.hours_worked_total, 0)::numeric(10,2) as hours_worked_total,
  coalesce(labor.labor_cost_total, 0)::numeric(12,2) as labor_cost_total,
  coalesce(labor.labor_bill_total, 0)::numeric(12,2) as labor_bill_total,
  coalesce(fin.financial_event_count, 0)::int as financial_event_count,
  coalesce(fin.cost_event_count, 0)::int as cost_event_count,
  coalesce(fin.revenue_event_count, 0)::int as revenue_event_count,
  coalesce(fin.billable_event_count, 0)::int as billable_event_count,
  coalesce(fin.cost_total, 0)::numeric(12,2) as financial_event_cost_total,
  coalesce(fin.revenue_total, 0)::numeric(12,2) as financial_event_revenue_total,
  coalesce(sess.session_count, 0)::int as session_count,
  coalesce(sess.open_session_count, 0)::int as open_session_count,
  coalesce(sess.unsigned_session_count, 0)::int as unsigned_session_count,
  sess.last_session_started_at,
  sess.last_session_ended_at,
  sess.last_supervisor_signoff_at,
  (coalesce(j.actual_cost_total, 0) + coalesce(j.delay_cost_total, 0) + coalesce(j.equipment_repair_cost_total, 0) + coalesce(labor.labor_cost_total, 0) + coalesce(fin.cost_total, 0))::numeric(12,2) as actual_cost_rollup_total,
  (coalesce(j.actual_charge_total, 0) + coalesce(labor.labor_bill_total, 0) + coalesce(fin.revenue_total, 0))::numeric(12,2) as actual_charge_rollup_total,
  ((coalesce(j.actual_charge_total, 0) + coalesce(labor.labor_bill_total, 0) + coalesce(fin.revenue_total, 0))
    - (coalesce(j.actual_cost_total, 0) + coalesce(j.delay_cost_total, 0) + coalesce(j.equipment_repair_cost_total, 0) + coalesce(labor.labor_cost_total, 0) + coalesce(fin.cost_total, 0)))::numeric(12,2) as actual_profit_rollup_total,
  case
    when (coalesce(j.actual_charge_total, 0) + coalesce(labor.labor_bill_total, 0) + coalesce(fin.revenue_total, 0)) > 0
      then round((((coalesce(j.actual_charge_total, 0) + coalesce(labor.labor_bill_total, 0) + coalesce(fin.revenue_total, 0))
        - (coalesce(j.actual_cost_total, 0) + coalesce(j.delay_cost_total, 0) + coalesce(j.equipment_repair_cost_total, 0) + coalesce(labor.labor_cost_total, 0) + coalesce(fin.cost_total, 0)))
        / (coalesce(j.actual_charge_total, 0) + coalesce(labor.labor_bill_total, 0) + coalesce(fin.revenue_total, 0))) * 100.0, 2)::numeric(7,2)
    else 0::numeric(7,2)
  end as actual_margin_rollup_percent,
  ((coalesce(j.actual_charge_total, 0) + coalesce(labor.labor_bill_total, 0) + coalesce(fin.revenue_total, 0)) - coalesce(j.quoted_charge_total, 0))::numeric(12,2) as charge_vs_quote_variance_total,
  ((coalesce(j.actual_cost_total, 0) + coalesce(j.delay_cost_total, 0) + coalesce(j.equipment_repair_cost_total, 0) + coalesce(labor.labor_cost_total, 0) + coalesce(fin.cost_total, 0)) - coalesce(j.estimated_cost_total, 0))::numeric(12,2) as cost_vs_estimate_variance_total
from public.jobs j
left join public.v_job_labor_rollups labor on labor.job_id = j.id
left join public.v_job_financial_event_rollups fin on fin.job_id = j.id
left join session_rollup sess on sess.job_id = j.id;

create or replace view public.v_job_financial_event_directory as
select
  jfe.id,
  jfe.job_id,
  j.job_code,
  j.job_name,
  jfe.job_session_id,
  js.session_date,
  jfe.event_date,
  jfe.event_type,
  jfe.cost_amount,
  jfe.revenue_amount,
  jfe.quantity,
  jfe.unit_cost,
  jfe.unit_price,
  jfe.is_billable,
  jfe.vendor_id,
  v.legal_name as vendor_name,
  jfe.tax_code_id,
  tc.code as tax_code,
  jfe.gl_account_id,
  coa.account_number,
  coa.account_name,
  jfe.reference_number,
  jfe.notes,
  jfe.created_by_profile_id,
  p.full_name as created_by_name,
  jfe.created_at,
  jfe.updated_at
from public.job_financial_events jfe
left join public.jobs j on j.id = jfe.job_id
left join public.job_sessions js on js.id = jfe.job_session_id
left join public.ap_vendors v on v.id = jfe.vendor_id
left join public.tax_codes tc on tc.id = jfe.tax_code_id
left join public.chart_of_accounts coa on coa.id = jfe.gl_account_id
left join public.profiles p on p.id = jfe.created_by_profile_id;

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
  j.actual_margin_percent,
  j.service_pricing_template_id,
  spt.template_code as service_pricing_template_code,
  spt.template_name as service_pricing_template_name,
  j.sales_tax_code_id,
  tc.code as sales_tax_code,
  tc.name as sales_tax_name,
  tc.tax_type as sales_tax_type,
  j.estimated_tax_rate_percent,
  j.estimated_tax_total,
  j.estimated_total_with_tax,
  j.pricing_basis_label,
  j.client_reference,
  j.service_contract_reference,
  j.billing_transaction_number,
  j.invoice_number,
  coalesce(session_rollup.session_count, 0)::int as session_count,
  coalesce(session_rollup.total_logged_minutes, 0)::int as total_logged_minutes,
  round(coalesce(session_rollup.total_logged_minutes, 0) / 60.0, 2) as total_logged_hours,
  session_rollup.last_session_started_at,
  session_rollup.last_session_ended_at,
  session_rollup.last_supervisor_signoff_at,
  coalesce(reassignment_rollup.reassignment_count, 0)::int as reassignment_count,
  coalesce(crew_hours_rollup.logged_hours_total, 0)::numeric(10,2) as logged_hours_total,
  coalesce(fin.labor_entry_count, 0)::int as labor_entry_count,
  coalesce(fin.regular_hours_total, 0)::numeric(10,2) as regular_hours_total,
  coalesce(fin.overtime_hours_total, 0)::numeric(10,2) as overtime_hours_total,
  coalesce(fin.labor_cost_total, 0)::numeric(12,2) as actual_labor_cost_total,
  coalesce(fin.labor_bill_total, 0)::numeric(12,2) as actual_labor_bill_total,
  coalesce(fin.financial_event_count, 0)::int as financial_event_count,
  coalesce(fin.financial_event_cost_total, 0)::numeric(12,2) as financial_event_cost_total,
  coalesce(fin.financial_event_revenue_total, 0)::numeric(12,2) as financial_event_revenue_total,
  coalesce(fin.open_session_count, 0)::int as open_job_session_count,
  coalesce(fin.unsigned_session_count, 0)::int as unsigned_job_session_count,
  coalesce(fin.actual_cost_rollup_total, 0)::numeric(12,2) as actual_cost_rollup_total,
  coalesce(fin.actual_charge_rollup_total, 0)::numeric(12,2) as actual_charge_rollup_total,
  coalesce(fin.actual_profit_rollup_total, 0)::numeric(12,2) as actual_profit_rollup_total,
  coalesce(fin.actual_margin_rollup_percent, 0)::numeric(7,2) as actual_margin_rollup_percent,
  coalesce(fin.charge_vs_quote_variance_total, 0)::numeric(12,2) as charge_vs_quote_variance_total,
  coalesce(fin.cost_vs_estimate_variance_total, 0)::numeric(12,2) as cost_vs_estimate_variance_total
from public.jobs j
left join public.sites s on s.id = j.site_id
left join public.profiles sup on sup.id = j.site_supervisor_profile_id
left join public.profiles signsup on signsup.id = j.signing_supervisor_profile_id
left join public.profiles adm on adm.id = j.admin_profile_id
left join public.crews crew on crew.id = j.crew_id
left join public.profiles assignedsup on assignedsup.id = j.assigned_supervisor_profile_id
left join public.profiles leadp on leadp.id = j.crew_lead_profile_id
left join public.service_areas service_area on service_area.id = crew.service_area_id
left join public.service_pricing_templates spt on spt.id = j.service_pricing_template_id
left join public.tax_codes tc on tc.id = j.sales_tax_code_id
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
) comment_rollup on comment_rollup.job_id = j.id
left join (
  select job_id,
    count(*)::int as session_count,
    sum(coalesce(duration_minutes, 0))::int as total_logged_minutes,
    max(started_at) as last_session_started_at,
    max(ended_at) as last_session_ended_at,
    max(site_supervisor_signed_off_at) as last_supervisor_signoff_at
  from public.v_job_session_directory
  group by job_id
) session_rollup on session_rollup.job_id = j.id
left join (
  select job_id, sum(coalesce(hours_worked, 0))::numeric(10,2) as logged_hours_total
  from public.job_session_crew_hours
  group by job_id
) crew_hours_rollup on crew_hours_rollup.job_id = j.id
left join (
  select source_job_id as job_id, count(*)::int as reassignment_count
  from public.job_reassignment_events
  group by source_job_id
) reassignment_rollup on reassignment_rollup.job_id = j.id
left join public.v_job_financial_rollups fin on fin.job_id = j.id;

create or replace view public.v_accounting_review_summary as
with batch_rollup as (
  select
    count(*)::int as batch_count,
    count(*) filter (where coalesce(batch_status, '') <> 'posted')::int as unposted_batch_count,
    count(*) filter (where coalesce(is_balanced, false) = false)::int as unbalanced_batch_count,
    count(*) filter (where coalesce(source_sync_state, '') in ('stale', 'out_of_sync', 'needs_review'))::int as stale_source_batch_count,
    max(source_synced_at) as last_source_synced_at
  from public.v_gl_journal_batch_rollups
),
exception_rollup as (
  select
    count(*)::int as sync_exception_count,
    count(*) filter (where exception_status = 'open')::int as open_sync_exception_count,
    count(*) filter (where exception_status = 'open' and severity in ('warning','error'))::int as warning_or_error_sync_exception_count,
    max(last_seen_at) as last_sync_exception_at
  from public.v_gl_journal_sync_exceptions
),
ar_rollup as (
  select
    count(*) filter (where record_type = 'ar_invoice' and coalesce(balance_due, 0) > 0)::int as open_ar_record_count,
    coalesce(sum(case when record_type = 'ar_invoice' then balance_due else 0 end), 0)::numeric(12,2) as open_ar_balance
  from public.v_account_balance_rollups
),
ap_rollup as (
  select
    count(*) filter (where record_type = 'ap_bill' and coalesce(balance_due, 0) > 0)::int as open_ap_record_count,
    coalesce(sum(case when record_type = 'ap_bill' then balance_due else 0 end), 0)::numeric(12,2) as open_ap_balance
  from public.v_account_balance_rollups
),
traffic_rollup as (
  select
    max(event_date) as latest_daily_event_date,
    max(total_events) filter (where event_date = (select max(event_date) from public.v_app_traffic_daily_summary)) as latest_daily_total_events
  from public.v_app_traffic_daily_summary
),
job_rollup as (
  select
    count(*) filter (where coalesce(status, '') in ('completed','done','closed') and coalesce(invoice_number, '') = '')::int as completed_uninvoiced_job_count,
    count(*) filter (where coalesce(delayed_schedule, false) = true)::int as delayed_job_count,
    count(*) filter (where coalesce(unsigned_job_session_count, 0) > 0)::int as unsigned_job_session_count,
    count(*) filter (where coalesce(actual_profit_rollup_total, 0) < 0)::int as loss_making_job_count,
    count(*) filter (where coalesce(financial_event_count, 0) > 0)::int as jobs_with_financial_events_count,
    coalesce(sum(coalesce(actual_profit_rollup_total, 0)), 0)::numeric(12,2) as actual_rollup_profit_total
  from public.v_jobs_directory
)
select
  br.batch_count,
  br.unposted_batch_count,
  br.unbalanced_batch_count,
  br.stale_source_batch_count,
  br.last_source_synced_at,
  er.sync_exception_count,
  er.open_sync_exception_count,
  er.warning_or_error_sync_exception_count,
  er.last_sync_exception_at,
  ar.open_ar_record_count,
  ar.open_ar_balance,
  ap.open_ap_record_count,
  ap.open_ap_balance,
  tr.latest_daily_event_date,
  tr.latest_daily_total_events,
  jr.completed_uninvoiced_job_count,
  jr.delayed_job_count,
  jr.unsigned_job_session_count,
  jr.loss_making_job_count,
  jr.jobs_with_financial_events_count,
  jr.actual_rollup_profit_total
from batch_rollup br
cross join exception_rollup er
cross join ar_rollup ar
cross join ap_rollup ap
cross join traffic_rollup tr
cross join job_rollup jr;

-- 080_service_agreements_assets_payroll_and_login_tracking.sql
-- Extends the landscaping/service-management backbone with:
-- - recurring service agreements and snow-trigger logs
-- - change orders for custom and active jobs
-- - customer assets and per-asset service history
-- - payroll export tracking and burden-aware review views
-- - login-event auditing for admin visibility
-- - material-to-job auto-cost rollups and route profitability summaries

create extension if not exists pgcrypto;

create table if not exists public.account_login_events (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles(id) on delete cascade,
  event_type text not null default 'login',
  auth_source text not null default 'session_restore',
  success boolean not null default true,
  route_fragment text,
  session_fingerprint text,
  ip_address text,
  user_agent text,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table if exists public.account_login_events drop constraint if exists account_login_events_type_check;
alter table if exists public.account_login_events
  add constraint account_login_events_type_check
  check (event_type in ('login','session_restore','password_reset','logout','account_setup'));

create index if not exists idx_account_login_events_profile_id on public.account_login_events(profile_id, occurred_at desc);
create index if not exists idx_account_login_events_success on public.account_login_events(success, occurred_at desc);

create or replace view public.v_profile_access_rollups as
with latest as (
  select distinct on (ale.profile_id)
    ale.profile_id,
    ale.occurred_at as last_login_at,
    ale.auth_source as last_login_source,
    ale.route_fragment as last_login_route,
    ale.user_agent as last_login_user_agent
  from public.account_login_events ale
  where ale.success = true
  order by ale.profile_id, ale.occurred_at desc, ale.created_at desc
)
select
  p.id,
  count(ale.id)::int as login_event_count,
  count(*) filter (where ale.success = true)::int as successful_login_count,
  count(*) filter (where ale.success = false)::int as failed_login_count,
  max(ale.occurred_at) filter (where ale.success = true) as last_login_at,
  max(ale.occurred_at) as last_access_event_at,
  l.last_login_source,
  l.last_login_route,
  l.last_login_user_agent
from public.profiles p
left join public.account_login_events ale on ale.profile_id = p.id
left join latest l on l.profile_id = p.id
group by p.id, l.last_login_source, l.last_login_route, l.last_login_user_agent;

create table if not exists public.recurring_service_agreements (
  id uuid primary key default gen_random_uuid(),
  agreement_code text not null unique,
  client_id uuid references public.clients(id) on delete set null,
  client_site_id uuid references public.client_sites(id) on delete set null,
  service_pricing_template_id uuid references public.service_pricing_templates(id) on delete set null,
  route_id uuid references public.routes(id) on delete set null,
  crew_id uuid references public.crews(id) on delete set null,
  tax_code_id uuid references public.tax_codes(id) on delete set null,
  service_name text not null,
  agreement_status text not null default 'draft',
  billing_method text not null default 'per_visit',
  service_pattern text,
  recurrence_basis text,
  recurrence_rule text,
  recurrence_interval integer not null default 1,
  start_date date,
  end_date date,
  open_end_date boolean not null default false,
  visit_estimated_minutes integer,
  visit_estimated_duration_hours numeric(8,2),
  visit_cost_total numeric(12,2) not null default 0,
  visit_charge_total numeric(12,2) not null default 0,
  markup_percent numeric(7,2),
  discount_mode text not null default 'none',
  discount_value numeric(12,2) not null default 0,
  tiered_discount_notes text,
  event_trigger_type text,
  snow_trigger_threshold_cm numeric(8,2),
  trigger_notes text,
  pricing_notes text,
  service_notes text,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists public.recurring_service_agreements drop constraint if exists recurring_service_agreements_status_check;
alter table if exists public.recurring_service_agreements
  add constraint recurring_service_agreements_status_check
  check (agreement_status in ('draft','active','paused','completed','cancelled'));

alter table if exists public.recurring_service_agreements drop constraint if exists recurring_service_agreements_billing_method_check;
alter table if exists public.recurring_service_agreements
  add constraint recurring_service_agreements_billing_method_check
  check (billing_method in ('per_visit','flat_period','seasonal','event_trigger','time_and_material'));

alter table if exists public.recurring_service_agreements drop constraint if exists recurring_service_agreements_discount_mode_check;
alter table if exists public.recurring_service_agreements
  add constraint recurring_service_agreements_discount_mode_check
  check (discount_mode in ('none','percent','fixed','tiered'));

alter table if exists public.recurring_service_agreements drop constraint if exists recurring_service_agreements_event_trigger_check;
alter table if exists public.recurring_service_agreements
  add constraint recurring_service_agreements_event_trigger_check
  check (event_trigger_type is null or event_trigger_type in ('snow_cm','snow_event','ice_event','manual'));

create index if not exists idx_recurring_service_agreements_client_site on public.recurring_service_agreements(client_site_id, agreement_status);
create index if not exists idx_recurring_service_agreements_route on public.recurring_service_agreements(route_id, agreement_status);

create table if not exists public.snow_event_triggers (
  id uuid primary key default gen_random_uuid(),
  agreement_id uuid not null references public.recurring_service_agreements(id) on delete cascade,
  event_date date not null default current_date,
  event_label text,
  snowfall_cm numeric(8,2),
  threshold_cm numeric(8,2),
  trigger_met boolean not null default false,
  notes text,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_snow_event_triggers_agreement on public.snow_event_triggers(agreement_id, event_date desc);

create table if not exists public.change_orders (
  id uuid primary key default gen_random_uuid(),
  job_id bigint not null references public.jobs(id) on delete cascade,
  agreement_id uuid references public.recurring_service_agreements(id) on delete set null,
  change_order_number text not null unique,
  status text not null default 'draft',
  requested_at timestamptz not null default now(),
  approved_at timestamptz,
  approved_by_profile_id uuid references public.profiles(id) on delete set null,
  scope_summary text not null,
  reason text,
  estimated_cost_delta numeric(12,2) not null default 0,
  estimated_charge_delta numeric(12,2) not null default 0,
  actual_cost_delta numeric(12,2) not null default 0,
  actual_charge_delta numeric(12,2) not null default 0,
  tax_code_id uuid references public.tax_codes(id) on delete set null,
  notes text,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists public.change_orders drop constraint if exists change_orders_status_check;
alter table if exists public.change_orders
  add constraint change_orders_status_check
  check (status in ('draft','requested','approved','rejected','completed','void'));

create index if not exists idx_change_orders_job on public.change_orders(job_id, requested_at desc);

create table if not exists public.customer_assets (
  id uuid primary key default gen_random_uuid(),
  asset_code text not null unique,
  client_id uuid references public.clients(id) on delete set null,
  client_site_id uuid references public.client_sites(id) on delete set null,
  asset_name text not null,
  asset_type text not null default 'site_feature',
  serial_number text,
  install_date date,
  warranty_expiry_date date,
  manufacturer text,
  model text,
  location_notes text,
  service_notes text,
  is_active boolean not null default true,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_customer_assets_site on public.customer_assets(client_site_id, is_active);

create table if not exists public.customer_asset_job_links (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.customer_assets(id) on delete cascade,
  job_id bigint not null references public.jobs(id) on delete cascade,
  service_date date,
  event_type text not null default 'service',
  notes text,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists public.customer_asset_job_links drop constraint if exists customer_asset_job_links_type_check;
alter table if exists public.customer_asset_job_links
  add constraint customer_asset_job_links_type_check
  check (event_type in ('service','inspection','repair','warranty','callback','installation','replacement'));

create index if not exists idx_customer_asset_job_links_asset on public.customer_asset_job_links(asset_id, service_date desc, created_at desc);
create index if not exists idx_customer_asset_job_links_job on public.customer_asset_job_links(job_id, service_date desc, created_at desc);

create table if not exists public.warranty_callback_events (
  id uuid primary key default gen_random_uuid(),
  job_id bigint references public.jobs(id) on delete set null,
  asset_id uuid references public.customer_assets(id) on delete set null,
  client_site_id uuid references public.client_sites(id) on delete set null,
  callback_number text not null unique,
  callback_type text not null default 'callback',
  status text not null default 'open',
  warranty_covered boolean not null default false,
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  estimated_cost_total numeric(12,2) not null default 0,
  actual_cost_total numeric(12,2) not null default 0,
  notes text,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table if exists public.warranty_callback_events drop constraint if exists warranty_callback_events_type_check;
alter table if exists public.warranty_callback_events
  add constraint warranty_callback_events_type_check
  check (callback_type in ('callback','warranty','service_revisit','deficiency'));

alter table if exists public.warranty_callback_events drop constraint if exists warranty_callback_events_status_check;
alter table if exists public.warranty_callback_events
  add constraint warranty_callback_events_status_check
  check (status in ('open','scheduled','in_progress','closed','void'));

create table if not exists public.payroll_export_runs (
  id uuid primary key default gen_random_uuid(),
  run_code text not null unique,
  period_start date not null,
  period_end date not null,
  status text not null default 'draft',
  exported_at timestamptz,
  exported_by_profile_id uuid references public.profiles(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists public.payroll_export_runs drop constraint if exists payroll_export_runs_status_check;
alter table if exists public.payroll_export_runs
  add constraint payroll_export_runs_status_check
  check (status in ('draft','ready','exported','void'));

alter table if exists public.job_session_crew_hours
  add column if not exists payroll_export_run_id uuid references public.payroll_export_runs(id) on delete set null,
  add column if not exists payroll_exported_at timestamptz;

create or replace view public.v_payroll_review_detail as
select
  jh.id,
  jh.job_id,
  j.job_code,
  j.job_name,
  jh.job_session_id,
  js.session_date,
  jh.profile_id,
  p.full_name,
  p.employee_number,
  coalesce(jh.regular_hours, 0)::numeric(10,2) as regular_hours,
  coalesce(jh.overtime_hours, 0)::numeric(10,2) as overtime_hours,
  coalesce(jh.hours_worked, 0)::numeric(10,2) as hours_worked,
  coalesce(p.hourly_cost_rate, 0)::numeric(10,2) as hourly_cost_rate,
  coalesce(p.overtime_cost_rate, coalesce(p.hourly_cost_rate, 0) * 1.5, 0)::numeric(10,2) as overtime_cost_rate,
  coalesce(p.payroll_burden_percent, 0)::numeric(7,2) as payroll_burden_percent,
  (
    (coalesce(jh.regular_hours, 0) * coalesce(p.hourly_cost_rate, 0) * (1 + (coalesce(p.payroll_burden_percent, 0) / 100.0)))
    + (coalesce(jh.overtime_hours, 0) * coalesce(p.overtime_cost_rate, coalesce(p.hourly_cost_rate, 0) * 1.5, 0) * (1 + (coalesce(p.payroll_burden_percent, 0) / 100.0)))
  )::numeric(12,2) as payroll_cost_total,
  jh.payroll_export_run_id,
  per.run_code as payroll_export_run_code,
  jh.payroll_exported_at,
  (jh.payroll_export_run_id is null) as needs_export,
  jh.created_at,
  jh.updated_at
from public.job_session_crew_hours jh
left join public.jobs j on j.id = jh.job_id
left join public.job_sessions js on js.id = jh.job_session_id
left join public.profiles p on p.id = jh.profile_id
left join public.payroll_export_runs per on per.id = jh.payroll_export_run_id;

create or replace view public.v_payroll_review_summary as
select
  date_trunc('week', coalesce(js.session_date::timestamp, jh.created_at))::date as week_start,
  jh.profile_id,
  p.full_name,
  p.employee_number,
  count(*)::int as labor_entry_count,
  coalesce(sum(coalesce(jh.regular_hours, 0)), 0)::numeric(10,2) as regular_hours_total,
  coalesce(sum(coalesce(jh.overtime_hours, 0)), 0)::numeric(10,2) as overtime_hours_total,
  coalesce(sum(coalesce(jh.hours_worked, 0)), 0)::numeric(10,2) as hours_worked_total,
  coalesce(sum(
    (coalesce(jh.regular_hours, 0) * coalesce(p.hourly_cost_rate, 0) * (1 + (coalesce(p.payroll_burden_percent, 0) / 100.0)))
    + (coalesce(jh.overtime_hours, 0) * coalesce(p.overtime_cost_rate, coalesce(p.hourly_cost_rate, 0) * 1.5, 0) * (1 + (coalesce(p.payroll_burden_percent, 0) / 100.0)))
  ), 0)::numeric(12,2) as payroll_cost_total,
  count(*) filter (where jh.payroll_export_run_id is null)::int as unexported_entry_count,
  coalesce(sum(case when jh.payroll_export_run_id is null then coalesce(jh.hours_worked, 0) else 0 end), 0)::numeric(10,2) as unexported_hours_total,
  coalesce(sum(case when jh.payroll_export_run_id is null then (
    (coalesce(jh.regular_hours, 0) * coalesce(p.hourly_cost_rate, 0) * (1 + (coalesce(p.payroll_burden_percent, 0) / 100.0)))
    + (coalesce(jh.overtime_hours, 0) * coalesce(p.overtime_cost_rate, coalesce(p.hourly_cost_rate, 0) * 1.5, 0) * (1 + (coalesce(p.payroll_burden_percent, 0) / 100.0)))
  ) else 0 end), 0)::numeric(12,2) as unexported_payroll_cost_total,
  max(jh.payroll_exported_at) as last_exported_at
from public.job_session_crew_hours jh
left join public.job_sessions js on js.id = jh.job_session_id
left join public.profiles p on p.id = jh.profile_id
group by date_trunc('week', coalesce(js.session_date::timestamp, jh.created_at))::date, jh.profile_id, p.full_name, p.employee_number;

create or replace view public.v_job_material_rollups as
with receipt_rollup as (
  select
    wo.legacy_job_id::bigint as job_id,
    count(distinct mr.id)::int as receipt_count,
    coalesce(sum(coalesce(mrl.line_total, 0)), 0)::numeric(12,2) as receipt_cost_total,
    max(mr.receipt_date) as last_receipt_date
  from public.material_receipts mr
  join public.material_receipt_lines mrl on mrl.receipt_id = mr.id
  join public.work_orders wo on wo.id = mr.work_order_id
  where wo.legacy_job_id is not null
  group by wo.legacy_job_id
), issue_rollup as (
  select
    wo.legacy_job_id::bigint as job_id,
    count(distinct mi.id)::int as issue_count,
    coalesce(sum(coalesce(mil.line_total, 0)), 0)::numeric(12,2) as issue_cost_total,
    max(mi.issue_date) as last_issue_date
  from public.material_issues mi
  join public.material_issue_lines mil on mil.issue_id = mi.id
  join public.work_orders wo on wo.id = mi.work_order_id
  where wo.legacy_job_id is not null
  group by wo.legacy_job_id
)
select
  coalesce(rr.job_id, ir.job_id) as job_id,
  coalesce(rr.receipt_count, 0)::int as receipt_count,
  coalesce(rr.receipt_cost_total, 0)::numeric(12,2) as receipt_cost_total,
  rr.last_receipt_date,
  coalesce(ir.issue_count, 0)::int as issue_count,
  coalesce(ir.issue_cost_total, 0)::numeric(12,2) as issue_cost_total,
  ir.last_issue_date,
  case
    when coalesce(ir.issue_cost_total, 0) > 0 then coalesce(ir.issue_cost_total, 0)
    else coalesce(rr.receipt_cost_total, 0)
  end::numeric(12,2) as auto_material_cost_total
from receipt_rollup rr
full outer join issue_rollup ir on ir.job_id = rr.job_id;

create or replace view public.v_job_change_order_rollups as
select
  co.job_id,
  count(*)::int as change_order_count,
  count(*) filter (where co.status = 'approved')::int as approved_change_order_count,
  coalesce(sum(case when co.status = 'approved' then coalesce(co.estimated_cost_delta, 0) else 0 end), 0)::numeric(12,2) as approved_estimated_cost_delta_total,
  coalesce(sum(case when co.status = 'approved' then coalesce(co.estimated_charge_delta, 0) else 0 end), 0)::numeric(12,2) as approved_estimated_charge_delta_total,
  coalesce(sum(case when co.status = 'completed' then coalesce(co.actual_cost_delta, 0) else 0 end), 0)::numeric(12,2) as completed_actual_cost_delta_total,
  coalesce(sum(case when co.status = 'completed' then coalesce(co.actual_charge_delta, 0) else 0 end), 0)::numeric(12,2) as completed_actual_charge_delta_total,
  max(co.requested_at) as last_change_order_requested_at
from public.change_orders co
group by co.job_id;

create or replace view public.v_customer_asset_history as
select
  l.id,
  l.asset_id,
  a.asset_code,
  a.asset_name,
  a.asset_type,
  a.client_id,
  a.client_site_id,
  l.job_id,
  j.job_code,
  j.job_name,
  l.service_date,
  l.event_type,
  l.notes,
  l.created_by_profile_id,
  p.full_name as created_by_name,
  l.created_at,
  l.updated_at
from public.customer_asset_job_links l
left join public.customer_assets a on a.id = l.asset_id
left join public.jobs j on j.id = l.job_id
left join public.profiles p on p.id = l.created_by_profile_id;

create or replace view public.v_route_profitability_summary as
select
  jd.route_id,
  r.route_code,
  r.name as route_name,
  jd.service_area_id,
  jd.service_area_name,
  jd.crew_id,
  jd.crew_name,
  count(*)::int as job_count,
  coalesce(sum(coalesce(jd.session_count, 0)), 0)::int as session_count,
  coalesce(sum(coalesce(jd.actual_cost_rollup_total, 0)), 0)::numeric(12,2) as actual_cost_rollup_total,
  coalesce(sum(coalesce(jd.actual_charge_rollup_total, 0)), 0)::numeric(12,2) as actual_charge_rollup_total,
  coalesce(sum(coalesce(jd.actual_profit_rollup_total, 0)), 0)::numeric(12,2) as actual_profit_rollup_total,
  case
    when coalesce(sum(coalesce(jd.actual_charge_rollup_total, 0)), 0) > 0
      then round((coalesce(sum(coalesce(jd.actual_profit_rollup_total, 0)), 0) / coalesce(sum(coalesce(jd.actual_charge_rollup_total, 0)), 0)) * 100.0, 2)::numeric(7,2)
    else 0::numeric(7,2)
  end as actual_margin_percent,
  max(jd.last_activity_at) as last_activity_at
from public.v_jobs_directory jd
left join public.routes r on r.id = jd.route_id
group by jd.route_id, r.route_code, r.name, jd.service_area_id, jd.service_area_name, jd.crew_id, jd.crew_name;

create or replace view public.v_job_financial_rollups as
with session_rollup as (
  select
    js.job_id,
    count(*)::int as session_count,
    count(*) filter (where coalesce(js.session_status, '') in ('planned','in_progress','delayed','paused'))::int as open_session_count,
    count(*) filter (where js.site_supervisor_signed_off_at is null and coalesce(js.site_supervisor_signoff_name, '') = '')::int as unsigned_session_count,
    max(js.started_at) as last_session_started_at,
    max(js.ended_at) as last_session_ended_at,
    max(js.site_supervisor_signed_off_at) as last_supervisor_signoff_at
  from public.job_sessions js
  group by js.job_id
)
select
  j.id as job_id,
  coalesce(labor.labor_entry_count, 0)::int as labor_entry_count,
  coalesce(labor.regular_hours_total, 0)::numeric(10,2) as regular_hours_total,
  coalesce(labor.overtime_hours_total, 0)::numeric(10,2) as overtime_hours_total,
  coalesce(labor.hours_worked_total, 0)::numeric(10,2) as hours_worked_total,
  coalesce(labor.labor_cost_total, 0)::numeric(12,2) as labor_cost_total,
  coalesce(labor.labor_bill_total, 0)::numeric(12,2) as labor_bill_total,
  coalesce(fin.financial_event_count, 0)::int as financial_event_count,
  coalesce(fin.cost_event_count, 0)::int as cost_event_count,
  coalesce(fin.revenue_event_count, 0)::int as revenue_event_count,
  coalesce(fin.billable_event_count, 0)::int as billable_event_count,
  coalesce(fin.cost_total, 0)::numeric(12,2) as financial_event_cost_total,
  coalesce(fin.revenue_total, 0)::numeric(12,2) as financial_event_revenue_total,
  coalesce(sess.session_count, 0)::int as session_count,
  coalesce(sess.open_session_count, 0)::int as open_session_count,
  coalesce(sess.unsigned_session_count, 0)::int as unsigned_session_count,
  sess.last_session_started_at,
  sess.last_session_ended_at,
  sess.last_supervisor_signoff_at,
  (coalesce(j.actual_cost_total, 0) + coalesce(j.delay_cost_total, 0) + coalesce(j.equipment_repair_cost_total, 0) + coalesce(labor.labor_cost_total, 0) + coalesce(fin.cost_total, 0) + coalesce(mat.auto_material_cost_total, 0))::numeric(12,2) as actual_cost_rollup_total,
  (coalesce(j.actual_charge_total, 0) + coalesce(labor.labor_bill_total, 0) + coalesce(fin.revenue_total, 0))::numeric(12,2) as actual_charge_rollup_total,
  ((coalesce(j.actual_charge_total, 0) + coalesce(labor.labor_bill_total, 0) + coalesce(fin.revenue_total, 0))
    - (coalesce(j.actual_cost_total, 0) + coalesce(j.delay_cost_total, 0) + coalesce(j.equipment_repair_cost_total, 0) + coalesce(labor.labor_cost_total, 0) + coalesce(fin.cost_total, 0) + coalesce(mat.auto_material_cost_total, 0)))::numeric(12,2) as actual_profit_rollup_total,
  case
    when (coalesce(j.actual_charge_total, 0) + coalesce(labor.labor_bill_total, 0) + coalesce(fin.revenue_total, 0)) > 0
      then round((((coalesce(j.actual_charge_total, 0) + coalesce(labor.labor_bill_total, 0) + coalesce(fin.revenue_total, 0))
        - (coalesce(j.actual_cost_total, 0) + coalesce(j.delay_cost_total, 0) + coalesce(j.equipment_repair_cost_total, 0) + coalesce(labor.labor_cost_total, 0) + coalesce(fin.cost_total, 0) + coalesce(mat.auto_material_cost_total, 0)))
        / (coalesce(j.actual_charge_total, 0) + coalesce(labor.labor_bill_total, 0) + coalesce(fin.revenue_total, 0))) * 100.0, 2)::numeric(7,2)
    else 0::numeric(7,2)
  end as actual_margin_rollup_percent,
  ((coalesce(j.actual_charge_total, 0) + coalesce(labor.labor_bill_total, 0) + coalesce(fin.revenue_total, 0)) - coalesce(j.quoted_charge_total, 0))::numeric(12,2) as charge_vs_quote_variance_total,
  ((coalesce(j.actual_cost_total, 0) + coalesce(j.delay_cost_total, 0) + coalesce(j.equipment_repair_cost_total, 0) + coalesce(labor.labor_cost_total, 0) + coalesce(fin.cost_total, 0) + coalesce(mat.auto_material_cost_total, 0)) - coalesce(j.estimated_cost_total, 0))::numeric(12,2) as cost_vs_estimate_variance_total,
  coalesce(mat.receipt_count, 0)::int as material_receipt_count,
  coalesce(mat.receipt_cost_total, 0)::numeric(12,2) as material_receipt_cost_total,
  mat.last_receipt_date,
  coalesce(mat.issue_count, 0)::int as material_issue_count,
  coalesce(mat.issue_cost_total, 0)::numeric(12,2) as material_issue_cost_total,
  mat.last_issue_date,
  coalesce(mat.auto_material_cost_total, 0)::numeric(12,2) as auto_material_cost_total,
  coalesce(co.change_order_count, 0)::int as change_order_count,
  coalesce(co.approved_change_order_count, 0)::int as approved_change_order_count,
  coalesce(co.approved_estimated_cost_delta_total, 0)::numeric(12,2) as approved_change_order_estimated_cost_delta_total,
  coalesce(co.approved_estimated_charge_delta_total, 0)::numeric(12,2) as approved_change_order_estimated_charge_delta_total,
  coalesce(co.completed_actual_cost_delta_total, 0)::numeric(12,2) as completed_change_order_actual_cost_delta_total,
  coalesce(co.completed_actual_charge_delta_total, 0)::numeric(12,2) as completed_change_order_actual_charge_delta_total,
  co.last_change_order_requested_at
from public.jobs j
left join public.v_job_labor_rollups labor on labor.job_id = j.id
left join public.v_job_financial_event_rollups fin on fin.job_id = j.id
left join session_rollup sess on sess.job_id = j.id
left join public.v_job_material_rollups mat on mat.job_id = j.id
left join public.v_job_change_order_rollups co on co.job_id = j.id;

create or replace view public.v_accounting_review_summary as
with batch_rollup as (
  select
    count(*)::int as batch_count,
    count(*) filter (where coalesce(batch_status, '') <> 'posted')::int as unposted_batch_count,
    count(*) filter (where coalesce(is_balanced, false) = false)::int as unbalanced_batch_count,
    count(*) filter (where coalesce(source_sync_state, '') in ('stale', 'out_of_sync', 'needs_review'))::int as stale_source_batch_count,
    max(source_synced_at) as last_source_synced_at
  from public.v_gl_journal_batch_rollups
),
exception_rollup as (
  select
    count(*)::int as sync_exception_count,
    count(*) filter (where exception_status = 'open')::int as open_sync_exception_count,
    count(*) filter (where exception_status = 'open' and severity in ('warning','error'))::int as warning_or_error_sync_exception_count,
    max(last_seen_at) as last_sync_exception_at
  from public.v_gl_journal_sync_exceptions
),
ar_rollup as (
  select
    count(*) filter (where record_type = 'ar_invoice' and coalesce(balance_due, 0) > 0)::int as open_ar_record_count,
    coalesce(sum(case when record_type = 'ar_invoice' then balance_due else 0 end), 0)::numeric(12,2) as open_ar_balance
  from public.v_account_balance_rollups
),
ap_rollup as (
  select
    count(*) filter (where record_type = 'ap_bill' and coalesce(balance_due, 0) > 0)::int as open_ap_record_count,
    coalesce(sum(case when record_type = 'ap_bill' then balance_due else 0 end), 0)::numeric(12,2) as open_ap_balance
  from public.v_account_balance_rollups
),
traffic_rollup as (
  select
    max(event_date) as latest_daily_event_date,
    max(total_events) filter (where event_date = (select max(event_date) from public.v_app_traffic_daily_summary)) as latest_daily_total_events
  from public.v_app_traffic_daily_summary
),
job_rollup as (
  select
    count(*) filter (where coalesce(status, '') in ('completed','done','closed') and coalesce(invoice_number, '') = '')::int as completed_uninvoiced_job_count,
    count(*) filter (where coalesce(delayed_schedule, false) = true)::int as delayed_job_count,
    count(*) filter (where coalesce(unsigned_job_session_count, 0) > 0)::int as unsigned_job_session_count,
    count(*) filter (where coalesce(actual_profit_rollup_total, 0) < 0)::int as loss_making_job_count,
    count(*) filter (where coalesce(financial_event_count, 0) > 0)::int as jobs_with_financial_events_count,
    coalesce(sum(coalesce(actual_profit_rollup_total, 0)), 0)::numeric(12,2) as actual_rollup_profit_total,
    count(*) filter (where coalesce(change_order_count, 0) > 0)::int as jobs_with_change_orders_count
  from public.v_jobs_directory
),
payroll_rollup as (
  select
    count(*)::int as payroll_week_count,
    coalesce(sum(unexported_entry_count), 0)::int as unexported_payroll_entry_count,
    coalesce(sum(unexported_payroll_cost_total), 0)::numeric(12,2) as unexported_payroll_cost_total
  from public.v_payroll_review_summary
),
agreement_rollup as (
  select
    count(*) filter (where agreement_status = 'active')::int as active_recurring_agreement_count,
    count(*) filter (where coalesce(event_trigger_type, '') like 'snow%')::int as snow_trigger_agreement_count
  from public.recurring_service_agreements
),
callback_rollup as (
  select
    count(*) filter (where status <> 'closed')::int as open_callback_count,
    count(*) filter (where warranty_covered = true and status <> 'closed')::int as open_warranty_callback_count
  from public.warranty_callback_events
)
select
  br.batch_count,
  br.unposted_batch_count,
  br.unbalanced_batch_count,
  br.stale_source_batch_count,
  br.last_source_synced_at,
  er.sync_exception_count,
  er.open_sync_exception_count,
  er.warning_or_error_sync_exception_count,
  er.last_sync_exception_at,
  ar.open_ar_record_count,
  ar.open_ar_balance,
  ap.open_ap_record_count,
  ap.open_ap_balance,
  tr.latest_daily_event_date,
  tr.latest_daily_total_events,
  jr.completed_uninvoiced_job_count,
  jr.delayed_job_count,
  jr.unsigned_job_session_count,
  jr.loss_making_job_count,
  jr.jobs_with_financial_events_count,
  jr.actual_rollup_profit_total,
  pr.payroll_week_count,
  pr.unexported_payroll_entry_count,
  pr.unexported_payroll_cost_total,
  agr.active_recurring_agreement_count,
  agr.snow_trigger_agreement_count,
  jr.jobs_with_change_orders_count,
  cb.open_callback_count,
  cb.open_warranty_callback_count
from batch_rollup br
cross join exception_rollup er
cross join ar_rollup ar
cross join ap_rollup ap
cross join traffic_rollup tr
cross join job_rollup jr
cross join payroll_rollup pr
cross join agreement_rollup agr
cross join callback_rollup cb;


-- 081_contract_conversion_payroll_exports_and_snow_invoice_automation.sql

-- 081_contract_conversion_payroll_exports_and_snow_invoice_automation.sql
-- Adds:
-- - estimate -> agreement conversion support
-- - printable service contract / application records
-- - payroll export file generation storage
-- - agreement profitability and snow-event invoice automation
-- - callback / warranty dashboard summaries

create extension if not exists pgcrypto;

alter table if exists public.recurring_service_agreements
  add column if not exists estimate_id uuid references public.estimates(id) on delete set null,
  add column if not exists contract_document_id uuid,
  add column if not exists agreement_notes text;

create table if not exists public.service_contract_documents (
  id uuid primary key default gen_random_uuid(),
  document_number text not null unique,
  source_entity text not null,
  source_id text not null,
  estimate_id uuid references public.estimates(id) on delete set null,
  agreement_id uuid references public.recurring_service_agreements(id) on delete set null,
  job_id bigint references public.jobs(id) on delete set null,
  client_id uuid references public.clients(id) on delete set null,
  client_site_id uuid references public.client_sites(id) on delete set null,
  document_kind text not null default 'contract',
  document_status text not null default 'draft',
  title text not null,
  contract_reference text,
  effective_date date,
  expiry_date date,
  rendered_html text,
  rendered_text text,
  payload jsonb not null default '{}'::jsonb,
  notes text,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists public.service_contract_documents drop constraint if exists service_contract_documents_source_entity_check;
alter table if exists public.service_contract_documents
  add constraint service_contract_documents_source_entity_check
  check (source_entity in ('estimate','recurring_service_agreement','job','manual'));

alter table if exists public.service_contract_documents drop constraint if exists service_contract_documents_kind_check;
alter table if exists public.service_contract_documents
  add constraint service_contract_documents_kind_check
  check (document_kind in ('application','contract','change_order','service_summary','payroll_export_cover'));

alter table if exists public.service_contract_documents drop constraint if exists service_contract_documents_status_check;
alter table if exists public.service_contract_documents
  add constraint service_contract_documents_status_check
  check (document_status in ('draft','issued','signed','archived','void'));

alter table if exists public.recurring_service_agreements
  drop constraint if exists recurring_service_agreements_contract_document_fk;
alter table if exists public.recurring_service_agreements
  add constraint recurring_service_agreements_contract_document_fk
  foreign key (contract_document_id) references public.service_contract_documents(id) on delete set null;

alter table if exists public.payroll_export_runs
  add column if not exists export_format text not null default 'csv',
  add column if not exists export_file_name text,
  add column if not exists export_file_content text,
  add column if not exists exported_entry_count integer not null default 0,
  add column if not exists exported_hours_total numeric(10,2) not null default 0,
  add column if not exists exported_payroll_cost_total numeric(12,2) not null default 0;

alter table if exists public.payroll_export_runs drop constraint if exists payroll_export_runs_export_format_check;
alter table if exists public.payroll_export_runs
  add constraint payroll_export_runs_export_format_check
  check (export_format in ('csv','json'));

alter table if exists public.ar_invoices
  add column if not exists recurring_service_agreement_id uuid references public.recurring_service_agreements(id) on delete set null,
  add column if not exists snow_event_trigger_id uuid references public.snow_event_triggers(id) on delete set null,
  add column if not exists service_contract_document_id uuid references public.service_contract_documents(id) on delete set null,
  add column if not exists invoice_source text not null default 'manual';

alter table if exists public.ar_invoices drop constraint if exists ar_invoices_invoice_source_check;
alter table if exists public.ar_invoices
  add constraint ar_invoices_invoice_source_check
  check (invoice_source in ('manual','job','agreement_visit','agreement_snow','change_order','callback','contract'));

create index if not exists idx_service_contract_documents_source on public.service_contract_documents(source_entity, source_id, created_at desc);
create index if not exists idx_service_contract_documents_agreement on public.service_contract_documents(agreement_id, created_at desc);
create index if not exists idx_ar_invoices_agreement on public.ar_invoices(recurring_service_agreement_id, invoice_date desc);
create index if not exists idx_ar_invoices_snow_trigger on public.ar_invoices(snow_event_trigger_id);

create or replace view public.v_estimate_conversion_candidates as
select
  e.id,
  e.estimate_number,
  e.client_id,
  c.legal_name as client_name,
  e.client_site_id,
  cs.site_name as client_site_name,
  e.estimate_type,
  e.status,
  e.valid_until,
  e.subtotal,
  e.tax_total,
  e.total_amount,
  count(distinct a.id)::int as linked_agreement_count,
  count(distinct d.id)::int as linked_document_count,
  max(a.updated_at) as last_agreement_update_at,
  max(d.updated_at) as last_document_update_at
from public.estimates e
left join public.clients c on c.id = e.client_id
left join public.client_sites cs on cs.id = e.client_site_id
left join public.recurring_service_agreements a on a.estimate_id = e.id
left join public.service_contract_documents d on d.estimate_id = e.id
group by e.id, e.estimate_number, e.client_id, c.legal_name, e.client_site_id, cs.site_name, e.estimate_type, e.status, e.valid_until, e.subtotal, e.tax_total, e.total_amount;

create or replace view public.v_service_agreement_profitability_summary as
with agreement_jobs as (
  select
    a.id as agreement_id,
    j.id as job_id
  from public.recurring_service_agreements a
  left join public.jobs j on coalesce(j.service_contract_reference, '') = coalesce(a.agreement_code, '')
),
job_rollup as (
  select
    aj.agreement_id,
    count(distinct aj.job_id)::int as linked_job_count,
    coalesce(sum(coalesce(jf.session_count, 0)), 0)::int as linked_session_count,
    coalesce(sum(coalesce(jf.actual_cost_rollup_total, 0)), 0)::numeric(12,2) as actual_cost_rollup_total,
    coalesce(sum(coalesce(jf.actual_charge_rollup_total, 0)), 0)::numeric(12,2) as actual_charge_rollup_total,
    coalesce(sum(coalesce(jf.actual_profit_rollup_total, 0)), 0)::numeric(12,2) as actual_profit_rollup_total,
    max(jf.last_session_ended_at) as last_job_activity_at
  from agreement_jobs aj
  left join public.v_job_financial_rollups jf on jf.job_id = aj.job_id
  group by aj.agreement_id
),
invoice_rollup as (
  select
    ai.recurring_service_agreement_id as agreement_id,
    count(*)::int as invoice_count,
    count(*) filter (where coalesce(ai.invoice_source, '') = 'agreement_snow')::int as snow_invoice_count,
    coalesce(sum(coalesce(ai.total_amount, 0)), 0)::numeric(12,2) as invoiced_total,
    coalesce(sum(coalesce(ai.balance_due, 0)), 0)::numeric(12,2) as open_invoice_balance,
    max(ai.invoice_date) as last_invoice_date
  from public.ar_invoices ai
  where ai.recurring_service_agreement_id is not null
  group by ai.recurring_service_agreement_id
),
trigger_rollup as (
  select
    st.agreement_id,
    count(*)::int as snow_event_count,
    count(*) filter (where st.trigger_met = true)::int as triggered_snow_event_count,
    max(st.event_date) as last_snow_event_date
  from public.snow_event_triggers st
  group by st.agreement_id
)
select
  a.id,
  a.agreement_code,
  a.service_name,
  a.agreement_status,
  a.client_id,
  c.legal_name as client_name,
  a.client_site_id,
  cs.site_name as client_site_name,
  a.route_id,
  r.name as route_name,
  a.crew_id,
  cr.crew_name,
  a.billing_method,
  a.start_date,
  a.end_date,
  a.open_end_date,
  a.visit_cost_total,
  a.visit_charge_total,
  coalesce(jr.linked_job_count, 0)::int as linked_job_count,
  coalesce(jr.linked_session_count, 0)::int as linked_session_count,
  coalesce(jr.actual_cost_rollup_total, 0)::numeric(12,2) as actual_cost_rollup_total,
  coalesce(jr.actual_charge_rollup_total, 0)::numeric(12,2) as actual_charge_rollup_total,
  coalesce(jr.actual_profit_rollup_total, 0)::numeric(12,2) as actual_profit_rollup_total,
  case
    when coalesce(jr.actual_charge_rollup_total, 0) > 0 then round((coalesce(jr.actual_profit_rollup_total, 0) / coalesce(jr.actual_charge_rollup_total, 0)) * 100.0, 2)::numeric(7,2)
    else 0::numeric(7,2)
  end as actual_margin_percent,
  coalesce(ir.invoice_count, 0)::int as invoice_count,
  coalesce(ir.snow_invoice_count, 0)::int as snow_invoice_count,
  coalesce(ir.invoiced_total, 0)::numeric(12,2) as invoiced_total,
  coalesce(ir.open_invoice_balance, 0)::numeric(12,2) as open_invoice_balance,
  ir.last_invoice_date,
  coalesce(tr.snow_event_count, 0)::int as snow_event_count,
  coalesce(tr.triggered_snow_event_count, 0)::int as triggered_snow_event_count,
  tr.last_snow_event_date,
  jr.last_job_activity_at
from public.recurring_service_agreements a
left join public.clients c on c.id = a.client_id
left join public.client_sites cs on cs.id = a.client_site_id
left join public.routes r on r.id = a.route_id
left join public.crews cr on cr.id = a.crew_id
left join job_rollup jr on jr.agreement_id = a.id
left join invoice_rollup ir on ir.agreement_id = a.id
left join trigger_rollup tr on tr.agreement_id = a.id;

create or replace view public.v_snow_event_invoice_candidates as
select
  st.id,
  st.agreement_id,
  a.agreement_code,
  a.service_name,
  a.client_id,
  c.legal_name as client_name,
  a.client_site_id,
  cs.site_name as client_site_name,
  st.event_date,
  st.event_label,
  st.snowfall_cm,
  coalesce(st.threshold_cm, a.snow_trigger_threshold_cm) as threshold_cm,
  st.trigger_met,
  a.visit_charge_total,
  coalesce(tc.rate_percent, 0)::numeric(7,3) as tax_rate_percent,
  round(coalesce(a.visit_charge_total, 0) * (coalesce(tc.rate_percent, 0) / 100.0), 2)::numeric(12,2) as estimated_tax_total,
  round(coalesce(a.visit_charge_total, 0) * (1 + (coalesce(tc.rate_percent, 0) / 100.0)), 2)::numeric(12,2) as estimated_total_with_tax,
  ai.id as existing_invoice_id,
  ai.invoice_number as existing_invoice_number,
  ai.invoice_status as existing_invoice_status,
  ai.invoice_date as existing_invoice_date
from public.snow_event_triggers st
join public.recurring_service_agreements a on a.id = st.agreement_id
left join public.clients c on c.id = a.client_id
left join public.client_sites cs on cs.id = a.client_site_id
left join public.tax_codes tc on tc.id = a.tax_code_id
left join public.ar_invoices ai on ai.snow_event_trigger_id = st.id
where st.trigger_met = true;

create or replace view public.v_callback_warranty_dashboard_summary as
select
  count(*)::int as total_callback_count,
  count(*) filter (where status <> 'closed')::int as open_callback_count,
  count(*) filter (where callback_type = 'warranty' and status <> 'closed')::int as open_warranty_callback_count,
  count(*) filter (where callback_type = 'callback' and status <> 'closed')::int as open_standard_callback_count,
  coalesce(sum(case when status <> 'closed' then coalesce(actual_cost_total, 0) else 0 end), 0)::numeric(12,2) as open_callback_cost_total,
  max(opened_at) as last_callback_opened_at
from public.warranty_callback_events;


-- 082_site_activity_audit_and_admin_recent_events.sql
-- Adds a durable admin-visible activity trail for operational and accounting changes.

create extension if not exists pgcrypto;

create table if not exists public.site_activity_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  entity_type text not null,
  entity_id text,
  severity text not null default 'info',
  title text not null,
  summary text,
  metadata jsonb not null default '{}'::jsonb,
  related_job_id bigint references public.jobs(id) on delete set null,
  related_profile_id uuid references public.profiles(id) on delete set null,
  related_equipment_id uuid references public.equipment_master(id) on delete set null,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table if exists public.site_activity_events drop constraint if exists site_activity_events_type_check;
alter table if exists public.site_activity_events
  add constraint site_activity_events_type_check
  check (
    event_type in (
      'job_created','job_updated','job_session_created','job_session_updated','crew_hours_logged','job_reassignment_created','job_financial_event_created',
      'staff_created','staff_updated','staff_status_changed','staff_deleted',
      'equipment_created','equipment_updated','equipment_deleted',
      'agreement_created','agreement_updated','snow_trigger_created','change_order_created',
      'customer_asset_created','callback_created','payroll_export_created','contract_document_created',
      'order_created','account_login'
    )
  );

alter table if exists public.site_activity_events drop constraint if exists site_activity_events_severity_check;
alter table if exists public.site_activity_events
  add constraint site_activity_events_severity_check
  check (severity in ('info','success','warning','error'));

create index if not exists idx_site_activity_events_occurred_at on public.site_activity_events(occurred_at desc);
create index if not exists idx_site_activity_events_entity on public.site_activity_events(entity_type, entity_id, occurred_at desc);
create index if not exists idx_site_activity_events_job on public.site_activity_events(related_job_id, occurred_at desc);
create index if not exists idx_site_activity_events_actor on public.site_activity_events(created_by_profile_id, occurred_at desc);

create or replace view public.v_site_activity_recent as
select
  sae.id,
  sae.event_type,
  sae.entity_type,
  sae.entity_id,
  sae.severity,
  sae.title,
  sae.summary,
  sae.metadata,
  sae.related_job_id,
  j.job_code,
  j.job_name,
  sae.related_profile_id,
  rp.full_name as related_profile_name,
  sae.related_equipment_id,
  em.equipment_code as related_equipment_code,
  em.item_name as related_equipment_name,
  sae.created_by_profile_id,
  cp.full_name as created_by_name,
  sae.occurred_at,
  sae.created_at
from public.site_activity_events sae
left join public.jobs j on j.id = sae.related_job_id
left join public.profiles rp on rp.id = sae.related_profile_id
left join public.equipment_master em on em.id = sae.related_equipment_id
left join public.profiles cp on cp.id = sae.created_by_profile_id;

create or replace view public.v_site_activity_summary as
select
  count(*)::int as total_event_count,
  count(*) filter (where occurred_at >= now() - interval '24 hours')::int as last_24h_event_count,
  count(*) filter (where event_type = 'job_created' and occurred_at >= now() - interval '24 hours')::int as last_24h_job_created_count,
  count(*) filter (where event_type = 'staff_created' and occurred_at >= now() - interval '24 hours')::int as last_24h_staff_created_count,
  count(*) filter (where event_type = 'equipment_created' and occurred_at >= now() - interval '24 hours')::int as last_24h_equipment_created_count,
  count(*) filter (where severity in ('warning','error') and occurred_at >= now() - interval '24 hours')::int as last_24h_attention_count,
  max(occurred_at) as last_activity_at
from public.site_activity_events;


-- Included from 083_employee_time_clock_and_break_tracking.sql

-- 083_employee_time_clock_and_break_tracking.sql
-- Adds employee self-service site/job time clock tracking with unpaid breaks,
-- payroll-linked hour sync, and admin-visible attendance rollups.

create extension if not exists pgcrypto;

create table if not exists public.employee_time_entries (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  crew_id uuid references public.crews(id) on delete set null,
  job_id bigint not null references public.jobs(id) on delete cascade,
  job_session_id uuid references public.job_sessions(id) on delete set null,
  site_id bigint references public.sites(id) on delete set null,
  clock_status text not null default 'active',
  signed_in_at timestamptz not null default now(),
  last_status_at timestamptz not null default now(),
  signed_out_at timestamptz,
  total_elapsed_minutes integer not null default 0,
  unpaid_break_minutes integer not null default 0,
  paid_work_minutes integer not null default 0,
  notes text,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists public.employee_time_entries drop constraint if exists employee_time_entries_status_check;
alter table if exists public.employee_time_entries
  add constraint employee_time_entries_status_check
  check (clock_status in ('active','paused','signed_out','cancelled'));

create index if not exists idx_employee_time_entries_profile on public.employee_time_entries(profile_id, signed_in_at desc);
create index if not exists idx_employee_time_entries_job on public.employee_time_entries(job_id, signed_in_at desc);
create unique index if not exists idx_employee_time_entries_one_open_per_profile
  on public.employee_time_entries(profile_id)
  where signed_out_at is null and clock_status in ('active','paused');

create table if not exists public.employee_time_entry_breaks (
  id uuid primary key default gen_random_uuid(),
  time_entry_id uuid not null references public.employee_time_entries(id) on delete cascade,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  duration_minutes integer not null default 0,
  unpaid boolean not null default true,
  notes text,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_employee_time_entry_breaks_entry on public.employee_time_entry_breaks(time_entry_id, started_at desc);

alter table if exists public.job_session_crew_hours
  add column if not exists time_entry_id uuid references public.employee_time_entries(id) on delete set null,
  add column if not exists break_minutes integer not null default 0,
  add column if not exists pay_code text not null default 'regular';

alter table if exists public.job_session_crew_hours drop constraint if exists job_session_crew_hours_pay_code_check;
alter table if exists public.job_session_crew_hours
  add constraint job_session_crew_hours_pay_code_check
  check (pay_code in ('regular','overtime','mixed','manual'));

create unique index if not exists idx_job_session_crew_hours_time_entry_id on public.job_session_crew_hours(time_entry_id) where time_entry_id is not null;

alter table if exists public.site_activity_events drop constraint if exists site_activity_events_type_check;
alter table if exists public.site_activity_events
  add constraint site_activity_events_type_check
  check (
    event_type in (
      'job_created','job_updated','job_session_created','job_session_updated','crew_hours_logged','job_reassignment_created','job_financial_event_created',
      'staff_created','staff_updated','staff_status_changed','staff_deleted',
      'equipment_created','equipment_updated','equipment_deleted',
      'agreement_created','agreement_updated','snow_trigger_created','change_order_created',
      'customer_asset_created','callback_created','payroll_export_created','contract_document_created',
      'order_created','account_login',
      'employee_clock_in','employee_break_started','employee_break_ended','employee_clock_out'
    )
  );

create or replace view public.v_employee_time_entry_break_rollups as
select
  b.time_entry_id,
  count(*)::int as break_count,
  count(*) filter (where b.ended_at is null)::int as open_break_count,
  coalesce(sum(coalesce(b.duration_minutes, 0)), 0)::int as unpaid_break_minutes,
  max(b.started_at) as last_break_started_at,
  max(b.ended_at) as last_break_ended_at
from public.employee_time_entry_breaks b
where coalesce(b.unpaid, true) = true
group by b.time_entry_id;

create or replace view public.v_employee_time_clock_entries as
select
  te.id,
  te.profile_id,
  p.full_name,
  p.employee_number,
  te.crew_id,
  c.crew_name,
  c.crew_code,
  te.job_id,
  j.job_code,
  j.job_name,
  te.site_id,
  s.site_code,
  s.site_name,
  te.job_session_id,
  js.session_date,
  js.session_status,
  te.clock_status,
  te.signed_in_at,
  te.last_status_at,
  te.signed_out_at,
  te.total_elapsed_minutes,
  coalesce(br.unpaid_break_minutes, te.unpaid_break_minutes, 0)::int as unpaid_break_minutes,
  te.paid_work_minutes,
  te.notes,
  te.created_by_profile_id,
  actor.full_name as created_by_name,
  coalesce(br.break_count, 0)::int as break_count,
  coalesce(br.open_break_count, 0)::int as open_break_count,
  br.last_break_started_at,
  br.last_break_ended_at,
  to_char(te.signed_in_at at time zone 'America/Toronto', 'YYYY-MM-DD HH24:MI') as signed_in_at_local,
  to_char(te.signed_out_at at time zone 'America/Toronto', 'YYYY-MM-DD HH24:MI') as signed_out_at_local,
  te.created_at,
  te.updated_at
from public.employee_time_entries te
left join public.profiles p on p.id = te.profile_id
left join public.crews c on c.id = te.crew_id
left join public.jobs j on j.id = te.job_id
left join public.sites s on s.id = te.site_id
left join public.job_sessions js on js.id = te.job_session_id
left join public.profiles actor on actor.id = te.created_by_profile_id
left join public.v_employee_time_entry_break_rollups br on br.time_entry_id = te.id;

create or replace view public.v_employee_time_clock_current as
select *
from public.v_employee_time_clock_entries
where signed_out_at is null and clock_status in ('active','paused');

create or replace view public.v_employee_time_clock_summary as
select
  count(*)::int as total_entry_count,
  count(*) filter (where signed_in_at >= now() - interval '24 hours')::int as last_24h_clock_event_count,
  count(*) filter (where signed_in_at >= now() - interval '24 hours')::int as last_24h_clock_in_count,
  count(*) filter (where signed_out_at >= now() - interval '24 hours')::int as last_24h_clock_out_count,
  count(*) filter (where clock_status = 'paused' and signed_out_at is null)::int as currently_on_break_count,
  count(*) filter (where clock_status = 'active' and signed_out_at is null)::int as currently_clocked_in_count,
  coalesce(sum(case when signed_in_at >= now() - interval '24 hours' then paid_work_minutes else 0 end), 0)::int as last_24h_paid_minutes,
  max(greatest(coalesce(signed_out_at, signed_in_at), signed_in_at)) as last_activity_at
from public.employee_time_entries;



-- 084_supervisor_attendance_review_and_execution_candidates.sql

-- 084_supervisor_attendance_review_and_execution_candidates.sql
-- Adds:
-- - supervisor attendance review for missed clock-out / long-break exceptions
-- - geofence and photo-note capture fields on employee clock in/out
-- - operations dashboard summary cards
-- - recurring agreement execution candidate rules

create extension if not exists pgcrypto;

alter table if exists public.employee_time_entries
  add column if not exists clock_in_latitude numeric(10,7),
  add column if not exists clock_in_longitude numeric(10,7),
  add column if not exists clock_in_accuracy_m numeric(8,2),
  add column if not exists clock_in_geo_source text not null default 'manual',
  add column if not exists clock_in_photo_note text,
  add column if not exists clock_out_latitude numeric(10,7),
  add column if not exists clock_out_longitude numeric(10,7),
  add column if not exists clock_out_accuracy_m numeric(8,2),
  add column if not exists clock_out_geo_source text not null default 'manual',
  add column if not exists clock_out_photo_note text,
  add column if not exists exception_status text not null default 'clear',
  add column if not exists exception_notes text,
  add column if not exists exception_reviewed_at timestamptz,
  add column if not exists exception_reviewed_by_profile_id uuid references public.profiles(id) on delete set null;

alter table if exists public.employee_time_entries drop constraint if exists employee_time_entries_clock_in_geo_source_check;
alter table if exists public.employee_time_entries
  add constraint employee_time_entries_clock_in_geo_source_check
  check (clock_in_geo_source in ('manual','browser_geolocation','admin_override','unknown'));

alter table if exists public.employee_time_entries drop constraint if exists employee_time_entries_clock_out_geo_source_check;
alter table if exists public.employee_time_entries
  add constraint employee_time_entries_clock_out_geo_source_check
  check (clock_out_geo_source in ('manual','browser_geolocation','admin_override','unknown'));

alter table if exists public.employee_time_entries drop constraint if exists employee_time_entries_exception_status_check;
alter table if exists public.employee_time_entries
  add constraint employee_time_entries_exception_status_check
  check (exception_status in ('clear','open','reviewed','resolved','waived'));

create table if not exists public.employee_time_entry_reviews (
  id uuid primary key default gen_random_uuid(),
  time_entry_id uuid not null references public.employee_time_entries(id) on delete cascade,
  review_type text not null default 'attendance_exception',
  exception_type text,
  review_status text not null default 'open',
  reviewed_by_profile_id uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  resolution_notes text,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists public.employee_time_entry_reviews drop constraint if exists employee_time_entry_reviews_type_check;
alter table if exists public.employee_time_entry_reviews
  add constraint employee_time_entry_reviews_type_check
  check (review_type in ('attendance_exception','clock_edit','geofence_review','payroll_review'));

alter table if exists public.employee_time_entry_reviews drop constraint if exists employee_time_entry_reviews_status_check;
alter table if exists public.employee_time_entry_reviews
  add constraint employee_time_entry_reviews_status_check
  check (review_status in ('open','reviewed','resolved','waived'));

create index if not exists idx_employee_time_entry_reviews_entry on public.employee_time_entry_reviews(time_entry_id, created_at desc);

alter table if exists public.site_activity_events drop constraint if exists site_activity_events_type_check;
alter table if exists public.site_activity_events
  add constraint site_activity_events_type_check
  check (
    event_type in (
      'job_created','job_updated','job_session_created','job_session_updated','crew_hours_logged','job_reassignment_created','job_financial_event_created',
      'staff_created','staff_updated','staff_status_changed','staff_deleted',
      'equipment_created','equipment_updated','equipment_deleted',
      'agreement_created','agreement_updated','snow_trigger_created','change_order_created',
      'customer_asset_created','callback_created','payroll_export_created','contract_document_created',
      'order_created','account_login',
      'employee_clock_in','employee_break_started','employee_break_ended','employee_clock_out',
      'attendance_exception_opened','attendance_exception_reviewed','attendance_exception_resolved'
    )
  );

alter table if exists public.recurring_service_agreements
  add column if not exists auto_create_session_candidates boolean not null default true,
  add column if not exists auto_stage_invoice_candidates boolean not null default false,
  add column if not exists execution_lead_days integer not null default 0,
  add column if not exists application_required boolean not null default false,
  add column if not exists default_invoice_source text not null default 'agreement_visit';

alter table if exists public.recurring_service_agreements drop constraint if exists recurring_service_agreements_default_invoice_source_check;
alter table if exists public.recurring_service_agreements
  add constraint recurring_service_agreements_default_invoice_source_check
  check (default_invoice_source in ('agreement_visit','agreement_snow','contract','manual'));

create or replace view public.v_employee_time_clock_entries as
select
  te.id,
  te.profile_id,
  p.full_name,
  p.employee_number,
  te.crew_id,
  c.crew_name,
  c.crew_code,
  te.job_id,
  j.job_code,
  j.job_name,
  te.site_id,
  s.site_code,
  s.site_name,
  te.job_session_id,
  js.session_date,
  js.session_status,
  te.clock_status,
  te.signed_in_at,
  te.last_status_at,
  te.signed_out_at,
  te.total_elapsed_minutes,
  coalesce(br.unpaid_break_minutes, te.unpaid_break_minutes, 0)::int as unpaid_break_minutes,
  te.paid_work_minutes,
  te.clock_in_latitude,
  te.clock_in_longitude,
  te.clock_in_accuracy_m,
  te.clock_in_geo_source,
  te.clock_in_photo_note,
  te.clock_out_latitude,
  te.clock_out_longitude,
  te.clock_out_accuracy_m,
  te.clock_out_geo_source,
  te.clock_out_photo_note,
  te.exception_status,
  te.exception_notes,
  te.exception_reviewed_at,
  te.exception_reviewed_by_profile_id,
  te.notes,
  te.created_by_profile_id,
  actor.full_name as created_by_name,
  coalesce(br.break_count, 0)::int as break_count,
  coalesce(br.open_break_count, 0)::int as open_break_count,
  br.last_break_started_at,
  br.last_break_ended_at,
  to_char(te.signed_in_at at time zone 'America/Toronto', 'YYYY-MM-DD HH24:MI') as signed_in_at_local,
  to_char(te.signed_out_at at time zone 'America/Toronto', 'YYYY-MM-DD HH24:MI') as signed_out_at_local,
  te.created_at,
  te.updated_at
from public.employee_time_entries te
left join public.profiles p on p.id = te.profile_id
left join public.crews c on c.id = te.crew_id
left join public.jobs j on j.id = te.job_id
left join public.sites s on s.id = te.site_id
left join public.job_sessions js on js.id = te.job_session_id
left join public.profiles actor on actor.id = te.created_by_profile_id
left join public.v_employee_time_entry_break_rollups br on br.time_entry_id = te.id;

create or replace view public.v_employee_time_attendance_exceptions as
with latest_review as (
  select distinct on (r.time_entry_id)
    r.time_entry_id,
    r.id as review_id,
    r.review_type,
    r.review_status,
    r.exception_type as reviewed_exception_type,
    r.reviewed_by_profile_id,
    r.reviewed_at,
    r.resolution_notes,
    rp.full_name as reviewed_by_name
  from public.employee_time_entry_reviews r
  left join public.profiles rp on rp.id = r.reviewed_by_profile_id
  order by r.time_entry_id, coalesce(r.reviewed_at, r.updated_at, r.created_at) desc, r.created_at desc
), base as (
  select
    e.*,
    case
      when e.signed_out_at is null and e.clock_status in ('active','paused') and e.signed_in_at <= now() - interval '12 hours' then 'missed_clock_out'
      when e.clock_status = 'paused' and coalesce(e.open_break_count, 0) > 0 and e.last_break_started_at <= now() - interval '45 minutes' then 'long_break'
      when e.signed_out_at is not null and coalesce(e.total_elapsed_minutes, 0) >= 60 and coalesce(e.paid_work_minutes, 0) <= 0 then 'zero_paid_time'
      else null
    end as exception_type,
    case when e.signed_out_at is null then floor(extract(epoch from (now() - e.signed_in_at)) / 60.0)::int else null end as open_minutes,
    case when e.clock_status = 'paused' and e.last_break_started_at is not null then floor(extract(epoch from (now() - e.last_break_started_at)) / 60.0)::int else null end as open_break_minutes_live
  from public.v_employee_time_clock_entries e
)
select
  b.id,
  b.profile_id,
  b.full_name,
  b.employee_number,
  b.crew_id,
  b.crew_name,
  b.job_id,
  b.job_code,
  b.job_name,
  b.site_id,
  b.site_code,
  b.site_name,
  b.job_session_id,
  b.session_date,
  b.session_status,
  b.clock_status,
  b.signed_in_at,
  b.signed_out_at,
  b.total_elapsed_minutes,
  b.unpaid_break_minutes,
  b.paid_work_minutes,
  b.break_count,
  b.open_break_count,
  b.last_break_started_at,
  b.last_break_ended_at,
  b.clock_in_latitude,
  b.clock_in_longitude,
  b.clock_in_accuracy_m,
  b.clock_in_geo_source,
  b.clock_in_photo_note,
  b.clock_out_latitude,
  b.clock_out_longitude,
  b.clock_out_accuracy_m,
  b.clock_out_geo_source,
  b.clock_out_photo_note,
  coalesce(b.exception_type, case when b.exception_status in ('open','reviewed','resolved','waived') then 'manual_review' else null end) as exception_type,
  b.exception_status,
  b.exception_notes,
  b.exception_reviewed_at,
  b.exception_reviewed_by_profile_id,
  b.open_minutes,
  b.open_break_minutes_live,
  lr.review_id,
  lr.review_status as latest_review_status,
  lr.reviewed_exception_type,
  lr.reviewed_by_profile_id,
  lr.reviewed_by_name,
  lr.reviewed_at,
  lr.resolution_notes
from base b
left join latest_review lr on lr.time_entry_id = b.id
where b.exception_type is not null or b.exception_status in ('open','reviewed','resolved','waived');

create or replace view public.v_operations_dashboard_summary as
with active_crews as (
  select count(distinct crew_id)::int as active_crews_on_site_count
  from public.v_employee_time_clock_current
  where crew_id is not null
), active_staff as (
  select count(*)::int as active_staff_on_site_count
  from public.v_employee_time_clock_current
), attendance as (
  select
    count(*) filter (where exception_type = 'missed_clock_out')::int as overdue_sign_out_count,
    count(*) filter (where exception_type = 'long_break')::int as long_break_exception_count,
    count(*) filter (where coalesce(latest_review_status, exception_status, 'open') in ('open','reviewed') )::int as open_attendance_exception_count
  from public.v_employee_time_attendance_exceptions
), unsigned_sessions as (
  select count(*)::int as unsigned_session_job_count
  from public.v_job_financial_rollups
  where coalesce(unsigned_session_count, 0) > 0
), delayed as (
  select count(*)::int as delayed_job_count
  from public.jobs
  where coalesce(delayed_schedule, false) = true
), losses as (
  select count(*)::int as loss_making_job_count
  from public.v_job_financial_rollups
  where coalesce(actual_profit_rollup_total, 0) < 0
)
select
  ac.active_crews_on_site_count,
  ast.active_staff_on_site_count,
  atd.overdue_sign_out_count,
  atd.long_break_exception_count,
  atd.open_attendance_exception_count,
  us.unsigned_session_job_count,
  d.delayed_job_count,
  l.loss_making_job_count
from active_crews ac
cross join active_staff ast
cross join attendance atd
cross join unsigned_sessions us
cross join delayed d
cross join losses l;

create or replace view public.v_service_agreement_execution_candidates as
with active_agreements as (
  select
    a.*,
    greatest(current_date, coalesce(a.start_date, current_date)) as candidate_date
  from public.recurring_service_agreements a
  where a.agreement_status = 'active'
    and coalesce(a.start_date, current_date) <= current_date
    and (coalesce(a.open_end_date, false) = true or a.end_date is null or a.end_date >= current_date)
), visit_candidates as (
  select
    a.id,
    a.agreement_code,
    a.service_name,
    a.client_id,
    a.client_site_id,
    a.route_id,
    a.crew_id,
    'service_session'::text as candidate_kind,
    a.default_invoice_source as invoice_source,
    a.candidate_date,
    a.visit_charge_total,
    a.visit_cost_total,
    null::uuid as snow_event_trigger_id,
    'Active agreement is due for service execution review.'::text as candidate_reason
  from active_agreements a
  where coalesce(a.auto_create_session_candidates, false) = true
), invoice_candidates as (
  select
    a.id,
    a.agreement_code,
    a.service_name,
    a.client_id,
    a.client_site_id,
    a.route_id,
    a.crew_id,
    'visit_invoice'::text as candidate_kind,
    a.default_invoice_source as invoice_source,
    a.candidate_date,
    a.visit_charge_total,
    a.visit_cost_total,
    null::uuid as snow_event_trigger_id,
    'Agreement allows invoice candidate staging for the next visit.'::text as candidate_reason
  from active_agreements a
  where coalesce(a.auto_stage_invoice_candidates, false) = true
    and coalesce(a.default_invoice_source, 'agreement_visit') = 'agreement_visit'
), snow_candidates as (
  select
    a.id,
    a.agreement_code,
    a.service_name,
    a.client_id,
    a.client_site_id,
    a.route_id,
    a.crew_id,
    'snow_invoice'::text as candidate_kind,
    'agreement_snow'::text as invoice_source,
    st.event_date as candidate_date,
    a.visit_charge_total,
    a.visit_cost_total,
    st.id as snow_event_trigger_id,
    'Triggered snow event is ready for invoice candidate staging.'::text as candidate_reason
  from active_agreements a
  join public.snow_event_triggers st on st.agreement_id = a.id
  left join public.ar_invoices ai on ai.snow_event_trigger_id = st.id
  where coalesce(a.auto_stage_invoice_candidates, false) = true
    and st.trigger_met = true
    and ai.id is null
)
select * from visit_candidates
union all
select * from invoice_candidates
union all
select * from snow_candidates;


-- 085_attendance_photo_geofence_scheduler_and_signed_contract_invoice.sql

-- 085_attendance_photo_geofence_scheduler_and_signed_contract_invoice.sql
-- Adds:
-- - attendance photo storage metadata and geofence accuracy/source fields
-- - provider-specific payroll export layouts
-- - signed-contract invoice generation support
-- - scheduler-driven service execution runs and candidate views

create extension if not exists pgcrypto;

-- ------------------------------------------------------------
-- Employee time entry photo + geofence storage/capture fields
-- ------------------------------------------------------------
alter table if exists public.employee_time_entries
  add column if not exists clock_in_accuracy_m numeric(8,2),
  add column if not exists clock_in_geo_source text not null default 'manual',
  add column if not exists clock_out_accuracy_m numeric(8,2),
  add column if not exists clock_out_geo_source text not null default 'manual',
  add column if not exists clock_in_photo_bucket text,
  add column if not exists clock_in_photo_path text,
  add column if not exists clock_out_photo_bucket text,
  add column if not exists clock_out_photo_path text,
  add column if not exists clock_in_photo_uploaded_at timestamptz,
  add column if not exists clock_out_photo_uploaded_at timestamptz;

alter table if exists public.employee_time_entries drop constraint if exists employee_time_entries_clock_in_geo_source_check;
alter table if exists public.employee_time_entries
  add constraint employee_time_entries_clock_in_geo_source_check
  check (clock_in_geo_source in ('manual','browser_geolocation','admin_override','unknown'));

alter table if exists public.employee_time_entries drop constraint if exists employee_time_entries_clock_out_geo_source_check;
alter table if exists public.employee_time_entries
  add constraint employee_time_entries_clock_out_geo_source_check
  check (clock_out_geo_source in ('manual','browser_geolocation','admin_override','unknown'));


alter table if exists public.employee_time_entries
  add column if not exists exception_status text not null default 'clear',
  add column if not exists exception_notes text,
  add column if not exists exception_reviewed_at timestamptz,
  add column if not exists exception_reviewed_by_profile_id uuid references public.profiles(id) on delete set null;

alter table if exists public.employee_time_entries drop constraint if exists employee_time_entries_exception_status_check;
alter table if exists public.employee_time_entries
  add constraint employee_time_entries_exception_status_check
  check (exception_status in ('clear','open','reviewed','resolved','waived'));

create table if not exists public.employee_time_entry_reviews (
  id uuid primary key default gen_random_uuid(),
  time_entry_id uuid not null references public.employee_time_entries(id) on delete cascade,
  review_type text not null default 'attendance_exception',
  exception_type text,
  review_status text not null default 'open',
  reviewed_by_profile_id uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  resolution_notes text,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists public.employee_time_entry_reviews drop constraint if exists employee_time_entry_reviews_type_check;
alter table if exists public.employee_time_entry_reviews
  add constraint employee_time_entry_reviews_type_check
  check (review_type in ('attendance_exception','clock_edit','geofence_review','payroll_review'));

alter table if exists public.employee_time_entry_reviews drop constraint if exists employee_time_entry_reviews_status_check;
alter table if exists public.employee_time_entry_reviews
  add constraint employee_time_entry_reviews_status_check
  check (review_status in ('open','reviewed','resolved','waived'));

create index if not exists idx_employee_time_entry_reviews_entry on public.employee_time_entry_reviews(time_entry_id, created_at desc);

-- ------------------------------------------------------------
-- Payroll export provider options
-- ------------------------------------------------------------
alter table if exists public.payroll_export_runs
  add column if not exists export_provider text not null default 'generic_csv',
  add column if not exists export_mime_type text,
  add column if not exists export_layout_version text;

alter table if exists public.payroll_export_runs drop constraint if exists payroll_export_runs_export_provider_check;
alter table if exists public.payroll_export_runs
  add constraint payroll_export_runs_export_provider_check
  check (export_provider in ('generic_csv','quickbooks_time_csv','simplepay_csv','adp_csv','json'));

-- ------------------------------------------------------------
-- Signed contract / application metadata and invoice linkage
-- ------------------------------------------------------------
alter table if exists public.service_contract_documents
  add column if not exists issued_at timestamptz,
  add column if not exists signed_at timestamptz,
  add column if not exists signed_by_name text,
  add column if not exists signed_by_title text,
  add column if not exists signed_by_email text,
  add column if not exists signed_document_bucket text,
  add column if not exists signed_document_path text,
  add column if not exists signed_document_url text,
  add column if not exists application_submitted_at timestamptz,
  add column if not exists linked_invoice_id uuid references public.ar_invoices(id) on delete set null,
  add column if not exists invoice_generated_at timestamptz;

create index if not exists idx_service_contract_documents_signed_at on public.service_contract_documents(signed_at desc);
create index if not exists idx_service_contract_documents_linked_invoice_id on public.service_contract_documents(linked_invoice_id);

alter table if exists public.recurring_service_agreements
  add column if not exists last_scheduler_run_at timestamptz;

-- ------------------------------------------------------------
-- Scheduler runs
-- ------------------------------------------------------------
create table if not exists public.service_execution_scheduler_runs (
  id uuid primary key default gen_random_uuid(),
  run_code text not null unique,
  run_mode text not null default 'manual',
  run_status text not null default 'completed',
  agreement_id uuid references public.recurring_service_agreements(id) on delete set null,
  candidate_count integer not null default 0,
  session_created_count integer not null default 0,
  invoice_candidate_count integer not null default 0,
  skipped_count integer not null default 0,
  run_notes text,
  payload jsonb not null default '{}'::jsonb,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists public.service_execution_scheduler_runs drop constraint if exists service_execution_scheduler_runs_mode_check;
alter table if exists public.service_execution_scheduler_runs
  add constraint service_execution_scheduler_runs_mode_check
  check (run_mode in ('manual','scheduled','admin_trigger','agreement_trigger'));

alter table if exists public.service_execution_scheduler_runs drop constraint if exists service_execution_scheduler_runs_status_check;
alter table if exists public.service_execution_scheduler_runs
  add constraint service_execution_scheduler_runs_status_check
  check (run_status in ('queued','running','completed','partial','failed'));

create index if not exists idx_service_execution_scheduler_runs_created_at on public.service_execution_scheduler_runs(created_at desc);
create index if not exists idx_service_execution_scheduler_runs_agreement_id on public.service_execution_scheduler_runs(agreement_id, created_at desc);

-- ------------------------------------------------------------
-- Extend activity event types
-- ------------------------------------------------------------
alter table if exists public.site_activity_events drop constraint if exists site_activity_events_type_check;
alter table if exists public.site_activity_events
  add constraint site_activity_events_type_check
  check (
    event_type in (
      'job_created','job_updated','job_session_created','job_session_updated','crew_hours_logged','job_reassignment_created','job_financial_event_created',
      'staff_created','staff_updated','staff_status_changed','staff_deleted',
      'equipment_created','equipment_updated','equipment_deleted',
      'agreement_created','agreement_updated','snow_trigger_created','change_order_created',
      'customer_asset_created','callback_created','payroll_export_created','contract_document_created',
      'order_created','account_login',
      'employee_clock_in','employee_break_started','employee_break_ended','employee_clock_out',
      'attendance_exception_opened','attendance_exception_reviewed','attendance_exception_resolved',
      'employee_time_photo_uploaded','service_execution_candidate','service_invoice_candidate',
      'service_execution_scheduler_run','signed_contract_invoice_generated'
    )
  );

-- ------------------------------------------------------------
-- Preserve existing view column order, append new columns only
-- ------------------------------------------------------------
create or replace view public.v_employee_time_clock_entries as
with open_break as (
  select
    b.time_entry_id,
    max(b.started_at) filter (where b.ended_at is null and coalesce(b.unpaid, true) = true) as current_break_started_at
  from public.employee_time_entry_breaks b
  group by b.time_entry_id
)
select
  te.id,
  te.profile_id,
  p.full_name,
  p.employee_number,
  te.crew_id,
  c.crew_name,
  c.crew_code,
  te.job_id,
  j.job_code,
  j.job_name,
  te.site_id,
  s.site_code,
  s.site_name,
  te.job_session_id,
  js.session_date,
  js.session_status,
  te.clock_status,
  te.signed_in_at,
  te.last_status_at,
  te.signed_out_at,
  te.total_elapsed_minutes,
  coalesce(br.unpaid_break_minutes, te.unpaid_break_minutes, 0)::int as unpaid_break_minutes,
  te.paid_work_minutes,
  te.notes,
  te.created_by_profile_id,
  actor.full_name as created_by_name,
  coalesce(br.break_count, 0)::int as break_count,
  coalesce(br.open_break_count, 0)::int as open_break_count,
  br.last_break_started_at,
  br.last_break_ended_at,
  to_char(te.signed_in_at at time zone 'America/Toronto', 'YYYY-MM-DD HH24:MI') as signed_in_at_local,
  to_char(te.signed_out_at at time zone 'America/Toronto', 'YYYY-MM-DD HH24:MI') as signed_out_at_local,
  te.created_at,
  te.updated_at,
  te.clock_in_latitude,
  te.clock_in_longitude,
  te.clock_out_latitude,
  te.clock_out_longitude,
  te.clock_in_photo_note,
  te.clock_out_photo_note,
  te.clock_in_photo_url,
  te.clock_out_photo_url,
  te.clock_in_geofence_status,
  te.clock_out_geofence_status,
  te.clock_in_geofence_distance_meters,
  te.clock_out_geofence_distance_meters,
  te.attendance_exception_notes,
  s.expected_latitude as site_expected_latitude,
  s.expected_longitude as site_expected_longitude,
  s.geofence_radius_meters,
  case when te.clock_in_latitude is not null and te.clock_in_longitude is not null then true else false end as has_clock_in_location,
  case when te.clock_out_latitude is not null and te.clock_out_longitude is not null then true else false end as has_clock_out_location,
  case
    when te.signed_out_at is null and te.signed_in_at < now() - interval '12 hours' then true
    else false
  end as currently_overdue_sign_out,
  case
    when ob.current_break_started_at is not null
      then greatest(floor(extract(epoch from (now() - ob.current_break_started_at)) / 60.0), 0)::int
    else 0
  end as active_break_minutes,
  case
    when ob.current_break_started_at is not null and ob.current_break_started_at < now() - interval '45 minutes' then true
    when coalesce(br.unpaid_break_minutes, te.unpaid_break_minutes, 0) >= 90 then true
    else false
  end as long_break_exception_flag,
  te.clock_in_accuracy_m,
  te.clock_in_geo_source,
  te.clock_out_accuracy_m,
  te.clock_out_geo_source,
  te.clock_in_photo_bucket,
  te.clock_in_photo_path,
  te.clock_out_photo_bucket,
  te.clock_out_photo_path,
  te.clock_in_photo_uploaded_at,
  te.clock_out_photo_uploaded_at,
  case when te.clock_in_photo_path is not null or te.clock_in_photo_url is not null then true else false end as has_clock_in_photo,
  case when te.clock_out_photo_path is not null or te.clock_out_photo_url is not null then true else false end as has_clock_out_photo
from public.employee_time_entries te
left join public.profiles p on p.id = te.profile_id
left join public.crews c on c.id = te.crew_id
left join public.jobs j on j.id = te.job_id
left join public.sites s on s.id = te.site_id
left join public.job_sessions js on js.id = te.job_session_id
left join public.profiles actor on actor.id = te.created_by_profile_id
left join public.v_employee_time_entry_break_rollups br on br.time_entry_id = te.id
left join open_break ob on ob.time_entry_id = te.id;

create or replace view public.v_employee_time_clock_summary as
select
  count(*)::int as total_entry_count,
  count(*) filter (where signed_in_at >= now() - interval '24 hours')::int as last_24h_clock_event_count,
  count(*) filter (where signed_in_at >= now() - interval '24 hours')::int as last_24h_clock_in_count,
  count(*) filter (where signed_out_at >= now() - interval '24 hours')::int as last_24h_clock_out_count,
  count(*) filter (where clock_status = 'paused' and signed_out_at is null)::int as currently_on_break_count,
  count(*) filter (where clock_status = 'active' and signed_out_at is null)::int as currently_clocked_in_count,
  coalesce(sum(case when signed_in_at >= now() - interval '24 hours' then paid_work_minutes else 0 end), 0)::int as last_24h_paid_minutes,
  max(greatest(coalesce(signed_out_at, signed_in_at), signed_in_at)) as last_activity_at,
  count(distinct crew_id) filter (where signed_out_at is null and clock_status in ('active','paused') and crew_id is not null)::int as active_crew_count,
  count(distinct site_id) filter (where signed_out_at is null and clock_status in ('active','paused') and site_id is not null)::int as active_site_count,
  count(*) filter (where signed_out_at is null and signed_in_at < now() - interval '12 hours')::int as overdue_sign_out_count,
  count(*) filter (where long_break_exception_flag = true)::int as long_break_exception_count,
  count(*) filter (
    where (signed_out_at is null and signed_in_at < now() - interval '12 hours')
       or long_break_exception_flag = true
       or (signed_out_at is not null and coalesce(paid_work_minutes, 0) <= 0)
  )::int as attendance_exception_count,
  count(*) filter (where clock_in_geofence_status = 'outside' or clock_out_geofence_status = 'outside')::int as geofence_exception_count,
  count(*) filter (where has_clock_in_photo or has_clock_out_photo)::int as entry_with_photo_count
from public.v_employee_time_clock_entries;

-- ------------------------------------------------------------
-- Scheduler / invoice candidate views
-- ------------------------------------------------------------
create or replace view public.v_service_execution_scheduler_candidates as
with candidate_jobs as (
  select
    c.*, 
    j.id as job_id,
    j.job_code,
    j.job_name,
    j.status as job_status
  from public.v_service_agreement_execution_candidates c
  left join public.jobs j
    on upper(coalesce(j.service_contract_reference, '')) = upper(coalesce(c.agreement_code, ''))
)
select
  cj.agreement_id,
  cj.agreement_code,
  cj.service_name,
  cj.candidate_kind,
  cj.invoice_source,
  cj.candidate_date,
  cj.candidate_reason,
  cj.client_id,
  cj.client_site_id,
  cj.route_id,
  cj.crew_id,
  cj.job_id,
  cj.job_code,
  cj.job_name,
  cj.job_status,
  cj.visit_charge_total,
  cj.visit_cost_total,
  cj.snow_event_trigger_id,
  case when cj.job_id is null then 'no_linked_job'
       when exists (
         select 1 from public.job_sessions js
         where js.job_id = cj.job_id
           and js.session_date = cj.candidate_date
       ) then 'session_exists'
       else 'ready'
  end as scheduler_status
from candidate_jobs cj;

create or replace view public.v_signed_contract_invoice_candidates as
select
  d.id as contract_document_id,
  d.document_number,
  d.title,
  d.client_id,
  d.client_site_id,
  d.agreement_id,
  d.estimate_id,
  d.job_id,
  d.signed_at,
  d.signed_by_name,
  d.document_status,
  d.linked_invoice_id,
  a.agreement_code,
  a.service_name,
  a.tax_code_id,
  coalesce(a.visit_charge_total, e.total_amount, 0)::numeric(12,2) as candidate_subtotal,
  case
    when d.document_status = 'signed' or d.signed_at is not null then true
    else false
  end as is_signed_ready,
  case
    when d.linked_invoice_id is not null then 'already_invoiced'
    when d.document_status = 'signed' or d.signed_at is not null then 'ready'
    else 'not_signed'
  end as invoice_candidate_status
from public.service_contract_documents d
left join public.recurring_service_agreements a on a.id = d.agreement_id
left join public.estimates e on e.id = d.estimate_id;

create or replace view public.v_service_execution_scheduler_summary as
select
  count(*)::int as total_candidate_count,
  count(*) filter (where scheduler_status = 'ready')::int as ready_candidate_count,
  count(*) filter (where scheduler_status = 'session_exists')::int as session_exists_count,
  count(*) filter (where scheduler_status = 'no_linked_job')::int as no_linked_job_count,
  count(*) filter (where candidate_kind = 'service_session')::int as session_candidate_count,
  count(*) filter (where candidate_kind in ('visit_invoice','snow_invoice'))::int as invoice_candidate_count
from public.v_service_execution_scheduler_candidates;
