// Detailed Edge Function: admin-directory
// Purpose:
// - self scope: current employee profile only
// - crew scope: direct reports based on profile hierarchy and assignment reporting lines
// - all/users/sites/assignments/notifications scopes for admin/senior directory
// - operation/accounting backbone lists for admin managers

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function normalizeRole(role?: string | null) {
  const clean = String(role || '').trim().toLowerCase();
  if (clean === 'worker' || clean === 'staff') return 'employee';
  return clean || 'employee';
}

function roleRank(role: string) {
  return { employee:10, worker:10, staff:10, onsite_admin:18, site_leader:20, supervisor:30, hse:40, job_admin:45, admin:50 }[normalizeRole(role)] ?? 0;
}

function effectiveRole(profile: any, user: any) {
  const direct = normalizeRole(profile?.role);
  const tier = normalizeRole(profile?.staff_tier || user?.user_metadata?.staff_tier);
  const meta = normalizeRole(user?.user_metadata?.role || user?.app_metadata?.role);
  if (direct === 'admin' || tier === 'admin' || meta === 'admin') return 'admin';
  if (direct === 'supervisor' || tier === 'supervisor' || meta === 'supervisor') return 'supervisor';
  return direct || tier || meta || 'employee';
}

async function safeList(supabase: any, table: string, columns = '*', orderColumn?: string, limit = 200, ascending = true) {
  try {
    let q = supabase.from(table).select(columns).limit(limit);
    if (orderColumn) q = q.order(orderColumn, { ascending });
    const { data, error } = await q;
    if (error) return [];
    return data || [];
  } catch {
    return [];
  }
}

async function safeListWhere(supabase: any, table: string, columns = '*', filters: Array<[string, any]> = [], orderColumn?: string, limit = 200, ascending = true) {
  try {
    let q = supabase.from(table).select(columns).limit(limit);
    for (const [column, value] of filters) q = q.eq(column, value);
    if (orderColumn) q = q.order(orderColumn, { ascending });
    const { data, error } = await q;
    if (error) return [];
    return data || [];
  } catch {
    return [];
  }
}

function clampInt(value: unknown, fallback: number, min = 1, max = 500) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(parsed)));
}

function sanitizeIlikeTerm(value: unknown) {
  return String(value || '')
    .trim()
    .replace(/[%,()]/g, ' ')
    .replace(/\s+/g, ' ')
    .slice(0, 80);
}

function allowSort(value: unknown, fallback: string, allowed: string[]) {
  const clean = String(value || '').trim().toLowerCase();
  return allowed.includes(clean) ? clean : fallback;
}

function normalizeDirection(value: unknown) {
  return String(value || '').trim().toLowerCase() === 'desc' ? 'desc' : 'asc';
}

function compareNullable(a: any, b: any, direction = 'asc') {
  const left = a == null ? '' : String(a).toLowerCase();
  const right = b == null ? '' : String(b).toLowerCase();
  const result = left.localeCompare(right, undefined, { numeric: true, sensitivity: 'base' });
  return direction === 'desc' ? -result : result;
}

async function safeListPaged(supabase: any, table: string, options: Record<string, any> = {}) {
  const columns = options.columns || '*';
  const orderColumn = options.orderColumn;
  const ascending = options.ascending !== false;
  const page = clampInt(options.page, 1, 1, 10000);
  const pageSize = clampInt(options.pageSize, 25, 1, 200);
  const offset = (page - 1) * pageSize;
  const searchTerm = sanitizeIlikeTerm(options.search);
  const searchColumns = Array.isArray(options.searchColumns) ? options.searchColumns.filter(Boolean) : [];
  try {
    let q = supabase.from(table).select(columns, { count: 'exact' });
    if (searchTerm && searchColumns.length) {
      const pattern = `*${searchTerm}*`;
      q = q.or(searchColumns.map((column: string) => `${column}.ilike.${pattern}`).join(','));
    }
    if (orderColumn) q = q.order(orderColumn, { ascending });
    const { data, error, count } = await q.range(offset, offset + pageSize - 1);
    if (error) {
      return { rows: [], meta: { page, page_size: pageSize, total: 0, total_pages: 1, loaded: 0, error: error.message || 'Query failed.' } };
    }
    const total = Number.isFinite(Number(count)) ? Number(count) : (Array.isArray(data) ? data.length : 0);
    return {
      rows: data || [],
      meta: {
        page,
        page_size: pageSize,
        total,
        total_pages: Math.max(1, Math.ceil(total / pageSize)),
        loaded: Array.isArray(data) ? data.length : 0,
        search: searchTerm,
        order_column: orderColumn || null,
        ascending
      }
    };
  } catch (err) {
    return { rows: [], meta: { page, page_size: pageSize, total: 0, total_pages: 1, loaded: 0, error: String((err as any)?.message || err || 'Query failed.') } };
  }
}

