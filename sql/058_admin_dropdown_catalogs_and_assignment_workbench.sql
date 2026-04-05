-- 2026-04-05 admin dropdown catalogs and assignment workbench pass

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

insert into public.staff_tier_catalog (name, sort_order) values
  ('Admin', 10),
  ('Supervisor', 20),
  ('Employee', 30)
on conflict (name) do nothing;

insert into public.seniority_level_catalog (name, sort_order) values
  ('Junior', 10),
  ('Intermediate', 20),
  ('Senior', 30),
  ('Lead', 40)
on conflict (name) do nothing;

insert into public.employment_status_catalog (name, sort_order) values
  ('active', 10),
  ('blocked', 20),
  ('inactive', 30),
  ('leave', 40)
on conflict (name) do nothing;

insert into public.job_type_catalog (name, sort_order) values
  ('General Safety', 10),
  ('Landscaping', 20),
  ('Maintenance', 30),
  ('Inspection', 40),
  ('Training', 50)
on conflict (name) do nothing;
