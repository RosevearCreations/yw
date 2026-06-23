-- Schema 153: Disposable staging fixtures, policy assertions, private media review,
-- accountant close mapping, route-signal decisions, and Stripe delivery alerts.
-- Build 2026-06-22a.

begin;

-- ---------------------------------------------------------------------------
-- Disposable staging fixtures. These rows are deliberately labelled and tracked
-- so end-to-end tests do not require hand-created AR/AP/bank/quote records.
-- ---------------------------------------------------------------------------
create table if not exists public.operations_staging_fixture_sets (
  id uuid primary key default gen_random_uuid(),
  fixture_key text not null unique,
  fixture_label text not null,
  environment_label text not null default 'staging',
  fixture_status text not null default 'created',
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  cleaned_at timestamptz,
  cleaned_by_profile_id uuid references public.profiles(id) on delete set null,
  summary jsonb not null default '{}'::jsonb,
  cleanup_notes text,
  check (environment_label = 'staging'),
  check (fixture_label like 'STAGING-%'),
  check (fixture_status in ('created','in_use','cleanup_requested','cleaned','cleanup_failed'))
);

create table if not exists public.operations_staging_fixture_records (
  id uuid primary key default gen_random_uuid(),
  fixture_set_id uuid not null references public.operations_staging_fixture_sets(id) on delete cascade,
  entity_type text not null,
  entity_id text not null,
  entity_reference text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(fixture_set_id, entity_type, entity_id)
);
create index if not exists operations_staging_fixture_records_lookup_idx
  on public.operations_staging_fixture_records(fixture_set_id, entity_type);

-- ---------------------------------------------------------------------------
-- Accountant review mapping. These are review aids, not tax advice or filing.
-- ---------------------------------------------------------------------------
create table if not exists public.accountant_export_mapping_rules (
  id uuid primary key default gen_random_uuid(),
  mapping_key text not null unique,
  mapping_type text not null default 'account',
  source_key text not null,
  target_label text not null,
  account_id uuid references public.chart_of_accounts(id) on delete set null,
  tax_code_id uuid references public.tax_codes(id) on delete set null,
  reporting_group text,
  is_required boolean not null default true,
  review_status text not null default 'review',
  reviewed_by_profile_id uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (mapping_type in ('account','tax','close_check','export_group')),
  check (review_status in ('draft','review','approved','rejected','retired'))
);
create index if not exists accountant_export_mapping_rules_ready_idx
  on public.accountant_export_mapping_rules(is_active, is_required, review_status, mapping_type);

insert into public.accountant_export_mapping_rules (mapping_key, mapping_type, source_key, target_label, account_id, reporting_group, is_required, review_status, notes)
select v.mapping_key, 'account', v.system_code, v.target_label, coa.id, v.reporting_group, true, 'review', 'Seeded from system account code; accountant review required before close package is treated as final.'
from (values
  ('cash_operating','cash','Operating cash / bank','cash_and_equivalents'),
  ('accounts_receivable','ar','Accounts receivable','accounts_receivable'),
  ('accounts_payable','ap','Accounts payable','accounts_payable'),
  ('sales_tax_payable','tax_payable','Sales tax payable','sales_tax'),
  ('customer_deposits','customer_deposits','Customer deposits / deferred revenue','liabilities'),
  ('service_revenue','revenue_landscape','Service revenue','revenue')
) as v(mapping_key, system_code, target_label, reporting_group)
left join public.chart_of_accounts coa on lower(coalesce(coa.system_code,'')) = lower(v.system_code)
on conflict (mapping_key) do update set
  account_id = coalesce(excluded.account_id, public.accountant_export_mapping_rules.account_id),
  target_label = excluded.target_label,
  reporting_group = excluded.reporting_group,
  updated_at = now();

alter table public.accountant_handoff_exports
  add column if not exists mapping_snapshot jsonb not null default '[]'::jsonb,
  add column if not exists close_checklist_snapshot jsonb not null default '{}'::jsonb,
  add column if not exists mapping_reviewed_at timestamptz,
  add column if not exists mapping_reviewed_by_profile_id uuid references public.profiles(id) on delete set null;

create or replace view public.v_accountant_mapping_readiness as
select
  count(*) filter (where is_active and is_required)::int as required_mapping_count,
  count(*) filter (where is_active and is_required and review_status = 'approved')::int as approved_mapping_count,
  count(*) filter (where is_active and is_required and (review_status <> 'approved' or account_id is null))::int as unresolved_required_mapping_count,
  coalesce(jsonb_agg(jsonb_build_object(
    'mapping_key', mapping_key,
    'source_key', source_key,
    'target_label', target_label,
    'review_status', review_status,
    'account_id', account_id,
    'reporting_group', reporting_group,
    'notes', notes
  ) order by mapping_key) filter (where is_active and is_required and (review_status <> 'approved' or account_id is null)), '[]'::jsonb) as unresolved_mappings,
  case when count(*) filter (where is_active and is_required and (review_status <> 'approved' or account_id is null)) = 0
    then true else false end as mapping_ready,
  case when count(*) filter (where is_active and is_required and (review_status <> 'approved' or account_id is null)) = 0
    then 'Required chart-of-accounts mappings have accountant approval.'
    else 'An accountant or bookkeeper must approve required chart-of-accounts mappings before this package is final.' end as mapping_message
