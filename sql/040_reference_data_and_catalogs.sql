
-- File: sql/040_reference_data_and_catalogs.sql
-- Brief description: Adds admin-populated reference catalogs and richer site metadata
-- so forms can be populated from shared lists instead of free-typed values.

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

alter table public.sites add column if not exists site_supervisor_profile_id uuid references public.profiles(id);
alter table public.sites add column if not exists signing_supervisor_profile_id uuid references public.profiles(id);
alter table public.sites add column if not exists region text;
alter table public.sites add column if not exists client_name text;
alter table public.sites add column if not exists project_code text;
alter table public.sites add column if not exists project_status text;

insert into public.position_catalog (name, sort_order) values
  ('Labourer', 10),
  ('Operator', 20),
  ('Foreman', 30),
  ('Site Supervisor', 40),
  ('Safety Coordinator', 50),
  ('Project Manager', 60)
on conflict (name) do nothing;

insert into public.trade_catalog (name, sort_order) values
  ('General Construction', 10),
  ('Concrete', 20),
  ('Excavation', 30),
  ('Electrical', 40),
  ('Plumbing', 50),
  ('Carpentry', 60),
  ('Equipment Operation', 70),
  ('Health and Safety', 80)
on conflict (name) do nothing;
