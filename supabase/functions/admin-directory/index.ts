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
  const roleFilter = String(body.role_filter || body.profile_role || '').trim().toLowerCase();
  const limit = Math.max(1, Math.min(500, Number(body.limit || 200)));

  // Reporting can be a heavy screen. Return it through a narrow fast path so
  // Admin boot does not need to load people/site/assignment directories first.
  if (scope === 'reporting' && roleRank(actorRole) >= roleRank('supervisor')) {
    const reporting: Record<string, unknown> = { ok: true, reporting_scope: 'fast_path' };
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
    if (!search) return true;
    return [row.full_name, row.email, row.current_position, row.trade_specialty, row.phone, row.default_supervisor_name, row.default_admin_name]
      .some((v) => String(v || '').toLowerCase().includes(search));
  });

  const response: Record<string, unknown> = { ok:true, profiles: filteredPeople, users: filteredPeople };

  if ((scope === 'all' || scope === 'health' || scope === 'command_center') && roleRank(actorRole) >= roleRank('supervisor')) {
    response.admin_home_command_center = await safeList(supabase, 'v_admin_home_command_center');
    response.admin_error_health_center = await safeList(supabase, 'v_admin_error_health_center', '*', 'severity_rank', 100, true);
    response.admin_task_inbox = await safeList(supabase, 'v_admin_task_inbox', '*', 'priority_rank', 120, true);
    response.app_schema_version_status = await safeList(supabase, 'v_app_schema_version_status', '*', 'schema_version', 120, false);
    response.role_dashboard_presets = await safeList(supabase, 'v_role_dashboard_presets', '*', 'sort_order', 40, true);
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
    response.jobs = await safeList(supabase, 'jobs', 'id,job_code,job_name,job_type,job_status,client_id,client_site_id', 'job_code', limit);
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
