-- 174_finance_dependency_type_convergence.sql
-- Build 2026-09-02f
-- Corrects the applied Schema 173 dependency metadata for the canonical completion-review work-order key.
-- The live relation is UUID-backed. This migration changes I.T. contract metadata only.

begin;

do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema='public'
      and table_name='job_completion_reviews'
      and column_name='work_order_id'
      and data_type='uuid'
  ) then
    raise exception 'Schema 174 requires public.job_completion_reviews.work_order_id to be uuid.';
  end if;

  update public.app_schema_dependency_contracts
  set expected_data_type='uuid',
      notes='Canonical UUID work-order reference backing Finance candidate generation. Schema 174 corrects the Schema 173 metadata-only bigint assumption.',
      updated_at=now()
  where contract_key='completion_review_work_order'
    and relation_schema='public'
    and relation_name='job_completion_reviews'
    and column_name='work_order_id';

  if not found then
    raise exception 'Schema 173 completion_review_work_order dependency contract is missing.';
  end if;
end;
$$;

insert into public.it_readiness_check_registry(
  check_key,check_group,check_title,severity_if_failed,action_hint,route_hint,sort_order,is_enabled
) values(
  'finance_dependency_type_convergence','Architecture','Finance completion-review work-order dependency type is UUID-converged','critical',
  'Require the live work_order_id type and app_schema_dependency_contracts expected type to both resolve to uuid before dependent Finance releases.',
  'Admin > I.T. Readiness',40,true
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

update public.admin_scorecard_progress_rails
set rail_status='complete',progress_percent=100,current_value=4,target_value=4,
    next_action_hint='Schema 174 corrects the completion-review work-order dependency metadata to the canonical UUID type; all registered Schema 172 dependencies must pass live.',
    updated_at=now()
where rail_key='schema173_finance_schema_dependency_guard';

insert into public.admin_scorecard_progress_rails(
  rail_key,rail_area,rail_title,rail_status,progress_percent,current_value,target_value,
  next_action_hint,owner_hint,sort_order,metadata
) values(
  'schema174_finance_dependency_type_convergence','architecture','Finance dependency type convergence','complete',100,3,3,
  'Keep dependency contracts bound to information_schema type evidence before future Finance migrations.',
  'Finance / I.T. / Architecture',94,
  '{"build":"2026-09-02f","schema":174,"contract_key":"completion_review_work_order","canonical_type":"uuid","metadata_only":true,"business_mutation":false,"production_promotion":false}'::jsonb
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
  174,
  '174_finance_dependency_type_convergence',
  '174_finance_dependency_type_convergence.sql',
  '2026-09-02f',
  'Corrects the Finance dependency registry for the canonical UUID job_completion_reviews.work_order_id relation.',
  'applied',
  'Metadata/readiness convergence only. No business event consumption, candidate creation/posting, payment/provider mutation, Jobs writeback, fifth module or Production promotion.'
)
on conflict(schema_version) do update set
  migration_key=excluded.migration_key,
  schema_name=excluded.schema_name,
  release_label=excluded.release_label,
  description=excluded.description,
  status=excluded.status,
  notes=excluded.notes,
  applied_at=now();

create or replace view public.v_schema_drift_status as
select 174::int as expected_schema_version,
  coalesce(max(schema_version) filter(where status='applied'),0)::int as latest_applied_schema_version,
  case when coalesce(max(schema_version) filter(where status='applied'),0)>=174 then 'current' else 'behind' end as drift_status,
  case when coalesce(max(schema_version) filter(where status='applied'),0)>=174
    then 'Live database is at or ahead of the repo schema marker.'
    else 'Live database is behind the deployed app. Apply migrations through schema 174 in order.' end as message,
  now() as checked_at
from public.app_schema_versions;

commit;
