begin;

-- Schema 187 — rail-specific staging acceptance scenario catalog.
-- Planning/evidence controls only: no business readiness rail is auto-closed.

create table if not exists public.operations_staging_acceptance_scenarios (
  rail_key text not null references public.admin_scorecard_progress_rails(rail_key) on delete restrict,
  case_key text not null,
  case_title text not null,
  case_description text,
  evidence_kind text not null check (evidence_kind in ('automated','runtime','browser','manual')),
  verification_mode text not null check (verification_mode in ('runner','human')),
  is_blocking boolean not null default true,
  expected_outcome text not null,
  prerequisites jsonb not null default '[]'::jsonb,
  sort_order integer not null default 100,
  is_enabled boolean not null default true,
  introduced_by_schema integer not null default 187,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (rail_key,case_key),
  check (case_key ~ '^[a-z0-9][a-z0-9_]{2,119}$'),
  check (length(case_title) between 3 and 240),
  check (length(expected_outcome) between 3 and 2000),
  check (jsonb_typeof(prerequisites)='array')
);

alter table public.operations_staging_acceptance_scenarios enable row level security;
revoke all on table public.operations_staging_acceptance_scenarios from public,anon,authenticated;
grant select on table public.operations_staging_acceptance_scenarios to service_role;

create index if not exists operations_staging_acceptance_scenarios_rail_sort_idx
  on public.operations_staging_acceptance_scenarios(rail_key,is_enabled,sort_order,case_key);

insert into public.operations_staging_acceptance_scenarios(
  rail_key,case_key,case_title,case_description,evidence_kind,verification_mode,
  is_blocking,expected_outcome,prerequisites,sort_order,metadata
) values
-- Operations Cockpit
('operations_cockpit_live','schema_current','Schema is current','Confirm the dedicated staging database uses the exact current repository schema marker.','automated','runner',true,'Schema drift status is current at Schema 187 or later.','[{"kind":"schema","key":"v_schema_drift_status"}]',10,'{"shared":true}'),
('operations_cockpit_live','staging_security_assertions','Staging security assertions pass','Verify staging evidence remains service-private and human-gated.','automated','runner',true,'All staging acceptance security and catalog assertions pass.','[{"kind":"security","key":"ywi_staging_acceptance_security_assertions"}]',20,'{"shared":true}'),
('operations_cockpit_live','target_rail_visible','Target rail remains human-gated','Confirm the target rail is open, classified staging_acceptance, and requires human review.','automated','runner',true,'operations_cockpit_live remains open, staging_acceptance, and human-gated.','[{"kind":"rail","key":"operations_cockpit_live"}]',30,'{"shared":true}'),
('operations_cockpit_live','operations_cockpit_admin_allowed','Authorized Cockpit load','Load the protected Operations Cockpit queue with the staging Admin/job-admin identity.','browser','runner',true,'Authorized staging Admin/job-admin receives HTTP 200 with capability and Stripe-health evidence.','[{"kind":"project","key":"YWI_STAGING_PROJECT_REF"},{"kind":"identity","key":"YWI_STAGING_JOB_ADMIN_JWT"},{"kind":"edge_function","key":"operations-manage"}]',40,'{}'),
('operations_cockpit_live','operations_cockpit_worker_denied','Lower-rank Cockpit denial','Attempt the protected queue with the lower-rank staging worker identity.','browser','runner',true,'Lower-rank staging worker receives HTTP 403.','[{"kind":"identity","key":"YWI_STAGING_WORKER_JWT"},{"kind":"edge_function","key":"operations-manage"}]',50,'{}'),
('operations_cockpit_live','operations_cockpit_write_form_roundtrip','Cockpit write-form round trip','Exercise one safe staging Cockpit write form, verify persisted state, then restore/clean disposable data.','manual','human',true,'A staging-only Cockpit write succeeds at the intended role, is visible after reload, and disposable data is restored or cleaned.','[{"kind":"project","key":"YWI_STAGING_PROJECT_REF"},{"kind":"identity","key":"YWI_STAGING_JOB_ADMIN_JWT"},{"kind":"fixture","key":"STAGING-only write fixture"}]',60,'{}'),

-- Quote/contact intake
('quote_intake_live','schema_current','Schema is current','Confirm the dedicated staging database uses the exact current repository schema marker.','automated','runner',true,'Schema drift status is current at Schema 187 or later.','[{"kind":"schema","key":"v_schema_drift_status"}]',10,'{"shared":true}'),
('quote_intake_live','staging_security_assertions','Staging security assertions pass','Verify staging evidence remains service-private and human-gated.','automated','runner',true,'All staging acceptance security and catalog assertions pass.','[{"kind":"security","key":"ywi_staging_acceptance_security_assertions"}]',20,'{"shared":true}'),
('quote_intake_live','target_rail_visible','Target rail remains human-gated','Confirm quote intake is an open staging-acceptance rail.','automated','runner',true,'quote_intake_live remains open, staging_acceptance, and human-gated.','[{"kind":"rail","key":"quote_intake_live"}]',30,'{"shared":true}'),
('quote_intake_live','quote_invalid_payload_rejected','Invalid quote payload is rejected','Submit a deliberately invalid request without consent.','runtime','human',true,'quote-contact-submit rejects the invalid request with HTTP 400 and creates no business row.','[{"kind":"edge_function","key":"quote-contact-submit"}]',40,'{}'),
('quote_intake_live','quote_submission_creates_request','Valid quote creates one request','Submit one uniquely labelled STAGING quote/contact request.','manual','human',true,'Exactly one quote_contact_requests row is created with a request ID and follow-up target.','[{"kind":"edge_function","key":"quote-contact-submit"},{"kind":"fixture","key":"STAGING contact identity"}]',50,'{}'),
('quote_intake_live','quote_created_event_recorded','Quote creation event is recorded','Inspect request event history for the staging quote.','manual','human',true,'A created event references the same staging quote request and no unexpected duplicate row appears.','[{"kind":"table","key":"quote_contact_request_events"}]',60,'{}'),
('quote_intake_live','quote_fixture_cleanup','Disposable quote evidence is cleaned','Remove the STAGING-only quote/contact fixture after evidence is captured.','manual','human',true,'Disposable quote/contact rows used only for acceptance are removed or explicitly retained as labelled staging fixtures.','[{"kind":"fixture","key":"STAGING contact identity"}]',70,'{}'),

