-- Last synchronized: April 15, 2026. Reviewed during the job session, crew-hour, and reassignment workflow pass.
-- Current reference remains aligned through 079_job_financial_rollups_and_profit_review.sql.

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

