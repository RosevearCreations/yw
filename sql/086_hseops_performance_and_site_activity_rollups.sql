-- 086_hseops_performance_and_site_activity_rollups.sql
-- Adds lightweight site-activity rollup views for admin/HSE monitoring while
-- the HSE Operations page moves to a reduced selector payload for better runtime performance.

create or replace view public.v_site_activity_type_rollups as
select
  event_type,
  entity_type,
  count(*)::int as total_event_count,
  count(*) filter (where occurred_at >= now() - interval '24 hours')::int as last_24h_event_count,
  count(*) filter (where severity in ('warning','error') and occurred_at >= now() - interval '24 hours')::int as last_24h_attention_count,
  max(occurred_at) as last_activity_at
from public.site_activity_events
group by event_type, entity_type;

create or replace view public.v_site_activity_entity_rollups as
select
  entity_type,
  count(*)::int as total_event_count,
  count(*) filter (where occurred_at >= now() - interval '24 hours')::int as last_24h_event_count,
  count(*) filter (where severity in ('warning','error') and occurred_at >= now() - interval '24 hours')::int as last_24h_attention_count,
  max(occurred_at) as last_activity_at
from public.site_activity_events
group by entity_type;
