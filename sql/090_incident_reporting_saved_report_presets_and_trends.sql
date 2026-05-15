-- 090_incident_reporting_saved_report_presets_and_trends.sql
-- Adds incident / near-miss reporting views, saved reporting presets,
-- and richer DB-backed reporting rollups so reporting depends less on browser-local state.
-- This version preserves existing view column order and only appends new columns.

create table if not exists public.report_presets (
  id uuid primary key default gen_random_uuid(),
  preset_scope text not null default 'hse_reporting',
  preset_name text not null,
  visibility text not null default 'private',
  preset_payload jsonb not null default '{}'::jsonb,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists public.report_presets
  drop constraint if exists report_presets_scope_check;

alter table if exists public.report_presets
  add constraint report_presets_scope_check
  check (preset_scope in ('hse_reporting'));

alter table if exists public.report_presets
  drop constraint if exists report_presets_visibility_check;

alter table if exists public.report_presets
  add constraint report_presets_visibility_check
  check (visibility in ('private','shared'));

create index if not exists idx_report_presets_scope
  on public.report_presets(preset_scope, is_active, visibility, created_at desc);

create index if not exists idx_report_presets_creator
  on public.report_presets(created_by_profile_id, created_at desc);

create or replace view public.v_report_preset_directory as
select
  rp.id,
  rp.preset_scope,
  rp.preset_name,
  rp.visibility,
  rp.preset_payload,
  rp.created_by_profile_id,
  coalesce(p.full_name, p.email, '') as created_by_name,
  rp.is_active,
  rp.created_at,
  rp.updated_at
from public.report_presets rp
left join public.profiles p on p.id = rp.created_by_profile_id
where rp.is_active = true;

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
  select
    si.submission_id,
    count(*)::int as image_count
  from public.submission_images si
  group by si.submission_id
), base as (
  select
    s.*,
    case
      when upper(coalesce(s.form_type, '')) in ('E','TOOLBOX') then 'toolbox'
      when upper(coalesce(s.form_type, '')) in ('D','PPE') then 'ppe'
      when upper(coalesce(s.form_type, '')) in ('B','FIRSTAID','FIRST_AID') then 'firstaid'
      when upper(coalesce(s.form_type, '')) in ('C','INSPECTION','SITE_INSPECTION','INSPECT') then 'inspection'
      when upper(coalesce(s.form_type, '')) in ('A','DRILL','EMERGENCY_DRILL') then 'drill'
      when upper(coalesce(s.form_type, '')) in ('F','INCIDENT','INCIDENT_NEAR_MISS','NEAR_MISS') then 'incident'
      else lower(coalesce(s.form_type, 'other'))
    end as form_key,
    case
      when upper(coalesce(s.form_type, '')) in ('E','TOOLBOX') then 'Toolbox Talk'
      when upper(coalesce(s.form_type, '')) in ('D','PPE') then 'PPE Check'
      when upper(coalesce(s.form_type, '')) in ('B','FIRSTAID','FIRST_AID') then 'First Aid Kit'
      when upper(coalesce(s.form_type, '')) in ('C','INSPECTION','SITE_INSPECTION','INSPECT') then 'Site Inspection'
      when upper(coalesce(s.form_type, '')) in ('A','DRILL','EMERGENCY_DRILL') then 'Emergency Drill'
      when upper(coalesce(s.form_type, '')) in ('F','INCIDENT','INCIDENT_NEAR_MISS','NEAR_MISS') then 'Incident / Near Miss'
      else coalesce(s.form_type, 'Other')
    end as form_label
  from public.submissions s
)
select
  s.id as submission_id,
  s.form_type,
  s.date as submission_date,
  s.status,
  s.site_id,
  coalesce(st.site_code, s.site, '') as site_code,
  st.site_name,
  trim(
    both ' ' from concat(
      coalesce(st.site_code, ''),
      case when st.site_code is not null and st.site_name is not null then ' — ' else '' end,
      coalesce(st.site_name, s.site, '')
    )
  ) as site_label,
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
  s.updated_at,
  s.form_key,
  s.form_label,
  s.payload,
  coalesce(s.payload->>'job_code', s.payload->>'job_id', '') as job_code,
  coalesce(s.payload->>'work_order_number', s.payload->>'work_order_id', '') as work_order_number,
  coalesce(s.payload->>'route_code', s.payload->>'route_id', '') as route_code,
  coalesce(s.payload->>'equipment_code', '') as equipment_code,
  coalesce(s.payload->>'worker_name', s.payload->>'affected_worker', s.payload->>'employee_name', '') as worker_name,
  coalesce(s.payload->>'incident_kind', '') as incident_kind,
  coalesce(s.payload->>'severity', '') as severity,
  case
    when lower(coalesce(s.payload->>'anonymous_report', 'false')) in ('true','t','1','yes','y') then true
    else false
  end as anonymous_report