from public.accountant_export_mapping_rules;

-- ---------------------------------------------------------------------------
-- Search Console / Business Profile observations are manually imported or
-- entered evidence. Credentials are never stored here.
-- ---------------------------------------------------------------------------
create table if not exists public.content_signal_observations (
  id uuid primary key default gen_random_uuid(),
  observation_key text not null unique,
  source_name text not null,
  route_key text references public.public_route_approval_items(route_key) on delete set null,
  observation_date date not null default current_date,
  period_start date,
  period_end date,
  impressions integer,
  clicks integer,
  average_position numeric(8,2),
  calls integer,
  direction_requests integer,
  website_visits integer,
  review_count integer,
  rating numeric(3,2),
  notes text,
  evidence_url text,
  decision_status text not null default 'new',
  decision_note text,
  decided_by_profile_id uuid references public.profiles(id) on delete set null,
  decided_at timestamptz,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (source_name in ('search_console','google_business_profile','manual_analytics')),
  check (decision_status in ('new','review','actioned','no_change','archived')),
  check (period_end is null or period_start is null or period_end >= period_start)
);
create index if not exists content_signal_observations_queue_idx
  on public.content_signal_observations(decision_status, observation_date desc, route_key);

create or replace view public.v_route_content_decision_queue as
select
  s.id, s.observation_key, s.source_name, s.route_key, r.route_path, r.page_title,
  s.observation_date, s.period_start, s.period_end, s.impressions, s.clicks,
  s.average_position, s.calls, s.direction_requests, s.website_visits, s.review_count, s.rating,
  s.notes, s.evidence_url, s.decision_status, s.decision_note, s.created_at,
  case
    when s.source_name='search_console' and coalesce(s.impressions,0) >= 25 and coalesce(s.clicks,0)=0 then 'Review title, snippet, useful main-page answer, and CTA relevance.'
    when s.source_name='search_console' and coalesce(s.average_position,999) between 8 and 20 then 'Review route intent, local proof, internal links, and original visual support; do not keyword stuff.'
    when s.source_name='google_business_profile' and coalesce(s.website_visits,0)+coalesce(s.calls,0)+coalesce(s.direction_requests,0)>0 then 'Compare business-profile discovery with the matching route CTA and booking path.'
    else 'Record a human decision before changing a public route.' end as recommended_next_action
from public.content_signal_observations s
left join public.public_route_approval_items r on r.route_key=s.route_key
where s.decision_status in ('new','review')
order by s.observation_date desc, s.created_at desc;