function mergeRowsById(baseRows: any[], extraRows: any[]) {
  const map = new Map<string, any>();
  for (const row of Array.isArray(baseRows) ? baseRows : []) {
    if (!row?.id) continue;
    map.set(String(row.id), { ...row });
  }
  for (const row of Array.isArray(extraRows) ? extraRows : []) {
    if (!row?.id) continue;
    const key = String(row.id);
    map.set(key, { ...(map.get(key) || {}), ...row });
  }
  return Array.from(map.values());
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabase = createClient((Deno.env.get('SB_URL') || Deno.env.get('SUPABASE_URL'))!, (Deno.env.get('SB_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'))!);
  const token = (req.headers.get('Authorization') ?? '').replace('Bearer ', '');
  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData.user) return Response.json({ ok:false, error:'Unauthorized' }, { status:401, headers:corsHeaders });

  const actorId = userData.user.id;
  const { data: actorProfile } = await supabase.from('profiles').select('*').eq('id', actorId).single();
  const actorRole = effectiveRole(actorProfile, userData.user);
  if (!actorProfile?.is_active) return Response.json({ ok:false, error:'Inactive profile' }, { status:403, headers:corsHeaders });

  const body = await req.json().catch(() => ({}));
  const scope = body.scope || body.mode || 'all';
  const search = String(body.search || '').trim().toLowerCase();
  const peopleSearch = String(body.people_search ?? body.search ?? '').trim().toLowerCase();
  const roleFilter = String(body.role_filter || body.profile_role || '').trim().toLowerCase();
  const peopleSort = allowSort(body.people_sort, 'full_name', ['full_name','email','role','employment_status','last_login_at','created_at','updated_at']);
  const peopleSortDir = normalizeDirection(body.people_sort_dir);
  const jobsSort = allowSort(body.jobs_sort, 'job_code', ['job_code','job_name','status','priority','start_date','end_date','updated_at','created_at']);
  const jobsSortDir = normalizeDirection(body.jobs_sort_dir);
  const limit = clampInt(body.limit, 200, 1, 500);
  const peoplePage = clampInt(body.people_page ?? body.page, 1, 1, 10000);
  const peoplePageSize = clampInt(body.people_page_size ?? body.page_size, Math.min(limit, 50), 1, 200);
  const jobsPage = clampInt(body.jobs_page, 1, 1, 10000);
  const jobsPageSize = clampInt(body.jobs_page_size, Math.min(limit, 50), 1, 200);
  const jobsSearch = String(body.jobs_search || '').trim().toLowerCase();

  // Reporting can be a heavy screen. Return it through a narrow fast path so
  // Admin boot does not need to load people/site/assignment directories first.
  if (scope === 'reporting' && roleRank(actorRole) >= roleRank('supervisor')) {
    const reporting: Record<string, unknown> = { ok: true, reporting_scope: 'fast_path', actor_role: actorRole, actor_profile_id: actorId };
    const [
      hseSubmissionHistoryReport, hseFormDailyRollup, hseFormSiteRollup, workflowHistoryReport,
      incidentNearMissHistory, monthlyTrends, workerRollup, contextRollup, reportPresetDirectory,
      correctiveDirectory, correctiveSummary, trainingCourses, trainingRecords, trainingSummary,
      sdsAcknowledgements, supervisorQueue, siteScorecards, supervisorScorecards, overdueAlerts,
      reportSubscriptions, reportDeliveryCandidates, equipmentJsaLinks, deliveryRunHistory, schedulerStatus
    ] = await Promise.all([
      safeList(supabase, 'v_hse_submission_history_report', '*', 'submission_date', limit, false),
      safeList(supabase, 'v_hse_form_daily_rollup', '*', 'report_date', limit, false),
      safeList(supabase, 'v_hse_form_site_rollup', '*', 'last_submission_date', limit, false),
      safeList(supabase, 'v_workflow_history_report', '*', 'occurred_at', limit, false),
      safeList(supabase, 'v_incident_near_miss_history', '*', 'submission_date', limit, false),
      safeList(supabase, 'v_hse_reporting_monthly_trends', '*', 'month_start', limit, false),
      safeList(supabase, 'v_hse_reporting_worker_rollup', '*', 'last_submission_date', limit, false),
      safeList(supabase, 'v_hse_reporting_context_rollup', '*', 'last_submission_date', limit, false),
      safeList(supabase, 'v_report_preset_directory', '*', 'updated_at', limit, false),
      safeList(supabase, 'v_corrective_action_task_directory', '*', 'due_date', limit, true),
      safeList(supabase, 'v_corrective_action_task_summary'),
      safeList(supabase, 'v_training_course_directory', '*', 'course_name', limit, true),
      safeList(supabase, 'v_training_record_directory', '*', 'expires_at', limit, true),
      safeList(supabase, 'v_training_expiry_summary'),
      safeList(supabase, 'v_sds_acknowledgement_directory', '*', 'expires_at', limit, true),
      safeList(supabase, 'v_supervisor_safety_queue', '*', 'sort_at', limit, false),
      safeList(supabase, 'v_site_safety_scorecards', '*', 'last_submission_date', limit, false),
      safeList(supabase, 'v_supervisor_scorecards', '*', 'last_activity_at', limit, false),
      safeList(supabase, 'v_overdue_action_alerts', '*', 'sort_at', limit, false),
      safeList(supabase, 'v_report_subscription_directory', '*', 'next_send_at', limit, false),
      safeList(supabase, 'v_report_delivery_candidates', '*', 'next_send_at', limit, false),
      safeList(supabase, 'v_equipment_jsa_hazard_link_directory', '*', 'review_due_date', limit, false),
      safeList(supabase, 'v_report_delivery_run_history', '*', 'started_at', limit, false),
      safeList(supabase, 'v_report_delivery_scheduler_status', '*', 'setting_code', 5, true),
    ]);

    Object.assign(reporting, {
      hse_submission_history_report: hseSubmissionHistoryReport,
      hse_form_daily_rollup: hseFormDailyRollup,
      hse_form_site_rollup: hseFormSiteRollup,
      workflow_history_report: workflowHistoryReport,
      incident_near_miss_history: incidentNearMissHistory,
      hse_reporting_monthly_trends: monthlyTrends,
      hse_reporting_worker_rollup: workerRollup,
      hse_reporting_context_rollup: contextRollup,
      report_preset_directory: reportPresetDirectory,
      corrective_action_task_directory: correctiveDirectory,
      corrective_action_task_summary: correctiveSummary,
      training_course_directory: trainingCourses,
      training_record_directory: trainingRecords,
      training_expiry_summary: trainingSummary,
      sds_acknowledgement_directory: sdsAcknowledgements,
      supervisor_safety_queue: supervisorQueue,
      site_safety_scorecards: siteScorecards,
      supervisor_scorecards: supervisorScorecards,
      overdue_action_alerts: overdueAlerts,
      report_subscription_directory: reportSubscriptions,
      report_delivery_candidates: reportDeliveryCandidates,
      equipment_jsa_hazard_link_directory: equipmentJsaLinks,
      report_delivery_run_history: deliveryRunHistory,
      report_delivery_scheduler_status: schedulerStatus,
    });
    return Response.json(reporting, { headers: corsHeaders });
  }


  // Narrow Admin panel fast paths. These avoid loading the full people/site/accounting directory
  // when the UI only needs one panel refresh on slower mobile connections.
  if (scope === 'operations' && roleRank(actorRole) >= roleRank('supervisor')) {
    const operations: Record<string, unknown> = { ok: true, operations_scope: 'fast_path', actor_role: actorRole, actor_profile_id: actorId, pagination_meta: { scope, limit, actor_role: actorRole, supports_server_paging: true, supports_sorting: true } };
    const jobsPaged = await safeListPaged(supabase, 'jobs', {
      orderColumn: jobsSort,
      ascending: jobsSortDir !== 'desc',
      page: jobsPage,
      pageSize: jobsPageSize,
      search: jobsSearch,
      searchColumns: ['job_code', 'job_name', 'status', 'priority']
    });
    operations.jobs = jobsPaged.rows;
    operations.pagination_meta = { ...(operations.pagination_meta as Record<string, unknown>), jobs: { ...jobsPaged.meta, sort: jobsSort, direction: jobsSortDir } };
    operations.service_areas = await safeList(supabase, 'service_areas', '*', 'name', limit);
    operations.routes = await safeList(supabase, 'routes', '*', 'name', limit);
    operations.clients = await safeList(supabase, 'clients', '*', 'legal_name', limit);
    operations.client_sites = await safeList(supabase, 'client_sites', '*', 'site_name', limit);
    operations.operations_dashboard_summary = await safeList(supabase, 'v_operations_dashboard_summary');
    return Response.json(operations, { headers: corsHeaders });
  }

  if (scope === 'command_center' && roleRank(actorRole) >= roleRank('supervisor')) {
    const commandCenter: Record<string, unknown> = { ok: true, command_center_scope: 'fast_path', actor_role: actorRole, actor_profile_id: actorId, pagination_meta: { scope, limit, actor_role: actorRole } };
    commandCenter.admin_home_command_center = await safeList(supabase, 'v_admin_home_command_center');
    commandCenter.admin_task_inbox = await safeList(supabase, 'v_admin_task_inbox', '*', 'priority_rank', 80, true);
    commandCenter.app_schema_version_status = await safeList(supabase, 'v_app_schema_version_status', '*', 'schema_version', 20, false);
    commandCenter.schema_drift_status = await safeList(supabase, 'v_schema_drift_status');
    commandCenter.admin_fast_path_scope_registry = await safeList(supabase, 'v_admin_fast_path_scope_registry', '*', 'scope_key', 40, true);
    commandCenter.admin_action_confirmation_rules = await safeList(supabase, 'v_admin_action_confirmation_rules', '*', 'action_area', 80, true);
    commandCenter.admin_action_permission_registry = await safeList(supabase, 'v_admin_action_permission_registry', '*', 'sort_order', 120, true);
    commandCenter.admin_panel_retry_policy = await safeList(supabase, 'v_admin_panel_retry_policy', '*', 'sort_order', 80, true);
    commandCenter.admin_schema_preflight_checks = await safeList(supabase, 'v_admin_schema_preflight_checks', '*', 'sort_order', 120, true);
    commandCenter.admin_deployment_checklist = await safeList(supabase, 'v_admin_deployment_checklist', '*', 'sort_order', 80, true);
    commandCenter.admin_function_readiness_checks = await safeList(supabase, 'v_admin_function_readiness_checks', '*', 'sort_order', 80, true);
    commandCenter.app_deployment_bundle_checks = await safeList(supabase, 'v_app_deployment_bundle_checks', '*', 'sort_order', 80, true);
    commandCenter.app_public_seo_checks = await safeList(supabase, 'v_app_public_seo_checks', '*', 'sort_order', 80, true);
    commandCenter.app_runtime_fallback_checks = await safeList(supabase, 'v_app_runtime_fallback_checks', '*', 'sort_order', 80, true);
    commandCenter.app_roadmap_action_steps = await safeList(supabase, 'v_app_roadmap_action_steps', '*', 'sort_order', 140, true);
    commandCenter.app_depth_review_queue = await safeList(supabase, 'v_app_depth_review_queue', '*', 'sort_order', 80, true);
    commandCenter.app_data_migration_candidates = await safeList(supabase, 'v_app_data_migration_candidates', '*', 'sort_order', 80, true);
    commandCenter.app_schema_documentation_sync_checks = await safeList(supabase, 'v_app_schema_documentation_sync_checks', '*', 'sort_order', 80, true);
    commandCenter.app_public_route_seo_registry = await safeList(supabase, 'v_app_public_route_seo_registry', '*', 'sort_order', 80, true);
    commandCenter.app_internal_link_suggestion_queue = await safeList(supabase, 'v_app_internal_link_suggestion_queue', '*', 'sort_order', 80, true);
    commandCenter.app_css_component_token_inventory = await safeList(supabase, 'v_app_css_component_token_inventory', '*', 'sort_order', 80, true);
    commandCenter.app_mobile_field_action_queue = await safeList(supabase, 'v_app_mobile_field_action_queue', '*', 'sort_order', 80, true);
    commandCenter.app_release_manifest_checks = await safeList(supabase, 'v_app_release_manifest_checks', '*', 'sort_order', 80, true);
    commandCenter.app_payment_application_action_registry = await safeList(supabase, 'v_app_payment_application_action_registry', '*', 'sort_order', 80, true);
    commandCenter.app_accounting_close_control_queue = await safeList(supabase, 'v_app_accounting_close_control_queue', '*', 'sort_order', 80, true);
    commandCenter.app_equipment_accountability_action_queue = await safeList(supabase, 'v_app_equipment_accountability_action_queue', '*', 'sort_order', 80, true);
    commandCenter.app_public_seo_publication_queue = await safeList(supabase, 'v_app_public_seo_publication_queue', '*', 'sort_order', 80, true);
    commandCenter.app_fallback_observability_matrix = await safeList(supabase, 'v_app_fallback_observability_matrix', '*', 'sort_order', 80, true);
    commandCenter.app_schema_migration_compatibility_checks = await safeList(supabase, 'v_app_schema_migration_compatibility_checks', '*', 'sort_order', 80, true);
    commandCenter.app_accounting_evidence_package_queue = await safeList(supabase, 'v_app_accounting_evidence_package_queue', '*', 'sort_order', 80, true);
    commandCenter.app_equipment_return_to_service_rules = await safeList(supabase, 'v_app_equipment_return_to_service_rules', '*', 'sort_order', 80, true);
    commandCenter.app_public_asset_smoke_checks = await safeList(supabase, 'v_app_public_asset_smoke_checks', '*', 'sort_order', 80, true);
    commandCenter.app_error_recovery_playbook = await safeList(supabase, 'v_app_error_recovery_playbook', '*', 'sort_order', 80, true);
    commandCenter.app_payment_execution_queue = await safeList(supabase, 'v_app_payment_execution_queue', '*', 'sort_order', 80, true);
    commandCenter.app_bank_reconciliation_execution_queue = await safeList(supabase, 'v_app_bank_reconciliation_execution_queue', '*', 'sort_order', 80, true);
    commandCenter.app_equipment_scan_template_registry = await safeList(supabase, 'v_app_equipment_scan_template_registry', '*', 'sort_order', 80, true);
    commandCenter.app_local_seo_execution_queue = await safeList(supabase, 'v_app_local_seo_execution_queue', '*', 'sort_order', 80, true);
    commandCenter.app_fallback_drill_queue = await safeList(supabase, 'v_app_fallback_drill_queue', '*', 'sort_order', 80, true);
    commandCenter.app_payment_application_ui_queue = await safeList(supabase, 'v_app_payment_application_ui_queue', '*', 'sort_order', 80, true);
    commandCenter.app_reconciliation_import_validation_queue = await safeList(supabase, 'v_app_reconciliation_import_validation_queue', '*', 'sort_order', 80, true);
    commandCenter.app_equipment_service_closeout_queue = await safeList(supabase, 'v_app_equipment_service_closeout_queue', '*', 'sort_order', 80, true);
    commandCenter.app_seo_asset_publication_queue = await safeList(supabase, 'v_app_seo_asset_publication_queue', '*', 'sort_order', 80, true);
    commandCenter.app_runtime_recovery_telemetry_queue = await safeList(supabase, 'v_app_runtime_recovery_telemetry_queue', '*', 'sort_order', 80, true);
    commandCenter.app_payment_posting_proof_queue = await safeList(supabase, 'v_app_payment_posting_proof_queue', '*', 'sort_order', 80, true);
    commandCenter.app_reconciliation_match_workbench_queue = await safeList(supabase, 'v_app_reconciliation_match_workbench_queue', '*', 'sort_order', 80, true);
    commandCenter.app_equipment_scan_verification_queue = await safeList(supabase, 'v_app_equipment_scan_verification_queue', '*', 'sort_order', 80, true);
    commandCenter.app_local_seo_asset_smoke_queue = await safeList(supabase, 'v_app_local_seo_asset_smoke_queue', '*', 'sort_order', 80, true);
    commandCenter.app_runtime_fallback_drill_history_queue = await safeList(supabase, 'v_app_runtime_fallback_drill_history_queue', '*', 'sort_order', 80, true);
    commandCenter.app_payment_write_path_queue = await safeList(supabase, 'v_app_payment_write_path_queue', '*', 'sort_order', 80, true);
    commandCenter.app_reconciliation_scoring_rule_queue = await safeList(supabase, 'v_app_reconciliation_scoring_rule_queue', '*', 'sort_order', 80, true);
    commandCenter.app_equipment_accessory_template_queue = await safeList(supabase, 'v_app_equipment_accessory_template_queue', '*', 'sort_order', 80, true);
    commandCenter.app_local_seo_generation_queue = await safeList(supabase, 'v_app_local_seo_generation_queue', '*', 'sort_order', 80, true);
    commandCenter.app_mobile_offline_conflict_resolution_queue = await safeList(supabase, 'v_app_mobile_offline_conflict_resolution_queue', '*', 'sort_order', 80, true);
    commandCenter.app_payment_adjustment_workflow_queue = await safeList(supabase, 'v_app_payment_adjustment_workflow_queue', '*', 'sort_order', 80, true);
    commandCenter.app_reconciliation_exception_resolution_queue = await safeList(supabase, 'v_app_reconciliation_exception_resolution_queue', '*', 'sort_order', 80, true);
    commandCenter.app_equipment_scan_rollout_queue = await safeList(supabase, 'v_app_equipment_scan_rollout_queue', '*', 'sort_order', 80, true);
    commandCenter.app_local_seo_content_depth_queue = await safeList(supabase, 'v_app_local_seo_content_depth_queue', '*', 'sort_order', 80, true);
    commandCenter.app_runtime_error_message_catalog = await safeList(supabase, 'v_app_runtime_error_message_catalog', '*', 'sort_order', 80, true);
    commandCenter.app_release_validation_queue = await safeList(supabase, 'v_app_release_validation_queue', '*', 'sort_order', 80, true);
    commandCenter.app_payment_reconciliation_execution_queue = await safeList(supabase, 'v_app_payment_reconciliation_execution_queue', '*', 'sort_order', 80, true);
    commandCenter.app_equipment_mobile_scan_validation_queue = await safeList(supabase, 'v_app_equipment_mobile_scan_validation_queue', '*', 'sort_order', 80, true);
    commandCenter.app_local_seo_release_validation_queue = await safeList(supabase, 'v_app_local_seo_release_validation_queue', '*', 'sort_order', 80, true);
    commandCenter.app_runtime_fallback_message_queue = await safeList(supabase, 'v_app_runtime_fallback_message_queue', '*', 'sort_order', 80, true);
    commandCenter.app_json_db_migration_execution_queue = await safeList(supabase, 'v_app_json_db_migration_execution_queue', '*', 'sort_order', 80, true);
    commandCenter.mobile_today_action_registry = await safeList(supabase, 'v_mobile_today_action_registry', '*', 'priority_rank', 80, true);
    commandCenter.mobile_pwa_install_quality_gates = await safeList(supabase, 'v_mobile_pwa_install_quality_gates', '*', 'sort_order', 40, true);
    commandCenter.mobile_form_stepper_registry = await safeList(supabase, 'v_mobile_form_stepper_registry', '*', 'sort_order', 80, true);
    commandCenter.mobile_form_quality_gates = await safeList(supabase, 'v_mobile_form_quality_gates', '*', 'sort_order', 80, true);
    return Response.json(commandCenter, { headers: corsHeaders });
  }

  if (scope === 'health' && roleRank(actorRole) >= roleRank('supervisor')) {
    const health: Record<string, unknown> = { ok: true, health_scope: 'fast_path', actor_role: actorRole, actor_profile_id: actorId, pagination_meta: { scope, limit, actor_role: actorRole } };
    health.admin_error_health_center = await safeList(supabase, 'v_admin_error_health_center', '*', 'severity_rank', 100, true);
    health.admin_task_inbox = await safeList(supabase, 'v_admin_task_inbox', '*', 'priority_rank', 120, true);
    health.app_schema_version_status = await safeList(supabase, 'v_app_schema_version_status', '*', 'schema_version', 122, false);
    health.schema_drift_status = await safeList(supabase, 'v_schema_drift_status');
    health.production_readiness_checklist = await safeList(supabase, 'v_production_readiness_checklist', '*', 'sort_order', 80, true);
    health.role_permission_matrix = await safeList(supabase, 'v_role_permission_matrix', '*', 'sort_order', 120, true);
    health.admin_health_resolution_queue = await safeList(supabase, 'v_admin_health_resolution_queue', '*', 'updated_at', 80, false);
    health.admin_deployment_gate_status = await safeList(supabase, 'v_admin_deployment_gate_status', '*', 'sort_order', 80, true);
    health.public_seo_smoke_check = await safeList(supabase, 'v_public_seo_smoke_check', '*', 'page_path', 80, true);
    health.admin_audit_event_directory = await safeList(supabase, 'v_admin_audit_event_directory', '*', 'occurred_at', 80, false);
    health.admin_panel_load_diagnostics = await safeList(supabase, 'v_admin_panel_load_diagnostics', '*', 'captured_at', 80, false);
    health.admin_fast_path_scope_registry = await safeList(supabase, 'v_admin_fast_path_scope_registry', '*', 'scope_key', 40, true);
    health.admin_action_confirmation_rules = await safeList(supabase, 'v_admin_action_confirmation_rules', '*', 'action_area', 80, true);
    health.admin_action_permission_registry = await safeList(supabase, 'v_admin_action_permission_registry', '*', 'sort_order', 120, true);
    health.admin_panel_retry_policy = await safeList(supabase, 'v_admin_panel_retry_policy', '*', 'sort_order', 80, true);
    health.admin_schema_preflight_checks = await safeList(supabase, 'v_admin_schema_preflight_checks', '*', 'sort_order', 120, true);
    health.admin_deployment_checklist = await safeList(supabase, 'v_admin_deployment_checklist', '*', 'sort_order', 80, true);
    health.admin_function_readiness_checks = await safeList(supabase, 'v_admin_function_readiness_checks', '*', 'sort_order', 80, true);
    health.app_deployment_bundle_checks = await safeList(supabase, 'v_app_deployment_bundle_checks', '*', 'sort_order', 80, true);
    health.app_public_seo_checks = await safeList(supabase, 'v_app_public_seo_checks', '*', 'sort_order', 80, true);
    health.app_runtime_fallback_checks = await safeList(supabase, 'v_app_runtime_fallback_checks', '*', 'sort_order', 80, true);
    health.app_roadmap_action_steps = await safeList(supabase, 'v_app_roadmap_action_steps', '*', 'sort_order', 140, true);
    health.app_depth_review_queue = await safeList(supabase, 'v_app_depth_review_queue', '*', 'sort_order', 80, true);
    health.app_data_migration_candidates = await safeList(supabase, 'v_app_data_migration_candidates', '*', 'sort_order', 80, true);
    health.app_schema_documentation_sync_checks = await safeList(supabase, 'v_app_schema_documentation_sync_checks', '*', 'sort_order', 80, true);
    health.app_public_route_seo_registry = await safeList(supabase, 'v_app_public_route_seo_registry', '*', 'sort_order', 80, true);
    health.app_internal_link_suggestion_queue = await safeList(supabase, 'v_app_internal_link_suggestion_queue', '*', 'sort_order', 80, true);
    health.app_css_component_token_inventory = await safeList(supabase, 'v_app_css_component_token_inventory', '*', 'sort_order', 80, true);
    health.app_mobile_field_action_queue = await safeList(supabase, 'v_app_mobile_field_action_queue', '*', 'sort_order', 80, true);
    health.app_release_manifest_checks = await safeList(supabase, 'v_app_release_manifest_checks', '*', 'sort_order', 80, true);
    health.app_payment_application_action_registry = await safeList(supabase, 'v_app_payment_application_action_registry', '*', 'sort_order', 80, true);
    health.app_accounting_close_control_queue = await safeList(supabase, 'v_app_accounting_close_control_queue', '*', 'sort_order', 80, true);
    health.app_equipment_accountability_action_queue = await safeList(supabase, 'v_app_equipment_accountability_action_queue', '*', 'sort_order', 80, true);
    health.app_public_seo_publication_queue = await safeList(supabase, 'v_app_public_seo_publication_queue', '*', 'sort_order', 80, true);
    health.app_fallback_observability_matrix = await safeList(supabase, 'v_app_fallback_observability_matrix', '*', 'sort_order', 80, true);
    health.app_schema_migration_compatibility_checks = await safeList(supabase, 'v_app_schema_migration_compatibility_checks', '*', 'sort_order', 80, true);
    health.app_accounting_evidence_package_queue = await safeList(supabase, 'v_app_accounting_evidence_package_queue', '*', 'sort_order', 80, true);
    health.app_equipment_return_to_service_rules = await safeList(supabase, 'v_app_equipment_return_to_service_rules', '*', 'sort_order', 80, true);
    health.app_public_asset_smoke_checks = await safeList(supabase, 'v_app_public_asset_smoke_checks', '*', 'sort_order', 80, true);
    health.app_error_recovery_playbook = await safeList(supabase, 'v_app_error_recovery_playbook', '*', 'sort_order', 80, true);
    health.app_payment_execution_queue = await safeList(supabase, 'v_app_payment_execution_queue', '*', 'sort_order', 80, true);
    health.app_bank_reconciliation_execution_queue = await safeList(supabase, 'v_app_bank_reconciliation_execution_queue', '*', 'sort_order', 80, true);
    health.app_equipment_scan_template_registry = await safeList(supabase, 'v_app_equipment_scan_template_registry', '*', 'sort_order', 80, true);
    health.app_local_seo_execution_queue = await safeList(supabase, 'v_app_local_seo_execution_queue', '*', 'sort_order', 80, true);
    health.app_fallback_drill_queue = await safeList(supabase, 'v_app_fallback_drill_queue', '*', 'sort_order', 80, true);
    health.app_payment_application_ui_queue = await safeList(supabase, 'v_app_payment_application_ui_queue', '*', 'sort_order', 80, true);
    health.app_reconciliation_import_validation_queue = await safeList(supabase, 'v_app_reconciliation_import_validation_queue', '*', 'sort_order', 80, true);
    health.app_equipment_service_closeout_queue = await safeList(supabase, 'v_app_equipment_service_closeout_queue', '*', 'sort_order', 80, true);
    health.app_seo_asset_publication_queue = await safeList(supabase, 'v_app_seo_asset_publication_queue', '*', 'sort_order', 80, true);
    health.app_runtime_recovery_telemetry_queue = await safeList(supabase, 'v_app_runtime_recovery_telemetry_queue', '*', 'sort_order', 80, true);
    health.app_payment_posting_proof_queue = await safeList(supabase, 'v_app_payment_posting_proof_queue', '*', 'sort_order', 80, true);
    health.app_reconciliation_match_workbench_queue = await safeList(supabase, 'v_app_reconciliation_match_workbench_queue', '*', 'sort_order', 80, true);
    health.app_equipment_scan_verification_queue = await safeList(supabase, 'v_app_equipment_scan_verification_queue', '*', 'sort_order', 80, true);
    health.app_local_seo_asset_smoke_queue = await safeList(supabase, 'v_app_local_seo_asset_smoke_queue', '*', 'sort_order', 80, true);
    health.app_runtime_fallback_drill_history_queue = await safeList(supabase, 'v_app_runtime_fallback_drill_history_queue', '*', 'sort_order', 80, true);
    health.app_payment_write_path_queue = await safeList(supabase, 'v_app_payment_write_path_queue', '*', 'sort_order', 80, true);
    health.app_reconciliation_scoring_rule_queue = await safeList(supabase, 'v_app_reconciliation_scoring_rule_queue', '*', 'sort_order', 80, true);
    health.app_equipment_accessory_template_queue = await safeList(supabase, 'v_app_equipment_accessory_template_queue', '*', 'sort_order', 80, true);
    health.app_local_seo_generation_queue = await safeList(supabase, 'v_app_local_seo_generation_queue', '*', 'sort_order', 80, true);
    health.app_mobile_offline_conflict_resolution_queue = await safeList(supabase, 'v_app_mobile_offline_conflict_resolution_queue', '*', 'sort_order', 80, true);
    health.app_payment_adjustment_workflow_queue = await safeList(supabase, 'v_app_payment_adjustment_workflow_queue', '*', 'sort_order', 80, true);
    health.app_reconciliation_exception_resolution_queue = await safeList(supabase, 'v_app_reconciliation_exception_resolution_queue', '*', 'sort_order', 80, true);
    health.app_equipment_scan_rollout_queue = await safeList(supabase, 'v_app_equipment_scan_rollout_queue', '*', 'sort_order', 80, true);
    health.app_local_seo_content_depth_queue = await safeList(supabase, 'v_app_local_seo_content_depth_queue', '*', 'sort_order', 80, true);
    health.app_runtime_error_message_catalog = await safeList(supabase, 'v_app_runtime_error_message_catalog', '*', 'sort_order', 80, true);
    health.app_release_validation_queue = await safeList(supabase, 'v_app_release_validation_queue', '*', 'sort_order', 80, true);
    health.app_payment_reconciliation_execution_queue = await safeList(supabase, 'v_app_payment_reconciliation_execution_queue', '*', 'sort_order', 80, true);
    health.app_equipment_mobile_scan_validation_queue = await safeList(supabase, 'v_app_equipment_mobile_scan_validation_queue', '*', 'sort_order', 80, true);
    health.app_local_seo_release_validation_queue = await safeList(supabase, 'v_app_local_seo_release_validation_queue', '*', 'sort_order', 80, true);
    health.app_runtime_fallback_message_queue = await safeList(supabase, 'v_app_runtime_fallback_message_queue', '*', 'sort_order', 80, true);
    health.app_json_db_migration_execution_queue = await safeList(supabase, 'v_app_json_db_migration_execution_queue', '*', 'sort_order', 80, true);
    health.mobile_today_action_registry = await safeList(supabase, 'v_mobile_today_action_registry', '*', 'priority_rank', 80, true);
    health.mobile_pwa_install_quality_gates = await safeList(supabase, 'v_mobile_pwa_install_quality_gates', '*', 'sort_order', 40, true);
    health.mobile_form_stepper_registry = await safeList(supabase, 'v_mobile_form_stepper_registry', '*', 'sort_order', 80, true);
    health.mobile_form_quality_gates = await safeList(supabase, 'v_mobile_form_quality_gates', '*', 'sort_order', 80, true);
    return Response.json(health, { headers: corsHeaders });
  }



  if (scope === 'accounting_close' && roleRank(actorRole) >= roleRank('supervisor')) {
    const accountingClose: Record<string, unknown> = { ok: true, accounting_close_scope: 'fast_path', actor_role: actorRole, actor_profile_id: actorId, pagination_meta: { scope, limit, actor_role: actorRole } };
    accountingClose.admin_home_command_center = await safeList(supabase, 'v_admin_home_command_center');
    accountingClose.admin_close_center_overview = await safeList(supabase, 'v_admin_close_center_overview');
    accountingClose.admin_close_wizard_steps = await safeList(supabase, 'v_admin_close_wizard_steps', '*', 'sort_order', 80, true);
    accountingClose.accounting_close_dashboard = await safeList(supabase, 'v_accounting_close_dashboard');
    accountingClose.accounting_close_admin_control_dashboard = await safeList(supabase, 'v_accounting_close_admin_control_dashboard', '*', 'period_end', limit, false);
    accountingClose.accounting_close_package_delivery_queue = await safeList(supabase, 'v_accounting_close_package_delivery_queue', '*', 'updated_at', limit, false);
    accountingClose.accountant_handoff_bundles = await safeList(supabase, 'v_accountant_handoff_bundle_directory', '*', 'updated_at', limit, false);
    accountingClose.accountant_handoff_packages = await safeList(supabase, 'v_accountant_handoff_package_directory', '*', 'updated_at', limit, false);
    return Response.json(accountingClose, { headers: corsHeaders });
  }

  if (scope === 'banking' && roleRank(actorRole) >= roleRank('supervisor')) {
    const banking: Record<string, unknown> = { ok: true, banking_scope: 'fast_path', actor_role: actorRole, actor_profile_id: actorId, pagination_meta: { scope, limit, actor_role: actorRole } };
    banking.bank_reconciliation_sessions = await safeList(supabase, 'v_bank_reconciliation_summary', '*', 'period_end', limit, false);
    banking.bank_reconciliation_items = await safeList(supabase, 'bank_reconciliation_items', '*', 'item_date', limit, false);
    banking.accounting_reconciliation_manual_review_queue = await safeList(supabase, 'v_accounting_reconciliation_manual_review_queue', '*', 'review_priority', limit, true);
    banking.bank_reconciliation_match_candidates = await safeList(supabase, 'v_bank_reconciliation_match_candidate_directory', '*', 'reconciliation_session_id', limit, false);
    banking.bank_reconciliation_match_scored = await safeList(supabase, 'v_bank_reconciliation_match_scored_directory', '*', 'match_score', limit, false);
    banking.bank_csv_import_session_directory = await safeList(supabase, 'v_bank_csv_import_session_directory', '*', 'updated_at', 80, false);
    return Response.json(banking, { headers: corsHeaders });
  }

  if (scope === 'tax_payroll' && roleRank(actorRole) >= roleRank('supervisor')) {
    const taxPayroll: Record<string, unknown> = { ok: true, tax_payroll_scope: 'fast_path', actor_role: actorRole, actor_profile_id: actorId, pagination_meta: { scope, limit, actor_role: actorRole } };
    taxPayroll.sales_tax_prep = await safeList(supabase, 'v_sales_tax_prep_directory', '*', 'period_end', limit, false);
    taxPayroll.sales_tax_filing_review = await safeList(supabase, 'v_sales_tax_filing_review_directory', '*', 'filing_period_end', limit, false);
    taxPayroll.payroll_remittance_prep = await safeList(supabase, 'v_payroll_remittance_prep_directory', '*', 'period_end', limit, false);
    taxPayroll.payroll_remittance_review = await safeList(supabase, 'v_payroll_remittance_review_directory', '*', 'remittance_period_end', limit, false);
    taxPayroll.accounting_payment_application_dashboard = await safeList(supabase, 'v_accounting_payment_application_dashboard');
    taxPayroll.ar_payment_applications = await safeList(supabase, 'v_ar_payment_application_directory', '*', 'application_date', limit, true);
    taxPayroll.ap_payment_applications = await safeList(supabase, 'v_ap_payment_application_directory', '*', 'application_date', limit, true);
    return Response.json(taxPayroll, { headers: corsHeaders });
  }

  if (scope === 'evidence' && roleRank(actorRole) >= roleRank('supervisor')) {
    const evidence: Record<string, unknown> = { ok: true, evidence_scope: 'fast_path', actor_role: actorRole, actor_profile_id: actorId, pagination_meta: { scope, limit, actor_role: actorRole } };
    evidence.evidence_manager_directory = await safeList(supabase, 'v_evidence_manager_directory', '*', 'last_seen_at', 120, false);
    evidence.admin_evidence_action_queue = await safeList(supabase, 'v_admin_evidence_action_queue', '*', 'updated_at', 80, false);
    evidence.attendance_photo_review = await safeList(supabase, 'v_attendance_photo_review', '*', 'uploaded_at', 120, false);
    evidence.hse_evidence_review = await safeList(supabase, 'v_hse_evidence_review', '*', 'created_at', 120, false);
    evidence.hse_packet_action_items = await safeList(supabase, 'v_hse_packet_action_items', '*', 'action_priority', 80, true);
    evidence.hse_dashboard_summary = await safeList(supabase, 'v_hse_dashboard_summary');
    return Response.json(evidence, { headers: corsHeaders });
  }

  if (scope === 'accounting' && roleRank(actorRole) >= roleRank('supervisor')) {
    const accounting: Record<string, unknown> = { ok: true, accounting_scope: 'fast_path', actor_role: actorRole, actor_profile_id: actorId, pagination_meta: { scope, limit, actor_role: actorRole } };
    accounting.admin_home_command_center = await safeList(supabase, 'v_admin_home_command_center');
    accounting.admin_close_center_overview = await safeList(supabase, 'v_admin_close_center_overview');
    accounting.admin_close_wizard_steps = await safeList(supabase, 'v_admin_close_wizard_steps', '*', 'sort_order', 80, true);
    accounting.accounting_close_admin_control_dashboard = await safeList(supabase, 'v_accounting_close_admin_control_dashboard', '*', 'period_end', limit, false);
    accounting.accounting_reconciliation_manual_review_queue = await safeList(supabase, 'v_accounting_reconciliation_manual_review_queue', '*', 'review_priority', limit, true);
    accounting.accounting_close_package_delivery_queue = await safeList(supabase, 'v_accounting_close_package_delivery_queue', '*', 'updated_at', limit, false);
    accounting.sales_tax_filing_review = await safeList(supabase, 'v_sales_tax_filing_review_directory', '*', 'filing_period_end', limit, false);
    accounting.payroll_remittance_review = await safeList(supabase, 'v_payroll_remittance_review_directory', '*', 'remittance_period_end', limit, false);
    return Response.json(accounting, { headers: corsHeaders });
  }

  const { data: peopleRaw } = await supabase.from('v_people_directory').select('*');
  const { data: profileAccessRaw } = await supabase.from('v_profile_access_rollups').select('*');
  const { data: assignmentsRaw } = await supabase.from('v_assignments_directory').select('*');
  const people = mergeRowsById(peopleRaw || [], profileAccessRaw || []);
  const assignments = assignmentsRaw || [];

  const directReportIds = new Set<string>();
  for (const row of people) {
    if (row.id === actorId) continue;
    if (row.default_supervisor_profile_id === actorId || row.override_supervisor_profile_id === actorId) directReportIds.add(String(row.id));
    if ((['admin','job_admin','hse'].includes(actorRole)) && (row.default_admin_profile_id === actorId || row.override_admin_profile_id === actorId)) {
      directReportIds.add(String(row.id));
    }
  }
  for (const a of assignments) {
    if (String(a.reports_to_supervisor_profile_id || '') === actorId || String(a.reports_to_admin_profile_id || '') === actorId) {
      directReportIds.add(String(a.profile_id));
    }
  }

  const filteredPeople = people.filter((row: any) => {
    if (scope === 'self') return row.id === actorId;
    if (scope === 'crew') {
      if (actorRole === 'admin') return true;
      if (roleRank(actorRole) >= roleRank('supervisor')) return row.id === actorId || directReportIds.has(String(row.id));
      return row.id === actorId;
    }
    if (scope === 'all' || scope === 'users') return roleRank(actorRole) >= roleRank('supervisor');
    return true;
  }).filter((row: any) => {
    if (roleFilter && normalizeRole(row.role) !== roleFilter) return false;
    if (!peopleSearch) return true;
    return [row.full_name, row.email, row.current_position, row.trade_specialty, row.phone, row.default_supervisor_name, row.default_admin_name]
      .some((v) => String(v || '').toLowerCase().includes(peopleSearch));
  });

  const sortedPeople = [...filteredPeople].sort((a: any, b: any) => compareNullable(a?.[peopleSort], b?.[peopleSort], peopleSortDir));
  const peopleOffset = (peoplePage - 1) * peoplePageSize;
  const pagedPeople = sortedPeople.slice(peopleOffset, peopleOffset + peoplePageSize);
  const peopleMeta = {
    page: peoplePage,
    page_size: peoplePageSize,
    total: filteredPeople.length,
    total_pages: Math.max(1, Math.ceil(filteredPeople.length / peoplePageSize)),
    loaded: pagedPeople.length,
    search: peopleSearch,
    role_filter: roleFilter,
    sort: peopleSort,
    direction: peopleSortDir
  };

  const response: Record<string, unknown> = {
    ok:true,
    actor_role: actorRole,
    actor_profile_id: actorId,
    profiles: pagedPeople,
    users: pagedPeople,
    pagination_meta: { scope, limit, search, actor_role: actorRole, people: peopleMeta, supports_server_paging: true, supports_sorting: true }
  };

  if (scope === 'people' && roleRank(actorRole) >= roleRank('supervisor')) {
    return Response.json(response, { headers: corsHeaders });
  }

  if (scope === 'operations' && roleRank(actorRole) >= roleRank('supervisor')) {
    response.service_areas = await safeList(supabase, 'service_areas', '*', 'name', limit);
    response.routes = await safeList(supabase, 'routes', '*', 'name', limit);
    const jobsPaged = await safeListPaged(supabase, 'jobs', {
      orderColumn: jobsSort,
      ascending: jobsSortDir !== 'desc',
      page: jobsPage,
      pageSize: jobsPageSize,
      search: jobsSearch,
      searchColumns: ['job_code', 'job_name', 'status', 'priority']
    });
    response.jobs = jobsPaged.rows;
    response.pagination_meta = { ...(response.pagination_meta as Record<string, unknown>), jobs: { ...jobsPaged.meta, sort: jobsSort, direction: jobsSortDir } };
    response.clients = await safeList(supabase, 'clients', '*', 'legal_name', limit);
    response.client_sites = await safeList(supabase, 'client_sites', '*', 'site_name', limit);
    response.operations_dashboard_summary = await safeList(supabase, 'v_operations_dashboard_summary');
    return Response.json(response, { headers: corsHeaders });
  }

  if ((scope === 'all' || scope === 'health' || scope === 'command_center') && roleRank(actorRole) >= roleRank('supervisor')) {
    response.admin_home_command_center = await safeList(supabase, 'v_admin_home_command_center');
    response.admin_error_health_center = await safeList(supabase, 'v_admin_error_health_center', '*', 'severity_rank', 100, true);
    response.admin_task_inbox = await safeList(supabase, 'v_admin_task_inbox', '*', 'priority_rank', 120, true);
    response.app_schema_version_status = await safeList(supabase, 'v_app_schema_version_status', '*', 'schema_version', 122, false);
    response.role_dashboard_presets = await safeList(supabase, 'v_role_dashboard_presets', '*', 'sort_order', 40, true);
    response.schema_drift_status = await safeList(supabase, 'v_schema_drift_status');
    response.production_readiness_checklist = await safeList(supabase, 'v_production_readiness_checklist', '*', 'sort_order', 80, true);
    response.role_permission_matrix = await safeList(supabase, 'v_role_permission_matrix', '*', 'sort_order', 120, true);
    response.admin_saved_filter_directory = await safeList(supabase, 'v_admin_saved_filter_directory', '*', 'updated_at', 80, false);
    response.admin_saved_filter_scope_summary = await safeList(supabase, 'v_admin_saved_filter_scope_summary', '*', 'filter_scope', 80, true);
    response.admin_close_center_overview = await safeList(supabase, 'v_admin_close_center_overview');
    response.admin_close_wizard_steps = await safeList(supabase, 'v_admin_close_wizard_steps', '*', 'sort_order', 80, true);
    response.admin_health_resolution_queue = await safeList(supabase, 'v_admin_health_resolution_queue', '*', 'updated_at', 80, false);
    response.admin_deployment_gate_status = await safeList(supabase, 'v_admin_deployment_gate_status', '*', 'sort_order', 80, true);
    response.public_seo_smoke_check = await safeList(supabase, 'v_public_seo_smoke_check', '*', 'page_path', 80, true);
    response.admin_audit_event_directory = await safeList(supabase, 'v_admin_audit_event_directory', '*', 'occurred_at', 80, false);
    response.admin_panel_load_diagnostics = await safeList(supabase, 'v_admin_panel_load_diagnostics', '*', 'captured_at', 80, false);
    response.admin_fast_path_scope_registry = await safeList(supabase, 'v_admin_fast_path_scope_registry', '*', 'scope_key', 40, true);
    response.admin_action_confirmation_rules = await safeList(supabase, 'v_admin_action_confirmation_rules', '*', 'action_area', 80, true);
    response.admin_action_permission_registry = await safeList(supabase, 'v_admin_action_permission_registry', '*', 'sort_order', 120, true);
    response.admin_panel_retry_policy = await safeList(supabase, 'v_admin_panel_retry_policy', '*', 'sort_order', 80, true);
    response.admin_schema_preflight_checks = await safeList(supabase, 'v_admin_schema_preflight_checks', '*', 'sort_order', 120, true);
    response.admin_deployment_checklist = await safeList(supabase, 'v_admin_deployment_checklist', '*', 'sort_order', 80, true);
    response.admin_function_readiness_checks = await safeList(supabase, 'v_admin_function_readiness_checks', '*', 'sort_order', 80, true);
    response.admin_backup_restore_rehearsal_directory = await safeList(supabase, 'v_admin_backup_restore_rehearsal_directory', '*', 'updated_at', 40, false);
    response.bank_csv_import_session_directory = await safeList(supabase, 'v_bank_csv_import_session_directory', '*', 'updated_at', 40, false);
    response.admin_evidence_action_queue = await safeList(supabase, 'v_admin_evidence_action_queue', '*', 'updated_at', 80, false);
    response.admin_mobile_action_card_directory = await safeList(supabase, 'v_admin_mobile_action_card_directory', '*', 'sort_order', 80, true);
    response.admin_list_pagination_settings = await safeList(supabase, 'v_admin_list_pagination_settings', '*', 'list_key', 80, true);
    response.mobile_navigation_quality_gates = await safeList(supabase, 'v_mobile_navigation_quality_gates', '*', 'sort_order', 20, true);
    response.mobile_first_quality_gates = await safeList(supabase, 'v_app_mobile_first_quality_gates', '*', 'sort_order', 80, true);
    response.jurisdiction_wording_gates = await safeList(supabase, 'v_app_jurisdiction_wording_gates', '*', 'sort_order', 40, true);
    response.mobile_today_action_registry = await safeList(supabase, 'v_mobile_today_action_registry', '*', 'priority_rank', 80, true);
    response.mobile_pwa_install_quality_gates = await safeList(supabase, 'v_mobile_pwa_install_quality_gates', '*', 'sort_order', 40, true);
    response.mobile_form_stepper_registry = await safeList(supabase, 'v_mobile_form_stepper_registry', '*', 'sort_order', 80, true);
    response.mobile_form_quality_gates = await safeList(supabase, 'v_mobile_form_quality_gates', '*', 'sort_order', 80, true);
    response.evidence_manager_directory = await safeList(supabase, 'v_evidence_manager_directory', '*', 'last_seen_at', 120, false);
  }
  if ((scope === 'all' || scope === 'sites') && roleRank(actorRole) >= roleRank('supervisor')) {
    response.sites = await safeList(supabase, 'sites', '*', 'site_code', limit);
  }
  if ((scope === 'all' || scope === 'assignments') && roleRank(actorRole) >= roleRank('supervisor')) {
    response.assignments = assignments;
  }
  if ((scope === 'all' || scope === 'notifications') && roleRank(actorRole) >= roleRank('supervisor')) {
    let q = supabase.from('v_admin_notifications').select('*').order('created_at', { ascending:false }).limit(limit);
    if (actorRole !== 'admin') q = q.or(`recipient_role.eq.admin,target_profile_id.eq.${actorId}`);
    const { data: notifications } = await q;
    response.notifications = (notifications || []).filter((row: any) => {
      if (!search) return true;
      return [row.notification_type, row.title, row.message, row.status, row.decision_status, row.created_by_name].some((v) => String(v || '').toLowerCase().includes(search));
    });
  }
  if ((scope === 'all' || scope === 'accounting' || scope === 'orders') && roleRank(actorRole) >= roleRank('supervisor')) {
    response.sales_orders = await safeList(supabase, 'sales_orders', '*', 'created_at', limit);
    response.accounting_entries = await safeList(supabase, 'accounting_entries', '*', 'created_at', limit);
    response.site_activity_events = await safeList(supabase, 'v_site_activity_recent', '*', 'occurred_at', limit, false);
    response.site_activity_summary = await safeList(supabase, 'v_site_activity_summary', '*', undefined, 5, false);
    response.site_activity_type_rollups = await safeList(supabase, 'v_site_activity_type_rollups', '*', 'last_24h_event_count', 100, false);
    response.site_activity_entity_rollups = await safeList(supabase, 'v_site_activity_entity_rollups', '*', 'last_24h_event_count', 100, false);
    response.attendance_photo_review = await safeList(supabase, 'v_attendance_photo_review', '*', 'uploaded_at', 120, false);
    response.hse_evidence_review = await safeList(supabase, 'v_hse_evidence_review', '*', 'created_at', 120, false);
  }
  if ((scope === 'all' || scope === 'operations' || scope === 'accounting_backbone') && roleRank(actorRole) >= roleRank('supervisor')) {
    response.service_areas = await safeList(supabase, 'service_areas', '*', 'name', limit);
    response.routes = await safeList(supabase, 'routes', '*', 'name', limit);
    const jobsPaged = await safeListPaged(supabase, 'jobs', {
      orderColumn: jobsSort,
      ascending: jobsSortDir !== 'desc',
      page: jobsPage,
      pageSize: jobsPageSize,
      search: jobsSearch,
      searchColumns: ['job_code', 'job_name', 'status', 'priority']
    });
    response.jobs = jobsPaged.rows;
    response.pagination_meta = { ...(response.pagination_meta as Record<string, unknown>), jobs: { ...jobsPaged.meta, sort: jobsSort, direction: jobsSortDir } };
    response.clients = await safeList(supabase, 'clients', '*', 'legal_name', limit);
    response.client_sites = await safeList(supabase, 'client_sites', '*', 'site_name', limit);
    response.units_of_measure = await safeList(supabase, 'units_of_measure', '*', 'sort_order', limit);
    response.cost_codes = await safeList(supabase, 'cost_codes', '*', 'code', limit);
    response.materials_catalog = await safeList(supabase, 'materials_catalog', '*', 'item_name', limit);
    response.service_pricing_templates = await safeList(supabase, 'service_pricing_templates', '*', 'template_name', limit);
    response.tax_codes = await safeList(supabase, 'tax_codes', '*', 'code', limit);
    response.business_tax_settings = await safeList(supabase, 'business_tax_settings', '*', 'profile_name', limit);
    response.recurring_service_agreements = await safeList(supabase, 'recurring_service_agreements', '*', 'agreement_code', limit);
    response.snow_event_triggers = await safeList(supabase, 'snow_event_triggers', '*', 'event_date', limit, false);
    response.change_orders = await safeList(supabase, 'change_orders', '*', 'requested_at', limit, false);
    response.customer_assets = await safeList(supabase, 'customer_assets', '*', 'asset_name', limit);
    response.customer_asset_job_links = await safeList(supabase, 'v_customer_asset_history', '*', 'service_date', limit, false);
    response.warranty_callback_events = await safeList(supabase, 'warranty_callback_events', '*', 'opened_at', limit, false);
    response.callback_warranty_dashboard_summary = await safeList(supabase, 'v_callback_warranty_dashboard_summary', '*', undefined, 5, false);
    response.payroll_export_runs = await safeList(supabase, 'payroll_export_runs', '*', 'period_start', limit, false);
    response.payroll_review_summary = await safeList(supabase, 'v_payroll_review_summary', '*', 'week_start', limit, false);
    response.payroll_review_detail = await safeList(supabase, 'v_payroll_review_detail', '*', 'created_at', limit, false);
    response.payroll_close_review_summary = await safeList(supabase, 'v_payroll_close_review_summary');
    response.route_profitability_summary = await safeList(supabase, 'v_route_profitability_summary', '*', 'route_name', limit);
    response.service_contract_documents = await safeList(supabase, 'service_contract_documents', '*', 'created_at', limit, false);
    response.service_agreement_profitability_summary = await safeList(supabase, 'v_service_agreement_profitability_summary', '*', 'agreement_code', limit);
    response.snow_event_invoice_candidates = await safeList(supabase, 'v_snow_event_invoice_candidates', '*', 'event_date', limit, false);
    response.estimate_conversion_candidates = await safeList(supabase, 'v_estimate_conversion_candidates', '*', 'estimate_number', limit, false);
    response.signed_contract_invoice_candidates = await safeList(supabase, 'v_signed_contract_invoice_candidates', '*', 'signed_at', limit, false);
    response.signed_contract_job_kickoff_candidates = await safeList(supabase, 'v_signed_contract_job_kickoff_candidates', '*', 'signed_at', limit, false);
    response.service_execution_scheduler_candidates = await safeList(supabase, 'v_service_execution_scheduler_candidates', '*', 'candidate_date', limit, false);
    response.service_execution_scheduler_summary = await safeList(supabase, 'v_service_execution_scheduler_summary');
    response.service_execution_scheduler_runs = await safeList(supabase, 'service_execution_scheduler_runs', '*', 'created_at', limit, false);
    response.service_execution_scheduler_settings = await safeList(supabase, 'service_execution_scheduler_settings', '*', 'setting_code', limit);
    response.service_execution_scheduler_status = await safeList(supabase, 'v_service_execution_scheduler_status');
    response.equipment_master = await safeList(supabase, 'equipment_master', '*', 'item_name', limit);
    response.estimates = await safeList(supabase, 'estimates', '*', 'estimate_number', limit);
    response.estimate_lines = await safeList(supabase, 'estimate_lines', '*', 'line_order', limit);
    response.work_orders = mergeRowsById(
      await safeList(supabase, 'work_orders', '*', 'work_order_number', limit),
      await safeList(supabase, 'v_work_order_rollups', '*', 'work_order_number', limit)
    );
    response.work_order_lines = await safeList(supabase, 'work_order_lines', '*', 'line_order', limit);
    response.route_stops = await safeList(supabase, 'route_stops', '*', 'stop_order', limit);
    response.route_stop_executions = await safeList(supabase, 'v_route_stop_execution_rollups', '*', 'execution_date', limit);
    response.route_stop_execution_attachments = await safeList(supabase, 'route_stop_execution_attachments', '*', 'created_at', limit);
    response.gl_journal_batches = await safeList(supabase, 'v_gl_journal_batch_rollups', '*', 'batch_number', limit);
    response.gl_journal_sync_exceptions = await safeList(supabase, 'v_gl_journal_sync_exceptions', '*', 'last_seen_at', limit);
    response.gl_journal_entries = await safeList(supabase, 'gl_journal_entries', '*', 'line_number', limit);
    response.subcontract_clients = await safeList(supabase, 'subcontract_clients', '*', 'company_name', limit);
    response.subcontract_dispatches = await safeList(supabase, 'subcontract_dispatches', '*', 'dispatch_number', limit);
    response.linked_hse_packets = mergeRowsById(
      await safeList(supabase, 'linked_hse_packets', '*', 'packet_number', limit),
      await safeList(supabase, 'v_hse_packet_progress', '*', 'packet_number', limit)
    );
    response.hse_packet_events = await safeList(supabase, 'hse_packet_events', '*', 'event_at', limit);
    response.hse_packet_proofs = await safeList(supabase, 'hse_packet_proofs', '*', 'created_at', limit);
    response.chart_of_accounts = await safeList(supabase, 'chart_of_accounts', '*', 'account_number', limit);
    response.bank_accounts = await safeList(supabase, 'bank_accounts', '*', 'account_name', limit);
    response.accounting_period_closes = await safeList(supabase, 'v_accounting_period_close_directory', '*', 'period_end', limit, false);
    response.sales_tax_filings = await safeList(supabase, 'v_sales_tax_filing_summary', '*', 'filing_period_end', limit, false);
    response.payroll_remittance_runs = await safeList(supabase, 'v_payroll_remittance_summary', '*', 'remittance_period_end', limit, false);
    response.bank_statement_imports = await safeList(supabase, 'bank_statement_imports', '*', 'statement_end', limit, false);
    response.bank_reconciliation_sessions = await safeList(supabase, 'v_bank_reconciliation_summary', '*', 'period_end', limit, false);
    response.bank_reconciliation_items = await safeList(supabase, 'bank_reconciliation_items', '*', 'item_date', limit, false);
    response.ar_invoice_aging_detail = await safeList(supabase, 'v_ar_invoice_aging_detail', '*', 'due_date', limit, true);
    response.ap_bill_aging_detail = await safeList(supabase, 'v_ap_bill_aging_detail', '*', 'due_date', limit, true);
    response.gl_trial_balance_summary = await safeList(supabase, 'v_gl_trial_balance_summary', '*', 'account_number', limit);
    response.accounting_close_dashboard = await safeList(supabase, 'v_accounting_close_dashboard');
    response.accounting_close_admin_control_dashboard = await safeList(supabase, 'v_accounting_close_admin_control_dashboard', '*', 'period_end', limit, false);
    response.accounting_reconciliation_manual_review_queue = await safeList(supabase, 'v_accounting_reconciliation_manual_review_queue', '*', 'review_priority', limit, true);
    response.accounting_close_package_delivery_queue = await safeList(supabase, 'v_accounting_close_package_delivery_queue', '*', 'updated_at', limit, false);
    response.sales_tax_prep = await safeList(supabase, 'v_sales_tax_prep_directory', '*', 'period_end', limit, false);
    response.sales_tax_filing_review = await safeList(supabase, 'v_sales_tax_filing_review_directory', '*', 'filing_period_end', limit, false);
    response.payroll_remittance_prep = await safeList(supabase, 'v_payroll_remittance_prep_directory', '*', 'period_end', limit, false);
    response.payroll_remittance_review = await safeList(supabase, 'v_payroll_remittance_review_directory', '*', 'remittance_period_end', limit, false);
    response.bank_reconciliation_match_candidates = await safeList(supabase, 'v_bank_reconciliation_match_candidate_directory', '*', 'reconciliation_session_id', limit, false);
    response.bank_reconciliation_match_scored = await safeList(supabase, 'v_bank_reconciliation_match_scored_directory', '*', 'match_score', limit, false);
    response.job_invoice_posting_automation = await safeList(supabase, 'v_job_invoice_posting_automation_directory', '*', 'updated_at', limit, false);
    response.job_journal_posting_automation = await safeList(supabase, 'v_job_journal_posting_automation_directory', '*', 'updated_at', limit, false);
    response.job_journal_generated_lines = await safeList(supabase, 'v_gl_journal_generated_line_directory', '*', 'line_sort', limit, false);
    response.accountant_handoff_bundles = await safeList(supabase, 'v_accountant_handoff_bundle_directory', '*', 'updated_at', limit, false);
    response.accountant_handoff_packages = await safeList(supabase, 'v_accountant_handoff_package_directory', '*', 'updated_at', limit, false);
    response.accountant_handoff_exports = await safeList(supabase, 'accountant_handoff_exports', '*', 'updated_at', limit, false);
    response.ap_vendors = await safeList(supabase, 'ap_vendors', '*', 'legal_name', limit);
    response.ar_invoices = mergeRowsById(
      await safeList(supabase, 'ar_invoices', '*', 'invoice_number', limit),
      (await safeList(supabase, 'v_account_balance_rollups', '*', 'record_number', limit)).filter((row: any) => row?.record_type === 'ar_invoice')
    );
    response.ar_payments = await safeList(supabase, 'ar_payments', '*', 'payment_number', limit);
    response.ar_payment_applications = await safeList(supabase, 'v_ar_payment_application_directory', '*', 'application_date', limit, true);
    response.ap_bills = mergeRowsById(
      await safeList(supabase, 'ap_bills', '*', 'bill_number', limit),
      (await safeList(supabase, 'v_account_balance_rollups', '*', 'record_number', limit)).filter((row: any) => row?.record_type === 'ap_bill')
    );
    response.ap_payments = await safeList(supabase, 'ap_payments', '*', 'payment_number', limit);
    response.ap_payment_applications = await safeList(supabase, 'v_ap_payment_application_directory', '*', 'application_date', limit, true);
    response.accounting_payment_application_dashboard = await safeList(supabase, 'v_accounting_payment_application_dashboard');
    response.material_receipts = mergeRowsById(
      await safeList(supabase, 'material_receipts', '*', 'receipt_number', limit),
      await safeList(supabase, 'v_material_receipt_rollups', '*', 'receipt_number', limit)
    );
    response.material_receipt_lines = await safeList(supabase, 'material_receipt_lines', '*', 'line_order', limit);
    response.material_issues = mergeRowsById(
      await safeList(supabase, 'material_issues', '*', 'issue_number', limit),
      await safeList(supabase, 'v_material_issue_rollups', '*', 'issue_number', limit)
    );
    response.material_issue_lines = await safeList(supabase, 'material_issue_lines', '*', 'line_order', limit);
    response.field_upload_failures = await safeList(supabase, 'v_field_upload_failure_rollups', '*', 'created_at', limit, false);
    response.app_traffic_events = await safeList(supabase, 'v_app_traffic_recent', '*', 'created_at', limit, false);
    response.backend_monitor_events = await safeList(supabase, 'v_backend_monitor_recent', '*', 'created_at', limit, false);
    response.app_traffic_daily_summary = await safeList(supabase, 'v_app_traffic_daily_summary', '*', 'event_date', 60, false);
    response.monitor_threshold_alerts = await safeList(supabase, 'v_monitor_threshold_alerts', '*', 'alert_key', limit);
    response.hse_packet_action_items = await safeList(supabase, 'v_hse_packet_action_items', '*', 'action_priority', limit, true);
    response.hse_dashboard_summary = await safeList(supabase, 'v_hse_dashboard_summary');
    response.accounting_review_summary = await safeList(supabase, 'v_accounting_review_summary');
    response.job_financial_events = await safeList(supabase, 'v_job_financial_event_directory', '*', 'event_date', limit, false);
    response.job_financial_rollups = await safeList(supabase, 'v_job_financial_rollups', '*', 'job_id', limit);
    response.account_login_events = await safeList(supabase, 'account_login_events', '*', 'occurred_at', limit, false);
    response.employee_time_clock_entries = await safeList(supabase, 'v_employee_time_clock_entries', '*', 'signed_in_at', limit, false);
    response.employee_time_clock_current = await safeList(supabase, 'v_employee_time_clock_current', '*', 'signed_in_at', limit, false);
    response.employee_time_clock_summary = await safeList(supabase, 'v_employee_time_clock_summary');
    response.employee_time_attendance_exceptions = await safeList(supabase, 'v_employee_time_attendance_exceptions', '*', 'signed_in_at', limit, false);
    response.employee_time_entry_reviews = await safeList(supabase, 'employee_time_entry_reviews', '*', 'created_at', limit, false);
    response.employee_time_review_queue = await safeList(supabase, 'v_employee_time_review_queue', '*', 'signed_in_at', limit, false);
    response.employee_time_review_summary = await safeList(supabase, 'v_employee_time_review_summary');
    response.operations_dashboard_summary = await safeList(supabase, 'v_operations_dashboard_summary');
    response.service_agreement_execution_candidates = await safeList(supabase, 'v_service_agreement_execution_candidates', '*', 'candidate_date', limit, false);
    response.hse_link_context_summary = await safeList(supabase, 'v_hse_link_context_summary', '*', 'sort_order', limit);
    response.monitor_review_summary = await safeList(supabase, 'v_monitor_review_summary', '*', 'sort_order', limit);
  }

