begin;

-- Schema 188 — unified open-rail acceptance readiness and current-action truth.
-- This layer is read-only guidance over the 11 human-gated business rails. It does not
-- create business acceptance evidence, enable Finance/provider mutation, or auto-close rails.

create table if not exists public.it_open_rail_acceptance_runbook (
  rail_key text primary key references public.admin_scorecard_progress_rails(rail_key) on delete restrict,
  guidance_title text not null,
  current_action text not null,
  evidence_requirement text not null,
  sort_order integer not null default 100,
  introduced_by_schema integer not null default 188,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (length(guidance_title) between 3 and 240),
  check (length(current_action) between 10 and 3000),
  check (length(evidence_requirement) between 10 and 3000),
  check (jsonb_typeof(metadata)='object')
);

alter table public.it_open_rail_acceptance_runbook enable row level security;
revoke all on table public.it_open_rail_acceptance_runbook from public,anon,authenticated;
grant select on table public.it_open_rail_acceptance_runbook to service_role;

insert into public.it_open_rail_acceptance_runbook(
  rail_key,guidance_title,current_action,evidence_requirement,sort_order,metadata
) values
('operations_cockpit_live','Run Operations Cockpit staging acceptance',
 'Use a dedicated non-production YardWeasels project. Start the Operations Cockpit Schema 187+ catalog run, complete the runner-owned checks, then record the staging-only Cockpit write-form human case before finalization and explicit signoff.',
 'Evidence must show authorized Cockpit access, lower-rank denial, one safe staging write round trip, cleanup/restoration, finalization, and explicit human signoff. Production data is not valid staging evidence.',10,'{"acceptance_surface":"admin_it","mutation_allowed":"staging_only"}'),
('quote_intake_live','Run quote/contact staging acceptance',
 'Do not redeploy Production or reapply an old schema. Confirm quote-contact-submit is present in the dedicated staging project, then execute the invalid-payload, valid STAGING request, event-history, and fixture-cleanup cases from the acceptance catalog.',
 'Evidence must include the invalid request rejection, exactly one labelled staging quote request, its matching created event, fixture cleanup/retention decision, finalization, and explicit human signoff.',20,'{"stale_hint_override":"deploy quote-contact-submit","mutation_allowed":"staging_only"}'),
('payment_actions_live','Run controlled accounting payment acceptance',
 'Keep Finance posting execution OFF. Use seeded test/accounting acceptance data to review payment permission, journal, posting-proof, exception, reversal/recovery, and reconciliation cases. Resolve any failed case before any later production release decision.',
 'Evidence must be human-reviewed accounting acceptance showing the intended permission outcomes, balanced journal/proof behavior, recovery/reversal behavior, and no unresolved critical reconciliation exception. This build does not authorize posting execution.',30,'{"finance_execution_release":"must_remain_off","provider_mutation":"must_remain_off"}'),
('bank_csv_preview_live','Run controlled bank CSV acceptance',
 'Keep Finance posting execution OFF. Use a labelled test bank import to exercise preview, duplicate/reject handling, exact split or promotion behavior, undo/recovery, and reconciliation signoff without changing production banking data.',
 'Evidence must show the seeded preview and row classifications, controlled promotion/split result, undo or recovery proof, and human reconciliation signoff with no critical exception left unresolved.',40,'{"finance_execution_release":"must_remain_off","mutation_allowed":"controlled_test_only"}'),
('route_asset_approval_live','Approve route and visual content',
 'Create or select a route candidate and an approved public visual, then perform the required human route/asset approval. Do not treat an empty publication-readiness queue as approval and do not publish placeholders.',
 'Evidence must identify the approved route, approved visual asset, human approver/decision, and resulting publication-readiness record. Public publishing remains closed until approval exists.',50,'{"content_approval":"human_required","public_publish":"after_approval_only"}'),
