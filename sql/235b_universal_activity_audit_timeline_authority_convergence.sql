-- Schema 235b — Build 347 release-authority convergence
-- Idempotent repair for environments where Schema 235 feature objects were applied
-- before the app_schema_versions / v_schema_drift_status authority marker was advanced.

begin;

insert into public.app_schema_versions(
  schema_version,schema_name,description,status,applied_at,applied_by,notes,migration_key,release_label
) values(
  235,'universal_activity_audit_timeline',
  'Build 347 adds a permission-aware, read-only universal activity and audit timeline over protected operation audit evidence.',
  'applied',now(),'schema235b',
  'Authority convergence only. No business data mutation; source modules remain authoritative.',
  '235_universal_activity_audit_timeline.sql','schema235'
)
on conflict(schema_version) do update set
  schema_name=excluded.schema_name,description=excluded.description,status='applied',applied_at=now(),
  applied_by=excluded.applied_by,notes=excluded.notes,migration_key=excluded.migration_key,release_label=excluded.release_label;

create or replace view public.v_schema_drift_status
with (security_invoker=true) as
select 235 as expected_schema_version,
  coalesce(max(schema_version) filter(where status='applied'),0) as latest_applied_schema_version,
  case when coalesce(max(schema_version) filter(where status='applied'),0)=235 then 'current'
       when coalesce(max(schema_version) filter(where status='applied'),0)>235 then 'ahead' else 'drift' end as drift_status,
  case when coalesce(max(schema_version) filter(where status='applied'),0)=235 then 'Live database matches the repository schema marker.'
       when coalesce(max(schema_version) filter(where status='applied'),0)>235 then 'Live database is ahead of the repository schema marker.'
       else 'Live database is behind the repository schema marker.' end as message,
  now() as checked_at
from public.app_schema_versions;
revoke all on table public.v_schema_drift_status from public,anon,authenticated;
grant select on table public.v_schema_drift_status to service_role;

select 235 as expected_schema_version;

commit;
