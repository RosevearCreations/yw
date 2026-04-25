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
    response.ap_vendors = await safeList(supabase, 'ap_vendors', '*', 'legal_name', limit);
    response.ar_invoices = mergeRowsById(
      await safeList(supabase, 'ar_invoices', '*', 'invoice_number', limit),
      (await safeList(supabase, 'v_account_balance_rollups', '*', 'record_number', limit)).filter((row: any) => row?.record_type === 'ar_invoice')
    );
    response.ar_payments = await safeList(supabase, 'ar_payments', '*', 'payment_number', limit);
    response.ap_bills = mergeRowsById(
      await safeList(supabase, 'ap_bills', '*', 'bill_number', limit),
      (await safeList(supabase, 'v_account_balance_rollups', '*', 'record_number', limit)).filter((row: any) => row?.record_type === 'ap_bill')
    );
    response.ap_payments = await safeList(supabase, 'ap_payments', '*', 'payment_number', limit);
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
}
  if (scope === 'self') response.profile = filteredPeople[0] || null;
  return Response.json(response, { headers: corsHeaders });
});