('customer_portal_live','Run Stripe test-mode customer portal acceptance',
 'Use Stripe test mode and a disposable/test customer flow to verify quote acceptance, hosted deposit checkout, webhook validation/processing, and customer status updates. Do not use a Production payment or enable provider mutation as a shortcut.',
 'Evidence must include a test-mode hosted checkout, matching validated webhook delivery, resulting deposit/customer-status transition, and human review that no Production payment/provider mutation was used.',60,'{"provider":"stripe","external_evidence":"required","production_payment":"forbidden"}'),
('live_job_updates','Run live job-update staging acceptance',
 'Schema 188 already includes the historical live-update schema work; do not reapply Schema 155. In dedicated staging, use a labelled work order and portal token to test staff-only visibility, customer-visible updates, approved public media, and retraction.',
 'Evidence must show staff-only data remains private, one customer-visible update appears, only approved public media is exposed, retraction removes the update, and the run is finalized and explicitly signed off.',70,'{"stale_hint_override":"deploy schema 155","mutation_allowed":"staging_only"}'),
('customer_live_update_notifications','Run customer notification staging acceptance',
 'In dedicated staging, record explicit portal opt-in, publish one customer-visible update, run the protected dispatcher with a test-safe destination, inspect the delivered message, then opt out and verify future delivery is blocked.',
 'Evidence must show explicit opt-in, exactly one queued notification, reviewed test-safe delivery, no staff-only/private data in the message, opt-out suppression, finalization, and explicit signoff.',80,'{"external_delivery":"test_safe_only","customer_contact":"no_real_customer"}'),
('service_execution_proof_costing','Run execution proof/costing staging acceptance',
 'In dedicated staging, submit one arrival proof and one completion proof with representative labour/material/equipment values, approve them with the intended supervisor role, then compare customer-safe portal proof with internal Cockpit cost variance.',
 'Evidence must prove arrival/completion capture, supervisor approval, customer-safe portal separation, internal-only cost variance visibility, finalization, and explicit human signoff.',90,'{"cost_data":"staff_only","mutation_allowed":"staging_only"}'),
('supervisor_closeout_signoff_invoice_followup','Run closeout/signoff staging acceptance',
 'In dedicated staging, create closeout from approved execution proof, approve it as supervisor, sign it from the customer portal, then verify invoice readiness, review-request state, and maintenance follow-up while internal costs remain private.',
 'Evidence must prove closeout creation, supervisor approval, customer signoff, invoice-readiness transition, review/maintenance follow-up, customer-safe data separation, finalization, and explicit human signoff.',100,'{"cost_data":"staff_only","mutation_allowed":"staging_only"}'),
('approved_route_generation','Run approved-route publication acceptance',
 'After a route and visual are human-approved, verify publication readiness, publish the approved route through the intended workflow, and run sitemap generation during deployment. Do not generate or publish an unapproved route.',
 'Evidence must show the approved route/visual pair, publication-ready state, published route record, sitemap entry/generation result, and human review of the public page/SEO output.',110,'{"content_approval":"prerequisite","sitemap":"deployment_step"}')
on conflict(rail_key) do update set
  guidance_title=excluded.guidance_title,
  current_action=excluded.current_action,
  evidence_requirement=excluded.evidence_requirement,
  sort_order=excluded.sort_order,
  metadata=excluded.metadata,
  introduced_by_schema=excluded.introduced_by_schema,
  updated_at=now();

