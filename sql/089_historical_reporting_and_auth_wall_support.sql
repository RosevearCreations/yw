
-- 089_historical_reporting_and_auth_wall_support.sql
-- Adds historical reporting views for OSHA/HSE submissions and cross-workflow history.

create or replace view public.v_hse_submission_history_report as
with review_rollup as (
  select
    sr.submission_id,
    count(*)::int as review_count,
    max(sr.created_at) as last_reviewed_at,
    (array_agg(sr.review_action order by sr.created_at desc nulls last))[1] as last_review_action,
    (array_agg(sr.review_note order by sr.created_at desc nulls last))[1] as last_review_note,
    (array_agg(coalesce(p.full_name, p.email, sr.reviewer_id::text) order by sr.created_at desc nulls last))[1] as last_reviewed_by_name
  from public.submission_reviews sr
  left join public.profiles p on p.id = sr.reviewer_id
  group by sr.submission_id
), image_rollup as (
  select si.submission_id, count(*)::int as image_count
  from public.submission_images si
  group by si.submission_id
)
select
  s.id as submission_id,
  s.form_type,
  s.date as submission_date,
  s.status,
  s.site_id,
  coalesce(st.site_code, s.site, '') as site_code,
  st.site_name,
  trim(both ' ' from concat(coalesce(st.site_code, ''), case when st.site_code is not null and st.site_name is not null then ' — ' else '' end, coalesce(st.site_name, s.site, ''))) as site_label,
  s.submitted_by_profile_id,
  coalesce(sp.full_name, sp.email, s.submitted_by, '') as submitted_by_name,
  s.supervisor_profile_id,
  coalesce(sup.full_name, sup.email, '') as supervisor_name,
  s.admin_profile_id,
  coalesce(adm.full_name, adm.email, '') as admin_name,
  s.reviewed_at,
  coalesce(rev.review_count, 0) as review_count,
  coalesce(img.image_count, 0) as image_count,
  rev.last_reviewed_at,
  rev.last_review_action,
  rev.last_review_note,
  rev.last_reviewed_by_name,
  s.created_at,
  s.updated_at
from public.submissions s
left join public.sites st on st.id = s.site_id
left join public.profiles sp on sp.id = s.submitted_by_profile_id
left join public.profiles sup on sup.id = s.supervisor_profile_id
left join public.profiles adm on adm.id = s.admin_profile_id
left join review_rollup rev on rev.submission_id = s.id
left join image_rollup img on img.submission_id = s.id;

create or replace view public.v_hse_form_daily_rollup as
with base as (
  select * from public.v_hse_submission_history_report
)
select
  submission_date as report_date,
  form_type,
  status,
  count(*)::int as submission_count,
  count(distinct coalesce(site_id::text, site_code, site_name, 'unknown'))::int as unique_site_count,
  coalesce(sum(image_count), 0)::int as image_count,
  count(*) filter (where coalesce(review_count, 0) > 0)::int as reviewed_count,
  count(*) filter (where coalesce(last_review_action, '') = 'rejected' or coalesce(status, '') = 'rejected')::int as rejected_count,
  max(last_reviewed_at) as last_reviewed_at
from base
group by submission_date, form_type, status;

create or replace view public.v_hse_form_site_rollup as
with base as (
  select * from public.v_hse_submission_history_report
)
select
  coalesce(site_id::text, site_code, site_name, 'unknown') as site_ref,
  site_id,
  site_code,
  site_name,
  site_label,
  form_type,
  count(*)::int as submission_count,
  count(*) filter (where coalesce(review_count, 0) > 0)::int as reviewed_count,
  count(*) filter (where coalesce(last_review_action, '') = 'rejected' or coalesce(status, '') = 'rejected')::int as rejected_count,
  coalesce(sum(image_count), 0)::int as image_count,
  max(submission_date) as last_submission_date,
  max(last_reviewed_at) as last_reviewed_at
from base
group by coalesce(site_id::text, site_code, site_name, 'unknown'), site_id, site_code, site_name, site_label, form_type;

