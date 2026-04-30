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
  coalesce(cp.full_name, cp.email, '') as created_by_name,
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