create or replace view public.v_it_open_rail_acceptance_readiness
with (security_invoker=true)
as
with
schema_state as (
  select expected_schema_version,latest_applied_schema_version,drift_status
  from public.v_schema_drift_status
  limit 1
),
staging_assertions as (
  select count(*) filter(where assertion_status<>'passed')::int as failed_count
  from (
    select * from public.ywi_staging_acceptance_security_assertions()
    union all
    select * from public.ywi_staging_acceptance_catalog_assertions()
  ) a
),
staging_plan as (
  select rail_key,
    count(*)::int as case_count,
    count(*) filter(where evidence_status='pending_evidence')::int as pending_case_count,
    count(*) filter(where verification_mode='human')::int as human_case_count,
    count(*) filter(where human_action_required)::int as current_human_action_count
  from public.v_it_staging_acceptance_scenario_plan
  group by rail_key
),
finance_state as (
  select assertion_count,passed_count,failed_count,execution_release_enabled,provider_mutation_enabled,
    reconciliation_issue_count,critical_reconciliation_issue_count,release_authority_status,hardening_status
  from public.v_it_finance_release_hardening_status
  limit 1
),
stripe_state as (
  select received_24h,processed_24h,failed_24h,last_processed_at,last_received_at,last_validation_status,latest_event_at
  from public.v_stripe_webhook_health
  limit 1
),
route_state as (
  select count(*)::int as total_count,
    count(*) filter(where publication_ready)::int as ready_count,
    count(*) filter(where published_at is not null)::int as published_count
  from public.v_public_route_publication_readiness
),
payment_state as (
  select count(*)::int as action_count,
    count(*) filter(where coalesce(action_status,'') not in ('posted','rejected','cancelled','complete','completed'))::int as pending_action_count
  from public.v_payment_action_workbench
),
bank_state as (
  select count(*)::int as preview_count,
    count(*) filter(where promoted_at is not null)::int as promoted_count
  from public.v_bank_csv_import_workbench
)
select
  t.rail_key,t.rail_area,t.rail_title,t.rail_status,t.progress_percent,t.current_value,t.target_value,t.sort_order,
  t.resolution_class,t.requires_human,t.requires_external,t.auto_close_allowed,t.resolution_note,
  t.next_action_hint as historical_next_action_hint,
  r.guidance_title,r.current_action,r.evidence_requirement,r.metadata as runbook_metadata,
  case
    when t.resolution_class='staging_acceptance' and (select drift_status from schema_state)='current'
      and coalesce(sp.case_count,0)>0 and (select failed_count from staging_assertions)=0 then 'ready'
    when t.resolution_class='staging_acceptance' then 'blocked'
    when t.resolution_class='accounting_acceptance'
      and coalesce((select hardening_status from finance_state),'')='green'
      and coalesce((select failed_count from finance_state),1)=0
      and coalesce((select execution_release_enabled from finance_state),false)=false
      and coalesce((select provider_mutation_enabled from finance_state),false)=false
      and coalesce((select critical_reconciliation_issue_count from finance_state),0)=0 then 'ready'
    when t.resolution_class='accounting_acceptance' then 'blocked'
    when t.resolution_class='provider_acceptance' and coalesce((select failed_24h from stripe_state),0)>0 then 'blocked'
    when t.resolution_class='provider_acceptance' then 'pending'
    when t.resolution_class='content_approval' then 'pending'
    else 'pending'
  end::text as technical_readiness_status,
  case
    when t.resolution_class='staging_acceptance' and (select drift_status from schema_state)='current'
      and coalesce(sp.case_count,0)>0 and (select failed_count from staging_assertions)=0 then 'ready_for_dedicated_staging_evidence'
    when t.resolution_class='staging_acceptance' then 'staging_control_plane_blocked'
    when t.resolution_class='accounting_acceptance'
      and coalesce((select hardening_status from finance_state),'')='green'
      and coalesce((select failed_count from finance_state),1)=0
      and coalesce((select execution_release_enabled from finance_state),false)=false
      and coalesce((select provider_mutation_enabled from finance_state),false)=false
      and coalesce((select critical_reconciliation_issue_count from finance_state),0)=0 then 'ready_for_human_accounting_acceptance'
    when t.resolution_class='accounting_acceptance' then 'accounting_control_plane_blocked'
    when t.resolution_class='provider_acceptance' and coalesce((select failed_24h from stripe_state),0)>0 then 'stripe_health_blocked'
    when t.resolution_class='provider_acceptance' and (select latest_event_at from stripe_state) is null then 'waiting_for_stripe_test_evidence'
    when t.resolution_class='provider_acceptance' then 'ready_for_provider_acceptance_review'
    when t.resolution_class='content_approval' and (select total_count from route_state)=0 then 'waiting_for_human_route_asset_approval'
    when t.resolution_class='content_approval' and (select ready_count from route_state)>0 then 'ready_for_content_publication_acceptance'
    else 'waiting_for_human_content_approval'
  end::text as technical_readiness_code,
  case
    when t.resolution_class='staging_acceptance' then format('Schema %s/%s %s; catalog cases %s; pending cases %s; current human actions %s; staging assertion failures %s.',
      coalesce((select latest_applied_schema_version from schema_state),0),coalesce((select expected_schema_version from schema_state),0),
      coalesce((select drift_status from schema_state),'unknown'),coalesce(sp.case_count,0),coalesce(sp.pending_case_count,0),coalesce(sp.current_human_action_count,0),
      coalesce((select failed_count from staging_assertions),0))
    when t.resolution_class='accounting_acceptance' then format('Finance hardening %s; assertions %s/%s passed; execution release %s; provider mutation %s; reconciliation issues %s (%s critical).',
      coalesce((select hardening_status from finance_state),'unknown'),coalesce((select passed_count from finance_state),0),coalesce((select assertion_count from finance_state),0),
      coalesce((select execution_release_enabled from finance_state),false),coalesce((select provider_mutation_enabled from finance_state),false),
      coalesce((select reconciliation_issue_count from finance_state),0),coalesce((select critical_reconciliation_issue_count from finance_state),0))
    when t.resolution_class='provider_acceptance' then format('Stripe webhook evidence in last 24h: received %s, processed %s, failed %s; latest event %s.',
      coalesce((select received_24h from stripe_state),0),coalesce((select processed_24h from stripe_state),0),coalesce((select failed_24h from stripe_state),0),
      coalesce((select latest_event_at::text from stripe_state),'none'))
    when t.resolution_class='content_approval' then format('Route publication readiness: %s candidate(s), %s ready, %s published.',
      coalesce((select total_count from route_state),0),coalesce((select ready_count from route_state),0),coalesce((select published_count from route_state),0))
    else 'No technical readiness adapter is configured for this resolution class.'
  end::text as technical_readiness_detail,
  true as human_action_required,
  t.requires_external as external_action_required,
  coalesce(sp.case_count,0)::int as staging_case_count,
  coalesce(sp.pending_case_count,0)::int as staging_pending_case_count,
  coalesce(sp.human_case_count,0)::int as staging_human_case_count,
  coalesce((select hardening_status from finance_state),'unknown')::text as finance_hardening_status,
  coalesce((select execution_release_enabled from finance_state),false) as finance_execution_release_enabled,
  coalesce((select provider_mutation_enabled from finance_state),false) as provider_mutation_enabled,
  coalesce((select reconciliation_issue_count from finance_state),0)::int as reconciliation_issue_count,
  coalesce((select received_24h from stripe_state),0)::int as stripe_received_24h,
  coalesce((select processed_24h from stripe_state),0)::int as stripe_processed_24h,
  coalesce((select failed_24h from stripe_state),0)::int as stripe_failed_24h,
  (select latest_event_at from stripe_state) as stripe_latest_event_at,
  coalesce((select total_count from route_state),0)::int as route_candidate_count,
  coalesce((select ready_count from route_state),0)::int as route_ready_count,
  coalesce((select published_count from route_state),0)::int as route_published_count,
  coalesce((select action_count from payment_state),0)::int as payment_action_count,
  coalesce((select pending_action_count from payment_state),0)::int as payment_pending_action_count,
  coalesce((select preview_count from bank_state),0)::int as bank_preview_count,
  coalesce((select promoted_count from bank_state),0)::int as bank_promoted_count,
  case
    when t.rail_key='quote_intake_live' and lower(coalesce(t.next_action_hint,'')) like '%deploy quote-contact-submit%' then true
    when t.rail_key='live_job_updates' and lower(coalesce(t.next_action_hint,'')) like '%deploy schema 155%' then true
    else false
  end as historical_hint_stale,
  now() as checked_at
