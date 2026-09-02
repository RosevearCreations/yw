-- 182_schema181_release_authority_marker_convergence.sql
-- Build 2026-09-02n
-- Maintenance-only convergence repair for the Schema 181 release-authority marker.
-- Schema 181 correctly applied its ledger row but did not advance v_schema_drift_status from 180.
-- This migration changes only schema/release-control-plane metadata and does not mutate business data,
-- Finance mappings, accounting postings, Jobs state, provider/payment truth, or Production promotion.

begin;

create or replace view public.v_schema_drift_status as
select
  182::int as expected_schema_version,
  coalesce(max(schema_version) filter(where status='applied'),0)::int as latest_applied_schema_version,
  case
    when coalesce(max(schema_version) filter(where status='applied'),0)>=182 then 'current'
    else 'behind'
  end::text as drift_status,
  case
    when coalesce(max(schema_version) filter(where status='applied'),0)>=182 then 'Live database is at or ahead of the repo schema marker.'
    else 'Live database is behind the deployed app. Apply migrations through schema 182 in order.'
  end::text as message,
  now() as checked_at
from public.app_schema_versions;

insert into public.it_readiness_check_registry(
  check_key,check_group,check_title,severity_if_failed,action_hint,route_hint,sort_order,is_enabled
) values(
  'schema182_release_authority_marker_convergence','Release','Schema 182 release-authority marker convergence','critical',
  'Verify v_schema_drift_status expects Schema 182, the live ledger includes Schema 182, and exact-main release evidence is recorded for the same schema before declaring release authority green.',
  'Admin > I.T. Readiness > Release authority',52,true
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
) values(
  'schema182_release_authority_marker_convergence','admin','Schema 182 release-authority marker convergence',
  'active',90,9,10,
  'Verify exact-main Schema 182 source proof, apply the maintenance migration, record matching release evidence, and confirm release authority green without changing business data.',
  'I.T.',102,
  jsonb_build_object(
    'schema',182,
    'build','2026-09-02n',
    'maintenance_only',true,
    'schema181_feature_state','complete',
    'business_data_mutation',false,
    'mapping_mutation',false,
    'posting_execution_release_enabled',false,
    'provider_mutation',false,
    'jobs_writeback',false,
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

insert into public.app_schema_versions(
  schema_version,migration_key,schema_name,release_label,description,status,notes
) values(
  182,
  '182_schema181_release_authority_marker_convergence',
  '182_schema181_release_authority_marker_convergence.sql',
  '2026-09-02n',
  'Advances the release-authority schema marker after Schema 181 and preserves the completed Finance mapping-observability feature unchanged.',
  'applied',
  'Maintenance-only authority convergence. No Finance mapping/accounting/Jobs/provider/Production business mutation.'
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