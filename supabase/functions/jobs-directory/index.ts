// Detailed Edge Function: jobs-directory
// Purpose:
// - Return jobs, crews, comments, equipment, signouts, notifications, and pool availability
// - Include signed URLs for equipment evidence and job comment photo attachments

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

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const supabase = createClient((Deno.env.get('SB_URL') || Deno.env.get('SUPABASE_URL'))!, (Deno.env.get('SB_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'))!);
  const token = (req.headers.get('Authorization') ?? '').replace('Bearer ', '');
  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData.user) return Response.json({ ok:false, error:'Unauthorized' }, { status:401, headers:corsHeaders });
  const { data: actorProfile } = await supabase.from('profiles').select('*').eq('id', userData.user.id).single();
  const actorRole = effectiveRole(actorProfile, userData.user);
  if (!actorProfile?.is_active || roleRank(actorRole) < roleRank('supervisor')) return Response.json({ ok:false, error:'Supervisor+ required' }, { status:403, headers:corsHeaders });

  const { data: jobs } = await supabase.from('v_jobs_directory').select('*').order('start_date', { ascending: false });
  const { data: crews } = await supabase.from('v_crew_directory').select('*').order('crew_name');
  const { data: crewMembers } = await supabase.from('crew_members').select('*').order('created_at');
  const { data: profiles } = await supabase.from('profiles').select('id,full_name,email,role,is_active').eq('is_active', true).order('full_name');
  const { data: jobComments } = await supabase.from('v_job_comment_activity').select('*').order('created_at', { ascending:false }).limit(1000);
  const { data: jobCommentAttachmentsRaw } = await supabase.from('job_comment_attachments').select('*').order('created_at', { ascending:false }).limit(2000);
  const { data: equipment } = await supabase.from('v_equipment_directory').select('*').order('equipment_code');
  const { data: requirements } = await supabase.from('job_equipment_requirements').select('*').order('job_id');
  const { data: signouts } = await supabase.from('equipment_signouts').select('*, equipment_items(equipment_code,equipment_name), jobs(job_code,job_name)').order('checked_out_at', { ascending:false });
  const { data: pools } = await supabase.from('v_equipment_pool_availability').select('*').order('equipment_pool_key');
  const { data: notifications } = await supabase.from('v_admin_notifications').select('*').in('notification_type', ['equipment_reservation_conflict','job_approval_requested','equipment_checkout','equipment_return','equipment_inspection','equipment_maintenance','equipment_lockout','equipment_lockout_cleared','account_identity_change_requested']).order('created_at', { ascending:false }).limit(150);
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
  const journalPostings = await safeSelect(supabase, 'v_job_journal_posting_directory', '*', (query) => query.order('updated_at', { ascending:false }).limit(1000));
  const profitabilityManagement = await safeSelect(supabase, 'v_job_profitability_management_scorecard_directory', '*', (query) => query.order('group_type', { ascending:true }).limit(2000));
  const jobSessions = await safeSelect(supabase, 'v_job_session_directory', '*', (query) => query.order('started_at', { ascending:false }).limit(2000));
  const jobCrewHours = await safeSelect(supabase, 'v_job_crew_hours_directory', '*', (query) => query.order('created_at', { ascending:false }).limit(3000));
  const jobReassignments = await safeSelect(supabase, 'v_job_reassignment_directory', '*', (query) => query.order('started_at', { ascending:false }).limit(1000));
  const jobFinancialEvents = await safeSelect(supabase, 'v_job_financial_event_directory', '*', (query) => query.order('event_date', { ascending:false }).limit(2000));
  const jobFinancialRollups = await safeSelect(supabase, 'v_job_financial_rollups', '*', (query) => query.order('job_id', { ascending:true }).limit(2000));
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

  return Response.json({
    ok:true,
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
    equipment: equipment || [],
    requirements: requirements || [],
    signouts: signoutRows,
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
    evidence_assets: evidenceAssets
  }, { headers: corsHeaders });
});
