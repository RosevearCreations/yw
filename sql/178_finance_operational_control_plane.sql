-- 178_finance_operational_control_plane.sql
-- Build 2026-09-02j
-- Adds a unified Finance completion lifecycle, actionable blocker/reconciliation views and
-- Admin > I.T. operational readiness. This release is observability/control-plane only:
-- it does not enable posting execution, approve accountant mappings, mutate providers/payments,
-- write back to Jobs, create a fifth module or promote Production.

begin;

create or replace view public.v_finance_job_completion_operational_lifecycle
with (security_invoker=true)
as
with execution_control as (
  select
    coalesce(max(execution_enabled::int),0)=1 as execution_release_enabled,
    false::boolean as provider_mutation_authorized
  from public.finance_job_completion_posting_execution_controls
  where control_key='finance_job_completion_v1'
)
select
  r.intake_id,
  r.source_event_id,
  r.job_id,
  r.job_code,
  r.job_name,
  r.completion_review_id,
  r.completion_review_status,
  r.completion_date,
  r.accounting_ready,
  r.work_order_id,
  r.work_order_number,
  r.client_id,
  r.client_name,
  r.client_site_id,
  r.site_name,
  r.subtotal,
  r.tax_total,
  r.total_amount,
  r.intake_status,
  r.source_occurred_at,
  r.queued_at,
  r.disposition_id,
  r.disposition_status,
  r.disposition_reason,
  r.reviewed_by_profile_id,
  r.reviewed_by_name,
  r.reviewed_at,
  r.candidate_generation_status,
  r.invoice_candidate_id,
  r.invoice_candidate_status,
  r.journal_candidate_id,
  r.journal_candidate_status,
  pa.id as posting_approval_id,
  pa.approval_status as posting_approval_status,
  pa.approval_reason as posting_approval_reason,
  pa.approved_by_profile_id as posting_approved_by_profile_id,
  pa.approved_at as posting_approved_at,
  pa.idempotency_key as posting_idempotency_key,
  pf.preflight_status,
  pf.invoice_mapping_status,
  pf.journal_mapping_status,
  pf.paired_consistency_status,
  coalesce(pf.blockers,'[]'::jsonb) as preflight_blockers,
  pf.invoice_plan,
  pf.journal_plan,
  er.id as execution_run_id,
  er.execution_status as posting_execution_status,
  er.attempt_count as posting_attempt_count,
  er.invoice_posting_id,
  er.ar_invoice_id,
  er.journal_posting_id,
  er.gl_batch_id,
  er.last_error as posting_execution_error,
  er.started_at as posting_started_at,
  er.completed_at as posting_completed_at,
  er.updated_at as posting_updated_at,
  rv.id as reversal_id,
  rv.reversal_status,
  rv.reason as reversal_reason,
  rv.reversal_gl_batch_id,
  rv.completed_at as reversal_completed_at,
  ec.execution_release_enabled,
  ec.provider_mutation_authorized,
  case
    when rv.reversal_status='completed' then 'reversed'
    when er.execution_status='recovery_required' then 'recovery_required'
    when er.execution_status='failed' then 'posting_failed'
    when er.execution_status='completed' then 'posted'
    when r.disposition_status='rejected' then 'rejected'
    when r.disposition_id is null then 'awaiting_review'
    when r.disposition_status='approved' and r.candidate_generation_status='eligible' then 'awaiting_candidate_generation'
    when r.candidate_generation_status='blocked' then 'candidate_blocked'
    when r.candidate_generation_status='generated' and pa.id is null then 'awaiting_posting_approval'
    when pa.id is not null and coalesce(pf.preflight_status,'blocked')<>'passed_execution_closed' then 'preflight_blocked'
    when pa.id is not null and pf.preflight_status='passed_execution_closed' and not ec.execution_release_enabled then 'release_blocked'
    when pa.id is not null and pf.preflight_status='passed_execution_closed' and ec.execution_release_enabled then 'ready_to_execute'
    else 'blocked'
  end::text as lifecycle_stage,
  case
    when rv.reversal_status='completed' then 'POSTING_REVERSED'
    when er.execution_status='recovery_required' then 'POSTING_RECOVERY_REQUIRED'
    when er.execution_status='failed' then 'POSTING_EXECUTION_FAILED'
    when er.execution_status='completed' then 'POSTED'
    when r.disposition_status='rejected' then 'FINANCE_REVIEW_REJECTED'
    when r.disposition_id is null then 'FINANCE_REVIEW_REQUIRED'
    when r.disposition_status='approved' and r.candidate_generation_status='eligible' then 'CANDIDATE_GENERATION_REQUIRED'
    when r.candidate_generation_status='blocked' then 'CANDIDATE_GENERATION_BLOCKED'
    when r.candidate_generation_status='generated' and pa.id is null then 'POSTING_APPROVAL_REQUIRED'
    when pa.id is not null and jsonb_array_length(coalesce(pf.blockers,'[]'::jsonb))>0 then coalesce(pf.blockers->0->>'code','POSTING_PREFLIGHT_BLOCKED')
    when pa.id is not null and coalesce(pf.preflight_status,'blocked')<>'passed_execution_closed' then 'POSTING_PREFLIGHT_BLOCKED'
    when pa.id is not null and pf.preflight_status='passed_execution_closed' and not ec.execution_release_enabled then 'EXECUTION_RELEASE_DISABLED'
    when pa.id is not null and pf.preflight_status='passed_execution_closed' and ec.execution_release_enabled then 'READY_TO_EXECUTE'
    else 'FINANCE_PIPELINE_BLOCKED'
  end::text as blocker_code,
  case
    when rv.reversal_status='completed' then 'The posting was reversed through the auditable Schema 177 reversal authority.'
    when er.execution_status='recovery_required' then coalesce(er.last_error,'A partial/orphan accounting state requires Finance/I.T. recovery review before retry.')
    when er.execution_status='failed' then coalesce(er.last_error,'The controlled posting attempt failed and requires investigation before retry.')
    when er.execution_status='completed' then 'The Finance posting pair is complete and linked to AR and GL records.'
    when r.disposition_status='rejected' then coalesce(r.disposition_reason,'Finance rejected this completion intake.')
    when r.disposition_id is null then 'A human Finance disposition is required before draft accounting candidates may be generated.'
    when r.disposition_status='approved' and r.candidate_generation_status='eligible' then 'Finance approved the completion; generate the server-owned draft invoice/journal candidate pair.'
    when r.candidate_generation_status='blocked' then 'Draft candidate generation is blocked and requires Finance review.'
    when r.candidate_generation_status='generated' and pa.id is null then 'A separate human Finance posting approval is required before execution can ever be considered.'
    when pa.id is not null and jsonb_array_length(coalesce(pf.blockers,'[]'::jsonb))>0 then coalesce(pf.blockers->0->>'message','Posting preflight is blocked.')
    when pa.id is not null and coalesce(pf.preflight_status,'blocked')<>'passed_execution_closed' then 'Posting preflight has not passed.'
    when pa.id is not null and pf.preflight_status='passed_execution_closed' and not ec.execution_release_enabled then 'Preflight is clear, but the server-owned Finance posting execution release remains disabled.'
    when pa.id is not null and pf.preflight_status='passed_execution_closed' and ec.execution_release_enabled then 'All current posting prerequisites are satisfied; controlled execution is eligible.'
    else 'Finance completion processing is blocked by an unresolved lifecycle state.'
  end::text as blocker_message,
  case
    when rv.reversal_status='completed' then 'No destructive edit is required; retain the original and reversal accounting history.'
    when er.execution_status='recovery_required' then 'Open Admin > I.T. Readiness, inspect the Finance reconciliation issue, and resolve the partial/orphan state before any retry.'
    when er.execution_status='failed' then 'Review the execution error and preflight state; retry only through the protected Finance action after the cause is corrected.'
    when er.execution_status='completed' then 'No Finance posting action is required. Reversal, if ever required, remains Finance manage-only.'
    when r.disposition_status='rejected' then 'No posting action is available for a rejected completion. Preserve the recorded Finance reason.'
    when r.disposition_id is null then 'Finance approve access may approve or reject the completion with a reason.'
    when r.disposition_status='approved' and r.candidate_generation_status='eligible' then 'Generate draft candidates through the protected Finance review action; this does not post or charge anything.'
    when r.candidate_generation_status='blocked' then 'Inspect the completion review and canonical identity/totals before attempting candidate generation again.'
    when r.candidate_generation_status='generated' and pa.id is null then 'Finance approve access may record the separate posting approval after reviewing both draft candidates.'
    when pa.id is not null and jsonb_array_length(coalesce(pf.blockers,'[]'::jsonb))>0 then 'Resolve the first preflight blocker shown here, then rerun read-only preflight. Do not bypass server-owned mappings or totals.'
    when pa.id is not null and pf.preflight_status='passed_execution_closed' and not ec.execution_release_enabled then 'No operator action is required unless a deliberate future release separately enables execution. The browser cannot enable it.'
    when pa.id is not null and pf.preflight_status='passed_execution_closed' and ec.execution_release_enabled then 'Finance approve access may invoke the protected idempotent execution action.'
    else 'Inspect the Finance lifecycle and I.T. reconciliation status before continuing.'
  end::text as action_hint,
  now() as checked_at
