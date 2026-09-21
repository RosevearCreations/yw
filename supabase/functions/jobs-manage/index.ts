// Detailed Edge Function: jobs-manage
// Purpose:
// - Create/update jobs and equipment records
// - Reserve equipment for jobs using real quantity-pool checks across overlapping jobs
// - Check equipment out to jobs and return it
// - Queue approval/conflict notifications and send email when configured

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { hasModuleAccess } from "../_shared/module-permissions.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};


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

function roleRank(role: string) {
  return { worker:10, employee:10, staff:15, onsite_admin:18, site_leader:20, supervisor:30, hse:40, job_admin:45, admin:50 }[role] ?? 0;
}
function normalizePoolKey(value?: string | null) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
}
function overlaps(aStart?: string | null, aEnd?: string | null, bStart?: string | null, bEnd?: string | null, aOpenEnd = false, bOpenEnd = false) {
  const a1 = aStart || '1900-01-01';
  const a2 = aOpenEnd ? '2999-12-31' : (aEnd || aStart || '2999-12-31');
  const b1 = bStart || '1900-01-01';
  const b2 = bOpenEnd ? '2999-12-31' : (bEnd || bStart || '2999-12-31');
  return a1 <= b2 && b1 <= a2;
}
async function resolveProfileIdByNameOrEmail(supabase: any, value?: string | null) {
  const clean = String(value || '').trim();
  if (!clean) return null;
  let { data } = await supabase.from('profiles').select('id').ilike('email', clean).limit(1).maybeSingle();
  if (data?.id) return data.id;
  ({ data } = await supabase.from('profiles').select('id').ilike('full_name', clean).limit(1).maybeSingle());
  return data?.id || null;
}
async function resolveSiteIdByCodeOrName(supabase: any, value?: string | null) {
  const clean = String(value || '').trim();
  if (!clean) return null;
  let { data } = await supabase.from('sites').select('id').ilike('site_code', clean.split(' — ')[0]).limit(1).maybeSingle();
  if (data?.id) return data.id;
  ({ data } = await supabase.from('sites').select('id').ilike('site_name', clean).limit(1).maybeSingle());
  return data?.id || null;
}
async function resolveJobIdByCode(supabase: any, code?: string | null) {
  const clean = String(code || '').trim();
  if (!clean) return null;
  const { data } = await supabase.from('jobs').select('id').eq('job_code', clean).limit(1).maybeSingle();
  return data?.id || null;
}
async function resolveEquipmentIdByCode(supabase: any, code?: string | null) {
  const clean = String(code || '').trim();
  if (!clean) return null;
  const { data } = await supabase.from('equipment_items').select('id').eq('equipment_code', clean).limit(1).maybeSingle();
  return data?.id || null;
}

async function resolveCrewIdByNameOrCode(supabase: any, value?: string | null) {
  const clean = String(value || '').trim();
  if (!clean) return null;
  let { data } = await supabase.from('crews').select('id').ilike('crew_code', clean).limit(1).maybeSingle();
  if (data?.id) return data.id;
  ({ data } = await supabase.from('crews').select('id').ilike('crew_name', clean).limit(1).maybeSingle());
  return data?.id || null;
}
function parsePeopleList(value?: string | string[] | null) {
  if (Array.isArray(value)) return value.map((item) => String(item || '').trim()).filter(Boolean);
  return String(value || '').split(/[\n,;]+/).map((item) => item.trim()).filter(Boolean);
}
async function ensureCrewRecord(supabase: any, payload: any) {
  const crewId = String(payload?.crew_id || '').trim();
  const crewName = String(payload?.crew_name || '').trim();
  const crewCode = String(payload?.crew_code || '').trim();
  const supervisorId = payload?.supervisor_profile_id || null;
  const leadId = payload?.lead_profile_id || null;
  const serviceAreaId = payload?.service_area_id || null;
  const crewKind = String(payload?.crew_kind || 'general').trim() || 'general';
  const defaultEquipmentNotes = payload?.default_equipment_notes ?? null;
  const notes = payload?.notes ?? null;
  if (crewId) {
    await supabase.from('crews').update({ supervisor_profile_id: supervisorId, lead_profile_id: leadId, service_area_id: serviceAreaId, crew_kind: crewKind, default_equipment_notes: defaultEquipmentNotes, notes, updated_at: new Date().toISOString() }).eq('id', crewId);
    return crewId;
  }
  if (!crewName && !crewCode) return null;
  let existingId = null;
  if (crewCode) existingId = await resolveCrewIdByNameOrCode(supabase, crewCode);
  if (!existingId && crewName) existingId = await resolveCrewIdByNameOrCode(supabase, crewName);
  if (existingId) {
    await supabase.from('crews').update({
      crew_code: crewCode || null,
      crew_name: crewName || crewCode || 'Crew',
      supervisor_profile_id: supervisorId,
      lead_profile_id: leadId,
      service_area_id: serviceAreaId,
      crew_kind: crewKind,
      default_equipment_notes: defaultEquipmentNotes,
      notes,
      updated_at: new Date().toISOString()
    }).eq('id', existingId);
    return existingId;
  }
  const { data, error } = await supabase.from('crews').insert({
    crew_code: crewCode || null,
    crew_name: crewName || crewCode || `Crew ${crypto.randomUUID().slice(0, 8)}`,
    supervisor_profile_id: supervisorId,
    lead_profile_id: leadId,
    service_area_id: serviceAreaId,
    crew_kind: crewKind,
    default_equipment_notes: defaultEquipmentNotes,
    notes,
    created_by_profile_id: payload?.actor_id || null
  }).select('id').single();
  if (error) throw error;
  return data?.id || null;
}
async function syncCrewMembers(supabase: any, crewId: string | null, members: string[] = [], actorId?: string | null, supervisorId?: string | null, leadId?: string | null) {
  if (!crewId) return;
  const desiredIds: string[] = [];
  if (supervisorId) desiredIds.push(String(supervisorId));
  if (leadId) desiredIds.push(String(leadId));
  for (const value of members) {
    const id = await resolveProfileIdByNameOrEmail(supabase, value);
    if (id) desiredIds.push(String(id));
  }
  const uniqueIds = Array.from(new Set(desiredIds.filter(Boolean)));
  if (!uniqueIds.length) return;
  await supabase.from('crew_members').delete().eq('crew_id', crewId).not('profile_id', 'in', `(${uniqueIds.map((id) => `"${id}"`).join(',')})`);
  for (const id of uniqueIds) {
    const { data: existing } = await supabase.from('crew_members').select('id').eq('crew_id', crewId).eq('profile_id', id).maybeSingle();
    const patch = { crew_id: crewId, profile_id: id, member_role: id === supervisorId ? 'supervisor' : (id === leadId ? 'lead' : 'member'), is_primary: id === supervisorId || id === leadId, added_by_profile_id: actorId || null, updated_at: new Date().toISOString() };
    if (existing?.id) await supabase.from('crew_members').update(patch).eq('id', existing.id);
    else await supabase.from('crew_members').insert(patch);
  }
}

function hasValue(value: unknown) {
  return !(value === null || value === undefined || (typeof value === 'string' && value.trim() === ''));
}

function normalizeMoney(value: unknown, fallback = 0) {
  const n = Number(value);
  if (!Number.isFinite(n)) return Number(fallback.toFixed ? fallback.toFixed(2) : fallback);
  return Number(n.toFixed(2));
}
async function loadServicePricingTemplate(supabase: any, templateId?: string | null) {
  const id = String(templateId || '').trim();
  if (!id) return null;
  const { data } = await supabase.from('service_pricing_templates').select('*').eq('id', id).maybeSingle();
  return data || null;
}

async function loadSalesTaxCode(supabase: any, taxCodeId?: string | null) {
  const id = String(taxCodeId || '').trim();
  if (id) {
    const { data } = await supabase.from('tax_codes').select('*').eq('id', id).maybeSingle();
    if (data) return data;
  }
  const { data: settings } = await supabase.from('business_tax_settings').select('default_sales_tax_code_id').order('updated_at', { ascending: false }).limit(1).maybeSingle();
  if (settings?.default_sales_tax_code_id) {
    const { data } = await supabase.from('tax_codes').select('*').eq('id', settings.default_sales_tax_code_id).maybeSingle();
    if (data) return data;
  }
  const { data } = await supabase.from('tax_codes').select('*').eq('is_default', true).in('applies_to', ['sale', 'both']).order('rate_percent', { ascending: false }).limit(1).maybeSingle();
  return data || null;
}

async function computeJobPricing(supabase: any, body: any, template: any = null) {
  const cost = normalizeMoney(hasValue(body?.estimated_cost_total) ? body?.estimated_cost_total : (template?.default_estimated_cost_total || 0), 0);
  const pricingMethod = String(hasValue(body?.pricing_method) ? body?.pricing_method : (template?.default_pricing_method || 'manual')).trim() || 'manual';
  const markupPercentRaw = hasValue(body?.markup_percent) ? body?.markup_percent : template?.default_markup_percent;
  const markupPercent = Number(markupPercentRaw || 0);
  const discountMode = String(hasValue(body?.discount_mode) ? body?.discount_mode : (template?.default_discount_mode || 'none')).trim() || 'none';
  const discountValue = normalizeMoney(hasValue(body?.discount_value) ? body?.discount_value : (template?.default_discount_value || 0), 0);
  let quoted = normalizeMoney(hasValue(body?.quoted_charge_total) ? body?.quoted_charge_total : (template?.default_quoted_charge_total || 0), 0);
  if (pricingMethod === 'markup_percent' && Number.isFinite(markupPercent)) {
    quoted = normalizeMoney(cost * (1 + (markupPercent / 100)), quoted);
  }
  if (discountMode === 'percent' && discountValue > 0) {
    quoted = normalizeMoney(quoted * Math.max(0, 1 - (discountValue / 100)), quoted);
  } else if (discountMode === 'fixed' && discountValue > 0) {
    quoted = normalizeMoney(Math.max(0, quoted - discountValue), quoted);
  }
  const estimatedProfit = normalizeMoney(quoted - cost, 0);
  const estimatedMarginPercent = quoted > 0 ? Number(((estimatedProfit / quoted) * 100).toFixed(2)) : 0;
  const actualCost = normalizeMoney(body?.actual_cost_total || 0, 0);
  const actualCharge = normalizeMoney(body?.actual_charge_total || 0, 0);
  const delayCost = normalizeMoney(body?.delay_cost_total || 0, 0);
  const repairCost = normalizeMoney(body?.equipment_repair_cost_total || 0, 0);
  const actualProfit = normalizeMoney(actualCharge - actualCost - delayCost - repairCost, 0);
  const actualMarginPercent = actualCharge > 0 ? Number(((actualProfit / actualCharge) * 100).toFixed(2)) : 0;
  const salesTaxCode = await loadSalesTaxCode(supabase, body?.sales_tax_code_id || template?.sales_tax_code_id || null);
  const taxRatePercent = Number.isFinite(Number(body?.estimated_tax_rate_percent)) && hasValue(body?.estimated_tax_rate_percent)
    ? Number(Number(body?.estimated_tax_rate_percent).toFixed(3))
    : Number(Number(salesTaxCode?.rate_percent || 0).toFixed(3));
  const estimatedTaxTotal = normalizeMoney(quoted * (taxRatePercent / 100), 0);
  const estimatedTotalWithTax = normalizeMoney(quoted + estimatedTaxTotal, 0);
  return {
    estimated_cost_total: cost,
    quoted_charge_total: quoted,
    pricing_method: pricingMethod,
    markup_percent: Number.isFinite(markupPercent) ? Number(markupPercent.toFixed(2)) : null,
    discount_mode: discountMode,
    discount_value: discountValue,
    estimated_profit_total: estimatedProfit,
    estimated_margin_percent: estimatedMarginPercent,
    actual_cost_total: actualCost,
    actual_charge_total: actualCharge,
    delay_cost_total: delayCost,
    equipment_repair_cost_total: repairCost,
    actual_profit_total: actualProfit,
    actual_margin_percent: actualMarginPercent,
    sales_tax_code_id: salesTaxCode?.id || null,
    estimated_tax_rate_percent: taxRatePercent,
    estimated_tax_total: estimatedTaxTotal,
    estimated_total_with_tax: estimatedTotalWithTax,
    pricing_basis_label: template?.template_name || body?.pricing_basis_label || null,
    service_pricing_template_id: template?.id || (body?.service_pricing_template_id || null),
  };
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

async function sendEmailIfConfigured(notification: any) {
  const apiKey = Deno.env.get('RESEND_API_KEY');
  const from = Deno.env.get('RESEND_FROM_EMAIL') || Deno.env.get('EMAIL_FROM');
  const to = notification?.email_to || Deno.env.get('ADMIN_NOTIFICATION_TO');
  if (!apiKey || !from || !to) return { attempted: false, status: 'pending' };

  const subject = notification?.email_subject || notification?.title || 'YWI HSE notification';
  const text = notification?.body || notification?.message || JSON.stringify(notification?.payload || {});
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ from, to: String(to).split(/[;,]/).map((v) => v.trim()).filter(Boolean), subject, text })
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`Resend email failed: ${body}`);
  return { attempted: true, status: 'sent' };
}

async function insertEquipmentTransferEvent(supabase: any, payload: any) {
  try {
    const row = {
      equipment_item_id: payload.equipment_item_id,
      signout_id: payload.signout_id || null,
      job_id: payload.job_id || null,
      event_type: payload.event_type,
      from_site_id: payload.from_site_id || null,
      to_site_id: payload.to_site_id || null,
      test_status: payload.test_status || 'not_recorded',
      condition_status: payload.condition_status || null,
      verified_by_profile_id: payload.verified_by_profile_id || null,
      verification_notes: payload.verification_notes || null,
      event_payload: payload.event_payload || {},
    };
    await supabase.from('equipment_transfer_verification_events').insert(row);
  } catch {
    // Keep the field workflow alive even if the optional audit table is not migrated yet.
  }
}

