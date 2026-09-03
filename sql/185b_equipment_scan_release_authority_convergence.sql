-- 185b_equipment_scan_release_authority_convergence.sql
-- Build 2026-09-02q closeout repair
--
-- Schema 185 introduced the equipment scanner/custody contracts but the inherited
-- release-authority schema marker still expected 184. This bounded repair advances
-- only that canonical marker. Existing source-evidence/release-authority views derive
-- their expected schema from v_schema_drift_status and therefore automatically require
-- exact-main Schema 185 evidence after this change.
--
-- No business data, Finance posting/mapping, payment provider, Jobs operational record,
-- equipment record, or Production promotion is mutated here.

begin;

create or replace view public.v_schema_drift_status
with (security_invoker=true)
as
select
  185::int as expected_schema_version,
  coalesce(max(schema_version) filter(where status='applied'),0)::int as latest_applied_schema_version,
  case
    when coalesce(max(schema_version) filter(where status='applied'),0) >= 185 then 'current'
    else 'behind'
  end::text as drift_status,
  case
    when coalesce(max(schema_version) filter(where status='applied'),0) >= 185
      then 'Live database is at or ahead of the repo schema marker.'
    else 'Live database is behind the deployed app. Apply migrations through schema 185 in order.'
  end::text as message,
  now() as checked_at
from public.app_schema_versions;

revoke all on table public.v_schema_drift_status from public,anon,authenticated;
grant select on table public.v_schema_drift_status to service_role;

update public.app_schema_versions
set notes=concat_ws(' ',nullif(notes,''),
    'Build 185 release-authority convergence advances v_schema_drift_status to expected Schema 185; exact-main source evidence is required before final release closure.'),
    applied_at=applied_at
where schema_version=185
  and migration_key='185_equipment_scan_identity_custody_hardening';

commit;