if ((scope === 'all' || scope === 'reporting') && roleRank(actorRole) >= roleRank('supervisor')) {
  response.hse_submission_history_report = await safeList(supabase, 'v_hse_submission_history_report', '*', 'submission_date', limit, false);
  response.hse_form_daily_rollup = await safeList(supabase, 'v_hse_form_daily_rollup', '*', 'report_date', limit, false);
  response.hse_form_site_rollup = await safeList(supabase, 'v_hse_form_site_rollup', '*', 'last_submission_date', limit, false);
  response.workflow_history_report = await safeList(supabase, 'v_workflow_history_report', '*', 'occurred_at', limit, false);
  response.incident_near_miss_history = await safeList(supabase, 'v_incident_near_miss_history', '*', 'submission_date', limit, false);
  response.hse_reporting_monthly_trends = await safeList(supabase, 'v_hse_reporting_monthly_trends', '*', 'month_start', limit, false);
  response.hse_reporting_worker_rollup = await safeList(supabase, 'v_hse_reporting_worker_rollup', '*', 'last_submission_date', limit, false);
  response.hse_reporting_context_rollup = await safeList(supabase, 'v_hse_reporting_context_rollup', '*', 'last_submission_date', limit, false);
  response.report_preset_directory = await safeList(supabase, 'v_report_preset_directory', '*', 'updated_at', limit, false);
  response.corrective_action_task_directory = await safeList(supabase, 'v_corrective_action_task_directory', '*', 'due_date', limit, true);
  response.corrective_action_task_summary = await safeList(supabase, 'v_corrective_action_task_summary');
  response.training_course_directory = await safeList(supabase, 'v_training_course_directory', '*', 'course_name', limit, true);
  response.training_record_directory = await safeList(supabase, 'v_training_record_directory', '*', 'expires_at', limit, true);
  response.training_expiry_summary = await safeList(supabase, 'v_training_expiry_summary');
  response.sds_acknowledgement_directory = await safeList(supabase, 'v_sds_acknowledgement_directory', '*', 'expires_at', limit, true);
  response.supervisor_safety_queue = await safeList(supabase, 'v_supervisor_safety_queue', '*', 'sort_at', limit, false);
  response.site_safety_scorecards = await safeList(supabase, 'v_site_safety_scorecards', '*', 'last_submission_date', limit, false);
  response.supervisor_scorecards = await safeList(supabase, 'v_supervisor_scorecards', '*', 'last_activity_at', limit, false);
  response.overdue_action_alerts = await safeList(supabase, 'v_overdue_action_alerts', '*', 'sort_at', limit, false);
  response.report_subscription_directory = await safeList(supabase, 'v_report_subscription_directory', '*', 'next_send_at', limit, false);
  response.report_delivery_candidates = await safeList(supabase, 'v_report_delivery_candidates', '*', 'next_send_at', limit, false);
  response.equipment_jsa_hazard_link_directory = await safeList(supabase, 'v_equipment_jsa_hazard_link_directory', '*', 'review_due_date', limit, false);
  response.report_delivery_run_history = await safeList(supabase, 'v_report_delivery_run_history', '*', 'started_at', limit, false);
  response.report_delivery_scheduler_status = await safeList(supabase, 'v_report_delivery_scheduler_status', '*', 'setting_code', 5, true);
}
  if (scope === 'self') {
    response.profile = filteredPeople[0] || null;
    response.self_training_available_courses = (await safeList(supabase, 'v_training_course_directory', '*', 'course_name', limit, true)).filter((row: any) => row?.self_service_enabled !== false);
    response.self_training_records = await safeListWhere(supabase, 'v_training_record_directory', '*', [['profile_id', actorId]], 'expires_at', limit, true);
    response.self_sds_acknowledgements = await safeListWhere(supabase, 'v_sds_acknowledgement_directory', '*', [['profile_id', actorId]], 'expires_at', limit, true);
    response.self_sds_prompts = await safeListWhere(supabase, 'v_worker_sds_prompt_queue', '*', [['profile_id', actorId]], 'acknowledged_at', limit, false);
  }
  return Response.json(response, { headers: corsHeaders });
});