from public.v_finance_job_completion_review_queue r
left join public.finance_job_completion_posting_approvals pa on pa.intake_id=r.intake_id
left join public.v_finance_job_completion_posting_preflight_queue pf on pf.intake_id=r.intake_id
left join public.finance_job_completion_posting_execution_runs er on er.intake_id=r.intake_id
left join public.finance_job_completion_posting_reversals rv on rv.execution_run_id=er.id
cross join execution_control ec;

revoke all on table public.v_finance_job_completion_operational_lifecycle from public,anon,authenticated;
grant select on table public.v_finance_job_completion_operational_lifecycle to service_role;

create or replace view public.v_finance_job_completion_operational_summary
with (security_invoker=true)
as
select
  count(*)::int as total_intake_count,
  count(*) filter(where lifecycle_stage='awaiting_review')::int as awaiting_review_count,
  count(*) filter(where lifecycle_stage='awaiting_review' and queued_at < now()-interval '24 hours')::int as stale_review_count,
  count(*) filter(where lifecycle_stage='rejected')::int as rejected_count,
  count(*) filter(where lifecycle_stage='awaiting_candidate_generation')::int as awaiting_candidate_generation_count,
  count(*) filter(where lifecycle_stage='candidate_blocked')::int as candidate_blocked_count,
  count(*) filter(where lifecycle_stage='awaiting_posting_approval')::int as awaiting_posting_approval_count,
  count(*) filter(where lifecycle_stage='preflight_blocked')::int as preflight_blocked_count,
  count(*) filter(where lifecycle_stage='release_blocked')::int as release_blocked_count,
  count(*) filter(where lifecycle_stage='ready_to_execute')::int as ready_to_execute_count,
  count(*) filter(where lifecycle_stage='posting_failed')::int as posting_failed_count,
  count(*) filter(where lifecycle_stage='recovery_required')::int as recovery_required_count,
  count(*) filter(where lifecycle_stage='posted')::int as posted_count,
  count(*) filter(where lifecycle_stage='reversed')::int as reversed_count,
  coalesce(bool_or(execution_release_enabled),false) as execution_release_enabled,
  false::boolean as provider_mutation_authorized,
  now() as checked_at