-- Live job updates
('live_job_updates','schema_current','Schema is current','Confirm the dedicated staging database uses the exact current repository schema marker.','automated','runner',true,'Schema drift status is current at Schema 187 or later.','[{"kind":"schema","key":"v_schema_drift_status"}]',10,'{"shared":true}'),
('live_job_updates','staging_security_assertions','Staging security assertions pass','Verify staging evidence remains service-private and human-gated.','automated','runner',true,'All staging acceptance security and catalog assertions pass.','[{"kind":"security","key":"ywi_staging_acceptance_security_assertions"}]',20,'{"shared":true}'),
('live_job_updates','target_rail_visible','Target rail remains human-gated','Confirm live job updates are an open staging-acceptance rail.','automated','runner',true,'live_job_updates remains open, staging_acceptance, and human-gated.','[{"kind":"rail","key":"live_job_updates"}]',30,'{"shared":true}'),
('live_job_updates','live_update_staff_only_hidden','Staff-only update stays private','Publish one staff-only staging update and inspect the matching customer portal.','manual','human',true,'Staff-only update is visible to authorized staff but absent from the customer portal.','[{"kind":"identity","key":"staging staff"},{"kind":"fixture","key":"staging work order + portal token"}]',40,'{}'),
('live_job_updates','live_update_customer_visible','Customer-visible update appears','Publish one customer-visible staging update.','manual','human',true,'The approved customer-visible update appears in the matching customer portal timeline.','[{"kind":"fixture","key":"staging work order + portal token"}]',50,'{}'),
('live_job_updates','live_update_public_media_gate','Customer update uses approved public media','Attach an approved public image to the customer-visible update.','manual','human',true,'Only approved public delivery media appears; private or unapproved media is rejected or omitted.','[{"kind":"content","key":"approved staging public asset"}]',60,'{}'),
('live_job_updates','live_update_retraction','Retracted update disappears','Retract the customer-visible staging update.','manual','human',true,'Authorized staff can retract the update and it no longer appears in the customer portal.','[{"kind":"identity","key":"staging supervisor"}]',70,'{}'),

-- Customer live-update notifications
('customer_live_update_notifications','schema_current','Schema is current','Confirm the dedicated staging database uses the exact current repository schema marker.','automated','runner',true,'Schema drift status is current at Schema 187 or later.','[{"kind":"schema","key":"v_schema_drift_status"}]',10,'{"shared":true}'),
('customer_live_update_notifications','staging_security_assertions','Staging security assertions pass','Verify staging evidence remains service-private and human-gated.','automated','runner',true,'All staging acceptance security and catalog assertions pass.','[{"kind":"security","key":"ywi_staging_acceptance_security_assertions"}]',20,'{"shared":true}'),
('customer_live_update_notifications','target_rail_visible','Target rail remains human-gated','Confirm customer notification delivery is an open staging-acceptance rail.','automated','runner',true,'customer_live_update_notifications remains open, staging_acceptance, and human-gated.','[{"kind":"rail","key":"customer_live_update_notifications"}]',30,'{"shared":true}'),
('customer_live_update_notifications','notification_opt_in_recorded','Explicit customer opt-in is recorded','Enable live-update email for the disposable staging customer portal.','manual','human',true,'The staging customer preference records explicit opt-in before any delivery attempt.','[{"kind":"fixture","key":"staging portal customer"}]',40,'{}'),
('customer_live_update_notifications','notification_customer_update_enqueued','Customer update enqueues notification','Publish one customer-visible staging update after opt-in.','manual','human',true,'Exactly one notification outbox item is queued for the opted-in staging customer.','[{"kind":"table","key":"customer_notification_outbox"}]',50,'{}'),
('customer_live_update_notifications','notification_dispatch_delivers','Protected dispatcher processes notification','Run the protected staging dispatcher with test-safe provider configuration.','manual','human',true,'The staged notification records a successful or explicitly reviewed provider delivery attempt without contacting a real customer.','[{"kind":"edge_function","key":"customer-notification-dispatch"},{"kind":"secret","key":"YWI_CUSTOMER_NOTIFICATION_DELIVERY_ENABLED"},{"kind":"provider","key":"test-safe email destination"}]',60,'{}'),
('customer_live_update_notifications','notification_no_staff_data','Notification excludes staff-only data','Inspect the delivered test message.','manual','human',true,'No staff-only notes, internal costing, private media, or portal secrets appear in the customer email.','[{"kind":"provider","key":"test-safe email destination"}]',70,'{}'),
('customer_live_update_notifications','notification_opt_out_blocks','Opt-out blocks future delivery','Disable live-update email and publish another customer-visible staging update.','manual','human',true,'No deliverable notification is produced while the staging customer is opted out.','[{"kind":"fixture","key":"staging portal customer"}]',80,'{}'),