from base s
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
  max(form_type) as form_type,
  status,
  count(*)::int as submission_count,
  count(distinct coalesce(site_id::text, site_code, site_name, 'unknown'))::int as unique_site_count,
  coalesce(sum(image_count), 0)::int as image_count,
  count(*) filter (where coalesce(review_count, 0) > 0)::int as reviewed_count,
  count(*) filter (
    where coalesce(last_review_action, '') = 'rejected'
       or coalesce(status, '') = 'rejected'
  )::int as rejected_count,
  max(last_reviewed_at) as last_reviewed_at,
  form_key,
  max(form_label) as form_label,
  count(*) filter (where form_key = 'incident')::int as incident_count,
  count(*) filter (where form_key = 'incident' and lower(coalesce(incident_kind, '')) = 'near_miss')::int as near_miss_count,
  count(*) filter (where form_key = 'incident' and lower(coalesce(severity, '')) in ('high','critical'))::int as high_severity_incident_count
from base
group by submission_date, form_key, status;

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
  max(form_type) as form_type,
  count(*)::int as submission_count,
  count(*) filter (where coalesce(review_count, 0) > 0)::int as reviewed_count,
  count(*) filter (
    where coalesce(last_review_action, '') = 'rejected'
       or coalesce(status, '') = 'rejected'
  )::int as rejected_count,
  coalesce(sum(image_count), 0)::int as image_count,
  max(submission_date) as last_submission_date,
  max(last_reviewed_at) as last_reviewed_at,
  form_key,
  max(form_label) as form_label,
  count(*) filter (where form_key = 'incident')::int as incident_count
from base
group by
  coalesce(site_id::text, site_code, site_name, 'unknown'),
  site_id,
  site_code,
  site_name,
  site_label,
  form_key;

create or replace view public.v_incident_near_miss_history as
select
  submission_id,
  form_type,
  form_key,
  form_label,
  submission_date,
  status,
  site_id,
  site_code,
  site_name,
  site_label,
  submitted_by_profile_id,
  submitted_by_name,
  supervisor_profile_id,
  supervisor_name,
  admin_profile_id,
  admin_name,
  worker_name,
  job_code,
  work_order_number,
  route_code,
  equipment_code,
  coalesce(nullif(incident_kind, ''), 'incident') as incident_kind,
  coalesce(nullif(severity, ''), 'medium') as severity,
  case
    when lower(coalesce(payload->>'medical_treatment_required', 'false')) in ('true','t','1','yes','y') then true
    else false
  end as medical_treatment_required,
  case
    when lower(coalesce(payload->>'lost_time', 'false')) in ('true','t','1','yes','y') then true
    else false
  end as lost_time,
  case
    when lower(coalesce(payload->>'property_damage', 'false')) in ('true','t','1','yes','y') then true
    else false
  end as property_damage,
  case
    when lower(coalesce(payload->>'vehicle_involved', 'false')) in ('true','t','1','yes','y') then true
    else false
  end as vehicle_involved,
  anonymous_report,
  coalesce(payload->>'event_time', payload->>'incident_time', '') as event_time,
  coalesce(payload->>'event_summary', payload->>'what_happened', payload->>'description', '') as event_summary,
  coalesce(payload->>'immediate_actions_taken', payload->>'immediate_action', '') as immediate_actions_taken,
  coalesce(payload->>'root_cause_summary', payload->>'root_cause', '') as root_cause_summary,
  coalesce(payload->>'corrective_action_required', '') as corrective_action_required,
  coalesce(payload->>'corrective_action_owner', '') as corrective_action_owner,
  coalesce(payload->>'corrective_action_status', '') as corrective_action_status,
  coalesce(payload->>'corrective_action_due_date', '') as corrective_action_due_date,
  coalesce(payload->>'witness_names', '') as witness_names,
  image_count,
  review_count,
  last_review_action,
  last_reviewed_at,
  created_at,
  updated_at,
  payload
