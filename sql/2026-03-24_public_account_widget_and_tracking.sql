-- 2026-03-24_public_account_widget_and_tracking.sql

begin;

alter table public.customer_profiles
  add column if not exists email_verified_at timestamptz null,
  add column if not exists marketing_source text null,
  add column if not exists last_login_at timestamptz null;

create table if not exists public.customer_auth_tokens (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  customer_profile_id uuid not null references public.customer_profiles(id) on delete cascade,
  purpose text not null check (purpose in ('password_reset','email_verification')),
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz null,
  payload jsonb not null default '{}'::jsonb
);

create index if not exists idx_customer_auth_tokens_customer_profile_id on public.customer_auth_tokens(customer_profile_id, created_at desc);
create index if not exists idx_customer_auth_tokens_purpose on public.customer_auth_tokens(purpose, created_at desc);
create index if not exists idx_customer_auth_tokens_expires_at on public.customer_auth_tokens(expires_at);

insert into public.app_management_settings (key, value, updated_at)
values
  ('feature_flags', '{"analytics_tracking_enabled": true, "analytics_journeys_enabled": true, "abandoned_recovery_enabled": true, "public_catalog_db_enabled": true, "recovery_templates_enabled": true, "low_stock_alerts_enabled": true}'::jsonb, now()),
  ('public_account_widget', '{"enabled": true, "show_login_everywhere": true, "allow_password_reset": true, "allow_verification_resend": true}'::jsonb, now())
on conflict (key) do update
set
  value = public.app_management_settings.value || excluded.value,
  updated_at = now();

commit;
