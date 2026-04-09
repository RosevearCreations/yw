-- 061_estimates_work_orders_routes_materials_and_gl_foundation.sql
-- Corrected full-run version
-- Landscaping / project-work / subcontract dispatch / accounting foundation
-- Safe for reruns and partial previous runs.

create extension if not exists pgcrypto;

-- =========================================================
-- Core reference tables
-- =========================================================

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

-- =========================================================
-- Client sites
-- Adapts legacy_site_id to actual public.sites.id type
-- =========================================================

do $$
declare
  v_sites_id_type text;
  v_client_sites_exists boolean;
begin
  select c.data_type
  into v_sites_id_type
  from information_schema.columns c
  where c.table_schema = 'public'
    and c.table_name = 'sites'
    and c.column_name = 'id';

  select exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'client_sites'
  )
  into v_client_sites_exists;

  if not v_client_sites_exists then
    if v_sites_id_type is null then
      execute $sql$
        create table public.client_sites (
          id uuid primary key default gen_random_uuid(),
          client_id uuid not null references public.clients(id) on delete cascade,
          legacy_site_id uuid,
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
        )
      $sql$;
    elsif v_sites_id_type = 'uuid' then
      execute $sql$
        create table public.client_sites (
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
        )
      $sql$;
    else
      execute format($sql$
        create table public.client_sites (
          id uuid primary key default gen_random_uuid(),
          client_id uuid not null references public.clients(id) on delete cascade,
          legacy_site_id %s references public.sites(id) on delete set null,
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
        )
      $sql$, v_sites_id_type);
    end if;
  else
    if v_sites_id_type is not null then
      execute 'alter table public.client_sites drop constraint if exists client_sites_legacy_site_id_fkey';

      if v_sites_id_type = 'uuid' then
        begin
          execute 'alter table public.client_sites alter column legacy_site_id type uuid using legacy_site_id::uuid';
        exception when others then
          execute 'update public.client_sites set legacy_site_id = null where legacy_site_id is not null';
          execute 'alter table public.client_sites alter column legacy_site_id type uuid using null';
        end;
        execute 'alter table public.client_sites add constraint client_sites_legacy_site_id_fkey foreign key (legacy_site_id) references public.sites(id) on delete set null';
      else
        begin
          execute format('alter table public.client_sites alter column legacy_site_id type %s using legacy_site_id::text::%s', v_sites_id_type, v_sites_id_type);
        exception when others then
          execute 'update public.client_sites set legacy_site_id = null where legacy_site_id is not null';
          execute format('alter table public.client_sites alter column legacy_site_id type %s using null', v_sites_id_type);
        end;
        execute 'alter table public.client_sites add constraint client_sites_legacy_site_id_fkey foreign key (legacy_site_id) references public.sites(id) on delete set null';
      end if;
    end if;
  end if;
end $$;

create index if not exists idx_client_sites_client_id on public.client_sites(client_id);

-- =========================================================
-- Route stops
-- =========================================================

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

-- =========================================================
-- Estimates
-- =========================================================

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

-- =========================================================
-- Work orders
-- Adapts legacy_job_id to actual public.jobs.id type
-- =========================================================

do $$
declare
  v_jobs_id_type text;
  v_work_orders_exists boolean;
begin
  select c.data_type
  into v_jobs_id_type
  from information_schema.columns c
  where c.table_schema = 'public'
    and c.table_name = 'jobs'
    and c.column_name = 'id';

  select exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'work_orders'
  )
  into v_work_orders_exists;

  if not v_work_orders_exists then
    if v_jobs_id_type is null then
      execute $sql$
        create table public.work_orders (
          id uuid primary key default gen_random_uuid(),
          work_order_number text not null unique,
          estimate_id uuid references public.estimates(id) on delete set null,
          client_id uuid references public.clients(id) on delete set null,
          client_site_id uuid references public.client_sites(id) on delete set null,
          legacy_job_id uuid,
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
        )
      $sql$;
    elsif v_jobs_id_type = 'uuid' then
      execute $sql$
        create table public.work_orders (
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
        )
      $sql$;
    else
      execute format($sql$
        create table public.work_orders (
          id uuid primary key default gen_random_uuid(),
          work_order_number text not null unique,
          estimate_id uuid references public.estimates(id) on delete set null,
          client_id uuid references public.clients(id) on delete set null,
          client_site_id uuid references public.client_sites(id) on delete set null,
          legacy_job_id %s references public.jobs(id) on delete set null,
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
        )
      $sql$, v_jobs_id_type);
    end if;
  else
    if v_jobs_id_type is not null then
      execute 'alter table public.work_orders drop constraint if exists work_orders_legacy_job_id_fkey';

      if v_jobs_id_type = 'uuid' then
        begin
          execute 'alter table public.work_orders alter column legacy_job_id type uuid using legacy_job_id::uuid';
        exception when others then
          execute 'update public.work_orders set legacy_job_id = null where legacy_job_id is not null';
          execute 'alter table public.work_orders alter column legacy_job_id type uuid using null';
        end;
        execute 'alter table public.work_orders add constraint work_orders_legacy_job_id_fkey foreign key (legacy_job_id) references public.jobs(id) on delete set null';
      else
        begin
          execute format('alter table public.work_orders alter column legacy_job_id type %s using legacy_job_id::text::%s', v_jobs_id_type, v_jobs_id_type);
        exception when others then
          execute 'update public.work_orders set legacy_job_id = null where legacy_job_id is not null';
          execute format('alter table public.work_orders alter column legacy_job_id type %s using null', v_jobs_id_type);
        end;
        execute 'alter table public.work_orders add constraint work_orders_legacy_job_id_fkey foreign key (legacy_job_id) references public.jobs(id) on delete set null';
      end if;
    end if;
  end if;
end $$;

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

-- =========================================================
-- Subcontract dispatch
-- =========================================================

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

-- =========================================================
-- General ledger / AR / AP
-- =========================================================

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

-- =========================================================
-- Seed data
-- =========================================================

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
