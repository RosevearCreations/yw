begin;

-- Build 322 / Schema 211 advisor hygiene.
-- Remove the duplicate site/status index discovered after Production convergence,
-- and cover the new actor/profile foreign keys added by Build 322.

drop index if exists public.recurring_service_agreements_site_status_idx;

create index if not exists recurring_service_agreements_paused_by_profile_idx
  on public.recurring_service_agreements(paused_by_profile_id)
  where paused_by_profile_id is not null;

create index if not exists recurring_service_agreements_cancelled_by_profile_idx
  on public.recurring_service_agreements(cancelled_by_profile_id)
  where cancelled_by_profile_id is not null;

create index if not exists recurring_service_visit_events_actor_profile_idx
  on public.recurring_service_visit_events(actor_profile_id)
  where actor_profile_id is not null;

commit;
