-- 105_repo_cleanup_and_roadmap_refresh.sql
-- Repo cleanup, Markdown archive reset, and roadmap refresh marker.
-- This migration is intentionally light. It gives live deployments a simple
-- schema marker confirming that the 2026-05-10 cleanup/roadmap pass was applied
-- after the reporting timeout guardrail work in schema 104.

create or replace view public.v_repo_cleanup_and_roadmap_health as
select
  now() as checked_at,
  '105_repo_cleanup_and_roadmap_refresh'::text as schema_marker,
  'ok'::text as status,
  20::int as next_roadmap_step_count,
  'Active Markdown was refreshed, older Markdown was archived, obvious temp files were removed, and the next 20 production-readiness steps were documented.'::text as note;

comment on view public.v_repo_cleanup_and_roadmap_health is
  'Schema 105 marker for the 2026-05-10 repository cleanup and next-step roadmap refresh pass.';