from public.v_finance_job_completion_operational_lifecycle;

revoke all on table public.v_finance_job_completion_operational_summary from public,anon,authenticated;
grant select on table public.v_finance_job_completion_operational_summary to service_role;

create or replace view public.v_finance_job_completion_reconciliation_issues
with (security_invoker=true)
as
select
  'invoice_candidate_orphan_intake:'||c.id::text as issue_key,
  'critical'::text as severity,
  'INVOICE_CANDIDATE_ORPHAN_INTAKE'::text as issue_code,
  i.id as intake_id,
  'job_invoice_candidate'::text as source_record_type,
  c.id as source_record_id,
  null::uuid as related_record_id,
  'Schema 172 Finance invoice candidate does not resolve to its declared Finance intake.'::text as details,
  'Do not post this candidate. Reconcile its immutable Finance intake/disposition provenance first.'::text as action_hint,
  now() as detected_at
from public.job_invoice_candidates c
left join public.finance_job_completion_intake i on i.id::text=coalesce(c.payload->>'finance_intake_id','')
where coalesce(c.payload->>'candidate_authority','')='schema172_finance_review' and i.id is null
union all
select
  'journal_candidate_orphan_intake:'||c.id::text,'critical','JOURNAL_CANDIDATE_ORPHAN_INTAKE',i.id,
  'job_journal_candidate',c.id,null::uuid,
  'Schema 172 Finance journal candidate does not resolve to its declared Finance intake.',
  'Do not post this candidate. Reconcile its immutable Finance intake/disposition provenance first.',now()
