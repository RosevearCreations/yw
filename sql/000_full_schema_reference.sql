-- Last synchronized: April 10, 2026. Reviewed during the receipt rollups, work-order operational status, posted/open amount visibility, and admin workflow sync pass.
-- Current reference includes migrations through 064_receipt_rollups_work_order_operational_status_and_posted_amounts.sql and documents DB-enforced totals, posting rollups, receiving-cost linkage, packet closeout, and operational rollup visibility.

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
  e.serial_number,
  e.asset_tag,
  j.job_code,
  j.job_name,
  jsonb_array_length(coalesce(s.checkout_photos_json, '[]'::jsonb)) as checkout_photo_count,
  jsonb_array_length(coalesce(s.return_photos_json, '[]'::jsonb)) as return_photo_count
from public.equipment_signouts s
left join public.equipment_items e on e.id = s.equipment_item_id
left join public.jobs j on j.id = s.job_id;


create or replace view public.v_equipment_inspection_history as
select
  h.*,
  e.equipment_code,
  e.equipment_name,
  p.full_name as inspector_name
from public.equipment_inspection_history h
left join public.equipment_items e on e.id = h.equipment_item_id
left join public.profiles p on p.id = h.inspected_by_profile_id;

create or replace view public.v_equipment_maintenance_history as
select
  h.*,
  e.equipment_code,
  e.equipment_name,
  p.full_name as performed_by_name
from public.equipment_maintenance_history h
left join public.equipment_items e on e.id = h.equipment_item_id
left join public.profiles p on p.id = h.performed_by_profile_id;

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
  n.email_provider,
  n.email_attempt_count,
  n.email_last_attempt_at,
  n.email_error,
  n.sms_provider,
  n.sms_attempt_count,
  n.sms_last_attempt_at,
  n.dead_lettered_at,
  n.dead_letter_reason,
  n.created_by_profile_id
from public.admin_notifications n;


create unique index if not exists idx_profiles_username_unique
  on public.profiles (lower(username))
  where username is not null and btrim(username) <> '';

create index if not exists idx_account_recovery_requests_created_at
  on public.account_recovery_requests(created_at desc);

create index if not exists idx_account_recovery_requests_profile
  on public.account_recovery_requests(matched_profile_id, created_at desc);


-- 2026-03-28 login stability and compatibility pass
-- No structural schema changes were introduced in this pass.
-- This snapshot remains aligned with migration 055 and the current runtime/auth compatibility updates.

-- 2026-03-29 conflict-aware replay, diagnostics detail, and evidence bulk-actions pass
-- Conflict-aware action outbox replay/merge.
-- Diagnostics banner now shows validation detail arrays.
-- Smoke check now verifies diagnostics banner is empty after clean boot.
-- Equipment evidence gallery now supports bulk select/delete and clearer replace progress messaging.