from public.v_it_scorecard_progress_truth t
join public.it_open_rail_acceptance_runbook r on r.rail_key=t.rail_key
left join staging_plan sp on sp.rail_key=t.rail_key
where t.rail_status<>'complete'
  and t.resolution_class in ('staging_acceptance','accounting_acceptance','provider_acceptance','content_approval');

revoke all on table public.v_it_open_rail_acceptance_readiness from public,anon,authenticated;
grant select on table public.v_it_open_rail_acceptance_readiness to service_role;

create or replace function public.ywi_open_rail_acceptance_readiness_assertions()
returns table(assertion_key text,assertion_status text,assertion_detail text)
language sql security definer set search_path=public,pg_temp
as $$
  select 'open_rail_runbook_catalog_exact_business_set',
    case when (select count(*) from public.it_open_rail_acceptance_runbook)=11 then 'passed' else 'failed' end,
    'The current runbook catalogs exactly the 11 known human-gated business acceptance rails.'
  union all
  select 'open_rail_runbook_covers_all_open_business_rails',
    case when not exists(
      select 1 from public.v_it_scorecard_progress_truth t
      where t.rail_status<>'complete' and t.resolution_class in ('staging_acceptance','accounting_acceptance','provider_acceptance','content_approval')
        and not exists(select 1 from public.it_open_rail_acceptance_runbook r where r.rail_key=t.rail_key)
    ) then 'passed' else 'failed' end,
    'Every currently open business acceptance rail has current-action and evidence guidance.'
  union all
  select 'open_rail_runbook_preserves_human_gates',
    case when not exists(
      select 1 from public.it_open_rail_acceptance_runbook r
      join public.it_scorecard_rail_resolution_contracts c on c.rail_key=r.rail_key
      where c.requires_human is not true or c.auto_close_allowed is not false
    ) then 'passed' else 'failed' end,
    'Every runbook rail remains human-required and non-auto-closeable.'
  union all
  select 'open_rail_provider_external_gate_preserved',
    case when exists(
      select 1 from public.it_scorecard_rail_resolution_contracts
      where rail_key='customer_portal_live' and requires_human and requires_external and auto_close_allowed=false
    ) then 'passed' else 'failed' end,
    'Customer portal acceptance still requires human and external Stripe evidence.'
  union all
  select 'open_rail_stale_hints_overridden',
    case when exists(select 1 from public.v_it_open_rail_acceptance_readiness where rail_key='quote_intake_live' and historical_hint_stale and lower(current_action) not like '%deploy quote-contact-submit%')
      and exists(select 1 from public.v_it_open_rail_acceptance_readiness where rail_key='live_job_updates' and historical_hint_stale and lower(current_action) not like '%deploy schema 155%')
      then 'passed' else 'failed' end,
    'Known stale deploy instructions remain visible for audit but are overridden by current Schema 188 actions.'
  union all
  select 'open_rail_runbook_service_private',
    case when not exists(
      select 1 from information_schema.role_table_grants
      where table_schema='public' and table_name='it_open_rail_acceptance_runbook' and grantee in ('anon','authenticated','PUBLIC')
    ) and not exists(
      select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public' and c.relname='it_open_rail_acceptance_runbook' and c.relrowsecurity is not true
    ) then 'passed' else 'failed' end,
    'Acceptance runbook data is RLS-enabled and service-private.'
  union all
  select 'open_rail_finance_provider_mutation_closed',
    case when coalesce((select execution_release_enabled from public.v_it_finance_release_hardening_status limit 1),false)=false
      and coalesce((select provider_mutation_enabled from public.v_it_finance_release_hardening_status limit 1),false)=false
      then 'passed' else 'failed' end,
    'Finance posting execution and provider mutation remain OFF while acceptance is pending.'
  union all
  select 'open_rail_readiness_is_read_only',
    case when not exists(
      select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='public' and p.proname like 'ywi_open_rail_acceptance_readiness%'
        and p.proname<>'ywi_open_rail_acceptance_readiness_assertions'
    ) then 'passed' else 'failed' end,
    'Schema 188 adds no open-rail mutation RPC; readiness guidance is read-only.';
