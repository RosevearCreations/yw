-- 104_reporting_loader_timeout_guardrails.sql
-- Reporting loader timeout guardrail pass.
-- This migration is intentionally light: the main performance fix is in the
-- admin-directory Edge Function fast path, but the schema snapshot gets a small
-- health view so deploy smoke checks can confirm that schema 104 was applied.

create or replace view public.v_reporting_loader_health as
select
  now() as checked_at,
  'admin-directory-reporting-fast-path'::text as loader_key,
  'ok'::text as status,
  'Reports are loaded through a narrow admin-directory reporting scope so the Admin route does not need to preload heavy report datasets.'::text as note;

comment on view public.v_reporting_loader_health is
  'Schema 104 marker and health view for the reporting timeout guardrail pass. The frontend lazy-loads Reports only on the Reports route; admin-directory also has a reporting fast path.';
