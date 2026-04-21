// Detailed Edge Function: admin-selectors
// Purpose:
// - Return profile/site/assignment selectors for admin management
// - Return operational/accounting selectors so Admin UI can manage new backbone tables

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

async function safeList(supabase: any, table: string, columns = '*', orderColumn?: string, limit = 1000, ascending = true) {
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
  const { data: actorProfile } = await supabase.from('profiles').select('*').eq('id', userData.user.id).single();
  const actorRole = effectiveRole(actorProfile, userData.user);
  if (!actorProfile?.is_active) return Response.json({ ok:false, error:'Inactive profile' }, { status:403, headers:corsHeaders });
  if (roleRank(actorRole) < roleRank('supervisor')) return Response.json({ ok:false, error:'Supervisor+ required' }, { status:403, headers:corsHeaders });

  const body = await req.json().catch(() => ({}));
  const scope = String(body.scope || 'all').trim().toLowerCase();


  if (scope === 'admin_core') {
    return Response.json({
      ok: true,
      profiles,
      sites,
      assignments,
      positions: await safeList(supabase, 'position_catalog', '*', 'sort_order'),
      trades: await safeList(supabase, 'trade_catalog', '*', 'sort_order'),
      staff_tiers: await safeList(supabase, 'staff_tier_catalog', '*', 'sort_order'),
      seniority_levels: await safeList(supabase, 'seniority_level_catalog', '*', 'sort_order'),
      employment_statuses: await safeList(supabase, 'employment_status_catalog', '*', 'sort_order'),
      job_types: await safeList(supabase, 'job_type_catalog', '*', 'sort_order'),
      units_of_measure: await safeList(supabase, 'units_of_measure', 'id,code,name,category,sort_order,is_active', 'sort_order'),
      cost_codes: await safeList(supabase, 'cost_codes', 'id,code,name,category,is_active', 'code'),
      service_areas: await safeList(supabase, 'service_areas', 'id,area_code,name,region,is_active', 'name'),
      routes: await safeList(supabase, 'routes', 'id,route_code,name,service_area_id,route_type,is_active', 'name'),
      jobs: await safeList(supabase, 'jobs', 'id,job_code,job_name,job_type,job_status,client_id,client_site_id,service_contract_reference', 'job_code'),
      clients: await safeList(supabase, 'clients', 'id,client_code,legal_name,display_name,is_active', 'legal_name'),
      client_sites: await safeList(supabase, 'client_sites', 'id,client_id,site_code,site_name,is_active', 'site_name'),
      materials_catalog: await safeList(supabase, 'materials_catalog', 'id,sku,item_name,material_category,unit_id,is_active', 'item_name'),
      equipment_master: await safeList(supabase, 'equipment_master', 'id,equipment_code,item_name,equipment_category,is_active', 'item_name'),
      estimates: await safeList(supabase, 'estimates', 'id,estimate_number,client_id,client_site_id,status,total_amount', 'estimate_number'),
      work_orders: await safeList(supabase, 'work_orders', 'id,work_order_number,client_id,client_site_id,work_type,status,route_id', 'work_order_number'),
      subcontract_clients: await safeList(supabase, 'subcontract_clients', 'id,subcontract_code,company_name,is_active', 'company_name'),
      subcontract_dispatches: await safeList(supabase, 'subcontract_dispatches', 'id,dispatch_number,subcontract_client_id,dispatch_status', 'dispatch_number'),
      linked_hse_packets: await safeList(supabase, 'linked_hse_packets', 'id,packet_number,packet_type,packet_status,job_id,work_order_id', 'packet_number'),
      chart_of_accounts: await safeList(supabase, 'chart_of_accounts', 'id,account_number,account_name,account_type,is_active', 'account_number'),
      ap_vendors: await safeList(supabase, 'ap_vendors', 'id,vendor_code,legal_name,display_name,is_active', 'legal_name'),
      ar_invoices: await safeList(supabase, 'ar_invoices', 'id,invoice_number,client_id,invoice_status,total_amount,balance_due', 'invoice_number'),
      ap_bills: await safeList(supabase, 'ap_bills', 'id,bill_number,vendor_id,bill_status,total_amount,balance_due', 'bill_number'),
      tax_codes: await safeList(supabase, 'tax_codes', '*', 'code'),
      business_tax_settings: await safeList(supabase, 'business_tax_settings', '*', 'profile_name'),
      service_pricing_templates: await safeList(supabase, 'service_pricing_templates', '*', 'template_name'),
      recurring_service_agreements: await safeList(supabase, 'recurring_service_agreements', 'id,agreement_code,service_name,agreement_status,billing_method,client_id,client_site_id,contract_document_id', 'agreement_code'),
      change_orders: await safeList(supabase, 'change_orders', 'id,change_order_number,job_id,status,requested_at', 'requested_at', 250, false),
      customer_assets: await safeList(supabase, 'customer_assets', 'id,asset_code,asset_name,asset_type,client_id,client_site_id,is_active', 'asset_name'),
      warranty_callback_events: await safeList(supabase, 'warranty_callback_events', 'id,callback_number,callback_type,status,job_id,asset_id', 'opened_at', 250, false),
      payroll_export_runs: await safeList(supabase, 'payroll_export_runs', 'id,run_code,period_start,period_end,status,export_provider', 'period_start', 250, false),
      service_contract_documents: await safeList(supabase, 'service_contract_documents', 'id,document_number,document_kind,document_status,agreement_id,estimate_id,job_id,signed_at,linked_invoice_id', 'created_at', 250, false),
      service_execution_scheduler_settings: await safeList(supabase, 'service_execution_scheduler_settings', '*', 'setting_code')
    }, { headers: corsHeaders });
  }

  if (scope === 'hse_ops') {
    const linkedHsePackets = await safeList(supabase, 'linked_hse_packets', '*', 'packet_number');
    const hseProgress = await safeList(supabase, 'v_hse_packet_progress', '*', 'packet_number');
    const hsePacketActionItems = await safeList(supabase, 'v_hse_packet_action_items', '*', 'action_priority', 250, true);
    const hseDashboardSummary = await safeList(supabase, 'v_hse_dashboard_summary');
    const accountingReviewSummary = await safeList(supabase, 'v_accounting_review_summary');
    const fieldUploadFailures = await safeList(supabase, 'v_field_upload_failure_rollups', '*', 'created_at', 120, false);
    const backendMonitorEvents = await safeList(supabase, 'v_backend_monitor_recent', '*', 'created_at', 120, false);
    const appTrafficDailySummary = await safeList(supabase, 'v_app_traffic_daily_summary', '*', 'event_date', 14, false);
    const monitorThresholdAlerts = await safeList(supabase, 'v_monitor_threshold_alerts', '*', 'alert_key', 120, true);
    const hseLinkContextSummary = await safeList(supabase, 'v_hse_link_context_summary', '*', 'sort_order', 50, true);
    const monitorReviewSummary = await safeList(supabase, 'v_monitor_review_summary', '*', 'sort_order', 50, true);
    const operationsDashboardSummary = await safeList(supabase, 'v_operations_dashboard_summary');
    const siteActivitySummary = await safeList(supabase, 'v_site_activity_summary');
    return Response.json({
      ok: true,
      linked_hse_packets: mergeRowsById(linkedHsePackets, hseProgress),
      hse_packet_action_items: hsePacketActionItems,
      hse_dashboard_summary: hseDashboardSummary,
      accounting_review_summary: accountingReviewSummary,
      field_upload_failures: fieldUploadFailures,
      backend_monitor_events: backendMonitorEvents,
      app_traffic_daily_summary: appTrafficDailySummary,
      monitor_threshold_alerts: monitorThresholdAlerts,
      hse_link_context_summary: hseLinkContextSummary,
      monitor_review_summary: monitorReviewSummary,
      operations_dashboard_summary: operationsDashboardSummary,
      site_activity_summary: siteActivitySummary
    }, { headers: corsHeaders });
  }

  const profiles = await safeList(supabase, 'v_people_directory', 'id,email,full_name,role,is_active,default_supervisor_name,default_admin_name,staff_tier,current_position,trade_specialty', 'full_name');
  const sites = await safeList(supabase, 'sites', 'id,site_code,site_name,is_active,region,client_name,project_code,project_status', 'site_code');
  const assignments = await safeList(supabase, 'site_assignments', 'id,site_id,profile_id,assignment_role,is_primary,reports_to_supervisor_profile_id,reports_to_admin_profile_id', 'id');

  const workOrders = await safeList(supabase, 'work_orders', '*', 'work_order_number');
  const workOrderRollups = await safeList(supabase, 'v_work_order_rollups', '*', 'work_order_number');
  const linkedHsePackets = await safeList(supabase, 'linked_hse_packets', '*', 'packet_number');
  const hseProgress = await safeList(supabase, 'v_hse_packet_progress', '*', 'packet_number');
  const hsePacketEvents = await safeList(supabase, 'hse_packet_events', '*', 'event_at');
  const routeStopExecutions = await safeList(supabase, 'v_route_stop_execution_rollups', '*', 'execution_date');
  const routeStopExecutionAttachments = await safeList(supabase, 'route_stop_execution_attachments', '*', 'created_at');
  const hsePacketProofs = await safeList(supabase, 'hse_packet_proofs', '*', 'created_at');
  const glJournalBatches = await safeList(supabase, 'gl_journal_batches', '*', 'batch_number');
  const glJournalBatchRollups = await safeList(supabase, 'v_gl_journal_batch_rollups', '*', 'batch_number');
  const glJournalSyncExceptions = await safeList(supabase, 'v_gl_journal_sync_exceptions', '*', 'last_seen_at');
  const fieldUploadFailures = await safeList(supabase, 'v_field_upload_failure_rollups', '*', 'created_at', 500, false);
  const appTrafficEvents = await safeList(supabase, 'v_app_traffic_recent', '*', 'created_at', 500, false);
  const backendMonitorEvents = await safeList(supabase, 'v_backend_monitor_recent', '*', 'created_at', 500, false);
  const appTrafficDailySummary = await safeList(supabase, 'v_app_traffic_daily_summary', '*', 'event_date', 60, false);
  const monitorThresholdAlerts = await safeList(supabase, 'v_monitor_threshold_alerts', '*', 'alert_key');
  const hsePacketActionItems = await safeList(supabase, 'v_hse_packet_action_items', '*', 'action_priority', 500, true);
  const hseDashboardSummary = await safeList(supabase, 'v_hse_dashboard_summary');
  const accountingSummary = await safeList(supabase, 'v_accounting_review_summary');
  const jobFinancialEvents = await safeList(supabase, 'v_job_financial_event_directory', '*', 'event_date', 1000, false);
  const jobFinancialRollups = await safeList(supabase, 'v_job_financial_rollups', '*', 'job_id', 1000, true);
  const hseLinkContextSummary = await safeList(supabase, 'v_hse_link_context_summary', '*', 'sort_order');
  const monitorReviewSummary = await safeList(supabase, 'v_monitor_review_summary', '*', 'sort_order');
  const materialIssues = await safeList(supabase, 'material_issues', '*', 'issue_number');
  const materialIssueRollups = await safeList(supabase, 'v_material_issue_rollups', '*', 'issue_number');
  const arInvoices = await safeList(supabase, 'ar_invoices', '*', 'invoice_number');
  const apBills = await safeList(supabase, 'ap_bills', '*', 'bill_number');
  const materialReceipts = await safeList(supabase, 'material_receipts', '*', 'receipt_number');
  const materialReceiptRollups = await safeList(supabase, 'v_material_receipt_rollups', '*', 'receipt_number');
  const accountRollups = await safeList(supabase, 'v_account_balance_rollups', '*', 'record_number');

  return Response.json({
    ok:true,
    profiles,
    sites,
    assignments,
    positions: await safeList(supabase, 'position_catalog', '*', 'sort_order'),
    trades: await safeList(supabase, 'trade_catalog', '*', 'sort_order'),
    staff_tiers: await safeList(supabase, 'staff_tier_catalog', '*', 'sort_order'),
    seniority_levels: await safeList(supabase, 'seniority_level_catalog', '*', 'sort_order'),
    employment_statuses: await safeList(supabase, 'employment_status_catalog', '*', 'sort_order'),
    job_types: await safeList(supabase, 'job_type_catalog', '*', 'sort_order'),
    units_of_measure: await safeList(supabase, 'units_of_measure', '*', 'sort_order'),
    cost_codes: await safeList(supabase, 'cost_codes', '*', 'code'),
    service_areas: await safeList(supabase, 'service_areas', '*', 'name'),
    routes: await safeList(supabase, 'routes', '*', 'name'),
    jobs: await safeList(supabase, 'jobs', 'id,job_code,job_name,job_type,job_status,client_id,client_site_id', 'job_code'),
    clients: await safeList(supabase, 'clients', '*', 'legal_name'),
    client_sites: await safeList(supabase, 'client_sites', '*', 'site_name'),
    materials_catalog: await safeList(supabase, 'materials_catalog', '*', 'item_name'),
    service_pricing_templates: await safeList(supabase, 'service_pricing_templates', '*', 'template_name'),
    tax_codes: await safeList(supabase, 'tax_codes', '*', 'code'),
    business_tax_settings: await safeList(supabase, 'business_tax_settings', '*', 'profile_name'),
    job_financial_events: jobFinancialEvents,
    job_financial_rollups: jobFinancialRollups,
    equipment_master: await safeList(supabase, 'equipment_master', '*', 'item_name'),
    estimates: await safeList(supabase, 'estimates', '*', 'estimate_number'),
    estimate_lines: await safeList(supabase, 'estimate_lines', '*', 'line_order'),
    work_orders: mergeRowsById(workOrders, workOrderRollups),
    work_order_lines: await safeList(supabase, 'work_order_lines', '*', 'line_order'),
    route_stops: await safeList(supabase, 'route_stops', '*', 'stop_order'),
    route_stop_executions: routeStopExecutions,
    route_stop_execution_attachments: routeStopExecutionAttachments,
    subcontract_clients: await safeList(supabase, 'subcontract_clients', '*', 'company_name'),
    subcontract_dispatches: await safeList(supabase, 'subcontract_dispatches', '*', 'dispatch_number'),
    linked_hse_packets: mergeRowsById(linkedHsePackets, hseProgress),
    hse_packet_events: hsePacketEvents,
    hse_packet_proofs: hsePacketProofs,
    chart_of_accounts: await safeList(supabase, 'chart_of_accounts', '*', 'account_number'),
    gl_journal_batches: mergeRowsById(glJournalBatches, glJournalBatchRollups),
    gl_journal_sync_exceptions: glJournalSyncExceptions,
    gl_journal_entries: await safeList(supabase, 'gl_journal_entries', '*', 'line_number'),
    ap_vendors: await safeList(supabase, 'ap_vendors', '*', 'legal_name'),
    ar_invoices: mergeRowsById(arInvoices, (accountRollups || []).filter((row: any) => row?.record_type === 'ar_invoice')),
    ar_payments: await safeList(supabase, 'ar_payments', '*', 'payment_number'),
    ap_bills: mergeRowsById(apBills, (accountRollups || []).filter((row: any) => row?.record_type === 'ap_bill')),
    ap_payments: await safeList(supabase, 'ap_payments', '*', 'payment_number'),
    material_receipts: mergeRowsById(materialReceipts, materialReceiptRollups),
    material_receipt_lines: await safeList(supabase, 'material_receipt_lines', '*', 'line_order'),
    material_issues: mergeRowsById(materialIssues, materialIssueRollups),
    material_issue_lines: await safeList(supabase, 'material_issue_lines', '*', 'line_order'),
    field_upload_failures: fieldUploadFailures,
    app_traffic_events: appTrafficEvents,
    backend_monitor_events: backendMonitorEvents,
    app_traffic_daily_summary: appTrafficDailySummary,
    monitor_threshold_alerts: monitorThresholdAlerts,
    hse_packet_action_items: hsePacketActionItems,
    hse_dashboard_summary: hseDashboardSummary,
    accounting_review_summary: accountingSummary,
    hse_link_context_summary: hseLinkContextSummary,
    monitor_review_summary: monitorReviewSummary,
  }, { headers: corsHeaders });
});