-- Service execution proof + costing
('service_execution_proof_costing','schema_current','Schema is current','Confirm the dedicated staging database uses the exact current repository schema marker.','automated','runner',true,'Schema drift status is current at Schema 187 or later.','[{"kind":"schema","key":"v_schema_drift_status"}]',10,'{"shared":true}'),
('service_execution_proof_costing','staging_security_assertions','Staging security assertions pass','Verify staging evidence remains service-private and human-gated.','automated','runner',true,'All staging acceptance security and catalog assertions pass.','[{"kind":"security","key":"ywi_staging_acceptance_security_assertions"}]',20,'{"shared":true}'),
('service_execution_proof_costing','target_rail_visible','Target rail remains human-gated','Confirm execution proof/costing is an open staging-acceptance rail.','automated','runner',true,'service_execution_proof_costing remains open, staging_acceptance, and human-gated.','[{"kind":"rail","key":"service_execution_proof_costing"}]',30,'{"shared":true}'),
('service_execution_proof_costing','execution_arrival_proof','Arrival proof is submitted','Capture one staging arrival proof with representative labour/material/equipment values.','manual','human',true,'Arrival proof is accepted for the staging work order and internal cost fields remain staff-only.','[{"kind":"fixture","key":"staging work order"},{"kind":"identity","key":"staging site leader"}]',40,'{}'),
('service_execution_proof_costing','execution_completion_proof','Completion proof is submitted','Capture one staging completion proof.','manual','human',true,'Completion proof is accepted for the same staging work order.','[{"kind":"fixture","key":"staging work order"}]',50,'{}'),
('service_execution_proof_costing','execution_supervisor_approval','Supervisor approves proof','Approve the staged proof using the intended supervisory role.','manual','human',true,'Supervisor approval succeeds and proof becomes eligible for customer-safe display and closeout.','[{"kind":"identity","key":"staging supervisor"}]',60,'{}'),
('service_execution_proof_costing','execution_customer_safe_portal','Portal shows customer-safe proof','Open the matching staging customer portal.','manual','human',true,'Approved proof/media appears while labour, material, equipment, margin, and staff notes remain absent.','[{"kind":"fixture","key":"staging portal token"},{"kind":"content","key":"approved staging public asset"}]',70,'{}'),
('service_execution_proof_costing','execution_cost_variance_visible','Internal cost variance is visible','Inspect the Operations Cockpit cost dashboard for the staged work order.','manual','human',true,'Internal staff view shows captured cost comparison or variance without exposing it to the customer portal.','[{"kind":"identity","key":"staging staff"}]',80,'{}'),

-- Supervisor closeout / customer signoff / invoice follow-up
('supervisor_closeout_signoff_invoice_followup','schema_current','Schema is current','Confirm the dedicated staging database uses the exact current repository schema marker.','automated','runner',true,'Schema drift status is current at Schema 187 or later.','[{"kind":"schema","key":"v_schema_drift_status"}]',10,'{"shared":true}'),
('supervisor_closeout_signoff_invoice_followup','staging_security_assertions','Staging security assertions pass','Verify staging evidence remains service-private and human-gated.','automated','runner',true,'All staging acceptance security and catalog assertions pass.','[{"kind":"security","key":"ywi_staging_acceptance_security_assertions"}]',20,'{"shared":true}'),
('supervisor_closeout_signoff_invoice_followup','target_rail_visible','Target rail remains human-gated','Confirm closeout/signoff is an open staging-acceptance rail.','automated','runner',true,'supervisor_closeout_signoff_invoice_followup remains open, staging_acceptance, and human-gated.','[{"kind":"rail","key":"supervisor_closeout_signoff_invoice_followup"}]',30,'{"shared":true}'),
('supervisor_closeout_signoff_invoice_followup','closeout_submit_from_proof','Closeout is submitted from approved proof','Create a staging closeout package from approved execution proof.','manual','human',true,'A closeout package is created with customer-safe summary/gallery and internal cost context separated.','[{"kind":"fixture","key":"approved staging execution proof"}]',40,'{}'),
('supervisor_closeout_signoff_invoice_followup','closeout_supervisor_approve','Supervisor approves closeout','Approve the staging closeout package.','manual','human',true,'Supervisor approval succeeds and the package becomes available for customer signoff.','[{"kind":"identity","key":"staging supervisor"}]',50,'{}'),
('supervisor_closeout_signoff_invoice_followup','closeout_customer_signoff','Customer signs closeout','Use the staging customer portal to approve completed work.','manual','human',true,'Customer signoff is recorded against the approved closeout package.','[{"kind":"fixture","key":"staging customer portal"}]',60,'{}'),
('supervisor_closeout_signoff_invoice_followup','closeout_invoice_ready','Invoice readiness follows signoff','Inspect the staff closeout queue after customer signoff.','manual','human',true,'The staged work becomes invoice-ready only after required approval and customer signoff.','[{"kind":"fixture","key":"approved staging closeout"}]',70,'{}'),
('supervisor_closeout_signoff_invoice_followup','closeout_review_request','Review-request state is created','Verify review-request follow-up after successful signoff.','manual','human',true,'Review-request status is tied to the staged work order without exposing internal costs.','[{"kind":"fixture","key":"signed staging closeout"}]',80,'{}'),
('supervisor_closeout_signoff_invoice_followup','closeout_maintenance_followup','Maintenance follow-up is created','Verify maintenance follow-up scheduling/state after closeout.','manual','human',true,'Maintenance follow-up is tied to the staged work order with expected customer-safe details.','[{"kind":"fixture","key":"signed staging closeout"}]',90,'{}'),
('supervisor_closeout_signoff_invoice_followup','closeout_cost_privacy','Customer portal excludes internal costs','Inspect the signed closeout package in the staging portal.','manual','human',true,'Labour, material, equipment, margin, staff notes, and private review media remain absent from the customer portal.','[{"kind":"fixture","key":"staging customer portal"}]',100,'{}')
on conflict(rail_key,case_key) do update set
  case_title=excluded.case_title,case_description=excluded.case_description,
  evidence_kind=excluded.evidence_kind,verification_mode=excluded.verification_mode,
  is_blocking=excluded.is_blocking,expected_outcome=excluded.expected_outcome,
  prerequisites=excluded.prerequisites,sort_order=excluded.sort_order,is_enabled=true,
  introduced_by_schema=187,metadata=excluded.metadata,updated_at=now();

