-- 097_jobs_quote_delivery_threshold_rules_and_accountant_exports.sql
-- Deepens the Jobs commercial/accounting workflow with:
-- - richer branded quote package output details
-- - automatic threshold evaluation metadata
-- - resolved closeout evidence links to real source records
-- - more explicit accountant-handoff metadata
-- - extended profitability scorecards with variance context

alter table if exists public.work_order_release_threshold_evaluations
  add column if not exists evaluation_trigger text not null default 'manual',
  add column if not exists evaluated_at timestamptz not null default now();

alter table if exists public.work_order_release_threshold_evaluations
  drop constraint if exists work_order_release_threshold_evaluations_trigger_check;
alter table if exists public.work_order_release_threshold_evaluations
  add constraint work_order_release_threshold_evaluations_trigger_check
  check (evaluation_trigger in ('save','manual','release','system'));

create or replace view public.v_quote_package_output_directory as
select
  -- legacy columns first
  qp.id,
  qp.estimate_id,
  e.estimate_number,
  e.quote_title,
  qp.business_tax_setting_id,
  bts.profile_name as tax_profile_name,
  bts.legal_entity_type,
  qp.package_status,
  qp.rendered_title,
  qp.client_email,
  qp.brand_name,
  qp.brand_tagline,
  qp.email_subject,
  qp.last_rendered_at,
  qp.sent_at,
  qp.accepted_at,
  qp.last_sent_via,
  qp.accepted_signature_name,
  qp.public_token,
  coalesce(count(qoe.id), 0)::int as output_event_count,
  max(qoe.created_at) as last_output_event_at,
  qp.created_at,
  qp.updated_at,
  -- appended columns
  qp.printable_html,
  qp.email_body,
  qp.render_payload,
  bts.legal_entity_name,
  bts.federal_return_type,
  bts.provincial_return_type,
  bts.usa_tax_classification,
  coalesce((qp.render_payload->>'preview_text')::text, '') as preview_text,
  coalesce(e.total_amount, 0)::numeric(12,2) as estimate_total_amount,
  coalesce(e.margin_estimate_percent, 0)::numeric(7,2) as estimate_margin_percent
from public.estimate_quote_packages qp
left join public.estimates e on e.id = qp.estimate_id
left join public.business_tax_settings bts on bts.id = qp.business_tax_setting_id
left join public.quote_package_output_events qoe on qoe.quote_package_id = qp.id
group by qp.id, e.estimate_number, e.quote_title, e.total_amount, e.margin_estimate_percent, bts.profile_name, bts.legal_entity_type, bts.legal_entity_name, bts.federal_return_type, bts.provincial_return_type, bts.usa_tax_classification;

create or replace view public.v_work_order_threshold_evaluation_directory as
select
  -- legacy columns first
  te.id,
  te.work_order_release_review_id,
  te.threshold_id,
  cat.threshold_name,
  te.work_order_id,
  wo.work_order_number,
  te.estimate_id,
  e.estimate_number,
  te.evaluated_status,
  te.evaluation_message,
  te.discount_percent,
  te.margin_percent,
  te.total_amount,
  te.required_signoff_role,
  te.created_by_profile_id,
  coalesce(p.full_name, p.email, '') as created_by_name,
  te.created_at,
  -- appended columns
  te.evaluation_trigger,
  te.evaluated_at,
  cat.applies_to_scope,
  cat.applies_to_value,
  cat.hard_block
from public.work_order_release_threshold_evaluations te
left join public.commercial_approval_thresholds cat on cat.id = te.threshold_id
left join public.work_orders wo on wo.id = te.work_order_id
left join public.estimates e on e.id = te.estimate_id
left join public.profiles p on p.id = te.created_by_profile_id;

create or replace view public.v_job_closeout_evidence_directory as
select
  -- legacy columns first
  ca.id,
  ca.closeout_item_id,
  ci.completion_review_id,
  cr.job_id,
  j.job_code,
  j.job_name,
  cr.work_order_id,
  wo.work_order_number,
  ca.asset_kind,
  ca.label,
  ca.asset_url,
  ca.source_table,
  ca.source_id,
  ca.notes,
  ca.created_by_profile_id,
  coalesce(p.full_name, p.email, '') as created_by_name,
  ca.created_at,
  ca.updated_at,
  -- appended columns
  coalesce(jca.preview_url, eea.preview_url, ca.asset_url) as resolved_asset_url,
  coalesce(jca.file_name, si.file_name, eea.file_name, ca.label) as resolved_file_name,
  coalesce(si.caption, eea.caption, ca.notes) as resolved_caption,
  coalesce(jca.storage_bucket, eea.storage_bucket, '') as resolved_storage_bucket,
  coalesce(jca.storage_path, si.file_path, eea.storage_path, '') as resolved_storage_path
from public.job_completion_closeout_assets ca
left join public.job_completion_closeout_items ci on ci.id = ca.closeout_item_id
left join public.job_completion_reviews cr on cr.id = ci.completion_review_id
left join public.jobs j on j.id = cr.job_id
left join public.work_orders wo on wo.id = cr.work_order_id
left join public.profiles p on p.id = ca.created_by_profile_id
left join public.job_comment_attachments jca on ca.source_table = 'job_comment_attachments' and ca.source_id = jca.id::text
left join public.submission_images si on ca.source_table = 'submission_images' and ca.source_id = si.id::text
left join public.equipment_evidence_assets eea on ca.source_table = 'equipment_evidence_assets' and ca.source_id = eea.id::text;