from public.v_hse_submission_history_report
where form_key = 'incident';

create or replace view public.v_hse_reporting_monthly_trends as
with base as (
  select * from public.v_hse_submission_history_report
)
select
  date_trunc('month', submission_date::timestamp)::date as month_start,
  form_key,
  max(form_label) as form_label,
  count(*)::int as submission_count,
  count(*) filter (where form_key = 'incident')::int as incident_count,
  count(*) filter (where form_key = 'incident' and lower(coalesce(incident_kind, '')) = 'near_miss')::int as near_miss_count,
  count(*) filter (where form_key = 'incident' and lower(coalesce(severity, '')) in ('high','critical'))::int as high_severity_incident_count,
  count(*) filter (where coalesce(review_count, 0) > 0)::int as reviewed_count,
  count(*) filter (
    where coalesce(last_review_action, '') = 'rejected'
       or coalesce(status, '') = 'rejected'
  )::int as rejected_count,
  coalesce(sum(image_count), 0)::int as image_count
from base
group by date_trunc('month', submission_date::timestamp)::date, form_key;

create or replace view public.v_hse_reporting_worker_rollup as
with base as (
  select * from public.v_hse_submission_history_report
)
select
  coalesce(nullif(worker_name, ''), submitted_by_name, 'Unknown worker') as worker_label,
  max(submitted_by_name) as submitted_by_name,
  count(*)::int as submission_count,
  count(*) filter (where form_key = 'incident')::int as incident_count,
  count(*) filter (where form_key = 'incident' and lower(coalesce(incident_kind, '')) = 'near_miss')::int as near_miss_count,
  count(*) filter (where form_key = 'incident' and lower(coalesce(severity, '')) in ('high','critical'))::int as high_severity_incident_count,
  count(*) filter (where coalesce(review_count, 0) > 0)::int as reviewed_count,
  max(submission_date) as last_submission_date,
  string_agg(distinct form_label, ', ' order by form_label) as form_labels
from base
group by coalesce(nullif(worker_name, ''), submitted_by_name, 'Unknown worker');

create or replace view public.v_hse_reporting_context_rollup as
with base as (
  select * from public.v_hse_submission_history_report
), normalized as (
  select
    coalesce(site_label, site_name, site_code, 'Unknown site') as site_label,
    coalesce(nullif(job_code, ''), '—') as job_code,
    coalesce(nullif(work_order_number, ''), '—') as work_order_number,
    coalesce(nullif(route_code, ''), '—') as route_code,
    count(*)::int as submission_count,
    count(*) filter (where form_key = 'incident')::int as incident_count,
    count(*) filter (where form_key = 'incident' and lower(coalesce(incident_kind, '')) = 'near_miss')::int as near_miss_count,
    count(*) filter (where coalesce(review_count, 0) > 0)::int as reviewed_count,
    max(submission_date) as last_submission_date
  from base
  group by
    coalesce(site_label, site_name, site_code, 'Unknown site'),
    coalesce(nullif(job_code, ''), '—'),
    coalesce(nullif(work_order_number, ''), '—'),
    coalesce(nullif(route_code, ''), '—')
)
select * from normalized;