create or replace view public.v_it_staging_acceptance_scenario_plan
with (security_invoker=true)
as
with latest_run as (
  select distinct on (target_rail_key)
    id,run_key,target_rail_key,suite_name,run_status,source_sha,source_workflow_run_id,schema_version,
    human_signoff_required,human_signoff_status,started_at,finished_at
  from public.operations_staging_test_runs
  where acceptance_class='staging_acceptance'
  order by target_rail_key,started_at desc,id desc
)
select
  r.rail_key,r.rail_title,r.rail_status,r.progress_percent,r.next_action_hint,
  c.resolution_class,c.requires_human,c.requires_external,
  s.case_key,s.case_title,s.case_description,s.evidence_kind,s.verification_mode,s.is_blocking,
  s.expected_outcome,s.prerequisites,s.sort_order as case_sort_order,
  lr.id as run_id,lr.run_key,lr.suite_name,lr.run_status,lr.source_sha,lr.source_workflow_run_id,lr.schema_version,
  lr.human_signoff_required,lr.human_signoff_status,lr.started_at,lr.finished_at,
  tr.case_status,tr.observed_outcome,tr.details as result_details,
  case
    when lr.id is null then 'not_run'
    when tr.case_status='passed' then 'passed'
    when tr.case_status='failed' then 'failed'
    when tr.case_status='skipped' and s.is_blocking then 'failed'
    when tr.case_status='skipped' then 'skipped'
    else 'pending_evidence'
  end::text as evidence_status,
  case
    when tr.case_status='passed' then 'satisfied_by_evidence'
    when s.case_key='schema_current' and exists(select 1 from public.v_schema_drift_status where drift_status='current' and expected_schema_version>=187) then 'source_ready'
    when s.case_key='staging_security_assertions' and not exists(select 1 from public.ywi_staging_acceptance_security_assertions() where assertion_status<>'passed') then 'source_ready'
    when s.verification_mode='runner' then 'requires_staging_runtime'
    else 'requires_human_staging_evidence'
  end::text as prerequisite_truth,
  (lr.run_status='started' and s.verification_mode='human' and coalesce(tr.case_status,'pending')='pending') as human_action_required
from public.admin_scorecard_progress_rails r
join public.it_scorecard_rail_resolution_contracts c on c.rail_key=r.rail_key
join public.operations_staging_acceptance_scenarios s on s.rail_key=r.rail_key and s.is_enabled
left join latest_run lr on lr.target_rail_key=r.rail_key
left join public.operations_staging_test_results tr on tr.run_id=lr.id and tr.case_key=s.case_key
where c.resolution_class='staging_acceptance' and r.rail_status<>'complete';

revoke all on table public.v_it_staging_acceptance_scenario_plan from public,anon,authenticated;
grant select on table public.v_it_staging_acceptance_scenario_plan to service_role;

create or replace function public.ywi_rpc_start_staging_acceptance_run(
  p_actor_profile_id uuid,p_run_key text,p_suite_name text,p_target_rail_key text,p_source_sha text,
  p_schema_version integer,p_source_workflow_run_id bigint default null,p_fixture_set_id uuid default null
) returns jsonb
language plpgsql security definer set search_path=public,pg_temp
as $$
declare
  v_run public.operations_staging_test_runs%rowtype;
  v_expected_schema integer; v_latest_schema integer; v_schema_status text;
  v_requires_human boolean; v_resolution_class text; v_rail_status text;
  v_fixture public.operations_staging_fixture_sets%rowtype;
  v_key text:=btrim(coalesce(p_run_key,'')); v_suite text:=btrim(coalesce(p_suite_name,''));
  v_rail text:=btrim(coalesce(p_target_rail_key,'')); v_sha text:=lower(btrim(coalesce(p_source_sha,'')));
  v_catalog_count integer;
