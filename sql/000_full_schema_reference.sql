-- Last synchronized: April 22, 2026. Reviewed during the portable scheduler, workflow-guardrail, and repo-alignment pass.
-- Current reference remains aligned through 088_scheduler_cron_media_review_payroll_close_receipts.sql.

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


-- 086_hseops_performance_and_site_activity_rollups.sql
-- Adds lightweight site-activity rollup views for admin/HSE monitoring while
-- the HSE Operations page moves to a reduced selector payload for better runtime performance.

create or replace view public.v_site_activity_type_rollups as
select
  event_type,
  entity_type,
  count(*)::int as total_event_count,
  count(*) filter (where occurred_at >= now() - interval '24 hours')::int as last_24h_event_count,
  count(*) filter (where severity in ('warning','error') and occurred_at >= now() - interval '24 hours')::int as last_24h_attention_count,
  max(occurred_at) as last_activity_at
from public.site_activity_events
group by event_type, entity_type;

create or replace view public.v_site_activity_entity_rollups as
select
  entity_type,
  count(*)::int as total_event_count,
  count(*) filter (where occurred_at >= now() - interval '24 hours')::int as last_24h_event_count,
  count(*) filter (where severity in ('warning','error') and occurred_at >= now() - interval '24 hours')::int as last_24h_attention_count,
  max(occurred_at) as last_activity_at
from public.site_activity_events
group by entity_type;

-- 087_evidence_review_scheduler_settings_and_signed_contract_kickoff.sql
-- Adds:
-- - Admin-visible attendance / HSE evidence review views
-- - scheduler settings/status for service execution automation
-- - signed-contract kickoff candidates for live jobs
-- - payroll close review summaries for provider-ready delivery

