// Detailed Edge Function: jobs-manage
// Purpose:
// - Create/update jobs and equipment records
// - Reserve equipment for jobs using real quantity-pool checks across overlapping jobs
// - Check equipment out to jobs and return it
// - Queue approval/conflict notifications and send email when configured

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
  if (!actorProfile?.is_active || roleRank(actorProfile.role) < roleRank('supervisor')) return Response.json({ ok:false, error:'Supervisor+ required' }, { status:403, headers:corsHeaders });

  const body = await req.json().catch(() => ({}));
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
        return Response.json({ ok:true, record:data }, { headers:corsHeaders });
      }
      if (body.action === 'update') {
        const { data, error } = await supabase.from('job_sessions').update(payload).eq('id', body.item_id).select('*').single();
        if (error) throw error;
        await supabase.from('jobs').update({ last_activity_at: now, updated_at: now, delayed_schedule: payload.delay_minutes > 0 }).eq('id', payload.job_id);
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
        return Response.json({ ok:true, record:data }, { headers:corsHeaders });
      }
      if (body.action === 'update') {
        const { data, error } = await supabase.from('job_session_crew_hours').update(payload).eq('id', body.item_id).select('*').single();
        if (error) throw error;
        await supabase.from('jobs').update({ last_activity_at: now, updated_at: now }).eq('id', payload.job_id);
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
        return Response.json({ ok:true, record:data }, { headers:corsHeaders });
      }
      if (body.action === 'delete') {
        await supabase.from('job_reassignment_events').delete().eq('id', body.item_id);
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
      const homeSiteId = await resolveSiteIdByCodeOrName(supabase, body.home_site);
      const currentJobId = await resolveJobIdByCode(supabase, body.current_job_code);
      const poolKey = normalizePoolKey(body.equipment_pool_key || body.category || body.equipment_name || body.equipment_code);
      const { data, error } = await supabase.from('equipment_items').upsert({
        equipment_code: body.equipment_code,
        equipment_name: body.equipment_name,
        category: body.category ?? null,
        home_site_id: homeSiteId,
        status: body.status ?? 'available',
        current_job_id: currentJobId,
        assigned_supervisor_profile_id: await resolveProfileIdByNameOrEmail(supabase, body.assigned_supervisor_name),
        equipment_pool_key: poolKey || null,
        serial_number: body.serial_number ?? null,
        asset_tag: body.asset_tag ?? null,
        manufacturer: body.manufacturer ?? null,
        model_number: body.model_number ?? null,
        purchase_year: body.purchase_year ?? null,
        purchase_date: body.purchase_date ?? null,
        purchase_price: body.purchase_price ?? null,
        condition_status: body.condition_status ?? null,
        image_url: body.image_url ?? null,
        service_interval_days: body.service_interval_days ?? null,
        last_service_date: body.last_service_date ?? null,
        next_service_due_date: body.next_service_due_date ?? null,
        last_inspection_at: body.last_inspection_at ?? null,
        next_inspection_due_date: body.next_inspection_due_date ?? null,
        defect_status: body.defect_status ?? 'clear',
        defect_notes: body.defect_notes ?? null,
        is_locked_out: body.is_locked_out ?? false,
        locked_out_at: body.is_locked_out ? new Date().toISOString() : null,
        locked_out_by_profile_id: body.is_locked_out ? actorProfile.id : null,
        comments: body.comments ?? null,
        notes: body.notes ?? null,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'equipment_code' }).select('*').single();
      if (error) throw error;
      return Response.json({ ok:true, record: data }, { headers:corsHeaders });
    }

    if (body.entity === 'equipment' && body.action === 'checkout') {
      const equipmentId = await resolveEquipmentIdByCode(supabase, body.equipment_code);
      const jobId = await resolveJobIdByCode(supabase, body.job_code);
      if (!equipmentId || !jobId) return Response.json({ ok:false, error:'Equipment and job are required' }, { status:400, headers:corsHeaders });
      const { data: item } = await supabase.from('equipment_items').select('*').eq('id', equipmentId).single();
      if (!item) return Response.json({ ok:false, error:'Equipment not found' }, { status:404, headers:corsHeaders });
      if (item.is_locked_out) return Response.json({ ok:false, error:'Equipment is locked out for a defect or failed inspection' }, { status:409, headers:corsHeaders });
      if (!['available','reserved'].includes(item.status)) return Response.json({ ok:false, error:'Equipment is not available for checkout' }, { status:409, headers:corsHeaders });
      await supabase.from('equipment_items').update({ status:'checked_out', current_job_id: jobId, assigned_supervisor_profile_id: await resolveProfileIdByNameOrEmail(supabase, body.supervisor_name), condition_status: body.checkout_condition ?? item.condition_status ?? null, updated_at:new Date().toISOString() }).eq('id', equipmentId);
      const { data, error } = await supabase.from('equipment_signouts').insert({ equipment_item_id: equipmentId, job_id: jobId, checked_out_by_profile_id: actorProfile.id, checked_out_to_supervisor_profile_id: await resolveProfileIdByNameOrEmail(supabase, body.supervisor_name), signout_notes: body.notes ?? null, checkout_worker_signature_name: body.worker_signature_name ?? null, checkout_supervisor_signature_name: body.supervisor_signature_name ?? null, checkout_admin_signature_name: body.admin_signature_name ?? null, checkout_condition: body.checkout_condition ?? null }).select('*').single();
      if (error) throw error;
      await insertNotification(supabase, { notification_type:'equipment_checkout', target_table:'equipment_signouts', target_id:data.id, recipient_role:'admin', title:`Equipment checked out: ${body.equipment_code}`, body: JSON.stringify({ equipment_code: body.equipment_code, job_code: body.job_code }), created_by_profile_id: actorProfile.id, email_subject: `YWI HSE equipment checkout: ${body.equipment_code}`, payload: { equipment_code: body.equipment_code, job_code: body.job_code, signout_id: data.id } });
      return Response.json({ ok:true, record:data, signout_id: data.id }, { headers:corsHeaders });
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
      await supabase.from('equipment_items').update({ status:'available', current_job_id:null, assigned_supervisor_profile_id:null, condition_status: body.return_condition ?? null, updated_at:new Date().toISOString() }).eq('id', equipmentId);
      const { data: signout } = await supabase.from('equipment_signouts').select('*').eq('equipment_item_id', equipmentId).is('returned_at', null).order('checked_out_at', { ascending:false }).limit(1).maybeSingle();
      if (signout?.id) await supabase.from('equipment_signouts').update({ returned_at:new Date().toISOString(), return_worker_signature_name: body.worker_signature_name ?? null, return_supervisor_signature_name: body.supervisor_signature_name ?? null, return_admin_signature_name: body.admin_signature_name ?? null, return_condition: body.return_condition ?? null, return_notes: body.return_notes ?? null, damage_reported: !!body.damage_reported, damage_notes: body.damage_notes ?? null }).eq('id', signout.id);
      await insertNotification(supabase, { notification_type:'equipment_return', target_table:'equipment_items', target_id:equipmentId, recipient_role:'admin', title:`Equipment returned: ${body.equipment_code}`, body: JSON.stringify({ equipment_code: body.equipment_code }), created_by_profile_id: actorProfile.id, email_subject: `YWI HSE equipment return: ${body.equipment_code}`, payload: { equipment_code: body.equipment_code, damage_reported: !!body.damage_reported, damage_notes: body.damage_notes ?? null, signout_id: signout?.id || null } });
      return Response.json({ ok:true, signout_id: signout?.id || null }, { headers:corsHeaders });
    }

    return Response.json({ ok:false, error:'Unsupported entity/action' }, { status:400, headers:corsHeaders });
  } catch (error) {
    return Response.json({ ok:false, error:String(error) }, { status:500, headers:corsHeaders });
  }
});