begin
  perform public.ywi_require_rpc_rank(p_actor_profile_id,45,'start staging acceptance');
  if v_key='' or length(v_key)>180 then raise exception 'A bounded staging run key is required.' using errcode='22023'; end if;
  if v_suite='' or length(v_suite)>180 then raise exception 'A staging suite name is required.' using errcode='22023'; end if;
  if v_sha !~ '^[0-9a-f]{40}$' then raise exception 'A full lowercase 40-character source SHA is required.' using errcode='22023'; end if;

  select expected_schema_version,latest_applied_schema_version,drift_status
    into v_expected_schema,v_latest_schema,v_schema_status from public.v_schema_drift_status limit 1;
  if v_schema_status<>'current' or p_schema_version is distinct from v_expected_schema or v_latest_schema<v_expected_schema then
    raise exception 'Staging acceptance requires the current schema marker. Expected %, applied %, supplied %.',v_expected_schema,v_latest_schema,p_schema_version using errcode='23514';
  end if;

  select c.resolution_class,c.requires_human,r.rail_status into v_resolution_class,v_requires_human,v_rail_status
  from public.admin_scorecard_progress_rails r join public.it_scorecard_rail_resolution_contracts c on c.rail_key=r.rail_key
  where r.rail_key=v_rail;
  if not found then raise exception 'Target readiness rail % does not exist or has no resolution contract.',v_rail using errcode='23503'; end if;
  if v_resolution_class<>'staging_acceptance' then raise exception 'Target rail % is %, not staging_acceptance.',v_rail,v_resolution_class using errcode='23514'; end if;
  if v_rail_status='complete' then raise exception 'Target rail % is already complete; do not create new acceptance evidence against a closed rail.',v_rail using errcode='23514'; end if;

  select count(*)::int into v_catalog_count from public.operations_staging_acceptance_scenarios where rail_key=v_rail and is_enabled;
  if v_catalog_count=0 then raise exception 'Target rail % has no enabled Schema 187 acceptance scenarios.',v_rail using errcode='23514'; end if;

  if p_fixture_set_id is not null then
    select * into v_fixture from public.operations_staging_fixture_sets where id=p_fixture_set_id;
    if not found or v_fixture.environment_label<>'staging' or v_fixture.fixture_label not like 'STAGING-%' or v_fixture.fixture_status not in ('created','in_use') then
      raise exception 'The supplied fixture set is not an active tracked STAGING fixture set.' using errcode='23514';
    end if;
  end if;

  insert into public.operations_staging_test_runs(
    run_key,environment_label,suite_name,run_status,requested_by_profile_id,summary,
    target_rail_key,source_sha,source_workflow_run_id,schema_version,fixture_set_id,
    acceptance_class,human_signoff_required,human_signoff_status,evidence_note
  ) values(
    v_key,'staging',v_suite,'started',p_actor_profile_id,
    jsonb_build_object('build','2026-09-03a','schema',187,'target_rail_key',v_rail,'source_sha',v_sha,
      'source_workflow_run_id',p_source_workflow_run_id,'fixture_set_id',p_fixture_set_id,
      'auto_close_allowed',false,'catalog_case_count',v_catalog_count,'catalog_schema',187),
    v_rail,v_sha,p_source_workflow_run_id,p_schema_version,p_fixture_set_id,'staging_acceptance',coalesce(v_requires_human,true),
    case when coalesce(v_requires_human,true) then 'pending' else 'not_required' end,
    'Schema 187 catalog-bound staging acceptance evidence. Every required case starts pending; no business rail is auto-closed.'
  ) returning * into v_run;

  insert into public.operations_staging_test_results(
    run_id,case_key,case_status,details,evidence_kind,is_blocking,expected_outcome,observed_outcome
  )
  select v_run.id,s.case_key,'pending',
    jsonb_build_object('catalog_schema',187,'verification_mode',s.verification_mode,'prerequisites',s.prerequisites,'case_title',s.case_title),
    s.evidence_kind,s.is_blocking,s.expected_outcome,null
  from public.operations_staging_acceptance_scenarios s where s.rail_key=v_rail and s.is_enabled
  order by s.sort_order,s.case_key;

  return jsonb_build_object('run_id',v_run.id,'run_key',v_run.run_key,'target_rail_key',v_run.target_rail_key,
    'schema_version',v_run.schema_version,'source_sha',v_run.source_sha,'human_signoff_required',v_run.human_signoff_required,
    'human_signoff_status',v_run.human_signoff_status,'run_status',v_run.run_status,'catalog_case_count',v_catalog_count,'catalog_schema',187);
end;
$$;

create or replace function public.ywi_rpc_record_staging_acceptance_result(
  p_run_id uuid,p_actor_profile_id uuid,p_case_key text,p_case_status text,p_evidence_kind text default 'automated',
  p_is_blocking boolean default true,p_expected_outcome text default null,p_observed_outcome text default null,p_details jsonb default '{}'::jsonb
) returns jsonb
language plpgsql security definer set search_path=public,pg_temp
as $$
declare
  v_run public.operations_staging_test_runs%rowtype;
  v_case_key text:=btrim(coalesce(p_case_key,'')); v_status text:=lower(btrim(coalesce(p_case_status,'')));
  v_catalog public.operations_staging_acceptance_scenarios%rowtype; v_result public.operations_staging_test_results%rowtype;