from public.job_journal_candidates c
left join public.finance_job_completion_intake i on i.id::text=coalesce(c.payload->>'finance_intake_id','')
where coalesce(c.payload->>'candidate_authority','')='schema172_finance_review' and i.id is null
union all
select
  'invoice_candidate_missing_disposition:'||c.id::text,'critical','INVOICE_CANDIDATE_MISSING_DISPOSITION',i.id,
  'job_invoice_candidate',c.id,null::uuid,
  'Schema 172 Finance invoice candidate is not referenced by its canonical Finance disposition.',
  'Reconcile the candidate/disposition identity chain; do not fabricate a replacement link.',now()
from public.job_invoice_candidates c
left join public.finance_job_completion_intake i on i.id::text=coalesce(c.payload->>'finance_intake_id','')
where coalesce(c.payload->>'candidate_authority','')='schema172_finance_review'
  and not exists(select 1 from public.finance_job_completion_review_dispositions d where d.invoice_candidate_id=c.id)
union all
select
  'journal_candidate_missing_disposition:'||c.id::text,'critical','JOURNAL_CANDIDATE_MISSING_DISPOSITION',i.id,
  'job_journal_candidate',c.id,null::uuid,
  'Schema 172 Finance journal candidate is not referenced by its canonical Finance disposition.',
  'Reconcile the candidate/disposition identity chain; do not fabricate a replacement link.',now()
from public.job_journal_candidates c
left join public.finance_job_completion_intake i on i.id::text=coalesce(c.payload->>'finance_intake_id','')
where coalesce(c.payload->>'candidate_authority','')='schema172_finance_review'
  and not exists(select 1 from public.finance_job_completion_review_dispositions d where d.journal_candidate_id=c.id)
union all
select
  'invoice_posting_missing_candidate:'||p.id::text,'critical','INVOICE_POSTING_MISSING_CANDIDATE',null::uuid,
  'job_invoice_posting',p.id,p.invoice_candidate_id,
  'Invoice posting references no live invoice candidate.',
  'Quarantine the posting path and restore referential integrity before any Finance retry.',now()
from public.job_invoice_postings p
left join public.job_invoice_candidates c on c.id=p.invoice_candidate_id
where c.id is null
union all
select
  'journal_posting_missing_candidate:'||p.id::text,'critical','JOURNAL_POSTING_MISSING_CANDIDATE',null::uuid,
  'job_journal_posting',p.id,p.journal_candidate_id,
  'Journal posting references no live journal candidate.',
  'Quarantine the posting path and restore referential integrity before any Finance retry.',now()
from public.job_journal_postings p
left join public.job_journal_candidates c on c.id=p.journal_candidate_id
where c.id is null
union all
select
  'schema177_invoice_posting_missing_run:'||p.id::text,'critical','SCHEMA177_INVOICE_POSTING_MISSING_EXECUTION_RUN',i.id,
  'job_invoice_posting',p.id,p.ar_invoice_id,
  'Schema 177 Finance invoice posting is not linked from its durable execution run.',
  'Mark the lifecycle for recovery review; never create a duplicate posting to compensate.',now()
from public.job_invoice_postings p
left join public.finance_job_completion_posting_execution_runs er on er.invoice_posting_id=p.id
left join public.finance_job_completion_intake i on i.id::text=coalesce(p.posting_payload->>'finance_intake_id','')
where coalesce(p.posting_payload->>'posting_authority','')='schema177_finance_posting_execution' and er.id is null
union all
select
  'schema177_journal_posting_missing_run:'||p.id::text,'critical','SCHEMA177_JOURNAL_POSTING_MISSING_EXECUTION_RUN',i.id,
  'job_journal_posting',p.id,p.gl_batch_id,
  'Schema 177 Finance journal posting is not linked from its durable execution run.',
  'Mark the lifecycle for recovery review; never create a duplicate posting to compensate.',now()
from public.job_journal_postings p
left join public.finance_job_completion_posting_execution_runs er on er.journal_posting_id=p.id
left join public.finance_job_completion_intake i on i.id::text=coalesce(p.posting_payload->>'finance_intake_id','')
where coalesce(p.posting_payload->>'posting_authority','')='schema177_finance_posting_execution' and er.id is null
union all
select
  'completed_execution_incomplete_pair:'||er.id::text,'critical','COMPLETED_EXECUTION_INCOMPLETE_PAIR',er.intake_id,
  'finance_posting_execution_run',er.id,er.posting_approval_id,
  'Completed Finance execution is missing one or more invoice/journal/AR/GL identities.',
  'Treat this run as accounting divergence and require I.T./Finance recovery review before any retry.',now()