create or replace view public.v_workflow_history_report as
select
  'submission'::text as history_type,
  'submissions'::text as source_table,
  s.id::text as source_id,
  coalesce(s.reviewed_at, s.updated_at, s.created_at) as occurred_at,
  coalesce(s.status, 'submitted') as record_status,
  s.id::text as record_number,
  concat(upper(coalesce(s.form_type, 'form')), ' submission') as headline,
  concat(coalesce(st.site_code, st.site_name, s.site, 'Unknown site'), ' • ', coalesce(s.submitted_by, 'submitted')) as detail,
  st.site_code,
  st.site_name
from public.submissions s
left join public.sites st on st.id = s.site_id

union all

select
  'hse_packet_event'::text,
  'hse_packet_events'::text,
  e.id::text,
  e.event_at,
  coalesce(e.event_type, 'event') as record_status,
  coalesce(lp.packet_number, e.packet_id::text) as record_number,
  concat('HSE packet ', coalesce(lp.packet_number, 'event')) as headline,
  coalesce(e.event_summary, e.event_notes, 'Packet event recorded') as detail,
  null::text as site_code,
  null::text as site_name
from public.hse_packet_events e
left join public.linked_hse_packets lp on lp.id = e.packet_id

union all

select
  'evidence_review'::text,
  'media_review_actions'::text,
  m.id::text,
  coalesce(m.reviewed_at, m.updated_at, m.created_at) as occurred_at,
  coalesce(m.review_status, 'pending') as record_status,
  m.target_id::text as record_number,
  concat('Evidence review • ', m.target_entity, ' • ', m.media_stage) as headline,
  coalesce(m.review_notes, 'Evidence status updated') as detail,
  null::text as site_code,
  null::text as site_name
from public.media_review_actions m

union all

select
  'scheduler_run'::text,
  'service_execution_scheduler_runs'::text,
  r.id::text,
  coalesce(r.updated_at, r.created_at) as occurred_at,
  coalesce(r.run_status, 'queued') as record_status,
  coalesce(r.run_code, r.id::text) as record_number,
  'Service execution scheduler run' as headline,
  concat('Candidates: ', coalesce(r.candidate_count, 0), ' • Sessions: ', coalesce(r.session_created_count, 0), ' • Invoice candidates: ', coalesce(r.invoice_candidate_count, 0), ' • Skipped: ', coalesce(r.skipped_count, 0)) as detail,
  null::text as site_code,
  null::text as site_name
from public.service_execution_scheduler_runs r

union all

select
  'payroll_export'::text,
  'payroll_export_runs'::text,
  p.id::text,
  coalesce(p.payroll_closed_at, p.delivery_confirmed_at, p.delivered_at, p.exported_at, p.created_at) as occurred_at,
  coalesce(p.payroll_close_status, p.delivery_status, p.status, 'open') as record_status,
  coalesce(p.export_batch_number, p.id::text) as record_number,
  'Payroll export workflow' as headline,
  concat('Provider: ', coalesce(p.export_provider, 'n/a'), ' • Period: ', coalesce(p.period_start::text, ''), ' to ', coalesce(p.period_end::text, ''), ' • Delivery: ', coalesce(p.delivery_status, 'pending')) as detail,
  null::text as site_code,
  null::text as site_name
from public.payroll_export_runs p

union all

select
  'signed_contract'::text,
  'service_contract_documents'::text,
  d.id::text,
  coalesce(d.signed_at, d.updated_at, d.created_at) as occurred_at,
  coalesce(d.document_status, 'draft') as record_status,
  coalesce(d.document_number, d.contract_reference, d.id::text) as record_number,
  coalesce(d.title, 'Service contract document') as headline,
  concat('Kind: ', coalesce(d.document_kind, 'contract'), case when d.signed_by_name is not null then concat(' • Signed by ', d.signed_by_name) else '' end) as detail,
  null::text as site_code,
  null::text as site_name
from public.service_contract_documents d;
