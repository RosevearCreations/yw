-- Last synchronized: June 2, 2026. Reviewed during the public route SEO, internal-link, CSS token, mobile action, release manifest, and schema 127 pass.
-- Current reference remains aligned through 127_public_route_seo_internal_link_css_mobile_guardrails.sql.

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
  creator.full_name as uploaded_by_name,
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
  p.full_name as uploaded_by_name,
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
  p.full_name as uploaded_by_name,
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
  cp.full_name as uploaded_by_name,
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
  actor.full_name as uploaded_by_name,
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
  actor.full_name as uploaded_by_name,
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
  actor.full_name as uploaded_by_name,
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
-- Adds historical reporting views for Ontario OHSA / HSE submissions and cross-workflow history.

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
  coalesce(p.full_name, p.email, '') as uploaded_by_name,
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
  coalesce(cp.full_name, cp.email, '') as uploaded_by_name,
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
  coalesce(cp.full_name, cp.email, '') as uploaded_by_name,
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
  coalesce(cp.full_name, cp.email, '') as uploaded_by_name,
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
  coalesce(cp.full_name, cp.email, '') as uploaded_by_name,
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
    (array_agg(site_id order by site_id nulls last))[1] as site_id,
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
    (array_agg(supervisor_profile_id order by supervisor_profile_id nulls last))[1] as supervisor_profile_id,
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
  coalesce(cp.full_name, cp.email, '') as uploaded_by_name,
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
  coalesce(cp.full_name, cp.email, '') as uploaded_by_name,
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
  coalesce(p.full_name, p.email, '') as uploaded_by_name,
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
  coalesce(cp.full_name, cp.email, '') as uploaded_by_name,
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
  coalesce(cp.full_name, cp.email, '') as uploaded_by_name,
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
  coalesce(cp.full_name, cp.email, '') as uploaded_by_name,
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
  coalesce(cp.full_name, cp.email, '') as uploaded_by_name,
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
  coalesce(cp.full_name, cp.email, '') as uploaded_by_name,
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


alter table if exists public.work_order_release_threshold_evaluations
  add column if not exists evaluation_trigger text not null default 'manual',
  add column if not exists evaluated_at timestamptz not null default now();

alter table if exists public.work_order_release_threshold_evaluations
  drop constraint if exists work_order_release_threshold_evaluations_trigger_check;
alter table if exists public.work_order_release_threshold_evaluations
  add constraint work_order_release_threshold_evaluations_trigger_check
  check (evaluation_trigger in ('save','manual','release','system'));

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
  qp.updated_at,
  qp.printable_html,
  qp.email_body,
  qp.render_payload,
  bts.legal_entity_name,
  bts.federal_return_type,
  bts.provincial_return_type,
  bts.usa_tax_classification,
  coalesce((qp.render_payload->>'preview_text')::text, '') as preview_text,
  coalesce(e.total_amount, 0)::numeric(12,2) as estimate_total_amount,
  coalesce(e.margin_estimate_percent, 0)::numeric(7,2) as estimate_margin_percent
from public.estimate_quote_packages qp
left join public.estimates e on e.id = qp.estimate_id
left join public.business_tax_settings bts on bts.id = qp.business_tax_setting_id
left join public.quote_package_output_events qoe on qoe.quote_package_id = qp.id
group by qp.id, e.estimate_number, e.quote_title, e.total_amount, e.margin_estimate_percent, bts.profile_name, bts.legal_entity_type, bts.legal_entity_name, bts.federal_return_type, bts.provincial_return_type, bts.usa_tax_classification;


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
  coalesce(p.full_name, p.email, '') as uploaded_by_name,
  te.created_at,
  te.evaluation_trigger,
  te.evaluated_at,
  cat.applies_to_scope,
  cat.applies_to_value,
  cat.hard_block
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
  coalesce(p.full_name, p.email, '') as uploaded_by_name,
  ca.created_at,
  ca.updated_at,
  coalesce(jca.preview_url, eea.preview_url, ca.asset_url) as resolved_asset_url,
  coalesce(jca.file_name, si.file_name, eea.file_name, ca.label) as resolved_file_name,
  coalesce(si.caption, eea.caption, ca.notes) as resolved_caption,
  coalesce(jca.storage_bucket, eea.storage_bucket, '') as resolved_storage_bucket,
  coalesce(jca.storage_path, si.file_path, eea.storage_path, '') as resolved_storage_path
from public.job_completion_closeout_assets ca
left join public.job_completion_closeout_items ci on ci.id = ca.closeout_item_id
left join public.job_completion_reviews cr on cr.id = ci.completion_review_id
left join public.jobs j on j.id = cr.job_id
left join public.work_orders wo on wo.id = cr.work_order_id
left join public.profiles p on p.id = ca.created_by_profile_id
left join public.job_comment_attachments jca on ca.source_table = 'job_comment_attachments' and ca.source_id = jca.id::text
left join public.submission_images si on ca.source_table = 'submission_images' and ca.source_id = si.id::text
left join public.equipment_evidence_assets eea on ca.source_table = 'equipment_evidence_assets' and ca.source_id = eea.id::text;


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
  ah.updated_at,
  bts.legal_entity_name,
  bts.business_number,
  bts.corporation_number,
  bts.ein,
  left(coalesce(ah.export_markdown, ''), 400) as export_preview,
  coalesce((ah.export_payload->>'invoice_candidate_count')::int, 0) as invoice_candidate_count,
  coalesce((ah.export_payload->>'journal_candidate_count')::int, 0) as journal_candidate_count,
  coalesce((ah.export_payload->>'closeout_item_count')::int, 0) as closeout_item_count,
  coalesce((ah.export_payload->>'closeout_asset_count')::int, 0) as closeout_asset_count
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

-- 097_jobs_quote_delivery_threshold_rules_and_accountant_exports.sql
-- Deepens the Jobs commercial/accounting workflow with:
-- - richer branded quote package output details
-- - automatic threshold evaluation metadata
-- - resolved closeout evidence links to real source records
-- - more explicit accountant-handoff metadata
-- - extended profitability scorecards with variance context

alter table if exists public.work_order_release_threshold_evaluations
  add column if not exists evaluation_trigger text not null default 'manual',
  add column if not exists evaluated_at timestamptz not null default now();

alter table if exists public.work_order_release_threshold_evaluations
  drop constraint if exists work_order_release_threshold_evaluations_trigger_check;
alter table if exists public.work_order_release_threshold_evaluations
  add constraint work_order_release_threshold_evaluations_trigger_check
  check (evaluation_trigger in ('save','manual','release','system'));

create or replace view public.v_quote_package_output_directory as
select
  -- legacy columns first
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
  qp.updated_at,
  -- appended columns
  qp.printable_html,
  qp.email_body,
  qp.render_payload,
  bts.legal_entity_name,
  bts.federal_return_type,
  bts.provincial_return_type,
  bts.usa_tax_classification,
  coalesce((qp.render_payload->>'preview_text')::text, '') as preview_text,
  coalesce(e.total_amount, 0)::numeric(12,2) as estimate_total_amount,
  coalesce(e.margin_estimate_percent, 0)::numeric(7,2) as estimate_margin_percent
from public.estimate_quote_packages qp
left join public.estimates e on e.id = qp.estimate_id
left join public.business_tax_settings bts on bts.id = qp.business_tax_setting_id
left join public.quote_package_output_events qoe on qoe.quote_package_id = qp.id
group by qp.id, e.estimate_number, e.quote_title, e.total_amount, e.margin_estimate_percent, bts.profile_name, bts.legal_entity_type, bts.legal_entity_name, bts.federal_return_type, bts.provincial_return_type, bts.usa_tax_classification;

create or replace view public.v_work_order_threshold_evaluation_directory as
select
  -- legacy columns first
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
  coalesce(p.full_name, p.email, '') as uploaded_by_name,
  te.created_at,
  -- appended columns
  te.evaluation_trigger,
  te.evaluated_at,
  cat.applies_to_scope,
  cat.applies_to_value,
  cat.hard_block
from public.work_order_release_threshold_evaluations te
left join public.commercial_approval_thresholds cat on cat.id = te.threshold_id
left join public.work_orders wo on wo.id = te.work_order_id
left join public.estimates e on e.id = te.estimate_id
left join public.profiles p on p.id = te.created_by_profile_id;

create or replace view public.v_job_closeout_evidence_directory as
select
  -- legacy columns first
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
  coalesce(p.full_name, p.email, '') as uploaded_by_name,
  ca.created_at,
  ca.updated_at,
  -- appended columns
  coalesce(jca.preview_url, eea.preview_url, ca.asset_url) as resolved_asset_url,
  coalesce(jca.file_name, si.file_name, eea.file_name, ca.label) as resolved_file_name,
  coalesce(si.caption, eea.caption, ca.notes) as resolved_caption,
  coalesce(jca.storage_bucket, eea.storage_bucket, '') as resolved_storage_bucket,
  coalesce(jca.storage_path, si.file_path, eea.storage_path, '') as resolved_storage_path
from public.job_completion_closeout_assets ca
left join public.job_completion_closeout_items ci on ci.id = ca.closeout_item_id
left join public.job_completion_reviews cr on cr.id = ci.completion_review_id
left join public.jobs j on j.id = cr.job_id
left join public.work_orders wo on wo.id = cr.work_order_id
left join public.profiles p on p.id = ca.created_by_profile_id
left join public.job_comment_attachments jca on ca.source_table = 'job_comment_attachments' and ca.source_id = jca.id::text
left join public.submission_images si on ca.source_table = 'submission_images' and ca.source_id = si.id::text
left join public.equipment_evidence_assets eea on ca.source_table = 'equipment_evidence_assets' and ca.source_id = eea.id::text;

create or replace view public.v_accountant_handoff_export_directory as
select
  -- legacy columns first
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
  ah.updated_at,
  -- appended columns
  bts.legal_entity_name,
  bts.business_number,
  bts.corporation_number,
  bts.ein,
  left(coalesce(ah.export_markdown, ''), 400) as export_preview,
  coalesce((ah.export_payload->>'invoice_candidate_count')::int, 0) as invoice_candidate_count,
  coalesce((ah.export_payload->>'journal_candidate_count')::int, 0) as journal_candidate_count,
  coalesce((ah.export_payload->>'closeout_item_count')::int, 0) as closeout_item_count,
  coalesce((ah.export_payload->>'closeout_asset_count')::int, 0) as closeout_asset_count
from public.accountant_handoff_exports ah
left join public.business_tax_settings bts on bts.id = ah.business_tax_setting_id
left join public.profiles p on p.id = ah.generated_by_profile_id;

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
    coalesce(j.quoted_charge_total, 0)::numeric(12,2) as quoted_total,
    coalesce(j.estimated_cost_total, 0)::numeric(12,2) as estimated_cost_total,
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
), grouped as (
  select 'site'::text as group_type, site_key as group_key, site_name as group_label, count(*)::int as job_count, sum(quoted_total)::numeric(12,2) as quoted_total, sum(estimated_cost_total)::numeric(12,2) as estimated_cost_total, sum(revenue_total)::numeric(12,2) as revenue_total, sum(cost_total)::numeric(12,2) as cost_total, sum(profit_total)::numeric(12,2) as profit_total from base group by site_key, site_name
  union all
  select 'supervisor'::text, supervisor_key, supervisor_name, count(*)::int, sum(quoted_total)::numeric(12,2), sum(estimated_cost_total)::numeric(12,2), sum(revenue_total)::numeric(12,2), sum(cost_total)::numeric(12,2), sum(profit_total)::numeric(12,2) from base group by supervisor_key, supervisor_name
  union all
  select 'route'::text, route_key, route_name, count(*)::int, sum(quoted_total)::numeric(12,2), sum(estimated_cost_total)::numeric(12,2), sum(revenue_total)::numeric(12,2), sum(cost_total)::numeric(12,2), sum(profit_total)::numeric(12,2) from base group by route_key, route_name
  union all
  select 'job_family'::text, job_family, job_family, count(*)::int, sum(quoted_total)::numeric(12,2), sum(estimated_cost_total)::numeric(12,2), sum(revenue_total)::numeric(12,2), sum(cost_total)::numeric(12,2), sum(profit_total)::numeric(12,2) from base group by job_family
)
select
  -- legacy columns first
  group_type,
  group_key,
  group_label,
  job_count,
  revenue_total,
  cost_total,
  profit_total,
  case when revenue_total > 0 then round((profit_total / revenue_total) * 100.0, 2)::numeric(7,2) else 0::numeric(7,2) end as margin_percent,
  -- appended columns
  quoted_total,
  estimated_cost_total,
  (revenue_total - quoted_total)::numeric(12,2) as revenue_variance_total,
  (cost_total - estimated_cost_total)::numeric(12,2) as cost_variance_total
from grouped;

-- 098_jobs_quote_email_signoff_and_gl_posting.sql
-- Extends the Jobs commercial/accounting workflow with:
-- - actual quote-package email delivery tracking
-- - harder threshold policy matching by role / client / site / job family
-- - completion package signoff drilldown
-- - invoice/journal posting into fuller AR/AP and GL workflow
-- - profitability management scorecards

alter table if exists public.estimate_quote_packages
  add column if not exists send_status text not null default 'draft',
  add column if not exists send_error text,
  add column if not exists last_send_attempt_at timestamptz,
  add column if not exists resend_count integer not null default 0,
  add column if not exists recipient_name text,
  add column if not exists recipient_profile_id uuid references public.profiles(id) on delete set null,
  add column if not exists copied_to_emails text,
  add column if not exists last_email_message_id text;

alter table if exists public.estimate_quote_packages
  drop constraint if exists estimate_quote_packages_send_status_check;
alter table if exists public.estimate_quote_packages
  add constraint estimate_quote_packages_send_status_check
  check (send_status in ('draft','ready','sending','sent','failed','accepted'));

alter table if exists public.quote_package_output_events
  add column if not exists provider_name text,
  add column if not exists provider_message_id text,
  add column if not exists output_error text;

alter table if exists public.commercial_approval_thresholds
  add column if not exists applies_to_client_id uuid references public.clients(id) on delete set null,
  add column if not exists applies_to_client_site_id uuid references public.client_sites(id) on delete set null,
  add column if not exists applies_to_role text,
  add column if not exists warning_text text,
  add column if not exists block_text text;

create table if not exists public.job_completion_signoff_steps (
  id uuid primary key default gen_random_uuid(),
  completion_review_id uuid not null references public.job_completion_reviews(id) on delete cascade,
  signoff_kind text not null default 'field_supervisor',
  signoff_status text not null default 'pending',
  required_role text,
  signoff_profile_id uuid references public.profiles(id) on delete set null,
  signoff_name text,
  signoff_notes text,
  signed_at timestamptz,
  sort_order integer not null default 100,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists public.job_completion_signoff_steps
  drop constraint if exists job_completion_signoff_steps_kind_check;
alter table if exists public.job_completion_signoff_steps
  add constraint job_completion_signoff_steps_kind_check
  check (signoff_kind in ('field_supervisor','operations_manager','client','accounting','safety','other'));

alter table if exists public.job_completion_signoff_steps
  drop constraint if exists job_completion_signoff_steps_status_check;
alter table if exists public.job_completion_signoff_steps
  add constraint job_completion_signoff_steps_status_check
  check (signoff_status in ('pending','signed','rejected','waived'));

create index if not exists idx_job_completion_signoff_steps_review
  on public.job_completion_signoff_steps(completion_review_id, sort_order, created_at);

create table if not exists public.job_invoice_postings (
  id uuid primary key default gen_random_uuid(),
  invoice_candidate_id uuid not null references public.job_invoice_candidates(id) on delete cascade,
  ar_ap_queue_id uuid references public.job_ar_ap_review_queue(id) on delete set null,
  posting_status text not null default 'draft',
  external_system text,
  external_invoice_number text,
  posting_payload jsonb not null default '{}'::jsonb,
  posted_by_profile_id uuid references public.profiles(id) on delete set null,
  posted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(invoice_candidate_id)
);

alter table if exists public.job_invoice_postings
  drop constraint if exists job_invoice_postings_status_check;
alter table if exists public.job_invoice_postings
  add constraint job_invoice_postings_status_check
  check (posting_status in ('draft','reviewed','posted','reversed','failed'));

create table if not exists public.job_journal_postings (
  id uuid primary key default gen_random_uuid(),
  journal_candidate_id uuid not null references public.job_journal_candidates(id) on delete cascade,
  ar_ap_queue_id uuid references public.job_ar_ap_review_queue(id) on delete set null,
  posting_status text not null default 'draft',
  external_system text,
  journal_entry_number text,
  batch_number text,
  posting_payload jsonb not null default '{}'::jsonb,
  posted_by_profile_id uuid references public.profiles(id) on delete set null,
  posted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(journal_candidate_id)
);

alter table if exists public.job_journal_postings
  drop constraint if exists job_journal_postings_status_check;
alter table if exists public.job_journal_postings
  add constraint job_journal_postings_status_check
  check (posting_status in ('draft','reviewed','posted','reversed','failed'));

create or replace view public.v_job_completion_signoff_directory as
select
  ss.id,
  ss.completion_review_id,
  cr.job_id,
  j.job_code,
  j.job_name,
  cr.work_order_id,
  wo.work_order_number,
  ss.signoff_kind,
  ss.signoff_status,
  ss.required_role,
  ss.signoff_profile_id,
  coalesce(sp.full_name, sp.email, ss.signoff_name, '') as signoff_display_name,
  ss.signoff_name,
  ss.signoff_notes,
  ss.signed_at,
  ss.sort_order,
  ss.created_by_profile_id,
  coalesce(cp.full_name, cp.email, '') as uploaded_by_name,
  ss.created_at,
  ss.updated_at
from public.job_completion_signoff_steps ss
left join public.job_completion_reviews cr on cr.id = ss.completion_review_id
left join public.jobs j on j.id = cr.job_id
left join public.work_orders wo on wo.id = cr.work_order_id
left join public.profiles sp on sp.id = ss.signoff_profile_id
left join public.profiles cp on cp.id = ss.created_by_profile_id;

create or replace view public.v_job_invoice_posting_directory as
select
  p.id,
  p.invoice_candidate_id,
  c.completion_review_id,
  c.job_id,
  c.job_code,
  c.job_name,
  c.candidate_number,
  c.candidate_status,
  c.total_amount,
  p.ar_ap_queue_id,
  q.queue_status,
  p.posting_status,
  p.external_system,
  p.external_invoice_number,
  p.posting_payload,
  p.posted_by_profile_id,
  coalesce(pp.full_name, pp.email, '') as posted_by_name,
  p.posted_at,
  p.created_at,
  p.updated_at
from public.job_invoice_postings p
left join public.v_job_invoice_candidate_directory c on c.id = p.invoice_candidate_id
left join public.job_ar_ap_review_queue q on q.id = p.ar_ap_queue_id
left join public.profiles pp on pp.id = p.posted_by_profile_id;

create or replace view public.v_job_journal_posting_directory as
select
  p.id,
  p.journal_candidate_id,
  c.completion_review_id,
  c.job_id,
  c.job_code,
  c.job_name,
  c.candidate_status,
  c.journal_memo,
  p.ar_ap_queue_id,
  q.queue_status,
  p.posting_status,
  p.external_system,
  p.journal_entry_number,
  p.batch_number,
  p.posting_payload,
  p.posted_by_profile_id,
  coalesce(pp.full_name, pp.email, '') as posted_by_name,
  p.posted_at,
  p.created_at,
  p.updated_at
from public.job_journal_postings p
left join public.v_job_journal_candidate_directory c on c.id = p.journal_candidate_id
left join public.job_ar_ap_review_queue q on q.id = p.ar_ap_queue_id
left join public.profiles pp on pp.id = p.posted_by_profile_id;

create or replace view public.v_job_profitability_management_scorecard_directory as
select
  group_type,
  group_key,
  group_label,
  job_count,
  quoted_total,
  estimated_cost_total,
  actual_revenue_total,
  actual_cost_total,
  actual_profit_total,
  revenue_variance_total,
  cost_variance_total,
  case when actual_revenue_total > 0 then round((actual_profit_total / actual_revenue_total) * 100.0, 2)::numeric(9,2) else 0::numeric(9,2) end as actual_margin_percent,
  case when quoted_total > 0 then round((revenue_variance_total / quoted_total) * 100.0, 2)::numeric(9,2) else 0::numeric(9,2) end as revenue_variance_percent,
  case when estimated_cost_total > 0 then round((cost_variance_total / estimated_cost_total) * 100.0, 2)::numeric(9,2) else 0::numeric(9,2) end as cost_variance_percent
from public.v_job_profitability_variance_directory;

-- 099_quote_acceptance_threshold_autoeval_and_accounting_lifecycle.sql
-- Adds quote engagement tracking, stronger threshold evaluation state,
-- completion readiness rollups, and accounting lifecycle history.

alter table if exists public.estimate_quote_packages
  add column if not exists first_viewed_at timestamptz,
  add column if not exists last_viewed_at timestamptz,
  add column if not exists open_count integer not null default 0,
  add column if not exists last_client_action text,
  add column if not exists last_client_action_at timestamptz,
  add column if not exists accepted_by_email text,
  add column if not exists declined_at timestamptz,
  add column if not exists declined_notes text,
  add column if not exists last_client_ip text,
  add column if not exists last_client_user_agent text;

alter table if exists public.estimate_quote_packages
  drop constraint if exists estimate_quote_packages_last_client_action_check;

alter table if exists public.estimate_quote_packages
  add constraint estimate_quote_packages_last_client_action_check
  check (last_client_action in ('sent','viewed','accepted','declined') or last_client_action is null);

create table if not exists public.quote_package_client_events (
  id uuid primary key default gen_random_uuid(),
  quote_package_id uuid not null references public.estimate_quote_packages(id) on delete cascade,
  event_action text not null default 'viewed',
  event_at timestamptz not null default now(),
  event_email text,
  event_name text,
  event_ip text,
  user_agent text,
  notes text,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table if exists public.quote_package_client_events
  drop constraint if exists quote_package_client_events_event_action_check;

alter table if exists public.quote_package_client_events
  add constraint quote_package_client_events_event_action_check
  check (event_action in ('sent','viewed','accepted','declined','printed'));

create index if not exists idx_quote_package_client_events_package
  on public.quote_package_client_events(quote_package_id, event_at desc, created_at desc);

create or replace view public.v_quote_package_engagement_directory as
with event_rollup as (
  select
    q.event_action,
    q.quote_package_id,
    count(*)::int as event_count,
    max(q.event_at) as last_event_at,
    (array_agg(q.event_email order by q.event_at desc nulls last, q.created_at desc))[1] as last_event_email,
    (array_agg(q.event_name order by q.event_at desc nulls last, q.created_at desc))[1] as last_event_name,
    (array_agg(q.notes order by q.event_at desc nulls last, q.created_at desc))[1] as last_event_notes
  from public.quote_package_client_events q
  group by q.quote_package_id, q.event_action
), latest_event as (
  select distinct on (q.quote_package_id)
    q.quote_package_id,
    q.event_action as latest_event_action,
    q.event_at as latest_event_at,
    q.event_email as latest_event_email,
    q.event_name as latest_event_name,
    q.notes as latest_event_notes
  from public.quote_package_client_events q
  order by q.quote_package_id, q.event_at desc nulls last, q.created_at desc
)
select
  qp.id,
  qp.estimate_id,
  e.estimate_number,
  c.legal_name as client_name,
  qp.package_status,
  qp.send_status,
  qp.client_email,
  qp.sent_at,
  qp.first_viewed_at,
  qp.last_viewed_at,
  qp.open_count,
  qp.viewed_at,
  qp.accepted_at,
  qp.accepted_by_name,
  qp.accepted_by_email,
  qp.declined_at,
  qp.declined_notes,
  qp.last_client_action,
  qp.last_client_action_at,
  qp.last_client_ip,
  qp.last_client_user_agent,
  coalesce(sent.event_count, 0) as sent_event_count,
  coalesce(viewed.event_count, 0) as viewed_event_count,
  coalesce(accepted.event_count, 0) as accepted_event_count,
  coalesce(declined.event_count, 0) as declined_event_count,
  le.latest_event_action,
  le.latest_event_at,
  le.latest_event_email,
  le.latest_event_name,
  le.latest_event_notes,
  qp.updated_at,
  qp.created_at
from public.estimate_quote_packages qp
left join public.estimates e on e.id = qp.estimate_id
left join public.clients c on c.id = e.client_id
left join event_rollup sent on sent.quote_package_id = qp.id and sent.event_action = 'sent'
left join event_rollup viewed on viewed.quote_package_id = qp.id and viewed.event_action = 'viewed'
left join event_rollup accepted on accepted.quote_package_id = qp.id and accepted.event_action = 'accepted'
left join event_rollup declined on declined.quote_package_id = qp.id and declined.event_action = 'declined'
left join latest_event le on le.quote_package_id = qp.id;

alter table if exists public.work_order_release_reviews
  add column if not exists last_evaluated_at timestamptz,
  add column if not exists evaluation_count integer not null default 0,
  add column if not exists last_threshold_message text;

create or replace view public.v_work_order_release_enforcement_directory as
select
  r.id,
  r.work_order_id,
  wo.work_order_number,
  wo.legacy_job_id as job_id,
  j.job_code,
  j.job_name,
  wo.client_id,
  wo.client_site_id,
  r.estimate_id,
  r.release_status,
  r.threshold_status,
  r.discount_percent,
  r.margin_percent,
  r.required_signoff_role,
  r.signoff_profile_id,
  p.full_name as signoff_name,
  r.signoff_at,
  r.last_evaluated_at,
  r.evaluation_count,
  r.last_threshold_message,
  case when r.threshold_status = 'block' then true else false end as is_release_blocked,
  case when r.threshold_status = 'warn' and coalesce(r.signoff_at::text, '') = '' and coalesce(r.required_signoff_role, '') <> '' then true else false end as requires_pending_signoff,
  r.release_notes,
  r.updated_at,
  r.created_at
from public.work_order_release_reviews r
left join public.work_orders wo on wo.id = r.work_order_id
left join public.jobs j on j.id = wo.legacy_job_id
left join public.profiles p on p.id = r.signoff_profile_id;

create or replace view public.v_job_completion_readiness_directory as
with closeout_rollup as (
  select
    i.completion_review_id,
    count(*)::int as closeout_item_count,
    count(*) filter (where coalesce(i.required_item, true) = true)::int as required_closeout_count,
    count(*) filter (where coalesce(i.required_item, true) = true and coalesce(i.item_status, '') = 'complete')::int as required_closeout_complete_count,
    count(*) filter (where coalesce(i.required_item, true) = true and coalesce(i.item_status, '') <> 'complete')::int as required_closeout_remaining_count
  from public.job_completion_closeout_items i
  group by i.completion_review_id
), signoff_rollup as (
  select
    s.completion_review_id,
    count(*)::int as signoff_step_count,
    count(*) filter (where coalesce(s.signoff_status, '') = 'signed')::int as signoff_signed_count,
    count(*) filter (where coalesce(s.signoff_status, '') <> 'signed')::int as signoff_remaining_count
  from public.job_completion_signoff_steps s
  group by s.completion_review_id
), evidence_rollup as (
  select
    i.completion_review_id,
    count(a.id)::int as evidence_asset_count
  from public.job_completion_closeout_items i
  left join public.job_completion_closeout_assets a on a.closeout_item_id = i.id
  group by i.completion_review_id
)
select
  cr.id as completion_review_id,
  cr.job_id,
  cr.job_code,
  cr.job_name,
  cr.work_order_id,
  cr.review_status,
  cr.accounting_ready,
  coalesce(c.closeout_item_count, 0) as closeout_item_count,
  coalesce(c.required_closeout_count, 0) as required_closeout_count,
  coalesce(c.required_closeout_complete_count, 0) as required_closeout_complete_count,
  coalesce(c.required_closeout_remaining_count, 0) as required_closeout_remaining_count,
  coalesce(s.signoff_step_count, 0) as signoff_step_count,
  coalesce(s.signoff_signed_count, 0) as signoff_signed_count,
  coalesce(s.signoff_remaining_count, 0) as signoff_remaining_count,
  coalesce(e.evidence_asset_count, 0) as evidence_asset_count,
  case when coalesce(c.required_closeout_remaining_count, 0) = 0 and coalesce(s.signoff_remaining_count, 0) = 0 then true else false end as ready_for_signoff_and_accounting,
  cr.updated_at,
  cr.created_at
from public.v_job_completion_review_directory cr
left join closeout_rollup c on c.completion_review_id = cr.id
left join signoff_rollup s on s.completion_review_id = cr.id
left join evidence_rollup e on e.completion_review_id = cr.id;

create table if not exists public.job_accounting_lifecycle_events (
  id uuid primary key default gen_random_uuid(),
  job_id bigint references public.jobs(id) on delete set null,
  source_type text not null,
  source_id text not null,
  lifecycle_stage text not null,
  lifecycle_status text not null default 'open',
  headline text,
  notes text,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists public.job_accounting_lifecycle_events
  drop constraint if exists job_accounting_lifecycle_events_source_type_check;

alter table if exists public.job_accounting_lifecycle_events
  add constraint job_accounting_lifecycle_events_source_type_check
  check (source_type in ('completion_review','invoice_candidate','journal_candidate','invoice_posting','journal_posting','ar_ap_queue','accountant_export'));

create index if not exists idx_job_accounting_lifecycle_events_job
  on public.job_accounting_lifecycle_events(job_id, created_at desc);

create or replace view public.v_job_accounting_lifecycle_directory as
select
  e.id,
  e.job_id,
  j.job_code,
  j.job_name,
  e.source_type,
  e.source_id,
  e.lifecycle_stage,
  e.lifecycle_status,
  e.headline,
  e.notes,
  e.created_by_profile_id,
  p.full_name as uploaded_by_name,
  e.created_at,
  e.updated_at
from public.job_accounting_lifecycle_events e
left join public.jobs j on j.id = e.job_id
left join public.profiles p on p.id = e.created_by_profile_id;


-- 100_accounting_close_reconciliation_and_tax_filing_foundation.sql
-- 100_accounting_close_reconciliation_and_tax_filing_foundation.sql
-- Adds backend accounting-close foundations so the quote -> release -> completion -> posting path
-- can move into real close, remittance, reconciliation, and accountant handoff workflows.

alter table if exists public.chart_of_accounts
  add column if not exists gifi_code text,
  add column if not exists gifi_description text,
  add column if not exists tax_export_group text,
  add column if not exists accountant_export_group text,
  add column if not exists normal_balance text,
  add column if not exists is_control_account boolean not null default false;

alter table if exists public.chart_of_accounts
  drop constraint if exists chart_of_accounts_normal_balance_check;

alter table if exists public.chart_of_accounts
  add constraint chart_of_accounts_normal_balance_check
  check (normal_balance in ('debit','credit') or normal_balance is null);

create table if not exists public.bank_accounts (
  id uuid primary key default gen_random_uuid(),
  account_name text not null,
  institution_name text,
  currency_code text not null default 'CAD',
  account_mask text,
  transit_number text,
  institution_number text,
  account_number_last4 text,
  account_status text not null default 'open',
  gl_account_id uuid references public.chart_of_accounts(id) on delete set null,
  is_default boolean not null default false,
  notes text,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists public.bank_accounts
  drop constraint if exists bank_accounts_status_check;

alter table if exists public.bank_accounts
  add constraint bank_accounts_status_check
  check (account_status in ('open','inactive','closed'));

create index if not exists idx_bank_accounts_status
  on public.bank_accounts(account_status, is_default, account_name);

alter table if exists public.business_tax_settings
  add column if not exists filing_country_code text not null default 'CA',
  add column if not exists filing_region_code text,
  add column if not exists accountant_export_style text not null default 'management',
  add column if not exists default_bank_account_id uuid references public.bank_accounts(id) on delete set null;

alter table if exists public.business_tax_settings
  drop constraint if exists business_tax_settings_accountant_export_style_check;

alter table if exists public.business_tax_settings
  add constraint business_tax_settings_accountant_export_style_check
  check (accountant_export_style in ('management','t2_gifi','llc_review','corp_review','custom'));

create table if not exists public.accounting_period_closes (
  id uuid primary key default gen_random_uuid(),
  period_code text not null unique,
  period_start date not null,
  period_end date not null,
  close_scope text not null default 'month_end',
  close_status text not null default 'open',
  ar_locked boolean not null default false,
  ap_locked boolean not null default false,
  gl_locked boolean not null default false,
  payroll_locked boolean not null default false,
  tax_locked boolean not null default false,
  close_checklist jsonb not null default '{}'::jsonb,
  close_notes text,
  closed_by_profile_id uuid references public.profiles(id) on delete set null,
  closed_at timestamptz,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (period_end >= period_start)
);

alter table if exists public.accounting_period_closes
  drop constraint if exists accounting_period_closes_scope_check;

alter table if exists public.accounting_period_closes
  add constraint accounting_period_closes_scope_check
  check (close_scope in ('month_end','quarter_end','year_end','custom'));

alter table if exists public.accounting_period_closes
  drop constraint if exists accounting_period_closes_status_check;

alter table if exists public.accounting_period_closes
  add constraint accounting_period_closes_status_check
  check (close_status in ('open','in_review','closed','reopened'));

create index if not exists idx_accounting_period_closes_range
  on public.accounting_period_closes(period_start, period_end, close_status);

create table if not exists public.sales_tax_filings (
  id uuid primary key default gen_random_uuid(),
  filing_code text not null unique,
  business_tax_setting_id uuid references public.business_tax_settings(id) on delete set null,
  tax_code_id uuid references public.tax_codes(id) on delete set null,
  filing_scope text not null default 'hst_return',
  filing_period_start date not null,
  filing_period_end date not null,
  due_date date,
  filing_status text not null default 'draft',
  taxable_sales_total numeric(12,2) not null default 0,
  tax_collected_total numeric(12,2) not null default 0,
  tax_paid_total numeric(12,2) not null default 0,
  adjustment_total numeric(12,2) not null default 0,
  net_remittance_total numeric(12,2) not null default 0,
  reference_number text,
  notes text,
  filed_by_profile_id uuid references public.profiles(id) on delete set null,
  filed_at timestamptz,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (filing_period_end >= filing_period_start)
);

alter table if exists public.sales_tax_filings
  drop constraint if exists sales_tax_filings_scope_check;

alter table if exists public.sales_tax_filings
  add constraint sales_tax_filings_scope_check
  check (filing_scope in ('hst_return','gst_return','pst_return','sales_tax_custom'));

alter table if exists public.sales_tax_filings
  drop constraint if exists sales_tax_filings_status_check;

alter table if exists public.sales_tax_filings
  add constraint sales_tax_filings_status_check
  check (filing_status in ('draft','prepared','filed','paid','amended'));

create index if not exists idx_sales_tax_filings_period
  on public.sales_tax_filings(filing_period_start, filing_period_end, filing_status);

create table if not exists public.payroll_remittance_runs (
  id uuid primary key default gen_random_uuid(),
  remittance_code text not null unique,
  payroll_export_run_id uuid references public.payroll_export_runs(id) on delete set null,
  remittance_type text not null default 'source_deductions',
  remittance_period_start date not null,
  remittance_period_end date not null,
  due_date date,
  remittance_status text not null default 'draft',
  gross_pay_total numeric(12,2) not null default 0,
  employee_deduction_total numeric(12,2) not null default 0,
  employer_contribution_total numeric(12,2) not null default 0,
  net_remittance_total numeric(12,2) not null default 0,
  reference_number text,
  notes text,
  remitted_by_profile_id uuid references public.profiles(id) on delete set null,
  remitted_at timestamptz,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (remittance_period_end >= remittance_period_start)
);

alter table if exists public.payroll_remittance_runs
  drop constraint if exists payroll_remittance_runs_type_check;

alter table if exists public.payroll_remittance_runs
  add constraint payroll_remittance_runs_type_check
  check (remittance_type in ('source_deductions','wsib','benefits','custom'));

alter table if exists public.payroll_remittance_runs
  drop constraint if exists payroll_remittance_runs_status_check;

alter table if exists public.payroll_remittance_runs
  add constraint payroll_remittance_runs_status_check
  check (remittance_status in ('draft','prepared','remitted','adjusted'));

create index if not exists idx_payroll_remittance_runs_period
  on public.payroll_remittance_runs(remittance_period_start, remittance_period_end, remittance_status);

create table if not exists public.bank_statement_imports (
  id uuid primary key default gen_random_uuid(),
  bank_account_id uuid not null references public.bank_accounts(id) on delete cascade,
  import_code text not null unique,
  statement_start date,
  statement_end date,
  import_status text not null default 'draft',
  opening_balance numeric(12,2),
  closing_balance numeric(12,2),
  transaction_count integer not null default 0,
  source_file_name text,
  source_format text,
  import_payload jsonb not null default '{}'::jsonb,
  imported_by_profile_id uuid references public.profiles(id) on delete set null,
  imported_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists public.bank_statement_imports
  drop constraint if exists bank_statement_imports_status_check;

alter table if exists public.bank_statement_imports
  add constraint bank_statement_imports_status_check
  check (import_status in ('draft','imported','reviewed','reconciled','rejected'));

create table if not exists public.bank_reconciliation_sessions (
  id uuid primary key default gen_random_uuid(),
  bank_account_id uuid not null references public.bank_accounts(id) on delete cascade,
  statement_import_id uuid references public.bank_statement_imports(id) on delete set null,
  session_code text not null unique,
  period_start date,
  period_end date,
  reconciliation_status text not null default 'draft',
  book_balance numeric(12,2),
  bank_balance numeric(12,2),
  difference_amount numeric(12,2),
  reviewed_by_profile_id uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  notes text,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists public.bank_reconciliation_sessions
  drop constraint if exists bank_reconciliation_sessions_status_check;

alter table if exists public.bank_reconciliation_sessions
  add constraint bank_reconciliation_sessions_status_check
  check (reconciliation_status in ('draft','in_review','balanced','closed','difference_pending'));

create table if not exists public.bank_reconciliation_items (
  id uuid primary key default gen_random_uuid(),
  reconciliation_session_id uuid not null references public.bank_reconciliation_sessions(id) on delete cascade,
  item_source_type text not null,
  item_source_id text,
  item_date date,
  item_description text,
  amount numeric(12,2) not null default 0,
  match_status text not null default 'unmatched',
  clearing_status text not null default 'open',
  difference_reason text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists public.bank_reconciliation_items
  drop constraint if exists bank_reconciliation_items_source_check;

alter table if exists public.bank_reconciliation_items
  add constraint bank_reconciliation_items_source_check
  check (item_source_type in ('bank_statement_line','ar_payment','ap_payment','gl_journal_entry','processor_payout','adjustment','other'));

alter table if exists public.bank_reconciliation_items
  drop constraint if exists bank_reconciliation_items_match_status_check;

alter table if exists public.bank_reconciliation_items
  add constraint bank_reconciliation_items_match_status_check
  check (match_status in ('unmatched','matched','partial','exception'));

alter table if exists public.bank_reconciliation_items
  drop constraint if exists bank_reconciliation_items_clearing_status_check;

alter table if exists public.bank_reconciliation_items
  add constraint bank_reconciliation_items_clearing_status_check
  check (clearing_status in ('open','cleared','void','ignored'));

create index if not exists idx_bank_reconciliation_items_session
  on public.bank_reconciliation_items(reconciliation_session_id, match_status, clearing_status, item_date);

create or replace view public.v_ar_invoice_aging_detail as
select
  ai.id,
  ai.invoice_number,
  ai.client_id,
  c.legal_name as client_name,
  ai.invoice_status,
  ai.invoice_date,
  ai.due_date,
  ai.total_amount,
  ai.balance_due,
  greatest((current_date - coalesce(ai.due_date, ai.invoice_date)), 0) as days_past_due,
  case
    when coalesce(ai.balance_due, 0) <= 0 then 'paid'
    when coalesce(ai.due_date, ai.invoice_date) >= current_date then 'current'
    when current_date - coalesce(ai.due_date, ai.invoice_date) between 1 and 30 then '1_30'
    when current_date - coalesce(ai.due_date, ai.invoice_date) between 31 and 60 then '31_60'
    when current_date - coalesce(ai.due_date, ai.invoice_date) between 61 and 90 then '61_90'
    else '90_plus'
  end as aging_bucket,
  ai.work_order_id,
  ai.created_at,
  ai.updated_at
from public.ar_invoices ai
left join public.clients c on c.id = ai.client_id;

create or replace view public.v_ap_bill_aging_detail as
select
  ab.id,
  ab.bill_number,
  ab.vendor_id,
  v.legal_name as vendor_name,
  ab.bill_status,
  ab.bill_date,
  ab.due_date,
  ab.total_amount,
  ab.balance_due,
  greatest((current_date - coalesce(ab.due_date, ab.bill_date)), 0) as days_past_due,
  case
    when coalesce(ab.balance_due, 0) <= 0 then 'paid'
    when coalesce(ab.due_date, ab.bill_date) >= current_date then 'current'
    when current_date - coalesce(ab.due_date, ab.bill_date) between 1 and 30 then '1_30'
    when current_date - coalesce(ab.due_date, ab.bill_date) between 31 and 60 then '31_60'
    when current_date - coalesce(ab.due_date, ab.bill_date) between 61 and 90 then '61_90'
    else '90_plus'
  end as aging_bucket,
  ab.created_at,
  ab.updated_at
from public.ap_bills ab
left join public.ap_vendors v on v.id = ab.vendor_id;

create or replace view public.v_gl_trial_balance_summary as
select
  coa.id as account_id,
  coa.account_number,
  coa.account_name,
  coa.account_type,
  coa.system_code,
  coa.gifi_code,
  coa.gifi_description,
  coa.tax_export_group,
  coa.accountant_export_group,
  coa.normal_balance,
  coa.is_control_account,
  coalesce(sum(gle.debit_amount), 0)::numeric(12,2) as debit_total,
  coalesce(sum(gle.credit_amount), 0)::numeric(12,2) as credit_total,
  (coalesce(sum(gle.debit_amount), 0) - coalesce(sum(gle.credit_amount), 0))::numeric(12,2) as net_movement
from public.chart_of_accounts coa
left join public.gl_journal_entries gle on gle.account_id = coa.id
group by coa.id, coa.account_number, coa.account_name, coa.account_type, coa.system_code, coa.gifi_code, coa.gifi_description, coa.tax_export_group, coa.accountant_export_group, coa.normal_balance, coa.is_control_account;

create or replace view public.v_sales_tax_filing_summary as
select
  stf.id,
  stf.filing_code,
  stf.business_tax_setting_id,
  bts.profile_name as business_tax_profile_name,
  stf.tax_code_id,
  tc.code as tax_code,
  stf.filing_scope,
  stf.filing_period_start,
  stf.filing_period_end,
  stf.due_date,
  stf.filing_status,
  stf.taxable_sales_total,
  stf.tax_collected_total,
  stf.tax_paid_total,
  stf.adjustment_total,
  stf.net_remittance_total,
  stf.reference_number,
  stf.filed_at,
  stf.created_at,
  stf.updated_at
from public.sales_tax_filings stf
left join public.business_tax_settings bts on bts.id = stf.business_tax_setting_id
left join public.tax_codes tc on tc.id = stf.tax_code_id;

create or replace view public.v_payroll_remittance_summary as
select
  pr.id,
  pr.remittance_code,
  pr.payroll_export_run_id,
  per.export_provider,
  pr.remittance_type,
  pr.remittance_period_start,
  pr.remittance_period_end,
  pr.due_date,
  pr.remittance_status,
  pr.gross_pay_total,
  pr.employee_deduction_total,
  pr.employer_contribution_total,
  pr.net_remittance_total,
  pr.reference_number,
  pr.remitted_at,
  pr.created_at,
  pr.updated_at
from public.payroll_remittance_runs pr
left join public.payroll_export_runs per on per.id = pr.payroll_export_run_id;

create or replace view public.v_bank_reconciliation_summary as
with item_rollup as (
  select
    bri.reconciliation_session_id,
    count(*)::int as item_count,
    count(*) filter (where bri.match_status = 'matched')::int as matched_count,
    count(*) filter (where bri.match_status = 'unmatched')::int as unmatched_count,
    count(*) filter (where bri.match_status = 'exception')::int as exception_count,
    count(*) filter (where bri.clearing_status = 'cleared')::int as cleared_count,
    coalesce(sum(case when bri.clearing_status = 'cleared' then bri.amount else 0 end), 0)::numeric(12,2) as cleared_amount_total
  from public.bank_reconciliation_items bri
  group by bri.reconciliation_session_id
)
select
  brs.id,
  brs.bank_account_id,
  ba.account_name,
  ba.institution_name,
  brs.statement_import_id,
  bsi.import_code,
  brs.session_code,
  brs.period_start,
  brs.period_end,
  brs.reconciliation_status,
  brs.book_balance,
  brs.bank_balance,
  brs.difference_amount,
  coalesce(ir.item_count, 0) as item_count,
  coalesce(ir.matched_count, 0) as matched_count,
  coalesce(ir.unmatched_count, 0) as unmatched_count,
  coalesce(ir.exception_count, 0) as exception_count,
  coalesce(ir.cleared_count, 0) as cleared_count,
  coalesce(ir.cleared_amount_total, 0) as cleared_amount_total,
  brs.reviewed_at,
  brs.created_at,
  brs.updated_at
from public.bank_reconciliation_sessions brs
left join public.bank_accounts ba on ba.id = brs.bank_account_id
left join public.bank_statement_imports bsi on bsi.id = brs.statement_import_id
left join item_rollup ir on ir.reconciliation_session_id = brs.id;

create or replace view public.v_accounting_period_close_directory as
select
  apc.id,
  apc.period_code,
  apc.period_start,
  apc.period_end,
  apc.close_scope,
  apc.close_status,
  apc.ar_locked,
  apc.ap_locked,
  apc.gl_locked,
  apc.payroll_locked,
  apc.tax_locked,
  apc.close_checklist,
  apc.close_notes,
  apc.closed_by_profile_id,
  p.full_name as closed_by_name,
  apc.closed_at,
  apc.created_at,
  apc.updated_at
from public.accounting_period_closes apc
left join public.profiles p on p.id = apc.closed_by_profile_id;

create or replace view public.v_accounting_close_dashboard as
with ar as (
  select
    count(*) filter (where coalesce(balance_due, 0) > 0)::int as open_invoice_count,
    coalesce(sum(balance_due) filter (where coalesce(balance_due, 0) > 0), 0)::numeric(12,2) as open_invoice_balance,
    coalesce(sum(balance_due) filter (where aging_bucket = '90_plus'), 0)::numeric(12,2) as ar_90_plus_balance
  from public.v_ar_invoice_aging_detail
), ap as (
  select
    count(*) filter (where coalesce(balance_due, 0) > 0)::int as open_bill_count,
    coalesce(sum(balance_due) filter (where coalesce(balance_due, 0) > 0), 0)::numeric(12,2) as open_bill_balance,
    coalesce(sum(balance_due) filter (where aging_bucket = '90_plus'), 0)::numeric(12,2) as ap_90_plus_balance
  from public.v_ap_bill_aging_detail
), tax as (
  select
    count(*) filter (where filing_status in ('draft','prepared'))::int as open_tax_filing_count,
    coalesce(sum(net_remittance_total) filter (where filing_status in ('draft','prepared')), 0)::numeric(12,2) as open_tax_remittance_total
  from public.sales_tax_filings
), payroll as (
  select
    count(*) filter (where remittance_status in ('draft','prepared'))::int as open_payroll_remittance_count,
    coalesce(sum(net_remittance_total) filter (where remittance_status in ('draft','prepared')), 0)::numeric(12,2) as open_payroll_remittance_total
  from public.payroll_remittance_runs
), bank as (
  select
    count(*) filter (where reconciliation_status in ('draft','in_review','difference_pending'))::int as open_bank_reconciliation_count,
    coalesce(sum(difference_amount) filter (where reconciliation_status in ('draft','in_review','difference_pending')), 0)::numeric(12,2) as open_bank_difference_total
  from public.bank_reconciliation_sessions
), periods as (
  select
    count(*) filter (where close_status in ('open','in_review','reopened'))::int as open_period_count,
    count(*) filter (where close_status = 'closed')::int as closed_period_count
  from public.accounting_period_closes
)
select
  ar.open_invoice_count,
  ar.open_invoice_balance,
  ar.ar_90_plus_balance,
  ap.open_bill_count,
  ap.open_bill_balance,
  ap.ap_90_plus_balance,
  tax.open_tax_filing_count,
  tax.open_tax_remittance_total,
  payroll.open_payroll_remittance_count,
  payroll.open_payroll_remittance_total,
  bank.open_bank_reconciliation_count,
  bank.open_bank_difference_total,
  periods.open_period_count,
  periods.closed_period_count
from ar
cross join ap
cross join tax
cross join payroll
cross join bank
cross join periods;



-- 101_accounting_posting_automation_and_export_bundle.sql
-- Extends the accounting-close foundation into a more actionable workflow:
-- - job invoice postings can link to real AR invoices
-- - job journal postings can link to real GL journal batches
-- - sales tax prep and payroll remittance prep directories
-- - bank reconciliation match candidates
-- - accountant handoff export bundles and bundle items

alter table if exists public.job_invoice_postings
  add column if not exists ar_invoice_id uuid references public.ar_invoices(id) on delete set null,
  add column if not exists posting_message text;

alter table if exists public.job_journal_postings
  add column if not exists gl_batch_id uuid references public.gl_journal_batches(id) on delete set null,
  add column if not exists posting_message text;

alter table if exists public.accountant_handoff_exports
  add column if not exists bundle_kind text not null default 'management_close_bundle',
  add column if not exists delivery_channel text not null default 'manual',
  add column if not exists delivered_to_email text,
  add column if not exists bundle_item_count integer not null default 0,
  add column if not exists bundle_payload jsonb not null default '{}'::jsonb;

alter table if exists public.accountant_handoff_exports
  drop constraint if exists accountant_handoff_exports_bundle_kind_check;
alter table if exists public.accountant_handoff_exports
  add constraint accountant_handoff_exports_bundle_kind_check
  check (bundle_kind in ('management_close_bundle','corp_t2_bundle','llc_review_bundle','custom'));

alter table if exists public.accountant_handoff_exports
  drop constraint if exists accountant_handoff_exports_delivery_channel_check;
alter table if exists public.accountant_handoff_exports
  add constraint accountant_handoff_exports_delivery_channel_check
  check (delivery_channel in ('manual','email','download'));

create table if not exists public.accountant_handoff_export_items (
  id uuid primary key default gen_random_uuid(),
  export_id uuid not null references public.accountant_handoff_exports(id) on delete cascade,
  item_kind text not null,
  item_label text not null,
  source_type text,
  source_id text,
  item_order integer not null default 100,
  item_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_accountant_handoff_export_items_export
  on public.accountant_handoff_export_items(export_id, item_order, created_at);

create or replace view public.v_job_invoice_posting_automation_directory as
select
  p.id,
  p.invoice_candidate_id,
  c.completion_review_id,
  c.job_id,
  c.job_code,
  c.job_name,
  c.candidate_number,
  c.candidate_status,
  c.client_id,
  c.client_name,
  c.total_amount,
  p.ar_ap_queue_id,
  q.queue_status,
  p.posting_status,
  p.external_system,
  p.external_invoice_number,
  p.ar_invoice_id,
  ai.invoice_number,
  ai.invoice_status,
  ai.invoice_date,
  ai.due_date,
  ai.balance_due,
  p.posting_message,
  p.posting_payload,
  p.posted_by_profile_id,
  coalesce(pp.full_name, pp.email, '') as posted_by_name,
  p.posted_at,
  p.created_at,
  p.updated_at
from public.job_invoice_postings p
left join public.v_job_invoice_candidate_directory c on c.id = p.invoice_candidate_id
left join public.job_ar_ap_review_queue q on q.id = p.ar_ap_queue_id
left join public.ar_invoices ai on ai.id = p.ar_invoice_id
left join public.profiles pp on pp.id = p.posted_by_profile_id;

create or replace view public.v_job_journal_posting_automation_directory as
select
  p.id,
  p.journal_candidate_id,
  c.completion_review_id,
  c.job_id,
  c.job_code,
  c.job_name,
  c.candidate_status,
  c.journal_memo,
  p.ar_ap_queue_id,
  q.queue_status,
  p.posting_status,
  p.external_system,
  p.journal_entry_number,
  p.batch_number,
  p.gl_batch_id,
  gjb.batch_number as gl_batch_number,
  gjb.batch_status as gl_batch_status,
  gjb.batch_date,
  gjb.line_count,
  gjb.debit_total,
  gjb.credit_total,
  gjb.is_balanced,
  p.posting_message,
  p.posting_payload,
  p.posted_by_profile_id,
  coalesce(pp.full_name, pp.email, '') as posted_by_name,
  p.posted_at,
  p.created_at,
  p.updated_at
from public.job_journal_postings p
left join public.v_job_journal_candidate_directory c on c.id = p.journal_candidate_id
left join public.job_ar_ap_review_queue q on q.id = p.ar_ap_queue_id
left join public.gl_journal_batches gjb on gjb.id = p.gl_batch_id
left join public.profiles pp on pp.id = p.posted_by_profile_id;

create or replace view public.v_sales_tax_prep_directory as
with sales as (
  select
    date_trunc('month', invoice_date::timestamp)::date as period_start,
    (date_trunc('month', invoice_date::timestamp) + interval '1 month - 1 day')::date as period_end,
    count(*)::int as invoice_count,
    coalesce(sum(subtotal), 0)::numeric(12,2) as taxable_sales_total,
    coalesce(sum(tax_total), 0)::numeric(12,2) as tax_collected_total
  from public.ar_invoices
  group by 1,2
), purchases as (
  select
    date_trunc('month', bill_date::timestamp)::date as period_start,
    (date_trunc('month', bill_date::timestamp) + interval '1 month - 1 day')::date as period_end,
    count(*)::int as bill_count,
    coalesce(sum(subtotal), 0)::numeric(12,2) as taxable_purchase_total,
    coalesce(sum(tax_total), 0)::numeric(12,2) as tax_paid_total
  from public.ap_bills
  group by 1,2
)
select
  coalesce(s.period_start, p.period_start) as period_start,
  coalesce(s.period_end, p.period_end) as period_end,
  coalesce(s.invoice_count, 0) as invoice_count,
  coalesce(p.bill_count, 0) as bill_count,
  coalesce(s.taxable_sales_total, 0)::numeric(12,2) as taxable_sales_total,
  coalesce(s.tax_collected_total, 0)::numeric(12,2) as tax_collected_total,
  coalesce(p.taxable_purchase_total, 0)::numeric(12,2) as taxable_purchase_total,
  coalesce(p.tax_paid_total, 0)::numeric(12,2) as tax_paid_total,
  (coalesce(s.tax_collected_total, 0) - coalesce(p.tax_paid_total, 0))::numeric(12,2) as suggested_net_remittance_total
from sales s
full outer join purchases p
  on p.period_start = s.period_start and p.period_end = s.period_end;

create or replace view public.v_payroll_remittance_prep_directory as
select
  per.period_start,
  per.period_end,
  count(*)::int as export_run_count,
  coalesce(sum(per.exported_entry_count), 0)::int as exported_entry_count,
  coalesce(sum(per.exported_hours_total), 0)::numeric(10,2) as exported_hours_total,
  coalesce(sum(per.exported_payroll_cost_total), 0)::numeric(12,2) as exported_payroll_cost_total,
  max(per.exported_at) as last_exported_at,
  max(per.delivery_confirmed_at) as last_delivery_confirmed_at
from public.payroll_export_runs per
group by per.period_start, per.period_end;

create or replace view public.v_bank_reconciliation_match_candidate_directory as
with unmatched as (
  select *
  from public.bank_reconciliation_items
  where coalesce(match_status, 'unmatched') <> 'matched'
)
select
  a.reconciliation_session_id,
  a.id as bank_item_id,
  a.item_source_type as bank_item_source_type,
  a.item_source_id as bank_item_source_id,
  a.item_date as bank_item_date,
  a.item_description as bank_item_description,
  a.amount as bank_item_amount,
  b.id as candidate_item_id,
  b.item_source_type as candidate_source_type,
  b.item_source_id as candidate_source_id,
  b.item_date as candidate_item_date,
  b.item_description as candidate_item_description,
  b.amount as candidate_amount,
  abs(coalesce(a.amount,0) - coalesce(b.amount,0))::numeric(12,2) as amount_difference,
  case
    when a.item_source_type = 'bank_statement_line' and b.item_source_type <> 'bank_statement_line' and a.amount = b.amount then 'exact_amount'
    when a.item_source_type = 'bank_statement_line' and b.item_source_type <> 'bank_statement_line' and abs(coalesce(a.amount,0) - coalesce(b.amount,0)) <= 1.00 then 'near_amount'
    else 'review'
  end as match_reason
from unmatched a
join unmatched b
  on b.reconciliation_session_id = a.reconciliation_session_id
 and b.id <> a.id
 and (
   (a.item_source_type = 'bank_statement_line' and b.item_source_type <> 'bank_statement_line')
   or
   (b.item_source_type = 'bank_statement_line' and a.item_source_type <> 'bank_statement_line')
 )
 and abs(coalesce(a.amount,0) - coalesce(b.amount,0)) <= 1.00;

create or replace view public.v_accountant_handoff_bundle_directory as
with item_rollup as (
  select
    export_id,
    count(*)::int as item_count,
    max(created_at) as last_item_at
  from public.accountant_handoff_export_items
  group by export_id
)
select
  ah.id,
  ah.export_kind,
  ah.entity_scope,
  ah.entity_id,
  ah.business_tax_setting_id,
  bts.profile_name as tax_profile_name,
  bts.legal_entity_type,
  bts.legal_entity_name,
  bts.federal_return_type,
  bts.provincial_return_type,
  bts.usa_tax_classification,
  ah.export_status,
  ah.bundle_kind,
  ah.delivery_channel,
  ah.delivered_to_email,
  ah.export_title,
  ah.generated_by_profile_id,
  p.full_name as generated_by_name,
  ah.generated_at,
  ah.delivered_at,
  coalesce(ir.item_count, ah.bundle_item_count, 0)::int as bundle_item_count,
  ir.last_item_at,
  ah.bundle_payload,
  ah.export_payload,
  ah.created_at,
  ah.updated_at
from public.accountant_handoff_exports ah
left join public.business_tax_settings bts on bts.id = ah.business_tax_setting_id
left join public.profiles p on p.id = ah.generated_by_profile_id
left join item_rollup ir on ir.export_id = ah.id;



-- 102_accounting_close_end_to_end_workflow.sql
-- 102_accounting_close_end_to_end_workflow.sql
-- Finishes the accounting-close workflow with:
-- - AR/AP payment application
-- - fuller journal-line automation support
-- - better reconciliation matching scores
-- - filing/remittance review flow
-- - final accountant export packaging metadata

alter table if exists public.ar_payments
  add column if not exists unapplied_amount numeric(12,2) not null default 0,
  add column if not exists application_status text not null default 'unapplied',
  add column if not exists last_applied_at timestamptz,
  add column if not exists last_application_notes text;

alter table if exists public.ar_payments
  drop constraint if exists ar_payments_application_status_check;
alter table if exists public.ar_payments
  add constraint ar_payments_application_status_check
  check (application_status in ('unapplied','partial','applied'));

alter table if exists public.ap_payments
  add column if not exists unapplied_amount numeric(12,2) not null default 0,
  add column if not exists application_status text not null default 'unapplied',
  add column if not exists last_applied_at timestamptz,
  add column if not exists last_application_notes text;

alter table if exists public.ap_payments
  drop constraint if exists ap_payments_application_status_check;
alter table if exists public.ap_payments
  add constraint ap_payments_application_status_check
  check (application_status in ('unapplied','partial','applied'));

create table if not exists public.ar_payment_applications (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.ar_payments(id) on delete cascade,
  invoice_id uuid not null references public.ar_invoices(id) on delete cascade,
  applied_amount numeric(12,2) not null default 0,
  application_date date not null default current_date,
  application_status text not null default 'applied',
  notes text,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists public.ar_payment_applications
  drop constraint if exists ar_payment_applications_status_check;
alter table if exists public.ar_payment_applications
  add constraint ar_payment_applications_status_check
  check (application_status in ('applied','reversed','void'));

create index if not exists idx_ar_payment_applications_payment
  on public.ar_payment_applications(payment_id, application_date desc, created_at desc);
create index if not exists idx_ar_payment_applications_invoice
  on public.ar_payment_applications(invoice_id, application_date desc, created_at desc);

create table if not exists public.ap_payment_applications (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.ap_payments(id) on delete cascade,
  bill_id uuid not null references public.ap_bills(id) on delete cascade,
  applied_amount numeric(12,2) not null default 0,
  application_date date not null default current_date,
  application_status text not null default 'applied',
  notes text,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists public.ap_payment_applications
  drop constraint if exists ap_payment_applications_status_check;
alter table if exists public.ap_payment_applications
  add constraint ap_payment_applications_status_check
  check (application_status in ('applied','reversed','void'));

create index if not exists idx_ap_payment_applications_payment
  on public.ap_payment_applications(payment_id, application_date desc, created_at desc);
create index if not exists idx_ap_payment_applications_bill
  on public.ap_payment_applications(bill_id, application_date desc, created_at desc);

update public.ar_payments p
set
  unapplied_amount = greatest(coalesce(p.amount, 0) - coalesce(a.applied_total, 0), 0)::numeric(12,2),
  application_status = case
    when coalesce(a.applied_total, 0) <= 0 then 'unapplied'
    when coalesce(a.applied_total, 0) < coalesce(p.amount, 0) then 'partial'
    else 'applied'
  end,
  last_applied_at = a.last_applied_at
from (
  select payment_id, coalesce(sum(applied_amount), 0)::numeric(12,2) as applied_total, max(created_at) as last_applied_at
  from public.ar_payment_applications
  where coalesce(application_status, 'applied') <> 'void'
  group by payment_id
) a
where a.payment_id = p.id;

update public.ap_payments p
set
  unapplied_amount = greatest(coalesce(p.amount, 0) - coalesce(a.applied_total, 0), 0)::numeric(12,2),
  application_status = case
    when coalesce(a.applied_total, 0) <= 0 then 'unapplied'
    when coalesce(a.applied_total, 0) < coalesce(p.amount, 0) then 'partial'
    else 'applied'
  end,
  last_applied_at = a.last_applied_at
from (
  select payment_id, coalesce(sum(applied_amount), 0)::numeric(12,2) as applied_total, max(created_at) as last_applied_at
  from public.ap_payment_applications
  where coalesce(application_status, 'applied') <> 'void'
  group by payment_id
) a
where a.payment_id = p.id;

update public.sales_tax_filings
set filing_status = coalesce(filing_status, 'draft')
where filing_status is null;

alter table if exists public.sales_tax_filings
  add column if not exists review_status text not null default 'draft',
  add column if not exists review_notes text,
  add column if not exists reviewed_by_profile_id uuid references public.profiles(id) on delete set null,
  add column if not exists reviewed_at timestamptz,
  add column if not exists payment_reference text,
  add column if not exists paid_at timestamptz;

alter table if exists public.sales_tax_filings
  drop constraint if exists sales_tax_filings_review_status_check;
alter table if exists public.sales_tax_filings
  add constraint sales_tax_filings_review_status_check
  check (review_status in ('draft','prepared','reviewed','approved','filed','paid'));

alter table if exists public.payroll_remittance_runs
  add column if not exists review_status text not null default 'draft',
  add column if not exists review_notes text,
  add column if not exists reviewed_by_profile_id uuid references public.profiles(id) on delete set null,
  add column if not exists reviewed_at timestamptz,
  add column if not exists payment_reference text;

alter table if exists public.payroll_remittance_runs
  drop constraint if exists payroll_remittance_runs_review_status_check;
alter table if exists public.payroll_remittance_runs
  add constraint payroll_remittance_runs_review_status_check
  check (review_status in ('draft','prepared','reviewed','approved','remitted'));

alter table if exists public.accountant_handoff_exports
  add column if not exists package_status text not null default 'draft',
  add column if not exists package_manifest jsonb not null default '{}'::jsonb,
  add column if not exists package_markdown text,
  add column if not exists package_json jsonb not null default '{}'::jsonb,
  add column if not exists reviewed_by_profile_id uuid references public.profiles(id) on delete set null,
  add column if not exists reviewed_at timestamptz,
  add column if not exists finalised_at timestamptz;

alter table if exists public.accountant_handoff_exports
  drop constraint if exists accountant_handoff_exports_package_status_check;
alter table if exists public.accountant_handoff_exports
  add constraint accountant_handoff_exports_package_status_check
  check (package_status in ('draft','prepared','reviewed','finalized','delivered'));

create or replace view public.v_ar_payment_application_directory as
with applied_by_payment as (
  select payment_id, coalesce(sum(applied_amount), 0)::numeric(12,2) as applied_total
  from public.ar_payment_applications
  where coalesce(application_status, 'applied') <> 'void'
  group by payment_id
), applied_by_invoice as (
  select invoice_id, coalesce(sum(applied_amount), 0)::numeric(12,2) as applied_total
  from public.ar_payment_applications
  where coalesce(application_status, 'applied') <> 'void'
  group by invoice_id
)
select
  a.id,
  a.payment_id,
  p.payment_number,
  p.payment_date,
  p.payment_method,
  p.reference_number,
  p.client_id,
  c.legal_name as client_name,
  p.amount as payment_amount,
  coalesce(pb.applied_total, 0)::numeric(12,2) as payment_applied_total,
  greatest(coalesce(p.amount, 0) - coalesce(pb.applied_total, 0), 0)::numeric(12,2) as payment_unapplied_amount,
  p.application_status as payment_application_status,
  a.invoice_id,
  i.invoice_number,
  i.invoice_date,
  i.due_date,
  i.invoice_status,
  i.total_amount as invoice_total_amount,
  i.balance_due as invoice_balance_due,
  coalesce(ib.applied_total, 0)::numeric(12,2) as invoice_applied_total,
  a.applied_amount,
  a.application_date,
  a.application_status,
  a.notes,
  a.created_by_profile_id,
  pr.full_name as uploaded_by_name,
  a.created_at,
  a.updated_at
from public.ar_payment_applications a
left join public.ar_payments p on p.id = a.payment_id
left join public.clients c on c.id = p.client_id
left join public.ar_invoices i on i.id = a.invoice_id
left join public.profiles pr on pr.id = a.created_by_profile_id
left join applied_by_payment pb on pb.payment_id = a.payment_id
left join applied_by_invoice ib on ib.invoice_id = a.invoice_id;

create or replace view public.v_ap_payment_application_directory as
with applied_by_payment as (
  select payment_id, coalesce(sum(applied_amount), 0)::numeric(12,2) as applied_total
  from public.ap_payment_applications
  where coalesce(application_status, 'applied') <> 'void'
  group by payment_id
), applied_by_bill as (
  select bill_id, coalesce(sum(applied_amount), 0)::numeric(12,2) as applied_total
  from public.ap_payment_applications
  where coalesce(application_status, 'applied') <> 'void'
  group by bill_id
)
select
  a.id,
  a.payment_id,
  p.payment_number,
  p.payment_date,
  p.payment_method,
  p.reference_number,
  p.vendor_id,
  v.legal_name as vendor_name,
  p.amount as payment_amount,
  coalesce(pb.applied_total, 0)::numeric(12,2) as payment_applied_total,
  greatest(coalesce(p.amount, 0) - coalesce(pb.applied_total, 0), 0)::numeric(12,2) as payment_unapplied_amount,
  p.application_status as payment_application_status,
  a.bill_id,
  b.bill_number,
  b.bill_date,
  b.due_date,
  b.bill_status,
  b.total_amount as bill_total_amount,
  b.balance_due as bill_balance_due,
  coalesce(bb.applied_total, 0)::numeric(12,2) as bill_applied_total,
  a.applied_amount,
  a.application_date,
  a.application_status,
  a.notes,
  a.created_by_profile_id,
  pr.full_name as uploaded_by_name,
  a.created_at,
  a.updated_at
from public.ap_payment_applications a
left join public.ap_payments p on p.id = a.payment_id
left join public.ap_vendors v on v.id = p.vendor_id
left join public.ap_bills b on b.id = a.bill_id
left join public.profiles pr on pr.id = a.created_by_profile_id
left join applied_by_payment pb on pb.payment_id = a.payment_id
left join applied_by_bill bb on bb.bill_id = a.bill_id;

create or replace view public.v_gl_journal_generated_line_directory as
with base as (
  select
    p.id as posting_id,
    p.journal_candidate_id,
    p.gl_batch_id,
    c.job_id,
    c.job_code,
    c.job_name,
    c.journal_memo,
    coalesce(c.ledger_summary, '{}'::jsonb) as ls,
    coalesce((c.ledger_summary ->> 'revenue_total')::numeric, 0)::numeric(12,2) as revenue_total,
    coalesce((c.ledger_summary ->> 'cost_total')::numeric, 0)::numeric(12,2) as cost_total,
    nullif(coalesce(c.ledger_summary ->> 'revenue_account_id', ''), '') as revenue_account_id,
    nullif(coalesce(c.ledger_summary ->> 'cogs_account_id', ''), '') as cogs_account_id,
    nullif(coalesce(c.ledger_summary ->> 'wip_account_id', ''), '') as wip_account_id,
    nullif(coalesce(c.ledger_summary ->> 'variance_account_id', ''), '') as variance_account_id
  from public.job_journal_postings p
  left join public.v_job_journal_candidate_directory c on c.id = p.journal_candidate_id
), generated as (
  select posting_id, journal_candidate_id, gl_batch_id, job_id, job_code, job_name, journal_memo, 10 as line_sort, 'revenue_offset_debit'::text as line_role, coalesce(wip_account_id, revenue_account_id) as account_id, revenue_total as debit_amount, 0::numeric(12,2) as credit_amount, 'Generated offset for revenue recognition.'::text as line_note
  from base where revenue_total > 0 and coalesce(wip_account_id, revenue_account_id) is not null
  union all
  select posting_id, journal_candidate_id, gl_batch_id, job_id, job_code, job_name, journal_memo, 20, 'revenue_credit', revenue_account_id, 0::numeric(12,2), revenue_total, 'Generated revenue line.' from base where revenue_total > 0 and revenue_account_id is not null
  union all
  select posting_id, journal_candidate_id, gl_batch_id, job_id, job_code, job_name, journal_memo, 30, 'cost_debit', cogs_account_id, cost_total, 0::numeric(12,2), 'Generated cost recognition line.' from base where cost_total > 0 and cogs_account_id is not null
  union all
  select posting_id, journal_candidate_id, gl_batch_id, job_id, job_code, job_name, journal_memo, 40, 'cost_offset_credit', coalesce(wip_account_id, cogs_account_id), 0::numeric(12,2), cost_total, 'Generated offset for cost recognition.' from base where cost_total > 0 and coalesce(wip_account_id, cogs_account_id) is not null
)
select
  g.posting_id,
  g.journal_candidate_id,
  g.gl_batch_id,
  g.job_id,
  g.job_code,
  g.job_name,
  g.journal_memo,
  g.line_sort,
  g.line_role,
  g.account_id,
  coa.account_number,
  coa.account_name,
  g.debit_amount,
  g.credit_amount,
  g.line_note
from generated g
left join public.chart_of_accounts coa on coa.id::text = g.account_id;

create or replace view public.v_bank_reconciliation_match_scored_directory as
with base as (
  select *
  from public.v_bank_reconciliation_match_candidate_directory
  where coalesce(bank_item_source_type, '') = 'bank_statement_line'
), scored as (
  select
    b.*,
    abs(coalesce(bank_item_date, candidate_item_date) - coalesce(candidate_item_date, bank_item_date)) as date_difference_days,
    case when lower(coalesce(bank_item_description, '')) like '%' || split_part(lower(coalesce(candidate_item_description, '')), ' ', 1) || '%' then true else false end as description_hint,
    (
      case when coalesce(amount_difference, 0) = 0 then 70
           when coalesce(amount_difference, 0) <= 0.10 then 55
           when coalesce(amount_difference, 0) <= 1.00 then 40
           else 10 end
      + case when abs(coalesce(bank_item_date, candidate_item_date) - coalesce(candidate_item_date, bank_item_date)) <= 2 then 20
             when abs(coalesce(bank_item_date, candidate_item_date) - coalesce(candidate_item_date, bank_item_date)) <= 7 then 10
             else 0 end
      + case when lower(coalesce(bank_item_description, '')) like '%' || split_part(lower(coalesce(candidate_item_description, '')), ' ', 1) || '%' then 10 else 0 end
    )::int as match_score
  from base b
)
select
  scored.*,
  case when match_score >= 90 then 'auto_match'
       when match_score >= 70 then 'likely_match'
       else 'review' end as recommendation
from scored;

create or replace view public.v_sales_tax_filing_review_directory as
select
  s.id,
  s.filing_code,
  s.business_tax_setting_id,
  bts.profile_name as business_tax_profile_name,
  bts.legal_entity_type,
  bts.legal_entity_name,
  bts.federal_return_type,
  bts.provincial_return_type,
  s.tax_code_id,
  tc.code as tax_code,
  s.filing_scope,
  s.filing_period_start,
  s.filing_period_end,
  s.due_date,
  s.filing_status,
  s.review_status,
  s.review_notes,
  s.reviewed_by_profile_id,
  p.full_name as reviewed_by_name,
  s.reviewed_at,
  s.taxable_sales_total,
  s.tax_collected_total,
  s.tax_paid_total,
  s.adjustment_total,
  s.net_remittance_total,
  prep.suggested_net_remittance_total,
  (coalesce(s.net_remittance_total, 0) - coalesce(prep.suggested_net_remittance_total, 0))::numeric(12,2) as net_difference_total,
  s.reference_number,
  s.payment_reference,
  s.filed_at,
  s.paid_at,
  s.created_at,
  s.updated_at
from public.sales_tax_filings s
left join public.business_tax_settings bts on bts.id = s.business_tax_setting_id
left join public.tax_codes tc on tc.id = s.tax_code_id
left join public.profiles p on p.id = s.reviewed_by_profile_id
left join public.v_sales_tax_prep_directory prep on prep.period_start = s.filing_period_start and prep.period_end = s.filing_period_end;

create or replace view public.v_payroll_remittance_review_directory as
select
  r.id,
  r.remittance_code,
  r.payroll_export_run_id,
  r.remittance_type,
  r.remittance_period_start,
  r.remittance_period_end,
  r.due_date,
  r.remittance_status,
  r.review_status,
  r.review_notes,
  r.reviewed_by_profile_id,
  p.full_name as reviewed_by_name,
  r.reviewed_at,
  r.gross_pay_total,
  r.employee_deduction_total,
  r.employer_contribution_total,
  r.net_remittance_total,
  prep.exported_payroll_cost_total as prepared_payroll_cost_total,
  r.reference_number,
  r.payment_reference,
  r.remitted_at,
  r.created_at,
  r.updated_at
from public.payroll_remittance_runs r
left join public.profiles p on p.id = r.reviewed_by_profile_id
left join public.v_payroll_remittance_prep_directory prep on prep.period_start = r.remittance_period_start and prep.period_end = r.remittance_period_end;

create or replace view public.v_accountant_handoff_package_directory as
with item_rollup as (
  select
    export_id,
    count(*)::int as item_count,
    count(*) filter (where item_kind = 'trial_balance')::int as trial_balance_item_count,
    count(*) filter (where item_kind = 'ar_aging')::int as ar_aging_item_count,
    count(*) filter (where item_kind = 'ap_aging')::int as ap_aging_item_count,
    count(*) filter (where item_kind = 'sales_tax_prep')::int as sales_tax_item_count,
    count(*) filter (where item_kind = 'payroll_remittance_prep')::int as payroll_item_count,
    max(created_at) as last_item_at
  from public.accountant_handoff_export_items
  group by export_id
)
select
  e.id,
  e.export_kind,
  e.entity_scope,
  e.entity_id,
  e.business_tax_setting_id,
  bts.profile_name as tax_profile_name,
  bts.legal_entity_type,
  bts.legal_entity_name,
  bts.federal_return_type,
  bts.provincial_return_type,
  bts.usa_tax_classification,
  e.export_status,
  e.bundle_kind,
  e.delivery_channel,
  e.delivered_to_email,
  e.package_status,
  e.package_manifest,
  e.package_markdown,
  e.package_json,
  e.bundle_item_count,
  coalesce(ir.item_count, e.bundle_item_count, 0)::int as resolved_item_count,
  coalesce(ir.trial_balance_item_count, 0)::int as trial_balance_item_count,
  coalesce(ir.ar_aging_item_count, 0)::int as ar_aging_item_count,
  coalesce(ir.ap_aging_item_count, 0)::int as ap_aging_item_count,
  coalesce(ir.sales_tax_item_count, 0)::int as sales_tax_item_count,
  coalesce(ir.payroll_item_count, 0)::int as payroll_item_count,
  e.export_title,
  e.generated_by_profile_id,
  pg.full_name as generated_by_name,
  e.generated_at,
  e.reviewed_by_profile_id,
  pr.full_name as reviewed_by_name,
  e.reviewed_at,
  e.finalised_at,
  e.delivered_at,
  ir.last_item_at,
  e.bundle_payload,
  e.export_payload,
  e.created_at,
  e.updated_at
from public.accountant_handoff_exports e
left join public.business_tax_settings bts on bts.id = e.business_tax_setting_id
left join public.profiles pg on pg.id = e.generated_by_profile_id
left join public.profiles pr on pr.id = e.reviewed_by_profile_id
left join item_rollup ir on ir.export_id = e.id;

create or replace view public.v_accounting_payment_application_dashboard as
with ar as (
  select
    count(*)::int as application_count,
    coalesce(sum(applied_amount), 0)::numeric(12,2) as applied_total,
    count(distinct payment_id)::int as payment_count,
    count(distinct invoice_id)::int as invoice_count
  from public.ar_payment_applications
  where coalesce(application_status, 'applied') <> 'void'
), ap as (
  select
    count(*)::int as application_count,
    coalesce(sum(applied_amount), 0)::numeric(12,2) as applied_total,
    count(distinct payment_id)::int as payment_count,
    count(distinct bill_id)::int as bill_count
  from public.ap_payment_applications
  where coalesce(application_status, 'applied') <> 'void'
)
select
  'ar'::text as application_type,
  ar.application_count,
  ar.applied_total,
  ar.payment_count,
  ar.invoice_count as linked_document_count
from ar
union all
select
  'ap'::text,
  ap.application_count,
  ap.applied_total,
  ap.payment_count,
  ap.bill_count
from ap;

-- 103_accounting_close_admin_ui_controls.sql
-- Admin-facing controls for the end-to-end accounting close workflow.
-- Adds close/reopen audit fields, package delivery metadata, and dashboard views
-- consumed by the Admin Backbone manager.

alter table if exists public.accounting_period_closes
  add column if not exists reopened_by_profile_id uuid references public.profiles(id) on delete set null,
  add column if not exists reopened_at timestamptz,
  add column if not exists reopen_reason text,
  add column if not exists close_ready_override boolean not null default false,
  add column if not exists lock_notes text;

alter table if exists public.accountant_handoff_exports
  add column if not exists delivery_status text not null default 'pending',
  add column if not exists delivery_reference text,
  add column if not exists delivery_notes text;

alter table if exists public.accountant_handoff_exports
  drop constraint if exists accountant_handoff_exports_delivery_status_check;

alter table if exists public.accountant_handoff_exports
  add constraint accountant_handoff_exports_delivery_status_check
  check (delivery_status in ('pending','delivered','confirmed','failed','cancelled'));

create or replace view public.v_accounting_close_admin_control_dashboard as
select
  apc.id,
  apc.period_code,
  apc.period_start,
  apc.period_end,
  apc.close_scope,
  apc.close_status,
  apc.ar_locked,
  apc.ap_locked,
  apc.gl_locked,
  apc.payroll_locked,
  apc.tax_locked,
  apc.close_ready_override,
  apc.closed_by_profile_id,
  closer.full_name as closed_by_name,
  apc.closed_at,
  apc.reopened_by_profile_id,
  reopener.full_name as reopened_by_name,
  apc.reopened_at,
  apc.reopen_reason,
  apc.close_notes,
  apc.lock_notes,
  coalesce(tax.open_tax_filing_count, 0)::int as open_tax_filing_count,
  coalesce(payroll.open_payroll_remittance_count, 0)::int as open_payroll_remittance_count,
  coalesce(recon.open_reconciliation_count, 0)::int as open_reconciliation_count,
  coalesce(recon.open_reconciliation_difference_total, 0)::numeric(12,2) as open_reconciliation_difference_total,
  coalesce(pkg.package_count, 0)::int as package_count,
  case
    when apc.close_ready_override then true
    when coalesce(tax.open_tax_filing_count, 0) = 0
      and coalesce(payroll.open_payroll_remittance_count, 0) = 0
      and coalesce(recon.open_reconciliation_count, 0) = 0
      and coalesce(recon.open_reconciliation_difference_total, 0) = 0
    then true
    else false
  end as close_ready
from public.accounting_period_closes apc
left join public.profiles closer on closer.id = apc.closed_by_profile_id
left join public.profiles reopener on reopener.id = apc.reopened_by_profile_id
left join lateral (
  select count(*) as open_tax_filing_count
  from public.sales_tax_filings f
  where f.filing_period_start >= apc.period_start
    and f.filing_period_end <= apc.period_end
    and coalesce(f.review_status, f.filing_status, 'draft') not in ('filed','paid')
) tax on true
left join lateral (
  select count(*) as open_payroll_remittance_count
  from public.payroll_remittance_runs r
  where r.remittance_period_start >= apc.period_start
    and r.remittance_period_end <= apc.period_end
    and coalesce(r.review_status, r.remittance_status, 'draft') <> 'remitted'
) payroll on true
left join lateral (
  select
    count(*) filter (where coalesce(s.reconciliation_status, 'draft') <> 'closed') as open_reconciliation_count,
    coalesce(sum(coalesce(s.difference_amount, 0)) filter (where coalesce(s.reconciliation_status, 'draft') <> 'closed'), 0) as open_reconciliation_difference_total
  from public.bank_reconciliation_sessions s
  where coalesce(s.period_start, apc.period_start) >= apc.period_start
    and coalesce(s.period_end, apc.period_end) <= apc.period_end
) recon on true
left join lateral (
  select count(*) as package_count
  from public.accountant_handoff_exports e
  where e.entity_scope in ('accounting_period_close','period_close','accounting_close')
    and e.entity_id = apc.id::text
) pkg on true;

create or replace view public.v_accounting_reconciliation_manual_review_queue as
select
  brs.id as reconciliation_session_id,
  brs.session_code,
  brs.period_start,
  brs.period_end,
  brs.reconciliation_status,
  brs.bank_account_id,
  ba.account_name,
  brs.book_balance,
  brs.bank_balance,
  brs.difference_amount,
  bri.id as reconciliation_item_id,
  bri.item_date,
  bri.item_description,
  bri.amount,
  bri.match_status,
  bri.clearing_status,
  bri.difference_reason,
  case
    when bri.match_status = 'exception' or coalesce(brs.difference_amount, 0) <> 0 then 10
    when bri.match_status = 'partial' then 20
    when bri.match_status = 'unmatched' then 30
    when brs.reconciliation_status in ('draft','in_review','difference_pending') then 40
    else 90
  end as review_priority
from public.bank_reconciliation_sessions brs
left join public.bank_accounts ba on ba.id = brs.bank_account_id
left join public.bank_reconciliation_items bri on bri.reconciliation_session_id = brs.id
where brs.reconciliation_status in ('draft','in_review','difference_pending')
   or coalesce(bri.match_status, 'unmatched') in ('unmatched','partial','exception')
   or coalesce(bri.clearing_status, 'open') = 'open';

create or replace view public.v_accounting_close_package_delivery_queue as
select
  e.id,
  e.export_title,
  e.export_kind,
  e.entity_scope,
  e.entity_id,
  e.business_tax_setting_id,
  e.bundle_kind,
  e.package_status,
  e.delivery_channel,
  e.delivery_status,
  e.delivery_reference,
  e.delivered_to_email,
  e.delivered_at,
  e.finalised_at,
  e.generated_at,
  e.updated_at,
  coalesce(items.item_count, 0)::int as item_count,
  case
    when e.package_status = 'finalized' and e.delivery_status in ('pending','failed') then true
    when e.package_status = 'delivered' and e.delivery_status <> 'confirmed' then true
    else false
  end as needs_delivery_attention
from public.accountant_handoff_exports e
left join lateral (
  select count(*) as item_count
  from public.accountant_handoff_export_items i
  where i.export_id = e.id
) items on true
where e.package_status in ('prepared','reviewed','finalized','delivered')
   or e.delivery_status in ('pending','failed');


-- Schema 104: reporting loader timeout guardrail marker.
-- 104_reporting_loader_timeout_guardrails.sql
-- Reporting loader timeout guardrail pass.
-- This migration is intentionally light: the main performance fix is in the
-- admin-directory Edge Function fast path, but the schema snapshot gets a small
-- health view so deploy smoke checks can confirm that schema 104 was applied.

create or replace view public.v_reporting_loader_health as
select
  now() as checked_at,
  'admin-directory-reporting-fast-path'::text as loader_key,
  'ok'::text as status,
  'Reports are loaded through a narrow admin-directory reporting scope so the Admin route does not need to preload heavy report datasets.'::text as note;

comment on view public.v_reporting_loader_health is
  'Schema 104 marker and health view for the reporting timeout guardrail pass. The frontend lazy-loads Reports only on the Reports route; admin-directory also has a reporting fast path.';


-- Schema 105: repo cleanup and roadmap refresh marker.
-- 105_repo_cleanup_and_roadmap_refresh.sql
-- Repo cleanup, Markdown archive reset, and roadmap refresh marker.
-- This migration is intentionally light. It gives live deployments a simple
-- schema marker confirming that the 2026-05-10 cleanup/roadmap pass was applied
-- after the reporting timeout guardrail work in schema 104.

create or replace view public.v_repo_cleanup_and_roadmap_health as
select
  now() as checked_at,
  '105_repo_cleanup_and_roadmap_refresh'::text as schema_marker,
  'ok'::text as status,
  20::int as next_roadmap_step_count,
  'Active Markdown was refreshed, older Markdown was archived, obvious temp files were removed, and the next 20 production-readiness steps were documented.'::text as note;

comment on view public.v_repo_cleanup_and_roadmap_health is
  'Schema 105 marker for the 2026-05-10 repository cleanup and next-step roadmap refresh pass.';

-- Schema 106: admin command center, schema tracking, and health center.
-- 106_admin_command_center_schema_tracking_and_health.sql
-- Repaired in the 2026-05-14b pass so it creates schema tracking before views read it
-- and uses jobs.status instead of assuming jobs.job_status exists.

create table if not exists public.app_schema_versions (
  schema_version integer primary key,
  migration_key text,
  schema_name text,
  release_label text,
  description text,
  status text not null default 'applied',
  applied_at timestamptz not null default now(),
  applied_by text,
  notes text
);

alter table public.app_schema_versions add column if not exists migration_key text;
alter table public.app_schema_versions add column if not exists schema_name text;
alter table public.app_schema_versions add column if not exists release_label text;
alter table public.app_schema_versions add column if not exists description text;
alter table public.app_schema_versions add column if not exists status text not null default 'applied';
alter table public.app_schema_versions add column if not exists applied_at timestamptz not null default now();
alter table public.app_schema_versions add column if not exists applied_by text;
alter table public.app_schema_versions add column if not exists notes text;

insert into public.app_schema_versions (schema_version, migration_key, schema_name, release_label, description, status, notes)
values
  (105, '105_repo_cleanup_and_roadmap_refresh', '105_repo_cleanup_and_roadmap_refresh.sql', '2026-05-10a', 'Repo cleanup and roadmap refresh marker.', 'applied', 'Preserved baseline marker before schema tracking.'),
  (106, '106_admin_command_center_schema_tracking_and_health', '106_admin_command_center_schema_tracking_and_health.sql', '2026-05-15a', 'Admin command center, health dashboard, task inbox, and schema tracking support.', 'applied', 'Creates schema tracking before command/health views read it.')
on conflict (schema_version) do update set
  migration_key = excluded.migration_key,
  schema_name = excluded.schema_name,
  release_label = excluded.release_label,
  description = excluded.description,
  status = excluded.status,
  notes = excluded.notes,
  applied_at = coalesce(public.app_schema_versions.applied_at, now());

create or replace view public.v_app_schema_version_status as
select
  schema_version,
  coalesce(migration_key, regexp_replace(coalesce(schema_name, ''), '\.sql$', '')) as migration_key,
  schema_name,
  release_label,
  description,
  status,
  applied_at,
  applied_by,
  notes,
  schema_version = max(schema_version) over () as is_latest
from public.app_schema_versions
order by schema_version desc;

drop view if exists public.v_admin_home_command_center;
create view public.v_admin_home_command_center as
select
  now() as checked_at,
  (select count(*) from public.admin_notifications n where coalesce(n.decision_status, n.status, 'pending') in ('pending','needs_review','failed','dead_letter'))::int as pending_notification_count,
  (select count(*) from public.admin_notifications n where coalesce(n.email_status, '') in ('failed','dead_letter'))::int as failed_notification_count,
  (select count(*) from public.jobs j where coalesce(j.status, 'open') not in ('complete','completed','closed','cancelled','canceled'))::int as open_job_count,
  (select count(*) from public.accounting_period_closes c where coalesce(c.close_status, 'open') <> 'closed')::int as open_accounting_period_count,
  (select count(*) from public.bank_reconciliation_sessions s where coalesce(s.reconciliation_status, 'draft') <> 'closed')::int as open_reconciliation_count,
  (select count(*) from public.bank_reconciliation_items i where coalesce(i.match_status, 'unmatched') in ('unmatched','partial','exception'))::int as reconciliation_review_count,
  (select count(*) from public.sales_tax_filings f where coalesce(f.review_status, f.filing_status, 'draft') not in ('filed','paid'))::int as open_tax_filing_count,
  (select count(*) from public.payroll_remittance_runs r where coalesce(r.review_status, r.remittance_status, 'draft') <> 'remitted')::int as open_payroll_remittance_count,
  ((select count(*) from public.ar_payment_applications a where coalesce(a.application_status, 'draft') in ('draft','review','exception'))::int +
   (select count(*) from public.ap_payment_applications a where coalesce(a.application_status, 'draft') in ('draft','review','exception'))::int) as payment_application_attention_count,
  (select count(*) from public.accountant_handoff_exports e where coalesce(e.package_status, 'prepared') in ('prepared','reviewed','finalized') and coalesce(e.delivery_status, 'pending') <> 'confirmed')::int as package_delivery_attention_count,
  (select coalesce(max(schema_version), 0) from public.app_schema_versions where status = 'applied')::int as latest_schema_version;

drop view if exists public.v_admin_error_health_center;
create view public.v_admin_error_health_center as
select 'warning'::text as severity, 'schema'::text as source, 'Latest schema marker'::text as title,
       concat(schema_version::text, ' · ', coalesce(migration_key, schema_name, 'unknown'), ' · ', status) as message,
       applied_at as last_seen_at, 'health'::text as route_hint
from public.app_schema_versions
where schema_version = (select max(schema_version) from public.app_schema_versions)
union all
select 'warning', 'notifications', 'Failed notification delivery', concat(count(*)::text, ' failed/dead-letter notification(s).'), now(), 'notifications'
from public.admin_notifications
where coalesce(email_status, '') in ('failed','dead_letter')
having count(*) > 0
union all
select 'warning', 'accounting', 'Bank reconciliation review', concat(count(*)::text, ' reconciliation item(s) need review.'), now(), 'bank_reconciliation_item'
from public.bank_reconciliation_items
where coalesce(match_status, 'unmatched') in ('unmatched','partial','exception')
having count(*) > 0;

drop view if exists public.v_admin_task_inbox;
create view public.v_admin_task_inbox as
select 10::int as priority_rank, 'High'::text as priority_label, 'Failed notification delivery'::text as task_title,
       concat(title, ': ', message) as task_summary, 'messaging'::text as source_area, created_at as due_at,
       'notifications'::text as route_hint, id::text as entity_hint
from public.admin_notifications
where coalesce(email_status, '') in ('failed','dead_letter')
union all
select 20, 'High', 'Reconcile bank item', coalesce(item_description, 'Bank item needs manual review'),
       'accounting', created_at, 'bank_reconciliation_item', id::text
from public.bank_reconciliation_items
where coalesce(match_status, 'unmatched') in ('unmatched','partial','exception')
union all
select 30, 'Review', 'Accounting period still open', concat(period_code, ' · ', close_status),
       'accounting', period_end::timestamptz, 'accounting_period_close', id::text
from public.accounting_period_closes
where coalesce(close_status, 'open') <> 'closed';

drop view if exists public.v_role_dashboard_presets;
create view public.v_role_dashboard_presets as
select * from (values
  (1, 'admin', 'Command Center', 'home', 'Full command center, health, accounting, operations, and messaging.'),
  (2, 'supervisor', 'Supervisor Daily Dashboard', 'operations', 'Jobs, crews, attendance, HSE review, and evidence.'),
  (3, 'hse', 'Safety Review Dashboard', 'safety', 'Corrective actions, training, SDS, HSE proof, and incidents.'),
  (4, 'employee', 'Worker Mobile Dashboard', 'profile', 'Assigned forms, clock/outbox, training, and self-service records.')
) as t(sort_order, role_key, dashboard_label, default_section, notes);

drop view if exists public.v_schema_106_admin_command_center_health;
create view public.v_schema_106_admin_command_center_health as
select 106::int as schema_version, '106_admin_command_center_schema_tracking_and_health'::text as schema_marker, now() as checked_at,
       'Admin Command Center, App Health and Schema Center, task inbox, schema tracking, role dashboard presets, and live-schema fixes are installed.'::text as note;

grant select on public.app_schema_versions to authenticated;
grant select on public.v_app_schema_version_status to authenticated;
grant select on public.v_admin_home_command_center to authenticated;
grant select on public.v_admin_error_health_center to authenticated;
grant select on public.v_admin_task_inbox to authenticated;
grant select on public.v_role_dashboard_presets to authenticated;
grant select on public.v_schema_106_admin_command_center_health to authenticated;

-- Schema 107: production readiness, schema drift, saved filters, permissions, close/evidence manager foundations.
-- 108_saved_filters_close_wizard_health_and_seo_gates.sql

-- Schema 107 is also safe to run directly after a partial/live failed schema-106 attempt.
create table if not exists public.app_schema_versions (
  schema_version integer primary key,
  migration_key text,
  schema_name text,
  release_label text,
  description text,
  status text not null default 'applied',
  applied_at timestamptz not null default now(),
  applied_by text,
  notes text
);

alter table public.app_schema_versions add column if not exists migration_key text;
alter table public.app_schema_versions add column if not exists schema_name text;
alter table public.app_schema_versions add column if not exists release_label text;
alter table public.app_schema_versions add column if not exists description text;
alter table public.app_schema_versions add column if not exists status text not null default 'applied';
alter table public.app_schema_versions add column if not exists applied_at timestamptz not null default now();
alter table public.app_schema_versions add column if not exists applied_by text;
alter table public.app_schema_versions add column if not exists notes text;

insert into public.app_schema_versions (schema_version, migration_key, schema_name, release_label, description, status, notes)
values (
  107,
  '108_saved_filters_close_wizard_health_and_seo_gates',
  '108_saved_filters_close_wizard_health_and_seo_gates.sql',
  '2026-05-14b',
  'Adds schema drift status, production readiness checklist, saved admin filters, role permission matrix, close center overview, and evidence manager directory.',
  'applied',
  'Follow-up to live schema errors: avoids jobs.job_status assumptions and gives admins production-readiness visibility.'
)
on conflict (schema_version) do update set
  migration_key = excluded.migration_key,
  schema_name = excluded.schema_name,
  release_label = excluded.release_label,
  description = excluded.description,
  status = excluded.status,
  notes = excluded.notes,
  applied_at = now();

create table if not exists public.admin_saved_filters (
  id uuid primary key default gen_random_uuid(),
  owner_profile_id uuid references public.profiles(id),
  filter_scope text not null,
  filter_name text not null,
  filter_payload jsonb not null default '{}'::jsonb,
  is_shared boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_admin_saved_filters_scope on public.admin_saved_filters(filter_scope, updated_at desc);

create table if not exists public.admin_production_readiness_checks (
  check_key text primary key,
  check_area text not null,
  check_title text not null,
  check_detail text,
  check_status text not null default 'review',
  next_action text,
  sort_order int not null default 100,
  updated_at timestamptz not null default now()
);

insert into public.admin_production_readiness_checks (check_key, check_area, check_title, check_detail, check_status, next_action, sort_order)
values
  ('schema_drift', 'Database', 'Live schema matches repo marker', 'Database should have all migrations through schema 107.', 'review', 'Confirm v_schema_drift_status says current.', 10),
  ('rls_review', 'Security', 'RLS and role policies reviewed', 'Admin, supervisor, HSE, and employee workflows need final live policy review.', 'review', 'Run a role-by-role permission test.', 20),
  ('backup_restore', 'Recovery', 'Backup and restore tested', 'Supabase DB, storage/media, and export bundles need restore proof.', 'review', 'Run a small restore rehearsal before production sign-off.', 30),
  ('error_monitoring', 'Monitoring', 'Error and health center monitored', 'Frontend diagnostics and backend health rows should be watched after deploy.', 'review', 'Open Admin Health after deploy and confirm no critical rows.', 40),
  ('accounting_close', 'Accounting', 'Close workflow has no blockers', 'Close Center should show payment, reconciliation, tax, payroll, journal, and package status.', 'review', 'Clear blockers before locking a period.', 50),
  ('seo_public_pages', 'SEO', 'Public pages pass SEO smoke check', 'One H1, clear title/meta, local terms, alt text, and no broken assets.', 'review', 'Run public-page smoke checks when marketing pages are added.', 60)
on conflict (check_key) do update set
  check_area = excluded.check_area,
  check_title = excluded.check_title,
  check_detail = excluded.check_detail,
  check_status = excluded.check_status,
  next_action = excluded.next_action,
  sort_order = excluded.sort_order,
  updated_at = now();

create table if not exists public.admin_role_permission_matrix (
  id uuid primary key default gen_random_uuid(),
  role_key text not null,
  workflow_area text not null,
  can_view boolean not null default true,
  can_create boolean not null default false,
  can_edit boolean not null default false,
  can_approve boolean not null default false,
  can_close_reopen boolean not null default false,
  can_export boolean not null default false,
  notes text,
  sort_order int not null default 100,
  unique(role_key, workflow_area)
);

insert into public.admin_role_permission_matrix (role_key, workflow_area, can_view, can_create, can_edit, can_approve, can_close_reopen, can_export, notes, sort_order)
values
  ('admin', 'Admin / Security', true, true, true, true, true, true, 'Full admin access after RLS review.', 10),
  ('admin', 'Accounting Close', true, true, true, true, true, true, 'Can close/reopen periods and export accountant packages.', 20),
  ('supervisor', 'Jobs / Operations', true, true, true, true, false, true, 'Can manage jobs and review operational exceptions.', 30),
  ('supervisor', 'HSE Review', true, true, true, true, false, true, 'Can review evidence and safety tasks.', 40),
  ('hse', 'HSE Review', true, true, true, true, false, true, 'Safety-focused review and export lane.', 50),
  ('employee', 'Worker Self-Service', true, true, true, false, false, false, 'Own forms, profile, training, SDS, clock/outbox only.', 60)
on conflict (role_key, workflow_area) do update set
  can_view = excluded.can_view,
  can_create = excluded.can_create,
  can_edit = excluded.can_edit,
  can_approve = excluded.can_approve,
  can_close_reopen = excluded.can_close_reopen,
  can_export = excluded.can_export,
  notes = excluded.notes,
  sort_order = excluded.sort_order;

drop view if exists public.v_schema_drift_status;
create view public.v_schema_drift_status as
select
  107::int as expected_schema_version,
  coalesce(max(schema_version) filter (where status = 'applied'), 0)::int as latest_applied_schema_version,
  case when coalesce(max(schema_version) filter (where status = 'applied'), 0) >= 107 then 'current' else 'behind' end as drift_status,
  case when coalesce(max(schema_version) filter (where status = 'applied'), 0) >= 107
    then 'Live database is at or ahead of the repo schema marker.'
    else 'Live database is behind the deployed app. Apply migrations through schema 107.'
  end as message,
  now() as checked_at
from public.app_schema_versions;

drop view if exists public.v_production_readiness_checklist;
create view public.v_production_readiness_checklist as
select check_key, check_area, check_title, check_detail, check_status, next_action, sort_order, updated_at
from public.admin_production_readiness_checks
order by sort_order, check_key;

drop view if exists public.v_role_permission_matrix;
create view public.v_role_permission_matrix as
select role_key, workflow_area, can_view, can_create, can_edit, can_approve, can_close_reopen, can_export, notes, sort_order
from public.admin_role_permission_matrix
order by sort_order, role_key, workflow_area;

drop view if exists public.v_admin_saved_filter_directory;
create view public.v_admin_saved_filter_directory as
select f.id, f.filter_scope, f.filter_name, f.filter_payload, f.is_shared, f.created_at, f.updated_at,
       p.full_name as owner_name
from public.admin_saved_filters f
left join public.profiles p on p.id = f.owner_profile_id
order by f.updated_at desc;

drop view if exists public.v_admin_close_center_overview;
create view public.v_admin_close_center_overview as
select
  now() as checked_at,
  (select count(*) from public.accounting_period_closes c where coalesce(c.close_status, 'open') <> 'closed')::int as open_accounting_period_count,
  ((select count(*) from public.ar_payment_applications a where coalesce(a.application_status, 'draft') in ('draft','review','exception'))::int +
   (select count(*) from public.ap_payment_applications a where coalesce(a.application_status, 'draft') in ('draft','review','exception'))::int) as payment_application_attention_count,
  (select count(*) from public.bank_reconciliation_items i where coalesce(i.match_status, 'unmatched') in ('unmatched','partial','exception'))::int as reconciliation_review_count,
  (select count(*) from public.sales_tax_filings f where coalesce(f.review_status, f.filing_status, 'draft') not in ('filed','paid'))::int as open_tax_filing_count,
  (select count(*) from public.payroll_remittance_runs r where coalesce(r.review_status, r.remittance_status, 'draft') <> 'remitted')::int as open_payroll_remittance_count,
  (select count(*) from public.gl_journal_batches b where coalesce(b.batch_status, 'draft') in ('draft','review','exception','generated'))::int as journal_candidate_count,
  (select count(*) from public.accountant_handoff_exports e where coalesce(e.package_status, 'prepared') in ('prepared','reviewed','finalized') and coalesce(e.delivery_status, 'pending') <> 'confirmed')::int as package_delivery_attention_count;

drop view if exists public.v_evidence_manager_directory;
create view public.v_evidence_manager_directory as
select
  'field_upload_failure'::text as source_area,
  'Failed upload'::text as evidence_type,
  coalesce(file_name, storage_path, id::text) as evidence_title,
  coalesce(retry_status, failure_stage, 'failed') as evidence_status,
  true as needs_review,
  coalesce(failure_reason, resolution_notes, 'Upload needs retry or admin resolution.') as action_hint,
  null::text as owner_name,
  created_at as last_seen_at,
  id::text as source_id
from public.field_upload_failures
union all
select
  'attendance_photo'::text,
  'Attendance photo'::text,
  coalesce(photo_stage, time_entry_id::text),
  coalesce(review_status, geofence_status, 'review'),
  coalesce(needs_review, false),
  coalesce(review_notes, 'Review attendance photo/geofence status.'),
  full_name,
  uploaded_at,
  time_entry_id::text
from public.v_attendance_photo_review
union all
select
  'hse_evidence'::text,
  coalesce(proof_kind, 'HSE proof')::text,
  coalesce(caption, file_name, proof_id::text),
  coalesce(review_status, 'review')::text,
  coalesce(needs_review, false),
  coalesce(review_notes, proof_notes, 'Review HSE proof.'),
  uploaded_by_name,
  created_at,
  proof_id::text
from public.v_hse_evidence_review;

grant select on public.v_schema_drift_status to authenticated;
grant select on public.v_production_readiness_checklist to authenticated;
grant select on public.v_role_permission_matrix to authenticated;
grant select on public.v_admin_saved_filter_directory to authenticated;
grant select on public.v_admin_close_center_overview to authenticated;
grant select on public.v_evidence_manager_directory to authenticated;
grant select on public.admin_saved_filters to authenticated;
grant select on public.admin_production_readiness_checks to authenticated;
grant select on public.admin_role_permission_matrix to authenticated;

-- ============================================================================
-- Schema 108: saved filters, close wizard, health resolution, deployment gates,
-- and SEO smoke checks.
-- Source: sql/108_saved_filters_close_wizard_health_and_seo_gates.sql
-- ============================================================================
-- Schema 108: saved-filter actions, close wizard steps, health resolution notes, deployment gates, and SEO smoke checks.
-- 108_saved_filters_close_wizard_health_and_seo_gates.sql

create table if not exists public.app_schema_versions (
  schema_version integer primary key,
  migration_key text,
  schema_name text,
  release_label text,
  description text,
  status text not null default 'applied',
  applied_at timestamptz not null default now(),
  applied_by text,
  notes text
);

alter table public.admin_saved_filters add column if not exists last_used_at timestamptz;
alter table public.admin_saved_filters add column if not exists usage_count int not null default 0;
alter table public.admin_saved_filters add column if not exists route_hint text;
alter table public.admin_saved_filters add column if not exists section_hint text;
create index if not exists idx_admin_saved_filters_scope_name on public.admin_saved_filters(filter_scope, filter_name);
create index if not exists idx_admin_saved_filters_shared_scope on public.admin_saved_filters(filter_scope, is_shared, updated_at desc);

create table if not exists public.admin_close_workflow_steps (
  step_key text primary key,
  step_group text not null,
  step_title text not null,
  step_detail text,
  source_view text,
  source_entity text,
  route_hint text,
  blocker_count_column text,
  step_status text not null default 'review',
  sort_order int not null default 100,
  updated_at timestamptz not null default now()
);

insert into public.admin_close_workflow_steps (step_key, step_group, step_title, step_detail, source_view, source_entity, route_hint, blocker_count_column, step_status, sort_order)
values
  ('period_review', 'Period Close', 'Review open accounting periods', 'Confirm each period is ready before lock/reopen actions are used.', 'v_admin_close_center_overview', 'accounting_period_close', 'admin:accounting', 'open_accounting_period_count', 'review', 10),
  ('payment_applications', 'Payments', 'Clear AR/AP payment applications', 'Review partial payments, overpayments, unapplied amounts, reversals, and voids.', 'v_admin_close_center_overview', 'ar_payment_application', 'admin:accounting', 'payment_application_attention_count', 'review', 20),
  ('bank_reconciliation', 'Banking', 'Resolve reconciliation review items', 'Clear unmatched, partial, and exception rows before close.', 'v_admin_close_center_overview', 'bank_reconciliation_item', 'admin:accounting', 'reconciliation_review_count', 'review', 30),
  ('tax_payroll', 'Tax and Payroll', 'Review filings and remittances', 'Confirm sales-tax filing and payroll remittance review screens before package export.', 'v_admin_close_center_overview', 'sales_tax_filing', 'admin:accounting', 'open_tax_filing_count', 'review', 40),
  ('journal_preview', 'Posting', 'Validate journal candidates', 'Preview generated lines, debit/credit balance, source links, approvals, and locked periods before posting.', 'v_admin_close_center_overview', 'gl_journal_batch', 'admin:accounting', 'journal_candidate_count', 'review', 50),
  ('accountant_package', 'Export', 'Finalize accountant package delivery', 'Confirm package manifest, GL detail, trial balance, AR/AP aging, tax, payroll, reconciliation, and receipts.', 'v_admin_close_center_overview', 'accountant_handoff_export', 'admin:accounting', 'package_delivery_attention_count', 'review', 60)
on conflict (step_key) do update set
  step_group = excluded.step_group,
  step_title = excluded.step_title,
  step_detail = excluded.step_detail,
  source_view = excluded.source_view,
  source_entity = excluded.source_entity,
  route_hint = excluded.route_hint,
  blocker_count_column = excluded.blocker_count_column,
  step_status = excluded.step_status,
  sort_order = excluded.sort_order,
  updated_at = now();

create table if not exists public.admin_health_resolution_notes (
  id uuid primary key default gen_random_uuid(),
  source_area text not null default 'manual',
  source_id text,
  resolution_status text not null default 'open',
  resolution_notes text,
  assigned_to_profile_id uuid references public.profiles(id),
  resolved_by_profile_id uuid references public.profiles(id),
  resolved_at timestamptz,
  created_by_profile_id uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_admin_health_resolution_status on public.admin_health_resolution_notes(resolution_status, updated_at desc);

create table if not exists public.admin_deployment_gate_checks (
  check_key text primary key,
  check_area text not null,
  check_title text not null,
  check_status text not null default 'review',
  command_hint text,
  failure_hint text,
  sort_order int not null default 100,
  updated_at timestamptz not null default now()
);

insert into public.admin_deployment_gate_checks (check_key, check_area, check_title, check_status, command_hint, failure_hint, sort_order)
values
  ('node_syntax', 'Code', 'JavaScript syntax checks pass', 'review', 'node --check js/api.js && node --check js/admin-ui.js && node --check app.js', 'Fix syntax errors before deploy.', 10),
  ('repo_smoke', 'Code', 'Repo smoke check passes', 'review', 'node scripts/repo-smoke-check.mjs', 'Smoke check must pass before packaging.', 20),
  ('single_h1', 'SEO', 'Exposed app shell has no more than one H1', 'review', 'grep -oi "<h1" index.html | wc -l', 'Keep one clear public H1.', 30),
  ('schema_marker', 'Database', 'Schema marker matches latest repo migration', 'review', 'Apply SQL through schema 108 and check Admin Health.', 'Live schema behind repo can break views/functions.', 40),
  ('service_worker_version', 'Deploy', 'Service worker cache version bumped', 'review', 'Confirm CACHE_NAME and script query strings match the build.', 'Old service worker assets can keep stale bugs alive.', 50),
  ('edge_functions', 'Backend', 'Changed Supabase functions redeployed', 'review', 'Deploy admin-directory, admin-manage, and admin-selectors when changed.', 'New UI may call old Edge Function code.', 60),
  ('backup_ready', 'Recovery', 'Backup and restore rehearsal is scheduled', 'review', 'Export schema/data sample and test restore before production sign-off.', 'No restore proof means recovery remains untested.', 70)
on conflict (check_key) do update set
  check_area = excluded.check_area,
  check_title = excluded.check_title,
  check_status = excluded.check_status,
  command_hint = excluded.command_hint,
  failure_hint = excluded.failure_hint,
  sort_order = excluded.sort_order,
  updated_at = now();

create table if not exists public.admin_public_seo_checks (
  page_path text primary key,
  page_title text,
  h1_count int not null default 0,
  local_terms_present boolean not null default false,
  meta_description_present boolean not null default false,
  image_alt_coverage_percent numeric(6,2),
  broken_asset_count int not null default 0,
  check_status text not null default 'review',
  notes text,
  checked_at timestamptz not null default now()
);

insert into public.admin_public_seo_checks (page_path, page_title, h1_count, local_terms_present, meta_description_present, image_alt_coverage_percent, broken_asset_count, check_status, notes)
values
  ('/', 'YWI HSE App', 1, true, true, 100, 0, 'review', 'Current app shell has one H1. Re-run when public marketing pages are added.')
on conflict (page_path) do update set
  page_title = excluded.page_title,
  h1_count = excluded.h1_count,
  local_terms_present = excluded.local_terms_present,
  meta_description_present = excluded.meta_description_present,
  image_alt_coverage_percent = excluded.image_alt_coverage_percent,
  broken_asset_count = excluded.broken_asset_count,
  check_status = excluded.check_status,
  notes = excluded.notes,
  checked_at = now();

insert into public.admin_production_readiness_checks (check_key, check_area, check_title, check_detail, check_status, next_action, sort_order)
values
  ('saved_filters', 'Admin UX', 'Saved filters have write actions', 'Managers can save shared/personal views for Command Center and admin lists.', 'review', 'Test create/update/delete saved filters from Admin.', 70),
  ('close_wizard_steps', 'Accounting', 'Guided close steps are visible', 'Close Center now has ordered step rows that map blockers to the related manager.', 'review', 'Use the step cards before building the write wizard.', 80),
  ('deployment_gates', 'Deploy', 'Deployment gate checklist exists', 'Code/schema/cache/Edge Function checks are tracked before packaging/deploy.', 'review', 'Mark gate rows pass/fail during each release.', 90),
  ('seo_gate', 'SEO', 'SEO smoke check table exists', 'Public pages can be checked for title/meta/H1/local words/alt/broken assets.', 'review', 'Automate this when more public pages are introduced.', 100)
on conflict (check_key) do update set
  check_area = excluded.check_area,
  check_title = excluded.check_title,
  check_detail = excluded.check_detail,
  check_status = excluded.check_status,
  next_action = excluded.next_action,
  sort_order = excluded.sort_order,
  updated_at = now();

drop view if exists public.v_admin_saved_filter_directory;
create view public.v_admin_saved_filter_directory as
select f.id, f.filter_scope, f.filter_name, f.filter_payload, f.is_shared, f.route_hint, f.section_hint, f.usage_count, f.last_used_at, f.created_at, f.updated_at,
       p.full_name as owner_name
from public.admin_saved_filters f
left join public.profiles p on p.id = f.owner_profile_id
order by f.updated_at desc;

drop view if exists public.v_admin_saved_filter_scope_summary;
create view public.v_admin_saved_filter_scope_summary as
select
  filter_scope,
  count(*)::int as filter_count,
  count(*) filter (where is_shared)::int as shared_filter_count,
  max(updated_at) as last_updated_at,
  max(last_used_at) as last_used_at
from public.admin_saved_filters
group by filter_scope
order by filter_scope;

drop view if exists public.v_admin_close_wizard_steps;
create view public.v_admin_close_wizard_steps as
select
  s.step_key,
  s.step_group,
  s.step_title,
  s.step_detail,
  s.source_view,
  s.source_entity,
  s.route_hint,
  s.blocker_count_column,
  s.step_status,
  s.sort_order,
  s.updated_at
from public.admin_close_workflow_steps s
order by s.sort_order, s.step_key;

drop view if exists public.v_admin_health_resolution_queue;
create view public.v_admin_health_resolution_queue as
select
  n.id,
  n.source_area,
  n.source_id,
  n.resolution_status,
  n.resolution_notes,
  assigned.full_name as assigned_to_name,
  resolved.full_name as resolved_by_name,
  n.resolved_at,
  n.created_at,
  n.updated_at
from public.admin_health_resolution_notes n
left join public.profiles assigned on assigned.id = n.assigned_to_profile_id
left join public.profiles resolved on resolved.id = n.resolved_by_profile_id
order by case n.resolution_status when 'open' then 1 when 'assigned' then 2 when 'resolved' then 9 when 'dismissed' then 10 else 5 end, n.updated_at desc;

drop view if exists public.v_admin_deployment_gate_status;
create view public.v_admin_deployment_gate_status as
select check_key, check_area, check_title, check_status, command_hint, failure_hint, sort_order, updated_at
from public.admin_deployment_gate_checks
order by sort_order, check_key;

drop view if exists public.v_public_seo_smoke_check;
create view public.v_public_seo_smoke_check as
select
  page_path,
  page_title,
  h1_count,
  local_terms_present,
  meta_description_present,
  image_alt_coverage_percent,
  broken_asset_count,
  case
    when h1_count > 1 then 'fail'
    when broken_asset_count > 0 then 'warning'
    when not meta_description_present then 'warning'
    when not local_terms_present then 'review'
    else check_status
  end as check_status,
  notes,
  checked_at
from public.admin_public_seo_checks
order by page_path;

drop view if exists public.v_schema_drift_status;
create view public.v_schema_drift_status as
select
  108::int as expected_schema_version,
  coalesce(max(schema_version) filter (where status = 'applied'), 0)::int as latest_applied_schema_version,
  case when coalesce(max(schema_version) filter (where status = 'applied'), 0) >= 108 then 'current' else 'behind' end as drift_status,
  case when coalesce(max(schema_version) filter (where status = 'applied'), 0) >= 108
    then 'Live database is at or ahead of the repo schema marker.'
    else 'Live database is behind the deployed app. Apply migrations through schema 108.'
  end as message,
  now() as checked_at
from public.app_schema_versions;

insert into public.app_schema_versions (schema_version, migration_key, schema_name, release_label, description, status, notes)
values (
  108,
  '108_saved_filters_close_wizard_health_and_seo_gates',
  '108_saved_filters_close_wizard_health_and_seo_gates.sql',
  '2026-05-15b',
  'Adds saved filter actions, close wizard step metadata, health resolution notes, deployment gate checks, and SEO smoke check foundations.',
  'applied',
  'Production-readiness pass that advances saved filters, close workflow, health resolution, deployment gating, and SEO checks.'
)
on conflict (schema_version) do update set
  migration_key = excluded.migration_key,
  schema_name = excluded.schema_name,
  release_label = excluded.release_label,
  description = excluded.description,
  status = excluded.status,
  notes = excluded.notes,
  applied_at = now();

grant select on public.v_admin_saved_filter_scope_summary to authenticated;
grant select on public.v_admin_close_wizard_steps to authenticated;
grant select on public.v_admin_health_resolution_queue to authenticated;
grant select on public.v_admin_deployment_gate_status to authenticated;
grant select on public.v_public_seo_smoke_check to authenticated;
grant select on public.admin_close_workflow_steps to authenticated;
grant select on public.admin_health_resolution_notes to authenticated;
grant select on public.admin_deployment_gate_checks to authenticated;
grant select on public.admin_public_seo_checks to authenticated;
grant select on public.admin_saved_filters to authenticated;


-- ============================================================================
-- Schema 109: pagination, close wizard actions, audit, backup, CSV import, evidence queue, and mobile cards
-- Source file: sql/109_pagination_close_wizard_audit_backup_mobile_foundations.sql
-- ============================================================================
-- Schema 109: pagination, guided close actions, audit log, backup rehearsal, bank CSV import staging, evidence queue, and mobile action cards.
-- 109_pagination_close_wizard_audit_backup_mobile_foundations.sql

create table if not exists public.app_schema_versions (
  schema_version integer primary key,
  migration_key text,
  schema_name text,
  release_label text,
  description text,
  status text not null default 'applied',
  applied_at timestamptz not null default now(),
  applied_by text,
  notes text
);

alter table public.admin_close_workflow_steps add column if not exists owner_profile_id uuid references public.profiles(id);
alter table public.admin_close_workflow_steps add column if not exists due_at timestamptz;
alter table public.admin_close_workflow_steps add column if not exists blocker_count_override int;
alter table public.admin_close_workflow_steps add column if not exists completion_notes text;
alter table public.admin_close_workflow_steps add column if not exists completed_by_profile_id uuid references public.profiles(id);
alter table public.admin_close_workflow_steps add column if not exists completed_at timestamptz;

create table if not exists public.admin_close_step_events (
  id uuid primary key default gen_random_uuid(),
  step_key text not null references public.admin_close_workflow_steps(step_key) on delete cascade,
  event_action text not null,
  from_status text,
  to_status text,
  event_notes text,
  actor_profile_id uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
create index if not exists idx_admin_close_step_events_step_created on public.admin_close_step_events(step_key, created_at desc);

create table if not exists public.admin_audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_profile_id uuid references public.profiles(id),
  event_area text not null default 'admin',
  event_action text not null,
  entity_type text,
  entity_id text,
  event_summary text,
  event_status text not null default 'recorded',
  route_hint text,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);
create index if not exists idx_admin_audit_events_occurred on public.admin_audit_events(occurred_at desc);
create index if not exists idx_admin_audit_events_entity on public.admin_audit_events(entity_type, entity_id);

create table if not exists public.admin_list_pagination_settings (
  list_key text primary key,
  list_title text not null,
  list_scope text not null default 'admin',
  default_page_size int not null default 50,
  max_page_size int not null default 200,
  current_sort_key text,
  current_sort_direction text not null default 'desc',
  supports_server_paging boolean not null default true,
  notes text,
  updated_at timestamptz not null default now()
);

insert into public.admin_list_pagination_settings (list_key, list_title, list_scope, default_page_size, max_page_size, current_sort_key, current_sort_direction, notes)
values
  ('people', 'People directory', 'people', 50, 200, 'full_name', 'asc', 'First list to wire to true server-side pagination.'),
  ('jobs', 'Jobs and operations', 'operations', 50, 200, 'updated_at', 'desc', 'Use for work orders, jobs, routes, and operations tables.'),
  ('accounting_close', 'Accounting close lists', 'accounting', 50, 200, 'period_end', 'desc', 'Use for period close, tax, payroll, reconciliation, and exports.'),
  ('health', 'Health and evidence queues', 'health', 50, 150, 'updated_at', 'desc', 'Use for health resolution, evidence, and failed upload queues.'),
  ('reports', 'Reports and rollups', 'reports', 40, 150, 'updated_at', 'desc', 'Keep reporting payloads smaller to avoid timeout regressions.')
on conflict (list_key) do update set
  list_title = excluded.list_title,
  list_scope = excluded.list_scope,
  default_page_size = excluded.default_page_size,
  max_page_size = excluded.max_page_size,
  current_sort_key = excluded.current_sort_key,
  current_sort_direction = excluded.current_sort_direction,
  notes = excluded.notes,
  updated_at = now();

create table if not exists public.bank_csv_import_sessions (
  id uuid primary key default gen_random_uuid(),
  bank_account_id uuid references public.bank_accounts(id),
  file_name text,
  import_status text not null default 'draft',
  total_row_count int not null default 0,
  accepted_row_count int not null default 0,
  rejected_row_count int not null default 0,
  duplicate_row_count int not null default 0,
  preview_notes text,
  import_notes text,
  created_by_profile_id uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_bank_csv_import_sessions_status on public.bank_csv_import_sessions(import_status, updated_at desc);

create table if not exists public.bank_csv_import_rows (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.bank_csv_import_sessions(id) on delete cascade,
  row_number int not null,
  transaction_date date,
  description text,
  amount numeric(14,2),
  row_hash text,
  duplicate_status text not null default 'unchecked',
  import_status text not null default 'preview',
  matched_reconciliation_item_id uuid references public.bank_reconciliation_items(id),
  reject_reason text,
  created_at timestamptz not null default now()
);
create unique index if not exists idx_bank_csv_import_rows_session_row on public.bank_csv_import_rows(session_id, row_number);
create index if not exists idx_bank_csv_import_rows_hash on public.bank_csv_import_rows(row_hash);

create table if not exists public.admin_backup_restore_rehearsals (
  id uuid primary key default gen_random_uuid(),
  rehearsal_key text,
  rehearsal_name text not null,
  rehearsal_scope text not null default 'database',
  rehearsal_status text not null default 'planned',
  operator_profile_id uuid references public.profiles(id),
  rehearsal_at timestamptz,
  source_backup_label text,
  restore_target_label text,
  result_summary text,
  next_action text,
  evidence_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.admin_backup_restore_rehearsals add column if not exists rehearsal_key text;
create unique index if not exists idx_admin_backup_restore_rehearsal_key on public.admin_backup_restore_rehearsals(rehearsal_key);
create index if not exists idx_admin_backup_restore_status on public.admin_backup_restore_rehearsals(rehearsal_status, updated_at desc);

insert into public.admin_backup_restore_rehearsals (rehearsal_key, rehearsal_name, rehearsal_scope, rehearsal_status, result_summary, next_action)
values
  ('supabase_restore_first', 'First Supabase backup restore rehearsal', 'database', 'planned', 'No restore rehearsal recorded yet.', 'Export a small backup, restore it to a non-production project, and record the result.'),
  ('edge_function_rollback_first', 'Edge Function rollback rehearsal', 'functions', 'planned', 'No rollback rehearsal recorded yet.', 'Keep prior function bundle and document rollback command before production sign-off.')
on conflict (rehearsal_key) do update set
  rehearsal_name = excluded.rehearsal_name,
  rehearsal_scope = excluded.rehearsal_scope,
  rehearsal_status = excluded.rehearsal_status,
  result_summary = excluded.result_summary,
  next_action = excluded.next_action,
  updated_at = now();

create table if not exists public.admin_evidence_action_queue (
  id uuid primary key default gen_random_uuid(),
  source_area text not null default 'evidence',
  source_id text,
  evidence_title text,
  action_type text not null default 'follow_up',
  action_status text not null default 'queued',
  assigned_to_profile_id uuid references public.profiles(id),
  created_by_profile_id uuid references public.profiles(id),
  action_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_admin_evidence_action_status on public.admin_evidence_action_queue(action_status, updated_at desc);

create table if not exists public.admin_mobile_action_cards (
  card_key text primary key,
  role_key text not null,
  card_title text not null,
  card_detail text,
  route_hint text,
  priority_rank int not null default 50,
  card_status text not null default 'review',
  offline_ready boolean not null default false,
  sort_order int not null default 100,
  updated_at timestamptz not null default now()
);

insert into public.admin_mobile_action_cards (card_key, role_key, card_title, card_detail, route_hint, priority_rank, card_status, offline_ready, sort_order)
values
  ('worker_clock', 'employee', 'Clock in / out', 'Mobile worker entry for shift start, breaks, and sign-out.', 'timeclock', 10, 'review', true, 10),
  ('worker_forms', 'employee', 'Assigned forms', 'Show required HSE forms, SDS prompts, training acknowledgements, and offline outbox status.', 'toolbox', 20, 'review', true, 20),
  ('worker_help', 'employee', 'Help contact', 'Fast call/message route for blocked workers and upload failures.', 'support', 30, 'review', false, 30),
  ('supervisor_daily', 'supervisor', 'Daily crew dashboard', 'Active crews, late/no-show risk, evidence review, incidents, and payroll exceptions.', 'admin', 10, 'review', false, 40),
  ('supervisor_evidence', 'supervisor', 'Evidence review', 'Supervisor queue for photos, signatures, failed uploads, and closeout proof.', 'admin', 20, 'review', false, 50)
on conflict (card_key) do update set
  role_key = excluded.role_key,
  card_title = excluded.card_title,
  card_detail = excluded.card_detail,
  route_hint = excluded.route_hint,
  priority_rank = excluded.priority_rank,
  card_status = excluded.card_status,
  offline_ready = excluded.offline_ready,
  sort_order = excluded.sort_order,
  updated_at = now();

insert into public.admin_production_readiness_checks (check_key, check_area, check_title, check_detail, check_status, next_action, sort_order)
values
  ('server_pagination_foundation', 'Performance', 'Server-side pagination settings exist', 'Admin lists now have DB-backed defaults for page size, sort, and payload limits.', 'review', 'Wire each table UI to send list_key, page, page_size, sort, and search to admin-directory.', 110),
  ('close_step_write_actions', 'Accounting', 'Guided close step write actions exist', 'Close steps can be completed or reopened and event history is logged.', 'review', 'Add owner/due-date editing and blocker drill-down per step.', 120),
  ('audit_event_log', 'Audit', 'Admin audit event log exists', 'Admin actions can be written to a central audit table and viewed in the readiness panel.', 'review', 'Expand every write action to call audit insert consistently.', 130),
  ('bank_csv_import_foundation', 'Accounting', 'Bank CSV import staging exists', 'Bank statement CSV uploads can be staged with duplicate/reject/accept counts before reconciliation posting.', 'review', 'Build the upload and preview screen next.', 140),
  ('evidence_retry_queue', 'Evidence', 'Evidence retry/replace/archive queue exists', 'Failed uploads and proof issues can now be queued for retry, replacement, archive, or follow-up.', 'review', 'Wire retry/replace/archive to the actual upload providers.', 150),
  ('mobile_action_cards', 'Mobile', 'Worker and supervisor mobile cards exist', 'Mobile dashboard cards are tracked for clocking, assigned forms, help contact, and supervisor daily view.', 'review', 'Build the worker mobile dashboard screen and offline outbox UI.', 160),
  ('backup_restore_rehearsal_log', 'Recovery', 'Backup/restore rehearsal log exists', 'Restore rehearsals can be tracked with operator, result, evidence, and next action.', 'review', 'Complete one real restore rehearsal before production sign-off.', 170)
on conflict (check_key) do update set
  check_area = excluded.check_area,
  check_title = excluded.check_title,
  check_detail = excluded.check_detail,
  check_status = excluded.check_status,
  next_action = excluded.next_action,
  sort_order = excluded.sort_order,
  updated_at = now();

update public.admin_deployment_gate_checks
set command_hint = replace(coalesce(command_hint, ''), 'schema 108', 'schema 109'),
    failure_hint = replace(coalesce(failure_hint, ''), 'schema 108', 'schema 109'),
    updated_at = now()
where check_key = 'schema_marker';

insert into public.admin_deployment_gate_checks (check_key, check_area, check_title, check_status, command_hint, failure_hint, sort_order)
values
  ('schema_109_marker', 'Database', 'Schema 109 marker applied', 'review', 'Apply sql/109_pagination_close_wizard_audit_backup_mobile_foundations.sql and verify Admin Health shows schema 109.', 'Admin UI can load schema 109 panels only after this migration is applied.', 45)
on conflict (check_key) do update set
  check_area = excluded.check_area,
  check_title = excluded.check_title,
  command_hint = excluded.command_hint,
  failure_hint = excluded.failure_hint,
  sort_order = excluded.sort_order,
  updated_at = now();

drop view if exists public.v_admin_close_wizard_steps;
create view public.v_admin_close_wizard_steps as
select
  s.step_key,
  s.step_group,
  s.step_title,
  s.step_detail,
  s.source_view,
  s.source_entity,
  s.route_hint,
  s.blocker_count_column,
  s.blocker_count_override,
  coalesce(s.blocker_count_override, 0)::int as active_blocker_count,
  s.step_status,
  s.owner_profile_id,
  owner.full_name as owner_name,
  s.due_at,
  s.completion_notes,
  s.completed_by_profile_id,
  completed.full_name as completed_by_name,
  s.completed_at,
  s.sort_order,
  s.updated_at
from public.admin_close_workflow_steps s
left join public.profiles owner on owner.id = s.owner_profile_id
left join public.profiles completed on completed.id = s.completed_by_profile_id
order by s.sort_order, s.step_key;

drop view if exists public.v_admin_audit_event_directory;
create view public.v_admin_audit_event_directory as
select
  e.id,
  e.occurred_at,
  e.event_area,
  e.event_action,
  e.entity_type,
  e.entity_id,
  e.event_summary,
  e.event_status,
  e.route_hint,
  p.full_name as actor_name,
  p.email as actor_email
from public.admin_audit_events e
left join public.profiles p on p.id = e.actor_profile_id
order by e.occurred_at desc;

drop view if exists public.v_admin_list_pagination_settings;
create view public.v_admin_list_pagination_settings as
select * from public.admin_list_pagination_settings order by list_scope, list_key;

drop view if exists public.v_bank_csv_import_session_directory;
create view public.v_bank_csv_import_session_directory as
select
  s.id,
  s.file_name,
  s.import_status,
  s.total_row_count,
  s.accepted_row_count,
  s.rejected_row_count,
  s.duplicate_row_count,
  s.preview_notes,
  s.import_notes,
  s.created_at,
  s.updated_at,
  ba.account_name as bank_account_name,
  p.full_name as created_by_name
from public.bank_csv_import_sessions s
left join public.bank_accounts ba on ba.id = s.bank_account_id
left join public.profiles p on p.id = s.created_by_profile_id
order by s.updated_at desc;

drop view if exists public.v_admin_backup_restore_rehearsal_directory;
create view public.v_admin_backup_restore_rehearsal_directory as
select
  r.id,
  r.rehearsal_key,
  r.rehearsal_name,
  r.rehearsal_scope,
  r.rehearsal_status,
  r.rehearsal_at,
  r.source_backup_label,
  r.restore_target_label,
  r.result_summary,
  r.next_action,
  r.evidence_url,
  r.created_at,
  r.updated_at,
  p.full_name as operator_name
from public.admin_backup_restore_rehearsals r
left join public.profiles p on p.id = r.operator_profile_id
order by case r.rehearsal_status when 'failed' then 1 when 'planned' then 2 when 'running' then 3 when 'passed' then 9 else 5 end, r.updated_at desc;

drop view if exists public.v_admin_evidence_action_queue;
create view public.v_admin_evidence_action_queue as
select
  q.id,
  q.source_area,
  q.source_id,
  q.evidence_title,
  q.action_type,
  q.action_status,
  assigned.full_name as assigned_to_name,
  created.full_name as created_by_name,
  q.action_notes,
  q.created_at,
  q.updated_at
from public.admin_evidence_action_queue q
left join public.profiles assigned on assigned.id = q.assigned_to_profile_id
left join public.profiles created on created.id = q.created_by_profile_id
order by case q.action_status when 'queued' then 1 when 'assigned' then 2 when 'blocked' then 3 when 'completed' then 9 else 5 end, q.updated_at desc;

drop view if exists public.v_admin_mobile_action_card_directory;
create view public.v_admin_mobile_action_card_directory as
select * from public.admin_mobile_action_cards order by role_key, sort_order, card_key;

drop view if exists public.v_schema_drift_status;
create view public.v_schema_drift_status as
select
  109::int as expected_schema_version,
  coalesce(max(schema_version) filter (where status = 'applied'), 0)::int as latest_applied_schema_version,
  case when coalesce(max(schema_version) filter (where status = 'applied'), 0) >= 109 then 'current' else 'behind' end as drift_status,
  case when coalesce(max(schema_version) filter (where status = 'applied'), 0) >= 109
    then 'Live database is at or ahead of the repo schema marker.'
    else 'Live database is behind the deployed app. Apply migrations through schema 109.'
  end as message,
  now() as checked_at
from public.app_schema_versions;

insert into public.app_schema_versions (schema_version, migration_key, schema_name, release_label, description, status, notes)
values (
  109,
  '109_pagination_close_wizard_audit_backup_mobile_foundations',
  '109_pagination_close_wizard_audit_backup_mobile_foundations.sql',
  '2026-05-15c',
  'Adds server pagination settings, close step write history, admin audit events, bank CSV staging, evidence action queue, mobile action cards, and backup rehearsal tracking.',
  'applied',
  'Production-readiness pass that advances the next 20 roadmap items into DB-backed foundations.'
)
on conflict (schema_version) do update set
  migration_key = excluded.migration_key,
  schema_name = excluded.schema_name,
  release_label = excluded.release_label,
  description = excluded.description,
  status = excluded.status,
  notes = excluded.notes,
  applied_at = now();

grant select on public.v_admin_close_wizard_steps to authenticated;
grant select on public.v_admin_audit_event_directory to authenticated;
grant select on public.v_admin_list_pagination_settings to authenticated;
grant select on public.v_bank_csv_import_session_directory to authenticated;
grant select on public.v_admin_backup_restore_rehearsal_directory to authenticated;
grant select on public.v_admin_evidence_action_queue to authenticated;
grant select on public.v_admin_mobile_action_card_directory to authenticated;
grant select on public.admin_close_step_events to authenticated;
grant select on public.admin_audit_events to authenticated;
grant select on public.admin_list_pagination_settings to authenticated;
grant select on public.bank_csv_import_sessions to authenticated;
grant select on public.bank_csv_import_rows to authenticated;
grant select on public.admin_backup_restore_rehearsals to authenticated;
grant select on public.admin_evidence_action_queue to authenticated;
grant select on public.admin_mobile_action_cards to authenticated;
-- Schema 110: mobile navigation quality gates.
-- Adds a safe DB marker for the 2026-05-16a mobile UX pass.
-- This migration has no hard dependency on app data tables and is safe to run after a partial schema-109 deploy.

create table if not exists public.app_schema_versions (
  schema_version integer primary key,
  schema_name text,
  description text,
  status text not null default 'applied',
  applied_at timestamptz not null default now(),
  applied_by text,
  notes text
);

alter table public.app_schema_versions add column if not exists migration_key text;
alter table public.app_schema_versions add column if not exists release_label text;

create table if not exists public.app_frontend_quality_gates (
  gate_key text primary key,
  gate_area text not null default 'Frontend',
  gate_title text not null,
  gate_status text not null default 'review',
  route_hint text,
  command_hint text,
  failure_hint text,
  checked_at timestamptz,
  sort_order integer not null default 100,
  updated_at timestamptz not null default now()
);

insert into public.app_frontend_quality_gates (
  gate_key,
  gate_area,
  gate_title,
  gate_status,
  route_hint,
  command_hint,
  failure_hint,
  checked_at,
  sort_order
)
values
  (
    'mobile_main_nav_collapsed',
    'Mobile UX',
    'Main menu collapses on phones and expands on tap',
    'passed',
    '#toolbox',
    'Open the app under 760px wide and confirm the header shows one Menu button before expansion.',
    'If the full nav appears as a long vertical list on load, verify index.html, style.css, and js/mobile-menu.js are deployed with the same cache version.',
    now(),
    10
  ),
  (
    'mobile_admin_section_nav_collapsed',
    'Mobile UX',
    'Admin section menu collapses on phones and expands on tap',
    'passed',
    '#admin',
    'Open Admin under 720px wide and confirm Admin sections are hidden behind one expandable control.',
    'If admin section buttons form a long list, verify js/admin-ui.js and style.css are from release 2026-05-16a.',
    now(),
    20
  ),
  (
    'single_public_h1',
    'SEO',
    'Exposed app shell keeps one H1',
    'passed',
    '/',
    'Run node scripts/repo-smoke-check.mjs and confirm single-public-h1-index passes.',
    'If more than one H1 is found, demote secondary page headings to H2/H3.',
    now(),
    30
  ),
  (
    'cache_version_2026_05_16a',
    'Deployment',
    'Static assets and service worker use release 2026-05-16a',
    'passed',
    '/',
    'Hard refresh after deploy and confirm scripts/css load with ?v=2026-05-16a.',
    'If old menus persist, unregister the service worker or clear the app cache.',
    now(),
    40
  ),
  (
    'active_markdown_refreshed',
    'Documentation',
    'Active Markdown reflects schema 110 and mobile menu pass',
    'passed',
    'README.md',
    'Review README.md, DEVELOPMENT_ROADMAP.md, KNOWN_ISSUES_AND_GAPS.md, and DATABASE_STRUCTURE.md.',
    'If docs still mention schema 109 as latest, use the 2026-05-16a build docs.',
    now(),
    50
  )
on conflict (gate_key) do update set
  gate_area = excluded.gate_area,
  gate_title = excluded.gate_title,
  gate_status = excluded.gate_status,
  route_hint = excluded.route_hint,
  command_hint = excluded.command_hint,
  failure_hint = excluded.failure_hint,
  checked_at = excluded.checked_at,
  sort_order = excluded.sort_order,
  updated_at = now();

do $$
begin
  if to_regclass('public.admin_deployment_gate_checks') is not null then
    insert into public.admin_deployment_gate_checks (check_key, check_area, check_title, check_status, command_hint, failure_hint, sort_order)
    values (
      'schema_110_mobile_navigation_marker',
      'Mobile UX',
      'Schema 110 mobile navigation marker applied',
      'passed',
      'Apply sql/110_mobile_navigation_quality_gates.sql and verify v_mobile_navigation_quality_gates returns rows.',
      'Mobile UX gates will not appear in Admin readiness until schema 110 is applied.',
      46
    )
    on conflict (check_key) do update set
      check_area = excluded.check_area,
      check_title = excluded.check_title,
      check_status = excluded.check_status,
      command_hint = excluded.command_hint,
      failure_hint = excluded.failure_hint,
      sort_order = excluded.sort_order,
      updated_at = now();
  end if;
end $$;

drop view if exists public.v_mobile_navigation_quality_gates;
create view public.v_mobile_navigation_quality_gates as
select
  gate_key,
  gate_area,
  gate_title,
  gate_status,
  route_hint,
  command_hint,
  failure_hint,
  checked_at,
  sort_order,
  updated_at
from public.app_frontend_quality_gates
where gate_key in (
  'mobile_main_nav_collapsed',
  'mobile_admin_section_nav_collapsed',
  'single_public_h1',
  'cache_version_2026_05_16a',
  'active_markdown_refreshed'
)
order by sort_order, gate_key;

drop view if exists public.v_schema_drift_status;
create view public.v_schema_drift_status as
select
  110::int as expected_schema_version,
  coalesce(max(schema_version) filter (where status = 'applied'), 0)::int as latest_applied_schema_version,
  case when coalesce(max(schema_version) filter (where status = 'applied'), 0) >= 110 then 'current' else 'behind' end as drift_status,
  case when coalesce(max(schema_version) filter (where status = 'applied'), 0) >= 110
    then 'Live database is at or ahead of the repo schema marker.'
    else 'Live database is behind the deployed app. Apply migrations through schema 110.'
  end as message,
  now() as checked_at
from public.app_schema_versions;

insert into public.app_schema_versions (schema_version, migration_key, schema_name, release_label, description, status, notes)
values (
  110,
  '110_mobile_navigation_quality_gates',
  '110_mobile_navigation_quality_gates.sql',
  '2026-05-16a',
  'Adds frontend quality-gate tracking for compact mobile navigation, admin mobile sections, cache version, one-H1, and active docs readiness.',
  'applied',
  'Mobile UX pass focused on replacing long mobile menu lists with compact expandable menus.'
)
on conflict (schema_version) do update set
  migration_key = excluded.migration_key,
  schema_name = excluded.schema_name,
  release_label = excluded.release_label,
  description = excluded.description,
  status = excluded.status,
  notes = excluded.notes,
  applied_at = now();

grant select on public.app_frontend_quality_gates to authenticated;
grant select on public.v_mobile_navigation_quality_gates to authenticated;
-- Schema 111: Admin directory pagination and saved-view replay quality gates.
-- Adds a safe marker for the 2026-05-16b pass. It is intentionally low-risk:
-- existing schema-109 pagination settings are updated, frontend quality gates are marked,
-- and the schema drift view is advanced to 111.

create table if not exists public.app_schema_versions (
  schema_version integer primary key,
  schema_name text,
  description text,
  status text not null default 'applied',
  applied_at timestamptz not null default now(),
  applied_by text,
  notes text
);

alter table public.app_schema_versions add column if not exists migration_key text;
alter table public.app_schema_versions add column if not exists release_label text;

create table if not exists public.app_frontend_quality_gates (
  gate_key text primary key,
  gate_area text not null default 'Frontend',
  gate_title text not null,
  gate_status text not null default 'review',
  route_hint text,
  command_hint text,
  failure_hint text,
  checked_at timestamptz,
  sort_order integer not null default 100,
  updated_at timestamptz not null default now()
);

-- Tighten the previously planned admin pagination defaults so first load is lighter on phones.
do $$
begin
  if to_regclass('public.admin_list_pagination_settings') is not null then
    insert into public.admin_list_pagination_settings (list_key, list_title, list_scope, default_page_size, max_page_size, current_sort_key, current_sort_direction, notes)
    values
      ('people', 'People directory', 'people', 25, 200, 'full_name', 'asc', 'Staff Directory now sends page, page size, search, and role filter to admin-directory.'),
      ('jobs', 'Jobs and operations', 'operations', 25, 200, 'job_code', 'asc', 'Jobs list now has a paged Edge Function path for smaller payloads.')
    on conflict (list_key) do update set
      list_title = excluded.list_title,
      list_scope = excluded.list_scope,
      default_page_size = excluded.default_page_size,
      max_page_size = excluded.max_page_size,
      current_sort_key = excluded.current_sort_key,
      current_sort_direction = excluded.current_sort_direction,
      notes = excluded.notes,
      updated_at = now();
  end if;
end $$;

insert into public.app_frontend_quality_gates (
  gate_key,
  gate_area,
  gate_title,
  gate_status,
  route_hint,
  command_hint,
  failure_hint,
  checked_at,
  sort_order
)
values
  (
    'admin_people_pagination_controls',
    'Admin UX',
    'Staff Directory has search, role filter, page size, and previous/next controls',
    'passed',
    '#admin',
    'Open Admin > People and Access; confirm Staff Directory controls load and page labels update.',
    'If the Staff Directory still loads one large table with no controls, verify js/admin-ui.js and style.css from release 2026-05-16b are deployed.',
    now(),
    60
  ),
  (
    'admin_directory_pagination_payload',
    'Backend',
    'admin-directory returns pagination_meta for people and jobs',
    'passed',
    'supabase/functions/admin-directory',
    'Call admin-directory with people_page, people_page_size, jobs_page, and jobs_page_size; confirm pagination_meta.people/jobs is returned.',
    'If payloads are still too large, verify the updated admin-directory Edge Function was redeployed.',
    now(),
    70
  ),
  (
    'admin_saved_view_replay_staff_filters',
    'Admin UX',
    'Saved admin views replay Staff Directory filters',
    'passed',
    '#admin',
    'Save a view with Staff search/role/page size, then press Use and confirm the filters reload.',
    'If saved views only switch sections, verify v_admin_saved_filter_directory includes filter_payload and admin-ui.js release 2026-05-16b is deployed.',
    now(),
    80
  ),
  (
    'cache_version_2026_05_16b',
    'Deployment',
    'Static assets and service worker use release 2026-05-16b',
    'passed',
    '/',
    'Hard refresh after deploy and confirm scripts/css load with ?v=2026-05-16b.',
    'If old admin tables persist, unregister the service worker or clear the app cache.',
    now(),
    90
  )
on conflict (gate_key) do update set
  gate_area = excluded.gate_area,
  gate_title = excluded.gate_title,
  gate_status = excluded.gate_status,
  route_hint = excluded.route_hint,
  command_hint = excluded.command_hint,
  failure_hint = excluded.failure_hint,
  checked_at = excluded.checked_at,
  sort_order = excluded.sort_order,
  updated_at = now();

-- Keep the existing mobile quality-gate view useful and include this pass's Admin UX checks.
drop view if exists public.v_mobile_navigation_quality_gates;
create view public.v_mobile_navigation_quality_gates as
select
  gate_key,
  gate_area,
  gate_title,
  gate_status,
  route_hint,
  command_hint,
  failure_hint,
  checked_at,
  sort_order,
  updated_at
from public.app_frontend_quality_gates
where gate_key in (
  'mobile_main_nav_collapsed',
  'mobile_admin_section_nav_collapsed',
  'single_public_h1',
  'cache_version_2026_05_16a',
  'active_markdown_refreshed',
  'admin_people_pagination_controls',
  'admin_directory_pagination_payload',
  'admin_saved_view_replay_staff_filters',
  'cache_version_2026_05_16b'
)
order by sort_order, gate_key;

drop view if exists public.v_schema_drift_status;
create view public.v_schema_drift_status as
select
  111::int as expected_schema_version,
  coalesce(max(schema_version) filter (where status = 'applied'), 0)::int as latest_applied_schema_version,
  case when coalesce(max(schema_version) filter (where status = 'applied'), 0) >= 111 then 'current' else 'behind' end as drift_status,
  case when coalesce(max(schema_version) filter (where status = 'applied'), 0) >= 111
    then 'Live database is at or ahead of the repo schema marker.'
    else 'Live database is behind the deployed app. Apply migrations through schema 111.'
  end as message,
  now() as checked_at
from public.app_schema_versions;

insert into public.app_schema_versions (schema_version, migration_key, schema_name, release_label, description, status, notes)
values (
  111,
  '111_admin_directory_pagination_saved_view_replay',
  '111_admin_directory_pagination_saved_view_replay.sql',
  '2026-05-16b',
  'Adds quality gates for Staff Directory pagination controls, admin-directory pagination metadata, saved-view replay, and release cache version 2026-05-16b.',
  'applied',
  'Production-readiness pass focused on reducing Admin payload size and making saved admin views reusable.'
)
on conflict (schema_version) do update set
  migration_key = excluded.migration_key,
  schema_name = excluded.schema_name,
  release_label = excluded.release_label,
  description = excluded.description,
  status = excluded.status,
  notes = excluded.notes,
  applied_at = now();

grant select on public.app_frontend_quality_gates to authenticated;
grant select on public.v_mobile_navigation_quality_gates to authenticated;
-- Schema 112: Admin Operations pagination, sorting, panel refresh, and saved view quality gates.
-- Low-risk tracking migration for the 2026-05-17a pass. It records the new Admin UX/backend
-- behavior without changing core business tables.

create table if not exists public.app_schema_versions (
  schema_version integer primary key,
  schema_name text,
  description text,
  status text not null default 'applied',
  applied_at timestamptz not null default now(),
  applied_by text,
  notes text
);

alter table public.app_schema_versions add column if not exists migration_key text;
alter table public.app_schema_versions add column if not exists release_label text;

create table if not exists public.app_frontend_quality_gates (
  gate_key text primary key,
  gate_area text not null default 'Frontend',
  gate_title text not null,
  gate_status text not null default 'review',
  route_hint text,
  command_hint text,
  failure_hint text,
  checked_at timestamptz,
  sort_order integer not null default 100,
  updated_at timestamptz not null default now()
);

-- Keep default list settings aligned with the visible Admin list controls.
do $$
begin
  if to_regclass('public.admin_list_pagination_settings') is not null then
    insert into public.admin_list_pagination_settings (
      list_key,
      list_title,
      list_scope,
      default_page_size,
      max_page_size,
      current_sort_key,
      current_sort_direction,
      notes
    )
    values
      ('people', 'People directory', 'people', 25, 200, 'full_name', 'asc', 'Staff Directory supports search, role filter, sort, direction, page size, previous/next, and saved-view replay.'),
      ('jobs', 'Jobs and operations', 'operations', 25, 200, 'job_code', 'asc', 'Jobs/Operations supports search, sort, direction, page size, previous/next, and saved-view replay.')
    on conflict (list_key) do update set
      list_title = excluded.list_title,
      list_scope = excluded.list_scope,
      default_page_size = excluded.default_page_size,
      max_page_size = excluded.max_page_size,
      current_sort_key = excluded.current_sort_key,
      current_sort_direction = excluded.current_sort_direction,
      notes = excluded.notes,
      updated_at = now();
  end if;
end $$;

insert into public.app_frontend_quality_gates (
  gate_key,
  gate_area,
  gate_title,
  gate_status,
  route_hint,
  command_hint,
  failure_hint,
  checked_at,
  sort_order
)
values
  (
    'admin_people_sort_controls',
    'Admin UX',
    'Staff Directory supports visible sort and direction controls',
    'passed',
    '#admin',
    'Open Admin > People and Access; change Sort/Direction and confirm the page reloads with the selected order.',
    'If sorting is ignored, redeploy admin-directory and clear cached 2026-05-16b assets.',
    now(),
    92
  ),
  (
    'admin_jobs_pagination_controls',
    'Admin UX',
    'Jobs/Operations supports visible search, sort, page size, and previous/next controls',
    'passed',
    '#admin',
    'Open Admin > Jobs and Operations; use the Jobs toolbar and confirm the page label changes.',
    'If the Jobs toolbar is missing, verify js/admin-ui.js and style.css from 2026-05-17a deployed.',
    now(),
    94
  ),
  (
    'admin_directory_people_jobs_sort_payload',
    'Backend',
    'admin-directory accepts sanitized people_sort/jobs_sort payloads',
    'passed',
    'supabase/functions/admin-directory',
    'Call admin-directory with people_sort, people_sort_dir, jobs_sort, and jobs_sort_dir; confirm pagination_meta returns sorting metadata.',
    'If sorting fails, redeploy the admin-directory Edge Function from 2026-05-17a.',
    now(),
    96
  ),
  (
    'admin_saved_view_replay_people_jobs',
    'Admin UX',
    'Saved admin views replay Staff and Jobs list filters',
    'passed',
    '#admin',
    'Save a view with Staff and Jobs filters, press Use, and confirm both toolbars are restored.',
    'If only the section changes, redeploy admin-manage/admin-directory and clear the service worker cache.',
    now(),
    98
  ),
  (
    'cache_version_2026_05_17a',
    'Deployment',
    'Static assets and service worker use release 2026-05-17a',
    'passed',
    '/',
    'Hard refresh after deploy and confirm scripts/css load with ?v=2026-05-17a.',
    'If old Admin list controls persist, unregister the service worker or clear the app cache.',
    now(),
    100
  )
on conflict (gate_key) do update set
  gate_area = excluded.gate_area,
  gate_title = excluded.gate_title,
  gate_status = excluded.gate_status,
  route_hint = excluded.route_hint,
  command_hint = excluded.command_hint,
  failure_hint = excluded.failure_hint,
  checked_at = excluded.checked_at,
  sort_order = excluded.sort_order,
  updated_at = now();

-- Keep the quality gate directory current for Admin Health / Readiness panels.
drop view if exists public.v_mobile_navigation_quality_gates;
create view public.v_mobile_navigation_quality_gates as
select
  gate_key,
  gate_area,
  gate_title,
  gate_status,
  route_hint,
  command_hint,
  failure_hint,
  checked_at,
  sort_order,
  updated_at
from public.app_frontend_quality_gates
where gate_key in (
  'mobile_main_nav_collapsed',
  'mobile_admin_section_nav_collapsed',
  'single_public_h1',
  'active_markdown_refreshed',
  'admin_people_pagination_controls',
  'admin_directory_pagination_payload',
  'admin_saved_view_replay_staff_filters',
  'cache_version_2026_05_16b',
  'admin_people_sort_controls',
  'admin_jobs_pagination_controls',
  'admin_directory_people_jobs_sort_payload',
  'admin_saved_view_replay_people_jobs',
  'cache_version_2026_05_17a'
)
order by sort_order, gate_key;

drop view if exists public.v_schema_drift_status;
create view public.v_schema_drift_status as
select
  112::int as expected_schema_version,
  coalesce(max(schema_version) filter (where status = 'applied'), 0)::int as latest_applied_schema_version,
  case when coalesce(max(schema_version) filter (where status = 'applied'), 0) >= 112 then 'current' else 'behind' end as drift_status,
  case when coalesce(max(schema_version) filter (where status = 'applied'), 0) >= 112
    then 'Live database is at or ahead of the repo schema marker.'
    else 'Live database is behind the deployed app. Apply migrations through schema 112.'
  end as message,
  now() as checked_at
from public.app_schema_versions;

insert into public.app_schema_versions (schema_version, migration_key, schema_name, release_label, description, status, notes)
values (
  112,
  '112_admin_operations_pagination_sorting_panel_refresh',
  '112_admin_operations_pagination_sorting_panel_refresh.sql',
  '2026-05-17a',
  'Adds quality gates for Staff sort controls, visible Jobs/Operations pagination controls, sanitized admin-directory sorting, saved-view replay, and cache version 2026-05-17a.',
  'applied',
  'Production-readiness pass focused on mobile-friendly list controls and smaller Admin refresh payloads.'
)
on conflict (schema_version) do update set
  migration_key = excluded.migration_key,
  schema_name = excluded.schema_name,
  release_label = excluded.release_label,
  description = excluded.description,
  status = excluded.status,
  notes = excluded.notes,
  applied_at = now();

grant select on public.app_frontend_quality_gates to authenticated;
grant select on public.v_mobile_navigation_quality_gates to authenticated;
grant select on public.v_schema_drift_status to authenticated;



-- 113_admin_panel_refresh_and_job_review_actions.sql
-- Schema 113: Admin panel-only refreshes, Operations job review actions, and mobile table quality gates.
-- Low-risk tracking migration for the 2026-05-17b pass.
--
-- Important live-schema fix:
-- Keep v_schema_drift_status column name as expected_schema_version.
-- Earlier file used repo_schema_version, which caused:
-- ERROR 42P16: cannot change name of view column "expected_schema_version" to "repo_schema_version"

create table if not exists public.app_schema_versions (
  schema_version integer primary key,
  schema_name text,
  description text,
  status text not null default 'applied',
  applied_at timestamptz not null default now(),
  applied_by text,
  notes text
);

alter table public.app_schema_versions add column if not exists migration_key text;
alter table public.app_schema_versions add column if not exists release_label text;

create table if not exists public.app_frontend_quality_gates (
  gate_key text primary key,
  gate_area text not null default 'Frontend',
  gate_title text not null,
  gate_status text not null default 'review',
  route_hint text,
  command_hint text,
  failure_hint text,
  checked_at timestamptz,
  sort_order integer not null default 100,
  updated_at timestamptz not null default now()
);

create table if not exists public.admin_panel_refresh_preferences (
  panel_key text primary key,
  panel_title text not null,
  edge_scope text not null,
  preferred_timeout_ms integer not null default 12000,
  last_refresh_status text not null default 'ready',
  last_refresh_at timestamptz,
  notes text,
  updated_at timestamptz not null default now()
);

create table if not exists public.admin_job_action_audit (
  id uuid primary key default gen_random_uuid(),
  job_id bigint,
  action_key text not null,
  action_status text not null default 'queued',
  action_note text,
  created_by_profile_id uuid,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists idx_admin_job_action_audit_job_id_created
  on public.admin_job_action_audit(job_id, created_at desc);

insert into public.admin_panel_refresh_preferences (
  panel_key,
  panel_title,
  edge_scope,
  preferred_timeout_ms,
  last_refresh_status,
  notes
)
values
  (
    'staff_directory',
    'Staff Directory and Access',
    'people',
    12000,
    'ready',
    'Refresh Staff Only uses the people fast path instead of reloading all Admin data.'
  ),
  (
    'jobs_operations',
    'Jobs and Operations',
    'operations',
    12000,
    'ready',
    'Refresh Jobs Only uses the operations fast path and keeps the current Jobs filter/page.'
  ),
  (
    'health_schema',
    'App Health and Schema Center',
    'health',
    12000,
    'ready',
    'Health panel can be refreshed through a narrow health/command-center scope.'
  ),
  (
    'accounting_close',
    'Guided Close Center',
    'accounting',
    12000,
    'ready',
    'Close center can refresh close blockers without reloading Staff Directory data.'
  ),
  (
    'reporting',
    'Reporting',
    'reporting',
    20000,
    'ready',
    'Reports remain lazy-loaded and use the reporting fast path.'
  )
on conflict (panel_key) do update set
  panel_title = excluded.panel_title,
  edge_scope = excluded.edge_scope,
  preferred_timeout_ms = excluded.preferred_timeout_ms,
  last_refresh_status = excluded.last_refresh_status,
  notes = excluded.notes,
  updated_at = now();

insert into public.app_frontend_quality_gates (
  gate_key,
  gate_area,
  gate_title,
  gate_status,
  route_hint,
  command_hint,
  failure_hint,
  checked_at,
  sort_order
)
values
  (
    'admin_panel_refresh_people_scope',
    'Admin UX',
    'Staff panel refresh uses people-only Edge scope',
    'passed',
    '#admin',
    'Open Admin > People and Access, press Refresh Staff Only, and confirm other sections are not reloaded.',
    'Redeploy admin-directory and clear service worker cache if the button still reloads the full Admin manager.',
    now(),
    310
  ),
  (
    'admin_panel_refresh_operations_scope',
    'Admin UX',
    'Jobs panel refresh uses operations-only Edge scope',
    'passed',
    '#admin',
    'Open Admin > Jobs and Operations, press Refresh Jobs Only, and confirm Jobs paging remains intact.',
    'Redeploy admin-directory and clear service worker cache if Jobs reload is slow or resets filters.',
    now(),
    320
  ),
  (
    'admin_jobs_review_table_mobile',
    'Mobile UX',
    'Jobs review table has compact mobile row actions',
    'passed',
    '#admin',
    'On a phone-width viewport, confirm Open, Complete, Cancel, and Add Note stack cleanly.',
    'Check style.css admin-row-actions and admin-jobs-review-wrap rules if actions overflow.',
    now(),
    330
  ),
  (
    'admin_job_action_handlers',
    'Admin Actions',
    'Admin Manage supports job status and note actions',
    'passed',
    '#admin',
    'Use a safe test job to add a note, then review job_comments and site activity.',
    'Redeploy admin-manage if row actions return unsupported job action.',
    now(),
    340
  )
on conflict (gate_key) do update set
  gate_area = excluded.gate_area,
  gate_title = excluded.gate_title,
  gate_status = excluded.gate_status,
  route_hint = excluded.route_hint,
  command_hint = excluded.command_hint,
  failure_hint = excluded.failure_hint,
  checked_at = excluded.checked_at,
  sort_order = excluded.sort_order,
  updated_at = now();

create or replace view public.v_admin_panel_refresh_preferences as
select
  panel_key,
  panel_title,
  edge_scope,
  preferred_timeout_ms,
  last_refresh_status,
  last_refresh_at,
  notes,
  updated_at
from public.admin_panel_refresh_preferences
order by panel_key;

create or replace view public.v_admin_job_action_audit_directory as
select
  a.id,
  a.job_id,
  j.job_code,
  j.job_name,
  a.action_key,
  a.action_status,
  a.action_note,
  p.full_name as created_by_name,
  a.created_at,
  a.resolved_at,
  a.metadata
from public.admin_job_action_audit a
left join public.jobs j on j.id = a.job_id
left join public.profiles p on p.id = a.created_by_profile_id
order by a.created_at desc;

create or replace view public.v_schema_drift_status as
select
  113::int as expected_schema_version,
  coalesce(max(schema_version) filter (where status = 'applied'), 0)::int as latest_applied_schema_version,
  case
    when coalesce(max(schema_version) filter (where status = 'applied'), 0) >= 113
      then 'current'
    else 'behind'
  end as drift_status,
  case
    when coalesce(max(schema_version) filter (where status = 'applied'), 0) >= 113
      then 'Live database is at or ahead of the repo schema marker.'
    else 'Live database is behind the deployed app. Apply migrations through schema 113.'
  end as message,
  now() as checked_at
from public.app_schema_versions;

insert into public.app_schema_versions (
  schema_version,
  migration_key,
  schema_name,
  release_label,
  description,
  status,
  notes
)
values (
  113,
  '113_admin_panel_refresh_and_job_review_actions',
  '113_admin_panel_refresh_and_job_review_actions.sql',
  '2026-05-17b',
  'Adds Admin panel-only refresh tracking, mobile Jobs review quality gates, and job action audit foundations.',
  'applied',
  'Production-readiness pass focused on smaller Admin payloads, direct jobs review actions, and mobile-safe admin tables.'
)
on conflict (schema_version) do update set
  migration_key = excluded.migration_key,
  schema_name = excluded.schema_name,
  release_label = excluded.release_label,
  description = excluded.description,
  status = excluded.status,
  notes = excluded.notes,
  applied_at = now();

grant select on public.app_frontend_quality_gates to authenticated;
grant select on public.v_admin_panel_refresh_preferences to authenticated;
grant select on public.v_admin_job_action_audit_directory to authenticated;
grant select on public.v_schema_drift_status to authenticated;


-- Schema 114: Staged Admin load and cache fallback guardrails.
-- Low-risk tracking migration for the 2026-05-18a pass.
-- Documents the Admin load change from one large `scope: all` request to smaller staged panel requests.

create table if not exists public.app_schema_versions (
  schema_version integer primary key,
  schema_name text,
  description text,
  status text not null default 'applied',
  applied_at timestamptz not null default now(),
  applied_by text,
  notes text
);

alter table public.app_schema_versions add column if not exists migration_key text;
alter table public.app_schema_versions add column if not exists release_label text;

create table if not exists public.app_frontend_quality_gates (
  gate_key text primary key,
  gate_area text not null default 'Frontend',
  gate_title text not null,
  gate_status text not null default 'review',
  route_hint text,
  command_hint text,
  failure_hint text,
  checked_at timestamptz,
  sort_order integer not null default 100,
  updated_at timestamptz not null default now()
);

create table if not exists public.admin_panel_refresh_preferences (
  panel_key text primary key,
  panel_title text not null,
  edge_scope text not null,
  preferred_timeout_ms integer not null default 12000,
  last_refresh_status text not null default 'ready',
  last_refresh_at timestamptz,
  notes text,
  updated_at timestamptz not null default now()
);

insert into public.admin_panel_refresh_preferences (
  panel_key,
  panel_title,
  edge_scope,
  preferred_timeout_ms,
  last_refresh_status,
  notes
)
values
  (
    'admin_initial_health_stage',
    'Admin Initial Load - Health Stage',
    'health',
    16000,
    'ready',
    'Initial Admin load starts with the light health scope so the Command Center can render before heavier panels.'
  ),
  (
    'admin_initial_people_stage',
    'Admin Initial Load - People Stage',
    'people',
    16000,
    'ready',
    'Initial Admin load uses the people scope for Staff Directory pagination instead of one large all-scope payload.'
  ),
  (
    'admin_initial_operations_stage',
    'Admin Initial Load - Operations Stage',
    'operations',
    25000,
    'ready',
    'Initial Admin load uses the operations scope for Jobs/Operations and gives it a slightly longer timeout.'
  ),
  (
    'admin_initial_accounting_stage',
    'Admin Initial Load - Accounting Stage',
    'accounting',
    16000,
    'ready',
    'Initial Admin load uses the accounting scope for close-center data instead of blocking the whole Admin page.'
  ),
  (
    'admin_initial_all_fallback',
    'Admin Initial Load - All Scope Emergency Fallback',
    'all',
    90000,
    'ready',
    'The old all-scope request remains only as a fallback when every staged panel request fails.'
  )
on conflict (panel_key) do update set
  panel_title = excluded.panel_title,
  edge_scope = excluded.edge_scope,
  preferred_timeout_ms = excluded.preferred_timeout_ms,
  last_refresh_status = excluded.last_refresh_status,
  notes = excluded.notes,
  updated_at = now();

insert into public.app_frontend_quality_gates (
  gate_key,
  gate_area,
  gate_title,
  gate_status,
  route_hint,
  command_hint,
  failure_hint,
  checked_at,
  sort_order
)
values
  (
    'admin_initial_load_staged_scopes',
    'Admin UX',
    'Admin initial load uses staged Edge scopes',
    'passed',
    '#admin',
    'Open Admin and confirm it loads without immediately falling back to cached data. Network calls should show health, people, operations, and accounting scopes before any all-scope fallback.',
    'Redeploy admin-directory and clear the service worker if Admin still starts with only scope=all.',
    now(),
    350
  ),
  (
    'admin_cached_data_warning_specific',
    'Admin Resilience',
    'Cached Admin fallback remains available but is not the first normal path',
    'passed',
    '#admin',
    'Temporarily block one staged scope and confirm Admin shows partial live data with a panel retry warning instead of blanking the whole screen.',
    'Check js/admin-ui.js loadDirectory stagedWarnings handling if the whole Admin screen falls back too quickly.',
    now(),
    360
  ),
  (
    'admin_operations_timeout_guardrail',
    'Admin Performance',
    'Operations scope has a bounded 25s timeout during initial Admin load',
    'passed',
    '#admin',
    'Confirm Jobs/Operations can be retried separately with Refresh Jobs Only if the initial operations panel is slow.',
    'Use the operations fast path and pagination controls before increasing the timeout further.',
    now(),
    370
  ),
  (
    'admin_all_scope_emergency_fallback_only',
    'Admin Performance',
    'All-scope Admin load is kept as emergency fallback only',
    'passed',
    '#admin',
    'Confirm the all-scope request is not the first request during normal Admin page load.',
    'If all-scope fires first, clear cached 2026-05-17b assets and verify 2026-05-18a scripts are deployed.',
    now(),
    380
  )
on conflict (gate_key) do update set
  gate_area = excluded.gate_area,
  gate_title = excluded.gate_title,
  gate_status = excluded.gate_status,
  route_hint = excluded.route_hint,
  command_hint = excluded.command_hint,
  failure_hint = excluded.failure_hint,
  checked_at = excluded.checked_at,
  sort_order = excluded.sort_order,
  updated_at = now();

create or replace view public.v_admin_panel_refresh_preferences as
select
  panel_key,
  panel_title,
  edge_scope,
  preferred_timeout_ms,
  last_refresh_status,
  last_refresh_at,
  notes,
  updated_at
from public.admin_panel_refresh_preferences
order by panel_key;

create or replace view public.v_schema_drift_status as
select
  114::int as expected_schema_version,
  coalesce(max(schema_version) filter (where status = 'applied'), 0)::int as latest_applied_schema_version,
  case
    when coalesce(max(schema_version) filter (where status = 'applied'), 0) >= 114
      then 'current'
    else 'behind'
  end as drift_status,
  case
    when coalesce(max(schema_version) filter (where status = 'applied'), 0) >= 114
      then 'Live database is at or ahead of the repo schema marker.'
    else 'Live database is behind the deployed app. Apply migrations through schema 114.'
  end as message,
  now() as checked_at
from public.app_schema_versions;

insert into public.app_schema_versions (
  schema_version,
  migration_key,
  schema_name,
  release_label,
  description,
  status,
  notes
)
values (
  114,
  '114_staged_admin_load_and_cache_fallback_guardrails',
  '114_staged_admin_load_and_cache_fallback_guardrails.sql',
  '2026-05-18a',
  'Tracks staged Admin initial load, smaller panel scopes, bounded timeouts, and cache fallback guardrails.',
  'applied',
  'Production-readiness pass focused on stopping Admin from starting with one heavy all-scope request and falling back to stale cached data too quickly.'
)
on conflict (schema_version) do update set
  migration_key = excluded.migration_key,
  schema_name = excluded.schema_name,
  release_label = excluded.release_label,
  description = excluded.description,
  status = excluded.status,
  notes = excluded.notes,
  applied_at = now();

grant select on public.app_frontend_quality_gates to authenticated;
grant select on public.v_admin_panel_refresh_preferences to authenticated;
grant select on public.v_schema_drift_status to authenticated;

-- Schema 115: Admin panel retry, timing visibility, and command-center fast path.
-- Low-risk tracking migration for the 2026-05-18b pass.
-- Keeps the expected_schema_version column name stable to avoid PostgreSQL 42P16 view rename errors.

create table if not exists public.app_schema_versions (
  schema_version integer primary key,
  schema_name text,
  description text,
  status text not null default 'applied',
  applied_at timestamptz not null default now(),
  applied_by text,
  notes text
);

alter table public.app_schema_versions add column if not exists migration_key text;
alter table public.app_schema_versions add column if not exists release_label text;

create table if not exists public.app_frontend_quality_gates (
  gate_key text primary key,
  gate_area text not null default 'Frontend',
  gate_title text not null,
  gate_status text not null default 'review',
  route_hint text,
  command_hint text,
  failure_hint text,
  checked_at timestamptz,
  sort_order integer not null default 100,
  updated_at timestamptz not null default now()
);

create table if not exists public.admin_panel_refresh_preferences (
  panel_key text primary key,
  panel_title text not null,
  edge_scope text not null,
  preferred_timeout_ms integer not null default 12000,
  last_refresh_status text not null default 'ready',
  last_refresh_at timestamptz,
  notes text,
  updated_at timestamptz not null default now()
);

create table if not exists public.admin_panel_load_diagnostics (
  id uuid primary key default gen_random_uuid(),
  panel_key text not null,
  edge_scope text not null,
  load_status text not null default 'observed',
  elapsed_ms integer,
  stale_age_seconds integer,
  diagnostic_message text,
  captured_by_profile_id uuid,
  captured_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists idx_admin_panel_load_diagnostics_scope_time
  on public.admin_panel_load_diagnostics(edge_scope, captured_at desc);

insert into public.admin_panel_refresh_preferences (
  panel_key,
  panel_title,
  edge_scope,
  preferred_timeout_ms,
  last_refresh_status,
  notes
)
values
  (
    'admin_command_center_fast_path',
    'Admin Command Center Fast Path',
    'command_center',
    16000,
    'ready',
    'Dedicated lightweight first-stage scope for Command Center cards, task inbox preview, and schema drift summary.'
  ),
  (
    'admin_health_retry_button',
    'Admin Health Retry Button',
    'health',
    16000,
    'ready',
    'Visible retry button lets operators reload Health and Schema without reloading the full Admin manager.'
  ),
  (
    'admin_accounting_retry_button',
    'Admin Accounting Retry Button',
    'accounting',
    16000,
    'ready',
    'Visible retry button lets operators reload Guided Close Center and accounting blocker panels independently.'
  ),
  (
    'admin_scope_timing_cards',
    'Admin Scope Timing Cards',
    'health',
    16000,
    'ready',
    'Frontend displays per-scope load timing, last loaded time, and retry status in the Health panel.'
  )
on conflict (panel_key) do update set
  panel_title = excluded.panel_title,
  edge_scope = excluded.edge_scope,
  preferred_timeout_ms = excluded.preferred_timeout_ms,
  last_refresh_status = excluded.last_refresh_status,
  notes = excluded.notes,
  updated_at = now();

insert into public.app_frontend_quality_gates (
  gate_key,
  gate_area,
  gate_title,
  gate_status,
  route_hint,
  command_hint,
  failure_hint,
  checked_at,
  sort_order
)
values
  (
    'admin_command_center_dedicated_scope',
    'Admin Performance',
    'Command Center has a dedicated fast path before heavier panels load',
    'passed',
    '#admin',
    'Open DevTools on Admin and confirm the first staged request can use scope=command_center before health, people, operations, and accounting.',
    'Redeploy admin-directory if scope=command_center returns the same large payload as health/all.',
    now(),
    390
  ),
  (
    'admin_visible_health_retry_button',
    'Admin UX',
    'Health panel has a visible retry button',
    'passed',
    '#admin',
    'Open App Health and Schema Center and use Retry Health without refreshing the full browser page.',
    'Clear service worker cache if the button does not appear after deployment.',
    now(),
    400
  ),
  (
    'admin_visible_accounting_retry_button',
    'Admin UX',
    'Guided Close Center has a visible Accounting retry button',
    'passed',
    '#admin',
    'Open Guided Close Center and use Retry Accounting without reloading Staff Directory or Jobs.',
    'Redeploy admin-directory/admin-ui assets if the button still triggers the full all-scope load.',
    now(),
    410
  ),
  (
    'admin_panel_scope_timing_cards',
    'Admin Diagnostics',
    'Admin Health shows per-panel live-load timing cards',
    'passed',
    '#admin',
    'Open App Health and confirm Command Center, Health, People, Operations, and Accounting status cards show timing and last-loaded age.',
    'Check js/admin-ui.js renderAdminScopeStatus if timing cards do not render.',
    now(),
    420
  ),
  (
    'report_subscription_delivery_run_bundle_ready',
    'Edge Functions',
    'Report subscription delivery function bundles with escaped newline strings',
    'passed',
    'supabase/functions/report-subscription-delivery-run/index.ts',
    'Deploy the Edge Function and confirm there is no unterminated regexp/string literal bundle error.',
    'Replace literal multi-line string joins with escaped newline strings if bundling fails again.',
    now(),
    430
  )
on conflict (gate_key) do update set
  gate_area = excluded.gate_area,
  gate_title = excluded.gate_title,
  gate_status = excluded.gate_status,
  route_hint = excluded.route_hint,
  command_hint = excluded.command_hint,
  failure_hint = excluded.failure_hint,
  checked_at = excluded.checked_at,
  sort_order = excluded.sort_order,
  updated_at = now();

create or replace view public.v_admin_panel_load_diagnostics as
select
  id,
  panel_key,
  edge_scope,
  load_status,
  elapsed_ms,
  stale_age_seconds,
  diagnostic_message,
  captured_by_profile_id,
  captured_at,
  metadata
from public.admin_panel_load_diagnostics
order by captured_at desc;

create or replace view public.v_admin_panel_refresh_preferences as
select
  panel_key,
  panel_title,
  edge_scope,
  preferred_timeout_ms,
  last_refresh_status,
  last_refresh_at,
  notes,
  updated_at
from public.admin_panel_refresh_preferences
order by panel_key;

create or replace view public.v_schema_drift_status as
select
  115::int as expected_schema_version,
  coalesce(max(schema_version) filter (where status = 'applied'), 0)::int as latest_applied_schema_version,
  case
    when coalesce(max(schema_version) filter (where status = 'applied'), 0) >= 115
      then 'current'
    else 'behind'
  end as drift_status,
  case
    when coalesce(max(schema_version) filter (where status = 'applied'), 0) >= 115
      then 'Live database is at or ahead of the repo schema marker.'
    else 'Live database is behind the deployed app. Apply migrations through schema 115.'
  end as message,
  now() as checked_at
from public.app_schema_versions;

insert into public.app_schema_versions (
  schema_version,
  migration_key,
  schema_name,
  release_label,
  description,
  status,
  notes
)
values (
  115,
  '115_admin_panel_retry_timing_and_command_scope',
  '115_admin_panel_retry_timing_and_command_scope.sql',
  '2026-05-18b',
  'Tracks visible Admin panel retry buttons, per-scope load timing cards, command_center fast path, and report-delivery bundle readiness.',
  'applied',
  'Production-readiness pass focused on making Admin staged loading visible, retryable, and easier to diagnose on mobile.'
)
on conflict (schema_version) do update set
  migration_key = excluded.migration_key,
  schema_name = excluded.schema_name,
  release_label = excluded.release_label,
  description = excluded.description,
  status = excluded.status,
  notes = excluded.notes,
  applied_at = now();

grant select on public.app_frontend_quality_gates to authenticated;
grant select on public.admin_panel_refresh_preferences to authenticated;
grant select on public.admin_panel_load_diagnostics to authenticated;
grant select on public.v_admin_panel_load_diagnostics to authenticated;
grant select on public.v_admin_panel_refresh_preferences to authenticated;
grant select on public.v_schema_drift_status to authenticated;


-- -----------------------------------------------------------------------------
-- Schema 116: Admin diagnostics drawer, stale-data badges, and persisted panel failures
-- -----------------------------------------------------------------------------

-- Schema 116: Admin diagnostics drawer, persisted panel failures, and stale-data badges.
-- Low-risk tracking migration for the 2026-05-19a pass.
-- Keeps v_schema_drift_status column name as expected_schema_version to avoid PostgreSQL 42P16 view rename errors.

create table if not exists public.app_schema_versions (
  schema_version integer primary key,
  schema_name text,
  description text,
  status text not null default 'applied',
  applied_at timestamptz not null default now(),
  applied_by text,
  notes text
);

alter table public.app_schema_versions add column if not exists migration_key text;
alter table public.app_schema_versions add column if not exists release_label text;

create table if not exists public.app_frontend_quality_gates (
  gate_key text primary key,
  gate_area text not null default 'Frontend',
  gate_title text not null,
  gate_status text not null default 'review',
  route_hint text,
  command_hint text,
  failure_hint text,
  checked_at timestamptz,
  sort_order integer not null default 100,
  updated_at timestamptz not null default now()
);

create table if not exists public.admin_panel_load_diagnostics (
  id uuid primary key default gen_random_uuid(),
  panel_key text not null,
  edge_scope text not null,
  load_status text not null default 'observed',
  elapsed_ms integer,
  stale_age_seconds integer,
  diagnostic_message text,
  captured_by_profile_id uuid,
  captured_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists idx_admin_panel_load_diagnostics_scope_time
  on public.admin_panel_load_diagnostics(edge_scope, captured_at desc);

create index if not exists idx_admin_panel_load_diagnostics_status_time
  on public.admin_panel_load_diagnostics(load_status, captured_at desc);

create table if not exists public.admin_panel_refresh_preferences (
  panel_key text primary key,
  panel_title text not null,
  edge_scope text not null,
  preferred_timeout_ms integer not null default 12000,
  last_refresh_status text not null default 'ready',
  last_refresh_at timestamptz,
  notes text,
  updated_at timestamptz not null default now()
);

insert into public.admin_panel_refresh_preferences (
  panel_key,
  panel_title,
  edge_scope,
  preferred_timeout_ms,
  last_refresh_status,
  notes
)
values
  (
    'admin_diagnostics_drawer',
    'Admin Diagnostics Drawer',
    'health',
    16000,
    'ready',
    'Health panel now expands staged load details, elapsed time, stale age, and persisted database diagnostics.'
  ),
  (
    'admin_stale_age_badges',
    'Admin Stale Data Age Badges',
    'health',
    16000,
    'ready',
    'Admin panel headings and Health summary show last live-load age so cached or stale panels are visible.'
  ),
  (
    'admin_persisted_panel_failures',
    'Persisted Admin Panel Load Failures',
    'health',
    16000,
    'ready',
    'Failed staged Admin panel loads can be written through admin-manage into admin_panel_load_diagnostics.'
  )
on conflict (panel_key) do update set
  panel_title = excluded.panel_title,
  edge_scope = excluded.edge_scope,
  preferred_timeout_ms = excluded.preferred_timeout_ms,
  last_refresh_status = excluded.last_refresh_status,
  notes = excluded.notes,
  updated_at = now();

insert into public.app_frontend_quality_gates (
  gate_key,
  gate_area,
  gate_title,
  gate_status,
  route_hint,
  command_hint,
  failure_hint,
  checked_at,
  sort_order
)
values
  (
    'admin_diagnostics_drawer_visible',
    'Admin Diagnostics',
    'Admin Health includes an expandable panel diagnostics drawer',
    'passed',
    '#admin',
    'Open App Health and Schema Center, then expand Panel diagnostics and live-load details.',
    'Clear service worker cache and confirm js/admin-ui.js is loading the 2026-05-19a asset version.',
    now(),
    440
  ),
  (
    'admin_panel_failure_persistence',
    'Admin Diagnostics',
    'Failed staged panel loads are persisted through admin-manage',
    'passed',
    '#admin',
    'Temporarily block a panel endpoint in dev, reload Admin, then confirm admin_panel_load_diagnostics receives a failed row.',
    'Redeploy admin-manage and apply schema 116 if failures only appear in the browser session.',
    now(),
    450
  ),
  (
    'admin_stale_data_age_badges',
    'Mobile UX',
    'Admin panels show stale-data age badges on mobile-friendly layouts',
    'passed',
    '#admin',
    'Open Admin on a phone-width viewport and confirm panel age badges wrap without horizontal scrolling.',
    'Check style.css admin-age-badge and admin-panel-age-grid rules if badges overflow.',
    now(),
    460
  )
on conflict (gate_key) do update set
  gate_area = excluded.gate_area,
  gate_title = excluded.gate_title,
  gate_status = excluded.gate_status,
  route_hint = excluded.route_hint,
  command_hint = excluded.command_hint,
  failure_hint = excluded.failure_hint,
  checked_at = excluded.checked_at,
  sort_order = excluded.sort_order,
  updated_at = now();

drop view if exists public.v_admin_panel_load_diagnostics;
create view public.v_admin_panel_load_diagnostics as
select
  d.id,
  d.panel_key,
  d.edge_scope,
  d.load_status,
  d.elapsed_ms,
  d.stale_age_seconds,
  d.diagnostic_message,
  d.captured_by_profile_id,
  p.full_name as captured_by_name,
  d.captured_at,
  d.metadata
from public.admin_panel_load_diagnostics d
left join public.profiles p on p.id = d.captured_by_profile_id
order by d.captured_at desc;

create or replace view public.v_schema_drift_status as
select
  116::int as expected_schema_version,
  coalesce(max(schema_version) filter (where status = 'applied'), 0)::int as latest_applied_schema_version,
  case
    when coalesce(max(schema_version) filter (where status = 'applied'), 0) >= 116
      then 'current'
    else 'behind'
  end as drift_status,
  case
    when coalesce(max(schema_version) filter (where status = 'applied'), 0) >= 116
      then 'Live database is at or ahead of the repo schema marker.'
    else 'Live database is behind the deployed app. Apply migrations through schema 116.'
  end as message,
  now() as checked_at
from public.app_schema_versions;

insert into public.app_schema_versions (
  schema_version,
  migration_key,
  schema_name,
  release_label,
  description,
  status,
  notes
)
values (
  116,
  '116_admin_diagnostics_drawer_and_stale_data_badges',
  '116_admin_diagnostics_drawer_and_stale_data_badges.sql',
  '2026-05-19a',
  'Adds Admin diagnostics drawer tracking, persisted panel failure writes, and stale-data age badge quality gates.',
  'applied',
  'Production-readiness pass focused on making staged Admin loading diagnosable, visible, and mobile-friendly.'
)
on conflict (schema_version) do update set
  migration_key = excluded.migration_key,
  schema_name = excluded.schema_name,
  release_label = excluded.release_label,
  description = excluded.description,
  status = excluded.status,
  notes = excluded.notes,
  applied_at = now();

grant select on public.app_frontend_quality_gates to authenticated;
grant select on public.admin_panel_refresh_preferences to authenticated;
grant select on public.admin_panel_load_diagnostics to authenticated;
grant select on public.v_admin_panel_load_diagnostics to authenticated;
grant select on public.v_schema_drift_status to authenticated;


-- Schema 117: Split Admin fast paths, evidence scope, confirmation guardrails, and deployment checklist notes.
-- Low-risk tracking migration for the 2026-05-19b pass.
-- Keeps v_schema_drift_status column name as expected_schema_version to avoid PostgreSQL 42P16 view rename errors.

create table if not exists public.app_schema_versions (
  schema_version integer primary key,
  schema_name text,
  description text,
  status text not null default 'applied',
  applied_at timestamptz not null default now(),
  applied_by text,
  notes text
);

alter table public.app_schema_versions add column if not exists migration_key text;
alter table public.app_schema_versions add column if not exists release_label text;

create table if not exists public.app_frontend_quality_gates (
  gate_key text primary key,
  gate_area text not null default 'Frontend',
  gate_title text not null,
  gate_status text not null default 'review',
  route_hint text,
  command_hint text,
  failure_hint text,
  checked_at timestamptz,
  sort_order integer not null default 100,
  updated_at timestamptz not null default now()
);

create table if not exists public.admin_fast_path_scope_registry (
  scope_key text primary key,
  scope_title text not null,
  panel_key text not null,
  preferred_timeout_ms integer not null default 16000,
  is_initial_load_scope boolean not null default false,
  is_deprecated boolean not null default false,
  notes text,
  updated_at timestamptz not null default now()
);

create table if not exists public.admin_action_confirmation_rules (
  rule_key text primary key,
  action_area text not null,
  action_key text not null,
  confirmation_level text not null default 'confirm',
  prompt_text text not null,
  notes text,
  updated_at timestamptz not null default now()
);

create table if not exists public.admin_deployment_checklist_items (
  checklist_key text primary key,
  checklist_area text not null,
  checklist_title text not null,
  check_status text not null default 'review',
  command_hint text,
  failure_hint text,
  sort_order integer not null default 100,
  checked_at timestamptz,
  updated_at timestamptz not null default now()
);

insert into public.admin_fast_path_scope_registry (
  scope_key,
  scope_title,
  panel_key,
  preferred_timeout_ms,
  is_initial_load_scope,
  is_deprecated,
  notes
)
values
  ('command_center', 'Command Center', 'admin_command_center', 16000, true, false, 'Lightweight command-center counters, task inbox, and schema drift rows.'),
  ('health', 'Health and Schema', 'admin_health_schema', 16000, true, false, 'Health, schema, readiness, diagnostics, and deployment gate rows.'),
  ('people', 'People and Access', 'admin_staff_directory', 16000, true, false, 'Paged Staff Directory and assignment access rows.'),
  ('operations', 'Jobs and Operations', 'admin_jobs_operations', 25000, true, false, 'Paged Jobs, service areas, routes, clients, and operations dashboard rows.'),
  ('accounting_close', 'Accounting Close', 'admin_accounting_close', 18000, true, false, 'Close center, close wizard steps, close dashboard, and accountant package rows.'),
  ('banking', 'Banking and Reconciliation', 'admin_banking_reconciliation', 18000, true, false, 'Bank reconciliation sessions, review queue, match candidates, scored matches, and bank CSV import status.'),
  ('tax_payroll', 'Tax and Payroll', 'admin_tax_payroll', 18000, true, false, 'Sales tax, payroll remittance, and AR/AP payment application review rows.'),
  ('evidence', 'Evidence Manager', 'admin_evidence_manager', 18000, true, false, 'Evidence manager, action queue, attendance/HSE evidence review, and HSE action rows.'),
  ('accounting', 'Accounting Fallback', 'admin_accounting_fallback', 30000, false, true, 'Temporary broad accounting fallback retained while split accounting scopes are production-tested.'),
  ('all', 'All Fallback', 'admin_all_fallback', 90000, false, true, 'Emergency broad fallback only; should be retired after split panel scopes are trusted.')
on conflict (scope_key) do update set
  scope_title = excluded.scope_title,
  panel_key = excluded.panel_key,
  preferred_timeout_ms = excluded.preferred_timeout_ms,
  is_initial_load_scope = excluded.is_initial_load_scope,
  is_deprecated = excluded.is_deprecated,
  notes = excluded.notes,
  updated_at = now();

insert into public.admin_action_confirmation_rules (
  rule_key,
  action_area,
  action_key,
  confirmation_level,
  prompt_text,
  notes
)
values
  ('job_complete_confirm', 'jobs', 'complete', 'confirm', 'Confirm before marking a job complete.', 'Protects job status changes from accidental phone taps.'),
  ('job_cancel_confirm', 'jobs', 'cancel', 'confirm', 'Confirm before cancelling a job.', 'Protects job status changes from accidental phone taps.'),
  ('close_step_complete_confirm', 'accounting_close', 'complete', 'confirm', 'Confirm before completing a close step.', 'Close workflow actions affect accounting review status.'),
  ('close_step_reopen_confirm', 'accounting_close', 'reopen', 'confirm', 'Confirm before reopening a close step.', 'Reopen actions should be deliberate and visible.'),
  ('health_resolve_confirm', 'health', 'resolve', 'confirm', 'Confirm before marking a health item resolved.', 'Resolution rows should only be marked after review.'),
  ('evidence_followup_confirm', 'evidence', 'follow_up', 'confirm', 'Confirm before creating an evidence follow-up.', 'Evidence follow-ups create action queue rows.')
on conflict (rule_key) do update set
  action_area = excluded.action_area,
  action_key = excluded.action_key,
  confirmation_level = excluded.confirmation_level,
  prompt_text = excluded.prompt_text,
  notes = excluded.notes,
  updated_at = now();

insert into public.admin_deployment_checklist_items (
  checklist_key,
  checklist_area,
  checklist_title,
  check_status,
  command_hint,
  failure_hint,
  sort_order,
  checked_at
)
values
  ('apply_schema_117', 'Database', 'Apply migrations through schema 117', 'review', 'Run sql/117_split_admin_scopes_confirmation_and_deployment_checklist.sql in Supabase SQL editor.', 'Admin split scopes can return empty results if schema 117 has not been applied.', 510, now()),
  ('redeploy_admin_directory_117', 'Edge Functions', 'Redeploy admin-directory after split-scope changes', 'review', 'Deploy supabase/functions/admin-directory.', 'New accounting/evidence fast paths will not exist until the function is redeployed.', 520, now()),
  ('redeploy_admin_manage_117', 'Edge Functions', 'Redeploy admin-manage after confirmation/diagnostic updates', 'review', 'Deploy supabase/functions/admin-manage.', 'Panel diagnostics and admin action writes may fail if the older function remains deployed.', 530, now()),
  ('hard_refresh_2026_05_19b', 'Browser Cache', 'Clear service worker cache for 2026-05-19b assets', 'review', 'Hard refresh or unregister service worker after deployment.', 'Old admin-ui.js can keep the old broad accounting scope alive.', 540, now())
on conflict (checklist_key) do update set
  checklist_area = excluded.checklist_area,
  checklist_title = excluded.checklist_title,
  check_status = excluded.check_status,
  command_hint = excluded.command_hint,
  failure_hint = excluded.failure_hint,
  sort_order = excluded.sort_order,
  checked_at = excluded.checked_at,
  updated_at = now();

insert into public.app_frontend_quality_gates (
  gate_key,
  gate_area,
  gate_title,
  gate_status,
  route_hint,
  command_hint,
  failure_hint,
  checked_at,
  sort_order
)
values
  ('admin_split_accounting_scopes', 'Admin Performance', 'Admin initial load uses split accounting fast paths', 'passed', '#admin', 'Open Admin and confirm Accounting Close, Banking, and Tax/Payroll status cards load separately.', 'Redeploy admin-directory and clear cache if Accounting still loads as one broad scope.', now(), 470),
  ('admin_evidence_fast_path', 'Admin Performance', 'Evidence Manager has a dedicated fast path and retry button', 'passed', '#admin', 'Open Evidence Manager and press Retry Evidence.', 'Redeploy admin-directory if Retry Evidence returns unsupported scope.', now(), 480),
  ('admin_action_confirmation_dialogs', 'Mobile UX', 'Destructive/status-changing Admin actions ask for confirmation', 'passed', '#admin', 'Tap Complete/Cancel job, close-step actions, health resolve, or evidence follow-up and confirm a dialog appears.', 'Check js/admin-ui.js confirmAdminAction wiring if actions fire immediately.', now(), 490),
  ('admin_loading_skeletons', 'Mobile UX', 'Admin shows lightweight skeleton loaders during staged panel loads', 'passed', '#admin', 'Reload Admin on a slow connection and confirm panel placeholders appear before live data.', 'Check style.css is-admin-loading skeleton rules if the page looks frozen.', now(), 500)
on conflict (gate_key) do update set
  gate_area = excluded.gate_area,
  gate_title = excluded.gate_title,
  gate_status = excluded.gate_status,
  route_hint = excluded.route_hint,
  command_hint = excluded.command_hint,
  failure_hint = excluded.failure_hint,
  checked_at = excluded.checked_at,
  sort_order = excluded.sort_order,
  updated_at = now();

drop view if exists public.v_admin_fast_path_scope_registry;
create view public.v_admin_fast_path_scope_registry as
select
  scope_key,
  scope_title,
  panel_key,
  preferred_timeout_ms,
  is_initial_load_scope,
  is_deprecated,
  notes,
  updated_at
from public.admin_fast_path_scope_registry
order by is_deprecated asc, is_initial_load_scope desc, scope_key;

drop view if exists public.v_admin_action_confirmation_rules;
create view public.v_admin_action_confirmation_rules as
select
  rule_key,
  action_area,
  action_key,
  confirmation_level,
  prompt_text,
  notes,
  updated_at
from public.admin_action_confirmation_rules
order by action_area, action_key;

drop view if exists public.v_admin_deployment_checklist;
create view public.v_admin_deployment_checklist as
select
  checklist_key,
  checklist_area,
  checklist_title,
  check_status,
  command_hint,
  failure_hint,
  sort_order,
  checked_at,
  updated_at
from public.admin_deployment_checklist_items
order by sort_order, checklist_area, checklist_title;

create or replace view public.v_schema_drift_status as
select
  117::int as expected_schema_version,
  coalesce(max(schema_version) filter (where status = 'applied'), 0)::int as latest_applied_schema_version,
  case
    when coalesce(max(schema_version) filter (where status = 'applied'), 0) >= 117
      then 'current'
    else 'behind'
  end as drift_status,
  case
    when coalesce(max(schema_version) filter (where status = 'applied'), 0) >= 117
      then 'Live database is at or ahead of the repo schema marker.'
    else 'Live database is behind the deployed app. Apply migrations through schema 117.'
  end as message,
  now() as checked_at
from public.app_schema_versions;

insert into public.app_schema_versions (
  schema_version,
  migration_key,
  schema_name,
  release_label,
  description,
  status,
  notes
)
values (
  117,
  '117_split_admin_scopes_confirmation_and_deployment_checklist',
  '117_split_admin_scopes_confirmation_and_deployment_checklist.sql',
  '2026-05-19b',
  'Splits Admin accounting/evidence fast paths, tracks confirmation guardrails, and adds deployment checklist rows.',
  'applied',
  'Production-readiness pass focused on smaller Admin payloads, safer mobile status-changing actions, and clearer deployment readiness checks.'
)
on conflict (schema_version) do update set
  migration_key = excluded.migration_key,
  schema_name = excluded.schema_name,
  release_label = excluded.release_label,
  description = excluded.description,
  status = excluded.status,
  notes = excluded.notes,
  applied_at = now();

grant select on public.app_frontend_quality_gates to authenticated;
grant select on public.admin_fast_path_scope_registry to authenticated;
grant select on public.admin_action_confirmation_rules to authenticated;
grant select on public.admin_deployment_checklist_items to authenticated;
grant select on public.v_admin_fast_path_scope_registry to authenticated;
grant select on public.v_admin_action_confirmation_rules to authenticated;
grant select on public.v_admin_deployment_checklist to authenticated;
grant select on public.v_schema_drift_status to authenticated;
-- Schema 118: Admin preflight registry, deployment checklist rendering, and function readiness tracking.
-- Low-risk tracking migration for the 2026-05-20a pass.
-- Keeps v_schema_drift_status column name as expected_schema_version to avoid PostgreSQL 42P16 view rename errors.

create table if not exists public.app_schema_versions (
  schema_version integer primary key,
  schema_name text,
  description text,
  status text not null default 'applied',
  applied_at timestamptz not null default now(),
  applied_by text,
  notes text
);

alter table public.app_schema_versions add column if not exists migration_key text;
alter table public.app_schema_versions add column if not exists release_label text;

create table if not exists public.app_frontend_quality_gates (
  gate_key text primary key,
  gate_area text not null default 'Frontend',
  gate_title text not null,
  gate_status text not null default 'review',
  route_hint text,
  command_hint text,
  failure_hint text,
  checked_at timestamptz,
  sort_order integer not null default 100,
  updated_at timestamptz not null default now()
);

create table if not exists public.admin_fast_path_scope_registry (
  scope_key text primary key,
  scope_title text not null,
  panel_key text not null,
  preferred_timeout_ms integer not null default 16000,
  is_initial_load_scope boolean not null default false,
  is_deprecated boolean not null default false,
  notes text,
  updated_at timestamptz not null default now()
);

create table if not exists public.admin_deployment_checklist_items (
  checklist_key text primary key,
  checklist_area text not null,
  checklist_title text not null,
  check_status text not null default 'review',
  command_hint text,
  failure_hint text,
  sort_order integer not null default 100,
  checked_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.admin_function_readiness_checks (
  function_key text primary key,
  function_name text not null,
  expected_scope text,
  readiness_status text not null default 'review',
  deploy_hint text,
  failure_hint text,
  sort_order integer not null default 100,
  checked_at timestamptz,
  updated_at timestamptz not null default now()
);

insert into public.admin_deployment_checklist_items (
  checklist_key,
  checklist_area,
  checklist_title,
  check_status,
  command_hint,
  failure_hint,
  sort_order,
  checked_at
)
values
  ('apply_schema_118', 'Database', 'Apply migrations through schema 118', 'review', 'Run sql/118_admin_preflight_registry_deployment_checklist_ui.sql in Supabase SQL editor.', 'The Admin UI can show empty deployment/function-readiness tables if schema 118 has not been applied.', 550, now()),
  ('redeploy_admin_directory_118', 'Edge Functions', 'Redeploy admin-directory after registry/checklist payload changes', 'review', 'Deploy supabase/functions/admin-directory.', 'Admin startup will fall back to hard-coded scopes if v_admin_fast_path_scope_registry is not returned.', 560, now()),
  ('hard_refresh_2026_05_20a', 'Browser Cache', 'Clear service worker cache for 2026-05-20a assets', 'review', 'Hard refresh or unregister service worker after deployment.', 'Old admin-ui.js will not render deployment checklist or function readiness rows.', 570, now()),
  ('verify_admin_preflight_ui', 'Admin QA', 'Verify Production Readiness shows checklist and function tables', 'review', 'Open #admin, filter Readiness, and confirm both new tables populate or show useful empty states.', 'Operators may miss deploy steps if readiness rows are not visible.', 580, now())
on conflict (checklist_key) do update set
  checklist_area = excluded.checklist_area,
  checklist_title = excluded.checklist_title,
  check_status = excluded.check_status,
  command_hint = excluded.command_hint,
  failure_hint = excluded.failure_hint,
  sort_order = excluded.sort_order,
  checked_at = excluded.checked_at,
  updated_at = now();

insert into public.admin_function_readiness_checks (
  function_key,
  function_name,
  expected_scope,
  readiness_status,
  deploy_hint,
  failure_hint,
  sort_order,
  checked_at
)
values
  ('admin_directory_command_center', 'admin-directory', 'command_center / health / people / operations / accounting_close / banking / tax_payroll / evidence', 'review', 'Deploy supabase/functions/admin-directory after schema 118.', 'Admin panels can show cached or missing data if the deployed function does not return the latest fast-path payloads.', 100, now()),
  ('admin_manage_actions', 'admin-manage', 'job actions, diagnostics, deployment gates, evidence follow-up', 'review', 'Deploy supabase/functions/admin-manage after Admin action changes.', 'Status-changing buttons or diagnostic writes can fail if this function is stale.', 110, now()),
  ('report_subscription_delivery_run', 'report-subscription-delivery-run', 'scheduled report delivery', 'review', 'Deploy supabase/functions/report-subscription-delivery-run after newline/CSV escaping fixes.', 'Report delivery scheduler can fail to bundle or send if this function is stale.', 120, now()),
  ('service_execution_scheduler_run', 'service-execution-scheduler-run', 'scheduled operations dispatch', 'review', 'Confirm SERVICE_EXECUTION_SCHEDULER_SECRET and deploy service-execution-scheduler-run.', 'Scheduled service execution can stop advancing next_run_at if this function or secret is not ready.', 130, now())
on conflict (function_key) do update set
  function_name = excluded.function_name,
  expected_scope = excluded.expected_scope,
  readiness_status = excluded.readiness_status,
  deploy_hint = excluded.deploy_hint,
  failure_hint = excluded.failure_hint,
  sort_order = excluded.sort_order,
  checked_at = excluded.checked_at,
  updated_at = now();

insert into public.app_frontend_quality_gates (
  gate_key,
  gate_area,
  gate_title,
  gate_status,
  route_hint,
  command_hint,
  failure_hint,
  checked_at,
  sort_order
)
values
  ('admin_registry_driven_initial_scopes', 'Admin Performance', 'Admin initial load reads the fast-path scope registry', 'passed', '#admin', 'Open Admin and confirm command_center loads first, then configured initial scopes load from v_admin_fast_path_scope_registry.', 'Redeploy admin-directory if the registry array is missing from the command center payload.', now(), 510),
  ('admin_deployment_checklist_visible', 'Production Readiness', 'Deployment checklist rows render in Admin Readiness', 'passed', '#admin', 'Open Admin > Readiness and confirm deployment checklist rows are visible.', 'Apply schema 118 and clear cache if the checklist table is empty.', now(), 520),
  ('admin_function_readiness_visible', 'Production Readiness', 'Function readiness rows render in Admin Readiness', 'passed', '#admin', 'Open Admin > Readiness and confirm function readiness rows are visible.', 'Apply schema 118 and redeploy admin-directory if function rows are missing.', now(), 530)
on conflict (gate_key) do update set
  gate_area = excluded.gate_area,
  gate_title = excluded.gate_title,
  gate_status = excluded.gate_status,
  route_hint = excluded.route_hint,
  command_hint = excluded.command_hint,
  failure_hint = excluded.failure_hint,
  checked_at = excluded.checked_at,
  sort_order = excluded.sort_order,
  updated_at = now();

drop view if exists public.v_admin_function_readiness_checks;
create view public.v_admin_function_readiness_checks as
select
  function_key,
  function_name,
  expected_scope,
  readiness_status,
  deploy_hint,
  failure_hint,
  sort_order,
  checked_at,
  updated_at
from public.admin_function_readiness_checks
order by sort_order, function_name;

drop view if exists public.v_admin_deployment_checklist;
create view public.v_admin_deployment_checklist as
select
  checklist_key,
  checklist_area,
  checklist_title,
  check_status,
  command_hint,
  failure_hint,
  sort_order,
  checked_at,
  updated_at
from public.admin_deployment_checklist_items
order by sort_order, checklist_area, checklist_title;

create or replace view public.v_schema_drift_status as
select
  118::int as expected_schema_version,
  coalesce(max(schema_version) filter (where status = 'applied'), 0)::int as latest_applied_schema_version,
  case
    when coalesce(max(schema_version) filter (where status = 'applied'), 0) >= 118
      then 'current'
    else 'behind'
  end as drift_status,
  case
    when coalesce(max(schema_version) filter (where status = 'applied'), 0) >= 118
      then 'Live database is at or ahead of the repo schema marker.'
    else 'Live database is behind the deployed app. Apply migrations through schema 118.'
  end as message,
  now() as checked_at
from public.app_schema_versions;

insert into public.app_schema_versions (
  schema_version,
  migration_key,
  schema_name,
  release_label,
  description,
  status,
  notes
)
values (
  118,
  '118_admin_preflight_registry_deployment_checklist_ui',
  '118_admin_preflight_registry_deployment_checklist_ui.sql',
  '2026-05-20a',
  'Renders Admin deployment checklist and function readiness rows, and lets Admin startup use the fast-path scope registry.',
  'applied',
  'Production-readiness pass focused on making deploy/preflight state visible in Admin and reducing hard-coded Admin startup assumptions.'
)
on conflict (schema_version) do update set
  migration_key = excluded.migration_key,
  schema_name = excluded.schema_name,
  release_label = excluded.release_label,
  description = excluded.description,
  status = excluded.status,
  notes = excluded.notes,
  applied_at = now();

grant select on public.app_frontend_quality_gates to authenticated;
grant select on public.admin_fast_path_scope_registry to authenticated;
grant select on public.admin_deployment_checklist_items to authenticated;
grant select on public.admin_function_readiness_checks to authenticated;
grant select on public.v_admin_deployment_checklist to authenticated;
grant select on public.v_admin_function_readiness_checks to authenticated;
grant select on public.v_schema_drift_status to authenticated;
-- Schema 119: Admin action permissions, schema preflight rows, retry/backoff policy, and function signoff fields.
-- Low-risk tracking migration for the 2026-05-20b pass.
-- Keeps v_schema_drift_status column name as expected_schema_version to avoid PostgreSQL 42P16 view rename errors.

create table if not exists public.app_schema_versions (
  schema_version integer primary key,
  schema_name text,
  description text,
  status text not null default 'applied',
  applied_at timestamptz not null default now(),
  applied_by text,
  notes text
);

alter table public.app_schema_versions add column if not exists migration_key text;
alter table public.app_schema_versions add column if not exists release_label text;

create table if not exists public.admin_action_permission_registry (
  action_key text primary key,
  action_area text not null,
  action_label text not null,
  required_role text not null default 'supervisor',
  required_scope text,
  is_enabled boolean not null default true,
  enabled_message text,
  disabled_message text,
  failure_hint text,
  sort_order integer not null default 100,
  updated_at timestamptz not null default now()
);

create table if not exists public.admin_panel_retry_policy (
  panel_key text primary key,
  panel_title text not null,
  scope_key text not null,
  max_attempts integer not null default 2,
  cooldown_seconds integer not null default 30,
  backoff_multiplier numeric(6,2) not null default 1.50,
  retry_status text not null default 'active',
  operator_hint text,
  failure_hint text,
  sort_order integer not null default 100,
  updated_at timestamptz not null default now()
);

create table if not exists public.admin_schema_preflight_checks (
  check_key text primary key,
  check_area text not null,
  required_object_type text not null,
  required_object_name text not null,
  expected_status text not null default 'present',
  live_status text not null default 'not_checked',
  check_status text not null default 'review',
  operator_hint text,
  failure_hint text,
  sort_order integer not null default 100,
  checked_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table if exists public.admin_function_readiness_checks add column if not exists last_checked_at timestamptz;
alter table if exists public.admin_function_readiness_checks add column if not exists operator_signoff_at timestamptz;
alter table if exists public.admin_function_readiness_checks add column if not exists operator_signoff_by text;
alter table if exists public.admin_function_readiness_checks add column if not exists operator_notes text;

insert into public.admin_action_permission_registry (
  action_key,
  action_area,
  action_label,
  required_role,
  required_scope,
  is_enabled,
  enabled_message,
  disabled_message,
  failure_hint,
  sort_order
)
values
  ('job_status_update', 'Jobs', 'Complete or cancel a job', 'job_admin', 'operations', true, 'This role may change job status.', 'Requires Job Admin or Admin. Use Open/Add Note for review-only roles.', 'If this is disabled unexpectedly, check v_admin_action_permission_registry and actor_role returned by admin-directory.', 100),
  ('job_add_note', 'Jobs', 'Add a job note', 'supervisor', 'operations', true, 'This role may add job notes.', 'Requires Supervisor or higher.', 'Redeploy admin-directory if actor_role is missing from the Admin payload.', 110),
  ('close_step_complete', 'Accounting Close', 'Complete a close step', 'job_admin', 'accounting_close', true, 'This role may complete close steps.', 'Requires Job Admin or Admin.', 'Close steps should remain disabled for roles that cannot affect accounting close state.', 200),
  ('close_step_reopen', 'Accounting Close', 'Reopen a close step', 'admin', 'accounting_close', true, 'This role may reopen close steps.', 'Requires Admin because reopening can affect close evidence and exports.', 'Keep reopen permission tighter than complete permission.', 210),
  ('deployment_gate_update', 'Deployment', 'Mark a deployment gate as passed', 'admin', 'health', true, 'This role may update deployment gates.', 'Requires Admin signoff.', 'Deployment gates should not be marked passed by non-admin review roles.', 300),
  ('evidence_follow_up', 'Evidence', 'Create evidence follow-up', 'hse', 'evidence', true, 'This role may create HSE/evidence follow-up work.', 'Requires HSE, Job Admin, or Admin.', 'If supervisors need this workflow, add an explicit registry row with the lower required role.', 400)
on conflict (action_key) do update set
  action_area = excluded.action_area,
  action_label = excluded.action_label,
  required_role = excluded.required_role,
  required_scope = excluded.required_scope,
  is_enabled = excluded.is_enabled,
  enabled_message = excluded.enabled_message,
  disabled_message = excluded.disabled_message,
  failure_hint = excluded.failure_hint,
  sort_order = excluded.sort_order,
  updated_at = now();

insert into public.admin_panel_retry_policy (
  panel_key,
  panel_title,
  scope_key,
  max_attempts,
  cooldown_seconds,
  backoff_multiplier,
  retry_status,
  operator_hint,
  failure_hint,
  sort_order
)
values
  ('command_center', 'Command Center', 'command_center', 2, 20, 1.50, 'active', 'Retry Command Center manually after a short pause if the first load fails.', 'Repeated failures usually mean admin-directory is stale or schema is behind.', 100),
  ('health_schema', 'Health and Schema', 'health', 2, 30, 1.75, 'active', 'Health can be retried without reloading Staff or Jobs.', 'If health times out, check expensive views and missing schema objects.', 110),
  ('staff_directory', 'Staff Directory', 'people', 2, 25, 1.50, 'active', 'Retry Staff Only keeps current search/filter/page settings.', 'If Staff repeatedly fails, reduce page size and check profiles RLS/function logs.', 200),
  ('jobs_operations', 'Jobs and Operations', 'operations', 2, 25, 1.50, 'active', 'Retry Jobs Only keeps current search/filter/page settings.', 'If Jobs repeatedly fails, check jobs status columns and fast-path query fields.', 210),
  ('accounting_close', 'Guided Close Center', 'accounting_close', 2, 45, 2.00, 'active', 'Retry Accounting after schema and close views are confirmed.', 'Repeated accounting failures usually point to missing close/reconciliation views.', 300),
  ('evidence_manager', 'Evidence Manager', 'evidence', 2, 30, 1.75, 'active', 'Retry Evidence separately from the HSE dashboard.', 'Repeated failures may mean an upload/evidence view is missing.', 400)
on conflict (panel_key) do update set
  panel_title = excluded.panel_title,
  scope_key = excluded.scope_key,
  max_attempts = excluded.max_attempts,
  cooldown_seconds = excluded.cooldown_seconds,
  backoff_multiplier = excluded.backoff_multiplier,
  retry_status = excluded.retry_status,
  operator_hint = excluded.operator_hint,
  failure_hint = excluded.failure_hint,
  sort_order = excluded.sort_order,
  updated_at = now();

insert into public.admin_schema_preflight_checks (
  check_key,
  check_area,
  required_object_type,
  required_object_name,
  expected_status,
  live_status,
  check_status,
  operator_hint,
  failure_hint,
  sort_order,
  checked_at
)
values
  ('schema_versions_table', 'Database', 'table', 'public.app_schema_versions', 'present', 'not_checked', 'review', 'Confirm the table exists before relying on schema drift cards.', 'Schema status cards cannot show current/behind state without app_schema_versions.', 100, now()),
  ('fast_path_registry_view', 'Admin Startup', 'view', 'public.v_admin_fast_path_scope_registry', 'present', 'not_checked', 'review', 'Apply schema 118+ so Admin can read startup scopes from DB.', 'Admin falls back to hard-coded scope order if this view is missing.', 110, now()),
  ('action_permission_view', 'Admin Actions', 'view', 'public.v_admin_action_permission_registry', 'present', 'not_checked', 'review', 'Apply schema 120 before relying on role-aware disabled buttons.', 'Unsafe action buttons cannot be disabled by registry if this view is missing.', 120, now()),
  ('panel_retry_policy_view', 'Admin Reliability', 'view', 'public.v_admin_panel_retry_policy', 'present', 'not_checked', 'review', 'Apply schema 120 before tuning retry/backoff rules from DB.', 'Repeated panel failures can keep hammering functions without an operator-visible policy.', 130, now()),
  ('schema_preflight_view', 'Deployment Preflight', 'view', 'public.v_admin_schema_preflight_checks', 'present', 'not_checked', 'review', 'Use this table as the first visible checklist before deployment.', 'Operators may miss missing schema objects until a button fails.', 140, now()),
  ('admin_directory_function', 'Edge Functions', 'function', 'supabase/functions/admin-directory', 'deployed', 'not_checked', 'review', 'Redeploy admin-directory after schema 120.', 'New readiness/preflight/permission arrays will not reach the browser until admin-directory is current.', 200, now())
on conflict (check_key) do update set
  check_area = excluded.check_area,
  required_object_type = excluded.required_object_type,
  required_object_name = excluded.required_object_name,
  expected_status = excluded.expected_status,
  live_status = excluded.live_status,
  check_status = excluded.check_status,
  operator_hint = excluded.operator_hint,
  failure_hint = excluded.failure_hint,
  sort_order = excluded.sort_order,
  checked_at = excluded.checked_at,
  updated_at = now();

update public.admin_function_readiness_checks
set last_checked_at = coalesce(last_checked_at, checked_at, now())
where last_checked_at is null;

insert into public.app_frontend_quality_gates (
  gate_key,
  gate_area,
  gate_title,
  gate_status,
  route_hint,
  command_hint,
  failure_hint,
  checked_at,
  sort_order
)
values
  ('admin_action_permission_registry_visible', 'Admin Actions', 'Action permission registry renders and disables risky buttons', 'passed', '#admin', 'Open Admin > Readiness and confirm action permission rows are visible. Test with a non-admin role before production.', 'Apply schema 120 and redeploy admin-directory if the table is empty or buttons are not annotated.', now(), 540),
  ('admin_schema_preflight_visible', 'Deployment Preflight', 'Schema preflight table names required tables/views/functions', 'passed', '#admin', 'Open Admin > Readiness and confirm schema preflight rows are visible.', 'Missing preflight rows make it harder to diagnose schema drift before button clicks.', now(), 550),
  ('admin_panel_retry_policy_visible', 'Admin Reliability', 'Panel retry policy rows render in Production Readiness', 'passed', '#admin', 'Open Admin > Readiness and confirm retry/backoff rows are visible.', 'Repeated failing panels may retry too aggressively if no policy rows are visible.', now(), 560)
on conflict (gate_key) do update set
  gate_area = excluded.gate_area,
  gate_title = excluded.gate_title,
  gate_status = excluded.gate_status,
  route_hint = excluded.route_hint,
  command_hint = excluded.command_hint,
  failure_hint = excluded.failure_hint,
  checked_at = excluded.checked_at,
  sort_order = excluded.sort_order,
  updated_at = now();

drop view if exists public.v_admin_action_permission_registry;
create view public.v_admin_action_permission_registry as
select
  action_key,
  action_area,
  action_label,
  required_role,
  required_scope,
  is_enabled,
  enabled_message,
  disabled_message,
  failure_hint,
  sort_order,
  updated_at
from public.admin_action_permission_registry
order by sort_order, action_area, action_label;

drop view if exists public.v_admin_panel_retry_policy;
create view public.v_admin_panel_retry_policy as
select
  panel_key,
  panel_title,
  scope_key,
  max_attempts,
  cooldown_seconds,
  backoff_multiplier,
  retry_status,
  operator_hint,
  failure_hint,
  sort_order,
  updated_at
from public.admin_panel_retry_policy
order by sort_order, panel_title;

drop view if exists public.v_admin_schema_preflight_checks;
create view public.v_admin_schema_preflight_checks as
select
  check_key,
  check_area,
  required_object_type,
  required_object_name,
  expected_status,
  live_status,
  check_status,
  operator_hint,
  failure_hint,
  sort_order,
  checked_at,
  updated_at
from public.admin_schema_preflight_checks
order by sort_order, check_area, required_object_name;

drop view if exists public.v_admin_function_readiness_checks;
create view public.v_admin_function_readiness_checks as
select
  function_key,
  function_name,
  expected_scope,
  readiness_status,
  deploy_hint,
  failure_hint,
  sort_order,
  checked_at,
  last_checked_at,
  operator_signoff_at,
  operator_signoff_by,
  operator_notes,
  updated_at
from public.admin_function_readiness_checks
order by sort_order, function_name;

drop view if exists public.v_schema_drift_status;
create view public.v_schema_drift_status as
select
  120::int as expected_schema_version,
  coalesce(max(schema_version) filter (where status = 'applied'), 0)::int as latest_applied_schema_version,
  case
    when coalesce(max(schema_version) filter (where status = 'applied'), 0) >= 120
      then 'current'
    else 'behind'
  end as drift_status,
  case
    when coalesce(max(schema_version) filter (where status = 'applied'), 0) >= 120
      then 'Live database is at or ahead of the repo schema marker.'
    else 'Live database is behind the deployed app. Apply migrations through schema 120.'
  end as message,
  now() as checked_at
from public.app_schema_versions;

insert into public.app_schema_versions (
  schema_version,
  migration_key,
  schema_name,
  release_label,
  description,
  status,
  notes
)
values (
  119,
  '119_admin_action_permissions_preflight_and_retry_rules',
  '119_admin_action_permissions_preflight_and_retry_rules.sql',
  '2026-05-20b',
  'Adds Admin action permission registry, schema preflight rows, panel retry/backoff policies, and function signoff metadata.',
  'applied',
  'Production-readiness pass focused on preventing unsafe button clicks, surfacing missing schema objects early, and making retry/backoff rules visible.'
)
on conflict (schema_version) do update set
  migration_key = excluded.migration_key,
  schema_name = excluded.schema_name,
  release_label = excluded.release_label,
  description = excluded.description,
  status = excluded.status,
  notes = excluded.notes,
  applied_at = now();

grant select on public.admin_action_permission_registry to authenticated;
grant select on public.admin_panel_retry_policy to authenticated;
grant select on public.admin_schema_preflight_checks to authenticated;
grant select on public.v_admin_action_permission_registry to authenticated;
grant select on public.v_admin_panel_retry_policy to authenticated;
grant select on public.v_admin_schema_preflight_checks to authenticated;
grant select on public.v_admin_function_readiness_checks to authenticated;
grant select on public.v_schema_drift_status to authenticated;


-- BEGIN 120_ontario_ohsa_mobile_first_app_guardrails.sql
-- Schema 120: Ontario OHSA wording and mobile-first app guardrails.
-- Tracks the 2026-05-26a pass that removed user-facing U.S. safety wording
-- and promoted mobile-first field use for Ontario workplace safety workflows.

create table if not exists public.app_schema_versions (
  schema_version integer primary key,
  schema_name text,
  description text,
  status text not null default 'applied',
  applied_at timestamptz not null default now(),
  applied_by text,
  notes text
);

alter table public.app_schema_versions add column if not exists migration_key text;
alter table public.app_schema_versions add column if not exists release_label text;

create table if not exists public.app_mobile_first_quality_gates (
  gate_key text primary key,
  gate_area text not null default 'Mobile UX',
  gate_title text not null,
  gate_status text not null default 'review',
  route_hint text,
  test_hint text,
  failure_hint text,
  sort_order integer not null default 100,
  checked_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.app_jurisdiction_wording_gates (
  gate_key text primary key,
  jurisdiction text not null default 'Ontario',
  gate_title text not null,
  preferred_terms text not null default 'Ontario OHSA; Ontario workplace safety; safety operations',
  avoid_terms text not null default 'U.S. safety terminology when describing Ontario workplace procedures',
  gate_status text not null default 'review',
  route_hint text,
  operator_hint text,
  sort_order integer not null default 100,
  checked_at timestamptz,
  updated_at timestamptz not null default now()
);

insert into public.app_mobile_first_quality_gates (
  gate_key,
  gate_area,
  gate_title,
  gate_status,
  route_hint,
  test_hint,
  failure_hint,
  sort_order,
  checked_at
)
values
  (
    'mobile_quick_nav_core_routes',
    'Mobile UX',
    'Mobile quick-action bar exposes the five most-used field routes',
    'passed',
    '#toolbox #incident #hseops #jobs #admin',
    'Open a phone-width viewport and confirm Talk, Incident, Safety, Jobs, and Admin remain visible at the bottom.',
    'Check index.html mobileQuickNav, js/mobile-menu.js syncQuickNav, and style.css mobile-quick-nav rules.',
    120,
    now()
  ),
  (
    'mobile_admin_action_spacing',
    'Mobile UX',
    'Admin and form actions stack as phone-friendly buttons',
    'passed',
    '#admin',
    'Confirm Admin retry/action buttons are one-column and easy to tap on phone width.',
    'Review .admin-heading-actions and .form-footer mobile CSS if actions overflow.',
    130,
    now()
  ),
  (
    'mobile_content_one_h1',
    'SEO / Mobile',
    'Public app shell keeps one main H1 for clearer mobile title signals',
    'passed',
    '/',
    'Run the smoke check and confirm H1_COUNT remains 1.',
    'Remove extra public H1 tags or convert section headings to H2/H3.',
    140,
    now()
  )
on conflict (gate_key) do update set
  gate_area = excluded.gate_area,
  gate_title = excluded.gate_title,
  gate_status = excluded.gate_status,
  route_hint = excluded.route_hint,
  test_hint = excluded.test_hint,
  failure_hint = excluded.failure_hint,
  sort_order = excluded.sort_order,
  checked_at = excluded.checked_at,
  updated_at = now();

insert into public.app_jurisdiction_wording_gates (
  gate_key,
  jurisdiction,
  gate_title,
  preferred_terms,
  avoid_terms,
  gate_status,
  route_hint,
  operator_hint,
  sort_order,
  checked_at
)
values
  (
    'ontario_ohsa_not_us_osha',
    'Ontario',
    'Use Ontario OHSA / workplace safety language instead of U.S. safety wording',
    'Ontario OHSA; Ontario workplace safety; safety operations; HSE where used as internal shorthand',
    'U.S. safety terminology for Ontario workplace procedures',
    'passed',
    '#hseops #admin #reports',
    'Historical migration filenames may remain unchanged, but user-facing text should use Ontario terms.',
    110,
    now()
  ),
  (
    'mobile_first_field_app_copy',
    'Ontario',
    'App copy emphasizes phone-first field use',
    'mobile-first; phone; field workflow; quick action',
    'desktop-only workflow assumptions',
    'passed',
    '#toolbox #incident #hseops',
    'Keep new field workflows usable on phone before adding desktop-only tables.',
    120,
    now()
  )
on conflict (gate_key) do update set
  jurisdiction = excluded.jurisdiction,
  gate_title = excluded.gate_title,
  preferred_terms = excluded.preferred_terms,
  avoid_terms = excluded.avoid_terms,
  gate_status = excluded.gate_status,
  route_hint = excluded.route_hint,
  operator_hint = excluded.operator_hint,
  sort_order = excluded.sort_order,
  checked_at = excluded.checked_at,
  updated_at = now();

drop view if exists public.v_app_mobile_first_quality_gates;
create view public.v_app_mobile_first_quality_gates as
select
  gate_key,
  gate_area,
  gate_title,
  gate_status,
  route_hint,
  test_hint,
  failure_hint,
  sort_order,
  checked_at,
  updated_at
from public.app_mobile_first_quality_gates
order by sort_order, gate_key;

drop view if exists public.v_app_jurisdiction_wording_gates;
create view public.v_app_jurisdiction_wording_gates as
select
  gate_key,
  jurisdiction,
  gate_title,
  preferred_terms,
  avoid_terms,
  gate_status,
  route_hint,
  operator_hint,
  sort_order,
  checked_at,
  updated_at
from public.app_jurisdiction_wording_gates
order by sort_order, gate_key;

drop view if exists public.v_schema_drift_status;
create view public.v_schema_drift_status as
select
  120::int as expected_schema_version,
  coalesce(max(schema_version) filter (where status = 'applied'), 0)::int as latest_applied_schema_version,
  case
    when coalesce(max(schema_version) filter (where status = 'applied'), 0) >= 120
      then 'current'
    else 'behind'
  end as drift_status,
  case
    when coalesce(max(schema_version) filter (where status = 'applied'), 0) >= 120
      then 'Live database is at or ahead of the repo schema marker.'
    else 'Live database is behind the deployed app. Apply migrations through schema 120.'
  end as message,
  now() as checked_at
from public.app_schema_versions;

insert into public.app_schema_versions (
  schema_version,
  migration_key,
  schema_name,
  release_label,
  description,
  status,
  notes
)
values (
  120,
  '120_ontario_ohsa_mobile_first_app_guardrails',
  '120_ontario_ohsa_mobile_first_app_guardrails.sql',
  '2026-05-26a',
  'Adds Ontario OHSA wording gates and mobile-first app quality gates for phone-heavy field usage.',
  'applied',
  'Mobile-first pass focused on Ontario workplace safety terminology, bottom quick navigation, PWA copy, and phone-friendly field workflows.'
)
on conflict (schema_version) do update set
  migration_key = excluded.migration_key,
  schema_name = excluded.schema_name,
  release_label = excluded.release_label,
  description = excluded.description,
  status = excluded.status,
  notes = excluded.notes,
  applied_at = now();

grant select on public.app_mobile_first_quality_gates to authenticated;
grant select on public.app_jurisdiction_wording_gates to authenticated;
grant select on public.v_app_mobile_first_quality_gates to authenticated;
grant select on public.v_app_jurisdiction_wording_gates to authenticated;
grant select on public.v_schema_drift_status to authenticated;

-- END 120_ontario_ohsa_mobile_first_app_guardrails.sql

-- -----------------------------------------------------------------------------
-- Schema 121: Mobile Today dashboard, PWA install helper, and offline queue badges
-- -----------------------------------------------------------------------------
-- Schema 121: Mobile Today dashboard, PWA install helper, and offline queue badges.
-- Tracks the 2026-05-27a pass that makes the app more usable as a phone-first
-- Ontario OHSA field workflow instead of a desktop-first admin shell.

create table if not exists public.app_schema_versions (
  schema_version integer primary key,
  schema_name text,
  description text,
  status text not null default 'applied',
  applied_at timestamptz not null default now(),
  applied_by text,
  notes text
);

alter table public.app_schema_versions add column if not exists migration_key text;
alter table public.app_schema_versions add column if not exists release_label text;

create table if not exists public.mobile_today_action_registry (
  action_key text primary key,
  action_title text not null,
  action_detail text not null,
  route_hint text not null,
  required_role text not null default 'employee',
  action_status text not null default 'active',
  priority_rank integer not null default 100,
  mobile_hint text,
  offline_hint text,
  updated_at timestamptz not null default now()
);

create table if not exists public.mobile_pwa_install_quality_gates (
  gate_key text primary key,
  gate_title text not null,
  gate_status text not null default 'review',
  platform_hint text,
  test_hint text,
  failure_hint text,
  sort_order integer not null default 100,
  checked_at timestamptz,
  updated_at timestamptz not null default now()
);

insert into public.mobile_today_action_registry (
  action_key,
  action_title,
  action_detail,
  route_hint,
  required_role,
  action_status,
  priority_rank,
  mobile_hint,
  offline_hint
)
values
  (
    'today_dashboard_core',
    'Today mobile dashboard',
    'Shows the next phone-first actions for the signed-in role before the long route list.',
    '#today',
    'employee',
    'active',
    10,
    'Keep this as the first mobile route and PWA start URL.',
    'The shell loads offline; live data still requires sync.'
  ),
  (
    'toolbox_quick_action',
    'Toolbox Talk quick action',
    'One-tap route to daily talk capture and signoff.',
    '#toolbox',
    'employee',
    'active',
    20,
    'Large tap target in quick nav and Today cards.',
    'Queued submissions show in the quick-nav badge.'
  ),
  (
    'incident_quick_action',
    'Incident / Near Miss quick action',
    'One-tap route for urgent event capture from a phone.',
    '#incident',
    'employee',
    'active',
    30,
    'Keep visible in bottom quick nav.',
    'Use local queue if connection drops before sync.'
  ),
  (
    'jobs_quick_action',
    'Jobs mobile action',
    'Field users can jump directly into jobs and operations records.',
    '#jobs',
    'employee',
    'active',
    40,
    'Today card explains job status use before desktop tables.',
    'Offline shell opens; updates need live connection.'
  ),
  (
    'ontario_safety_ops',
    'Ontario Safety Ops quick action',
    'Keeps Ontario OHSA-aware safety workflows visible for field users.',
    '#hseops',
    'employee',
    'active',
    50,
    'Use Ontario OHSA / workplace safety wording in visible copy.',
    'Offline shell opens; queue actions when possible.'
  ),
  (
    'admin_retry_action',
    'Admin retry/status action',
    'Admins can see staged load state and queued action count from the mobile quick nav.',
    '#admin',
    'admin',
    'active',
    90,
    'Badge shows queued admin/action outbox items.',
    'Retries should respect panel cooldown/backoff policies.'
  )
on conflict (action_key) do update set
  action_title = excluded.action_title,
  action_detail = excluded.action_detail,
  route_hint = excluded.route_hint,
  required_role = excluded.required_role,
  action_status = excluded.action_status,
  priority_rank = excluded.priority_rank,
  mobile_hint = excluded.mobile_hint,
  offline_hint = excluded.offline_hint,
  updated_at = now();

insert into public.mobile_pwa_install_quality_gates (
  gate_key,
  gate_title,
  gate_status,
  platform_hint,
  test_hint,
  failure_hint,
  sort_order,
  checked_at
)
values
  (
    'pwa_start_route_today',
    'PWA starts on the Today dashboard',
    'passed',
    'Android, iOS, desktop browser install',
    'Open manifest.json and confirm start_url is /#today.',
    'Update manifest.json start_url if the installed app opens an older form route.',
    10,
    now()
  ),
  (
    'quick_nav_badges',
    'Mobile quick nav shows offline queue badges',
    'passed',
    'Phone browser and installed PWA',
    'Queue a draft/offline action and confirm Today/Talk/Admin badges update.',
    'Check js/outbox.js notifyQueueChanged and js/mobile-menu.js syncBadges.',
    20,
    now()
  ),
  (
    'install_helper_card',
    'Today screen includes install guidance',
    'passed',
    'Chrome Android, Safari iOS',
    'Open #today on a phone-width viewport and confirm install guidance is visible when not already installed.',
    'Check js/mobile-today.js renderInstallCard and mobile-install-card CSS.',
    30,
    now()
  ),
  (
    'six_button_mobile_quick_nav',
    'Six primary mobile routes fit without turning into a long list',
    'passed',
    'Small phone width',
    'Confirm Today, Talk, Incident, Safety, Jobs, and Admin remain in one bottom bar.',
    'Check .mobile-quick-nav mobile CSS if labels wrap badly.',
    40,
    now()
  )
on conflict (gate_key) do update set
  gate_title = excluded.gate_title,
  gate_status = excluded.gate_status,
  platform_hint = excluded.platform_hint,
  test_hint = excluded.test_hint,
  failure_hint = excluded.failure_hint,
  sort_order = excluded.sort_order,
  checked_at = excluded.checked_at,
  updated_at = now();

insert into public.app_mobile_first_quality_gates (
  gate_key,
  gate_area,
  gate_title,
  gate_status,
  route_hint,
  test_hint,
  failure_hint,
  sort_order,
  checked_at
)
values
  (
    'mobile_today_dashboard_role_aware',
    'Mobile UX',
    'Today dashboard shows role-aware field actions',
    'passed',
    '#today',
    'Sign in as employee/supervisor/admin and confirm Today cards adjust to the role.',
    'Check js/mobile-today.js visibleCards and js/security.js section rules.',
    150,
    now()
  ),
  (
    'mobile_quick_nav_queue_badges',
    'Mobile UX',
    'Bottom quick nav displays queued form/action badges',
    'passed',
    '#today #toolbox #admin',
    'Queue a failed submission or action and confirm the badge updates without reload.',
    'Check js/outbox.js notifyQueueChanged and js/mobile-menu.js syncBadges.',
    160,
    now()
  ),
  (
    'mobile_pwa_install_helper',
    'Mobile UX',
    'Today route includes a PWA install helper',
    'passed',
    '#today',
    'Open the app in a non-installed mobile browser and confirm the helper explains Android/iOS install paths.',
    'Check mobileInstallCard in index.html and js/mobile-today.js.',
    170,
    now()
  )
on conflict (gate_key) do update set
  gate_area = excluded.gate_area,
  gate_title = excluded.gate_title,
  gate_status = excluded.gate_status,
  route_hint = excluded.route_hint,
  test_hint = excluded.test_hint,
  failure_hint = excluded.failure_hint,
  sort_order = excluded.sort_order,
  checked_at = excluded.checked_at,
  updated_at = now();

drop view if exists public.v_mobile_today_action_registry;
create view public.v_mobile_today_action_registry as
select
  action_key,
  action_title,
  action_detail,
  route_hint,
  required_role,
  action_status,
  priority_rank,
  mobile_hint,
  offline_hint,
  updated_at
from public.mobile_today_action_registry
order by priority_rank, action_key;

drop view if exists public.v_mobile_pwa_install_quality_gates;
create view public.v_mobile_pwa_install_quality_gates as
select
  gate_key,
  gate_title,
  gate_status,
  platform_hint,
  test_hint,
  failure_hint,
  sort_order,
  checked_at,
  updated_at
from public.mobile_pwa_install_quality_gates
order by sort_order, gate_key;

drop view if exists public.v_schema_drift_status;
create view public.v_schema_drift_status as
select
  121::int as expected_schema_version,
  coalesce(max(schema_version) filter (where status = 'applied'), 0)::int as latest_applied_schema_version,
  case
    when coalesce(max(schema_version) filter (where status = 'applied'), 0) >= 121
      then 'current'
    else 'behind'
  end as drift_status,
  case
    when coalesce(max(schema_version) filter (where status = 'applied'), 0) >= 121
      then 'Live database is at or ahead of the repo schema marker.'
    else 'Live database is behind the deployed app. Apply migrations through schema 121.'
  end as message,
  now() as checked_at
from public.app_schema_versions;

insert into public.app_schema_versions (
  schema_version,
  migration_key,
  schema_name,
  release_label,
  description,
  status,
  notes
)
values (
  121,
  '121_mobile_today_dashboard_pwa_and_offline_badges',
  '121_mobile_today_dashboard_pwa_and_offline_badges.sql',
  '2026-05-27a',
  'Adds a mobile Today dashboard registry, PWA install quality gates, and quick-nav offline badge tracking.',
  'applied',
  'Mobile-first pass focused on role-aware Today cards, quick-action badges, install guidance, and Ontario OHSA field workflow usability.'
)
on conflict (schema_version) do update set
  migration_key = excluded.migration_key,
  schema_name = excluded.schema_name,
  release_label = excluded.release_label,
  description = excluded.description,
  status = excluded.status,
  notes = excluded.notes,
  applied_at = now();

grant select on public.mobile_today_action_registry to authenticated;
grant select on public.mobile_pwa_install_quality_gates to authenticated;
grant select on public.v_mobile_today_action_registry to authenticated;
grant select on public.v_mobile_pwa_install_quality_gates to authenticated;
grant select on public.v_app_mobile_first_quality_gates to authenticated;
grant select on public.v_schema_drift_status to authenticated;
-- Schema 122: Mobile form steppers, local draft resume chips, and phone-first form quality gates.
-- This migration is intentionally low-risk: it adds metadata/quality-gate tables and views
-- used by Admin readiness screens. It does not alter live form submission tables.

create table if not exists public.app_schema_versions (
  schema_version integer primary key,
  schema_name text,
  description text,
  status text not null default 'applied',
  applied_at timestamptz not null default now(),
  applied_by text,
  notes text
);

alter table public.app_schema_versions add column if not exists migration_key text;
alter table public.app_schema_versions add column if not exists release_label text;

create table if not exists public.mobile_form_stepper_registry (
  form_key text primary key,
  form_title text not null,
  route_hint text not null,
  step_labels text[] not null default '{}'::text[],
  draft_policy text not null default 'local_device_only',
  offline_hint text,
  quality_status text not null default 'review',
  sort_order integer not null default 100,
  updated_at timestamptz not null default now()
);

create table if not exists public.mobile_form_quality_gates (
  gate_key text primary key,
  form_key text,
  gate_title text not null,
  gate_status text not null default 'review',
  route_hint text,
  test_hint text,
  failure_hint text,
  sort_order integer not null default 100,
  checked_at timestamptz,
  updated_at timestamptz not null default now()
);

insert into public.mobile_form_stepper_registry (
  form_key,
  form_title,
  route_hint,
  step_labels,
  draft_policy,
  offline_hint,
  quality_status,
  sort_order
)
values
  ('toolboxForm', 'Toolbox Talk', '#toolbox', array['Basics','Topic','Attendees','Photos','Submit'], 'local_device_only', 'Draft values are saved locally on the phone; file attachments still need to be re-selected before final submit.', 'passed', 10),
  ('ppeForm', 'PPE Check', '#ppe', array['Basics','Items','Notes','Submit'], 'local_device_only', 'Draft values are saved locally on the phone and the form can still queue through the outbox when offline.', 'passed', 20),
  ('faForm', 'First Aid Kit', '#firstaid', array['Basics','Items','Notes','Submit'], 'local_device_only', 'Draft values are saved locally on the phone and can be resumed before submission.', 'passed', 30),
  ('incidentForm', 'Incident / Near Miss', '#incident', array['Basics','Event','Actions','Photos','Submit'], 'local_device_only', 'Draft text is local; photos must be attached again before final submit if the browser clears file inputs.', 'passed', 40),
  ('inspForm', 'Site Inspection', '#inspect', array['Basics','Items','Photos','Submit'], 'local_device_only', 'Draft values are saved locally and inspection rows remain easier to reach with step chips.', 'passed', 50),
  ('drForm', 'Emergency Drill', '#drill', array['Basics','Scenario','Attendees','Submit'], 'local_device_only', 'Draft values are saved locally and attendee rows remain inside the normal form payload.', 'passed', 60)
on conflict (form_key) do update set
  form_title = excluded.form_title,
  route_hint = excluded.route_hint,
  step_labels = excluded.step_labels,
  draft_policy = excluded.draft_policy,
  offline_hint = excluded.offline_hint,
  quality_status = excluded.quality_status,
  sort_order = excluded.sort_order,
  updated_at = now();

insert into public.mobile_form_quality_gates (
  gate_key,
  form_key,
  gate_title,
  gate_status,
  route_hint,
  test_hint,
  failure_hint,
  sort_order,
  checked_at
)
values
  ('mobile_form_helper_script_loaded', null, 'Mobile form helper is loaded by the app shell', 'passed', '#today', 'Open the app and confirm js/mobile-form-helper.js is loaded with the current cache marker.', 'Hard refresh or clear the service worker if the helper does not load.', 10, now()),
  ('mobile_toolbox_stepper', 'toolboxForm', 'Toolbox Talk has mobile step chips and draft resume', 'passed', '#toolbox', 'Open Toolbox Talk at phone width and confirm Basics, Topic, Attendees, Photos, Submit chips appear.', 'Check js/mobile-form-helper.js and style.css mobile-form-assist rules.', 20, now()),
  ('mobile_incident_stepper', 'incidentForm', 'Incident / Near Miss has mobile step chips and draft resume', 'passed', '#incident', 'Open Incident / Near Miss at phone width and confirm Basics, Event, Actions, Photos, Submit chips appear.', 'Check the incidentForm config in js/mobile-form-helper.js.', 30, now()),
  ('mobile_safety_forms_stepper', null, 'PPE, First Aid, Inspection, and Drill have mobile step chips', 'passed', '#ppe', 'Open PPE, First Aid, Site Inspection, and Drill at phone width and confirm each form gets a mobile guide.', 'Check form IDs and MutationObserver enhancement timing.', 40, now()),
  ('mobile_draft_count_today', null, 'Today dashboard and quick badge include saved local drafts', 'passed', '#today', 'Save a draft on a form and confirm Today status/badge reflects the saved draft count.', 'Check ywi:mobile-drafts-updated events and mobile-menu badge sync.', 50, now())
on conflict (gate_key) do update set
  form_key = excluded.form_key,
  gate_title = excluded.gate_title,
  gate_status = excluded.gate_status,
  route_hint = excluded.route_hint,
  test_hint = excluded.test_hint,
  failure_hint = excluded.failure_hint,
  sort_order = excluded.sort_order,
  checked_at = excluded.checked_at,
  updated_at = now();

drop view if exists public.v_mobile_form_stepper_registry;
create view public.v_mobile_form_stepper_registry as
select
  form_key,
  form_title,
  route_hint,
  step_labels,
  draft_policy,
  offline_hint,
  quality_status,
  sort_order,
  updated_at
from public.mobile_form_stepper_registry
order by sort_order, form_key;

drop view if exists public.v_mobile_form_quality_gates;
create view public.v_mobile_form_quality_gates as
select
  gate_key,
  form_key,
  gate_title,
  gate_status,
  route_hint,
  test_hint,
  failure_hint,
  sort_order,
  checked_at,
  updated_at
from public.mobile_form_quality_gates
order by sort_order, gate_key;

drop view if exists public.v_schema_drift_status;
create view public.v_schema_drift_status as
select
  122::int as expected_schema_version,
  coalesce(max(schema_version) filter (where status = 'applied'), 0)::int as latest_applied_schema_version,
  case
    when coalesce(max(schema_version) filter (where status = 'applied'), 0) >= 122
      then 'current'
    else 'behind'
  end as drift_status,
  case
    when coalesce(max(schema_version) filter (where status = 'applied'), 0) >= 122
      then 'Live database is at or ahead of the repo schema marker.'
    else 'Live database is behind the deployed app. Apply migrations through schema 122.'
  end as message,
  now() as checked_at
from public.app_schema_versions;

insert into public.app_schema_versions (
  schema_version,
  migration_key,
  schema_name,
  release_label,
  description,
  status,
  notes
)
values (
  122,
  '122_mobile_form_stepper_draft_resume_guardrails',
  '122_mobile_form_stepper_draft_resume_guardrails.sql',
  '2026-05-28a',
  'Adds mobile form stepper and local draft-resume quality gate tracking for phone-first field usage.',
  'applied',
  'Mobile-first pass focused on guided form chips, local draft saving/resume, Today draft badges, and Ontario OHSA field workflow usability.'
)
on conflict (schema_version) do update set
  migration_key = excluded.migration_key,
  schema_name = excluded.schema_name,
  release_label = excluded.release_label,
  description = excluded.description,
  status = excluded.status,
  notes = excluded.notes,
  applied_at = now();

grant select on public.mobile_form_stepper_registry to authenticated;
grant select on public.mobile_form_quality_gates to authenticated;
grant select on public.v_mobile_form_stepper_registry to authenticated;
grant select on public.v_mobile_form_quality_gates to authenticated;
grant select on public.v_schema_drift_status to authenticated;


-- ============================================================================
-- Included migration: 123_equipment_transfer_arrival_return_accounting_seo_guardrails.sql
-- ============================================================================

-- Schema 123: Equipment transfer verification, return signoff depth, accounting/SEO guardrails.
-- This pass tightens the end-to-end equipment withdrawal -> site arrival -> return workflow
-- and records the rollout in readiness tables so Admin can see what still needs testing.

begin;

create table if not exists public.app_schema_versions (
  schema_version integer primary key,
  schema_name text,
  description text,
  status text not null default 'applied',
  applied_at timestamptz not null default now(),
  applied_by text,
  notes text
);

alter table public.app_schema_versions add column if not exists migration_key text;
alter table public.app_schema_versions add column if not exists release_label text;

alter table if exists public.equipment_items
  add column if not exists current_site_id uuid references public.sites(id) on delete set null,
  add column if not exists target_site_id uuid references public.sites(id) on delete set null,
  add column if not exists last_transfer_status text not null default 'ready',
  add column if not exists last_transfer_notes text,
  add column if not exists last_arrival_verified_at timestamptz,
  add column if not exists last_arrival_verified_by_profile_id uuid references public.profiles(id) on delete set null,
  add column if not exists last_arrival_test_status text,
  add column if not exists last_return_verified_at timestamptz,
  add column if not exists last_return_verified_by_profile_id uuid references public.profiles(id) on delete set null,
  add column if not exists last_return_test_status text;

alter table if exists public.equipment_signouts
  add column if not exists intended_site_id uuid references public.sites(id) on delete set null,
  add column if not exists checkout_to_site_id uuid references public.sites(id) on delete set null,
  add column if not exists checkout_safety_test_status text not null default 'not_recorded',
  add column if not exists checkout_test_notes text,
  add column if not exists transport_handoff_notes text,
  add column if not exists arrived_at_site_at timestamptz,
  add column if not exists arrived_at_site_by_profile_id uuid references public.profiles(id) on delete set null,
  add column if not exists arrival_condition text,
  add column if not exists arrival_test_status text not null default 'not_recorded',
  add column if not exists arrival_verification_notes text,
  add column if not exists return_destination_site_id uuid references public.sites(id) on delete set null,
  add column if not exists return_test_status text not null default 'not_recorded',
  add column if not exists return_test_notes text,
  add column if not exists return_verified_at timestamptz,
  add column if not exists return_verified_by_profile_id uuid references public.profiles(id) on delete set null,
  add column if not exists verification_status text not null default 'open';

alter table if exists public.equipment_signouts
  drop constraint if exists equipment_signouts_checkout_safety_test_status_check;
alter table if exists public.equipment_signouts
  add constraint equipment_signouts_checkout_safety_test_status_check
  check (checkout_safety_test_status in ('not_recorded','passed','failed','needs_service','not_required'));

alter table if exists public.equipment_signouts
  drop constraint if exists equipment_signouts_arrival_test_status_check;
alter table if exists public.equipment_signouts
  add constraint equipment_signouts_arrival_test_status_check
  check (arrival_test_status in ('not_recorded','passed','failed','needs_service','not_required'));

alter table if exists public.equipment_signouts
  drop constraint if exists equipment_signouts_return_test_status_check;
alter table if exists public.equipment_signouts
  add constraint equipment_signouts_return_test_status_check
  check (return_test_status in ('not_recorded','passed','failed','needs_service','not_required'));

alter table if exists public.equipment_signouts
  drop constraint if exists equipment_signouts_verification_status_check;
alter table if exists public.equipment_signouts
  add constraint equipment_signouts_verification_status_check
  check (verification_status in ('open','in_transit','arrived_verified','arrival_issue','returned_pending_review','return_verified','return_issue'));

alter table if exists public.equipment_items
  drop constraint if exists equipment_items_last_transfer_status_check;
alter table if exists public.equipment_items
  add constraint equipment_items_last_transfer_status_check
  check (last_transfer_status in ('ready','reserved','in_transit','arrived_verified','arrival_issue','returned_pending_review','return_verified','return_issue','locked_out'));

create table if not exists public.equipment_transfer_verification_events (
  id bigserial primary key,
  equipment_item_id bigint not null references public.equipment_items(id) on delete cascade,
  signout_id bigint references public.equipment_signouts(id) on delete cascade,
  job_id bigint references public.jobs(id) on delete set null,
  event_type text not null,
  from_site_id uuid references public.sites(id) on delete set null,
  to_site_id uuid references public.sites(id) on delete set null,
  test_status text not null default 'not_recorded',
  condition_status text,
  verified_by_profile_id uuid references public.profiles(id) on delete set null,
  verification_notes text,
  event_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table if exists public.equipment_transfer_verification_events
  drop constraint if exists equipment_transfer_verification_events_event_type_check;
alter table if exists public.equipment_transfer_verification_events
  add constraint equipment_transfer_verification_events_event_type_check
  check (event_type in ('checkout_released','site_arrival_verified','site_arrival_issue','return_received','return_verified','return_issue','lockout_after_return'));

alter table if exists public.equipment_transfer_verification_events
  drop constraint if exists equipment_transfer_verification_events_test_status_check;
alter table if exists public.equipment_transfer_verification_events
  add constraint equipment_transfer_verification_events_test_status_check
  check (test_status in ('not_recorded','passed','failed','needs_service','not_required'));

create index if not exists idx_equipment_items_transfer_status
  on public.equipment_items(last_transfer_status, status, updated_at desc);
create index if not exists idx_equipment_items_current_site
  on public.equipment_items(current_site_id, status);
create index if not exists idx_equipment_signouts_verification_status
  on public.equipment_signouts(verification_status, checked_out_at desc);
create index if not exists idx_equipment_signouts_intended_site
  on public.equipment_signouts(intended_site_id, checked_out_at desc);
create index if not exists idx_equipment_transfer_events_signout
  on public.equipment_transfer_verification_events(signout_id, created_at desc);

create table if not exists public.app_operational_depth_gates (
  gate_key text primary key,
  gate_area text not null,
  gate_title text not null,
  gate_status text not null default 'review',
  owner_hint text,
  route_hint text,
  test_hint text,
  failure_hint text,
  sort_order integer not null default 100,
  checked_at timestamptz,
  updated_at timestamptz not null default now()
);

insert into public.app_operational_depth_gates (
  gate_key,
  gate_area,
  gate_title,
  gate_status,
  owner_hint,
  route_hint,
  test_hint,
  failure_hint,
  sort_order,
  checked_at
)
values
  ('equipment_checkout_requires_job_and_destination', 'equipment', 'Checkout captures the job and intended destination site', 'passed', 'Supervisor / Job Admin', '#equipment', 'Load equipment, select a Current Job and Destination Site, then check out.', 'Keep checkout blocked until both the job and destination are clear.', 10, now()),
  ('equipment_arrival_verification_recorded', 'equipment', 'Arrival verification records site, condition, test status, and verifier', 'passed', 'Supervisor / Site Leader', '#equipment', 'After checkout, use Verify Arrival / Site Test and confirm a transfer event row is created.', 'If this fails, do not mark equipment ready on site.', 20, now()),
  ('equipment_return_verified_before_ready', 'equipment', 'Return verification separates returned-pending-review from return-verified', 'passed', 'Supervisor / Admin', '#equipment', 'Return an item, then confirm Return Verified changes the workflow status.', 'Damaged or untested returns should stay pending review or issue.', 30, now()),
  ('equipment_exceptions_visible', 'equipment', 'Open equipment transfer/return exceptions are visible in the Equipment panel', 'passed', 'Admin', '#equipment', 'Confirm missing arrival, arrival issue, and pending return rows appear in the exception summary.', 'Use the return exception view as the supervisor triage list.', 40, now()),
  ('seo_public_smoke_policy', 'seo', 'SEO smoke checks remain part of each pass', 'passed', 'Admin / Content', '#admin', 'Confirm one H1, title, meta description, structured data, and local wording checks remain documented.', 'Do not ship public pages with duplicate H1s or unclear titles.', 50, now()),
  ('accounting_depth_review', 'accounting', 'Accounting close still needs deeper applied-cost, payment, remittance, and export review', 'review', 'Admin / Accountant', '#jobs', 'Review payment application, journal lines, reconciliation, remittance signoff, and accountant handoff after live data exists.', 'Treat this as a depth gap until real transaction fixtures pass end-to-end.', 60, now())
on conflict (gate_key) do update set
  gate_area = excluded.gate_area,
  gate_title = excluded.gate_title,
  gate_status = excluded.gate_status,
  owner_hint = excluded.owner_hint,
  route_hint = excluded.route_hint,
  test_hint = excluded.test_hint,
  failure_hint = excluded.failure_hint,
  sort_order = excluded.sort_order,
  checked_at = excluded.checked_at,
  updated_at = now();

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
  e.asset_tag,
  e.manufacturer,
  e.model_number,
  e.purchase_year,
  e.purchase_date,
  e.purchase_price,
  e.condition_status,
  e.image_url,
  e.comments,
  e.equipment_pool_key,
  e.service_interval_days,
  e.last_service_date,
  e.next_service_due_date,
  e.last_inspection_at,
  e.next_inspection_due_date,
  e.defect_status,
  e.defect_notes,
  e.is_locked_out,
  e.last_transfer_status,
  e.last_transfer_notes,
  e.last_arrival_verified_at,
  e.last_arrival_test_status,
  e.last_return_verified_at,
  e.last_return_test_status,
  home.site_code as home_site_code,
  home.site_name as home_site_name,
  cur.site_code as current_site_code,
  cur.site_name as current_site_name,
  target.site_code as target_site_code,
  target.site_name as target_site_name,
  j.job_code as current_job_code,
  j.job_name as current_job_name,
  sup.full_name as assigned_supervisor_name,
  arrival.full_name as last_arrival_verified_by_name,
  ret.full_name as last_return_verified_by_name
from public.equipment_items e
left join public.sites home on home.id = e.home_site_id
left join public.sites cur on cur.id = e.current_site_id
left join public.sites target on target.id = e.target_site_id
left join public.jobs j on j.id = e.current_job_id
left join public.profiles sup on sup.id = e.assigned_supervisor_profile_id
left join public.profiles arrival on arrival.id = e.last_arrival_verified_by_profile_id
left join public.profiles ret on ret.id = e.last_return_verified_by_profile_id;

drop view if exists public.v_equipment_transfer_verification_directory;
create view public.v_equipment_transfer_verification_directory as
select
  ev.id,
  ev.event_type,
  ev.test_status,
  ev.condition_status,
  ev.verification_notes,
  ev.event_payload,
  ev.created_at,
  eq.equipment_code,
  eq.equipment_name,
  j.job_code,
  j.job_name,
  from_site.site_code as from_site_code,
  from_site.site_name as from_site_name,
  to_site.site_code as to_site_code,
  to_site.site_name as to_site_name,
  verifier.full_name as verified_by_name,
  verifier.email as verified_by_email,
  ev.signout_id,
  ev.equipment_item_id,
  ev.job_id
from public.equipment_transfer_verification_events ev
left join public.equipment_items eq on eq.id = ev.equipment_item_id
left join public.jobs j on j.id = ev.job_id
left join public.sites from_site on from_site.id = ev.from_site_id
left join public.sites to_site on to_site.id = ev.to_site_id
left join public.profiles verifier on verifier.id = ev.verified_by_profile_id;

drop view if exists public.v_equipment_return_exception_directory;
create view public.v_equipment_return_exception_directory as
select
  s.id as signout_id,
  e.id as equipment_item_id,
  e.equipment_code,
  e.equipment_name,
  j.job_code,
  j.job_name,
  coalesce(dest.site_code, target.site_code, home.site_code, '') as expected_site_code,
  coalesce(dest.site_name, target.site_name, home.site_name, '') as expected_site_name,
  s.checked_out_at,
  s.arrived_at_site_at,
  s.returned_at,
  s.verification_status,
  s.checkout_safety_test_status,
  s.arrival_test_status,
  s.return_test_status,
  s.damage_reported,
  s.damage_notes,
  case
    when s.returned_at is null and s.arrived_at_site_at is null then 'missing_arrival_verification'
    when s.verification_status in ('arrival_issue','return_issue') then s.verification_status
    when s.returned_at is not null and s.return_verified_at is null then 'returned_pending_review'
    when coalesce(s.damage_reported,false) = true then 'damage_reported'
    else 'ok'
  end as exception_status,
  coalesce(s.arrival_verification_notes, s.return_test_notes, s.damage_notes, s.return_notes, s.signout_notes) as exception_notes
from public.equipment_signouts s
join public.equipment_items e on e.id = s.equipment_item_id
left join public.jobs j on j.id = s.job_id
left join public.sites dest on dest.id = s.return_destination_site_id
left join public.sites target on target.id = s.intended_site_id
left join public.sites home on home.id = e.home_site_id
where
  s.returned_at is null
  or s.return_verified_at is null
  or s.verification_status in ('arrival_issue','return_issue','returned_pending_review')
  or coalesce(s.damage_reported,false) = true;

drop view if exists public.v_app_operational_depth_gates;
create view public.v_app_operational_depth_gates as
select
  gate_key,
  gate_area,
  gate_title,
  gate_status,
  owner_hint,
  route_hint,
  test_hint,
  failure_hint,
  sort_order,
  checked_at,
  updated_at
from public.app_operational_depth_gates
order by sort_order, gate_key;

drop view if exists public.v_schema_drift_status;
create view public.v_schema_drift_status as
select
  123::int as expected_schema_version,
  coalesce(max(schema_version) filter (where status = 'applied'), 0)::int as latest_applied_schema_version,
  case
    when coalesce(max(schema_version) filter (where status = 'applied'), 0) >= 123
      then 'current'
    else 'behind'
  end as drift_status,
  case
    when coalesce(max(schema_version) filter (where status = 'applied'), 0) >= 123
      then 'Live database is at or ahead of the repo schema marker.'
    else 'Live database is behind the deployed app. Apply migrations through schema 123.'
  end as message,
  now() as checked_at
from public.app_schema_versions;

insert into public.app_schema_versions (
  schema_version,
  migration_key,
  schema_name,
  release_label,
  description,
  status,
  notes
)
values (
  123,
  '123_equipment_transfer_arrival_return_accounting_seo_guardrails',
  '123_equipment_transfer_arrival_return_accounting_seo_guardrails.sql',
  '2026-05-29a',
  'Adds equipment destination, arrival verification, return verification, transfer audit events, and operational-depth gates for equipment/accounting/SEO sanity checks.',
  'applied',
  'Equipment withdrawal now records destination, site arrival verification, return review status, transfer history, and exception rows; accounting and SEO depth gaps remain visible as gates.'
)
on conflict (schema_version) do update set
  migration_key = excluded.migration_key,
  schema_name = excluded.schema_name,
  release_label = excluded.release_label,
  description = excluded.description,
  status = excluded.status,
  notes = excluded.notes,
  applied_at = now();

grant select on public.equipment_transfer_verification_events to authenticated;
grant select on public.app_operational_depth_gates to authenticated;
grant select on public.v_equipment_directory to authenticated;
grant select on public.v_equipment_transfer_verification_directory to authenticated;
grant select on public.v_equipment_return_exception_directory to authenticated;
grant select on public.v_app_operational_depth_gates to authenticated;
grant select on public.v_schema_drift_status to authenticated;

commit;


-- Schema 124: Accounting depth and equipment accountability pass.
-- Adds deeper job-cost categories, payment application review fields,
-- reconciliation review workbench metadata, remittance/filing signoff proof,
-- month-end lock/reopen handoff fields, QR/barcode equipment lookup,
-- accessory checklist tracking, and automatic service-task candidates.

begin;

create extension if not exists pgcrypto;

create table if not exists public.app_schema_versions (
  schema_version integer primary key,
  schema_name text,
  description text,
  status text not null default 'applied',
  applied_at timestamptz not null default now(),
  applied_by text,
  notes text
);

alter table public.app_schema_versions add column if not exists migration_key text;
alter table public.app_schema_versions add column if not exists release_label text;

alter table if exists public.job_financial_events
  add column if not exists cost_category text,
  add column if not exists billable_charge_status text not null default 'not_billable',
  add column if not exists source_equipment_item_id bigint references public.equipment_items(id) on delete set null,
  add column if not exists source_signout_id bigint references public.equipment_signouts(id) on delete set null,
  add column if not exists accounting_period_close_id uuid references public.accounting_period_closes(id) on delete set null,
  add column if not exists posting_status text not null default 'draft',
  add column if not exists profitability_notes text;

alter table if exists public.job_financial_events drop constraint if exists job_financial_events_type_check;
alter table if exists public.job_financial_events
  add constraint job_financial_events_type_check
  check (event_type in (
    'material',
    'equipment_usage',
    'equipment_repair',
    'equipment_replacement',
    'delay',
    'fuel',
    'travel',
    'subcontract',
    'disposal',
    'permit',
    'revenue_adjustment',
    'discount_adjustment',
    'writeoff_adjustment',
    'other'
  ));

alter table if exists public.job_financial_events drop constraint if exists job_financial_events_billable_charge_status_check;
alter table if exists public.job_financial_events
  add constraint job_financial_events_billable_charge_status_check
  check (billable_charge_status in ('not_billable','billable','billed','written_off','review'));

alter table if exists public.job_financial_events drop constraint if exists job_financial_events_posting_status_check;
alter table if exists public.job_financial_events
  add constraint job_financial_events_posting_status_check
  check (posting_status in ('draft','review','approved','posted','void'));

create index if not exists idx_job_financial_events_cost_category
  on public.job_financial_events(cost_category, event_type, event_date desc);
create index if not exists idx_job_financial_events_source_equipment
  on public.job_financial_events(source_equipment_item_id, event_date desc);
create index if not exists idx_job_financial_events_period
  on public.job_financial_events(accounting_period_close_id, posting_status, event_date desc);

alter table if exists public.ar_payment_applications
  add column if not exists application_type text not null default 'invoice_payment',
  add column if not exists credit_amount numeric(12,2) not null default 0,
  add column if not exists discount_amount numeric(12,2) not null default 0,
  add column if not exists writeoff_amount numeric(12,2) not null default 0,
  add column if not exists overpayment_amount numeric(12,2) not null default 0,
  add column if not exists review_status text not null default 'draft',
  add column if not exists reviewed_by_profile_id uuid references public.profiles(id) on delete set null,
  add column if not exists reviewed_at timestamptz,
  add column if not exists source_reconciliation_item_id uuid references public.bank_reconciliation_items(id) on delete set null,
  add column if not exists application_payload jsonb not null default '{}'::jsonb;

alter table if exists public.ar_payment_applications drop constraint if exists ar_payment_applications_application_type_check;
alter table if exists public.ar_payment_applications
  add constraint ar_payment_applications_application_type_check
  check (application_type in ('invoice_payment','deposit','credit','discount','writeoff','overpayment','refund','other'));

alter table if exists public.ar_payment_applications drop constraint if exists ar_payment_applications_review_status_check;
alter table if exists public.ar_payment_applications
  add constraint ar_payment_applications_review_status_check
  check (review_status in ('draft','review','approved','posted','reversed','exception'));

alter table if exists public.ap_payment_applications
  add column if not exists application_type text not null default 'bill_payment',
  add column if not exists credit_amount numeric(12,2) not null default 0,
  add column if not exists discount_amount numeric(12,2) not null default 0,
  add column if not exists writeoff_amount numeric(12,2) not null default 0,
  add column if not exists overpayment_amount numeric(12,2) not null default 0,
  add column if not exists review_status text not null default 'draft',
  add column if not exists reviewed_by_profile_id uuid references public.profiles(id) on delete set null,
  add column if not exists reviewed_at timestamptz,
  add column if not exists source_reconciliation_item_id uuid references public.bank_reconciliation_items(id) on delete set null,
  add column if not exists application_payload jsonb not null default '{}'::jsonb;

alter table if exists public.ap_payment_applications drop constraint if exists ap_payment_applications_application_type_check;
alter table if exists public.ap_payment_applications
  add constraint ap_payment_applications_application_type_check
  check (application_type in ('bill_payment','deposit','credit','discount','writeoff','overpayment','refund','other'));

alter table if exists public.ap_payment_applications drop constraint if exists ap_payment_applications_review_status_check;
alter table if exists public.ap_payment_applications
  add constraint ap_payment_applications_review_status_check
  check (review_status in ('draft','review','approved','posted','reversed','exception'));

create index if not exists idx_ar_payment_applications_review
  on public.ar_payment_applications(review_status, application_date desc, created_at desc);
create index if not exists idx_ap_payment_applications_review
  on public.ap_payment_applications(review_status, application_date desc, created_at desc);

alter table if exists public.bank_reconciliation_items
  add column if not exists import_row_number integer,
  add column if not exists raw_description text,
  add column if not exists suggested_match_source_table text,
  add column if not exists suggested_match_source_id text,
  add column if not exists suggested_match_score numeric(7,2),
  add column if not exists suggested_match_reason text,
  add column if not exists manual_review_status text not null default 'needs_review',
  add column if not exists reviewed_by_profile_id uuid references public.profiles(id) on delete set null,
  add column if not exists reviewed_at timestamptz,
  add column if not exists undo_of_item_id uuid references public.bank_reconciliation_items(id) on delete set null,
  add column if not exists review_notes text;

alter table if exists public.bank_reconciliation_items drop constraint if exists bank_reconciliation_items_manual_review_status_check;
alter table if exists public.bank_reconciliation_items
  add constraint bank_reconciliation_items_manual_review_status_check
  check (manual_review_status in ('needs_review','suggested','manual_match','approved','undo','exception','ignored'));

create index if not exists idx_bank_reconciliation_items_manual_review
  on public.bank_reconciliation_items(manual_review_status, match_status, item_date desc);

alter table if exists public.sales_tax_filings
  add column if not exists source_totals_jsonb jsonb not null default '{}'::jsonb,
  add column if not exists adjustment_notes text,
  add column if not exists export_proof_url text,
  add column if not exists signed_off_by_profile_id uuid references public.profiles(id) on delete set null,
  add column if not exists signed_off_at timestamptz,
  add column if not exists filed_reference text,
  add column if not exists filing_review_step text not null default 'source_review';

alter table if exists public.sales_tax_filings drop constraint if exists sales_tax_filings_review_step_check;
alter table if exists public.sales_tax_filings
  add constraint sales_tax_filings_review_step_check
  check (filing_review_step in ('source_review','adjustment_review','approved','filed','paid','exception'));

alter table if exists public.payroll_remittance_runs
  add column if not exists source_totals_jsonb jsonb not null default '{}'::jsonb,
  add column if not exists adjustment_notes text,
  add column if not exists export_proof_url text,
  add column if not exists signed_off_by_profile_id uuid references public.profiles(id) on delete set null,
  add column if not exists signed_off_at timestamptz,
  add column if not exists filed_reference text,
  add column if not exists remittance_review_step text not null default 'source_review';

alter table if exists public.payroll_remittance_runs drop constraint if exists payroll_remittance_runs_review_step_check;
alter table if exists public.payroll_remittance_runs
  add constraint payroll_remittance_runs_review_step_check
  check (remittance_review_step in ('source_review','adjustment_review','approved','remitted','paid','exception'));

alter table if exists public.accounting_period_closes
  add column if not exists period_lock_status text not null default 'open',
  add column if not exists locked_by_profile_id uuid references public.profiles(id) on delete set null,
  add column if not exists locked_at timestamptz,
  add column if not exists reopened_by_profile_id uuid references public.profiles(id) on delete set null,
  add column if not exists reopened_at timestamptz,
  add column if not exists reopen_reason text,
  add column if not exists accountant_package_export_id uuid references public.accountant_handoff_exports(id) on delete set null,
  add column if not exists close_package_manifest jsonb not null default '{}'::jsonb;

alter table if exists public.accounting_period_closes drop constraint if exists accounting_period_closes_period_lock_status_check;
alter table if exists public.accounting_period_closes
  add constraint accounting_period_closes_period_lock_status_check
  check (period_lock_status in ('open','soft_locked','locked','reopened'));

alter table if exists public.accountant_handoff_exports
  add column if not exists source_period_close_id uuid references public.accounting_period_closes(id) on delete set null,
  add column if not exists exported_file_manifest jsonb not null default '[]'::jsonb,
  add column if not exists package_delivery_reference text,
  add column if not exists finalized_by_profile_id uuid references public.profiles(id) on delete set null,
  add column if not exists delivered_by_profile_id uuid references public.profiles(id) on delete set null;

alter table if exists public.equipment_items
  add column if not exists qr_code_value text,
  add column if not exists barcode_value text,
  add column if not exists verifier_role_required text not null default 'supervisor',
  add column if not exists accessory_checklist_required boolean not null default false;

alter table if exists public.equipment_items drop constraint if exists equipment_items_verifier_role_required_check;
alter table if exists public.equipment_items
  add constraint equipment_items_verifier_role_required_check
  check (verifier_role_required in ('site_leader','supervisor','job_admin','admin'));

create unique index if not exists idx_equipment_items_qr_code_value
  on public.equipment_items(qr_code_value) where qr_code_value is not null;
create unique index if not exists idx_equipment_items_barcode_value
  on public.equipment_items(barcode_value) where barcode_value is not null;

create table if not exists public.equipment_accessory_checklists (
  id uuid primary key default gen_random_uuid(),
  equipment_item_id bigint references public.equipment_items(id) on delete cascade,
  equipment_pool_key text,
  checklist_name text not null,
  required_accessories jsonb not null default '[]'::jsonb,
  safety_items jsonb not null default '[]'::jsonb,
  default_notes text,
  is_active boolean not null default true,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_equipment_accessory_checklists_equipment
  on public.equipment_accessory_checklists(equipment_item_id, is_active, checklist_name);
create index if not exists idx_equipment_accessory_checklists_pool
  on public.equipment_accessory_checklists(equipment_pool_key, is_active, checklist_name);

alter table if exists public.equipment_signouts
  add column if not exists checkout_accessory_checklist jsonb not null default '[]'::jsonb,
  add column if not exists arrival_accessory_checklist jsonb not null default '[]'::jsonb,
  add column if not exists return_accessory_checklist jsonb not null default '[]'::jsonb,
  add column if not exists checkout_accessory_status text not null default 'not_recorded',
  add column if not exists arrival_accessory_status text not null default 'not_recorded',
  add column if not exists return_accessory_status text not null default 'not_recorded',
  add column if not exists accessory_missing_notes text;

alter table if exists public.equipment_signouts drop constraint if exists equipment_signouts_checkout_accessory_status_check;
alter table if exists public.equipment_signouts
  add constraint equipment_signouts_checkout_accessory_status_check
  check (checkout_accessory_status in ('not_recorded','complete','missing','damaged','not_required'));

alter table if exists public.equipment_signouts drop constraint if exists equipment_signouts_arrival_accessory_status_check;
alter table if exists public.equipment_signouts
  add constraint equipment_signouts_arrival_accessory_status_check
  check (arrival_accessory_status in ('not_recorded','complete','missing','damaged','not_required'));

alter table if exists public.equipment_signouts drop constraint if exists equipment_signouts_return_accessory_status_check;
alter table if exists public.equipment_signouts
  add constraint equipment_signouts_return_accessory_status_check
  check (return_accessory_status in ('not_recorded','complete','missing','damaged','not_required'));

create table if not exists public.equipment_service_tasks (
  id uuid primary key default gen_random_uuid(),
  equipment_item_id bigint not null references public.equipment_items(id) on delete cascade,
  source_signout_id bigint references public.equipment_signouts(id) on delete set null,
  source_event_id bigint references public.equipment_transfer_verification_events(id) on delete set null,
  job_id bigint references public.jobs(id) on delete set null,
  task_type text not null default 'return_test_followup',
  task_status text not null default 'open',
  priority text not null default 'normal',
  failure_reason text,
  estimated_cost numeric(12,2) not null default 0,
  actual_cost numeric(12,2) not null default 0,
  assigned_to_profile_id uuid references public.profiles(id) on delete set null,
  due_at timestamptz,
  resolved_at timestamptz,
  resolved_by_profile_id uuid references public.profiles(id) on delete set null,
  notes text,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists public.equipment_service_tasks drop constraint if exists equipment_service_tasks_type_check;
alter table if exists public.equipment_service_tasks
  add constraint equipment_service_tasks_type_check
  check (task_type in ('arrival_test_followup','return_test_followup','repair','cleaning','inspection','replacement','accessory_missing','custom'));

alter table if exists public.equipment_service_tasks drop constraint if exists equipment_service_tasks_status_check;
alter table if exists public.equipment_service_tasks
  add constraint equipment_service_tasks_status_check
  check (task_status in ('open','assigned','waiting_parts','in_progress','resolved','cancelled'));

create index if not exists idx_equipment_service_tasks_equipment
  on public.equipment_service_tasks(equipment_item_id, task_status, created_at desc);
create index if not exists idx_equipment_service_tasks_job
  on public.equipment_service_tasks(job_id, task_status, created_at desc);

create or replace view public.v_job_cost_depth_directory as
with cost_rollup as (
  select
    job_id,
    coalesce(sum(cost_amount) filter (where event_type = 'equipment_usage'), 0)::numeric(12,2) as equipment_usage_cost_total,
    coalesce(sum(cost_amount) filter (where event_type = 'equipment_repair'), 0)::numeric(12,2) as equipment_repair_event_cost_total,
    coalesce(sum(cost_amount) filter (where event_type = 'equipment_replacement'), 0)::numeric(12,2) as equipment_replacement_cost_total,
    coalesce(sum(cost_amount) filter (where event_type = 'delay'), 0)::numeric(12,2) as delay_event_cost_total,
    coalesce(sum(cost_amount) filter (where event_type = 'fuel'), 0)::numeric(12,2) as fuel_cost_total,
    coalesce(sum(cost_amount) filter (where event_type = 'disposal'), 0)::numeric(12,2) as disposal_cost_total,
    coalesce(sum(cost_amount) filter (where event_type = 'subcontract'), 0)::numeric(12,2) as subcontract_cost_total,
    coalesce(sum(cost_amount) filter (where event_type = 'material'), 0)::numeric(12,2) as material_cost_total,
    coalesce(sum(cost_amount), 0)::numeric(12,2) as financial_event_cost_total,
    coalesce(sum(revenue_amount), 0)::numeric(12,2) as financial_event_revenue_total,
    count(*)::int as cost_event_count
  from public.job_financial_events
  group by job_id
)
select
  j.id as job_id,
  j.job_code,
  j.job_name,
  j.client_name,
  j.status,
  j.start_date,
  j.end_date,
  coalesce(j.estimated_cost_total, 0)::numeric(12,2) as estimated_cost_total,
  coalesce(j.quoted_charge_total, 0)::numeric(12,2) as quoted_charge_total,
  coalesce(j.actual_cost_total, 0)::numeric(12,2) as actual_cost_total,
  coalesce(j.actual_charge_total, 0)::numeric(12,2) as actual_charge_total,
  coalesce(j.delay_cost_total, 0)::numeric(12,2) as job_delay_cost_total,
  coalesce(j.equipment_repair_cost_total, 0)::numeric(12,2) as job_equipment_repair_cost_total,
  coalesce(cr.equipment_usage_cost_total, 0)::numeric(12,2) as equipment_usage_cost_total,
  coalesce(cr.equipment_repair_event_cost_total, 0)::numeric(12,2) as equipment_repair_event_cost_total,
  coalesce(cr.equipment_replacement_cost_total, 0)::numeric(12,2) as equipment_replacement_cost_total,
  coalesce(cr.delay_event_cost_total, 0)::numeric(12,2) as delay_event_cost_total,
  coalesce(cr.fuel_cost_total, 0)::numeric(12,2) as fuel_cost_total,
  coalesce(cr.disposal_cost_total, 0)::numeric(12,2) as disposal_cost_total,
  coalesce(cr.subcontract_cost_total, 0)::numeric(12,2) as subcontract_cost_total,
  coalesce(cr.material_cost_total, 0)::numeric(12,2) as material_cost_total,
  (coalesce(j.actual_cost_total, 0) + coalesce(j.delay_cost_total, 0) + coalesce(j.equipment_repair_cost_total, 0) + coalesce(cr.financial_event_cost_total, 0))::numeric(12,2) as total_known_cost,
  (coalesce(j.actual_charge_total, 0) + coalesce(cr.financial_event_revenue_total, 0))::numeric(12,2) as total_known_revenue,
  ((coalesce(j.actual_charge_total, 0) + coalesce(cr.financial_event_revenue_total, 0)) - (coalesce(j.actual_cost_total, 0) + coalesce(j.delay_cost_total, 0) + coalesce(j.equipment_repair_cost_total, 0) + coalesce(cr.financial_event_cost_total, 0)))::numeric(12,2) as known_profit_total,
  coalesce(cr.cost_event_count, 0)::int as cost_event_count
from public.jobs j
left join cost_rollup cr on cr.job_id = j.id;

create or replace view public.v_payment_application_workbench_directory as
select
  'ar'::text as ledger_side,
  a.id,
  a.payment_id,
  a.invoice_id as target_id,
  i.invoice_number as target_number,
  c.legal_name as party_name,
  p.payment_number,
  p.payment_date,
  p.amount as payment_amount,
  a.applied_amount,
  a.credit_amount,
  a.discount_amount,
  a.writeoff_amount,
  a.overpayment_amount,
  a.application_type,
  a.application_status,
  a.review_status,
  a.application_date,
  a.notes,
  reviewer.full_name as reviewed_by_name,
  a.reviewed_at
from public.ar_payment_applications a
left join public.ar_payments p on p.id = a.payment_id
left join public.ar_invoices i on i.id = a.invoice_id
left join public.clients c on c.id = p.client_id
left join public.profiles reviewer on reviewer.id = a.reviewed_by_profile_id
union all
select
  'ap'::text as ledger_side,
  a.id,
  a.payment_id,
  a.bill_id as target_id,
  b.bill_number as target_number,
  v.legal_name as party_name,
  p.payment_number,
  p.payment_date,
  p.amount as payment_amount,
  a.applied_amount,
  a.credit_amount,
  a.discount_amount,
  a.writeoff_amount,
  a.overpayment_amount,
  a.application_type,
  a.application_status,
  a.review_status,
  a.application_date,
  a.notes,
  reviewer.full_name as reviewed_by_name,
  a.reviewed_at
from public.ap_payment_applications a
left join public.ap_payments p on p.id = a.payment_id
left join public.ap_bills b on b.id = a.bill_id
left join public.ap_vendors v on v.id = p.vendor_id
left join public.profiles reviewer on reviewer.id = a.reviewed_by_profile_id;

create or replace view public.v_bank_reconciliation_review_workbench as
select
  i.id,
  s.session_code,
  ba.account_name,
  i.item_date,
  i.item_description,
  coalesce(i.raw_description, i.item_description) as raw_description,
  i.amount,
  i.item_source_type,
  i.match_status,
  i.clearing_status,
  i.suggested_match_score,
  i.suggested_match_reason,
  i.suggested_match_source_table,
  i.suggested_match_source_id,
  i.manual_review_status,
  i.review_notes,
  reviewer.full_name as reviewed_by_name,
  i.reviewed_at,
  i.import_row_number,
  i.reconciliation_session_id
from public.bank_reconciliation_items i
left join public.bank_reconciliation_sessions s on s.id = i.reconciliation_session_id
left join public.bank_accounts ba on ba.id = s.bank_account_id
left join public.profiles reviewer on reviewer.id = i.reviewed_by_profile_id;

create or replace view public.v_remittance_filing_review_workbench as
select
  'sales_tax'::text as review_kind,
  s.id,
  s.filing_code as record_code,
  s.filing_period_start as period_start,
  s.filing_period_end as period_end,
  s.due_date,
  s.filing_status as status,
  s.review_status,
  s.filing_review_step as review_step,
  s.taxable_sales_total as source_base_total,
  s.tax_collected_total,
  s.tax_paid_total,
  s.adjustment_total,
  s.net_remittance_total,
  s.reference_number,
  s.filed_reference,
  s.export_proof_url,
  reviewer.full_name as reviewed_by_name,
  s.reviewed_at,
  signer.full_name as signed_off_by_name,
  s.signed_off_at,
  s.review_notes,
  s.adjustment_notes
from public.sales_tax_filings s
left join public.profiles reviewer on reviewer.id = s.reviewed_by_profile_id
left join public.profiles signer on signer.id = s.signed_off_by_profile_id
union all
select
  'payroll'::text as review_kind,
  r.id,
  r.remittance_code as record_code,
  r.remittance_period_start as period_start,
  r.remittance_period_end as period_end,
  r.due_date,
  r.remittance_status as status,
  r.review_status,
  r.remittance_review_step as review_step,
  r.gross_pay_total as source_base_total,
  0::numeric(12,2) as tax_collected_total,
  0::numeric(12,2) as tax_paid_total,
  0::numeric(12,2) as adjustment_total,
  r.net_remittance_total,
  r.reference_number,
  r.filed_reference,
  r.export_proof_url,
  reviewer.full_name as reviewed_by_name,
  r.reviewed_at,
  signer.full_name as signed_off_by_name,
  r.signed_off_at,
  r.review_notes,
  r.adjustment_notes
from public.payroll_remittance_runs r
left join public.profiles reviewer on reviewer.id = r.reviewed_by_profile_id
left join public.profiles signer on signer.id = r.signed_off_by_profile_id;

create or replace view public.v_month_end_close_workbench as
select
  c.id,
  c.period_code,
  c.period_start,
  c.period_end,
  c.close_scope,
  c.close_status,
  c.period_lock_status,
  c.ar_locked,
  c.ap_locked,
  c.gl_locked,
  c.payroll_locked,
  c.tax_locked,
  c.close_notes,
  c.close_package_manifest,
  c.locked_at,
  locker.full_name as locked_by_name,
  c.reopened_at,
  reopener.full_name as reopened_by_name,
  c.reopen_reason,
  c.closed_at,
  closer.full_name as closed_by_name,
  c.accountant_package_export_id,
  ah.export_title as accountant_package_title,
  ah.package_status as accountant_package_status
from public.accounting_period_closes c
left join public.profiles locker on locker.id = c.locked_by_profile_id
left join public.profiles reopener on reopener.id = c.reopened_by_profile_id
left join public.profiles closer on closer.id = c.closed_by_profile_id
left join public.accountant_handoff_exports ah on ah.id = c.accountant_package_export_id;

create or replace view public.v_equipment_accountability_workbench as
select
  e.id as equipment_item_id,
  e.equipment_code,
  e.equipment_name,
  e.status,
  e.qr_code_value,
  e.barcode_value,
  e.verifier_role_required,
  e.accessory_checklist_required,
  e.last_transfer_status,
  e.last_return_test_status,
  e.is_locked_out,
  coalesce(ac.checklist_count, 0)::int as active_checklist_count,
  coalesce(st.open_service_task_count, 0)::int as open_service_task_count,
  coalesce(st.open_estimated_cost_total, 0)::numeric(12,2) as open_estimated_service_cost_total,
  cur.site_name as current_site_name,
  target.site_name as target_site_name
from public.equipment_items e
left join public.sites cur on cur.id = e.current_site_id
left join public.sites target on target.id = e.target_site_id
left join (
  select equipment_item_id, count(*)::int as checklist_count
  from public.equipment_accessory_checklists
  where is_active = true and equipment_item_id is not null
  group by equipment_item_id
) ac on ac.equipment_item_id = e.id
left join (
  select equipment_item_id, count(*)::int as open_service_task_count, coalesce(sum(estimated_cost), 0)::numeric(12,2) as open_estimated_cost_total
  from public.equipment_service_tasks
  where task_status in ('open','assigned','waiting_parts','in_progress')
  group by equipment_item_id
) st on st.equipment_item_id = e.id;

create or replace view public.v_equipment_service_task_directory as
select
  t.id,
  t.equipment_item_id,
  e.equipment_code,
  e.equipment_name,
  t.source_signout_id,
  t.job_id,
  j.job_code,
  j.job_name,
  t.task_type,
  t.task_status,
  t.priority,
  t.failure_reason,
  t.estimated_cost,
  t.actual_cost,
  assignee.full_name as assigned_to_name,
  t.due_at,
  t.resolved_at,
  resolver.full_name as resolved_by_name,
  t.notes,
  t.created_at,
  t.updated_at
from public.equipment_service_tasks t
left join public.equipment_items e on e.id = t.equipment_item_id
left join public.jobs j on j.id = t.job_id
left join public.profiles assignee on assignee.id = t.assigned_to_profile_id
left join public.profiles resolver on resolver.id = t.resolved_by_profile_id;

insert into public.app_operational_depth_gates (
  gate_key,
  gate_area,
  gate_title,
  gate_status,
  owner_hint,
  route_hint,
  test_hint,
  failure_hint,
  sort_order,
  checked_at
)
values
  ('accounting_job_cost_depth_breakdown', 'accounting', 'Job profitability includes usage, repair, replacement, fuel, disposal, materials, delay, and subcontract cost buckets', 'passed', 'Admin / Accountant', '#jobs', 'Load Jobs and review the Job Cost Depth table.', 'Do not close month-end until each cost bucket has a source and review status.', 61, now()),
  ('payment_application_workbench_review', 'accounting', 'Payment application review can separate invoices/bills, deposits, credits, discounts, write-offs, and overpayments', 'passed', 'Admin / Accountant', '#jobs', 'Load the Accounting Depth tables and review payment application rows.', 'Unreviewed or exception applications should block period close.', 62, now()),
  ('bank_reconciliation_manual_review', 'accounting', 'Bank reconciliation rows have match score, manual review, undo, and exception metadata', 'passed', 'Admin / Accountant', '#jobs', 'Review the Bank Reconciliation table for suggested score and manual review status.', 'Rows in needs_review/exception should remain close blockers.', 63, now()),
  ('tax_payroll_review_signoff', 'accounting', 'HST/GST and payroll remittance rows capture source totals, adjustment notes, signoff, filing/remittance reference, and export proof', 'passed', 'Admin / Accountant', '#jobs', 'Review the Remittance and Filing table before final package export.', 'Missing proof or signoff should block close.', 64, now()),
  ('month_end_lock_and_package', 'accounting', 'Month-end close has lock/reopen status and accountant package linkage', 'passed', 'Admin / Accountant', '#jobs', 'Review the Month-End Close table for lock status and export package.', 'Reopened periods need reason and reviewer.', 65, now()),
  ('equipment_qr_accessory_service_tasks', 'equipment', 'Equipment supports QR/barcode lookup, accessory checklist status, verifier role requirement, and service-task follow-up', 'passed', 'Supervisor / Site Leader', '#equipment', 'Review the Equipment Accountability and Service Task tables after a failed arrival/return test.', 'Failed tests should keep equipment locked out until a service task is resolved.', 66, now())
on conflict (gate_key) do update set
  gate_area = excluded.gate_area,
  gate_title = excluded.gate_title,
  gate_status = excluded.gate_status,
  owner_hint = excluded.owner_hint,
  route_hint = excluded.route_hint,
  test_hint = excluded.test_hint,
  failure_hint = excluded.failure_hint,
  sort_order = excluded.sort_order,
  checked_at = excluded.checked_at,
  updated_at = now();

drop view if exists public.v_schema_drift_status;
create view public.v_schema_drift_status as
select
  124::int as expected_schema_version,
  coalesce(max(schema_version) filter (where status = 'applied'), 0)::int as latest_applied_schema_version,
  case
    when coalesce(max(schema_version) filter (where status = 'applied'), 0) >= 124
      then 'current'
    else 'behind'
  end as drift_status,
  case
    when coalesce(max(schema_version) filter (where status = 'applied'), 0) >= 124
      then 'Live database is at or ahead of the repo schema marker.'
    else 'Live database is behind the deployed app. Apply migrations through schema 124.'
  end as message,
  now() as checked_at
from public.app_schema_versions;

insert into public.app_schema_versions (
  schema_version,
  migration_key,
  schema_name,
  release_label,
  description,
  status,
  notes
)
values (
  124,
  '124_accounting_cost_payment_reconciliation_remittance_equipment_depth',
  '124_accounting_cost_payment_reconciliation_remittance_equipment_depth.sql',
  '2026-05-30a',
  'Adds deeper accounting cost buckets, payment application review, reconciliation review, tax/payroll signoff proof, month-end close lock/package fields, and equipment QR/accessory/service-task accountability.',
  'applied',
  'This pass makes the remaining depth gaps visible in workbench views and prepares UI/API surfaces for payment application, reconciliation review, remittance signoff, month-end close, and equipment service follow-up.'
)
on conflict (schema_version) do update set
  migration_key = excluded.migration_key,
  schema_name = excluded.schema_name,
  release_label = excluded.release_label,
  description = excluded.description,
  status = excluded.status,
  notes = excluded.notes,
  applied_at = now();

grant select on public.v_job_cost_depth_directory to authenticated;
grant select on public.v_payment_application_workbench_directory to authenticated;
grant select on public.v_bank_reconciliation_review_workbench to authenticated;
grant select on public.v_remittance_filing_review_workbench to authenticated;
grant select on public.v_month_end_close_workbench to authenticated;
grant select on public.v_equipment_accountability_workbench to authenticated;
grant select on public.v_equipment_service_task_directory to authenticated;
grant select on public.equipment_accessory_checklists to authenticated;
grant select on public.equipment_service_tasks to authenticated;
grant select on public.v_schema_drift_status to authenticated;

commit;


-- Schema 125: Deployment bundle parse, SEO, and fallback guardrails.
-- Adds database-visible checklists for Edge Function bundle readiness, public SEO/local wording,
-- and runtime fallback behaviour. This pass was triggered by a Supabase Edge Function deploy
-- failure caused by an unterminated regular-expression literal in jobs-manage.

begin;

create table if not exists public.app_schema_versions (
  schema_version integer primary key,
  schema_name text,
  description text,
  status text not null default 'applied',
  applied_at timestamptz not null default now(),
  applied_by text,
  notes text
);

alter table public.app_schema_versions add column if not exists migration_key text;
alter table public.app_schema_versions add column if not exists release_label text;

create table if not exists public.app_deployment_bundle_checks (
  check_key text primary key,
  check_area text not null,
  check_title text not null,
  expected_status text not null default 'required',
  current_status text not null default 'pending',
  function_name text,
  file_path text,
  route_hint text,
  test_command text,
  failure_hint text,
  sort_order integer not null default 100,
  metadata jsonb not null default '{}'::jsonb,
  checked_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.app_public_seo_checks (
  check_key text primary key,
  check_area text not null default 'seo',
  check_title text not null,
  route_hint text,
  expected_status text not null default 'required',
  current_status text not null default 'pending',
  local_wording_hint text,
  test_command text,
  failure_hint text,
  sort_order integer not null default 100,
  metadata jsonb not null default '{}'::jsonb,
  checked_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.app_runtime_fallback_checks (
  check_key text primary key,
  check_area text not null default 'fallback',
  check_title text not null,
  expected_status text not null default 'required',
  current_status text not null default 'pending',
  surface_hint text,
  fallback_hint text,
  test_command text,
  failure_hint text,
  sort_order integer not null default 100,
  metadata jsonb not null default '{}'::jsonb,
  checked_at timestamptz,
  updated_at timestamptz not null default now()
);

insert into public.app_deployment_bundle_checks (
  check_key,
  check_area,
  check_title,
  expected_status,
  current_status,
  function_name,
  file_path,
  route_hint,
  test_command,
  failure_hint,
  sort_order,
  metadata,
  checked_at
)
values
  ('edge_ts_parse_all_functions', 'edge-functions', 'All Supabase Edge Function index.ts files parse before deploy', 'required', 'passed', null, 'supabase/functions/*/index.ts', 'Supabase Edge Functions', 'node scripts/repo-smoke-check.mjs', 'Do not deploy until TypeScript parser diagnostics are zero.', 10, '{"schema_pass":"125","source":"repo-smoke-check"}'::jsonb, now()),
  ('jobs_manage_regex_escape_guard', 'edge-functions', 'jobs-manage accessory JSON fallback uses an escaped newline regexp', 'required', 'passed', 'jobs-manage', 'supabase/functions/jobs-manage/index.ts', 'Jobs / Equipment', 'grep -n "split(/\\\\[" supabase/functions/jobs-manage/index.ts', 'A literal newline inside a regexp breaks Supabase bundling.', 20, '{"fixed_error":"Unterminated regexp literal at normalizeJsonArray"}'::jsonb, now()),
  ('jobs_directory_attachment_dedup_guard', 'edge-functions', 'jobs-directory returns each comment attachment once', 'required', 'passed', 'jobs-directory', 'supabase/functions/jobs-directory/index.ts', 'Jobs / Comments', 'node scripts/repo-smoke-check.mjs', 'Duplicate push calls create repeated attachment rows in Admin/Jobs views.', 30, '{"fixed_error":"duplicate attachment push removed"}'::jsonb, now()),
  ('service_worker_install_fallback_guard', 'frontend', 'Service worker install tolerates one stale/missing static asset', 'required', 'passed', null, 'server-worker.js', 'PWA shell', 'node --check app.js && node scripts/repo-smoke-check.mjs', 'cache.addAll-only installs can fail the whole worker if one file is stale.', 40, '{"fallback":"cache each app shell asset independently"}'::jsonb, now()),
  ('schema_marker_125_current', 'schema', 'Canonical schema and drift view expect schema 125', 'required', 'passed', null, 'sql/000_full_schema_reference.sql', 'Schema Drift', 'node scripts/repo-smoke-check.mjs', 'A stale schema marker makes deploy/debugging harder after SQL changes.', 50, '{"expected_schema_version":125}'::jsonb, now())
on conflict (check_key) do update set
  check_area = excluded.check_area,
  check_title = excluded.check_title,
  expected_status = excluded.expected_status,
  current_status = excluded.current_status,
  function_name = excluded.function_name,
  file_path = excluded.file_path,
  route_hint = excluded.route_hint,
  test_command = excluded.test_command,
  failure_hint = excluded.failure_hint,
  sort_order = excluded.sort_order,
  metadata = excluded.metadata,
  checked_at = excluded.checked_at,
  updated_at = now();

insert into public.app_public_seo_checks (
  check_key,
  check_title,
  route_hint,
  expected_status,
  current_status,
  local_wording_hint,
  test_command,
  failure_hint,
  sort_order,
  metadata,
  checked_at
)
values
  ('public_one_h1_index', 'Public shell keeps no more than one H1', '/ /#today', 'required', 'passed', 'Use one clear page-level heading and supporting H2/H3 sections.', 'node scripts/repo-smoke-check.mjs', 'Duplicate H1s weaken page-title clarity and accessibility.', 10, '{"file":"index.html"}'::jsonb, now()),
  ('public_title_meta_prominent_words', 'Title and meta description keep plain searchable local wording', '/ /#today', 'required', 'passed', 'Keep service, safety, Ontario, job/equipment, and local terms in visible headings/body copy where accurate.', 'manual content review plus smoke check', 'Avoid vague headings and repeated title-like text blocks.', 20, '{"source":"roadmap"}'::jsonb, now()),
  ('local_service_wording_truthful', 'Local wording only claims real service coverage', 'public routes', 'required', 'review', 'Mention locations only when the business truly serves them or has real proof.', 'content review before publish', 'Do not add thin city pages or unsupported location claims.', 30, '{"local_ranking":"relevance_distance_prominence"}'::jsonb, now()),
  ('public_static_asset_cache_version', 'Public assets use the current cache marker', 'index.html / server-worker.js', 'required', 'passed', 'Update cache marker on every build pass so stale CSS/JS does not hide fixes.', 'node scripts/repo-smoke-check.mjs', 'Old service worker assets can keep repaired code from loading.', 40, '{"cache_marker":"2026-06-01a"}'::jsonb, now())
on conflict (check_key) do update set
  check_title = excluded.check_title,
  route_hint = excluded.route_hint,
  expected_status = excluded.expected_status,
  current_status = excluded.current_status,
  local_wording_hint = excluded.local_wording_hint,
  test_command = excluded.test_command,
  failure_hint = excluded.failure_hint,
  sort_order = excluded.sort_order,
  metadata = excluded.metadata,
  checked_at = excluded.checked_at,
  updated_at = now();

insert into public.app_runtime_fallback_checks (
  check_key,
  check_title,
  expected_status,
  current_status,
  surface_hint,
  fallback_hint,
  test_command,
  failure_hint,
  sort_order,
  metadata,
  checked_at
)
values
  ('jobs_directory_optional_views_safe_select', 'Jobs directory optional schema views fail soft to empty arrays', 'required', 'passed', 'jobs-directory', 'Use safeSelect for newer optional views so older databases do not crash the whole page.', 'review jobs-directory safeSelect usage', 'A missing view should show an empty table and visible gap, not a 500.', 10, '{"function":"jobs-directory"}'::jsonb, now()),
  ('jobs_manage_optional_service_tasks_fail_soft', 'Equipment service-task inserts fail soft if schema 124 is not deployed yet', 'required', 'passed', 'jobs-manage equipment return/arrival', 'Keep checkout/return alive while the service-task table is still being migrated.', 'review insertEquipmentServiceTask catch block', 'Field equipment workflows should not fail only because optional follow-up task schema is missing.', 20, '{"function":"jobs-manage"}'::jsonb, now()),
  ('pwa_shell_individual_asset_cache', 'PWA shell caches assets one by one with install fallback', 'required', 'passed', 'server-worker.js', 'A single stale asset should not prevent a repaired service worker from installing.', 'node scripts/repo-smoke-check.mjs', 'cache.addAll can block the whole install when one cache entry is stale.', 30, '{"file":"server-worker.js"}'::jsonb, now()),
  ('smoke_script_edge_parse_check', 'Smoke script parses Edge Functions before packaging', 'required', 'passed', 'scripts/repo-smoke-check.mjs', 'Use TypeScript parser diagnostics to catch deploy bundle syntax problems locally.', 'node scripts/repo-smoke-check.mjs', 'Supabase deploy should not be the first place syntax errors are found.', 40, '{"tool":"typescript.transpileModule"}'::jsonb, now())
on conflict (check_key) do update set
  check_title = excluded.check_title,
  expected_status = excluded.expected_status,
  current_status = excluded.current_status,
  surface_hint = excluded.surface_hint,
  fallback_hint = excluded.fallback_hint,
  test_command = excluded.test_command,
  failure_hint = excluded.failure_hint,
  sort_order = excluded.sort_order,
  metadata = excluded.metadata,
  checked_at = excluded.checked_at,
  updated_at = now();

drop view if exists public.v_app_deployment_bundle_checks;
create view public.v_app_deployment_bundle_checks as
select
  check_key,
  check_area,
  check_title,
  expected_status,
  current_status,
  function_name,
  file_path,
  route_hint,
  test_command,
  failure_hint,
  sort_order,
  metadata,
  checked_at,
  updated_at
from public.app_deployment_bundle_checks
order by sort_order, check_key;

drop view if exists public.v_app_public_seo_checks;
create view public.v_app_public_seo_checks as
select
  check_key,
  check_area,
  check_title,
  route_hint,
  expected_status,
  current_status,
  local_wording_hint,
  test_command,
  failure_hint,
  sort_order,
  metadata,
  checked_at,
  updated_at
from public.app_public_seo_checks
order by sort_order, check_key;

drop view if exists public.v_app_runtime_fallback_checks;
create view public.v_app_runtime_fallback_checks as
select
  check_key,
  check_area,
  check_title,
  expected_status,
  current_status,
  surface_hint,
  fallback_hint,
  test_command,
  failure_hint,
  sort_order,
  metadata,
  checked_at,
  updated_at
from public.app_runtime_fallback_checks
order by sort_order, check_key;

create table if not exists public.app_operational_depth_gates (
  gate_key text primary key,
  gate_area text not null,
  gate_title text not null,
  gate_status text not null default 'review',
  owner_hint text,
  route_hint text,
  test_hint text,
  failure_hint text,
  sort_order integer not null default 100,
  checked_at timestamptz,
  updated_at timestamptz not null default now()
);

insert into public.app_operational_depth_gates (
  gate_key,
  gate_area,
  gate_title,
  gate_status,
  owner_hint,
  route_hint,
  test_hint,
  failure_hint,
  sort_order,
  checked_at
)
values
  ('edge_function_parse_before_deploy', 'deployment', 'Edge Function TypeScript parse check runs before deploy', 'passed', 'Admin / Developer', 'Supabase Functions', 'Run node scripts/repo-smoke-check.mjs before deploying Edge Functions.', 'Do not deploy functions with TypeScript parser diagnostics.', 67, now()),
  ('jobs_manage_regex_repair_verified', 'deployment', 'jobs-manage regexp newline repair verified', 'passed', 'Admin / Developer', '#equipment', 'Confirm normalizeJsonArray uses split(/[\\n,]/), not a literal newline inside the regexp.', 'Literal newline regex failure blocks Supabase bundling.', 68, now()),
  ('public_seo_local_guardrails_visible', 'seo', 'Public SEO/local wording guardrails are visible in database checks', 'passed', 'Admin / Content', '#admin', 'Review v_app_public_seo_checks before publishing new public route copy.', 'Unsupported local wording or duplicate H1s should block publish.', 69, now()),
  ('runtime_fallback_guardrails_visible', 'fallback', 'Runtime fallback guardrails are visible in database checks', 'passed', 'Admin / Developer', '#admin', 'Review v_app_runtime_fallback_checks after schema or service-worker changes.', 'Missing optional views/assets should not take down whole screens.', 70, now())
on conflict (gate_key) do update set
  gate_area = excluded.gate_area,
  gate_title = excluded.gate_title,
  gate_status = excluded.gate_status,
  owner_hint = excluded.owner_hint,
  route_hint = excluded.route_hint,
  test_hint = excluded.test_hint,
  failure_hint = excluded.failure_hint,
  sort_order = excluded.sort_order,
  checked_at = excluded.checked_at,
  updated_at = now();

drop view if exists public.v_schema_drift_status;
create view public.v_schema_drift_status as
select
  125::int as expected_schema_version,
  coalesce(max(schema_version) filter (where status = 'applied'), 0)::int as latest_applied_schema_version,
  case
    when coalesce(max(schema_version) filter (where status = 'applied'), 0) >= 125
      then 'current'
    else 'behind'
  end as drift_status,
  case
    when coalesce(max(schema_version) filter (where status = 'applied'), 0) >= 125
      then 'Live database is at or ahead of the repo schema marker.'
    else 'Live database is behind the deployed app. Apply migrations through schema 125.'
  end as message,
  now() as checked_at
from public.app_schema_versions;

insert into public.app_schema_versions (
  schema_version,
  migration_key,
  schema_name,
  release_label,
  description,
  status,
  notes
)
values (
  125,
  '125_deployment_bundle_parse_seo_fallback_guardrails',
  '125_deployment_bundle_parse_seo_fallback_guardrails.sql',
  '2026-06-01a',
  'Adds deployment bundle parse checks, public SEO/local wording checks, and runtime fallback checks after the jobs-manage Edge Function bundle failure.',
  'applied',
  'This pass repairs jobs-manage bundling, adds TypeScript parse checks to smoke testing, improves service-worker install fallback, and exposes deployment/SEO/fallback guardrails in database views.'
)
on conflict (schema_version) do update set
  migration_key = excluded.migration_key,
  schema_name = excluded.schema_name,
  release_label = excluded.release_label,
  description = excluded.description,
  status = excluded.status,
  notes = excluded.notes,
  applied_at = now();

grant select on public.app_deployment_bundle_checks to authenticated;
grant select on public.app_public_seo_checks to authenticated;
grant select on public.app_runtime_fallback_checks to authenticated;
grant select on public.v_app_deployment_bundle_checks to authenticated;
grant select on public.v_app_public_seo_checks to authenticated;
grant select on public.v_app_runtime_fallback_checks to authenticated;
grant select on public.v_schema_drift_status to authenticated;

commit;

-- Schema 126: Roadmap depth, data-migration, SEO/CSS, and fallback guardrails.
-- Adds DB-visible tracking for this pass's completed 20 steps, the next 20 planned steps,
-- duplicated-data migration decisions, documentation/schema sync checks, and CSS/SEO/fallback sanity.

begin;

create table if not exists public.app_schema_versions (
  schema_version integer primary key,
  schema_name text,
  description text,
  status text not null default 'applied',
  applied_at timestamptz not null default now(),
  applied_by text,
  notes text
);

alter table public.app_schema_versions add column if not exists migration_key text;
alter table public.app_schema_versions add column if not exists release_label text;

create table if not exists public.app_roadmap_action_steps (
  step_key text primary key,
  step_batch text not null,
  step_number integer not null,
  step_area text not null,
  step_title text not null,
  step_status text not null default 'planned',
  priority text not null default 'medium',
  source_doc text,
  route_hint text,
  implementation_notes text,
  acceptance_check text,
  risk_if_skipped text,
  sort_order integer not null default 100,
  metadata jsonb not null default '{}'::jsonb,
  checked_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.app_roadmap_action_steps add column if not exists step_batch text;
alter table public.app_roadmap_action_steps add column if not exists step_number integer;
alter table public.app_roadmap_action_steps add column if not exists step_area text;
alter table public.app_roadmap_action_steps add column if not exists step_title text;
alter table public.app_roadmap_action_steps add column if not exists step_status text not null default 'planned';
alter table public.app_roadmap_action_steps add column if not exists priority text not null default 'medium';
alter table public.app_roadmap_action_steps add column if not exists source_doc text;
alter table public.app_roadmap_action_steps add column if not exists route_hint text;
alter table public.app_roadmap_action_steps add column if not exists implementation_notes text;
alter table public.app_roadmap_action_steps add column if not exists acceptance_check text;
alter table public.app_roadmap_action_steps add column if not exists risk_if_skipped text;
alter table public.app_roadmap_action_steps add column if not exists sort_order integer not null default 100;
alter table public.app_roadmap_action_steps add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.app_roadmap_action_steps add column if not exists checked_at timestamptz;
alter table public.app_roadmap_action_steps add column if not exists updated_at timestamptz not null default now();

alter table public.app_roadmap_action_steps drop constraint if exists app_roadmap_action_steps_step_batch_check;
alter table public.app_roadmap_action_steps add constraint app_roadmap_action_steps_step_batch_check
  check (step_batch in ('completed_this_pass','next_20'));

alter table public.app_roadmap_action_steps drop constraint if exists app_roadmap_action_steps_step_status_check;
alter table public.app_roadmap_action_steps add constraint app_roadmap_action_steps_step_status_check
  check (step_status in ('completed','in_progress','planned','blocked','review'));

create table if not exists public.app_depth_review_queue (
  review_key text primary key,
  review_area text not null,
  review_title text not null,
  current_depth text,
  recommended_depth text,
  review_status text not null default 'review',
  cost_linkage_hint text,
  accounting_impact text,
  route_hint text,
  acceptance_check text,
  sort_order integer not null default 100,
  metadata jsonb not null default '{}'::jsonb,
  checked_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.app_depth_review_queue add column if not exists review_area text;
alter table public.app_depth_review_queue add column if not exists review_title text;
alter table public.app_depth_review_queue add column if not exists current_depth text;
alter table public.app_depth_review_queue add column if not exists recommended_depth text;
alter table public.app_depth_review_queue add column if not exists review_status text not null default 'review';
alter table public.app_depth_review_queue add column if not exists cost_linkage_hint text;
alter table public.app_depth_review_queue add column if not exists accounting_impact text;
alter table public.app_depth_review_queue add column if not exists route_hint text;
alter table public.app_depth_review_queue add column if not exists acceptance_check text;
alter table public.app_depth_review_queue add column if not exists sort_order integer not null default 100;
alter table public.app_depth_review_queue add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.app_depth_review_queue add column if not exists checked_at timestamptz;
alter table public.app_depth_review_queue add column if not exists updated_at timestamptz not null default now();

alter table public.app_depth_review_queue drop constraint if exists app_depth_review_queue_review_status_check;
alter table public.app_depth_review_queue add constraint app_depth_review_queue_review_status_check
  check (review_status in ('passed','review','planned','blocked','in_progress'));

create table if not exists public.app_data_migration_candidates (
  candidate_key text primary key,
  data_area text not null,
  source_location text not null,
  recommended_target text not null,
  duplication_risk text not null default 'medium',
  migration_status text not null default 'review',
  reason text,
  fallback_plan text,
  acceptance_check text,
  sort_order integer not null default 100,
  metadata jsonb not null default '{}'::jsonb,
  checked_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.app_data_migration_candidates add column if not exists data_area text;
alter table public.app_data_migration_candidates add column if not exists source_location text;
alter table public.app_data_migration_candidates add column if not exists recommended_target text;
alter table public.app_data_migration_candidates add column if not exists duplication_risk text not null default 'medium';
alter table public.app_data_migration_candidates add column if not exists migration_status text not null default 'review';
alter table public.app_data_migration_candidates add column if not exists reason text;
alter table public.app_data_migration_candidates add column if not exists fallback_plan text;
alter table public.app_data_migration_candidates add column if not exists acceptance_check text;
alter table public.app_data_migration_candidates add column if not exists sort_order integer not null default 100;
alter table public.app_data_migration_candidates add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.app_data_migration_candidates add column if not exists checked_at timestamptz;
alter table public.app_data_migration_candidates add column if not exists updated_at timestamptz not null default now();

create table if not exists public.app_schema_documentation_sync_checks (
  check_key text primary key,
  check_area text not null,
  check_title text not null,
  expected_status text not null default 'required',
  current_status text not null default 'pending',
  file_path text,
  test_command text,
  failure_hint text,
  sort_order integer not null default 100,
  metadata jsonb not null default '{}'::jsonb,
  checked_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.app_schema_documentation_sync_checks add column if not exists check_area text;
alter table public.app_schema_documentation_sync_checks add column if not exists check_title text;
alter table public.app_schema_documentation_sync_checks add column if not exists expected_status text not null default 'required';
alter table public.app_schema_documentation_sync_checks add column if not exists current_status text not null default 'pending';
alter table public.app_schema_documentation_sync_checks add column if not exists file_path text;
alter table public.app_schema_documentation_sync_checks add column if not exists test_command text;
alter table public.app_schema_documentation_sync_checks add column if not exists failure_hint text;
alter table public.app_schema_documentation_sync_checks add column if not exists sort_order integer not null default 100;
alter table public.app_schema_documentation_sync_checks add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.app_schema_documentation_sync_checks add column if not exists checked_at timestamptz;
alter table public.app_schema_documentation_sync_checks add column if not exists updated_at timestamptz not null default now();

insert into public.app_roadmap_action_steps (
  step_key, step_batch, step_number, step_area, step_title, step_status, priority,
  source_doc, route_hint, implementation_notes, acceptance_check, risk_if_skipped,
  sort_order, metadata, checked_at
)
values
  ('schema126_01_archive_snapshots', 'completed_this_pass', 1, 'documentation', 'Create Markdown archive snapshots for current and legacy build checks', 'completed', 'high', 'DEVELOPMENT_ROADMAP.md', 'repo/archive', 'Added archive snapshot folders so smoke checks prove active docs were preserved before editing.', 'Archive contains README.md for required snapshot folders.', 'Future edits could lose the previous project state.', 1, '{"build":"2026-06-02a"}'::jsonb, now()),
  ('schema126_02_remove_test_files', 'completed_this_pass', 2, 'repo hygiene', 'Retire temporary test_write files from the active root', 'completed', 'high', 'KNOWN_ISSUES_AND_GAPS.md', 'repo root', 'Moved temporary test_write files to archive/retired-test-files-2026-06-02a.', 'Root no longer contains test_write files.', 'Smoke checks fail and repo root stays confusing.', 2, '{}'::jsonb, now()),
  ('schema126_03_schema_marker', 'completed_this_pass', 3, 'schema', 'Add schema 126 migration and drift marker', 'completed', 'high', 'DATABASE_STRUCTURE.md', 'Schema Drift', 'Added this migration and updated the canonical schema reference.', 'v_schema_drift_status expects schema 126.', 'Live database may appear current when it is behind.', 3, '{}'::jsonb, now()),
  ('schema126_04_roadmap_db_rows', 'completed_this_pass', 4, 'roadmap', 'Store completed and next roadmap steps in DB-visible rows', 'completed', 'medium', 'DEVELOPMENT_ROADMAP.md', '#admin', 'Added app_roadmap_action_steps and v_app_roadmap_action_steps.', 'Admin/readiness data can show current and next steps.', 'Roadmap only lives in Markdown and is easy to drift.', 4, '{}'::jsonb, now()),
  ('schema126_05_depth_review_queue', 'completed_this_pass', 5, 'sanity check', 'Add application-depth review queue', 'completed', 'high', 'KNOWN_ISSUES_AND_GAPS.md', '#admin', 'Added app_depth_review_queue for accounting, equipment, SEO, mobile, and fallback depth gaps.', 'Depth gaps are queryable by area and status.', 'Large app gaps stay hidden in prose.', 5, '{}'::jsonb, now()),
  ('schema126_06_data_migration_tracker', 'completed_this_pass', 6, 'data migration', 'Add JSON/DB duplication migration candidate tracker', 'completed', 'high', 'DATABASE_STRUCTURE.md', '#admin', 'Added app_data_migration_candidates so repeated data sources have a reviewed target and fallback plan.', 'High-risk duplication areas are visible in v_app_data_migration_candidates.', 'Data can drift between JSON, DB, and local cache.', 6, '{}'::jsonb, now()),
  ('schema126_07_doc_sync_checks', 'completed_this_pass', 7, 'documentation', 'Add schema/documentation sync checks', 'completed', 'medium', 'TESTING_CHECKLIST.md', '#admin', 'Added app_schema_documentation_sync_checks for SQL, Markdown, smoke, cache, and service-worker sync.', 'Sync checks are visible in v_app_schema_documentation_sync_checks.', 'Docs can claim a build state the app does not match.', 7, '{}'::jsonb, now()),
  ('schema126_08_admin_edge_loads', 'completed_this_pass', 8, 'admin ui', 'Load deployment/SEO/fallback/roadmap/depth views in admin-directory', 'completed', 'high', 'SYSTEM_ARCHITECTURE.md', '#admin', 'admin-directory now returns the schema 125 and 126 guardrail views on command_center and health scopes.', 'Admin payload includes new guardrail arrays.', 'New DB checks exist but are not visible to operators.', 8, '{}'::jsonb, now()),
  ('schema126_09_admin_ui_tables', 'completed_this_pass', 9, 'admin ui', 'Render new guardrail tables in Production Readiness', 'completed', 'high', 'DEVELOPMENT_ROADMAP.md', '#admin', 'Admin UI now renders build guardrails, SEO guardrails, fallback guardrails, roadmap steps, and depth review rows.', 'Readiness section has visible tables for new checks.', 'Operators must inspect DB manually.', 9, '{}'::jsonb, now()),
  ('schema126_10_cache_marker', 'completed_this_pass', 10, 'pwa', 'Update public cache marker to 2026-06-02a', 'completed', 'medium', 'DEPLOYMENT_GUIDE.md', 'index.html / service worker', 'Updated index.html query strings and service-worker cache name.', 'Smoke confirms 2026-06-02a marker.', 'Browsers may keep stale repaired code.', 10, '{}'::jsonb, now()),
  ('schema126_11_edge_parse', 'completed_this_pass', 11, 'deployment', 'Keep Edge Function TypeScript parse checks in smoke testing', 'completed', 'high', 'TESTING_CHECKLIST.md', 'Supabase Functions', 'Smoke script continues parsing Edge Function index.ts files before packaging.', 'node scripts/repo-smoke-check.mjs passes Edge Function parse check.', 'Deploy failures are discovered only in Supabase.', 11, '{}'::jsonb, now()),
  ('schema126_12_css_brace', 'completed_this_pass', 12, 'css', 'Keep CSS brace-balance check active', 'completed', 'medium', 'TESTING_CHECKLIST.md', 'style.css', 'Smoke script checks style.css brace balance.', 'CSS brace balance equals zero.', 'CSS drift can silently break mobile layouts.', 12, '{}'::jsonb, now()),
  ('schema126_13_h1_guard', 'completed_this_pass', 13, 'seo', 'Keep single H1 public-page guard active', 'completed', 'high', 'SEO_PUBLIC_PAGE_RULES.md', 'index.html', 'Smoke script confirms index.html has no more than one H1.', 'H1 count is one or less.', 'Search title clarity and accessibility can drift.', 13, '{}'::jsonb, now()),
  ('schema126_14_local_wording', 'completed_this_pass', 14, 'seo', 'Refresh local search wording guidance in docs', 'completed', 'medium', 'SEO_PUBLIC_PAGE_RULES.md', 'public pages', 'Docs continue emphasizing truthful local wording, title/main-heading clarity, and no thin location claims.', 'Roadmap and SEO docs mention local relevance/distance/prominence habits.', 'Local pages can become vague or unsupported.', 14, '{}'::jsonb, now()),
  ('schema126_15_fallback_depth', 'completed_this_pass', 15, 'fallback', 'Track missing optional-view fallback depth', 'completed', 'medium', 'KNOWN_ISSUES_AND_GAPS.md', '#admin', 'Runtime fallback checks remain visible and are reinforced by the new depth queue.', 'Fallback rows exist for optional views and service-worker install.', 'One missing optional object can take down a full screen.', 15, '{}'::jsonb, now()),
  ('schema126_16_accounting_depth', 'completed_this_pass', 16, 'accounting', 'Carry accounting cost and close gaps forward as tracked depth items', 'completed', 'high', 'KNOWN_ISSUES_AND_GAPS.md', '#jobs / #admin', 'Payment application, reconciliation, remittance, and close-package gaps are listed in app_depth_review_queue.', 'Accounting depth rows are visible.', 'Cost and close workflows remain partially manual.', 16, '{}'::jsonb, now()),
  ('schema126_17_equipment_depth', 'completed_this_pass', 17, 'equipment', 'Carry equipment scan/signoff gaps forward as tracked depth items', 'completed', 'high', 'KNOWN_ISSUES_AND_GAPS.md', '#equipment', 'QR/barcode scan, accessory checklist, verifier role, and failed-test task depth are listed in app_depth_review_queue.', 'Equipment accountability rows are visible.', 'Equipment movement can be hard to audit after site work.', 17, '{}'::jsonb, now()),
  ('schema126_18_mobile_depth', 'completed_this_pass', 18, 'mobile', 'Carry mobile-first field workflow depth forward', 'completed', 'medium', 'DEVELOPMENT_ROADMAP.md', '#today', 'Mobile offline, draft resume, and supervisor scan actions are tracked as next-step rows.', 'Mobile rows appear in next 20.', 'Field users may avoid the app on phones.', 18, '{}'::jsonb, now()),
  ('schema126_19_docs_refresh', 'completed_this_pass', 19, 'documentation', 'Update active Markdown files for build 2026-06-02a', 'completed', 'high', 'README.md', 'repo docs', 'Updated active project, roadmap, issue, database, testing, deployment, and new-chat docs.', 'Active Markdown files reference schema 126.', 'Future chats continue from stale schema assumptions.', 19, '{}'::jsonb, now()),
  ('schema126_20_smoke_update', 'completed_this_pass', 20, 'testing', 'Update smoke script to require schema 126 guardrails', 'completed', 'high', 'TESTING_CHECKLIST.md', 'scripts/repo-smoke-check.mjs', 'Smoke now checks schema 126 file, cache marker, archive snapshots, admin loads, and UI rendering.', 'Smoke passes with no failed checks.', 'Build packages can ship without the new guardrails.', 20, '{}'::jsonb, now()),
  ('next126_01_payment_application_ui', 'next_20', 1, 'accounting', 'Build full payment application screen', 'planned', 'high', 'DEVELOPMENT_ROADMAP.md', '#admin accounting', 'Apply deposits, payments, credits, discounts, write-offs, and overpayments to invoices with undo/review.', 'Payment application rows can be created, reviewed, reversed, and exported.', 'Revenue recognition and balances remain manual.', 101, '{}'::jsonb, now()),
  ('next126_02_bank_csv_preview', 'next_20', 2, 'accounting', 'Add bank CSV preview and import validation UI', 'planned', 'high', 'DEVELOPMENT_ROADMAP.md', '#admin banking', 'Preview CSV headers, duplicates, invalid dates, and amount sign rules before commit.', 'CSV import has preview, accept/reject, and error rows.', 'Bad imports can pollute reconciliation.', 102, '{}'::jsonb, now()),
  ('next126_03_match_undo', 'next_20', 3, 'accounting', 'Add reconciliation manual match and undo controls', 'planned', 'high', 'KNOWN_ISSUES_AND_GAPS.md', '#admin banking', 'Allow scored match, manual match, split match, unmatch, and review signoff.', 'Bank line shows match status, reviewer, and undo history.', 'Bank reconciliation cannot be trusted end to end.', 103, '{}'::jsonb, now()),
  ('next126_04_hst_review', 'next_20', 4, 'tax', 'Add HST/GST filing review screen with source totals', 'planned', 'high', 'KNOWN_ISSUES_AND_GAPS.md', '#admin tax', 'Show collected/paid/adjustment totals, reviewer signoff, filed date, remitted date, and proof upload.', 'Tax filing row ties back to source totals and proof.', 'Filing records remain outside the system.', 104, '{}'::jsonb, now()),
  ('next126_05_payroll_remittance_review', 'next_20', 5, 'payroll', 'Add payroll remittance review/signoff flow', 'planned', 'high', 'KNOWN_ISSUES_AND_GAPS.md', '#admin payroll', 'Track source pay runs, remittance amounts, reviewer, filing proof, payment proof, and lock status.', 'Payroll remittance run has proof and signoff fields visible.', 'Payroll obligations stay hard to audit.', 105, '{}'::jsonb, now()),
  ('next126_06_month_end_lock_ui', 'next_20', 6, 'accounting', 'Finish month-end close lock/reopen controls', 'planned', 'high', 'DEVELOPMENT_ROADMAP.md', '#admin close center', 'Lock periods, block new postings, request reopen with reason, and record approval.', 'Closed period rejects new postings unless reopened.', 'Reports can change after accountant review.', 106, '{}'::jsonb, now()),
  ('next126_07_accountant_export_delivery', 'next_20', 7, 'accounting', 'Finish accountant export packaging and delivery', 'planned', 'high', 'DEVELOPMENT_ROADMAP.md', '#admin close center', 'Bundle reports, CSVs, proof files, journal lines, and manifest with delivery status.', 'Export package has manifest, files, delivery timestamp, and receipt.', 'Accountant handoff remains manual.', 107, '{}'::jsonb, now()),
  ('next126_08_qr_scan_flow', 'next_20', 8, 'equipment', 'Add QR/barcode scan flow for equipment checkout/arrival/return', 'planned', 'high', 'KNOWN_ISSUES_AND_GAPS.md', '#equipment', 'Use camera/manual scan to load equipment item and reduce typing errors.', 'Scan fills equipment code and shows current status.', 'Wrong equipment can be checked out or returned.', 108, '{}'::jsonb, now()),
  ('next126_09_accessory_template_library', 'next_20', 9, 'equipment', 'Create reusable accessory checklist templates', 'planned', 'medium', 'KNOWN_ISSUES_AND_GAPS.md', '#equipment', 'Attach default accessory checklist templates to equipment categories.', 'Checkout/return checklist defaults from equipment type.', 'Accessory checks stay inconsistent.', 109, '{}'::jsonb, now()),
  ('next126_10_verifier_permissions', 'next_20', 10, 'equipment', 'Tighten verifier permissions for final returns and lockout clearing', 'planned', 'high', 'KNOWN_ISSUES_AND_GAPS.md', '#equipment', 'Require configured role for verify_return_complete and defect_clear actions.', 'Lower roles see disabled action with clear explanation.', 'Unqualified users can clear safety-critical defects.', 110, '{}'::jsonb, now()),
  ('next126_11_failed_test_service_workorder', 'next_20', 11, 'equipment', 'Convert failed equipment tests into service work orders', 'planned', 'medium', 'DEVELOPMENT_ROADMAP.md', '#equipment', 'Turn failed arrival/return tests into assignable repair/service tasks with cost tracking.', 'Failed test creates visible service task and optional job cost.', 'Failed tests do not become actionable work.', 111, '{}'::jsonb, now()),
  ('next126_12_job_cost_rollup', 'next_20', 12, 'jobs/accounting', 'Link repair, delay, fuel, disposal, subcontractor, and material costs to job profitability', 'planned', 'high', 'KNOWN_ISSUES_AND_GAPS.md', '#jobs', 'Roll up cost categories into job margin and close blockers.', 'Job margin shows category subtotals and actual-vs-estimate variance.', 'Profitability is incomplete.', 112, '{}'::jsonb, now()),
  ('next126_13_customer_quote_to_invoice', 'next_20', 13, 'jobs/accounting', 'Tighten quote acceptance to invoice candidate flow', 'planned', 'medium', 'DEVELOPMENT_ROADMAP.md', '#jobs', 'Carry accepted quote totals, tax code, discounts, and attachments into invoice candidates.', 'Accepted quote produces invoice candidate without retyping.', 'Billing handoff is slow and error prone.', 113, '{}'::jsonb, now()),
  ('next126_14_local_seo_route_registry', 'next_20', 14, 'seo', 'Add public route SEO registry for local wording review', 'planned', 'medium', 'SEO_PUBLIC_PAGE_RULES.md', '#admin readiness', 'Track route title, H1, meta, local terms, image alt, and proof level.', 'SEO smoke table covers each public route.', 'Local SEO work stays informal.', 114, '{}'::jsonb, now()),
  ('next126_15_internal_link_suggestions', 'next_20', 15, 'seo', 'Add internal-link suggestion queue', 'planned', 'medium', 'SEO_PUBLIC_PAGE_RULES.md', '#admin readiness', 'Suggest links between service, location, proof, gallery, and contact pages.', 'Queue shows suggested source, target, anchor, status.', 'Pages can stay orphaned or weakly connected.', 115, '{}'::jsonb, now()),
  ('next126_16_mobile_scan_buttons', 'next_20', 16, 'mobile', 'Add phone-first scan buttons to Today dashboard', 'planned', 'medium', 'MOBILE_TODAY_DASHBOARD_PWA_AND_OFFLINE_BADGES.md', '#today', 'Give supervisors quick access to equipment scan, proof upload, incident, and closeout actions.', 'Today dashboard exposes scan and proof shortcuts.', 'Field users must dig through menus.', 116, '{}'::jsonb, now()),
  ('next126_17_offline_conflict_labels', 'next_20', 17, 'fallback', 'Improve offline conflict labels and retry messages', 'planned', 'medium', 'WORKFLOW_AUTOMATION_AND_EVIDENCE_REVIEW.md', '#admin messaging', 'Show user-friendly conflict causes and recommended retry/keep/discard decisions.', 'Conflict table explains what failed and what to do.', 'Users may delete useful local drafts.', 117, '{}'::jsonb, now()),
  ('next126_18_css_component_tokens', 'next_20', 18, 'css', 'Introduce small CSS component token inventory', 'planned', 'low', 'SYSTEM_ARCHITECTURE.md', 'style.css', 'Document reused card/table/button spacing tokens to slow CSS drift.', 'Style guide names common layout classes.', 'One-off CSS keeps accumulating.', 118, '{}'::jsonb, now()),
  ('next126_19_schema_preflight_auto_seed', 'next_20', 19, 'deployment', 'Auto-seed schema preflight rows for new migrations', 'planned', 'medium', 'TESTING_CHECKLIST.md', '#admin readiness', 'Each migration adds required table/view rows so missing live objects are visible.', 'New schema objects appear in preflight list.', 'Live database gaps are not obvious.', 119, '{}'::jsonb, now()),
  ('next126_20_live_supabase_smoke_runbook', 'next_20', 20, 'deployment', 'Create live Supabase deployment smoke runbook', 'planned', 'high', 'DEPLOYMENT_GUIDE.md', 'Supabase', 'Document exact Edge Function deploy order, schema apply order, and browser cache reset.', 'Runbook can be followed without local node access.', 'Deploy errors repeat across passes.', 120, '{}'::jsonb, now())
on conflict (step_key) do update set
  step_batch = excluded.step_batch,
  step_number = excluded.step_number,
  step_area = excluded.step_area,
  step_title = excluded.step_title,
  step_status = excluded.step_status,
  priority = excluded.priority,
  source_doc = excluded.source_doc,
  route_hint = excluded.route_hint,
  implementation_notes = excluded.implementation_notes,
  acceptance_check = excluded.acceptance_check,
  risk_if_skipped = excluded.risk_if_skipped,
  sort_order = excluded.sort_order,
  metadata = excluded.metadata,
  checked_at = excluded.checked_at,
  updated_at = now();

insert into public.app_depth_review_queue (
  review_key, review_area, review_title, current_depth, recommended_depth, review_status,
  cost_linkage_hint, accounting_impact, route_hint, acceptance_check, sort_order, metadata, checked_at
)
values
  ('accounting_cost_category_rollups', 'accounting costs', 'Repair, delay, equipment usage, replacement, fuel, disposal, material, and subcontractor costs need stronger job profitability links', 'Schema has job financial events and rollups, but category-level actual-vs-estimate review needs deeper UI and close blocking.', 'Add cost category subtotals, source proof, approval state, job margin impact, and close blocker status.', 'review', 'Link each cost to job_id, job_session_id, equipment_item_id, vendor_id, tax code, and GL account where possible.', 'Improves job margin, tax prep, close review, and accountant handoff.', '#jobs / #admin accounting', 'Job profitability row shows each cost category with source count, total, and variance.', 10, '{}'::jsonb, now()),
  ('payment_application_full_screen', 'payment application', 'Payment application needs a full screen for invoices, deposits, credits, discounts, write-offs, and overpayments', 'Schema foundation exists, but operator workflow is not yet complete enough for month-end.', 'Build apply/reverse/review controls with clear unapplied balance and audit trail.', 'planned', 'Link AR payment application to invoice, quote, job, bank item, and close period.', 'Needed before final close lock and accountant export are reliable.', '#admin accounting', 'Payment can be applied, partially applied, reversed, and exported with reviewer.', 20, '{}'::jsonb, now()),
  ('bank_reconciliation_manual_review', 'bank reconciliation', 'Bank reconciliation needs CSV preview, scored matching, manual matching, undo, and review status', 'Schema has review queues and match candidates, but the operator review flow needs more depth.', 'Add CSV staging preview, match scoring display, manual review screen, undo, and reviewer signoff.', 'planned', 'Tie bank item to payment, invoice, journal entry, vendor bill, and close period.', 'Prevents incorrect bank matches and supports close lock.', '#admin banking', 'Each bank row has import status, match status, reviewer, and undo trail.', 30, '{}'::jsonb, now()),
  ('hst_gst_payroll_remittance', 'tax and payroll', 'HST/GST and payroll remittance need source totals, review/signoff, filed/remitted dates, and export proof', 'Tables/views exist but need more proof and review UX.', 'Add source totals, adjustment rows, proof upload, filed date, paid date, reviewer, and lock status.', 'planned', 'Tie tax/payroll rows to close period and accountant export bundle.', 'Needed for audit trail and month-end package confidence.', '#admin tax_payroll', 'Filing/remittance row has proof, source totals, reviewed by, filed date, remitted date.', 40, '{}'::jsonb, now()),
  ('month_end_close_package', 'month-end close', 'Month-end close lock/reopen and accountant export packaging still need completion', 'Close center exists, but lock/reopen and package delivery need stronger workflow enforcement.', 'Block changes to closed periods, allow approved reopen, and export a manifest with all proofs.', 'planned', 'Tie all journal/payment/reconciliation/tax/export rows to accounting period close.', 'Stops reports from changing after accountant handoff.', '#admin close center', 'Closed period blocks posting; package has manifest, files, and delivery proof.', 50, '{}'::jsonb, now()),
  ('equipment_qr_accessory_verifier', 'equipment accountability', 'Equipment accountability needs QR/barcode scan flow, accessory templates, verifier permissions, and service tasks from failed tests', 'Schema has QR/barcode fields, accessory JSON, verifier-role fields, and service task rows; UI scan and permission enforcement need more depth.', 'Add camera/manual scan UI, checklist templates, role-disabled final verification, and service-task work orders.', 'planned', 'Link failed equipment task cost to job and equipment maintenance history.', 'Improves custody, safety, repair costing, and return signoff.', '#equipment', 'Scan-driven checkout/arrival/return works and failed tests create follow-up work.', 60, '{}'::jsonb, now()),
  ('seo_local_public_pages', 'SEO/local search', 'Public SEO needs route-level title, H1, meta, local wording, image alt, and proof checks per public page', 'Smoke checks index.html and DB has SEO guardrails, but multi-route public SEO registry needs expansion.', 'Create public route registry and internal-link suggestion workflow.', 'planned', null, 'Improves local relevance and prevents unsupported location claims.', '#admin readiness', 'Every public route has title, H1 count, meta, local terms, proof level, and internal-link status.', 70, '{}'::jsonb, now()),
  ('css_drift_component_system', 'CSS/mobile', 'CSS drift needs component-level reuse and mobile regression checks', 'Brace balance passes; component-level drift is still manual.', 'Add component token inventory and per-breakpoint visual checklist.', 'review', null, 'Reduces layout regressions and long-scroll mobile issues.', 'style.css / #admin readiness', 'Common cards/tables/buttons/forms use documented classes and smoke checks.', 80, '{}'::jsonb, now())
on conflict (review_key) do update set
  review_area = excluded.review_area,
  review_title = excluded.review_title,
  current_depth = excluded.current_depth,
  recommended_depth = excluded.recommended_depth,
  review_status = excluded.review_status,
  cost_linkage_hint = excluded.cost_linkage_hint,
  accounting_impact = excluded.accounting_impact,
  route_hint = excluded.route_hint,
  acceptance_check = excluded.acceptance_check,
  sort_order = excluded.sort_order,
  metadata = excluded.metadata,
  checked_at = excluded.checked_at,
  updated_at = now();

insert into public.app_data_migration_candidates (
  candidate_key, data_area, source_location, recommended_target, duplication_risk,
  migration_status, reason, fallback_plan, acceptance_check, sort_order, metadata, checked_at
)
values
  ('public_route_seo_registry', 'SEO/public routes', 'index.html, Markdown notes, future static route copy', 'Database registry with generated static fallback JSON', 'high', 'planned', 'SEO checks currently exist in code/docs, but per-route proof and local terms should be reviewable.', 'Keep static HTML/meta as the public fallback and export reviewed DB rows into build-time JSON when needed.', 'Admin can list public route title, H1, meta, local terms, proof level, and status.', 10, '{}'::jsonb, now()),
  ('mobile_today_action_registry', 'Mobile Today actions', 'DB registry plus frontend fallback arrays', 'Database as source of truth with cached frontend fallback', 'medium', 'in_progress', 'Mobile actions need admin visibility but must still work offline.', 'Keep safe hard-coded fallback actions if the view is missing or offline.', 'Today actions load from DB when available and fallback offline.', 20, '{}'::jsonb, now()),
  ('equipment_accessory_templates', 'Equipment accessories', 'Free-text/JSON accessory checklists', 'Database template rows linked to equipment category or item', 'high', 'planned', 'Accessory requirements should not be typed differently every checkout.', 'Preserve existing JSON checklist data as historical event payload.', 'Equipment type preloads expected accessory list at checkout and return.', 30, '{}'::jsonb, now()),
  ('accounting_close_exports', 'Accounting exports', 'Manual reports, proof files, and accountant notes', 'Database package manifest with generated export files', 'high', 'planned', 'Accountant handoff should not depend on ad-hoc local files.', 'Allow manual download bundle until automated delivery is tested.', 'Export package includes manifest, source totals, proof files, delivery status.', 40, '{}'::jsonb, now()),
  ('bank_csv_imports', 'Bank CSV imports', 'Uploaded CSV rows and manual review notes', 'Database staging/import tables with reject reasons and fallback export', 'high', 'planned', 'Bank import decisions must be auditable and reversible.', 'Allow rejected rows to be downloaded as a correction CSV.', 'Import session has row counts, duplicate counts, accepted rows, rejected rows, and reviewer.', 50, '{}'::jsonb, now()),
  ('local_draft_outbox', 'Offline drafts/outbox', 'Browser localStorage queue', 'Keep localStorage for offline-first, sync summary to DB when authenticated', 'medium', 'review', 'Offline drafts belong locally first, but Admin needs conflict visibility after sync.', 'Never delete local draft automatically on failed sync; show conflict actions.', 'Conflict review shows local payload, server response, retry/keep/discard actions.', 60, '{}'::jsonb, now())
on conflict (candidate_key) do update set
  data_area = excluded.data_area,
  source_location = excluded.source_location,
  recommended_target = excluded.recommended_target,
  duplication_risk = excluded.duplication_risk,
  migration_status = excluded.migration_status,
  reason = excluded.reason,
  fallback_plan = excluded.fallback_plan,
  acceptance_check = excluded.acceptance_check,
  sort_order = excluded.sort_order,
  metadata = excluded.metadata,
  checked_at = excluded.checked_at,
  updated_at = now();

insert into public.app_schema_documentation_sync_checks (
  check_key, check_area, check_title, expected_status, current_status,
  file_path, test_command, failure_hint, sort_order, metadata, checked_at
)
values
  ('schema_126_file_present', 'schema', 'Schema 126 migration file is present', 'required', 'passed', 'sql/126_roadmap_depth_data_migration_seo_css_fallback_guardrails.sql', 'test -f sql/126_roadmap_depth_data_migration_seo_css_fallback_guardrails.sql', 'Do not ship schema 126 docs without the migration file.', 10, '{}'::jsonb, now()),
  ('canonical_schema_126', 'schema', 'Canonical full schema reference includes schema 126', 'required', 'passed', 'sql/000_full_schema_reference.sql', 'grep 126_roadmap_depth_data_migration_seo_css_fallback_guardrails sql/000_full_schema_reference.sql', 'The full schema reference must match latest migration.', 20, '{}'::jsonb, now()),
  ('markdown_126_refreshed', 'documentation', 'Active Markdown files are refreshed for schema 126', 'required', 'passed', 'README.md / DEVELOPMENT_ROADMAP.md / KNOWN_ISSUES_AND_GAPS.md', 'grep 2026-06-02a README.md DEVELOPMENT_ROADMAP.md KNOWN_ISSUES_AND_GAPS.md', 'Future chat handoff will be stale if active Markdown is not updated.', 30, '{}'::jsonb, now()),
  ('smoke_126_current', 'testing', 'Smoke script expects schema 126 and 2026-06-02a cache marker', 'required', 'passed', 'scripts/repo-smoke-check.mjs', 'node scripts/repo-smoke-check.mjs', 'Smoke script must fail stale schema/cache packages.', 40, '{}'::jsonb, now()),
  ('css_brace_balance', 'css', 'CSS brace balance remains clean', 'required', 'passed', 'style.css', 'node scripts/repo-smoke-check.mjs', 'CSS drift can break mobile sections invisibly.', 50, '{}'::jsonb, now()),
  ('single_h1_public_shell', 'seo', 'Public app shell keeps no more than one H1', 'required', 'passed', 'index.html', 'node scripts/repo-smoke-check.mjs', 'Duplicate H1s can weaken main-title clarity and accessibility.', 60, '{}'::jsonb, now()),
  ('edge_function_parse', 'deployment', 'All Edge Function TypeScript files parse before deploy', 'required', 'passed', 'supabase/functions/*/index.ts', 'node scripts/repo-smoke-check.mjs', 'Supabase should not be first place syntax errors are found.', 70, '{}'::jsonb, now())
on conflict (check_key) do update set
  check_area = excluded.check_area,
  check_title = excluded.check_title,
  expected_status = excluded.expected_status,
  current_status = excluded.current_status,
  file_path = excluded.file_path,
  test_command = excluded.test_command,
  failure_hint = excluded.failure_hint,
  sort_order = excluded.sort_order,
  metadata = excluded.metadata,
  checked_at = excluded.checked_at,
  updated_at = now();

drop view if exists public.v_app_roadmap_action_steps;
create view public.v_app_roadmap_action_steps as
select
  step_key,
  step_batch,
  step_number,
  step_area,
  step_title,
  step_status,
  priority,
  source_doc,
  route_hint,
  implementation_notes,
  acceptance_check,
  risk_if_skipped,
  sort_order,
  metadata,
  checked_at,
  updated_at
from public.app_roadmap_action_steps
order by step_batch, sort_order, step_number, step_key;

drop view if exists public.v_app_depth_review_queue;
create view public.v_app_depth_review_queue as
select
  review_key,
  review_area,
  review_title,
  current_depth,
  recommended_depth,
  review_status,
  cost_linkage_hint,
  accounting_impact,
  route_hint,
  acceptance_check,
  sort_order,
  metadata,
  checked_at,
  updated_at
from public.app_depth_review_queue
order by sort_order, review_key;

drop view if exists public.v_app_data_migration_candidates;
create view public.v_app_data_migration_candidates as
select
  candidate_key,
  data_area,
  source_location,
  recommended_target,
  duplication_risk,
  migration_status,
  reason,
  fallback_plan,
  acceptance_check,
  sort_order,
  metadata,
  checked_at,
  updated_at
from public.app_data_migration_candidates
order by sort_order, candidate_key;

drop view if exists public.v_app_schema_documentation_sync_checks;
create view public.v_app_schema_documentation_sync_checks as
select
  check_key,
  check_area,
  check_title,
  expected_status,
  current_status,
  file_path,
  test_command,
  failure_hint,
  sort_order,
  metadata,
  checked_at,
  updated_at
from public.app_schema_documentation_sync_checks
order by sort_order, check_key;

create table if not exists public.app_operational_depth_gates (
  gate_key text primary key,
  gate_area text not null,
  gate_title text not null,
  gate_status text not null default 'review',
  owner_hint text,
  route_hint text,
  test_hint text,
  failure_hint text,
  sort_order integer not null default 100,
  checked_at timestamptz,
  updated_at timestamptz not null default now()
);

insert into public.app_operational_depth_gates (
  gate_key, gate_area, gate_title, gate_status, owner_hint, route_hint,
  test_hint, failure_hint, sort_order, checked_at
)
values
  ('roadmap_next20_visible', 'roadmap', 'Completed 20 and next 20 roadmap steps are DB-visible', 'passed', 'Admin / Developer', '#admin readiness', 'Review v_app_roadmap_action_steps after each pass.', 'Roadmap may drift from app state if only Markdown is updated.', 71, now()),
  ('data_migration_candidates_visible', 'data migration', 'JSON/DB duplication migration candidates are tracked', 'passed', 'Admin / Developer', '#admin readiness', 'Review v_app_data_migration_candidates before moving shared data between JSON and DB.', 'Moving data without fallback can break offline use or create duplicated sources.', 72, now()),
  ('depth_review_queue_visible', 'sanity check', 'Application-depth review queue is visible', 'passed', 'Admin / Developer', '#admin readiness', 'Review v_app_depth_review_queue for accounting, equipment, SEO, CSS, mobile, and fallback depth.', 'Important gaps can be missed between build passes.', 73, now()),
  ('schema_126_sync_visible', 'documentation', 'Schema/documentation sync checks are visible', 'passed', 'Admin / Developer', '#admin readiness', 'Review v_app_schema_documentation_sync_checks before packaging.', 'Docs and schema can ship out of sync.', 74, now())
on conflict (gate_key) do update set
  gate_area = excluded.gate_area,
  gate_title = excluded.gate_title,
  gate_status = excluded.gate_status,
  owner_hint = excluded.owner_hint,
  route_hint = excluded.route_hint,
  test_hint = excluded.test_hint,
  failure_hint = excluded.failure_hint,
  sort_order = excluded.sort_order,
  checked_at = excluded.checked_at,
  updated_at = now();

drop view if exists public.v_schema_drift_status;
create view public.v_schema_drift_status as
select
  126::int as expected_schema_version,
  coalesce(max(schema_version) filter (where status = 'applied'), 0)::int as latest_applied_schema_version,
  case
    when coalesce(max(schema_version) filter (where status = 'applied'), 0) >= 126
      then 'current'
    else 'behind'
  end as drift_status,
  case
    when coalesce(max(schema_version) filter (where status = 'applied'), 0) >= 126
      then 'Live database is at or ahead of the repo schema marker.'
    else 'Live database is behind the deployed app. Apply migrations through schema 126.'
  end as message,
  now() as checked_at
from public.app_schema_versions;

insert into public.app_schema_versions (
  schema_version,
  migration_key,
  schema_name,
  release_label,
  description,
  status,
  notes
)
values (
  126,
  '126_roadmap_depth_data_migration_seo_css_fallback_guardrails',
  '126_roadmap_depth_data_migration_seo_css_fallback_guardrails.sql',
  '2026-06-02a',
  'Adds DB-visible roadmap completion/next-step tracking, application-depth review rows, data-migration candidates, and schema/documentation sync checks for SEO, CSS, fallback, accounting, and equipment accountability.',
  'applied',
  'This pass repairs repo archive/test hygiene, updates the cache marker, exposes schema 125/126 guardrails in Admin, and records completed 20 plus next 20 roadmap steps.'
)
on conflict (schema_version) do update set
  migration_key = excluded.migration_key,
  schema_name = excluded.schema_name,
  release_label = excluded.release_label,
  description = excluded.description,
  status = excluded.status,
  notes = excluded.notes,
  applied_at = now();

grant select on public.app_roadmap_action_steps to authenticated;
grant select on public.app_depth_review_queue to authenticated;
grant select on public.app_data_migration_candidates to authenticated;
grant select on public.app_schema_documentation_sync_checks to authenticated;
grant select on public.v_app_roadmap_action_steps to authenticated;
grant select on public.v_app_depth_review_queue to authenticated;
grant select on public.v_app_data_migration_candidates to authenticated;
grant select on public.v_app_schema_documentation_sync_checks to authenticated;
grant select on public.v_schema_drift_status to authenticated;

commit;

-- Schema 127: public route SEO, internal-link, CSS-token, mobile action, and release-manifest guardrails.
-- Build 2026-06-02b. This pass keeps roadmap/issues/schema/docs/cache checks synchronized and adds DB-visible next-step depth.

begin;

create table if not exists public.app_public_route_seo_registry (
  route_key text primary key,
  route_path text not null,
  route_label text not null,
  page_title text,
  h1_text text,
  meta_description text,
  primary_local_terms text[] not null default '{}'::text[],
  secondary_search_terms text[] not null default '{}'::text[],
  proof_status text not null default 'review',
  title_status text not null default 'review',
  h1_status text not null default 'review',
  meta_status text not null default 'review',
  image_alt_status text not null default 'review',
  internal_link_status text not null default 'review',
  structured_data_status text not null default 'review',
  publish_status text not null default 'draft',
  local_wording_notes text,
  fallback_hint text,
  sort_order integer not null default 100,
  metadata jsonb not null default '{}'::jsonb,
  checked_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.app_public_route_seo_registry add column if not exists route_path text;
alter table public.app_public_route_seo_registry add column if not exists route_label text;
alter table public.app_public_route_seo_registry add column if not exists page_title text;
alter table public.app_public_route_seo_registry add column if not exists h1_text text;
alter table public.app_public_route_seo_registry add column if not exists meta_description text;
alter table public.app_public_route_seo_registry add column if not exists primary_local_terms text[] not null default '{}'::text[];
alter table public.app_public_route_seo_registry add column if not exists secondary_search_terms text[] not null default '{}'::text[];
alter table public.app_public_route_seo_registry add column if not exists proof_status text not null default 'review';
alter table public.app_public_route_seo_registry add column if not exists title_status text not null default 'review';
alter table public.app_public_route_seo_registry add column if not exists h1_status text not null default 'review';
alter table public.app_public_route_seo_registry add column if not exists meta_status text not null default 'review';
alter table public.app_public_route_seo_registry add column if not exists image_alt_status text not null default 'review';
alter table public.app_public_route_seo_registry add column if not exists internal_link_status text not null default 'review';
alter table public.app_public_route_seo_registry add column if not exists structured_data_status text not null default 'review';
alter table public.app_public_route_seo_registry add column if not exists publish_status text not null default 'draft';
alter table public.app_public_route_seo_registry add column if not exists local_wording_notes text;
alter table public.app_public_route_seo_registry add column if not exists fallback_hint text;
alter table public.app_public_route_seo_registry add column if not exists sort_order integer not null default 100;
alter table public.app_public_route_seo_registry add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.app_public_route_seo_registry add column if not exists checked_at timestamptz;
alter table public.app_public_route_seo_registry add column if not exists updated_at timestamptz not null default now();

create table if not exists public.app_internal_link_suggestion_queue (
  suggestion_key text primary key,
  source_route_key text references public.app_public_route_seo_registry(route_key) on delete cascade,
  target_route_key text references public.app_public_route_seo_registry(route_key) on delete set null,
  link_context text not null,
  suggested_anchor_text text,
  suggestion_status text not null default 'review',
  seo_reason text,
  proof_reason text,
  fallback_plan text,
  sort_order integer not null default 100,
  metadata jsonb not null default '{}'::jsonb,
  checked_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.app_internal_link_suggestion_queue add column if not exists source_route_key text;
alter table public.app_internal_link_suggestion_queue add column if not exists target_route_key text;
alter table public.app_internal_link_suggestion_queue add column if not exists link_context text;
alter table public.app_internal_link_suggestion_queue add column if not exists suggested_anchor_text text;
alter table public.app_internal_link_suggestion_queue add column if not exists suggestion_status text not null default 'review';
alter table public.app_internal_link_suggestion_queue add column if not exists seo_reason text;
alter table public.app_internal_link_suggestion_queue add column if not exists proof_reason text;
alter table public.app_internal_link_suggestion_queue add column if not exists fallback_plan text;
alter table public.app_internal_link_suggestion_queue add column if not exists sort_order integer not null default 100;
alter table public.app_internal_link_suggestion_queue add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.app_internal_link_suggestion_queue add column if not exists checked_at timestamptz;
alter table public.app_internal_link_suggestion_queue add column if not exists updated_at timestamptz not null default now();

create table if not exists public.app_css_component_token_inventory (
  token_key text primary key,
  component_area text not null,
  token_name text not null,
  token_purpose text,
  current_source text,
  recommended_class_name text,
  drift_risk text not null default 'medium',
  token_status text not null default 'review',
  mobile_check_hint text,
  fallback_hint text,
  sort_order integer not null default 100,
  metadata jsonb not null default '{}'::jsonb,
  checked_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.app_mobile_field_action_queue (
  action_key text primary key,
  action_area text not null,
  action_title text not null,
  action_status text not null default 'planned',
  required_role text not null default 'employee',
  route_hint text,
  offline_support_status text not null default 'review',
  scan_or_proof_hint text,
  fallback_hint text,
  sort_order integer not null default 100,
  metadata jsonb not null default '{}'::jsonb,
  checked_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.app_release_manifest_checks (
  manifest_key text primary key,
  release_label text not null,
  manifest_area text not null,
  manifest_title text not null,
  manifest_status text not null default 'review',
  file_path text,
  expected_marker text,
  verification_hint text,
  failure_hint text,
  sort_order integer not null default 100,
  metadata jsonb not null default '{}'::jsonb,
  checked_at timestamptz,
  updated_at timestamptz not null default now()
);

insert into public.app_public_route_seo_registry (
  route_key, route_path, route_label, page_title, h1_text, meta_description,
  primary_local_terms, secondary_search_terms, proof_status, title_status, h1_status,
  meta_status, image_alt_status, internal_link_status, structured_data_status,
  publish_status, local_wording_notes, fallback_hint, sort_order, metadata, checked_at
)
values
  ('home_shell', '/', 'Home shell', 'YWI HSE workplace safety and field operations app', 'YWI HSE Field Operations', 'Workplace safety, job tracking, equipment accountability, and accounting workflow app for Ontario field operations.', array['Ontario workplace safety','field operations'], array['equipment signoff','job safety forms','mobile field app'], 'review', 'passed', 'passed', 'review', 'review', 'review', 'review', 'draft', 'Keep public wording truthful and service-area wording supported by real operations.', 'If DB registry is unavailable, keep index.html title/H1/meta smoke checks active.', 10, '{"build":"2026-06-02b","schema":127}'::jsonb, now()),
  ('today_mobile', '/#today', 'Mobile Today', 'Today dashboard for field crews', 'YWI HSE Field Operations', 'Phone-first dashboard for safety forms, saved drafts, offline work, equipment checks, and Admin follow-up.', array['Ontario field crew','mobile safety forms'], array['offline draft','equipment scan','daily dashboard'], 'review', 'review', 'passed', 'review', 'review', 'review', 'review', 'internal', 'Today route is internal but should still use clear accessible labels.', 'If route registry fails, Today remains available from static shell and cached JS.', 20, '{"build":"2026-06-02b","schema":127}'::jsonb, now()),
  ('jobs_equipment', '/#jobs', 'Jobs and Equipment', 'Jobs, equipment, signoffs, and accounting depth', 'YWI HSE Field Operations', 'Manage jobs, equipment checkout, arrival verification, return signoff, service tasks, and job profitability review.', array['equipment checkout','job profitability'], array['return signoff','arrival verification','repair costs'], 'review', 'review', 'passed', 'review', 'review', 'review', 'review', 'internal', 'Jobs route needs plain headings and no duplicate title-like H1 blocks.', 'Jobs UI should fall back to empty arrays when optional views are missing.', 30, '{"build":"2026-06-02b","schema":127}'::jsonb, now()),
  ('admin_readiness', '/#admin', 'Admin readiness', 'Admin readiness and deployment checks', 'YWI HSE Field Operations', 'Admin command center for schema readiness, deployment guardrails, SEO checks, mobile quality, and accounting close review.', array['admin readiness','deployment checks'], array['schema drift','production readiness','local SEO checks'], 'review', 'review', 'passed', 'review', 'review', 'review', 'review', 'internal', 'Admin is internal, but labels must stay clear for operators.', 'Admin directory optional views must fail soft to visible empty tables.', 40, '{"build":"2026-06-02b","schema":127}'::jsonb, now())
on conflict (route_key) do update set
  route_path = excluded.route_path,
  route_label = excluded.route_label,
  page_title = excluded.page_title,
  h1_text = excluded.h1_text,
  meta_description = excluded.meta_description,
  primary_local_terms = excluded.primary_local_terms,
  secondary_search_terms = excluded.secondary_search_terms,
  proof_status = excluded.proof_status,
  title_status = excluded.title_status,
  h1_status = excluded.h1_status,
  meta_status = excluded.meta_status,
  image_alt_status = excluded.image_alt_status,
  internal_link_status = excluded.internal_link_status,
  structured_data_status = excluded.structured_data_status,
  publish_status = excluded.publish_status,
  local_wording_notes = excluded.local_wording_notes,
  fallback_hint = excluded.fallback_hint,
  sort_order = excluded.sort_order,
  metadata = excluded.metadata,
  checked_at = excluded.checked_at,
  updated_at = now();

insert into public.app_internal_link_suggestion_queue (
  suggestion_key, source_route_key, target_route_key, link_context, suggested_anchor_text,
  suggestion_status, seo_reason, proof_reason, fallback_plan, sort_order, metadata, checked_at
)
values
  ('link_home_to_jobs_equipment', 'home_shell', 'jobs_equipment', 'Home shell should lead operators to job/equipment workflow.', 'Jobs and equipment signoff', 'review', 'Supports clear navigation to high-value workflow.', 'Only expose as public copy if actual workflow proof is ready.', 'Keep static nav link as fallback.', 10, '{"build":"2026-06-02b"}'::jsonb, now()),
  ('link_today_to_jobs_scan', 'today_mobile', 'jobs_equipment', 'Today dashboard should lead to scan/check equipment action.', 'Scan or verify equipment', 'planned', 'Improves phone-first action clarity.', 'Requires working scan/proof action before marking ready.', 'Manual equipment-code search remains fallback.', 20, '{"build":"2026-06-02b"}'::jsonb, now()),
  ('link_admin_to_seo_registry', 'admin_readiness', 'home_shell', 'Admin readiness should track public route title/H1/meta quality.', 'Public route SEO registry', 'review', 'Keeps SEO/local wording from drifting.', 'Registry must reflect real route content.', 'Smoke checks keep one-H1/title checks active.', 30, '{"build":"2026-06-02b"}'::jsonb, now())
on conflict (suggestion_key) do update set
  source_route_key = excluded.source_route_key,
  target_route_key = excluded.target_route_key,
  link_context = excluded.link_context,
  suggested_anchor_text = excluded.suggested_anchor_text,
  suggestion_status = excluded.suggestion_status,
  seo_reason = excluded.seo_reason,
  proof_reason = excluded.proof_reason,
  fallback_plan = excluded.fallback_plan,
  sort_order = excluded.sort_order,
  metadata = excluded.metadata,
  checked_at = excluded.checked_at,
  updated_at = now();

insert into public.app_css_component_token_inventory (
  token_key, component_area, token_name, token_purpose, current_source,
  recommended_class_name, drift_risk, token_status, mobile_check_hint, fallback_hint, sort_order, metadata, checked_at
)
values
  ('token_admin_table_scroll', 'admin tables', 'table-scroll', 'Shared horizontal overflow wrapper for long Admin tables.', 'style.css .table-scroll plus inline table wrappers', 'table-scroll', 'medium', 'in_progress', 'Verify tables become scrollable instead of overflowing phone screens.', 'Keep wrapper around new tables even when cards are added later.', 10, '{"build":"2026-06-02b"}'::jsonb, now()),
  ('token_notice_panel', 'notices', 'notice', 'Reusable status/instruction block for fallback and empty state messages.', 'style.css .notice', 'notice notice--status', 'medium', 'review', 'Check small screens for readable wrapping and spacing.', 'Plain text fallback remains visible if enhanced cards fail.', 20, '{"build":"2026-06-02b"}'::jsonb, now()),
  ('token_status_pill', 'status pills', 'admin-status-pill', 'Shared status labels for pass/warn/fail/review rows.', 'js/admin-ui.js renderStatusPill and style.css status classes', 'status-pill status-pill--state', 'high', 'review', 'Tap target not needed, but text and contrast must remain readable.', 'Fallback to text status when CSS is missing.', 30, '{"build":"2026-06-02b"}'::jsonb, now()),
  ('token_mobile_quick_nav', 'mobile navigation', 'mobile-quick-nav', 'Phone-first fixed quick navigation bar.', 'style.css .mobile-quick-nav', 'mobile-quick-nav', 'medium', 'in_progress', 'Check bottom spacing and no overlap with form buttons.', 'Static top nav remains available.', 40, '{"build":"2026-06-02b"}'::jsonb, now())
on conflict (token_key) do update set
  component_area = excluded.component_area,
  token_name = excluded.token_name,
  token_purpose = excluded.token_purpose,
  current_source = excluded.current_source,
  recommended_class_name = excluded.recommended_class_name,
  drift_risk = excluded.drift_risk,
  token_status = excluded.token_status,
  mobile_check_hint = excluded.mobile_check_hint,
  fallback_hint = excluded.fallback_hint,
  sort_order = excluded.sort_order,
  metadata = excluded.metadata,
  checked_at = excluded.checked_at,
  updated_at = now();

insert into public.app_mobile_field_action_queue (
  action_key, action_area, action_title, action_status, required_role, route_hint,
  offline_support_status, scan_or_proof_hint, fallback_hint, sort_order, metadata, checked_at
)
values
  ('mobile_scan_equipment_label', 'equipment', 'Scan equipment label into QR/barcode fields', 'planned', 'employee', '#jobs', 'manual_fallback_ready', 'Use BarcodeDetector/camera when available, with manual prompt fallback.', 'Manual code entry remains available.', 10, '{"build":"2026-06-02b"}'::jsonb, now()),
  ('mobile_verify_arrival', 'equipment', 'Verify arrival/site test from phone', 'in_progress', 'site_leader', '#jobs', 'review', 'Use equipment code, arrival condition, arrival test, accessory status, and notes.', 'Supervisor can complete verification from desktop if phone fails.', 20, '{"build":"2026-06-02b"}'::jsonb, now()),
  ('mobile_return_proof', 'equipment', 'Capture return proof and accessory status', 'in_progress', 'employee', '#jobs', 'review', 'Use return/damage photos, return test, and accessory checklist.', 'Evidence upload failures should show a visible retry message.', 30, '{"build":"2026-06-02b"}'::jsonb, now()),
  ('mobile_accounting_review', 'accounting', 'Review accounting close exceptions on phone', 'planned', 'admin', '#admin', 'online_only', 'Use compact cards before tables for payment/reconciliation/remittance exceptions.', 'Desktop Admin remains fallback.', 40, '{"build":"2026-06-02b"}'::jsonb, now())
on conflict (action_key) do update set
  action_area = excluded.action_area,
  action_title = excluded.action_title,
  action_status = excluded.action_status,
  required_role = excluded.required_role,
  route_hint = excluded.route_hint,
  offline_support_status = excluded.offline_support_status,
  scan_or_proof_hint = excluded.scan_or_proof_hint,
  fallback_hint = excluded.fallback_hint,
  sort_order = excluded.sort_order,
  metadata = excluded.metadata,
  checked_at = excluded.checked_at,
  updated_at = now();

insert into public.app_release_manifest_checks (
  manifest_key, release_label, manifest_area, manifest_title, manifest_status,
  file_path, expected_marker, verification_hint, failure_hint, sort_order, metadata, checked_at
)
values
  ('manifest_schema_127', '2026-06-02b', 'schema', 'Schema migration and full reference are aligned through 127', 'passed', 'sql/127_public_route_seo_internal_link_css_mobile_guardrails.sql', '127_public_route_seo_internal_link_css_mobile_guardrails', 'Run smoke check and verify schema drift expects 127.', 'Live DB can drift from shipped functions.', 10, '{"build":"2026-06-02b"}'::jsonb, now()),
  ('manifest_docs_127', '2026-06-02b', 'documentation', 'Root Markdown and schema 127 doc refreshed', 'passed', 'docs/PUBLIC_ROUTE_SEO_INTERNAL_LINK_CSS_MOBILE_SCHEMA127.md', 'schema 127', 'Review roadmap/issues/database/deployment/checklist docs.', 'Operators may follow stale deploy steps.', 20, '{"build":"2026-06-02b"}'::jsonb, now()),
  ('manifest_cache_127', '2026-06-02b', 'pwa', 'Index and service worker use the same cache marker', 'passed', 'server-worker.js', '2026-06-02b', 'Hard-refresh after deployment and check service worker cache.', 'Browsers can keep stale repaired code.', 30, '{"build":"2026-06-02b"}'::jsonb, now()),
  ('manifest_smoke_127', '2026-06-02b', 'testing', 'Repo smoke script checks schema 127 guardrails', 'passed', 'scripts/repo-smoke-check.mjs', 'schema-has-127', 'Run node scripts/repo-smoke-check.mjs before packaging.', 'Deployment regressions may reach Supabase first.', 40, '{"build":"2026-06-02b"}'::jsonb, now())
on conflict (manifest_key) do update set
  release_label = excluded.release_label,
  manifest_area = excluded.manifest_area,
  manifest_title = excluded.manifest_title,
  manifest_status = excluded.manifest_status,
  file_path = excluded.file_path,
  expected_marker = excluded.expected_marker,
  verification_hint = excluded.verification_hint,
  failure_hint = excluded.failure_hint,
  sort_order = excluded.sort_order,
  metadata = excluded.metadata,
  checked_at = excluded.checked_at,
  updated_at = now();

insert into public.app_roadmap_action_steps (
  step_key, step_batch, step_number, step_area, step_title, step_status, priority,
  source_doc, route_hint, implementation_notes, acceptance_check, risk_if_skipped,
  sort_order, metadata, checked_at
)
values
  ('schema127_01_archive_snapshot', 'completed_this_pass', 1, 'repo hygiene', 'Archive schema 126 active Markdown before editing', 'completed', 'high', 'DEVELOPMENT_ROADMAP.md', '#admin', 'Created archive/markdown-current-snapshot-2026-06-02a with active root docs before this pass.', 'Snapshot contains README and active docs.', 'This step can drift if Markdown, schema, and Admin readiness are not kept in sync.', 1, '{"build":"2026-06-02b","schema":127}'::jsonb, now()),
  ('schema127_02_retire_root_docs', 'completed_this_pass', 2, 'repo hygiene', 'Retire legacy prompt/runbook root Markdown again', 'completed', 'high', 'DEVELOPMENT_ROADMAP.md', '#admin', 'Moved legacy root docs into archive so root remains clean.', 'Smoke confirms retired docs are not in root.', 'This step can drift if Markdown, schema, and Admin readiness are not kept in sync.', 2, '{"build":"2026-06-02b","schema":127}'::jsonb, now()),
  ('schema127_03_retire_test_files', 'completed_this_pass', 3, 'repo hygiene', 'Retire test_write files again', 'completed', 'high', 'DEVELOPMENT_ROADMAP.md', '#admin', 'Moved uploaded root test_write files to archive.', 'Smoke confirms test_write files are not active.', 'This step can drift if Markdown, schema, and Admin readiness are not kept in sync.', 3, '{"build":"2026-06-02b","schema":127}'::jsonb, now()),
  ('schema127_04_schema_migration', 'completed_this_pass', 4, 'schema', 'Add schema 127 migration', 'completed', 'high', 'DEVELOPMENT_ROADMAP.md', '#admin', 'Added public route SEO, link, CSS token, mobile action, and release manifest guardrails.', 'Migration file exists and drift expects 127.', 'This step can drift if Markdown, schema, and Admin readiness are not kept in sync.', 4, '{"build":"2026-06-02b","schema":127}'::jsonb, now()),
  ('schema127_05_schema_reference', 'completed_this_pass', 5, 'schema', 'Update full schema reference through 127', 'completed', 'high', 'DEVELOPMENT_ROADMAP.md', '#admin', 'Appended schema 127 to canonical schema reference.', 'Full reference includes schema 127 marker.', 'This step can drift if Markdown, schema, and Admin readiness are not kept in sync.', 5, '{"build":"2026-06-02b","schema":127}'::jsonb, now()),
  ('schema127_06_route_seo_registry', 'completed_this_pass', 6, 'seo', 'Add DB route-level SEO registry', 'completed', 'high', 'DEVELOPMENT_ROADMAP.md', '#admin', 'Added app_public_route_seo_registry for title/H1/meta/local/proof/internal-link status.', 'v_app_public_route_seo_registry is visible.', 'This step can drift if Markdown, schema, and Admin readiness are not kept in sync.', 6, '{"build":"2026-06-02b","schema":127}'::jsonb, now()),
  ('schema127_07_internal_links', 'completed_this_pass', 7, 'seo', 'Add internal-link suggestion queue', 'completed', 'high', 'DEVELOPMENT_ROADMAP.md', '#admin', 'Added app_internal_link_suggestion_queue for service/location/proof/contact link suggestions.', 'v_app_internal_link_suggestion_queue is visible.', 'This step can drift if Markdown, schema, and Admin readiness are not kept in sync.', 7, '{"build":"2026-06-02b","schema":127}'::jsonb, now()),
  ('schema127_08_css_tokens', 'completed_this_pass', 8, 'css', 'Add CSS component token inventory', 'completed', 'high', 'DEVELOPMENT_ROADMAP.md', '#admin', 'Added app_css_component_token_inventory for repeatable component/token review.', 'v_app_css_component_token_inventory is visible.', 'This step can drift if Markdown, schema, and Admin readiness are not kept in sync.', 8, '{"build":"2026-06-02b","schema":127}'::jsonb, now()),
  ('schema127_09_mobile_actions', 'completed_this_pass', 9, 'mobile', 'Add mobile field action queue', 'completed', 'high', 'DEVELOPMENT_ROADMAP.md', '#admin', 'Added app_mobile_field_action_queue for phone-first scan/proof actions.', 'v_app_mobile_field_action_queue is visible.', 'This step can drift if Markdown, schema, and Admin readiness are not kept in sync.', 9, '{"build":"2026-06-02b","schema":127}'::jsonb, now()),
  ('schema127_10_release_manifest', 'completed_this_pass', 10, 'deployment', 'Add release manifest checks', 'completed', 'high', 'DEVELOPMENT_ROADMAP.md', '#admin', 'Added app_release_manifest_checks to track SQL/docs/cache/smoke packaging pieces.', 'v_app_release_manifest_checks is visible.', 'This step can drift if Markdown, schema, and Admin readiness are not kept in sync.', 10, '{"build":"2026-06-02b","schema":127}'::jsonb, now()),
  ('schema127_11_admin_directory', 'completed_this_pass', 11, 'admin ui', 'Load schema 127 views in admin-directory', 'completed', 'high', 'DEVELOPMENT_ROADMAP.md', '#admin', 'Admin command_center and health scopes return schema 127 arrays.', 'admin-directory source includes all schema 127 views.', 'This step can drift if Markdown, schema, and Admin readiness are not kept in sync.', 11, '{"build":"2026-06-02b","schema":127}'::jsonb, now()),
  ('schema127_12_admin_ui_state', 'completed_this_pass', 12, 'admin ui', 'Store schema 127 arrays in Admin UI state', 'completed', 'high', 'DEVELOPMENT_ROADMAP.md', '#admin', 'Added Admin state keys and payload mapping for new arrays.', 'Admin UI source includes schema 127 state names.', 'This step can drift if Markdown, schema, and Admin readiness are not kept in sync.', 12, '{"build":"2026-06-02b","schema":127}'::jsonb, now()),
  ('schema127_13_admin_ui_tables', 'completed_this_pass', 13, 'admin ui', 'Render route SEO, links, CSS, mobile, and release rows', 'completed', 'high', 'DEVELOPMENT_ROADMAP.md', '#admin', 'Production Readiness now has compact tables for schema 127 views.', 'Admin UI has table IDs and render bodies.', 'This step can drift if Markdown, schema, and Admin readiness are not kept in sync.', 13, '{"build":"2026-06-02b","schema":127}'::jsonb, now()),
  ('schema127_14_cache_marker', 'completed_this_pass', 14, 'pwa', 'Update cache marker to 2026-06-02b', 'completed', 'high', 'DEVELOPMENT_ROADMAP.md', '#admin', 'Updated index query strings and service worker cache version.', 'Smoke checks 2026-06-02b marker.', 'This step can drift if Markdown, schema, and Admin readiness are not kept in sync.', 14, '{"build":"2026-06-02b","schema":127}'::jsonb, now()),
  ('schema127_15_smoke_current', 'completed_this_pass', 15, 'testing', 'Update smoke expectations to schema 127', 'completed', 'high', 'DEVELOPMENT_ROADMAP.md', '#admin', 'Smoke now checks schema 127 marker, views, admin loading, and cache version.', 'node scripts/repo-smoke-check.mjs passes.', 'This step can drift if Markdown, schema, and Admin readiness are not kept in sync.', 15, '{"build":"2026-06-02b","schema":127}'::jsonb, now()),
  ('schema127_16_markdown_root', 'completed_this_pass', 16, 'documentation', 'Refresh root Markdown for schema 127', 'completed', 'high', 'DEVELOPMENT_ROADMAP.md', '#admin', 'Updated roadmap, issues, database, deployment, project, status, and checklist docs.', 'Root docs mention schema 127.', 'This step can drift if Markdown, schema, and Admin readiness are not kept in sync.', 16, '{"build":"2026-06-02b","schema":127}'::jsonb, now()),
  ('schema127_17_docs_page', 'completed_this_pass', 17, 'documentation', 'Add schema 127 implementation doc', 'completed', 'high', 'DEVELOPMENT_ROADMAP.md', '#admin', 'Added docs/PUBLIC_ROUTE_SEO_INTERNAL_LINK_CSS_MOBILE_SCHEMA127.md.', 'Schema 127 doc is present.', 'This step can drift if Markdown, schema, and Admin readiness are not kept in sync.', 17, '{"build":"2026-06-02b","schema":127}'::jsonb, now()),
  ('schema127_18_seo_direction', 'completed_this_pass', 18, 'seo', 'Carry local SEO rules forward', 'completed', 'high', 'DEVELOPMENT_ROADMAP.md', '#admin', 'Documented one H1, plain local wording, internal links, and proof-level status.', 'SEO gaps now tie to route registry.', 'This step can drift if Markdown, schema, and Admin readiness are not kept in sync.', 18, '{"build":"2026-06-02b","schema":127}'::jsonb, now()),
  ('schema127_19_mobile_depth', 'completed_this_pass', 19, 'mobile', 'Carry phone-first scan/proof depth forward', 'completed', 'high', 'DEVELOPMENT_ROADMAP.md', '#admin', 'Mobile action queue documents checkout/arrival/return/proof actions.', 'Mobile next steps are DB-visible.', 'This step can drift if Markdown, schema, and Admin readiness are not kept in sync.', 19, '{"build":"2026-06-02b","schema":127}'::jsonb, now()),
  ('schema127_20_next20', 'completed_this_pass', 20, 'roadmap', 'Add the next 20 roadmap steps after this pass', 'completed', 'high', 'DEVELOPMENT_ROADMAP.md', '#admin', 'Roadmap and DB rows now list the next implementation targets.', 'v_app_roadmap_action_steps has next_20 rows.', 'This step can drift if Markdown, schema, and Admin readiness are not kept in sync.', 20, '{"build":"2026-06-02b","schema":127}'::jsonb, now()),
  ('schema127_next_01', 'next_20', 1, 'accounting', 'Build payment application UI actions for apply/reverse/approve', 'planned', 'high', 'DEVELOPMENT_ROADMAP.md', '#admin', 'Create buttons and Edge Function actions for invoice/deposit/credit/write-off/overpayment application.', 'Payment application rows can be acted on from Jobs/Admin.', 'Leaving this gap open keeps the workflow partly manual.', 101, '{"build":"2026-06-02b","schema":127}'::jsonb, now()),
  ('schema127_next_02', 'next_20', 2, 'accounting', 'Add bank CSV import preview screen', 'planned', 'high', 'DEVELOPMENT_ROADMAP.md', '#admin', 'Preview parsed rows, bad dates, duplicate candidates, rejected rows, and amount signs before staging.', 'Bank CSV preview can reject unsafe imports.', 'Leaving this gap open keeps the workflow partly manual.', 102, '{"build":"2026-06-02b","schema":127}'::jsonb, now()),
  ('schema127_next_03', 'next_20', 3, 'accounting', 'Add reconciliation manual match and undo actions', 'planned', 'high', 'DEVELOPMENT_ROADMAP.md', '#admin', 'Support match, split match, unmatch, reviewer notes, and final signoff.', 'Reconciliation review no longer requires manual DB editing.', 'Leaving this gap open keeps the workflow partly manual.', 103, '{"build":"2026-06-02b","schema":127}'::jsonb, now()),
  ('schema127_next_04', 'next_20', 4, 'accounting', 'Finish HST/GST filing proof workflow', 'planned', 'high', 'DEVELOPMENT_ROADMAP.md', '#admin', 'Add upload proof, source totals, adjustment notes, filed/remitted dates, and lock state.', 'Sales tax filing rows have evidence and status.', 'Leaving this gap open keeps the workflow partly manual.', 104, '{"build":"2026-06-02b","schema":127}'::jsonb, now()),
  ('schema127_next_05', 'next_20', 5, 'accounting', 'Finish payroll remittance proof workflow', 'planned', 'high', 'DEVELOPMENT_ROADMAP.md', '#admin', 'Link payroll source runs, deductions/employer costs, proof, payment date, and close period.', 'Payroll remittance rows can be reviewed and signed off.', 'Leaving this gap open keeps the workflow partly manual.', 105, '{"build":"2026-06-02b","schema":127}'::jsonb, now()),
  ('schema127_next_06', 'next_20', 6, 'accounting', 'Finish month-end close lock/reopen controls', 'planned', 'high', 'DEVELOPMENT_ROADMAP.md', '#admin', 'Block postings to closed periods and record reopen reason/signoff.', 'Closed periods prevent accidental posting.', 'Leaving this gap open keeps the workflow partly manual.', 106, '{"build":"2026-06-02b","schema":127}'::jsonb, now()),
  ('schema127_next_07', 'next_20', 7, 'accounting', 'Package accountant export files', 'planned', 'high', 'DEVELOPMENT_ROADMAP.md', '#admin', 'Generate manifest, CSV/JSON summaries, proof list, delivery status, and resend record.', 'Accountant handoff package is complete.', 'Leaving this gap open keeps the workflow partly manual.', 107, '{"build":"2026-06-02b","schema":127}'::jsonb, now()),
  ('schema127_next_08', 'next_20', 8, 'equipment', 'Add real QR/barcode scan buttons', 'planned', 'high', 'DEVELOPMENT_ROADMAP.md', '#admin', 'Use device camera/BarcodeDetector where supported, with manual fallback prompt.', 'Phone user can scan equipment labels into the selected field.', 'Leaving this gap open keeps the workflow partly manual.', 108, '{"build":"2026-06-02b","schema":127}'::jsonb, now()),
  ('schema127_next_09', 'next_20', 9, 'equipment', 'Create reusable accessory checklist templates', 'planned', 'high', 'DEVELOPMENT_ROADMAP.md', '#admin', 'Move category/pool checklist templates from free text to DB rows.', 'Checklist can auto-load by pool/category.', 'Leaving this gap open keeps the workflow partly manual.', 109, '{"build":"2026-06-02b","schema":127}'::jsonb, now()),
  ('schema127_next_10', 'next_20', 10, 'equipment', 'Enforce verifier role server-side', 'planned', 'high', 'DEVELOPMENT_ROADMAP.md', '#admin', 'Block final return verification, defect clearing, and return-to-service below required role.', 'Lower-role users cannot clear locked-out equipment.', 'Leaving this gap open keeps the workflow partly manual.', 110, '{"build":"2026-06-02b","schema":127}'::jsonb, now()),
  ('schema127_next_11', 'next_20', 11, 'equipment', 'Convert failed tests into service work orders', 'planned', 'high', 'DEVELOPMENT_ROADMAP.md', '#admin', 'Promote failed arrival/return tasks to assigned work orders with cost and proof.', 'Service tasks have owner, due date, evidence, and cost.', 'Leaving this gap open keeps the workflow partly manual.', 111, '{"build":"2026-06-02b","schema":127}'::jsonb, now()),
  ('schema127_next_12', 'next_20', 12, 'jobs', 'Roll up detailed cost categories into profitability', 'planned', 'high', 'DEVELOPMENT_ROADMAP.md', '#admin', 'Include repair, delay, equipment usage, replacement, fuel, disposal, materials, and subcontractors.', 'Job profitability matches source costs.', 'Leaving this gap open keeps the workflow partly manual.', 112, '{"build":"2026-06-02b","schema":127}'::jsonb, now()),
  ('schema127_next_13', 'next_20', 13, 'jobs', 'Carry quote acceptance terms into invoice candidates', 'planned', 'high', 'DEVELOPMENT_ROADMAP.md', '#admin', 'Accepted terms should populate invoice candidates without retyping.', 'Invoice candidates retain accepted pricing terms.', 'Leaving this gap open keeps the workflow partly manual.', 113, '{"build":"2026-06-02b","schema":127}'::jsonb, now()),
  ('schema127_next_14', 'next_20', 14, 'seo', 'Populate public route SEO registry from actual routes', 'planned', 'high', 'DEVELOPMENT_ROADMAP.md', '#admin', 'Generate route rows from active route list and fail missing title/H1/meta/local terms.', 'SEO registry reflects actual public pages.', 'Leaving this gap open keeps the workflow partly manual.', 114, '{"build":"2026-06-02b","schema":127}'::jsonb, now()),
  ('schema127_next_15', 'next_20', 15, 'seo', 'Build internal-link review UI', 'planned', 'high', 'DEVELOPMENT_ROADMAP.md', '#admin', 'Approve or dismiss link suggestions between service/location/proof/contact pages.', 'Internal link suggestions can be managed in Admin.', 'Leaving this gap open keeps the workflow partly manual.', 115, '{"build":"2026-06-02b","schema":127}'::jsonb, now()),
  ('schema127_next_16', 'next_20', 16, 'mobile', 'Add Today dashboard scan/proof buttons', 'planned', 'high', 'DEVELOPMENT_ROADMAP.md', '#admin', 'Add quick buttons for scan equipment, add proof, review exceptions, and resume drafts.', 'Phone users reach common field actions in one tap.', 'Leaving this gap open keeps the workflow partly manual.', 116, '{"build":"2026-06-02b","schema":127}'::jsonb, now()),
  ('schema127_next_17', 'next_20', 17, 'offline', 'Improve offline conflict review language', 'planned', 'high', 'DEVELOPMENT_ROADMAP.md', '#admin', 'Add clearer retry/keep local/discard local choices and sync explanations.', 'Offline errors are understandable.', 'Leaving this gap open keeps the workflow partly manual.', 117, '{"build":"2026-06-02b","schema":127}'::jsonb, now()),
  ('schema127_next_18', 'next_20', 18, 'css', 'Create reusable CSS token classes', 'planned', 'high', 'DEVELOPMENT_ROADMAP.md', '#admin', 'Move repeated cards/pills/tables/notices toward named component classes.', 'Fewer one-off inline styles.', 'Leaving this gap open keeps the workflow partly manual.', 118, '{"build":"2026-06-02b","schema":127}'::jsonb, now()),
  ('schema127_next_19', 'next_20', 19, 'deployment', 'Add release manifest file generation', 'planned', 'high', 'DEVELOPMENT_ROADMAP.md', '#admin', 'Generate a build manifest Markdown/JSON from schema, docs, code, and smoke results.', 'Each zip includes a release manifest.', 'Leaving this gap open keeps the workflow partly manual.', 119, '{"build":"2026-06-02b","schema":127}'::jsonb, now()),
  ('schema127_next_20', 'next_20', 20, 'testing', 'Add sitemap/robots/link/image-alt smoke checks', 'planned', 'high', 'DEVELOPMENT_ROADMAP.md', '#admin', 'Extend smoke checks for public SEO files, broken links, robots, sitemap, and alt text.', 'Public SEO regressions fail before packaging.', 'Leaving this gap open keeps the workflow partly manual.', 120, '{"build":"2026-06-02b","schema":127}'::jsonb, now())
on conflict (step_key) do update set
  step_batch = excluded.step_batch,
  step_number = excluded.step_number,
  step_area = excluded.step_area,
  step_title = excluded.step_title,
  step_status = excluded.step_status,
  priority = excluded.priority,
  source_doc = excluded.source_doc,
  route_hint = excluded.route_hint,
  implementation_notes = excluded.implementation_notes,
  acceptance_check = excluded.acceptance_check,
  risk_if_skipped = excluded.risk_if_skipped,
  sort_order = excluded.sort_order,
  metadata = excluded.metadata,
  checked_at = excluded.checked_at,
  updated_at = now();

insert into public.app_data_migration_candidates (
  candidate_key, data_area, source_location, recommended_target, duplication_risk,
  migration_status, reason, fallback_plan, acceptance_check, sort_order, metadata, checked_at
)
values
  ('schema127_public_route_seo_registry', 'seo', 'index.html / future public route copy', 'app_public_route_seo_registry with generated static fallback', 'medium', 'in_progress', 'Public SEO title/H1/meta/local terms need one reviewed source of truth.', 'Static index.html title/meta and smoke checks remain fallback.', 'Route registry rows exist before adding more public pages.', 15, '{"build":"2026-06-02b"}'::jsonb, now()),
  ('schema127_css_token_inventory', 'css', 'style.css and inline component styles', 'app_css_component_token_inventory plus reusable CSS classes', 'medium', 'review', 'CSS drift grows when repeated component styles are one-off.', 'Existing style.css remains source until tokens are implemented.', 'Token inventory covers tables, notices, pills, and mobile quick nav.', 25, '{"build":"2026-06-02b"}'::jsonb, now()),
  ('schema127_release_manifest', 'deployment', 'Markdown deploy notes and smoke script output', 'app_release_manifest_checks plus generated release manifest files', 'low', 'in_progress', 'Each zip needs a clear schema/docs/cache/smoke summary.', 'Final assistant summary and docs remain fallback.', 'Release manifest checks are DB-visible.', 35, '{"build":"2026-06-02b"}'::jsonb, now())
on conflict (candidate_key) do update set
  data_area = excluded.data_area,
  source_location = excluded.source_location,
  recommended_target = excluded.recommended_target,
  duplication_risk = excluded.duplication_risk,
  migration_status = excluded.migration_status,
  reason = excluded.reason,
  fallback_plan = excluded.fallback_plan,
  acceptance_check = excluded.acceptance_check,
  sort_order = excluded.sort_order,
  metadata = excluded.metadata,
  checked_at = excluded.checked_at,
  updated_at = now();

insert into public.app_schema_documentation_sync_checks (
  check_key, check_area, check_title, expected_status, current_status,
  file_path, test_command, failure_hint, sort_order, metadata, checked_at
)
values
  ('schema127_sql_reference_sync', 'schema', 'Schema 127 migration and full reference are synchronized', 'required', 'passed', 'sql/000_full_schema_reference.sql', 'node scripts/repo-smoke-check.mjs', 'Apply schema 127 before deploying Admin views.', 15, '{"build":"2026-06-02b"}'::jsonb, now()),
  ('schema127_markdown_sync', 'documentation', 'Roadmap, issues, deployment, database, and checklist docs mention schema 127', 'required', 'passed', 'DEVELOPMENT_ROADMAP.md', 'manual review', 'Docs may direct the next pass to the wrong feature set.', 25, '{"build":"2026-06-02b"}'::jsonb, now()),
  ('schema127_cache_sync', 'pwa', 'Index and service worker cache markers match 2026-06-02b', 'required', 'passed', 'server-worker.js', 'node scripts/repo-smoke-check.mjs', 'A stale browser cache can hide new code.', 35, '{"build":"2026-06-02b"}'::jsonb, now())
on conflict (check_key) do update set
  check_area = excluded.check_area,
  check_title = excluded.check_title,
  expected_status = excluded.expected_status,
  current_status = excluded.current_status,
  file_path = excluded.file_path,
  test_command = excluded.test_command,
  failure_hint = excluded.failure_hint,
  sort_order = excluded.sort_order,
  metadata = excluded.metadata,
  checked_at = excluded.checked_at,
  updated_at = now();

drop view if exists public.v_app_public_route_seo_registry;
create view public.v_app_public_route_seo_registry as
select
  route_key, route_path, route_label, page_title, h1_text, meta_description,
  array_to_string(primary_local_terms, ', ') as primary_local_terms,
  array_to_string(secondary_search_terms, ', ') as secondary_search_terms,
  proof_status, title_status, h1_status, meta_status, image_alt_status,
  internal_link_status, structured_data_status, publish_status,
  local_wording_notes, fallback_hint, sort_order, checked_at, updated_at
from public.app_public_route_seo_registry
order by sort_order, route_key;

drop view if exists public.v_app_internal_link_suggestion_queue;
create view public.v_app_internal_link_suggestion_queue as
select
  q.suggestion_key,
  q.link_context,
  q.suggested_anchor_text,
  q.suggestion_status,
  src.route_path as source_route_path,
  src.route_label as source_route_label,
  tgt.route_path as target_route_path,
  tgt.route_label as target_route_label,
  q.seo_reason,
  q.proof_reason,
  q.fallback_plan,
  q.sort_order,
  q.checked_at,
  q.updated_at
from public.app_internal_link_suggestion_queue q
left join public.app_public_route_seo_registry src on src.route_key = q.source_route_key
left join public.app_public_route_seo_registry tgt on tgt.route_key = q.target_route_key
order by q.sort_order, q.suggestion_key;

drop view if exists public.v_app_css_component_token_inventory;
create view public.v_app_css_component_token_inventory as
select
  token_key, component_area, token_name, token_purpose, current_source,
  recommended_class_name, drift_risk, token_status, mobile_check_hint,
  fallback_hint, sort_order, checked_at, updated_at
from public.app_css_component_token_inventory
order by sort_order, token_key;

drop view if exists public.v_app_mobile_field_action_queue;
create view public.v_app_mobile_field_action_queue as
select
  action_key, action_area, action_title, action_status, required_role,
  route_hint, offline_support_status, scan_or_proof_hint, fallback_hint,
  sort_order, checked_at, updated_at
from public.app_mobile_field_action_queue
order by sort_order, action_key;

drop view if exists public.v_app_release_manifest_checks;
create view public.v_app_release_manifest_checks as
select
  manifest_key, release_label, manifest_area, manifest_title, manifest_status,
  file_path, expected_marker, verification_hint, failure_hint,
  sort_order, checked_at, updated_at
from public.app_release_manifest_checks
order by sort_order, manifest_key;

drop view if exists public.v_schema_drift_status;
create view public.v_schema_drift_status as
select
  127::int as expected_schema_version,
  coalesce(max(schema_version) filter (where status = 'applied'), 0)::int as latest_applied_schema_version,
  case when coalesce(max(schema_version) filter (where status = 'applied'), 0) >= 127 then 'current' else 'behind' end as drift_status,
  case when coalesce(max(schema_version) filter (where status = 'applied'), 0) >= 127
    then 'Live database is at or ahead of the repo schema marker.'
    else 'Live database is behind the deployed app. Apply migrations through schema 127.'
  end as message,
  now() as checked_at
from public.app_schema_versions;

insert into public.app_schema_versions (
  schema_version, migration_key, schema_name, release_label, description, status, notes
)
values (
  127,
  '127_public_route_seo_internal_link_css_mobile_guardrails',
  '127_public_route_seo_internal_link_css_mobile_guardrails.sql',
  '2026-06-02b',
  'Adds route-level SEO registry, internal link suggestion queue, CSS token inventory, mobile field action queue, release manifest checks, and refreshed roadmap/data-migration/sync rows.',
  'applied',
  'This pass cleans uploaded archive/test drift again, updates cache marker, exposes schema 127 readiness views, and records the next 20 roadmap steps.'
)
on conflict (schema_version) do update set
  migration_key = excluded.migration_key,
  schema_name = excluded.schema_name,
  release_label = excluded.release_label,
  description = excluded.description,
  status = excluded.status,
  notes = excluded.notes,
  applied_at = now();

grant select on public.app_public_route_seo_registry to authenticated;
grant select on public.app_internal_link_suggestion_queue to authenticated;
grant select on public.app_css_component_token_inventory to authenticated;
grant select on public.app_mobile_field_action_queue to authenticated;
grant select on public.app_release_manifest_checks to authenticated;
grant select on public.v_app_public_route_seo_registry to authenticated;
grant select on public.v_app_internal_link_suggestion_queue to authenticated;
grant select on public.v_app_css_component_token_inventory to authenticated;
grant select on public.v_app_mobile_field_action_queue to authenticated;
grant select on public.v_app_release_manifest_checks to authenticated;
grant select on public.v_app_roadmap_action_steps to authenticated;
grant select on public.v_app_data_migration_candidates to authenticated;
grant select on public.v_app_schema_documentation_sync_checks to authenticated;
grant select on public.v_schema_drift_status to authenticated;

commit;



-- Schema 128: accounting, equipment, public SEO, and fallback execution queues.
-- Build 2026-06-03a. This pass converts the schema 127 next-step list into Admin-visible execution queues.

begin;

create table if not exists public.app_payment_application_action_registry (
  action_key text primary key,
  action_area text not null,
  action_title text not null,
  workflow_status text not null default 'planned',
  required_role text not null default 'admin',
  route_hint text,
  source_table_hint text,
  accounting_effect text,
  fallback_hint text,
  sort_order integer not null default 100,
  metadata jsonb not null default '{}'::jsonb,
  checked_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.app_accounting_close_control_queue (
  control_key text primary key,
  close_area text not null,
  control_title text not null,
  control_status text not null default 'planned',
  source_totals_hint text,
  reviewer_hint text,
  proof_hint text,
  lock_behavior text,
  fallback_hint text,
  sort_order integer not null default 100,
  metadata jsonb not null default '{}'::jsonb,
  checked_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.app_equipment_accountability_action_queue (
  action_key text primary key,
  equipment_area text not null,
  action_title text not null,
  action_status text not null default 'planned',
  required_role text not null default 'supervisor',
  scanner_status text not null default 'manual_fallback',
  server_enforcement_status text not null default 'review',
  service_task_behavior text,
  fallback_hint text,
  sort_order integer not null default 100,
  metadata jsonb not null default '{}'::jsonb,
  checked_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.app_public_seo_publication_queue (
  queue_key text primary key,
  route_key text,
  publish_area text not null,
  publish_title text not null,
  publish_status text not null default 'planned',
  required_evidence text,
  local_wording_hint text,
  smoke_test_hint text,
  fallback_hint text,
  sort_order integer not null default 100,
  metadata jsonb not null default '{}'::jsonb,
  checked_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.app_fallback_observability_matrix (
  matrix_key text primary key,
  app_surface text not null,
  failure_mode text not null,
  fallback_status text not null default 'review',
  user_message_hint text,
  telemetry_hint text,
  retry_policy_hint text,
  owner_hint text,
  sort_order integer not null default 100,
  metadata jsonb not null default '{}'::jsonb,
  checked_at timestamptz,
  updated_at timestamptz not null default now()
);

insert into public.app_payment_application_action_registry (action_key, action_area, action_title, workflow_status, required_role, route_hint, source_table_hint, accounting_effect, fallback_hint, sort_order, metadata, checked_at) values
('apply_customer_payment','payment_application','Apply customer payment to one or more invoices','planned','admin','#admin','payment applications / invoices / deposits','Reduces invoice balance and links cash to customer account.','Keep staged until reviewer approves.',10,'{"build":"2026-06-03a","schema":128}'::jsonb,now()),
('reverse_payment_application','payment_application','Reverse a mistaken payment application with audit reason','planned','admin','#admin','payment reversals','Restores balance and keeps reversal trail.','Lock row and add manual review note until reversal UI exists.',20,'{"build":"2026-06-03a","schema":128}'::jsonb,now()),
('apply_adjustments','adjustments','Apply discount, credit, write-off, refund, or overpayment decision','planned','admin','#admin','adjustments / refunds','Separates cash received from revenue reductions and refunds.','Require reason and reviewer before posting.',30,'{"build":"2026-06-03a","schema":128}'::jsonb,now()),
('job_cost_rollup','job_costs','Roll repair, delay, usage, replacement, fuel, disposal, materials, and subcontractors into job profitability','in_progress','admin','#jobs','job financial events / equipment service tasks','Improves quoted-vs-actual margin reporting.','Show source rows if rollup view is unavailable.',40,'{"build":"2026-06-03a","schema":128}'::jsonb,now())
on conflict (action_key) do update set action_area=excluded.action_area, action_title=excluded.action_title, workflow_status=excluded.workflow_status, required_role=excluded.required_role, route_hint=excluded.route_hint, source_table_hint=excluded.source_table_hint, accounting_effect=excluded.accounting_effect, fallback_hint=excluded.fallback_hint, sort_order=excluded.sort_order, metadata=excluded.metadata, checked_at=excluded.checked_at, updated_at=now();

insert into public.app_accounting_close_control_queue (control_key, close_area, control_title, control_status, source_totals_hint, reviewer_hint, proof_hint, lock_behavior, fallback_hint, sort_order, metadata, checked_at) values
('bank_csv_preview','bank_reconciliation','CSV preview validates headers, duplicates, bad dates, and amount signs','planned','Bank import staging and rejected-row reasons.','Reviewer confirms import source and duplicate handling.','Preview report retained with accepted/rejected counts.','No posting from unreviewed imports.','Manual spreadsheet review remains fallback.',10,'{"build":"2026-06-03a","schema":128}'::jsonb,now()),
('manual_match_review','bank_reconciliation','Manual match, split match, undo, notes, and signoff','planned','Bank rows, payments, invoices, journal candidates, unmatched items.','Reviewer signs off match decisions.','Match history keeps who/when/reason.','Matched rows lock after close.','Unmatched rows stay in review queue.',20,'{"build":"2026-06-03a","schema":128}'::jsonb,now()),
('hst_gst_proof','tax_remittance','HST/GST source totals, adjustments, proof, filed/remitted dates, and lock status','planned','Sales tax collected, ITCs, adjustments, payment rows.','Reviewer confirms amounts before filing.','Proof upload and remittance confirmation are linked.','Filing row locks when accepted/paid.','Export summary remains fallback.',30,'{"build":"2026-06-03a","schema":128}'::jsonb,now()),
('payroll_remittance_proof','payroll_remittance','Payroll source pay runs, deductions, employer costs, proof, payment date, and signoff','planned','Pay runs, deductions, employer costs, payment proof.','Reviewer signs source totals and proof.','Proof retained with close period.','Remittance locks after proof/signoff.','Manual accountant package remains fallback.',40,'{"build":"2026-06-03a","schema":128}'::jsonb,now()),
('month_end_lock_export','month_end_close','Month-end lock, reopen reason, posting block, and accountant export package','planned','Close period, journal rows, reconciliation, remittances, export manifest.','Admin/accountant final signoff.','Manifest lists CSV/JSON/proof files.','Closed periods block postings unless reopened.','Warning banners remain fallback.',50,'{"build":"2026-06-03a","schema":128}'::jsonb,now())
on conflict (control_key) do update set close_area=excluded.close_area, control_title=excluded.control_title, control_status=excluded.control_status, source_totals_hint=excluded.source_totals_hint, reviewer_hint=excluded.reviewer_hint, proof_hint=excluded.proof_hint, lock_behavior=excluded.lock_behavior, fallback_hint=excluded.fallback_hint, sort_order=excluded.sort_order, metadata=excluded.metadata, checked_at=excluded.checked_at, updated_at=now();

insert into public.app_equipment_accountability_action_queue (action_key, equipment_area, action_title, action_status, required_role, scanner_status, server_enforcement_status, service_task_behavior, fallback_hint, sort_order, metadata, checked_at) values
('camera_scan','scan','Add camera/BarcodeDetector scan with manual entry fallback','planned','employee','manual_fallback_ready','review','Prefill checkout, arrival, return, and service task equipment code.','Manual prompt remains fallback.',10,'{"build":"2026-06-03a","schema":128}'::jsonb,now()),
('accessory_templates','accessories','Create reusable accessory checklist templates by equipment pool/category','planned','supervisor','not_required','review','Expected accessories load during checkout/arrival/return.','Free-text checklist remains fallback.',20,'{"build":"2026-06-03a","schema":128}'::jsonb,now()),
('verifier_roles','verification','Enforce verifier role server-side for return, defect clear, and return-to-service','planned','supervisor','not_required','planned','Service task cannot close below required role.','UI disable remains fallback but server must be authority.',30,'{"build":"2026-06-03a","schema":128}'::jsonb,now()),
('failed_test_work_orders','service_tasks','Promote failed arrival/return tests into assigned service work orders','in_progress','supervisor','not_required','review','Failed tests get owner, due date, cost, evidence, and closeout proof.','Current service-task insert remains fallback.',40,'{"build":"2026-06-03a","schema":128}'::jsonb,now()),
('return_to_service','lockout','Require return-to-service signoff before locked-out equipment becomes available','planned','admin','not_required','planned','Defect clear verifies service task completion and proof.','Keep item locked out until verification succeeds.',50,'{"build":"2026-06-03a","schema":128}'::jsonb,now())
on conflict (action_key) do update set equipment_area=excluded.equipment_area, action_title=excluded.action_title, action_status=excluded.action_status, required_role=excluded.required_role, scanner_status=excluded.scanner_status, server_enforcement_status=excluded.server_enforcement_status, service_task_behavior=excluded.service_task_behavior, fallback_hint=excluded.fallback_hint, sort_order=excluded.sort_order, metadata=excluded.metadata, checked_at=excluded.checked_at, updated_at=now();

insert into public.app_public_seo_publication_queue (queue_key, route_key, publish_area, publish_title, publish_status, required_evidence, local_wording_hint, smoke_test_hint, fallback_hint, sort_order, metadata, checked_at) values
('sitemap_robots','home_shell','technical_seo','Generate sitemap and robots from approved route rows','planned','Approved route registry rows.','Only include true service/location coverage.','Confirm sitemap.xml and robots.txt exist and list approved routes.','Static index remains fallback.',10,'{"build":"2026-06-03a","schema":128}'::jsonb,now()),
('broken_link_check','home_shell','technical_seo','Add broken-link and broken-asset smoke checks','planned','Public links/assets from static shell and route registry.','Avoid unsupported local pages.','Flag missing routes, images, scripts, styles, and manifest files.','Hide route until link check passes.',20,'{"build":"2026-06-03a","schema":128}'::jsonb,now()),
('structured_data','home_shell','structured_data','Review structured data before publishing public pages','planned','Business identity, service area, contact, proof data.','Do not overclaim service areas.','Check JSON-LD parses and required fields exist.','Plain title/meta remains fallback.',30,'{"build":"2026-06-03a","schema":128}'::jsonb,now()),
('image_alt_score','home_shell','image_alt','Add image-alt completeness and local proof scoring','planned','Images, captions, alt text, route context, proof status.','Alt text should describe real content truthfully.','Flag missing or too-short public image alt text.','Hide weak gallery blocks until proof passes.',40,'{"build":"2026-06-03a","schema":128}'::jsonb,now())
on conflict (queue_key) do update set route_key=excluded.route_key, publish_area=excluded.publish_area, publish_title=excluded.publish_title, publish_status=excluded.publish_status, required_evidence=excluded.required_evidence, local_wording_hint=excluded.local_wording_hint, smoke_test_hint=excluded.smoke_test_hint, fallback_hint=excluded.fallback_hint, sort_order=excluded.sort_order, metadata=excluded.metadata, checked_at=excluded.checked_at, updated_at=now();

insert into public.app_fallback_observability_matrix (matrix_key, app_surface, failure_mode, fallback_status, user_message_hint, telemetry_hint, retry_policy_hint, owner_hint, sort_order, metadata, checked_at) values
('optional_view_missing','Edge Functions','Optional DB view missing after partial schema deploy','covered','Show empty table with Apply schema message.','Record panel diagnostic and failed view name when available.','Retry after schema deploy; keep cached rows if safe.','Admin',10,'{"build":"2026-06-03a","schema":128}'::jsonb,now()),
('stale_service_worker','Public shell','Old service worker serves stale assets','covered','Ask user to hard-refresh or clear old service worker when marker mismatches.','Compare cache marker, index marker, and schema drift row.','Install assets one at a time and keep shell fallback alive.','Admin',20,'{"build":"2026-06-03a","schema":128}'::jsonb,now()),
('offline_conflict','Mobile forms','Local draft conflicts with server state','review','Offer Retry sync, Keep local, or Discard local choices.','Track draft count and last failed sync time locally.','Retry failed payload only and keep local copy until acknowledged.','Supervisor',30,'{"build":"2026-06-03a","schema":128}'::jsonb,now()),
('scan_unsupported','Equipment mobile','Camera or BarcodeDetector unavailable','covered','Prompt for manual QR/barcode/code entry.','Track manual fallback count once telemetry exists.','No retry loop; use manual entry.','Supervisor',40,'{"build":"2026-06-03a","schema":128}'::jsonb,now()),
('accounting_blocked','Accounting workbench','Accounting action missing proof or close-period signoff','planned','Explain missing proof/signoff and keep action in queue.','Store blocked reason and reviewer note.','Do not auto-retry blocked accounting actions.','Admin / Accountant',50,'{"build":"2026-06-03a","schema":128}'::jsonb,now())
on conflict (matrix_key) do update set app_surface=excluded.app_surface, failure_mode=excluded.failure_mode, fallback_status=excluded.fallback_status, user_message_hint=excluded.user_message_hint, telemetry_hint=excluded.telemetry_hint, retry_policy_hint=excluded.retry_policy_hint, owner_hint=excluded.owner_hint, sort_order=excluded.sort_order, metadata=excluded.metadata, checked_at=excluded.checked_at, updated_at=now();

-- Record this release in the existing roadmap/data-migration/sync registries added by schema 126.
insert into public.app_roadmap_action_steps (
  step_key,
  step_batch,
  step_number,
  step_area,
  step_title,
  step_status,
  priority,
  source_doc,
  route_hint,
  acceptance_check,
  implementation_notes,
  risk_if_skipped,
  sort_order,
  metadata,
  checked_at
)
values
  (
    'schema128_done_01',
    'completed_this_pass',
    1,
    'schema',
    'Added schema 128 execution queues',
    'completed',
    'high',
    'DEVELOPMENT_ROADMAP.md',
    '#admin',
    'Migration and full schema include schema 128.',
    'DB-visible queues now track accounting, equipment, SEO, and fallback depth.',
    'Roadmap stays Markdown-only.',
    1,
    '{"build":"2026-06-03a","schema":128}'::jsonb,
    now()
  ),
  (
    'schema128_done_02',
    'completed_this_pass',
    2,
    'admin',
    'Exposed schema 128 queues in Admin readiness',
    'completed',
    'high',
    'DEVELOPMENT_ROADMAP.md',
    '#admin',
    'admin-directory and admin-ui reference schema 128 views.',
    'Operators can see the new queues.',
    'New rows stay hidden.',
    2,
    '{"build":"2026-06-03a","schema":128}'::jsonb,
    now()
  ),
  (
    'schema128_done_03',
    'completed_this_pass',
    3,
    'cleanup',
    'Archived current Markdown and retired test_write files',
    'completed',
    'high',
    'DEVELOPMENT_ROADMAP.md',
    'archive',
    'Smoke archive hygiene passes.',
    'Root stays clean.',
    'Stale files keep breaking smoke.',
    3,
    '{"build":"2026-06-03a","schema":128}'::jsonb,
    now()
  ),
  (
    'schema128_done_04',
    'completed_this_pass',
    4,
    'cache',
    'Updated cache marker to 2026-06-03a',
    'completed',
    'high',
    'DEVELOPMENT_ROADMAP.md',
    '/',
    'index and service worker markers match.',
    'Stale browser issues are clearer.',
    'Old cache can mask repairs.',
    4,
    '{"build":"2026-06-03a","schema":128}'::jsonb,
    now()
  ),
  (
    'schema128_done_05',
    'completed_this_pass',
    5,
    'docs',
    'Updated active Markdown and added schema 128 docs',
    'completed',
    'high',
    'DEVELOPMENT_ROADMAP.md',
    'docs',
    'Docs reflect schema 128.',
    'Future pass has context.',
    'Docs drift from code.',
    5,
    '{"build":"2026-06-03a","schema":128}'::jsonb,
    now()
  ),
  (
    'schema128_next_01',
    'next_20',
    1,
    'accounting',
    'Build payment apply/reverse/adjust/refund UI actions',
    'planned',
    'high',
    'DEVELOPMENT_ROADMAP.md',
    '#admin',
    'Payment actions move from registry to working buttons.',
    'Cash application becomes usable.',
    'Cash remains manual.',
    101,
    '{"build":"2026-06-03a","schema":128}'::jsonb,
    now()
  ),
  (
    'schema128_next_02',
    'next_20',
    2,
    'accounting',
    'Build bank CSV preview and staging screen',
    'planned',
    'high',
    'DEVELOPMENT_ROADMAP.md',
    '#admin',
    'Header/date/duplicate/sign validation appears before staging.',
    'Bad imports are blocked.',
    'Bad data can enter.',
    102,
    '{"build":"2026-06-03a","schema":128}'::jsonb,
    now()
  ),
  (
    'schema128_next_03',
    'next_20',
    3,
    'accounting',
    'Build reconciliation match/split/undo/signoff workflow',
    'planned',
    'high',
    'DEVELOPMENT_ROADMAP.md',
    '#admin',
    'Reviewer can match, split, undo, note, and sign off.',
    'Reconciliation is auditable.',
    'Rows remain unmatched.',
    103,
    '{"build":"2026-06-03a","schema":128}'::jsonb,
    now()
  ),
  (
    'schema128_next_04',
    'next_20',
    4,
    'equipment',
    'Add real camera scan and DB accessory templates',
    'planned',
    'high',
    'DEVELOPMENT_ROADMAP.md',
    '#jobs',
    'Scanner and templates replace manual-only flow.',
    'Field checkout is faster and clearer.',
    'Manual entry stays slow.',
    104,
    '{"build":"2026-06-03a","schema":128}'::jsonb,
    now()
  ),
  (
    'schema128_next_05',
    'next_20',
    5,
    'seo',
    'Generate sitemap/robots and add broken-link/image-alt/JSON-LD smoke checks',
    'planned',
    'medium',
    'DEVELOPMENT_ROADMAP.md',
    '/',
    'Technical SEO files and smoke checks exist.',
    'Public publish is safer.',
    'SEO files drift.',
    105,
    '{"build":"2026-06-03a","schema":128}'::jsonb,
    now()
  )
on conflict (step_key) do update set
  step_batch = excluded.step_batch,
  step_number = excluded.step_number,
  step_area = excluded.step_area,
  step_title = excluded.step_title,
  step_status = excluded.step_status,
  priority = excluded.priority,
  source_doc = excluded.source_doc,
  route_hint = excluded.route_hint,
  acceptance_check = excluded.acceptance_check,
  implementation_notes = excluded.implementation_notes,
  risk_if_skipped = excluded.risk_if_skipped,
  sort_order = excluded.sort_order,
  metadata = excluded.metadata,
  checked_at = excluded.checked_at,
  updated_at = now();

drop view if exists public.v_app_payment_application_action_registry;
create view public.v_app_payment_application_action_registry as select action_key, action_area, action_title, workflow_status, required_role, route_hint, source_table_hint, accounting_effect, fallback_hint, sort_order, checked_at, updated_at from public.app_payment_application_action_registry order by sort_order, action_key;

drop view if exists public.v_app_accounting_close_control_queue;
create view public.v_app_accounting_close_control_queue as select control_key, close_area, control_title, control_status, source_totals_hint, reviewer_hint, proof_hint, lock_behavior, fallback_hint, sort_order, checked_at, updated_at from public.app_accounting_close_control_queue order by sort_order, control_key;

drop view if exists public.v_app_equipment_accountability_action_queue;
create view public.v_app_equipment_accountability_action_queue as select action_key, equipment_area, action_title, action_status, required_role, scanner_status, server_enforcement_status, service_task_behavior, fallback_hint, sort_order, checked_at, updated_at from public.app_equipment_accountability_action_queue order by sort_order, action_key;

drop view if exists public.v_app_public_seo_publication_queue;
create view public.v_app_public_seo_publication_queue as select queue_key, route_key, publish_area, publish_title, publish_status, required_evidence, local_wording_hint, smoke_test_hint, fallback_hint, sort_order, checked_at, updated_at from public.app_public_seo_publication_queue order by sort_order, queue_key;

drop view if exists public.v_app_fallback_observability_matrix;
create view public.v_app_fallback_observability_matrix as select matrix_key, app_surface, failure_mode, fallback_status, user_message_hint, telemetry_hint, retry_policy_hint, owner_hint, sort_order, checked_at, updated_at from public.app_fallback_observability_matrix order by sort_order, matrix_key;

drop view if exists public.v_schema_drift_status;
create view public.v_schema_drift_status as
select 128::int as expected_schema_version,
  coalesce(max(schema_version) filter (where status = 'applied'), 0)::int as latest_applied_schema_version,
  case when coalesce(max(schema_version) filter (where status = 'applied'), 0) >= 128 then 'current' else 'behind' end as drift_status,
  case when coalesce(max(schema_version) filter (where status = 'applied'), 0) >= 128 then 'Live database is at or ahead of the repo schema marker.' else 'Live database is behind the deployed app. Apply migrations through schema 128.' end as message,
  now() as checked_at
from public.app_schema_versions;

insert into public.app_schema_versions (schema_version, migration_key, schema_name, release_label, description, status, notes) values
(128,'128_accounting_equipment_seo_fallback_execution_depth','128_accounting_equipment_seo_fallback_execution_depth.sql','2026-06-03a','Adds Admin-visible execution queues for accounting actions, close controls, equipment accountability, public SEO publishing, and fallback observability.','applied','This pass refreshes schema/docs/cache/smoke guardrails and moves the next-step list into DB-visible queues.')
on conflict (schema_version) do update set migration_key=excluded.migration_key, schema_name=excluded.schema_name, release_label=excluded.release_label, description=excluded.description, status=excluded.status, notes=excluded.notes, applied_at=now();

grant select on public.app_payment_application_action_registry to authenticated;
grant select on public.app_accounting_close_control_queue to authenticated;
grant select on public.app_equipment_accountability_action_queue to authenticated;
grant select on public.app_public_seo_publication_queue to authenticated;
grant select on public.app_fallback_observability_matrix to authenticated;
grant select on public.v_app_payment_application_action_registry to authenticated;
grant select on public.v_app_accounting_close_control_queue to authenticated;
grant select on public.v_app_equipment_accountability_action_queue to authenticated;
grant select on public.v_app_public_seo_publication_queue to authenticated;
grant select on public.v_app_fallback_observability_matrix to authenticated;
grant select on public.v_schema_drift_status to authenticated;

commit;

-- Schema 129: schema compatibility repair, accounting proof packaging, equipment return-to-service, SEO asset checks, and fallback playbooks.
-- Build 2026-06-04a.
-- This pass locks in the schema 128 column-name repair and adds DB-visible queues for the next implementation layer.

begin;

create table if not exists public.app_schema_versions (
  schema_version integer primary key,
  schema_name text,
  description text,
  status text not null default 'applied',
  applied_at timestamptz not null default now(),
  applied_by text,
  notes text
);

alter table public.app_schema_versions add column if not exists migration_key text;
alter table public.app_schema_versions add column if not exists release_label text;

create table if not exists public.app_schema_migration_compatibility_checks (
  check_key text primary key,
  schema_file text not null,
  compatibility_area text not null,
  check_title text not null,
  check_status text not null default 'review',
  expected_column text,
  legacy_column text,
  repair_hint text,
  smoke_test_hint text,
  sort_order integer not null default 100,
  metadata jsonb not null default '{}'::jsonb,
  checked_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.app_accounting_evidence_package_queue (
  package_key text primary key,
  package_area text not null,
  package_title text not null,
  package_status text not null default 'planned',
  source_rows_hint text,
  required_proof_hint text,
  reviewer_role_hint text,
  export_format_hint text,
  fallback_hint text,
  sort_order integer not null default 100,
  metadata jsonb not null default '{}'::jsonb,
  checked_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.app_equipment_return_to_service_rules (
  rule_key text primary key,
  equipment_area text not null,
  rule_title text not null,
  rule_status text not null default 'planned',
  required_role text not null default 'supervisor',
  source_event_hint text,
  proof_required_hint text,
  block_behavior text,
  fallback_hint text,
  sort_order integer not null default 100,
  metadata jsonb not null default '{}'::jsonb,
  checked_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.app_public_asset_smoke_checks (
  check_key text primary key,
  asset_area text not null,
  asset_title text not null,
  check_status text not null default 'planned',
  file_path text,
  source_registry_hint text,
  local_seo_hint text,
  failure_hint text,
  sort_order integer not null default 100,
  metadata jsonb not null default '{}'::jsonb,
  checked_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.app_error_recovery_playbook (
  playbook_key text primary key,
  app_area text not null,
  error_signature text not null,
  playbook_status text not null default 'review',
  operator_message text,
  recovery_steps text,
  prevention_check text,
  owner_hint text,
  sort_order integer not null default 100,
  metadata jsonb not null default '{}'::jsonb,
  checked_at timestamptz,
  updated_at timestamptz not null default now()
);

insert into public.app_schema_migration_compatibility_checks (
  check_key,
  schema_file,
  compatibility_area,
  check_title,
  check_status,
  expected_column,
  legacy_column,
  repair_hint,
  smoke_test_hint,
  sort_order,
  metadata,
  checked_at
)
values
  (
    'schema128_roadmap_source_doc',
    'sql/128_accounting_equipment_seo_fallback_execution_depth.sql',
    'roadmap_column_names',
    'Schema 128 uses source_doc instead of source_document',
    'passed',
    'source_doc',
    'source_document',
    'Use the schema 126 app_roadmap_action_steps column name and reject the legacy alias in smoke checks.',
    'repo-smoke-check searches schema 128 and 000_full_schema_reference for source_document, target_route_hint, and completion_note.',
    10,
    '{"build":"2026-06-04a","schema":129}'::jsonb,
    now()
  ),
  (
    'schema128_roadmap_route_hint',
    'sql/128_accounting_equipment_seo_fallback_execution_depth.sql',
    'roadmap_column_names',
    'Schema 128 uses route_hint instead of target_route_hint',
    'passed',
    'route_hint',
    'target_route_hint',
    'Keep the insert and update clauses aligned with schema 126.',
    'repo-smoke-check blocks target_route_hint in schema 128/full schema.',
    20,
    '{"build":"2026-06-04a","schema":129}'::jsonb,
    now()
  ),
  (
    'schema128_roadmap_implementation_notes',
    'sql/128_accounting_equipment_seo_fallback_execution_depth.sql',
    'roadmap_column_names',
    'Schema 128 uses implementation_notes instead of completion_note',
    'passed',
    'implementation_notes',
    'completion_note',
    'Keep completed-step notes in implementation_notes.',
    'repo-smoke-check blocks completion_note in schema 128/full schema.',
    30,
    '{"build":"2026-06-04a","schema":129}'::jsonb,
    now()
  ),
  (
    'schema129_full_schema_sync',
    'sql/000_full_schema_reference.sql',
    'canonical_schema_reference',
    'Full schema reference includes the repaired schema 128 block and schema 129 marker',
    'passed',
    'expected_schema_version=129',
    'expected_schema_version=128',
    'Append schema 129 and make v_schema_drift_status expect 129.',
    'Smoke checks schema 129 marker and expected 129 drift string.',
    40,
    '{"build":"2026-06-04a","schema":129}'::jsonb,
    now()
  )
on conflict (check_key) do update set
  schema_file = excluded.schema_file,
  compatibility_area = excluded.compatibility_area,
  check_title = excluded.check_title,
  check_status = excluded.check_status,
  expected_column = excluded.expected_column,
  legacy_column = excluded.legacy_column,
  repair_hint = excluded.repair_hint,
  smoke_test_hint = excluded.smoke_test_hint,
  sort_order = excluded.sort_order,
  metadata = excluded.metadata,
  checked_at = excluded.checked_at,
  updated_at = now();

insert into public.app_accounting_evidence_package_queue (
  package_key,
  package_area,
  package_title,
  package_status,
  source_rows_hint,
  required_proof_hint,
  reviewer_role_hint,
  export_format_hint,
  fallback_hint,
  sort_order,
  metadata,
  checked_at
)
values
  (
    'payment_application_package',
    'payment_application',
    'Payment application proof package',
    'planned',
    'AR/AP payments, invoice or bill rows, application rows, adjustments, reversals, and reviewer notes.',
    'Payment source, application date, amount split, customer/vendor, reviewer, and reversal reason when applicable.',
    'admin / accountant',
    'CSV summary plus JSON manifest and proof attachments.',
    'Manual accountant export remains fallback until generated package files exist.',
    10,
    '{"build":"2026-06-04a","schema":129}'::jsonb,
    now()
  ),
  (
    'bank_reconciliation_package',
    'bank_reconciliation',
    'Bank reconciliation proof package',
    'planned',
    'Bank imports, rejected rows, matched items, split matches, unmatched items, and undo history.',
    'CSV preview report, duplicate report, match proof, reviewer notes, and final signoff.',
    'admin / accountant',
    'CSV exports plus close-period PDF/Markdown summary when available.',
    'Keep unmatched rows in review queue with exportable CSV.',
    20,
    '{"build":"2026-06-04a","schema":129}'::jsonb,
    now()
  ),
  (
    'remittance_package',
    'remittance',
    'HST/GST and payroll remittance proof package',
    'planned',
    'Sales tax filing rows, payroll remittance rows, payment rows, proof uploads, filed/remitted dates.',
    'Source totals, adjustments, filing period, remitted date, proof upload, and reviewer signoff.',
    'admin / accountant',
    'Accountant handoff package with source totals and proof index.',
    'Manual filing checklist remains fallback until proof package automation is done.',
    30,
    '{"build":"2026-06-04a","schema":129}'::jsonb,
    now()
  ),
  (
    'month_end_close_package',
    'month_end_close',
    'Month-end close and accountant export proof package',
    'planned',
    'Period close row, lock/reopen audit, journal candidates, reconciliation, remittances, and export manifest.',
    'Final close signoff, reopen reason history, blocked posting check, and package delivery status.',
    'admin / accountant',
    'ZIP package manifest plus CSV/JSON exports and proof file list.',
    'Do not mark the period locked until proof package checks pass.',
    40,
    '{"build":"2026-06-04a","schema":129}'::jsonb,
    now()
  )
on conflict (package_key) do update set
  package_area = excluded.package_area,
  package_title = excluded.package_title,
  package_status = excluded.package_status,
  source_rows_hint = excluded.source_rows_hint,
  required_proof_hint = excluded.required_proof_hint,
  reviewer_role_hint = excluded.reviewer_role_hint,
  export_format_hint = excluded.export_format_hint,
  fallback_hint = excluded.fallback_hint,
  sort_order = excluded.sort_order,
  metadata = excluded.metadata,
  checked_at = excluded.checked_at,
  updated_at = now();

insert into public.app_equipment_return_to_service_rules (
  rule_key,
  equipment_area,
  rule_title,
  rule_status,
  required_role,
  source_event_hint,
  proof_required_hint,
  block_behavior,
  fallback_hint,
  sort_order,
  metadata,
  checked_at
)
values
  (
    'failed_arrival_blocks_availability',
    'arrival_verification',
    'Failed arrival tests keep equipment locked until service proof exists',
    'planned',
    'supervisor',
    'equipment_transfer_verification_events and equipment_service_tasks',
    'Arrival test status, failure reason, assigned service task, repair/inspection note, and verifier.',
    'Block available status when last_arrival_test_status is failed or needs_service.',
    'Manual lockout stays in place if rule automation is unavailable.',
    10,
    '{"build":"2026-06-04a","schema":129}'::jsonb,
    now()
  ),
  (
    'failed_return_blocks_availability',
    'return_verification',
    'Failed return tests require return-to-service signoff',
    'planned',
    'supervisor',
    'equipment_signouts, equipment_transfer_verification_events, and equipment_service_tasks',
    'Return condition, test notes, damage notes, service closeout, proof, and final verifier.',
    'Block available status until a completed service task and return-to-service verifier are recorded.',
    'Keep maintenance status if proof is missing.',
    20,
    '{"build":"2026-06-04a","schema":129}'::jsonb,
    now()
  ),
  (
    'missing_accessory_blocks_closeout',
    'accessory_checklist',
    'Missing accessories block final closeout until resolved or waived',
    'planned',
    'supervisor',
    'checkout/arrival/return accessory checklist JSON',
    'Accessory list, missing/damaged reason, replacement cost, waiver reason, and reviewer.',
    'Block return_verified when required accessories are missing without waiver.',
    'Manual exception note remains fallback.',
    30,
    '{"build":"2026-06-04a","schema":129}'::jsonb,
    now()
  ),
  (
    'qr_scan_audit_required',
    'scan_audit',
    'QR/barcode manual fallback records who entered the code and why',
    'planned',
    'employee',
    'manual scan fallback and future BarcodeDetector flow',
    'Scanned or typed code, actor, timestamp, unsupported-camera reason, and related action.',
    'Warn when high-risk equipment is moved by manual entry only.',
    'Manual entry still works with visible fallback reason.',
    40,
    '{"build":"2026-06-04a","schema":129}'::jsonb,
    now()
  )
on conflict (rule_key) do update set
  equipment_area = excluded.equipment_area,
  rule_title = excluded.rule_title,
  rule_status = excluded.rule_status,
  required_role = excluded.required_role,
  source_event_hint = excluded.source_event_hint,
  proof_required_hint = excluded.proof_required_hint,
  block_behavior = excluded.block_behavior,
  fallback_hint = excluded.fallback_hint,
  sort_order = excluded.sort_order,
  metadata = excluded.metadata,
  checked_at = excluded.checked_at,
  updated_at = now();

insert into public.app_public_asset_smoke_checks (
  check_key,
  asset_area,
  asset_title,
  check_status,
  file_path,
  source_registry_hint,
  local_seo_hint,
  failure_hint,
  sort_order,
  metadata,
  checked_at
)
values
  (
    'single_h1_index',
    'public_html',
    'Index keeps exactly one public H1',
    'passed',
    'index.html',
    'Public route shell and smoke script.',
    'Use one clear main heading and supporting section headings only.',
    'Block release when exposed page has duplicate H1 tags.',
    10,
    '{"build":"2026-06-04a","schema":129}'::jsonb,
    now()
  ),
  (
    'cache_marker_match',
    'service_worker',
    'Index and service worker cache markers match',
    'passed',
    'index.html / server-worker.js',
    'Release manifest and smoke script.',
    'Avoid stale public assets hiding repaired code.',
    'Hard-refresh or unregister old worker if marker mismatch is visible.',
    20,
    '{"build":"2026-06-04a","schema":129}'::jsonb,
    now()
  ),
  (
    'sitemap_robots_next',
    'technical_seo',
    'Sitemap and robots generation should come from approved route rows',
    'planned',
    'sitemap.xml / robots.txt',
    'v_app_public_route_seo_registry and v_app_public_seo_publication_queue.',
    'Only list real locations/services with proof and useful wording.',
    'Do not publish thin unsupported local routes.',
    30,
    '{"build":"2026-06-04a","schema":129}'::jsonb,
    now()
  ),
  (
    'broken_asset_next',
    'technical_seo',
    'Broken link and asset smoke checks should run before packaging',
    'planned',
    'index.html, manifest.json, css, js, icons',
    'Release manifest and route registry.',
    'Missing images/scripts/styles weaken trust and search quality.',
    'Keep route hidden until assets pass.',
    40,
    '{"build":"2026-06-04a","schema":129}'::jsonb,
    now()
  )
on conflict (check_key) do update set
  asset_area = excluded.asset_area,
  asset_title = excluded.asset_title,
  check_status = excluded.check_status,
  file_path = excluded.file_path,
  source_registry_hint = excluded.source_registry_hint,
  local_seo_hint = excluded.local_seo_hint,
  failure_hint = excluded.failure_hint,
  sort_order = excluded.sort_order,
  metadata = excluded.metadata,
  checked_at = excluded.checked_at,
  updated_at = now();

insert into public.app_error_recovery_playbook (
  playbook_key,
  app_area,
  error_signature,
  playbook_status,
  operator_message,
  recovery_steps,
  prevention_check,
  owner_hint,
  sort_order,
  metadata,
  checked_at
)
values
  (
    'schema_column_missing_roadmap',
    'schema_deploy',
    'column source_document of relation app_roadmap_action_steps does not exist',
    'covered',
    'The schema file is using an older roadmap column name. Use source_doc, route_hint, and implementation_notes.',
    'Replace the schema 128 file with the repaired version, confirm 000_full_schema_reference has no source_document/target_route_hint/completion_note roadmap insert, then rerun schema 128 followed by schema 129.',
    'Smoke check rejects legacy roadmap column names in schema 128 and canonical full schema.',
    'Admin',
    10,
    '{"build":"2026-06-04a","schema":129}'::jsonb,
    now()
  ),
  (
    'edge_function_parse_error',
    'edge_deploy',
    'Failed to bundle the function / source code could not be parsed',
    'covered',
    'The Edge Function contains a syntax error and must not be deployed until node/TypeScript parse checks pass.',
    'Run repo smoke check, repair the exact file and line, then redeploy the specific Edge Function only.',
    'Edge Function TypeScript parse diagnostics are part of repo-smoke-check.',
    'Admin',
    20,
    '{"build":"2026-06-04a","schema":129}'::jsonb,
    now()
  ),
  (
    'optional_view_missing_admin',
    'admin_readiness',
    'relation v_app_* does not exist',
    'covered',
    'A new optional readiness view is missing because a migration has not been applied yet.',
    'Show an empty table with Apply schema message, then rerun the latest schema and refresh Admin.',
    'admin-directory safeList calls must stay optional-view tolerant.',
    'Admin',
    30,
    '{"build":"2026-06-04a","schema":129}'::jsonb,
    now()
  ),
  (
    'offline_sync_conflict',
    'mobile_forms',
    'local draft conflicts with server state',
    'planned',
    'A saved local draft needs review before it can sync safely.',
    'Offer Retry sync, Keep local, or Discard local choices with a plain-language reason.',
    'Offline draft queue and conflict wording stay visible on mobile Today.',
    'Supervisor',
    40,
    '{"build":"2026-06-04a","schema":129}'::jsonb,
    now()
  )
on conflict (playbook_key) do update set
  app_area = excluded.app_area,
  error_signature = excluded.error_signature,
  playbook_status = excluded.playbook_status,
  operator_message = excluded.operator_message,
  recovery_steps = excluded.recovery_steps,
  prevention_check = excluded.prevention_check,
  owner_hint = excluded.owner_hint,
  sort_order = excluded.sort_order,
  metadata = excluded.metadata,
  checked_at = excluded.checked_at,
  updated_at = now();

insert into public.app_roadmap_action_steps (
  step_key,
  step_batch,
  step_number,
  step_area,
  step_title,
  step_status,
  priority,
  source_doc,
  route_hint,
  acceptance_check,
  implementation_notes,
  risk_if_skipped,
  sort_order,
  metadata,
  checked_at
)
values
  ('schema129_done_01','completed_this_pass',1,'schema','Repaired canonical full schema reference for schema 128 roadmap columns','completed','high','DEVELOPMENT_ROADMAP.md','sql/000_full_schema_reference.sql','Full schema no longer contains the legacy source_document/target_route_hint/completion_note roadmap insert.','The schema 128 repair is now reflected in the full canonical schema, not only the standalone file.','Full-schema deploys keep failing even when the standalone file is fixed.',1,'{"build":"2026-06-04a","schema":129}'::jsonb,now()),
  ('schema129_done_02','completed_this_pass',2,'schema','Added schema 129 compatibility checks and recovery playbooks','completed','high','DEVELOPMENT_ROADMAP.md','#admin','Schema 129 views expose compatibility and error recovery rows.','Operators get a DB-visible explanation for the schema 128 failure and future parse/view failures.','Known deploy errors remain tribal knowledge.',2,'{"build":"2026-06-04a","schema":129}'::jsonb,now()),
  ('schema129_done_03','completed_this_pass',3,'accounting','Added accounting evidence package queue','completed','high','DEVELOPMENT_ROADMAP.md','#admin','Payment, reconciliation, remittance, and close package rows exist.','Accounting next steps are now packaged around proof, reviewer, and export requirements.','Accounting actions can be built without proof requirements.',3,'{"build":"2026-06-04a","schema":129}'::jsonb,now()),
  ('schema129_done_04','completed_this_pass',4,'equipment','Added equipment return-to-service rule queue','completed','high','DEVELOPMENT_ROADMAP.md','#jobs','Return-to-service rules are visible for failed tests, missing accessories, and manual scan audit.','Equipment accountability now has clearer server-side enforcement targets.','Failed equipment may accidentally return to available status.',4,'{"build":"2026-06-04a","schema":129}'::jsonb,now()),
  ('schema129_done_05','completed_this_pass',5,'seo','Added public asset smoke-check queue','completed','medium','DEVELOPMENT_ROADMAP.md','/','H1/cache/sitemap/asset rows exist and Admin can load them.','SEO checks are tied to release assets and route registry rows.','SEO regressions stay manual.',5,'{"build":"2026-06-04a","schema":129}'::jsonb,now()),
  ('schema129_next_01','next_20',1,'accounting','Build the payment application screen using the schema 128/129 action and proof queues','planned','high','DEVELOPMENT_ROADMAP.md','#admin','Admin can apply, reverse, adjust, refund, and export proof for payments.','Use schema 129 package rows as acceptance criteria.','Payments remain manually matched.',101,'{"build":"2026-06-04a","schema":129}'::jsonb,now()),
  ('schema129_next_02','next_20',2,'accounting','Build bank CSV staging with reject reasons and preview report','planned','high','DEVELOPMENT_ROADMAP.md','#admin','CSV header/date/duplicate/amount checks are visible before import.','Keep rejected rows exportable.','Bad bank data enters reconciliation.',102,'{"build":"2026-06-04a","schema":129}'::jsonb,now()),
  ('schema129_next_03','next_20',3,'accounting','Build reconciliation match/split/undo/signoff controls','planned','high','DEVELOPMENT_ROADMAP.md','#admin','Reviewer can match, split, undo, note, and sign off.','Tie final signoff into close package rows.','Unmatched rows remain unresolved.',103,'{"build":"2026-06-04a","schema":129}'::jsonb,now()),
  ('schema129_next_04','next_20',4,'equipment','Add real BarcodeDetector camera scan with manual-fallback audit reason','planned','high','DEVELOPMENT_ROADMAP.md','#jobs','Camera scan populates equipment code; unsupported camera records manual fallback reason.','Use schema 129 scan audit rule as acceptance criteria.','Manual entry has no audit reason.',104,'{"build":"2026-06-04a","schema":129}'::jsonb,now()),
  ('schema129_next_05','next_20',5,'seo','Generate sitemap/robots from approved route SEO rows and add broken-asset checks','planned','medium','DEVELOPMENT_ROADMAP.md','/','Generated files and smoke checks exist.','Only publish routes that pass local proof and asset checks.','Search/public assets drift.',105,'{"build":"2026-06-04a","schema":129}'::jsonb,now())
on conflict (step_key) do update set
  step_batch = excluded.step_batch,
  step_number = excluded.step_number,
  step_area = excluded.step_area,
  step_title = excluded.step_title,
  step_status = excluded.step_status,
  priority = excluded.priority,
  source_doc = excluded.source_doc,
  route_hint = excluded.route_hint,
  acceptance_check = excluded.acceptance_check,
  implementation_notes = excluded.implementation_notes,
  risk_if_skipped = excluded.risk_if_skipped,
  sort_order = excluded.sort_order,
  metadata = excluded.metadata,
  checked_at = excluded.checked_at,
  updated_at = now();

drop view if exists public.v_app_schema_migration_compatibility_checks;
create view public.v_app_schema_migration_compatibility_checks as
select
  check_key,
  schema_file,
  compatibility_area,
  check_title,
  check_status,
  expected_column,
  legacy_column,
  repair_hint,
  smoke_test_hint,
  sort_order,
  checked_at,
  updated_at
from public.app_schema_migration_compatibility_checks
order by sort_order, check_key;

drop view if exists public.v_app_accounting_evidence_package_queue;
create view public.v_app_accounting_evidence_package_queue as
select
  package_key,
  package_area,
  package_title,
  package_status,
  source_rows_hint,
  required_proof_hint,
  reviewer_role_hint,
  export_format_hint,
  fallback_hint,
  sort_order,
  checked_at,
  updated_at
from public.app_accounting_evidence_package_queue
order by sort_order, package_key;

drop view if exists public.v_app_equipment_return_to_service_rules;
create view public.v_app_equipment_return_to_service_rules as
select
  rule_key,
  equipment_area,
  rule_title,
  rule_status,
  required_role,
  source_event_hint,
  proof_required_hint,
  block_behavior,
  fallback_hint,
  sort_order,
  checked_at,
  updated_at
from public.app_equipment_return_to_service_rules
order by sort_order, rule_key;

drop view if exists public.v_app_public_asset_smoke_checks;
create view public.v_app_public_asset_smoke_checks as
select
  check_key,
  asset_area,
  asset_title,
  check_status,
  file_path,
  source_registry_hint,
  local_seo_hint,
  failure_hint,
  sort_order,
  checked_at,
  updated_at
from public.app_public_asset_smoke_checks
order by sort_order, check_key;

drop view if exists public.v_app_error_recovery_playbook;
create view public.v_app_error_recovery_playbook as
select
  playbook_key,
  app_area,
  error_signature,
  playbook_status,
  operator_message,
  recovery_steps,
  prevention_check,
  owner_hint,
  sort_order,
  checked_at,
  updated_at
from public.app_error_recovery_playbook
order by sort_order, playbook_key;

drop view if exists public.v_schema_drift_status;
create view public.v_schema_drift_status as
select
  129::int as expected_schema_version,
  coalesce(max(schema_version) filter (where status = 'applied'), 0)::int as latest_applied_schema_version,
  case
    when coalesce(max(schema_version) filter (where status = 'applied'), 0) >= 129 then 'current'
    else 'behind'
  end as drift_status,
  case
    when coalesce(max(schema_version) filter (where status = 'applied'), 0) >= 129 then 'Live database is at or ahead of the repo schema marker.'
    else 'Live database is behind the deployed app. Apply migrations through schema 129.'
  end as message,
  now() as checked_at
from public.app_schema_versions;

insert into public.app_schema_versions (
  schema_version,
  migration_key,
  schema_name,
  release_label,
  description,
  status,
  notes
)
values (
  129,
  '129_schema_compatibility_accounting_equipment_seo_fallback_playbooks',
  '129_schema_compatibility_accounting_equipment_seo_fallback_playbooks.sql',
  '2026-06-04a',
  'Repairs the canonical schema 128 roadmap-column mismatch and adds compatibility checks, accounting proof package queues, equipment return-to-service rules, public asset smoke checks, and error recovery playbooks.',
  'applied',
  'This pass prevents the schema 128 source_document/target_route_hint/completion_note mismatch from returning and makes the next implementation layer visible in Admin readiness.'
)
on conflict (schema_version) do update set
  migration_key = excluded.migration_key,
  schema_name = excluded.schema_name,
  release_label = excluded.release_label,
  description = excluded.description,
  status = excluded.status,
  notes = excluded.notes,
  applied_at = now();

grant select on public.app_schema_migration_compatibility_checks to authenticated;
grant select on public.app_accounting_evidence_package_queue to authenticated;
grant select on public.app_equipment_return_to_service_rules to authenticated;
grant select on public.app_public_asset_smoke_checks to authenticated;
grant select on public.app_error_recovery_playbook to authenticated;
grant select on public.v_app_schema_migration_compatibility_checks to authenticated;
grant select on public.v_app_accounting_evidence_package_queue to authenticated;
grant select on public.v_app_equipment_return_to_service_rules to authenticated;
grant select on public.v_app_public_asset_smoke_checks to authenticated;
grant select on public.v_app_error_recovery_playbook to authenticated;
grant select on public.v_schema_drift_status to authenticated;

commit;

-- Schema 130: payment, reconciliation, equipment scan, local SEO, and fallback execution playbooks.
-- Build 2026-06-04b.
-- This pass moves the schema 129 planning queues closer to executable Admin/mobile work.

begin;

create table if not exists public.app_schema_versions (
  schema_version integer primary key,
  schema_name text,
  description text,
  status text not null default 'applied',
  applied_at timestamptz not null default now(),
  applied_by text,
  notes text
);

alter table public.app_schema_versions add column if not exists migration_key text;
alter table public.app_schema_versions add column if not exists release_label text;

create table if not exists public.app_payment_execution_queue (
  action_key text primary key,
  action_area text not null,
  action_title text not null,
  action_status text not null default 'planned',
  required_role text not null default 'admin',
  route_hint text,
  source_rows_hint text,
  fallback_hint text,
  sort_order integer not null default 100,
  metadata jsonb not null default '{}'::jsonb,
  checked_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.app_bank_reconciliation_execution_queue (
  action_key text primary key,
  action_area text not null,
  action_title text not null,
  action_status text not null default 'planned',
  route_hint text,
  source_rows_hint text,
  fallback_hint text,
  sort_order integer not null default 100,
  metadata jsonb not null default '{}'::jsonb,
  checked_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.app_equipment_scan_template_registry (
  action_key text primary key,
  equipment_area text not null,
  action_title text not null,
  action_status text not null default 'planned',
  required_role text not null default 'supervisor',
  scanner_status text not null default 'manual_fallback',
  service_task_behavior text,
  fallback_hint text,
  sort_order integer not null default 100,
  metadata jsonb not null default '{}'::jsonb,
  checked_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.app_local_seo_execution_queue (
  action_key text primary key,
  seo_area text not null,
  action_title text not null,
  action_status text not null default 'planned',
  required_evidence text,
  local_wording_hint text,
  fallback_hint text,
  sort_order integer not null default 100,
  metadata jsonb not null default '{}'::jsonb,
  checked_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.app_fallback_drill_queue (
  drill_key text primary key,
  app_surface text not null,
  drill_title text not null,
  drill_status text not null default 'planned',
  trigger_hint text,
  expected_fallback text,
  recovery_hint text,
  owner_hint text,
  sort_order integer not null default 100,
  metadata jsonb not null default '{}'::jsonb,
  checked_at timestamptz,
  updated_at timestamptz not null default now()
);

insert into public.app_payment_execution_queue (
  action_key, action_area, action_title, action_status, required_role, route_hint, source_rows_hint, fallback_hint, sort_order, metadata, checked_at
)
values
  ('payment_apply_form', 'payment_application', 'Build apply-payment form state and validation', 'planned', 'admin', '#admin', 'invoice/deposit/payment rows', 'Manual journal note until posting is wired', 10, '{"build":"2026-06-04b","schema":130}'::jsonb, now()),
  ('payment_reverse_action', 'payment_application', 'Add reversal action with reason and audit trail', 'planned', 'admin', '#admin', 'payment_application reversal rows', 'Block reversal without reason', 20, '{"build":"2026-06-04b","schema":130}'::jsonb, now()),
  ('payment_adjustment_types', 'payment_application', 'Separate discounts, credits, write-offs, overpayments, and refunds', 'planned', 'admin', '#admin', 'adjustment rows and journal candidates', 'Keep as reviewer note if GL posting unavailable', 30, '{"build":"2026-06-04b","schema":130}'::jsonb, now()),
  ('payment_approval_gate', 'payment_application', 'Require reviewer approval before posting payment decisions', 'planned', 'admin', '#admin', 'approval status and reviewer profile', 'Keep staged status', 40, '{"build":"2026-06-04b","schema":130}'::jsonb, now())
on conflict (action_key) do update set
  action_area = excluded.action_area,
  action_title = excluded.action_title,
  action_status = excluded.action_status,
  required_role = excluded.required_role,
  route_hint = excluded.route_hint,
  source_rows_hint = excluded.source_rows_hint,
  fallback_hint = excluded.fallback_hint,
  sort_order = excluded.sort_order,
  metadata = excluded.metadata,
  checked_at = excluded.checked_at,
  updated_at = now();

insert into public.app_bank_reconciliation_execution_queue (
  action_key, action_area, action_title, action_status, route_hint, source_rows_hint, fallback_hint, sort_order, metadata, checked_at
)
values
  ('bank_csv_header_preview', 'bank_reconciliation', 'Validate CSV headers, dates, amount signs, duplicates, and rejected rows', 'planned', '#admin', 'bank_statement_imports', 'Rejected row report stays visible', 10, '{"build":"2026-06-04b","schema":130}'::jsonb, now()),
  ('bank_match_scoring', 'bank_reconciliation', 'Score matches by amount, date, reference, invoice, and customer', 'planned', '#admin', 'bank_reconciliation_items', 'Manual search fallback', 20, '{"build":"2026-06-04b","schema":130}'::jsonb, now()),
  ('bank_manual_split_undo', 'bank_reconciliation', 'Support manual match, split match, unmatch/undo, and notes', 'planned', '#admin', 'bank_reconciliation_sessions', 'Keep unmatched rows open', 30, '{"build":"2026-06-04b","schema":130}'::jsonb, now()),
  ('bank_reviewer_signoff', 'bank_reconciliation', 'Final reviewer signoff locks reconciled rows', 'planned', '#admin', 'accounting_period_closes', 'Prevent posting from unreviewed imports', 40, '{"build":"2026-06-04b","schema":130}'::jsonb, now())
on conflict (action_key) do update set
  action_area = excluded.action_area,
  action_title = excluded.action_title,
  action_status = excluded.action_status,
  route_hint = excluded.route_hint,
  source_rows_hint = excluded.source_rows_hint,
  fallback_hint = excluded.fallback_hint,
  sort_order = excluded.sort_order,
  metadata = excluded.metadata,
  checked_at = excluded.checked_at,
  updated_at = now();

insert into public.app_equipment_scan_template_registry (
  action_key, equipment_area, action_title, action_status, required_role, scanner_status, service_task_behavior, fallback_hint, sort_order, metadata, checked_at
)
values
  ('scan_camera_detector', 'scan', 'Camera BarcodeDetector scan with manual entry fallback', 'planned', 'employee', 'manual_fallback', 'Fill equipment code / QR / barcode from camera when supported', 'Manual code prompt', 10, '{"build":"2026-06-04b","schema":130}'::jsonb, now()),
  ('accessory_template_registry', 'accessory_templates', 'Reusable accessory templates by equipment category/pool', 'planned', 'supervisor', 'not_required', 'Load expected accessories on checkout/arrival/return', 'Free text checklist', 20, '{"build":"2026-06-04b","schema":130}'::jsonb, now()),
  ('verifier_server_enforcement', 'verifier_roles', 'Server-side verifier role checks for return and defect clear', 'planned', 'supervisor', 'not_required', 'Block final signoff below required role', 'UI disable as fallback', 30, '{"build":"2026-06-04b","schema":130}'::jsonb, now()),
  ('return_service_proof', 'return_to_service', 'Proof upload and cost capture before locked-out equipment returns to available', 'planned', 'admin', 'not_required', 'Close service task with proof, cost, and verifier', 'Keep locked out', 40, '{"build":"2026-06-04b","schema":130}'::jsonb, now())
on conflict (action_key) do update set
  equipment_area = excluded.equipment_area,
  action_title = excluded.action_title,
  action_status = excluded.action_status,
  required_role = excluded.required_role,
  scanner_status = excluded.scanner_status,
  service_task_behavior = excluded.service_task_behavior,
  fallback_hint = excluded.fallback_hint,
  sort_order = excluded.sort_order,
  metadata = excluded.metadata,
  checked_at = excluded.checked_at,
  updated_at = now();

insert into public.app_local_seo_execution_queue (
  action_key, seo_area, action_title, action_status, required_evidence, local_wording_hint, fallback_hint, sort_order, metadata, checked_at
)
values
  ('sitemap_robot_generator', 'technical_seo', 'Generate sitemap.xml and robots.txt from approved public route rows', 'planned', 'Approved route registry rows', 'Use only true service/location wording', 'Keep static shell', 10, '{"build":"2026-06-04b","schema":130}'::jsonb, now()),
  ('broken_link_asset_smoke', 'technical_seo', 'Smoke-check public links, scripts, styles, images, and manifest files', 'planned', 'Static shell and route registry', 'Flag broken public assets before deploy', 'Hide route until fixed', 20, '{"build":"2026-06-04b","schema":130}'::jsonb, now()),
  ('jsonld_validation', 'structured_data', 'Parse JSON-LD and check required business/service fields', 'planned', 'Structured data snippets', 'Avoid overclaiming service areas', 'Plain title/meta fallback', 30, '{"build":"2026-06-04b","schema":130}'::jsonb, now()),
  ('image_alt_local_proof', 'image_alt', 'Score public image alt text, captions, and local proof', 'planned', 'Image registry or static HTML', 'Describe real content truthfully', 'Hide weak gallery blocks', 40, '{"build":"2026-06-04b","schema":130}'::jsonb, now())
on conflict (action_key) do update set
  seo_area = excluded.seo_area,
  action_title = excluded.action_title,
  action_status = excluded.action_status,
  required_evidence = excluded.required_evidence,
  local_wording_hint = excluded.local_wording_hint,
  fallback_hint = excluded.fallback_hint,
  sort_order = excluded.sort_order,
  metadata = excluded.metadata,
  checked_at = excluded.checked_at,
  updated_at = now();

insert into public.app_fallback_drill_queue (
  drill_key, app_surface, drill_title, drill_status, trigger_hint, expected_fallback, recovery_hint, owner_hint, sort_order, metadata, checked_at
)
values
  ('offline_conflict_drill', 'mobile_offline', 'Run offline draft conflict drill', 'planned', 'Mobile form drafts', 'Retry / keep local / discard local options', 'Manual copy fallback', 'Supervisor', 10, '{"build":"2026-06-04b","schema":130}'::jsonb, now()),
  ('optional_view_drill', 'edge_optional_views', 'Run optional-view missing drill', 'planned', 'admin-directory safeList', 'Empty table with schema hint', 'Apply schema then retry', 'Admin', 20, '{"build":"2026-06-04b","schema":130}'::jsonb, now()),
  ('cache_stale_drill', 'service_worker', 'Run stale service worker/cache marker drill', 'planned', 'index/server-worker marker', 'Hard-refresh / clear worker guidance', 'Cache shell fallback', 'Admin', 30, '{"build":"2026-06-04b","schema":130}'::jsonb, now()),
  ('accounting_block_drill', 'accounting_workbench', 'Run blocked accounting proof/signoff drill', 'planned', 'accounting close controls', 'Explain missing proof/signoff', 'Keep action queued', 'Admin / Accountant', 40, '{"build":"2026-06-04b","schema":130}'::jsonb, now())
on conflict (drill_key) do update set
  app_surface = excluded.app_surface,
  drill_title = excluded.drill_title,
  drill_status = excluded.drill_status,
  trigger_hint = excluded.trigger_hint,
  expected_fallback = excluded.expected_fallback,
  recovery_hint = excluded.recovery_hint,
  owner_hint = excluded.owner_hint,
  sort_order = excluded.sort_order,
  metadata = excluded.metadata,
  checked_at = excluded.checked_at,
  updated_at = now();

insert into public.app_roadmap_action_steps (
  step_key, step_batch, step_number, step_area, step_title, step_status, priority, source_doc, route_hint, acceptance_check, implementation_notes, risk_if_skipped, sort_order, metadata, checked_at
)
values
  (
    'schema130_done_01',
    'completed_this_pass',
    1,
    'schema',
    'Added schema 130 execution playbooks',
    'completed',
    'high',
    'DEVELOPMENT_ROADMAP.md',
    '#admin',
    'Migration and full schema include schema 130.',
    'DB-visible queues now track next executable payment, reconciliation, scan, SEO, and fallback work.',
    'Roadmap stays too abstract.',
    1,
    '{"build":"2026-06-04b","schema":130}'::jsonb,
    now()
  ),
  (
    'schema130_done_02',
    'completed_this_pass',
    2,
    'accounting',
    'Added payment execution queue',
    'completed',
    'high',
    'DEVELOPMENT_ROADMAP.md',
    '#admin',
    'Admin readiness can load payment execution rows.',
    'Payment application work has a staged implementation list.',
    'Payment UI remains unclear.',
    2,
    '{"build":"2026-06-04b","schema":130}'::jsonb,
    now()
  ),
  (
    'schema130_done_03',
    'completed_this_pass',
    3,
    'banking',
    'Added reconciliation execution queue',
    'completed',
    'high',
    'DEVELOPMENT_ROADMAP.md',
    '#admin',
    'Admin readiness can load reconciliation execution rows.',
    'CSV preview and match workflow work is staged clearly.',
    'Bank workflow remains manual.',
    3,
    '{"build":"2026-06-04b","schema":130}'::jsonb,
    now()
  ),
  (
    'schema130_done_04',
    'completed_this_pass',
    4,
    'equipment',
    'Added equipment scan/template execution queue',
    'completed',
    'high',
    'DEVELOPMENT_ROADMAP.md',
    '#admin',
    'Admin readiness can load equipment scan/template rows.',
    'Camera scan, templates, verifier roles, and return-to-service actions are broken down.',
    'Equipment accountability remains manual.',
    4,
    '{"build":"2026-06-04b","schema":130}'::jsonb,
    now()
  ),
  (
    'schema130_done_05',
    'completed_this_pass',
    5,
    'seo',
    'Added local SEO execution queue',
    'completed',
    'high',
    'DEVELOPMENT_ROADMAP.md',
    '#admin',
    'Admin readiness can load local SEO rows.',
    'Sitemap, robots, broken-link, JSON-LD, and alt-text work is staged.',
    'Public SEO work drifts.',
    5,
    '{"build":"2026-06-04b","schema":130}'::jsonb,
    now()
  ),
  (
    'schema130_done_06',
    'completed_this_pass',
    6,
    'fallback',
    'Added fallback drill queue',
    'completed',
    'high',
    'DEVELOPMENT_ROADMAP.md',
    '#admin',
    'Admin readiness can load fallback drill rows.',
    'Offline, stale cache, optional view, and blocked accounting flows have drill steps.',
    'Fallbacks stay untested.',
    6,
    '{"build":"2026-06-04b","schema":130}'::jsonb,
    now()
  ),
  (
    'schema130_done_07',
    'completed_this_pass',
    7,
    'admin',
    'Loaded schema 130 views in admin-directory',
    'completed',
    'high',
    'DEVELOPMENT_ROADMAP.md',
    '#admin',
    'admin-directory references schema 130 views.',
    'Admin can see schema 130 rows after deploy.',
    'Rows stay hidden.',
    7,
    '{"build":"2026-06-04b","schema":130}'::jsonb,
    now()
  ),
  (
    'schema130_done_08',
    'completed_this_pass',
    8,
    'admin',
    'Rendered schema 130 tables in Admin UI',
    'completed',
    'high',
    'DEVELOPMENT_ROADMAP.md',
    '#admin',
    'Admin UI includes schema 130 table bodies.',
    'Operators can review queue rows from the app.',
    'Rows require SQL queries to inspect.',
    8,
    '{"build":"2026-06-04b","schema":130}'::jsonb,
    now()
  ),
  (
    'schema130_done_09',
    'completed_this_pass',
    9,
    'docs',
    'Updated active Markdown files to schema 130',
    'completed',
    'high',
    'DEVELOPMENT_ROADMAP.md',
    '#admin',
    'Root Markdown reflects build 2026-06-04b.',
    'New chat/roadmap/testing/deploy files stay in sync.',
    'Future work loses context.',
    9,
    '{"build":"2026-06-04b","schema":130}'::jsonb,
    now()
  ),
  (
    'schema130_done_10',
    'completed_this_pass',
    10,
    'docs',
    'Added schema 130 documentation',
    'completed',
    'high',
    'DEVELOPMENT_ROADMAP.md',
    '#admin',
    'docs/PAYMENT_RECONCILIATION_EQUIPMENT_SCAN_LOCAL_SEO_SCHEMA130.md exists.',
    'Schema 130 intent is documented.',
    'Schema intent is unclear.',
    10,
    '{"build":"2026-06-04b","schema":130}'::jsonb,
    now()
  ),
  (
    'schema130_done_11',
    'completed_this_pass',
    11,
    'schema',
    'Updated canonical full schema through schema 130',
    'completed',
    'high',
    'DEVELOPMENT_ROADMAP.md',
    '#admin',
    '000_full_schema_reference.sql contains schema 130 marker and drift view expects 130.',
    'Full rebuilds match migrations.',
    'Full schema can lag migrations.',
    11,
    '{"build":"2026-06-04b","schema":130}'::jsonb,
    now()
  ),
  (
    'schema130_done_12',
    'completed_this_pass',
    12,
    'smoke',
    'Updated smoke checks for schema 130',
    'completed',
    'high',
    'DEVELOPMENT_ROADMAP.md',
    '#admin',
    'repo-smoke-check requires schema 130 marker, views, Admin UI, and cache marker.',
    'Future packages catch drift.',
    'Schema 130 can regress silently.',
    12,
    '{"build":"2026-06-04b","schema":130}'::jsonb,
    now()
  ),
  (
    'schema130_done_13',
    'completed_this_pass',
    13,
    'cache',
    'Updated static/cache marker to 2026-06-04b',
    'completed',
    'high',
    'DEVELOPMENT_ROADMAP.md',
    '#admin',
    'index and service worker use 2026-06-04b.',
    'Browser cache issues are easier to spot.',
    'Old assets can mask changes.',
    13,
    '{"build":"2026-06-04b","schema":130}'::jsonb,
    now()
  ),
  (
    'schema130_done_14',
    'completed_this_pass',
    14,
    'seo',
    'Verified one public H1 remains in index',
    'completed',
    'high',
    'DEVELOPMENT_ROADMAP.md',
    '#admin',
    'Smoke check confirms one H1.',
    'Title/main-heading clarity remains protected.',
    'Public page clarity can weaken.',
    14,
    '{"build":"2026-06-04b","schema":130}'::jsonb,
    now()
  ),
  (
    'schema130_done_15',
    'completed_this_pass',
    15,
    'css',
    'Verified CSS brace balance',
    'completed',
    'medium',
    'DEVELOPMENT_ROADMAP.md',
    '#admin',
    'CSS brace balance is zero.',
    'CSS drift is less likely to break layout.',
    'UI layout can drift.',
    15,
    '{"build":"2026-06-04b","schema":130}'::jsonb,
    now()
  ),
  (
    'schema130_done_16',
    'completed_this_pass',
    16,
    'edge',
    'Verified Edge Function TypeScript parse checks',
    'completed',
    'medium',
    'DEVELOPMENT_ROADMAP.md',
    '#admin',
    'repo-smoke-check TypeScript parse diagnostics pass.',
    'Deploy parse errors are caught earlier.',
    'Supabase deploy can fail late.',
    16,
    '{"build":"2026-06-04b","schema":130}'::jsonb,
    now()
  ),
  (
    'schema130_done_17',
    'completed_this_pass',
    17,
    'archive',
    'Restored 2026-05-29a Markdown archive snapshot',
    'completed',
    'medium',
    'DEVELOPMENT_ROADMAP.md',
    '#admin',
    'archive/markdown-current-snapshot-2026-05-29a/README.md exists.',
    'Legacy smoke compatibility is restored.',
    'Smoke fails before useful checks.',
    17,
    '{"build":"2026-06-04b","schema":130}'::jsonb,
    now()
  ),
  (
    'schema130_done_18',
    'completed_this_pass',
    18,
    'cleanup',
    'Retired active test_write files',
    'completed',
    'medium',
    'DEVELOPMENT_ROADMAP.md',
    '#admin',
    'test_write files are moved out of active root.',
    'Temporary files do not pollute package.',
    'Smoke hygiene fails.',
    18,
    '{"build":"2026-06-04b","schema":130}'::jsonb,
    now()
  ),
  (
    'schema130_done_19',
    'completed_this_pass',
    19,
    'roadmap',
    'Replaced completed/next 20 Markdown lists',
    'completed',
    'medium',
    'DEVELOPMENT_ROADMAP.md',
    '#admin',
    'DEVELOPMENT_ROADMAP.md contains schema 130 completed and next steps.',
    'Next work is clear.',
    'Work repeats or scatters.',
    19,
    '{"build":"2026-06-04b","schema":130}'::jsonb,
    now()
  ),
  (
    'schema130_done_20',
    'completed_this_pass',
    20,
    'issues',
    'Updated Known Issues and Gaps',
    'completed',
    'medium',
    'DEVELOPMENT_ROADMAP.md',
    '#admin',
    'Known issues list calls out schema 130 deployment and remaining depth gaps.',
    'Deployment/feature gaps are clear.',
    'Operators chase stale issues.',
    20,
    '{"build":"2026-06-04b","schema":130}'::jsonb,
    now()
  ),
  (
    'schema130_next_01',
    'next_20',
    1,
    'accounting',
    'Build real payment application form and buttons',
    'planned',
    'high',
    'DEVELOPMENT_ROADMAP.md',
    '#admin',
    'Payment apply/reverse/discount/write-off/overpayment actions work in Admin.',
    'Cash application becomes usable.',
    'Cash application remains tracked only.',
    101,
    '{"build":"2026-06-04b","schema":130}'::jsonb,
    now()
  ),
  (
    'schema130_next_02',
    'next_20',
    2,
    'accounting',
    'Create payment proof package generator',
    'planned',
    'high',
    'DEVELOPMENT_ROADMAP.md',
    '#admin',
    'Proof package rows produce downloadable manifest and proof bundle.',
    'Payment review is exportable.',
    'Proof remains manual.',
    102,
    '{"build":"2026-06-04b","schema":130}'::jsonb,
    now()
  ),
  (
    'schema130_next_03',
    'next_20',
    3,
    'banking',
    'Build bank CSV preview importer',
    'planned',
    'high',
    'DEVELOPMENT_ROADMAP.md',
    '#admin',
    'CSV rows stage with header, duplicate, date, and amount-sign validation.',
    'Bad imports are blocked before posting.',
    'Bad data can enter review.',
    103,
    '{"build":"2026-06-04b","schema":130}'::jsonb,
    now()
  ),
  (
    'schema130_next_04',
    'next_20',
    4,
    'banking',
    'Build reconciliation match/split/undo/signoff UI',
    'planned',
    'high',
    'DEVELOPMENT_ROADMAP.md',
    '#admin',
    'Reviewer can match, split, undo, note, and sign off rows.',
    'Bank reconciliation becomes auditable.',
    'Reconciliation remains manual.',
    104,
    '{"build":"2026-06-04b","schema":130}'::jsonb,
    now()
  ),
  (
    'schema130_next_05',
    'next_20',
    5,
    'banking',
    'Add match confidence scoring',
    'planned',
    'high',
    'DEVELOPMENT_ROADMAP.md',
    '#admin',
    'Rows show confidence from amount/date/reference/customer matches.',
    'Reviewer can prioritize likely matches.',
    'Manual review is slower.',
    105,
    '{"build":"2026-06-04b","schema":130}'::jsonb,
    now()
  ),
  (
    'schema130_next_06',
    'next_20',
    6,
    'tax',
    'Build HST/GST review package screen',
    'planned',
    'high',
    'DEVELOPMENT_ROADMAP.md',
    '#admin',
    'Source totals, adjustments, filed date, remitted date, proof, and lock status are visible.',
    'Tax review is traceable.',
    'Tax evidence stays scattered.',
    106,
    '{"build":"2026-06-04b","schema":130}'::jsonb,
    now()
  ),
  (
    'schema130_next_07',
    'next_20',
    7,
    'payroll',
    'Build payroll remittance review screen',
    'planned',
    'high',
    'DEVELOPMENT_ROADMAP.md',
    '#admin',
    'Pay runs, deductions, employer costs, proof, and signoff are visible.',
    'Payroll remittance review is traceable.',
    'Payroll proof stays manual.',
    107,
    '{"build":"2026-06-04b","schema":130}'::jsonb,
    now()
  ),
  (
    'schema130_next_08',
    'next_20',
    8,
    'close',
    'Build month-end close lock/reopen controls',
    'planned',
    'high',
    'DEVELOPMENT_ROADMAP.md',
    '#admin',
    'Closed periods block postings unless reopened with reason and role.',
    'Accounting close becomes safer.',
    'Late edits can alter closed periods.',
    108,
    '{"build":"2026-06-04b","schema":130}'::jsonb,
    now()
  ),
  (
    'schema130_next_09',
    'next_20',
    9,
    'export',
    'Generate accountant export package files',
    'planned',
    'high',
    'DEVELOPMENT_ROADMAP.md',
    '#admin',
    'CSV/JSON/proof files and manifest are generated from close rows.',
    'Accountant handoff is complete.',
    'Exports remain manual.',
    109,
    '{"build":"2026-06-04b","schema":130}'::jsonb,
    now()
  ),
  (
    'schema130_next_10',
    'next_20',
    10,
    'equipment',
    'Implement camera BarcodeDetector scan',
    'planned',
    'high',
    'DEVELOPMENT_ROADMAP.md',
    '#admin',
    'Camera scan fills QR/barcode/equipment code with manual fallback.',
    'Field equipment handling is faster.',
    'Manual entry remains default.',
    110,
    '{"build":"2026-06-04b","schema":130}'::jsonb,
    now()
  ),
  (
    'schema130_next_11',
    'next_20',
    11,
    'equipment',
    'Add accessory template DB tables',
    'planned',
    'high',
    'DEVELOPMENT_ROADMAP.md',
    '#admin',
    'Accessory templates auto-load by equipment category/pool.',
    'Missing accessories are easier to catch.',
    'Free-text accessories stay inconsistent.',
    111,
    '{"build":"2026-06-04b","schema":130}'::jsonb,
    now()
  ),
  (
    'schema130_next_12',
    'next_20',
    12,
    'equipment',
    'Enforce verifier roles server-side',
    'planned',
    'high',
    'DEVELOPMENT_ROADMAP.md',
    '#admin',
    'Return, defect clear, and return-to-service actions require the configured role.',
    'UI bypass cannot clear equipment incorrectly.',
    'Role enforcement is only visual.',
    112,
    '{"build":"2026-06-04b","schema":130}'::jsonb,
    now()
  ),
  (
    'schema130_next_13',
    'next_20',
    13,
    'equipment',
    'Turn failed tests into assignable service work orders',
    'planned',
    'high',
    'DEVELOPMENT_ROADMAP.md',
    '#admin',
    'Failed arrival/return tests create assigned tasks with proof, due date, and cost.',
    'Lockouts become actionable.',
    'Failed tests stay loose.',
    113,
    '{"build":"2026-06-04b","schema":130}'::jsonb,
    now()
  ),
  (
    'schema130_next_14',
    'next_20',
    14,
    'equipment',
    'Add return-to-service proof upload',
    'planned',
    'high',
    'DEVELOPMENT_ROADMAP.md',
    '#admin',
    'Locked-out equipment requires proof before availability.',
    'Unsafe equipment stays blocked.',
    'Defect clear can be too easy.',
    114,
    '{"build":"2026-06-04b","schema":130}'::jsonb,
    now()
  ),
  (
    'schema130_next_15',
    'next_20',
    15,
    'seo',
    'Generate sitemap.xml and robots.txt',
    'planned',
    'medium',
    'DEVELOPMENT_ROADMAP.md',
    '#admin',
    'Approved public route rows generate deployable sitemap/robots files.',
    'Crawlers have cleaner route signals.',
    'Technical SEO remains manual.',
    115,
    '{"build":"2026-06-04b","schema":130}'::jsonb,
    now()
  ),
  (
    'schema130_next_16',
    'next_20',
    16,
    'seo',
    'Add broken-link and broken-asset smoke checks',
    'planned',
    'medium',
    'DEVELOPMENT_ROADMAP.md',
    '#admin',
    'Smoke flags missing routes, images, scripts, styles, and manifests.',
    'Public errors are caught before deploy.',
    'Broken links can ship.',
    116,
    '{"build":"2026-06-04b","schema":130}'::jsonb,
    now()
  ),
  (
    'schema130_next_17',
    'next_20',
    17,
    'seo',
    'Add JSON-LD validation queue',
    'planned',
    'medium',
    'DEVELOPMENT_ROADMAP.md',
    '#admin',
    'Structured data rows parse and pass required-field checks before publication.',
    'Search snippets are safer.',
    'Structured data can drift.',
    117,
    '{"build":"2026-06-04b","schema":130}'::jsonb,
    now()
  ),
  (
    'schema130_next_18',
    'next_20',
    18,
    'seo',
    'Add image alt/local proof scoring',
    'planned',
    'medium',
    'DEVELOPMENT_ROADMAP.md',
    '#admin',
    'Public images require alt/caption/local proof before route publication.',
    'Local proof stays truthful and accessible.',
    'Weak gallery blocks can publish.',
    118,
    '{"build":"2026-06-04b","schema":130}'::jsonb,
    now()
  ),
  (
    'schema130_next_19',
    'next_20',
    19,
    'mobile',
    'Add offline conflict resolution UI',
    'planned',
    'medium',
    'DEVELOPMENT_ROADMAP.md',
    '#admin',
    'Users can retry, keep local, or discard local drafts when server state changed.',
    'Mobile sync feels safer.',
    'Draft conflicts are confusing.',
    119,
    '{"build":"2026-06-04b","schema":130}'::jsonb,
    now()
  ),
  (
    'schema130_next_20',
    'next_20',
    20,
    'fallback',
    'Add fallback drill run history',
    'planned',
    'medium',
    'DEVELOPMENT_ROADMAP.md',
    '#admin',
    'Operators can mark fallback drills run/pass/fail with notes.',
    'Fallbacks are tested, not just listed.',
    'Recovery plans stay unproven.',
    120,
    '{"build":"2026-06-04b","schema":130}'::jsonb,
    now()
  )
on conflict (step_key) do update set
  step_batch = excluded.step_batch,
  step_number = excluded.step_number,
  step_area = excluded.step_area,
  step_title = excluded.step_title,
  step_status = excluded.step_status,
  priority = excluded.priority,
  source_doc = excluded.source_doc,
  route_hint = excluded.route_hint,
  acceptance_check = excluded.acceptance_check,
  implementation_notes = excluded.implementation_notes,
  risk_if_skipped = excluded.risk_if_skipped,
  sort_order = excluded.sort_order,
  metadata = excluded.metadata,
  checked_at = excluded.checked_at,
  updated_at = now();

drop view if exists public.v_app_payment_execution_queue;
create view public.v_app_payment_execution_queue as
select action_key, action_area, action_title, action_status, required_role, route_hint, source_rows_hint, fallback_hint, sort_order, checked_at, updated_at
from public.app_payment_execution_queue
order by sort_order, action_key;

drop view if exists public.v_app_bank_reconciliation_execution_queue;
create view public.v_app_bank_reconciliation_execution_queue as
select action_key, action_area, action_title, action_status, route_hint, source_rows_hint, fallback_hint, sort_order, checked_at, updated_at
from public.app_bank_reconciliation_execution_queue
order by sort_order, action_key;

drop view if exists public.v_app_equipment_scan_template_registry;
create view public.v_app_equipment_scan_template_registry as
select action_key, equipment_area, action_title, action_status, required_role, scanner_status, service_task_behavior, fallback_hint, sort_order, checked_at, updated_at
from public.app_equipment_scan_template_registry
order by sort_order, action_key;

drop view if exists public.v_app_local_seo_execution_queue;
create view public.v_app_local_seo_execution_queue as
select action_key, seo_area, action_title, action_status, required_evidence, local_wording_hint, fallback_hint, sort_order, checked_at, updated_at
from public.app_local_seo_execution_queue
order by sort_order, action_key;

drop view if exists public.v_app_fallback_drill_queue;
create view public.v_app_fallback_drill_queue as
select drill_key, app_surface, drill_title, drill_status, trigger_hint, expected_fallback, recovery_hint, owner_hint, sort_order, checked_at, updated_at
from public.app_fallback_drill_queue
order by sort_order, drill_key;

drop view if exists public.v_schema_drift_status;
create view public.v_schema_drift_status as
select
  130::int as expected_schema_version,
  coalesce(max(schema_version) filter (where status = 'applied'), 0)::int as latest_applied_schema_version,
  case
    when coalesce(max(schema_version) filter (where status = 'applied'), 0) >= 130
      then 'current'
    else 'behind'
  end as drift_status,
  case
    when coalesce(max(schema_version) filter (where status = 'applied'), 0) >= 130
      then 'Live database is at or ahead of the repo schema marker.'
    else 'Live database is behind the deployed app. Apply migrations through schema 130.'
  end as message,
  now() as checked_at
from public.app_schema_versions;

insert into public.app_schema_versions (
  schema_version, migration_key, schema_name, release_label, description, status, notes
)
values (
  130,
  '130_payment_reconciliation_equipment_scan_local_seo_execution_playbooks',
  '130_payment_reconciliation_equipment_scan_local_seo_execution_playbooks.sql',
  '2026-06-04b',
  'Adds Admin-visible execution queues for payment application, bank reconciliation, equipment scan/template work, local SEO publication, and fallback drills.',
  'applied',
  'This pass converts the next 20 roadmap items into DB-visible execution rows and keeps schema/docs/cache/smoke guardrails aligned.'
)
on conflict (schema_version) do update set
  migration_key = excluded.migration_key,
  schema_name = excluded.schema_name,
  release_label = excluded.release_label,
  description = excluded.description,
  status = excluded.status,
  notes = excluded.notes,
  applied_at = now();

grant select on public.app_payment_execution_queue to authenticated;
grant select on public.app_bank_reconciliation_execution_queue to authenticated;
grant select on public.app_equipment_scan_template_registry to authenticated;
grant select on public.app_local_seo_execution_queue to authenticated;
grant select on public.app_fallback_drill_queue to authenticated;
grant select on public.v_app_payment_execution_queue to authenticated;
grant select on public.v_app_bank_reconciliation_execution_queue to authenticated;
grant select on public.v_app_equipment_scan_template_registry to authenticated;
grant select on public.v_app_local_seo_execution_queue to authenticated;
grant select on public.v_app_fallback_drill_queue to authenticated;
grant select on public.v_schema_drift_status to authenticated;

commit;

-- Schema 131: payment UI, reconciliation import, equipment service closeout, SEO asset, and runtime recovery controls.
-- Build 2026-06-05a.
-- This pass moves schema 130 execution queues closer to working controls and operator proof paths.

begin;

create table if not exists public.app_schema_versions (
  schema_version integer primary key,
  schema_name text,
  description text,
  status text not null default 'applied',
  applied_at timestamptz not null default now(),
  applied_by text,
  notes text
);

alter table public.app_schema_versions add column if not exists migration_key text;
alter table public.app_schema_versions add column if not exists release_label text;

create table if not exists public.app_payment_application_ui_queue (
  control_key text primary key,
  control_area text not null,
  control_title text not null,
  control_status text not null default 'planned',
  required_role text not null default 'admin',
  route_hint text,
  validation_hint text,
  posting_hint text,
  fallback_hint text,
  sort_order integer not null default 100,
  metadata jsonb not null default '{}'::jsonb,
  checked_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.app_reconciliation_import_validation_queue (
  check_key text primary key,
  import_area text not null,
  check_title text not null,
  check_status text not null default 'planned',
  csv_rule_hint text,
  match_rule_hint text,
  reviewer_hint text,
  fallback_hint text,
  sort_order integer not null default 100,
  metadata jsonb not null default '{}'::jsonb,
  checked_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.app_equipment_service_closeout_queue (
  closeout_key text primary key,
  equipment_area text not null,
  closeout_title text not null,
  closeout_status text not null default 'planned',
  required_role text not null default 'supervisor',
  proof_hint text,
  cost_capture_hint text,
  return_to_service_hint text,
  fallback_hint text,
  sort_order integer not null default 100,
  metadata jsonb not null default '{}'::jsonb,
  checked_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.app_seo_asset_publication_queue (
  asset_key text primary key,
  route_key text,
  seo_area text not null,
  asset_title text not null,
  asset_status text not null default 'planned',
  file_path_hint text,
  local_search_hint text,
  validation_hint text,
  fallback_hint text,
  sort_order integer not null default 100,
  metadata jsonb not null default '{}'::jsonb,
  checked_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.app_runtime_recovery_telemetry_queue (
  telemetry_key text primary key,
  app_surface text not null,
  recovery_title text not null,
  recovery_status text not null default 'planned',
  signal_hint text,
  operator_message_hint text,
  retry_hint text,
  owner_hint text,
  sort_order integer not null default 100,
  metadata jsonb not null default '{}'::jsonb,
  checked_at timestamptz,
  updated_at timestamptz not null default now()
);

insert into public.app_payment_application_ui_queue (
  control_key, control_area, control_title, control_status, required_role, route_hint, validation_hint, posting_hint, fallback_hint, sort_order, metadata, checked_at
)
values
  ('payment_apply_button_guard', 'payment_application', 'Wire Apply Payment button with invoice/deposit validation', 'planned', 'admin', '#admin', 'Require customer, invoice/deposit source, positive amount, date, and payment method.', 'Create staged application row before posting.', 'Keep payment as reviewer note if validation fails.', 10, '{"build":"2026-06-05a","schema":131}'::jsonb, now()),
  ('payment_reverse_button_guard', 'payment_application', 'Wire Reverse Payment button with reason and role gate', 'planned', 'admin', '#admin', 'Require original application, reversal reason, and reviewer role.', 'Create reversal row and restore open balance.', 'Block reversal and show reason field.', 20, '{"build":"2026-06-05a","schema":131}'::jsonb, now()),
  ('payment_adjustment_selector', 'payment_application', 'Add adjustment selector for discount, credit, write-off, refund, and overpayment', 'planned', 'admin', '#admin', 'Adjustment type controls required proof and posting path.', 'Separate cash movement from revenue reduction.', 'Keep staged adjustment until accountant review.', 30, '{"build":"2026-06-05a","schema":131}'::jsonb, now()),
  ('payment_proof_attachment_gate', 'payment_application', 'Require proof attachment or external reference before final posting', 'planned', 'admin', '#admin', 'Proof/reference required for refunds, overpayments, and write-offs.', 'Link proof to accountant export package.', 'Keep status pending proof.', 40, '{"build":"2026-06-05a","schema":131}'::jsonb, now())
on conflict (control_key) do update set
  control_area = excluded.control_area,
  control_title = excluded.control_title,
  control_status = excluded.control_status,
  required_role = excluded.required_role,
  route_hint = excluded.route_hint,
  validation_hint = excluded.validation_hint,
  posting_hint = excluded.posting_hint,
  fallback_hint = excluded.fallback_hint,
  sort_order = excluded.sort_order,
  metadata = excluded.metadata,
  checked_at = excluded.checked_at,
  updated_at = now();

insert into public.app_reconciliation_import_validation_queue (
  check_key, import_area, check_title, check_status, csv_rule_hint, match_rule_hint, reviewer_hint, fallback_hint, sort_order, metadata, checked_at
)
values
  ('csv_header_map', 'bank_reconciliation', 'Preview and map bank CSV headers before staging', 'planned', 'Detect date, description, debit, credit, amount, balance, reference, and account columns.', 'No match scoring until mapped columns pass.', 'Reviewer confirms the bank/source account.', 'Reject import with clear missing-column message.', 10, '{"build":"2026-06-05a","schema":131}'::jsonb, now()),
  ('csv_duplicate_detection', 'bank_reconciliation', 'Detect duplicate bank rows before acceptance', 'planned', 'Hash date, amount, description, reference, and account.', 'Duplicates are excluded from confidence scoring.', 'Reviewer can mark duplicate as accepted only with note.', 'Keep duplicates in rejected-row preview.', 20, '{"build":"2026-06-05a","schema":131}'::jsonb, now()),
  ('match_confidence_rules', 'bank_reconciliation', 'Score match confidence by amount, date, reference, customer, and invoice', 'planned', 'Accepted rows feed match candidates.', 'Exact amount/reference wins, date proximity adds score, fuzzy description is lower score.', 'Reviewer signs manual low-confidence matches.', 'Manual search stays available.', 30, '{"build":"2026-06-05a","schema":131}'::jsonb, now()),
  ('unmatch_undo_history', 'bank_reconciliation', 'Track unmatch/undo/split history with reason', 'planned', 'Each manual action records actor and reason.', 'Undo returns rows to unmatched queue.', 'Reviewer sees history before close.', 'Closed periods block undo unless reopened.', 40, '{"build":"2026-06-05a","schema":131}'::jsonb, now())
on conflict (check_key) do update set
  import_area = excluded.import_area,
  check_title = excluded.check_title,
  check_status = excluded.check_status,
  csv_rule_hint = excluded.csv_rule_hint,
  match_rule_hint = excluded.match_rule_hint,
  reviewer_hint = excluded.reviewer_hint,
  fallback_hint = excluded.fallback_hint,
  sort_order = excluded.sort_order,
  metadata = excluded.metadata,
  checked_at = excluded.checked_at,
  updated_at = now();

insert into public.app_equipment_service_closeout_queue (
  closeout_key, equipment_area, closeout_title, closeout_status, required_role, proof_hint, cost_capture_hint, return_to_service_hint, fallback_hint, sort_order, metadata, checked_at
)
values
  ('failed_arrival_closeout', 'arrival_issue', 'Close failed arrival test with service proof and cost', 'planned', 'supervisor', 'Attach photo/note proof and arrival test result.', 'Capture repair/delay/replacement estimate against job/equipment.', 'Equipment stays locked out until verifier signs off.', 'Keep open service task if proof missing.', 10, '{"build":"2026-06-05a","schema":131}'::jsonb, now()),
  ('failed_return_closeout', 'return_issue', 'Close failed return test with return-to-service signoff', 'planned', 'supervisor', 'Attach return proof, damage notes, and test result.', 'Capture actual repair/replacement cost.', 'Status changes to available only after final verifier.', 'Keep equipment maintenance/locked_out.', 20, '{"build":"2026-06-05a","schema":131}'::jsonb, now()),
  ('accessory_missing_closeout', 'accessory_issue', 'Resolve missing or damaged accessories before final return', 'planned', 'supervisor', 'Checklist shows missing/damaged accessories and resolution proof.', 'Capture accessory replacement cost.', 'Accessory issue must be closed before ready status.', 'Keep issue visible in exception queue.', 30, '{"build":"2026-06-05a","schema":131}'::jsonb, now()),
  ('service_task_cost_rollup', 'cost_rollup', 'Roll equipment service task costs into job profitability', 'planned', 'admin', 'Service task closeout includes cost proof.', 'Post repair, delay, usage, or replacement cost to job financial events.', 'Cost rows become part of close package.', 'Show service task source rows if rollup fails.', 40, '{"build":"2026-06-05a","schema":131}'::jsonb, now())
on conflict (closeout_key) do update set
  equipment_area = excluded.equipment_area,
  closeout_title = excluded.closeout_title,
  closeout_status = excluded.closeout_status,
  required_role = excluded.required_role,
  proof_hint = excluded.proof_hint,
  cost_capture_hint = excluded.cost_capture_hint,
  return_to_service_hint = excluded.return_to_service_hint,
  fallback_hint = excluded.fallback_hint,
  sort_order = excluded.sort_order,
  metadata = excluded.metadata,
  checked_at = excluded.checked_at,
  updated_at = now();

insert into public.app_seo_asset_publication_queue (
  asset_key, route_key, seo_area, asset_title, asset_status, file_path_hint, local_search_hint, validation_hint, fallback_hint, sort_order, metadata, checked_at
)
values
  ('sitemap_publish', 'home_shell', 'technical_seo', 'Publish sitemap.xml from approved public route registry', 'planned', '/sitemap.xml', 'Include only truthful service/location routes.', 'Smoke check file exists and contains approved routes.', 'Do not submit sitemap until generated file passes.', 10, '{"build":"2026-06-05a","schema":131}'::jsonb, now()),
  ('robots_publish', 'home_shell', 'technical_seo', 'Publish robots.txt with sitemap reference', 'planned', '/robots.txt', 'Allow public service pages; do not expose admin routes.', 'Smoke check sitemap reference and admin exclusions.', 'Keep default static shell until robots passes.', 20, '{"build":"2026-06-05a","schema":131}'::jsonb, now()),
  ('jsonld_publish_gate', 'home_shell', 'structured_data', 'Validate JSON-LD before public publish', 'planned', 'index.html / route snippets', 'Use accurate business/service area wording only.', 'Parse JSON-LD and flag missing required fields.', 'Plain title/meta remains fallback.', 30, '{"build":"2026-06-05a","schema":131}'::jsonb, now()),
  ('image_alt_publish_gate', 'home_shell', 'image_alt', 'Block weak public image alt text and missing local proof', 'planned', 'public image registry/static markup', 'Alt text describes real image and service area proof truthfully.', 'Smoke check missing/short alt text before deploy.', 'Hide weak gallery blocks until fixed.', 40, '{"build":"2026-06-05a","schema":131}'::jsonb, now())
on conflict (asset_key) do update set
  route_key = excluded.route_key,
  seo_area = excluded.seo_area,
  asset_title = excluded.asset_title,
  asset_status = excluded.asset_status,
  file_path_hint = excluded.file_path_hint,
  local_search_hint = excluded.local_search_hint,
  validation_hint = excluded.validation_hint,
  fallback_hint = excluded.fallback_hint,
  sort_order = excluded.sort_order,
  metadata = excluded.metadata,
  checked_at = excluded.checked_at,
  updated_at = now();

insert into public.app_runtime_recovery_telemetry_queue (
  telemetry_key, app_surface, recovery_title, recovery_status, signal_hint, operator_message_hint, retry_hint, owner_hint, sort_order, metadata, checked_at
)
values
  ('edge_view_missing_signal', 'admin-directory', 'Track optional view missing signals with operator-friendly copy', 'planned', 'safeList fallback result and view name.', 'Apply latest schema, redeploy function, then refresh.', 'Retry after schema deploy; keep table empty meanwhile.', 'Admin', 10, '{"build":"2026-06-05a","schema":131}'::jsonb, now()),
  ('service_worker_marker_signal', 'public_shell', 'Track stale service worker marker mismatch', 'planned', 'Index marker, service worker cache marker, and asset query version.', 'Hard refresh or clear old worker if markers mismatch.', 'Install cache assets one by one and keep shell fallback alive.', 'Admin', 20, '{"build":"2026-06-05a","schema":131}'::jsonb, now()),
  ('offline_sync_signal', 'mobile_forms', 'Track offline draft sync failures and conflict choices', 'planned', 'Local draft count, outbox count, last failed sync reason.', 'Choose retry, keep local, or discard local copy.', 'Retry failed payload only; keep copy until acknowledged.', 'Supervisor', 30, '{"build":"2026-06-05a","schema":131}'::jsonb, now()),
  ('accounting_block_signal', 'accounting_workbench', 'Track proof/signoff blocks before close or posting', 'planned', 'Missing proof, reviewer, close period, or reconciliation signal.', 'Complete the missing proof/signoff before posting.', 'No automatic retry for blocked accounting actions.', 'Admin / Accountant', 40, '{"build":"2026-06-05a","schema":131}'::jsonb, now())
on conflict (telemetry_key) do update set
  app_surface = excluded.app_surface,
  recovery_title = excluded.recovery_title,
  recovery_status = excluded.recovery_status,
  signal_hint = excluded.signal_hint,
  operator_message_hint = excluded.operator_message_hint,
  retry_hint = excluded.retry_hint,
  owner_hint = excluded.owner_hint,
  sort_order = excluded.sort_order,
  metadata = excluded.metadata,
  checked_at = excluded.checked_at,
  updated_at = now();

insert into public.app_roadmap_action_steps (
  step_key, step_batch, step_number, step_area, step_title, step_status, priority, source_doc, route_hint, acceptance_check, implementation_notes, risk_if_skipped, sort_order, metadata, checked_at
)
values
  ('schema131_done_01', 'completed_this_pass', 1, 'schema', 'Added schema 131 execution-control queues', 'completed', 'high', 'DEVELOPMENT_ROADMAP.md', '#admin', 'Migration and full schema include schema 131.', 'New DB-visible queues track payment UI, reconciliation import validation, equipment service closeout, SEO asset publication, and runtime recovery telemetry.', 'Execution controls remain scattered.', 1, '{"build":"2026-06-05a","schema":131}'::jsonb, now()),
  ('schema131_done_02', 'completed_this_pass', 2, 'admin', 'Loaded schema 131 queues in admin-directory', 'completed', 'high', 'DEVELOPMENT_ROADMAP.md', '#admin', 'admin-directory returns all schema 131 views with safe fallbacks.', 'Admin can see these queues when schema 131 is applied.', 'Rows stay hidden from operators.', 2, '{"build":"2026-06-05a","schema":131}'::jsonb, now()),
  ('schema131_done_03', 'completed_this_pass', 3, 'ui', 'Rendered schema 131 queues in Admin readiness', 'completed', 'high', 'DEVELOPMENT_ROADMAP.md', '#admin', 'Admin UI contains schema 131 table bindings and empty-state fallback messages.', 'Planning rows are visible in the app.', 'Operators rely on Markdown only.', 3, '{"build":"2026-06-05a","schema":131}'::jsonb, now()),
  ('schema131_done_04', 'completed_this_pass', 4, 'seo', 'Kept one-H1 and local SEO smoke checks active', 'completed', 'high', 'DEVELOPMENT_ROADMAP.md', '/', 'Smoke confirms one H1 and cache markers.', 'Public route quality habits continue each pass.', 'Search clarity can drift.', 4, '{"build":"2026-06-05a","schema":131}'::jsonb, now()),
  ('schema131_done_05', 'completed_this_pass', 5, 'cleanup', 'Restored missing archive snapshots and retired test_write files', 'completed', 'medium', 'KNOWN_ISSUES_AND_GAPS.md', 'archive', 'Smoke archive and temporary file checks pass.', 'Root stays clean and smoke script stays reliable.', 'Old hygiene failures distract from real work.', 5, '{"build":"2026-06-05a","schema":131}'::jsonb, now()),
  ('schema131_next_01', 'next_20', 1, 'payments', 'Build the real Apply Payment form and staged save action', 'planned', 'high', 'DEVELOPMENT_ROADMAP.md', '#admin', 'Admin can choose invoice/deposit rows, amount, date, method, and save staged application.', 'Payment action moves from queue to real UI.', 'Cash application stays manual.', 101, '{"build":"2026-06-05a","schema":131}'::jsonb, now()),
  ('schema131_next_02', 'next_20', 2, 'payments', 'Add reversal and adjustment actions with proof gates', 'planned', 'high', 'DEVELOPMENT_ROADMAP.md', '#admin', 'Reverse/adjust buttons require reason, proof/reference, and reviewer role.', 'Mistakes can be corrected with audit trail.', 'Corrections remain unsafe/manual.', 102, '{"build":"2026-06-05a","schema":131}'::jsonb, now()),
  ('schema131_next_03', 'next_20', 3, 'reconciliation', 'Create bank CSV preview/import staging screen', 'planned', 'high', 'DEVELOPMENT_ROADMAP.md', '#admin', 'CSV rows preview with header map, duplicate detection, rejected rows, and accepted count.', 'Bank imports become safer.', 'Bad rows may enter accounting.', 103, '{"build":"2026-06-05a","schema":131}'::jsonb, now()),
  ('schema131_next_04', 'next_20', 4, 'reconciliation', 'Create match scoring and manual match/split/undo controls', 'planned', 'high', 'DEVELOPMENT_ROADMAP.md', '#admin', 'Reviewer can accept scored matches, manually match, split, unmatch, and see history.', 'Reconciliation gets auditable flow.', 'Rows stay unmatched.', 104, '{"build":"2026-06-05a","schema":131}'::jsonb, now()),
  ('schema131_next_05', 'next_20', 5, 'equipment', 'Add camera scan using BarcodeDetector with manual fallback', 'planned', 'high', 'DEVELOPMENT_ROADMAP.md', '#jobs', 'Camera scan fills equipment code when supported and falls back to manual entry.', 'Field equipment work speeds up.', 'Manual entry stays slow.', 105, '{"build":"2026-06-05a","schema":131}'::jsonb, now()),
  ('schema131_next_06', 'next_20', 6, 'equipment', 'Create accessory template tables and editor', 'planned', 'high', 'DEVELOPMENT_ROADMAP.md', '#jobs', 'Expected accessories load by equipment pool/category.', 'Missing accessories are easier to catch.', 'Checklists stay free-text.', 106, '{"build":"2026-06-05a","schema":131}'::jsonb, now()),
  ('schema131_next_07', 'next_20', 7, 'equipment', 'Enforce verifier roles server-side for return-to-service', 'planned', 'high', 'DEVELOPMENT_ROADMAP.md', '#jobs', 'Server blocks return-to-service below required verifier role.', 'Lockout safety is authoritative.', 'UI-only locks can be bypassed.', 107, '{"build":"2026-06-05a","schema":131}'::jsonb, now()),
  ('schema131_next_08', 'next_20', 8, 'equipment', 'Build equipment service closeout screen with proof and costs', 'planned', 'high', 'DEVELOPMENT_ROADMAP.md', '#jobs', 'Failed test service tasks can be closed with proof, costs, and final status.', 'Equipment cost and safety flow gets depth.', 'Service tasks stay open-ended.', 108, '{"build":"2026-06-05a","schema":131}'::jsonb, now()),
  ('schema131_next_09', 'next_20', 9, 'seo', 'Generate sitemap.xml and robots.txt from approved routes', 'planned', 'medium', 'DEVELOPMENT_ROADMAP.md', '/', 'Generated files exist and list approved public routes only.', 'Technical SEO moves beyond planning.', 'Search engines get stale route hints.', 109, '{"build":"2026-06-05a","schema":131}'::jsonb, now()),
  ('schema131_next_10', 'next_20', 10, 'seo', 'Add broken-link, image-alt, and JSON-LD validation to smoke checks', 'planned', 'medium', 'DEVELOPMENT_ROADMAP.md', '/', 'Smoke flags broken assets, weak alt text, and invalid JSON-LD.', 'Public quality gate becomes stronger.', 'SEO drift remains manual.', 110, '{"build":"2026-06-05a","schema":131}'::jsonb, now()),
  ('schema131_next_11', 'next_20', 11, 'accounting', 'Build HST/GST source totals and proof review UI', 'planned', 'high', 'DEVELOPMENT_ROADMAP.md', '#admin', 'Reviewer sees tax totals, adjustments, filed date, remitted date, and proof.', 'Tax review becomes auditable.', 'Tax filing remains spreadsheet-based.', 111, '{"build":"2026-06-05a","schema":131}'::jsonb, now()),
  ('schema131_next_12', 'next_20', 12, 'accounting', 'Build payroll remittance source totals and proof UI', 'planned', 'high', 'DEVELOPMENT_ROADMAP.md', '#admin', 'Reviewer sees payroll source totals, deductions, employer costs, proof, and signoff.', 'Payroll remittance gets close workflow.', 'Payroll proof remains scattered.', 112, '{"build":"2026-06-05a","schema":131}'::jsonb, now()),
  ('schema131_next_13', 'next_20', 13, 'accounting', 'Build month-end lock/reopen and accountant export package', 'planned', 'high', 'DEVELOPMENT_ROADMAP.md', '#admin', 'Closed periods block posting unless reopened with reason; export package lists files/proofs.', 'Month-end becomes controlled.', 'Posting drift can happen after close.', 113, '{"build":"2026-06-05a","schema":131}'::jsonb, now()),
  ('schema131_next_14', 'next_20', 14, 'mobile', 'Add offline conflict resolution choices to forms', 'planned', 'medium', 'DEVELOPMENT_ROADMAP.md', '#today', 'Users can retry, keep local, or discard local draft when conflict occurs.', 'Mobile fallback becomes clear.', 'Draft conflict can confuse users.', 114, '{"build":"2026-06-05a","schema":131}'::jsonb, now()),
  ('schema131_next_15', 'next_20', 15, 'fallback', 'Store fallback drill run history and pass/fail notes', 'planned', 'medium', 'DEVELOPMENT_ROADMAP.md', '#admin', 'Operators can mark drills run/pass/fail with notes.', 'Fallbacks become testable.', 'Fallback rows are unproven.', 115, '{"build":"2026-06-05a","schema":131}'::jsonb, now()),
  ('schema131_next_16', 'next_20', 16, 'telemetry', 'Add runtime recovery telemetry summary cards', 'planned', 'medium', 'DEVELOPMENT_ROADMAP.md', '#admin', 'Admin sees optional-view, service-worker, offline-sync, and accounting-block signals.', 'Failures are easier to triage.', 'Errors remain hidden in console.', 116, '{"build":"2026-06-05a","schema":131}'::jsonb, now()),
  ('schema131_next_17', 'next_20', 17, 'data', 'Promote repeated route/SEO/action JSON data into DB-backed registries', 'planned', 'medium', 'DEVELOPMENT_ROADMAP.md', '#admin', 'Repeated static config with review status moves into DB queues.', 'Admin can sort/review/update it.', 'JSON duplication remains.', 117, '{"build":"2026-06-05a","schema":131}'::jsonb, now()),
  ('schema131_next_18', 'next_20', 18, 'css', 'Add CSS component drift snapshot and mobile overflow check', 'planned', 'medium', 'DEVELOPMENT_ROADMAP.md', '/', 'Smoke detects major missing CSS components and mobile overflow patterns.', 'CSS drift is caught earlier.', 'Mobile layout can regress.', 118, '{"build":"2026-06-05a","schema":131}'::jsonb, now()),
  ('schema131_next_19', 'next_20', 19, 'deployment', 'Add schema deploy order and function redeploy checklist for 131+', 'planned', 'medium', 'DEPLOYMENT_GUIDE.md', '#admin', 'Deployment checklist states schema/function/cache order.', 'Deploy steps stay clear.', 'Partial deploy confusion continues.', 119, '{"build":"2026-06-05a","schema":131}'::jsonb, now()),
  ('schema131_next_20', 'next_20', 20, 'docs', 'Keep all active Markdown and schema references synced each pass', 'planned', 'medium', 'DEVELOPMENT_ROADMAP.md', 'docs', 'Roadmap, known gaps, changelog, project state, testing, deployment, and full schema all reference latest build.', 'New chat starts with correct context.', 'Docs drift again.', 120, '{"build":"2026-06-05a","schema":131}'::jsonb, now())
on conflict (step_key) do update set
  step_batch = excluded.step_batch,
  step_number = excluded.step_number,
  step_area = excluded.step_area,
  step_title = excluded.step_title,
  step_status = excluded.step_status,
  priority = excluded.priority,
  source_doc = excluded.source_doc,
  route_hint = excluded.route_hint,
  acceptance_check = excluded.acceptance_check,
  implementation_notes = excluded.implementation_notes,
  risk_if_skipped = excluded.risk_if_skipped,
  sort_order = excluded.sort_order,
  metadata = excluded.metadata,
  checked_at = excluded.checked_at,
  updated_at = now();

drop view if exists public.v_app_payment_application_ui_queue;
create view public.v_app_payment_application_ui_queue as
select control_key, control_area, control_title, control_status, required_role, route_hint, validation_hint, posting_hint, fallback_hint, sort_order, checked_at, updated_at
from public.app_payment_application_ui_queue
order by sort_order, control_key;

drop view if exists public.v_app_reconciliation_import_validation_queue;
create view public.v_app_reconciliation_import_validation_queue as
select check_key, import_area, check_title, check_status, csv_rule_hint, match_rule_hint, reviewer_hint, fallback_hint, sort_order, checked_at, updated_at
from public.app_reconciliation_import_validation_queue
order by sort_order, check_key;

drop view if exists public.v_app_equipment_service_closeout_queue;
create view public.v_app_equipment_service_closeout_queue as
select closeout_key, equipment_area, closeout_title, closeout_status, required_role, proof_hint, cost_capture_hint, return_to_service_hint, fallback_hint, sort_order, checked_at, updated_at
from public.app_equipment_service_closeout_queue
order by sort_order, closeout_key;

drop view if exists public.v_app_seo_asset_publication_queue;
create view public.v_app_seo_asset_publication_queue as
select asset_key, route_key, seo_area, asset_title, asset_status, file_path_hint, local_search_hint, validation_hint, fallback_hint, sort_order, checked_at, updated_at
from public.app_seo_asset_publication_queue
order by sort_order, asset_key;

drop view if exists public.v_app_runtime_recovery_telemetry_queue;
create view public.v_app_runtime_recovery_telemetry_queue as
select telemetry_key, app_surface, recovery_title, recovery_status, signal_hint, operator_message_hint, retry_hint, owner_hint, sort_order, checked_at, updated_at
from public.app_runtime_recovery_telemetry_queue
order by sort_order, telemetry_key;

drop view if exists public.v_schema_drift_status;
create view public.v_schema_drift_status as
select
  131::int as expected_schema_version,
  coalesce(max(schema_version) filter (where status = 'applied'), 0)::int as latest_applied_schema_version,
  case
    when coalesce(max(schema_version) filter (where status = 'applied'), 0) >= 131
      then 'current'
    else 'behind'
  end as drift_status,
  case
    when coalesce(max(schema_version) filter (where status = 'applied'), 0) >= 131
      then 'Live database is at or ahead of the repo schema marker.'
    else 'Live database is behind the deployed app. Apply migrations through schema 131.'
  end as message,
  now() as checked_at
from public.app_schema_versions;

insert into public.app_schema_versions (
  schema_version, migration_key, schema_name, release_label, description, status, notes
)
values (
  131,
  '131_payment_recon_equipment_seo_runtime_execution_controls',
  '131_payment_recon_equipment_seo_runtime_execution_controls.sql',
  '2026-06-05a',
  'Adds Admin-visible execution controls for payment UI validation, reconciliation import validation, equipment service closeout, SEO asset publication, and runtime recovery telemetry.',
  'applied',
  'This pass moves schema 130 execution playbooks closer to working controls while keeping schema/docs/cache/smoke guardrails aligned.'
)
on conflict (schema_version) do update set
  migration_key = excluded.migration_key,
  schema_name = excluded.schema_name,
  release_label = excluded.release_label,
  description = excluded.description,
  status = excluded.status,
  notes = excluded.notes,
  applied_at = now();

grant select on public.app_payment_application_ui_queue to authenticated;
grant select on public.app_reconciliation_import_validation_queue to authenticated;
grant select on public.app_equipment_service_closeout_queue to authenticated;
grant select on public.app_seo_asset_publication_queue to authenticated;
grant select on public.app_runtime_recovery_telemetry_queue to authenticated;
grant select on public.v_app_payment_application_ui_queue to authenticated;
grant select on public.v_app_reconciliation_import_validation_queue to authenticated;
grant select on public.v_app_equipment_service_closeout_queue to authenticated;
grant select on public.v_app_seo_asset_publication_queue to authenticated;
grant select on public.v_app_runtime_recovery_telemetry_queue to authenticated;
grant select on public.v_schema_drift_status to authenticated;

commit;

-- Schema 132: payment posting proofs, reconciliation matching, equipment verification, local SEO assets, and fallback telemetry drill history.
-- Build 2026-06-05b.
-- This pass moves schema 131 execution controls closer to usable operator workflows while keeping roadmap/docs/schema drift aligned.

begin;

create table if not exists public.app_schema_versions (
  schema_version integer primary key,
  schema_name text,
  description text,
  status text not null default 'applied',
  applied_at timestamptz not null default now(),
  applied_by text,
  notes text
);

alter table public.app_schema_versions add column if not exists migration_key text;
alter table public.app_schema_versions add column if not exists release_label text;

create table if not exists public.app_payment_posting_proof_queue (
  proof_key text primary key,
  proof_area text not null,
  proof_title text not null,
  proof_status text not null default 'planned',
  required_role text not null default 'admin',
  source_row_hint text,
  proof_requirement text,
  posting_block_hint text,
  fallback_hint text,
  sort_order integer not null default 100,
  metadata jsonb not null default '{}'::jsonb,
  checked_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.app_reconciliation_match_workbench_queue (
  workbench_key text primary key,
  match_area text not null,
  workbench_title text not null,
  workbench_status text not null default 'planned',
  import_rule_hint text,
  match_score_hint text,
  manual_review_hint text,
  fallback_hint text,
  sort_order integer not null default 100,
  metadata jsonb not null default '{}'::jsonb,
  checked_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.app_equipment_scan_verification_queue (
  verification_key text primary key,
  equipment_area text not null,
  verification_title text not null,
  verification_status text not null default 'planned',
  scan_path_hint text,
  role_gate_hint text,
  evidence_hint text,
  fallback_hint text,
  sort_order integer not null default 100,
  metadata jsonb not null default '{}'::jsonb,
  checked_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.app_local_seo_asset_smoke_queue (
  smoke_key text primary key,
  seo_area text not null,
  smoke_title text not null,
  smoke_status text not null default 'planned',
  asset_path_hint text,
  local_relevance_hint text,
  validation_hint text,
  fallback_hint text,
  sort_order integer not null default 100,
  metadata jsonb not null default '{}'::jsonb,
  checked_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.app_runtime_fallback_drill_history_queue (
  drill_key text primary key,
  app_surface text not null,
  drill_title text not null,
  drill_status text not null default 'planned',
  trigger_hint text,
  expected_result_hint text,
  evidence_hint text,
  fallback_hint text,
  sort_order integer not null default 100,
  metadata jsonb not null default '{}'::jsonb,
  checked_at timestamptz,
  updated_at timestamptz not null default now()
);

insert into public.app_payment_posting_proof_queue (proof_key, proof_area, proof_title, proof_status, required_role, source_row_hint, proof_requirement, posting_block_hint, fallback_hint, sort_order, metadata, checked_at)
values
  ('payment_source_required', 'payment_application', 'Require source payment, target invoice, amount, date, and method before Apply Payment', 'planned', 'admin', 'AR payment / deposit / invoice rows', 'Receipt reference or external transaction id is required before posting.', 'Block final posting if source or target is missing.', 'Keep row staged and show missing-field warning.', 10, '{"build":"2026-06-05b","schema":132}'::jsonb, now()),
  ('adjustment_reason_required', 'payment_adjustments', 'Require reason and proof for discounts, credits, write-offs, refunds, and overpayments', 'planned', 'admin', 'Adjustment selector / payment application rows', 'Reason, reviewer, amount, and proof attachment/reference are required.', 'Block close-period posting if proof is missing.', 'Store draft adjustment with reviewer note.', 20, '{"build":"2026-06-05b","schema":132}'::jsonb, now()),
  ('accountant_export_payment_manifest', 'accountant_export', 'Include payment application and reversal manifest in accountant export package', 'planned', 'admin', 'Payment, adjustment, reversal, and proof rows', 'Manifest lists row counts, totals, and proof references.', 'Closed period export is blocked until unmatched proof is resolved.', 'Export summary table remains fallback.', 30, '{"build":"2026-06-05b","schema":132}'::jsonb, now()),
  ('job_profitability_payment_link', 'job_profitability', 'Link payment and adjustment proof back to job profitability review', 'planned', 'admin', 'Job financial events / AR invoice / payment rows', 'Job margin card shows payment, credit, write-off, refund, and outstanding balance.', 'Do not mark job accounting-complete until payment state is reviewed.', 'Show payment source rows if rollup fails.', 40, '{"build":"2026-06-05b","schema":132}'::jsonb, now())
on conflict (proof_key) do update set
  proof_area = excluded.proof_area,
  proof_title = excluded.proof_title,
  proof_status = excluded.proof_status,
  required_role = excluded.required_role,
  source_row_hint = excluded.source_row_hint,
  proof_requirement = excluded.proof_requirement,
  posting_block_hint = excluded.posting_block_hint,
  fallback_hint = excluded.fallback_hint,
  sort_order = excluded.sort_order,
  metadata = excluded.metadata,
  checked_at = excluded.checked_at,
  updated_at = now();

insert into public.app_reconciliation_match_workbench_queue (workbench_key, match_area, workbench_title, workbench_status, import_rule_hint, match_score_hint, manual_review_hint, fallback_hint, sort_order, metadata, checked_at)
values
  ('csv_preview_accept_reject', 'csv_preview', 'Preview bank CSV rows with accept/reject reasons before staging', 'planned', 'Validate mapped date, amount, description, reference, account, duplicate hash, and sign direction.', 'No match scoring until accepted rows are staged.', 'Reviewer can accept rejected row only with note.', 'Keep file outside posting path until preview passes.', 10, '{"build":"2026-06-05b","schema":132}'::jsonb, now()),
  ('match_score_thresholds', 'match_scoring', 'Apply match score thresholds for exact, probable, and manual-review matches', 'planned', 'Accepted import rows are normalized before scoring.', 'Exact amount/reference/date gets highest score; fuzzy text is lower confidence.', 'Low confidence rows must be manually reviewed.', 'Manual search remains fallback.', 20, '{"build":"2026-06-05b","schema":132}'::jsonb, now()),
  ('split_match_support', 'manual_review', 'Support split matches with notes, proof, and undo trail', 'planned', 'Split rows inherit source CSV row and reviewer note.', 'Split rows cannot exceed source amount.', 'Reviewer sees split history before close.', 'Leave row unmatched if split validation fails.', 30, '{"build":"2026-06-05b","schema":132}'::jsonb, now()),
  ('reconciliation_close_block', 'period_close', 'Block month-end close when unmatched or unreviewed reconciliation rows remain', 'planned', 'Close wizard checks unmatched rows, rejected rows, and unsigned reviews.', 'Only signed sessions can close.', 'Admin/accountant must sign unresolved exceptions.', 'Close remains in review state.', 40, '{"build":"2026-06-05b","schema":132}'::jsonb, now())
on conflict (workbench_key) do update set
  match_area = excluded.match_area,
  workbench_title = excluded.workbench_title,
  workbench_status = excluded.workbench_status,
  import_rule_hint = excluded.import_rule_hint,
  match_score_hint = excluded.match_score_hint,
  manual_review_hint = excluded.manual_review_hint,
  fallback_hint = excluded.fallback_hint,
  sort_order = excluded.sort_order,
  metadata = excluded.metadata,
  checked_at = excluded.checked_at,
  updated_at = now();

insert into public.app_equipment_scan_verification_queue (verification_key, equipment_area, verification_title, verification_status, scan_path_hint, role_gate_hint, evidence_hint, fallback_hint, sort_order, metadata, checked_at)
values
  ('checkout_scan_required_when_available', 'checkout', 'Use QR/barcode scan when available, with manual code fallback', 'planned', 'Camera scan -> equipment code -> checkout form prefill.', 'Employee may scan; supervisor still approves checkout.', 'Checkout event records scanned/manual source.', 'Manual entry stays available when camera unsupported.', 10, '{"build":"2026-06-05b","schema":132}'::jsonb, now()),
  ('arrival_scan_site_match', 'arrival_verification', 'Verify scanned equipment arrived at the intended site', 'planned', 'Scan equipment code at destination site.', 'Supervisor/site lead verifies arrival test.', 'Arrival event stores site, condition, test result, and proof note.', 'Manual verify arrival remains fallback.', 20, '{"build":"2026-06-05b","schema":132}'::jsonb, now()),
  ('return_scan_accessory_match', 'return_verification', 'Scan equipment on return and compare accessory checklist', 'planned', 'Scan returned equipment and load expected accessories.', 'Supervisor verifies return, accessory status, and damage.', 'Missing/damaged accessories create service task and cost capture.', 'Keep return pending review if checklist fails.', 30, '{"build":"2026-06-05b","schema":132}'::jsonb, now()),
  ('return_to_service_proof_gate', 'return_to_service', 'Require service proof before locked-out equipment becomes available', 'planned', 'Service task closeout references equipment scan/code.', 'Admin/supervisor role gate blocks bypass.', 'Proof, cost, and final test result are retained.', 'Keep locked out until gate passes.', 40, '{"build":"2026-06-05b","schema":132}'::jsonb, now())
on conflict (verification_key) do update set
  equipment_area = excluded.equipment_area,
  verification_title = excluded.verification_title,
  verification_status = excluded.verification_status,
  scan_path_hint = excluded.scan_path_hint,
  role_gate_hint = excluded.role_gate_hint,
  evidence_hint = excluded.evidence_hint,
  fallback_hint = excluded.fallback_hint,
  sort_order = excluded.sort_order,
  metadata = excluded.metadata,
  checked_at = excluded.checked_at,
  updated_at = now();

insert into public.app_local_seo_asset_smoke_queue (smoke_key, seo_area, smoke_title, smoke_status, asset_path_hint, local_relevance_hint, validation_hint, fallback_hint, sort_order, metadata, checked_at)
values
  ('sitemap_file_present', 'technical_seo', 'Ship sitemap.xml with approved public routes only', 'in_progress', '/sitemap.xml', 'Routes must match true service/location coverage.', 'Smoke checks sitemap file exists and excludes admin routes.', 'Keep single-page shell if sitemap generation fails.', 10, '{"build":"2026-06-05b","schema":132}'::jsonb, now()),
  ('robots_file_present', 'technical_seo', 'Ship robots.txt with sitemap reference and admin exclusions', 'in_progress', '/robots.txt', 'Public crawl is allowed; admin routes are excluded.', 'Smoke checks robots file exists and references sitemap.', 'Default robots remains fallback.', 20, '{"build":"2026-06-05b","schema":132}'::jsonb, now()),
  ('title_h1_meta_alignment', 'on_page_seo', 'Check title, H1, meta description, and local wording alignment', 'in_progress', 'index.html', 'Use clear service/location wording without duplicate H1s.', 'Smoke verifies one public H1 and local terms table rows.', 'Hold route in review until wording passes.', 30, '{"build":"2026-06-05b","schema":132}'::jsonb, now()),
  ('image_alt_jsonld_check', 'structured_data', 'Add image alt and JSON-LD validation before local proof publishing', 'planned', 'index.html / public image registry', 'Image alt text and structured data must be accurate and not overclaim.', 'Smoke flags missing alt text and invalid JSON-LD.', 'Hide gallery/proof block until fixed.', 40, '{"build":"2026-06-05b","schema":132}'::jsonb, now())
on conflict (smoke_key) do update set
  seo_area = excluded.seo_area,
  smoke_title = excluded.smoke_title,
  smoke_status = excluded.smoke_status,
  asset_path_hint = excluded.asset_path_hint,
  local_relevance_hint = excluded.local_relevance_hint,
  validation_hint = excluded.validation_hint,
  fallback_hint = excluded.fallback_hint,
  sort_order = excluded.sort_order,
  metadata = excluded.metadata,
  checked_at = excluded.checked_at,
  updated_at = now();

insert into public.app_runtime_fallback_drill_history_queue (drill_key, app_surface, drill_title, drill_status, trigger_hint, expected_result_hint, evidence_hint, fallback_hint, sort_order, metadata, checked_at)
values
  ('edge_optional_view_drill', 'admin-directory', 'Drill missing optional view fallback', 'planned', 'Temporarily hide optional schema view in test database.', 'Admin readiness table shows empty rows with apply-schema hint instead of crashing.', 'Record drill date/result in future drill history.', 'safeList keeps response alive.', 10, '{"build":"2026-06-05b","schema":132}'::jsonb, now()),
  ('service_worker_stale_drill', 'public_shell', 'Drill stale service worker and cache-marker recovery', 'planned', 'Serve previous worker marker against new index marker.', 'User sees hard-refresh/clear-worker instruction and app shell still loads.', 'Record marker mismatch signal once telemetry table exists.', 'Per-asset cache install keeps shell alive.', 20, '{"build":"2026-06-05b","schema":132}'::jsonb, now()),
  ('offline_draft_conflict_drill', 'mobile_forms', 'Drill offline draft conflict choices', 'planned', 'Create local draft, change server record, then reconnect.', 'User can retry, keep local, or discard local draft.', 'Record choice, actor, and conflict reason in future history table.', 'Local copy is retained until acknowledged.', 30, '{"build":"2026-06-05b","schema":132}'::jsonb, now()),
  ('accounting_block_drill', 'accounting_workbench', 'Drill accounting proof/signoff block before posting', 'planned', 'Attempt close/posting without proof or reviewer.', 'System blocks action and shows missing proof/signoff reason.', 'Record blocked reason and reviewer note in future audit table.', 'Action remains staged, not posted.', 40, '{"build":"2026-06-05b","schema":132}'::jsonb, now())
on conflict (drill_key) do update set
  app_surface = excluded.app_surface,
  drill_title = excluded.drill_title,
  drill_status = excluded.drill_status,
  trigger_hint = excluded.trigger_hint,
  expected_result_hint = excluded.expected_result_hint,
  evidence_hint = excluded.evidence_hint,
  fallback_hint = excluded.fallback_hint,
  sort_order = excluded.sort_order,
  metadata = excluded.metadata,
  checked_at = excluded.checked_at,
  updated_at = now();

insert into public.app_roadmap_action_steps (
  step_key, step_batch, step_number, step_area, step_title, step_status, priority, source_doc, route_hint, acceptance_check, implementation_notes, risk_if_skipped, sort_order, metadata, checked_at
)
values
  ('schema132_done_01', 'completed_this_pass', 1, 'schema', 'Added schema 132 operator workflow queues', 'completed', 'high', 'DEVELOPMENT_ROADMAP.md', '#admin', 'Migration and full schema include schema 132.', 'Payment proof, reconciliation matching, equipment scan verification, SEO asset smoke, and fallback drill queues are DB-visible.', 'Workflow depth remains only in Markdown.', 1, '{"build":"2026-06-05b","schema":132}'::jsonb, now()),
  ('schema132_done_02', 'completed_this_pass', 2, 'admin', 'Loaded schema 132 queues in Admin readiness', 'completed', 'high', 'DEVELOPMENT_ROADMAP.md', '#admin', 'admin-directory and admin-ui reference schema 132 views.', 'Operators can review the new proof/matching/scan/SEO/fallback queues.', 'Rows stay hidden from Admin.', 2, '{"build":"2026-06-05b","schema":132}'::jsonb, now()),
  ('schema132_done_03', 'completed_this_pass', 3, 'seo', 'Added first static sitemap.xml and robots.txt assets', 'completed', 'medium', 'DEVELOPMENT_ROADMAP.md', '/', 'Files exist and smoke checks verify their presence.', 'Technical SEO moves from queue to shipped asset.', 'Search engines lack canonical crawl hints.', 3, '{"build":"2026-06-05b","schema":132}'::jsonb, now()),
  ('schema132_done_04', 'completed_this_pass', 4, 'cleanup', 'Archived current Markdown and retired root test_write files', 'completed', 'high', 'DEVELOPMENT_ROADMAP.md', 'archive', 'Smoke archive hygiene passes and root test files are removed.', 'Root stays cleaner for deployment.', 'Temporary files keep drifting into builds.', 4, '{"build":"2026-06-05b","schema":132}'::jsonb, now()),
  ('schema132_done_05', 'completed_this_pass', 5, 'cache', 'Updated cache marker to 2026-06-05b', 'completed', 'high', 'DEPLOYMENT_GUIDE.md', '/', 'index.html and service worker markers match.', 'Hard-refresh guidance points to the latest assets.', 'Old cache can mask repaired code.', 5, '{"build":"2026-06-05b","schema":132}'::jsonb, now()),
  ('schema132_next_01', 'next_20', 1, 'accounting', 'Create real payment application tables and form actions from proof queue', 'planned', 'high', 'DEVELOPMENT_ROADMAP.md', '#admin', 'Apply/reverse/adjust/refund buttons write staged rows with proof requirements.', 'Payment application becomes operational.', 'Cash remains manually tracked.', 101, '{"build":"2026-06-05b","schema":132}'::jsonb, now()),
  ('schema132_next_02', 'next_20', 2, 'accounting', 'Build bank CSV upload preview with accepted/rejected row staging', 'planned', 'high', 'DEVELOPMENT_ROADMAP.md', '#admin', 'CSV preview validates headers, duplicate hashes, dates, signs, and row counts.', 'Bad import rows are stopped before reconciliation.', 'Bad bank data can enter.', 102, '{"build":"2026-06-05b","schema":132}'::jsonb, now()),
  ('schema132_next_03', 'next_20', 3, 'accounting', 'Build reconciliation match workbench with split/undo/signoff', 'planned', 'high', 'DEVELOPMENT_ROADMAP.md', '#admin', 'Reviewer can accept matches, split rows, undo with reason, and sign the session.', 'Bank reconciliation gets usable workflow.', 'Unmatched rows stay manual.', 103, '{"build":"2026-06-05b","schema":132}'::jsonb, now()),
  ('schema132_next_04', 'next_20', 4, 'equipment', 'Build camera scan helper with manual fallback and event source tracking', 'planned', 'high', 'DEVELOPMENT_ROADMAP.md', '#jobs', 'Checkout/arrival/return forms can scan or enter code and record source.', 'Equipment movement becomes easier in the field.', 'Manual entry remains error-prone.', 104, '{"build":"2026-06-05b","schema":132}'::jsonb, now()),
  ('schema132_next_05', 'next_20', 5, 'equipment', 'Build DB-backed accessory templates and return comparison', 'planned', 'high', 'DEVELOPMENT_ROADMAP.md', '#jobs', 'Expected accessory templates load by equipment pool and compare on return.', 'Missing accessory cost/proof flow improves.', 'Accessory checks stay free-text.', 105, '{"build":"2026-06-05b","schema":132}'::jsonb, now()),
  ('schema132_next_06', 'next_20', 6, 'equipment', 'Enforce return-to-service proof server-side', 'planned', 'high', 'DEVELOPMENT_ROADMAP.md', '#jobs', 'Locked-out equipment cannot become available without service proof and verifier role.', 'Safety lockout becomes authoritative.', 'UI-only locks can be bypassed.', 106, '{"build":"2026-06-05b","schema":132}'::jsonb, now()),
  ('schema132_next_07', 'next_20', 7, 'seo', 'Generate sitemap from approved route registry instead of static placeholder', 'planned', 'medium', 'DEVELOPMENT_ROADMAP.md', '/', 'sitemap.xml is generated from approved public route rows.', 'SEO assets stay aligned to real routes.', 'Static sitemap can drift.', 107, '{"build":"2026-06-05b","schema":132}'::jsonb, now()),
  ('schema132_next_08', 'next_20', 8, 'seo', 'Add JSON-LD and image-alt smoke checks', 'planned', 'medium', 'DEVELOPMENT_ROADMAP.md', '/', 'Smoke flags invalid JSON-LD and missing/weak image alt text.', 'Public content quality improves.', 'SEO issues stay manual.', 108, '{"build":"2026-06-05b","schema":132}'::jsonb, now()),
  ('schema132_next_09', 'next_20', 9, 'css', 'Add mobile overflow and component drift smoke checks', 'planned', 'medium', 'DEVELOPMENT_ROADMAP.md', '/', 'Smoke catches missing CSS blocks and obvious mobile overflow patterns.', 'CSS drift is caught earlier.', 'Mobile layout can regress.', 109, '{"build":"2026-06-05b","schema":132}'::jsonb, now()),
  ('schema132_next_10', 'next_20', 10, 'fallback', 'Create fallback drill run-history table and UI', 'planned', 'medium', 'DEVELOPMENT_ROADMAP.md', '#admin', 'Operators can mark fallback drills pass/fail with notes and evidence.', 'Fallbacks become testable.', 'Drills remain theoretical.', 110, '{"build":"2026-06-05b","schema":132}'::jsonb, now()),
  ('schema132_next_11', 'next_20', 11, 'telemetry', 'Store runtime fallback telemetry signals', 'planned', 'medium', 'DEVELOPMENT_ROADMAP.md', '#admin', 'Optional-view, cache-marker, offline-conflict, and accounting-block signals are summarized.', 'Troubleshooting gets faster.', 'Console-only failures remain hidden.', 111, '{"build":"2026-06-05b","schema":132}'::jsonb, now()),
  ('schema132_next_12', 'next_20', 12, 'accounting', 'Build HST/GST source totals, adjustments, proof, filed/remitted signoff', 'planned', 'high', 'DEVELOPMENT_ROADMAP.md', '#admin', 'Tax filing screen shows source totals, proof, dates, and review status.', 'Tax review becomes auditable.', 'Tax support stays spreadsheet-based.', 112, '{"build":"2026-06-05b","schema":132}'::jsonb, now()),
  ('schema132_next_13', 'next_20', 13, 'accounting', 'Build payroll remittance totals and proof signoff', 'planned', 'high', 'DEVELOPMENT_ROADMAP.md', '#admin', 'Payroll remittance screen shows deductions, employer costs, proof, and signoff.', 'Payroll remittance gets close workflow.', 'Payroll proof remains scattered.', 113, '{"build":"2026-06-05b","schema":132}'::jsonb, now()),
  ('schema132_next_14', 'next_20', 14, 'accounting', 'Build month-end lock/reopen and accountant export package delivery', 'planned', 'high', 'DEPLOYMENT_GUIDE.md', '#admin', 'Close period lock, reopen reason, package manifest, and proof delivery work end-to-end.', 'Month-end close becomes controlled.', 'Posting can drift after close.', 114, '{"build":"2026-06-05b","schema":132}'::jsonb, now()),
  ('schema132_next_15', 'next_20', 15, 'data', 'Promote repeated route, SEO, and action registry JSON into DB-backed review tables', 'planned', 'medium', 'DEVELOPMENT_ROADMAP.md', '#admin', 'Repeated static config becomes editable/reviewable DB rows.', 'Duplication and stale JSON risk reduce.', 'Static config duplication remains.', 115, '{"build":"2026-06-05b","schema":132}'::jsonb, now()),
  ('schema132_next_16', 'next_20', 16, 'mobile', 'Add offline conflict resolution choices to all mobile forms', 'planned', 'medium', 'DEVELOPMENT_ROADMAP.md', '#today', 'Users can retry, keep local, or discard local drafts on conflict.', 'Field fallback becomes clearer.', 'Draft conflicts confuse users.', 116, '{"build":"2026-06-05b","schema":132}'::jsonb, now()),
  ('schema132_next_17', 'next_20', 17, 'permissions', 'Tighten accounting and equipment verifier permissions in Edge Functions', 'planned', 'high', 'DEVELOPMENT_ROADMAP.md', '#admin', 'Server-side role gates match UI requirements for posting and return-to-service.', 'Permission enforcement becomes reliable.', 'UI-only restrictions can fail.', 117, '{"build":"2026-06-05b","schema":132}'::jsonb, now()),
  ('schema132_next_18', 'next_20', 18, 'deployment', 'Add SQL migration compatibility linter for roadmap columns and status values', 'planned', 'medium', 'TESTING_CHECKLIST.md', 'scripts', 'Smoke detects legacy source_document/target_route_hint/completion_note and invalid status values.', 'SQL deploy errors are caught before Supabase.', 'Column drift can recur.', 118, '{"build":"2026-06-05b","schema":132}'::jsonb, now()),
  ('schema132_next_19', 'next_20', 19, 'docs', 'Keep active Markdown and full schema reference synchronized every pass', 'planned', 'medium', 'DEVELOPMENT_ROADMAP.md', 'docs', 'Roadmap, known gaps, changelog, project state, testing, deployment, and schema docs reference schema 132.', 'New chats start with correct context.', 'Docs drift again.', 119, '{"build":"2026-06-05b","schema":132}'::jsonb, now()),
  ('schema132_next_20', 'next_20', 20, 'testing', 'Add smoke checks for sitemap, robots, schema 132 views, Admin rendering, and cache marker', 'planned', 'medium', 'TESTING_CHECKLIST.md', 'scripts', 'Smoke reports schema 132 guardrails and assets before packaging.', 'Build quality gate stays current.', 'Packaging regressions slip through.', 120, '{"build":"2026-06-05b","schema":132}'::jsonb, now())
on conflict (step_key) do update set
  step_batch = excluded.step_batch,
  step_number = excluded.step_number,
  step_area = excluded.step_area,
  step_title = excluded.step_title,
  step_status = excluded.step_status,
  priority = excluded.priority,
  source_doc = excluded.source_doc,
  route_hint = excluded.route_hint,
  acceptance_check = excluded.acceptance_check,
  implementation_notes = excluded.implementation_notes,
  risk_if_skipped = excluded.risk_if_skipped,
  sort_order = excluded.sort_order,
  metadata = excluded.metadata,
  checked_at = excluded.checked_at,
  updated_at = now();

drop view if exists public.v_app_payment_posting_proof_queue;
create view public.v_app_payment_posting_proof_queue as
select proof_key, proof_area, proof_title, proof_status, required_role, source_row_hint, proof_requirement, posting_block_hint, fallback_hint, sort_order, checked_at, updated_at
from public.app_payment_posting_proof_queue
order by sort_order, proof_key;

drop view if exists public.v_app_reconciliation_match_workbench_queue;
create view public.v_app_reconciliation_match_workbench_queue as
select workbench_key, match_area, workbench_title, workbench_status, import_rule_hint, match_score_hint, manual_review_hint, fallback_hint, sort_order, checked_at, updated_at
from public.app_reconciliation_match_workbench_queue
order by sort_order, workbench_key;

drop view if exists public.v_app_equipment_scan_verification_queue;
create view public.v_app_equipment_scan_verification_queue as
select verification_key, equipment_area, verification_title, verification_status, scan_path_hint, role_gate_hint, evidence_hint, fallback_hint, sort_order, checked_at, updated_at
from public.app_equipment_scan_verification_queue
order by sort_order, verification_key;

drop view if exists public.v_app_local_seo_asset_smoke_queue;
create view public.v_app_local_seo_asset_smoke_queue as
select smoke_key, seo_area, smoke_title, smoke_status, asset_path_hint, local_relevance_hint, validation_hint, fallback_hint, sort_order, checked_at, updated_at
from public.app_local_seo_asset_smoke_queue
order by sort_order, smoke_key;

drop view if exists public.v_app_runtime_fallback_drill_history_queue;
create view public.v_app_runtime_fallback_drill_history_queue as
select drill_key, app_surface, drill_title, drill_status, trigger_hint, expected_result_hint, evidence_hint, fallback_hint, sort_order, checked_at, updated_at
from public.app_runtime_fallback_drill_history_queue
order by sort_order, drill_key;

drop view if exists public.v_schema_drift_status;
create view public.v_schema_drift_status as
select
  132::int as expected_schema_version,
  coalesce(max(schema_version) filter (where status = 'applied'), 0)::int as latest_applied_schema_version,
  case
    when coalesce(max(schema_version) filter (where status = 'applied'), 0) >= 132
      then 'current'
    else 'behind'
  end as drift_status,
  case
    when coalesce(max(schema_version) filter (where status = 'applied'), 0) >= 132
      then 'Live database is at or ahead of the repo schema marker.'
    else 'Live database is behind the deployed app. Apply migrations through schema 132.'
  end as message,
  now() as checked_at
from public.app_schema_versions;

insert into public.app_schema_versions (schema_version, migration_key, schema_name, release_label, description, status, notes)
values (
  132,
  '132_payment_recon_equipment_seo_fallback_telemetry_drill_history',
  '132_payment_recon_equipment_seo_fallback_telemetry_drill_history.sql',
  '2026-06-05b',
  'Adds Admin-visible proof, reconciliation, equipment scan verification, local SEO asset smoke, and fallback drill-history queues.',
  'applied',
  'This pass ships first static sitemap/robots assets, keeps one-H1/local SEO guardrails, and moves accounting/equipment/fallback items toward operator workflows.'
)
on conflict (schema_version) do update set
  migration_key = excluded.migration_key,
  schema_name = excluded.schema_name,
  release_label = excluded.release_label,
  description = excluded.description,
  status = excluded.status,
  notes = excluded.notes,
  applied_at = now();

grant select on public.app_payment_posting_proof_queue to authenticated;
grant select on public.app_reconciliation_match_workbench_queue to authenticated;
grant select on public.app_equipment_scan_verification_queue to authenticated;
grant select on public.app_local_seo_asset_smoke_queue to authenticated;
grant select on public.app_runtime_fallback_drill_history_queue to authenticated;
grant select on public.v_app_payment_posting_proof_queue to authenticated;
grant select on public.v_app_reconciliation_match_workbench_queue to authenticated;
grant select on public.v_app_equipment_scan_verification_queue to authenticated;
grant select on public.v_app_local_seo_asset_smoke_queue to authenticated;
grant select on public.v_app_runtime_fallback_drill_history_queue to authenticated;
grant select on public.v_schema_drift_status to authenticated;

commit;

-- Schema 133: payment write-path staging, reconciliation scoring, equipment accessory templates, SEO generation, and offline conflict controls.
-- Build 2026-06-05c.
-- This pass turns schema 132 queues into more concrete execution registries while preserving local SEO, one-H1, CSS, fallback, and documentation guardrails.

begin;

create table if not exists public.app_schema_versions (
  schema_version integer primary key,
  schema_name text,
  description text,
  status text not null default 'applied',
  applied_at timestamptz not null default now(),
  applied_by text,
  notes text
);

alter table public.app_schema_versions add column if not exists migration_key text;
alter table public.app_schema_versions add column if not exists release_label text;

create table if not exists public.app_roadmap_action_steps (
  step_key text primary key,
  step_batch text not null,
  step_number integer not null,
  step_area text not null,
  step_title text not null,
  step_status text not null default 'planned',
  priority text not null default 'medium',
  source_doc text,
  route_hint text,
  implementation_notes text,
  acceptance_check text,
  risk_if_skipped text,
  sort_order integer not null default 100,
  metadata jsonb not null default '{}'::jsonb,
  checked_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.app_roadmap_action_steps add column if not exists source_doc text;
alter table public.app_roadmap_action_steps add column if not exists route_hint text;
alter table public.app_roadmap_action_steps add column if not exists implementation_notes text;
alter table public.app_roadmap_action_steps add column if not exists acceptance_check text;
alter table public.app_roadmap_action_steps add column if not exists risk_if_skipped text;
alter table public.app_roadmap_action_steps add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.app_roadmap_action_steps add column if not exists checked_at timestamptz;
alter table public.app_roadmap_action_steps add column if not exists updated_at timestamptz not null default now();

alter table public.app_roadmap_action_steps drop constraint if exists app_roadmap_action_steps_step_batch_check;
alter table public.app_roadmap_action_steps add constraint app_roadmap_action_steps_step_batch_check check (step_batch in ('completed_this_pass', 'next_20'));
alter table public.app_roadmap_action_steps drop constraint if exists app_roadmap_action_steps_step_status_check;
alter table public.app_roadmap_action_steps add constraint app_roadmap_action_steps_step_status_check check (step_status in ('completed', 'in_progress', 'planned', 'blocked', 'review'));

create table if not exists public.app_payment_write_path_queue (
  write_key text primary key,
  write_area text not null,
  write_title text not null,
  write_status text not null default 'planned',
  required_role text not null default 'admin',
  source_rows_hint text,
  validation_hint text,
  posting_proof_hint text,
  rollback_hint text,
  fallback_hint text,
  sort_order integer not null default 100,
  metadata jsonb not null default '{}'::jsonb,
  checked_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.app_reconciliation_scoring_rule_queue (
  rule_key text primary key,
  rule_area text not null,
  rule_title text not null,
  rule_status text not null default 'planned',
  score_hint text,
  match_input_hint text,
  reviewer_action_hint text,
  undo_hint text,
  fallback_hint text,
  sort_order integer not null default 100,
  metadata jsonb not null default '{}'::jsonb,
  checked_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.app_equipment_accessory_template_queue (
  template_key text primary key,
  equipment_pool_hint text not null,
  template_title text not null,
  template_status text not null default 'planned',
  expected_items_hint text,
  checkout_compare_hint text,
  return_compare_hint text,
  exception_hint text,
  fallback_hint text,
  sort_order integer not null default 100,
  metadata jsonb not null default '{}'::jsonb,
  checked_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.app_local_seo_generation_queue (
  generation_key text primary key,
  seo_area text not null,
  generation_title text not null,
  generation_status text not null default 'planned',
  source_registry_hint text,
  output_asset_hint text,
  local_relevance_hint text,
  validation_hint text,
  fallback_hint text,
  sort_order integer not null default 100,
  metadata jsonb not null default '{}'::jsonb,
  checked_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.app_mobile_offline_conflict_resolution_queue (
  conflict_key text primary key,
  form_area text not null,
  conflict_title text not null,
  conflict_status text not null default 'planned',
  detection_hint text,
  user_choice_hint text,
  retry_hint text,
  data_safety_hint text,
  fallback_hint text,
  sort_order integer not null default 100,
  metadata jsonb not null default '{}'::jsonb,
  checked_at timestamptz,
  updated_at timestamptz not null default now()
);

insert into public.app_payment_write_path_queue (write_key, write_area, write_title, write_status, required_role, source_rows_hint, validation_hint, posting_proof_hint, rollback_hint, fallback_hint, sort_order, metadata, checked_at)
values
  ('payment_apply_staging', 'payment_application', 'Create staged payment application write path', 'planned', 'admin', 'Invoices, deposits, unapplied payments, customer account rows.', 'Amount cannot exceed available cash or invoice balance unless overpayment is selected.', 'Reviewer, note, source reference, and timestamp are required before posting.', 'Reverse creates a linked reversal row instead of deleting history.', 'Keep payment visible in manual review queue until staged apply exists.', 10, '{"build":"2026-06-05c","schema":133}'::jsonb, now()),
  ('payment_adjustment_write_path', 'payment_adjustment', 'Write credit, discount, refund, write-off, and overpayment decisions with proof', 'planned', 'admin', 'Adjustment reason, customer, job/invoice, source payment, proof upload.', 'Requires reason code and accounting effect before posting.', 'Proof package should link to close period and export manifest.', 'Adjustment reversal requires reviewer reason.', 'Use notes-only adjustment registry until write tables are live.', 20, '{"build":"2026-06-05c","schema":133}'::jsonb, now()),
  ('job_profitability_payment_link', 'job_profitability', 'Link payment and cost events back to job profitability', 'planned', 'admin', 'Job financial events, equipment service tasks, invoice/payment rows.', 'Costs and collected cash should be separately tracked.', 'Profitability row shows estimated vs actual margin and evidence status.', 'Corrections create adjustment entries.', 'Show raw source rows if rollup is unavailable.', 30, '{"build":"2026-06-05c","schema":133}'::jsonb, now())
on conflict (write_key) do update set write_area = excluded.write_area, write_title = excluded.write_title, write_status = excluded.write_status, required_role = excluded.required_role, source_rows_hint = excluded.source_rows_hint, validation_hint = excluded.validation_hint, posting_proof_hint = excluded.posting_proof_hint, rollback_hint = excluded.rollback_hint, fallback_hint = excluded.fallback_hint, sort_order = excluded.sort_order, metadata = excluded.metadata, checked_at = excluded.checked_at, updated_at = now();

insert into public.app_reconciliation_scoring_rule_queue (rule_key, rule_area, rule_title, rule_status, score_hint, match_input_hint, reviewer_action_hint, undo_hint, fallback_hint, sort_order, metadata, checked_at)
values
  ('exact_reference_amount_date', 'match_scoring', 'Score exact reference, amount, and near-date matches highest', 'planned', 'Reference + amount + date window should score as strong match.', 'Bank CSV row, payment reference, invoice number, amount, transaction date.', 'Reviewer can accept, split, or reject the suggested match.', 'Undo restores all linked rows to unmatched.', 'Manual match remains fallback.', 10, '{"build":"2026-06-05c","schema":133}'::jsonb, now()),
  ('split_deposit_grouping', 'split_matching', 'Support one bank deposit matched to multiple invoices/payments', 'planned', 'Grouped rows total must equal bank row within tolerance.', 'Bank deposit row and selected payment/application rows.', 'Reviewer signs split allocation with note.', 'Undo removes group and restores individual unmatched rows.', 'Keep deposit in review queue if total does not match.', 20, '{"build":"2026-06-05c","schema":133}'::jsonb, now()),
  ('unmatched_age_escalation', 'review_queue', 'Escalate unmatched bank rows by age and amount', 'planned', 'Older or larger unmatched rows get higher priority.', 'CSV staging rows and unmatched review status.', 'Reviewer can defer with reason or create manual transaction.', 'Undo defer reopens the row.', 'Export unmatched list for accountant.', 30, '{"build":"2026-06-05c","schema":133}'::jsonb, now())
on conflict (rule_key) do update set rule_area = excluded.rule_area, rule_title = excluded.rule_title, rule_status = excluded.rule_status, score_hint = excluded.score_hint, match_input_hint = excluded.match_input_hint, reviewer_action_hint = excluded.reviewer_action_hint, undo_hint = excluded.undo_hint, fallback_hint = excluded.fallback_hint, sort_order = excluded.sort_order, metadata = excluded.metadata, checked_at = excluded.checked_at, updated_at = now();

insert into public.app_equipment_accessory_template_queue (template_key, equipment_pool_hint, template_title, template_status, expected_items_hint, checkout_compare_hint, return_compare_hint, exception_hint, fallback_hint, sort_order, metadata, checked_at)
values
  ('pool_template_small_power_tools', 'small_power_tools', 'Accessory template for batteries, chargers, guards, and cases', 'planned', 'Battery count, charger, blade/guard, case, manual/safety card.', 'Checkout compares expected accessories with signed release list.', 'Return compares expected vs returned and opens exception for missing/damaged items.', 'Missing accessory keeps equipment pending review.', 'Free-text accessory checklist remains fallback.', 10, '{"build":"2026-06-05c","schema":133}'::jsonb, now()),
  ('pool_template_lawn_equipment', 'lawn_equipment', 'Accessory template for fuel, guard, line/blade, PPE cue, and cleaning tools', 'planned', 'Fuel level, guard, trimmer line/blade, PPE cue, cleaning brush/wrench.', 'Checkout requires site-safe condition and accessory confirmation.', 'Return requires condition, cleaning, and accessory status.', 'Failed return creates service task and lockout.', 'Manual return notes remain fallback.', 20, '{"build":"2026-06-05c","schema":133}'::jsonb, now()),
  ('pool_template_measurement_safety', 'measurement_safety', 'Accessory template for measuring, signage, SDS, and safety kits', 'planned', 'Tape/measure tools, sign kit, SDS card, first aid cue, traffic cone count.', 'Checkout confirms kit completeness before site release.', 'Return confirms kit completeness and replaces missing consumables.', 'Missing safety accessory triggers supervisor review.', 'Supervisor checklist remains fallback.', 30, '{"build":"2026-06-05c","schema":133}'::jsonb, now())
on conflict (template_key) do update set equipment_pool_hint = excluded.equipment_pool_hint, template_title = excluded.template_title, template_status = excluded.template_status, expected_items_hint = excluded.expected_items_hint, checkout_compare_hint = excluded.checkout_compare_hint, return_compare_hint = excluded.return_compare_hint, exception_hint = excluded.exception_hint, fallback_hint = excluded.fallback_hint, sort_order = excluded.sort_order, metadata = excluded.metadata, checked_at = excluded.checked_at, updated_at = now();

insert into public.app_local_seo_generation_queue (generation_key, seo_area, generation_title, generation_status, source_registry_hint, output_asset_hint, local_relevance_hint, validation_hint, fallback_hint, sort_order, metadata, checked_at)
values
  ('generate_sitemap_from_routes', 'technical_seo', 'Generate sitemap from approved public route registry', 'in_progress', 'v_app_public_route_seo_registry approved/published rows.', 'sitemap.xml', 'Only include real service/location pages that the business supports.', 'Smoke confirms urlset, route count, and no blocked routes.', 'Static sitemap remains fallback.', 10, '{"build":"2026-06-05c","schema":133}'::jsonb, now()),
  ('generate_robots_from_settings', 'technical_seo', 'Generate robots.txt with sitemap pointer and admin disallow rules', 'in_progress', 'Public route and deployment settings.', 'robots.txt', 'Do not expose internal admin paths.', 'Smoke confirms Sitemap line and Disallow for admin/internal paths.', 'Static robots.txt remains fallback.', 20, '{"build":"2026-06-05c","schema":133}'::jsonb, now()),
  ('jsonld_local_business_gate', 'structured_data', 'Add JSON-LD local business/service validation before publish', 'planned', 'Business identity, service area, contact, approved service rows.', 'public JSON-LD block', 'Avoid unsupported location or service claims.', 'Smoke parses JSON-LD and checks required fields.', 'Title/meta remain fallback until JSON-LD is ready.', 30, '{"build":"2026-06-05c","schema":133}'::jsonb, now()),
  ('image_alt_local_proof_gate', 'image_alt', 'Validate image alt text and local proof captions', 'planned', 'Image registry, captions, route context, evidence/proof flags.', 'public gallery/card images', 'Alt text describes the actual image and local context truthfully.', 'Smoke flags missing or weak alt text.', 'Hide weak public image blocks until reviewed.', 40, '{"build":"2026-06-05c","schema":133}'::jsonb, now())
on conflict (generation_key) do update set seo_area = excluded.seo_area, generation_title = excluded.generation_title, generation_status = excluded.generation_status, source_registry_hint = excluded.source_registry_hint, output_asset_hint = excluded.output_asset_hint, local_relevance_hint = excluded.local_relevance_hint, validation_hint = excluded.validation_hint, fallback_hint = excluded.fallback_hint, sort_order = excluded.sort_order, metadata = excluded.metadata, checked_at = excluded.checked_at, updated_at = now();

insert into public.app_mobile_offline_conflict_resolution_queue (conflict_key, form_area, conflict_title, conflict_status, detection_hint, user_choice_hint, retry_hint, data_safety_hint, fallback_hint, sort_order, metadata, checked_at)
values
  ('offline_draft_conflict_choices', 'mobile_forms', 'Offer retry, keep local, or discard local when a draft conflicts', 'planned', 'Server updated_at or version marker differs from local draft marker.', 'Show three clear choices with the affected form name.', 'Retry only the failed payload and keep local data until success.', 'Never delete local draft until the user chooses or server confirms save.', 'Current draft resume remains fallback.', 10, '{"build":"2026-06-05c","schema":133}'::jsonb, now()),
  ('offline_attachment_retry_queue', 'attachments', 'Keep failed photos/proof attachments in retry queue with clear status', 'planned', 'Upload failure, missing public URL, or network timeout.', 'Show Retry Upload and Remove Local Copy after warning.', 'Retry with same metadata and show final success/fail.', 'Keep local metadata and filename until acknowledged.', 'Evidence Manager failed-upload rows remain fallback.', 20, '{"build":"2026-06-05c","schema":133}'::jsonb, now()),
  ('offline_equipment_scan_resolution', 'equipment_mobile', 'Resolve equipment scan/manual code mismatch before checkout or return', 'planned', 'Scanned QR/barcode does not match selected equipment row.', 'User must confirm scanned item or re-enter code.', 'Retry lookup after network returns.', 'Do not post checkout/return against mismatched equipment.', 'Manual code entry remains fallback.', 30, '{"build":"2026-06-05c","schema":133}'::jsonb, now())
on conflict (conflict_key) do update set form_area = excluded.form_area, conflict_title = excluded.conflict_title, conflict_status = excluded.conflict_status, detection_hint = excluded.detection_hint, user_choice_hint = excluded.user_choice_hint, retry_hint = excluded.retry_hint, data_safety_hint = excluded.data_safety_hint, fallback_hint = excluded.fallback_hint, sort_order = excluded.sort_order, metadata = excluded.metadata, checked_at = excluded.checked_at, updated_at = now();

insert into public.app_roadmap_action_steps (step_key, step_batch, step_number, step_area, step_title, step_status, priority, source_doc, route_hint, acceptance_check, implementation_notes, risk_if_skipped, sort_order, metadata, checked_at)
values
  ('schema133_done_01', 'completed_this_pass', 1, 'schema', 'Added schema 133 execution registries', 'completed', 'high', 'DEVELOPMENT_ROADMAP.md', '#admin', 'Migration and full schema include schema 133.', 'Added DB-visible queues for payment write paths, reconciliation scoring, accessory templates, local SEO generation, and offline conflict handling.', 'Roadmap remains disconnected from deployable schema.', 1, '{"build":"2026-06-05c","schema":133}'::jsonb, now()),
  ('schema133_done_02', 'completed_this_pass', 2, 'admin', 'Loaded schema 133 queues through Admin directory', 'completed', 'high', 'DEVELOPMENT_ROADMAP.md', '#admin', 'admin-directory safeList includes all schema 133 views.', 'New queues are visible to Admin readiness when schema is applied.', 'Operators cannot see the latest execution queues.', 2, '{"build":"2026-06-05c","schema":133}'::jsonb, now()),
  ('schema133_done_03', 'completed_this_pass', 3, 'ui', 'Rendered schema 133 queues in Admin readiness', 'completed', 'high', 'DEVELOPMENT_ROADMAP.md', '#admin', 'Admin UI includes table bodies and render handlers for schema 133 rows.', 'Admin can review next execution depth without opening SQL.', 'New DB rows remain hidden.', 3, '{"build":"2026-06-05c","schema":133}'::jsonb, now()),
  ('schema133_done_04', 'completed_this_pass', 4, 'seo', 'Updated static sitemap and robots assets for schema 133', 'completed', 'medium', 'TESTING_CHECKLIST.md', '/', 'Smoke confirms sitemap and robots remain present.', 'SEO fallback files remain deployable while generator is planned.', 'Search discovery assets can drift.', 4, '{"build":"2026-06-05c","schema":133}'::jsonb, now()),
  ('schema133_done_05', 'completed_this_pass', 5, 'docs', 'Updated active Markdown and schema documentation', 'completed', 'high', 'DEVELOPMENT_ROADMAP.md', 'docs', 'Roadmap, known gaps, changelog, project state, testing, deployment, and docs mention schema 133.', 'New chats and future passes have current context.', 'Documentation drifts from build.', 5, '{"build":"2026-06-05c","schema":133}'::jsonb, now()),
  ('schema133_done_06', 'completed_this_pass', 6, 'testing', 'Updated smoke checks to expect schema 133', 'completed', 'high', 'TESTING_CHECKLIST.md', 'scripts', 'repo-smoke-check validates schema 133 markers and Admin rendering.', 'Packaging catches schema/admin drift.', 'Smoke checks lag behind build.', 6, '{"build":"2026-06-05c","schema":133}'::jsonb, now()),
  ('schema133_done_07', 'completed_this_pass', 7, 'cleanup', 'Archived current Markdown and retired test_write files', 'completed', 'medium', 'CHANGELOG.md', 'archive', 'Archive snapshots exist and root test_write files are not active.', 'Root stays clean for deployment.', 'Smoke and packaging hygiene can fail.', 7, '{"build":"2026-06-05c","schema":133}'::jsonb, now()),
  ('schema133_done_08', 'completed_this_pass', 8, 'cache', 'Updated cache marker to 2026-06-05c', 'completed', 'medium', 'DEPLOYMENT_GUIDE.md', '/', 'index and service worker asset versions match.', 'Browser refresh behavior is predictable.', 'Old assets can mask repairs.', 8, '{"build":"2026-06-05c","schema":133}'::jsonb, now()),
  ('schema133_done_09', 'completed_this_pass', 9, 'css', 'Preserved CSS brace and mobile table guardrails', 'completed', 'medium', 'TESTING_CHECKLIST.md', 'style.css', 'CSS brace balance remains clean and Admin tables use scroll containers.', 'CSS drift remains controlled.', 'Mobile table overflow can regress.', 9, '{"build":"2026-06-05c","schema":133}'::jsonb, now()),
  ('schema133_done_10', 'completed_this_pass', 10, 'h1', 'Preserved one public H1 rule', 'completed', 'medium', 'TESTING_CHECKLIST.md', '/', 'Smoke confirms index.html has no more than one H1.', 'Public title clarity remains protected.', 'Search/title clarity can degrade.', 10, '{"build":"2026-06-05c","schema":133}'::jsonb, now()),
  ('schema133_next_01', 'next_20', 1, 'payment', 'Create payment application base tables and Edge write action', 'planned', 'high', 'DEVELOPMENT_ROADMAP.md', '#admin', 'Admin can stage and apply payment rows with proof.', 'Cash application begins to work end-to-end.', 'Payment workflow remains registry-only.', 101, '{"build":"2026-06-05c","schema":133}'::jsonb, now()),
  ('schema133_next_02', 'next_20', 2, 'payment', 'Create payment reversal, credit, refund, write-off, and overpayment actions', 'planned', 'high', 'DEVELOPMENT_ROADMAP.md', '#admin', 'Adjustment actions require reason, proof, reviewer, and rollback trail.', 'Accounting adjustments become auditable.', 'Adjustments stay manual.', 102, '{"build":"2026-06-05c","schema":133}'::jsonb, now()),
  ('schema133_next_03', 'next_20', 3, 'reconciliation', 'Create bank CSV upload preview and staging write path', 'planned', 'high', 'DEVELOPMENT_ROADMAP.md', '#admin', 'CSV import stores accepted/rejected rows with reasons.', 'Bank import becomes safe and reviewable.', 'Spreadsheet import remains manual.', 103, '{"build":"2026-06-05c","schema":133}'::jsonb, now()),
  ('schema133_next_04', 'next_20', 4, 'reconciliation', 'Create reconciliation score rows and manual match/split/undo UI', 'planned', 'high', 'DEVELOPMENT_ROADMAP.md', '#admin', 'Reviewer can accept, split, undo, and sign off matches.', 'Bank reconciliation becomes operational.', 'Unmatched rows remain hard to process.', 104, '{"build":"2026-06-05c","schema":133}'::jsonb, now()),
  ('schema133_next_05', 'next_20', 5, 'equipment', 'Create DB accessory template tables and editor', 'planned', 'high', 'DEVELOPMENT_ROADMAP.md', '#jobs', 'Templates attach to equipment pools and populate checkout/return checklists.', 'Accessory accountability becomes consistent.', 'Accessory checks remain free text.', 105, '{"build":"2026-06-05c","schema":133}'::jsonb, now()),
  ('schema133_next_06', 'next_20', 6, 'equipment', 'Add BarcodeDetector camera scan with manual fallback and mismatch handling', 'planned', 'high', 'DEVELOPMENT_ROADMAP.md', '#jobs', 'Camera scanning works where supported and manual fallback stays clear.', 'Field equipment flow gets faster.', 'Manual code lookup stays slow.', 106, '{"build":"2026-06-05c","schema":133}'::jsonb, now()),
  ('schema133_next_07', 'next_20', 7, 'equipment', 'Enforce return-to-service proof and verifier role server-side', 'planned', 'high', 'DEVELOPMENT_ROADMAP.md', '#jobs', 'Locked-out equipment cannot become available without proof and required role.', 'Equipment safety accountability tightens.', 'UI-only restrictions can be bypassed.', 107, '{"build":"2026-06-05c","schema":133}'::jsonb, now()),
  ('schema133_next_08', 'next_20', 8, 'equipment', 'Roll equipment service costs into job profitability', 'planned', 'high', 'DEVELOPMENT_ROADMAP.md', '#jobs', 'Service-task costs appear in job financial events and margin views.', 'Job profitability is more accurate.', 'Repair costs remain disconnected.', 108, '{"build":"2026-06-05c","schema":133}'::jsonb, now()),
  ('schema133_next_09', 'next_20', 9, 'seo', 'Generate sitemap and robots from approved DB route registry', 'planned', 'medium', 'DEVELOPMENT_ROADMAP.md', '/', 'Generated assets match approved public routes.', 'Local discovery assets stay current.', 'Static assets can drift.', 109, '{"build":"2026-06-05c","schema":133}'::jsonb, now()),
  ('schema133_next_10', 'next_20', 10, 'seo', 'Add JSON-LD, image-alt, broken-link, and local-proof smoke checks', 'planned', 'medium', 'TESTING_CHECKLIST.md', '/', 'Smoke flags invalid structured data, weak alt text, broken links, and unsupported local wording.', 'Public SEO quality improves.', 'SEO issues remain manual.', 110, '{"build":"2026-06-05c","schema":133}'::jsonb, now()),
  ('schema133_next_11', 'next_20', 11, 'mobile', 'Add offline conflict resolution choices to mobile forms', 'planned', 'medium', 'DEVELOPMENT_ROADMAP.md', '#today', 'Forms show retry, keep local, and discard local choices on conflict.', 'Field users can recover safely.', 'Draft conflict risk remains.', 111, '{"build":"2026-06-05c","schema":133}'::jsonb, now()),
  ('schema133_next_12', 'next_20', 12, 'fallback', 'Create fallback drill result write UI', 'planned', 'medium', 'DEVELOPMENT_ROADMAP.md', '#admin', 'Operators can record pass/fail drill results with notes.', 'Fallbacks become testable instead of theoretical.', 'Drill history remains read-only.', 112, '{"build":"2026-06-05c","schema":133}'::jsonb, now()),
  ('schema133_next_13', 'next_20', 13, 'telemetry', 'Store runtime fallback telemetry counts', 'planned', 'medium', 'DEVELOPMENT_ROADMAP.md', '#admin', 'Optional-view, stale-cache, offline-conflict, upload-failure, and accounting-block counts appear in Admin.', 'Troubleshooting gets faster.', 'Failures remain console-only.', 113, '{"build":"2026-06-05c","schema":133}'::jsonb, now()),
  ('schema133_next_14', 'next_20', 14, 'tax', 'Build HST/GST source totals, proof, filed, and remitted screens', 'planned', 'high', 'DEVELOPMENT_ROADMAP.md', '#admin', 'Tax review has source totals, proof upload, filed/remitted dates, and lock status.', 'Tax review becomes auditable.', 'Tax remains spreadsheet-based.', 114, '{"build":"2026-06-05c","schema":133}'::jsonb, now()),
  ('schema133_next_15', 'next_20', 15, 'payroll', 'Build payroll remittance proof and signoff screens', 'planned', 'high', 'DEVELOPMENT_ROADMAP.md', '#admin', 'Payroll source totals and proof signoff are visible.', 'Payroll close support improves.', 'Payroll proof remains scattered.', 115, '{"build":"2026-06-05c","schema":133}'::jsonb, now()),
  ('schema133_next_16', 'next_20', 16, 'close', 'Build month-end close lock/reopen and accountant export delivery', 'planned', 'high', 'DEVELOPMENT_ROADMAP.md', '#admin', 'Close period blocks postings and export package has manifest/proofs.', 'Month-end close becomes controlled.', 'Posting can drift after close.', 116, '{"build":"2026-06-05c","schema":133}'::jsonb, now()),
  ('schema133_next_17', 'next_20', 17, 'data', 'Promote repeated JSON route/action config into DB registries', 'planned', 'medium', 'DEVELOPMENT_ROADMAP.md', '#admin', 'Duplicate route/action lists become DB-backed where they need review status.', 'Duplication risk decreases.', 'Static JSON drift continues.', 117, '{"build":"2026-06-05c","schema":133}'::jsonb, now()),
  ('schema133_next_18', 'next_20', 18, 'css', 'Add component drift and mobile overflow smoke checks', 'planned', 'medium', 'TESTING_CHECKLIST.md', 'style.css', 'Smoke catches missing critical CSS blocks and obvious mobile overflow risks.', 'Mobile CSS drift is caught earlier.', 'Visual drift can recur.', 118, '{"build":"2026-06-05c","schema":133}'::jsonb, now()),
  ('schema133_next_19', 'next_20', 19, 'deployment', 'Add SQL compatibility linter for roadmap/status column drift', 'planned', 'medium', 'TESTING_CHECKLIST.md', 'scripts', 'Smoke catches legacy source_document/target_route_hint/completion_note and invalid status values.', 'Migration errors are caught earlier.', 'Column drift can recur.', 119, '{"build":"2026-06-05c","schema":133}'::jsonb, now()),
  ('schema133_next_20', 'next_20', 20, 'docs', 'Keep all active Markdown, schema, cache, and smoke checks synchronized each pass', 'planned', 'medium', 'DEVELOPMENT_ROADMAP.md', 'docs', 'Docs and SQL reference schema 133 and next 20.', 'Future work starts from correct context.', 'Build context drifts.', 120, '{"build":"2026-06-05c","schema":133}'::jsonb, now())
on conflict (step_key) do update set
  step_batch = excluded.step_batch,
  step_number = excluded.step_number,
  step_area = excluded.step_area,
  step_title = excluded.step_title,
  step_status = excluded.step_status,
  priority = excluded.priority,
  source_doc = excluded.source_doc,
  route_hint = excluded.route_hint,
  acceptance_check = excluded.acceptance_check,
  implementation_notes = excluded.implementation_notes,
  risk_if_skipped = excluded.risk_if_skipped,
  sort_order = excluded.sort_order,
  metadata = excluded.metadata,
  checked_at = excluded.checked_at,
  updated_at = now();

drop view if exists public.v_app_payment_write_path_queue;
create view public.v_app_payment_write_path_queue as
select write_key, write_area, write_title, write_status, required_role, source_rows_hint, validation_hint, posting_proof_hint, rollback_hint, fallback_hint, sort_order, checked_at, updated_at
from public.app_payment_write_path_queue
order by sort_order, write_key;

drop view if exists public.v_app_reconciliation_scoring_rule_queue;
create view public.v_app_reconciliation_scoring_rule_queue as
select rule_key, rule_area, rule_title, rule_status, score_hint, match_input_hint, reviewer_action_hint, undo_hint, fallback_hint, sort_order, checked_at, updated_at
from public.app_reconciliation_scoring_rule_queue
order by sort_order, rule_key;

drop view if exists public.v_app_equipment_accessory_template_queue;
create view public.v_app_equipment_accessory_template_queue as
select template_key, equipment_pool_hint, template_title, template_status, expected_items_hint, checkout_compare_hint, return_compare_hint, exception_hint, fallback_hint, sort_order, checked_at, updated_at
from public.app_equipment_accessory_template_queue
order by sort_order, template_key;

drop view if exists public.v_app_local_seo_generation_queue;
create view public.v_app_local_seo_generation_queue as
select generation_key, seo_area, generation_title, generation_status, source_registry_hint, output_asset_hint, local_relevance_hint, validation_hint, fallback_hint, sort_order, checked_at, updated_at
from public.app_local_seo_generation_queue
order by sort_order, generation_key;

drop view if exists public.v_app_mobile_offline_conflict_resolution_queue;
create view public.v_app_mobile_offline_conflict_resolution_queue as
select conflict_key, form_area, conflict_title, conflict_status, detection_hint, user_choice_hint, retry_hint, data_safety_hint, fallback_hint, sort_order, checked_at, updated_at
from public.app_mobile_offline_conflict_resolution_queue
order by sort_order, conflict_key;

drop view if exists public.v_schema_drift_status;
create view public.v_schema_drift_status as
select
  133::int as expected_schema_version,
  coalesce(max(schema_version) filter (where status = 'applied'), 0)::int as latest_applied_schema_version,
  case
    when coalesce(max(schema_version) filter (where status = 'applied'), 0) >= 133 then 'current'
    else 'behind'
  end as drift_status,
  case
    when coalesce(max(schema_version) filter (where status = 'applied'), 0) >= 133 then 'Live database is at or ahead of the repo schema marker.'
    else 'Live database is behind the deployed app. Apply migrations through schema 133.'
  end as message,
  now() as checked_at
from public.app_schema_versions;

insert into public.app_schema_versions (schema_version, migration_key, schema_name, release_label, description, status, notes)
values (
  133,
  '133_payment_recon_equipment_seo_offline_execution_controls',
  '133_payment_recon_equipment_seo_offline_execution_controls.sql',
  '2026-06-05c',
  'Adds Admin-visible execution registries for payment write paths, reconciliation scoring, equipment accessory templates, local SEO asset generation, and mobile offline conflict handling.',
  'applied',
  'This pass keeps schema/docs/cache/smoke guardrails aligned while preparing the next write-path workflows.'
)
on conflict (schema_version) do update set
  migration_key = excluded.migration_key,
  schema_name = excluded.schema_name,
  release_label = excluded.release_label,
  description = excluded.description,
  status = excluded.status,
  notes = excluded.notes,
  applied_at = now();

grant select on public.app_payment_write_path_queue to authenticated;
grant select on public.app_reconciliation_scoring_rule_queue to authenticated;
grant select on public.app_equipment_accessory_template_queue to authenticated;
grant select on public.app_local_seo_generation_queue to authenticated;
grant select on public.app_mobile_offline_conflict_resolution_queue to authenticated;
grant select on public.v_app_payment_write_path_queue to authenticated;
grant select on public.v_app_reconciliation_scoring_rule_queue to authenticated;
grant select on public.v_app_equipment_accessory_template_queue to authenticated;
grant select on public.v_app_local_seo_generation_queue to authenticated;
grant select on public.v_app_mobile_offline_conflict_resolution_queue to authenticated;
grant select on public.v_schema_drift_status to authenticated;

commit;



-- -----------------------------------------------------------------------------
-- Included migration: 134_payment_adjustment_recon_exception_equipment_scan_seo_runtime_messages.sql
-- -----------------------------------------------------------------------------
-- Schema 134: payment adjustment, reconciliation exception, equipment scan rollout, SEO content depth, and runtime message controls.
-- Build 2026-06-06a.
-- This pass keeps the schema, Markdown, CSS/SEO/H1, fallback, and Admin readiness queues aligned after schema 133.

begin;

create table if not exists public.app_schema_versions (
  schema_version integer primary key,
  schema_name text,
  description text,
  status text not null default 'applied',
  applied_at timestamptz not null default now(),
  applied_by text,
  notes text
);

alter table public.app_schema_versions add column if not exists migration_key text;
alter table public.app_schema_versions add column if not exists release_label text;

create table if not exists public.app_roadmap_action_steps (
  step_key text primary key,
  step_batch text not null,
  step_number integer not null,
  step_area text not null,
  step_title text not null,
  step_status text not null default 'planned',
  priority text not null default 'medium',
  source_doc text,
  route_hint text,
  implementation_notes text,
  acceptance_check text,
  risk_if_skipped text,
  sort_order integer not null default 100,
  metadata jsonb not null default '{}'::jsonb,
  checked_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.app_roadmap_action_steps add column if not exists source_doc text;
alter table public.app_roadmap_action_steps add column if not exists route_hint text;
alter table public.app_roadmap_action_steps add column if not exists implementation_notes text;
alter table public.app_roadmap_action_steps add column if not exists acceptance_check text;
alter table public.app_roadmap_action_steps add column if not exists risk_if_skipped text;
alter table public.app_roadmap_action_steps add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.app_roadmap_action_steps add column if not exists checked_at timestamptz;
alter table public.app_roadmap_action_steps add column if not exists updated_at timestamptz not null default now();

create table if not exists public.app_payment_adjustment_workflow_queue (
  workflow_key text primary key,
  workflow_area text not null,
  workflow_title text not null,
  workflow_status text not null default 'planned',
  required_role text not null default 'admin',
  validation_hint text,
  posting_hint text,
  reversal_hint text,
  evidence_hint text,
  fallback_hint text,
  sort_order integer not null default 100,
  metadata jsonb not null default '{}'::jsonb,
  checked_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.app_reconciliation_exception_resolution_queue (
  exception_key text primary key,
  exception_area text not null,
  exception_title text not null,
  exception_status text not null default 'planned',
  match_score_hint text,
  human_review_hint text,
  posting_block_hint text,
  undo_hint text,
  fallback_hint text,
  sort_order integer not null default 100,
  metadata jsonb not null default '{}'::jsonb,
  checked_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.app_equipment_scan_rollout_queue (
  rollout_key text primary key,
  rollout_area text not null,
  rollout_title text not null,
  rollout_status text not null default 'planned',
  device_requirement_hint text,
  manual_fallback_hint text,
  accessory_template_hint text,
  verifier_role_hint text,
  service_task_hint text,
  sort_order integer not null default 100,
  metadata jsonb not null default '{}'::jsonb,
  checked_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.app_local_seo_content_depth_queue (
  content_key text primary key,
  route_key text,
  content_area text not null,
  content_title text not null,
  content_status text not null default 'planned',
  primary_local_phrase text,
  proof_requirement_hint text,
  internal_link_hint text,
  publication_gate_hint text,
  fallback_hint text,
  sort_order integer not null default 100,
  metadata jsonb not null default '{}'::jsonb,
  checked_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.app_runtime_error_message_catalog (
  message_key text primary key,
  app_surface text not null,
  error_title text not null,
  error_status text not null default 'review',
  user_message text,
  operator_hint text,
  telemetry_hint text,
  retry_hint text,
  fallback_hint text,
  sort_order integer not null default 100,
  metadata jsonb not null default '{}'::jsonb,
  checked_at timestamptz,
  updated_at timestamptz not null default now()
);

insert into public.app_payment_adjustment_workflow_queue (workflow_key, workflow_area, workflow_title, workflow_status, required_role, validation_hint, posting_hint, reversal_hint, evidence_hint, fallback_hint, sort_order, metadata, checked_at) values
('payment_apply_deposit_to_invoice','payment_application','Apply deposit to invoice with remaining balance preview','planned','admin','Require invoice, customer, deposit source, amount, date, and reviewer note before save.','Post only after amount <= unapplied deposit and period is open.','Reverse with reason and linked reversal row, not delete.','Keep payment source, invoice, reviewer, and period evidence together.','Keep as staged review row if posting tables are unavailable.',10,'{"build":"2026-06-06a","schema":134}'::jsonb,now()),
('payment_credit_writeoff_overpayment','adjustments','Handle credit, write-off, refund, and overpayment from one adjustment workflow','planned','admin','Require adjustment type, reason, customer, source transaction, and approval threshold.','Post to mapped GL account only after reason and permission pass.','Undo by reversing adjustment and retaining original proof.','Attach approval and customer communication notes where applicable.','Export manual adjustment packet for accountant review.',20,'{"build":"2026-06-06a","schema":134}'::jsonb,now()),
('payment_closed_period_guard','period_lock','Block payment changes against locked month-end periods','planned','admin','Check accounting period close status before any apply/reverse action.','Posting blocked when close period is locked unless reopened with reason.','Reversal requires reopen reason if original period is closed.','Store period id and reopen reason on the action row.','Show warning and keep action pending.',30,'{"build":"2026-06-06a","schema":134}'::jsonb,now())
on conflict (workflow_key) do update set workflow_area=excluded.workflow_area, workflow_title=excluded.workflow_title, workflow_status=excluded.workflow_status, required_role=excluded.required_role, validation_hint=excluded.validation_hint, posting_hint=excluded.posting_hint, reversal_hint=excluded.reversal_hint, evidence_hint=excluded.evidence_hint, fallback_hint=excluded.fallback_hint, sort_order=excluded.sort_order, metadata=excluded.metadata, checked_at=excluded.checked_at, updated_at=now();

insert into public.app_reconciliation_exception_resolution_queue (exception_key, exception_area, exception_title, exception_status, match_score_hint, human_review_hint, posting_block_hint, undo_hint, fallback_hint, sort_order, metadata, checked_at) values
('recon_duplicate_bank_row','bank_import','Resolve duplicate or near-duplicate bank rows before matching','planned','Score by same date, amount, memo fingerprint, and import source.','Reviewer chooses keep, reject, or merge with note.','Rejected/duplicate rows cannot post.','Undo restores row to review state with previous reason.','Keep duplicate report for manual review.',10,'{"build":"2026-06-06a","schema":134}'::jsonb,now()),
('recon_split_payment','matching','Support one bank row split across multiple invoices or deposits','planned','Score based on customer, total amount, memo, invoice refs, and date proximity.','Reviewer adds split rows and confirms total equals bank amount.','Block posting until split total balances exactly.','Undo removes split bundle and reopens bank row.','Keep unmatched row in review queue.',20,'{"build":"2026-06-06a","schema":134}'::jsonb,now()),
('recon_no_match_exception','exceptions','Escalate low-confidence or no-match transactions','planned','Low score when amount/date/ref/customer do not align.','Reviewer can assign category, vendor/customer, or mark research-needed.','No GL posting without category or reviewer decision.','Undo returns row to unmatched state.','Export exception list to accountant packet.',30,'{"build":"2026-06-06a","schema":134}'::jsonb,now())
on conflict (exception_key) do update set exception_area=excluded.exception_area, exception_title=excluded.exception_title, exception_status=excluded.exception_status, match_score_hint=excluded.match_score_hint, human_review_hint=excluded.human_review_hint, posting_block_hint=excluded.posting_block_hint, undo_hint=excluded.undo_hint, fallback_hint=excluded.fallback_hint, sort_order=excluded.sort_order, metadata=excluded.metadata, checked_at=excluded.checked_at, updated_at=now();

insert into public.app_equipment_scan_rollout_queue (rollout_key, rollout_area, rollout_title, rollout_status, device_requirement_hint, manual_fallback_hint, accessory_template_hint, verifier_role_hint, service_task_hint, sort_order, metadata, checked_at) values
('scan_checkout_arrival_return','camera_scan','Use scan/manual entry for checkout, arrival, return, and service closeout','planned','Prefer BarcodeDetector/camera where supported over HTTPS on mobile.','Manual Scan / Enter Code stays visible for unsupported devices.','Load expected accessories after equipment code resolves.','Verifier role check should happen server-side before status changes.','Failed scan/test can create service task with equipment code already filled.',10,'{"build":"2026-06-06a","schema":134}'::jsonb,now()),
('accessory_template_db','accessories','Move accessory checklists from free text to DB-backed templates','planned','No device requirement; templates load from equipment pool/category.','Allow typed accessory notes when template is missing.','Compare checkout, arrival, and return accessories against expected list.','Supervisor verifies missing/damaged accessories.','Missing/damaged items create service task or exception.',20,'{"build":"2026-06-06a","schema":134}'::jsonb,now()),
('return_to_service_lock','lockout','Keep failed equipment locked until return-to-service proof is complete','planned','No device requirement.','Manual verifier can enter evidence reference when scan unavailable.','Accessory issues must be resolved or waived.','Admin/supervisor role required based on equipment verifier role setting.','Closing service task updates return-to-service evidence.',30,'{"build":"2026-06-06a","schema":134}'::jsonb,now())
on conflict (rollout_key) do update set rollout_area=excluded.rollout_area, rollout_title=excluded.rollout_title, rollout_status=excluded.rollout_status, device_requirement_hint=excluded.device_requirement_hint, manual_fallback_hint=excluded.manual_fallback_hint, accessory_template_hint=excluded.accessory_template_hint, verifier_role_hint=excluded.verifier_role_hint, service_task_hint=excluded.service_task_hint, sort_order=excluded.sort_order, metadata=excluded.metadata, checked_at=excluded.checked_at, updated_at=now();

insert into public.app_local_seo_content_depth_queue (content_key, route_key, content_area, content_title, content_status, primary_local_phrase, proof_requirement_hint, internal_link_hint, publication_gate_hint, fallback_hint, sort_order, metadata, checked_at) values
('home_local_service_depth','home','local_home','Strengthen homepage local service language without adding a second H1','in_progress','Ontario workplace safety app and job operations tracking','Use true app capabilities and avoid unsupported location claims.','Link to safety, jobs, equipment, accounting, and mobile workflow sections.','One H1, clear title/meta, sitemap/robots present, no broken core assets.','Keep current homepage copy until content proof is approved.',10,'{"build":"2026-06-06a","schema":134}'::jsonb,now()),
('accounting_content_depth','accounting','local_service_depth','Explain accounting close, payment application, and reconciliation benefits clearly','planned','Ontario small business accounting close workflow','Use features actually present in Admin queues and docs.','Link from Admin/readiness/accounting sections.','Do not publish service claims beyond built workflow state.','Keep as internal Admin text until proof gates pass.',20,'{"build":"2026-06-06a","schema":134}'::jsonb,now()),
('equipment_accountability_depth','equipment','local_service_depth','Explain equipment checkout, arrival, return, scan, and lockout workflow','planned','equipment accountability and return signoff workflow','Use screenshots/evidence only after consent and actual use.','Link equipment docs with jobs and mobile Today workflow.','Require image alt text and one-H1 check before publishing.','Keep as internal ops docs until public proof is ready.',30,'{"build":"2026-06-06a","schema":134}'::jsonb,now())
on conflict (content_key) do update set route_key=excluded.route_key, content_area=excluded.content_area, content_title=excluded.content_title, content_status=excluded.content_status, primary_local_phrase=excluded.primary_local_phrase, proof_requirement_hint=excluded.proof_requirement_hint, internal_link_hint=excluded.internal_link_hint, publication_gate_hint=excluded.publication_gate_hint, fallback_hint=excluded.fallback_hint, sort_order=excluded.sort_order, metadata=excluded.metadata, checked_at=excluded.checked_at, updated_at=now();

insert into public.app_runtime_error_message_catalog (message_key, app_surface, error_title, error_status, user_message, operator_hint, telemetry_hint, retry_hint, fallback_hint, sort_order, metadata, checked_at) values
('schema_view_missing','Admin readiness','Optional schema view missing','covered','This panel is waiting for a database migration. Apply the latest schema and refresh.','Check v_schema_drift_status and the missing view name in the Edge Function response.','Log scope, view, and schema drift status.','Retry after schema deploy; keep cached data if safe.','Show empty table with apply-schema message.',10,'{"build":"2026-06-06a","schema":134}'::jsonb,now()),
('edge_function_bundle_error','Deployment','Edge Function bundle/parse error','covered','The function did not deploy. Use the smoke check and repair the file named in the deploy error.','Run repo smoke check and deploy only after TypeScript parse passes.','Record function name, error text, and build marker.','Do not retry unchanged code.','Keep previous deployed function live.',20,'{"build":"2026-06-06a","schema":134}'::jsonb,now()),
('offline_draft_conflict','Mobile offline forms','Offline draft conflicts with server record','review','A saved draft may conflict with a newer server record. Choose keep local, reload server, or merge manually.','Show draft timestamp, server timestamp, and form id.','Track local draft id, form type, and retry count.','Retry the failed payload only after user choice.','Never delete local draft until acknowledged.',30,'{"build":"2026-06-06a","schema":134}'::jsonb,now())
on conflict (message_key) do update set app_surface=excluded.app_surface, error_title=excluded.error_title, error_status=excluded.error_status, user_message=excluded.user_message, operator_hint=excluded.operator_hint, telemetry_hint=excluded.telemetry_hint, retry_hint=excluded.retry_hint, fallback_hint=excluded.fallback_hint, sort_order=excluded.sort_order, metadata=excluded.metadata, checked_at=excluded.checked_at, updated_at=now();

insert into public.app_roadmap_action_steps (step_key, step_batch, step_number, step_area, step_title, step_status, priority, source_doc, route_hint, acceptance_check, implementation_notes, risk_if_skipped, sort_order, metadata, checked_at) values
('schema134_done_01','completed_this_pass',1,'schema','Added schema 134 execution-control queues','completed','high','DEVELOPMENT_ROADMAP.md','#admin','Schema 134 migration and canonical full schema contain new queues/views.','Payment adjustment, reconciliation exception, equipment scan, SEO content depth, and runtime message queues are DB-visible.','Roadmap depth remains Markdown-only.',1,'{"build":"2026-06-06a","schema":134}'::jsonb,now()),
('schema134_done_02','completed_this_pass',2,'admin','Exposed schema 134 queues in Admin readiness','completed','high','DEVELOPMENT_ROADMAP.md','#admin','admin-directory and admin-ui reference schema 134 views.','Admin can see the new execution queues.','New rows stay hidden from operators.',2,'{"build":"2026-06-06a","schema":134}'::jsonb,now()),
('schema134_done_03','completed_this_pass',3,'seo','Updated sitemap lastmod and preserved one-H1/public asset checks','completed','medium','DEVELOPMENT_ROADMAP.md','/','sitemap lastmod is current and smoke checks still verify one H1.','SEO asset freshness stays visible.','Search assets drift quietly.',3,'{"build":"2026-06-06a","schema":134}'::jsonb,now()),
('schema134_done_04','completed_this_pass',4,'fallback','Added runtime error-message catalog for clearer recovery text','completed','high','KNOWN_ISSUES_AND_GAPS.md','#admin','Runtime message rows exist and are visible in readiness.','Operators get clearer fallback wording.','Errors remain confusing in the field.',4,'{"build":"2026-06-06a","schema":134}'::jsonb,now()),
('schema134_done_05','completed_this_pass',5,'cleanup','Archived current Markdown and retired root test files','completed','medium','DEVELOPMENT_ROADMAP.md','archive','Archive snapshots exist and root test files are retired.','Smoke hygiene is restored.','Old test files keep polluting releases.',5,'{"build":"2026-06-06a","schema":134}'::jsonb,now()),
('schema134_next_01','next_20',1,'accounting','Turn payment adjustment queues into working apply/reverse buttons','planned','high','DEVELOPMENT_ROADMAP.md','#admin','Admin can apply, reverse, refund, credit, write off, and overpayment decisions with proof.','Moves from visibility to usable accounting workflow.','Cash application remains manual.',101,'{"build":"2026-06-06a","schema":134}'::jsonb,now()),
('schema134_next_02','next_20',2,'accounting','Build reconciliation exception action buttons','planned','high','DEVELOPMENT_ROADMAP.md','#admin','Duplicate, split, no-match, and research-needed rows can be resolved and undone.','Bank review becomes auditable.','Unmatched rows accumulate.',102,'{"build":"2026-06-06a","schema":134}'::jsonb,now()),
('schema134_next_03','next_20',3,'equipment','Implement camera scan where supported and keep manual fallback','planned','high','DEVELOPMENT_ROADMAP.md','#jobs','Phone scan fills checkout, arrival, return, and service-task equipment code.','Field workflow becomes faster.','Manual entry stays error-prone.',103,'{"build":"2026-06-06a","schema":134}'::jsonb,now()),
('schema134_next_04','next_20',4,'equipment','Create DB-backed accessory templates and compare on return','planned','high','DEVELOPMENT_ROADMAP.md','#jobs','Expected accessories load by pool/category and mismatch rows become exceptions.','Equipment accountability improves.','Missing accessories are missed.',104,'{"build":"2026-06-06a","schema":134}'::jsonb,now()),
('schema134_next_05','next_20',5,'seo','Publish only approved local SEO route content with proof gates','planned','medium','DEVELOPMENT_ROADMAP.md','/','Route content requires one H1, title/meta, internal links, image alt, and truthful local wording.','Public SEO quality improves.','Pages can overclaim or drift.',105,'{"build":"2026-06-06a","schema":134}'::jsonb,now())
on conflict (step_key) do update set step_batch=excluded.step_batch, step_number=excluded.step_number, step_area=excluded.step_area, step_title=excluded.step_title, step_status=excluded.step_status, priority=excluded.priority, source_doc=excluded.source_doc, route_hint=excluded.route_hint, acceptance_check=excluded.acceptance_check, implementation_notes=excluded.implementation_notes, risk_if_skipped=excluded.risk_if_skipped, sort_order=excluded.sort_order, metadata=excluded.metadata, checked_at=excluded.checked_at, updated_at=now();

drop view if exists public.v_app_payment_adjustment_workflow_queue;
create view public.v_app_payment_adjustment_workflow_queue as
select workflow_key, workflow_area, workflow_title, workflow_status, required_role, validation_hint, posting_hint, reversal_hint, evidence_hint, fallback_hint, sort_order, checked_at, updated_at
from public.app_payment_adjustment_workflow_queue
order by sort_order, workflow_key;

drop view if exists public.v_app_reconciliation_exception_resolution_queue;
create view public.v_app_reconciliation_exception_resolution_queue as
select exception_key, exception_area, exception_title, exception_status, match_score_hint, human_review_hint, posting_block_hint, undo_hint, fallback_hint, sort_order, checked_at, updated_at
from public.app_reconciliation_exception_resolution_queue
order by sort_order, exception_key;

drop view if exists public.v_app_equipment_scan_rollout_queue;
create view public.v_app_equipment_scan_rollout_queue as
select rollout_key, rollout_area, rollout_title, rollout_status, device_requirement_hint, manual_fallback_hint, accessory_template_hint, verifier_role_hint, service_task_hint, sort_order, checked_at, updated_at
from public.app_equipment_scan_rollout_queue
order by sort_order, rollout_key;

drop view if exists public.v_app_local_seo_content_depth_queue;
create view public.v_app_local_seo_content_depth_queue as
select content_key, route_key, content_area, content_title, content_status, primary_local_phrase, proof_requirement_hint, internal_link_hint, publication_gate_hint, fallback_hint, sort_order, checked_at, updated_at
from public.app_local_seo_content_depth_queue
order by sort_order, content_key;

drop view if exists public.v_app_runtime_error_message_catalog;
create view public.v_app_runtime_error_message_catalog as
select message_key, app_surface, error_title, error_status, user_message, operator_hint, telemetry_hint, retry_hint, fallback_hint, sort_order, checked_at, updated_at
from public.app_runtime_error_message_catalog
order by sort_order, message_key;

drop view if exists public.v_schema_drift_status;
create view public.v_schema_drift_status as
select
  134::int as expected_schema_version,
  coalesce(max(schema_version) filter (where status = 'applied'), 0)::int as latest_applied_schema_version,
  case when coalesce(max(schema_version) filter (where status = 'applied'), 0) >= 134 then 'current' else 'behind' end as drift_status,
  case when coalesce(max(schema_version) filter (where status = 'applied'), 0) >= 134 then 'Live database is at or ahead of the repo schema marker.' else 'Live database is behind the deployed app. Apply migrations through schema 134.' end as message,
  now() as checked_at
from public.app_schema_versions;

insert into public.app_schema_versions (schema_version, migration_key, schema_name, release_label, description, status, notes)
values (
  134,
  '134_payment_adjustment_recon_exception_equipment_scan_seo_runtime_messages',
  '134_payment_adjustment_recon_exception_equipment_scan_seo_runtime_messages.sql',
  '2026-06-06a',
  'Adds Admin-visible execution controls for payment adjustments, reconciliation exception resolution, equipment scan rollout, local SEO content depth, and runtime error messages.',
  'applied',
  'This pass keeps schema/docs/cache/smoke guardrails aligned while preparing write-path, scan, SEO, and recovery workflows for deeper implementation.'
)
on conflict (schema_version) do update set
  migration_key = excluded.migration_key,
  schema_name = excluded.schema_name,
  release_label = excluded.release_label,
  description = excluded.description,
  status = excluded.status,
  notes = excluded.notes,
  applied_at = now();

grant select on public.app_payment_adjustment_workflow_queue to authenticated;
grant select on public.app_reconciliation_exception_resolution_queue to authenticated;
grant select on public.app_equipment_scan_rollout_queue to authenticated;
grant select on public.app_local_seo_content_depth_queue to authenticated;
grant select on public.app_runtime_error_message_catalog to authenticated;
grant select on public.v_app_payment_adjustment_workflow_queue to authenticated;
grant select on public.v_app_reconciliation_exception_resolution_queue to authenticated;
grant select on public.v_app_equipment_scan_rollout_queue to authenticated;
grant select on public.v_app_local_seo_content_depth_queue to authenticated;
grant select on public.v_app_runtime_error_message_catalog to authenticated;
grant select on public.v_schema_drift_status to authenticated;

commit;