from public.finance_job_completion_posting_execution_runs er
where er.execution_status='completed'
  and (er.invoice_posting_id is null or er.ar_invoice_id is null or er.journal_posting_id is null or er.gl_batch_id is null)
union all
select
  'completed_execution_unbalanced_gl:'||er.id::text,'critical','COMPLETED_EXECUTION_UNBALANCED_GL',er.intake_id,
  'finance_posting_execution_run',er.id,er.gl_batch_id,
  'Completed Finance execution references a GL batch that is missing, unposted, or unbalanced.',
  'Do not alter posted history in place. Investigate the execution run and use auditable recovery/reversal authority if required.',now()
from public.finance_job_completion_posting_execution_runs er
left join public.gl_journal_batches b on b.id=er.gl_batch_id
where er.execution_status in ('completed','reversed')
  and (b.id is null or b.batch_status<>'posted' or b.is_balanced is not true or b.debit_total<>b.credit_total)
union all
select
  'completed_reversal_invalid:'||rv.id::text,'critical','COMPLETED_REVERSAL_INVALID',er.intake_id,
  'finance_posting_reversal',rv.id,rv.reversal_gl_batch_id,
  'Completed Finance reversal is not paired with a reversed execution run and a separate balanced posted reversal batch.',
  'Preserve original accounting history and reconcile the reversal authority before further action.',now()
from public.finance_job_completion_posting_reversals rv
join public.finance_job_completion_posting_execution_runs er on er.id=rv.execution_run_id
left join public.gl_journal_batches b on b.id=rv.reversal_gl_batch_id
where rv.reversal_status='completed'
  and (er.execution_status<>'reversed' or b.id is null or b.batch_status<>'posted' or b.is_balanced is not true or b.debit_total<>b.credit_total)
union all
select
  'duplicate_invoice_candidate_posting:'||p.invoice_candidate_id::text,'critical','DUPLICATE_INVOICE_POSTING_REFERENCE',null::uuid,
  'job_invoice_posting',min(p.id),p.invoice_candidate_id,
  format('%s invoice posting rows reference the same candidate.',count(*)),
  'Keep the uniqueness guard intact and investigate any bypass before Finance posting is released.',now()
from public.job_invoice_postings p
group by p.invoice_candidate_id having count(*)>1
union all
select
  'duplicate_journal_candidate_posting:'||p.journal_candidate_id::text,'critical','DUPLICATE_JOURNAL_POSTING_REFERENCE',null::uuid,
  'job_journal_posting',min(p.id),p.journal_candidate_id,
  format('%s journal posting rows reference the same candidate.',count(*)),
  'Keep the uniqueness guard intact and investigate any bypass before Finance posting is released.',now()
from public.job_journal_postings p
group by p.journal_candidate_id having count(*)>1;

revoke all on table public.v_finance_job_completion_reconciliation_issues from public,anon,authenticated;
grant select on table public.v_finance_job_completion_reconciliation_issues to service_role;

