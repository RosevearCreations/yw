// Detailed Edge Function: jobs-directory
// Purpose:
// - Return jobs, crews, comments, equipment, signouts, notifications, and pool availability
// - Include signed URLs for equipment evidence and job comment photo attachments

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { hasModuleAccess } from "../_shared/module-permissions.ts";

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
  const meta = normalizeRole(user?.user_metadata?.role);
  if (direct === 'admin' || tier === 'admin' || meta === 'admin') return 'admin';
  if (direct === 'supervisor' || tier === 'supervisor' || meta === 'supervisor') return 'supervisor';
  return direct || tier || meta || 'employee';
}

async function safeSelect(supabase: any, tableOrView: string, selectExpr = '*', builder?: (query: any) => any) {
  try {
    let query = supabase.from(tableOrView).select(selectExpr);
    if (builder) query = builder(query) || query;
    const { data, error } = await query;
    if (error) return [];
    return data || [];
  } catch {
    return [];
  }
}

function numeric(value: any) {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function buildJobProfitabilityCloseout(input: any) {
  const jobs = Array.isArray(input.jobs) ? input.jobs : [];
  const rollups = Array.isArray(input.rollups) ? input.rollups : [];
  const depthRows = Array.isArray(input.depthRows) ? input.depthRows : [];
  const events = Array.isArray(input.events) ? input.events : [];
  const reviews = Array.isArray(input.reviews) ? input.reviews : [];
  const invoiceCandidates = Array.isArray(input.invoiceCandidates) ? input.invoiceCandidates : [];
  const invoicePostings = Array.isArray(input.invoicePostings) ? input.invoicePostings : [];
  const invoicePostingLinks = Array.isArray(input.invoicePostingLinks) ? input.invoicePostingLinks : [];
  const paymentApplications = Array.isArray(input.paymentApplications) ? input.paymentApplications : [];
  const executionCosts = Array.isArray(input.executionCosts) ? input.executionCosts : [];

  const firstByJob = (rows: any[]) => {
    const map = new Map<number, any>();
    for (const row of rows) {
      const id = Number(row?.job_id || 0);
      if (id && !map.has(id)) map.set(id, row);
    }
    return map;
  };
  const rollupByJob = firstByJob(rollups);
  const depthByJob = firstByJob(depthRows);
  const reviewsByJob = new Map<number, any[]>();
  const eventsByJob = new Map<number, any[]>();
  const executionByJob = new Map<number, any[]>();
  for (const row of reviews) {
    const id = Number(row?.job_id || 0);
    if (!id) continue;
    const list = reviewsByJob.get(id) || [];
    list.push(row); reviewsByJob.set(id, list);
  }
  for (const row of events) {
    const id = Number(row?.job_id || 0);
    if (!id) continue;
    const list = eventsByJob.get(id) || [];
    list.push(row); eventsByJob.set(id, list);
  }
  for (const row of executionCosts) {
    const id = Number(row?.job_id || 0);
    if (!id) continue;
    const list = executionByJob.get(id) || [];
    list.push(row); executionByJob.set(id, list);
  }

  const candidateJob = new Map<string, number>();
  for (const row of invoiceCandidates) {
    const id = String(row?.id || '');
    const jobId = Number(row?.job_id || 0);
    if (id && jobId) candidateJob.set(id, jobId);
  }
  const invoiceIdsByJob = new Map<number, Set<string>>();
  for (const link of invoicePostingLinks) {
    const jobId = candidateJob.get(String(link?.invoice_candidate_id || '')) || 0;
    const invoiceId = String(link?.ar_invoice_id || '');
    if (!jobId || !invoiceId) continue;
    const set = invoiceIdsByJob.get(jobId) || new Set<string>();
    set.add(invoiceId); invoiceIdsByJob.set(jobId, set);
  }

  return jobs.map((job: any) => {
    const jobId = Number(job?.id || 0);
    const rollup = rollupByJob.get(jobId) || {};
    const depth = depthByJob.get(jobId) || {};
    const jobEvents = eventsByJob.get(jobId) || [];
    const jobReviews = reviewsByJob.get(jobId) || [];
    const jobExecution = executionByJob.get(jobId) || [];

    const eventCost = (types: string[]) => jobEvents
      .filter((row: any) => types.includes(String(row?.event_type || '')))
      .reduce((sum: number, row: any) => sum + numeric(row?.cost_amount), 0);
    const categoryCost = (category: string) => jobEvents
      .filter((row: any) => String(row?.cost_category || '').toLowerCase() === category)
      .reduce((sum: number, row: any) => sum + numeric(row?.cost_amount), 0);

    const labour = numeric(rollup.labor_cost_total);
    const material = eventCost(['material']);
    const equipment = eventCost(['equipment_usage','equipment_repair','equipment_replacement']) + numeric(job.equipment_repair_cost_total);
    const fuel = eventCost(['fuel']);
    const travel = eventCost(['travel']);
    const subcontract = eventCost(['subcontract']);
    const disposal = eventCost(['disposal']);
    const rework = categoryCost('rework') + eventCost(['delay']) + numeric(job.delay_cost_total);

    const estimatedRevenue = numeric(job.quoted_charge_total);
    const estimatedCost = numeric(job.estimated_cost_total);
    const actualRevenue = numeric(rollup.actual_charge_rollup_total || depth.total_known_revenue || job.actual_charge_total);
    const actualCost = numeric(rollup.actual_cost_rollup_total || depth.total_known_cost || job.actual_cost_total);
    const actualProfit = actualRevenue - actualCost;
    const actualMargin = actualRevenue > 0 ? Number(((actualProfit / actualRevenue) * 100).toFixed(2)) : 0;
    const estimatedProfit = numeric(job.estimated_profit_total || (estimatedRevenue - estimatedCost));
    const classifiedCost = labour + material + equipment + fuel + travel + subcontract + disposal + rework;
    const other = Math.max(0, Number((actualCost - classifiedCost).toFixed(2)));

    const jobPostingRows = invoicePostings.filter((row: any) => Number(row?.job_id || 0) === jobId && String(row?.posting_status || '') === 'posted');
    const invoiced = jobPostingRows.reduce((sum: number, row: any) => sum + numeric(row?.total_amount), 0);
    const invoiceIds = invoiceIdsByJob.get(jobId) || new Set<string>();
    const jobApplications = paymentApplications.filter((row: any) =>
      invoiceIds.has(String(row?.invoice_id || '')) &&
      !['reversed','void'].includes(String(row?.review_status || row?.application_status || '').toLowerCase())
    );
    const collected = jobApplications.reduce((sum: number, row: any) => sum + numeric(row?.applied_amount), 0);

    const approvedProofCount = jobExecution.reduce((sum: number, row: any) => sum + numeric(row?.approved_proof_count), 0);
    const submittedProofCount = jobExecution.reduce((sum: number, row: any) => sum + numeric(row?.submitted_proof_count), 0);
    const accountingReady = jobReviews.some((row: any) => row?.accounting_ready === true);
    const reviewApproved = jobReviews.some((row: any) => ['approved','complete','completed','closed'].includes(String(row?.review_status || '').toLowerCase()));

    let closeoutStatus = 'review_required';
    if (!jobReviews.length) closeoutStatus = 'needs_completion_review';
    else if (!approvedProofCount && submittedProofCount) closeoutStatus = 'needs_proof_approval';
    else if (!accountingReady && !reviewApproved) closeoutStatus = 'needs_closeout_review';
    else if (invoiced <= 0 && actualRevenue > 0) closeoutStatus = 'ready_to_invoice';
    else if (invoiced > 0 && collected + 0.01 < invoiced) closeoutStatus = 'collection_open';
    else if (actualCost > estimatedCost && estimatedCost > 0) closeoutStatus = 'cost_variance_review';
    else closeoutStatus = 'profitability_closed';

    return {
      build: 318,
      job_id: jobId,
      job_code: job.job_code,
      job_name: job.job_name,
      client_name: job.client_name,
      service_pattern: job.service_pattern,
      closeout_status: closeoutStatus,
      estimated_revenue_total: Number(estimatedRevenue.toFixed(2)),
      estimated_cost_total: Number(estimatedCost.toFixed(2)),
      estimated_profit_total: Number(estimatedProfit.toFixed(2)),
      actual_revenue_total: Number(actualRevenue.toFixed(2)),
      invoiced_total: Number(invoiced.toFixed(2)),
      collected_total: Number(collected.toFixed(2)),
      outstanding_invoiced_total: Number(Math.max(0, invoiced - collected).toFixed(2)),
      labour_cost_total: Number(labour.toFixed(2)),
      material_cost_total: Number(material.toFixed(2)),
      equipment_cost_total: Number(equipment.toFixed(2)),
      fuel_cost_total: Number(fuel.toFixed(2)),
      travel_cost_total: Number(travel.toFixed(2)),
      subcontract_cost_total: Number(subcontract.toFixed(2)),
      disposal_cost_total: Number(disposal.toFixed(2)),
      rework_cost_total: Number(rework.toFixed(2)),
      other_cost_total: other,
      actual_cost_total: Number(actualCost.toFixed(2)),
      actual_profit_total: Number(actualProfit.toFixed(2)),
      actual_margin_percent: actualMargin,
      revenue_variance_total: Number((actualRevenue - estimatedRevenue).toFixed(2)),
      cost_variance_total: Number((actualCost - estimatedCost).toFixed(2)),
      profit_variance_total: Number((actualProfit - estimatedProfit).toFixed(2)),
      source_provenance: {
        labour_entry_count: Number(rollup.labor_entry_count || 0),
        financial_event_count: jobEvents.length,
        completion_review_count: jobReviews.length,
        submitted_execution_proof_count: submittedProofCount,
        approved_execution_proof_count: approvedProofCount,
        posted_invoice_count: jobPostingRows.length,
        payment_application_count: jobApplications.length
      },
      internal_only: true,
      posting_execution_authorized: false,
      provider_mutation: false
    };
  });
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
  if (!(await hasModuleAccess(supabase, actorProfile, 'jobs', 'view'))) return Response.json({ ok:false, error:'Jobs module view access is required.', module_key:'jobs', required_access:'view' }, { status:403, headers:corsHeaders });
  if (roleRank(actorRole) < roleRank('supervisor')) return Response.json({ ok:false, error:'Supervisor+ role is required for the full Jobs directory.' }, { status:403, headers:corsHeaders });
  const financeAllowed = await hasModuleAccess(supabase, actorProfile, 'finance', 'view');

  const { data: jobs } = await supabase.from('v_jobs_directory').select('*').order('start_date', { ascending: false });
  const { data: crews } = await supabase.from('v_crew_directory').select('*').order('crew_name');
  const { data: crewMembers } = await supabase.from('crew_members').select('*').order('created_at');
  const { data: profiles } = await supabase.from('profiles').select('id,full_name,email,role,is_active').eq('is_active', true).order('full_name');
  const { data: jobComments } = await supabase.from('v_job_comment_activity').select('*').order('created_at', { ascending:false }).limit(1000);
  const { data: jobCommentAttachmentsRaw } = await supabase.from('job_comment_attachments').select('*').order('created_at', { ascending:false }).limit(2000);
  const { data: equipment } = await supabase.from('v_equipment_directory').select('*').order('equipment_code');
  const equipmentRegistryV2 = await safeSelect(supabase, 'v_equipment_registry_v2', '*', (query) => query.order('equipment_code', { ascending:true }).limit(1500));
  const equipmentRegistryV2Summary = await safeSelect(supabase, 'v_equipment_registry_v2_summary');
  const { data: requirements } = await supabase.from('job_equipment_requirements').select('*').order('job_id');
  const { data: signouts } = await supabase.from('equipment_signouts').select('*, equipment_items(equipment_code,equipment_name), jobs(job_code,job_name)').order('checked_out_at', { ascending:false });
  const { data: pools } = await supabase.from('v_equipment_pool_availability').select('*').order('equipment_pool_key');
  const { data: notifications } = await supabase.from('v_admin_notifications').select('*').in('notification_type', ['equipment_reservation_conflict','job_approval_requested','equipment_checkout','equipment_arrival_verification','equipment_return','equipment_return_verified','equipment_return_exception','equipment_inspection','equipment_maintenance','equipment_lockout','equipment_lockout_cleared','account_identity_change_requested']).order('created_at', { ascending:false }).limit(150);
  const { data: servicePricingTemplates } = await supabase.from('service_pricing_templates').select('*').eq('is_active', true).order('template_name');
  const { data: taxCodes } = await supabase.from('tax_codes').select('*').eq('is_active', true).order('code');
  const { data: businessTaxSettings } = await supabase.from('business_tax_settings').select('*').order('profile_name');
  const estimateCommercial = await safeSelect(supabase, 'v_estimate_commercial_directory', '*', (query) => query.order('created_at', { ascending:false }).limit(1000));
  const estimateLines = await safeSelect(supabase, 'estimate_lines', '*', (query) => query.order('line_order', { ascending:true }).limit(3000));
  const workOrderCommercial = await safeSelect(supabase, 'v_work_order_commercial_directory', '*', (query) => query.order('scheduled_start', { ascending:false }).limit(1000));
  const workOrderLines = await safeSelect(supabase, 'work_order_lines', '*', (query) => query.order('line_order', { ascending:true }).limit(3000));
  const completionReviews = await safeSelect(supabase, 'v_job_completion_review_directory', '*', (query) => query.order('updated_at', { ascending:false }).limit(1000));
  const accountingReadyQueue = await safeSelect(supabase, 'v_job_accounting_ready_queue', '*', (query) => query.order('accounting_ready_at', { ascending:false }).limit(1000));
  const commercialApprovalEvents = await safeSelect(supabase, 'commercial_approval_events', '*', (query) => query.order('created_at', { ascending:false }).limit(1000));
  const quotePackages = await safeSelect(supabase, 'v_estimate_quote_package_directory', '*', (query) => query.order('updated_at', { ascending:false }).limit(1000));
  const approvalThresholds = await safeSelect(supabase, 'v_commercial_approval_threshold_directory', '*', (query) => query.order('updated_at', { ascending:false }).limit(1000));
  const workOrderReleaseReviews = await safeSelect(supabase, 'v_work_order_release_review_directory', '*', (query) => query.order('updated_at', { ascending:false }).limit(1000));
  const completionPackageItems = await safeSelect(supabase, 'v_job_completion_package_directory', '*', (query) => query.order('sort_order', { ascending:true }).limit(3000));
  const invoiceCandidates = await safeSelect(supabase, 'v_job_invoice_candidate_directory', '*', (query) => query.order('updated_at', { ascending:false }).limit(1000));
  const journalCandidates = await safeSelect(supabase, 'v_job_journal_candidate_directory', '*', (query) => query.order('updated_at', { ascending:false }).limit(1000));
  const arapReviewQueue = await safeSelect(supabase, 'v_job_ar_ap_review_queue_directory', '*', (query) => query.order('updated_at', { ascending:false }).limit(1000));
  const profitabilityScorecards = await safeSelect(supabase, 'v_job_profitability_scorecard_directory', '*', (query) => query.order('group_type', { ascending:true }).limit(1000));
  const quoteOutputRows = await safeSelect(supabase, 'v_quote_package_output_directory', '*', (query) => query.order('updated_at', { ascending:false }).limit(1000));
  const thresholdEvaluations = await safeSelect(supabase, 'v_work_order_threshold_evaluation_directory', '*', (query) => query.order('created_at', { ascending:false }).limit(2000));
  const closeoutEvidence = await safeSelect(supabase, 'v_job_closeout_evidence_directory', '*', (query) => query.order('created_at', { ascending:false }).limit(3000));
  const invoicePostingRules = await safeSelect(supabase, 'v_invoice_candidate_posting_rule_directory', '*', (query) => query.order('updated_at', { ascending:false }).limit(1000));
  const journalPostingRules = await safeSelect(supabase, 'v_journal_candidate_posting_rule_directory', '*', (query) => query.order('updated_at', { ascending:false }).limit(1000));
  const accountantHandoffExports = await safeSelect(supabase, 'v_accountant_handoff_export_directory', '*', (query) => query.order('updated_at', { ascending:false }).limit(1000));
  const profitabilityVariance = await safeSelect(supabase, 'v_job_profitability_variance_directory', '*', (query) => query.order('group_type', { ascending:true }).limit(2000));
  const completionSignoffs = await safeSelect(supabase, 'v_job_completion_signoff_directory', '*', (query) => query.order('sort_order', { ascending:true }).limit(3000));
  const invoicePostings = await safeSelect(supabase, 'v_job_invoice_posting_directory', '*', (query) => query.order('updated_at', { ascending:false }).limit(1000));
  const jobInvoicePostingLinks = await safeSelect(supabase, 'job_invoice_postings', 'id,invoice_candidate_id,ar_invoice_id,posting_status,posted_at,updated_at', (query) => query.order('updated_at', { ascending:false }).limit(1000));
  const jobProfitabilityEvents = await safeSelect(supabase, 'job_financial_events', 'id,job_id,event_type,cost_category,cost_amount,revenue_amount,billable_charge_status,posting_status,reference_number,notes,event_date', (query) => query.order('event_date', { ascending:false }).limit(4000));
  const jobExecutionCostDashboard = await safeSelect(supabase, 'v_work_order_execution_cost_dashboard', '*', (query) => query.order('scheduled_start', { ascending:false }).limit(2000));
  const journalPostings = await safeSelect(supabase, 'v_job_journal_posting_directory', '*', (query) => query.order('updated_at', { ascending:false }).limit(1000));
  const profitabilityManagement = await safeSelect(supabase, 'v_job_profitability_management_scorecard_directory', '*', (query) => query.order('group_type', { ascending:true }).limit(2000));
  const quoteEngagement = await safeSelect(supabase, 'v_quote_package_engagement_directory', '*', (query) => query.order('updated_at', { ascending:false }).limit(1000));
  const releaseEnforcement = await safeSelect(supabase, 'v_work_order_release_enforcement_directory', '*', (query) => query.order('updated_at', { ascending:false }).limit(1000));
  const completionReadiness = await safeSelect(supabase, 'v_job_completion_readiness_directory', '*', (query) => query.order('updated_at', { ascending:false }).limit(1000));
  const accountingLifecycle = await safeSelect(supabase, 'v_job_accounting_lifecycle_directory', '*', (query) => query.order('created_at', { ascending:false }).limit(2000));
  const invoicePostingAutomation = await safeSelect(supabase, 'v_job_invoice_posting_automation_directory', '*', (query) => query.order('updated_at', { ascending:false }).limit(1000));
  const journalPostingAutomation = await safeSelect(supabase, 'v_job_journal_posting_automation_directory', '*', (query) => query.order('updated_at', { ascending:false }).limit(1000));
  const accountantBundles = await safeSelect(supabase, 'v_accountant_handoff_bundle_directory', '*', (query) => query.order('updated_at', { ascending:false }).limit(1000));
  const accountantPackages = await safeSelect(supabase, 'v_accountant_handoff_package_directory', '*', (query) => query.order('updated_at', { ascending:false }).limit(1000));
  const arPaymentApplications = await safeSelect(supabase, 'v_ar_payment_application_directory', '*', (query) => query.order('application_date', { ascending:false }).limit(1000));
  const apPaymentApplications = await safeSelect(supabase, 'v_ap_payment_application_directory', '*', (query) => query.order('application_date', { ascending:false }).limit(1000));
  const journalGeneratedLines = await safeSelect(supabase, 'v_gl_journal_generated_line_directory', '*', (query) => query.order('line_sort', { ascending:true }).limit(4000));
  const salesTaxReview = await safeSelect(supabase, 'v_sales_tax_filing_review_directory', '*', (query) => query.order('filing_period_end', { ascending:false }).limit(500));
  const payrollRemittanceReview = await safeSelect(supabase, 'v_payroll_remittance_review_directory', '*', (query) => query.order('remittance_period_end', { ascending:false }).limit(500));
  const bankReconciliationMatchScored = await safeSelect(supabase, 'v_bank_reconciliation_match_scored_directory', '*', (query) => query.order('match_score', { ascending:false }).limit(1000));
  const jobCostDepth = await safeSelect(supabase, 'v_job_cost_depth_directory', '*', (query) => query.order('job_id', { ascending:false }).limit(2000));
  const paymentApplicationWorkbench = await safeSelect(supabase, 'v_payment_application_workbench_directory', '*', (query) => query.order('application_date', { ascending:false }).limit(1000));
  const bankReconciliationReviewWorkbench = await safeSelect(supabase, 'v_bank_reconciliation_review_workbench', '*', (query) => query.order('item_date', { ascending:false }).limit(1000));
  const remittanceFilingReviewWorkbench = await safeSelect(supabase, 'v_remittance_filing_review_workbench', '*', (query) => query.order('period_end', { ascending:false }).limit(1000));
  const monthEndCloseWorkbench = await safeSelect(supabase, 'v_month_end_close_workbench', '*', (query) => query.order('period_end', { ascending:false }).limit(500));
  const equipmentAccountability = await safeSelect(supabase, 'v_equipment_accountability_workbench', '*', (query) => query.order('equipment_code', { ascending:true }).limit(1000));
  const equipmentServiceTasks = await safeSelect(supabase, 'v_equipment_service_task_directory', '*', (query) => query.order('created_at', { ascending:false }).limit(1000));
  const jobSessions = await safeSelect(supabase, 'v_job_session_directory', '*', (query) => query.order('started_at', { ascending:false }).limit(2000));
  const jobCrewHours = await safeSelect(supabase, 'v_job_crew_hours_directory', '*', (query) => query.order('created_at', { ascending:false }).limit(3000));
  const jobReassignments = await safeSelect(supabase, 'v_job_reassignment_directory', '*', (query) => query.order('started_at', { ascending:false }).limit(1000));
  const jobFinancialEvents = await safeSelect(supabase, 'v_job_financial_event_directory', '*', (query) => query.order('event_date', { ascending:false }).limit(2000));
  const jobFinancialRollups = await safeSelect(supabase, 'v_job_financial_rollups', '*', (query) => query.order('job_id', { ascending:true }).limit(2000));
  const equipmentTransferVerifications = await safeSelect(supabase, 'v_equipment_transfer_verification_directory', '*', (query) => query.order('created_at', { ascending:false }).limit(1000));
  const equipmentReturnExceptions = await safeSelect(supabase, 'v_equipment_return_exception_directory', '*', (query) => query.order('checked_out_at', { ascending:false }).limit(500));
  const operationalDepthGates = await safeSelect(supabase, 'v_app_operational_depth_gates', '*', (query) => query.order('sort_order', { ascending:true }).limit(200));
  const dailyInspectionTemplates = await safeSelect(supabase, 'v_equipment_daily_inspection_templates', '*', (query) => query.order('template_code', { ascending:true }).limit(500));
  const dailyInspectionWorkbench = await safeSelect(supabase, 'v_equipment_daily_inspection_workbench', '*', (query) => query.order('inspected_at', { ascending:false }).limit(1000));
  const dailyInspectionSummary = await safeSelect(supabase, 'v_equipment_daily_inspection_summary', '*', (query) => query.limit(1));
  const fleetVehicleOperations = await safeSelect(supabase, 'v_fleet_vehicle_operations', '*', (query) => query.order('equipment_code', { ascending:true }).limit(1000));
  const fleetOperationsSummary = await safeSelect(supabase, 'v_fleet_operations_summary', '*', (query) => query.limit(1));
  const fleetTowingAssignments = await safeSelect(supabase, 'v_fleet_towing_assignment_directory', '*', (query) => query.order('assigned_at', { ascending:false }).limit(1000));
  const preventiveMaintenanceWorkbench = await safeSelect(supabase, 'v_preventive_maintenance_workbench', '*', (query) => query.order('due_status', { ascending:true }).order('equipment_code', { ascending:true }).limit(1500));
  const preventiveMaintenanceSummary = await safeSelect(supabase, 'v_preventive_maintenance_summary', '*', (query) => query.limit(1));
  const { data: inspections } = await supabase.from('v_equipment_inspection_history').select('*').order('inspected_at', { ascending:false }).limit(200);
  const { data: maintenance } = await supabase.from('v_equipment_maintenance_history').select('*').order('performed_at', { ascending:false }).limit(200);
  const { data: evidenceAssetsRaw } = await supabase.from('equipment_evidence_assets').select('*').order('created_at', { ascending:false }).limit(1000);

  const evidenceAssets = await Promise.all((evidenceAssetsRaw || []).map(async (row: any) => {
    let preview_url = row.preview_url || null;
    if (!preview_url && row.storage_bucket && row.storage_path) {
      const { data } = await supabase.storage.from(row.storage_bucket).createSignedUrl(row.storage_path, 60 * 60 * 24 * 7);
      preview_url = data?.signedUrl || null;
    }
    return { ...row, preview_url, public_url: preview_url || row.preview_url || null };
  }));

  const jobCommentAttachments = await Promise.all((jobCommentAttachmentsRaw || []).map(async (row: any) => {
    let preview_url = row.preview_url || null;
    if (!preview_url && row.storage_bucket && row.storage_path) {
      const { data } = await supabase.storage.from(row.storage_bucket).createSignedUrl(row.storage_path, 60 * 60 * 24 * 7);
      preview_url = data?.signedUrl || null;
    }
    return { ...row, preview_url, public_url: preview_url || row.preview_url || null };
  }));

  const registryV2ById = new Map<number, any>();
  for (const row of equipmentRegistryV2 || []) {
    const id=Number(row?.id || 0);
    if(id) registryV2ById.set(id,row);
  }
  const equipmentRows=(equipment || []).map((row:any)=>({
    ...row,
    ...(registryV2ById.get(Number(row?.id || 0)) || {})
  }));

  const evidenceBySignout = new Map<number, any[]>();
  for (const row of evidenceAssets) {
    const key = Number(row.signout_id || 0);
    if (!key) continue;
    const list = evidenceBySignout.get(key) || [];
    list.push(row);
    evidenceBySignout.set(key, list);
  }

  const attachmentsByComment = new Map<string, any[]>();
  for (const row of jobCommentAttachments) {
    const key = String(row.comment_id || '');
    if (!key) continue;
    const list = attachmentsByComment.get(key) || [];
    list.push(row);
    attachmentsByComment.set(key, list);
  }

  const signoutRows = (signouts || []).map((row: any) => {
    const assets = evidenceBySignout.get(Number(row.id)) || [];
    const checkoutAssets = assets.filter((asset) => asset.stage === 'checkout');
    const returnAssets = assets.filter((asset) => asset.stage === 'return');
    const signatureAssets = assets.filter((asset) => asset.evidence_kind === 'signature');
    return {
      ...row,
      equipment_code: row.equipment_items?.equipment_code || null,
      equipment_name: row.equipment_items?.equipment_name || null,
      job_code: row.jobs?.job_code || null,
      job_name: row.jobs?.job_name || null,
      has_checkout_signatures: !!(signatureAssets.find((asset) => asset.stage === 'checkout') || row.checkout_worker_signature_name || row.checkout_supervisor_signature_name || row.checkout_admin_signature_name),
      has_return_signatures: !!(signatureAssets.find((asset) => asset.stage === 'return') || row.return_worker_signature_name || row.return_supervisor_signature_name || row.return_admin_signature_name),
      checkout_photo_count: checkoutAssets.filter((asset) => asset.evidence_kind === 'photo').length,
      return_photo_count: returnAssets.filter((asset) => asset.evidence_kind === 'photo').length,
      signature_asset_count: signatureAssets.length,
      damage_reported: !!row.damage_reported,
      damage_notes: row.damage_notes || '',
      evidence_assets: assets,
    };
  });

  const commentRows = (jobComments || []).map((row: any) => ({
    ...row,
    attachments: attachmentsByComment.get(String(row.id || '')) || []
  }));

  const financeRedactions = financeAllowed ? {} : {
    service_pricing_templates:[], tax_codes:[], business_tax_settings:[], estimates:[], estimate_lines:[], work_orders:[], work_order_lines:[],
    job_accounting_ready_queue:[], commercial_approval_events:[], quote_packages:[], commercial_approval_thresholds:[], invoice_candidates:[], journal_candidates:[],
    ar_ap_review_queue:[], profitability_scorecards:[], quote_output_rows:[], threshold_evaluations:[], invoice_posting_rules:[], journal_posting_rules:[],
    accountant_handoff_exports:[], profitability_variance:[], invoice_postings:[], journal_postings:[], profitability_management:[], quote_package_engagement:[],
    accounting_lifecycle:[], invoice_posting_automation:[], journal_posting_automation:[], accountant_handoff_bundles:[], accountant_packages:[],
    ar_payment_applications:[], ap_payment_applications:[], journal_generated_lines:[], sales_tax_review:[], payroll_remittance_review:[], bank_reconciliation_match_scored:[],
    job_cost_depth:[], job_profitability_closeout:[], payment_application_workbench:[], bank_reconciliation_review_workbench:[], remittance_filing_review_workbench:[], month_end_close_workbench:[],
    job_financial_events:[], job_financial_rollups:[]
  };

  const jobProfitabilityCloseout = buildJobProfitabilityCloseout({
    jobs: jobs || [],
    rollups: jobFinancialRollups || [],
    depthRows: jobCostDepth || [],
    events: jobProfitabilityEvents || [],
    reviews: completionReviews || [],
    invoiceCandidates: invoiceCandidates || [],
    invoicePostings: invoicePostings || [],
    invoicePostingLinks: jobInvoicePostingLinks || [],
    paymentApplications: arPaymentApplications || [],
    executionCosts: jobExecutionCostDashboard || []
  });

  return Response.json({
    ok:true,
    module_access:{ jobs:'view', finance: financeAllowed ? 'view_or_higher' : 'hidden' },
    jobs: jobs || [],
    crews: crews || [],
    crew_members: crewMembers || [],
    profiles: profiles || [],
    job_comments: commentRows,
    job_comment_attachments: jobCommentAttachments,
    job_sessions: jobSessions || [],
    job_crew_hours: jobCrewHours || [],
    job_reassignments: jobReassignments || [],
    job_financial_events: jobFinancialEvents || [],
    job_financial_rollups: jobFinancialRollups || [],
    equipment: equipmentRows,
    equipment_registry_v2: equipmentRegistryV2 || [],
    equipment_registry_v2_summary: equipmentRegistryV2Summary || [],
    equipment_daily_inspection_templates: dailyInspectionTemplates || [],
    equipment_daily_inspection_workbench: dailyInspectionWorkbench || [],
    equipment_daily_inspection_summary: dailyInspectionSummary || [],
    fleet_vehicle_operations: fleetVehicleOperations || [],
    fleet_operations_summary: fleetOperationsSummary || [],
    fleet_towing_assignments: fleetTowingAssignments || [],
    preventive_maintenance_workbench: preventiveMaintenanceWorkbench || [],
    preventive_maintenance_summary: preventiveMaintenanceSummary || [],
    requirements: requirements || [],
    signouts: signoutRows,
    equipment_transfer_verifications: equipmentTransferVerifications || [],
    equipment_return_exceptions: equipmentReturnExceptions || [],
    operational_depth_gates: operationalDepthGates || [],
    pools: pools || [],
    notifications: notifications || [],
    inspections: inspections || [],
    maintenance: maintenance || [],
    service_pricing_templates: servicePricingTemplates || [],
    tax_codes: taxCodes || [],
    business_tax_settings: businessTaxSettings || [],
    estimates: estimateCommercial || [],
    estimate_lines: estimateLines || [],
    work_orders: workOrderCommercial || [],
    work_order_lines: workOrderLines || [],
    job_completion_reviews: completionReviews || [],
    job_accounting_ready_queue: accountingReadyQueue || [],
    commercial_approval_events: commercialApprovalEvents || [],
    quote_packages: quotePackages || [],
    commercial_approval_thresholds: approvalThresholds || [],
    work_order_release_reviews: workOrderReleaseReviews || [],
    completion_package_items: completionPackageItems || [],
    invoice_candidates: invoiceCandidates || [],
    journal_candidates: journalCandidates || [],
    ar_ap_review_queue: arapReviewQueue || [],
    profitability_scorecards: profitabilityScorecards || [],
    quote_output_rows: quoteOutputRows || [],
    threshold_evaluations: thresholdEvaluations || [],
    closeout_evidence: closeoutEvidence || [],
    invoice_posting_rules: invoicePostingRules || [],
    journal_posting_rules: journalPostingRules || [],
    accountant_handoff_exports: accountantHandoffExports || [],
    profitability_variance: profitabilityVariance || [],
    completion_signoff_steps: completionSignoffs || [],
    invoice_postings: invoicePostings || [],
    journal_postings: journalPostings || [],
    profitability_management: profitabilityManagement || [],
    quote_package_engagement: quoteEngagement || [],
    release_enforcement: releaseEnforcement || [],
    completion_readiness: completionReadiness || [],
    accounting_lifecycle: accountingLifecycle || [],
    invoice_posting_automation: invoicePostingAutomation || [],
    journal_posting_automation: journalPostingAutomation || [],
    accountant_handoff_bundles: accountantBundles || [],
    accountant_packages: accountantPackages || [],
    ar_payment_applications: arPaymentApplications || [],
    ap_payment_applications: apPaymentApplications || [],
    journal_generated_lines: journalGeneratedLines || [],
    sales_tax_review: salesTaxReview || [],
    payroll_remittance_review: payrollRemittanceReview || [],
    bank_reconciliation_match_scored: bankReconciliationMatchScored || [],
    job_cost_depth: jobCostDepth || [],
    job_profitability_closeout: jobProfitabilityCloseout,
    payment_application_workbench: paymentApplicationWorkbench || [],
    bank_reconciliation_review_workbench: bankReconciliationReviewWorkbench || [],
    remittance_filing_review_workbench: remittanceFilingReviewWorkbench || [],
    month_end_close_workbench: monthEndCloseWorkbench || [],
    equipment_accountability: equipmentAccountability || [],
    equipment_service_tasks: equipmentServiceTasks || [],
    evidence_assets: evidenceAssets,
    ...financeRedactions
  }, { headers: corsHeaders });
});