begin
  perform public.ywi_require_rpc_rank(p_actor_profile_id,45,'record staging acceptance evidence');
  select * into v_run from public.operations_staging_test_runs where id=p_run_id for update;
  if not found or v_run.environment_label<>'staging' or v_run.acceptance_class<>'staging_acceptance' then raise exception 'A tracked staging acceptance run is required.' using errcode='23514'; end if;
  if v_run.run_status<>'started' then raise exception 'Acceptance evidence can only be recorded while the run is started.' using errcode='23514'; end if;
  if v_case_key='' or length(v_case_key)>180 then raise exception 'A bounded case key is required.' using errcode='22023'; end if;
  if v_status not in ('pending','passed','failed','skipped') then raise exception 'Unsupported staging case status %.',v_status using errcode='22023'; end if;

  if coalesce(v_run.schema_version,0)>=187 then
    select * into v_catalog from public.operations_staging_acceptance_scenarios
    where rail_key=v_run.target_rail_key and case_key=v_case_key and is_enabled;
    if not found then raise exception 'Case % is not enabled in the Schema 187 catalog for rail %.',v_case_key,v_run.target_rail_key using errcode='23514'; end if;
    update public.operations_staging_test_results set
      case_status=v_status,
      details=coalesce(p_details,'{}'::jsonb)||jsonb_build_object('catalog_schema',187,'verification_mode',v_catalog.verification_mode,'recorded_by_profile_id',p_actor_profile_id),
      evidence_kind=v_catalog.evidence_kind,is_blocking=v_catalog.is_blocking,expected_outcome=v_catalog.expected_outcome,
      observed_outcome=nullif(left(btrim(coalesce(p_observed_outcome,'')),2000),''),updated_at=now()
    where run_id=v_run.id and case_key=v_case_key returning * into v_result;
    if not found then raise exception 'The catalog case % was not seeded for run %.',v_case_key,v_run.id using errcode='23514'; end if;
  else
    insert into public.operations_staging_test_results(run_id,case_key,case_status,details,evidence_kind,is_blocking,expected_outcome,observed_outcome)
    values(v_run.id,v_case_key,v_status,coalesce(p_details,'{}'::jsonb),lower(btrim(coalesce(p_evidence_kind,'automated'))),coalesce(p_is_blocking,true),
      nullif(left(btrim(coalesce(p_expected_outcome,'')),2000),''),nullif(left(btrim(coalesce(p_observed_outcome,'')),2000),''))
    on conflict(run_id,case_key) do update set case_status=excluded.case_status,details=excluded.details,evidence_kind=excluded.evidence_kind,
      is_blocking=excluded.is_blocking,expected_outcome=excluded.expected_outcome,observed_outcome=excluded.observed_outcome,updated_at=now()
    returning * into v_result;
  end if;

  return jsonb_build_object('result_id',v_result.id,'run_id',v_result.run_id,'case_key',v_result.case_key,
    'case_status',v_result.case_status,'evidence_kind',v_result.evidence_kind,'is_blocking',v_result.is_blocking);
end;
$$;

create or replace function public.ywi_rpc_finalize_staging_acceptance_run(
  p_run_id uuid,p_actor_profile_id uuid,p_failure_reason text default null
) returns jsonb
language plpgsql security definer set search_path=public,pg_temp
as $$
declare
  v_run public.operations_staging_test_runs%rowtype;
  v_total integer; v_pending integer; v_blocking_failed integer; v_required_catalog integer;
  v_status text; v_acceptance text;
begin
  perform public.ywi_require_rpc_rank(p_actor_profile_id,45,'finalize staging acceptance');
  select * into v_run from public.operations_staging_test_runs where id=p_run_id for update;
  if not found or v_run.environment_label<>'staging' or v_run.acceptance_class<>'staging_acceptance' then raise exception 'A tracked staging acceptance run is required.' using errcode='23514'; end if;
  if v_run.run_status<>'started' then raise exception 'Only a started staging acceptance run can be finalized.' using errcode='23514'; end if;

  select count(*)::int,count(*) filter(where case_status='pending')::int,
    count(*) filter(where is_blocking and case_status in ('failed','skipped'))::int
  into v_total,v_pending,v_blocking_failed from public.operations_staging_test_results where run_id=v_run.id;

  if coalesce(v_run.schema_version,0)>=187 then
    select count(*)::int into v_required_catalog from public.operations_staging_acceptance_scenarios where rail_key=v_run.target_rail_key and is_enabled;
    if v_total is distinct from v_required_catalog then raise exception 'Catalog-bound run % has % evidence rows but % enabled catalog cases are required.',v_run.id,v_total,v_required_catalog using errcode='23514'; end if;
  end if;
  if v_total=0 then raise exception 'A staging acceptance run cannot be finalized without evidence rows.' using errcode='23514'; end if;
  if v_pending>0 then raise exception 'A staging acceptance run cannot be finalized while % evidence row(s) are pending.',v_pending using errcode='23514'; end if;

  v_status:=case when v_blocking_failed>0 then 'failed' else 'passed' end;
  update public.operations_staging_test_runs set run_status=v_status,finished_at=now(),
    failure_reason=case when v_status='failed' then nullif(left(btrim(coalesce(p_failure_reason,'One or more blocking staging acceptance cases failed or were skipped.')),2000),'') else null end,
    summary=coalesce(summary,'{}'::jsonb)||jsonb_build_object('result_count',v_total,'blocking_failed_count',v_blocking_failed,'finalized_at',now(),
      'automated_run_status',v_status,'auto_close_allowed',false,'catalog_schema',case when coalesce(v_run.schema_version,0)>=187 then 187 else null end),
    updated_at=now() where id=v_run.id returning * into v_run;

  v_acceptance:=case when v_status='failed' then 'failed' when v_run.human_signoff_required then 'awaiting_human_signoff' else 'accepted' end;
  return jsonb_build_object('run_id',v_run.id,'run_status',v_run.run_status,'target_rail_key',v_run.target_rail_key,
    'result_count',v_total,'blocking_failed_count',v_blocking_failed,'human_signoff_required',v_run.human_signoff_required,
    'human_signoff_status',v_run.human_signoff_status,'acceptance_status',v_acceptance,'scorecard_auto_closed',false);