-- ---------------------------------------------------------------------------
-- Stripe delivery alerts. The webhook writes safe event outcomes; this view
-- turns repeated validated failures or stale delivery into reviewable alerts.
-- ---------------------------------------------------------------------------
create table if not exists public.stripe_webhook_operational_alerts (
  id uuid primary key default gen_random_uuid(),
  alert_key text not null unique,
  alert_type text not null,
  alert_status text not null default 'open',
  severity text not null default 'warning',
  message text not null,
  details jsonb not null default '{}'::jsonb,
  first_detected_at timestamptz not null default now(),
  last_detected_at timestamptz not null default now(),
  acknowledged_by_profile_id uuid references public.profiles(id) on delete set null,
  acknowledged_at timestamptz,
  resolved_by_profile_id uuid references public.profiles(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (alert_type in ('repeated_delivery_failure','stale_delivery','configuration_gap')),
  check (alert_status in ('open','acknowledged','resolved')),
  check (severity in ('info','warning','critical'))
);
create index if not exists stripe_webhook_operational_alerts_queue_idx
  on public.stripe_webhook_operational_alerts(alert_status, severity, last_detected_at desc);

create or replace function public.ywi_refresh_stripe_webhook_alerts()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_failed_count integer := 0;
  v_last_event timestamptz;
  v_result jsonb := '[]'::jsonb;
begin
  select count(*)::int, max(created_at) into v_failed_count, v_last_event
  from public.stripe_webhook_delivery_events
  where created_at >= now() - interval '30 minutes'
    and delivery_status='failed'
    and validation_status='failed';

  if v_failed_count >= 3 then
    insert into public.stripe_webhook_operational_alerts(alert_key, alert_type, alert_status, severity, message, details, first_detected_at, last_detected_at, updated_at)
    values ('stripe-repeated-delivery-failure', 'repeated_delivery_failure', 'open', 'critical',
      'Three or more Stripe webhook deliveries failed validation or processing in the last 30 minutes.',
      jsonb_build_object('failure_count_30m',v_failed_count), now(), now(), now())
    on conflict (alert_key) do update set alert_status='open', severity='critical', message=excluded.message,
      details=excluded.details, last_detected_at=now(), updated_at=now(), resolved_at=null, resolved_by_profile_id=null;
    v_result := v_result || jsonb_build_array('repeated_delivery_failure');
  end if;

  if v_last_event is not null and v_last_event < now() - interval '48 hours' then
    insert into public.stripe_webhook_operational_alerts(alert_key, alert_type, alert_status, severity, message, details, first_detected_at, last_detected_at, updated_at)
    values ('stripe-stale-delivery', 'stale_delivery', 'open', 'warning',
      'No recorded Stripe webhook delivery has arrived for more than 48 hours. Confirm whether this is expected and review the Stripe endpoint.',
      jsonb_build_object('last_event_at',v_last_event), now(), now(), now())
    on conflict (alert_key) do update set alert_status='open', severity='warning', message=excluded.message,
      details=excluded.details, last_detected_at=now(), updated_at=now(), resolved_at=null, resolved_by_profile_id=null;
    v_result := v_result || jsonb_build_array('stale_delivery');
  end if;
  return jsonb_build_object('alerts_refreshed',v_result,'failed_count_30m',v_failed_count,'last_event_at',v_last_event);
end;
$$;

create or replace view public.v_stripe_webhook_alert_queue as
select id, alert_key, alert_type, alert_status, severity, message, details,
       first_detected_at, last_detected_at, acknowledged_at, resolved_at
from public.stripe_webhook_operational_alerts
where alert_status in ('open','acknowledged')
order by case severity when 'critical' then 1 when 'warning' then 2 else 3 end, last_detected_at desc;

-- ---------------------------------------------------------------------------
-- Private review media. The public-assets bucket stays public only for approved
-- copies. Uploads start in review-assets; operations-manage promotes them after
-- consent/readiness approval.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('review-assets','review-assets',false,8388608,array['image/webp','image/jpeg','image/png'])
on conflict (id) do update set public=false, file_size_limit=excluded.file_size_limit, allowed_mime_types=excluded.allowed_mime_types;

update storage.buckets set public=true where id='public-assets';

alter table public.visual_asset_approval_items
  add column if not exists review_storage_bucket text,
  add column if not exists review_storage_path text,
  add column if not exists review_thumbnail_path text,
  add column if not exists published_storage_bucket text,
  add column if not exists published_storage_path text,
  add column if not exists published_thumbnail_path text,
  add column if not exists published_at timestamptz;

-- Tables are accessed through service-role Edge Functions. Direct browser
-- access is denied; public delivery happens only through approved public URLs.
alter table public.visual_asset_approval_items enable row level security;
alter table public.accountant_handoff_exports enable row level security;
alter table public.estimate_quote_packages enable row level security;
alter table public.customer_deposit_requests enable row level security;
alter table public.operations_staging_fixture_sets enable row level security;
alter table public.operations_staging_fixture_records enable row level security;
alter table public.accountant_export_mapping_rules enable row level security;
alter table public.content_signal_observations enable row level security;
alter table public.stripe_webhook_operational_alerts enable row level security;

revoke all on public.operations_staging_fixture_sets, public.operations_staging_fixture_records,
  public.accountant_export_mapping_rules, public.content_signal_observations,
  public.stripe_webhook_operational_alerts from anon, authenticated;

create or replace function public.ywi_security_policy_assertions()
returns table(assertion_key text, assertion_status text, details text)
language sql
security definer
set search_path = public, storage, pg_catalog
as $$
  with required_tables(table_name) as (
    values ('visual_asset_approval_items'),('accountant_handoff_exports'),('estimate_quote_packages'),
           ('customer_deposit_requests'),('operations_staging_fixture_sets'),('content_signal_observations')
  ), checks as (
    select 'review_assets_private'::text as assertion_key,
      case when exists(select 1 from storage.buckets where id='review-assets' and public=false) then 'passed' else 'failed' end as assertion_status,
      'Review uploads must remain in a private bucket until approved.'::text as details
    union all select 'accountant_exports_private', case when exists(select 1 from storage.buckets where id='accountant-exports' and public=false) then 'passed' else 'failed' end,
      'Accountant ZIP packages must remain private and use signed downloads.'
    union all select 'public_assets_bucket_present', case when exists(select 1 from storage.buckets where id='public-assets' and public=true) then 'passed' else 'failed' end,
      'Public assets may be public only after the approval-copy workflow promotes them.'
    union all select 'sensitive_tables_rls_enabled', case when not exists(
      select 1 from required_tables r left join pg_class c on c.relname=r.table_name and c.relnamespace='public'::regnamespace where coalesce(c.relrowsecurity,false)=false
    ) then 'passed' else 'failed' end,
      'Sensitive direct-data tables must have Row Level Security enabled.'
    union all select 'portal_rpc_not_public', case when not exists(
      select 1 from information_schema.routine_privileges rp
      where rp.routine_schema='public' and rp.routine_name='ywi_rpc_accept_quote_package' and rp.grantee in ('anon','authenticated') and rp.privilege_type='EXECUTE'
    ) then 'passed' else 'failed' end,
      'Portal conversion RPC is callable only through the token-validating service function.'
  ) select * from checks;
$$;

create or replace view public.v_security_policy_assertion_summary as
select count(*)::int as assertion_count,
       count(*) filter (where assertion_status='passed')::int as passed_count,
       count(*) filter (where assertion_status='failed')::int as failed_count,
       coalesce(jsonb_agg(jsonb_build_object('assertion_key',assertion_key,'assertion_status',assertion_status,'details',details) order by assertion_key), '[]'::jsonb) as assertions,
       count(*) filter (where assertion_status='failed')=0 as policy_ready
from public.ywi_security_policy_assertions();

-- ---------------------------------------------------------------------------
-- Staging fixture RPCs. They create only records tagged STAGING-* and can only
-- run through the service role after an admin-profile rank check.
-- ---------------------------------------------------------------------------
create or replace function public.ywi_rpc_create_staging_fixture_set(
  p_actor_profile_id uuid,
  p_fixture_label text default 'STAGING-RPC'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_label text;
  v_suffix text;
  v_set public.operations_staging_fixture_sets%rowtype;
  v_cash_account_id uuid;
  v_client_id uuid;
  v_vendor_id uuid;
  v_bank_id uuid;
  v_invoice_id uuid;
  v_bill_id uuid;
  v_estimate_id uuid;
  v_quote_id uuid;
  v_preview_id uuid;
  v_portal_token text;
  v_key text;
begin
  perform public.ywi_require_rpc_rank(p_actor_profile_id,45,'create staging fixtures');
  v_label := upper(regexp_replace(trim(coalesce(p_fixture_label,'')), '[^A-Z0-9_-]+', '-', 'g'));
  if v_label !~ '^STAGING-[A-Z0-9_-]{3,80}$' then
    raise exception 'Fixture label must start with STAGING- and contain only letters, numbers, underscores, or dashes.' using errcode='23514';
  end if;
  v_suffix := to_char(clock_timestamp(),'YYYYMMDDHH24MISSMS') || '-' || substr(gen_random_uuid()::text,1,8);
  v_key := lower(v_label || '-' || v_suffix);
  insert into public.operations_staging_fixture_sets(fixture_key, fixture_label, environment_label, fixture_status, created_by_profile_id, summary)
  values(v_key, v_label, 'staging', 'created', p_actor_profile_id, jsonb_build_object('schema',153,'build','2026-06-22a'))
  returning * into v_set;

  select id into v_cash_account_id from public.chart_of_accounts
  where is_active is true and lower(coalesce(system_code,'')) in ('cash','bank')
  order by case when lower(coalesce(system_code,''))='cash' then 0 else 1 end, account_number limit 1;

  insert into public.bank_accounts(account_name, institution_name, currency_code, account_mask, account_status, gl_account_id, is_default, notes, created_by_profile_id)
  values (v_label || ' Fixture Bank ' || v_suffix, 'STAGING ONLY', 'CAD', '0000', 'open', v_cash_account_id, false, 'Disposable fixture set ' || v_set.id, p_actor_profile_id)
  returning id into v_bank_id;
  insert into public.operations_staging_fixture_records(fixture_set_id,entity_type,entity_id,entity_reference)
  values(v_set.id,'bank_account',v_bank_id::text,v_label || '-BANK');

  insert into public.clients(client_code, legal_name, display_name, client_type, billing_email, phone, city, province, postal_code, notes)
  values (left(v_label || '-CLIENT-' || v_suffix,80), v_label || ' Fixture Customer ' || v_suffix, v_label || ' Fixture Customer', 'customer', 'staging-' || substr(v_suffix,1,8) || '@example.invalid', '555-0100', 'Tillsonburg', 'ON', 'N4G0A0', 'Disposable staging fixture set ' || v_set.id)
  returning id into v_client_id;
  insert into public.operations_staging_fixture_records(fixture_set_id,entity_type,entity_id,entity_reference)
  values(v_set.id,'client',v_client_id::text,v_label || '-CLIENT');

  insert into public.ap_vendors(vendor_code, legal_name, display_name, contact_email, notes)
  values(left(v_label || '-VENDOR-' || v_suffix,80), v_label || ' Fixture Vendor ' || v_suffix, v_label || ' Fixture Vendor', 'staging-vendor-' || substr(v_suffix,1,8) || '@example.invalid', 'Disposable staging fixture set ' || v_set.id)
  returning id into v_vendor_id;
  insert into public.operations_staging_fixture_records(fixture_set_id,entity_type,entity_id,entity_reference)
  values(v_set.id,'vendor',v_vendor_id::text,v_label || '-VENDOR');

  insert into public.ar_invoices(invoice_number, client_id, invoice_status, invoice_date, due_date, subtotal, tax_total, total_amount, balance_due, created_by_profile_id)
  values(left(v_label || '-AR-' || v_suffix,100),v_client_id,'draft',current_date,current_date+30,100.00,13.00,113.00,113.00,p_actor_profile_id)
  returning id into v_invoice_id;
  insert into public.operations_staging_fixture_records(fixture_set_id,entity_type,entity_id,entity_reference)
  values(v_set.id,'ar_invoice',v_invoice_id::text,v_label || '-AR');

  insert into public.ap_bills(bill_number, vendor_id, bill_status, bill_date, due_date, subtotal, tax_total, total_amount, balance_due, created_by_profile_id)
  values(left(v_label || '-AP-' || v_suffix,100),v_vendor_id,'draft',current_date,current_date+30,80.00,10.40,90.40,90.40,p_actor_profile_id)
  returning id into v_bill_id;
  insert into public.operations_staging_fixture_records(fixture_set_id,entity_type,entity_id,entity_reference)
  values(v_set.id,'ap_bill',v_bill_id::text,v_label || '-AP');

  insert into public.estimates(estimate_number, client_id, estimate_type, status, valid_until, subtotal, tax_total, total_amount, scope_notes, terms_notes, created_by_profile_id)
  values(left(v_label || '-QUOTE-' || v_suffix,100),v_client_id,'service','draft',current_date+30,200.00,26.00,226.00,'Disposable staging quote fixture.','Staging-only terms; do not use for a real customer.',p_actor_profile_id)
  returning id into v_estimate_id;
  insert into public.estimate_quote_packages(estimate_id, package_status, rendered_title, rendered_html, client_email, created_by_profile_id)
  values(v_estimate_id,'sent',v_label || ' Fixture Quote','<p>STAGING fixture quote only.</p>','staging-' || substr(v_suffix,1,8) || '@example.invalid',p_actor_profile_id)
  returning id, public_token into v_quote_id, v_portal_token;
  insert into public.operations_staging_fixture_records(fixture_set_id,entity_type,entity_id,entity_reference,metadata)
  values(v_set.id,'estimate',v_estimate_id::text,v_label || '-QUOTE',jsonb_build_object('portal_token',v_portal_token)),
        (v_set.id,'quote_package',v_quote_id::text,v_label || '-PORTAL',jsonb_build_object('portal_token',v_portal_token));

  insert into public.bank_csv_import_previews(import_key, original_filename, bank_account_hint, preview_status, header_json, total_rows, accepted_rows, rejected_rows, duplicate_rows, validation_summary, created_by_profile_id, bank_account_id, metadata)
  values(left(v_label || '-CSV-' || v_suffix,160),v_label || '-bank.csv',v_label || ' Fixture Bank','preview',jsonb_build_array('Date','Description','Amount','Reference'),1,1,0,0,jsonb_build_object('fixture_set_id',v_set.id,'staging_only',true),p_actor_profile_id,v_bank_id,jsonb_build_object('fixture_set_id',v_set.id,'staging_only',true))
  returning id into v_preview_id;
  insert into public.bank_csv_import_preview_rows(import_id,row_number,row_status,transaction_date,description,amount,debit_amount,credit_amount,reference,duplicate_key,raw_row)
  values(v_preview_id,1,'accepted',current_date,v_label || ' fixture bank receipt',113.00,113.00,0,left(v_label || '-BANK-ROW-' || v_suffix,160),left(v_label || '-BANK-DUP-' || v_suffix,160),jsonb_build_object('fixture_set_id',v_set.id,'Date',current_date,'Description',v_label || ' fixture bank receipt','Amount',113.00));
  insert into public.operations_staging_fixture_records(fixture_set_id,entity_type,entity_id,entity_reference)
  values(v_set.id,'bank_csv_import_preview',v_preview_id::text,v_label || '-CSV');

  update public.operations_staging_fixture_sets
  set summary=jsonb_build_object('schema',153,'build','2026-06-22a','bank_account_id',v_bank_id,'client_id',v_client_id,'vendor_id',v_vendor_id,'ar_invoice_id',v_invoice_id,'ap_bill_id',v_bill_id,'estimate_id',v_estimate_id,'quote_package_id',v_quote_id,'portal_token',v_portal_token,'bank_import_id',v_preview_id), fixture_status='in_use'
  where id=v_set.id;

  return jsonb_build_object('fixture_set_id',v_set.id,'fixture_key',v_set.fixture_key,'fixture_label',v_label,'bank_account_id',v_bank_id,'client_id',v_client_id,'vendor_id',v_vendor_id,'ar_invoice_id',v_invoice_id,'ap_bill_id',v_bill_id,'estimate_id',v_estimate_id,'quote_package_id',v_quote_id,'portal_token',v_portal_token,'bank_import_id',v_preview_id);
end;
$$;

create or replace function public.ywi_rpc_cleanup_staging_fixture_set(
  p_fixture_set_id uuid,
  p_actor_profile_id uuid,
  p_cleanup_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_set public.operations_staging_fixture_sets%rowtype;
  v_bank_id uuid;
  v_client_id uuid;
  v_vendor_id uuid;
  v_invoice_id uuid;
  v_bill_id uuid;
  v_estimate_id uuid;
  v_quote_id uuid;
  v_preview_id uuid;
  v_session_id uuid;
  v_statement_id uuid;
  v_deleted jsonb := '{}'::jsonb;
begin
  perform public.ywi_require_rpc_rank(p_actor_profile_id,45,'clean staging fixtures');
  select * into v_set from public.operations_staging_fixture_sets where id=p_fixture_set_id for update;
  if not found or v_set.environment_label <> 'staging' or v_set.fixture_label not like 'STAGING-%' then
    raise exception 'Only a tracked STAGING fixture set can be cleaned.' using errcode='23514';
  end if;
  if v_set.fixture_status='cleaned' then return jsonb_build_object('fixture_set_id',v_set.id,'already_cleaned',true); end if;

  select entity_id::uuid into v_bank_id from public.operations_staging_fixture_records where fixture_set_id=v_set.id and entity_type='bank_account';
  select entity_id::uuid into v_client_id from public.operations_staging_fixture_records where fixture_set_id=v_set.id and entity_type='client';
  select entity_id::uuid into v_vendor_id from public.operations_staging_fixture_records where fixture_set_id=v_set.id and entity_type='vendor';
  select entity_id::uuid into v_invoice_id from public.operations_staging_fixture_records where fixture_set_id=v_set.id and entity_type='ar_invoice';
  select entity_id::uuid into v_bill_id from public.operations_staging_fixture_records where fixture_set_id=v_set.id and entity_type='ap_bill';
  select entity_id::uuid into v_estimate_id from public.operations_staging_fixture_records where fixture_set_id=v_set.id and entity_type='estimate';
  select entity_id::uuid into v_quote_id from public.operations_staging_fixture_records where fixture_set_id=v_set.id and entity_type='quote_package';
  select entity_id::uuid into v_preview_id from public.operations_staging_fixture_records where fixture_set_id=v_set.id and entity_type='bank_csv_import_preview';

  select reconciliation_session_id, statement_import_id into v_session_id, v_statement_id from public.bank_csv_import_previews where id=v_preview_id;
  delete from public.reconciliation_action_requests where import_id=v_preview_id or reconciliation_item_id in (select id from public.bank_reconciliation_items where reconciliation_session_id=v_session_id);
  delete from public.bank_reconciliation_items where reconciliation_session_id=v_session_id;
  delete from public.bank_reconciliation_sessions where id=v_session_id;
  delete from public.bank_statement_imports where id=v_statement_id;
  delete from public.bank_csv_import_previews where id=v_preview_id;

  delete from public.customer_deposit_requests where quote_package_id=v_quote_id;
  delete from public.customer_portal_events where quote_package_id=v_quote_id;
  delete from public.quote_package_client_events where quote_package_id=v_quote_id;
  delete from public.estimate_quote_packages where id=v_quote_id;
  delete from public.work_orders where estimate_id=v_estimate_id and work_order_number like 'WO-%';
  delete from public.estimates where id=v_estimate_id;
  delete from public.payment_action_requests where ar_invoice_id=v_invoice_id or ap_bill_id=v_bill_id;
  delete from public.ar_invoices where id=v_invoice_id;
  delete from public.ap_bills where id=v_bill_id;
  delete from public.clients where id=v_client_id;
  delete from public.ap_vendors where id=v_vendor_id;
  delete from public.bank_accounts where id=v_bank_id and account_name like 'STAGING%';

  update public.operations_staging_fixture_sets
  set fixture_status='cleaned', cleaned_at=now(), cleaned_by_profile_id=p_actor_profile_id,
      cleanup_notes=left(coalesce(p_cleanup_note,'Cleaned through ywi_rpc_cleanup_staging_fixture_set.'),1000)
  where id=v_set.id;
  return jsonb_build_object('fixture_set_id',v_set.id,'cleaned',true);
exception when others then
  update public.operations_staging_fixture_sets set fixture_status='cleanup_failed', cleanup_notes=left(sqlerrm,1000) where id=p_fixture_set_id;
  raise;
end;
$$;

create or replace function public.ywi_rpc_capture_accountant_close_snapshot(
  p_export_id uuid,
  p_period_close_id uuid,
  p_actor_profile_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_export public.accountant_handoff_exports%rowtype;
  v_close public.accounting_period_closes%rowtype;
  v_mappings jsonb;
  v_readiness record;
begin
  perform public.ywi_require_rpc_rank(p_actor_profile_id,45,'capture accountant close snapshot');
  select * into v_export from public.accountant_handoff_exports where id=p_export_id for update;
  if not found then raise exception 'Accountant export was not found.' using errcode='P0002'; end if;
  if p_period_close_id is not null then select * into v_close from public.accounting_period_closes where id=p_period_close_id; end if;
  select coalesce(jsonb_agg(jsonb_build_object('mapping_key',mapping_key,'source_key',source_key,'target_label',target_label,'account_id',account_id,'reporting_group',reporting_group,'review_status',review_status) order by mapping_key),'[]'::jsonb)
    into v_mappings from public.accountant_export_mapping_rules where is_active;
  select * into v_readiness from public.v_accountant_mapping_readiness;
  update public.accountant_handoff_exports
  set source_period_close_id=coalesce(p_period_close_id,source_period_close_id), mapping_snapshot=v_mappings,
      close_checklist_snapshot=coalesce(v_close.close_checklist,'{}'::jsonb) || jsonb_build_object('mapping_ready',v_readiness.mapping_ready,'mapping_message',v_readiness.mapping_message),
      mapping_reviewed_at=now(), mapping_reviewed_by_profile_id=p_actor_profile_id, updated_at=now()
  where id=v_export.id returning * into v_export;
  return jsonb_build_object('export_id',v_export.id,'mapping_ready',v_readiness.mapping_ready,'mapping_message',v_readiness.mapping_message,'period_close_id',p_period_close_id);
end;
$$;

-- The package readiness view now includes mapping review status. Existing base
-- accounting/reconciliation blockers from schema 152 remain unchanged.
create or replace view public.v_accountant_export_readiness as
with payments as (
  select count(*) filter (where action_status='approved' and posting_status <> 'posted')::int as approved_payment_actions_pending,
         count(*) filter (where posting_status='failed')::int as failed_payment_actions
  from public.payment_action_requests
), reconciliation as (
  select count(*) filter (where clearing_status='open')::int as open_bank_items,
         count(*) filter (where match_status in ('unmatched','exception'))::int as unresolved_bank_items
  from public.bank_reconciliation_items
), periods as (
  select count(*) filter (where close_status in ('in_review','closed'))::int as locked_period_count
  from public.accounting_period_closes
), latest as (
  select id, export_status, export_title, generated_at, artifact_storage_path, artifact_expires_at
  from public.accountant_handoff_exports order by generated_at desc nulls last, created_at desc limit 1
), mappings as (
  select * from public.v_accountant_mapping_readiness
)
select p.approved_payment_actions_pending, p.failed_payment_actions, r.open_bank_items, r.unresolved_bank_items,
  pr.locked_period_count, m.required_mapping_count, m.approved_mapping_count, m.unresolved_required_mapping_count,
  m.mapping_ready, m.mapping_message, m.unresolved_mappings,
  l.id as latest_export_id, l.export_status as latest_export_status, l.export_title as latest_export_title,
  l.generated_at as latest_export_generated_at, l.artifact_storage_path as latest_export_storage_path, l.artifact_expires_at as latest_export_expires_at,
  case when p.approved_payment_actions_pending=0 and p.failed_payment_actions=0 and r.unresolved_bank_items=0 and m.mapping_ready then true else false end as package_ready,
  case when p.approved_payment_actions_pending=0 and p.failed_payment_actions=0 and r.unresolved_bank_items=0 and m.mapping_ready
       then 'Accounting workbench and required mapping review are ready for accountant package generation.'
       else 'Resolve payment/reconciliation exceptions and required mapping review before treating the accountant package as final.' end as readiness_message
from payments p cross join reconciliation r cross join periods pr cross join mappings m left join latest l on true;

-- Expand the server-provided capability snapshot for the schema 153 release
-- queues. The UI is explanatory only; Edge/RPC rank checks remain authoritative.
create or replace function public.ywi_get_operations_capabilities(p_actor_profile_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_role text := lower(coalesce((select role from public.profiles where id = p_actor_profile_id and coalesce(is_active,true) is true), ''));
  v_rank integer := coalesce(public.ywi_profile_rank(p_actor_profile_id), 0);
  v_actions jsonb;
begin
  select coalesce(jsonb_object_agg(action_key,
    jsonb_build_object(
      'label', label,
      'minimum_role', minimum_role,
      'minimum_rank', minimum_rank,
      'permitted', v_rank >= minimum_rank,
      'reason', case when v_rank >= minimum_rank then 'Allowed for your role.' else 'Requires ' || replace(minimum_role, '_', ' ') || ' or higher.' end
    )
  ), '{}'::jsonb)
  into v_actions
  from (values
    ('payment_action_request','Create payment action','job_admin',45),
    ('payment_action_decision','Approve, reject, or post payment','job_admin',45),
    ('bank_csv_preview','Parse bank CSV','job_admin',45),
    ('bank_csv_confirm_import','Promote confirmed bank rows','job_admin',45),
    ('reconciliation_action','Process reconciliation','job_admin',45),
    ('equipment_scan_event','Record equipment custody scan','site_leader',20),
    ('equipment_cost_recovery_decision','Approve equipment recovery','job_admin',45),
    ('visual_asset_register','Register visual asset','supervisor',30),
    ('visual_asset_decision','Approve or reject visual asset','job_admin',45),
    ('public_route_register','Save public route','job_admin',45),
    ('public_route_decision','Approve or reject public route','job_admin',45),
    ('public_route_publish','Publish public route and sitemap','job_admin',45),
    ('quote_owner_assign','Assign quote owner','supervisor',30),
    ('quote_followup_event','Record quote follow-up','supervisor',30),
    ('dispatch_schedule','Dispatch work order','supervisor',30),
    ('job_cost_refresh','Refresh live job cost','supervisor',30),
    ('accountant_export_prepare','Generate accountant package','job_admin',45),
    ('staging_fixture_create','Create disposable staging fixture','job_admin',45),
    ('staging_fixture_cleanup','Clean disposable staging fixture','job_admin',45),
    ('content_signal_record','Record search/local performance evidence','job_admin',45),
    ('content_signal_decision','Decide route/content follow-up','job_admin',45),
    ('stripe_webhook_alert_decision','Acknowledge or resolve webhook alert','job_admin',45)
  ) as permissions(action_key, label, minimum_role, minimum_rank);
  return jsonb_build_object('actor_profile_id',p_actor_profile_id,'actor_role',coalesce(v_role,'unknown'),'actor_rank',v_rank,'actions',v_actions,'generated_at',now());
end;
$$;

-- Schema marker and minimum grants. Browser clients use Edge Functions; these
-- RPCs stay service-role-only.
drop view if exists public.v_schema_drift_status;
create view public.v_schema_drift_status as
select 153::int as expected_schema_version,
  coalesce(max(schema_version) filter (where status='applied'),0)::int as latest_applied_schema_version,
  case when coalesce(max(schema_version) filter (where status='applied'),0)>=153 then 'current' else 'behind' end as drift_status,
  case when coalesce(max(schema_version) filter (where status='applied'),0)>=153
    then 'Live database is at or ahead of the repo schema marker.'
    else 'Live database is behind the deployed app. Apply migrations through schema 153.' end as message,
  now() as checked_at
from public.app_schema_versions;

insert into public.app_schema_versions(schema_version,migration_key,schema_name,release_label,description,status,notes)
values(153,'153_release_fixture_policy_mapping_seo_alerts','153_release_fixture_policy_mapping_seo_alerts.sql','2026-06-22a',
  'Adds disposable staging fixtures/cleanup, policy assertions, private media review promotion, accountant mapping snapshots, route signal decisions, and Stripe webhook operational alerts.',
  'applied','Schema 153 turns staging proof into seeded repeatable tests, gates unapproved media in a private bucket, and adds accountant/SEO/payment operational review queues.')
on conflict (schema_version) do update set migration_key=excluded.migration_key,schema_name=excluded.schema_name,release_label=excluded.release_label,description=excluded.description,status=excluded.status,notes=excluded.notes,applied_at=now();

revoke all on function public.ywi_rpc_create_staging_fixture_set(uuid,text) from public;
revoke all on function public.ywi_rpc_cleanup_staging_fixture_set(uuid,uuid,text) from public;
revoke all on function public.ywi_rpc_capture_accountant_close_snapshot(uuid,uuid,uuid) from public;
revoke all on function public.ywi_security_policy_assertions() from public;
grant execute on function public.ywi_rpc_create_staging_fixture_set(uuid,text) to service_role;
grant execute on function public.ywi_rpc_cleanup_staging_fixture_set(uuid,uuid,text) to service_role;
grant execute on function public.ywi_rpc_capture_accountant_close_snapshot(uuid,uuid,uuid) to service_role;
grant execute on function public.ywi_security_policy_assertions() to service_role;
-- Cockpit and portal data are read through authenticated Edge Functions using
-- service-role credentials. Do not expose operational health queues directly.
revoke all on public.v_accountant_mapping_readiness, public.v_route_content_decision_queue,
  public.v_stripe_webhook_alert_queue, public.v_security_policy_assertion_summary from anon, authenticated;

commit;