create or replace view public.v_accountant_handoff_export_directory as
select
  -- legacy columns first
  ah.id,
  ah.export_kind,
  ah.entity_scope,
  ah.entity_id,
  ah.business_tax_setting_id,
  bts.profile_name as tax_profile_name,
  bts.legal_entity_type,
  bts.federal_return_type,
  bts.provincial_return_type,
  bts.usa_tax_classification,
  ah.export_status,
  ah.export_title,
  ah.generated_by_profile_id,
  coalesce(p.full_name, p.email, '') as generated_by_name,
  ah.generated_at,
  ah.delivered_at,
  ah.created_at,
  ah.updated_at,
  -- appended columns
  bts.legal_entity_name,
  bts.business_number,
  bts.corporation_number,
  bts.ein,
  left(coalesce(ah.export_markdown, ''), 400) as export_preview,
  coalesce((ah.export_payload->>'invoice_candidate_count')::int, 0) as invoice_candidate_count,
  coalesce((ah.export_payload->>'journal_candidate_count')::int, 0) as journal_candidate_count,
  coalesce((ah.export_payload->>'closeout_item_count')::int, 0) as closeout_item_count,
  coalesce((ah.export_payload->>'closeout_asset_count')::int, 0) as closeout_asset_count
from public.accountant_handoff_exports ah
left join public.business_tax_settings bts on bts.id = ah.business_tax_setting_id
left join public.profiles p on p.id = ah.generated_by_profile_id;

create or replace view public.v_job_profitability_scorecard_directory as
with base as (
  select
    j.id as job_id,
    j.job_code,
    j.job_name,
    coalesce(j.job_family, 'unclassified') as job_family,
    coalesce(j.assigned_supervisor_profile_id::text, j.site_supervisor_profile_id::text, 'unassigned') as supervisor_key,
    coalesce(sp.full_name, sup.full_name, 'Unassigned') as supervisor_name,
    coalesce(j.site_id::text, 'no-site') as site_key,
    coalesce(st.site_code, st.site_name, 'No site') as site_name,
    coalesce(wo.route_id::text, 'no-route') as route_key,
    coalesce(rt.route_code, rt.name, 'No route') as route_name,
    coalesce(j.quoted_charge_total, 0)::numeric(12,2) as quoted_total,
    coalesce(j.estimated_cost_total, 0)::numeric(12,2) as estimated_cost_total,
    coalesce(cr.revenue_total, j.actual_charge_rollup_total, j.actual_charge_total, j.quoted_charge_total, 0)::numeric(12,2) as revenue_total,
    coalesce(cr.cost_total, j.actual_cost_rollup_total, j.actual_cost_total, j.estimated_cost_total, 0)::numeric(12,2) as cost_total,
    coalesce(cr.profit_total, (coalesce(cr.revenue_total, j.actual_charge_rollup_total, j.actual_charge_total, j.quoted_charge_total, 0) - coalesce(cr.cost_total, j.actual_cost_rollup_total, j.actual_cost_total, j.estimated_cost_total, 0)))::numeric(12,2) as profit_total
  from public.v_jobs_directory j
  left join public.job_completion_reviews cr on cr.job_id = j.id
  left join public.work_orders wo on wo.legacy_job_id = j.id
  left join public.routes rt on rt.id = wo.route_id
  left join public.sites st on st.id = j.site_id
  left join public.profiles sp on sp.id = j.assigned_supervisor_profile_id
  left join public.profiles sup on sup.id = j.site_supervisor_profile_id
), grouped as (
  select 'site'::text as group_type, site_key as group_key, site_name as group_label, count(*)::int as job_count, sum(quoted_total)::numeric(12,2) as quoted_total, sum(estimated_cost_total)::numeric(12,2) as estimated_cost_total, sum(revenue_total)::numeric(12,2) as revenue_total, sum(cost_total)::numeric(12,2) as cost_total, sum(profit_total)::numeric(12,2) as profit_total from base group by site_key, site_name
  union all
  select 'supervisor'::text, supervisor_key, supervisor_name, count(*)::int, sum(quoted_total)::numeric(12,2), sum(estimated_cost_total)::numeric(12,2), sum(revenue_total)::numeric(12,2), sum(cost_total)::numeric(12,2), sum(profit_total)::numeric(12,2) from base group by supervisor_key, supervisor_name
  union all
  select 'route'::text, route_key, route_name, count(*)::int, sum(quoted_total)::numeric(12,2), sum(estimated_cost_total)::numeric(12,2), sum(revenue_total)::numeric(12,2), sum(cost_total)::numeric(12,2), sum(profit_total)::numeric(12,2) from base group by route_key, route_name
  union all
  select 'job_family'::text, job_family, job_family, count(*)::int, sum(quoted_total)::numeric(12,2), sum(estimated_cost_total)::numeric(12,2), sum(revenue_total)::numeric(12,2), sum(cost_total)::numeric(12,2), sum(profit_total)::numeric(12,2) from base group by job_family
)
select
  -- legacy columns first
  group_type,
  group_key,
  group_label,
  job_count,
  revenue_total,
  cost_total,
  profit_total,
  case when revenue_total > 0 then round((profit_total / revenue_total) * 100.0, 2)::numeric(7,2) else 0::numeric(7,2) end as margin_percent,
  -- appended columns
  quoted_total,
  estimated_cost_total,
  (revenue_total - quoted_total)::numeric(12,2) as revenue_variance_total,
  (cost_total - estimated_cost_total)::numeric(12,2) as cost_variance_total
from grouped;
