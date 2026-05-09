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