create or replace view public.v_it_finance_completion_pipeline_status
with (security_invoker=true)
as
with lifecycle as (
  select * from public.v_finance_job_completion_operational_summary
), consumer as (
  select
    count(*) filter(where run_status in ('failed','error') or failed_count>0)::int as consumer_failure_count,
    max(finished_at) as last_consumer_finished_at
  from public.finance_job_completion_consumer_runs
  where started_at >= now()-interval '24 hours'
), reconciliation as (
  select
    count(*)::int as reconciliation_issue_count,
    count(*) filter(where severity='critical')::int as critical_reconciliation_issue_count,
    count(*) filter(where issue_code ilike 'DUPLICATE%')::int as duplicate_reference_issue_count,
    count(*) filter(where issue_code in ('COMPLETED_EXECUTION_INCOMPLETE_PAIR','COMPLETED_EXECUTION_UNBALANCED_GL','COMPLETED_REVERSAL_INVALID','SCHEMA177_INVOICE_POSTING_MISSING_EXECUTION_RUN','SCHEMA177_JOURNAL_POSTING_MISSING_EXECUTION_RUN'))::int as accounting_divergence_issue_count
  from public.v_finance_job_completion_reconciliation_issues
), mappings as (
  select
    count(*) filter(where mapping_approved)::int as approved_required_posting_mapping_count,
    count(*)::int as required_posting_mapping_count
  from public.v_finance_posting_account_mapping_authority
)
select
  l.total_intake_count,
  coalesce(c.consumer_failure_count,0)::int as consumer_failure_count,
  c.last_consumer_finished_at,
  l.stale_review_count,
  l.candidate_blocked_count as candidate_failure_count,
  l.awaiting_posting_approval_count,
  l.preflight_blocked_count,
  l.posting_failed_count as posting_failure_count,
  l.recovery_required_count,
  coalesce(r.reconciliation_issue_count,0)::int as reconciliation_issue_count,
  coalesce(r.critical_reconciliation_issue_count,0)::int as critical_reconciliation_issue_count,
  coalesce(r.duplicate_reference_issue_count,0)::int as duplicate_reference_issue_count,
  coalesce(r.accounting_divergence_issue_count,0)::int as accounting_divergence_issue_count,
  m.approved_required_posting_mapping_count,
  m.required_posting_mapping_count,
  l.execution_release_enabled,
  false::boolean as provider_mutation_authorized,
  case
    when coalesce(r.critical_reconciliation_issue_count,0)>0 or l.recovery_required_count>0 then 'red'
    when coalesce(c.consumer_failure_count,0)>0 or l.stale_review_count>0 or l.candidate_blocked_count>0 or l.preflight_blocked_count>0 or l.posting_failed_count>0 then 'amber'
    else 'green'
  end::text as pipeline_status,
  jsonb_build_array(
    jsonb_build_object('when','consumer_failure','action','Inspect Finance consumer runs and retry only the failed idempotent intake path.'),
    jsonb_build_object('when','stale_review','action','Review Finance completion intakes older than 24 hours; do not auto-dispose them.'),
    jsonb_build_object('when','preflight_blocked','action','Resolve reason-coded preflight blockers without bypassing server-owned totals or accountant mappings.'),
    jsonb_build_object('when','recovery_required','action','Quarantine retries until reconciliation shows a complete AR/GL pair or an auditable reversal path.'),
    jsonb_build_object('when','accounting_divergence','action','Preserve posted history and reconcile linked Finance execution, AR and GL identities before further action.')
  ) as recovery_actions,
  now() as checked_at
from lifecycle l cross join consumer c cross join reconciliation r cross join mappings m;

revoke all on table public.v_it_finance_completion_pipeline_status from public,anon,authenticated;
grant select on table public.v_it_finance_completion_pipeline_status to service_role;

create or replace function public.ywi_finance_operational_control_plane_assertions()
returns table(assertion_key text,assertion_status text,details text)
language sql
stable
security invoker
set search_path=public,pg_temp
as $$
  select 'finance_operational_views_private',
    case when not exists(
      select 1 from information_schema.table_privileges
      where table_schema='public'
        and table_name in ('v_finance_job_completion_operational_lifecycle','v_finance_job_completion_operational_summary','v_finance_job_completion_reconciliation_issues','v_it_finance_completion_pipeline_status')
        and grantee in ('anon','authenticated','PUBLIC')
    ) then 'passed' else 'failed' end,
    'Finance lifecycle, reconciliation and I.T. pipeline views remain private service-role control-plane surfaces.'
  union all
  select 'finance_lifecycle_one_row_per_intake',
    case when not exists(select 1 from public.v_finance_job_completion_operational_lifecycle group by intake_id having count(*)<>1)
      then 'passed' else 'failed' end,
    'The operational lifecycle has at most one row for each canonical Finance intake.'
  union all
  select 'finance_lifecycle_covers_intake',
    case when (select count(*) from public.v_finance_job_completion_operational_lifecycle)=(select count(*) from public.finance_job_completion_intake)
      then 'passed' else 'failed' end,
    'Every canonical Finance job-completion intake is represented in the operational lifecycle.'
  union all
  select 'finance_operational_provider_mutation_closed',
    case when not exists(select 1 from public.v_finance_job_completion_operational_lifecycle where provider_mutation_authorized)
      and not exists(select 1 from public.v_it_finance_completion_pipeline_status where provider_mutation_authorized)
      then 'passed' else 'failed' end,
    'Build 178 does not authorize Stripe, PayPal or any provider/payment mutation.'
  union all
  select 'finance_execution_release_server_owned',
    case when not exists(
      select 1 from information_schema.table_privileges
      where table_schema='public' and table_name='finance_job_completion_posting_execution_controls'
        and grantee in ('anon','authenticated','PUBLIC')
    ) then 'passed' else 'failed' end,
    'The browser cannot enable the Finance posting execution release.'
  union all
  select 'finance_posting_duplicate_references_absent',
    case when not exists(
      select 1 from public.v_finance_job_completion_reconciliation_issues
      where issue_code in ('DUPLICATE_INVOICE_POSTING_REFERENCE','DUPLICATE_JOURNAL_POSTING_REFERENCE')
    ) then 'passed' else 'failed' end,
    'Invoice and journal posting candidate references remain unique.'
  union all
  select 'finance_completed_pair_integrity',
    case when not exists(
      select 1 from public.v_finance_job_completion_reconciliation_issues
      where issue_code in ('COMPLETED_EXECUTION_INCOMPLETE_PAIR','COMPLETED_EXECUTION_UNBALANCED_GL','SCHEMA177_INVOICE_POSTING_MISSING_EXECUTION_RUN','SCHEMA177_JOURNAL_POSTING_MISSING_EXECUTION_RUN')
    ) then 'passed' else 'failed' end,
    'Completed Schema 177 posting executions retain a complete linked AR/GL pair.'
  union all
  select 'finance_reversal_integrity',
    case when not exists(select 1 from public.v_finance_job_completion_reconciliation_issues where issue_code='COMPLETED_REVERSAL_INVALID')
      then 'passed' else 'failed' end,
    'Completed reversals remain linked to a reversed execution and a separate balanced posted reversal batch.'
  union all
  select 'finance_schema_dependencies_current',
    case when not exists(select 1 from public.v_it_schema_dependency_status where required_by_schema<=178 and check_status<>'passed')
      then 'passed' else 'failed' end,
    'Every registered Finance/core dependency required through Schema 178 matches the live relation/column/type contract.'
  union all
  select 'finance_admin_preflight_tracks_current_schema',
    case when pg_get_viewdef('public.v_admin_schema_preflight_checks'::regclass,true) ilike '%expected_schema_version%'
      and pg_get_viewdef('public.v_admin_schema_preflight_checks'::regclass,true) not ilike '%required_by_schema <= 173%'
      then 'passed' else 'failed' end,
    'Admin > I.T. schema preflight follows the current schema marker instead of stopping at Schema 173.';
