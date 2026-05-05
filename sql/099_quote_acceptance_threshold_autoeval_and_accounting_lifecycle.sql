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
  p.full_name as created_by_name,
  e.created_at,
  e.updated_at
from public.job_accounting_lifecycle_events e
left join public.jobs j on j.id = e.job_id
left join public.profiles p on p.id = e.created_by_profile_id;
