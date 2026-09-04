begin;

-- Search discovery quality remains a technical release concern only.
-- This migration does not publish content, submit URLs to external providers,
-- close human/content/staging rails, or enable Finance/provider execution.

create or replace function public.ywi_search_discovery_quality_assertions()
returns table(assertion_key text, assertion_status text, assertion_detail text)
language sql security definer set search_path=public,pg_temp as $$
  select 'prior_public_authority_green',
    case when not exists(select 1 from public.ywi_public_web_authority_release_assertions() where assertion_status<>'passed') then 'passed' else 'failed' end,
    'Existing canonical/noindex/public-authority assertions remain green.'
  union all select 'active_sitemap_canonical_origin',
    case when not exists(
      select 1 from public.public_sitemap_entries
      where entry_status='active'
        and canonical_url not like 'https://yardweasels.ca/%'
    ) then 'passed' else 'failed' end,
    'Every active sitemap entry uses the canonical yardweasels.ca authority.'
  union all select 'active_sitemap_route_matches_canonical',
    case when not exists(
      select 1 from public.public_sitemap_entries
      where entry_status='active'
        and regexp_replace(regexp_replace(canonical_url,'^https://yardweasels\.ca',''),'/+$','')
            <> regexp_replace(route_path,'/+$','')
    ) then 'passed' else 'failed' end,
    'Every active sitemap canonical resolves to the same approved route path.'
  union all select 'active_sitemap_lastmod_truthful',
    case when not exists(
      select 1 from public.public_sitemap_entries
      where entry_status='active'
        and (last_modified is null or last_modified>current_date)
    ) then 'passed' else 'failed' end,
    'Active sitemap freshness is present and never future-dated.'
  union all select 'open_business_acceptance_unchanged',
    case when (select count(*) from public.v_it_open_rail_acceptance_readiness where rail_status<>'complete')=11 then 'passed' else 'failed' end,
    'All 11 human/provider/accounting/content/staging acceptance rails remain open.'
  union all select 'finance_provider_execution_off',
    case when not exists(
      select 1 from public.finance_job_completion_posting_execution_controls
      where execution_enabled=true or provider_mutation_enabled=true
    ) then 'passed' else 'failed' end,
    'Finance posting execution and provider mutation remain OFF.';
$$;
revoke all on function public.ywi_search_discovery_quality_assertions() from public,anon,authenticated;
grant execute on function public.ywi_search_discovery_quality_assertions() to service_role;

insert into public.it_readiness_check_registry(
  check_key,check_group,check_title,severity_if_failed,action_hint,route_hint,sort_order,is_enabled
)
values(
  'search_discovery_quality',
  'SEO / Public Web',
  'Canonical sitemap freshness and structured discovery contract',
  'error',
  'Keep sitemap canonicals aligned to approved routes, use truthful lastmod, preserve one-H1/canonical/noindex phone-desktop acceptance, and keep external search-engine submission explicit rather than automatic.',
  'Admin > I.T. Readiness',
  48,
  true
)
on conflict(check_key) do update set
  check_group=excluded.check_group,
  check_title=excluded.check_title,
  severity_if_failed=excluded.severity_if_failed,
  action_hint=excluded.action_hint,
  route_hint=excluded.route_hint,
  sort_order=excluded.sort_order,
  is_enabled=excluded.is_enabled,
  updated_at=now();

insert into public.admin_scorecard_progress_rails(
  rail_key,rail_area,rail_title,rail_status,progress_percent,current_value,target_value,
  next_action_hint,owner_hint,sort_order,metadata
)
values(
  'schema196_search_discovery_quality',
  'growth',
  'Search discovery, sitemap freshness and structured-data parity',
  'active',80,8,10,
  'Verify canonical/sitemap conflict handling, truthful home and route lastmod, static/runtime Breadcrumb structured-data parity, permanent source/browser gates, Schema 196 convergence, dev/main accepted-tree parity, release evidence and cleanup. Do not publish unapproved routes or submit URLs externally as part of this technical rail.',
  'Growth / Admin / I.T. / Release',
  116,
  jsonb_build_object(
    'schema',196,
    'business_rail_auto_close',false,
    'content_publish',false,
    'search_engine_submission',false,
    'finance_mutation',false,
    'payment_provider_mutation',false,
    'production_promotion',false
  )
)
on conflict(rail_key) do update set
  rail_area=excluded.rail_area,
  rail_title=excluded.rail_title,
  rail_status=excluded.rail_status,
  progress_percent=excluded.progress_percent,
  current_value=excluded.current_value,
  target_value=excluded.target_value,
  next_action_hint=excluded.next_action_hint,
  owner_hint=excluded.owner_hint,
  sort_order=excluded.sort_order,
  metadata=excluded.metadata,
  updated_at=now();

insert into public.it_scorecard_rail_resolution_contracts(
  rail_key,resolution_class,requires_human,requires_external,auto_close_allowed,resolution_note,introduced_by_schema
)
values(
  'schema196_search_discovery_quality',
  'build_acceptance',false,false,false,
  'Close only after search-discovery assertions, exact source/browser GREEN, schema convergence, dev/main accepted-tree parity, release evidence and cleanup. External indexing submission and human route/content approval remain separate.',
  196
)
on conflict(rail_key) do update set
  resolution_class=excluded.resolution_class,
  requires_human=excluded.requires_human,
  requires_external=excluded.requires_external,
  auto_close_allowed=excluded.auto_close_allowed,
  resolution_note=excluded.resolution_note,
  introduced_by_schema=excluded.introduced_by_schema,
  updated_at=now();

create or replace view public.v_schema_drift_status with (security_invoker=true) as
select 196::int as expected_schema_version,
       coalesce(max(schema_version) filter(where status='applied'),0)::int as latest_applied_schema_version,
       case when coalesce(max(schema_version) filter(where status='applied'),0)>=196 then 'current' else 'behind' end::text as drift_status,
       case when coalesce(max(schema_version) filter(where status='applied'),0)>=196 then 'Live database is at or ahead of the repo schema marker.' else 'Live database is behind the deployed app. Apply migrations through the current schema in order.' end::text as message,
       now() as checked_at
from public.app_schema_versions;
revoke all on table public.v_schema_drift_status from public,anon,authenticated;
grant select on table public.v_schema_drift_status to service_role;

insert into public.app_schema_versions(
  schema_version,migration_key,schema_name,release_label,description,status,notes
)
values(
  196,
  '196_search_discovery_quality',
  '196_search_discovery_quality.sql',
  '2026-09-03j',
  'Strengthens canonical sitemap/freshness and search-discovery release authority without publishing content or submitting URLs externally.',
  'applied',
  'No business-data mutation. Eleven human/external acceptance rails remain open. Finance/provider execution remains OFF. Search-engine submission remains explicit/manual.'
)
on conflict(schema_version) do update set
  migration_key=excluded.migration_key,
  schema_name=excluded.schema_name,
  release_label=excluded.release_label,
  description=excluded.description,
  status=excluded.status,
  notes=excluded.notes,
  applied_at=now();

commit;