$$;

revoke all on function public.ywi_finance_operational_control_plane_assertions() from public,anon,authenticated;
grant execute on function public.ywi_finance_operational_control_plane_assertions() to service_role;

insert into public.app_schema_dependency_contracts(
  contract_key,relation_schema,relation_name,column_name,expected_data_type,owner_module,
  introduced_by_schema,required_by_schema,is_required,notes
) values
  ('finance_disposition_candidate_generation_status','public','finance_job_completion_review_dispositions','candidate_generation_status','text','finance',172,178,true,'Operational lifecycle candidate-generation state.'),
  ('finance_posting_execution_run_status','public','finance_job_completion_posting_execution_runs','execution_status','text','finance',177,178,true,'Operational lifecycle execution/recovery state.'),
  ('job_invoice_posting_ar_invoice_id','public','job_invoice_postings','ar_invoice_id','uuid','finance',101,178,true,'Existing AR posting link reused by Finance execution reconciliation.'),
  ('job_journal_posting_gl_batch_id','public','job_journal_postings','gl_batch_id','uuid','finance',101,178,true,'Existing GL posting link reused by Finance execution reconciliation.')
on conflict(contract_key) do update set
  relation_schema=excluded.relation_schema,relation_name=excluded.relation_name,column_name=excluded.column_name,
  expected_data_type=excluded.expected_data_type,owner_module=excluded.owner_module,
  introduced_by_schema=excluded.introduced_by_schema,required_by_schema=excluded.required_by_schema,
  is_required=excluded.is_required,notes=excluded.notes,updated_at=now();

create or replace view public.v_admin_schema_preflight_checks
with (security_invoker=true)
as
select
  p.check_key,p.check_area,p.required_object_type,p.required_object_name,p.expected_status,
  p.live_status,p.check_status,p.operator_hint,p.failure_hint,p.sort_order,p.checked_at,p.updated_at
from public.admin_schema_preflight_checks p
union all
select
  'finance_schema_dependency_contract'::text,
  'Architecture'::text,
  'column_contract'::text,
  'registered dependencies through current schema'::text,
  'all_required_columns_match'::text,
  case when count(*) filter(where check_status<>'passed')=0 then 'present' else 'mismatch' end::text,
  case when count(*) filter(where check_status<>'passed')=0 then 'passed' else 'failed' end::text,
  'Every dependency registered through the current schema marker must match the live relation/column/type contract.'::text,
  'Do not apply or release dependent Finance code while any current registered schema dependency is missing or mismatched.'::text,
  145::int,
  now(),
  now()