$$;

revoke all on function public.ywi_open_rail_acceptance_readiness_assertions() from public,anon,authenticated;
grant execute on function public.ywi_open_rail_acceptance_readiness_assertions() to service_role;

insert into public.it_readiness_check_registry(check_key,check_group,check_title,severity_if_failed,action_hint,route_hint,sort_order,is_enabled)
values('open_rail_acceptance_readiness','Acceptance','All open business rails expose current technical readiness, human action and evidence requirements','critical',
  'Use Admin > I.T. Acceptance Readiness. Follow current_action rather than stale historical scorecard hints; never auto-close a human/provider/accounting/content rail.',
  'Admin > I.T. Readiness',38,true)
on conflict(check_key) do update set check_group=excluded.check_group,check_title=excluded.check_title,severity_if_failed=excluded.severity_if_failed,
  action_hint=excluded.action_hint,route_hint=excluded.route_hint,sort_order=excluded.sort_order,is_enabled=excluded.is_enabled,updated_at=now();

insert into public.admin_scorecard_progress_rails(
  rail_key,rail_area,rail_title,rail_status,progress_percent,current_value,target_value,next_action_hint,owner_hint,sort_order,metadata
) values(
  'schema188_open_rail_acceptance_readiness','release','Open-rail acceptance readiness and current-action truth','active',90,9,10,
  'Verify all 11 human-gated business rails have current technical readiness, accurate action/evidence guidance, protected Admin I.T. rendering, source/browser gates, and exact-main release evidence. Do not close any business rail.',
  'I.T. / Release',108,jsonb_build_object('schema',188,'build','2026-09-03b','business_rail_auto_close',false,'finance_mutation',false,'payment_provider_mutation',false,'production_promotion',false)
)
on conflict(rail_key) do update set rail_area=excluded.rail_area,rail_title=excluded.rail_title,rail_status=excluded.rail_status,
  progress_percent=excluded.progress_percent,current_value=excluded.current_value,target_value=excluded.target_value,next_action_hint=excluded.next_action_hint,
  owner_hint=excluded.owner_hint,sort_order=excluded.sort_order,metadata=excluded.metadata,updated_at=now();