end;
$$;

revoke all on function public.ywi_rpc_start_staging_acceptance_run(uuid,text,text,text,text,integer,bigint,uuid) from public,anon,authenticated;
revoke all on function public.ywi_rpc_record_staging_acceptance_result(uuid,uuid,text,text,text,boolean,text,text,jsonb) from public,anon,authenticated;
revoke all on function public.ywi_rpc_finalize_staging_acceptance_run(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.ywi_rpc_start_staging_acceptance_run(uuid,text,text,text,text,integer,bigint,uuid) to service_role;
grant execute on function public.ywi_rpc_record_staging_acceptance_result(uuid,uuid,text,text,text,boolean,text,text,jsonb) to service_role;
grant execute on function public.ywi_rpc_finalize_staging_acceptance_run(uuid,uuid,text) to service_role;

create or replace function public.ywi_staging_acceptance_catalog_assertions()
returns table(assertion_key text,assertion_status text,assertion_detail text)
language sql security definer set search_path=public,pg_temp
as $$
  select 'catalog_covers_all_open_staging_rails',case when not exists(
    select 1 from public.admin_scorecard_progress_rails r join public.it_scorecard_rail_resolution_contracts c on c.rail_key=r.rail_key
    where r.rail_status<>'complete' and c.resolution_class='staging_acceptance'
      and not exists(select 1 from public.operations_staging_acceptance_scenarios s where s.rail_key=r.rail_key and s.is_enabled)
  ) then 'passed' else 'failed' end,'Every open staging_acceptance rail has an enabled Schema 187 evidence checklist.'
  union all
  select 'catalog_exact_six_business_rails',case when (select count(distinct rail_key) from public.operations_staging_acceptance_scenarios where is_enabled)=6 then 'passed' else 'failed' end,
    'The catalog covers exactly the six business staging-acceptance rails; Build 187 is not a generic auto-close mechanism.'
  union all
  select 'catalog_each_rail_has_human_blocking_case',case when not exists(
    select 1 from public.admin_scorecard_progress_rails r join public.it_scorecard_rail_resolution_contracts c on c.rail_key=r.rail_key
    where r.rail_status<>'complete' and c.resolution_class='staging_acceptance'
      and not exists(select 1 from public.operations_staging_acceptance_scenarios s where s.rail_key=r.rail_key and s.is_enabled and s.verification_mode='human' and s.is_blocking)
  ) then 'passed' else 'failed' end,'Every staging rail retains at least one blocking human evidence case.'
  union all
  select 'catalog_private_service_only',case when not exists(
    select 1 from information_schema.role_table_grants where table_schema='public' and table_name='operations_staging_acceptance_scenarios' and grantee in ('anon','authenticated','PUBLIC')
  ) and not exists(
    select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='operations_staging_acceptance_scenarios' and c.relrowsecurity is not true
  ) then 'passed' else 'failed' end,'Scenario catalog is RLS-enabled and service-private.'
  union all
  select 'catalog_start_seeds_pending_cases',case when exists(
    select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='ywi_rpc_start_staging_acceptance_run'
      and pg_get_functiondef(p.oid) ~ 'operations_staging_acceptance_scenarios' and pg_get_functiondef(p.oid) ~ '''pending''' and pg_get_functiondef(p.oid) ~ 'catalog_case_count'
  ) then 'passed' else 'failed' end,'Starting a Schema 187 run seeds every enabled catalog case as pending evidence.'
  union all
  select 'catalog_record_cannot_weaken_case',case when exists(
    select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='ywi_rpc_record_staging_acceptance_result'
      and pg_get_functiondef(p.oid) ~ 'v_catalog\.evidence_kind' and pg_get_functiondef(p.oid) ~ 'v_catalog\.is_blocking' and pg_get_functiondef(p.oid) ~ 'v_catalog\.expected_outcome'
  ) then 'passed' else 'failed' end,'Recorded evidence inherits catalog kind/blocking/expected-outcome values; callers cannot weaken a required case.'
  union all
  select 'catalog_finalize_blocks_pending_or_skipped_blocking',case when exists(
    select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='ywi_rpc_finalize_staging_acceptance_run'
      and pg_get_functiondef(p.oid) ~ 'case_status=''pending''' and pg_get_functiondef(p.oid) ~ 'case_status in \(''failed'',''skipped''\)'
  ) then 'passed' else 'failed' end,'Finalization blocks pending evidence and treats skipped blocking cases as failures.'
  union all
  select 'catalog_never_auto_closes_scorecard',case when not exists(
    select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'
      and p.proname in ('ywi_rpc_start_staging_acceptance_run','ywi_rpc_record_staging_acceptance_result','ywi_rpc_finalize_staging_acceptance_run','ywi_rpc_signoff_staging_acceptance_run')
      and pg_get_functiondef(p.oid) ~* 'update[[:space:]]+public\.admin_scorecard_progress_rails'
  ) then 'passed' else 'failed' end,'Scenario evidence, finalization and human signoff never update scorecard rail completion state.';
$$;

revoke all on function public.ywi_staging_acceptance_catalog_assertions() from public,anon,authenticated;
grant execute on function public.ywi_staging_acceptance_catalog_assertions() to service_role;

insert into public.it_readiness_check_registry(check_key,check_group,check_title,severity_if_failed,action_hint,route_hint,sort_order,is_enabled)
values('staging_acceptance_scenario_catalog','Acceptance','All staging rails have fail-closed evidence checklists and prerequisite truth','critical',
  'Use Admin > I.T. to review each rail checklist. Start runs only against a dedicated non-production project; record every blocking case before finalization and signoff.',
  'Admin > I.T. Readiness',39,true)
on conflict(check_key) do update set check_group=excluded.check_group,check_title=excluded.check_title,severity_if_failed=excluded.severity_if_failed,
  action_hint=excluded.action_hint,route_hint=excluded.route_hint,sort_order=excluded.sort_order,is_enabled=excluded.is_enabled,updated_at=now();

insert into public.admin_scorecard_progress_rails(
  rail_key,rail_area,rail_title,rail_status,progress_percent,current_value,target_value,next_action_hint,owner_hint,sort_order,metadata
) values(
  'schema187_staging_scenario_catalog','release','Staging acceptance scenario catalog and prerequisite truth convergence','active',90,9,10,
  'Verify six-rail catalog coverage, pending-case seeding, human evidence recording/finalization UI, source/browser gates, and exact-main release evidence. Do not close any business staging rail.',
  'I.T. / Release',107,jsonb_build_object('schema',187,'build','2026-09-03a','business_rail_auto_close',false,'finance_mutation',false,'payment_provider_mutation',false,'production_promotion',false)
)
on conflict(rail_key) do update set rail_area=excluded.rail_area,rail_title=excluded.rail_title,rail_status=excluded.rail_status,
  progress_percent=excluded.progress_percent,current_value=excluded.current_value,target_value=excluded.target_value,next_action_hint=excluded.next_action_hint,
  owner_hint=excluded.owner_hint,sort_order=excluded.sort_order,metadata=excluded.metadata,updated_at=now();

insert into public.it_scorecard_rail_resolution_contracts(
  rail_key,resolution_class,requires_human,requires_external,auto_close_allowed,resolution_note,introduced_by_schema
) values(
  'schema187_staging_scenario_catalog','build_acceptance',false,false,false,
  'Close Build 187 only after catalog assertions, source/browser acceptance, protected Admin I.T. case workflow, and exact-main release evidence are green. Business staging rails remain human-gated.',187
)
on conflict(rail_key) do update set resolution_class=excluded.resolution_class,requires_human=excluded.requires_human,requires_external=excluded.requires_external,
  auto_close_allowed=excluded.auto_close_allowed,resolution_note=excluded.resolution_note,introduced_by_schema=excluded.introduced_by_schema,updated_at=now();

create or replace view public.v_schema_drift_status with (security_invoker=true) as
select 187::int as expected_schema_version,
  coalesce(max(schema_version) filter(where status='applied'),0)::int as latest_applied_schema_version,
  case when coalesce(max(schema_version) filter(where status='applied'),0)>=187 then 'current' else 'behind' end::text as drift_status,
  case when coalesce(max(schema_version) filter(where status='applied'),0)>=187 then 'Live database is at or ahead of the repo schema marker.' else 'Live database is behind the deployed app. Apply migrations through schema 187 in order.' end::text as message,
  now() as checked_at
from public.app_schema_versions;
revoke all on table public.v_schema_drift_status from public,anon,authenticated;
grant select on table public.v_schema_drift_status to service_role;

insert into public.app_schema_versions(schema_version,migration_key,schema_name,release_label,description,status,notes)
values(187,'187_staging_acceptance_scenario_catalog','187_staging_acceptance_scenario_catalog.sql','2026-09-03a',
  'Adds a service-private rail-specific staging acceptance scenario catalog; new runs seed all required cases pending and finalization fails closed until evidence is explicit.',
  'applied','No business staging rail is closed. Finance posting execution, provider/payment mutation and Production promotion remain untouched.')
on conflict(schema_version) do update set migration_key=excluded.migration_key,schema_name=excluded.schema_name,release_label=excluded.release_label,
  description=excluded.description,status=excluded.status,notes=excluded.notes,applied_at=now();

commit;
