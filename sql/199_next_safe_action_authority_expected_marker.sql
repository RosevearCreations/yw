begin;

-- Schema 199 companion convergence: keep the repository/live drift authority exact.
-- This changes no business data, acceptance state, Auth settings, Finance/provider controls,
-- public content, staging mutation, or Production promotion authority.

create or replace view public.v_schema_drift_status as
select
  199 as expected_schema_version,
  coalesce(max(schema_version) filter (where status='applied'),0) as latest_applied_schema_version,
  case
    when coalesce(max(schema_version) filter (where status='applied'),0) >= 199 then 'current'
    else 'drift'
  end::text as drift_status,
  case
    when coalesce(max(schema_version) filter (where status='applied'),0) >= 199
      then 'Live database is at or ahead of the repo schema marker.'
    else 'Live database is behind the repo schema marker.'
  end::text as message,
  now() as checked_at
from public.app_schema_versions;

revoke all on table public.v_schema_drift_status from public,anon,authenticated;
grant select on table public.v_schema_drift_status to service_role;

commit;
