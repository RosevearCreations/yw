-- =========================================================
-- YWI HSE Full Schema Reference
-- Purpose:
-- - Baseline schema reference for the current app
-- - Includes core tables, constraints, indexes, and storage notes
-- - Safe as a planning/reference file; review before production use
-- =========================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------
-- profiles
-- ---------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key,
  email text not null unique,
  full_name text,
  role text not null default 'worker',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_role_check check (role in ('worker','supervisor','hse','admin'))
);

-- ---------------------------------------------------------
-- sites
-- ---------------------------------------------------------
create table if not exists public.sites (
  id uuid primary key default gen_random_uuid(),
  site_code text not null unique,
  site_name text not null,
  address text,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------
-- site_assignments
-- ---------------------------------------------------------
create table if not exists public.site_assignments (
  id bigserial primary key,
  site_id uuid not null references public.sites(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  assignment_role text not null default 'worker',
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  constraint site_assignments_role_check check (assignment_role in ('worker','supervisor','hse','admin'))
);

-- Optional uniqueness protection
create unique index if not exists idx_site_assignments_unique_pair
  on public.site_assignments(site_id, profile_id);

-- ---------------------------------------------------------
-- submissions
-- ---------------------------------------------------------
create table if not exists public.submissions (
  id bigserial primary key,
  site text not null,
  form_type text not null,
  date date not null,
  submitted_by text,
  submitted_by_profile_id uuid references public.profiles(id) on delete set null,
  status text not null default 'submitted',
  admin_notes text,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint submissions_form_type_check check (form_type in ('A','B','C','D','E')),
  constraint submissions_status_check check (status in ('submitted','under_review','approved','follow_up_required','closed'))
);

-- ---------------------------------------------------------
-- toolbox_attendees
-- ---------------------------------------------------------
create table if not exists public.toolbox_attendees (
  id bigserial primary key,
  submission_id bigint not null references public.submissions(id) on delete cascade,
  name text not null,
  role_on_site text,
  signature_png_base64 text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------
-- submission_reviews
-- ---------------------------------------------------------
create table if not exists public.submission_reviews (
  id bigserial primary key,
  submission_id bigint not null references public.submissions(id) on delete cascade,
  reviewer_id uuid references public.profiles(id) on delete set null,
  review_action text not null,
  review_note text,
  created_at timestamptz not null default now(),
  constraint submission_reviews_action_check check (
    review_action in ('commented','under_review','approved','follow_up_required','closed','reopened')
  )
);

-- ---------------------------------------------------------
-- submission_images
-- ---------------------------------------------------------
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
  created_at timestamptz not null default now(),
  constraint submission_images_type_check check (image_type in ('hazard','status','repair','other'))
);

-- ---------------------------------------------------------
-- indexes
-- ---------------------------------------------------------
create index if not exists idx_submissions_status
  on public.submissions(status);

create index if not exists idx_submissions_site_date
  on public.submissions(site, date desc);

create index if not exists idx_submissions_form_date
  on public.submissions(form_type, date desc);

create index if not exists idx_submissions_submitted_by_profile_id
  on public.submissions(submitted_by_profile_id);

create index if not exists idx_toolbox_attendees_submission_id
  on public.toolbox_attendees(submission_id);

create index if not exists idx_submission_reviews_submission_id
  on public.submission_reviews(submission_id);

create index if not exists idx_submission_reviews_reviewer_id
  on public.submission_reviews(reviewer_id);

create index if not exists idx_submission_images_submission_id
  on public.submission_images(submission_id);

create index if not exists idx_submission_images_uploaded_by
  on public.submission_images(uploaded_by);

create index if not exists idx_site_assignments_site_id
  on public.site_assignments(site_id);

create index if not exists idx_site_assignments_profile_id
  on public.site_assignments(profile_id);

-- ---------------------------------------------------------
-- rls enablement
-- ---------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.sites enable row level security;
alter table public.site_assignments enable row level security;
alter table public.submissions enable row level security;
alter table public.toolbox_attendees enable row level security;
alter table public.submission_reviews enable row level security;
alter table public.submission_images enable row level security;

-- ---------------------------------------------------------
-- minimal read policies
-- ---------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'profiles' and policyname = 'profiles_authenticated_read'
  ) then
    create policy profiles_authenticated_read
      on public.profiles
      for select
      to authenticated
      using (true);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'sites' and policyname = 'sites_authenticated_read'
  ) then
    create policy sites_authenticated_read
      on public.sites
      for select
      to authenticated
      using (true);
  end if;
end $$;

-- ---------------------------------------------------------
-- trigger function for updated_at
-- ---------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Attach only where updated_at exists

drop trigger if exists trg_profiles_set_updated_at on public.profiles;
create trigger trg_profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists trg_sites_set_updated_at on public.sites;
create trigger trg_sites_set_updated_at
before update on public.sites
for each row execute function public.set_updated_at();

drop trigger if exists trg_submissions_set_updated_at on public.submissions;
create trigger trg_submissions_set_updated_at
before update on public.submissions
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------
-- storage note
-- ---------------------------------------------------------
-- Required bucket for app:
--   submission-images
-- Suggested config:
--   private bucket
--   max 10 MB
--   image mime types only