from public.v_it_schema_dependency_status
where required_by_schema <= coalesce((select expected_schema_version from public.v_schema_drift_status limit 1),178)
order by sort_order,check_area,required_object_name;

revoke all on table public.v_admin_schema_preflight_checks from public,anon,authenticated;
grant select on table public.v_admin_schema_preflight_checks to service_role;

insert into public.it_readiness_check_registry(
  check_key,check_group,check_title,severity_if_failed,action_hint,route_hint,sort_order,is_enabled
) values(
  'finance_operational_control_plane','Finance','Finance completion lifecycle and reconciliation control plane','critical',
  'Review reason-coded Finance lifecycle blockers, recovery-required runs and reconciliation divergence before any posting release or retry.',
  'Admin > I.T. Readiness',48,true
)
on conflict(check_key) do update set
  check_group=excluded.check_group,check_title=excluded.check_title,severity_if_failed=excluded.severity_if_failed,
  action_hint=excluded.action_hint,route_hint=excluded.route_hint,sort_order=excluded.sort_order,is_enabled=excluded.is_enabled,updated_at=now();

update public.admin_scorecard_progress_rails
set rail_status='complete',progress_percent=100,current_value=10,target_value=10,
    next_action_hint='Schema 177 is release-proven with exact-main evidence and protected Finance Edge v3; live execution release remains disabled.',
    updated_at=now()
where rail_key='schema177_finance_posting_execution_recovery';

insert into public.admin_scorecard_progress_rails(
  rail_key,rail_area,rail_title,rail_status,progress_percent,current_value,target_value,
  next_action_hint,owner_hint,sort_order,metadata
) values(
  'schema178_finance_operational_control_plane','finance','Finance lifecycle, blocker and reconciliation control plane','active',90,9,10,
  'Merge exact green Schema 178 source, apply/verify live lifecycle and reconciliation assertions, deploy protected Finance/Admin I.T. functions, and record exact-main release evidence.',
  'Finance / I.T. / Accounting',98,
  '{"build":"2026-09-02j","schema":178,"unified_lifecycle":true,"reason_coded_blockers":true,"finance_reconciliation":true,"it_pipeline_readiness":true,"posting_execution_release_enabled":false,"jobs_writeback":false,"provider_mutation":false,"production_promotion":false}'::jsonb
)
on conflict(rail_key) do update set
  rail_area=excluded.rail_area,rail_title=excluded.rail_title,rail_status=excluded.rail_status,
  progress_percent=excluded.progress_percent,current_value=excluded.current_value,target_value=excluded.target_value,
  next_action_hint=excluded.next_action_hint,owner_hint=excluded.owner_hint,sort_order=excluded.sort_order,
  metadata=excluded.metadata,updated_at=now();

insert into public.app_schema_versions(
  schema_version,migration_key,schema_name,release_label,description,status,notes
) values(
  178,'178_finance_operational_control_plane','178_finance_operational_control_plane.sql','2026-09-02j',
  'Adds a unified Finance completion lifecycle, reason-coded blockers, reconciliation/integrity diagnostics and Admin I.T. pipeline readiness over the existing Schema 169-177 accounting authorities.',
  'applied',
  'Observability/control-plane only. Posting execution release stays unchanged/off unless deliberately enabled by a future reviewed authority; accountant mappings remain human-controlled; provider/payment mutation, Jobs writeback, fifth module and Production promotion remain excluded.'
)
on conflict(schema_version) do update set
  migration_key=excluded.migration_key,schema_name=excluded.schema_name,release_label=excluded.release_label,
  description=excluded.description,status=excluded.status,notes=excluded.notes,applied_at=now();

create or replace view public.v_schema_drift_status as
select 178::int as expected_schema_version,
  coalesce(max(schema_version) filter(where status='applied'),0)::int as latest_applied_schema_version,
  case when coalesce(max(schema_version) filter(where status='applied'),0)>=178 then 'current' else 'behind' end as drift_status,
  case when coalesce(max(schema_version) filter(where status='applied'),0)>=178
    then 'Live database is at or ahead of the repo schema marker.'
    else 'Live database is behind the deployed app. Apply migrations through schema 178 in order.' end as message,
  now() as checked_at
from public.app_schema_versions;

commit;