-- 2026-04-03 admin password reset and sales/accounting stub pass
create table if not exists public.admin_password_resets (
  id bigserial primary key,
  target_profile_id uuid not null references public.profiles(id) on delete cascade,
  reset_by_profile_id uuid references public.profiles(id) on delete set null,
  reason text,
  force_password_change boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_admin_password_resets_target_created
  on public.admin_password_resets(target_profile_id, created_at desc);

create table if not exists public.sales_orders (
  id bigserial primary key,
  order_code text not null unique,
  customer_name text,
  customer_email text,
  order_status text not null default 'draft',
  currency_code text not null default 'CAD',
  subtotal_amount numeric(12,2) not null default 0,
  tax_amount numeric(12,2) not null default 0,
  total_amount numeric(12,2) not null default 0,
  notes text,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.accounting_entries (
  id bigserial primary key,
  source_type text not null,
  source_id bigint,
  entry_type text not null,
  entry_status text not null default 'open',
  customer_name text,
  customer_email text,
  currency_code text not null default 'CAD',
  subtotal_amount numeric(12,2) not null default 0,
  tax_amount numeric(12,2) not null default 0,
  total_amount numeric(12,2) not null default 0,
  payload jsonb not null default '{}'::jsonb,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace view public.v_sales_order_accounting_summary as
select
  so.id,
  so.order_code,
  so.customer_name,
  so.customer_email,
  so.order_status,
  so.currency_code,
  so.subtotal_amount,
  so.tax_amount,
  so.total_amount,
  so.created_at,
  so.updated_at,
  ae.id as accounting_entry_id,
  ae.entry_type,
  ae.entry_status,
  ae.payload as accounting_payload,
  ae.created_at as accounting_created_at
from public.sales_orders so
left join public.accounting_entries ae
  on ae.source_type = 'sales_order'
 and ae.source_id = so.id;
-- 061_estimates_work_orders_routes_materials_and_gl_foundation.sql
-- Note: the runnable migration file is adaptive and should be used on live databases so legacy jobs/sites foreign keys match the actual existing ID types.
-- Landscaping / project-work / subcontract dispatch / accounting foundation

create table if not exists public.units_of_measure (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  category text,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cost_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  category text,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  client_code text unique,
  legal_name text not null,
  display_name text,
  client_type text not null default 'customer',
  billing_email text,
  phone text,
  address_line1 text,
  address_line2 text,
  city text,
  province text,
  postal_code text,
  payment_terms_days integer not null default 30,
  tax_registration_number text,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.client_sites (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  legacy_site_id uuid references public.sites(id) on delete set null,
  site_code text,
  site_name text not null,
  service_address text,
  city text,
  province text,
  postal_code text,
  latitude numeric(10,7),
  longitude numeric(10,7),
  access_notes text,
  hazard_notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_client_sites_client_id on public.client_sites(client_id);

create table if not exists public.service_areas (
  id uuid primary key default gen_random_uuid(),
  area_code text unique,
  name text not null,
  region text,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.routes (
  id uuid primary key default gen_random_uuid(),
  route_code text unique,
  name text not null,
  service_area_id uuid references public.service_areas(id) on delete set null,
  route_type text not null default 'recurring',
  day_of_week integer,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.route_stops (
  id uuid primary key default gen_random_uuid(),
  route_id uuid not null references public.routes(id) on delete cascade,
  client_site_id uuid references public.client_sites(id) on delete set null,
  stop_order integer not null default 0,
  planned_arrival_time time,
  planned_duration_minutes integer,
  instructions text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(route_id, stop_order)
);

create table if not exists public.materials_catalog (
  id uuid primary key default gen_random_uuid(),
  sku text unique,
  item_name text not null,
  material_category text,
  unit_id uuid references public.units_of_measure(id) on delete set null,
  default_unit_cost numeric(12,2) not null default 0,
  default_bill_rate numeric(12,2) not null default 0,
  taxable boolean not null default true,
  inventory_tracked boolean not null default true,
  reorder_point numeric(12,2),
  reorder_quantity numeric(12,2),
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.equipment_master (
  id uuid primary key default gen_random_uuid(),
  equipment_code text unique,
  item_name text not null,
  equipment_category text,
  manufacturer text,
  model text,
  ownership_type text not null default 'owned',
  bill_rate_hourly numeric(12,2) not null default 0,
  cost_rate_hourly numeric(12,2) not null default 0,
  default_operator_required boolean not null default false,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.estimates (
  id uuid primary key default gen_random_uuid(),
  estimate_number text not null unique,
  client_id uuid references public.clients(id) on delete set null,
  client_site_id uuid references public.client_sites(id) on delete set null,
  estimate_type text not null default 'landscaping',
  status text not null default 'draft',
  valid_until date,
  subtotal numeric(12,2) not null default 0,
  tax_total numeric(12,2) not null default 0,
  total_amount numeric(12,2) not null default 0,
  scope_notes text,
  terms_notes text,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.estimate_lines (
  id uuid primary key default gen_random_uuid(),
  estimate_id uuid not null references public.estimates(id) on delete cascade,
  line_order integer not null default 0,
  line_type text not null default 'service',
  description text not null,
  cost_code_id uuid references public.cost_codes(id) on delete set null,
  unit_id uuid references public.units_of_measure(id) on delete set null,
  quantity numeric(12,2) not null default 1,
  unit_cost numeric(12,2) not null default 0,
  unit_price numeric(12,2) not null default 0,
  line_total numeric(12,2) not null default 0,
  material_id uuid references public.materials_catalog(id) on delete set null,
  equipment_master_id uuid references public.equipment_master(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.work_orders (
  id uuid primary key default gen_random_uuid(),
  work_order_number text not null unique,
  estimate_id uuid references public.estimates(id) on delete set null,
  client_id uuid references public.clients(id) on delete set null,
  client_site_id uuid references public.client_sites(id) on delete set null,
  legacy_job_id uuid references public.jobs(id) on delete set null,
  work_type text not null default 'service',
  status text not null default 'draft',
  scheduled_start timestamptz,
  scheduled_end timestamptz,
  service_area_id uuid references public.service_areas(id) on delete set null,
  route_id uuid references public.routes(id) on delete set null,
  supervisor_profile_id uuid references public.profiles(id) on delete set null,
  crew_notes text,
  customer_notes text,
  safety_notes text,
  subtotal numeric(12,2) not null default 0,
  tax_total numeric(12,2) not null default 0,
  total_amount numeric(12,2) not null default 0,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.work_order_lines (
  id uuid primary key default gen_random_uuid(),
  work_order_id uuid not null references public.work_orders(id) on delete cascade,
  line_order integer not null default 0,
  line_type text not null default 'service',
  description text not null,
  cost_code_id uuid references public.cost_codes(id) on delete set null,
  unit_id uuid references public.units_of_measure(id) on delete set null,
  quantity numeric(12,2) not null default 1,
  unit_cost numeric(12,2) not null default 0,
  unit_price numeric(12,2) not null default 0,
  line_total numeric(12,2) not null default 0,
  material_id uuid references public.materials_catalog(id) on delete set null,
  equipment_master_id uuid references public.equipment_master(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.subcontract_clients (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.clients(id) on delete set null,
  subcontract_code text unique,
  company_name text not null,
  contact_name text,
  contact_email text,
  contact_phone text,
  billing_basis text not null default 'hourly',
  rate_notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.subcontract_dispatches (
  id uuid primary key default gen_random_uuid(),
  dispatch_number text not null unique,
  subcontract_client_id uuid not null references public.subcontract_clients(id) on delete cascade,
  client_site_id uuid references public.client_sites(id) on delete set null,
  work_order_id uuid references public.work_orders(id) on delete set null,
  operator_profile_id uuid references public.profiles(id) on delete set null,
  equipment_master_id uuid references public.equipment_master(id) on delete set null,
  dispatch_status text not null default 'draft',
  dispatch_start timestamptz,
  dispatch_end timestamptz,
  billing_basis text not null default 'hourly',
  bill_rate numeric(12,2) not null default 0,
  cost_rate numeric(12,2) not null default 0,
  notes text,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.chart_of_accounts (
  id uuid primary key default gen_random_uuid(),
  account_number text not null unique,
  account_name text not null,
  account_type text not null,
  parent_account_id uuid references public.chart_of_accounts(id) on delete set null,
  is_active boolean not null default true,
  system_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.gl_journal_batches (
  id uuid primary key default gen_random_uuid(),
  batch_number text not null unique,
  source_module text not null,
  batch_status text not null default 'draft',
  batch_date date not null default current_date,
  memo text,
  posted_at timestamptz,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.gl_journal_entries (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.gl_journal_batches(id) on delete cascade,
  entry_date date not null default current_date,
  account_id uuid not null references public.chart_of_accounts(id) on delete restrict,
  debit_amount numeric(12,2) not null default 0,
  credit_amount numeric(12,2) not null default 0,
  client_id uuid references public.clients(id) on delete set null,
  work_order_id uuid references public.work_orders(id) on delete set null,
  dispatch_id uuid references public.subcontract_dispatches(id) on delete set null,
  memo text,
  created_at timestamptz not null default now(),
  check (debit_amount >= 0 and credit_amount >= 0),
  check ((debit_amount = 0 and credit_amount > 0) or (credit_amount = 0 and debit_amount > 0))
);

create table if not exists public.ar_invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_number text not null unique,
  client_id uuid not null references public.clients(id) on delete restrict,
  work_order_id uuid references public.work_orders(id) on delete set null,
  dispatch_id uuid references public.subcontract_dispatches(id) on delete set null,
  invoice_status text not null default 'draft',
  invoice_date date not null default current_date,
  due_date date,
  subtotal numeric(12,2) not null default 0,
  tax_total numeric(12,2) not null default 0,
  total_amount numeric(12,2) not null default 0,
  balance_due numeric(12,2) not null default 0,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ar_payments (
  id uuid primary key default gen_random_uuid(),
  payment_number text not null unique,
  client_id uuid not null references public.clients(id) on delete restrict,
  invoice_id uuid references public.ar_invoices(id) on delete set null,
  payment_date date not null default current_date,
  payment_method text,
  reference_number text,
  amount numeric(12,2) not null default 0,
  notes text,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ap_vendors (
  id uuid primary key default gen_random_uuid(),
  vendor_code text unique,
  legal_name text not null,
  display_name text,
  contact_name text,
  contact_email text,
  contact_phone text,
  payment_terms_days integer not null default 30,
  tax_registration_number text,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ap_bills (
  id uuid primary key default gen_random_uuid(),
  bill_number text not null unique,
  vendor_id uuid not null references public.ap_vendors(id) on delete restrict,
  bill_status text not null default 'draft',
  bill_date date not null default current_date,
  due_date date,
  subtotal numeric(12,2) not null default 0,
  tax_total numeric(12,2) not null default 0,
  total_amount numeric(12,2) not null default 0,
  balance_due numeric(12,2) not null default 0,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ap_payments (
  id uuid primary key default gen_random_uuid(),
  payment_number text not null unique,
  vendor_id uuid not null references public.ap_vendors(id) on delete restrict,
  bill_id uuid references public.ap_bills(id) on delete set null,
  payment_date date not null default current_date,
  payment_method text,
  reference_number text,
  amount numeric(12,2) not null default 0,
  notes text,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.units_of_measure (code, name, category, sort_order)
values
  ('EA', 'Each', 'count', 10),
  ('HR', 'Hour', 'time', 20),
  ('DAY', 'Day', 'time', 30),
  ('M', 'Metre', 'length', 40),
  ('M2', 'Square metre', 'area', 50),
  ('M3', 'Cubic metre', 'volume', 60),
  ('L', 'Litre', 'volume', 70),
  ('KG', 'Kilogram', 'weight', 80)
on conflict (code) do nothing;

insert into public.cost_codes (code, name, category)
values
  ('LAB', 'Labour', 'direct_cost'),
  ('MAT', 'Materials', 'direct_cost'),
  ('EQP', 'Equipment', 'direct_cost'),
  ('SUB', 'Subcontract', 'direct_cost'),
  ('MOB', 'Mobilization', 'overhead'),
  ('SAFE', 'Safety / HSE', 'overhead')
on conflict (code) do nothing;

insert into public.chart_of_accounts (account_number, account_name, account_type, system_code)
values
  ('1000', 'Cash', 'asset', 'cash'),
  ('1100', 'Accounts Receivable', 'asset', 'ar'),
  ('1200', 'Inventory / Materials', 'asset', 'inventory'),
  ('1500', 'Equipment Assets', 'asset', 'equipment'),
  ('2000', 'Accounts Payable', 'liability', 'ap'),
  ('2100', 'Sales Tax Payable', 'liability', 'tax_payable'),
  ('3000', 'Owner Equity', 'equity', 'equity'),
  ('4000', 'Landscape Service Revenue', 'revenue', 'revenue_landscape'),
  ('4010', 'Project / Construction Revenue', 'revenue', 'revenue_project'),
  ('4020', 'Subcontract Dispatch Revenue', 'revenue', 'revenue_dispatch'),
  ('5000', 'Direct Labour Expense', 'expense', 'expense_labour'),
  ('5010', 'Materials Expense', 'expense', 'expense_materials'),
  ('5020', 'Equipment Operating Expense', 'expense', 'expense_equipment'),
  ('5030', 'Subcontract Expense', 'expense', 'expense_subcontract'),
  ('5100', 'Safety / Compliance Expense', 'expense', 'expense_safety')
on conflict (account_number) do nothing;


-- 062 deeper workflow polish
-- 062_deeper_workflow_polish_admin_foundation.sql
-- Deeper workflow polish on top of 061:
-- estimate/work-order lines, route stops, AR/AP payment posting,
-- purchase/material receiving, and linked HSE packets for work orders/dispatches.

create extension if not exists pgcrypto;

create table if not exists public.material_receipts (
  id uuid primary key default gen_random_uuid(),
  receipt_number text not null unique,
  vendor_id uuid references public.ap_vendors(id) on delete set null,
  client_site_id uuid references public.client_sites(id) on delete set null,
  work_order_id uuid references public.work_orders(id) on delete set null,
  receipt_status text not null default 'draft',
  receipt_date date not null default current_date,
  received_by_profile_id uuid references public.profiles(id) on delete set null,
  notes text,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.material_receipt_lines (
  id uuid primary key default gen_random_uuid(),
  receipt_id uuid not null references public.material_receipts(id) on delete cascade,
  line_order integer not null default 0,
  material_id uuid references public.materials_catalog(id) on delete set null,
  description text not null,
  unit_id uuid references public.units_of_measure(id) on delete set null,
  quantity numeric(12,2) not null default 0,
  unit_cost numeric(12,2) not null default 0,
  line_total numeric(12,2) not null default 0,
  cost_code_id uuid references public.cost_codes(id) on delete set null,
  work_order_line_id uuid references public.work_order_lines(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.linked_hse_packets (
  id uuid primary key default gen_random_uuid(),
  packet_number text not null unique,
  packet_type text not null default 'work_order',
  packet_status text not null default 'draft',
  work_order_id uuid references public.work_orders(id) on delete set null,
  dispatch_id uuid references public.subcontract_dispatches(id) on delete set null,
  client_site_id uuid references public.client_sites(id) on delete set null,
  route_id uuid references public.routes(id) on delete set null,
  supervisor_profile_id uuid references public.profiles(id) on delete set null,
  briefing_required boolean not null default true,
  inspection_required boolean not null default true,
  emergency_review_required boolean not null default false,
  completion_percent numeric(5,2) not null default 0,
  packet_notes text,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (packet_type in ('work_order','dispatch','standalone_hse')),
  check (completion_percent >= 0 and completion_percent <= 100)
);

create index if not exists idx_route_stops_route_id on public.route_stops(route_id);
create index if not exists idx_estimate_lines_estimate_id on public.estimate_lines(estimate_id);
create index if not exists idx_work_order_lines_work_order_id on public.work_order_lines(work_order_id);
create index if not exists idx_ar_payments_invoice_id on public.ar_payments(invoice_id);
create index if not exists idx_ap_payments_bill_id on public.ap_payments(bill_id);
create index if not exists idx_material_receipts_vendor_id on public.material_receipts(vendor_id);
create index if not exists idx_material_receipts_work_order_id on public.material_receipts(work_order_id);
create index if not exists idx_material_receipt_lines_receipt_id on public.material_receipt_lines(receipt_id);
create index if not exists idx_linked_hse_packets_work_order_id on public.linked_hse_packets(work_order_id);
create index if not exists idx_linked_hse_packets_dispatch_id on public.linked_hse_packets(dispatch_id);

insert into public.cost_codes (code, name, category)
values
  ('REC', 'Material Receiving', 'overhead'),
  ('WOH', 'Work Order HSE Packet', 'overhead'),
  ('DSH', 'Dispatch HSE Packet', 'overhead')
on conflict (code) do nothing;


-- 063 workflow rollups, posting, and HSE closeout
-- 063_workflow_rollups_posting_and_hse_closeout.sql

-- 063_workflow_rollups_posting_and_hse_closeout.sql
-- Workflow polish pass focused on database-enforced totals, payment posting,
-- receiving-to-costing flow, and linked HSE packet progress / closeout.

create extension if not exists pgcrypto;

alter table if exists public.work_order_lines
  add column if not exists actual_quantity_received numeric(12,2) not null default 0,
  add column if not exists actual_material_cost numeric(12,2) not null default 0;

alter table if exists public.work_orders
  add column if not exists actual_material_cost_total numeric(12,2) not null default 0;

alter table if exists public.linked_hse_packets
  add column if not exists briefing_completed boolean not null default false,
  add column if not exists inspection_completed boolean not null default false,
  add column if not exists emergency_review_completed boolean not null default false,
  add column if not exists ready_for_closeout_at timestamptz,
  add column if not exists closed_at timestamptz,
  add column if not exists closed_by_profile_id uuid references public.profiles(id) on delete set null,
  add column if not exists closeout_notes text;

create or replace function public.ywi_normalize_money(value numeric)
returns numeric
language sql
immutable
as $$
  select round(coalesce(value, 0)::numeric, 2)
$$;

create or replace function public.ywi_next_line_order(parent_table regclass, parent_column text, parent_id uuid, current_id uuid default null)
returns integer
language plpgsql
as $$
declare
  v_sql text;
  v_next integer;
begin
  if parent_id is null then
    return 10;
  end if;

  v_sql := format(
    'select coalesce(max(line_order), 0) + 10 from %s where %I = $1 and ($2 is null or id <> $2)',
    parent_table,
    parent_column
  );

  execute v_sql into v_next using parent_id, current_id;
  return coalesce(v_next, 10);
end;
$$;

create or replace function public.ywi_next_stop_order(route_id uuid, current_id uuid default null)
returns integer
language plpgsql
as $$
declare
  v_next integer;
begin
  if route_id is null then
    return 10;
  end if;

  select coalesce(max(stop_order), 0) + 10
    into v_next
  from public.route_stops
  where route_stops.route_id = ywi_next_stop_order.route_id
    and (current_id is null or id <> current_id);

  return coalesce(v_next, 10);
end;
$$;

create or replace function public.ywi_before_route_stop()
returns trigger
language plpgsql
as $$
begin
  if new.stop_order is null or new.stop_order <= 0 then
    new.stop_order := public.ywi_next_stop_order(new.route_id, new.id);
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_ywi_before_route_stop on public.route_stops;
create trigger trg_ywi_before_route_stop
before insert or update on public.route_stops
for each row execute function public.ywi_before_route_stop();

create or replace function public.ywi_before_estimate_line()
returns trigger
language plpgsql
as $$
begin
  if new.line_order is null or new.line_order <= 0 then
    new.line_order := public.ywi_next_line_order('public.estimate_lines'::regclass, 'estimate_id', new.estimate_id, new.id);
  end if;
  new.quantity := coalesce(new.quantity, 1);
  new.unit_cost := public.ywi_normalize_money(new.unit_cost);
  new.unit_price := public.ywi_normalize_money(new.unit_price);
  new.line_total := public.ywi_normalize_money(coalesce(new.quantity, 0) * coalesce(new.unit_price, 0));
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_ywi_before_estimate_line on public.estimate_lines;
create trigger trg_ywi_before_estimate_line
before insert or update on public.estimate_lines
for each row execute function public.ywi_before_estimate_line();

create or replace function public.ywi_before_work_order_line()
returns trigger
language plpgsql
as $$
begin
  if new.line_order is null or new.line_order <= 0 then
    new.line_order := public.ywi_next_line_order('public.work_order_lines'::regclass, 'work_order_id', new.work_order_id, new.id);
  end if;
  new.quantity := coalesce(new.quantity, 1);
  new.unit_cost := public.ywi_normalize_money(new.unit_cost);
  new.unit_price := public.ywi_normalize_money(new.unit_price);
  new.line_total := public.ywi_normalize_money(coalesce(new.quantity, 0) * coalesce(new.unit_price, 0));
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_ywi_before_work_order_line on public.work_order_lines;
create trigger trg_ywi_before_work_order_line
before insert or update on public.work_order_lines
for each row execute function public.ywi_before_work_order_line();

create or replace function public.ywi_before_material_receipt_line()
returns trigger
language plpgsql
as $$
begin
  if new.line_order is null or new.line_order <= 0 then
    new.line_order := public.ywi_next_line_order('public.material_receipt_lines'::regclass, 'receipt_id', new.receipt_id, new.id);
  end if;
  new.quantity := coalesce(new.quantity, 0);
  new.unit_cost := public.ywi_normalize_money(new.unit_cost);
  new.line_total := public.ywi_normalize_money(coalesce(new.quantity, 0) * coalesce(new.unit_cost, 0));
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_ywi_before_material_receipt_line on public.material_receipt_lines;
create trigger trg_ywi_before_material_receipt_line
before insert or update on public.material_receipt_lines
for each row execute function public.ywi_before_material_receipt_line();

create or replace function public.ywi_recalc_estimate_totals(p_estimate_id uuid)
returns void
language plpgsql
as $$
declare
  v_subtotal numeric := 0;
  v_tax numeric := 0;
begin
  if p_estimate_id is null then
    return;
  end if;

  select coalesce(sum(line_total), 0)
    into v_subtotal
  from public.estimate_lines
  where estimate_id = p_estimate_id;

  select coalesce(tax_total, 0)
    into v_tax
  from public.estimates
  where id = p_estimate_id;

  update public.estimates
  set subtotal = public.ywi_normalize_money(v_subtotal),
      total_amount = public.ywi_normalize_money(v_subtotal + v_tax),
      updated_at = now()
  where id = p_estimate_id;
end;
$$;

create or replace function public.ywi_recalc_work_order_totals(p_work_order_id uuid)
returns void
language plpgsql
as $$
declare
  v_subtotal numeric := 0;
  v_tax numeric := 0;
  v_actual_material_cost numeric := 0;
begin
  if p_work_order_id is null then
    return;
  end if;

  select coalesce(sum(line_total), 0), coalesce(sum(actual_material_cost), 0)
    into v_subtotal, v_actual_material_cost
  from public.work_order_lines
  where work_order_id = p_work_order_id;

  select coalesce(tax_total, 0)
    into v_tax
  from public.work_orders
  where id = p_work_order_id;

  update public.work_orders
  set subtotal = public.ywi_normalize_money(v_subtotal),
      total_amount = public.ywi_normalize_money(v_subtotal + v_tax),
      actual_material_cost_total = public.ywi_normalize_money(v_actual_material_cost),
      updated_at = now()
  where id = p_work_order_id;
end;
$$;

create or replace function public.ywi_after_estimate_line_recalc()
returns trigger
language plpgsql
as $$
begin
  if tg_op in ('INSERT', 'UPDATE') then
    perform public.ywi_recalc_estimate_totals(new.estimate_id);
  end if;
  if tg_op in ('UPDATE', 'DELETE') then
    perform public.ywi_recalc_estimate_totals(old.estimate_id);
  end if;
  return null;
end;
$$;

drop trigger if exists trg_ywi_after_estimate_line_recalc on public.estimate_lines;
create trigger trg_ywi_after_estimate_line_recalc
after insert or update or delete on public.estimate_lines
for each row execute function public.ywi_after_estimate_line_recalc();

create or replace function public.ywi_after_work_order_line_recalc()
returns trigger
language plpgsql
as $$
begin
  if tg_op in ('INSERT', 'UPDATE') then
    perform public.ywi_recalc_work_order_totals(new.work_order_id);
  end if;
  if tg_op in ('UPDATE', 'DELETE') then
    perform public.ywi_recalc_work_order_totals(old.work_order_id);
  end if;
  return null;
end;
$$;

drop trigger if exists trg_ywi_after_work_order_line_recalc on public.work_order_lines;
create trigger trg_ywi_after_work_order_line_recalc
after insert or update or delete on public.work_order_lines
for each row execute function public.ywi_after_work_order_line_recalc();

create or replace function public.ywi_sync_work_order_line_actuals(p_work_order_line_id uuid)
returns void
language plpgsql
as $$
declare
  v_work_order_id uuid;
  v_qty numeric := 0;
  v_cost numeric := 0;
begin
  if p_work_order_line_id is null then
    return;
  end if;

  select coalesce(sum(quantity), 0), coalesce(sum(line_total), 0)
    into v_qty, v_cost
  from public.material_receipt_lines
  where work_order_line_id = p_work_order_line_id;

  update public.work_order_lines
  set actual_quantity_received = public.ywi_normalize_money(v_qty),
      actual_material_cost = public.ywi_normalize_money(v_cost),
      updated_at = now()
  where id = p_work_order_line_id;

  select work_order_id into v_work_order_id
  from public.work_order_lines
  where id = p_work_order_line_id;

  perform public.ywi_recalc_work_order_totals(v_work_order_id);
end;
$$;

create or replace function public.ywi_after_material_receipt_line_sync()
returns trigger
language plpgsql
as $$
begin
  if tg_op in ('INSERT', 'UPDATE') then
    perform public.ywi_sync_work_order_line_actuals(new.work_order_line_id);
  end if;
  if tg_op in ('UPDATE', 'DELETE') then
    perform public.ywi_sync_work_order_line_actuals(old.work_order_line_id);
  end if;
  return null;
end;
$$;

drop trigger if exists trg_ywi_after_material_receipt_line_sync on public.material_receipt_lines;
create trigger trg_ywi_after_material_receipt_line_sync
after insert or update or delete on public.material_receipt_lines
for each row execute function public.ywi_after_material_receipt_line_sync();

create or replace function public.ywi_recalc_ar_invoice_balance(p_invoice_id uuid)
returns void
language plpgsql
as $$
declare
  v_total numeric := 0;
  v_paid numeric := 0;
  v_balance numeric := 0;
  v_status text;
begin
  if p_invoice_id is null then
    return;
  end if;

  select coalesce(total_amount, 0), invoice_status
    into v_total, v_status
  from public.ar_invoices
  where id = p_invoice_id;

  select coalesce(sum(amount), 0)
    into v_paid
  from public.ar_payments
  where invoice_id = p_invoice_id;

  v_balance := greatest(v_total - v_paid, 0);

  update public.ar_invoices
  set balance_due = public.ywi_normalize_money(v_balance),
      invoice_status = case
        when invoice_status = 'void' then 'void'
        when public.ywi_normalize_money(v_total) <= 0 then invoice_status
        when public.ywi_normalize_money(v_balance) = 0 then 'paid'
        when public.ywi_normalize_money(v_paid) > 0 then 'partial'
        when invoice_status in ('paid', 'partial') then 'issued'
        else invoice_status
      end,
      updated_at = now()
  where id = p_invoice_id;
end;
$$;

create or replace function public.ywi_after_ar_payment_recalc()
returns trigger
language plpgsql
as $$
begin
  if tg_op in ('INSERT', 'UPDATE') then
    perform public.ywi_recalc_ar_invoice_balance(new.invoice_id);
  end if;
  if tg_op in ('UPDATE', 'DELETE') then
    perform public.ywi_recalc_ar_invoice_balance(old.invoice_id);
  end if;
  return null;
end;
$$;

drop trigger if exists trg_ywi_after_ar_payment_recalc on public.ar_payments;
create trigger trg_ywi_after_ar_payment_recalc
after insert or update or delete on public.ar_payments
for each row execute function public.ywi_after_ar_payment_recalc();

create or replace function public.ywi_recalc_ap_bill_balance(p_bill_id uuid)
returns void
language plpgsql
as $$
declare
  v_total numeric := 0;
  v_paid numeric := 0;
  v_balance numeric := 0;
begin
  if p_bill_id is null then
    return;
  end if;

  select coalesce(total_amount, 0)
    into v_total
  from public.ap_bills
  where id = p_bill_id;

  select coalesce(sum(amount), 0)
    into v_paid
  from public.ap_payments
  where bill_id = p_bill_id;

  v_balance := greatest(v_total - v_paid, 0);

  update public.ap_bills
  set balance_due = public.ywi_normalize_money(v_balance),
      bill_status = case
        when bill_status = 'void' then 'void'
        when public.ywi_normalize_money(v_total) <= 0 then bill_status
        when public.ywi_normalize_money(v_balance) = 0 then 'paid'
        when public.ywi_normalize_money(v_paid) > 0 then 'partial'
        when bill_status in ('paid', 'partial') then 'scheduled'
        else bill_status
      end,
      updated_at = now()
  where id = p_bill_id;
end;
$$;

create or replace function public.ywi_after_ap_payment_recalc()
returns trigger
language plpgsql
as $$
begin
  if tg_op in ('INSERT', 'UPDATE') then
    perform public.ywi_recalc_ap_bill_balance(new.bill_id);
  end if;
  if tg_op in ('UPDATE', 'DELETE') then
    perform public.ywi_recalc_ap_bill_balance(old.bill_id);
  end if;
  return null;
end;
$$;

drop trigger if exists trg_ywi_after_ap_payment_recalc on public.ap_payments;
create trigger trg_ywi_after_ap_payment_recalc
after insert or update or delete on public.ap_payments
for each row execute function public.ywi_after_ap_payment_recalc();

create or replace function public.ywi_before_linked_hse_packet()
returns trigger
language plpgsql
as $$
declare
  v_required_count integer := 0;
  v_completed_count integer := 0;
begin
  v_required_count :=
      (case when coalesce(new.briefing_required, false) then 1 else 0 end)
    + (case when coalesce(new.inspection_required, false) then 1 else 0 end)
    + (case when coalesce(new.emergency_review_required, false) then 1 else 0 end);

  v_completed_count :=
      (case when coalesce(new.briefing_required, false) and coalesce(new.briefing_completed, false) then 1 else 0 end)
    + (case when coalesce(new.inspection_required, false) and coalesce(new.inspection_completed, false) then 1 else 0 end)
    + (case when coalesce(new.emergency_review_required, false) and coalesce(new.emergency_review_completed, false) then 1 else 0 end);

  if coalesce(new.packet_status, '') = 'closed' then
    new.completion_percent := 100;
    new.ready_for_closeout_at := coalesce(new.ready_for_closeout_at, now());
    new.closed_at := coalesce(new.closed_at, now());
  else
    if v_required_count <= 0 then
      new.completion_percent := 100;
      new.packet_status := 'ready_for_closeout';
      new.ready_for_closeout_at := coalesce(new.ready_for_closeout_at, now());
    else
      new.completion_percent := round((v_completed_count::numeric / v_required_count::numeric) * 100, 2);
      if v_completed_count = v_required_count then
        new.packet_status := 'ready_for_closeout';
        new.ready_for_closeout_at := coalesce(new.ready_for_closeout_at, now());
      elsif v_completed_count > 0 then
        if coalesce(new.packet_status, '') not in ('closed') then
          new.packet_status := 'in_progress';
        end if;
        new.ready_for_closeout_at := null;
        new.closed_at := null;
      else
        new.packet_status := 'draft';
        new.ready_for_closeout_at := null;
        new.closed_at := null;
      end if;
    end if;
  end if;

  if coalesce(new.packet_status, '') <> 'closed' then
    new.closed_at := null;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_ywi_before_linked_hse_packet on public.linked_hse_packets;
create trigger trg_ywi_before_linked_hse_packet
before insert or update on public.linked_hse_packets
for each row execute function public.ywi_before_linked_hse_packet();

create or replace view public.v_route_rollups as
select
  r.id,
  r.route_code,
  r.name,
  r.route_type,
  count(rs.id) as stop_count,
  count(*) filter (where rs.is_active is true) as active_stop_count,
  coalesce(sum(rs.planned_duration_minutes), 0) as planned_minutes_total,
  min(rs.planned_arrival_time) as first_planned_arrival,
  max(rs.planned_arrival_time) as last_planned_arrival
from public.routes r
left join public.route_stops rs on rs.route_id = r.id
group by r.id, r.route_code, r.name, r.route_type;

create or replace view public.v_estimate_rollups as
select
  e.id,
  e.estimate_number,
  e.status,
  e.client_id,
  count(el.id) as line_count,
  coalesce(sum(el.line_total), 0) as rolled_subtotal,
  e.tax_total,
  public.ywi_normalize_money(coalesce(sum(el.line_total), 0) + coalesce(e.tax_total, 0)) as rolled_total
from public.estimates e
left join public.estimate_lines el on el.estimate_id = e.id
group by e.id, e.estimate_number, e.status, e.client_id, e.tax_total;

create or replace view public.v_work_order_rollups as
select
  wo.id,
  wo.work_order_number,
  wo.status,
  wo.client_id,
  count(wol.id) as line_count,
  coalesce(sum(wol.line_total), 0) as rolled_subtotal,
  coalesce(sum(wol.actual_material_cost), 0) as actual_material_cost_total,
  wo.tax_total,
  public.ywi_normalize_money(coalesce(sum(wol.line_total), 0) + coalesce(wo.tax_total, 0)) as rolled_total,
  count(lhp.id) filter (where lhp.packet_status in ('draft', 'in_progress')) as open_hse_packets,
  count(lhp.id) filter (where lhp.packet_status = 'ready_for_closeout') as ready_hse_packets,
  count(lhp.id) filter (where lhp.packet_status = 'closed') as closed_hse_packets
from public.work_orders wo
left join public.work_order_lines wol on wol.work_order_id = wo.id
left join public.linked_hse_packets lhp on lhp.work_order_id = wo.id
group by wo.id, wo.work_order_number, wo.status, wo.client_id, wo.tax_total;

create or replace view public.v_material_receipt_rollups as
select
  mr.id,
  mr.receipt_number,
  mr.receipt_status,
  mr.vendor_id,
  mr.work_order_id,
  count(mrl.id) as line_count,
  coalesce(sum(mrl.quantity), 0) as quantity_total,
  coalesce(sum(mrl.line_total), 0) as receipt_total
from public.material_receipts mr
left join public.material_receipt_lines mrl on mrl.receipt_id = mr.id
group by mr.id, mr.receipt_number, mr.receipt_status, mr.vendor_id, mr.work_order_id;

create or replace view public.v_hse_packet_progress as
select
  lhp.id,
  lhp.packet_number,
  lhp.packet_type,
  lhp.packet_status,
  lhp.work_order_id,
  lhp.dispatch_id,
  ((case when lhp.briefing_required then 1 else 0 end)
    + (case when lhp.inspection_required then 1 else 0 end)
    + (case when lhp.emergency_review_required then 1 else 0 end)) as required_step_count,
  ((case when lhp.briefing_required and lhp.briefing_completed then 1 else 0 end)
    + (case when lhp.inspection_required and lhp.inspection_completed then 1 else 0 end)
    + (case when lhp.emergency_review_required and lhp.emergency_review_completed then 1 else 0 end)) as completed_step_count,
  lhp.completion_percent,
  lhp.ready_for_closeout_at,
  lhp.closed_at
from public.linked_hse_packets lhp;

create or replace view public.v_account_balance_rollups as
select
  'ar_invoice'::text as record_type,
  ai.id,
  ai.invoice_number as record_number,
  ai.client_id,
  ai.total_amount,
  coalesce(sum(ap.amount), 0) as posted_amount,
  ai.balance_due,
  ai.invoice_status as status
from public.ar_invoices ai
left join public.ar_payments ap on ap.invoice_id = ai.id
group by ai.id, ai.invoice_number, ai.client_id, ai.total_amount, ai.balance_due, ai.invoice_status
union all
select
  'ap_bill'::text as record_type,
  ab.id,
  ab.bill_number as record_number,
  ab.vendor_id as client_id,
  ab.total_amount,
  coalesce(sum(app.amount), 0) as posted_amount,
  ab.balance_due,
  ab.bill_status as status
from public.ap_bills ab
left join public.ap_payments app on app.bill_id = ab.id
group by ab.id, ab.bill_number, ab.vendor_id, ab.total_amount, ab.balance_due, ab.bill_status;

create index if not exists idx_material_receipt_lines_work_order_line_id on public.material_receipt_lines(work_order_line_id);
create index if not exists idx_linked_hse_packets_status on public.linked_hse_packets(packet_status);


-- 064 receipt rollups, work-order operational status, and posted/open amounts
-- 064_receipt_rollups_work_order_operational_status_and_posted_amounts.sql

-- 064_receipt_rollups_work_order_operational_status_and_posted_amounts.sql
-- Follow-up polish on top of 063:
-- - clearer receipt allocation rollups
-- - work-order operational visibility for receiving + HSE linkage
-- - posted/open amount visibility for AR/AP records

create extension if not exists pgcrypto;

create or replace view public.v_material_receipt_rollups as
with receipt_rollups as (
  select
    mr.id,
    mr.receipt_number,
    mr.receipt_status,
    mr.vendor_id,
    mr.work_order_id,
    count(mrl.id) as line_count,
    coalesce(sum(mrl.quantity), 0) as quantity_total,
    coalesce(sum(mrl.line_total), 0) as receipt_total,
    coalesce(sum(case when mrl.work_order_line_id is not null then mrl.line_total else 0 end), 0) as allocated_receipt_total,
    coalesce(sum(case when mrl.work_order_line_id is null then mrl.line_total else 0 end), 0) as unallocated_receipt_total,
    count(distinct mrl.work_order_line_id) filter (where mrl.work_order_line_id is not null) as linked_work_order_line_count
  from public.material_receipts mr
  left join public.material_receipt_lines mrl on mrl.receipt_id = mr.id
  group by mr.id, mr.receipt_number, mr.receipt_status, mr.vendor_id, mr.work_order_id
)
select * from receipt_rollups;

create or replace view public.v_work_order_rollups as
with line_rollups as (
  select
    wo.id,
    count(wol.id) as line_count,
    coalesce(sum(wol.line_total), 0) as rolled_subtotal,
    coalesce(sum(wol.actual_material_cost), 0) as actual_material_cost_total
  from public.work_orders wo
  left join public.work_order_lines wol on wol.work_order_id = wo.id
  group by wo.id
),
receipt_rollups as (
  select
    mr.work_order_id,
    count(distinct mr.id) as receipt_count,
    coalesce(sum(mrl.quantity), 0) as received_material_quantity_total,
    coalesce(sum(mrl.line_total), 0) as received_material_cost_total,
    coalesce(sum(case when mrl.work_order_line_id is not null then mrl.line_total else 0 end), 0) as allocated_receipt_cost_total,
    coalesce(sum(case when mrl.work_order_line_id is null then mrl.line_total else 0 end), 0) as unallocated_receipt_cost_total
  from public.material_receipts mr
  left join public.material_receipt_lines mrl on mrl.receipt_id = mr.id
  where mr.work_order_id is not null
  group by mr.work_order_id
),
hse_rollups as (
  select
    lhp.work_order_id,
    count(lhp.id) filter (where lhp.packet_status in ('draft', 'in_progress')) as open_hse_packets,
    count(lhp.id) filter (where lhp.packet_status = 'ready_for_closeout') as ready_hse_packets,
    count(lhp.id) filter (where lhp.packet_status = 'closed') as closed_hse_packets
  from public.linked_hse_packets lhp
  where lhp.work_order_id is not null
  group by lhp.work_order_id
)
select
  wo.id,
  wo.work_order_number,
  wo.status,
  wo.client_id,
  coalesce(lr.line_count, 0) as line_count,
  coalesce(lr.rolled_subtotal, 0) as rolled_subtotal,
  coalesce(lr.actual_material_cost_total, 0) as actual_material_cost_total,
  wo.tax_total,
  public.ywi_normalize_money(coalesce(lr.rolled_subtotal, 0) + coalesce(wo.tax_total, 0)) as rolled_total,
  coalesce(hr.open_hse_packets, 0) as open_hse_packets,
  coalesce(hr.ready_hse_packets, 0) as ready_hse_packets,
  coalesce(hr.closed_hse_packets, 0) as closed_hse_packets,
  coalesce(rr.receipt_count, 0) as receipt_count,
  coalesce(rr.received_material_quantity_total, 0) as received_material_quantity_total,
  coalesce(rr.received_material_cost_total, 0) as received_material_cost_total,
  coalesce(rr.allocated_receipt_cost_total, 0) as allocated_receipt_cost_total,
  coalesce(rr.unallocated_receipt_cost_total, 0) as unallocated_receipt_cost_total,
  case
    when wo.status = 'closed' then 'closed'
    when wo.status = 'completed' and coalesce(hr.open_hse_packets, 0) = 0 then 'ready_for_billing'
    when wo.status in ('in_progress', 'completed') or coalesce(rr.receipt_count, 0) > 0 or coalesce(hr.open_hse_packets, 0) > 0 then 'active'
    when wo.status = 'scheduled' then 'scheduled'
    else 'draft'
  end as operational_status
from public.work_orders wo
left join line_rollups lr on lr.id = wo.id
left join receipt_rollups rr on rr.work_order_id = wo.id
left join hse_rollups hr on hr.work_order_id = wo.id;

create or replace view public.v_account_balance_rollups as
select
  'ar_invoice'::text as record_type,
  ai.id,
  ai.invoice_number as record_number,
  ai.client_id,
  ai.total_amount,
  public.ywi_normalize_money(coalesce(ai.total_amount, 0) - coalesce(ai.balance_due, 0)) as posted_amount,
  ai.balance_due,
  ai.invoice_status as status,
  public.ywi_normalize_money(coalesce(ai.balance_due, 0)) as open_amount,
  case
    when coalesce(ai.total_amount, 0) <= 0 then 0
    else round(((coalesce(ai.total_amount, 0) - coalesce(ai.balance_due, 0)) / nullif(ai.total_amount, 0)) * 100, 2)
  end as posted_percent
from public.ar_invoices ai
union all
select
  'ap_bill'::text as record_type,
  ab.id,
  ab.bill_number as record_number,
  ab.vendor_id as client_id,
  ab.total_amount,
  public.ywi_normalize_money(coalesce(ab.total_amount, 0) - coalesce(ab.balance_due, 0)) as posted_amount,
  ab.balance_due,
  ab.bill_status as status,
  public.ywi_normalize_money(coalesce(ab.balance_due, 0)) as open_amount,
  case
    when coalesce(ab.total_amount, 0) <= 0 then 0
    else round(((coalesce(ab.total_amount, 0) - coalesce(ab.balance_due, 0)) / nullif(ab.total_amount, 0)) * 100, 2)
  end as posted_percent
from public.ap_bills ab;

create index if not exists idx_material_receipt_lines_material_id on public.material_receipt_lines(material_id);
create index if not exists idx_work_orders_route_id on public.work_orders(route_id);