insert into public.it_scorecard_rail_resolution_contracts(
  rail_key,resolution_class,requires_human,requires_external,auto_close_allowed,resolution_note,introduced_by_schema
) values(
  'schema188_open_rail_acceptance_readiness','build_acceptance',false,false,false,
  'Close Build 188 only after unified read-only readiness assertions, Admin I.T. rendering, source/browser acceptance, and exact-main release evidence are green. No business acceptance rail may be closed by this build.',188
)
on conflict(rail_key) do update set resolution_class=excluded.resolution_class,requires_human=excluded.requires_human,requires_external=excluded.requires_external,
  auto_close_allowed=excluded.auto_close_allowed,resolution_note=excluded.resolution_note,introduced_by_schema=excluded.introduced_by_schema,updated_at=now();

create or replace view public.v_schema_drift_status with (security_invoker=true) as
select 188::int as expected_schema_version,
  coalesce(max(schema_version) filter(where status='applied'),0)::int as latest_applied_schema_version,
  case when coalesce(max(schema_version) filter(where status='applied'),0)>=188 then 'current' else 'behind' end::text as drift_status,
  case when coalesce(max(schema_version) filter(where status='applied'),0)>=188 then 'Live database is at or ahead of the repo schema marker.' else 'Live database is behind the deployed app. Apply migrations through schema 188 in order.' end::text as message,
  now() as checked_at
from public.app_schema_versions;
revoke all on table public.v_schema_drift_status from public,anon,authenticated;
grant select on table public.v_schema_drift_status to service_role;

insert into public.app_schema_versions(schema_version,migration_key,schema_name,release_label,description,status,notes)
values(188,'188_open_rail_acceptance_readiness','188_open_rail_acceptance_readiness.sql','2026-09-03b',
  'Adds a service-private current-action runbook and unified read-only technical readiness view over the 11 remaining human/provider/accounting/content acceptance rails.',
  'applied','No business rail is closed. Finance posting execution and provider mutation remain OFF; Production promotion remains manual.')
on conflict(schema_version) do update set migration_key=excluded.migration_key,schema_name=excluded.schema_name,release_label=excluded.release_label,
  description=excluded.description,status=excluded.status,notes=excluded.notes,applied_at=now();

commit;
