-- File: sql/055_storage_onboarding_identity_change_and_bootstrap.sql
-- Brief description:
-- Moves equipment evidence into storage-backed audit rows, adds onboarding and
-- identity-change workflow fields, and prepares bootstrap account scripting support.

begin;

alter table if exists public.profiles
  add column if not exists pending_email text,
  add column if not exists pending_username text,
  add column if not exists onboarding_completed_at timestamptz;

create index if not exists idx_profiles_username_lookup
  on public.profiles (lower(coalesce(username, '')));

create index if not exists idx_profiles_pending_username_lookup
  on public.profiles (lower(coalesce(pending_username, '')));

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

create index if not exists idx_account_identity_change_requests_profile_id
  on public.account_identity_change_requests (profile_id, created_at desc);

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

create index if not exists idx_equipment_evidence_assets_signout_id
  on public.equipment_evidence_assets (signout_id, created_at desc);

create index if not exists idx_equipment_evidence_assets_item_id
  on public.equipment_evidence_assets (equipment_item_id, created_at desc);

commit;
