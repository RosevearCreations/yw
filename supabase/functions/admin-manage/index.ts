// Detailed Edge Function: admin-manage
// Purpose:
// - Admin CRUD for profiles/sites/assignments
// - Self profile updates for employee contact/preferences fields
// - Resolve supervisor/admin name fields to profile ids for hierarchy management
// - Admin approval / dismissal actions for notifications

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};


function normalizeRole(role?: string | null) {
  const clean = String(role || 'employee').trim().toLowerCase() || 'employee';
  if (clean === 'worker' || clean === 'staff') return 'employee';
  return clean;
}

function roleRank(role: string) {
  return { employee:10, worker:10, staff:10, onsite_admin:18, site_leader:20, supervisor:30, hse:40, job_admin:45, admin:50 }[normalizeRole(role)] ?? 0;
}

function addMonthsToDate(baseDate?: string | null, months?: number | null) {
  const clean = String(baseDate || '').trim();
  const count = Number(months || 0);
  if (!clean || !Number.isFinite(count) || count <= 0) return null;
  const d = new Date(`${clean}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  d.setUTCMonth(d.getUTCMonth() + count);
  return d.toISOString().slice(0, 10);
}


async function updateDeliveryState(supabase: any, notificationId: any, kind: 'email' | 'sms', provider: string, ok: boolean, errorText = '') {
  if (!notificationId) return;
  const countField = kind === 'sms' ? 'sms_attempt_count' : 'email_attempt_count';
  const providerField = kind === 'sms' ? 'sms_provider' : 'email_provider';
  const attemptField = kind === 'sms' ? 'sms_last_attempt_at' : 'email_last_attempt_at';
  const { data: current } = await supabase.from('admin_notifications').select(`id,${countField}`).eq('id', notificationId).maybeSingle();
  const attemptCount = Number(current?.[countField] || 0) + 1;
  const patch: Record<string, unknown> = {
    [countField]: attemptCount,
    [providerField]: provider,
    [attemptField]: new Date().toISOString(),
  };
  if (kind === 'email') {
    patch.email_status = ok ? 'sent' : 'failed';
    patch.email_error = ok ? null : String(errorText || '');
  }
  if (!ok && attemptCount >= 3) {
    patch.dead_lettered_at = new Date().toISOString();
    patch.dead_letter_reason = `${kind}:${String(errorText || 'delivery failed')}`;
    patch.status = 'dead_letter';
  }
  await supabase.from('admin_notifications').update(patch).eq('id', notificationId);
}

async function sendEmailIfConfigured(row: any, overrides: Record<string, unknown> = {}) {
  const apiKey = Deno.env.get('RESEND_API_KEY');
  const from = Deno.env.get('RESEND_FROM_EMAIL') || Deno.env.get('EMAIL_FROM');
  const to = String(overrides.email_to || row?.email_to || Deno.env.get('ADMIN_NOTIFICATION_TO') || '').trim();
  if (!apiKey || !from || !to) return { attempted: false, status: 'pending', error: '' };
  const subject = String(overrides.email_subject || row?.email_subject || row?.title || 'YWI HSE notification');
  const text = String(overrides.body || row?.body || row?.message || JSON.stringify(row?.payload || {}));
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      from,
      to: to.split(/[;,]/).map((v) => v.trim()).filter(Boolean),
      subject,
      text,
    })
  });
  const body = await res.text();
  if (!res.ok) throw new Error(body);
  return { attempted: true, status: 'sent', error: '' };
}

async function resolveProfileIdByNameOrEmail(supabase: any, value?: string | null) {
  const clean = String(value || '').trim();
  if (!clean) return null;
  let { data } = await supabase.from('profiles').select('id').ilike('email', clean).limit(1).maybeSingle();
  if (data?.id) return data.id;
  ({ data } = await supabase.from('profiles').select('id').ilike('full_name', clean).limit(1).maybeSingle());
  return data?.id || null;
}


async function resolveProfileByIdOrEmail(supabase: any, profileId?: string | null, email?: string | null) {
  const cleanId = String(profileId || '').trim();
  if (cleanId) {
    const { data } = await supabase.from('profiles').select('*').eq('id', cleanId).maybeSingle();
    if (data) return data;
  }
  const cleanEmail = String(email || '').trim().toLowerCase();
  if (cleanEmail) {
    const { data } = await supabase.from('profiles').select('*').ilike('email', cleanEmail).maybeSingle();
    if (data) return data;
  }
  return null;
}

function getCatalogConfig(catalogType: string) {
  const key = String(catalogType || '').trim().toLowerCase();
  const map: Record<string, { table: string; nameColumn: string }> = {
    position: { table: 'position_catalog', nameColumn: 'name' },
    trade: { table: 'trade_catalog', nameColumn: 'name' },
    staff_tier: { table: 'staff_tier_catalog', nameColumn: 'name' },
    seniority: { table: 'seniority_level_catalog', nameColumn: 'name' },
    employment_status: { table: 'employment_status_catalog', nameColumn: 'name' },
    job_type: { table: 'job_type_catalog', nameColumn: 'name' },
    tax_code: { table: 'tax_codes', nameColumn: 'name' },
    service_pricing_template: { table: 'service_pricing_templates', nameColumn: 'template_name' },
  };
  return map[key] || null;
}


function asNumber(value: unknown, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function asNullableNumber(value: unknown) {
  if (value === null || value === undefined || String(value).trim() === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function asNullableText(value: unknown) {
  const clean = String(value ?? '').trim();
  return clean ? clean : null;
}

function asNullableBool(value: unknown) {
  return value === undefined ? null : !!value;
}

function asNullableDate(value: unknown) {
  const clean = String(value ?? '').trim();
  return clean ? clean : null;
}

function asNullableDateTime(value: unknown) {
  const clean = String(value ?? '').trim();
  return clean ? clean : null;
}

async function getCostCodeIdByCode(supabase: any, code: string) {
  const clean = String(code || '').trim().toUpperCase();
  if (!clean) return null;
  const { data } = await supabase.from('cost_codes').select('id').eq('code', clean).maybeSingle();
  return data?.id || null;
}

async function getMaterialDefaults(supabase: any, materialId?: string | null) {
  const id = String(materialId || '').trim();
  if (!id) return null;
  const { data } = await supabase.from('materials_catalog').select('id,item_name,unit_id,default_unit_cost,default_bill_rate').eq('id', id).maybeSingle();
  return data || null;
}

async function getEquipmentDefaults(supabase: any, equipmentId?: string | null) {
  const id = String(equipmentId || '').trim();
  if (!id) return null;
  const { data } = await supabase.from('equipment_master').select('id,item_name,cost_rate_hourly,bill_rate_hourly').eq('id', id).maybeSingle();
  return data || null;
}

async function getWorkOrderLineDefaults(supabase: any, workOrderLineId?: string | null) {
  const id = String(workOrderLineId || '').trim();
  if (!id) return null;
  const { data } = await supabase.from('work_order_lines').select('id,work_order_id,description,unit_id,unit_cost,unit_price,cost_code_id,material_id').eq('id', id).maybeSingle();
  return data || null;
}

async function getRouteStopDefaults(supabase: any, routeStopId?: string | null) {
  const id = String(routeStopId || '').trim();
  if (!id) return null;
  const { data } = await supabase.from('route_stops').select('id,route_id,client_site_id,stop_order,instructions').eq('id', id).maybeSingle();
  return data || null;
}

async function getLinkedHsePacketDefaults(supabase: any, packetId?: string | null) {
  const id = String(packetId || '').trim();
  if (!id) return null;
  const { data } = await supabase.from('linked_hse_packets').select('id,job_id,work_order_id,dispatch_id,client_site_id,route_id,equipment_master_id,supervisor_profile_id,packet_number').eq('id', id).maybeSingle();
  return data || null;
}

async function recordSiteActivity(supabase: any, payload: any) {
  try {
    await supabase.from('site_activity_events').insert({
      event_type: payload.event_type,
      entity_type: payload.entity_type,
      entity_id: payload.entity_id != null ? String(payload.entity_id) : null,
      severity: payload.severity || 'info',
      title: payload.title || 'Activity recorded',
      summary: payload.summary || null,
      metadata: payload.metadata || {},
      related_job_id: payload.related_job_id || null,
      related_profile_id: payload.related_profile_id || null,
      related_equipment_id: payload.related_equipment_id || null,
      created_by_profile_id: payload.created_by_profile_id || null,
      occurred_at: payload.occurred_at || new Date().toISOString(),
    });
  } catch {
    // ignore activity audit failures so the main workflow still succeeds
  }
}


function makeDocumentNumber(prefix: string) {
  const stamp = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 12);
  return `${prefix}-${stamp}`;
}

function escHtml(value: unknown) {
  return String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}

function money(value: unknown) {
  const num = Number(value || 0);
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(Number.isFinite(num) ? num : 0);
}

function makeContractHtml(opts: { title: string; subtitle?: string | null; sections?: Array<{ heading: string; body: string }>; footer?: string | null; }) {
  const sections = Array.isArray(opts.sections) ? opts.sections : [];
  return `<!doctype html>
<html><head><meta charset="utf-8" /><title>${escHtml(opts.title)}</title>
<style>body{font-family:Arial,sans-serif;color:#1f2937;padding:32px;line-height:1.5}h1{font-size:28px;margin:0 0 6px}h2{font-size:18px;margin:22px 0 8px}.meta{color:#4b5563;margin-bottom:20px}.box{border:1px solid #d1d5db;border-radius:10px;padding:14px 16px;margin-bottom:14px}.footer{margin-top:24px;color:#6b7280;font-size:12px}</style></head><body>
<h1>${escHtml(opts.title)}</h1>${opts.subtitle ? `<div class="meta">${escHtml(opts.subtitle)}</div>` : ''}
${sections.map((section) => `<section class="box"><h2>${escHtml(section.heading)}</h2><div>${section.body}</div></section>`).join('')}
${opts.footer ? `<div class="footer">${escHtml(opts.footer)}</div>` : ''}
</body></html>`;
}

function buildPayrollCsv(rows: any[] = []) {
  const headers = ['Employee Number','Employee Name','Job Code','Job Name','Session Date','Regular Hours','Overtime Hours','Hours Worked','Payroll Cost Total'];
  const lines = [headers.join(',')];
  for (const row of rows) {
    const values = [
      row?.employee_number || '',
      row?.full_name || '',
      row?.job_code || '',
      row?.job_name || '',
      row?.session_date || '',
      row?.regular_hours || 0,
      row?.overtime_hours || 0,
      row?.hours_worked || 0,
      row?.payroll_cost_total || 0,
    ].map((value) => `"${String(value ?? '').replaceAll('"', '""')}"`);
    lines.push(values.join(','));
  }
  return lines.join('\n');
}

async function fetchSingle(supabase: any, table: string, id: any) {
  if (!id) return null;
  const { data } = await supabase.from(table).select('*').eq('id', id).maybeSingle();
  return data || null;
}

function validateAdminSetPassword(password?: string | null) {
  const clean = String(password || '');
  if (!clean) throw new Error('A new password is required.');
  if (clean.length < 10) throw new Error('Password must be at least 10 characters long.');
  if (!/[A-Z]/.test(clean) || !/[a-z]/.test(clean) || !/[0-9]/.test(clean)) {
    throw new Error('Password must include upper, lower, and number characters.');
  }
  return clean;
}



function normalizePayrollExportProvider(provider?: string | null) {
  const clean = String(provider || 'generic_csv').trim().toLowerCase();
  if (clean === 'quickbooks_time_csv') return 'quickbooks_time';
  if (clean === 'simplepay_csv') return 'simplepay';
  if (clean === 'adp_csv') return 'adp';
  return clean || 'generic_csv';
}

function computeSchedulerNextRunAt(setting: any, base = new Date()) {
  const cadence = String(setting?.cadence || 'manual').trim().toLowerCase();
  if (!setting?.is_enabled || cadence === 'manual') return null;
  const next = new Date(base.getTime());
  if (cadence === 'hourly') {
    next.setMinutes(0, 0, 0);
    next.setHours(next.getHours() + 1);
    return next.toISOString();
  }
  const hour = Math.max(0, Math.min(23, Number(setting?.run_hour_local ?? 0) || 0));
  const minute = Math.max(0, Math.min(59, Number(setting?.run_minute_local ?? 0) || 0));
  next.setSeconds(0, 0);
  next.setHours(hour, minute, 0, 0);
  if (cadence === 'weekly') {
    if (next <= base) next.setDate(next.getDate() + 7);
    return next.toISOString();
  }
  if (next <= base) next.setDate(next.getDate() + 1);
  return next.toISOString();
}

async function upsertMediaReviewAction(supabase: any, payload: { target_entity: string; target_id: string; media_stage?: string | null; review_status: string; review_notes?: string | null; reviewed_by_profile_id?: string | null; created_by_profile_id?: string | null; }) {
  const patch = {
    target_entity: payload.target_entity,
    target_id: payload.target_id,
    media_stage: String(payload.media_stage || 'evidence').trim() || 'evidence',
    review_status: String(payload.review_status || 'pending').trim() || 'pending',
    review_notes: payload.review_notes || null,
    reviewed_at: new Date().toISOString(),
    reviewed_by_profile_id: payload.reviewed_by_profile_id || null,
    created_by_profile_id: payload.created_by_profile_id || null,
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await supabase.from('media_review_actions').upsert(patch, { onConflict: 'target_entity,target_id,media_stage' }).select('*').single();
  if (error) throw error;
  return data;
}

function makeSlugCode(prefix: string, base: unknown) {
  const clean = String(base || '').trim().replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '').toUpperCase();
  return `${prefix}-${clean || crypto.randomUUID().slice(0, 8).toUpperCase()}`;
}

function pickSuggestedFirstSessionDate(contract: any, agreement: any) {
  const base = String(agreement?.start_date || contract?.effective_date || '').trim();
  const today = new Date().toISOString().slice(0, 10);
  if (!base) return today;
  return base >= today ? base : today;
}

function buildPayrollExportContent(rows: any[] = [], provider = 'generic_csv', format = 'csv') {
  const safeRows = Array.isArray(rows) ? rows : [];
  const safeProvider = normalizePayrollExportProvider(provider);
  const safeFormat = String(format || 'csv').trim().toLowerCase();

  const csvEscape = (value: unknown) => `"${String(value ?? '').replaceAll('"', '""')}"`;
  const makeCsv = (headers: string[], mapper: (row: any) => unknown[]) => {
    const lines = [headers.map(csvEscape).join(',')];
    for (const row of safeRows) {
      lines.push(mapper(row).map(csvEscape).join(','));
    }
    return lines.join('\n');
  };

  if (safeFormat === 'json' || safeProvider === 'json') {
    return {
      fileName: 'payroll-export.json',
      mimeType: 'application/json',
      content: JSON.stringify(safeRows, null, 2),
    };
  }

  if (safeProvider === 'quickbooks_time') {
    return {
      fileName: 'quickbooks-time-export.csv',
      mimeType: 'text/csv',
      content: makeCsv(
        ['Employee Number','Employee Name','Job Code','Date','Hours Worked'],
        (row) => [
          row?.employee_number || '',
          row?.full_name || '',
          row?.job_code || '',
          row?.session_date || '',
          row?.hours_worked || 0,
        ],
      ),
    };
  }

  if (safeProvider === 'simplepay') {
    return {
      fileName: 'simplepay-export.csv',
      mimeType: 'text/csv',
      content: makeCsv(
        ['Employee Number','Employee Name','Regular Hours','Overtime Hours'],
        (row) => [
          row?.employee_number || '',
          row?.full_name || '',
          row?.regular_hours || 0,
          row?.overtime_hours || 0,
        ],
      ),
    };
  }

  if (safeProvider === 'adp') {
    return {
      fileName: 'adp-export.csv',
      mimeType: 'text/csv',
      content: makeCsv(
        ['Employee ID','Name','Hours','Earnings Code','Job'],
        (row) => [
          row?.employee_number || '',
          row?.full_name || '',
          row?.hours_worked || 0,
          Number(row?.overtime_hours || 0) > 0 ? 'OT' : 'REG',
          row?.job_code || '',
        ],
      ),
    };
  }

  return {
    fileName: 'generic-payroll-export.csv',
    mimeType: 'text/csv',
    content: makeCsv(
      ['Employee Number','Employee Name','Job Code','Job Name','Session Date','Regular Hours','Overtime Hours','Hours Worked','Payroll Cost Total'],
      (row) => [
        row?.employee_number || '',
        row?.full_name || '',
        row?.job_code || '',
        row?.job_name || '',
        row?.session_date || '',
        row?.regular_hours || 0,
        row?.overtime_hours || 0,
        row?.hours_worked || 0,
        row?.payroll_cost_total || 0,
      ],
    ),
  };
}

async function createInvoiceFromSignedContract(supabase: any, contract: any, actorId: string) {
  const invoiceNumber = makeDocumentNumber('INV');
  const subtotal = Number(contract?.contract_total_amount || contract?.total_amount || contract?.quoted_charge_total || 0);
  const taxCode = contract?.tax_code_id ? await fetchSingle(supabase, 'tax_codes', contract.tax_code_id) : null;
  const taxRate = Number(taxCode?.rate_percent || contract?.tax_rate_percent || 0);
  const taxTotal = Number((subtotal * (taxRate / 100)).toFixed(2));
  const totalAmount = Number((subtotal + taxTotal).toFixed(2));

  const insertPayload: Record<string, unknown> = {
    invoice_number: invoiceNumber,
    client_id: contract?.client_id || null,
    invoice_status: 'draft',
    invoice_date: new Date().toISOString().slice(0, 10),
    subtotal,
    tax_total: taxTotal,
    total_amount: totalAmount,
    balance_due: totalAmount,
    created_by_profile_id: actorId,
    updated_at: new Date().toISOString(),
    invoice_source: 'signed_contract',
  };
  if (contract?.client_site_id) insertPayload.client_site_id = contract.client_site_id;
  if (contract?.agreement_id) insertPayload.recurring_service_agreement_id = contract.agreement_id;
  if (contract?.id) insertPayload.service_contract_document_id = contract.id;
  if (contract?.job_id) insertPayload.job_id = contract.job_id;

  const { data, error } = await supabase.from('ar_invoices').insert(insertPayload).select('*').single();
  if (error) throw error;

  await supabase.from('service_contract_documents').update({
    linked_invoice_id: data.id,
    invoice_generated_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq('id', contract.id);

  return data;
}

async function runServiceExecutionScheduler(supabase: any, actorId: string, agreementId?: string | null, schedulerSetting?: any | null) {
  const setting = schedulerSetting || (await supabase.from('service_execution_scheduler_settings').select('*').eq('setting_code', 'default').maybeSingle()).data || null;
  let query = supabase.from('v_service_execution_scheduler_candidates').select('*').eq('scheduler_status', 'ready').order('candidate_date', { ascending: true });
  if (agreementId) query = query.eq('agreement_id', agreementId);
  const { data: candidates, error } = await query;
  if (error) throw error;

  const today = new Date();
  const lastAllowed = new Date(today.getTime());
  lastAllowed.setDate(lastAllowed.getDate() + Math.max(0, Number(setting?.lookahead_days ?? 1) || 0));
  const lastAllowedIso = lastAllowed.toISOString().slice(0, 10);
  const filtered = (candidates || []).filter((row: any) => {
    const date = String(row?.candidate_date || '').slice(0, 10);
    if (date && date > lastAllowedIso) return false;
    if (row?.candidate_kind === 'service_session' && setting?.require_linked_job !== false && !row?.job_id) return false;
    return true;
  });

  let createdCount = 0;
  let invoiceCandidateCount = 0;
  let skippedCount = 0;

  for (const row of filtered) {
    if (row.candidate_kind === 'service_session') {
      if (setting?.auto_create_sessions === false) { skippedCount += 1; continue; }
      if (!row.job_id) { skippedCount += 1; continue; }
      const { data: existing } = await supabase.from('job_sessions').select('id').eq('job_id', row.job_id).eq('session_date', row.candidate_date).maybeSingle();
      if (existing?.id) { skippedCount += 1; continue; }
      const { data: created } = await supabase.from('job_sessions').insert({
        job_id: row.job_id,
        session_date: row.candidate_date,
        session_kind: 'scheduled_service',
        session_status: 'planned',
        service_frequency_label: row.service_name || 'scheduled_service',
        created_by_profile_id: actorId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).select('id').single();
      if (created?.id) createdCount += 1; else skippedCount += 1;
      continue;
    }
    if (setting?.auto_stage_invoices === false) { skippedCount += 1; continue; }
    invoiceCandidateCount += 1;
  }

  const runCode = `SCH-${new Date().toISOString().slice(0,10).replaceAll('-','')}-${crypto.randomUUID().slice(0,8).toUpperCase()}`;
  const nowIso = new Date().toISOString();
  const { data: run, error: runErr } = await supabase.from('service_execution_scheduler_runs').insert({
    agreement_id: agreementId || null,
    run_code: runCode,
    run_mode: agreementId ? 'agreement_trigger' : 'manual',
    run_status: 'completed',
    candidate_count: filtered.length,
    session_created_count: createdCount,
    invoice_candidate_count: invoiceCandidateCount,
    skipped_count: skippedCount,
    payload: { candidates: filtered, scheduler_setting: setting ? { setting_code: setting.setting_code, lookahead_days: setting.lookahead_days, auto_create_sessions: setting.auto_create_sessions, auto_stage_invoices: setting.auto_stage_invoices, require_linked_job: setting.require_linked_job } : null },
    created_by_profile_id: actorId,
    updated_at: nowIso,
  }).select('*').single();
  if (runErr) throw runErr;

  if (setting?.id) {
    await supabase.from('service_execution_scheduler_settings').update({
      last_run_at: nowIso,
      next_run_at: computeSchedulerNextRunAt(setting, new Date(nowIso)),
      last_dispatch_status: 'completed',
      last_dispatch_notes: 'Run completed from Admin or direct scheduler invocation.',
      updated_at: nowIso,
    }).eq('id', setting.id);
  }

  await recordSiteActivity(supabase, {
    event_type: 'service_execution_scheduler_run',
    entity_type: 'service_execution_scheduler_run',
    entity_id: run.id,
    severity: 'info',
    title: 'Service execution scheduler run completed',
    summary: `${createdCount} session(s) created, ${invoiceCandidateCount} invoice candidate(s), ${skippedCount} skipped.`,
    created_by_profile_id: actorId,
  });

  return { run, createdCount, invoiceCandidateCount, skippedCount, filteredCount: filtered.length };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const supabase = createClient((Deno.env.get('SB_URL') || Deno.env.get('SUPABASE_URL'))!, (Deno.env.get('SB_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'))!);
  const token = (req.headers.get('Authorization') ?? '').replace('Bearer ', '');
  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData.user) return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401, headers: corsHeaders });

  const actorId = userData.user.id;
  const { data: actorProfile } = await supabase.from('profiles').select('*').eq('id', actorId).single();
  if (!actorProfile?.is_active) return Response.json({ ok: false, error: 'Inactive profile' }, { status: 403, headers: corsHeaders });

  const body = await req.json();
  const entity = body.entity;
  const action = body.action;
  const isAdmin = actorProfile.role === 'admin';

  try {
    if (entity === 'profile' && action === 'self_update') {
      const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
      for (const field of ['full_name','phone','address_line1','address_line2','city','province','postal_code','vehicle_make_model','vehicle_plate','current_position','trade_specialty','feature_preferences','emergency_contact_name','emergency_contact_phone','start_date','strengths','employee_number']) {
        if (field in body) patch[field] = body[field] ?? null;
      }
      const { data, error } = await supabase.from('profiles').update(patch).eq('id', actorId).select('*').single();
      if (error) throw error;
      return Response.json({ ok: true, record: data }, { headers: corsHeaders });
    }


if (entity === 'training_self_acknowledgement') {
  const now = new Date().toISOString();
  const courseId = asNullableText(body.course_id);
  if (!courseId) return Response.json({ ok:false, error:'Course is required.' }, { status:400, headers:corsHeaders });
  const course = await fetchSingle(supabase, 'training_courses', courseId);
  if (!course?.id || course.is_active === false) return Response.json({ ok:false, error:'Training course not found.' }, { status:404, headers:corsHeaders });
  if (course.self_service_enabled === false) return Response.json({ ok:false, error:'This training course does not allow worker self acknowledgement.' }, { status:403, headers:corsHeaders });
  const completedAt = asNullableDate(body.completed_at) || now.slice(0, 10);
  const expiresAt = asNullableDate(body.expires_at) || addMonthsToDate(completedAt, Number(course?.validity_months || 0));
  const patch: Record<string, unknown> = {
    profile_id: actorId,
    course_id: courseId,
    completion_status: 'completed',
    completed_at: completedAt,
    expires_at: expiresAt,
    trainer_name: asNullableText(body.trainer_name),
    provider_name: asNullableText(body.provider_name),
    certificate_number: asNullableText(body.certificate_number),
    license_number: asNullableText(body.license_number),
    source_submission_id: body.source_submission_id ?? null,
    notes: asNullableText(body.notes),
    created_by_profile_id: actorId,
    self_attested: true,
    self_attested_at: completedAt,
    acknowledgement_method: 'worker_self_ack',
    updated_at: now,
  };
  const existingId = String(body.item_id || body.training_record_id || '').trim();
  const existing = existingId ? await fetchSingle(supabase, 'training_records', existingId) : null;
  if (action === 'create') {
    const { data, error } = await supabase.from('training_records').insert({ ...patch, created_at: now }).select('*').single();
    if (error) throw error;
    return Response.json({ ok:true, record:data }, { headers:corsHeaders });
  }
  if (!existing?.id || String(existing.profile_id || '') !== String(actorId)) return Response.json({ ok:false, error:'Training acknowledgement not found.' }, { status:404, headers:corsHeaders });
  if (action === 'update') {
    const { data, error } = await supabase.from('training_records').update(patch).eq('id', existing.id).select('*').single();
    if (error) throw error;
    return Response.json({ ok:true, record:data }, { headers:corsHeaders });
  }
}


if (entity === 'worker_sds_self_acknowledgement') {
  const now = new Date().toISOString();
  const today = now.slice(0, 10);
  const itemId = String(body.item_id || body.sds_acknowledgement_id || '').trim();
  const linkedTrainingRecordId = asNullableText(body.linked_training_record_id);
  let linkedTrainingRecord = null;
  let course = null;
  if (linkedTrainingRecordId) {
    linkedTrainingRecord = await fetchSingle(supabase, 'training_records', linkedTrainingRecordId);
    if (!linkedTrainingRecord?.id || String(linkedTrainingRecord.profile_id || '') !== String(actorId)) {
      return Response.json({ ok:false, error:'Training record not found for this worker.' }, { status:404, headers:corsHeaders });
    }
    if (linkedTrainingRecord.course_id) course = await fetchSingle(supabase, 'training_courses', linkedTrainingRecord.course_id);
  }
  const acknowledgedAt = asNullableDate(body.acknowledged_at) || today;
  const expiresAt = asNullableDate(body.expires_at) || addMonthsToDate(acknowledgedAt, Number(course?.validity_months || 12)) || addMonthsToDate(acknowledgedAt, 12);
  const patch: Record<string, unknown> = {
    profile_id: actorId,
    chemical_name: asNullableText(body.chemical_name) || asNullableText(body.product_name),
    product_name: asNullableText(body.product_name) || asNullableText(course?.course_name),
    vendor_name: asNullableText(body.vendor_name),
    sds_revision_date: asNullableDate(body.sds_revision_date),
    acknowledged_at: acknowledgedAt,
    expires_at: expiresAt,
    status: 'acknowledged',
    source_submission_id: body.source_submission_id ?? null,
    linked_training_record_id: linkedTrainingRecordId,
    acknowledged_by_profile_id: actorId,
    notes: asNullableText(body.notes),
    product_context: body.product_context && typeof body.product_context === 'object' ? body.product_context : {},
    equipment_code: asNullableText(body.equipment_code),
    job_code: asNullableText(body.job_code),
    work_order_number: asNullableText(body.work_order_number),
    route_code: asNullableText(body.route_code),
    updated_at: now,
  };
  if (!patch.product_name && !patch.chemical_name) {
    return Response.json({ ok:false, error:'Product or chemical name is required.' }, { status:400, headers:corsHeaders });
  }
  const existing = itemId ? await fetchSingle(supabase, 'sds_acknowledgements', itemId) : null;
  if (action === 'create') {
    const { data, error } = await supabase.from('sds_acknowledgements').insert({ ...patch, created_at: now }).select('*').single();
    if (error) throw error;
    return Response.json({ ok:true, record:data }, { headers:corsHeaders });
  }
  if (!existing?.id || String(existing.profile_id || '') !== String(actorId)) {
    return Response.json({ ok:false, error:'SDS acknowledgement not found.' }, { status:404, headers:corsHeaders });
  }
  if (action === 'update') {
    const { data, error } = await supabase.from('sds_acknowledgements').update(patch).eq('id', existing.id).select('*').single();
    if (error) throw error;
    return Response.json({ ok:true, record:data }, { headers:corsHeaders });
  }
}



if (entity === 'report_preset') {
  if (roleRank(actorProfile.role) < roleRank('supervisor')) {
    return Response.json({ ok:false, error:'Supervisor access is required.' }, { status:403, headers:corsHeaders });
  }
  const now = new Date().toISOString();
  const itemId = String(body.item_id || '').trim();
  const patch = {
    preset_scope: String(body.preset_scope || 'hse_reporting').trim() || 'hse_reporting',
    preset_name: String(body.preset_name || '').trim(),
    visibility: String(body.visibility || 'private').trim() || 'private',
    preset_payload: body.preset_payload && typeof body.preset_payload === 'object' ? body.preset_payload : {},
    is_active: body.is_active !== false,
    updated_at: now,
  };
  if (!patch.preset_name) return Response.json({ ok:false, error:'Preset name is required.' }, { status:400, headers:corsHeaders });
  if (!['hse_reporting'].includes(String(patch.preset_scope))) return Response.json({ ok:false, error:'Unsupported preset scope.' }, { status:400, headers:corsHeaders });
  if (!['private','shared'].includes(String(patch.visibility))) return Response.json({ ok:false, error:'Unsupported preset visibility.' }, { status:400, headers:corsHeaders });

  if (action === 'create') {
    const { data, error } = await supabase.from('report_presets').insert({ ...patch, created_by_profile_id: actorId, created_at: now }).select('*').single();
    if (error) throw error;
    return Response.json({ ok:true, record:data }, { headers:corsHeaders });
  }

  const preset = itemId ? await fetchSingle(supabase, 'report_presets', itemId) : null;
  if (!preset?.id) return Response.json({ ok:false, error:'Report preset not found.' }, { status:404, headers:corsHeaders });
  if (!isAdmin && String(preset.created_by_profile_id || '') !== String(actorId)) {
    return Response.json({ ok:false, error:'You can only manage your own report presets.' }, { status:403, headers:corsHeaders });
  }

  if (action === 'update') {
    const { data, error } = await supabase.from('report_presets').update(patch).eq('id', preset.id).select('*').single();
    if (error) throw error;
    return Response.json({ ok:true, record:data }, { headers:corsHeaders });
  }
  if (action === 'delete') {
    const { error } = await supabase.from('report_presets').update({ is_active:false, updated_at:now }).eq('id', preset.id);
    if (error) throw error;
    return Response.json({ ok:true }, { headers:corsHeaders });
  }
}

if (entity === 'corrective_action_task') {
  if (roleRank(actorProfile.role) < roleRank('supervisor')) {
    return Response.json({ ok:false, error:'Supervisor access is required.' }, { status:403, headers:corsHeaders });
  }
  const now = new Date().toISOString();
  const itemId = String(body.item_id || body.task_id || '').trim();
  const patch: Record<string, unknown> = {
    source_submission_id: body.source_submission_id ?? null,
    source_history_type: String(body.source_history_type || 'incident_submission').trim() || 'incident_submission',
    source_record_number: asNullableText(body.source_record_number),
    task_scope: String(body.task_scope || 'incident_corrective_action').trim() || 'incident_corrective_action',
    task_title: String(body.task_title || '').trim(),
    task_description: asNullableText(body.task_description),
    priority: String(body.priority || 'medium').trim() || 'medium',
    status: String(body.status || 'open').trim() || 'open',
    assigned_to_profile_id: asNullableText(body.assigned_to_profile_id),
    assigned_by_profile_id: actorId,
    owner_name: asNullableText(body.owner_name),
    due_date: asNullableDate(body.due_date),
    started_at: asNullableDateTime(body.started_at),
    completed_at: asNullableDateTime(body.completed_at),
    escalation_level: Number.isFinite(Number(body.escalation_level)) ? Number(body.escalation_level) : 0,
    reminder_last_sent_at: asNullableDateTime(body.reminder_last_sent_at),
    closeout_notes: asNullableText(body.closeout_notes),
    payload: body.payload && typeof body.payload === 'object' ? body.payload : {},
    supervisor_profile_id: asNullableText(body.supervisor_profile_id),
    reminder_count: Number.isFinite(Number(body.reminder_count)) ? Number(body.reminder_count) : 0,
    next_reminder_at: asNullableDateTime(body.next_reminder_at),
    escalation_due_at: asNullableDate(body.escalation_due_at),
    escalated_at: asNullableDateTime(body.escalated_at),
    escalation_notes: asNullableText(body.escalation_notes),
    updated_at: now,
  };
  if (!patch.task_title) return Response.json({ ok:false, error:'Task title is required.' }, { status:400, headers:corsHeaders });
  if (!['low','medium','high','critical'].includes(String(patch.priority))) return Response.json({ ok:false, error:'Unsupported priority.' }, { status:400, headers:corsHeaders });
  if (!['open','in_progress','blocked','ready_for_review','closed','cancelled'].includes(String(patch.status))) return Response.json({ ok:false, error:'Unsupported task status.' }, { status:400, headers:corsHeaders });
  if (String(patch.status) === 'closed' && !String(patch.closeout_notes || '').trim()) {
    return Response.json({ ok:false, error:'Closeout notes are required when closing a corrective action.' }, { status:400, headers:corsHeaders });
  }
  if (String(patch.status) === 'in_progress' && !patch.started_at) patch.started_at = now;
  if (String(patch.status) === 'closed' && !patch.completed_at) patch.completed_at = now;

  if (action === 'create') {
    const { data, error } = await supabase.from('corrective_action_tasks').insert({ ...patch, created_at: now }).select('*').single();
    if (error) throw error;
    await supabase.from('corrective_action_task_events').insert({ task_id: data.id, event_type: 'created', event_status: data.status, event_notes: asNullableText(body.event_notes) || 'Task created.', changed_by_profile_id: actorId, metadata: { source_submission_id: data.source_submission_id || null } });
    return Response.json({ ok:true, record:data }, { headers:corsHeaders });
  }

  const task = itemId ? await fetchSingle(supabase, 'corrective_action_tasks', itemId) : null;
  if (!task?.id) return Response.json({ ok:false, error:'Corrective action task not found.' }, { status:404, headers:corsHeaders });

  if (action === 'update' || action === 'set_status') {
    if (action === 'set_status' && !body.status) return Response.json({ ok:false, error:'A new status is required.' }, { status:400, headers:corsHeaders });
    const nextStatus = String((body.status ?? patch.status) || '').trim();
    const nextPatch = { ...patch, status: nextStatus };
    if (nextStatus === 'closed' && !String(body.closeout_notes || patch.closeout_notes || '').trim()) {
      return Response.json({ ok:false, error:'Closeout notes are required when closing a corrective action.' }, { status:400, headers:corsHeaders });
    }
    if (nextStatus === 'in_progress' && !task.started_at && !nextPatch.started_at) nextPatch.started_at = now;
    if (nextStatus === 'closed' && !nextPatch.completed_at) nextPatch.completed_at = now;
    const { data, error } = await supabase.from('corrective_action_tasks').update(nextPatch).eq('id', task.id).select('*').single();
    if (error) throw error;
    await supabase.from('corrective_action_task_events').insert({
      task_id: task.id,
      event_type: action === 'set_status' ? 'status_changed' : 'updated',
      event_status: data.status,
      event_notes: asNullableText(body.event_notes) || asNullableText(body.closeout_notes) || asNullableText(body.task_description) || 'Task updated.',
      changed_by_profile_id: actorId,
      metadata: { previous_status: task.status || null, next_status: data.status || null }
    });
    return Response.json({ ok:true, record:data }, { headers:corsHeaders });
  }

  if (action === 'send_reminder') {
    const nextReminderAt = body.next_reminder_at ? asNullableDateTime(body.next_reminder_at) : new Date(Date.now() + (7 * 24 * 60 * 60 * 1000)).toISOString();
    const { data, error } = await supabase.from('corrective_action_tasks').update({
      reminder_last_sent_at: now,
      reminder_count: Number(task.reminder_count || 0) + 1,
      next_reminder_at: nextReminderAt,
      updated_at: now,
    }).eq('id', task.id).select('*').single();
    if (error) throw error;
    await supabase.from('corrective_action_task_events').insert({ task_id: task.id, event_type: 'reminder_sent', event_status: data.status, event_notes: asNullableText(body.event_notes) || 'Reminder recorded.', changed_by_profile_id: actorId, metadata: { reminder_count: data.reminder_count || 0, next_reminder_at: data.next_reminder_at || null } });
    return Response.json({ ok:true, record:data }, { headers:corsHeaders });
  }

  if (action === 'escalate') {
    const { data, error } = await supabase.from('corrective_action_tasks').update({
      escalation_level: Number(task.escalation_level || 0) + 1,
      escalated_at: now,
      escalation_due_at: asNullableDate(body.escalation_due_at) || task.due_date || null,
      escalation_notes: asNullableText(body.escalation_notes) || asNullableText(body.event_notes) || 'Task escalated for follow-up.',
      updated_at: now,
    }).eq('id', task.id).select('*').single();
    if (error) throw error;
    await supabase.from('corrective_action_task_events').insert({ task_id: task.id, event_type: 'escalated', event_status: data.status, event_notes: asNullableText(body.event_notes) || 'Task escalated.', changed_by_profile_id: actorId, metadata: { escalation_level: data.escalation_level || 0, escalation_due_at: data.escalation_due_at || null } });
    return Response.json({ ok:true, record:data }, { headers:corsHeaders });
  }

  if (action === 'delete') {
    const { error } = await supabase.from('corrective_action_tasks').update({ status:'cancelled', updated_at:now }).eq('id', task.id);
    if (error) throw error;
    await supabase.from('corrective_action_task_events').insert({ task_id: task.id, event_type: 'cancelled', event_status: 'cancelled', event_notes: asNullableText(body.event_notes) || 'Task cancelled.', changed_by_profile_id: actorId });
    return Response.json({ ok:true }, { headers:corsHeaders });
  }
}

if (entity === 'training_record') {
  if (roleRank(actorProfile.role) < roleRank('supervisor')) {
    return Response.json({ ok:false, error:'Supervisor access is required.' }, { status:403, headers:corsHeaders });
  }
  const now = new Date().toISOString();
  const itemId = String(body.item_id || body.training_record_id || '').trim();
  const courseId = asNullableText(body.course_id);
  const profileId = asNullableText(body.profile_id);
  if (!courseId || !profileId) return Response.json({ ok:false, error:'Profile and course are required.' }, { status:400, headers:corsHeaders });
  const course = await fetchSingle(supabase, 'training_courses', courseId);
  const completedAt = asNullableDate(body.completed_at);
  const expiresAt = asNullableDate(body.expires_at) || addMonthsToDate(completedAt, Number(course?.validity_months || 0));
  const patch: Record<string, unknown> = {
    profile_id: profileId,
    course_id: courseId,
    completion_status: String(body.completion_status || 'completed').trim() || 'completed',
    completed_at: completedAt,
    expires_at: expiresAt,
    trainer_name: asNullableText(body.trainer_name),
    provider_name: asNullableText(body.provider_name),
    certificate_number: asNullableText(body.certificate_number),
    license_number: asNullableText(body.license_number),
    source_submission_id: body.source_submission_id ?? null,
    notes: asNullableText(body.notes),
    created_by_profile_id: actorId,
    self_attested: body.self_attested === true,
    self_attested_at: asNullableDate(body.self_attested_at),
    acknowledgement_method: String(body.acknowledgement_method || 'admin_recorded').trim() || 'admin_recorded',
    verified_by_profile_id: asNullableText(body.verified_by_profile_id),
    verified_at: asNullableDate(body.verified_at),
    reminder_last_sent_at: asNullableDateTime(body.reminder_last_sent_at),
    updated_at: now,
  };
  if (!['scheduled','in_progress','completed','expired','waived'].includes(String(patch.completion_status))) return Response.json({ ok:false, error:'Unsupported training status.' }, { status:400, headers:corsHeaders });
  if (action === 'create') {
    const { data, error } = await supabase.from('training_records').insert({ ...patch, created_at: now }).select('*').single();
    if (error) throw error;
    return Response.json({ ok:true, record:data }, { headers:corsHeaders });
  }
  const record = itemId ? await fetchSingle(supabase, 'training_records', itemId) : null;
  if (!record?.id) return Response.json({ ok:false, error:'Training record not found.' }, { status:404, headers:corsHeaders });
  if (action === 'update') {
    const { data, error } = await supabase.from('training_records').update(patch).eq('id', record.id).select('*').single();
    if (error) throw error;
    return Response.json({ ok:true, record:data }, { headers:corsHeaders });
  }
  if (action === 'delete') {
    const { error } = await supabase.from('training_records').delete().eq('id', record.id);
    if (error) throw error;
    return Response.json({ ok:true }, { headers:corsHeaders });
  }
}

if (entity === 'sds_acknowledgement') {
  if (roleRank(actorProfile.role) < roleRank('supervisor')) {
    return Response.json({ ok:false, error:'Supervisor access is required.' }, { status:403, headers:corsHeaders });
  }
  const now = new Date().toISOString();
  const itemId = String(body.item_id || body.sds_acknowledgement_id || '').trim();
  const patch: Record<string, unknown> = {
    profile_id: asNullableText(body.profile_id),
    chemical_name: String(body.chemical_name || '').trim(),
    product_name: asNullableText(body.product_name),
    vendor_name: asNullableText(body.vendor_name),
    sds_revision_date: asNullableDate(body.sds_revision_date),
    acknowledged_at: asNullableDate(body.acknowledged_at) || now.slice(0, 10),
    expires_at: asNullableDate(body.expires_at),
    status: String(body.status || 'acknowledged').trim() || 'acknowledged',
    source_submission_id: body.source_submission_id ?? null,
    linked_training_record_id: asNullableText(body.linked_training_record_id),
    acknowledged_by_profile_id: actorId,
    notes: asNullableText(body.notes),
    product_context: body.product_context && typeof body.product_context === 'object' ? body.product_context : {},
    equipment_code: asNullableText(body.equipment_code),
    job_code: asNullableText(body.job_code),
    work_order_number: asNullableText(body.work_order_number),
    route_code: asNullableText(body.route_code),
    updated_at: now,
  };
  if (!patch.profile_id || !patch.chemical_name) return Response.json({ ok:false, error:'Profile and chemical name are required.' }, { status:400, headers:corsHeaders });
  if (!['acknowledged','expired','revoked'].includes(String(patch.status))) return Response.json({ ok:false, error:'Unsupported SDS acknowledgement status.' }, { status:400, headers:corsHeaders });
  if (action === 'create') {
    const { data, error } = await supabase.from('sds_acknowledgements').insert({ ...patch, created_at: now }).select('*').single();
    if (error) throw error;
    return Response.json({ ok:true, record:data }, { headers:corsHeaders });
  }
  const record = itemId ? await fetchSingle(supabase, 'sds_acknowledgements', itemId) : null;
  if (!record?.id) return Response.json({ ok:false, error:'SDS acknowledgement not found.' }, { status:404, headers:corsHeaders });
  if (action === 'update') {
    const { data, error } = await supabase.from('sds_acknowledgements').update(patch).eq('id', record.id).select('*').single();
    if (error) throw error;
    return Response.json({ ok:true, record:data }, { headers:corsHeaders });
  }
  if (action === 'delete') {
    const { error } = await supabase.from('sds_acknowledgements').delete().eq('id', record.id);
    if (error) throw error;
    return Response.json({ ok:true }, { headers:corsHeaders });
  }
}

if (!isAdmin) return Response.json({ ok: false, error: 'Admin role required' }, { status: 403, headers: corsHeaders });

if (entity === 'training_course') {
  const now = new Date().toISOString();
  const itemId = String(body.item_id || body.course_id || '').trim();
  const patch: Record<string, unknown> = {
    course_code: String(body.course_code || '').trim().toUpperCase(),
    course_name: String(body.course_name || '').trim(),
    category: String(body.category || 'safety').trim() || 'safety',
    validity_months: asNullableNumber(body.validity_months),
    reminder_days_before: Number.isFinite(Number(body.reminder_days_before)) ? Number(body.reminder_days_before) : 30,
    requires_sds_acknowledgement: !!body.requires_sds_acknowledgement,
    is_active: body.is_active !== false,
    notes: asNullableText(body.notes),
    self_service_enabled: body.self_service_enabled !== false,
    require_supervisor_verification: !!body.require_supervisor_verification,
    sds_prompt_text: asNullableText(body.sds_prompt_text),
    updated_at: now,
  };
  if (!patch.course_code || !patch.course_name) return Response.json({ ok:false, error:'Course code and course name are required.' }, { status:400, headers:corsHeaders });
  if (action === 'create') {
    const { data, error } = await supabase.from('training_courses').insert({ ...patch, created_at: now }).select('*').single();
    if (error) throw error;
    return Response.json({ ok:true, record:data }, { headers:corsHeaders });
  }
  const course = itemId ? await fetchSingle(supabase, 'training_courses', itemId) : null;
  if (!course?.id) return Response.json({ ok:false, error:'Training course not found.' }, { status:404, headers:corsHeaders });
  if (action === 'update') {
    const { data, error } = await supabase.from('training_courses').update(patch).eq('id', course.id).select('*').single();
    if (error) throw error;
    return Response.json({ ok:true, record:data }, { headers:corsHeaders });
  }
  if (action === 'delete') {
    const { error } = await supabase.from('training_courses').update({ is_active:false, updated_at:now }).eq('id', course.id);
    if (error) throw error;
    return Response.json({ ok:true }, { headers:corsHeaders });
  }
}

if (entity === 'report_subscription') {
  if (roleRank(actorProfile.role) < roleRank('supervisor')) {
    return Response.json({ ok:false, error:'Supervisor access is required.' }, { status:403, headers:corsHeaders });
  }
  const now = new Date().toISOString();
  const itemId = String(body.item_id || body.subscription_id || '').trim();
  const patch: Record<string, unknown> = {
    subscription_scope: 'safety_reporting',
    subscription_name: String(body.subscription_name || '').trim(),
    report_kind: String(body.report_kind || 'weekly_supervisor_summary').trim() || 'weekly_supervisor_summary',
    cadence: String(body.cadence || 'weekly').trim() || 'weekly',
    delivery_channel: String(body.delivery_channel || 'email').trim() || 'email',
    target_role: asNullableText(body.target_role),
    target_profile_id: asNullableText(body.target_profile_id),
    recipient_email: asNullableText(body.recipient_email),
    report_preset_id: asNullableText(body.report_preset_id),
    filter_payload: body.filter_payload && typeof body.filter_payload === 'object' ? body.filter_payload : {},
    include_csv: body.include_csv !== false,
    is_active: body.is_active !== false,
    last_sent_at: asNullableDateTime(body.last_sent_at),
    next_send_at: asNullableDateTime(body.next_send_at),
    last_status: asNullableText(body.last_status),
    notes: asNullableText(body.notes),
    updated_at: now,
  };
  if (!patch.subscription_name) return Response.json({ ok:false, error:'Subscription name is required.' }, { status:400, headers:corsHeaders });
  if (action === 'create') {
    const { data, error } = await supabase.from('report_subscriptions').insert({ ...patch, created_by_profile_id: actorId, created_at: now }).select('*').single();
    if (error) throw error;
    return Response.json({ ok:true, record:data }, { headers:corsHeaders });
  }
  const record = itemId ? await fetchSingle(supabase, 'report_subscriptions', itemId) : null;
  if (!record?.id) return Response.json({ ok:false, error:'Report subscription not found.' }, { status:404, headers:corsHeaders });
  if (action === 'update') {
    const { data, error } = await supabase.from('report_subscriptions').update(patch).eq('id', record.id).select('*').single();
    if (error) throw error;
    return Response.json({ ok:true, record:data }, { headers:corsHeaders });
  }
  if (action === 'delete') {
    const { error } = await supabase.from('report_subscriptions').update({ is_active:false, updated_at:now }).eq('id', record.id);
    if (error) throw error;
    return Response.json({ ok:true }, { headers:corsHeaders });
  }
}

if (entity === 'equipment_jsa_hazard_link') {
  if (roleRank(actorProfile.role) < roleRank('supervisor')) {
    return Response.json({ ok:false, error:'Supervisor access is required.' }, { status:403, headers:corsHeaders });
  }
  const now = new Date().toISOString();
  const itemId = String(body.item_id || body.link_id || '').trim();
  const patch: Record<string, unknown> = {
    source_submission_id: body.source_submission_id ?? null,
    linked_hse_packet_id: asNullableText(body.linked_hse_packet_id),
    equipment_code: asNullableText(body.equipment_code),
    job_code: asNullableText(body.job_code),
    work_order_number: asNullableText(body.work_order_number),
    route_code: asNullableText(body.route_code),
    hazard_title: String(body.hazard_title || '').trim(),
    hazard_summary: asNullableText(body.hazard_summary),
    jsa_required: body.jsa_required !== false,
    status: String(body.status || 'open').trim() || 'open',
    review_due_date: asNullableDate(body.review_due_date),
    completed_at: asNullableDate(body.completed_at),
    notes: asNullableText(body.notes),
    payload: body.payload && typeof body.payload === 'object' ? body.payload : {},
    created_by_profile_id: actorId,
    updated_at: now,
  };
  if (!patch.hazard_title) return Response.json({ ok:false, error:'Hazard title is required.' }, { status:400, headers:corsHeaders });
  if (action === 'create') {
    const { data, error } = await supabase.from('equipment_jsa_hazard_links').insert({ ...patch, created_at: now }).select('*').single();
    if (error) throw error;
    return Response.json({ ok:true, record:data }, { headers:corsHeaders });
  }
  const record = itemId ? await fetchSingle(supabase, 'equipment_jsa_hazard_links', itemId) : null;
  if (!record?.id) return Response.json({ ok:false, error:'JSA / hazard link not found.' }, { status:404, headers:corsHeaders });
  if (action === 'update') {
    const { data, error } = await supabase.from('equipment_jsa_hazard_links').update(patch).eq('id', record.id).select('*').single();
    if (error) throw error;
    return Response.json({ ok:true, record:data }, { headers:corsHeaders });
  }
  if (action === 'delete') {
    const { error } = await supabase.from('equipment_jsa_hazard_links').update({ status:'cancelled', updated_at:now }).eq('id', record.id);
    if (error) throw error;
    return Response.json({ ok:true }, { headers:corsHeaders });
  }
}


if (!isAdmin) return Response.json({ ok: false, error: 'Admin role required' }, { status: 403, headers: corsHeaders });
    if (entity === 'credential' && action === 'create_user') {
      const email = String(body.email || '').trim().toLowerCase();
      const password = validateAdminSetPassword(body.new_password || body.password || '');
      if (!email) return Response.json({ ok:false, error:'Email is required.' }, { status:400, headers:corsHeaders });
      const role = String(body.role || 'employee').trim().toLowerCase() || 'employee';
      const createResp = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: !!body.email_verified,
        phone_confirm: !!body.phone_verified,
        user_metadata: {
          full_name: body.full_name || null,
          role,
          employee_number: body.employee_number || null,
          staff_tier: body.staff_tier || role
        }
      });
      if (createResp.error || !createResp.data?.user) {
        return Response.json({ ok:false, error:createResp.error?.message || 'User create failed.' }, { status:400, headers:corsHeaders });
      }
      const userId = createResp.data.user.id;
      const profilePatch = {
        id: userId,
        email,
        full_name: body.full_name ?? null,
        role,
        is_active: body.is_active ?? true,
        phone: body.phone ?? null,
        phone_verified: !!body.phone_verified,
        email_verified: !!body.email_verified,
        employee_number: body.employee_number ?? null,
        current_position: body.current_position ?? null,
        trade_specialty: body.trade_specialty ?? null,
        seniority_level: body.seniority_level ?? null,
        employment_status: body.employment_status ?? 'active',
        staff_tier: body.staff_tier ?? role,
        start_date: body.start_date ?? null,
        years_employed: body.years_employed ?? null,
        notes: body.notes ?? null,
        hourly_cost_rate: asNullableNumber(body.hourly_cost_rate),
        overtime_cost_rate: asNullableNumber(body.overtime_cost_rate),
        hourly_bill_rate: asNullableNumber(body.hourly_bill_rate),
        overtime_bill_rate: asNullableNumber(body.overtime_bill_rate),
        payroll_burden_percent: asNullableNumber(body.payroll_burden_percent),
        password_login_ready: true,
        password_changed_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      const { data: profileRow, error: profileErr } = await supabase.from('profiles').upsert(profilePatch).select('*').single();
      if (profileErr) throw profileErr;
      await recordSiteActivity(supabase, { event_type: 'staff_created', entity_type: 'profile', entity_id: userId, severity: 'success', title: 'Staff user created', summary: `${profileRow?.full_name || email} was added as ${role}.`, metadata: { email, role, staff_tier: profileRow?.staff_tier || role, employee_number: profileRow?.employee_number || null }, related_profile_id: userId, created_by_profile_id: actorId });
      return Response.json({ ok:true, record: profileRow }, { headers:corsHeaders });
    }

    if (entity === 'credential' && action === 'send_password_reset') {
      const target = await resolveProfileByIdOrEmail(supabase, body.profile_id, body.email);
      if (!target?.email) return Response.json({ ok:false, error:'Target profile was not found.' }, { status:404, headers:corsHeaders });
      const resetResp = await supabase.auth.admin.generateLink({
        type: 'recovery',
        email: String(target.email),
        options: { redirectTo: Deno.env.get('PASSWORD_RESET_REDIRECT_TO') || Deno.env.get('SITE_URL') || undefined }
      });
      if (resetResp.error) return Response.json({ ok:false, error:resetResp.error.message }, { status:400, headers:corsHeaders });
      return Response.json({ ok:true, email: target.email, link_generated: true }, { headers:corsHeaders });
    }

    if (entity === 'profile' && action === 'create') {
      const { data, error } = await supabase.from('profiles').insert({
        id: body.profile_id,
        email: body.email,
        full_name: body.full_name ?? null,
        role: body.role ?? 'employee',
        is_active: body.is_active ?? true,
        phone: body.phone ?? null,
        phone_verified: !!body.phone_verified,
        email_verified: !!body.email_verified,
        employee_number: body.employee_number ?? null,
        current_position: body.current_position ?? null,
        trade_specialty: body.trade_specialty ?? null,
        seniority_level: body.seniority_level ?? null,
        employment_status: body.employment_status ?? 'active',
        staff_tier: body.staff_tier ?? body.role ?? 'employee',
        start_date: body.start_date ?? null,
        years_employed: body.years_employed ?? null,
        notes: body.notes ?? null,
        hourly_cost_rate: asNullableNumber(body.hourly_cost_rate),
        overtime_cost_rate: asNullableNumber(body.overtime_cost_rate),
        hourly_bill_rate: asNullableNumber(body.hourly_bill_rate),
        overtime_bill_rate: asNullableNumber(body.overtime_bill_rate),
        payroll_burden_percent: asNullableNumber(body.payroll_burden_percent),
        updated_at: new Date().toISOString(),
      }).select('*').single();
      if (error) throw error;
      await recordSiteActivity(supabase, { event_type: 'staff_created', entity_type: 'profile', entity_id: data.id, severity: 'success', title: 'Staff profile created', summary: `${data.full_name || data.email || data.id} was added to the staff directory.`, metadata: { role: data.role || null, staff_tier: data.staff_tier || null, employment_status: data.employment_status || null }, related_profile_id: data.id, created_by_profile_id: actorId });
      return Response.json({ ok:true, record:data }, { headers:corsHeaders });
    }

    if (entity === 'profile' && action === 'set_active') {
      const { data, error } = await supabase.from('profiles').update({
        is_active: !!body.is_active,
        employment_status: body.is_active === false ? 'blocked' : (body.employment_status ?? 'active'),
        updated_at: new Date().toISOString(),
      }).eq('id', body.profile_id).select('*').single();
      if (error) throw error;
      await recordSiteActivity(supabase, { event_type: 'staff_status_changed', entity_type: 'profile', entity_id: data.id, severity: body.is_active === false ? 'warning' : 'info', title: 'Staff status changed', summary: `${data.full_name || data.email || data.id} is now ${data.is_active ? 'active' : 'blocked'}.`, metadata: { is_active: !!data.is_active, employment_status: data.employment_status || null }, related_profile_id: data.id, created_by_profile_id: actorId });
      return Response.json({ ok:true, record:data }, { headers:corsHeaders });
    }

    if (entity === 'profile' && action === 'delete') {
      const target = await resolveProfileByIdOrEmail(supabase, body.profile_id, body.email);
      if (!target?.id) return Response.json({ ok:false, error:'Target profile was not found.' }, { status:404, headers:corsHeaders });
      const delResp = await supabase.auth.admin.deleteUser(String(target.id));
      if (delResp.error) return Response.json({ ok:false, error:delResp.error.message }, { status:400, headers:corsHeaders });
      await recordSiteActivity(supabase, { event_type: 'staff_deleted', entity_type: 'profile', entity_id: target.id, severity: 'warning', title: 'Staff account deleted', summary: `${target.full_name || target.email || target.id} was removed.`, metadata: { email: target.email || null }, related_profile_id: target.id, created_by_profile_id: actorId });
      return Response.json({ ok:true }, { headers:corsHeaders });
    }

    if (entity === 'notification') {
      const notificationId = body.notification_id;
      if (!notificationId) return Response.json({ ok:false, error:'notification_id is required' }, { status:400, headers:corsHeaders });
      const { data: notification, error: loadErr } = await supabase.from('admin_notifications').select('*').eq('id', notificationId).single();
      if (loadErr || !notification) return Response.json({ ok:false, error:'Notification not found' }, { status:404, headers:corsHeaders });
      const now = new Date().toISOString();

      if (action === 'preview_email') {
        return Response.json({ ok:true, preview: {
          to: body.email_to || notification.email_to || Deno.env.get('ADMIN_NOTIFICATION_TO') || '',
          subject: body.email_subject || notification.email_subject || notification.title || 'YWI HSE notification',
          body: body.email_body || notification.body || notification.message || JSON.stringify(notification.payload || {})
        } }, { headers:corsHeaders });
      }

      if (action === 'test_send' || action === 'retry_send') {
        try {
          const sent = await sendEmailIfConfigured(notification, {
            email_to: body.email_to,
            email_subject: body.email_subject,
            body: body.email_body
          });
          if (sent.attempted) {
            const patch = {
              email_to: body.email_to || notification.email_to || null,
              email_subject: body.email_subject || notification.email_subject || notification.title || 'YWI HSE notification',
              email_status: sent.status,
              email_provider: 'resend',
              email_error: null,
              sent_at: now,
              status: 'sent',
              read_at: notification.read_at || now,
            };
            const { data: updated, error: updateErr } = await supabase.from('admin_notifications').update(patch).eq('id', notificationId).select('*').single();
            if (updateErr) throw updateErr;
            await updateDeliveryState(supabase, notificationId, 'email', 'resend', true, '');
            return Response.json({ ok:true, record: updated, preview: patch }, { headers:corsHeaders });
          }
          return Response.json({ ok:false, error:'Outbound email is not configured.' }, { status:400, headers:corsHeaders });
        } catch (err) {
          await updateDeliveryState(supabase, notificationId, 'email', 'resend', false, String(err));
          await supabase.from('admin_notifications').update({ status: 'failed', read_at: notification.read_at || now }).eq('id', notificationId);
          return Response.json({ ok:false, error:String(err?.message || err), details:Array.isArray((err as any)?.details) ? (err as any).details : [] }, { status:500, headers:corsHeaders });
        }
      }

      const patch: Record<string, unknown> = { read_at: notification.read_at || now };
      if (action === 'mark_read') patch.status = 'read';
      if (action === 'dismiss') {
        patch.status = 'dismissed';
        patch.decision_status = 'dismissed';
        patch.decided_at = now;
        patch.decided_by_profile_id = actorId;
      }
      if (action === 'resolve') {
        patch.status = 'resolved';
        patch.decision_status = 'resolved';
        patch.decision_notes = body.decision_notes ?? null;
        patch.decided_at = now;
        patch.decided_by_profile_id = actorId;
      }
      if (action === 'approve') {
        patch.status = 'approved';
        patch.decision_status = 'approved';
        patch.decision_notes = body.decision_notes ?? null;
        patch.decided_at = now;
        patch.decided_by_profile_id = actorId;
      }
      if (action === 'reject') {
        patch.status = 'rejected';
        patch.decision_status = 'rejected';
        patch.decision_notes = body.decision_notes ?? null;
        patch.decided_at = now;
        patch.decided_by_profile_id = actorId;
      }
      const { data: updated, error: notifErr } = await supabase.from('admin_notifications').update(patch).eq('id', notificationId).select('*').single();
      if (notifErr) throw notifErr;

      if (action === 'approve' && notification.notification_type === 'phone_verification_request' && notification.target_id) {
        let phone = '';
        const payload = typeof notification.payload === 'object' && notification.payload ? notification.payload : null;
        try { phone = String(payload?.phone || JSON.parse(notification.body || '{}')?.phone || '').trim(); } catch {}
        await supabase.from('profiles').update({ phone: phone || undefined, phone_verified: true, phone_verified_at: now, phone_validation_requested_at: null, updated_at: now }).eq('id', notification.target_id);
      }
      if ((action === 'approve' || action === 'reject') && notification.target_table === 'jobs' && notification.target_id) {
        await supabase.from('jobs').update({ approval_status: action === 'approve' ? 'approved' : 'rejected', approved_at: now, approved_by_profile_id: actorId, approval_notes: body.decision_notes ?? null, updated_at: now }).eq('id', Number(notification.target_id));
      }
      if ((action === 'approve' || action === 'reject') && notification.target_table === 'job_equipment_requirements' && notification.target_id) {
        await supabase.from('job_equipment_requirements').update({ approval_status: action === 'approve' ? 'approved' : 'rejected', approval_notes: body.decision_notes ?? null, approved_at: now, approved_by_profile_id: actorId }).eq('id', Number(notification.target_id));
      }
      if ((action === 'approve' || action === 'reject') && notification.target_table === 'account_identity_change_requests' && notification.target_id) {
        const requestId = Number(notification.target_id);
        const { data: requestRow } = await supabase.from('account_identity_change_requests').select('*').eq('id', requestId).maybeSingle();
        if (requestRow?.profile_id) {
          if (action === 'approve') {
            const profilePatch: Record<string, unknown> = {
              pending_email: null,
              pending_username: null,
              updated_at: now,
            };
            if (requestRow.requested_username) profilePatch.username = requestRow.requested_username;
            if (requestRow.requested_email) {
              profilePatch.email = requestRow.requested_email;
              profilePatch.recovery_email = requestRow.requested_email;
            }

            const authPatch: Record<string, unknown> = {
              user_metadata: {
                requested_username: null,
                requested_email: null,
              }
            };
            if (requestRow.requested_email) {
              authPatch.email = requestRow.requested_email;
              authPatch.email_confirm = true;
            }
            if (requestRow.requested_username) {
              authPatch.user_metadata = {
                ...(authPatch.user_metadata as Record<string, unknown>),
                username: requestRow.requested_username,
              };
            }
            const shouldSyncAuth = !!(requestRow.requested_email || requestRow.requested_username);
            if (shouldSyncAuth) {
              const { error: authSyncError } = await supabase.auth.admin.updateUserById(requestRow.profile_id, authPatch);
              if (authSyncError) {
                const syncError: any = new Error(`Auth identity sync failed: ${authSyncError.message}`);
                syncError.details = ['The approved profile change was not applied to the Auth user record.', authSyncError.message];
                throw syncError;
              }
            }
            await supabase.from('profiles').update(profilePatch).eq('id', requestRow.profile_id);
          } else {
            await supabase.from('profiles').update({ pending_email: null, pending_username: null, updated_at: now }).eq('id', requestRow.profile_id);
          }
          await supabase.from('account_identity_change_requests').update({ request_status: action === 'approve' ? 'approved' : 'rejected', reviewed_by_profile_id: actorId, reviewed_at: now, notes: body.decision_notes ?? null }).eq('id', requestId);
          await supabase.from('admin_notifications').insert({
            notification_type: action === 'approve' ? 'account_identity_change_approved' : 'account_identity_change_rejected',
            recipient_role: 'worker',
            target_table: 'account_identity_change_requests',
            target_id: String(requestId),
            target_profile_id: requestRow.profile_id,
            title: action === 'approve' ? 'Your account identity change was approved' : 'Your account identity change was rejected',
            body: JSON.stringify({
              request_id: requestId,
              request_status: action === 'approve' ? 'approved' : 'rejected',
              requested_username: requestRow.requested_username || null,
              requested_email: requestRow.requested_email || null,
              notes: body.decision_notes ?? null,
              auth_sync_applied: action === 'approve',
            }),
            payload: {
              request_id: requestId,
              profile_id: requestRow.profile_id,
              request_status: action === 'approve' ? 'approved' : 'rejected',
              requested_username: requestRow.requested_username || null,
              requested_email: requestRow.requested_email || null,
              notes: body.decision_notes ?? null,
              auth_sync_applied: action === 'approve',
            },
            status: 'queued',
            email_subject: action === 'approve' ? 'YWI HSE identity change approved' : 'YWI HSE identity change rejected',
            created_by_profile_id: actorId,
          });
        }
      }
      return Response.json({ ok:true, record: updated }, { headers:corsHeaders });
    }

    if (entity === 'job_requirement') {
      if (!body.requirement_id) return Response.json({ ok:false, error:'requirement_id is required' }, { status:400, headers:corsHeaders });
      const now = new Date().toISOString();
      const patch: Record<string, unknown> = { approval_notes: body.decision_notes ?? null };
      if (action === 'approve') {
        patch.approval_status = 'approved';
        patch.approved_at = now;
        patch.approved_by_profile_id = actorId;
      }
      if (action === 'reject') {
        patch.approval_status = 'rejected';
        patch.approved_at = now;
        patch.approved_by_profile_id = actorId;
      }
      if (action === 'request_approval') {
        patch.approval_status = 'pending';
      }
      const { data: updated, error: reqErr } = await supabase.from('job_equipment_requirements').update(patch).eq('id', body.requirement_id).select('*').single();
      if (reqErr) throw reqErr;
      if (action === 'request_approval') {
        await supabase.from('admin_notifications').insert({
          notification_type: 'job_requirement_approval_requested',
          recipient_role: 'admin',
          target_table: 'job_equipment_requirements',
          target_id: String(updated.id),
          title: `Requirement approval requested: ${updated.equipment_name || updated.equipment_code || updated.id}`,
          body: JSON.stringify({ requirement_id: updated.id, equipment_name: updated.equipment_name, needed_qty: updated.needed_qty, reserved_qty: updated.reserved_qty }),
          payload: { requirement_id: updated.id, job_id: updated.job_id, equipment_name: updated.equipment_name, needed_qty: updated.needed_qty, reserved_qty: updated.reserved_qty },
          status: 'queued',
          email_subject: `YWI HSE requirement approval requested: ${updated.equipment_name || updated.equipment_code || updated.id}`,
          created_by_profile_id: actorId,
        });
      }
      return Response.json({ ok:true, record: updated }, { headers:corsHeaders });
    }


    if (entity === 'credential' && action === 'set_password') {
      const targetProfileId = String(body.profile_id || '').trim();
      if (!targetProfileId) return Response.json({ ok:false, error:'profile_id is required' }, { status:400, headers:corsHeaders });
      const newPassword = validateAdminSetPassword(body.new_password);
      const now = new Date().toISOString();
      const { data: targetProfile, error: targetProfileErr } = await supabase.from('profiles').select('id,email,full_name,role,is_active,password_login_ready').eq('id', targetProfileId).maybeSingle();
      if (targetProfileErr || !targetProfile) return Response.json({ ok:false, error:'Target profile not found' }, { status:404, headers:corsHeaders });
      const { error: authUpdateErr } = await supabase.auth.admin.updateUserById(targetProfileId, {
        password: newPassword,
        user_metadata: {
          password_reset_required: !!body.force_password_change,
          password_set_by_admin_profile_id: actorId,
          password_set_by_admin_at: now,
        }
      });
      if (authUpdateErr) throw authUpdateErr;
      const { data: updatedProfile, error: profileUpdateErr } = await supabase
        .from('profiles')
        .update({ password_login_ready: true, password_changed_at: now, updated_at: now })
        .eq('id', targetProfileId)
        .select('*')
        .single();
      if (profileUpdateErr) throw profileUpdateErr;

      await supabase.from('admin_password_resets').insert({
        target_profile_id: targetProfileId,
        reset_by_profile_id: actorId,
        reason: body.reason ?? null,
        force_password_change: !!body.force_password_change,
        created_at: now,
      });

      await supabase.from('admin_notifications').insert({
        notification_type: 'admin_password_reset',
        recipient_role: targetProfile.role || 'employee',
        target_table: 'profiles',
        target_id: String(targetProfileId),
        target_profile_id: targetProfileId,
        title: `Password changed by admin for ${targetProfile.full_name || targetProfile.email || targetProfileId}`,
        body: JSON.stringify({
          target_profile_id: targetProfileId,
          target_email: targetProfile.email || null,
          target_name: targetProfile.full_name || null,
          force_password_change: !!body.force_password_change,
          reason: body.reason ?? null,
        }),
        payload: {
          target_profile_id: targetProfileId,
          target_email: targetProfile.email || null,
          target_name: targetProfile.full_name || null,
          force_password_change: !!body.force_password_change,
          reason: body.reason ?? null,
        },
        status: 'queued',
        email_subject: 'YWI HSE password changed by admin',
        created_by_profile_id: actorId,
      });

      return Response.json({ ok:true, record: updatedProfile }, { headers:corsHeaders });
    }

    if (entity === 'sales_order' && action === 'create') {
      const now = new Date().toISOString();
      const subtotal = Number(body.subtotal_amount || 0);
      const tax = Number(body.tax_amount || 0);
      const total = Number(body.total_amount || subtotal + tax || 0);
      const orderCode = String(body.order_code || '').trim() || `ORD-${Date.now()}`;
      const orderPatch = {
        order_code: orderCode,
        customer_name: body.customer_name ?? null,
        customer_email: body.customer_email ?? null,
        order_status: body.order_status ?? 'draft',
        currency_code: body.currency_code ?? 'CAD',
        subtotal_amount: subtotal,
        tax_amount: tax,
        total_amount: total,
        notes: body.notes ?? null,
        created_by_profile_id: actorId,
        updated_at: now,
      };
      const { data: orderRow, error: orderErr } = await supabase.from('sales_orders').insert(orderPatch).select('*').single();
      if (orderErr) throw orderErr;
      const accountingPayload = {
        source_type: 'sales_order',
        source_id: orderRow.id,
        entry_type: 'order_created',
        entry_status: 'open',
        customer_name: orderRow.customer_name,
        customer_email: orderRow.customer_email,
        currency_code: orderRow.currency_code,
        subtotal_amount: orderRow.subtotal_amount,
        tax_amount: orderRow.tax_amount,
        total_amount: orderRow.total_amount,
        payload: {
          order_code: orderRow.order_code,
          notes: orderRow.notes || null,
          order_status: orderRow.order_status,
          accounting_stage: 'order_stub_created'
        },
        created_by_profile_id: actorId,
      };
      const { data: accountingRow, error: accountingErr } = await supabase.from('accounting_entries').insert(accountingPayload).select('*').single();
      if (accountingErr) throw accountingErr;
      await recordSiteActivity(supabase, { event_type: 'order_created', entity_type: 'sales_order', entity_id: orderRow.id, severity: 'success', title: 'Order created', summary: `${orderRow.order_code || orderRow.id} was created for ${orderRow.customer_name || 'customer'}.`, metadata: { order_status: orderRow.order_status || null, total_amount: orderRow.total_amount || 0 }, created_by_profile_id: actorId });
      return Response.json({ ok:true, record: orderRow, accounting_record: accountingRow }, { headers:corsHeaders });
    }

    if (entity === 'profile' && action === 'update') {
      const normalizedRole = String(body.role ?? '').trim().toLowerCase() || undefined;
      const normalizedEmail = String(body.email ?? '').trim().toLowerCase() || null;
      const patch = {
        full_name: body.full_name ?? null,
        email: normalizedEmail,
        role: normalizedRole,
        is_active: body.is_active ?? true,
        phone: body.phone ?? null,
        phone_verified: !!body.phone_verified,
        email_verified: body.email_verified === undefined ? undefined : !!body.email_verified,
        address_line1: body.address_line1 ?? null,
        address_line2: body.address_line2 ?? null,
        city: body.city ?? null,
        province: body.province ?? null,
        postal_code: body.postal_code ?? null,
        emergency_contact_name: body.emergency_contact_name ?? null,
        emergency_contact_phone: body.emergency_contact_phone ?? null,
        vehicle_make_model: body.vehicle_make_model ?? null,
        vehicle_plate: body.vehicle_plate ?? null,
        years_employed: body.years_employed ?? null,
        start_date: body.start_date ?? null,
        employee_number: body.employee_number ?? null,
        current_position: body.current_position ?? null,
        seniority_level: body.seniority_level ?? null,
        employment_status: body.employment_status ?? null,
        staff_tier: body.staff_tier ?? null,
        previous_employee: !!body.previous_employee,
        trade_specialty: body.trade_specialty ?? null,
        strengths: body.strengths ?? null,
        certifications: body.certifications ?? null,
        feature_preferences: body.feature_preferences ?? null,
        notes: body.notes ?? null,
        hourly_cost_rate: asNullableNumber(body.hourly_cost_rate),
        overtime_cost_rate: asNullableNumber(body.overtime_cost_rate),
        hourly_bill_rate: asNullableNumber(body.hourly_bill_rate),
        overtime_bill_rate: asNullableNumber(body.overtime_bill_rate),
        payroll_burden_percent: asNullableNumber(body.payroll_burden_percent),
        default_supervisor_profile_id: await resolveProfileIdByNameOrEmail(supabase, body.default_supervisor_name),
        override_supervisor_profile_id: await resolveProfileIdByNameOrEmail(supabase, body.override_supervisor_name),
        default_admin_profile_id: await resolveProfileIdByNameOrEmail(supabase, body.default_admin_name),
        override_admin_profile_id: await resolveProfileIdByNameOrEmail(supabase, body.override_admin_name),
        updated_at: new Date().toISOString(),
      };
      const { data, error } = await supabase.from('profiles').update(patch).eq('id', body.profile_id).select('*').single();
      if (error) throw error;
      const metadataPatch: Record<string, unknown> = {};
      if (body.full_name !== undefined) metadataPatch.full_name = body.full_name ?? null;
      if (normalizedRole !== undefined) metadataPatch.role = normalizedRole;
      if (body.employee_number !== undefined) metadataPatch.employee_number = body.employee_number ?? null;
      if (body.staff_tier !== undefined) metadataPatch.staff_tier = body.staff_tier ?? null;
      if (Object.keys(metadataPatch).length || normalizedEmail !== null) {
        const authPatch: Record<string, unknown> = { user_metadata: metadataPatch };
        if (normalizedEmail !== null) authPatch.email = normalizedEmail;
        const authResp = await supabase.auth.admin.updateUserById(String(body.profile_id), authPatch);
        if (authResp.error) return Response.json({ ok:false, error:authResp.error.message }, { status:400, headers:corsHeaders });
      }
      await recordSiteActivity(supabase, { event_type: 'staff_updated', entity_type: 'profile', entity_id: data.id, severity: 'info', title: 'Staff profile updated', summary: `${data.full_name || data.email || data.id} was updated.`, metadata: { role: data.role || null, staff_tier: data.staff_tier || null, employment_status: data.employment_status || null }, related_profile_id: data.id, created_by_profile_id: actorId });
      return Response.json({ ok: true, record: data }, { headers: corsHeaders });
    }

    if (entity === 'site' && action === 'create') {
      const { data, error } = await supabase.from('sites').insert({
        site_code: body.site_code,
        site_name: body.site_name,
        address: body.address ?? null,
        region: body.region ?? null,
        client_name: body.client_name ?? null,
        project_code: body.project_code ?? null,
        project_status: body.project_status ?? null,
        site_supervisor_profile_id: await resolveProfileIdByNameOrEmail(supabase, body.site_supervisor_name),
        signing_supervisor_profile_id: await resolveProfileIdByNameOrEmail(supabase, body.signing_supervisor_name),
        admin_profile_id: await resolveProfileIdByNameOrEmail(supabase, body.admin_name),
        notes: body.notes ?? null,
        is_active: body.is_active ?? true,
      }).select('*').single();
      if (error) throw error;
      return Response.json({ ok: true, record: data }, { headers: corsHeaders });
    }

    if (entity === 'site' && action === 'update') {
      const { data, error } = await supabase.from('sites').update({
        site_code: body.site_code,
        site_name: body.site_name,
        address: body.address ?? null,
        region: body.region ?? null,
        client_name: body.client_name ?? null,
        project_code: body.project_code ?? null,
        project_status: body.project_status ?? null,
        site_supervisor_profile_id: await resolveProfileIdByNameOrEmail(supabase, body.site_supervisor_name),
        signing_supervisor_profile_id: await resolveProfileIdByNameOrEmail(supabase, body.signing_supervisor_name),
        admin_profile_id: await resolveProfileIdByNameOrEmail(supabase, body.admin_name),
        notes: body.notes ?? null,
        is_active: body.is_active ?? true,
        updated_at: new Date().toISOString(),
      }).eq('id', body.site_id).select('*').single();
      if (error) throw error;
      return Response.json({ ok: true, record: data }, { headers: corsHeaders });
    }

    if (entity === 'assignment' && action === 'create') {
      const { data, error } = await supabase.from('site_assignments').insert({
        site_id: body.site_id,
        profile_id: body.profile_id,
        assignment_role: body.assignment_role ?? 'worker',
        is_primary: !!body.is_primary,
        reports_to_supervisor_profile_id: await resolveProfileIdByNameOrEmail(supabase, body.reports_to_supervisor_name),
        reports_to_admin_profile_id: await resolveProfileIdByNameOrEmail(supabase, body.reports_to_admin_name),
      }).select('*').single();
      if (error) throw error;
      return Response.json({ ok: true, record: data }, { headers: corsHeaders });
    }

    if (entity === 'assignment' && action === 'update') {
      const { data, error } = await supabase.from('site_assignments').update({
        assignment_role: body.assignment_role ?? 'worker',
        is_primary: !!body.is_primary,
        reports_to_supervisor_profile_id: await resolveProfileIdByNameOrEmail(supabase, body.reports_to_supervisor_name),
        reports_to_admin_profile_id: await resolveProfileIdByNameOrEmail(supabase, body.reports_to_admin_name),
        updated_at: new Date().toISOString(),
      }).eq('id', body.assignment_id).select('*').single();
      if (error) throw error;
      return Response.json({ ok: true, record: data }, { headers: corsHeaders });
    }

    if (entity === 'catalog') {
      const cfg = getCatalogConfig(body.catalog_type);
      if (!cfg) return Response.json({ ok:false, error:'Unsupported catalog type.' }, { status:400, headers:corsHeaders });
      const record: Record<string, unknown> = {
        [cfg.nameColumn]: body.name,
        sort_order: Number(body.sort_order ?? 100),
        is_active: body.is_active !== false,
      };
      if (action === 'create') {
        const { data, error } = await supabase.from(cfg.table).insert(record).select('*').single();
        if (error) throw error;
        return Response.json({ ok:true, record:data }, { headers:corsHeaders });
      }
      if (action === 'update') {
        const { data, error } = await supabase.from(cfg.table).update(record).eq('id', body.item_id).select('*').single();
        if (error) throw error;
        return Response.json({ ok:true, record:data }, { headers:corsHeaders });
      }
      if (action === 'delete') {
        const { error } = await supabase.from(cfg.table).delete().eq('id', body.item_id);
        if (error) throw error;
        return Response.json({ ok:true }, { headers:corsHeaders });
      }
    }



    if (entity === 'unit_of_measure') {
      const patch = {
        code: String(body.code || '').trim().toUpperCase(),
        name: body.name ?? null,
        category: body.category ?? null,
        sort_order: asNumber(body.sort_order, 0),
        is_active: body.is_active !== false,
        updated_at: new Date().toISOString(),
      };
      if (!patch.code || !patch.name) return Response.json({ ok:false, error:'code and name are required' }, { status:400, headers:corsHeaders });
      if (action === 'create') {
        const { data, error } = await supabase.from('units_of_measure').insert(patch).select('*').single();
        if (error) throw error;
        return Response.json({ ok:true, record:data }, { headers:corsHeaders });
      }
      if (action === 'update') {
        const { data, error } = await supabase.from('units_of_measure').update(patch).eq('id', body.item_id).select('*').single();
        if (error) throw error;
        return Response.json({ ok:true, record:data }, { headers:corsHeaders });
      }
      if (action === 'delete') {
        const { error } = await supabase.from('units_of_measure').delete().eq('id', body.item_id);
        if (error) throw error;
        return Response.json({ ok:true }, { headers:corsHeaders });
      }
    }

    if (entity === 'cost_code') {
      const patch = {
        code: String(body.code || '').trim().toUpperCase(),
        name: body.name ?? null,
        category: body.category ?? null,
        description: body.description ?? null,
        is_active: body.is_active !== false,
        updated_at: new Date().toISOString(),
      };
      if (!patch.code || !patch.name) return Response.json({ ok:false, error:'code and name are required' }, { status:400, headers:corsHeaders });
      if (action === 'create') {
        const { data, error } = await supabase.from('cost_codes').insert(patch).select('*').single();
        if (error) throw error;
        return Response.json({ ok:true, record:data }, { headers:corsHeaders });
      }
      if (action === 'update') {
        const { data, error } = await supabase.from('cost_codes').update(patch).eq('id', body.item_id).select('*').single();
        if (error) throw error;
        return Response.json({ ok:true, record:data }, { headers:corsHeaders });
      }
      if (action === 'delete') {
        const { error } = await supabase.from('cost_codes').delete().eq('id', body.item_id);
        if (error) throw error;
        return Response.json({ ok:true }, { headers:corsHeaders });
      }
    }



    if (entity === 'tax_code') {
      const patch = {
        code: String(body.code || '').trim().toUpperCase(),
        name: body.name ?? null,
        tax_type: body.tax_type ?? 'hst',
        province_code: body.province_code ?? 'ON',
        country_code: body.country_code ?? 'CA',
        rate_percent: asNumber(body.rate_percent, 0),
        applies_to: body.applies_to ?? 'sale',
        is_default: body.is_default === true,
        is_active: body.is_active !== false,
        notes: body.notes ?? null,
        updated_at: new Date().toISOString(),
      };
      if (!patch.code || !patch.name) return Response.json({ ok:false, error:'code and name are required' }, { status:400, headers:corsHeaders });
      if (action === 'create') {
        const { data, error } = await supabase.from('tax_codes').insert(patch).select('*').single();
        if (error) throw error;
        return Response.json({ ok:true, record:data }, { headers:corsHeaders });
      }
      if (action === 'update') {
        const { data, error } = await supabase.from('tax_codes').update(patch).eq('id', body.item_id).select('*').single();
        if (error) throw error;
        return Response.json({ ok:true, record:data }, { headers:corsHeaders });
      }
      if (action === 'delete') {
        const { error } = await supabase.from('tax_codes').delete().eq('id', body.item_id);
        if (error) throw error;
        return Response.json({ ok:true }, { headers:corsHeaders });
      }
    }

    if (entity === 'service_pricing_template') {
      const patch = {
        template_code: String(body.template_code || '').trim().toUpperCase(),
        template_name: body.template_name ?? null,
        job_family: body.job_family ?? null,
        project_scope: body.project_scope ?? null,
        service_pattern: body.service_pattern ?? null,
        default_schedule_mode: body.default_schedule_mode ?? 'standalone',
        default_estimated_visit_minutes: asNullableNumber(body.default_estimated_visit_minutes),
        default_estimated_duration_hours: asNullableNumber(body.default_estimated_duration_hours),
        default_estimated_duration_days: asNullableNumber(body.default_estimated_duration_days),
        default_estimated_cost_total: asNumber(body.default_estimated_cost_total, 0),
        default_quoted_charge_total: asNumber(body.default_quoted_charge_total, 0),
        default_pricing_method: body.default_pricing_method ?? 'manual',
        default_markup_percent: asNullableNumber(body.default_markup_percent),
        default_discount_mode: body.default_discount_mode ?? 'none',
        default_discount_value: asNumber(body.default_discount_value, 0),
        sales_tax_code_id: asNullableText(body.sales_tax_code_id),
        notes: body.notes ?? null,
        is_active: body.is_active !== false,
        updated_at: new Date().toISOString(),
      };
      if (!patch.template_code || !patch.template_name) return Response.json({ ok:false, error:'template_code and template_name are required' }, { status:400, headers:corsHeaders });
      if (action === 'create') {
        const { data, error } = await supabase.from('service_pricing_templates').insert(patch).select('*').single();
        if (error) throw error;
        return Response.json({ ok:true, record:data }, { headers:corsHeaders });
      }
      if (action === 'update') {
        const { data, error } = await supabase.from('service_pricing_templates').update(patch).eq('id', body.item_id).select('*').single();
        if (error) throw error;
        return Response.json({ ok:true, record:data }, { headers:corsHeaders });
      }
      if (action === 'delete') {
        const { error } = await supabase.from('service_pricing_templates').delete().eq('id', body.item_id);
        if (error) throw error;
        return Response.json({ ok:true }, { headers:corsHeaders });
      }
    }


    if (entity === 'recurring_service_agreement') {
      const patch = {
        agreement_code: String(body.agreement_code || '').trim().toUpperCase(),
        client_id: asNullableText(body.client_id),
        client_site_id: asNullableText(body.client_site_id),
        service_pricing_template_id: asNullableText(body.service_pricing_template_id),
        route_id: asNullableText(body.route_id),
        crew_id: asNullableText(body.crew_id),
        tax_code_id: asNullableText(body.tax_code_id),
        service_name: body.service_name ?? null,
        agreement_status: body.agreement_status ?? 'draft',
        billing_method: body.billing_method ?? 'per_visit',
        service_pattern: body.service_pattern ?? null,
        recurrence_basis: body.recurrence_basis ?? null,
        recurrence_rule: body.recurrence_rule ?? null,
        recurrence_interval: asNumber(body.recurrence_interval, 1),
        start_date: asNullableDate(body.start_date),
        end_date: asNullableDate(body.end_date),
        open_end_date: !!body.open_end_date,
        visit_estimated_minutes: asNullableNumber(body.visit_estimated_minutes),
        visit_estimated_duration_hours: asNullableNumber(body.visit_estimated_duration_hours),
        visit_cost_total: asNumber(body.visit_cost_total, 0),
        visit_charge_total: asNumber(body.visit_charge_total, 0),
        markup_percent: asNullableNumber(body.markup_percent),
        discount_mode: body.discount_mode ?? 'none',
        discount_value: asNumber(body.discount_value, 0),
        tiered_discount_notes: body.tiered_discount_notes ?? null,
        event_trigger_type: body.event_trigger_type ?? null,
        snow_trigger_threshold_cm: asNullableNumber(body.snow_trigger_threshold_cm),
        trigger_notes: body.trigger_notes ?? null,
        pricing_notes: body.pricing_notes ?? null,
        service_notes: body.service_notes ?? null,
        estimate_id: asNullableText(body.estimate_id),
        contract_document_id: asNullableText(body.contract_document_id),
        auto_create_session_candidates: body.auto_create_session_candidates !== false,
        auto_stage_invoice_candidates: !!body.auto_stage_invoice_candidates,
        execution_lead_days: asNumber(body.execution_lead_days, 0),
        application_required: !!body.application_required,
        default_invoice_source: body.default_invoice_source ?? 'agreement_visit',
        created_by_profile_id: actorId,
        updated_at: new Date().toISOString(),
      };
      if (!patch.agreement_code || !patch.service_name) return Response.json({ ok:false, error:'agreement_code and service_name are required' }, { status:400, headers:corsHeaders });
      if (action === 'create') {
        const { data, error } = await supabase.from('recurring_service_agreements').insert(patch).select('*').single();
        if (error) throw error;
        await recordSiteActivity(supabase, { event_type: 'agreement_created', entity_type: 'recurring_service_agreement', entity_id: data.id, severity: 'success', title: 'Recurring agreement created', summary: `${data.service_name || data.agreement_code || data.id} was created.`, metadata: { agreement_code: data.agreement_code || null, billing_method: data.billing_method || null, agreement_status: data.agreement_status || null }, created_by_profile_id: actorId });
        return Response.json({ ok:true, record:data }, { headers:corsHeaders });
      }
      if (action === 'update') {
        const { data, error } = await supabase.from('recurring_service_agreements').update(patch).eq('id', body.item_id).select('*').single();
        if (error) throw error;
        await recordSiteActivity(supabase, { event_type: 'agreement_updated', entity_type: 'recurring_service_agreement', entity_id: data.id, severity: 'info', title: 'Recurring agreement updated', summary: `${data.service_name || data.agreement_code || data.id} was updated.`, metadata: { agreement_code: data.agreement_code || null, billing_method: data.billing_method || null, agreement_status: data.agreement_status || null }, created_by_profile_id: actorId });
        return Response.json({ ok:true, record:data }, { headers:corsHeaders });
      }
      if (action === 'delete') {
        const { error } = await supabase.from('recurring_service_agreements').delete().eq('id', body.item_id);
        if (error) throw error;
        return Response.json({ ok:true }, { headers:corsHeaders });
      }
    }

    if (entity === 'snow_event_trigger') {
      const patch = {
        agreement_id: asNullableText(body.agreement_id),
        event_date: asNullableDate(body.event_date) || new Date().toISOString().slice(0, 10),
        event_label: body.event_label ?? null,
        snowfall_cm: asNullableNumber(body.snowfall_cm),
        threshold_cm: asNullableNumber(body.threshold_cm),
        trigger_met: !!body.trigger_met,
        notes: body.notes ?? null,
        created_by_profile_id: actorId,
        updated_at: new Date().toISOString(),
      };
      if (!patch.agreement_id) return Response.json({ ok:false, error:'agreement_id is required' }, { status:400, headers:corsHeaders });
      if (action === 'create') {
        const { data, error } = await supabase.from('snow_event_triggers').insert(patch).select('*').single();
        if (error) throw error;
        await recordSiteActivity(supabase, { event_type: 'snow_trigger_created', entity_type: 'snow_event_trigger', entity_id: data.id, severity: data.trigger_met ? 'warning' : 'info', title: 'Snow trigger recorded', summary: `${data.event_label || data.event_date || data.id} was logged for snow review.`, metadata: { agreement_id: data.agreement_id || null, snowfall_cm: data.snowfall_cm || null, trigger_met: !!data.trigger_met }, created_by_profile_id: actorId });
        return Response.json({ ok:true, record:data }, { headers:corsHeaders });
      }
      if (action === 'update') {
        const { data, error } = await supabase.from('snow_event_triggers').update(patch).eq('id', body.item_id).select('*').single();
        if (error) throw error;
        return Response.json({ ok:true, record:data }, { headers:corsHeaders });
      }
      if (action === 'delete') {
        const { error } = await supabase.from('snow_event_triggers').delete().eq('id', body.item_id);
        if (error) throw error;
        return Response.json({ ok:true }, { headers:corsHeaders });
      }
    }

    if (entity === 'change_order') {
      const patch = {
        job_id: asNullableNumber(body.job_id),
        agreement_id: asNullableText(body.agreement_id),
        change_order_number: String(body.change_order_number || '').trim().toUpperCase(),
        status: body.status ?? 'draft',
        requested_at: asNullableDateTime(body.requested_at) || new Date().toISOString(),
        approved_at: asNullableDateTime(body.approved_at),
        approved_by_profile_id: asNullableText(body.approved_by_profile_id),
        scope_summary: body.scope_summary ?? null,
        reason: body.reason ?? null,
        estimated_cost_delta: asNumber(body.estimated_cost_delta, 0),
        estimated_charge_delta: asNumber(body.estimated_charge_delta, 0),
        actual_cost_delta: asNumber(body.actual_cost_delta, 0),
        actual_charge_delta: asNumber(body.actual_charge_delta, 0),
        tax_code_id: asNullableText(body.tax_code_id),
        notes: body.notes ?? null,
        created_by_profile_id: actorId,
        updated_at: new Date().toISOString(),
      };
      if (!patch.job_id || !patch.change_order_number || !patch.scope_summary) return Response.json({ ok:false, error:'job_id, change_order_number, and scope_summary are required' }, { status:400, headers:corsHeaders });
      if (action === 'create') {
        const { data, error } = await supabase.from('change_orders').insert(patch).select('*').single();
        if (error) throw error;
        await recordSiteActivity(supabase, { event_type: 'change_order_created', entity_type: 'change_order', entity_id: data.id, severity: 'info', title: 'Change order created', summary: `${data.change_order_number || data.id} was created for job ${data.job_id}.`, metadata: { status: data.status || null, estimated_charge_delta: data.estimated_charge_delta || 0 }, related_job_id: data.job_id || null, created_by_profile_id: actorId });
        return Response.json({ ok:true, record:data }, { headers:corsHeaders });
      }
      if (action === 'update') {
        const { data, error } = await supabase.from('change_orders').update(patch).eq('id', body.item_id).select('*').single();
        if (error) throw error;
        return Response.json({ ok:true, record:data }, { headers:corsHeaders });
      }
      if (action === 'delete') {
        const { error } = await supabase.from('change_orders').delete().eq('id', body.item_id);
        if (error) throw error;
        return Response.json({ ok:true }, { headers:corsHeaders });
      }
    }

    if (entity === 'service_contract_document') {
      const patch = {
        document_number: String(body.document_number || '').trim().toUpperCase(),
        source_entity: body.source_entity ?? 'manual',
        source_id: String(body.source_id || '').trim(),
        estimate_id: asNullableText(body.estimate_id),
        agreement_id: asNullableText(body.agreement_id),
        job_id: asNullableNumber(body.job_id),
        client_id: asNullableText(body.client_id),
        client_site_id: asNullableText(body.client_site_id),
        document_kind: body.document_kind ?? 'contract',
        document_status: body.document_status ?? 'draft',
        title: body.title ?? null,
        contract_reference: body.contract_reference ?? null,
        effective_date: asNullableDate(body.effective_date),
        expiry_date: asNullableDate(body.expiry_date),
        issued_at: asNullableDateTime(body.issued_at),
        signed_at: asNullableDateTime(body.signed_at),
        signed_by_name: body.signed_by_name ?? null,
        signed_by_title: body.signed_by_title ?? null,
        signed_by_email: body.signed_by_email ?? null,
        signed_document_url: body.signed_document_url ?? null,
        linked_invoice_id: asNullableText(body.linked_invoice_id),
        invoice_generated_at: asNullableDateTime(body.invoice_generated_at),
        application_submitted_at: asNullableDateTime(body.application_submitted_at),
        rendered_html: body.rendered_html ?? null,
        rendered_text: body.rendered_text ?? null,
        notes: body.notes ?? null,
        created_by_profile_id: actorId,
        updated_at: new Date().toISOString(),
      };
      if (!patch.document_number || !patch.source_id || !patch.title) return Response.json({ ok:false, error:'document_number, source_id, and title are required' }, { status:400, headers:corsHeaders });
      if (action === 'create') {
        const { data, error } = await supabase.from('service_contract_documents').insert(patch).select('*').single();
        if (error) throw error;
        await recordSiteActivity(supabase, { event_type:'contract_document_created', entity_type:'service_contract_document', entity_id:data.id, severity:'success', title:'Service contract document created', summary:`${data.document_number || data.id} created.`, created_by_profile_id: actorId });
        return Response.json({ ok:true, record:data }, { headers:corsHeaders });
      }
      if (action === 'update') {
        const { data, error } = await supabase.from('service_contract_documents').update(patch).eq('id', body.item_id).select('*').single();
        if (error) throw error;
        return Response.json({ ok:true, record:data }, { headers:corsHeaders });
      }
      if (action === 'delete') {
        const { error } = await supabase.from('service_contract_documents').delete().eq('id', body.item_id);
        if (error) throw error;
        return Response.json({ ok:true }, { headers:corsHeaders });
      }
    }

    if (entity === 'customer_asset') {
      const patch = {
        asset_code: String(body.asset_code || '').trim().toUpperCase(),
        client_id: asNullableText(body.client_id),
        client_site_id: asNullableText(body.client_site_id),
        asset_name: body.asset_name ?? null,
        asset_type: body.asset_type ?? 'site_feature',
        serial_number: body.serial_number ?? null,
        install_date: asNullableDate(body.install_date),
        warranty_expiry_date: asNullableDate(body.warranty_expiry_date),
        manufacturer: body.manufacturer ?? null,
        model: body.model ?? null,
        location_notes: body.location_notes ?? null,
        service_notes: body.service_notes ?? null,
        is_active: body.is_active !== false,
        created_by_profile_id: actorId,
        updated_at: new Date().toISOString(),
      };
      if (!patch.asset_code || !patch.asset_name) return Response.json({ ok:false, error:'asset_code and asset_name are required' }, { status:400, headers:corsHeaders });
      if (action === 'create') {
        const { data, error } = await supabase.from('customer_assets').insert(patch).select('*').single();
        if (error) throw error;
        await recordSiteActivity(supabase, { event_type: 'customer_asset_created', entity_type: 'customer_asset', entity_id: data.id, severity: 'success', title: 'Customer asset added', summary: `${data.asset_name || data.asset_code || data.id} was added.`, metadata: { asset_code: data.asset_code || null, asset_type: data.asset_type || null }, created_by_profile_id: actorId });
        return Response.json({ ok:true, record:data }, { headers:corsHeaders });
      }
      if (action === 'update') {
        const { data, error } = await supabase.from('customer_assets').update(patch).eq('id', body.item_id).select('*').single();
        if (error) throw error;
        return Response.json({ ok:true, record:data }, { headers:corsHeaders });
      }
      if (action === 'delete') {
        const { error } = await supabase.from('customer_assets').delete().eq('id', body.item_id);
        if (error) throw error;
        return Response.json({ ok:true }, { headers:corsHeaders });
      }
    }

    if (entity === 'customer_asset_job_link') {
      const patch = {
        asset_id: asNullableText(body.asset_id),
        job_id: asNullableNumber(body.job_id),
        service_date: asNullableDate(body.service_date),
        event_type: body.event_type ?? 'service',
        notes: body.notes ?? null,
        created_by_profile_id: actorId,
        updated_at: new Date().toISOString(),
      };
      if (!patch.asset_id || !patch.job_id) return Response.json({ ok:false, error:'asset_id and job_id are required' }, { status:400, headers:corsHeaders });
      if (action === 'create') {
        const { data, error } = await supabase.from('customer_asset_job_links').insert(patch).select('*').single();
        if (error) throw error;
        return Response.json({ ok:true, record:data }, { headers:corsHeaders });
      }
      if (action === 'update') {
        const { data, error } = await supabase.from('customer_asset_job_links').update(patch).eq('id', body.item_id).select('*').single();
        if (error) throw error;
        return Response.json({ ok:true, record:data }, { headers:corsHeaders });
      }
      if (action === 'delete') {
        const { error } = await supabase.from('customer_asset_job_links').delete().eq('id', body.item_id);
        if (error) throw error;
        return Response.json({ ok:true }, { headers:corsHeaders });
      }
    }

    if (entity === 'warranty_callback_event') {
      const patch = {
        job_id: asNullableNumber(body.job_id),
        asset_id: asNullableText(body.asset_id),
        client_site_id: asNullableText(body.client_site_id),
        callback_number: String(body.callback_number || '').trim().toUpperCase(),
        callback_type: body.callback_type ?? 'callback',
        status: body.status ?? 'open',
        warranty_covered: !!body.warranty_covered,
        opened_at: asNullableDateTime(body.opened_at) || new Date().toISOString(),
        closed_at: asNullableDateTime(body.closed_at),
        estimated_cost_total: asNumber(body.estimated_cost_total, 0),
        actual_cost_total: asNumber(body.actual_cost_total, 0),
        notes: body.notes ?? null,
        created_by_profile_id: actorId,
        updated_at: new Date().toISOString(),
      };
      if (!patch.callback_number) return Response.json({ ok:false, error:'callback_number is required' }, { status:400, headers:corsHeaders });
      if (action === 'create') {
        const { data, error } = await supabase.from('warranty_callback_events').insert(patch).select('*').single();
        if (error) throw error;
        await recordSiteActivity(supabase, { event_type: 'callback_created', entity_type: 'warranty_callback_event', entity_id: data.id, severity: data.warranty_covered ? 'warning' : 'info', title: 'Callback / warranty event created', summary: `${data.callback_number || data.id} was opened.`, metadata: { callback_type: data.callback_type || null, warranty_covered: !!data.warranty_covered, status: data.status || null }, related_job_id: data.job_id || null, created_by_profile_id: actorId });
        return Response.json({ ok:true, record:data }, { headers:corsHeaders });
      }
      if (action === 'update') {
        const { data, error } = await supabase.from('warranty_callback_events').update(patch).eq('id', body.item_id).select('*').single();
        if (error) throw error;
        return Response.json({ ok:true, record:data }, { headers:corsHeaders });
      }
      if (action === 'delete') {
        const { error } = await supabase.from('warranty_callback_events').delete().eq('id', body.item_id);
        if (error) throw error;
        return Response.json({ ok:true }, { headers:corsHeaders });
      }
    }

    if (entity === 'payroll_export_run') {
      const patch = {
        run_code: String(body.run_code || '').trim().toUpperCase(),
        period_start: asNullableDate(body.period_start),
        period_end: asNullableDate(body.period_end),
        status: body.status ?? 'draft',
        export_format: body.export_format ?? 'csv',
        export_provider: normalizePayrollExportProvider(body.export_provider ?? 'generic_csv'),
        export_file_name: body.export_file_name ?? null,
        export_mime_type: body.export_mime_type ?? null,
        export_layout_version: body.export_layout_version ?? null,
        exported_at: asNullableDateTime(body.exported_at),
        exported_by_profile_id: asNullableText(body.exported_by_profile_id),
        delivery_status: body.delivery_status ?? 'pending',
        delivery_reference: body.delivery_reference ?? null,
        delivery_notes: body.delivery_notes ?? null,
        delivered_at: asNullableDateTime(body.delivered_at),
        delivered_by_profile_id: asNullableText(body.delivered_by_profile_id),
        delivery_confirmed_at: asNullableDateTime(body.delivery_confirmed_at),
        payroll_close_status: body.payroll_close_status ?? 'open',
        payroll_closed_at: asNullableDateTime(body.payroll_closed_at),
        payroll_closed_by_profile_id: asNullableText(body.payroll_closed_by_profile_id),
        payroll_close_notes: body.payroll_close_notes ?? null,
        notes: body.notes ?? null,
        updated_at: new Date().toISOString(),
      };
      if (!patch.run_code || !patch.period_start || !patch.period_end) return Response.json({ ok:false, error:'run_code, period_start, and period_end are required' }, { status:400, headers:corsHeaders });
      if (action === 'create') {
        const { data, error } = await supabase.from('payroll_export_runs').insert(patch).select('*').single();
        if (error) throw error;
        await recordSiteActivity(supabase, { event_type: 'payroll_export_created', entity_type: 'payroll_export_run', entity_id: data.id, severity: 'info', title: 'Payroll export run created', summary: `${data.run_code || data.id} covers ${data.period_start || ''} to ${data.period_end || ''}.`, metadata: { status: data.status || null, period_start: data.period_start || null, period_end: data.period_end || null }, created_by_profile_id: actorId });
        return Response.json({ ok:true, record:data }, { headers:corsHeaders });
      }
      if (action === 'update') {
        const { data, error } = await supabase.from('payroll_export_runs').update(patch).eq('id', body.item_id).select('*').single();
        if (error) throw error;
        return Response.json({ ok:true, record:data }, { headers:corsHeaders });
      }
      if (action === 'delete') {
        const { error } = await supabase.from('payroll_export_runs').delete().eq('id', body.item_id);
        if (error) throw error;
        return Response.json({ ok:true }, { headers:corsHeaders });
      }
    }


    if (entity === 'service_execution_scheduler_setting') {
      const patch = {
        setting_code: String(body.setting_code || '').trim().toLowerCase(),
        is_enabled: body.is_enabled === true,
        run_timezone: body.run_timezone ?? 'America/Toronto',
        cadence: body.cadence ?? 'daily',
        run_hour_local: asNumber(body.run_hour_local, 4),
        run_minute_local: asNumber(body.run_minute_local, 0),
        lookahead_days: asNumber(body.lookahead_days, 1),
        auto_create_sessions: body.auto_create_sessions !== false,
        auto_stage_invoices: body.auto_stage_invoices !== false,
        require_linked_job: body.require_linked_job !== false,
        invoke_url: body.invoke_url ?? null,
        notes: body.notes ?? null,
        updated_at: new Date().toISOString(),
      };
      if (!patch.setting_code) return Response.json({ ok:false, error:'setting_code is required' }, { status:400, headers:corsHeaders });
      const now = new Date();
      const nextRunAt = computeSchedulerNextRunAt(patch, now);
      if (action === 'create') {
        const { data, error } = await supabase.from('service_execution_scheduler_settings').insert({ ...patch, next_run_at: nextRunAt, created_by_profile_id: actorId }).select('*').single();
        if (error) throw error;
        await recordSiteActivity(supabase, { event_type:'service_execution_scheduler_setting_created', entity_type:'service_execution_scheduler_setting', entity_id:data.id, severity:'info', title:'Scheduler setting created', summary:`${data.setting_code} scheduler setting was created.`, created_by_profile_id: actorId });
        return Response.json({ ok:true, record:data }, { headers:corsHeaders });
      }
      if (action === 'update') {
        const { data, error } = await supabase.from('service_execution_scheduler_settings').update({ ...patch, next_run_at: nextRunAt }).eq('id', body.item_id).select('*').single();
        if (error) throw error;
        return Response.json({ ok:true, record:data }, { headers:corsHeaders });
      }
      if (action === 'delete') {
        const { error } = await supabase.from('service_execution_scheduler_settings').delete().eq('id', body.item_id);
        if (error) throw error;
        return Response.json({ ok:true }, { headers:corsHeaders });
      }
      if (action === 'run_now') {
        const setting = await fetchSingle(supabase, 'service_execution_scheduler_settings', body.item_id);
        if (!setting?.id) return Response.json({ ok:false, error:'Scheduler setting not found.' }, { status:404, headers:corsHeaders });
        const result = await runServiceExecutionScheduler(supabase, actorId, null, setting);
        return Response.json({ ok:true, record: setting, scheduler_run: result.run, created_count: result.createdCount, invoice_candidate_count: result.invoiceCandidateCount, skipped_count: result.skippedCount, filtered_count: result.filteredCount }, { headers:corsHeaders });
      }
    }


    if (entity === 'job_financial_event') {
      const quantity = asNullableNumber(body.quantity);
      const unitCost = asNullableNumber(body.unit_cost);
      const unitPrice = asNullableNumber(body.unit_price);
      const patch = {
        job_id: asNullableNumber(body.job_id),
        job_session_id: asNullableText(body.job_session_id),
        event_date: asNullableDate(body.event_date) || new Date().toISOString().slice(0, 10),
        event_type: body.event_type ?? 'other',
        cost_amount: asNumber(body.cost_amount, (quantity !== null && unitCost !== null) ? quantity * unitCost : 0),
        revenue_amount: asNumber(body.revenue_amount, (quantity !== null && unitPrice !== null) ? quantity * unitPrice : 0),
        quantity,
        unit_cost: unitCost,
        unit_price: unitPrice,
        is_billable: body.is_billable === true,
        vendor_id: asNullableText(body.vendor_id),
        tax_code_id: asNullableText(body.tax_code_id),
        gl_account_id: asNullableText(body.gl_account_id),
        reference_number: body.reference_number ?? null,
        notes: body.notes ?? null,
        created_by_profile_id: actorId,
        updated_at: new Date().toISOString(),
      };
      if (!patch.job_id) return Response.json({ ok:false, error:'job_id is required' }, { status:400, headers:corsHeaders });
      if (action === 'create') {
        const { data, error } = await supabase.from('job_financial_events').insert({ ...patch, created_at: new Date().toISOString() }).select('*').single();
        if (error) throw error;
        return Response.json({ ok:true, record:data }, { headers:corsHeaders });
      }
      if (action === 'update') {
        const { data, error } = await supabase.from('job_financial_events').update(patch).eq('id', body.item_id).select('*').single();
        if (error) throw error;
        return Response.json({ ok:true, record:data }, { headers:corsHeaders });
      }
      if (action === 'delete') {
        const { error } = await supabase.from('job_financial_events').delete().eq('id', body.item_id);
        if (error) throw error;
        return Response.json({ ok:true }, { headers:corsHeaders });
      }
    }

    if (entity === 'business_tax_setting') {
      const patch = {
        profile_name: body.profile_name ?? null,
        province_code: body.province_code ?? 'ON',
        country_code: body.country_code ?? 'CA',
        currency_code: body.currency_code ?? 'CAD',
        default_sales_tax_code_id: asNullableText(body.default_sales_tax_code_id),
        default_purchase_tax_code_id: asNullableText(body.default_purchase_tax_code_id),
        hst_registration_number: body.hst_registration_number ?? null,
        fiscal_year_end_mmdd: body.fiscal_year_end_mmdd ?? null,
        small_supplier_flag: body.small_supplier_flag === true,
        notes: body.notes ?? null,
        updated_at: new Date().toISOString(),
      };
      if (!patch.profile_name) return Response.json({ ok:false, error:'profile_name is required' }, { status:400, headers:corsHeaders });
      if (action === 'create') {
        const { data, error } = await supabase.from('business_tax_settings').insert(patch).select('*').single();
        if (error) throw error;
        return Response.json({ ok:true, record:data }, { headers:corsHeaders });
      }
      if (action === 'update') {
        const { data, error } = await supabase.from('business_tax_settings').update(patch).eq('id', body.item_id).select('*').single();
        if (error) throw error;
        return Response.json({ ok:true, record:data }, { headers:corsHeaders });
      }
      if (action === 'delete') {
        const { error } = await supabase.from('business_tax_settings').delete().eq('id', body.item_id);
        if (error) throw error;
        return Response.json({ ok:true }, { headers:corsHeaders });
      }
    }
    if (entity === 'service_area') {
      const patch = {
        area_code: asNullableText(body.area_code),
        name: body.name ?? null,
        region: body.region ?? null,
        notes: body.notes ?? null,
        is_active: body.is_active !== false,
        updated_at: new Date().toISOString(),
      };
      if (!patch.name) return Response.json({ ok:false, error:'name is required' }, { status:400, headers:corsHeaders });
      if (action === 'create') {
        const { data, error } = await supabase.from('service_areas').insert(patch).select('*').single();
        if (error) throw error;
        return Response.json({ ok:true, record:data }, { headers:corsHeaders });
      }
      if (action === 'update') {
        const { data, error } = await supabase.from('service_areas').update(patch).eq('id', body.item_id).select('*').single();
        if (error) throw error;
        return Response.json({ ok:true, record:data }, { headers:corsHeaders });
      }
      if (action === 'delete') {
        const { error } = await supabase.from('service_areas').delete().eq('id', body.item_id);
        if (error) throw error;
        return Response.json({ ok:true }, { headers:corsHeaders });
      }
    }


    if (entity === 'employee_time_entry') {
      const patch = {
        profile_id: asNullableText(body.profile_id),
        crew_id: asNullableText(body.crew_id),
        job_id: asNullableNumber(body.job_id),
        job_session_id: asNullableText(body.job_session_id),
        site_id: asNullableText(body.site_id),
        clock_status: body.clock_status ?? 'active',
        signed_in_at: asNullableDateTime(body.signed_in_at),
        signed_out_at: asNullableDateTime(body.signed_out_at),
        unpaid_break_minutes: asNumber(body.unpaid_break_minutes, 0),
        paid_work_minutes: asNumber(body.paid_work_minutes, 0),
        clock_in_latitude: asNullableNumber(body.clock_in_latitude),
        clock_in_longitude: asNullableNumber(body.clock_in_longitude),
        clock_in_accuracy_m: asNullableNumber(body.clock_in_accuracy_m),
        clock_in_geo_source: body.clock_in_geo_source ?? 'manual',
        clock_in_photo_note: body.clock_in_photo_note ?? null,
        clock_out_latitude: asNullableNumber(body.clock_out_latitude),
        clock_out_longitude: asNullableNumber(body.clock_out_longitude),
        clock_out_accuracy_m: asNullableNumber(body.clock_out_accuracy_m),
        clock_out_geo_source: body.clock_out_geo_source ?? 'manual',
        clock_out_photo_note: body.clock_out_photo_note ?? null,
        exception_status: body.exception_status ?? 'clear',
        exception_notes: body.exception_notes ?? null,
        notes: body.notes ?? null,
        updated_at: new Date().toISOString(),
      };
      if (action === 'create') {
        const { data, error } = await supabase.from('employee_time_entries').insert({ ...patch, created_by_profile_id: actorId, created_at: new Date().toISOString() }).select('*').single();
        if (error) throw error;
        await recordSiteActivity(supabase, { event_type:'employee_clock_in', entity_type:'employee_time_entry', entity_id:data?.id, title:'Employee time entry created', summary:'An employee time record was created from Admin.', related_job_id:data?.job_id || null, related_profile_id:data?.profile_id || null, created_by_profile_id: actorId });
        return Response.json({ ok:true, record:data }, { headers:corsHeaders });
      }
      if (action === 'update') {
        const { data, error } = await supabase.from('employee_time_entries').update(patch).eq('id', body.item_id).select('*').single();
        if (error) throw error;
        return Response.json({ ok:true, record:data }, { headers:corsHeaders });
      }
      if (action === 'delete') {
        const { error } = await supabase.from('employee_time_entries').delete().eq('id', body.item_id);
        if (error) throw error;
        return Response.json({ ok:true }, { headers:corsHeaders });
      }
      if (action === 'review_media') {
        const entry = await fetchSingle(supabase, 'employee_time_entries', body.item_id);
        if (!entry?.id) return Response.json({ ok:false, error:'Employee time entry not found.' }, { status:404, headers:corsHeaders });
        const stage = String(body.media_stage || 'clock_in').trim() || 'clock_in';
        const requestedStatus = String(body.review_status || 'pending').trim() || 'pending';
        const requestedNotes = String(body.review_notes || '').trim();
        if (['rejected', 'follow_up'].includes(requestedStatus) && !requestedNotes) {
          return Response.json({ ok:false, error:'Add a review note before rejecting evidence or sending it to follow-up.' }, { status:400, headers:corsHeaders });
        }
        const review = await upsertMediaReviewAction(supabase, {
          target_entity: 'employee_time_entry',
          target_id: entry.id,
          media_stage: stage,
          review_status: requestedStatus,
          review_notes: requestedNotes || null,
          reviewed_by_profile_id: actorId,
          created_by_profile_id: actorId,
        });
        await supabase.from('employee_time_entries').update({
          exception_status: review.review_status === 'approved' ? 'reviewed' : (review.review_status === 'rejected' ? 'flagged' : 'reviewed'),
          exception_notes: review.review_notes || entry.exception_notes || null,
          exception_reviewed_at: review.reviewed_at,
          exception_reviewed_by_profile_id: actorId,
          updated_at: new Date().toISOString(),
        }).eq('id', entry.id);
        await recordSiteActivity(supabase, { event_type: review.review_status === 'approved' ? 'attendance_evidence_approved' : (review.review_status === 'rejected' ? 'attendance_evidence_rejected' : 'attendance_evidence_follow_up'), entity_type: 'employee_time_entry', entity_id: entry.id, severity: review.review_status === 'approved' ? 'success' : 'warning', title: 'Attendance evidence reviewed', summary: `${stage.replaceAll('_', ' ')} evidence marked ${review.review_status.replaceAll('_', ' ')}.`, related_job_id: entry.job_id || null, related_profile_id: entry.profile_id || null, created_by_profile_id: actorId });
        return Response.json({ ok:true, record: review }, { headers:corsHeaders });
      }
    }


    if (entity === 'employee_time_entry_review') {
      const patch = {
        time_entry_id: asNullableText(body.time_entry_id),
        review_type: body.review_type ?? 'attendance_exception',
        exception_type: body.exception_type ?? null,
        review_status: body.review_status ?? 'open',
        reviewed_by_profile_id: asNullableText(body.reviewed_by_profile_id),
        reviewed_at: asNullableDateTime(body.reviewed_at),
        resolution_notes: body.resolution_notes ?? null,
        created_by_profile_id: actorId,
        updated_at: new Date().toISOString(),
      };
      if (!patch.time_entry_id) return Response.json({ ok:false, error:'time_entry_id is required' }, { status:400, headers:corsHeaders });
      if (action === 'create') {
        const { data, error } = await supabase.from('employee_time_entry_reviews').insert({ ...patch, created_at: new Date().toISOString() }).select('*').single();
        if (error) throw error;
        await supabase.from('employee_time_entries').update({ exception_status: patch.review_status === 'resolved' ? 'resolved' : 'reviewed', exception_notes: patch.resolution_notes || null, exception_reviewed_at: patch.reviewed_at || new Date().toISOString(), exception_reviewed_by_profile_id: patch.reviewed_by_profile_id || actorId, updated_at: new Date().toISOString() }).eq('id', patch.time_entry_id);
        await recordSiteActivity(supabase, { event_type: patch.review_status === 'resolved' ? 'attendance_exception_resolved' : 'attendance_exception_reviewed', entity_type: 'employee_time_entry_review', entity_id: data.id, severity: patch.review_status === 'resolved' ? 'success' : 'warning', title: 'Attendance exception reviewed', summary: patch.exception_type ? `Review recorded for ${patch.exception_type}.` : 'Attendance review recorded.', related_profile_id: null, created_by_profile_id: actorId });
        return Response.json({ ok:true, record:data }, { headers:corsHeaders });
      }
      if (action === 'update') {
        const { data, error } = await supabase.from('employee_time_entry_reviews').update(patch).eq('id', body.item_id).select('*').single();
        if (error) throw error;
        await supabase.from('employee_time_entries').update({ exception_status: patch.review_status === 'resolved' ? 'resolved' : 'reviewed', exception_notes: patch.resolution_notes || null, exception_reviewed_at: patch.reviewed_at || new Date().toISOString(), exception_reviewed_by_profile_id: patch.reviewed_by_profile_id || actorId, updated_at: new Date().toISOString() }).eq('id', patch.time_entry_id);
        return Response.json({ ok:true, record:data }, { headers:corsHeaders });
      }
      if (action === 'delete') {
        const { error } = await supabase.from('employee_time_entry_reviews').delete().eq('id', body.item_id);
        if (error) throw error;
        return Response.json({ ok:true }, { headers:corsHeaders });
      }
    }

    if (entity === 'route') {
      const patch = {
        route_code: asNullableText(body.route_code),
        name: body.name ?? null,
        service_area_id: asNullableText(body.service_area_id),
        route_type: body.route_type ?? 'recurring',
        day_of_week: asNullableNumber(body.day_of_week),
        notes: body.notes ?? null,
        is_active: body.is_active !== false,
        updated_at: new Date().toISOString(),
      };
      if (!patch.name) return Response.json({ ok:false, error:'name is required' }, { status:400, headers:corsHeaders });
      if (action === 'create') {
        const { data, error } = await supabase.from('routes').insert(patch).select('*').single();
        if (error) throw error;
        return Response.json({ ok:true, record:data }, { headers:corsHeaders });
      }
      if (action === 'update') {
        const { data, error } = await supabase.from('routes').update(patch).eq('id', body.item_id).select('*').single();
        if (error) throw error;
        return Response.json({ ok:true, record:data }, { headers:corsHeaders });
      }
      if (action === 'delete') {
        const { error } = await supabase.from('routes').delete().eq('id', body.item_id);
        if (error) throw error;
        return Response.json({ ok:true }, { headers:corsHeaders });
      }
    }

    if (entity === 'client') {
      const patch = {
        client_code: asNullableText(body.client_code),
        legal_name: body.legal_name ?? null,
        display_name: body.display_name ?? null,
        client_type: body.client_type ?? 'customer',
        billing_email: body.billing_email ?? null,
        phone: body.phone ?? null,
        address_line1: body.address_line1 ?? null,
        address_line2: body.address_line2 ?? null,
        city: body.city ?? null,
        province: body.province ?? null,
        postal_code: body.postal_code ?? null,
        payment_terms_days: asNumber(body.payment_terms_days, 30),
        tax_registration_number: body.tax_registration_number ?? null,
        notes: body.notes ?? null,
        is_active: body.is_active !== false,
        updated_at: new Date().toISOString(),
      };
      if (!patch.legal_name) return Response.json({ ok:false, error:'legal_name is required' }, { status:400, headers:corsHeaders });
      if (action === 'create') {
        const { data, error } = await supabase.from('clients').insert(patch).select('*').single();
        if (error) throw error;
        return Response.json({ ok:true, record:data }, { headers:corsHeaders });
      }
      if (action === 'update') {
        const { data, error } = await supabase.from('clients').update(patch).eq('id', body.item_id).select('*').single();
        if (error) throw error;
        return Response.json({ ok:true, record:data }, { headers:corsHeaders });
      }
      if (action === 'delete') {
        const { error } = await supabase.from('clients').delete().eq('id', body.item_id);
        if (error) throw error;
        return Response.json({ ok:true }, { headers:corsHeaders });
      }
    }

    if (entity === 'client_site') {
      const patch = {
        client_id: asNullableText(body.client_id),
        legacy_site_id: asNullableText(body.legacy_site_id),
        site_code: asNullableText(body.site_code),
        site_name: body.site_name ?? null,
        service_address: body.service_address ?? null,
        city: body.city ?? null,
        province: body.province ?? null,
        postal_code: body.postal_code ?? null,
        access_notes: body.access_notes ?? null,
        hazard_notes: body.hazard_notes ?? null,
        is_active: body.is_active !== false,
        updated_at: new Date().toISOString(),
      };
      if (!patch.client_id || !patch.site_name) return Response.json({ ok:false, error:'client_id and site_name are required' }, { status:400, headers:corsHeaders });
      if (action === 'create') {
        const { data, error } = await supabase.from('client_sites').insert(patch).select('*').single();
        if (error) throw error;
        return Response.json({ ok:true, record:data }, { headers:corsHeaders });
      }
      if (action === 'update') {
        const { data, error } = await supabase.from('client_sites').update(patch).eq('id', body.item_id).select('*').single();
        if (error) throw error;
        return Response.json({ ok:true, record:data }, { headers:corsHeaders });
      }
      if (action === 'delete') {
        const { error } = await supabase.from('client_sites').delete().eq('id', body.item_id);
        if (error) throw error;
        return Response.json({ ok:true }, { headers:corsHeaders });
      }
    }

    if (entity === 'material') {
      const patch = {
        sku: asNullableText(body.sku),
        item_name: body.item_name ?? null,
        material_category: body.material_category ?? null,
        unit_id: asNullableText(body.unit_id),
        default_unit_cost: asNumber(body.default_unit_cost, 0),
        default_bill_rate: asNumber(body.default_bill_rate, 0),
        taxable: body.taxable !== false,
        inventory_tracked: body.inventory_tracked !== false,
        reorder_point: asNullableNumber(body.reorder_point),
        reorder_quantity: asNullableNumber(body.reorder_quantity),
        notes: body.notes ?? null,
        is_active: body.is_active !== false,
        updated_at: new Date().toISOString(),
      };
      if (!patch.item_name) return Response.json({ ok:false, error:'item_name is required' }, { status:400, headers:corsHeaders });
      if (action === 'create') {
        const { data, error } = await supabase.from('materials_catalog').insert(patch).select('*').single();
        if (error) throw error;
        return Response.json({ ok:true, record:data }, { headers:corsHeaders });
      }
      if (action === 'update') {
        const { data, error } = await supabase.from('materials_catalog').update(patch).eq('id', body.item_id).select('*').single();
        if (error) throw error;
        return Response.json({ ok:true, record:data }, { headers:corsHeaders });
      }
      if (action === 'delete') {
        const { error } = await supabase.from('materials_catalog').delete().eq('id', body.item_id);
        if (error) throw error;
        return Response.json({ ok:true }, { headers:corsHeaders });
      }
    }

    if (entity === 'equipment_master') {
      const patch = {
        equipment_code: asNullableText(body.equipment_code),
        item_name: body.item_name ?? null,
        equipment_category: body.equipment_category ?? null,
        manufacturer: body.manufacturer ?? null,
        model: body.model ?? null,
        ownership_type: body.ownership_type ?? 'owned',
        bill_rate_hourly: asNumber(body.bill_rate_hourly, 0),
        cost_rate_hourly: asNumber(body.cost_rate_hourly, 0),
        default_operator_required: !!body.default_operator_required,
        notes: body.notes ?? null,
        is_active: body.is_active !== false,
        updated_at: new Date().toISOString(),
      };
      if (!patch.item_name) return Response.json({ ok:false, error:'item_name is required' }, { status:400, headers:corsHeaders });
      if (action === 'create') {
        const { data, error } = await supabase.from('equipment_master').insert(patch).select('*').single();
        if (error) throw error;
        await recordSiteActivity(supabase, { event_type: 'equipment_created', entity_type: 'equipment_master', entity_id: data.id, severity: 'success', title: 'Equipment added', summary: `${data.item_name || data.equipment_code || data.id} was added to the equipment master.`, metadata: { equipment_code: data.equipment_code || null, equipment_category: data.equipment_category || null, ownership_type: data.ownership_type || null }, related_equipment_id: data.id, created_by_profile_id: actorId });
        return Response.json({ ok:true, record:data }, { headers:corsHeaders });
      }
      if (action === 'update') {
        const { data, error } = await supabase.from('equipment_master').update(patch).eq('id', body.item_id).select('*').single();
        if (error) throw error;
        await recordSiteActivity(supabase, { event_type: 'equipment_updated', entity_type: 'equipment_master', entity_id: data.id, severity: 'info', title: 'Equipment updated', summary: `${data.item_name || data.equipment_code || data.id} was updated.`, metadata: { equipment_code: data.equipment_code || null, equipment_category: data.equipment_category || null, ownership_type: data.ownership_type || null }, related_equipment_id: data.id, created_by_profile_id: actorId });
        return Response.json({ ok:true, record:data }, { headers:corsHeaders });
      }
      if (action === 'delete') {
        const { data: existing } = await supabase.from('equipment_master').select('id,item_name,equipment_code').eq('id', body.item_id).maybeSingle();
        const { error } = await supabase.from('equipment_master').delete().eq('id', body.item_id);
        if (error) throw error;
        await recordSiteActivity(supabase, { event_type: 'equipment_deleted', entity_type: 'equipment_master', entity_id: body.item_id, severity: 'warning', title: 'Equipment deleted', summary: `${existing?.item_name || existing?.equipment_code || body.item_id} was removed from equipment master.`, metadata: { equipment_code: existing?.equipment_code || null }, related_equipment_id: existing?.id || null, created_by_profile_id: actorId });
        return Response.json({ ok:true }, { headers:corsHeaders });
      }
    }

    if (entity === 'estimate') {
      const patch = {
        estimate_number: body.estimate_number ?? null,
        client_id: asNullableText(body.client_id),
        client_site_id: asNullableText(body.client_site_id),
        estimate_type: body.estimate_type ?? 'landscaping',
        status: body.status ?? 'draft',
        valid_until: asNullableDate(body.valid_until),
        subtotal: asNumber(body.subtotal, 0),
        tax_total: asNumber(body.tax_total, 0),
        total_amount: asNumber(body.total_amount, 0),
        scope_notes: body.scope_notes ?? null,
        terms_notes: body.terms_notes ?? null,
        created_by_profile_id: actorId,
        updated_at: new Date().toISOString(),
      };
      if (!patch.estimate_number) return Response.json({ ok:false, error:'estimate_number is required' }, { status:400, headers:corsHeaders });
      if (action === 'create') {
        const { data, error } = await supabase.from('estimates').insert(patch).select('*').single();
        if (error) throw error;
        return Response.json({ ok:true, record:data }, { headers:corsHeaders });
      }
      if (action === 'update') {
        const { data, error } = await supabase.from('estimates').update(patch).eq('id', body.item_id).select('*').single();
        if (error) throw error;
        return Response.json({ ok:true, record:data }, { headers:corsHeaders });
      }
      if (action === 'delete') {
        const { error } = await supabase.from('estimates').delete().eq('id', body.item_id);
        if (error) throw error;
        return Response.json({ ok:true }, { headers:corsHeaders });
      }
    }

    if (entity === 'work_order') {
      const patch = {
        work_order_number: body.work_order_number ?? null,
        estimate_id: asNullableText(body.estimate_id),
        client_id: asNullableText(body.client_id),
        client_site_id: asNullableText(body.client_site_id),
        legacy_job_id: asNullableNumber(body.legacy_job_id),
        work_type: body.work_type ?? 'service',
        status: body.status ?? 'draft',
        scheduled_start: asNullableDateTime(body.scheduled_start),
        scheduled_end: asNullableDateTime(body.scheduled_end),
        service_area_id: asNullableText(body.service_area_id),
        route_id: asNullableText(body.route_id),
        supervisor_profile_id: asNullableText(body.supervisor_profile_id),
        crew_notes: body.crew_notes ?? null,
        customer_notes: body.customer_notes ?? null,
        safety_notes: body.safety_notes ?? null,
        subtotal: asNumber(body.subtotal, 0),
        tax_total: asNumber(body.tax_total, 0),
        total_amount: asNumber(body.total_amount, 0),
        created_by_profile_id: actorId,
        updated_at: new Date().toISOString(),
      };
      if (!patch.work_order_number) return Response.json({ ok:false, error:'work_order_number is required' }, { status:400, headers:corsHeaders });
      if (action === 'create') {
        const { data, error } = await supabase.from('work_orders').insert(patch).select('*').single();
        if (error) throw error;
        return Response.json({ ok:true, record:data }, { headers:corsHeaders });
      }
      if (action === 'update') {
        const { data, error } = await supabase.from('work_orders').update(patch).eq('id', body.item_id).select('*').single();
        if (error) throw error;
        return Response.json({ ok:true, record:data }, { headers:corsHeaders });
      }
      if (action === 'delete') {
        const { error } = await supabase.from('work_orders').delete().eq('id', body.item_id);
        if (error) throw error;
        return Response.json({ ok:true }, { headers:corsHeaders });
      }
    }

    if (entity === 'subcontract_client') {
      const patch = {
        client_id: asNullableText(body.client_id),
        subcontract_code: asNullableText(body.subcontract_code),
        company_name: body.company_name ?? null,
        contact_name: body.contact_name ?? null,
        contact_email: body.contact_email ?? null,
        contact_phone: body.contact_phone ?? null,
        billing_basis: body.billing_basis ?? 'hourly',
        rate_notes: body.rate_notes ?? null,
        is_active: body.is_active !== false,
        updated_at: new Date().toISOString(),
      };
      if (!patch.company_name) return Response.json({ ok:false, error:'company_name is required' }, { status:400, headers:corsHeaders });
      if (action === 'create') {
        const { data, error } = await supabase.from('subcontract_clients').insert(patch).select('*').single();
        if (error) throw error;
        return Response.json({ ok:true, record:data }, { headers:corsHeaders });
      }
      if (action === 'update') {
        const { data, error } = await supabase.from('subcontract_clients').update(patch).eq('id', body.item_id).select('*').single();
        if (error) throw error;
        return Response.json({ ok:true, record:data }, { headers:corsHeaders });
      }
      if (action === 'delete') {
        const { error } = await supabase.from('subcontract_clients').delete().eq('id', body.item_id);
        if (error) throw error;
        return Response.json({ ok:true }, { headers:corsHeaders });
      }
    }

    if (entity === 'subcontract_dispatch') {
      const patch = {
        dispatch_number: body.dispatch_number ?? null,
        subcontract_client_id: asNullableText(body.subcontract_client_id),
        client_site_id: asNullableText(body.client_site_id),
        work_order_id: asNullableText(body.work_order_id),
        operator_profile_id: asNullableText(body.operator_profile_id),
        equipment_master_id: asNullableText(body.equipment_master_id),
        dispatch_status: body.dispatch_status ?? 'draft',
        dispatch_start: asNullableDateTime(body.dispatch_start),
        dispatch_end: asNullableDateTime(body.dispatch_end),
        billing_basis: body.billing_basis ?? 'hourly',
        bill_rate: asNumber(body.bill_rate, 0),
        cost_rate: asNumber(body.cost_rate, 0),
        notes: body.notes ?? null,
        created_by_profile_id: actorId,
        updated_at: new Date().toISOString(),
      };
      if (!patch.dispatch_number || !patch.subcontract_client_id) return Response.json({ ok:false, error:'dispatch_number and subcontract_client_id are required' }, { status:400, headers:corsHeaders });
      if (action === 'create') {
        const { data, error } = await supabase.from('subcontract_dispatches').insert(patch).select('*').single();
        if (error) throw error;
        return Response.json({ ok:true, record:data }, { headers:corsHeaders });
      }
      if (action === 'update') {
        const { data, error } = await supabase.from('subcontract_dispatches').update(patch).eq('id', body.item_id).select('*').single();
        if (error) throw error;
        return Response.json({ ok:true, record:data }, { headers:corsHeaders });
      }
      if (action === 'delete') {
        const { error } = await supabase.from('subcontract_dispatches').delete().eq('id', body.item_id);
        if (error) throw error;
        return Response.json({ ok:true }, { headers:corsHeaders });
      }
    }

    if (entity === 'gl_account') {
      const patch = {
        account_number: body.account_number ?? null,
        account_name: body.account_name ?? null,
        account_type: body.account_type ?? null,
        parent_account_id: asNullableText(body.parent_account_id),
        system_code: body.system_code ?? null,
        is_active: body.is_active !== false,
        updated_at: new Date().toISOString(),
      };
      if (!patch.account_number || !patch.account_name || !patch.account_type) return Response.json({ ok:false, error:'account_number, account_name, and account_type are required' }, { status:400, headers:corsHeaders });
      if (action === 'create') {
        const { data, error } = await supabase.from('chart_of_accounts').insert(patch).select('*').single();
        if (error) throw error;
        return Response.json({ ok:true, record:data }, { headers:corsHeaders });
      }
      if (action === 'update') {
        const { data, error } = await supabase.from('chart_of_accounts').update(patch).eq('id', body.item_id).select('*').single();
        if (error) throw error;
        return Response.json({ ok:true, record:data }, { headers:corsHeaders });
      }
      if (action === 'delete') {
        const { error } = await supabase.from('chart_of_accounts').delete().eq('id', body.item_id);
        if (error) throw error;
        return Response.json({ ok:true }, { headers:corsHeaders });
      }
    }

    if (entity === 'ap_vendor') {
      const patch = {
        vendor_code: asNullableText(body.vendor_code),
        legal_name: body.legal_name ?? null,
        display_name: body.display_name ?? null,
        contact_name: body.contact_name ?? null,
        contact_email: body.contact_email ?? null,
        contact_phone: body.contact_phone ?? null,
        payment_terms_days: asNumber(body.payment_terms_days, 30),
        tax_registration_number: body.tax_registration_number ?? null,
        notes: body.notes ?? null,
        is_active: body.is_active !== false,
        updated_at: new Date().toISOString(),
      };
      if (!patch.legal_name) return Response.json({ ok:false, error:'legal_name is required' }, { status:400, headers:corsHeaders });
      if (action === 'create') {
        const { data, error } = await supabase.from('ap_vendors').insert(patch).select('*').single();
        if (error) throw error;
        return Response.json({ ok:true, record:data }, { headers:corsHeaders });
      }
      if (action === 'update') {
        const { data, error } = await supabase.from('ap_vendors').update(patch).eq('id', body.item_id).select('*').single();
        if (error) throw error;
        return Response.json({ ok:true, record:data }, { headers:corsHeaders });
      }
      if (action === 'delete') {
        const { error } = await supabase.from('ap_vendors').delete().eq('id', body.item_id);
        if (error) throw error;
        return Response.json({ ok:true }, { headers:corsHeaders });
      }
    }

    if (entity === 'ar_invoice') {
      const patch = {
        invoice_number: body.invoice_number ?? null,
        client_id: asNullableText(body.client_id),
        work_order_id: asNullableText(body.work_order_id),
        dispatch_id: asNullableText(body.dispatch_id),
        invoice_status: body.invoice_status ?? 'draft',
        invoice_date: asNullableDate(body.invoice_date) || new Date().toISOString().slice(0, 10),
        due_date: asNullableDate(body.due_date),
        subtotal: asNumber(body.subtotal, 0),
        tax_total: asNumber(body.tax_total, 0),
        total_amount: asNumber(body.total_amount, 0),
        balance_due: asNumber(body.balance_due, 0),
        created_by_profile_id: actorId,
        updated_at: new Date().toISOString(),
      };
      if (!patch.invoice_number || !patch.client_id) return Response.json({ ok:false, error:'invoice_number and client_id are required' }, { status:400, headers:corsHeaders });
      if (action === 'create') {
        const { data, error } = await supabase.from('ar_invoices').insert(patch).select('*').single();
        if (error) throw error;
        return Response.json({ ok:true, record:data }, { headers:corsHeaders });
      }
      if (action === 'update') {
        const { data, error } = await supabase.from('ar_invoices').update(patch).eq('id', body.item_id).select('*').single();
        if (error) throw error;
        return Response.json({ ok:true, record:data }, { headers:corsHeaders });
      }
      if (action === 'delete') {
        const { error } = await supabase.from('ar_invoices').delete().eq('id', body.item_id);
        if (error) throw error;
        return Response.json({ ok:true }, { headers:corsHeaders });
      }
    }

    if (entity === 'ap_bill') {
      const patch = {
        bill_number: body.bill_number ?? null,
        vendor_id: asNullableText(body.vendor_id),
        bill_status: body.bill_status ?? 'draft',
        bill_date: asNullableDate(body.bill_date) || new Date().toISOString().slice(0, 10),
        due_date: asNullableDate(body.due_date),
        subtotal: asNumber(body.subtotal, 0),
        tax_total: asNumber(body.tax_total, 0),
        total_amount: asNumber(body.total_amount, 0),
        balance_due: asNumber(body.balance_due, 0),
        created_by_profile_id: actorId,
        updated_at: new Date().toISOString(),
      };
      if (!patch.bill_number || !patch.vendor_id) return Response.json({ ok:false, error:'bill_number and vendor_id are required' }, { status:400, headers:corsHeaders });
      if (action === 'create') {
        const { data, error } = await supabase.from('ap_bills').insert(patch).select('*').single();
        if (error) throw error;
        return Response.json({ ok:true, record:data }, { headers:corsHeaders });
      }
      if (action === 'update') {
        const { data, error } = await supabase.from('ap_bills').update(patch).eq('id', body.item_id).select('*').single();
        if (error) throw error;
        return Response.json({ ok:true, record:data }, { headers:corsHeaders });
      }
      if (action === 'delete') {
        const { error } = await supabase.from('ap_bills').delete().eq('id', body.item_id);
        if (error) throw error;
        return Response.json({ ok:true }, { headers:corsHeaders });
      }
    }



    if (entity === 'route_stop') {
      const patch = {
        route_id: asNullableText(body.route_id),
        client_site_id: asNullableText(body.client_site_id),
        stop_order: asNumber(body.stop_order, 0),
        planned_arrival_time: asNullableText(body.planned_arrival_time),
        planned_duration_minutes: asNullableNumber(body.planned_duration_minutes),
        instructions: body.instructions ?? null,
        is_active: body.is_active !== false,
        updated_at: new Date().toISOString(),
      };
      if (!patch.route_id) return Response.json({ ok:false, error:'route_id is required' }, { status:400, headers:corsHeaders });
      if (action === 'create') {
        const { data, error } = await supabase.from('route_stops').insert(patch).select('*').single();
        if (error) throw error;
        return Response.json({ ok:true, record:data }, { headers:corsHeaders });
      }
      if (action === 'update') {
        const { data, error } = await supabase.from('route_stops').update(patch).eq('id', body.item_id).select('*').single();
        if (error) throw error;
        return Response.json({ ok:true, record:data }, { headers:corsHeaders });
      }
      if (action === 'delete') {
        const { error } = await supabase.from('route_stops').delete().eq('id', body.item_id);
        if (error) throw error;
        return Response.json({ ok:true }, { headers:corsHeaders });
      }
    }

    if (entity === 'estimate_line') {
      const quantity = asNumber(body.quantity, 1);
      const patch = {
        estimate_id: asNullableText(body.estimate_id),
        line_order: asNumber(body.line_order, 0),
        line_type: body.line_type ?? 'service',
        description: body.description ?? null,
        cost_code_id: asNullableText(body.cost_code_id),
        unit_id: asNullableText(body.unit_id),
        quantity,
        unit_cost: asNumber(body.unit_cost, 0),
        unit_price: asNumber(body.unit_price, 0),
        line_total: asNumber(body.line_total, quantity * asNumber(body.unit_price, 0)),
        material_id: asNullableText(body.material_id),
        equipment_master_id: asNullableText(body.equipment_master_id),
        updated_at: new Date().toISOString(),
      };
      if (patch.material_id) {
        const material = await getMaterialDefaults(supabase, patch.material_id);
        if (material) {
          if (!patch.description) patch.description = material.item_name;
          if (!patch.unit_id) patch.unit_id = material.unit_id || null;
          if (!asNullableNumber(body.unit_cost)) patch.unit_cost = asNumber(material.default_unit_cost, patch.unit_cost);
          if (!asNullableNumber(body.unit_price)) patch.unit_price = asNumber(material.default_bill_rate, patch.unit_price);
          if (!patch.cost_code_id) patch.cost_code_id = await getCostCodeIdByCode(supabase, 'MAT');
        }
      }
      if (patch.equipment_master_id) {
        const equipment = await getEquipmentDefaults(supabase, patch.equipment_master_id);
        if (equipment) {
          if (!patch.description) patch.description = equipment.item_name;
          if (!asNullableNumber(body.unit_cost)) patch.unit_cost = asNumber(equipment.cost_rate_hourly, patch.unit_cost);
          if (!asNullableNumber(body.unit_price)) patch.unit_price = asNumber(equipment.bill_rate_hourly, patch.unit_price);
          if (!patch.cost_code_id) patch.cost_code_id = await getCostCodeIdByCode(supabase, 'EQP');
        }
      }
      patch.line_total = asNumber(body.line_total, patch.quantity * patch.unit_price);
      if (!patch.estimate_id || !patch.description) return Response.json({ ok:false, error:'estimate_id and description are required' }, { status:400, headers:corsHeaders });
      if (action === 'create') {
        const { data, error } = await supabase.from('estimate_lines').insert(patch).select('*').single();
        if (error) throw error;
        return Response.json({ ok:true, record:data }, { headers:corsHeaders });
      }
      if (action === 'update') {
        const { data, error } = await supabase.from('estimate_lines').update(patch).eq('id', body.item_id).select('*').single();
        if (error) throw error;
        return Response.json({ ok:true, record:data }, { headers:corsHeaders });
      }
      if (action === 'delete') {
        const { error } = await supabase.from('estimate_lines').delete().eq('id', body.item_id);
        if (error) throw error;
        return Response.json({ ok:true }, { headers:corsHeaders });
      }
    }

    if (entity === 'work_order_line') {
      const quantity = asNumber(body.quantity, 1);
      const patch = {
        work_order_id: asNullableText(body.work_order_id),
        line_order: asNumber(body.line_order, 0),
        line_type: body.line_type ?? 'service',
        description: body.description ?? null,
        cost_code_id: asNullableText(body.cost_code_id),
        unit_id: asNullableText(body.unit_id),
        quantity,
        unit_cost: asNumber(body.unit_cost, 0),
        unit_price: asNumber(body.unit_price, 0),
        line_total: asNumber(body.line_total, quantity * asNumber(body.unit_price, 0)),
        material_id: asNullableText(body.material_id),
        equipment_master_id: asNullableText(body.equipment_master_id),
        updated_at: new Date().toISOString(),
      };
      if (patch.material_id) {
        const material = await getMaterialDefaults(supabase, patch.material_id);
        if (material) {
          if (!patch.description) patch.description = material.item_name;
          if (!patch.unit_id) patch.unit_id = material.unit_id || null;
          if (!asNullableNumber(body.unit_cost)) patch.unit_cost = asNumber(material.default_unit_cost, patch.unit_cost);
          if (!asNullableNumber(body.unit_price)) patch.unit_price = asNumber(material.default_bill_rate, patch.unit_price);
          if (!patch.cost_code_id) patch.cost_code_id = await getCostCodeIdByCode(supabase, 'MAT');
        }
      }
      if (patch.equipment_master_id) {
        const equipment = await getEquipmentDefaults(supabase, patch.equipment_master_id);
        if (equipment) {
          if (!patch.description) patch.description = equipment.item_name;
          if (!asNullableNumber(body.unit_cost)) patch.unit_cost = asNumber(equipment.cost_rate_hourly, patch.unit_cost);
          if (!asNullableNumber(body.unit_price)) patch.unit_price = asNumber(equipment.bill_rate_hourly, patch.unit_price);
          if (!patch.cost_code_id) patch.cost_code_id = await getCostCodeIdByCode(supabase, 'EQP');
        }
      }
      patch.line_total = asNumber(body.line_total, patch.quantity * patch.unit_price);
      if (!patch.work_order_id || !patch.description) return Response.json({ ok:false, error:'work_order_id and description are required' }, { status:400, headers:corsHeaders });
      if (action === 'create') {
        const { data, error } = await supabase.from('work_order_lines').insert(patch).select('*').single();
        if (error) throw error;
        return Response.json({ ok:true, record:data }, { headers:corsHeaders });
      }
      if (action === 'update') {
        const { data, error } = await supabase.from('work_order_lines').update(patch).eq('id', body.item_id).select('*').single();
        if (error) throw error;
        return Response.json({ ok:true, record:data }, { headers:corsHeaders });
      }
      if (action === 'delete') {
        const { error } = await supabase.from('work_order_lines').delete().eq('id', body.item_id);
        if (error) throw error;
        return Response.json({ ok:true }, { headers:corsHeaders });
      }
    }

    if (entity === 'ar_payment') {
      const patch = {
        payment_number: body.payment_number ?? null,
        client_id: asNullableText(body.client_id),
        invoice_id: asNullableText(body.invoice_id),
        payment_date: asNullableDate(body.payment_date) || new Date().toISOString().slice(0, 10),
        payment_method: body.payment_method ?? null,
        reference_number: body.reference_number ?? null,
        amount: asNumber(body.amount, 0),
        notes: body.notes ?? null,
        created_by_profile_id: actorId,
        updated_at: new Date().toISOString(),
      };
      if (patch.invoice_id) {
        const { data: invoice } = await supabase.from('ar_invoices').select('id,client_id,balance_due').eq('id', patch.invoice_id).maybeSingle();
        if (invoice) {
          if (!patch.client_id) patch.client_id = invoice.client_id || null;
          if (!(Number(body.amount) > 0)) patch.amount = asNumber(invoice.balance_due, 0);
        }
      }
      if (!patch.payment_number || !patch.client_id) return Response.json({ ok:false, error:'payment_number and client_id are required' }, { status:400, headers:corsHeaders });
      if (action === 'create') {
        const { data, error } = await supabase.from('ar_payments').insert(patch).select('*').single();
        if (error) throw error;
        return Response.json({ ok:true, record:data }, { headers:corsHeaders });
      }
      if (action === 'update') {
        const { data, error } = await supabase.from('ar_payments').update(patch).eq('id', body.item_id).select('*').single();
        if (error) throw error;
        return Response.json({ ok:true, record:data }, { headers:corsHeaders });
      }
      if (action === 'delete') {
        const { error } = await supabase.from('ar_payments').delete().eq('id', body.item_id);
        if (error) throw error;
        return Response.json({ ok:true }, { headers:corsHeaders });
      }
    }

    if (entity === 'ap_payment') {
      const patch = {
        payment_number: body.payment_number ?? null,
        vendor_id: asNullableText(body.vendor_id),
        bill_id: asNullableText(body.bill_id),
        payment_date: asNullableDate(body.payment_date) || new Date().toISOString().slice(0, 10),
        payment_method: body.payment_method ?? null,
        reference_number: body.reference_number ?? null,
        amount: asNumber(body.amount, 0),
        notes: body.notes ?? null,
        created_by_profile_id: actorId,
        updated_at: new Date().toISOString(),
      };
      if (patch.bill_id) {
        const { data: bill } = await supabase.from('ap_bills').select('id,vendor_id,balance_due').eq('id', patch.bill_id).maybeSingle();
        if (bill) {
          if (!patch.vendor_id) patch.vendor_id = bill.vendor_id || null;
          if (!(Number(body.amount) > 0)) patch.amount = asNumber(bill.balance_due, 0);
        }
      }
      if (!patch.payment_number || !patch.vendor_id) return Response.json({ ok:false, error:'payment_number and vendor_id are required' }, { status:400, headers:corsHeaders });
      if (action === 'create') {
        const { data, error } = await supabase.from('ap_payments').insert(patch).select('*').single();
        if (error) throw error;
        return Response.json({ ok:true, record:data }, { headers:corsHeaders });
      }
      if (action === 'update') {
        const { data, error } = await supabase.from('ap_payments').update(patch).eq('id', body.item_id).select('*').single();
        if (error) throw error;
        return Response.json({ ok:true, record:data }, { headers:corsHeaders });
      }
      if (action === 'delete') {
        const { error } = await supabase.from('ap_payments').delete().eq('id', body.item_id);
        if (error) throw error;
        return Response.json({ ok:true }, { headers:corsHeaders });
      }
    }

    if (entity === 'material_receipt') {
      const patch = {
        receipt_number: body.receipt_number ?? null,
        vendor_id: asNullableText(body.vendor_id),
        client_site_id: asNullableText(body.client_site_id),
        work_order_id: asNullableText(body.work_order_id),
        receipt_status: body.receipt_status ?? 'draft',
        receipt_date: asNullableDate(body.receipt_date) || new Date().toISOString().slice(0, 10),
        received_by_profile_id: asNullableText(body.received_by_profile_id),
        notes: body.notes ?? null,
        created_by_profile_id: actorId,
        updated_at: new Date().toISOString(),
      };
      if (patch.work_order_id && !patch.client_site_id) {
        const { data: workOrder } = await supabase.from('work_orders').select('id,client_site_id').eq('id', patch.work_order_id).maybeSingle();
        if (workOrder?.client_site_id) patch.client_site_id = workOrder.client_site_id;
      }
      if (!patch.receipt_number) return Response.json({ ok:false, error:'receipt_number is required' }, { status:400, headers:corsHeaders });
      if (action === 'create') {
        const { data, error } = await supabase.from('material_receipts').insert(patch).select('*').single();
        if (error) throw error;
        return Response.json({ ok:true, record:data }, { headers:corsHeaders });
      }
      if (action === 'update') {
        const { data, error } = await supabase.from('material_receipts').update(patch).eq('id', body.item_id).select('*').single();
        if (error) throw error;
        return Response.json({ ok:true, record:data }, { headers:corsHeaders });
      }
      if (action === 'delete') {
        const { error } = await supabase.from('material_receipts').delete().eq('id', body.item_id);
        if (error) throw error;
        return Response.json({ ok:true }, { headers:corsHeaders });
      }
    }

    if (entity === 'material_receipt_line') {
      const quantity = asNumber(body.quantity, 0);
      const patch = {
        receipt_id: asNullableText(body.receipt_id),
        line_order: asNumber(body.line_order, 0),
        material_id: asNullableText(body.material_id),
        description: body.description ?? null,
        unit_id: asNullableText(body.unit_id),
        quantity,
        unit_cost: asNumber(body.unit_cost, 0),
        line_total: asNumber(body.line_total, quantity * asNumber(body.unit_cost, 0)),
        cost_code_id: asNullableText(body.cost_code_id),
        work_order_line_id: asNullableText(body.work_order_line_id),
        updated_at: new Date().toISOString(),
      };
      if (patch.work_order_line_id) {
        const workOrderLine = await getWorkOrderLineDefaults(supabase, patch.work_order_line_id);
        if (workOrderLine) {
          if (!patch.description) patch.description = workOrderLine.description;
          if (!patch.unit_id) patch.unit_id = workOrderLine.unit_id || null;
          if (!patch.material_id) patch.material_id = workOrderLine.material_id || null;
          if (!patch.cost_code_id) patch.cost_code_id = workOrderLine.cost_code_id || null;
          if (!asNullableNumber(body.unit_cost)) patch.unit_cost = asNumber(workOrderLine.unit_cost, patch.unit_cost);
        }
      }
      if (patch.material_id) {
        const material = await getMaterialDefaults(supabase, patch.material_id);
        if (material) {
          if (!patch.description) patch.description = material.item_name;
          if (!patch.unit_id) patch.unit_id = material.unit_id || null;
          if (!asNullableNumber(body.unit_cost)) patch.unit_cost = asNumber(material.default_unit_cost, patch.unit_cost);
          if (!patch.cost_code_id) patch.cost_code_id = await getCostCodeIdByCode(supabase, 'MAT');
        }
      }
      patch.line_total = asNumber(body.line_total, patch.quantity * patch.unit_cost);
      if (!patch.receipt_id || !patch.description) return Response.json({ ok:false, error:'receipt_id and description are required' }, { status:400, headers:corsHeaders });
      if (action === 'create') {
        const { data, error } = await supabase.from('material_receipt_lines').insert(patch).select('*').single();
        if (error) throw error;
        return Response.json({ ok:true, record:data }, { headers:corsHeaders });
      }
      if (action === 'update') {
        const { data, error } = await supabase.from('material_receipt_lines').update(patch).eq('id', body.item_id).select('*').single();
        if (error) throw error;
        return Response.json({ ok:true, record:data }, { headers:corsHeaders });
      }
      if (action === 'delete') {
        const { error } = await supabase.from('material_receipt_lines').delete().eq('id', body.item_id);
        if (error) throw error;
        return Response.json({ ok:true }, { headers:corsHeaders });
      }
    }

    if (entity === 'linked_hse_packet') {
      const patch = {
        packet_number: body.packet_number ?? null,
        packet_type: body.packet_type ?? 'work_order',
        packet_scope: body.packet_scope ?? 'standalone',
        packet_status: body.packet_status ?? 'draft',
        job_id: asNullableNumber(body.job_id),
        work_order_id: asNullableText(body.work_order_id),
        dispatch_id: asNullableText(body.dispatch_id),
        client_site_id: asNullableText(body.client_site_id),
        route_id: asNullableText(body.route_id),
        equipment_master_id: asNullableText(body.equipment_master_id),
        supervisor_profile_id: asNullableText(body.supervisor_profile_id),
        unscheduled_project: !!body.unscheduled_project || String(body.packet_type || '') === 'unscheduled_project',
        standalone_project_name: body.standalone_project_name ?? null,
        briefing_required: body.briefing_required !== false,
        briefing_completed: !!body.briefing_completed,
        inspection_required: body.inspection_required !== false,
        inspection_completed: !!body.inspection_completed,
        emergency_review_required: !!body.emergency_review_required,
        emergency_review_completed: !!body.emergency_review_completed,
        weather_monitoring_required: !!body.weather_monitoring_required,
        weather_monitoring_completed: !!body.weather_monitoring_completed,
        heat_monitoring_required: !!body.heat_monitoring_required,
        heat_monitoring_completed: !!body.heat_monitoring_completed,
        chemical_handling_required: !!body.chemical_handling_required,
        chemical_handling_completed: !!body.chemical_handling_completed,
        traffic_control_required: !!body.traffic_control_required,
        traffic_control_completed: !!body.traffic_control_completed,
        field_signoff_required: body.field_signoff_required !== false,
        field_signoff_completed: !!body.field_signoff_completed,
        closeout_completed: !!body.closeout_completed,
        completion_percent: asNumber(body.completion_percent, 0),
        required_item_count: asNumber(body.required_item_count, 0),
        completed_item_count: asNumber(body.completed_item_count, 0),
        issued_at: asNullableText(body.issued_at),
        started_at: asNullableText(body.started_at),
        ready_for_closeout_at: asNullableText(body.ready_for_closeout_at),
        closed_at: asNullableText(body.closed_at),
        field_signed_off_at: asNullableDateTime(body.field_signed_off_at),
        field_signed_off_by_profile_id: asNullableText(body.field_signed_off_by_profile_id),
        weather_notes: body.weather_notes ?? null,
        heat_plan_notes: body.heat_plan_notes ?? null,
        chemical_notes: body.chemical_notes ?? null,
        traffic_notes: body.traffic_notes ?? null,
        public_interaction_notes: body.public_interaction_notes ?? null,
        packet_notes: body.packet_notes ?? null,
        closeout_notes: body.closeout_notes ?? null,
        reopen_in_progress: !!body.reopen_in_progress,
        reopen_reason: body.reopen_reason ?? null,
        last_reopened_by_profile_id: body.reopen_in_progress ? actorId : asNullableText(body.last_reopened_by_profile_id),
        closed_by_profile_id: asNullableText(body.closed_by_profile_id),
        created_by_profile_id: actorId,
        updated_at: new Date().toISOString(),
      };
      if (patch.work_order_id && (!patch.client_site_id || !patch.route_id || !patch.supervisor_profile_id)) {
        const { data: workOrder } = await supabase.from('work_orders').select('id,client_site_id,route_id,supervisor_profile_id,legacy_job_id').eq('id', patch.work_order_id).maybeSingle();
        if (workOrder) {
          if (!patch.client_site_id) patch.client_site_id = workOrder.client_site_id || null;
          if (!patch.route_id) patch.route_id = workOrder.route_id || null;
          if (!patch.supervisor_profile_id) patch.supervisor_profile_id = workOrder.supervisor_profile_id || null;
          if (!patch.job_id && workOrder.legacy_job_id) patch.job_id = Number(workOrder.legacy_job_id) || null;
        }
      }
      if (patch.dispatch_id && (!patch.client_site_id || !patch.work_order_id)) {
        const { data: dispatch } = await supabase.from('subcontract_dispatches').select('id,client_site_id,work_order_id,equipment_master_id').eq('id', patch.dispatch_id).maybeSingle();
        if (dispatch) {
          if (!patch.client_site_id) patch.client_site_id = dispatch.client_site_id || null;
          if (!patch.work_order_id) patch.work_order_id = dispatch.work_order_id || null;
          if (!patch.equipment_master_id) patch.equipment_master_id = dispatch.equipment_master_id || null;
        }
      }
      if (!patch.packet_number) return Response.json({ ok:false, error:'packet_number is required' }, { status:400, headers:corsHeaders });
      if (patch.packet_type === 'unscheduled_project' && !patch.standalone_project_name) {
        patch.standalone_project_name = patch.packet_number;
      }
      if (action === 'create') {
        const { data, error } = await supabase.from('linked_hse_packets').insert(patch).select('*').single();
        if (error) throw error;
        return Response.json({ ok:true, record:data }, { headers:corsHeaders });
      }
      if (action === 'update') {
        const { data, error } = await supabase.from('linked_hse_packets').update(patch).eq('id', body.item_id).select('*').single();
        if (error) throw error;
        return Response.json({ ok:true, record:data }, { headers:corsHeaders });
      }
      if (action === 'delete') {
        const { error } = await supabase.from('linked_hse_packets').delete().eq('id', body.item_id);
        if (error) throw error;
        return Response.json({ ok:true }, { headers:corsHeaders });
      }
    }


    if (entity === 'gl_journal_batch') {
      const patch = {
        batch_number: body.batch_number ?? null,
        source_module: body.source_module ?? 'manual',
        batch_status: body.batch_status ?? 'draft',
        batch_date: asNullableDate(body.batch_date) || new Date().toISOString().slice(0, 10),
        memo: body.memo ?? null,
        source_record_type: asNullableText(body.source_record_type),
        source_record_id: asNullableText(body.source_record_id),
        posting_notes: body.posting_notes ?? null,
        created_by_profile_id: actorId,
        updated_at: new Date().toISOString(),
      };
      if (!patch.batch_number) return Response.json({ ok:false, error:'batch_number is required' }, { status:400, headers:corsHeaders });
      if ((action === 'create' || action === 'update') && patch.batch_status === 'posted') {
        return Response.json({ ok:false, error:'Use the journal batch post action after the batch is balanced.' }, { status:400, headers:corsHeaders });
      }
      if (action === 'create') {
        const { data, error } = await supabase.from('gl_journal_batches').insert(patch).select('*').single();
        if (error) throw error;
        return Response.json({ ok:true, record:data }, { headers:corsHeaders });
      }
      if (action === 'update') {
        const { data, error } = await supabase.from('gl_journal_batches').update(patch).eq('id', body.item_id).select('*').single();
        if (error) throw error;
        return Response.json({ ok:true, record:data }, { headers:corsHeaders });
      }
      if (action === 'post') {
        const { data: batch } = await supabase.from('gl_journal_batches').select('id,batch_number,batch_status,line_count,debit_total,credit_total,is_balanced,source_generated,source_sync_state').eq('id', body.item_id).maybeSingle();
        if (!batch?.id) return Response.json({ ok:false, error:'Journal batch not found.' }, { status:404, headers:corsHeaders });
        if (String(batch.batch_status || '') === 'posted') return Response.json({ ok:true, record:batch }, { headers:corsHeaders });
        if (!(Number(batch.line_count) > 0)) return Response.json({ ok:false, error:'Journal batch must have at least one entry before posting.' }, { status:400, headers:corsHeaders });
        if (!batch.is_balanced) return Response.json({ ok:false, error:`Journal batch is not balanced. Debit ${batch.debit_total || 0} must equal credit ${batch.credit_total || 0}.` }, { status:400, headers:corsHeaders });
        if (batch.source_generated && String(batch.source_sync_state || '') === 'stale') return Response.json({ ok:false, error:'This source-generated batch is marked stale. Review and resolve the source sync exception before posting.' }, { status:400, headers:corsHeaders });
        const { data, error } = await supabase.from('gl_journal_batches').update({ batch_status:'posted', posted_at:new Date().toISOString(), posted_by_profile_id: actorId, posting_notes: body.posting_notes ?? null, source_sync_state: batch.source_generated ? 'posted' : 'manual', source_synced_at: new Date().toISOString(), updated_at:new Date().toISOString() }).eq('id', body.item_id).select('*').single();
        if (error) throw error;
        return Response.json({ ok:true, record:data }, { headers:corsHeaders });
      }
      if (action === 'delete') {
        const { error } = await supabase.from('gl_journal_batches').delete().eq('id', body.item_id);
        if (error) throw error;
        return Response.json({ ok:true }, { headers:corsHeaders });
      }
    }

    if (entity === 'gl_journal_sync_exception') {
      const patch = {
        exception_status: body.exception_status ?? 'open',
        severity: body.severity ?? 'warning',
        title: body.title ?? null,
        details: body.details ?? null,
        resolution_notes: body.resolution_notes ?? null,
        resolved_by_profile_id: ['resolved','dismissed'].includes(String(body.exception_status || '')) ? actorId : null,
        updated_at: new Date().toISOString(),
      };
      if (action === 'update') {
        const { data, error } = await supabase.from('gl_journal_sync_exceptions').update(patch).eq('id', body.item_id).select('*').single();
        if (error) throw error;
        return Response.json({ ok:true, record:data }, { headers:corsHeaders });
      }
      if (action === 'delete') {
        const { error } = await supabase.from('gl_journal_sync_exceptions').delete().eq('id', body.item_id);
        if (error) throw error;
        return Response.json({ ok:true }, { headers:corsHeaders });
      }
    }

    if (entity === 'gl_journal_entry') {
      const debit = asNumber(body.debit_amount, 0);
      const credit = asNumber(body.credit_amount, 0);
      const patch = {
        batch_id: asNullableText(body.batch_id),
        line_number: asNullableNumber(body.line_number),
        entry_date: asNullableDate(body.entry_date) || new Date().toISOString().slice(0, 10),
        account_id: asNullableText(body.account_id),
        debit_amount: debit,
        credit_amount: credit,
        client_id: asNullableText(body.client_id),
        work_order_id: asNullableText(body.work_order_id),
        dispatch_id: asNullableText(body.dispatch_id),
        source_record_type: asNullableText(body.source_record_type),
        source_record_id: asNullableText(body.source_record_id),
        memo: body.memo ?? null,
        created_by_profile_id: actorId,
      };
      if (!patch.batch_id || !patch.account_id) return Response.json({ ok:false, error:'batch_id and account_id are required' }, { status:400, headers:corsHeaders });
      if (!((debit > 0 && credit === 0) || (credit > 0 && debit === 0))) {
        return Response.json({ ok:false, error:'Exactly one of debit_amount or credit_amount must be greater than zero.' }, { status:400, headers:corsHeaders });
      }
      if (action === 'create') {
        const { data, error } = await supabase.from('gl_journal_entries').insert(patch).select('*').single();
        if (error) throw error;
        return Response.json({ ok:true, record:data }, { headers:corsHeaders });
      }
      if (action === 'update') {
        const { data, error } = await supabase.from('gl_journal_entries').update(patch).eq('id', body.item_id).select('*').single();
        if (error) throw error;
        return Response.json({ ok:true, record:data }, { headers:corsHeaders });
      }
      if (action === 'delete') {
        const { error } = await supabase.from('gl_journal_entries').delete().eq('id', body.item_id);
        if (error) throw error;
        return Response.json({ ok:true }, { headers:corsHeaders });
      }
    }

    if (entity === 'material_issue') {
      const patch = {
        issue_number: body.issue_number ?? null,
        work_order_id: asNullableText(body.work_order_id),
        client_site_id: asNullableText(body.client_site_id),
        issue_status: body.issue_status ?? 'draft',
        issue_date: asNullableDate(body.issue_date) || new Date().toISOString().slice(0, 10),
        issued_by_profile_id: asNullableText(body.issued_by_profile_id),
        notes: body.notes ?? null,
        created_by_profile_id: actorId,
        updated_at: new Date().toISOString(),
      };
      if (patch.work_order_id && !patch.client_site_id) {
        const { data: workOrder } = await supabase.from('work_orders').select('id,client_site_id').eq('id', patch.work_order_id).maybeSingle();
        if (workOrder?.client_site_id) patch.client_site_id = workOrder.client_site_id;
      }
      if (!patch.issue_number) return Response.json({ ok:false, error:'issue_number is required' }, { status:400, headers:corsHeaders });
      if (action === 'create') {
        const { data, error } = await supabase.from('material_issues').insert(patch).select('*').single();
        if (error) throw error;
        return Response.json({ ok:true, record:data }, { headers:corsHeaders });
      }
      if (action === 'update') {
        const { data, error } = await supabase.from('material_issues').update(patch).eq('id', body.item_id).select('*').single();
        if (error) throw error;
        return Response.json({ ok:true, record:data }, { headers:corsHeaders });
      }
      if (action === 'delete') {
        const { error } = await supabase.from('material_issues').delete().eq('id', body.item_id);
        if (error) throw error;
        return Response.json({ ok:true }, { headers:corsHeaders });
      }
    }

    if (entity === 'route_stop_execution') {
      const patch = {
        route_stop_id: asNullableText(body.route_stop_id),
        route_id: asNullableText(body.route_id),
        client_site_id: asNullableText(body.client_site_id),
        execution_date: asNullableDate(body.execution_date) || new Date().toISOString().slice(0, 10),
        execution_sequence: asNumber(body.execution_sequence, 1),
        execution_status: body.execution_status ?? 'planned',
        started_at: asNullableDateTime(body.started_at),
        arrived_at: asNullableDateTime(body.arrived_at),
        completed_at: asNullableDateTime(body.completed_at),
        completed_by_profile_id: asNullableText(body.completed_by_profile_id),
        supervisor_profile_id: asNullableText(body.supervisor_profile_id),
        delay_minutes: asNumber(body.delay_minutes, 0),
        special_instructions_acknowledged: !!body.special_instructions_acknowledged,
        notes: body.notes ?? null,
        exception_notes: body.exception_notes ?? null,
        created_by_profile_id: actorId,
        updated_at: new Date().toISOString(),
      };
      if (patch.route_stop_id) {
        const stop = await getRouteStopDefaults(supabase, patch.route_stop_id);
        if (stop) {
          if (!patch.route_id) patch.route_id = stop.route_id || null;
          if (!patch.client_site_id) patch.client_site_id = stop.client_site_id || null;
        }
      }
      if (!patch.route_stop_id) return Response.json({ ok:false, error:'route_stop_id is required' }, { status:400, headers:corsHeaders });
      if (action === 'create') {
        const { data, error } = await supabase.from('route_stop_executions').insert(patch).select('*').single();
        if (error) throw error;
        return Response.json({ ok:true, record:data }, { headers:corsHeaders });
      }
      if (action === 'update') {
        const { data, error } = await supabase.from('route_stop_executions').update(patch).eq('id', body.item_id).select('*').single();
        if (error) throw error;
        return Response.json({ ok:true, record:data }, { headers:corsHeaders });
      }
      if (action === 'delete') {
        const { error } = await supabase.from('route_stop_executions').delete().eq('id', body.item_id);
        if (error) throw error;
        return Response.json({ ok:true }, { headers:corsHeaders });
      }
    }

    if (entity === 'route_stop_execution_attachment') {
      const patch = {
        execution_id: asNullableText(body.execution_id),
        attachment_kind: body.attachment_kind ?? 'photo',
        storage_bucket: body.storage_bucket ?? null,
        storage_path: body.storage_path ?? null,
        file_name: body.file_name ?? null,
        mime_type: body.mime_type ?? null,
        public_url: body.public_url ?? null,
        caption: body.caption ?? null,
        created_by_profile_id: actorId,
      };
      if (!patch.execution_id) return Response.json({ ok:false, error:'execution_id is required' }, { status:400, headers:corsHeaders });
      if (action === 'create') {
        const { data, error } = await supabase.from('route_stop_execution_attachments').insert(patch).select('*').single();
        if (error) throw error;
        return Response.json({ ok:true, record:data }, { headers:corsHeaders });
      }
      if (action === 'update') {
        const { data, error } = await supabase.from('route_stop_execution_attachments').update(patch).eq('id', body.item_id).select('*').single();
        if (error) throw error;
        return Response.json({ ok:true, record:data }, { headers:corsHeaders });
      }
      if (action === 'delete') {
        const { error } = await supabase.from('route_stop_execution_attachments').delete().eq('id', body.item_id);
        if (error) throw error;
        return Response.json({ ok:true }, { headers:corsHeaders });
      }
    }

    if (entity === 'hse_packet_proof') {
      const patch = {
        packet_id: asNullableText(body.packet_id),
        proof_kind: body.proof_kind ?? 'photo',
        proof_stage: body.proof_stage ?? 'field',
        storage_bucket: body.storage_bucket ?? null,
        storage_path: body.storage_path ?? null,
        file_name: body.file_name ?? null,
        mime_type: body.mime_type ?? null,
        public_url: body.public_url ?? null,
        caption: body.caption ?? null,
        proof_notes: body.proof_notes ?? null,
        uploaded_by_profile_id: actorId,
        updated_at: new Date().toISOString(),
      };
      if (!patch.packet_id) return Response.json({ ok:false, error:'packet_id is required' }, { status:400, headers:corsHeaders });
      if (action === 'create') {
        const { data, error } = await supabase.from('hse_packet_proofs').insert(patch).select('*').single();
        if (error) throw error;
        return Response.json({ ok:true, record:data }, { headers:corsHeaders });
      }
      if (action === 'update') {
        const { data, error } = await supabase.from('hse_packet_proofs').update(patch).eq('id', body.item_id).select('*').single();
        if (error) throw error;
        return Response.json({ ok:true, record:data }, { headers:corsHeaders });
      }
      if (action === 'delete') {
        const { error } = await supabase.from('hse_packet_proofs').delete().eq('id', body.item_id);
        if (error) throw error;
        return Response.json({ ok:true }, { headers:corsHeaders });
      }
      if (action === 'review_media') {
        const proof = await fetchSingle(supabase, 'hse_packet_proofs', body.item_id);
        if (!proof?.id) return Response.json({ ok:false, error:'HSE packet proof not found.' }, { status:404, headers:corsHeaders });
        const requestedStatus = String(body.review_status || 'pending').trim() || 'pending';
        const requestedNotes = String(body.review_notes || '').trim();
        if (['rejected', 'follow_up'].includes(requestedStatus) && !requestedNotes) {
          return Response.json({ ok:false, error:'Add a review note before rejecting evidence or sending it to follow-up.' }, { status:400, headers:corsHeaders });
        }
        const review = await upsertMediaReviewAction(supabase, {
          target_entity: 'hse_packet_proof',
          target_id: proof.id,
          media_stage: String(body.media_stage || proof.proof_stage || 'field'),
          review_status: requestedStatus,
          review_notes: requestedNotes || null,
          reviewed_by_profile_id: actorId,
          created_by_profile_id: actorId,
        });
        await recordSiteActivity(supabase, { event_type: review.review_status === 'approved' ? 'hse_evidence_approved' : (review.review_status === 'rejected' ? 'hse_evidence_rejected' : 'hse_evidence_follow_up'), entity_type: 'hse_packet_proof', entity_id: proof.id, severity: review.review_status === 'approved' ? 'success' : 'warning', title: 'HSE evidence reviewed', summary: `${String(proof.file_name || proof.proof_stage || proof.id)} marked ${review.review_status.replaceAll('_', ' ')}.`, created_by_profile_id: actorId });
        return Response.json({ ok:true, record: review }, { headers:corsHeaders });
      }
    }

    if (entity === 'hse_packet_event') {
      const patch = {
        packet_id: asNullableText(body.packet_id),
        event_type: body.event_type ?? 'note',
        event_status: body.event_status ?? 'ok',
        event_at: asNullableDateTime(body.event_at) || new Date().toISOString(),
        weather_condition: body.weather_condition ?? null,
        temperature_c: asNullableNumber(body.temperature_c),
        humidex_c: asNullableNumber(body.humidex_c),
        wind_kph: asNullableNumber(body.wind_kph),
        precipitation_notes: body.precipitation_notes ?? null,
        heat_risk_level: body.heat_risk_level ?? null,
        chemical_name: body.chemical_name ?? null,
        sds_reviewed: asNullableBool(body.sds_reviewed),
        ppe_verified: asNullableBool(body.ppe_verified),
        traffic_control_level: body.traffic_control_level ?? null,
        public_interaction_notes: body.public_interaction_notes ?? null,
        notes: body.notes ?? null,
        proof_url: body.proof_url ?? null,
        created_by_profile_id: actorId,
        updated_at: new Date().toISOString(),
      };
      if (!patch.packet_id) return Response.json({ ok:false, error:'packet_id is required' }, { status:400, headers:corsHeaders });
      if (action === 'create') {
        const { data, error } = await supabase.from('hse_packet_events').insert(patch).select('*').single();
        if (error) throw error;
        return Response.json({ ok:true, record:data }, { headers:corsHeaders });
      }
      if (action === 'update') {
        const { data, error } = await supabase.from('hse_packet_events').update(patch).eq('id', body.item_id).select('*').single();
        if (error) throw error;
        return Response.json({ ok:true, record:data }, { headers:corsHeaders });
      }
      if (action === 'delete') {
        const { error } = await supabase.from('hse_packet_events').delete().eq('id', body.item_id);
        if (error) throw error;
        return Response.json({ ok:true }, { headers:corsHeaders });
      }
    }

    if (entity === 'field_upload_failure') {
      const patch = {
        retry_status: body.retry_status ?? 'pending',
        resolution_notes: body.resolution_notes ?? null,
        retry_owner_profile_id: asNullableText(body.retry_owner_profile_id),
        retry_owner_notes: body.retry_owner_notes ?? null,
        upload_attempts: asNumber(body.upload_attempts, 0),
        last_retry_at: asNullableDateTime(body.last_retry_at),
        next_retry_after: asNullableDateTime(body.next_retry_after),
        resolved_by_profile_id: ['resolved','abandoned'].includes(String(body.retry_status || '')) ? actorId : null,
        updated_at: new Date().toISOString(),
      };
      if (action === 'update') {
        const { data, error } = await supabase.from('field_upload_failures').update(patch).eq('id', body.item_id).select('*').single();
        if (error) throw error;
        return Response.json({ ok:true, record:data }, { headers:corsHeaders });
      }
      if (action === 'delete') {
        const { error } = await supabase.from('field_upload_failures').delete().eq('id', body.item_id);
        if (error) throw error;
        return Response.json({ ok:true }, { headers:corsHeaders });
      }
    }


    if (entity === 'backend_monitor_event') {
      const patch = {
        lifecycle_status: body.lifecycle_status ?? 'open',
        severity: body.severity ?? 'warning',
        resolution_notes: body.resolution_notes ?? null,
        resolved_by_profile_id: ['resolved','dismissed'].includes(String(body.lifecycle_status || '')) ? actorId : null,
        updated_at: new Date().toISOString(),
      };
      if (action === 'update') {
        const { data, error } = await supabase.from('backend_monitor_events').update(patch).eq('id', body.item_id).select('*').single();
        if (error) throw error;
        return Response.json({ ok:true, record:data }, { headers:corsHeaders });
      }
      if (action === 'delete') {
        const { error } = await supabase.from('backend_monitor_events').delete().eq('id', body.item_id);
        if (error) throw error;
        return Response.json({ ok:true }, { headers:corsHeaders });
      }
    }

    if (entity === 'app_traffic_event') {
      if (action === 'delete') {
        const { error } = await supabase.from('app_traffic_events').delete().eq('id', body.item_id);
        if (error) throw error;
        return Response.json({ ok:true }, { headers:corsHeaders });
      }
    }

    if (entity === 'material_issue_line') {
      const quantity = asNumber(body.quantity, 0);
      const patch = {
        issue_id: asNullableText(body.issue_id),
        line_order: asNumber(body.line_order, 0),
        material_id: asNullableText(body.material_id),
        work_order_line_id: asNullableText(body.work_order_line_id),
        description: body.description ?? null,
        unit_id: asNullableText(body.unit_id),
        quantity,
        unit_cost: asNumber(body.unit_cost, 0),
        line_total: asNumber(body.line_total, quantity * asNumber(body.unit_cost, 0)),
        cost_code_id: asNullableText(body.cost_code_id),
        notes: body.notes ?? null,
        updated_at: new Date().toISOString(),
      };
      if (patch.work_order_line_id) {
        const workOrderLine = await getWorkOrderLineDefaults(supabase, patch.work_order_line_id);
        if (workOrderLine) {
          if (!patch.description) patch.description = workOrderLine.description;
          if (!patch.unit_id) patch.unit_id = workOrderLine.unit_id || null;
          if (!patch.material_id) patch.material_id = workOrderLine.material_id || null;
          if (!patch.cost_code_id) patch.cost_code_id = workOrderLine.cost_code_id || null;
          if (!asNullableNumber(body.unit_cost)) patch.unit_cost = asNumber(workOrderLine.unit_cost, patch.unit_cost);
        }
      }
      if (patch.material_id) {
        const material = await getMaterialDefaults(supabase, patch.material_id);
        if (material) {
          if (!patch.description) patch.description = material.item_name;
          if (!patch.unit_id) patch.unit_id = material.unit_id || null;
          if (!asNullableNumber(body.unit_cost)) patch.unit_cost = asNumber(material.default_unit_cost, patch.unit_cost);
          if (!patch.cost_code_id) patch.cost_code_id = await getCostCodeIdByCode(supabase, 'MAT');
        }
      }
      patch.line_total = asNumber(body.line_total, patch.quantity * patch.unit_cost);
      if (!patch.issue_id || !patch.description) return Response.json({ ok:false, error:'issue_id and description are required' }, { status:400, headers:corsHeaders });
      if (action === 'create') {
        const { data, error } = await supabase.from('material_issue_lines').insert(patch).select('*').single();
        if (error) throw error;
        return Response.json({ ok:true, record:data }, { headers:corsHeaders });
      }
      if (action === 'update') {
        const { data, error } = await supabase.from('material_issue_lines').update(patch).eq('id', body.item_id).select('*').single();
        if (error) throw error;
        return Response.json({ ok:true, record:data }, { headers:corsHeaders });
      }
      if (action === 'delete') {
        const { error } = await supabase.from('material_issue_lines').delete().eq('id', body.item_id);
        if (error) throw error;
        return Response.json({ ok:true }, { headers:corsHeaders });
      }
    }


    if (entity === 'estimate' && action === 'convert_to_agreement') {
      const estimate = await fetchSingle(supabase, 'estimates', body.item_id);
      if (!estimate?.id) return Response.json({ ok:false, error:'Estimate not found.' }, { status:404, headers:corsHeaders });
      const agreementCode = `AGR-${String(estimate.estimate_number || estimate.id).replace(/[^A-Z0-9-]/gi, '').toUpperCase()}`;
      const { data, error } = await supabase.from('recurring_service_agreements').insert({
        agreement_code: agreementCode,
        estimate_id: estimate.id,
        client_id: estimate.client_id || null,
        client_site_id: estimate.client_site_id || null,
        service_name: estimate.scope_notes || estimate.estimate_type || `Agreement from ${estimate.estimate_number || estimate.id}`,
        agreement_status: 'draft',
        billing_method: 'per_visit',
        visit_cost_total: Number(estimate.subtotal || 0),
        visit_charge_total: Number(estimate.total_amount || estimate.subtotal || 0),
        agreement_notes: estimate.terms_notes || null,
        created_by_profile_id: actorId,
        updated_at: new Date().toISOString(),
      }).select('*').single();
      if (error) throw error;
      await recordSiteActivity(supabase, { event_type:'agreement_created', entity_type:'recurring_service_agreement', entity_id:data.id, severity:'success', title:'Agreement created from estimate', summary:`${estimate.estimate_number || estimate.id} converted into ${data.agreement_code}.`, created_by_profile_id: actorId });
      return Response.json({ ok:true, record:data }, { headers:corsHeaders });
    }

    if (entity === 'service_contract_document' && action === 'generate_from_source') {
      const sourceEntity = String(body.source_entity || '').trim();
      const sourceId = body.source_id;
      let source: any = null;
      if (sourceEntity === 'estimate') source = await fetchSingle(supabase, 'estimates', sourceId);
      if (sourceEntity === 'recurring_service_agreement') source = await fetchSingle(supabase, 'recurring_service_agreements', sourceId);
      if (sourceEntity === 'job') source = await fetchSingle(supabase, 'jobs', sourceId);
      if (!source) return Response.json({ ok:false, error:'Source record not found.' }, { status:404, headers:corsHeaders });
      const kind = String(body.document_kind || 'contract');
      const title = kind === 'application' ? 'Service Application' : (kind === 'change_order' ? 'Change Order' : 'Service Contract');
      const documentNumber = makeDocumentNumber(kind === 'application' ? 'APP' : 'CTR');
      const sections = [
        { heading: 'Customer / Site', body: `<p><strong>Client:</strong> ${escHtml(source.client_id || source.client_name || '')}</p><p><strong>Site:</strong> ${escHtml(source.client_site_id || source.site_name || '')}</p>` },
        { heading: 'Service Scope', body: `<p>${escHtml(source.service_name || source.job_name || source.scope_notes || source.estimate_type || '')}</p>` },
        { heading: 'Pricing', body: `<p><strong>Estimated Cost:</strong> ${money(source.visit_cost_total || source.subtotal || source.estimated_cost_total || 0)}</p><p><strong>Charge:</strong> ${money(source.visit_charge_total || source.total_amount || source.quoted_charge_total || 0)}</p>` },
        { heading: 'Terms', body: `<p>${escHtml(source.agreement_notes || source.terms_notes || source.service_notes || 'Service terms subject to signed approval.')}</p>` },
        { heading: 'Acceptance', body: '<p>Authorized signature: ____________________________ Date: ____________________</p>' }
      ];
      const html = makeContractHtml({ title, subtitle: `${documentNumber} · Customer-ready draft`, sections, footer: 'Generated by YW Alpha Admin.' });
      const renderedText = sections.map((s) => `${s.heading}\n${s.body.replace(/<[^>]+>/g, ' ')}`).join('\n\n');
      const insertPatch = {
        document_number: documentNumber,
        source_entity: sourceEntity || 'manual',
        source_id: String(sourceId || source.id || ''),
        estimate_id: sourceEntity === 'estimate' ? source.id : (source.estimate_id || null),
        agreement_id: sourceEntity === 'recurring_service_agreement' ? source.id : (source.agreement_id || null),
        job_id: sourceEntity === 'job' ? source.id : (source.job_id || null),
        client_id: source.client_id || null,
        client_site_id: source.client_site_id || null,
        document_kind: kind,
        document_status: 'draft',
        title: `${title} ${source.agreement_code || source.estimate_number || source.job_code || ''}`.trim(),
        contract_reference: source.agreement_code || source.estimate_number || source.job_code || documentNumber,
        effective_date: source.start_date || source.valid_until || new Date().toISOString().slice(0,10),
        expiry_date: source.end_date || null,
        issued_at: new Date().toISOString(),
        rendered_html: html,
        rendered_text: renderedText,
        payload: { source_snapshot: source },
        notes: body.notes || null,
        created_by_profile_id: actorId,
        updated_at: new Date().toISOString(),
      };
      const { data, error } = await supabase.from('service_contract_documents').insert(insertPatch).select('*').single();
      if (error) throw error;
      if (sourceEntity === 'recurring_service_agreement') await supabase.from('recurring_service_agreements').update({ contract_document_id: data.id, updated_at: new Date().toISOString() }).eq('id', source.id);
      await recordSiteActivity(supabase, { event_type:'contract_document_created', entity_type:'service_contract_document', entity_id:data.id, severity:'success', title:'Printable document generated', summary:`${data.document_number} was generated from ${sourceEntity}.`, created_by_profile_id: actorId });
      return Response.json({ ok:true, record:data }, { headers:corsHeaders });
    }

    if (entity === 'snow_event_trigger' && action === 'generate_invoice') {
      const trigger = await fetchSingle(supabase, 'snow_event_triggers', body.item_id);
      if (!trigger?.id) return Response.json({ ok:false, error:'Snow trigger not found.' }, { status:404, headers:corsHeaders });
      const agreement = await fetchSingle(supabase, 'recurring_service_agreements', trigger.agreement_id);
      if (!agreement?.id) return Response.json({ ok:false, error:'Linked agreement not found.' }, { status:404, headers:corsHeaders });
      const existing = await supabase.from('ar_invoices').select('id,invoice_number').eq('snow_event_trigger_id', trigger.id).maybeSingle();
      if (existing?.data?.id) return Response.json({ ok:true, record: existing.data }, { headers:corsHeaders });
      const subtotal = Number(agreement.visit_charge_total || 0);
      const taxCode = agreement.tax_code_id ? await fetchSingle(supabase, 'tax_codes', agreement.tax_code_id) : null;
      const taxRate = Number(taxCode?.rate_percent || 0);
      const tax = Math.round((subtotal * taxRate) * 100) / 10000 * 100;
      const invoiceNo = makeDocumentNumber('INV');
      const { data, error } = await supabase.from('ar_invoices').insert({
        invoice_number: invoiceNo,
        client_id: agreement.client_id || null,
        recurring_service_agreement_id: agreement.id,
        snow_event_trigger_id: trigger.id,
        invoice_source: 'agreement_snow',
        invoice_status: 'draft',
        invoice_date: trigger.event_date || new Date().toISOString().slice(0,10),
        subtotal,
        tax_total: Number((subtotal * (taxRate / 100)).toFixed(2)),
        total_amount: Number((subtotal * (1 + taxRate / 100)).toFixed(2)),
        balance_due: Number((subtotal * (1 + taxRate / 100)).toFixed(2)),
        created_by_profile_id: actorId,
        updated_at: new Date().toISOString(),
      }).select('*').single();
      if (error) throw error;
      return Response.json({ ok:true, record:data }, { headers:corsHeaders });
    }

    if (entity === 'payroll_export_run' && action === 'generate_export') {
      const run = await fetchSingle(supabase, 'payroll_export_runs', body.item_id);
      if (!run?.id) return Response.json({ ok:false, error:'Payroll export run not found.' }, { status:404, headers:corsHeaders });
      const { data: rows, error: rowsError } = await supabase.from('v_payroll_review_detail').select('*').gte('session_date', run.period_start).lte('session_date', run.period_end).order('session_date', { ascending: true });
      if (rowsError) throw rowsError;
      const hours = (rows || []).reduce((sum: number, row: any) => sum + Number(row?.hours_worked || 0), 0);
      const cost = (rows || []).reduce((sum: number, row: any) => sum + Number(row?.payroll_cost_total || 0), 0);
      const normalizedProvider = normalizePayrollExportProvider(run.export_provider || 'generic_csv');
      const exportPayload = buildPayrollExportContent(rows || [], normalizedProvider, run.export_format || 'csv');
      const fileName = `${run.run_code || 'payroll-export'}-${String(normalizedProvider || 'generic_csv')}.${String(exportPayload.fileName || '').split('.').pop() || 'csv'}`;
      const exportedAt = new Date().toISOString();
      const { data, error } = await supabase.from('payroll_export_runs').update({ export_provider: normalizedProvider, export_file_name: fileName, export_file_content: exportPayload.content, export_mime_type: exportPayload.mimeType, exported_entry_count: (rows || []).length, exported_hours_total: Number(hours.toFixed(2)), exported_payroll_cost_total: Number(cost.toFixed(2)), exported_at: exportedAt, exported_by_profile_id: actorId, status: 'exported', delivery_status: 'pending', delivery_confirmed_at: null, payroll_close_status: 'open', payroll_closed_at: null, payroll_closed_by_profile_id: null, updated_at: exportedAt }).eq('id', run.id).select('*').single();
      if (error) throw error;
      await supabase.from('job_session_crew_hours').update({ payroll_export_run_id: run.id, payroll_exported_at: new Date().toISOString(), updated_at: new Date().toISOString() }).gte('created_at', `${run.period_start}T00:00:00`).lte('created_at', `${run.period_end}T23:59:59`).is('payroll_export_run_id', null);
      await recordSiteActivity(supabase, { event_type:'payroll_export_generated', entity_type:'payroll_export_run', entity_id:data.id, severity:'success', title:'Payroll export generated', summary:`${data.run_code} generated ${data.exported_entry_count || 0} row(s) using ${data.export_provider || 'generic_csv'}.`, created_by_profile_id: actorId });
      return Response.json({ ok:true, record:data, export_file_name:fileName, export_file_content:exportPayload.content, export_mime_type: exportPayload.mimeType }, { headers:corsHeaders });
    }


    if (entity === 'payroll_export_run' && action === 'mark_delivered') {
      const run = await fetchSingle(supabase, 'payroll_export_runs', body.item_id);
      if (!run?.id) return Response.json({ ok:false, error:'Payroll export run not found.' }, { status:404, headers:corsHeaders });
      if (!run.exported_at) return Response.json({ ok:false, error:'Generate the payroll export before marking it delivered.' }, { status:400, headers:corsHeaders });
      const nowIso = new Date().toISOString();
      const nextStatus = String(body.delivery_status || 'confirmed').toLowerCase() === 'delivered' ? 'delivered' : 'confirmed';
      const deliveryReference = String(body.delivery_reference ?? run.delivery_reference ?? '').trim();
      const deliveryNotes = String(body.delivery_notes ?? run.delivery_notes ?? '').trim();
      if (nextStatus === 'delivered' && !deliveryReference) return Response.json({ ok:false, error:'Add a delivery reference or batch ID before marking this payroll export delivered.' }, { status:400, headers:corsHeaders });
      if (nextStatus === 'confirmed' && !['delivered','confirmed'].includes(String(run.delivery_status || '').toLowerCase())) return Response.json({ ok:false, error:'Mark this payroll export delivered before confirming receipt.' }, { status:400, headers:corsHeaders });
      if (nextStatus === 'confirmed' && !deliveryReference) return Response.json({ ok:false, error:'Keep the delivery reference on the payroll run before confirming receipt.' }, { status:400, headers:corsHeaders });
      const { data, error } = await supabase.from('payroll_export_runs').update({ delivery_status: nextStatus, delivery_reference: deliveryReference || null, delivery_notes: deliveryNotes || null, delivered_at: run.delivered_at || nowIso, delivered_by_profile_id: run.delivered_by_profile_id || actorId, delivery_confirmed_at: nextStatus === 'confirmed' ? nowIso : run.delivery_confirmed_at, payroll_close_status: nextStatus === 'confirmed' ? 'ready_to_close' : (run.payroll_close_status || 'open'), updated_at: nowIso }).eq('id', run.id).select('*').single();
      if (error) throw error;
      await recordSiteActivity(supabase, { event_type: nextStatus === 'confirmed' ? 'payroll_export_confirmed' : 'payroll_export_delivered', entity_type:'payroll_export_run', entity_id:data.id, severity:'success', title: nextStatus === 'confirmed' ? 'Payroll export receipt confirmed' : 'Payroll export delivery recorded', summary:`${data.run_code || data.id} marked ${data.delivery_status}.`, created_by_profile_id: actorId });
      return Response.json({ ok:true, record:data }, { headers:corsHeaders });
    }

    if (entity === 'payroll_export_run' && action === 'close_run') {
      const run = await fetchSingle(supabase, 'payroll_export_runs', body.item_id);
      if (!run?.id) return Response.json({ ok:false, error:'Payroll export run not found.' }, { status:404, headers:corsHeaders });
      if (!run.exported_at || String(run.delivery_status || '').toLowerCase() !== 'confirmed') return Response.json({ ok:false, error:'Confirm delivery before closing this payroll run.' }, { status:400, headers:corsHeaders });
      const closeNotes = String(body.payroll_close_notes ?? run.payroll_close_notes ?? '').trim();
      if (!closeNotes) return Response.json({ ok:false, error:'Add a payroll close signoff note before closing this payroll run.' }, { status:400, headers:corsHeaders });
      const nowIso = new Date().toISOString();
      const { data, error } = await supabase.from('payroll_export_runs').update({ payroll_close_status: 'closed', payroll_closed_at: nowIso, payroll_closed_by_profile_id: actorId, payroll_close_notes: closeNotes, updated_at: nowIso }).eq('id', run.id).select('*').single();
      if (error) throw error;
      await recordSiteActivity(supabase, { event_type:'payroll_export_closed', entity_type:'payroll_export_run', entity_id:data.id, severity:'success', title:'Payroll export closed', summary:`${data.run_code || data.id} was signed off as closed.`, created_by_profile_id: actorId });
      return Response.json({ ok:true, record:data }, { headers:corsHeaders });
    }

    if (entity === 'service_contract_document' && action === 'kickoff_live_job_from_signed') {
      const contract = await fetchSingle(supabase, 'service_contract_documents', body.item_id);
      if (!contract?.id) return Response.json({ ok:false, error:'Service contract document not found.' }, { status:404, headers:corsHeaders });
      if (!(String(contract.document_status || '') === 'signed' || contract.signed_at)) return Response.json({ ok:false, error:'The contract must be signed before kickoff.' }, { status:400, headers:corsHeaders });
      const agreement = contract.agreement_id ? await fetchSingle(supabase, 'recurring_service_agreements', contract.agreement_id) : null;
      const estimate = contract.estimate_id ? await fetchSingle(supabase, 'estimates', contract.estimate_id) : null;
      let jobId = contract.job_id || null;
      let linkedExistingJob = false;
      let jobCreated = false;
      let workOrderCreated = false;
      let firstSessionCreated = false;
      if (!jobId) {
        const serviceRef = agreement?.agreement_code || contract.contract_reference || contract.document_number || null;
        const existingJob = serviceRef ? (await supabase.from('jobs').select('*').ilike('service_contract_reference', serviceRef).limit(1).maybeSingle()).data : null;
        if (existingJob?.id) {
          jobId = existingJob.id;
          linkedExistingJob = true;
        } else {
          const jobCode = makeSlugCode('JOB', agreement?.agreement_code || contract.document_number || contract.contract_reference || contract.id);
          const jobName = String(agreement?.service_name || contract.title || 'Signed Contract Job').trim();
          const { data: createdJob, error: jobError } = await supabase.from('jobs').insert({
            job_code: jobCode,
            job_name: jobName,
            status: 'planned',
            priority: 'normal',
            client_name: estimate?.client_name || null,
            start_date: pickSuggestedFirstSessionDate(contract, agreement),
            end_date: agreement?.end_date || null,
            crew_id: agreement?.crew_id || null,
            service_contract_reference: serviceRef,
            client_reference: contract.document_number || null,
            notes: `Kickoff created from signed contract ${contract.document_number || contract.id}.`,
            created_by_profile_id: actorId,
            updated_at: new Date().toISOString(),
          }).select('*').single();
          if (jobError) throw jobError;
          jobId = createdJob.id;
          jobCreated = true;
          await recordSiteActivity(supabase, { event_type:'signed_contract_job_created', entity_type:'job', entity_id: createdJob.id, severity:'success', title:'Live job created from signed contract', summary:`${createdJob.job_code} was created from ${contract.document_number || contract.id}.`, created_by_profile_id: actorId });
        }
      }

      let workOrder = jobId ? (await supabase.from('work_orders').select('*').eq('legacy_job_id', jobId).order('created_at', { ascending: false }).limit(1).maybeSingle()).data : null;
      if (!workOrder?.id) {
        const workOrderNumber = makeSlugCode('WO', agreement?.agreement_code || contract.document_number || contract.contract_reference || contract.id);
        const scheduledDate = pickSuggestedFirstSessionDate(contract, agreement);
        const { data: createdWo, error: workOrderError } = await supabase.from('work_orders').insert({
          work_order_number: workOrderNumber,
          estimate_id: contract.estimate_id || null,
          client_id: contract.client_id || null,
          client_site_id: contract.client_site_id || null,
          legacy_job_id: jobId,
          work_type: 'service',
          status: 'scheduled',
          scheduled_start: `${scheduledDate}T08:00:00`,
          scheduled_end: `${scheduledDate}T10:00:00`,
          route_id: agreement?.route_id || null,
          supervisor_profile_id: null,
          crew_notes: agreement?.service_notes || null,
          customer_notes: contract.notes || null,
          safety_notes: agreement?.trigger_notes || null,
          subtotal: Number(agreement?.visit_charge_total || estimate?.subtotal || 0),
          tax_total: Number(estimate?.tax_total || 0),
          total_amount: Number(agreement?.visit_charge_total || estimate?.total_amount || 0),
          created_by_profile_id: actorId,
          updated_at: new Date().toISOString(),
        }).select('*').single();
        if (workOrderError) throw workOrderError;
        workOrder = createdWo;
        workOrderCreated = true;
      }

      const firstSessionDate = pickSuggestedFirstSessionDate(contract, agreement);
      const existingSession = jobId ? (await supabase.from('job_sessions').select('id').eq('job_id', jobId).eq('session_date', firstSessionDate).limit(1).maybeSingle()).data : null;
      let sessionRecord = existingSession || null;
      if (jobId && !existingSession?.id) {
        const { data: createdSession, error: sessionError } = await supabase.from('job_sessions').insert({
          job_id: jobId,
          session_date: firstSessionDate,
          session_kind: 'scheduled_service',
          session_status: 'planned',
          service_frequency_label: agreement?.service_name || contract.title || 'scheduled_service',
          notes: `First planned session created from signed contract ${contract.document_number || contract.id}.`,
          created_by_profile_id: actorId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }).select('*').single();
        if (sessionError) throw sessionError;
        sessionRecord = createdSession;
        firstSessionCreated = true;
      }

      const { data: updatedContract, error: updateContractError } = await supabase.from('service_contract_documents').update({ job_id: jobId, updated_at: new Date().toISOString() }).eq('id', contract.id).select('*').single();
      if (updateContractError) throw updateContractError;
      await recordSiteActivity(supabase, { event_type:'signed_contract_kickoff_completed', entity_type:'service_contract_document', entity_id: contract.id, severity:'success', title:'Signed contract kickoff completed', summary:`${contract.document_number || contract.id} linked to live job/work order scheduling.`, related_job_id: jobId || null, created_by_profile_id: actorId });
      return Response.json({ ok:true, record: updatedContract, job_id: jobId, work_order: workOrder, first_session: sessionRecord, linked_existing_job: linkedExistingJob, job_created: jobCreated, work_order_created: workOrderCreated, first_session_created: firstSessionCreated }, { headers:corsHeaders });
    }


    if (entity === 'service_contract_document' && action === 'generate_invoice_from_signed') {
      const contract = await fetchSingle(supabase, 'service_contract_documents', body.item_id);
      if (!contract?.id) return Response.json({ ok:false, error:'Service contract document not found.' }, { status:404, headers:corsHeaders });
      if (!(String(contract.document_status || '') === 'signed' || contract.signed_at)) {
        return Response.json({ ok:false, error:'The service contract must be signed before generating an invoice.' }, { status:400, headers:corsHeaders });
      }
      const invoice = await createInvoiceFromSignedContract(supabase, contract, actorId);
      await recordSiteActivity(supabase, { event_type:'signed_contract_invoice_generated', entity_type:'ar_invoice', entity_id:invoice.id, severity:'success', title:'Invoice generated from signed contract', summary:`${contract.document_number || contract.id} generated invoice ${invoice.invoice_number || invoice.id}.`, created_by_profile_id: actorId });
      return Response.json({ ok:true, record:invoice }, { headers:corsHeaders });
    }

    if (entity === 'recurring_service_agreement' && action === 'run_scheduler') {
      const agreement = await fetchSingle(supabase, 'recurring_service_agreements', body.item_id);
      if (!agreement?.id) return Response.json({ ok:false, error:'Recurring agreement not found.' }, { status:404, headers:corsHeaders });
      const result = await runServiceExecutionScheduler(supabase, actorId, agreement.id);
      return Response.json({ ok:true, record: agreement, scheduler_run: result.run, created_count: result.createdCount, invoice_candidate_count: result.invoiceCandidateCount, skipped_count: result.skippedCount }, { headers:corsHeaders });
    }
    return Response.json({ ok: false, error: 'Unsupported entity/action' }, { status: 400, headers: corsHeaders });
  } catch (error) {
    return Response.json({ ok: false, error: String(error) }, { status: 500, headers: corsHeaders });
  }
});