function normalizeEquipmentTestStatus(value?: string | null) {
  const clean = String(value || 'not_recorded').trim();
  if (['passed','failed','needs_service','not_required'].includes(clean)) return clean;
  return 'not_recorded';
}

function isPassingEquipmentTest(value?: string | null) {
  const clean = normalizeEquipmentTestStatus(value);
  return clean === 'passed' || clean === 'not_required';
}

async function insertEquipmentServiceTask(supabase: any, payload: any) {
  try {
    const row = {
      equipment_item_id: payload.equipment_item_id,
      source_signout_id: payload.source_signout_id || null,
      source_event_id: payload.source_event_id || null,
      job_id: payload.job_id || null,
      task_type: payload.task_type || 'return_test_followup',
      task_status: payload.task_status || 'open',
      priority: payload.priority || 'high',
      failure_reason: payload.failure_reason || null,
      estimated_cost: payload.estimated_cost || 0,
      actual_cost: payload.actual_cost || 0,
      assigned_to_profile_id: payload.assigned_to_profile_id || null,
      due_at: payload.due_at || null,
      notes: payload.notes || null,
      created_by_profile_id: payload.created_by_profile_id || null,
    };
    await supabase.from('equipment_service_tasks').insert(row);
  } catch {
    // Optional schema 124 table. Do not block checkout/return if it has not been deployed yet.
  }
}

function normalizeAccessoryStatus(value?: string | null) {
  const clean = String(value || 'not_recorded').trim();
  if (['complete','missing','damaged','not_required'].includes(clean)) return clean;
  return 'not_recorded';
}

function normalizeJsonArray(value: any) {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return value.split(/[\n,]/).map((item) => item.trim()).filter(Boolean).map((item) => ({ item, checked: false }));
    }
  }
  return [];
}