create table if not exists public.service_execution_scheduler_settings (
  id uuid primary key default gen_random_uuid(),
  setting_code text not null unique,
  is_enabled boolean not null default false,
  run_timezone text not null default 'America/Toronto',
  cadence text not null default 'daily',
  run_hour_local integer not null default 4,
  run_minute_local integer not null default 0,
  lookahead_days integer not null default 1,
  auto_create_sessions boolean not null default true,
  auto_stage_invoices boolean not null default true,
  require_linked_job boolean not null default true,
  last_run_at timestamptz,
  next_run_at timestamptz,
  notes text,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists public.service_execution_scheduler_settings
  drop constraint if exists service_execution_scheduler_settings_cadence_check;

alter table if exists public.service_execution_scheduler_settings
  add constraint service_execution_scheduler_settings_cadence_check
  check (cadence in ('manual','hourly','daily','weekly'));

alter table if exists public.service_execution_scheduler_settings
  drop constraint if exists service_execution_scheduler_settings_run_hour_check;

alter table if exists public.service_execution_scheduler_settings
  add constraint service_execution_scheduler_settings_run_hour_check
  check (run_hour_local between 0 and 23);

alter table if exists public.service_execution_scheduler_settings
  drop constraint if exists service_execution_scheduler_settings_run_minute_check;

alter table if exists public.service_execution_scheduler_settings
  add constraint service_execution_scheduler_settings_run_minute_check
  check (run_minute_local between 0 and 59);

alter table if exists public.service_execution_scheduler_settings
  drop constraint if exists service_execution_scheduler_settings_lookahead_days_check;

alter table if exists public.service_execution_scheduler_settings
  add constraint service_execution_scheduler_settings_lookahead_days_check
  check (lookahead_days between 0 and 14);

create index if not exists idx_service_execution_scheduler_settings_enabled
  on public.service_execution_scheduler_settings(is_enabled, next_run_at);

insert into public.service_execution_scheduler_settings (
  setting_code,
  is_enabled,
  run_timezone,
  cadence,
  run_hour_local,
  run_minute_local,
  lookahead_days,
  auto_create_sessions,
  auto_stage_invoices,
  require_linked_job,
  next_run_at,
  notes
)
select
  'default',
  false,
  'America/Toronto',
  'daily',
  4,
  0,
  1,
  true,
  true,
  true,
  null,
  'Default scheduler settings row for service execution automation.'
where not exists (
  select 1 from public.service_execution_scheduler_settings where setting_code = 'default'
);

create or replace view public.v_service_execution_scheduler_status as
with latest_run as (
  select distinct on (coalesce(agreement_id::text, 'ALL'))
    coalesce(agreement_id::text, 'ALL') as agreement_key,
    id,
    agreement_id,
    run_code,
    run_mode,
    run_status,
    candidate_count,
    session_created_count,
    invoice_candidate_count,
    skipped_count,
    created_at,
    updated_at
  from public.service_execution_scheduler_runs
  order by coalesce(agreement_id::text, 'ALL'), created_at desc
)
select
  s.id,
  s.setting_code,
  s.is_enabled,
  s.run_timezone,
  s.cadence,
  s.run_hour_local,
  s.run_minute_local,
  s.lookahead_days,
  s.auto_create_sessions,
  s.auto_stage_invoices,
  s.require_linked_job,
  s.last_run_at,
  s.next_run_at,
  s.notes,
  lr.id as latest_run_id,
  lr.run_code as latest_run_code,
  lr.run_mode as latest_run_mode,
  lr.run_status as latest_run_status,
  lr.candidate_count as latest_candidate_count,
  lr.session_created_count as latest_session_created_count,
  lr.invoice_candidate_count as latest_invoice_candidate_count,
  lr.skipped_count as latest_skipped_count,
  lr.created_at as latest_run_created_at,
  case
    when s.is_enabled = true and s.next_run_at is not null and s.next_run_at <= now() then true
    else false
  end as is_due,
  s.invoke_url,
  s.last_dispatch_at,
  s.last_dispatch_request_id,
  s.last_dispatch_status,
  s.last_dispatch_notes
from public.service_execution_scheduler_settings s
left join latest_run lr on lr.agreement_key = 'ALL';

create or replace view public.v_attendance_photo_review as
select
  e.id as time_entry_id,
  e.profile_id,
  e.full_name,
  e.employee_number,
  e.job_id,
  e.job_code,
  e.job_name,
  e.site_id,
  e.site_name,
  'clock_in'::text as photo_stage,
  e.clock_in_photo_url as photo_url,
  e.clock_in_photo_note as photo_note,
  e.clock_in_photo_bucket as storage_bucket,
  e.clock_in_photo_path as storage_path,
  e.clock_in_photo_uploaded_at as uploaded_at,
  e.clock_in_geofence_status as geofence_status,
  e.clock_in_geofence_distance_meters as geofence_distance_meters,
  e.currently_overdue_sign_out,
  e.long_break_exception_flag,
  e.attendance_exception_notes,
  e.signed_in_at,
  e.signed_out_at
from public.v_employee_time_clock_entries e
where e.has_clock_in_photo = true

union all

select
  e.id as time_entry_id,
  e.profile_id,
  e.full_name,
  e.employee_number,
  e.job_id,
  e.job_code,
  e.job_name,
  e.site_id,
  e.site_name,
  'clock_out'::text as photo_stage,
  e.clock_out_photo_url as photo_url,
  e.clock_out_photo_note as photo_note,
  e.clock_out_photo_bucket as storage_bucket,
  e.clock_out_photo_path as storage_path,
  e.clock_out_photo_uploaded_at as uploaded_at,
  e.clock_out_geofence_status as geofence_status,
  e.clock_out_geofence_distance_meters as geofence_distance_meters,
  e.currently_overdue_sign_out,
  e.long_break_exception_flag,
  e.attendance_exception_notes,
  e.signed_in_at,
  e.signed_out_at
from public.v_employee_time_clock_entries e
where e.has_clock_out_photo = true;

create or replace view public.v_hse_evidence_review as
select
  p.id as proof_id,
  p.packet_id,
  hp.packet_number,
  hp.packet_type,
  hp.packet_status,
  p.proof_stage,
  p.proof_kind,
  p.public_url,
  p.storage_bucket,
  p.storage_path,
  p.file_name,
  p.mime_type,
  p.caption,
  p.proof_notes,
  p.uploaded_by_profile_id,
  pr.full_name as uploaded_by_name,
  p.created_at,
  p.updated_at
from public.hse_packet_proofs p
left join public.linked_hse_packets hp on hp.id = p.packet_id
left join public.profiles pr on pr.id = p.uploaded_by_profile_id;

create or replace view public.v_signed_contract_job_kickoff_candidates as
with linked_jobs as (
  select
    d.id as contract_document_id,
    min(j.id) as linked_job_id
  from public.service_contract_documents d
  left join public.recurring_service_agreements a on a.id = d.agreement_id
  left join public.jobs j
    on upper(coalesce(j.service_contract_reference, '')) = upper(coalesce(a.agreement_code, d.contract_reference, ''))
  group by d.id
)
select
  d.id as contract_document_id,
  d.document_number,
  d.document_kind,
  d.document_status,
  d.title,
  d.contract_reference,
  d.signed_at,
  d.signed_by_name,
  d.client_id,
  d.client_site_id,
  d.agreement_id,
  d.estimate_id,
  d.job_id as direct_job_id,
  lj.linked_job_id,
  a.agreement_code,
  a.service_name,
  a.route_id,
  a.crew_id,
  a.tax_code_id,
  coalesce(a.visit_cost_total, e.subtotal, 0)::numeric(12,2) as estimated_cost_total,
  coalesce(a.visit_charge_total, e.total_amount, 0)::numeric(12,2) as quoted_charge_total,
  case
    when d.document_status = 'signed' or d.signed_at is not null then true
    else false
  end as is_signed_ready,
  case
    when coalesce(d.job_id::text, '') <> '' or coalesce(lj.linked_job_id::text, '') <> '' then 'linked_job_exists'
    when d.document_status = 'signed' or d.signed_at is not null then 'ready'
    else 'not_signed'
  end as kickoff_status,
  concat('JOB-', regexp_replace(coalesce(a.agreement_code, d.document_number, d.contract_reference, d.id::text), '[^A-Za-z0-9]+', '-', 'g')) as suggested_job_code,
  coalesce(a.service_name, d.title, 'Signed Contract Job') as suggested_job_name,
  concat('WO-', regexp_replace(coalesce(a.agreement_code, d.document_number, d.contract_reference, d.id::text), '[^A-Za-z0-9]+', '-', 'g')) as suggested_work_order_number,
  greatest(current_date, coalesce(a.start_date, current_date))::date as suggested_first_session_date,
  coalesce(a.visit_estimated_duration_hours, 0)::numeric(10,2) as suggested_first_session_hours
from public.service_contract_documents d
left join public.recurring_service_agreements a on a.id = d.agreement_id
left join public.estimates e on e.id = d.estimate_id
left join linked_jobs lj on lj.contract_document_id = d.id
where d.document_kind in ('contract','application');

create or replace view public.v_payroll_close_review_summary as
with export_rollup as (
  select
    count(*)::int as export_run_count,
    count(*) filter (where coalesce(status, '') <> 'exported')::int as open_export_run_count,
    count(*) filter (where coalesce(delivery_status, 'pending') = 'pending')::int as delivery_pending_count,
    count(*) filter (where coalesce(delivery_status, '') in ('delivered','confirmed'))::int as delivery_recorded_count,
    count(*) filter (where coalesce(delivery_status, '') = 'confirmed')::int as delivery_confirmed_count,
    count(*) filter (where coalesce(payroll_close_status, 'open') = 'ready_to_close')::int as ready_to_close_count,
    count(*) filter (where coalesce(payroll_close_status, 'open') = 'closed')::int as closed_run_count,
    max(exported_at) as last_exported_at,
    max(delivery_confirmed_at) as last_delivery_confirmed_at,
    max(payroll_closed_at) as last_payroll_closed_at,
    coalesce(sum(coalesce(exported_entry_count, 0)), 0)::int as exported_entry_count_total,
    coalesce(sum(coalesce(exported_hours_total, 0)), 0)::numeric(10,2) as exported_hours_total,
    coalesce(sum(coalesce(exported_payroll_cost_total, 0)), 0)::numeric(12,2) as exported_payroll_cost_total
  from public.payroll_export_runs
), attendance_rollup as (
  select
    coalesce(sum(unexported_entry_count), 0)::int as unexported_entry_count,
    coalesce(sum(unexported_hours_total), 0)::numeric(10,2) as unexported_hours_total,
    coalesce(sum(unexported_payroll_cost_total), 0)::numeric(12,2) as unexported_payroll_cost_total
  from public.v_payroll_review_summary
), review_rollup as (
  select
    count(*) filter (where needs_review = true)::int as attendance_review_needed_count
  from public.v_employee_time_review_queue
), clock_rollup as (
  select
    coalesce(overdue_sign_out_count, 0)::int as overdue_sign_out_count,
    coalesce(attendance_exception_count, 0)::int as attendance_exception_count
  from public.v_employee_time_clock_summary
)
select
  er.export_run_count,
  er.open_export_run_count,
  er.last_exported_at,
  er.exported_entry_count_total,
  er.exported_hours_total,
  er.exported_payroll_cost_total,
  ar.unexported_entry_count,
  ar.unexported_hours_total,
  ar.unexported_payroll_cost_total,
  rr.attendance_review_needed_count,
  cr.overdue_sign_out_count,
  cr.attendance_exception_count,
  er.delivery_pending_count,
  er.delivery_recorded_count,
  er.delivery_confirmed_count,
  er.ready_to_close_count,
  er.closed_run_count,
  er.last_delivery_confirmed_at,
  er.last_payroll_closed_at
from export_rollup er
cross join attendance_rollup ar
cross join review_rollup rr
cross join clock_rollup cr;


-- 088_scheduler_cron_media_review_payroll_close_receipts.sql
-- Adds:
-- - cron/dispatch plumbing for service execution scheduler settings
-- - richer media review actions for attendance and HSE evidence
-- - payroll export delivery confirmation and payroll-close signoff fields
-- - stronger signed-contract kickoff suggestions for first planned session timing

create extension if not exists pg_net;
create extension if not exists pg_cron;

create table if not exists public.media_review_actions (
  id uuid primary key default gen_random_uuid(),
  target_entity text not null,
  target_id uuid not null,
  media_stage text not null default 'evidence',
  review_status text not null default 'pending',
  review_notes text,
  reviewed_at timestamptz,
  reviewed_by_profile_id uuid references public.profiles(id) on delete set null,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (target_entity, target_id, media_stage)
);

alter table if exists public.media_review_actions
  drop constraint if exists media_review_actions_target_entity_check;

alter table if exists public.media_review_actions
  add constraint media_review_actions_target_entity_check
  check (target_entity in ('employee_time_entry','hse_packet_proof'));

alter table if exists public.media_review_actions
  drop constraint if exists media_review_actions_review_status_check;

alter table if exists public.media_review_actions
  add constraint media_review_actions_review_status_check
  check (review_status in ('pending','approved','rejected','follow_up'));

create index if not exists idx_media_review_actions_target
  on public.media_review_actions(target_entity, target_id, media_stage, reviewed_at desc, created_at desc);

alter table if exists public.service_execution_scheduler_settings
  add column if not exists invoke_url text,
  add column if not exists last_dispatch_at timestamptz,
  add column if not exists last_dispatch_request_id bigint,
  add column if not exists last_dispatch_status text,
  add column if not exists last_dispatch_notes text;

alter table if exists public.service_execution_scheduler_settings
  drop constraint if exists service_execution_scheduler_settings_last_dispatch_status_check;

alter table if exists public.service_execution_scheduler_settings
  add constraint service_execution_scheduler_settings_last_dispatch_status_check
  check (last_dispatch_status in ('queued','completed','failed') or last_dispatch_status is null);

create or replace function public.compute_service_execution_scheduler_next_run_at(
  p_run_timezone text,
  p_cadence text,
  p_run_hour_local integer,
  p_run_minute_local integer,
  p_base timestamptz default now()
)
returns timestamptz
language sql
stable
as $$
with args as (
  select
    coalesce(nullif(trim(p_run_timezone), ''), 'America/Toronto') as tz,
    lower(coalesce(nullif(trim(p_cadence), ''), 'manual')) as cadence,
    greatest(0, least(coalesce(p_run_hour_local, 0), 23)) as run_hour_local,
    greatest(0, least(coalesce(p_run_minute_local, 0), 59)) as run_minute_local,
    coalesce(p_base, now()) as base_ts
), local_clock as (
  select
    tz,
    cadence,
    run_hour_local,
    run_minute_local,
    base_ts,
    (base_ts at time zone tz) as local_now
  from args
), local_targets as (
  select
    tz,
    cadence,
    local_now,
    (date_trunc('day', local_now)
      + make_interval(hours => run_hour_local, mins => run_minute_local)) as scheduled_local_today,
    date_trunc('hour', local_now) + interval '1 hour' as next_hour_local
  from local_clock
)
select case
  when cadence = 'manual' then null
  when cadence = 'hourly' then next_hour_local at time zone tz
  when cadence = 'weekly' then (case when scheduled_local_today > local_now then scheduled_local_today else scheduled_local_today + interval '7 days' end) at time zone tz
  else (case when scheduled_local_today > local_now then scheduled_local_today else scheduled_local_today + interval '1 day' end) at time zone tz
end
from local_targets;
$$;

create or replace function public.dispatch_due_service_execution_scheduler_runs()
returns integer
language plpgsql
security definer
as $$
declare
  v_secret text := null;
  v_dispatched integer := 0;
  v_request_id bigint;
  r record;
begin
  -- Try Supabase Vault first.
  begin
    execute $sql$
      select decrypted_secret
      from vault.decrypted_secrets
      where name = 'service_execution_scheduler_secret'
      limit 1
    $sql$
    into v_secret;
  exception
    when undefined_table or invalid_schema_name then
      v_secret := null;
  end;

  -- Fallback for environments where Vault is unavailable.
  if coalesce(v_secret, '') = '' then
    v_secret := nullif(current_setting('app.settings.service_execution_scheduler_secret', true), '');
  end if;

  if coalesce(v_secret, '') = '' then
    update public.service_execution_scheduler_settings
    set
      last_dispatch_status = 'failed',
      last_dispatch_notes = 'Missing scheduler secret. Checked Vault first, then app.settings.service_execution_scheduler_secret.',
      updated_at = now()
    where is_enabled = true
      and coalesce(invoke_url, '') <> ''
      and coalesce(next_run_at, now()) <= now();

    return 0;
  end if;

  for r in
    select *
    from public.service_execution_scheduler_settings
    where is_enabled = true
      and cadence <> 'manual'
      and coalesce(invoke_url, '') <> ''
      and coalesce(next_run_at, now()) <= now()
      and not (
        coalesce(last_dispatch_status, '') = 'queued'
        and coalesce(last_dispatch_at, now() - interval '1 hour') > now() - interval '10 minutes'
      )
    order by next_run_at nulls first, created_at
    for update skip locked
  loop
    begin
      select net.http_post(
        url := r.invoke_url,
        headers := jsonb_build_object(
          'content-type', 'application/json',
          'x-scheduler-secret', v_secret
        ),
        body := jsonb_build_object('setting_code', r.setting_code)
      ) into v_request_id;

      update public.service_execution_scheduler_settings
      set
        last_dispatch_at = now(),
        last_dispatch_request_id = v_request_id,
        last_dispatch_status = 'queued',
        last_dispatch_notes = case
          when exists (
            select 1
            from pg_namespace
            where nspname = 'vault'
          ) then 'Queued through pg_cron/pg_net dispatcher using Vault-backed secret when available; duplicate queued dispatches are suppressed for 10 minutes.'
          else 'Queued through pg_cron/pg_net dispatcher using fallback secret source; duplicate queued dispatches are suppressed for 10 minutes.'
        end,
        updated_at = now()
      where id = r.id;

      v_dispatched := v_dispatched + 1;
    exception when others then
      update public.service_execution_scheduler_settings
      set
        last_dispatch_at = now(),
        last_dispatch_status = 'failed',
        last_dispatch_notes = left(sqlerrm, 1000),
        updated_at = now()
      where id = r.id;
    end;
  end loop;

  return v_dispatched;
end;
$$;

do $dispatch$
begin
  begin
    perform cron.unschedule('service_execution_scheduler_dispatch_default');
  exception when others then
    null;
  end;

  perform cron.schedule(
    'service_execution_scheduler_dispatch_default',
    '* * * * *',
    $job$select public.dispatch_due_service_execution_scheduler_runs();$job$
  );
exception when others then
  null;
end;
$dispatch$;

update public.service_execution_scheduler_settings
set next_run_at = public.compute_service_execution_scheduler_next_run_at(run_timezone, cadence, run_hour_local, run_minute_local, now())
where is_enabled = true
  and cadence <> 'manual'
  and next_run_at is null;

create or replace view public.v_service_execution_scheduler_status as
with latest_run as (
  select distinct on (coalesce(agreement_id::text, 'ALL'))
    coalesce(agreement_id::text, 'ALL') as agreement_key,
    id,
    agreement_id,
    run_code,
    run_mode,
    run_status,
    candidate_count,
    session_created_count,
    invoice_candidate_count,
    skipped_count,
    created_at,
    updated_at
  from public.service_execution_scheduler_runs
  order by coalesce(agreement_id::text, 'ALL'), created_at desc
)
select
  s.id,
  s.setting_code,
  s.is_enabled,
  s.run_timezone,
  s.cadence,
  s.run_hour_local,
  s.run_minute_local,
  s.lookahead_days,
  s.auto_create_sessions,
  s.auto_stage_invoices,
  s.require_linked_job,
  s.last_run_at,
  s.next_run_at,
  s.notes,
  lr.id as latest_run_id,
  lr.run_code as latest_run_code,
  lr.run_mode as latest_run_mode,
  lr.run_status as latest_run_status,
  lr.candidate_count as latest_candidate_count,
  lr.session_created_count as latest_session_created_count,
  lr.invoice_candidate_count as latest_invoice_candidate_count,
  lr.skipped_count as latest_skipped_count,
  lr.created_at as latest_run_created_at,
  case
    when s.is_enabled = true and s.next_run_at is not null and s.next_run_at <= now() then true
    else false
  end as is_due,
  s.invoke_url,
  s.last_dispatch_at,
  s.last_dispatch_request_id,
  s.last_dispatch_status,
  s.last_dispatch_notes
from public.service_execution_scheduler_settings s
left join latest_run lr on lr.agreement_key = 'ALL';

create or replace view public.v_attendance_photo_review as
with latest_review as (
  select distinct on (m.target_id, m.media_stage)
    m.target_id,
    m.media_stage,
    m.review_status,
    m.review_notes,
    m.reviewed_at,
    m.reviewed_by_profile_id,
    reviewer.full_name as reviewed_by_name
  from public.media_review_actions m
  left join public.profiles reviewer on reviewer.id = m.reviewed_by_profile_id
  where m.target_entity = 'employee_time_entry'
  order by m.target_id, m.media_stage, coalesce(m.reviewed_at, m.updated_at, m.created_at) desc, m.created_at desc
)
select
  e.id as time_entry_id,
  e.profile_id,
  e.full_name,
  e.employee_number,
  e.job_id,
  e.job_code,
  e.job_name,
  e.site_id,
  e.site_name,
  'clock_in'::text as photo_stage,
  e.clock_in_photo_url as photo_url,
  e.clock_in_photo_note as photo_note,
  e.clock_in_photo_bucket as storage_bucket,
  e.clock_in_photo_path as storage_path,
  e.clock_in_photo_uploaded_at as uploaded_at,
  e.clock_in_geofence_status as geofence_status,
  e.clock_in_geofence_distance_meters as geofence_distance_meters,
  e.currently_overdue_sign_out,
  e.long_break_exception_flag,
  e.attendance_exception_notes,
  e.signed_in_at,
  e.signed_out_at,
  coalesce(lr.review_status, 'pending') as review_status,
  lr.review_notes,
  lr.reviewed_at,
  lr.reviewed_by_profile_id,
  lr.reviewed_by_name,
  case
    when lr.review_status is null then true
    when lr.review_status in ('pending','follow_up') then true
    when e.clock_in_geofence_status in ('outside','override') then true
    else false
  end as needs_review
from public.v_employee_time_clock_entries e
left join latest_review lr on lr.target_id = e.id and lr.media_stage = 'clock_in'
where e.has_clock_in_photo = true

union all

select
  e.id as time_entry_id,
  e.profile_id,
  e.full_name,
  e.employee_number,
  e.job_id,
  e.job_code,
  e.job_name,
  e.site_id,
  e.site_name,
  'clock_out'::text as photo_stage,
  e.clock_out_photo_url as photo_url,
  e.clock_out_photo_note as photo_note,
  e.clock_out_photo_bucket as storage_bucket,
  e.clock_out_photo_path as storage_path,
  e.clock_out_photo_uploaded_at as uploaded_at,
  e.clock_out_geofence_status as geofence_status,
  e.clock_out_geofence_distance_meters as geofence_distance_meters,
  e.currently_overdue_sign_out,
  e.long_break_exception_flag,
  e.attendance_exception_notes,
  e.signed_in_at,
  e.signed_out_at,
  coalesce(lr.review_status, 'pending') as review_status,
  lr.review_notes,
  lr.reviewed_at,
  lr.reviewed_by_profile_id,
  lr.reviewed_by_name,
  case
    when lr.review_status is null then true
    when lr.review_status in ('pending','follow_up') then true
    when e.clock_out_geofence_status in ('outside','override') then true
    else false
  end as needs_review
from public.v_employee_time_clock_entries e
left join latest_review lr on lr.target_id = e.id and lr.media_stage = 'clock_out'
where e.has_clock_out_photo = true;

create or replace view public.v_hse_evidence_review as
with latest_review as (
  select distinct on (m.target_id, m.media_stage)
    m.target_id,
    m.media_stage,
    m.review_status,
    m.review_notes,
    m.reviewed_at,
    m.reviewed_by_profile_id,
    reviewer.full_name as reviewed_by_name
  from public.media_review_actions m
  left join public.profiles reviewer on reviewer.id = m.reviewed_by_profile_id
  where m.target_entity = 'hse_packet_proof'
  order by m.target_id, m.media_stage, coalesce(m.reviewed_at, m.updated_at, m.created_at) desc, m.created_at desc
)
select
  p.id as proof_id,
  p.packet_id,
  hp.packet_number,
  hp.packet_type,
  hp.packet_status,
  p.proof_stage,
  p.proof_kind,
  p.public_url,
  p.storage_bucket,
  p.storage_path,
  p.file_name,
  p.mime_type,
  p.caption,
  p.proof_notes,
  p.uploaded_by_profile_id,
  pr.full_name as uploaded_by_name,
  p.created_at,
  p.updated_at,
  coalesce(lr.review_status, 'pending') as review_status,
  lr.review_notes,
  lr.reviewed_at,
  lr.reviewed_by_profile_id,
  lr.reviewed_by_name,
  case
    when lr.review_status is null then true
    when lr.review_status in ('pending','follow_up') then true
    else false
  end as needs_review
from public.hse_packet_proofs p
left join public.linked_hse_packets hp on hp.id = p.packet_id
left join public.profiles pr on pr.id = p.uploaded_by_profile_id
left join latest_review lr on lr.target_id = p.id and lr.media_stage = p.proof_stage;

alter table if exists public.payroll_export_runs
  add column if not exists delivery_status text not null default 'pending',
  add column if not exists delivery_reference text,
  add column if not exists delivery_notes text,
  add column if not exists delivered_at timestamptz,
  add column if not exists delivered_by_profile_id uuid references public.profiles(id) on delete set null,
  add column if not exists delivery_confirmed_at timestamptz,
  add column if not exists payroll_close_status text not null default 'open',
  add column if not exists payroll_closed_at timestamptz,
  add column if not exists payroll_closed_by_profile_id uuid references public.profiles(id) on delete set null,
  add column if not exists payroll_close_notes text;

alter table if exists public.payroll_export_runs
  drop constraint if exists payroll_export_runs_delivery_status_check;

alter table if exists public.payroll_export_runs
  add constraint payroll_export_runs_delivery_status_check
  check (delivery_status in ('pending','delivered','confirmed'));

alter table if exists public.payroll_export_runs
  drop constraint if exists payroll_export_runs_payroll_close_status_check;

alter table if exists public.payroll_export_runs
  add constraint payroll_export_runs_payroll_close_status_check
  check (payroll_close_status in ('open','ready_to_close','closed'));

create or replace view public.v_signed_contract_job_kickoff_candidates as
with linked_jobs as (
  select
    d.id as contract_document_id,
    min(j.id) as linked_job_id
  from public.service_contract_documents d
  left join public.recurring_service_agreements a on a.id = d.agreement_id
  left join public.jobs j
    on upper(coalesce(j.service_contract_reference, '')) = upper(coalesce(a.agreement_code, d.contract_reference, ''))
  group by d.id
)
select
  d.id as contract_document_id,
  d.document_number,
  d.document_kind,
  d.document_status,
  d.title,
  d.contract_reference,
  d.signed_at,
  d.signed_by_name,
  d.client_id,
  d.client_site_id,
  d.agreement_id,
  d.estimate_id,
  d.job_id as direct_job_id,
  lj.linked_job_id,
  a.agreement_code,
  a.service_name,
  a.route_id,
  a.crew_id,
  a.tax_code_id,
  coalesce(a.visit_cost_total, e.subtotal, 0)::numeric(12,2) as estimated_cost_total,
  coalesce(a.visit_charge_total, e.total_amount, 0)::numeric(12,2) as quoted_charge_total,
  case
    when d.document_status = 'signed' or d.signed_at is not null then true
    else false
  end as is_signed_ready,
  case
    when coalesce(d.job_id::text, '') <> '' or coalesce(lj.linked_job_id::text, '') <> '' then 'linked_job_exists'
    when d.document_status = 'signed' or d.signed_at is not null then 'ready'
    else 'not_signed'
  end as kickoff_status,
  concat('JOB-', regexp_replace(coalesce(a.agreement_code, d.document_number, d.contract_reference, d.id::text), '[^A-Za-z0-9]+', '-', 'g')) as suggested_job_code,
  coalesce(a.service_name, d.title, 'Signed Contract Job') as suggested_job_name,
  concat('WO-', regexp_replace(coalesce(a.agreement_code, d.document_number, d.contract_reference, d.id::text), '[^A-Za-z0-9]+', '-', 'g')) as suggested_work_order_number,
  greatest(current_date, coalesce(a.start_date, current_date))::date as suggested_first_session_date,
  coalesce(a.visit_estimated_duration_hours, 0)::numeric(10,2) as suggested_first_session_hours
from public.service_contract_documents d
left join public.recurring_service_agreements a on a.id = d.agreement_id
left join public.estimates e on e.id = d.estimate_id
left join linked_jobs lj on lj.contract_document_id = d.id
where d.document_kind in ('contract','application');

create or replace view public.v_payroll_close_review_summary as
with export_rollup as (
  select
    count(*)::int as export_run_count,
    count(*) filter (where coalesce(status, '') <> 'exported')::int as open_export_run_count,
    count(*) filter (where coalesce(delivery_status, 'pending') = 'pending')::int as delivery_pending_count,
    count(*) filter (where coalesce(delivery_status, '') in ('delivered','confirmed'))::int as delivery_recorded_count,
    count(*) filter (where coalesce(delivery_status, '') = 'confirmed')::int as delivery_confirmed_count,
    count(*) filter (where coalesce(payroll_close_status, 'open') = 'ready_to_close')::int as ready_to_close_count,
    count(*) filter (where coalesce(payroll_close_status, 'open') = 'closed')::int as closed_run_count,
    max(exported_at) as last_exported_at,
    max(delivery_confirmed_at) as last_delivery_confirmed_at,
    max(payroll_closed_at) as last_payroll_closed_at,
    coalesce(sum(coalesce(exported_entry_count, 0)), 0)::int as exported_entry_count_total,
    coalesce(sum(coalesce(exported_hours_total, 0)), 0)::numeric(10,2) as exported_hours_total,
    coalesce(sum(coalesce(exported_payroll_cost_total, 0)), 0)::numeric(12,2) as exported_payroll_cost_total
  from public.payroll_export_runs
), attendance_rollup as (
  select
    coalesce(sum(unexported_entry_count), 0)::int as unexported_entry_count,
    coalesce(sum(unexported_hours_total), 0)::numeric(10,2) as unexported_hours_total,
    coalesce(sum(unexported_payroll_cost_total), 0)::numeric(12,2) as unexported_payroll_cost_total
  from public.v_payroll_review_summary
), review_rollup as (
  select
    count(*) filter (where needs_review = true)::int as attendance_review_needed_count
  from public.v_employee_time_review_queue
), clock_rollup as (
  select
    coalesce(overdue_sign_out_count, 0)::int as overdue_sign_out_count,
    coalesce(attendance_exception_count, 0)::int as attendance_exception_count
  from public.v_employee_time_clock_summary
)
select
  er.export_run_count,
  er.open_export_run_count,
  er.last_exported_at,
  er.exported_entry_count_total,
  er.exported_hours_total,
  er.exported_payroll_cost_total,
  ar.unexported_entry_count,
  ar.unexported_hours_total,
  ar.unexported_payroll_cost_total,
  rr.attendance_review_needed_count,
  cr.overdue_sign_out_count,
  cr.attendance_exception_count,
  er.delivery_pending_count,
  er.delivery_recorded_count,
  er.delivery_confirmed_count,
  er.ready_to_close_count,
  er.closed_run_count,
  er.last_delivery_confirmed_at,
  er.last_payroll_closed_at
from export_rollup er
cross join attendance_rollup ar
cross join review_rollup rr
cross join clock_rollup cr;



-- 089_historical_reporting_and_auth_wall_support.sql
-- Adds historical reporting views for OSHA/HSE submissions and cross-workflow history.

create or replace view public.v_hse_submission_history_report as
with review_rollup as (
  select
    sr.submission_id,
    count(*)::int as review_count,
    max(sr.created_at) as last_reviewed_at,
    (array_agg(sr.review_action order by sr.created_at desc nulls last))[1] as last_review_action,
    (array_agg(sr.review_note order by sr.created_at desc nulls last))[1] as last_review_note,
    (array_agg(coalesce(p.full_name, p.email, sr.reviewer_id::text) order by sr.created_at desc nulls last))[1] as last_reviewed_by_name
  from public.submission_reviews sr
  left join public.profiles p on p.id = sr.reviewer_id
  group by sr.submission_id
), image_rollup as (
  select si.submission_id, count(*)::int as image_count
  from public.submission_images si
  group by si.submission_id
)
select
  s.id as submission_id,
  s.form_type,
  s.date as submission_date,
  s.status,
  s.site_id,
  coalesce(st.site_code, s.site, '') as site_code,
  st.site_name,
  trim(both ' ' from concat(coalesce(st.site_code, ''), case when st.site_code is not null and st.site_name is not null then ' — ' else '' end, coalesce(st.site_name, s.site, ''))) as site_label,
  s.submitted_by_profile_id,
  coalesce(sp.full_name, sp.email, s.submitted_by, '') as submitted_by_name,
  s.supervisor_profile_id,
  coalesce(sup.full_name, sup.email, '') as supervisor_name,
  s.admin_profile_id,
  coalesce(adm.full_name, adm.email, '') as admin_name,
  s.reviewed_at,
  coalesce(rev.review_count, 0) as review_count,
  coalesce(img.image_count, 0) as image_count,
  rev.last_reviewed_at,
  rev.last_review_action,
  rev.last_review_note,
  rev.last_reviewed_by_name,
  s.created_at,
  s.updated_at
from public.submissions s
left join public.sites st on st.id = s.site_id
left join public.profiles sp on sp.id = s.submitted_by_profile_id
left join public.profiles sup on sup.id = s.supervisor_profile_id
left join public.profiles adm on adm.id = s.admin_profile_id
left join review_rollup rev on rev.submission_id = s.id
left join image_rollup img on img.submission_id = s.id;

create or replace view public.v_hse_form_daily_rollup as
with base as (
  select * from public.v_hse_submission_history_report
)
select
  submission_date as report_date,
  form_type,
  status,
  count(*)::int as submission_count,
  count(distinct coalesce(site_id::text, site_code, site_name, 'unknown'))::int as unique_site_count,
  coalesce(sum(image_count), 0)::int as image_count,
  count(*) filter (where coalesce(review_count, 0) > 0)::int as reviewed_count,
  count(*) filter (where coalesce(last_review_action, '') = 'rejected' or coalesce(status, '') = 'rejected')::int as rejected_count,
  max(last_reviewed_at) as last_reviewed_at
from base
group by submission_date, form_type, status;

create or replace view public.v_hse_form_site_rollup as
with base as (
  select * from public.v_hse_submission_history_report
)
select
  coalesce(site_id::text, site_code, site_name, 'unknown') as site_ref,
  site_id,
  site_code,
  site_name,
  site_label,
  form_type,
  count(*)::int as submission_count,
  count(*) filter (where coalesce(review_count, 0) > 0)::int as reviewed_count,
  count(*) filter (where coalesce(last_review_action, '') = 'rejected' or coalesce(status, '') = 'rejected')::int as rejected_count,
  coalesce(sum(image_count), 0)::int as image_count,
  max(submission_date) as last_submission_date,
  max(last_reviewed_at) as last_reviewed_at
from base
group by coalesce(site_id::text, site_code, site_name, 'unknown'), site_id, site_code, site_name, site_label, form_type;

create or replace view public.v_workflow_history_report as
select
  'submission'::text as history_type,
  'submissions'::text as source_table,
  s.id::text as source_id,
  coalesce(s.reviewed_at, s.updated_at, s.created_at) as occurred_at,
  coalesce(s.status, 'submitted') as record_status,
  s.id::text as record_number,
  concat(upper(coalesce(s.form_type, 'form')), ' submission') as headline,
  concat(coalesce(st.site_code, st.site_name, s.site, 'Unknown site'), ' • ', coalesce(s.submitted_by, 'submitted')) as detail,
  st.site_code,
  st.site_name
from public.submissions s
left join public.sites st on st.id = s.site_id

union all

select
  'hse_packet_event'::text,
  'hse_packet_events'::text,
  e.id::text,
  e.event_at,
  coalesce(e.event_type, 'event') as record_status,
  coalesce(lp.packet_number, e.packet_id::text) as record_number,
  concat('HSE packet ', coalesce(lp.packet_number, 'event')) as headline,
  coalesce(e.event_summary, e.event_notes, 'Packet event recorded') as detail,
  null::text as site_code,
  null::text as site_name
from public.hse_packet_events e
left join public.linked_hse_packets lp on lp.id = e.packet_id

union all

select
  'evidence_review'::text,
  'media_review_actions'::text,
  m.id::text,
  coalesce(m.reviewed_at, m.updated_at, m.created_at) as occurred_at,
  coalesce(m.review_status, 'pending') as record_status,
  m.target_id::text as record_number,
  concat('Evidence review • ', m.target_entity, ' • ', m.media_stage) as headline,
  coalesce(m.review_notes, 'Evidence status updated') as detail,
  null::text as site_code,
  null::text as site_name
from public.media_review_actions m

union all

select
  'scheduler_run'::text,
  'service_execution_scheduler_runs'::text,
  r.id::text,
  coalesce(r.updated_at, r.created_at) as occurred_at,
  coalesce(r.run_status, 'queued') as record_status,
  coalesce(r.run_code, r.id::text) as record_number,
  'Service execution scheduler run' as headline,
  concat('Candidates: ', coalesce(r.candidate_count, 0), ' • Sessions: ', coalesce(r.session_created_count, 0), ' • Invoice candidates: ', coalesce(r.invoice_candidate_count, 0), ' • Skipped: ', coalesce(r.skipped_count, 0)) as detail,
  null::text as site_code,
  null::text as site_name
from public.service_execution_scheduler_runs r

union all

select
  'payroll_export'::text,
  'payroll_export_runs'::text,
  p.id::text,
  coalesce(p.payroll_closed_at, p.delivery_confirmed_at, p.delivered_at, p.exported_at, p.created_at) as occurred_at,
  coalesce(p.payroll_close_status, p.delivery_status, p.status, 'open') as record_status,
  coalesce(p.export_batch_number, p.id::text) as record_number,
  'Payroll export workflow' as headline,
  concat('Provider: ', coalesce(p.export_provider, 'n/a'), ' • Period: ', coalesce(p.period_start::text, ''), ' to ', coalesce(p.period_end::text, ''), ' • Delivery: ', coalesce(p.delivery_status, 'pending')) as detail,
  null::text as site_code,
  null::text as site_name
from public.payroll_export_runs p

union all

select
  'signed_contract'::text,
  'service_contract_documents'::text,
  d.id::text,
  coalesce(d.signed_at, d.updated_at, d.created_at) as occurred_at,
  coalesce(d.document_status, 'draft') as record_status,
  coalesce(d.document_number, d.contract_reference, d.id::text) as record_number,
  coalesce(d.title, 'Service contract document') as headline,
  concat('Kind: ', coalesce(d.document_kind, 'contract'), case when d.signed_by_name is not null then concat(' • Signed by ', d.signed_by_name) else '' end) as detail,
  null::text as site_code,
  null::text as site_name
from public.service_contract_documents d;

-- Synced from sql/090_incident_reporting_saved_report_presets_and_trends.sql
-- 090_incident_reporting_saved_report_presets_and_trends.sql
-- Adds incident / near-miss reporting views, saved reporting presets,
-- and richer DB-backed reporting rollups so reporting depends less on browser-local state.
-- This version preserves existing view column order and only appends new columns.

create table if not exists public.report_presets (
  id uuid primary key default gen_random_uuid(),
  preset_scope text not null default 'hse_reporting',
  preset_name text not null,
  visibility text not null default 'private',
  preset_payload jsonb not null default '{}'::jsonb,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists public.report_presets
  drop constraint if exists report_presets_scope_check;

alter table if exists public.report_presets
  add constraint report_presets_scope_check
  check (preset_scope in ('hse_reporting'));

alter table if exists public.report_presets
  drop constraint if exists report_presets_visibility_check;

alter table if exists public.report_presets
  add constraint report_presets_visibility_check
  check (visibility in ('private','shared'));

create index if not exists idx_report_presets_scope
  on public.report_presets(preset_scope, is_active, visibility, created_at desc);

create index if not exists idx_report_presets_creator
  on public.report_presets(created_by_profile_id, created_at desc);

create or replace view public.v_report_preset_directory as
select
  rp.id,
  rp.preset_scope,
  rp.preset_name,
  rp.visibility,
  rp.preset_payload,
  rp.created_by_profile_id,
  coalesce(p.full_name, p.email, '') as created_by_name,
  rp.is_active,
  rp.created_at,
  rp.updated_at
from public.report_presets rp
left join public.profiles p on p.id = rp.created_by_profile_id
where rp.is_active = true;

create or replace view public.v_hse_submission_history_report as
with review_rollup as (
  select
    sr.submission_id,
    count(*)::int as review_count,
    max(sr.created_at) as last_reviewed_at,
    (array_agg(sr.review_action order by sr.created_at desc nulls last))[1] as last_review_action,
    (array_agg(sr.review_note order by sr.created_at desc nulls last))[1] as last_review_note,
    (array_agg(coalesce(p.full_name, p.email, sr.reviewer_id::text) order by sr.created_at desc nulls last))[1] as last_reviewed_by_name
  from public.submission_reviews sr
  left join public.profiles p on p.id = sr.reviewer_id
  group by sr.submission_id
), image_rollup as (
  select
    si.submission_id,
    count(*)::int as image_count
  from public.submission_images si
  group by si.submission_id
), base as (
  select
    s.*,
    case
      when upper(coalesce(s.form_type, '')) in ('E','TOOLBOX') then 'toolbox'
      when upper(coalesce(s.form_type, '')) in ('D','PPE') then 'ppe'
      when upper(coalesce(s.form_type, '')) in ('B','FIRSTAID','FIRST_AID') then 'firstaid'
      when upper(coalesce(s.form_type, '')) in ('C','INSPECTION','SITE_INSPECTION','INSPECT') then 'inspection'
      when upper(coalesce(s.form_type, '')) in ('A','DRILL','EMERGENCY_DRILL') then 'drill'
      when upper(coalesce(s.form_type, '')) in ('F','INCIDENT','INCIDENT_NEAR_MISS','NEAR_MISS') then 'incident'
      else lower(coalesce(s.form_type, 'other'))
    end as form_key,
    case
      when upper(coalesce(s.form_type, '')) in ('E','TOOLBOX') then 'Toolbox Talk'
      when upper(coalesce(s.form_type, '')) in ('D','PPE') then 'PPE Check'
      when upper(coalesce(s.form_type, '')) in ('B','FIRSTAID','FIRST_AID') then 'First Aid Kit'
      when upper(coalesce(s.form_type, '')) in ('C','INSPECTION','SITE_INSPECTION','INSPECT') then 'Site Inspection'
      when upper(coalesce(s.form_type, '')) in ('A','DRILL','EMERGENCY_DRILL') then 'Emergency Drill'
      when upper(coalesce(s.form_type, '')) in ('F','INCIDENT','INCIDENT_NEAR_MISS','NEAR_MISS') then 'Incident / Near Miss'
      else coalesce(s.form_type, 'Other')
    end as form_label
  from public.submissions s
)
select
  s.id as submission_id,
  s.form_type,
  s.date as submission_date,
  s.status,
  s.site_id,
  coalesce(st.site_code, s.site, '') as site_code,
  st.site_name,
  trim(
    both ' ' from concat(
      coalesce(st.site_code, ''),
      case when st.site_code is not null and st.site_name is not null then ' — ' else '' end,
      coalesce(st.site_name, s.site, '')
    )
  ) as site_label,
  s.submitted_by_profile_id,
  coalesce(sp.full_name, sp.email, s.submitted_by, '') as submitted_by_name,
  s.supervisor_profile_id,
  coalesce(sup.full_name, sup.email, '') as supervisor_name,
  s.admin_profile_id,
  coalesce(adm.full_name, adm.email, '') as admin_name,
  s.reviewed_at,
  coalesce(rev.review_count, 0) as review_count,
  coalesce(img.image_count, 0) as image_count,
  rev.last_reviewed_at,
  rev.last_review_action,
  rev.last_review_note,
  rev.last_reviewed_by_name,
  s.created_at,
  s.updated_at,
  s.form_key,
  s.form_label,
  s.payload,
  coalesce(s.payload->>'job_code', s.payload->>'job_id', '') as job_code,
  coalesce(s.payload->>'work_order_number', s.payload->>'work_order_id', '') as work_order_number,
  coalesce(s.payload->>'route_code', s.payload->>'route_id', '') as route_code,
  coalesce(s.payload->>'equipment_code', '') as equipment_code,
  coalesce(s.payload->>'worker_name', s.payload->>'affected_worker', s.payload->>'employee_name', '') as worker_name,
  coalesce(s.payload->>'incident_kind', '') as incident_kind,
  coalesce(s.payload->>'severity', '') as severity,
  case
    when lower(coalesce(s.payload->>'anonymous_report', 'false')) in ('true','t','1','yes','y') then true
    else false
  end as anonymous_report
from base s
left join public.sites st on st.id = s.site_id
left join public.profiles sp on sp.id = s.submitted_by_profile_id
left join public.profiles sup on sup.id = s.supervisor_profile_id
left join public.profiles adm on adm.id = s.admin_profile_id
left join review_rollup rev on rev.submission_id = s.id
left join image_rollup img on img.submission_id = s.id;

create or replace view public.v_hse_form_daily_rollup as
with base as (
  select * from public.v_hse_submission_history_report
)
select
  submission_date as report_date,
  max(form_type) as form_type,
  status,
  count(*)::int as submission_count,
  count(distinct coalesce(site_id::text, site_code, site_name, 'unknown'))::int as unique_site_count,
  coalesce(sum(image_count), 0)::int as image_count,
  count(*) filter (where coalesce(review_count, 0) > 0)::int as reviewed_count,
  count(*) filter (
    where coalesce(last_review_action, '') = 'rejected'
       or coalesce(status, '') = 'rejected'
  )::int as rejected_count,
  max(last_reviewed_at) as last_reviewed_at,
  form_key,
  max(form_label) as form_label,
  count(*) filter (where form_key = 'incident')::int as incident_count,
  count(*) filter (where form_key = 'incident' and lower(coalesce(incident_kind, '')) = 'near_miss')::int as near_miss_count,
  count(*) filter (where form_key = 'incident' and lower(coalesce(severity, '')) in ('high','critical'))::int as high_severity_incident_count
from base
group by submission_date, form_key, status;

create or replace view public.v_hse_form_site_rollup as
with base as (
  select * from public.v_hse_submission_history_report
)
select
  coalesce(site_id::text, site_code, site_name, 'unknown') as site_ref,
  site_id,
  site_code,
  site_name,
  site_label,
  max(form_type) as form_type,
  count(*)::int as submission_count,
  count(*) filter (where coalesce(review_count, 0) > 0)::int as reviewed_count,
  count(*) filter (
    where coalesce(last_review_action, '') = 'rejected'
       or coalesce(status, '') = 'rejected'
  )::int as rejected_count,
  coalesce(sum(image_count), 0)::int as image_count,
  max(submission_date) as last_submission_date,
  max(last_reviewed_at) as last_reviewed_at,
  form_key,
  max(form_label) as form_label,
  count(*) filter (where form_key = 'incident')::int as incident_count
from base
group by
  coalesce(site_id::text, site_code, site_name, 'unknown'),
  site_id,
  site_code,
  site_name,
  site_label,
  form_key;

create or replace view public.v_incident_near_miss_history as
select
  submission_id,
  form_type,
  form_key,
  form_label,
  submission_date,
  status,
  site_id,
  site_code,
  site_name,
  site_label,
  submitted_by_profile_id,
  submitted_by_name,
  supervisor_profile_id,
  supervisor_name,
  admin_profile_id,
  admin_name,
  worker_name,
  job_code,
  work_order_number,
  route_code,
  equipment_code,
  coalesce(nullif(incident_kind, ''), 'incident') as incident_kind,
  coalesce(nullif(severity, ''), 'medium') as severity,
  case
    when lower(coalesce(payload->>'medical_treatment_required', 'false')) in ('true','t','1','yes','y') then true
    else false
  end as medical_treatment_required,
  case
    when lower(coalesce(payload->>'lost_time', 'false')) in ('true','t','1','yes','y') then true
    else false
  end as lost_time,
  case
    when lower(coalesce(payload->>'property_damage', 'false')) in ('true','t','1','yes','y') then true
    else false
  end as property_damage,
  case
    when lower(coalesce(payload->>'vehicle_involved', 'false')) in ('true','t','1','yes','y') then true
    else false
  end as vehicle_involved,
  anonymous_report,
  coalesce(payload->>'event_time', payload->>'incident_time', '') as event_time,
  coalesce(payload->>'event_summary', payload->>'what_happened', payload->>'description', '') as event_summary,
  coalesce(payload->>'immediate_actions_taken', payload->>'immediate_action', '') as immediate_actions_taken,
  coalesce(payload->>'root_cause_summary', payload->>'root_cause', '') as root_cause_summary,
  coalesce(payload->>'corrective_action_required', '') as corrective_action_required,
  coalesce(payload->>'corrective_action_owner', '') as corrective_action_owner,
  coalesce(payload->>'corrective_action_status', '') as corrective_action_status,
  coalesce(payload->>'corrective_action_due_date', '') as corrective_action_due_date,
  coalesce(payload->>'witness_names', '') as witness_names,
  image_count,
  review_count,
  last_review_action,
  last_reviewed_at,
  created_at,
  updated_at,
  payload
from public.v_hse_submission_history_report
where form_key = 'incident';

create or replace view public.v_hse_reporting_monthly_trends as
with base as (
  select * from public.v_hse_submission_history_report
)
select
  date_trunc('month', submission_date::timestamp)::date as month_start,
  form_key,
  max(form_label) as form_label,
  count(*)::int as submission_count,
  count(*) filter (where form_key = 'incident')::int as incident_count,
  count(*) filter (where form_key = 'incident' and lower(coalesce(incident_kind, '')) = 'near_miss')::int as near_miss_count,
  count(*) filter (where form_key = 'incident' and lower(coalesce(severity, '')) in ('high','critical'))::int as high_severity_incident_count,
  count(*) filter (where coalesce(review_count, 0) > 0)::int as reviewed_count,
  count(*) filter (
    where coalesce(last_review_action, '') = 'rejected'
       or coalesce(status, '') = 'rejected'
  )::int as rejected_count,
  coalesce(sum(image_count), 0)::int as image_count
from base
group by date_trunc('month', submission_date::timestamp)::date, form_key;

create or replace view public.v_hse_reporting_worker_rollup as
with base as (
  select * from public.v_hse_submission_history_report
)
select
  coalesce(nullif(worker_name, ''), submitted_by_name, 'Unknown worker') as worker_label,
  max(submitted_by_name) as submitted_by_name,
  count(*)::int as submission_count,
  count(*) filter (where form_key = 'incident')::int as incident_count,
  count(*) filter (where form_key = 'incident' and lower(coalesce(incident_kind, '')) = 'near_miss')::int as near_miss_count,
  count(*) filter (where form_key = 'incident' and lower(coalesce(severity, '')) in ('high','critical'))::int as high_severity_incident_count,
  count(*) filter (where coalesce(review_count, 0) > 0)::int as reviewed_count,
  max(submission_date) as last_submission_date,
  string_agg(distinct form_label, ', ' order by form_label) as form_labels
from base
group by coalesce(nullif(worker_name, ''), submitted_by_name, 'Unknown worker');

create or replace view public.v_hse_reporting_context_rollup as
with base as (
  select * from public.v_hse_submission_history_report
), normalized as (
  select
    coalesce(site_label, site_name, site_code, 'Unknown site') as site_label,
    coalesce(nullif(job_code, ''), '—') as job_code,
    coalesce(nullif(work_order_number, ''), '—') as work_order_number,
    coalesce(nullif(route_code, ''), '—') as route_code,
    count(*)::int as submission_count,
    count(*) filter (where form_key = 'incident')::int as incident_count,
    count(*) filter (where form_key = 'incident' and lower(coalesce(incident_kind, '')) = 'near_miss')::int as near_miss_count,
    count(*) filter (where coalesce(review_count, 0) > 0)::int as reviewed_count,
    max(submission_date) as last_submission_date
  from base
  group by
    coalesce(site_label, site_name, site_code, 'Unknown site'),
    coalesce(nullif(job_code, ''), '—'),
    coalesce(nullif(work_order_number, ''), '—'),
    coalesce(nullif(route_code, ''), '—')
)
select * from normalized;


-- Synced from sql/091_corrective_actions_training_and_sds_tracking.sql
-- 091_corrective_actions_training_and_sds_tracking.sql
-- Adds first-class corrective-action tasks, training / certification tracking,
-- SDS acknowledgement history, and management-focused reporting views.

create table if not exists public.corrective_action_tasks (
  id uuid primary key default gen_random_uuid(),
  source_submission_id bigint references public.submissions(id) on delete set null,
  source_history_type text not null default 'incident_submission',
  source_record_number text,
  task_scope text not null default 'incident_corrective_action',
  task_title text not null,
  task_description text,
  priority text not null default 'medium',
  status text not null default 'open',
  assigned_to_profile_id uuid references public.profiles(id) on delete set null,
  assigned_by_profile_id uuid references public.profiles(id) on delete set null,
  owner_name text,
  due_date date,
  started_at timestamptz,
  completed_at timestamptz,
  escalation_level integer not null default 0,
  reminder_last_sent_at timestamptz,
  closeout_notes text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists public.corrective_action_tasks
  drop constraint if exists corrective_action_tasks_priority_check;

alter table if exists public.corrective_action_tasks
  add constraint corrective_action_tasks_priority_check
  check (priority in ('low','medium','high','critical'));

alter table if exists public.corrective_action_tasks
  drop constraint if exists corrective_action_tasks_status_check;

alter table if exists public.corrective_action_tasks
  add constraint corrective_action_tasks_status_check
  check (status in ('open','in_progress','blocked','ready_for_review','closed','cancelled'));

create index if not exists idx_corrective_action_tasks_status_due
  on public.corrective_action_tasks(status, due_date, created_at desc);

create index if not exists idx_corrective_action_tasks_assigned
  on public.corrective_action_tasks(assigned_to_profile_id, due_date, created_at desc);

create table if not exists public.corrective_action_task_events (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.corrective_action_tasks(id) on delete cascade,
  event_type text not null default 'note',
  event_status text,
  event_notes text,
  changed_by_profile_id uuid references public.profiles(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_corrective_action_task_events_task
  on public.corrective_action_task_events(task_id, created_at desc);

create table if not exists public.training_courses (
  id uuid primary key default gen_random_uuid(),
  course_code text not null unique,
  course_name text not null,
  category text not null default 'safety',
  validity_months integer,
  reminder_days_before integer not null default 30,
  requires_sds_acknowledgement boolean not null default false,
  is_active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_training_courses_active
  on public.training_courses(is_active, category, course_name);

create table if not exists public.training_records (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  course_id uuid not null references public.training_courses(id) on delete cascade,
  completion_status text not null default 'completed',
  completed_at date,
  expires_at date,
  trainer_name text,
  provider_name text,
  certificate_number text,
  license_number text,
  source_submission_id bigint references public.submissions(id) on delete set null,
  notes text,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists public.training_records
  drop constraint if exists training_records_status_check;

alter table if exists public.training_records
  add constraint training_records_status_check
  check (completion_status in ('scheduled','in_progress','completed','expired','waived'));

create index if not exists idx_training_records_profile
  on public.training_records(profile_id, expires_at, completed_at desc);

create index if not exists idx_training_records_course
  on public.training_records(course_id, expires_at, completed_at desc);

create table if not exists public.sds_acknowledgements (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  chemical_name text not null,
  product_name text,
  vendor_name text,
  sds_revision_date date,
  acknowledged_at date not null default current_date,
  expires_at date,
  status text not null default 'acknowledged',
  source_submission_id bigint references public.submissions(id) on delete set null,
  linked_training_record_id uuid references public.training_records(id) on delete set null,
  acknowledged_by_profile_id uuid references public.profiles(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists public.sds_acknowledgements
  drop constraint if exists sds_acknowledgements_status_check;

alter table if exists public.sds_acknowledgements
  add constraint sds_acknowledgements_status_check
  check (status in ('acknowledged','expired','revoked'));

create index if not exists idx_sds_acknowledgements_profile
  on public.sds_acknowledgements(profile_id, expires_at, acknowledged_at desc);

insert into public.training_courses (course_code, course_name, category, validity_months, reminder_days_before, requires_sds_acknowledgement, notes)
values
  ('WHMIS', 'WHMIS / Hazard Communication', 'safety', 12, 30, true, 'Covers chemical hazard communication and SDS review expectations.'),
  ('FIRST_AID', 'First Aid / CPR', 'medical', 36, 60, false, 'Worker first aid and CPR certification tracking.'),
  ('INCIDENT_REPORTING', 'Incident / Near-Miss Reporting', 'safety', 12, 30, false, 'How to report hazards, incidents, and close calls correctly.'),
  ('EMERGENCY_RESPONSE', 'Emergency Response and Drill Readiness', 'emergency', 12, 30, false, 'Emergency procedures, contacts, and drill expectations.'),
  ('JSA_HAZARD', 'Hazard Assessment / JSA Review', 'safety', 12, 30, false, 'Routine and non-routine hazard assessment expectations.'),
  ('PPE_USE', 'PPE Selection and Use', 'safety', 12, 30, false, 'PPE verification, selection, inspection, and use reminders.')
on conflict (course_code) do update set
  course_name = excluded.course_name,
  category = excluded.category,
  validity_months = excluded.validity_months,
  reminder_days_before = excluded.reminder_days_before,
  requires_sds_acknowledgement = excluded.requires_sds_acknowledgement,
  notes = excluded.notes,
  is_active = true,
  updated_at = now();

insert into public.corrective_action_tasks (
  source_submission_id,
  source_history_type,
  source_record_number,
  task_scope,
  task_title,
  task_description,
  priority,
  status,
  owner_name,
  due_date,
  payload,
  created_at,
  updated_at
)
select
  inc.submission_id,
  'incident_submission',
  inc.submission_id::text,
  'incident_corrective_action',
  left(coalesce(nullif(inc.event_summary, ''), 'Incident corrective action'), 160) as task_title,
  nullif(inc.corrective_action_required, '') as task_description,
  case when lower(coalesce(inc.severity, '')) in ('high','critical') then 'high' else 'medium' end as priority,
  case when lower(coalesce(inc.corrective_action_status, '')) in ('closed','complete','completed') then 'closed' else 'open' end as status,
  nullif(inc.corrective_action_owner, '') as owner_name,
  nullif(inc.corrective_action_due_date, '')::date as due_date,
  jsonb_build_object(
    'incident_kind', inc.incident_kind,
    'severity', inc.severity,
    'site_label', inc.site_label,
    'job_code', inc.job_code,
    'work_order_number', inc.work_order_number,
    'route_code', inc.route_code,
    'worker_name', inc.worker_name,
    'source', '091_backfill'
  ) as payload,
  coalesce(inc.created_at, now()),
  now()
from public.v_incident_near_miss_history inc
where coalesce(nullif(inc.corrective_action_required, ''), '') <> ''
  and not exists (
    select 1
    from public.corrective_action_tasks t
    where t.source_submission_id = inc.submission_id
      and t.task_scope = 'incident_corrective_action'
  );

create or replace view public.v_corrective_action_task_directory as
with event_rollup as (
  select
    e.task_id,
    count(*)::int as event_count,
    max(e.created_at) as last_event_at,
    (array_agg(e.event_type order by e.created_at desc nulls last))[1] as last_event_type,
    (array_agg(e.event_notes order by e.created_at desc nulls last))[1] as last_event_notes,
    (array_agg(coalesce(p.full_name, p.email, e.changed_by_profile_id::text) order by e.created_at desc nulls last))[1] as last_changed_by_name
  from public.corrective_action_task_events e
  left join public.profiles p on p.id = e.changed_by_profile_id
  group by e.task_id
)
select
  t.id,
  t.source_submission_id,
  t.source_history_type,
  t.source_record_number,
  t.task_scope,
  t.task_title,
  t.task_description,
  t.priority,
  t.status,
  t.assigned_to_profile_id,
  coalesce(ap.full_name, ap.email, '') as assigned_to_name,
  t.assigned_by_profile_id,
  coalesce(bp.full_name, bp.email, '') as assigned_by_name,
  t.owner_name,
  t.due_date,
  t.started_at,
  t.completed_at,
  t.escalation_level,
  t.reminder_last_sent_at,
  t.closeout_notes,
  t.payload,
  t.created_at,
  t.updated_at,
  inc.submission_date,
  inc.site_id,
  inc.site_code,
  inc.site_name,
  inc.site_label,
  inc.worker_name,
  inc.job_code,
  inc.work_order_number,
  inc.route_code,
  inc.event_summary,
  inc.immediate_actions_taken,
  inc.root_cause_summary,
  inc.incident_kind,
  inc.severity,
  case when t.status <> 'closed' and t.due_date is not null and t.due_date < current_date then true else false end as is_overdue,
  greatest(0, current_date - coalesce(t.due_date, current_date))::int as days_overdue,
  coalesce(er.event_count, 0) as event_count,
  er.last_event_at,
  er.last_event_type,
  er.last_event_notes,
  er.last_changed_by_name
from public.corrective_action_tasks t
left join public.profiles ap on ap.id = t.assigned_to_profile_id
left join public.profiles bp on bp.id = t.assigned_by_profile_id
left join public.v_incident_near_miss_history inc on inc.submission_id = t.source_submission_id
left join event_rollup er on er.task_id = t.id;

create or replace view public.v_corrective_action_task_summary as
select
  count(*)::int as task_count,
  count(*) filter (where status in ('open','in_progress','blocked','ready_for_review'))::int as open_task_count,
  count(*) filter (where status = 'closed')::int as closed_task_count,
  count(*) filter (where status <> 'closed' and due_date is not null and due_date < current_date)::int as overdue_task_count,
  count(*) filter (where priority in ('high','critical') and status <> 'closed')::int as high_priority_open_count,
  max(updated_at) as last_updated_at
from public.corrective_action_tasks;

create or replace view public.v_training_course_directory as
select
  tc.id,
  tc.course_code,
  tc.course_name,
  tc.category,
  tc.validity_months,
  tc.reminder_days_before,
  tc.requires_sds_acknowledgement,
  tc.is_active,
  tc.notes,
  tc.created_at,
  tc.updated_at
from public.training_courses tc
where tc.is_active = true;

create or replace view public.v_training_record_directory as
select
  tr.id,
  tr.profile_id,
  coalesce(p.full_name, p.email, '') as profile_name,
  p.role as profile_role,
  p.employee_number,
  tr.course_id,
  tc.course_code,
  tc.course_name,
  tc.category,
  tc.validity_months,
  tc.reminder_days_before,
  tc.requires_sds_acknowledgement,
  tr.completion_status,
  tr.completed_at,
  tr.expires_at,
  tr.trainer_name,
  tr.provider_name,
  tr.certificate_number,
  tr.license_number,
  tr.source_submission_id,
  tr.notes,
  tr.created_by_profile_id,
  coalesce(cp.full_name, cp.email, '') as created_by_name,
  tr.created_at,
  tr.updated_at,
  case when tr.expires_at is not null and tr.expires_at < current_date then true else false end as is_expired,
  case when tr.expires_at is not null and tr.expires_at between current_date and current_date + interval '30 days' then true else false end as expires_within_30_days,
  case when tr.expires_at is not null then greatest(0, tr.expires_at - current_date)::int else null end as days_until_expiry
from public.training_records tr
left join public.profiles p on p.id = tr.profile_id
left join public.training_courses tc on tc.id = tr.course_id
left join public.profiles cp on cp.id = tr.created_by_profile_id;

create or replace view public.v_training_expiry_summary as
select
  count(*)::int as record_count,
  count(*) filter (where is_expired = true)::int as expired_count,
  count(*) filter (where expires_within_30_days = true)::int as expiring_30_days_count,
  count(*) filter (where completion_status = 'scheduled')::int as scheduled_count,
  max(updated_at) as last_updated_at
from public.v_training_record_directory;

create or replace view public.v_sds_acknowledgement_directory as
select
  sa.id,
  sa.profile_id,
  coalesce(p.full_name, p.email, '') as profile_name,
  p.employee_number,
  sa.chemical_name,
  sa.product_name,
  sa.vendor_name,
  sa.sds_revision_date,
  sa.acknowledged_at,
  sa.expires_at,
  sa.status,
  sa.source_submission_id,
  sa.linked_training_record_id,
  sa.acknowledged_by_profile_id,
  coalesce(ap.full_name, ap.email, '') as acknowledged_by_name,
  sa.notes,
  sa.created_at,
  sa.updated_at,
  case when sa.expires_at is not null and sa.expires_at < current_date then true else false end as is_expired,
  case when sa.expires_at is not null and sa.expires_at between current_date and current_date + interval '30 days' then true else false end as expires_within_30_days
from public.sds_acknowledgements sa
left join public.profiles p on p.id = sa.profile_id
left join public.profiles ap on ap.id = sa.acknowledged_by_profile_id;

create or replace view public.v_supervisor_safety_queue as
select
  'corrective_action'::text as queue_type,
  t.id::text as queue_id,
  coalesce(t.site_label, 'Unknown site') as primary_context,
  coalesce(t.task_title, 'Corrective action') as headline,
  coalesce(t.status, 'open') as queue_status,
  t.priority as queue_priority,
  coalesce(t.assigned_to_name, t.owner_name, '') as owner_name,
  t.due_date::text as due_label,
  t.updated_at as sort_at
from public.v_corrective_action_task_directory t
where t.status <> 'closed'

union all

select
  'training_expiry'::text,
  tr.id::text,
  coalesce(tr.profile_name, 'Unknown worker') as primary_context,
  concat(tr.course_name, ' training expiry') as headline,
  case when tr.is_expired then 'expired' else 'expiring' end as queue_status,
  case when tr.is_expired then 'high' else 'medium' end as queue_priority,
  tr.profile_name as owner_name,
  coalesce(tr.expires_at::text, '') as due_label,
  tr.updated_at as sort_at
from public.v_training_record_directory tr
where tr.is_expired = true or tr.expires_within_30_days = true

union all

select
  'sds_acknowledgement'::text,
  sa.id::text,
  coalesce(sa.profile_name, 'Unknown worker') as primary_context,
  concat(coalesce(sa.chemical_name, 'Chemical'), ' SDS acknowledgement') as headline,
  case when sa.is_expired then 'expired' else 'acknowledged' end as queue_status,
  case when sa.is_expired then 'high' else 'medium' end as queue_priority,
  sa.profile_name as owner_name,
  coalesce(sa.expires_at::text, '') as due_label,
  sa.updated_at as sort_at
from public.v_sds_acknowledgement_directory sa
where sa.is_expired = true or sa.expires_within_30_days = true;


-- Synced from sql/092_management_workflows_and_subscriptions.sql
-- 092_management_workflows_and_subscriptions.sql
-- Adds management workflow depth on top of incident/corrective/training reporting:
-- - automated reminder / escalation fields for corrective actions and training
-- - worker self-service training acknowledgement support
-- - SDS prompts tied to product / job / route / equipment context
-- - site and supervisor scorecards
-- - report subscriptions and delivery candidates
-- - equipment-specific JSA / hazard-assessment linkage

alter table if exists public.corrective_action_tasks
  add column if not exists supervisor_profile_id uuid references public.profiles(id) on delete set null,
  add column if not exists reminder_count integer not null default 0,
  add column if not exists next_reminder_at timestamptz,
  add column if not exists escalation_due_at date,
  add column if not exists escalated_at timestamptz,
  add column if not exists escalation_notes text;

create index if not exists idx_corrective_action_tasks_supervisor
  on public.corrective_action_tasks(supervisor_profile_id, due_date, created_at desc);

alter table if exists public.training_courses
  add column if not exists self_service_enabled boolean not null default true,
  add column if not exists require_supervisor_verification boolean not null default false,
  add column if not exists sds_prompt_text text;

alter table if exists public.training_records
  add column if not exists self_attested boolean not null default false,
  add column if not exists self_attested_at date,
  add column if not exists acknowledgement_method text not null default 'admin_recorded',
  add column if not exists verified_by_profile_id uuid references public.profiles(id) on delete set null,
  add column if not exists verified_at date,
  add column if not exists reminder_last_sent_at timestamptz;

alter table if exists public.training_records
  drop constraint if exists training_records_acknowledgement_method_check;

alter table if exists public.training_records
  add constraint training_records_acknowledgement_method_check
  check (acknowledgement_method in ('admin_recorded','worker_self_ack','imported','system_generated'));

alter table if exists public.sds_acknowledgements
  add column if not exists product_context jsonb not null default '{}'::jsonb,
  add column if not exists equipment_code text,
  add column if not exists job_code text,
  add column if not exists work_order_number text,
  add column if not exists route_code text;

create table if not exists public.report_subscriptions (
  id uuid primary key default gen_random_uuid(),
  subscription_scope text not null default 'safety_reporting',
  subscription_name text not null,
  report_kind text not null default 'weekly_supervisor_summary',
  cadence text not null default 'weekly',
  delivery_channel text not null default 'email',
  target_role text,
  target_profile_id uuid references public.profiles(id) on delete set null,
  recipient_email text,
  report_preset_id uuid references public.report_presets(id) on delete set null,
  filter_payload jsonb not null default '{}'::jsonb,
  include_csv boolean not null default true,
  is_active boolean not null default true,
  last_sent_at timestamptz,
  next_send_at timestamptz,
  last_status text,
  notes text,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists public.report_subscriptions
  drop constraint if exists report_subscriptions_scope_check;
alter table if exists public.report_subscriptions
  add constraint report_subscriptions_scope_check
  check (subscription_scope in ('safety_reporting'));

alter table if exists public.report_subscriptions
  drop constraint if exists report_subscriptions_kind_check;
alter table if exists public.report_subscriptions
  add constraint report_subscriptions_kind_check
  check (report_kind in ('weekly_supervisor_summary','overdue_corrective_actions','training_expiry_30_days','rejected_evidence_followup','incident_near_miss_summary'));

alter table if exists public.report_subscriptions
  drop constraint if exists report_subscriptions_cadence_check;
alter table if exists public.report_subscriptions
  add constraint report_subscriptions_cadence_check
  check (cadence in ('daily','weekly','monthly'));

alter table if exists public.report_subscriptions
  drop constraint if exists report_subscriptions_delivery_channel_check;
alter table if exists public.report_subscriptions
  add constraint report_subscriptions_delivery_channel_check
  check (delivery_channel in ('email','in_app'));

create index if not exists idx_report_subscriptions_active_next_send
  on public.report_subscriptions(is_active, next_send_at, cadence);

create table if not exists public.equipment_jsa_hazard_links (
  id uuid primary key default gen_random_uuid(),
  source_submission_id bigint references public.submissions(id) on delete set null,
  linked_hse_packet_id uuid references public.linked_hse_packets(id) on delete set null,
  equipment_code text,
  job_code text,
  work_order_number text,
  route_code text,
  hazard_title text not null,
  hazard_summary text,
  jsa_required boolean not null default true,
  status text not null default 'open',
  review_due_date date,
  completed_at date,
  notes text,
  payload jsonb not null default '{}'::jsonb,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists public.equipment_jsa_hazard_links
  drop constraint if exists equipment_jsa_hazard_links_status_check;
alter table if exists public.equipment_jsa_hazard_links
  add constraint equipment_jsa_hazard_links_status_check
  check (status in ('open','in_review','ready','closed','cancelled'));

create index if not exists idx_equipment_jsa_hazard_links_due
  on public.equipment_jsa_hazard_links(status, review_due_date, created_at desc);

insert into public.equipment_jsa_hazard_links (
  source_submission_id,
  equipment_code,
  job_code,
  work_order_number,
  route_code,
  hazard_title,
  hazard_summary,
  jsa_required,
  status,
  review_due_date,
  payload,
  created_at,
  updated_at
)
select
  inc.submission_id,
  nullif(inc.equipment_code, ''),
  nullif(inc.job_code, ''),
  nullif(inc.work_order_number, ''),
  nullif(inc.route_code, ''),
  left(coalesce(nullif(inc.event_summary, ''), 'Hazard / JSA review'), 160),
  nullif(inc.root_cause_summary, ''),
  true,
  'open',
  case
    when nullif(inc.corrective_action_due_date, '') is not null then nullif(inc.corrective_action_due_date, '')::date
    else current_date + 14
  end,
  jsonb_build_object(
    'source', '092_backfill',
    'incident_kind', inc.incident_kind,
    'severity', inc.severity,
    'site_label', inc.site_label,
    'worker_name', inc.worker_name
  ),
  coalesce(inc.created_at, now()),
  now()
from public.v_incident_near_miss_history inc
where coalesce(nullif(inc.equipment_code, ''), '') <> ''
  and not exists (
    select 1 from public.equipment_jsa_hazard_links j
    where j.source_submission_id = inc.submission_id
      and coalesce(j.equipment_code, '') = coalesce(inc.equipment_code, '')
  );

create or replace view public.v_corrective_action_task_directory as
with event_rollup as (
  select
    e.task_id,
    count(*)::int as event_count,
    max(e.created_at) as last_event_at,
    (array_agg(e.event_type order by e.created_at desc nulls last))[1] as last_event_type,
    (array_agg(e.event_notes order by e.created_at desc nulls last))[1] as last_event_notes,
    (array_agg(coalesce(p.full_name, p.email, e.changed_by_profile_id::text) order by e.created_at desc nulls last))[1] as last_changed_by_name
  from public.corrective_action_task_events e
  left join public.profiles p on p.id = e.changed_by_profile_id
  group by e.task_id
)
select
  -- keep old 091 column order first
  t.id,
  t.source_submission_id,
  t.source_history_type,
  t.source_record_number,
  t.task_scope,
  t.task_title,
  t.task_description,
  t.priority,
  t.status,
  t.assigned_to_profile_id,
  coalesce(ap.full_name, ap.email, '') as assigned_to_name,
  t.assigned_by_profile_id,
  coalesce(bp.full_name, bp.email, '') as assigned_by_name,
  t.owner_name,
  t.due_date,
  t.started_at,
  t.completed_at,
  t.escalation_level,
  t.reminder_last_sent_at,
  t.closeout_notes,
  t.payload,
  t.created_at,
  t.updated_at,
  inc.submission_date,
  inc.site_id,
  inc.site_code,
  inc.site_name,
  inc.site_label,
  inc.worker_name,
  inc.job_code,
  inc.work_order_number,
  inc.route_code,
  inc.event_summary,
  inc.immediate_actions_taken,
  inc.root_cause_summary,
  inc.incident_kind,
  inc.severity,
  case when t.status <> 'closed' and t.due_date is not null and t.due_date < current_date then true else false end as is_overdue,
  greatest(0, current_date - coalesce(t.due_date, current_date))::int as days_overdue,
  coalesce(er.event_count, 0) as event_count,
  er.last_event_at,
  er.last_event_type,
  er.last_event_notes,
  er.last_changed_by_name,
  -- append new columns only
  t.supervisor_profile_id,
  coalesce(sp.full_name, sp.email, '') as supervisor_name,
  t.reminder_count,
  t.next_reminder_at,
  t.escalation_due_at,
  t.escalated_at,
  t.escalation_notes,
  case when t.status <> 'closed' and t.due_date is not null and t.due_date between current_date and current_date + 7 then true else false end as is_due_within_7_days,
  case when t.status <> 'closed' and t.next_reminder_at is not null and t.next_reminder_at <= now() then true else false end as reminder_due,
  case when t.status <> 'closed' and t.escalation_due_at is not null and t.escalation_due_at <= current_date then true else false end as escalation_due
from public.corrective_action_tasks t
left join public.profiles ap on ap.id = t.assigned_to_profile_id
left join public.profiles bp on bp.id = t.assigned_by_profile_id
left join public.profiles sp on sp.id = t.supervisor_profile_id
left join public.v_incident_near_miss_history inc on inc.submission_id = t.source_submission_id
left join event_rollup er on er.task_id = t.id;

create or replace view public.v_training_course_directory as
select
  -- keep old order first
  tc.id,
  tc.course_code,
  tc.course_name,
  tc.category,
  tc.validity_months,
  tc.reminder_days_before,
  tc.requires_sds_acknowledgement,
  tc.is_active,
  tc.notes,
  tc.created_at,
  tc.updated_at,
  -- append new columns
  tc.self_service_enabled,
  tc.require_supervisor_verification,
  tc.sds_prompt_text
from public.training_courses tc
where tc.is_active = true;

create or replace view public.v_training_record_directory as
select
  -- keep old order first
  tr.id,
  tr.profile_id,
  coalesce(p.full_name, p.email, '') as profile_name,
  p.role as profile_role,
  p.employee_number,
  tr.course_id,
  tc.course_code,
  tc.course_name,
  tc.category,
  tc.validity_months,
  tc.reminder_days_before,
  tc.requires_sds_acknowledgement,
  tr.completion_status,
  tr.completed_at,
  tr.expires_at,
  tr.trainer_name,
  tr.provider_name,
  tr.certificate_number,
  tr.license_number,
  tr.source_submission_id,
  tr.notes,
  tr.created_by_profile_id,
  coalesce(cp.full_name, cp.email, '') as created_by_name,
  tr.created_at,
  tr.updated_at,
  case when tr.expires_at is not null and tr.expires_at < current_date then true else false end as is_expired,
  case when tr.expires_at is not null and tr.expires_at between current_date and current_date + interval '30 days' then true else false end as expires_within_30_days,
  case when tr.expires_at is not null then greatest(0, tr.expires_at - current_date)::int else null end as days_until_expiry,
  -- append new columns
  tr.self_attested,
  tr.self_attested_at,
  tr.acknowledgement_method,
  tr.verified_by_profile_id,
  coalesce(vp.full_name, vp.email, '') as verified_by_name,
  tr.verified_at,
  tr.reminder_last_sent_at,
  case when tr.self_attested = true and tr.verified_at is null and tc.require_supervisor_verification = true then true else false end as verification_pending,
  case when tr.expires_at is not null and tr.expires_at between current_date and current_date + 7 then true else false end as expires_within_7_days
from public.training_records tr
left join public.profiles p on p.id = tr.profile_id
left join public.training_courses tc on tc.id = tr.course_id
left join public.profiles cp on cp.id = tr.created_by_profile_id
left join public.profiles vp on vp.id = tr.verified_by_profile_id;

create or replace view public.v_sds_acknowledgement_directory as
select
  -- keep old order first
  sa.id,
  sa.profile_id,
  coalesce(p.full_name, p.email, '') as profile_name,
  p.employee_number,
  sa.chemical_name,
  sa.product_name,
  sa.vendor_name,
  sa.sds_revision_date,
  sa.acknowledged_at,
  sa.expires_at,
  sa.status,
  sa.source_submission_id,
  sa.linked_training_record_id,
  sa.acknowledged_by_profile_id,
  coalesce(ap.full_name, ap.email, '') as acknowledged_by_name,
  sa.notes,
  sa.created_at,
  sa.updated_at,
  case when sa.expires_at is not null and sa.expires_at < current_date then true else false end as is_expired,
  case when sa.expires_at is not null and sa.expires_at between current_date and current_date + interval '30 days' then true else false end as expires_within_30_days,
  -- append new columns
  sa.product_context,
  sa.equipment_code,
  sa.job_code,
  sa.work_order_number,
  sa.route_code,
  trim(both ' ' from concat(
    coalesce(sa.product_name, sa.chemical_name, ''),
    case when coalesce(sa.job_code, sa.work_order_number, sa.route_code, sa.equipment_code, '') <> '' then ' • ' else '' end,
    concat_ws(' / ', nullif(sa.job_code, ''), nullif(sa.work_order_number, ''), nullif(sa.route_code, ''), nullif(sa.equipment_code, ''))
  )) as prompt_context_label,
  case when sa.expires_at is not null and sa.expires_at between current_date and current_date + 7 then true else false end as expires_within_7_days
from public.sds_acknowledgements sa
left join public.profiles p on p.id = sa.profile_id
left join public.profiles ap on ap.id = sa.acknowledged_by_profile_id;

create or replace view public.v_report_subscription_directory as
select
  rs.id,
  rs.subscription_scope,
  rs.subscription_name,
  rs.report_kind,
  rs.cadence,
  rs.delivery_channel,
  rs.target_role,
  rs.target_profile_id,
  coalesce(tp.full_name, tp.email, '') as target_profile_name,
  rs.recipient_email,
  rs.report_preset_id,
  coalesce(rp.preset_name, '') as report_preset_name,
  rs.filter_payload,
  rs.include_csv,
  rs.is_active,
  rs.last_sent_at,
  rs.next_send_at,
  rs.last_status,
  rs.notes,
  rs.created_by_profile_id,
  coalesce(cp.full_name, cp.email, '') as created_by_name,
  rs.created_at,
  rs.updated_at,
  case when rs.is_active = true and rs.next_send_at is not null and rs.next_send_at <= now() then true else false end as send_due
from public.report_subscriptions rs
left join public.profiles tp on tp.id = rs.target_profile_id
left join public.report_presets rp on rp.id = rs.report_preset_id
left join public.profiles cp on cp.id = rs.created_by_profile_id;

create or replace view public.v_report_delivery_candidates as
select
  id,
  subscription_scope,
  subscription_name,
  report_kind,
  cadence,
  delivery_channel,
  target_role,
  target_profile_id,
  target_profile_name,
  recipient_email,
  report_preset_id,
  report_preset_name,
  filter_payload,
  include_csv,
  next_send_at,
  last_sent_at,
  last_status,
  notes
from public.v_report_subscription_directory
where is_active = true
  and send_due = true;

create or replace view public.v_equipment_jsa_hazard_link_directory as
select
  j.id,
  j.source_submission_id,
  j.linked_hse_packet_id,
  j.equipment_code,
  j.job_code,
  j.work_order_number,
  j.route_code,
  j.hazard_title,
  j.hazard_summary,
  j.jsa_required,
  j.status,
  j.review_due_date,
  j.completed_at,
  j.notes,
  j.payload,
  j.created_by_profile_id,
  coalesce(cp.full_name, cp.email, '') as created_by_name,
  j.created_at,
  j.updated_at,
  case when j.status <> 'closed' and j.review_due_date is not null and j.review_due_date < current_date then true else false end as is_overdue,
  coalesce(lp.packet_number, '') as linked_packet_number
from public.equipment_jsa_hazard_links j
left join public.profiles cp on cp.id = j.created_by_profile_id
left join public.linked_hse_packets lp on lp.id = j.linked_hse_packet_id;

create or replace view public.v_site_safety_scorecards as
with submission_rollup as (
  select
    coalesce(site_id::text, site_label, site_name, site_code, 'unknown') as site_ref,
    max(site_id) as site_id,
    max(site_code) as site_code,
    max(site_name) as site_name,
    max(site_label) as site_label,
    count(*)::int as submission_count,
    count(*) filter (where form_key = 'incident')::int as incident_count,
    count(*) filter (where coalesce(last_review_action, '') = 'rejected' or coalesce(status, '') = 'rejected')::int as rejected_count,
    max(submission_date) as last_submission_date
  from public.v_hse_submission_history_report
  group by coalesce(site_id::text, site_label, site_name, site_code, 'unknown')
), corrective_rollup as (
  select
    coalesce(site_id::text, site_label, site_name, site_code, 'unknown') as site_ref,
    count(*) filter (where status <> 'closed')::int as open_corrective_count,
    count(*) filter (where is_overdue = true)::int as overdue_corrective_count,
    count(*) filter (where reminder_due = true or escalation_due = true)::int as escalation_attention_count
  from public.v_corrective_action_task_directory
  group by coalesce(site_id::text, site_label, site_name, site_code, 'unknown')
)
select
  sr.site_ref,
  sr.site_id,
  sr.site_code,
  sr.site_name,
  sr.site_label,
  sr.submission_count,
  sr.incident_count,
  sr.rejected_count,
  coalesce(cr.open_corrective_count, 0) as open_corrective_count,
  coalesce(cr.overdue_corrective_count, 0) as overdue_corrective_count,
  coalesce(cr.escalation_attention_count, 0) as escalation_attention_count,
  sr.last_submission_date,
  case
    when coalesce(cr.overdue_corrective_count, 0) > 0 then 'high'
    when sr.rejected_count > 0 then 'medium'
    else 'normal'
  end as scorecard_status
from submission_rollup sr
left join corrective_rollup cr on cr.site_ref = sr.site_ref;

create or replace view public.v_supervisor_scorecards as
with corrective_rollup as (
  select
    coalesce(supervisor_profile_id::text, assigned_to_profile_id::text, 'unassigned') as supervisor_ref,
    max(supervisor_profile_id) as supervisor_profile_id,
    count(*)::int as task_count,
    count(*) filter (where status <> 'closed')::int as open_task_count,
    count(*) filter (where is_overdue = true)::int as overdue_task_count,
    count(*) filter (where reminder_due = true or escalation_due = true)::int as reminder_or_escalation_count,
    max(updated_at) as last_activity_at
  from public.v_corrective_action_task_directory
  group by coalesce(supervisor_profile_id::text, assigned_to_profile_id::text, 'unassigned')
), training_rollup as (
  select
    p.default_supervisor_profile_id as supervisor_profile_id,
    count(*) filter (where is_expired = true)::int as expired_training_count,
    count(*) filter (where expires_within_30_days = true)::int as expiring_training_count,
    count(*) filter (where verification_pending = true)::int as verification_pending_count
  from public.v_training_record_directory tr
  left join public.profiles p on p.id = tr.profile_id
  group by p.default_supervisor_profile_id
), sds_rollup as (
  select
    p.default_supervisor_profile_id as supervisor_profile_id,
    count(*) filter (where is_expired = true)::int as expired_sds_count,
    count(*) filter (where expires_within_30_days = true)::int as expiring_sds_count
  from public.v_sds_acknowledgement_directory sa
  left join public.profiles p on p.id = sa.profile_id
  group by p.default_supervisor_profile_id
)
select
  coalesce(cr.supervisor_profile_id, tr.supervisor_profile_id, sr.supervisor_profile_id) as supervisor_profile_id,
  coalesce(pp.full_name, pp.email, 'Unassigned supervisor') as supervisor_name,
  coalesce(cr.task_count, 0) as task_count,
  coalesce(cr.open_task_count, 0) as open_task_count,
  coalesce(cr.overdue_task_count, 0) as overdue_task_count,
  coalesce(cr.reminder_or_escalation_count, 0) as reminder_or_escalation_count,
  coalesce(tr.expired_training_count, 0) as expired_training_count,
  coalesce(tr.expiring_training_count, 0) as expiring_training_count,
  coalesce(tr.verification_pending_count, 0) as verification_pending_count,
  coalesce(sr.expired_sds_count, 0) as expired_sds_count,
  coalesce(sr.expiring_sds_count, 0) as expiring_sds_count,
  cr.last_activity_at,
  case
    when coalesce(cr.overdue_task_count, 0) > 0 or coalesce(tr.expired_training_count, 0) > 0 or coalesce(sr.expired_sds_count, 0) > 0 then 'high'
    when coalesce(cr.reminder_or_escalation_count, 0) > 0 or coalesce(tr.expiring_training_count, 0) > 0 or coalesce(sr.expiring_sds_count, 0) > 0 then 'medium'
    else 'normal'
  end as scorecard_status
from corrective_rollup cr
full outer join training_rollup tr on tr.supervisor_profile_id = cr.supervisor_profile_id
full outer join sds_rollup sr on sr.supervisor_profile_id = coalesce(cr.supervisor_profile_id, tr.supervisor_profile_id)
left join public.profiles pp on pp.id = coalesce(cr.supervisor_profile_id, tr.supervisor_profile_id, sr.supervisor_profile_id);

create or replace view public.v_overdue_action_alerts as
select
  'corrective_action'::text as alert_type,
  id::text as alert_id,
  coalesce(site_label, site_name, site_code, 'Unknown site') as primary_context,
  task_title as headline,
  status as alert_status,
  priority as alert_priority,
  coalesce(assigned_to_name, owner_name, '') as owner_name,
  coalesce(due_date::text, '') as due_label,
  updated_at as sort_at
from public.v_corrective_action_task_directory
where status <> 'closed' and (is_overdue = true or reminder_due = true or escalation_due = true)

union all

select
  'training_expiry'::text,
  id::text,
  coalesce(profile_name, 'Unknown worker') as primary_context,
  concat(course_name, ' training follow-up') as headline,
  case when is_expired then 'expired' else 'expiring' end as alert_status,
  case when is_expired then 'high' else 'medium' end as alert_priority,
  profile_name as owner_name,
  coalesce(expires_at::text, '') as due_label,
  updated_at as sort_at
from public.v_training_record_directory
where is_expired = true or expires_within_7_days = true or verification_pending = true

union all

select
  'sds_acknowledgement'::text,
  id::text,
  coalesce(profile_name, 'Unknown worker') as primary_context,
  concat(coalesce(product_name, chemical_name, 'Product'), ' SDS prompt') as headline,
  case when is_expired then 'expired' else 'expiring' end as alert_status,
  case when is_expired then 'high' else 'medium' end as alert_priority,
  profile_name as owner_name,
  coalesce(expires_at::text, '') as due_label,
  updated_at as sort_at
from public.v_sds_acknowledgement_directory
where is_expired = true or expires_within_7_days = true

union all

select
  'report_subscription'::text,
  id::text,
  coalesce(target_profile_name, recipient_email, target_role, 'Report recipient') as primary_context,
  subscription_name as headline,
  coalesce(last_status, 'pending') as alert_status,
  'medium'::text as alert_priority,
  coalesce(target_profile_name, recipient_email, '') as owner_name,
  coalesce(next_send_at::text, '') as due_label,
  updated_at as sort_at
from public.v_report_subscription_directory
where send_due = true

union all

select
  'jsa_hazard_review'::text,
  id::text,
  coalesce(equipment_code, job_code, work_order_number, route_code, 'Equipment / work context') as primary_context,
  hazard_title as headline,
  status as alert_status,
  case when is_overdue then 'high' else 'medium' end as alert_priority,
  '' as owner_name,
  coalesce(review_due_date::text, '') as due_label,
  updated_at as sort_at
from public.v_equipment_jsa_hazard_link_directory
where status <> 'closed' and (is_overdue = true or review_due_date between current_date and current_date + 7);

create or replace view public.v_supervisor_safety_queue as
select
  -- keep old 091 column order first
  'corrective_action'::text as queue_type,
  t.id::text as queue_id,
  coalesce(t.site_label, 'Unknown site') as primary_context,
  coalesce(t.task_title, 'Corrective action') as headline,
  coalesce(t.status, 'open') as queue_status,
  t.priority as queue_priority,
  coalesce(t.assigned_to_name, t.owner_name, '') as owner_name,
  t.due_date::text as due_label,
  t.updated_at as sort_at,
  -- append new columns
  coalesce(t.site_code, '') as site_code,
  coalesce(t.site_name, '') as site_name,
  coalesce(t.job_code, '') as job_code,
  coalesce(t.work_order_number, '') as work_order_number,
  coalesce(t.route_code, '') as route_code,
  coalesce(t.supervisor_name, '') as supervisor_name
from public.v_corrective_action_task_directory t
where t.status <> 'closed'

union all

select
  'training_expiry'::text,
  tr.id::text,
  coalesce(tr.profile_name, 'Unknown worker') as primary_context,
  concat(tr.course_name, ' training expiry') as headline,
  case when tr.is_expired then 'expired' when tr.verification_pending then 'verification_pending' else 'expiring' end as queue_status,
  case when tr.is_expired then 'high' else 'medium' end as queue_priority,
  tr.profile_name as owner_name,
  coalesce(tr.expires_at::text, '') as due_label,
  tr.updated_at as sort_at,
  '' as site_code,
  '' as site_name,
  '' as job_code,
  '' as work_order_number,
  '' as route_code,
  '' as supervisor_name
from public.v_training_record_directory tr
where tr.is_expired = true or tr.expires_within_30_days = true or tr.verification_pending = true

union all

select
  'sds_acknowledgement'::text,
  sa.id::text,
  coalesce(sa.profile_name, 'Unknown worker') as primary_context,
  concat(coalesce(sa.chemical_name, 'Chemical'), ' SDS acknowledgement') as headline,
  case when sa.is_expired then 'expired' else 'acknowledged' end as queue_status,
  case when sa.is_expired then 'high' else 'medium' end as queue_priority,
  sa.profile_name as owner_name,
  coalesce(sa.expires_at::text, '') as due_label,
  sa.updated_at as sort_at,
  '' as site_code,
  '' as site_name,
  coalesce(sa.job_code, '') as job_code,
  coalesce(sa.work_order_number, '') as work_order_number,
  coalesce(sa.route_code, '') as route_code,
  '' as supervisor_name
from public.v_sds_acknowledgement_directory sa
where sa.is_expired = true or sa.expires_within_30_days = true

union all

select
  'report_subscription'::text,
  rs.id::text,
  coalesce(rs.target_profile_name, rs.recipient_email, rs.target_role, 'Report recipient') as primary_context,
  rs.subscription_name as headline,
  coalesce(rs.last_status, 'pending') as queue_status,
  'medium'::text as queue_priority,
  coalesce(rs.target_profile_name, rs.recipient_email, '') as owner_name,
  coalesce(rs.next_send_at::text, '') as due_label,
  rs.updated_at as sort_at,
  '' as site_code,
  '' as site_name,
  '' as job_code,
  '' as work_order_number,
  '' as route_code,
  '' as supervisor_name
from public.v_report_subscription_directory rs
where rs.send_due = true

union all

select
  'jsa_hazard_review'::text,
  j.id::text,
  coalesce(j.equipment_code, j.job_code, j.work_order_number, j.route_code, 'Equipment / work context') as primary_context,
  j.hazard_title as headline,
  j.status as queue_status,
  case when j.is_overdue then 'high' else 'medium' end as queue_priority,
  '' as owner_name,
  coalesce(j.review_due_date::text, '') as due_label,
  j.updated_at as sort_at,
  '' as site_code,
  '' as site_name,
  coalesce(j.job_code, '') as job_code,
  coalesce(j.work_order_number, '') as work_order_number,
  coalesce(j.route_code, '') as route_code,
  '' as supervisor_name
from public.v_equipment_jsa_hazard_link_directory j
where j.status <> 'closed' and (j.is_overdue = true or j.review_due_date between current_date and current_date + 30);

-- 093_report_delivery_and_worker_self_service.sql
-- Adds:
-- - scheduled report delivery plumbing and run history
-- - worker self-service SDS prompt queue
-- - supervisor/admin delivery reporting support

create table if not exists public.report_delivery_runs (
  id uuid primary key default gen_random_uuid(),
  run_code text not null unique,
  setting_code text not null default 'default',
  subscription_id uuid references public.report_subscriptions(id) on delete set null,
  subscription_name text,
  report_kind text,
  delivery_channel text,
  recipient_profile_id uuid references public.profiles(id) on delete set null,
  recipient_email text,
  run_status text not null default 'queued',
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  sent_count integer not null default 0,
  failed_count integer not null default 0,
  attachment_count integer not null default 0,
  delivery_subject text,
  delivery_summary text,
  payload jsonb not null default '{}'::jsonb,
  error_text text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists public.report_delivery_runs
  drop constraint if exists report_delivery_runs_status_check;

alter table if exists public.report_delivery_runs
  add constraint report_delivery_runs_status_check
  check (run_status in ('queued','running','completed','partial','failed','skipped'));

create index if not exists idx_report_delivery_runs_subscription
  on public.report_delivery_runs(subscription_id, started_at desc);

create index if not exists idx_report_delivery_runs_status
  on public.report_delivery_runs(run_status, started_at desc);

create table if not exists public.report_delivery_scheduler_settings (
  id uuid primary key default gen_random_uuid(),
  setting_code text not null unique,
  is_enabled boolean not null default false,
  run_timezone text not null default 'America/Toronto',
  cadence text not null default 'hourly',
  run_hour_local integer not null default 7,
  run_minute_local integer not null default 0,
  invoke_url text,
  last_run_at timestamptz,
  next_run_at timestamptz,
  last_dispatch_at timestamptz,
  last_dispatch_request_id bigint,
  last_dispatch_status text,
  last_dispatch_notes text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists public.report_delivery_scheduler_settings
  drop constraint if exists report_delivery_scheduler_settings_cadence_check;

alter table if exists public.report_delivery_scheduler_settings
  add constraint report_delivery_scheduler_settings_cadence_check
  check (cadence in ('manual','hourly','daily','weekly'));

alter table if exists public.report_delivery_scheduler_settings
  drop constraint if exists report_delivery_scheduler_settings_last_dispatch_status_check;

alter table if exists public.report_delivery_scheduler_settings
  add constraint report_delivery_scheduler_settings_last_dispatch_status_check
  check (last_dispatch_status in ('queued','completed','failed') or last_dispatch_status is null);

insert into public.report_delivery_scheduler_settings (
  setting_code,
  is_enabled,
  run_timezone,
  cadence,
  run_hour_local,
  run_minute_local,
  notes
)
select
  'default',
  false,
  'America/Toronto',
  'hourly',
  7,
  0,
  'Deploy report-subscription-delivery-run, set invoke_url, then enable this scheduler row.'
where not exists (
  select 1 from public.report_delivery_scheduler_settings where setting_code = 'default'
);

create or replace function public.dispatch_due_report_delivery_scheduler_runs()
returns integer
language plpgsql
security definer
as $$
declare
  v_secret text := null;
  v_dispatched integer := 0;
  v_request_id bigint;
  r record;
begin
  begin
    execute $sql$
      select decrypted_secret
      from vault.decrypted_secrets
      where name = 'service_execution_scheduler_secret'
      limit 1
    $sql$
    into v_secret;
  exception
    when undefined_table or invalid_schema_name then
      v_secret := null;
  end;

  if coalesce(v_secret, '') = '' then
    v_secret := nullif(current_setting('app.settings.service_execution_scheduler_secret', true), '');
  end if;

  if coalesce(v_secret, '') = '' then
    update public.report_delivery_scheduler_settings
    set
      last_dispatch_status = 'failed',
      last_dispatch_notes = 'Missing scheduler secret. Checked Vault first, then app.settings.service_execution_scheduler_secret.',
      updated_at = now()
    where is_enabled = true
      and coalesce(invoke_url, '') <> ''
      and coalesce(next_run_at, now()) <= now();
    return 0;
  end if;

  for r in
    select *
    from public.report_delivery_scheduler_settings
    where is_enabled = true
      and cadence <> 'manual'
      and coalesce(invoke_url, '') <> ''
      and coalesce(next_run_at, now()) <= now()
      and not (
        coalesce(last_dispatch_status, '') = 'queued'
        and coalesce(last_dispatch_at, now() - interval '100 years') > now() - interval '10 minutes'
      )
    order by next_run_at nulls first, created_at
    for update skip locked
  loop
    begin
      select net.http_post(
        url := r.invoke_url,
        headers := jsonb_build_object(
          'content-type', 'application/json',
          'x-scheduler-secret', v_secret
        ),
        body := jsonb_build_object('setting_code', r.setting_code)
      ) into v_request_id;

      update public.report_delivery_scheduler_settings
      set
        last_dispatch_at = now(),
        last_dispatch_request_id = v_request_id,
        last_dispatch_status = 'queued',
        last_dispatch_notes = 'Queued through pg_cron/pg_net dispatcher.',
        updated_at = now()
      where id = r.id;

      v_dispatched := v_dispatched + 1;
    exception when others then
      update public.report_delivery_scheduler_settings
      set
        last_dispatch_at = now(),
        last_dispatch_status = 'failed',
        last_dispatch_notes = left(sqlerrm, 1000),
        updated_at = now()
      where id = r.id;
    end;
  end loop;

  return v_dispatched;
end;
$$;

do $dispatch$
begin
  begin
    perform cron.unschedule('report_subscription_delivery_dispatch_default');
  exception when others then
    null;
  end;

  perform cron.schedule(
    'report_subscription_delivery_dispatch_default',
    '* * * * *',
    $job$select public.dispatch_due_report_delivery_scheduler_runs();$job$
  );
exception when others then
  null;
end;
$dispatch$;

update public.report_delivery_scheduler_settings
set next_run_at = public.compute_service_execution_scheduler_next_run_at(
  run_timezone,
  cadence,
  run_hour_local,
  run_minute_local,
  now()
)
where is_enabled = true
  and cadence <> 'manual'
  and next_run_at is null;

create or replace view public.v_report_delivery_scheduler_status as
with latest_run as (
  select distinct on (coalesce(setting_code, 'default'))
    coalesce(setting_code, 'default') as setting_key,
    id,
    run_code,
    run_status,
    sent_count,
    failed_count,
    attachment_count,
    delivery_subject,
    delivery_summary,
    started_at,
    completed_at,
    updated_at
  from public.report_delivery_runs
  order by coalesce(setting_code, 'default'), started_at desc
)
select
  s.id,
  s.setting_code,
  s.is_enabled,
  s.run_timezone,
  s.cadence,
  s.run_hour_local,
  s.run_minute_local,
  s.last_run_at,
  s.next_run_at,
  s.notes,
  lr.id as latest_run_id,
  lr.run_code as latest_run_code,
  lr.run_status as latest_run_status,
  lr.sent_count as latest_sent_count,
  lr.failed_count as latest_failed_count,
  lr.attachment_count as latest_attachment_count,
  lr.delivery_subject as latest_delivery_subject,
  lr.delivery_summary as latest_delivery_summary,
  lr.started_at as latest_started_at,
  lr.completed_at as latest_completed_at,
  case
    when s.is_enabled = true and s.next_run_at is not null and s.next_run_at <= now() then true
    else false
  end as is_due,
  s.invoke_url,
  s.last_dispatch_at,
  s.last_dispatch_request_id,
  s.last_dispatch_status,
  s.last_dispatch_notes
from public.report_delivery_scheduler_settings s
left join latest_run lr on lr.setting_key = s.setting_code;

create or replace view public.v_report_delivery_run_history as
select
  r.id,
  r.run_code,
  r.setting_code,
  r.subscription_id,
  r.subscription_name,
  r.report_kind,
  r.delivery_channel,
  r.recipient_profile_id,
  coalesce(p.full_name, p.email, '') as recipient_profile_name,
  r.recipient_email,
  r.run_status,
  r.started_at,
  r.completed_at,
  r.sent_count,
  r.failed_count,
  r.attachment_count,
  r.delivery_subject,
  r.delivery_summary,
  r.error_text,
  r.payload,
  r.created_at,
  r.updated_at
from public.report_delivery_runs r
left join public.profiles p on p.id = r.recipient_profile_id;

create or replace view public.v_worker_sds_prompt_queue as
with latest_sds as (
  select distinct on (sa.profile_id, sa.linked_training_record_id)
    sa.profile_id,
    sa.linked_training_record_id,
    sa.id as sds_acknowledgement_id,
    sa.product_name,
    sa.chemical_name,
    sa.vendor_name,
    sa.status,
    sa.acknowledged_at,
    sa.expires_at,
    sa.is_expired,
    sa.expires_within_7_days,
    sa.job_code,
    sa.work_order_number,
    sa.route_code,
    sa.equipment_code,
    sa.prompt_context_label,
    sa.updated_at
  from public.v_sds_acknowledgement_directory sa
  order by sa.profile_id, sa.linked_training_record_id, coalesce(sa.acknowledged_at, sa.updated_at, sa.created_at) desc nulls last
)
select
  tr.profile_id,
  tr.profile_name,
  tr.employee_number,
  tr.id as training_record_id,
  tr.course_id,
  tr.course_code,
  tr.course_name,
  tc.sds_prompt_text,
  tr.completed_at,
  tr.expires_at as training_expires_at,
  ls.sds_acknowledgement_id,
  coalesce(ls.product_name, tc.course_name) as product_name,
  ls.chemical_name,
  ls.vendor_name,
  ls.status as sds_status,
  ls.acknowledged_at,
  ls.expires_at,
  ls.job_code,
  ls.work_order_number,
  ls.route_code,
  ls.equipment_code,
  coalesce(ls.prompt_context_label, tc.sds_prompt_text, tc.course_name) as prompt_context_label,
  case
    when ls.sds_acknowledgement_id is null then true
    when coalesce(ls.is_expired, false) = true then true
    when coalesce(ls.expires_within_7_days, false) = true then true
    else false
  end as prompt_due,
  case
    when ls.sds_acknowledgement_id is null then 'missing'
    when coalesce(ls.is_expired, false) = true then 'expired'
    when coalesce(ls.expires_within_7_days, false) = true then 'expiring'
    else 'current'
  end as prompt_status
from public.v_training_record_directory tr
left join public.training_courses tc on tc.id = tr.course_id
left join latest_sds ls on ls.profile_id = tr.profile_id and ls.linked_training_record_id = tr.id
where coalesce(tc.requires_sds_acknowledgement, false) = true
  and coalesce(tr.completion_status, '') = 'completed';


-- 094_jobs_commercial_completion_and_accounting_ready.sql
-- 094_jobs_commercial_completion_and_accounting_ready.sql
-- Expands Jobs into a fuller commercial workflow:
-- - quote / estimate approval discipline
-- - estimate and work-order costing support
-- - completion review and accounting-ready queue
-- - commercial approval history and closeout evaluation

alter table if exists public.estimates
  add column if not exists quote_title text,
  add column if not exists pricing_basis_label text,
  add column if not exists discount_mode text not null default 'none',
  add column if not exists discount_value numeric(12,2) not null default 0,
  add column if not exists margin_estimate_total numeric(12,2) not null default 0,
  add column if not exists margin_estimate_percent numeric(7,2) not null default 0,
  add column if not exists approval_status text not null default 'draft',
  add column if not exists approval_required boolean not null default false,
  add column if not exists approval_requested_at timestamptz,
  add column if not exists approved_by_profile_id uuid references public.profiles(id) on delete set null,
  add column if not exists approved_at timestamptz,
  add column if not exists client_notes text,
  add column if not exists internal_notes text,
  add column if not exists converted_job_id bigint references public.jobs(id) on delete set null,
  add column if not exists converted_work_order_id uuid references public.work_orders(id) on delete set null,
  add column if not exists converted_at timestamptz;

alter table if exists public.estimates
  drop constraint if exists estimates_discount_mode_check;
alter table if exists public.estimates
  add constraint estimates_discount_mode_check
  check (discount_mode in ('none','percent','fixed','tiered'));

alter table if exists public.estimates
  drop constraint if exists estimates_approval_status_check;
alter table if exists public.estimates
  add constraint estimates_approval_status_check
  check (approval_status in ('draft','pending','approved','rejected','converted'));

alter table if exists public.estimate_lines
  add column if not exists discount_percent numeric(7,2) not null default 0,
  add column if not exists discount_amount numeric(12,2) not null default 0,
  add column if not exists cost_total numeric(12,2) not null default 0,
  add column if not exists margin_total numeric(12,2) not null default 0,
  add column if not exists margin_percent numeric(7,2) not null default 0,
  add column if not exists pricing_basis_label text,
  add column if not exists client_visible boolean not null default true;

alter table if exists public.work_orders
  add column if not exists discount_mode text not null default 'none',
  add column if not exists discount_value numeric(12,2) not null default 0,
  add column if not exists pricing_basis_label text,
  add column if not exists margin_estimate_total numeric(12,2) not null default 0,
  add column if not exists margin_estimate_percent numeric(7,2) not null default 0,
  add column if not exists approval_status text not null default 'draft',
  add column if not exists approval_required boolean not null default false,
  add column if not exists approval_requested_at timestamptz,
  add column if not exists approved_by_profile_id uuid references public.profiles(id) on delete set null,
  add column if not exists approved_at timestamptz,
  add column if not exists internal_notes text,
  add column if not exists completion_review_status text not null default 'draft',
  add column if not exists completion_ready_for_accounting boolean not null default false,
  add column if not exists completion_ready_at timestamptz,
  add column if not exists accounting_trigger_status text not null default 'pending';

alter table if exists public.work_orders
  drop constraint if exists work_orders_discount_mode_check;
alter table if exists public.work_orders
  add constraint work_orders_discount_mode_check
  check (discount_mode in ('none','percent','fixed','tiered'));

alter table if exists public.work_orders
  drop constraint if exists work_orders_approval_status_check;
alter table if exists public.work_orders
  add constraint work_orders_approval_status_check
  check (approval_status in ('draft','pending','approved','rejected','released','completed'));

alter table if exists public.work_orders
  drop constraint if exists work_orders_completion_review_status_check;
alter table if exists public.work_orders
  add constraint work_orders_completion_review_status_check
  check (completion_review_status in ('draft','pending','approved','rejected','ready_for_accounting'));

alter table if exists public.work_orders
  drop constraint if exists work_orders_accounting_trigger_status_check;
alter table if exists public.work_orders
  add constraint work_orders_accounting_trigger_status_check
  check (accounting_trigger_status in ('pending','queued','posted','failed','not_required'));

alter table if exists public.work_order_lines
  add column if not exists discount_percent numeric(7,2) not null default 0,
  add column if not exists discount_amount numeric(12,2) not null default 0,
  add column if not exists cost_total numeric(12,2) not null default 0,
  add column if not exists margin_total numeric(12,2) not null default 0,
  add column if not exists margin_percent numeric(7,2) not null default 0,
  add column if not exists pricing_basis_label text,
  add column if not exists client_visible boolean not null default true;

create table if not exists public.commercial_approval_events (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id text not null,
  approval_action text not null,
  approval_status text not null,
  actor_profile_id uuid references public.profiles(id) on delete set null,
  notes text,
  created_at timestamptz not null default now()
);

alter table if exists public.commercial_approval_events
  drop constraint if exists commercial_approval_events_entity_type_check;
alter table if exists public.commercial_approval_events
  add constraint commercial_approval_events_entity_type_check
  check (entity_type in ('estimate','work_order','job'));

alter table if exists public.commercial_approval_events
  drop constraint if exists commercial_approval_events_action_check;
alter table if exists public.commercial_approval_events
  add constraint commercial_approval_events_action_check
  check (approval_action in ('request_approval','approve','reject','release','mark_converted','mark_completed'));

create index if not exists idx_commercial_approval_events_entity
  on public.commercial_approval_events(entity_type, entity_id, created_at desc);

create table if not exists public.job_completion_reviews (
  id uuid primary key default gen_random_uuid(),
  job_id bigint not null references public.jobs(id) on delete cascade,
  work_order_id uuid references public.work_orders(id) on delete set null,
  estimate_id uuid references public.estimates(id) on delete set null,
  review_status text not null default 'draft',
  completion_date date,
  completion_notes text,
  closeout_evidence_complete boolean not null default false,
  supervisor_signoff_complete boolean not null default false,
  client_signoff_complete boolean not null default false,
  all_sessions_signed_off boolean not null default false,
  revenue_total numeric(12,2) not null default 0,
  cost_total numeric(12,2) not null default 0,
  profit_total numeric(12,2) not null default 0,
  margin_percent numeric(7,2) not null default 0,
  variance_summary text,
  accounting_ready boolean not null default false,
  accounting_ready_at timestamptz,
  accounting_trigger_status text not null default 'pending',
  reviewed_by_profile_id uuid references public.profiles(id) on delete set null,
  approved_by_profile_id uuid references public.profiles(id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(job_id)
);

alter table if exists public.job_completion_reviews
  drop constraint if exists job_completion_reviews_status_check;
alter table if exists public.job_completion_reviews
  add constraint job_completion_reviews_status_check
  check (review_status in ('draft','pending','approved','rejected','ready_for_accounting','posted'));

alter table if exists public.job_completion_reviews
  drop constraint if exists job_completion_reviews_trigger_status_check;
alter table if exists public.job_completion_reviews
  add constraint job_completion_reviews_trigger_status_check
  check (accounting_trigger_status in ('pending','queued','posted','failed','not_required'));

create table if not exists public.job_completion_accounting_events (
  id uuid primary key default gen_random_uuid(),
  completion_review_id uuid not null references public.job_completion_reviews(id) on delete cascade,
  job_id bigint not null references public.jobs(id) on delete cascade,
  accounting_action text not null,
  event_status text not null default 'queued',
  memo text,
  payload jsonb not null default '{}'::jsonb,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

alter table if exists public.job_completion_accounting_events
  drop constraint if exists job_completion_accounting_events_action_check;
alter table if exists public.job_completion_accounting_events
  add constraint job_completion_accounting_events_action_check
  check (accounting_action in ('queue_review','create_invoice_candidate','create_journal_candidate','mark_posted','mark_failed'));

alter table if exists public.job_completion_accounting_events
  drop constraint if exists job_completion_accounting_events_status_check;
alter table if exists public.job_completion_accounting_events
  add constraint job_completion_accounting_events_status_check
  check (event_status in ('queued','completed','failed'));

create or replace view public.v_estimate_commercial_directory as
with line_rollup as (
  select
    estimate_id,
    count(*)::int as line_count,
    coalesce(sum(coalesce(cost_total, quantity * unit_cost, 0)), 0)::numeric(12,2) as line_cost_total,
    coalesce(sum(coalesce(line_total, quantity * unit_price, 0)), 0)::numeric(12,2) as line_price_total,
    coalesce(sum(coalesce(discount_amount, 0)), 0)::numeric(12,2) as line_discount_total,
    coalesce(sum(coalesce(margin_total, coalesce(line_total, quantity * unit_price, 0) - coalesce(cost_total, quantity * unit_cost, 0))), 0)::numeric(12,2) as line_margin_total
  from public.estimate_lines
  group by estimate_id
)
select
  e.id,
  e.estimate_number,
  e.quote_title,
  e.client_id,
  c.client_code,
  coalesce(c.display_name, c.legal_name, '') as client_name,
  e.client_site_id,
  cs.site_code,
  cs.site_name,
  e.estimate_type,
  e.status,
  e.valid_until,
  e.subtotal,
  e.tax_total,
  e.total_amount,
  e.discount_mode,
  e.discount_value,
  e.pricing_basis_label,
  e.margin_estimate_total,
  e.margin_estimate_percent,
  e.approval_status,
  e.approval_required,
  e.approval_requested_at,
  e.approved_at,
  e.approved_by_profile_id,
  coalesce(ap.full_name, ap.email, '') as approved_by_name,
  e.scope_notes,
  e.terms_notes,
  e.client_notes,
  e.internal_notes,
  e.converted_job_id,
  j.job_code as converted_job_code,
  e.converted_work_order_id,
  wo.work_order_number as converted_work_order_number,
  e.converted_at,
  coalesce(lr.line_count, 0) as line_count,
  coalesce(lr.line_cost_total, 0)::numeric(12,2) as line_cost_total,
  coalesce(lr.line_price_total, 0)::numeric(12,2) as line_price_total,
  coalesce(lr.line_discount_total, 0)::numeric(12,2) as line_discount_total,
  coalesce(lr.line_margin_total, 0)::numeric(12,2) as line_margin_total,
  e.created_by_profile_id,
  coalesce(cp.full_name, cp.email, '') as created_by_name,
  e.created_at,
  e.updated_at
from public.estimates e
left join public.clients c on c.id = e.client_id
left join public.client_sites cs on cs.id = e.client_site_id
left join public.profiles cp on cp.id = e.created_by_profile_id
left join public.profiles ap on ap.id = e.approved_by_profile_id
left join public.jobs j on j.id = e.converted_job_id
left join public.work_orders wo on wo.id = e.converted_work_order_id
left join line_rollup lr on lr.estimate_id = e.id;

create or replace view public.v_work_order_commercial_directory as
with line_rollup as (
  select
    work_order_id,
    count(*)::int as line_count,
    coalesce(sum(coalesce(cost_total, quantity * unit_cost, 0)), 0)::numeric(12,2) as line_cost_total,
    coalesce(sum(coalesce(line_total, quantity * unit_price, 0)), 0)::numeric(12,2) as line_price_total,
    coalesce(sum(coalesce(discount_amount, 0)), 0)::numeric(12,2) as line_discount_total,
    coalesce(sum(coalesce(margin_total, coalesce(line_total, quantity * unit_price, 0) - coalesce(cost_total, quantity * unit_cost, 0))), 0)::numeric(12,2) as line_margin_total
  from public.work_order_lines
  group by work_order_id
)
select
  wo.id,
  wo.work_order_number,
  wo.estimate_id,
  e.estimate_number,
  wo.client_id,
  c.client_code,
  coalesce(c.display_name, c.legal_name, '') as client_name,
  wo.client_site_id,
  cs.site_code,
  cs.site_name,
  wo.legacy_job_id,
  j.job_code,
  j.job_name,
  wo.work_type,
  wo.status,
  wo.scheduled_start,
  wo.scheduled_end,
  wo.route_id,
  r.route_code,
  r.name as route_name,
  wo.service_area_id,
  sa.area_code,
  sa.name as service_area_name,
  wo.supervisor_profile_id,
  coalesce(sp.full_name, sp.email, '') as supervisor_name,
  wo.subtotal,
  wo.tax_total,
  wo.total_amount,
  wo.discount_mode,
  wo.discount_value,
  wo.pricing_basis_label,
  wo.margin_estimate_total,
  wo.margin_estimate_percent,
  wo.approval_status,
  wo.approval_required,
  wo.approval_requested_at,
  wo.approved_at,
  wo.completion_review_status,
  wo.completion_ready_for_accounting,
  wo.completion_ready_at,
  wo.accounting_trigger_status,
  wo.customer_notes,
  wo.internal_notes,
  wo.safety_notes,
  wo.crew_notes,
  coalesce(lr.line_count, 0) as line_count,
  coalesce(lr.line_cost_total, 0)::numeric(12,2) as line_cost_total,
  coalesce(lr.line_price_total, 0)::numeric(12,2) as line_price_total,
  coalesce(lr.line_discount_total, 0)::numeric(12,2) as line_discount_total,
  coalesce(lr.line_margin_total, 0)::numeric(12,2) as line_margin_total,
  wo.created_by_profile_id,
  coalesce(cp.full_name, cp.email, '') as created_by_name,
  wo.created_at,
  wo.updated_at
from public.work_orders wo
left join public.estimates e on e.id = wo.estimate_id
left join public.clients c on c.id = wo.client_id
left join public.client_sites cs on cs.id = wo.client_site_id
left join public.jobs j on j.id = wo.legacy_job_id
left join public.routes r on r.id = wo.route_id
left join public.service_areas sa on sa.id = wo.service_area_id
left join public.profiles sp on sp.id = wo.supervisor_profile_id
left join public.profiles cp on cp.id = wo.created_by_profile_id
left join line_rollup lr on lr.work_order_id = wo.id;

create or replace view public.v_job_completion_review_directory as
with session_rollup as (
  select
    job_id,
    count(*)::int as session_count,
    count(*) filter (where site_supervisor_signed_off_at is not null or coalesce(site_supervisor_signoff_name, '') <> '')::int as signed_session_count
  from public.job_sessions
  group by job_id
)
select
  cr.id,
  cr.job_id,
  j.job_code,
  j.job_name,
  cr.work_order_id,
  wo.work_order_number,
  cr.estimate_id,
  e.estimate_number,
  cr.review_status,
  cr.completion_date,
  cr.completion_notes,
  cr.closeout_evidence_complete,
  cr.supervisor_signoff_complete,
  cr.client_signoff_complete,
  cr.all_sessions_signed_off,
  cr.revenue_total,
  cr.cost_total,
  cr.profit_total,
  cr.margin_percent,
  cr.variance_summary,
  cr.accounting_ready,
  cr.accounting_ready_at,
  cr.accounting_trigger_status,
  cr.reviewed_by_profile_id,
  coalesce(rp.full_name, rp.email, '') as reviewed_by_name,
  cr.approved_by_profile_id,
  coalesce(ap.full_name, ap.email, '') as approved_by_name,
  cr.approved_at,
  coalesce(sr.session_count, 0) as session_count,
  coalesce(sr.signed_session_count, 0) as signed_session_count,
  cr.created_at,
  cr.updated_at
from public.job_completion_reviews cr
left join public.jobs j on j.id = cr.job_id
left join public.work_orders wo on wo.id = cr.work_order_id
left join public.estimates e on e.id = cr.estimate_id
left join public.profiles rp on rp.id = cr.reviewed_by_profile_id
left join public.profiles ap on ap.id = cr.approved_by_profile_id
left join session_rollup sr on sr.job_id = cr.job_id;

create or replace view public.v_job_accounting_ready_queue as
select
  cr.id,
  cr.job_id,
  j.job_code,
  j.job_name,
  cr.work_order_id,
  wo.work_order_number,
  cr.estimate_id,
  e.estimate_number,
  cr.review_status,
  cr.completion_date,
  cr.revenue_total,
  cr.cost_total,
  cr.profit_total,
  cr.margin_percent,
  cr.accounting_ready,
  cr.accounting_ready_at,
  cr.accounting_trigger_status,
  count(ev.id)::int as accounting_event_count,
  max(ev.created_at) as last_accounting_event_at,
  (array_agg(ev.event_status order by ev.created_at desc nulls last))[1] as last_accounting_event_status,
  (array_agg(ev.accounting_action order by ev.created_at desc nulls last))[1] as last_accounting_action,
  cr.variance_summary,
  cr.created_at,
  cr.updated_at
from public.job_completion_reviews cr
left join public.jobs j on j.id = cr.job_id
left join public.work_orders wo on wo.id = cr.work_order_id
left join public.estimates e on e.id = cr.estimate_id
left join public.job_completion_accounting_events ev on ev.completion_review_id = cr.id
where cr.accounting_ready = true or cr.review_status in ('ready_for_accounting','posted') or cr.accounting_trigger_status <> 'pending'
group by cr.id, j.job_code, j.job_name, wo.work_order_number, e.estimate_number;

-- 095_jobs_quote_approval_release_and_accounting_candidates.sql
-- Adds the next commercial layer for Jobs:
-- - client-ready quote package rendering
-- - approval thresholds and release controls
-- - completion package drilldown
-- - invoice / journal candidates and AR/AP review coordination
-- - business-entity and tax profile mapping for corporation / LLC style filings

alter table if exists public.business_tax_settings
  add column if not exists legal_entity_type text not null default 'corp_canada',
  add column if not exists legal_entity_name text,
  add column if not exists federal_return_type text,
  add column if not exists provincial_return_type text,
  add column if not exists usa_entity_type text,
  add column if not exists usa_tax_classification text,
  add column if not exists business_number text,
  add column if not exists corporation_number text,
  add column if not exists ein text,
  add column if not exists state_filing_state text,
  add column if not exists llc_tax_election text,
  add column if not exists default_ar_account_id uuid references public.chart_of_accounts(id) on delete set null,
  add column if not exists default_unbilled_revenue_account_id uuid references public.chart_of_accounts(id) on delete set null,
  add column if not exists default_deferred_revenue_account_id uuid references public.chart_of_accounts(id) on delete set null,
  add column if not exists default_wip_account_id uuid references public.chart_of_accounts(id) on delete set null,
  add column if not exists default_job_cogs_account_id uuid references public.chart_of_accounts(id) on delete set null,
  add column if not exists default_tax_liability_account_id uuid references public.chart_of_accounts(id) on delete set null;

alter table if exists public.business_tax_settings
  drop constraint if exists business_tax_settings_entity_type_check;
alter table if exists public.business_tax_settings
  add constraint business_tax_settings_entity_type_check
  check (legal_entity_type in ('corp_canada','corp_us','llc_us','sole_prop','partnership','other'));

create table if not exists public.commercial_approval_thresholds (
  id uuid primary key default gen_random_uuid(),
  threshold_name text not null,
  entity_type text not null default 'estimate',
  applies_to_scope text not null default 'global',
  applies_to_value text,
  discount_percent_cap numeric(7,2),
  fixed_discount_cap numeric(12,2),
  minimum_margin_percent numeric(7,2),
  maximum_total_without_approval numeric(12,2),
  required_signoff_role text not null default 'supervisor',
  hard_block boolean not null default false,
  is_active boolean not null default true,
  notes text,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists public.commercial_approval_thresholds
  drop constraint if exists commercial_approval_thresholds_entity_type_check;
alter table if exists public.commercial_approval_thresholds
  add constraint commercial_approval_thresholds_entity_type_check
  check (entity_type in ('estimate','work_order','job_completion_review'));

alter table if exists public.commercial_approval_thresholds
  drop constraint if exists commercial_approval_thresholds_scope_check;
alter table if exists public.commercial_approval_thresholds
  add constraint commercial_approval_thresholds_scope_check
  check (applies_to_scope in ('global','job_family','service_pattern','client','site','route','job'));

create index if not exists idx_commercial_approval_thresholds_active
  on public.commercial_approval_thresholds(entity_type, is_active, applies_to_scope, applies_to_value);

create table if not exists public.estimate_quote_packages (
  id uuid primary key default gen_random_uuid(),
  estimate_id uuid not null references public.estimates(id) on delete cascade,
  business_tax_setting_id uuid references public.business_tax_settings(id) on delete set null,
  package_status text not null default 'draft',
  render_version text,
  rendered_title text,
  rendered_markdown text,
  rendered_html text,
  public_token text not null default encode(gen_random_bytes(12), 'hex'),
  client_email text,
  sent_at timestamptz,
  viewed_at timestamptz,
  accepted_at timestamptz,
  accepted_by_name text,
  acceptance_notes text,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(estimate_id)
);

alter table if exists public.estimate_quote_packages
  drop constraint if exists estimate_quote_packages_status_check;
alter table if exists public.estimate_quote_packages
  add constraint estimate_quote_packages_status_check
  check (package_status in ('draft','rendered','sent','accepted','expired'));

create index if not exists idx_estimate_quote_packages_status
  on public.estimate_quote_packages(package_status, sent_at desc, accepted_at desc);

create table if not exists public.work_order_release_reviews (
  id uuid primary key default gen_random_uuid(),
  work_order_id uuid not null references public.work_orders(id) on delete cascade,
  estimate_id uuid references public.estimates(id) on delete set null,
  release_status text not null default 'draft',
  threshold_status text not null default 'pass',
  discount_percent numeric(7,2) not null default 0,
  margin_percent numeric(7,2) not null default 0,
  required_signoff_role text,
  release_notes text,
  signoff_profile_id uuid references public.profiles(id) on delete set null,
  signoff_at timestamptz,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(work_order_id)
);

alter table if exists public.work_order_release_reviews
  drop constraint if exists work_order_release_reviews_status_check;
alter table if exists public.work_order_release_reviews
  add constraint work_order_release_reviews_status_check
  check (release_status in ('draft','pending','approved','rejected','released','blocked'));

alter table if exists public.work_order_release_reviews
  drop constraint if exists work_order_release_reviews_threshold_check;
alter table if exists public.work_order_release_reviews
  add constraint work_order_release_reviews_threshold_check
  check (threshold_status in ('pass','warn','block'));

create table if not exists public.job_completion_closeout_items (
  id uuid primary key default gen_random_uuid(),
  completion_review_id uuid not null references public.job_completion_reviews(id) on delete cascade,
  item_type text not null default 'evidence',
  item_status text not null default 'pending',
  label text not null,
  notes text,
  due_at timestamptz,
  completed_at timestamptz,
  completed_by_profile_id uuid references public.profiles(id) on delete set null,
  required_item boolean not null default true,
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists public.job_completion_closeout_items
  drop constraint if exists job_completion_closeout_items_type_check;
alter table if exists public.job_completion_closeout_items
  add constraint job_completion_closeout_items_type_check
  check (item_type in ('evidence','supervisor_signoff','client_signoff','variance_explanation','session_closeout','materials','equipment','other'));

alter table if exists public.job_completion_closeout_items
  drop constraint if exists job_completion_closeout_items_status_check;
alter table if exists public.job_completion_closeout_items
  add constraint job_completion_closeout_items_status_check
  check (item_status in ('pending','complete','rejected','waived'));

create table if not exists public.job_invoice_candidates (
  id uuid primary key default gen_random_uuid(),
  completion_review_id uuid not null references public.job_completion_reviews(id) on delete cascade,
  job_id bigint not null references public.jobs(id) on delete cascade,
  work_order_id uuid references public.work_orders(id) on delete set null,
  estimate_id uuid references public.estimates(id) on delete set null,
  business_tax_setting_id uuid references public.business_tax_settings(id) on delete set null,
  candidate_status text not null default 'draft',
  candidate_number text,
  client_id uuid references public.clients(id) on delete set null,
  client_site_id uuid references public.client_sites(id) on delete set null,
  subtotal numeric(12,2) not null default 0,
  tax_total numeric(12,2) not null default 0,
  total_amount numeric(12,2) not null default 0,
  memo text,
  payload jsonb not null default '{}'::jsonb,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists public.job_invoice_candidates
  drop constraint if exists job_invoice_candidates_status_check;
alter table if exists public.job_invoice_candidates
  add constraint job_invoice_candidates_status_check
  check (candidate_status in ('draft','ready','reviewed','posted','rejected'));

create table if not exists public.job_journal_candidates (
  id uuid primary key default gen_random_uuid(),
  completion_review_id uuid not null references public.job_completion_reviews(id) on delete cascade,
  job_id bigint not null references public.jobs(id) on delete cascade,
  business_tax_setting_id uuid references public.business_tax_settings(id) on delete set null,
  candidate_status text not null default 'draft',
  journal_memo text,
  ledger_summary jsonb not null default '{}'::jsonb,
  payload jsonb not null default '{}'::jsonb,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists public.job_journal_candidates
  drop constraint if exists job_journal_candidates_status_check;
alter table if exists public.job_journal_candidates
  add constraint job_journal_candidates_status_check
  check (candidate_status in ('draft','ready','reviewed','posted','rejected'));

create table if not exists public.job_ar_ap_review_queue (
  id uuid primary key default gen_random_uuid(),
  source_type text not null,
  source_id text not null,
  job_id bigint references public.jobs(id) on delete set null,
  queue_status text not null default 'open',
  assigned_profile_id uuid references public.profiles(id) on delete set null,
  notes text,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists public.job_ar_ap_review_queue
  drop constraint if exists job_ar_ap_review_queue_source_check;
alter table if exists public.job_ar_ap_review_queue
  add constraint job_ar_ap_review_queue_source_check
  check (source_type in ('invoice_candidate','journal_candidate','completion_review','work_order'));

alter table if exists public.job_ar_ap_review_queue
  drop constraint if exists job_ar_ap_review_queue_status_check;
alter table if exists public.job_ar_ap_review_queue
  add constraint job_ar_ap_review_queue_status_check
  check (queue_status in ('open','in_review','approved','rejected','posted'));

create index if not exists idx_job_ar_ap_review_queue_status
  on public.job_ar_ap_review_queue(queue_status, created_at desc);

create or replace view public.v_commercial_approval_threshold_directory as
select
  t.id,
  t.threshold_name,
  t.entity_type,
  t.applies_to_scope,
  t.applies_to_value,
  t.discount_percent_cap,
  t.fixed_discount_cap,
  t.minimum_margin_percent,
  t.maximum_total_without_approval,
  t.required_signoff_role,
  t.hard_block,
  t.is_active,
  t.notes,
  t.created_by_profile_id,
  coalesce(p.full_name, p.email, '') as created_by_name,
  t.created_at,
  t.updated_at
from public.commercial_approval_thresholds t
left join public.profiles p on p.id = t.created_by_profile_id;

create or replace view public.v_estimate_quote_package_directory as
select
  qp.id,
  qp.estimate_id,
  e.estimate_number,
  e.quote_title,
  e.client_id,
  c.client_code,
  coalesce(c.display_name, c.legal_name, '') as client_name,
  e.client_site_id,
  cs.site_code,
  cs.site_name,
  qp.business_tax_setting_id,
  bts.profile_name as tax_profile_name,
  bts.legal_entity_type,
  bts.federal_return_type,
  bts.provincial_return_type,
  bts.usa_tax_classification,
  qp.package_status,
  qp.render_version,
  qp.rendered_title,
  qp.public_token,
  qp.client_email,
  qp.sent_at,
  qp.viewed_at,
  qp.accepted_at,
  qp.accepted_by_name,
  qp.acceptance_notes,
  qp.created_by_profile_id,
  coalesce(cp.full_name, cp.email, '') as created_by_name,
  qp.created_at,
  qp.updated_at
from public.estimate_quote_packages qp
left join public.estimates e on e.id = qp.estimate_id
left join public.clients c on c.id = e.client_id
left join public.client_sites cs on cs.id = e.client_site_id
left join public.business_tax_settings bts on bts.id = qp.business_tax_setting_id
left join public.profiles cp on cp.id = qp.created_by_profile_id;

create or replace view public.v_work_order_release_review_directory as
select
  rr.id,
  rr.work_order_id,
  wo.work_order_number,
  rr.estimate_id,
  e.estimate_number,
  wo.legacy_job_id as job_id,
  j.job_code,
  j.job_name,
  rr.release_status,
  rr.threshold_status,
  rr.discount_percent,
  rr.margin_percent,
  rr.required_signoff_role,
  rr.release_notes,
  rr.signoff_profile_id,
  coalesce(sp.full_name, sp.email, '') as signoff_name,
  rr.signoff_at,
  rr.created_by_profile_id,
  coalesce(cp.full_name, cp.email, '') as created_by_name,
  rr.created_at,
  rr.updated_at
from public.work_order_release_reviews rr
left join public.work_orders wo on wo.id = rr.work_order_id
left join public.estimates e on e.id = rr.estimate_id
left join public.jobs j on j.id = wo.legacy_job_id
left join public.profiles sp on sp.id = rr.signoff_profile_id
left join public.profiles cp on cp.id = rr.created_by_profile_id;

create or replace view public.v_job_completion_package_directory as
select
  ci.id,
  ci.completion_review_id,
  cr.job_id,
  j.job_code,
  j.job_name,
  cr.work_order_id,
  wo.work_order_number,
  ci.item_type,
  ci.item_status,
  ci.label,
  ci.notes,
  ci.required_item,
  ci.sort_order,
  ci.due_at,
  ci.completed_at,
  ci.completed_by_profile_id,
  coalesce(cp.full_name, cp.email, '') as completed_by_name,
  cr.review_status,
  cr.completion_date,
  cr.accounting_ready,
  ci.created_at,
  ci.updated_at
from public.job_completion_closeout_items ci
left join public.job_completion_reviews cr on cr.id = ci.completion_review_id
left join public.jobs j on j.id = cr.job_id
left join public.work_orders wo on wo.id = cr.work_order_id
left join public.profiles cp on cp.id = ci.completed_by_profile_id;

create or replace view public.v_job_invoice_candidate_directory as
select
  ic.id,
  ic.completion_review_id,
  ic.job_id,
  j.job_code,
  j.job_name,
  ic.work_order_id,
  wo.work_order_number,
  ic.estimate_id,
  e.estimate_number,
  ic.business_tax_setting_id,
  bts.profile_name as tax_profile_name,
  bts.legal_entity_type,
  ic.candidate_status,
  ic.candidate_number,
  ic.client_id,
  c.client_code,
  coalesce(c.display_name, c.legal_name, '') as client_name,
  ic.client_site_id,
  cs.site_code,
  cs.site_name,
  ic.subtotal,
  ic.tax_total,
  ic.total_amount,
  ic.memo,
  ic.created_by_profile_id,
  coalesce(cp.full_name, cp.email, '') as created_by_name,
  ic.created_at,
  ic.updated_at
from public.job_invoice_candidates ic
left join public.jobs j on j.id = ic.job_id
left join public.work_orders wo on wo.id = ic.work_order_id
left join public.estimates e on e.id = ic.estimate_id
left join public.clients c on c.id = ic.client_id
left join public.client_sites cs on cs.id = ic.client_site_id
left join public.business_tax_settings bts on bts.id = ic.business_tax_setting_id
left join public.profiles cp on cp.id = ic.created_by_profile_id;

create or replace view public.v_job_journal_candidate_directory as
select
  jc.id,
  jc.completion_review_id,
  jc.job_id,
  j.job_code,
  j.job_name,
  jc.business_tax_setting_id,
  bts.profile_name as tax_profile_name,
  bts.legal_entity_type,
  jc.candidate_status,
  jc.journal_memo,
  jc.ledger_summary,
  jc.created_by_profile_id,
  coalesce(cp.full_name, cp.email, '') as created_by_name,
  jc.created_at,
  jc.updated_at
from public.job_journal_candidates jc
left join public.jobs j on j.id = jc.job_id
left join public.business_tax_settings bts on bts.id = jc.business_tax_setting_id
left join public.profiles cp on cp.id = jc.created_by_profile_id;

create or replace view public.v_job_ar_ap_review_queue_directory as
select
  q.id,
  q.source_type,
  q.source_id,
  q.job_id,
  j.job_code,
  j.job_name,
  q.queue_status,
  q.assigned_profile_id,
  coalesce(ap.full_name, ap.email, '') as assigned_name,
  q.notes,
  q.created_by_profile_id,
  coalesce(cp.full_name, cp.email, '') as created_by_name,
  q.created_at,
  q.updated_at
from public.job_ar_ap_review_queue q
left join public.jobs j on j.id = q.job_id
left join public.profiles ap on ap.id = q.assigned_profile_id
left join public.profiles cp on cp.id = q.created_by_profile_id;

create or replace view public.v_job_profitability_scorecard_directory as
with base as (
  select
    j.id as job_id,
    j.job_code,
    j.job_name,
    coalesce(j.job_family, 'unclassified') as job_family,
    coalesce(j.assigned_supervisor_profile_id::text, j.site_supervisor_profile_id::text, 'unassigned') as supervisor_key,
    coalesce(sp.full_name, sup.full_name, 'Unassigned') as supervisor_name,
    coalesce(j.site_id::text, 'no-site') as site_key,
    coalesce(st.site_code, st.site_name, 'No site') as site_name,
    coalesce(wo.route_id::text, 'no-route') as route_key,
    coalesce(rt.route_code, rt.name, 'No route') as route_name,
    coalesce(cr.revenue_total, j.actual_charge_rollup_total, j.actual_charge_total, j.quoted_charge_total, 0)::numeric(12,2) as revenue_total,
    coalesce(cr.cost_total, j.actual_cost_rollup_total, j.actual_cost_total, j.estimated_cost_total, 0)::numeric(12,2) as cost_total,
    coalesce(cr.profit_total, (coalesce(cr.revenue_total, j.actual_charge_rollup_total, j.actual_charge_total, j.quoted_charge_total, 0) - coalesce(cr.cost_total, j.actual_cost_rollup_total, j.actual_cost_total, j.estimated_cost_total, 0)))::numeric(12,2) as profit_total
  from public.v_jobs_directory j
  left join public.job_completion_reviews cr on cr.job_id = j.id
  left join public.work_orders wo on wo.legacy_job_id = j.id
  left join public.routes rt on rt.id = wo.route_id
  left join public.sites st on st.id = j.site_id
  left join public.profiles sp on sp.id = j.assigned_supervisor_profile_id
  left join public.profiles sup on sup.id = j.site_supervisor_profile_id
)
select
  'site'::text as group_type,
  site_key as group_key,
  site_name as group_label,
  count(*)::int as job_count,
  coalesce(sum(revenue_total),0)::numeric(12,2) as revenue_total,
  coalesce(sum(cost_total),0)::numeric(12,2) as cost_total,
  coalesce(sum(profit_total),0)::numeric(12,2) as profit_total,
  case when coalesce(sum(revenue_total),0) > 0 then round((coalesce(sum(profit_total),0) / sum(revenue_total)) * 100.0, 2)::numeric(7,2) else 0::numeric(7,2) end as margin_percent
from base group by site_key, site_name
union all
select
  'supervisor'::text,
  supervisor_key,
  supervisor_name,
  count(*)::int,
  coalesce(sum(revenue_total),0)::numeric(12,2),
  coalesce(sum(cost_total),0)::numeric(12,2),
  coalesce(sum(profit_total),0)::numeric(12,2),
  case when coalesce(sum(revenue_total),0) > 0 then round((coalesce(sum(profit_total),0) / sum(revenue_total)) * 100.0, 2)::numeric(7,2) else 0::numeric(7,2) end
from base group by supervisor_key, supervisor_name
union all
select
  'route'::text,
  route_key,
  route_name,
  count(*)::int,
  coalesce(sum(revenue_total),0)::numeric(12,2),
  coalesce(sum(cost_total),0)::numeric(12,2),
  coalesce(sum(profit_total),0)::numeric(12,2),
  case when coalesce(sum(revenue_total),0) > 0 then round((coalesce(sum(profit_total),0) / sum(revenue_total)) * 100.0, 2)::numeric(7,2) else 0::numeric(7,2) end
from base group by route_key, route_name
union all
select
  'job_family'::text,
  job_family,
  job_family,
  count(*)::int,
  coalesce(sum(revenue_total),0)::numeric(12,2),
  coalesce(sum(cost_total),0)::numeric(12,2),
  coalesce(sum(profit_total),0)::numeric(12,2),
  case when coalesce(sum(revenue_total),0) > 0 then round((coalesce(sum(profit_total),0) / sum(revenue_total)) * 100.0, 2)::numeric(7,2) else 0::numeric(7,2) end
from base group by job_family;



-- 096_jobs_quote_output_threshold_enforcement_and_closeout_posting.sql
-- 096_jobs_quote_output_threshold_enforcement_and_closeout_posting.sql
-- Extends the commercial Jobs workflow with:
-- - branded printable/email quote output
-- - automatic threshold evaluations
-- - completion closeout evidence linkage
-- - invoice/journal candidate posting rules
-- - accountant handoff exports
-- - profitability/variance scorecards

alter table if exists public.estimate_quote_packages
  add column if not exists brand_name text,
  add column if not exists brand_tagline text,
  add column if not exists brand_email text,
  add column if not exists brand_phone text,
  add column if not exists brand_address text,
  add column if not exists printable_html text,
  add column if not exists email_subject text,
  add column if not exists email_body text,
  add column if not exists last_rendered_at timestamptz,
  add column if not exists last_sent_via text,
  add column if not exists accepted_signature_name text,
  add column if not exists render_payload jsonb not null default '{}'::jsonb;

create table if not exists public.quote_package_output_events (
  id uuid primary key default gen_random_uuid(),
  quote_package_id uuid not null references public.estimate_quote_packages(id) on delete cascade,
  output_type text not null default 'printable_html',
  output_status text not null default 'rendered',
  recipient_email text,
  email_subject text,
  output_payload jsonb not null default '{}'::jsonb,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists public.quote_package_output_events
  drop constraint if exists quote_package_output_events_type_check;
alter table if exists public.quote_package_output_events
  add constraint quote_package_output_events_type_check
  check (output_type in ('printable_html','email','client_acceptance'));

alter table if exists public.quote_package_output_events
  drop constraint if exists quote_package_output_events_status_check;
alter table if exists public.quote_package_output_events
  add constraint quote_package_output_events_status_check
  check (output_status in ('rendered','sent','accepted','failed'));

create table if not exists public.work_order_release_threshold_evaluations (
  id uuid primary key default gen_random_uuid(),
  work_order_release_review_id uuid references public.work_order_release_reviews(id) on delete cascade,
  threshold_id uuid references public.commercial_approval_thresholds(id) on delete set null,
  work_order_id uuid references public.work_orders(id) on delete cascade,
  estimate_id uuid references public.estimates(id) on delete set null,
  evaluated_status text not null default 'pass',
  evaluation_message text,
  discount_percent numeric(7,2) not null default 0,
  margin_percent numeric(7,2) not null default 0,
  total_amount numeric(12,2) not null default 0,
  required_signoff_role text,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table if exists public.work_order_release_threshold_evaluations
  drop constraint if exists work_order_release_threshold_evaluations_status_check;
alter table if exists public.work_order_release_threshold_evaluations
  add constraint work_order_release_threshold_evaluations_status_check
  check (evaluated_status in ('pass','warn','block'));

create table if not exists public.job_completion_closeout_assets (
  id uuid primary key default gen_random_uuid(),
  closeout_item_id uuid not null references public.job_completion_closeout_items(id) on delete cascade,
  asset_kind text not null default 'url',
  label text,
  asset_url text,
  source_table text,
  source_id text,
  notes text,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists public.job_completion_closeout_assets
  drop constraint if exists job_completion_closeout_assets_kind_check;
alter table if exists public.job_completion_closeout_assets
  add constraint job_completion_closeout_assets_kind_check
  check (asset_kind in ('url','job_comment_attachment','submission_image','equipment_evidence','signature','file'));

create table if not exists public.invoice_candidate_posting_rules (
  id uuid primary key default gen_random_uuid(),
  rule_name text not null,
  applies_to_scope text not null default 'global',
  applies_to_value text,
  require_approved_completion boolean not null default true,
  require_released_work_order boolean not null default true,
  require_closeout_complete boolean not null default true,
  ar_account_id uuid references public.chart_of_accounts(id) on delete set null,
  offset_account_id uuid references public.chart_of_accounts(id) on delete set null,
  tax_liability_account_id uuid references public.chart_of_accounts(id) on delete set null,
  is_active boolean not null default true,
  notes text,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.journal_candidate_posting_rules (
  id uuid primary key default gen_random_uuid(),
  rule_name text not null,
  applies_to_scope text not null default 'global',
  applies_to_value text,
  require_approved_completion boolean not null default true,
  require_closeout_complete boolean not null default true,
  revenue_account_id uuid references public.chart_of_accounts(id) on delete set null,
  cogs_account_id uuid references public.chart_of_accounts(id) on delete set null,
  wip_account_id uuid references public.chart_of_accounts(id) on delete set null,
  variance_account_id uuid references public.chart_of_accounts(id) on delete set null,
  is_active boolean not null default true,
  notes text,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.accountant_handoff_exports (
  id uuid primary key default gen_random_uuid(),
  export_kind text not null default 'closeout_bundle',
  entity_scope text not null default 'completion_review',
  entity_id text not null,
  business_tax_setting_id uuid references public.business_tax_settings(id) on delete set null,
  export_status text not null default 'draft',
  export_title text,
  export_markdown text,
  export_payload jsonb not null default '{}'::jsonb,
  generated_by_profile_id uuid references public.profiles(id) on delete set null,
  generated_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists public.accountant_handoff_exports
  drop constraint if exists accountant_handoff_exports_kind_check;
alter table if exists public.accountant_handoff_exports
  add constraint accountant_handoff_exports_kind_check
  check (export_kind in ('t2_package','llc_package','closeout_bundle','invoice_review','journal_review'));

alter table if exists public.accountant_handoff_exports
  drop constraint if exists accountant_handoff_exports_status_check;
alter table if exists public.accountant_handoff_exports
  add constraint accountant_handoff_exports_status_check
  check (export_status in ('draft','generated','delivered','archived'));

create or replace view public.v_quote_package_output_directory as
select
  qp.id,
  qp.estimate_id,
  e.estimate_number,
  e.quote_title,
  qp.business_tax_setting_id,
  bts.profile_name as tax_profile_name,
  bts.legal_entity_type,
  qp.package_status,
  qp.rendered_title,
  qp.client_email,
  qp.brand_name,
  qp.brand_tagline,
  qp.email_subject,
  qp.last_rendered_at,
  qp.sent_at,
  qp.accepted_at,
  qp.last_sent_via,
  qp.accepted_signature_name,
  qp.public_token,
  coalesce(count(qoe.id), 0)::int as output_event_count,
  max(qoe.created_at) as last_output_event_at,
  qp.created_at,
  qp.updated_at
from public.estimate_quote_packages qp
left join public.estimates e on e.id = qp.estimate_id
left join public.business_tax_settings bts on bts.id = qp.business_tax_setting_id
left join public.quote_package_output_events qoe on qoe.quote_package_id = qp.id
group by qp.id, e.estimate_number, e.quote_title, bts.profile_name, bts.legal_entity_type;

create or replace view public.v_work_order_threshold_evaluation_directory as
select
  te.id,
  te.work_order_release_review_id,
  te.threshold_id,
  cat.threshold_name,
  te.work_order_id,
  wo.work_order_number,
  te.estimate_id,
  e.estimate_number,
  te.evaluated_status,
  te.evaluation_message,
  te.discount_percent,
  te.margin_percent,
  te.total_amount,
  te.required_signoff_role,
  te.created_by_profile_id,
  coalesce(p.full_name, p.email, '') as created_by_name,
  te.created_at
from public.work_order_release_threshold_evaluations te
left join public.commercial_approval_thresholds cat on cat.id = te.threshold_id
left join public.work_orders wo on wo.id = te.work_order_id
left join public.estimates e on e.id = te.estimate_id
left join public.profiles p on p.id = te.created_by_profile_id;

create or replace view public.v_job_closeout_evidence_directory as
select
  ca.id,
  ca.closeout_item_id,
  ci.completion_review_id,
  cr.job_id,
  j.job_code,
  j.job_name,
  cr.work_order_id,
  wo.work_order_number,
  ca.asset_kind,
  ca.label,
  ca.asset_url,
  ca.source_table,
  ca.source_id,
  ca.notes,
  ca.created_by_profile_id,
  coalesce(p.full_name, p.email, '') as created_by_name,
  ca.created_at,
  ca.updated_at
from public.job_completion_closeout_assets ca
left join public.job_completion_closeout_items ci on ci.id = ca.closeout_item_id
left join public.job_completion_reviews cr on cr.id = ci.completion_review_id
left join public.jobs j on j.id = cr.job_id
left join public.work_orders wo on wo.id = cr.work_order_id
left join public.profiles p on p.id = ca.created_by_profile_id;

create or replace view public.v_invoice_candidate_posting_rule_directory as
select
  r.id,
  r.rule_name,
  r.applies_to_scope,
  r.applies_to_value,
  r.require_approved_completion,
  r.require_released_work_order,
  r.require_closeout_complete,
  r.ar_account_id,
  coa.account_number as ar_account_number,
  coa.account_name as ar_account_name,
  r.offset_account_id,
  offa.account_number as offset_account_number,
  offa.account_name as offset_account_name,
  r.tax_liability_account_id,
  taxa.account_number as tax_account_number,
  taxa.account_name as tax_account_name,
  r.is_active,
  r.notes,
  r.created_at,
  r.updated_at
from public.invoice_candidate_posting_rules r
left join public.chart_of_accounts coa on coa.id = r.ar_account_id
left join public.chart_of_accounts offa on offa.id = r.offset_account_id
left join public.chart_of_accounts taxa on taxa.id = r.tax_liability_account_id;

create or replace view public.v_journal_candidate_posting_rule_directory as
select
  r.id,
  r.rule_name,
  r.applies_to_scope,
  r.applies_to_value,
  r.require_approved_completion,
  r.require_closeout_complete,
  r.revenue_account_id,
  rev.account_number as revenue_account_number,
  rev.account_name as revenue_account_name,
  r.cogs_account_id,
  cogs.account_number as cogs_account_number,
  cogs.account_name as cogs_account_name,
  r.wip_account_id,
  wip.account_number as wip_account_number,
  wip.account_name as wip_account_name,
  r.variance_account_id,
  var.account_number as variance_account_number,
  var.account_name as variance_account_name,
  r.is_active,
  r.notes,
  r.created_at,
  r.updated_at
from public.journal_candidate_posting_rules r
left join public.chart_of_accounts rev on rev.id = r.revenue_account_id
left join public.chart_of_accounts cogs on cogs.id = r.cogs_account_id
left join public.chart_of_accounts wip on wip.id = r.wip_account_id
left join public.chart_of_accounts var on var.id = r.variance_account_id;

create or replace view public.v_accountant_handoff_export_directory as
select
  ah.id,
  ah.export_kind,
  ah.entity_scope,
  ah.entity_id,
  ah.business_tax_setting_id,
  bts.profile_name as tax_profile_name,
  bts.legal_entity_type,
  bts.federal_return_type,
  bts.provincial_return_type,
  bts.usa_tax_classification,
  ah.export_status,
  ah.export_title,
  ah.generated_by_profile_id,
  coalesce(p.full_name, p.email, '') as generated_by_name,
  ah.generated_at,
  ah.delivered_at,
  ah.created_at,
  ah.updated_at
from public.accountant_handoff_exports ah
left join public.business_tax_settings bts on bts.id = ah.business_tax_setting_id
left join public.profiles p on p.id = ah.generated_by_profile_id;

create or replace view public.v_job_profitability_variance_directory as
with base as (
  select
    j.id as job_id,
    j.job_code,
    j.job_name,
    coalesce(j.job_family, 'unclassified') as job_family,
    coalesce(st.site_code, st.site_name, 'No site') as site_label,
    coalesce(sp.full_name, sup.full_name, 'Unassigned') as supervisor_label,
    coalesce(rt.route_code, rt.name, 'No route') as route_label,
    coalesce(j.quoted_charge_total, 0)::numeric(12,2) as quoted_total,
    coalesce(j.estimated_cost_total, 0)::numeric(12,2) as estimated_cost_total,
    coalesce(j.actual_charge_rollup_total, j.actual_charge_total, 0)::numeric(12,2) as actual_revenue_total,
    coalesce(j.actual_cost_rollup_total, j.actual_cost_total, 0)::numeric(12,2) as actual_cost_total,
    coalesce(j.actual_profit_rollup_total, j.actual_profit_total, 0)::numeric(12,2) as actual_profit_total
  from public.v_jobs_directory j
  left join public.work_orders wo on wo.legacy_job_id = j.id
  left join public.routes rt on rt.id = wo.route_id
  left join public.sites st on st.id = j.site_id
  left join public.profiles sp on sp.id = j.assigned_supervisor_profile_id
  left join public.profiles sup on sup.id = j.site_supervisor_profile_id
)
select
  'job'::text as group_type,
  job_code as group_key,
  job_name as group_label,
  count(*)::int as job_count,
  sum(quoted_total)::numeric(12,2) as quoted_total,
  sum(estimated_cost_total)::numeric(12,2) as estimated_cost_total,
  sum(actual_revenue_total)::numeric(12,2) as actual_revenue_total,
  sum(actual_cost_total)::numeric(12,2) as actual_cost_total,
  sum(actual_profit_total)::numeric(12,2) as actual_profit_total,
  sum(actual_revenue_total - quoted_total)::numeric(12,2) as revenue_variance_total,
  sum(actual_cost_total - estimated_cost_total)::numeric(12,2) as cost_variance_total
from base group by job_code, job_name
union all
select
  'site', site_label, site_label, count(*)::int,
  sum(quoted_total)::numeric(12,2), sum(estimated_cost_total)::numeric(12,2),
  sum(actual_revenue_total)::numeric(12,2), sum(actual_cost_total)::numeric(12,2),
  sum(actual_profit_total)::numeric(12,2),
  sum(actual_revenue_total - quoted_total)::numeric(12,2),
  sum(actual_cost_total - estimated_cost_total)::numeric(12,2)
from base group by site_label
union all
select
  'supervisor', supervisor_label, supervisor_label, count(*)::int,
  sum(quoted_total)::numeric(12,2), sum(estimated_cost_total)::numeric(12,2),
  sum(actual_revenue_total)::numeric(12,2), sum(actual_cost_total)::numeric(12,2),
  sum(actual_profit_total)::numeric(12,2),
  sum(actual_revenue_total - quoted_total)::numeric(12,2),
  sum(actual_cost_total - estimated_cost_total)::numeric(12,2)
from base group by supervisor_label
union all
select
  'route', route_label, route_label, count(*)::int,
  sum(quoted_total)::numeric(12,2), sum(estimated_cost_total)::numeric(12,2),
  sum(actual_revenue_total)::numeric(12,2), sum(actual_cost_total)::numeric(12,2),
  sum(actual_profit_total)::numeric(12,2),
  sum(actual_revenue_total - quoted_total)::numeric(12,2),
  sum(actual_cost_total - estimated_cost_total)::numeric(12,2)
from base group by route_label
union all
select
  'job_family', job_family, job_family, count(*)::int,
  sum(quoted_total)::numeric(12,2), sum(estimated_cost_total)::numeric(12,2),
  sum(actual_revenue_total)::numeric(12,2), sum(actual_cost_total)::numeric(12,2),
  sum(actual_profit_total)::numeric(12,2),
  sum(actual_revenue_total - quoted_total)::numeric(12,2),
  sum(actual_cost_total - estimated_cost_total)::numeric(12,2)
from base group by job_family;