async function insertNotification(supabase: any, row: any) {
  const payload = row?.payload || {};
  const insertRow = {
    notification_type: row.notification_type,
    recipient_role: row.recipient_role || 'admin',
    target_profile_id: row.target_profile_id || null,
    target_table: row.target_table || null,
    target_id: row.target_id != null ? String(row.target_id) : null,
    title: row.title || 'Notification',
    body: row.body || row.message || JSON.stringify(payload),
    message: row.message || row.body || JSON.stringify(payload),
    payload,
    status: row.status || 'queued',
    email_to: row.email_to || null,
    email_subject: row.email_subject || row.title || 'Notification',
    email_status: 'pending',
    created_by_profile_id: row.created_by_profile_id || null,
  };
  const { data, error } = await supabase.from('admin_notifications').insert(insertRow).select('*').single();
  if (error) throw error;
  try {
    const sent = await sendEmailIfConfigured(insertRow);
    if (sent.attempted) {
      await updateDeliveryState(supabase, data.id, 'email', 'resend', true, '');
      await supabase.from('admin_notifications').update({ status: 'sent', sent_at: new Date().toISOString() }).eq('id', data.id);
    }
  } catch (err) {
    await updateDeliveryState(supabase, data.id, 'email', 'resend', false, String(err));
    await supabase.from('admin_notifications').update({ status: 'failed' }).eq('id', data.id);
  }
  return data;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const supabase = createClient((Deno.env.get('SB_URL') || Deno.env.get('SUPABASE_URL'))!, (Deno.env.get('SB_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'))!);
  const token = (req.headers.get('Authorization') ?? '').replace('Bearer ', '');
  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData.user) return Response.json({ ok:false, error:'Unauthorized' }, { status:401, headers:corsHeaders });
  const { data: actorProfile } = await supabase.from('profiles').select('*').eq('id', userData.user.id).single();
  if (!actorProfile?.is_active) return Response.json({ ok:false, error:'Inactive profile' }, { status:403, headers:corsHeaders });
  if (!(await hasModuleAccess(supabase, actorProfile, 'jobs', 'create'))) return Response.json({ ok:false, error:'Jobs module create access is required.', module_key:'jobs', required_access:'create' }, { status:403, headers:corsHeaders });
  if (roleRank(actorProfile.role) < roleRank('supervisor')) return Response.json({ ok:false, error:'Supervisor+ role is required for Jobs management.' }, { status:403, headers:corsHeaders });

  const body = await req.json().catch(() => ({}));
  if (body.entity === 'job_financial_event' && !(await hasModuleAccess(supabase, actorProfile, 'finance', 'create'))) {
    return Response.json({ ok:false, error:'Finance module create access is required for job financial events.', module_key:'finance', required_access:'create' }, { status:403, headers:corsHeaders });
  }
  try {
    if (body.entity === 'job' && body.action === 'upsert') {
      const siteId = await resolveSiteIdByCodeOrName(supabase, body.site_name);
      const supervisorId = await resolveProfileIdByNameOrEmail(supabase, body.assigned_supervisor_name || body.supervisor_name);
      const crewLeadId = await resolveProfileIdByNameOrEmail(supabase, body.crew_lead_name || body.crew_lead_profile_id || body.crew_lead_email);
      if (!supervisorId) return Response.json({ ok:false, error:'A supervisor is required when creating or updating a job.' }, { status:400, headers:corsHeaders });
      const crewMemberNames = parsePeopleList(body.crew_member_names || body.crew_member_ids || []);
      const crewId = await ensureCrewRecord(supabase, {
        crew_id: body.crew_id,
        crew_name: body.crew_name || (crewMemberNames.length ? `${body.job_code || body.job_name || 'Job'} Crew` : ''),
        crew_code: body.crew_code,
        supervisor_profile_id: supervisorId,
        lead_profile_id: crewLeadId,
        service_area_id: body.service_area_id || null,
        crew_kind: body.crew_kind || (String(body.service_pattern || '').trim() === 'weekly' ? 'maintenance' : 'general'),
        default_equipment_notes: body.default_equipment_notes ?? body.reservation_notes ?? null,
        notes: body.crew_notes ?? body.notes ?? null,
        actor_id: actorProfile.id,
      });
      if (crewId && crewMemberNames.length) {
        await syncCrewMembers(supabase, crewId, crewMemberNames, actorProfile.id, supervisorId, crewLeadId);
      }
      const now = new Date().toISOString();
      const existingJob = body.job_code ? await supabase.from('jobs').select('id,job_code,job_name,status,created_at').eq('job_code', body.job_code).maybeSingle() : { data: null };
      const template = await loadServicePricingTemplate(supabase, body.service_pricing_template_id || null);
      const scheduleMode = String(body.schedule_mode || template?.default_schedule_mode || 'standalone');
      const servicePattern = String(body.service_pattern || template?.service_pattern || (scheduleMode === 'recurring' ? 'weekly' : 'one_time'));
      const reservationWindowStart = body.reservation_window_start || body.start_date || null;
      const reservationWindowEnd = body.reservation_window_end || body.end_date || body.start_date || null;
      const pricing = await computeJobPricing(supabase, body, template);
      const payload = {
        job_code: body.job_code,
        job_name: body.job_name,
        site_id: siteId,
        job_type: body.job_type ?? null,
        job_family: body.job_family ?? template?.job_family ?? (scheduleMode === 'recurring' ? 'landscaping_recurring' : 'landscaping_standard'),
        project_scope: body.project_scope ?? template?.project_scope ?? 'property_service',
        service_pattern: servicePattern,
        status: body.status ?? 'planned',
        priority: body.priority ?? 'normal',
        client_name: body.client_name ?? null,
        client_reference: body.client_reference ?? null,
        start_date: body.start_date || null,
        end_date: body.end_date || null,
        site_supervisor_profile_id: supervisorId,
        assigned_supervisor_profile_id: supervisorId,
        signing_supervisor_profile_id: await resolveProfileIdByNameOrEmail(supabase, body.signing_supervisor_name || body.supervisor_name),
        admin_profile_id: await resolveProfileIdByNameOrEmail(supabase, body.admin_name),
        crew_id: crewId,
        crew_lead_profile_id: crewLeadId,
        schedule_mode: scheduleMode,
        recurrence_rule: scheduleMode === 'standalone' ? null : (body.recurrence_rule ?? null),
        recurrence_summary: scheduleMode === 'standalone' ? null : (body.recurrence_summary ?? null),
        recurrence_interval: body.recurrence_interval ? Number(body.recurrence_interval) : null,
        recurrence_anchor_date: body.recurrence_anchor_date || body.start_date || null,
        recurrence_basis: body.recurrence_basis ?? 'calendar_rule',
        recurrence_custom_days: body.recurrence_custom_days ?? null,
        custom_schedule_notes: body.custom_schedule_notes ?? null,
        tiered_discount_notes: body.tiered_discount_notes ?? null,
        delay_reason: body.delay_reason ?? null,
        special_instructions: body.special_instructions ?? null,
        reservation_window_start: body.open_end_date ? reservationWindowStart : reservationWindowStart,
        reservation_window_end: body.open_end_date ? null : reservationWindowEnd,
        reservation_notes: body.reservation_notes ?? null,
        equipment_planning_status: body.equipment_planning_status ?? 'planned',
        estimated_visit_minutes: hasValue(body.estimated_visit_minutes) ? Number(body.estimated_visit_minutes) : (template?.default_estimated_visit_minutes || null),
        estimated_duration_hours: hasValue(body.estimated_duration_hours) ? Number(body.estimated_duration_hours) : (template?.default_estimated_duration_hours || null),
        estimated_duration_days: hasValue(body.estimated_duration_days) ? Number(body.estimated_duration_days) : (template?.default_estimated_duration_days || null),
        open_end_date: body.open_end_date === true,
        delayed_schedule: body.delayed_schedule === true,
        equipment_readiness_required: body.equipment_readiness_required === false ? false : true,
        service_pricing_template_id: pricing.service_pricing_template_id,
        sales_tax_code_id: pricing.sales_tax_code_id,
        estimated_cost_total: pricing.estimated_cost_total,
        quoted_charge_total: pricing.quoted_charge_total,
        pricing_method: pricing.pricing_method,
        markup_percent: pricing.markup_percent,
        discount_mode: pricing.discount_mode,
        discount_value: pricing.discount_value,
        estimated_profit_total: pricing.estimated_profit_total,
        estimated_margin_percent: pricing.estimated_margin_percent,
        estimated_tax_rate_percent: pricing.estimated_tax_rate_percent,
        estimated_tax_total: pricing.estimated_tax_total,
        estimated_total_with_tax: pricing.estimated_total_with_tax,
        pricing_basis_label: pricing.pricing_basis_label,
        service_contract_reference: body.service_contract_reference ?? null,
        billing_transaction_number: body.billing_transaction_number ?? null,
        invoice_number: body.invoice_number ?? null,
        delay_cost_total: pricing.delay_cost_total,
        equipment_repair_cost_total: pricing.equipment_repair_cost_total,
        actual_cost_total: pricing.actual_cost_total,
        actual_charge_total: pricing.actual_charge_total,
        actual_profit_total: pricing.actual_profit_total,
        actual_margin_percent: pricing.actual_margin_percent,
        approval_status: body.request_approval ? 'requested' : (body.approval_status ?? 'not_requested'),
        approval_requested_at: body.request_approval ? now : null,
        notes: body.notes ?? null,
        created_by_profile_id: actorProfile.id,
        last_activity_at: now,
        updated_at: now,
      };
      const { data, error } = await supabase.from('jobs').upsert(payload, { onConflict: 'job_code' }).select('*').single();
      if (error) throw error;

      await recordSiteActivity(supabase, {
        event_type: existingJob?.data?.id ? 'job_updated' : 'job_created',
        entity_type: 'job',
        entity_id: data.id,
        severity: 'success',
        title: existingJob?.data?.id ? 'Job updated' : 'Job created',
        summary: `${data.job_code || ''} ${data.job_name || ''}`.trim() || 'Job record saved.',
        metadata: { job_code: data.job_code || null, status: data.status || null, client_name: data.client_name || null, crew_id: data.crew_id || null, service_pattern: data.service_pattern || null },
        related_job_id: data.id,
        created_by_profile_id: actorProfile.id,
        occurred_at: now,
      });

      const { data: allJobs } = await supabase.from('jobs').select('id,job_code,start_date,end_date,reservation_window_start,reservation_window_end,open_end_date').neq('id', data.id);
      const { data: allEquipment } = await supabase.from('equipment_items').select('*').order('equipment_code');
      const otherJobs = allJobs || [];
      const equipmentRows = allEquipment || [];

      if (Array.isArray(body.requirements)) {
        await supabase.from('job_equipment_requirements').delete().eq('job_id', data.id);
        for (const r of body.requirements) {
          const neededQty = Math.max(0, Number(r.needed_qty ?? 1));
          const requestedCode = String(r.equipment_code || '').trim();
          const directEquipmentId = requestedCode ? await resolveEquipmentIdByCode(supabase, requestedCode) : null;
          const poolKey = normalizePoolKey(r.equipment_pool_key || r.pool_key || r.name || r.category || requestedCode);

          let candidates = equipmentRows.filter((item: any) => {
            if (directEquipmentId) return item.id === directEquipmentId;
            if (requestedCode) return String(item.equipment_code || '').trim() === requestedCode;
            return normalizePoolKey(item.equipment_pool_key || item.category || item.equipment_name || item.equipment_code) === poolKey;
          });
          if (!candidates.length && requestedCode) {
            candidates = equipmentRows.filter((item: any) => normalizePoolKey(item.equipment_pool_key || item.category || item.equipment_name || item.equipment_code) === poolKey);
          }

          const overlappingJobIds = new Set(otherJobs.filter((job: any) => overlaps(data.reservation_window_start || data.start_date, data.reservation_window_end || data.end_date, job.reservation_window_start || job.start_date, job.reservation_window_end || job.end_date, !!data.open_end_date, !!job.open_end_date)).map((job: any) => job.id));
          const blocked = candidates.filter((item: any) => {
            if (item.current_job_id && overlappingJobIds.has(item.current_job_id)) return true;
            return item.status === 'checked_out';
          });
          const free = candidates.filter((item: any) => !blocked.some((b: any) => b.id === item.id) && ['available','reserved'].includes(item.status));
          const reserved = free.slice(0, neededQty);
          const reservedQty = reserved.length;
          const reservationStatus = reservedQty >= neededQty ? 'reserved' : 'needed';

          await supabase.from('job_equipment_requirements').insert({
            job_id: data.id,
            equipment_item_id: directEquipmentId,
            equipment_code: requestedCode || null,
            equipment_name: r.name,
            equipment_pool_key: poolKey || null,
            needed_qty: neededQty,
            reserved_qty: reservedQty,
            reservation_status: reservationStatus,
            approval_status: reservedQty >= neededQty ? 'not_required' : 'pending',
            notes: r.notes ?? null,
          });

          if (reservedQty) {
            await supabase.from('equipment_items').update({ status: 'reserved', current_job_id: data.id, assigned_supervisor_profile_id: supervisorId, equipment_pool_key: poolKey || null, updated_at: now }).in('id', reserved.map((x: any) => x.id));
          }

          if (reservedQty < neededQty) {
            await insertNotification(supabase, {
              notification_type: 'equipment_reservation_conflict',
              recipient_role: 'admin',
              target_table: 'jobs',
              target_id: data.id,
              title: `Reservation conflict for job ${data.job_code}`,
              body: JSON.stringify({ job_code: data.job_code, equipment_name: r.name, pool_key: poolKey, needed_qty: neededQty, reserved_qty: reservedQty, available_codes: free.map((x: any) => x.equipment_code), blocked_codes: blocked.map((x: any) => x.equipment_code) }),
              created_by_profile_id: actorProfile.id,
              email_subject: `YWI HSE reservation conflict: ${data.job_code}`,
              payload: { job_code: data.job_code, equipment_name: r.name, pool_key: poolKey, needed_qty: neededQty, reserved_qty: reservedQty }
            });
          }
        }
      }

      if (Array.isArray(body.requirements)) {
        const { data: requirementRows } = await supabase.from('job_equipment_requirements').select('needed_qty,reserved_qty').eq('job_id', data.id);
        const rows = requirementRows || [];
        const totalNeeded = rows.reduce((sum: number, row: any) => sum + Number(row.needed_qty || 0), 0);
        const totalReserved = rows.reduce((sum: number, row: any) => sum + Number(row.reserved_qty || 0), 0);
        const nextPlanningStatus = totalNeeded <= 0
          ? (payload.equipment_planning_status || 'planned')
          : (totalReserved >= totalNeeded ? 'reserved' : (totalReserved > 0 ? 'partial' : 'planned'));
        await supabase.from('jobs').update({ equipment_planning_status: nextPlanningStatus, updated_at: new Date().toISOString() }).eq('id', data.id);
        data.equipment_planning_status = nextPlanningStatus;
      }

      if (body.request_approval) {
        await insertNotification(supabase, {
          notification_type: 'job_approval_requested',
          recipient_role: 'admin',
          target_table: 'jobs',
          target_id: data.id,
          title: `Job approval requested: ${data.job_code}`,
          body: JSON.stringify({ job_code: data.job_code, job_name: data.job_name, start_date: data.start_date, end_date: data.end_date }),
          created_by_profile_id: actorProfile.id,
          email_subject: `YWI HSE job approval requested: ${data.job_code}`,
          payload: { job_code: data.job_code, job_name: data.job_name }
        });
      }
      return Response.json({ ok:true, record: data, crew_id: crewId }, { headers: corsHeaders });
    }

    if (body.entity === 'job_session') {
      const now = new Date().toISOString();
      const payload = {
        job_id: Number(body.job_id || 0),
        session_date: body.session_date || new Date().toISOString().slice(0, 10),
        session_kind: body.session_kind || 'field_service',
        session_status: body.session_status || 'completed',
        service_frequency_label: body.service_frequency_label ?? null,
        scheduled_start_at: body.scheduled_start_at || body.started_at || null,
        started_at: body.started_at || null,
        ended_at: body.ended_at || null,
        duration_minutes: body.duration_minutes != null ? Number(body.duration_minutes) : (body.started_at && body.ended_at ? Math.max(0, Math.round((new Date(body.ended_at).getTime() - new Date(body.started_at).getTime()) / 60000)) : null),
        delay_minutes: Number(body.delay_minutes || 0),
        notes: body.notes ?? null,
        site_supervisor_profile_id: await resolveProfileIdByNameOrEmail(supabase, body.site_supervisor_signoff_name || body.site_supervisor_name || null),
        site_supervisor_signoff_name: body.site_supervisor_signoff_name ?? null,
        site_supervisor_signed_off_at: body.site_supervisor_signoff_name ? now : (body.site_supervisor_signed_off_at || null),
        site_supervisor_signoff_notes: body.site_supervisor_signoff_notes ?? null,
        created_by_profile_id: actorProfile.id,
        updated_at: now,
      };
      if (!payload.job_id) return Response.json({ ok:false, error:'job_id is required' }, { status:400, headers:corsHeaders });
      if (body.action === 'create') {
        const { data, error } = await supabase.from('job_sessions').insert({ ...payload, created_at: now }).select('*').single();
        if (error) throw error;
        await supabase.from('jobs').update({ last_activity_at: now, updated_at: now, delayed_schedule: payload.delay_minutes > 0, signing_supervisor_profile_id: payload.site_supervisor_profile_id || undefined }).eq('id', payload.job_id);
        await recordSiteActivity(supabase, { event_type: 'job_session_created', entity_type: 'job_session', entity_id: data.id, severity: 'info', title: 'Job session created', summary: `Session logged for job ${payload.job_id}.`, metadata: { session_status: data.session_status || null, session_date: data.session_date || null, delay_minutes: data.delay_minutes || 0 }, related_job_id: payload.job_id, created_by_profile_id: actorProfile.id, occurred_at: now });
        return Response.json({ ok:true, record:data }, { headers:corsHeaders });
      }
      if (body.action === 'update') {
        const { data, error } = await supabase.from('job_sessions').update(payload).eq('id', body.item_id).select('*').single();
        if (error) throw error;
        await supabase.from('jobs').update({ last_activity_at: now, updated_at: now, delayed_schedule: payload.delay_minutes > 0 }).eq('id', payload.job_id);
        await recordSiteActivity(supabase, { event_type: 'job_session_updated', entity_type: 'job_session', entity_id: data.id, severity: 'info', title: 'Job session updated', summary: `Session updated for job ${payload.job_id}.`, metadata: { session_status: data.session_status || null, delay_minutes: data.delay_minutes || 0 }, related_job_id: payload.job_id, created_by_profile_id: actorProfile.id, occurred_at: now });
        return Response.json({ ok:true, record:data }, { headers:corsHeaders });
      }
      if (body.action === 'delete') {
        const { data: existing } = await supabase.from('job_sessions').select('id,job_id').eq('id', body.item_id).maybeSingle();
        if (existing?.id) {
          await supabase.from('job_sessions').delete().eq('id', existing.id);
          await supabase.from('jobs').update({ last_activity_at: now, updated_at: now }).eq('id', existing.job_id);
        }
        return Response.json({ ok:true }, { headers:corsHeaders });
      }
    }

    if (body.entity === 'job_crew_time') {
      const now = new Date().toISOString();
      const profileId = await resolveProfileIdByNameOrEmail(supabase, body.worker_name || body.profile_name || null);
      const regularHours = Number(body.regular_hours || 0);
      const overtimeHours = Number(body.overtime_hours || 0);
      const payload = {
        job_session_id: body.job_session_id || null,
        job_id: Number(body.job_id || 0),
        crew_id: body.crew_id || null,
        profile_id: profileId,
        worker_name: body.worker_name ?? body.profile_name ?? null,
        started_at: body.started_at || null,
        ended_at: body.ended_at || null,
        hours_worked: Number(body.hours_worked || (regularHours + overtimeHours || 0)),
        regular_hours: regularHours,
        overtime_hours: overtimeHours,
        notes: body.notes ?? null,
        created_by_profile_id: actorProfile.id,
        updated_at: now,
      };
      if (!payload.job_id) return Response.json({ ok:false, error:'job_id is required' }, { status:400, headers:corsHeaders });
      if (body.action === 'create') {
        const { data, error } = await supabase.from('job_session_crew_hours').insert({ ...payload, created_at: now }).select('*').single();
        if (error) throw error;
        await supabase.from('jobs').update({ last_activity_at: now, updated_at: now }).eq('id', payload.job_id);
        await recordSiteActivity(supabase, { event_type: 'crew_hours_logged', entity_type: 'job_crew_time', entity_id: data.id, severity: 'info', title: 'Crew hours logged', summary: `${data.worker_name || 'Crew member'} logged ${Number(data.hours_worked || 0).toFixed(2)} hours.`, metadata: { regular_hours: data.regular_hours || 0, overtime_hours: data.overtime_hours || 0 }, related_job_id: payload.job_id, related_profile_id: data.profile_id || null, created_by_profile_id: actorProfile.id, occurred_at: now });
        return Response.json({ ok:true, record:data }, { headers:corsHeaders });
      }
      if (body.action === 'update') {
        const { data, error } = await supabase.from('job_session_crew_hours').update(payload).eq('id', body.item_id).select('*').single();
        if (error) throw error;
        await supabase.from('jobs').update({ last_activity_at: now, updated_at: now }).eq('id', payload.job_id);
        await recordSiteActivity(supabase, { event_type: 'job_financial_event_created', entity_type: 'job_financial_event', entity_id: data.id, severity: 'info', title: 'Job financial event recorded', summary: `${data.event_type || 'financial'} event added to job ${payload.job_id}.`, metadata: { event_type: data.event_type || null, cost_amount: data.cost_amount || 0, revenue_amount: data.revenue_amount || 0, is_billable: !!data.is_billable }, related_job_id: payload.job_id, created_by_profile_id: actorProfile.id, occurred_at: now });
        return Response.json({ ok:true, record:data }, { headers:corsHeaders });
      }
      if (body.action === 'delete') {
        const { data: existing } = await supabase.from('job_session_crew_hours').select('id,job_id').eq('id', body.item_id).maybeSingle();
        if (existing?.id) {
          await supabase.from('job_session_crew_hours').delete().eq('id', existing.id);
          await supabase.from('jobs').update({ last_activity_at: now, updated_at: now }).eq('id', existing.job_id);
        }
        return Response.json({ ok:true }, { headers:corsHeaders });
      }
    }

    if (body.entity === 'job_reassignment') {
      const now = new Date().toISOString();
      const sourceJobId = Number(body.source_job_id || 0) || await resolveJobIdByCode(supabase, body.source_job_code || null);
      const targetJobId = await resolveJobIdByCode(supabase, body.target_job_code || null) || Number(body.target_job_id || 0);
      const equipmentId = await resolveEquipmentIdByCode(supabase, body.equipment_code || null);
      const profileId = await resolveProfileIdByNameOrEmail(supabase, body.profile_name || null);
      if (!sourceJobId || !targetJobId) return Response.json({ ok:false, error:'source and target jobs are required' }, { status:400, headers:corsHeaders });
      if (!equipmentId && !profileId) return Response.json({ ok:false, error:'Provide either an equipment code or a crew member name.' }, { status:400, headers:corsHeaders });
      const { data: sourceJob } = await supabase.from('jobs').select('id,crew_id,job_code').eq('id', sourceJobId).maybeSingle();
      const { data: targetJob } = await supabase.from('jobs').select('id,crew_id,job_code').eq('id', targetJobId).maybeSingle();
      const payload = {
        source_job_id: sourceJobId,
        target_job_id: targetJobId,
        crew_id: targetJob?.crew_id || sourceJob?.crew_id || null,
        profile_id: profileId,
        equipment_item_id: equipmentId,
        reassignment_type: body.equipment_code ? (body.emergency_override ? 'equipment_redirect' : 'service_contract_support') : (body.emergency_override ? 'emergency_override' : 'temporary_split'),
        reason: body.reason ?? null,
        emergency_override: body.emergency_override === true,
        service_contract_reference: body.service_contract_reference ?? null,
        started_at: body.started_at || now,
        ended_at: body.ended_at || null,
        notes: body.notes ?? null,
        reassigned_by_profile_id: actorProfile.id,
        updated_at: now,
      };
      if (body.action === 'create') {
        const { data, error } = await supabase.from('job_reassignment_events').insert({ ...payload, created_at: now }).select('*').single();
        if (error) throw error;
        if (equipmentId) {
          await supabase.from('equipment_items').update({ current_job_id: targetJobId, status: 'reserved', updated_at: now }).eq('id', equipmentId);
        }
        await supabase.from('jobs').update({ last_activity_at: now, updated_at: now, delayed_schedule: body.emergency_override === true ? true : undefined }).in('id', [sourceJobId, targetJobId]);
        await recordSiteActivity(supabase, { event_type: 'job_reassignment_created', entity_type: 'job_reassignment', entity_id: data.id, severity: body.emergency_override === true ? 'warning' : 'info', title: 'Job reassignment created', summary: `Resources moved from ${sourceJob?.job_code || sourceJobId} to ${targetJob?.job_code || targetJobId}.`, metadata: { reassignment_type: data.reassignment_type || null, emergency_override: !!data.emergency_override, service_contract_reference: data.service_contract_reference || null }, related_job_id: targetJobId, related_profile_id: data.profile_id || null, created_by_profile_id: actorProfile.id, occurred_at: now });
        return Response.json({ ok:true, record:data }, { headers:corsHeaders });
      }
      if (body.action === 'delete') {
        await supabase.from('job_reassignment_events').delete().eq('id', body.item_id);
        return Response.json({ ok:true }, { headers:corsHeaders });
      }
    }


    if (body.entity === 'job_financial_event') {
      const now = new Date().toISOString();
      const quantity = body.quantity != null && String(body.quantity).trim() !== '' ? Number(body.quantity) : null;
      const unitCost = body.unit_cost != null && String(body.unit_cost).trim() !== '' ? Number(body.unit_cost) : null;
      const unitPrice = body.unit_price != null && String(body.unit_price).trim() !== '' ? Number(body.unit_price) : null;
      const payload = {
        job_id: Number(body.job_id || 0),
        job_session_id: body.job_session_id || null,
        event_date: body.event_date || new Date().toISOString().slice(0, 10),
        event_type: body.event_type || 'other',
        cost_amount: Number(body.cost_amount || ((quantity != null && unitCost != null) ? quantity * unitCost : 0)),
        revenue_amount: Number(body.revenue_amount || ((quantity != null && unitPrice != null) ? quantity * unitPrice : 0)),
        quantity,
        unit_cost: unitCost,
        unit_price: unitPrice,
        is_billable: body.is_billable === true,
        cost_category: body.cost_category || null,
        billable_charge_status: body.billable_charge_status || (body.is_billable === true ? 'pending' : 'not_billable'),
        source_equipment_item_id: body.source_equipment_item_id || await resolveEquipmentIdByCode(supabase, body.equipment_code || null),
        source_signout_id: body.source_signout_id || null,
        accounting_period_close_id: body.accounting_period_close_id || null,
        posting_status: body.posting_status || 'draft',
        profitability_notes: body.profitability_notes ?? null,
        vendor_id: body.vendor_id || null,
        tax_code_id: body.tax_code_id || null,
        gl_account_id: body.gl_account_id || null,
        reference_number: body.reference_number ?? null,
        notes: body.notes ?? null,
        created_by_profile_id: actorProfile.id,
        updated_at: now,
      };
      if (!payload.job_id) return Response.json({ ok:false, error:'job_id is required' }, { status:400, headers:corsHeaders });
      if (body.action === 'create') {
        const { data, error } = await supabase.from('job_financial_events').insert({ ...payload, created_at: now }).select('*').single();
        if (error) throw error;
        await supabase.from('jobs').update({ last_activity_at: now, updated_at: now }).eq('id', payload.job_id);
        return Response.json({ ok:true, record:data }, { headers:corsHeaders });
      }
      if (body.action === 'update') {
        const { data, error } = await supabase.from('job_financial_events').update(payload).eq('id', body.item_id).select('*').single();
        if (error) throw error;
        await supabase.from('jobs').update({ last_activity_at: now, updated_at: now }).eq('id', payload.job_id);
        return Response.json({ ok:true, record:data }, { headers:corsHeaders });
      }
      if (body.action === 'delete') {
        const { data: existing } = await supabase.from('job_financial_events').select('id,job_id').eq('id', body.item_id).maybeSingle();
        if (existing?.id) {
          await supabase.from('job_financial_events').delete().eq('id', existing.id);
          await supabase.from('jobs').update({ last_activity_at: now, updated_at: now }).eq('id', existing.job_id);
        }
        return Response.json({ ok:true }, { headers:corsHeaders });
      }
    }

    if (body.entity === 'job_comment') {
      const now = new Date().toISOString();
      const patch = {
        job_id: Number(body.job_id || 0),
        work_order_id: body.work_order_id || null,
        comment_type: body.comment_type || (body.is_special_instruction ? 'instruction' : 'update'),
        comment_text: String(body.comment_text || '').trim(),
        is_special_instruction: !!body.is_special_instruction,
        visible_to_client: !!body.visible_to_client,
        created_by_profile_id: actorProfile.id,
        updated_at: now,
      };
      if (!patch.job_id || !patch.comment_text) return Response.json({ ok:false, error:'job_id and comment_text are required' }, { status:400, headers:corsHeaders });
      if (body.action === 'create') {
        const { data, error } = await supabase.from('job_comments').insert({ ...patch, created_at: now }).select('*').single();
        if (error) throw error;
        const jobPatch: any = { last_activity_at: now, updated_at: now };
        if (patch.is_special_instruction || body.set_job_instruction) jobPatch.special_instructions = patch.comment_text;
        await supabase.from('jobs').update(jobPatch).eq('id', patch.job_id);
        return Response.json({ ok:true, record:data }, { headers:corsHeaders });
      }
      if (body.action === 'update') {
        const { data, error } = await supabase.from('job_comments').update(patch).eq('id', body.item_id).select('*').single();
        if (error) throw error;
        const jobPatch: any = { last_activity_at: now, updated_at: now };
        if (patch.is_special_instruction || body.set_job_instruction) jobPatch.special_instructions = patch.comment_text;
        await supabase.from('jobs').update(jobPatch).eq('id', patch.job_id);
        return Response.json({ ok:true, record:data }, { headers:corsHeaders });
      }
      if (body.action === 'delete') {
        const { data: existing } = await supabase.from('job_comments').select('id,job_id').eq('id', body.item_id).maybeSingle();
        if (existing?.id) {
          await supabase.from('job_comments').delete().eq('id', body.item_id);
          await supabase.from('jobs').update({ last_activity_at: now, updated_at: now }).eq('id', existing.job_id);
        }
        return Response.json({ ok:true }, { headers:corsHeaders });
      }
    }

    if (body.entity === 'job_comment_attachment' && body.action === 'delete') {
      const { data: asset } = await supabase.from('job_comment_attachments').select('*').eq('id', body.asset_id || body.item_id).maybeSingle();
      if (asset?.storage_bucket && asset?.storage_path) {
        await supabase.storage.from(asset.storage_bucket).remove([asset.storage_path]);
      }
      if (asset?.id) await supabase.from('job_comment_attachments').delete().eq('id', asset.id);
      return Response.json({ ok:true }, { headers:corsHeaders });
    }

    if (body.entity === 'equipment_evidence_asset' && body.action === 'delete') {
      const { data: asset } = await supabase.from('equipment_evidence_assets').select('*').eq('id', body.asset_id || body.item_id).maybeSingle();
      if (asset?.storage_bucket && asset?.storage_path) {
        await supabase.storage.from(asset.storage_bucket).remove([asset.storage_path]);
      }
      if (asset?.id) await supabase.from('equipment_evidence_assets').delete().eq('id', asset.id);
      return Response.json({ ok:true }, { headers:corsHeaders });
    }

    if (body.entity === 'equipment' && body.action === 'upsert') {
      const equipmentCode=String(body.equipment_code || '').trim();
      const equipmentName=String(body.equipment_name || '').trim();
      if(!equipmentCode || !equipmentName) return Response.json({ok:false,error:'Equipment code and name are required.'},{status:400,headers:corsHeaders});

      const homeSiteId = await resolveSiteIdByCodeOrName(supabase, body.home_site);
      const currentSiteId = await resolveSiteIdByCodeOrName(supabase, body.current_site || body.current_site_name || body.home_site);
      const targetSiteId = await resolveSiteIdByCodeOrName(supabase, body.target_site || body.destination_site || body.destination_site_name);
      const currentJobId = await resolveJobIdByCode(supabase, body.current_job_code);
      const assignedCrewInput=String(body.assigned_crew_id || body.assigned_crew || body.assigned_crew_code || body.assigned_crew_name || '').trim();
      let assignedCrewId=null;
      if(assignedCrewInput){
        if(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(assignedCrewInput)){
          const {data:crew}=await supabase.from('crews').select('id').eq('id',assignedCrewInput).maybeSingle();
          if(!crew?.id) return Response.json({ok:false,error:'Assigned crew was not found.'},{status:400,headers:corsHeaders});
          assignedCrewId=crew.id;
        } else {
          assignedCrewId=await resolveCrewIdByNameOrCode(supabase,assignedCrewInput);
          if(!assignedCrewId) return Response.json({ok:false,error:'Assigned crew was not found.'},{status:400,headers:corsHeaders});
        }
      }
      const poolKey = normalizePoolKey(body.equipment_pool_key || body.category || body.equipment_name || body.equipment_code);
      const transferStatus = body.is_locked_out ? 'locked_out' : (targetSiteId ? 'reserved' : (body.last_transfer_status || 'ready'));
      const { data: existingEquipment } = await supabase.from('equipment_items')
        .select('id,current_meter_value,current_meter_at,qr_code_value')
        .eq('equipment_code', equipmentCode)
        .maybeSingle();

      const meterRaw = body.current_meter_value;
      const meterNumber = meterRaw === '' || meterRaw == null ? null : Number(meterRaw);
      if(meterNumber !== null && (!Number.isFinite(meterNumber) || meterNumber < 0)) {
        return Response.json({ok:false,error:'Equipment meter value must be a nonnegative number.'},{status:400,headers:corsHeaders});
      }
      const meterType=String(body.meter_type || (meterNumber !== null ? 'hours' : 'none')).trim().toLowerCase();
      if(!['none','hours','odometer','cycles','other'].includes(meterType)) {
        return Response.json({ok:false,error:'Unsupported equipment meter type.'},{status:400,headers:corsHeaders});
      }
      const replacementState=String(body.replacement_state || 'retain').trim().toLowerCase();
      if(!['retain','monitor','plan_replacement','replace','retired'].includes(replacementState)) {
        return Response.json({ok:false,error:'Unsupported equipment replacement state.'},{status:400,headers:corsHeaders});
      }
      const replacementCostRaw=body.replacement_estimated_cost;
      const replacementCost=replacementCostRaw === '' || replacementCostRaw == null ? null : Number(replacementCostRaw);
      if(replacementCost !== null && (!Number.isFinite(replacementCost) || replacementCost < 0)) {
        return Response.json({ok:false,error:'Replacement estimate must be nonnegative.'},{status:400,headers:corsHeaders});
      }
      const qrInput=String(body.qr_code_value ?? body.qr_code ?? existingEquipment?.qr_code_value ?? '').trim();
      const qrCodeValue=qrInput || `YWI-EQ-${crypto.randomUUID().replaceAll('-','')}`;
      const registryNow=new Date().toISOString();

      const { data, error } = await supabase.from('equipment_items').upsert({
        equipment_code: equipmentCode,
        equipment_name: equipmentName,
        category: body.category ?? null,
        home_site_id: homeSiteId,
        current_site_id: currentSiteId,
        target_site_id: targetSiteId,
        status: body.status ?? 'available',
        current_job_id: currentJobId,
        assigned_supervisor_profile_id: await resolveProfileIdByNameOrEmail(supabase, body.assigned_supervisor_name),
        assigned_crew_id: assignedCrewId,
        equipment_pool_key: poolKey || null,
        serial_number: body.serial_number ?? null,
        asset_tag: body.asset_tag ?? null,
        manufacturer: body.manufacturer ?? null,
        model_number: body.model_number ?? null,
        purchase_year: body.purchase_year ?? null,
        purchase_date: body.purchase_date ?? null,
        purchase_price: body.purchase_price ?? null,
        purchase_vendor: body.purchase_vendor ?? null,
        purchase_cost: body.purchase_cost ?? body.purchase_price ?? null,
        warranty_expiry_date: body.warranty_expiry_date ?? null,
        year_of_manufacture: body.year_of_manufacture ?? body.purchase_year ?? null,
        condition_status: body.condition_status ?? null,
        image_url: body.image_url ?? null,
        photo_url: body.photo_url ?? body.image_url ?? null,
        service_interval_days: body.service_interval_days ?? null,
        last_service_date: body.last_service_date ?? null,
        next_service_due_date: body.next_service_due_date ?? null,
        last_inspection_at: body.last_inspection_at ?? null,
        next_inspection_due_date: body.next_inspection_due_date ?? null,
        defect_status: body.defect_status ?? 'clear',
        defect_notes: body.defect_notes ?? null,
        is_locked_out: body.is_locked_out ?? false,
        qr_code_value: qrCodeValue,
        barcode_value: body.barcode_value ?? body.barcode ?? null,
        verifier_role_required: body.verifier_role_required ?? 'supervisor',
        accessory_checklist_required: body.accessory_checklist_required === true,
        locked_out_at: body.is_locked_out ? (body.locked_out_at || new Date().toISOString()) : null,
        locked_out_by_profile_id: body.is_locked_out ? actorProfile.id : null,
        lockout_reason: body.is_locked_out ? (body.lockout_reason || body.defect_notes || null) : null,
        last_transfer_status: transferStatus,
        last_transfer_notes: body.last_transfer_notes || body.transfer_notes || null,
        meter_type: meterType,
        meter_unit: String(body.meter_unit || '').trim() || null,
        current_meter_value: meterNumber,
        current_meter_at: meterNumber === null ? null : (body.current_meter_at || registryNow),
        replacement_state: replacementState,
        replacement_target_date: body.replacement_target_date || null,
        replacement_reason: body.replacement_reason || null,
        replacement_estimated_cost: replacementCost,
        registry_v2_updated_at: registryNow,
        comments: body.comments ?? null,
        notes: body.notes ?? null,
        updated_at: registryNow,
      }, { onConflict: 'equipment_code' }).select('*').single();
      if (error) throw error;

      if (Array.isArray(body.registry_documents)) {
        const docs = body.registry_documents.slice(0,40).map((row:any)=>({
          equipment_item_id:data.id,
          document_type:['manual','warranty','parts','service','registration','insurance','other'].includes(String(row?.document_type || '').toLowerCase()) ? String(row.document_type).toLowerCase() : 'manual',
          title:String(row?.title || row?.document_url || 'Equipment document').trim().slice(0,240),
          document_url:String(row?.document_url || '').trim().slice(0,2000),
          version_label:String(row?.version_label || '').trim().slice(0,120) || null,
          notes:String(row?.notes || '').trim().slice(0,1200) || null,
          is_active:row?.is_active !== false,
          created_by_profile_id:actorProfile.id,
          updated_at:registryNow
        })).filter((row:any)=>row.document_url);
        await supabase.from('equipment_registry_documents').delete().eq('equipment_item_id',data.id);
        if(docs.length){
          const inserted=await supabase.from('equipment_registry_documents').insert(docs);
          if(inserted.error) throw inserted.error;
        }
      }

      if (Array.isArray(body.registry_photos)) {
        const photos = body.registry_photos.slice(0,40).map((row:any,index:number)=>({
          equipment_item_id:data.id,
          photo_kind:['profile','serial','condition','accessory','label','other'].includes(String(row?.photo_kind || '').toLowerCase()) ? String(row.photo_kind).toLowerCase() : 'profile',
          photo_url:String(row?.photo_url || '').trim().slice(0,2000),
          caption:String(row?.caption || '').trim().slice(0,500) || null,
          is_primary:row?.is_primary === true || index === 0,
          taken_at:row?.taken_at || null,
          created_by_profile_id:actorProfile.id,
          updated_at:registryNow
        })).filter((row:any)=>row.photo_url);
        await supabase.from('equipment_registry_photos').delete().eq('equipment_item_id',data.id);
        if(photos.length){
          const inserted=await supabase.from('equipment_registry_photos').insert(photos);
          if(inserted.error) throw inserted.error;
        }
      }

      if (Array.isArray(body.registry_accessories)) {
        const accessories = body.registry_accessories.slice(0,80).map((row:any)=>({
          equipment_item_id:data.id,
          accessory_name:String(row?.accessory_name || row?.name || '').trim().slice(0,240),
          expected_quantity:Math.max(0,Math.min(1000,Number(row?.expected_quantity ?? row?.quantity ?? 1) || 0)),
          serial_number:String(row?.serial_number || '').trim().slice(0,240) || null,
          accessory_status:['active','missing','damaged','retired'].includes(String(row?.accessory_status || '').toLowerCase()) ? String(row.accessory_status).toLowerCase() : 'active',
          replacement_cost:row?.replacement_cost === '' || row?.replacement_cost == null ? null : Math.max(0,Number(row.replacement_cost) || 0),
          notes:String(row?.notes || '').trim().slice(0,1200) || null,
          updated_by_profile_id:actorProfile.id,
          updated_at:registryNow
        })).filter((row:any)=>row.accessory_name);
        await supabase.from('equipment_accessory_registry').delete().eq('equipment_item_id',data.id);
        if(accessories.length){
          const inserted=await supabase.from('equipment_accessory_registry').insert(accessories);
          if(inserted.error) throw inserted.error;
        }
      }

      if (meterNumber !== null && (
        existingEquipment?.current_meter_value == null
        || Number(existingEquipment.current_meter_value) !== meterNumber
        || String(existingEquipment.current_meter_at || '') !== String(body.current_meter_at || existingEquipment?.current_meter_at || '')
      )) {
        const meterInsert=await supabase.from('equipment_meter_readings').insert({
          equipment_item_id:data.id,
          meter_value:meterNumber,
          meter_unit:String(body.meter_unit || '').trim() || (meterType === 'hours' ? 'hours' : meterType === 'odometer' ? 'km' : meterType),
          reading_source:'manual',
          recorded_at:body.current_meter_at || registryNow,
          recorded_by_profile_id:actorProfile.id,
          notes:String(body.meter_notes || '').trim().slice(0,1200) || null
        });
        if(meterInsert.error) throw meterInsert.error;
      }

      const { data: registryRow } = await supabase.from('v_equipment_registry_v2').select('*').eq('id',data.id).maybeSingle();
      return Response.json({ ok:true, build:331, schema:219, record: registryRow || data }, { headers:corsHeaders });
    }

    if (body.entity === 'equipment' && body.action === 'checkout') {
      const equipmentId = await resolveEquipmentIdByCode(supabase, body.equipment_code);
      const jobId = await resolveJobIdByCode(supabase, body.job_code);
      if (!equipmentId || !jobId) return Response.json({ ok:false, error:'Equipment and job are required' }, { status:400, headers:corsHeaders });
      const { data: item } = await supabase.from('equipment_items').select('*').eq('id', equipmentId).single();
      const { data: job } = await supabase.from('jobs').select('id,site_id').eq('id', jobId).maybeSingle();
      if (!item) return Response.json({ ok:false, error:'Equipment not found' }, { status:404, headers:corsHeaders });
      if (item.is_locked_out) return Response.json({ ok:false, error:'Equipment is locked out for a defect or failed inspection' }, { status:409, headers:corsHeaders });
      if (!['available','reserved'].includes(item.status)) return Response.json({ ok:false, error:'Equipment is not available for checkout' }, { status:409, headers:corsHeaders });
      const supervisorId = await resolveProfileIdByNameOrEmail(supabase, body.supervisor_name);
      const currentSiteId = await resolveSiteIdByCodeOrName(supabase, body.current_site || body.current_site_name) || item.current_site_id || item.home_site_id || null;
      const intendedSiteId = await resolveSiteIdByCodeOrName(supabase, body.intended_site || body.checkout_to_site || body.destination_site || body.target_site || body.target_site_name) || job?.site_id || item.target_site_id || item.home_site_id || null;
      const checkoutTestStatus = normalizeEquipmentTestStatus(body.checkout_safety_test_status || body.checkout_test_status);
      await supabase.from('equipment_items').update({
        status:'checked_out',
        current_job_id: jobId,
        assigned_supervisor_profile_id: supervisorId,
        current_site_id: currentSiteId,
        target_site_id: intendedSiteId,
        condition_status: body.checkout_condition ?? item.condition_status ?? null,
        last_transfer_status: 'in_transit',
        last_transfer_notes: body.transport_handoff_notes || body.notes || null,
        updated_at:new Date().toISOString()
      }).eq('id', equipmentId);
      const { data, error } = await supabase.from('equipment_signouts').insert({
        equipment_item_id: equipmentId,
        job_id: jobId,
        intended_site_id: intendedSiteId,
        checkout_to_site_id: intendedSiteId,
        checked_out_by_profile_id: actorProfile.id,
        checked_out_to_supervisor_profile_id: supervisorId,
        signout_notes: body.notes ?? null,
        checkout_worker_signature_name: body.worker_signature_name ?? null,
        checkout_supervisor_signature_name: body.supervisor_signature_name ?? null,
        checkout_admin_signature_name: body.admin_signature_name ?? null,
        checkout_condition: body.checkout_condition ?? null,
        checkout_safety_test_status: checkoutTestStatus,
        checkout_test_notes: body.checkout_test_notes ?? null,
        transport_handoff_notes: body.transport_handoff_notes ?? null,
        checkout_accessory_checklist: normalizeJsonArray(body.checkout_accessory_checklist || body.accessory_checklist),
        checkout_accessory_status: normalizeAccessoryStatus(body.checkout_accessory_status),
        accessory_missing_notes: body.accessory_missing_notes ?? null,
        verification_status: 'in_transit'
      }).select('*').single();
      if (error) throw error;
      await insertEquipmentTransferEvent(supabase, { equipment_item_id: equipmentId, signout_id: data.id, job_id: jobId, event_type:'checkout_released', from_site_id: currentSiteId, to_site_id: intendedSiteId, test_status: checkoutTestStatus, condition_status: body.checkout_condition ?? item.condition_status ?? null, verified_by_profile_id: actorProfile.id, verification_notes: body.transport_handoff_notes || body.checkout_test_notes || body.notes || null, event_payload: { equipment_code: body.equipment_code, job_code: body.job_code } });
      await insertNotification(supabase, { notification_type:'equipment_checkout', target_table:'equipment_signouts', target_id:data.id, recipient_role:'admin', title:`Equipment checked out: ${body.equipment_code}`, body: JSON.stringify({ equipment_code: body.equipment_code, job_code: body.job_code, intended_site_id: intendedSiteId }), created_by_profile_id: actorProfile.id, email_subject: `YWI HSE equipment checkout: ${body.equipment_code}`, payload: { equipment_code: body.equipment_code, job_code: body.job_code, signout_id: data.id, intended_site_id: intendedSiteId, checkout_test_status: checkoutTestStatus } });
      return Response.json({ ok:true, record:data, signout_id: data.id }, { headers:corsHeaders });
    }


    if (body.entity === 'equipment' && body.action === 'verify_arrival') {
      const equipmentId = await resolveEquipmentIdByCode(supabase, body.equipment_code);
      if (!equipmentId) return Response.json({ ok:false, error:'Equipment required' }, { status:400, headers:corsHeaders });
      const { data: signout } = await supabase.from('equipment_signouts').select('*').eq('equipment_item_id', equipmentId).is('returned_at', null).order('checked_out_at', { ascending:false }).limit(1).maybeSingle();
      if (!signout?.id) return Response.json({ ok:false, error:'No open equipment checkout was found for arrival verification.' }, { status:404, headers:corsHeaders });
      const arrivalSiteId = await resolveSiteIdByCodeOrName(supabase, body.arrival_site || body.arrival_site_name || body.destination_site || body.target_site) || signout.intended_site_id || signout.checkout_to_site_id || null;
      const arrivalTestStatus = normalizeEquipmentTestStatus(body.arrival_test_status || body.site_test_status);
      const arrivalOk = isPassingEquipmentTest(arrivalTestStatus) && String(body.arrival_condition || '').toLowerCase() !== 'damaged';
      const verificationStatus = arrivalOk ? 'arrived_verified' : 'arrival_issue';
      const now = new Date().toISOString();
      const { data, error } = await supabase.from('equipment_signouts').update({
        arrived_at_site_at: now,
        arrived_at_site_by_profile_id: actorProfile.id,
        arrival_condition: body.arrival_condition ?? null,
        arrival_test_status: arrivalTestStatus,
        arrival_accessory_checklist: normalizeJsonArray(body.arrival_accessory_checklist || body.accessory_checklist),
        arrival_accessory_status: normalizeAccessoryStatus(body.arrival_accessory_status),
        accessory_missing_notes: body.accessory_missing_notes || signout.accessory_missing_notes || null,
        arrival_verification_notes: body.arrival_verification_notes || body.notes || null,
        verification_status: verificationStatus,
      }).eq('id', signout.id).select('*').single();
      if (error) throw error;
      await supabase.from('equipment_items').update({
        current_site_id: arrivalSiteId,
        target_site_id: null,
        condition_status: body.arrival_condition ?? null,
        last_arrival_verified_at: now,
        last_arrival_verified_by_profile_id: actorProfile.id,
        last_arrival_test_status: arrivalTestStatus,
        last_transfer_status: verificationStatus,
        last_transfer_notes: body.arrival_verification_notes || body.notes || null,
        defect_status: arrivalOk ? 'clear' : 'open',
        is_locked_out: arrivalOk ? false : true,
        locked_out_at: arrivalOk ? null : now,
        locked_out_by_profile_id: arrivalOk ? null : actorProfile.id,
        updated_at: now,
      }).eq('id', equipmentId);
      await insertEquipmentTransferEvent(supabase, { equipment_item_id: equipmentId, signout_id: signout.id, job_id: signout.job_id, event_type: arrivalOk ? 'site_arrival_verified' : 'site_arrival_issue', from_site_id: signout.checkout_to_site_id || null, to_site_id: arrivalSiteId, test_status: arrivalTestStatus, condition_status: body.arrival_condition ?? null, verified_by_profile_id: actorProfile.id, verification_notes: body.arrival_verification_notes || body.notes || null, event_payload: { equipment_code: body.equipment_code, verification_status: verificationStatus } });
      if (!arrivalOk) await insertEquipmentServiceTask(supabase, { equipment_item_id: equipmentId, source_signout_id: signout.id, job_id: signout.job_id, task_type:'arrival_test_followup', priority:'high', failure_reason: body.arrival_verification_notes || body.notes || `Arrival test ${arrivalTestStatus}`, estimated_cost: Number(body.estimated_service_cost || 0), notes: body.arrival_verification_notes || body.notes || null, created_by_profile_id: actorProfile.id });
      await insertNotification(supabase, { notification_type:'equipment_arrival_verification', target_table:'equipment_signouts', target_id:signout.id, recipient_role:'admin', title:`Equipment arrival ${arrivalOk ? 'verified' : 'issue'}: ${body.equipment_code}`, body: JSON.stringify({ equipment_code: body.equipment_code, arrival_test_status: arrivalTestStatus, verification_status: verificationStatus }), created_by_profile_id: actorProfile.id, email_subject: `YWI HSE equipment arrival: ${body.equipment_code}`, payload: { equipment_code: body.equipment_code, signout_id: signout.id, arrival_site_id: arrivalSiteId, arrival_test_status: arrivalTestStatus, verification_status: verificationStatus } });
      return Response.json({ ok:true, record:data, signout_id: signout.id }, { headers:corsHeaders });
    }

    if (body.entity === 'equipment' && body.action === 'fleet_profile_upsert') {
      const equipmentId = await resolveEquipmentIdByCode(supabase, body.equipment_code);
      if (!equipmentId) return Response.json({ ok:false, error:'Equipment required' }, { status:400, headers:corsHeaders });
      const assetClass=String(body.asset_class || 'vehicle').trim().toLowerCase();
      if(!['truck','trailer','vehicle'].includes(assetClass)) return Response.json({ok:false,error:'Fleet asset class must be truck, trailer, or vehicle.'},{status:400,headers:corsHeaders});
      const maxTow=body.max_tow_kg === '' || body.max_tow_kg == null ? null : Number(body.max_tow_kg);
      const gvwr=body.trailer_gvwr_kg === '' || body.trailer_gvwr_kg == null ? null : Number(body.trailer_gvwr_kg);
      if(maxTow !== null && (!Number.isFinite(maxTow) || maxTow < 0)) return Response.json({ok:false,error:'Maximum tow capacity must be nonnegative.'},{status:400,headers:corsHeaders});
      if(gvwr !== null && (!Number.isFinite(gvwr) || gvwr < 0)) return Response.json({ok:false,error:'Trailer GVWR must be nonnegative.'},{status:400,headers:corsHeaders});
      const tireStatus=String(body.tire_status || 'unknown').trim().toLowerCase();
      if(!['unknown','good','monitor','service_due','unsafe'].includes(tireStatus)) return Response.json({ok:false,error:'Unsupported tire status.'},{status:400,headers:corsHeaders});
      const operationalStatus=String(body.operational_status || 'ready').trim().toLowerCase();
      if(!['ready','assigned','service_due','downtime','out_of_service'].includes(operationalStatus)) return Response.json({ok:false,error:'Unsupported fleet operational status.'},{status:400,headers:corsHeaders});
      const damageStatus=String(body.damage_status || 'clear').trim().toLowerCase();
      if(!['clear','reported','repair_required','monitor'].includes(damageStatus)) return Response.json({ok:false,error:'Unsupported fleet damage status.'},{status:400,headers:corsHeaders});
      const fuelType=String(body.fuel_type || (assetClass==='trailer' ? 'none' : 'gasoline')).trim().toLowerCase();
      if(!['gasoline','diesel','electric','hybrid','propane','other','none'].includes(fuelType)) return Response.json({ok:false,error:'Unsupported fleet fuel type.'},{status:400,headers:corsHeaders});
      const now=new Date().toISOString();
      const {data,error}=await supabase.from('equipment_fleet_profiles').upsert({
        equipment_item_id:equipmentId,
        asset_class:assetClass,
        vin_or_unit_number:String(body.vin_or_unit_number || '').trim() || null,
        plate_number:String(body.plate_number || '').trim() || null,
        registration_expiry:body.registration_expiry || null,
        insurance_policy_reference:String(body.insurance_policy_reference || '').trim() || null,
        insurance_expiry:body.insurance_expiry || null,
        annual_vehicle_inspection_due:body.annual_vehicle_inspection_due || null,
        tire_status:tireStatus,
        hitch_class:String(body.hitch_class || '').trim() || null,
        max_tow_kg:maxTow,
        trailer_gvwr_kg:gvwr,
        trailer_connector:String(body.trailer_connector || '').trim() || null,
        fuel_type:fuelType,
        operational_status:operationalStatus,
        damage_status:damageStatus,
        downtime_reason:body.downtime_reason || null,
        downtime_started_at:body.downtime_started_at || null,
        notes:body.notes || null,
        updated_by_profile_id:actorProfile.id,
        updated_at:now
      },{onConflict:'equipment_item_id'}).select('*').single();
      if(error) throw error;
      if(body.odometer_km !== '' && body.odometer_km != null){
        const odometer=Number(body.odometer_km);
        if(!Number.isFinite(odometer) || odometer < 0) return Response.json({ok:false,error:'Odometer must be nonnegative.'},{status:400,headers:corsHeaders});
        await supabase.from('equipment_items').update({meter_type:'odometer',meter_unit:'km',current_meter_value:odometer,current_meter_at:now,updated_at:now}).eq('id',equipmentId);
      }
      return Response.json({ok:true,build:333,schema:221,record:data},{headers:corsHeaders});
    }

    if (body.entity === 'equipment' && body.action === 'fleet_readiness_record') {
      const equipmentId = await resolveEquipmentIdByCode(supabase, body.equipment_code);
      if (!equipmentId) return Response.json({ ok:false, error:'Equipment required' }, { status:400, headers:corsHeaders });
      const {data:profile}=await supabase.from('equipment_fleet_profiles').select('*').eq('equipment_item_id',equipmentId).maybeSingle();
      if(!profile) return Response.json({ok:false,error:'Save a fleet profile before recording readiness.'},{status:409,headers:corsHeaders});
      const tireStatus=String(body.tire_status || profile.tire_status || 'unknown').trim().toLowerCase();
      const reg=body.registration_verified === true;
      const ins=body.insurance_verified === true;
      const inspection=body.vehicle_inspection_verified === true;
      const hitchRequired=profile.asset_class === 'trailer' || profile.asset_class === 'truck';
      const hitchOk=!hitchRequired || body.hitch_compatible === true;
      const loadRequired=profile.asset_class === 'trailer';
      const loadOk=!loadRequired || body.trailer_load_ready === true;
      const blocked=!reg || !ins || !inspection || tireStatus === 'unsafe' || !hitchOk || !loadOk;
      const review=!blocked && (tireStatus === 'monitor' || tireStatus === 'service_due' || tireStatus === 'unknown');
      const readinessStatus=blocked ? 'blocked' : (review ? 'needs_review' : 'ready');
      const jobId=body.job_code ? await resolveJobIdByCode(supabase,body.job_code) : (body.job_id || null);
      const {data,error}=await supabase.from('fleet_readiness_checks').insert({
        equipment_item_id:equipmentId,
        job_id:jobId,
        registration_verified:reg,
        insurance_verified:ins,
        vehicle_inspection_verified:inspection,
        tire_status:tireStatus,
        hitch_compatible:hitchRequired ? hitchOk : null,
        trailer_load_ready:loadRequired ? loadOk : null,
        load_summary:body.load_summary || null,
        issue_summary:body.issue_summary || null,
        readiness_status:readinessStatus,
        checked_by_profile_id:actorProfile.id
      }).select('*').single();
      if(error) throw error;
      return Response.json({ok:true,build:333,schema:221,record:data,readiness_status:readinessStatus},{headers:corsHeaders});
    }

    if (body.entity === 'equipment' && body.action === 'fleet_fuel_record') {
      const equipmentId = await resolveEquipmentIdByCode(supabase, body.equipment_code);
      if (!equipmentId) return Response.json({ ok:false, error:'Equipment required' }, { status:400, headers:corsHeaders });
      const litres=Number(body.quantity_litres || 0);
      const totalCost=body.total_cost === '' || body.total_cost == null ? null : Number(body.total_cost);
      const odometer=body.odometer_km === '' || body.odometer_km == null ? null : Number(body.odometer_km);
      if(!Number.isFinite(litres) || litres <= 0) return Response.json({ok:false,error:'Fuel quantity in litres must be greater than zero.'},{status:400,headers:corsHeaders});
      if(totalCost !== null && (!Number.isFinite(totalCost) || totalCost < 0)) return Response.json({ok:false,error:'Fuel total cost must be nonnegative.'},{status:400,headers:corsHeaders});
      if(odometer !== null && (!Number.isFinite(odometer) || odometer < 0)) return Response.json({ok:false,error:'Odometer must be nonnegative.'},{status:400,headers:corsHeaders});
      const jobId=body.job_code ? await resolveJobIdByCode(supabase,body.job_code) : (body.job_id || null);
      const {data:profile}=await supabase.from('equipment_fleet_profiles').select('fuel_type').eq('equipment_item_id',equipmentId).maybeSingle();
      const {data,error}=await supabase.from('fleet_fuel_logs').insert({
        equipment_item_id:equipmentId,
        job_id:jobId,
        fuel_type:String(body.fuel_type || profile?.fuel_type || 'gasoline'),
        quantity_litres:litres,
        total_cost:totalCost,
        odometer_km:odometer,
        supplier:body.supplier || null,
        receipt_reference:body.receipt_reference || null,
        notes:body.notes || null,
        recorded_by_profile_id:actorProfile.id
      }).select('*').single();
      if(error) throw error;
      if(odometer !== null){
        const now=new Date().toISOString();
        await supabase.from('equipment_items').update({meter_type:'odometer',meter_unit:'km',current_meter_value:odometer,current_meter_at:now,updated_at:now}).eq('id',equipmentId);
      }
      return Response.json({ok:true,build:333,schema:221,record:data},{headers:corsHeaders});
    }

    if (body.entity === 'equipment' && body.action === 'fleet_towing_assign') {
      const truckId = await resolveEquipmentIdByCode(supabase, body.truck_equipment_code);
      const trailerId = await resolveEquipmentIdByCode(supabase, body.trailer_equipment_code);
      if(!truckId || !trailerId || truckId===trailerId) return Response.json({ok:false,error:'Distinct towing-unit and trailer equipment codes are required.'},{status:400,headers:corsHeaders});
      const {data:truck}=await supabase.from('equipment_fleet_profiles').select('*').eq('equipment_item_id',truckId).maybeSingle();
      const {data:trailer}=await supabase.from('equipment_fleet_profiles').select('*').eq('equipment_item_id',trailerId).maybeSingle();
      if(!truck || !trailer) return Response.json({ok:false,error:'Both towing unit and trailer require fleet profiles.'},{status:409,headers:corsHeaders});
      if(!['truck','vehicle'].includes(String(truck.asset_class)) || trailer.asset_class!=='trailer') return Response.json({ok:false,error:'Tow assignment requires a truck/vehicle towing unit and a trailer.'},{status:409,headers:corsHeaders});
      const hitchCompatible=!!truck.hitch_class && !!trailer.hitch_class && String(truck.hitch_class).toLowerCase()===String(trailer.hitch_class).toLowerCase();
      const capacityCompatible=Number(truck.max_tow_kg || 0)>0 && Number(trailer.trailer_gvwr_kg || 0)>0 && Number(truck.max_tow_kg)>=Number(trailer.trailer_gvwr_kg);
      if(!hitchCompatible || !capacityCompatible) return Response.json({ok:false,error:'Tow assignment blocked: hitch or towing-capacity compatibility failed.',compatibility:{hitch_compatible:hitchCompatible,tow_capacity_compatible:capacityCompatible}},{status:409,headers:corsHeaders});
      const {data:existing}=await supabase.from('fleet_towing_assignments').select('id').eq('trailer_equipment_item_id',trailerId).is('released_at',null).limit(1);
      if((existing || []).length) return Response.json({ok:false,error:'Trailer already has an active towing assignment.'},{status:409,headers:corsHeaders});
      const jobId=body.job_code ? await resolveJobIdByCode(supabase,body.job_code) : (body.job_id || null);
      let assignedCrewId=body.assigned_crew_id || null;
      if(!assignedCrewId && body.assigned_crew) assignedCrewId=await resolveCrewIdByNameOrCode(supabase,String(body.assigned_crew));
      const now=new Date().toISOString();
      const {data,error}=await supabase.from('fleet_towing_assignments').insert({
        truck_equipment_item_id:truckId,
        trailer_equipment_item_id:trailerId,
        job_id:jobId,
        assigned_crew_id:assignedCrewId,
        assigned_at:now,
        hitch_compatible:true,
        tow_capacity_compatible:true,
        compatibility_snapshot:{truck_hitch_class:truck.hitch_class,trailer_hitch_class:trailer.hitch_class,max_tow_kg:truck.max_tow_kg,trailer_gvwr_kg:trailer.trailer_gvwr_kg,trailer_connector:trailer.trailer_connector},
        assignment_notes:body.assignment_notes || null,
        assigned_by_profile_id:actorProfile.id
      }).select('*').single();
      if(error) throw error;
      await supabase.from('equipment_fleet_profiles').update({operational_status:'assigned',updated_by_profile_id:actorProfile.id,updated_at:now}).in('equipment_item_id',[truckId,trailerId]);
      return Response.json({ok:true,build:333,schema:221,record:data,compatibility:{hitch_compatible:true,tow_capacity_compatible:true}},{headers:corsHeaders});
    }

    if (body.entity === 'equipment' && body.action === 'fleet_towing_release') {
      const assignmentId=String(body.assignment_id || '').trim();
      if(!assignmentId) return Response.json({ok:false,error:'Tow assignment is required.'},{status:400,headers:corsHeaders});
      const {data:assignment}=await supabase.from('fleet_towing_assignments').select('*').eq('id',assignmentId).maybeSingle();
      if(!assignment) return Response.json({ok:false,error:'Tow assignment not found.'},{status:404,headers:corsHeaders});
      if(assignment.released_at) return Response.json({ok:true,build:333,schema:221,record:assignment},{headers:corsHeaders});
      const now=new Date().toISOString();
      const {data,error}=await supabase.from('fleet_towing_assignments').update({released_at:now,released_by_profile_id:actorProfile.id,release_notes:body.release_notes || null,updated_at:now}).eq('id',assignmentId).select('*').single();
      if(error) throw error;
      await supabase.from('equipment_fleet_profiles').update({operational_status:'ready',updated_by_profile_id:actorProfile.id,updated_at:now}).in('equipment_item_id',[assignment.truck_equipment_item_id,assignment.trailer_equipment_item_id]);
      return Response.json({ok:true,build:333,schema:221,record:data},{headers:corsHeaders});
    }

    if (body.entity === 'equipment' && body.action === 'fleet_downtime_start') {
      const equipmentId = await resolveEquipmentIdByCode(supabase, body.equipment_code);
      if (!equipmentId) return Response.json({ ok:false, error:'Equipment required' }, { status:400, headers:corsHeaders });
      const reason=String(body.downtime_reason || '').trim();
      if(!reason) return Response.json({ok:false,error:'Downtime reason is required.'},{status:400,headers:corsHeaders});
      const jobId=body.job_code ? await resolveJobIdByCode(supabase,body.job_code) : (body.job_id || null);
      const now=new Date().toISOString();
      const {data:task,error:taskError}=await supabase.from('equipment_service_tasks').insert({
        equipment_item_id:equipmentId,
        job_id:jobId,
        task_type:'repair',
        task_status:'open',
        priority:String(body.priority || 'high'),
        failure_reason:body.damage_summary || reason,
        estimated_cost:Number(body.estimated_service_cost || 0),
        notes:body.notes || reason,
        created_by_profile_id:actorProfile.id
      }).select('*').single();
      if(taskError) throw taskError;
      const {data,error}=await supabase.from('fleet_downtime_events').insert({
        equipment_item_id:equipmentId,
        job_id:jobId,
        service_task_id:task?.id || null,
        damage_summary:body.damage_summary || null,
        downtime_reason:reason,
        started_at:now,
        opened_by_profile_id:actorProfile.id
      }).select('*').single();
      if(error) throw error;
      await supabase.from('equipment_fleet_profiles').update({operational_status:'downtime',damage_status:body.damage_summary ? 'repair_required' : 'reported',downtime_reason:reason,downtime_started_at:now,updated_by_profile_id:actorProfile.id,updated_at:now}).eq('equipment_item_id',equipmentId);
      await supabase.from('equipment_items').update({status:'maintenance',defect_status:'open',defect_notes:body.damage_summary || reason,updated_at:now}).eq('id',equipmentId);
      return Response.json({ok:true,build:333,schema:221,record:data,service_task_id:task?.id || null},{headers:corsHeaders});
    }

    if (body.entity === 'equipment' && body.action === 'fleet_downtime_clear') {
      const equipmentId = await resolveEquipmentIdByCode(supabase, body.equipment_code);
      if (!equipmentId) return Response.json({ ok:false, error:'Equipment required' }, { status:400, headers:corsHeaders });
      const {data:rows}=await supabase.from('fleet_downtime_events').select('*').eq('equipment_item_id',equipmentId).is('ended_at',null).order('started_at',{ascending:false}).limit(1);
      const event=(rows || [])[0];
      if(!event) return Response.json({ok:false,error:'No open fleet downtime event was found.'},{status:409,headers:corsHeaders});
      if(event.service_task_id){
        const {data:task}=await supabase.from('equipment_service_tasks').select('task_status').eq('id',event.service_task_id).maybeSingle();
        if(!['resolved','cancelled'].includes(String(task?.task_status || ''))) return Response.json({ok:false,error:'Repair/service task must be resolved before fleet downtime can be cleared.'},{status:409,headers:corsHeaders});
      }
      const now=new Date().toISOString();
      const {data,error}=await supabase.from('fleet_downtime_events').update({ended_at:now,resolution_notes:body.resolution_notes || null,closed_by_profile_id:actorProfile.id,updated_at:now}).eq('id',event.id).select('*').single();
      if(error) throw error;
      await supabase.from('equipment_fleet_profiles').update({operational_status:'ready',damage_status:'clear',downtime_reason:null,downtime_started_at:null,updated_by_profile_id:actorProfile.id,updated_at:now}).eq('equipment_item_id',equipmentId);
      await supabase.from('equipment_items').update({status:'available',defect_status:'clear',defect_notes:null,updated_at:now}).eq('id',equipmentId);
      return Response.json({ok:true,build:333,schema:221,record:data},{headers:corsHeaders});
    }

    if (body.entity === 'equipment' && body.action === 'daily_inspection_submit') {
      const equipmentId = await resolveEquipmentIdByCode(supabase, body.equipment_code);
      if (!equipmentId) return Response.json({ ok:false, error:'Equipment required' }, { status:400, headers:corsHeaders });
      const stage = String(body.inspection_stage || 'pre_use');
      if (!['pre_use','post_use'].includes(stage)) return Response.json({ ok:false, error:'Inspection stage must be pre_use or post_use.' }, { status:400, headers:corsHeaders });
      const itemRows = Array.isArray(body.checklist_items) ? body.checklist_items : [];
      if (!itemRows.length) return Response.json({ ok:false, error:'At least one checklist item is required.' }, { status:400, headers:corsHeaders });
      const failed = itemRows.filter((row:any)=>String(row.result_status || 'pass') === 'fail');
      const criticalFailed = failed.filter((row:any)=>!!row.is_safety_critical);
      const overallStatus = criticalFailed.length ? 'fail' : (failed.length ? 'needs_review' : 'pass');
      const defectSummary = String(body.defect_summary || failed.map((row:any)=>row.note || row.item_label || row.item_key).filter(Boolean).join('; ') || '').trim() || null;
      const now = new Date().toISOString();
      const { data: inspection, error: inspectionError } = await supabase.from('equipment_daily_inspections').insert({
        equipment_item_id:equipmentId,
        template_id:body.template_id || null,
        job_id:body.job_id || null,
        inspection_stage:stage,
        inspection_date:body.inspection_date || now.slice(0,10),
        inspected_at:body.inspected_at || now,
        inspector_profile_id:actorProfile.id,
        meter_value:body.meter_value ?? null,
        meter_unit:body.meter_unit || null,
        overall_status:overallStatus,
        safety_critical_failure:criticalFailed.length > 0,
        defect_summary:defectSummary,
        supervisor_review_status:'pending',
        return_to_service_status:criticalFailed.length ? 'blocked' : 'not_required'
      }).select('*').single();
      if (inspectionError) throw inspectionError;
      const rows = itemRows.map((row:any)=>({
        inspection_id:inspection.id,
        template_item_id:row.template_item_id || null,
        item_key:String(row.item_key || '').trim(),
        inspection_area:String(row.inspection_area || 'general').trim(),
        item_label:String(row.item_label || row.item_key || 'Inspection item').trim(),
        result_status:['pass','fail','na'].includes(String(row.result_status)) ? String(row.result_status) : 'pass',
        is_safety_critical:!!row.is_safety_critical,
        note:row.note || null
      })).filter((row:any)=>row.item_key);
      if (rows.length) {
        const { error:itemError } = await supabase.from('equipment_daily_inspection_items').insert(rows);
        if (itemError) throw itemError;
      }
      let serviceTaskId = null;
      if (criticalFailed.length) {
        const { data:task, error:taskError } = await supabase.from('equipment_service_tasks').insert({
          equipment_item_id:equipmentId,
          job_id:body.job_id || null,
          task_type:'inspection',
          task_status:'open',
          priority:'high',
          failure_reason:defectSummary || 'Safety-critical daily equipment inspection failure',
          estimated_cost:Number(body.estimated_service_cost || 0),
          notes:body.notes || defectSummary,
          created_by_profile_id:actorProfile.id
        }).select('*').single();
        if (taskError) throw taskError;
        serviceTaskId = task?.id || null;
        await supabase.from('equipment_daily_inspections').update({ lockout_created:true, service_task_id:serviceTaskId, updated_at:now }).eq('id',inspection.id);
        await supabase.from('equipment_items').update({
          status:'maintenance', defect_status:'open', defect_notes:defectSummary,
          is_locked_out:true, locked_out_at:now, locked_out_by_profile_id:actorProfile.id,
          lockout_reason:'Safety-critical daily equipment inspection failure', updated_at:now
        }).eq('id',equipmentId);
      }
      if (body.meter_value != null) {
        await supabase.from('equipment_items').update({ current_meter_value:Number(body.meter_value), current_meter_at:body.inspected_at || now, updated_at:now }).eq('id',equipmentId);
      }
      await insertNotification(supabase, {
        notification_type:criticalFailed.length ? 'equipment_daily_inspection_lockout' : 'equipment_daily_inspection',
        target_table:'equipment_daily_inspections', target_id:inspection.id, recipient_role:'admin',
        title:`Daily equipment inspection ${criticalFailed.length ? 'LOCKOUT' : overallStatus}: ${body.equipment_code}`,
        body:JSON.stringify({ equipment_code:body.equipment_code, inspection_stage:stage, overall_status:overallStatus, critical_failure_count:criticalFailed.length, defect_summary:defectSummary, service_task_id:serviceTaskId }),
        created_by_profile_id:actorProfile.id,
        email_subject:`YWI equipment daily inspection: ${body.equipment_code}`,
        payload:{ equipment_code:body.equipment_code, inspection_id:inspection.id, inspection_stage:stage, overall_status:overallStatus, critical_failure_count:criticalFailed.length, service_task_id:serviceTaskId }
      });
      return Response.json({ ok:true, build:332, schema:220, record:{...inspection,lockout_created:criticalFailed.length>0,service_task_id:serviceTaskId}, locked_out:criticalFailed.length>0 }, { headers:corsHeaders });
    }

    if (body.entity === 'equipment' && body.action === 'daily_inspection_review') {
      const inspectionId = String(body.inspection_id || '');
      const reviewStatus = String(body.review_status || 'approved');
      if (!inspectionId || !['approved','rejected'].includes(reviewStatus)) return Response.json({ ok:false, error:'Inspection and approved/rejected review status are required.' }, { status:400, headers:corsHeaders });
      const { data:inspection } = await supabase.from('equipment_daily_inspections').select('*').eq('id',inspectionId).maybeSingle();
      if (!inspection) return Response.json({ ok:false, error:'Daily inspection not found.' }, { status:404, headers:corsHeaders });
      let returnStatus = inspection.return_to_service_status || 'not_required';
      if (inspection.safety_critical_failure && reviewStatus === 'approved') {
        let taskResolved = false;
        if (inspection.service_task_id) {
          const { data:task } = await supabase.from('equipment_service_tasks').select('task_status').eq('id',inspection.service_task_id).maybeSingle();
          taskResolved = ['resolved','cancelled'].includes(String(task?.task_status || ''));
        }
        returnStatus = taskResolved ? 'ready_for_verification' : 'blocked';
      }
      const now = new Date().toISOString();
      const { data,error } = await supabase.from('equipment_daily_inspections').update({
        supervisor_review_status:reviewStatus,
        supervisor_review_notes:body.review_notes || null,
        supervisor_reviewed_by_profile_id:actorProfile.id,
        supervisor_reviewed_at:now,
        return_to_service_status:returnStatus,
        updated_at:now
      }).eq('id',inspectionId).select('*').single();
      if (error) throw error;
      return Response.json({ ok:true, build:332, record:data }, { headers:corsHeaders });
    }

    if (body.entity === 'equipment' && body.action === 'daily_inspection_return_to_service') {
      const inspectionId = String(body.inspection_id || '');
      if (!inspectionId || String(body.verification_status || '') !== 'verified') return Response.json({ ok:false, error:'Explicit verified return-to-service confirmation is required.' }, { status:400, headers:corsHeaders });
      const { data:inspection } = await supabase.from('equipment_daily_inspections').select('*').eq('id',inspectionId).maybeSingle();
      if (!inspection) return Response.json({ ok:false, error:'Daily inspection not found.' }, { status:404, headers:corsHeaders });
      if (inspection.supervisor_review_status !== 'approved') return Response.json({ ok:false, error:'Supervisor approval is required before return to service.' }, { status:409, headers:corsHeaders });
      if (inspection.safety_critical_failure && inspection.service_task_id) {
        const { data:task } = await supabase.from('equipment_service_tasks').select('task_status').eq('id',inspection.service_task_id).maybeSingle();
        if (!['resolved','cancelled'].includes(String(task?.task_status || ''))) return Response.json({ ok:false, error:'Repair/service task must be resolved before return to service.' }, { status:409, headers:corsHeaders });
      }
      const now = new Date().toISOString();
      const { data,error } = await supabase.from('equipment_daily_inspections').update({
        return_to_service_status:'verified',
        return_to_service_notes:body.return_to_service_notes || null,
        returned_to_service_by_profile_id:actorProfile.id,
        returned_to_service_at:now,
        updated_at:now
      }).eq('id',inspectionId).select('*').single();
      if (error) throw error;
      await supabase.from('equipment_items').update({
        status:'available', defect_status:'clear', defect_notes:null,
        is_locked_out:false, locked_out_at:null, locked_out_by_profile_id:null, lockout_reason:null,
        updated_at:now
      }).eq('id',inspection.equipment_item_id);
      await insertNotification(supabase, {
        notification_type:'equipment_return_to_service_verified', target_table:'equipment_daily_inspections', target_id:inspectionId, recipient_role:'admin',
        title:'Equipment return to service verified', body:JSON.stringify({ inspection_id:inspectionId, equipment_item_id:inspection.equipment_item_id }),
        created_by_profile_id:actorProfile.id, email_subject:'YWI equipment return to service verified',
        payload:{ inspection_id:inspectionId, equipment_item_id:inspection.equipment_item_id }
      });
      return Response.json({ ok:true, build:332, record:data }, { headers:corsHeaders });
    }

    if (body.entity === 'equipment' && body.action === 'inspect') {
      const equipmentId = await resolveEquipmentIdByCode(supabase, body.equipment_code);
      if (!equipmentId) return Response.json({ ok:false, error:'Equipment required' }, { status:400, headers:corsHeaders });
      const inspectedAt = body.inspected_at || new Date().toISOString();
      const nextDueDate = body.next_due_date || null;
      const inspectionStatus = String(body.inspection_status || 'pass');
      const { data, error } = await supabase.from('equipment_inspection_history').insert({
        equipment_item_id: equipmentId,
        inspected_by_profile_id: actorProfile.id,
        inspected_at: inspectedAt,
        inspection_status: inspectionStatus,
        notes: body.notes ?? null,
        next_due_date: nextDueDate
      }).select('*').single();
      if (error) throw error;
      await supabase.from('equipment_items').update({
        last_inspection_at: inspectedAt,
        next_inspection_due_date: nextDueDate,
        defect_status: inspectionStatus === 'pass' ? 'clear' : 'open',
        defect_notes: body.notes ?? null,
        is_locked_out: inspectionStatus === 'pass' ? false : true,
        locked_out_at: inspectionStatus === 'pass' ? null : new Date().toISOString(),
        locked_out_by_profile_id: inspectionStatus === 'pass' ? null : actorProfile.id,
        updated_at: new Date().toISOString()
      }).eq('id', equipmentId);
      await insertNotification(supabase, { notification_type:'equipment_inspection', target_table:'equipment_items', target_id:equipmentId, recipient_role:'admin', title:`Equipment inspection: ${body.equipment_code}`, body: JSON.stringify({ equipment_code: body.equipment_code, inspection_status: inspectionStatus, next_due_date: nextDueDate, notes: body.notes || null }), created_by_profile_id: actorProfile.id, email_subject: `YWI HSE equipment inspection: ${body.equipment_code}`, payload: { equipment_code: body.equipment_code, inspection_status: inspectionStatus, next_due_date: nextDueDate } });
      return Response.json({ ok:true, record:data }, { headers:corsHeaders });
    }

    if (body.entity === 'equipment' && body.action === 'maintenance') {
      const equipmentId = await resolveEquipmentIdByCode(supabase, body.equipment_code);
      if (!equipmentId) return Response.json({ ok:false, error:'Equipment required' }, { status:400, headers:corsHeaders });
      const performedAt = body.performed_at || new Date().toISOString();
      const nextDueDate = body.next_due_date || null;
      const { data, error } = await supabase.from('equipment_maintenance_history').insert({
        equipment_item_id: equipmentId,
        performed_by_profile_id: actorProfile.id,
        performed_at: performedAt,
        maintenance_type: body.maintenance_type || 'service',
        provider_name: body.provider_name ?? null,
        cost_amount: body.cost_amount ?? null,
        notes: body.notes ?? null,
        next_due_date: nextDueDate
      }).select('*').single();
      if (error) throw error;
      await supabase.from('equipment_items').update({
        last_service_date: performedAt,
        next_service_due_date: nextDueDate,
        defect_status: 'clear',
        defect_notes: null,
        is_locked_out: false,
        locked_out_at: null,
        locked_out_by_profile_id: null,
        updated_at: new Date().toISOString()
      }).eq('id', equipmentId);
      await insertNotification(supabase, { notification_type:'equipment_maintenance', target_table:'equipment_items', target_id:equipmentId, recipient_role:'admin', title:`Equipment service: ${body.equipment_code}`, body: JSON.stringify({ equipment_code: body.equipment_code, maintenance_type: body.maintenance_type || 'service', provider_name: body.provider_name || null, next_due_date: nextDueDate }), created_by_profile_id: actorProfile.id, email_subject: `YWI HSE equipment service: ${body.equipment_code}`, payload: { equipment_code: body.equipment_code, maintenance_type: body.maintenance_type || 'service', provider_name: body.provider_name || null, next_due_date: nextDueDate } });
      return Response.json({ ok:true, record:data }, { headers:corsHeaders });
    }

    if (body.entity === 'equipment' && body.action === 'defect_lockout') {
      const equipmentId = await resolveEquipmentIdByCode(supabase, body.equipment_code);
      if (!equipmentId) return Response.json({ ok:false, error:'Equipment required' }, { status:400, headers:corsHeaders });
      await supabase.from('equipment_items').update({ defect_status:'open', defect_notes: body.notes ?? null, is_locked_out:true, locked_out_at:new Date().toISOString(), locked_out_by_profile_id: actorProfile.id, updated_at:new Date().toISOString() }).eq('id', equipmentId);
      await insertNotification(supabase, { notification_type:'equipment_lockout', target_table:'equipment_items', target_id:equipmentId, recipient_role:'admin', title:`Equipment locked out: ${body.equipment_code}`, body: JSON.stringify({ equipment_code: body.equipment_code, notes: body.notes || null }), created_by_profile_id: actorProfile.id, email_subject: `YWI HSE equipment lockout: ${body.equipment_code}`, payload: { equipment_code: body.equipment_code, notes: body.notes || null } });
      return Response.json({ ok:true }, { headers:corsHeaders });
    }

    if (body.entity === 'equipment' && body.action === 'defect_clear') {
      const equipmentId = await resolveEquipmentIdByCode(supabase, body.equipment_code);
      if (!equipmentId) return Response.json({ ok:false, error:'Equipment required' }, { status:400, headers:corsHeaders });
      await supabase.from('equipment_items').update({ defect_status:'clear', defect_notes: body.notes ?? null, is_locked_out:false, locked_out_at:null, locked_out_by_profile_id:null, updated_at:new Date().toISOString() }).eq('id', equipmentId);
      await insertNotification(supabase, { notification_type:'equipment_lockout_cleared', target_table:'equipment_items', target_id:equipmentId, recipient_role:'admin', title:`Equipment lockout cleared: ${body.equipment_code}`, body: JSON.stringify({ equipment_code: body.equipment_code, notes: body.notes || null }), created_by_profile_id: actorProfile.id, email_subject: `YWI HSE equipment lockout cleared: ${body.equipment_code}`, payload: { equipment_code: body.equipment_code, notes: body.notes || null } });
      return Response.json({ ok:true }, { headers:corsHeaders });
    }

    if (body.entity === 'equipment' && body.action === 'return') {
      const equipmentId = await resolveEquipmentIdByCode(supabase, body.equipment_code);
      if (!equipmentId) return Response.json({ ok:false, error:'Equipment required' }, { status:400, headers:corsHeaders });
      const { data: item } = await supabase.from('equipment_items').select('*').eq('id', equipmentId).maybeSingle();
      const { data: signout } = await supabase.from('equipment_signouts').select('*').eq('equipment_item_id', equipmentId).is('returned_at', null).order('checked_out_at', { ascending:false }).limit(1).maybeSingle();
      const returnDestinationSiteId = await resolveSiteIdByCodeOrName(supabase, body.return_destination_site || body.return_site || body.current_site || body.home_site) || signout?.return_destination_site_id || item?.home_site_id || item?.current_site_id || null;
      const returnTestStatus = normalizeEquipmentTestStatus(body.return_test_status || body.return_safety_test_status);
      const hasReturnIssue = !!body.damage_reported || returnTestStatus === 'failed' || returnTestStatus === 'needs_service';
      const now = new Date().toISOString();
      const transferStatus = hasReturnIssue ? 'return_issue' : 'returned_pending_review';
      await supabase.from('equipment_items').update({
        status: hasReturnIssue ? 'maintenance' : 'pending_return_review',
        current_job_id:null,
        assigned_supervisor_profile_id:null,
        current_site_id: returnDestinationSiteId,
        target_site_id:null,
        condition_status: body.return_condition ?? null,
        last_return_test_status: returnTestStatus,
        last_transfer_status: transferStatus,
        last_transfer_notes: body.return_test_notes || body.return_notes || body.damage_notes || null,
        defect_status: hasReturnIssue ? 'open' : (body.defect_status || 'clear'),
        defect_notes: hasReturnIssue ? (body.damage_notes || body.return_test_notes || body.return_notes || null) : null,
        is_locked_out: hasReturnIssue,
        locked_out_at: hasReturnIssue ? now : null,
        locked_out_by_profile_id: hasReturnIssue ? actorProfile.id : null,
        updated_at: now
      }).eq('id', equipmentId);
      if (signout?.id) await supabase.from('equipment_signouts').update({
        returned_at: now,
        return_destination_site_id: returnDestinationSiteId,
        return_worker_signature_name: body.worker_signature_name ?? null,
        return_supervisor_signature_name: body.supervisor_signature_name ?? null,
        return_admin_signature_name: body.admin_signature_name ?? null,
        return_condition: body.return_condition ?? null,
        return_notes: body.return_notes ?? null,
        return_test_status: returnTestStatus,
        return_test_notes: body.return_test_notes ?? null,
        return_accessory_checklist: normalizeJsonArray(body.return_accessory_checklist || body.accessory_checklist),
        return_accessory_status: normalizeAccessoryStatus(body.return_accessory_status),
        accessory_missing_notes: body.accessory_missing_notes || signout.accessory_missing_notes || null,
        damage_reported: !!body.damage_reported,
        damage_notes: body.damage_notes ?? null,
        verification_status: transferStatus,
      }).eq('id', signout.id);
      await insertEquipmentTransferEvent(supabase, { equipment_item_id: equipmentId, signout_id: signout?.id || null, job_id: signout?.job_id || null, event_type: hasReturnIssue ? 'return_issue' : 'return_received', from_site_id: signout?.intended_site_id || item?.current_site_id || null, to_site_id: returnDestinationSiteId, test_status: returnTestStatus, condition_status: body.return_condition ?? null, verified_by_profile_id: actorProfile.id, verification_notes: body.return_test_notes || body.return_notes || body.damage_notes || null, event_payload: { equipment_code: body.equipment_code, damage_reported: !!body.damage_reported, verification_status: transferStatus } });
      if (hasReturnIssue) await insertEquipmentServiceTask(supabase, { equipment_item_id: equipmentId, source_signout_id: signout?.id || null, job_id: signout?.job_id || null, task_type: body.damage_reported ? 'repair' : 'return_test_followup', priority:'high', failure_reason: body.damage_notes || body.return_test_notes || `Return test ${returnTestStatus}`, estimated_cost: Number(body.estimated_service_cost || 0), notes: body.return_notes || body.return_test_notes || body.damage_notes || null, created_by_profile_id: actorProfile.id });
      await insertNotification(supabase, { notification_type: hasReturnIssue ? 'equipment_return_exception' : 'equipment_return', target_table:'equipment_items', target_id:equipmentId, recipient_role:'admin', title:`Equipment returned${hasReturnIssue ? ' with issue' : ''}: ${body.equipment_code}`, body: JSON.stringify({ equipment_code: body.equipment_code, verification_status: transferStatus }), created_by_profile_id: actorProfile.id, email_subject: `YWI HSE equipment return: ${body.equipment_code}`, payload: { equipment_code: body.equipment_code, damage_reported: !!body.damage_reported, damage_notes: body.damage_notes ?? null, signout_id: signout?.id || null, return_test_status: returnTestStatus, verification_status: transferStatus } });
      return Response.json({ ok:true, signout_id: signout?.id || null, verification_status: transferStatus }, { headers:corsHeaders });
    }

    if (body.entity === 'equipment' && body.action === 'verify_return_complete') {
      const equipmentId = await resolveEquipmentIdByCode(supabase, body.equipment_code);
      if (!equipmentId) return Response.json({ ok:false, error:'Equipment required' }, { status:400, headers:corsHeaders });
      const { data: item } = await supabase.from('equipment_items').select('*').eq('id', equipmentId).maybeSingle();
      const { data: signout } = await supabase.from('equipment_signouts').select('*').eq('equipment_item_id', equipmentId).not('returned_at', 'is', null).order('returned_at', { ascending:false }).limit(1).maybeSingle();
      if (!signout?.id) return Response.json({ ok:false, error:'No returned checkout was found for final return verification.' }, { status:404, headers:corsHeaders });
      const returnTestStatus = normalizeEquipmentTestStatus(body.return_test_status || signout.return_test_status || item?.last_return_test_status);
      const returnOk = isPassingEquipmentTest(returnTestStatus) && !signout.damage_reported && String(body.return_condition || signout.return_condition || '').toLowerCase() !== 'damaged';
      const verificationStatus = returnOk ? 'return_verified' : 'return_issue';
      const now = new Date().toISOString();
      const { data, error } = await supabase.from('equipment_signouts').update({
        return_verified_at: now,
        return_verified_by_profile_id: actorProfile.id,
        return_test_status: returnTestStatus,
        return_test_notes: body.return_test_notes || signout.return_test_notes || null,
        verification_status: verificationStatus,
      }).eq('id', signout.id).select('*').single();
      if (error) throw error;
      await supabase.from('equipment_items').update({
        status: returnOk ? 'available' : 'maintenance',
        last_return_verified_at: now,
        last_return_verified_by_profile_id: actorProfile.id,
        last_return_test_status: returnTestStatus,
        last_transfer_status: verificationStatus,
        last_transfer_notes: body.return_test_notes || body.return_notes || null,
        defect_status: returnOk ? 'clear' : 'open',
        defect_notes: returnOk ? null : (body.return_test_notes || body.return_notes || signout.damage_notes || null),
        is_locked_out: returnOk ? false : true,
        locked_out_at: returnOk ? null : now,
        locked_out_by_profile_id: returnOk ? null : actorProfile.id,
        updated_at: now,
      }).eq('id', equipmentId);
      await insertEquipmentTransferEvent(supabase, { equipment_item_id: equipmentId, signout_id: signout.id, job_id: signout.job_id, event_type: returnOk ? 'return_verified' : 'return_issue', from_site_id: signout.intended_site_id || null, to_site_id: signout.return_destination_site_id || item?.current_site_id || null, test_status: returnTestStatus, condition_status: body.return_condition || signout.return_condition || null, verified_by_profile_id: actorProfile.id, verification_notes: body.return_test_notes || body.return_notes || null, event_payload: { equipment_code: body.equipment_code, verification_status: verificationStatus } });
      if (!returnOk) await insertEquipmentServiceTask(supabase, { equipment_item_id: equipmentId, source_signout_id: signout.id, job_id: signout.job_id, task_type:'return_test_followup', priority:'high', failure_reason: body.return_test_notes || body.return_notes || signout.damage_notes || `Return verification ${returnTestStatus}`, estimated_cost: Number(body.estimated_service_cost || 0), notes: body.return_test_notes || body.return_notes || signout.damage_notes || null, created_by_profile_id: actorProfile.id });
      await insertNotification(supabase, { notification_type:'equipment_return_verified', target_table:'equipment_signouts', target_id:signout.id, recipient_role:'admin', title:`Equipment return ${returnOk ? 'verified' : 'issue'}: ${body.equipment_code}`, body: JSON.stringify({ equipment_code: body.equipment_code, return_test_status: returnTestStatus, verification_status: verificationStatus }), created_by_profile_id: actorProfile.id, email_subject: `YWI HSE equipment return verification: ${body.equipment_code}`, payload: { equipment_code: body.equipment_code, signout_id: signout.id, return_test_status: returnTestStatus, verification_status: verificationStatus } });
      return Response.json({ ok:true, record:data, signout_id: signout.id, verification_status: verificationStatus }, { headers:corsHeaders });
    }

    return Response.json({ ok:false, error:'Unsupported entity/action' }, { status:400, headers:corsHeaders });
  } catch (error) {
    return Response.json({ ok:false, error:String(error) }, { status:500, headers:corsHeaders });
  }
});
