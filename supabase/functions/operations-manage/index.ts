import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const BUILD = '2026-06-17a';
const SCHEMA = 149;
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-idempotency-key',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

class HttpError extends Error {
  status: number;
  details?: unknown;
  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

function clean(value: unknown, max = 1000) {
  return String(value ?? '').trim().slice(0, max);
}
function money(value: unknown) {
  const n = Number(String(value ?? '').replace(/[$,]/g, ''));
  return Number.isFinite(n) ? Number(n.toFixed(2)) : 0;
}
function int(value: unknown, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}
function objectValue(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}
function idempotencyKey(req: Request, body: Record<string, unknown>, prefix: string) {
  return clean(req.headers.get('x-idempotency-key') || body.idempotency_key, 180) || `${prefix}_${crypto.randomUUID()}`;
}
function normalizeRole(role: unknown) {
  return clean(role, 80).toLowerCase();
}
function roleRank(role: unknown) {
  const map: Record<string, number> = { worker: 10, employee: 10, staff: 10, onsite_admin: 18, site_leader: 20, supervisor: 30, hse: 40, job_admin: 45, admin: 50 };
  return map[normalizeRole(role)] || 0;
}
function requireRank(profile: any, minimum: number, action: string) {
  if (!profile?.id) throw new HttpError(401, 'Sign in is required.');
  if (roleRank(profile.role) < minimum) throw new HttpError(403, `Your role cannot perform ${action}.`);
}
function isUuid(value: unknown) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(clean(value, 80));
}
function isoDate(value: unknown) {
  const raw = clean(value, 60);
  if (!raw) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const match = raw.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})$/);
  if (match) {
    let year = Number(match[3]);
    if (year < 100) year += 2000;
    const month = Number(match[1]);
    const day = Number(match[2]);
    const d = new Date(Date.UTC(year, month - 1, day));
    if (d.getUTCFullYear() === year && d.getUTCMonth() === month - 1 && d.getUTCDate() === day) {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }
  const parsed = new Date(raw);
  return Number.isNaN(parsed.valueOf()) ? null : parsed.toISOString().slice(0, 10);
}
function pick(row: Record<string, unknown>, names: string[]) {
  const entries = Object.entries(row);
  for (const name of names) {
    const found = entries.find(([key]) => key.trim().toLowerCase() === name.toLowerCase());
    if (found && clean(found[1], 1000)) return found[1];
  }
  return '';
}
function parseAmount(row: Record<string, unknown>) {
  const amount = money(pick(row, ['amount', 'transaction amount', 'value']));
  if (amount) return { amount, debit: amount < 0 ? Math.abs(amount) : 0, credit: amount > 0 ? amount : 0 };
  const debit = money(pick(row, ['debit', 'withdrawal', 'money out']));
  const credit = money(pick(row, ['credit', 'deposit', 'money in']));
  return { amount: Number((credit - debit).toFixed(2)), debit, credit };
}
function validateBankRows(rows: Record<string, unknown>[] = []) {
  const seen = new Set<string>();
  return rows.map((row, index) => {
    const rawDate = pick(row, ['date', 'transaction date', 'posted date', 'posting date']);
    const dateText = isoDate(rawDate);
    const description = clean(pick(row, ['description', 'memo', 'details', 'transaction']), 500);
    const reference = clean(pick(row, ['reference', 'reference number', 'id', 'transaction id', 'cheque number']), 160);
    const parsed = parseAmount(row);
    const key = `${dateText || clean(rawDate, 40)}|${description.toLowerCase()}|${parsed.amount}|${reference}`;
    const reasons: string[] = [];
    if (!dateText) reasons.push('Missing or invalid transaction date.');
    if (!description) reasons.push('Missing description.');
    if (!parsed.amount) reasons.push('Missing or zero amount.');
    const duplicate = seen.has(key);
    if (duplicate) reasons.push('Possible duplicate row.');
    seen.add(key);
    return {
      row, index: index + 1, dateText, description, reference,
      amount: parsed.amount, debit: parsed.debit, credit: parsed.credit,
      duplicate, status: reasons.length ? 'rejected' : 'accepted', reasons, duplicateKey: key
    };
  });
}

async function getActor(supabase: any, req: Request) {
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) return { user: null, profile: null };
  const { data } = await supabase.auth.getUser(token);
  const user = data?.user || null;
  if (!user?.id) return { user: null, profile: null };
  const { data: profile } = await supabase.from('profiles').select('id, role, full_name, email').eq('user_id', user.id).maybeSingle();
  return { user, profile };
}
async function audit(supabase: any, payload: Record<string, unknown>) {
  try {
    await supabase.from('operation_write_audit_events').insert({
      operation_action: clean(payload.operation_action, 120) || 'unknown',
      operation_status: clean(payload.operation_status, 80) || 'captured',
      entity_type: clean(payload.entity_type, 120) || null,
      entity_id: isUuid(payload.entity_id) ? payload.entity_id : null,
      actor_profile_id: isUuid(payload.actor_profile_id) ? payload.actor_profile_id : null,
      request_payload: objectValue(payload.request_payload),
      response_payload: objectValue(payload.response_payload),
      error_message: clean(payload.error_message, 2000) || null
    });
  } catch { /* audit must never break the requested action */ }
}
function safeRequest(body: Record<string, unknown>) {
  const copy = { ...body };
  delete copy.local_payload;
  delete copy.server_payload;
  if (copy.rows) copy.rows = `[${Array.isArray(copy.rows) ? copy.rows.length : 0} rows]`;
  return copy;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return Response.json({ ok: false, error: 'Use POST.' }, { status: 405, headers: corsHeaders });

  let supabase: any = null;
  let body: Record<string, unknown> = {};
  let profile: any = null;
  let action = '';
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || Deno.env.get('SB_URL') || '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SB_SERVICE_ROLE_KEY') || '';
    if (!supabaseUrl || !serviceKey) throw new HttpError(500, 'operations-manage is not configured.');
    supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
    body = await req.json().catch(() => ({}));
    action = clean(body.action, 80);
    ({ profile } = await getActor(supabase, req));
    if (!action) throw new HttpError(400, 'action is required.');

    if (action === 'payment_action_request') {
      requireRank(profile, 45, action);
      const allowed = ['apply_payment','reverse_payment','refund','write_off','overpayment_credit'];
      const actionType = clean(body.action_type || 'apply_payment', 80);
      if (!allowed.includes(actionType)) throw new HttpError(400, 'Unsupported payment action type.');
      const amount = money(body.amount);
      if (amount <= 0) throw new HttpError(400, 'Payment action amount must be greater than zero.');
      const reason = clean(body.reason, 1000);
      if (reason.length < 8) throw new HttpError(400, 'Add a clear reason of at least 8 characters.');
      const proofRequired = body.proof_required !== false;
      const proofReference = clean(body.proof_reference, 240);
      if (proofRequired && !proofReference) throw new HttpError(400, 'Proof reference is required for this action.');
      const key = idempotencyKey(req, body, 'payment');
      const row = {
        idempotency_key: key,
        action_type: actionType,
        action_status: 'submitted',
        customer_or_vendor_name: clean(body.customer_or_vendor_name, 180) || null,
        invoice_reference: clean(body.invoice_reference, 160) || null,
        payment_reference: clean(body.payment_reference, 160) || null,
        amount,
        currency_code: clean(body.currency_code || 'CAD', 8) || 'CAD',
        reason,
        proof_required: proofRequired,
        proof_reference: proofReference || null,
        requested_by_profile_id: profile.id,
        rollback_hint: 'Use a reversal request before period close if posted in error.',
        metadata: { build: BUILD, schema: SCHEMA, source: 'operations-manage' }
      };
      const { data, error } = await supabase.from('payment_action_requests').upsert(row, { onConflict: 'idempotency_key', ignoreDuplicates: false }).select('*').single();
      if (error) throw error;
      await audit(supabase, { operation_action: action, operation_status: 'submitted', entity_type: 'payment_action_request', entity_id: data.id, actor_profile_id: profile.id, request_payload: safeRequest(body), response_payload: { action_key: data.action_key } });
      return Response.json({ ok: true, record: data }, { headers: corsHeaders });
    }

    if (action === 'payment_action_decision') {
      requireRank(profile, 45, action);
      const requestId = clean(body.request_id, 80);
      if (!isUuid(requestId)) throw new HttpError(400, 'Valid request_id is required.');
      const decision = clean(body.decision, 40);
      if (!['approve','reject','post','cancel'].includes(decision)) throw new HttpError(400, 'Unsupported payment decision.');
      const { data: existing, error: readError } = await supabase.from('payment_action_requests').select('*').eq('id', requestId).single();
      if (readError) throw readError;
      const update: Record<string, unknown> = { updated_at: new Date().toISOString(), decision_note: clean(body.decision_note, 1000) || null };
      if (decision === 'approve') Object.assign(update, { action_status: 'approved', approved_by_profile_id: profile.id, approved_at: new Date().toISOString() });
      if (decision === 'reject') {
        const reason = clean(body.rejection_reason || body.decision_note, 1000);
        if (!reason) throw new HttpError(400, 'Rejection reason is required.');
        Object.assign(update, { action_status: 'rejected', rejected_by_profile_id: profile.id, rejected_at: new Date().toISOString(), rejection_reason: reason });
      }
      if (decision === 'cancel') Object.assign(update, { action_status: 'cancelled' });
      if (decision === 'post') {
        if (existing.action_status !== 'approved') throw new HttpError(409, 'Approve the payment action before posting.');
        if (existing.proof_required && !existing.proof_reference) throw new HttpError(409, 'Proof reference is required before posting.');
        if (body.period_lock_checked !== true) throw new HttpError(409, 'Confirm the accounting period lock check before posting.');
        Object.assign(update, { action_status: 'posted', period_lock_checked: true, posted_at: new Date().toISOString() });
      }
      const { data, error } = await supabase.from('payment_action_requests').update(update).eq('id', requestId).select('*').single();
      if (error) throw error;
      await audit(supabase, { operation_action: action, operation_status: decision, entity_type: 'payment_action_request', entity_id: data.id, actor_profile_id: profile.id, request_payload: safeRequest(body), response_payload: { status: data.action_status } });
      return Response.json({ ok: true, record: data }, { headers: corsHeaders });
    }

    if (action === 'bank_csv_preview') {
      requireRank(profile, 45, action);
      const rows = Array.isArray(body.rows) ? (body.rows as Record<string, unknown>[]).slice(0, 1000) : [];
      if (!rows.length) throw new HttpError(400, 'CSV preview needs at least one transaction row.');
      const headers = Array.isArray(body.headers) ? body.headers.map((h) => clean(h, 120)).filter(Boolean) : [];
      if (headers.length < 2) throw new HttpError(400, 'CSV headers were not detected.');
      const lower = headers.map((h) => h.toLowerCase());
      const hasDate = lower.some((h) => /date/.test(h));
      const hasDescription = lower.some((h) => /(description|memo|detail|transaction)/.test(h));
      const hasAmount = lower.some((h) => /(amount|debit|credit|withdrawal|deposit|money in|money out)/.test(h));
      if (!hasDate || !hasDescription || !hasAmount) throw new HttpError(400, 'CSV needs date, description/memo, and amount or debit/credit columns.', { headers });
      const validated = validateBankRows(rows);
      const accepted = validated.filter((r) => r.status === 'accepted').length;
      const rejected = validated.length - accepted;
      const duplicates = validated.filter((r) => r.duplicate).length;
      const key = idempotencyKey(req, body, 'bank');
      const { data: batch, error: batchError } = await supabase.from('bank_csv_import_previews').upsert({
        idempotency_key: key,
        original_filename: clean(body.original_filename, 260) || null,
        bank_account_hint: clean(body.bank_account_hint, 180) || null,
        preview_status: 'review',
        header_json: headers,
        total_rows: validated.length,
        accepted_rows: accepted,
        rejected_rows: rejected,
        duplicate_rows: duplicates,
        validation_summary: { accepted, rejected, duplicates, headers, header_checks: { hasDate, hasDescription, hasAmount } },
        created_by_profile_id: profile.id,
        metadata: { build: BUILD, schema: SCHEMA, source: 'operations-manage' }
      }, { onConflict: 'idempotency_key', ignoreDuplicates: false }).select('*').single();
      if (batchError) throw batchError;
      await supabase.from('bank_csv_import_preview_rows').delete().eq('import_id', batch.id);
      const insertRows = validated.map((item) => ({
        import_id: batch.id,
        row_number: item.index,
        row_status: item.status,
        transaction_date: item.dateText,
        description: item.description || null,
        amount: item.amount,
        debit_amount: item.debit || null,
        credit_amount: item.credit || null,
        reference: item.reference || null,
        duplicate_key: item.duplicateKey,
        rejection_reason: item.reasons.join('; ') || null,
        raw_row: item.row
      }));
      const { error: rowError } = await supabase.from('bank_csv_import_preview_rows').insert(insertRows);
      if (rowError) throw rowError;
      await audit(supabase, { operation_action: action, operation_status: 'review', entity_type: 'bank_csv_import_preview', entity_id: batch.id, actor_profile_id: profile.id, request_payload: safeRequest(body), response_payload: { accepted, rejected, duplicates } });
      return Response.json({ ok: true, batch, summary: { accepted, rejected, duplicates }, rows: validated.slice(0, 100) }, { headers: corsHeaders });
    }

    if (action === 'bank_csv_confirm_import') {
      requireRank(profile, 45, action);
      const importId = clean(body.import_id, 80);
      if (!isUuid(importId)) throw new HttpError(400, 'Valid import_id is required.');
      const { data: preview, error: readError } = await supabase.from('bank_csv_import_previews').select('*').eq('id', importId).single();
      if (readError) throw readError;
      if (preview.accepted_rows < 1) throw new HttpError(409, 'No accepted rows are available to confirm.');
      const { data, error } = await supabase.from('bank_csv_import_previews').update({
        preview_status: 'confirmed', confirmed_at: new Date().toISOString(), confirmed_by_profile_id: profile.id,
        confirmation_note: clean(body.confirmation_note, 1000) || null, updated_at: new Date().toISOString()
      }).eq('id', importId).select('*').single();
      if (error) throw error;
      await audit(supabase, { operation_action: action, operation_status: 'confirmed', entity_type: 'bank_csv_import_preview', entity_id: data.id, actor_profile_id: profile.id, request_payload: safeRequest(body), response_payload: { accepted_rows: data.accepted_rows } });
      return Response.json({ ok: true, record: data }, { headers: corsHeaders });
    }

    if (action === 'reconciliation_action') {
      requireRank(profile, 45, action);
      const type = clean(body.action_type || 'match', 80);
      if (!['match','split','undo','signoff','reject'].includes(type)) throw new HttpError(400, 'Unsupported reconciliation action type.');
      if (type === 'split' && (!Array.isArray(body.split_rows) || body.split_rows.length < 2)) throw new HttpError(400, 'Split actions need at least two split rows.');
      if (['signoff','reject'].includes(type) && clean(body.signoff_note, 1000).length < 8) throw new HttpError(400, 'Signoff/rejection note must be at least 8 characters.');
      const key = idempotencyKey(req, body, 'recon');
      const { data, error } = await supabase.from('reconciliation_action_requests').upsert({
        idempotency_key: key,
        action_type: type,
        action_status: type === 'signoff' ? 'signed_off' : 'submitted',
        import_id: isUuid(body.import_id) ? body.import_id : null,
        bank_row_id: isUuid(body.bank_row_id) ? body.bank_row_id : null,
        target_reference: clean(body.target_reference, 240) || null,
        split_json: Array.isArray(body.split_rows) ? body.split_rows : [],
        signoff_note: clean(body.signoff_note, 1000) || null,
        undo_of_action_id: isUuid(body.undo_of_action_id) ? body.undo_of_action_id : null,
        requested_by_profile_id: profile.id,
        signed_off_by_profile_id: type === 'signoff' ? profile.id : null,
        signed_off_at: type === 'signoff' ? new Date().toISOString() : null,
        decision_note: clean(body.decision_note, 1000) || null,
        metadata: { build: BUILD, schema: SCHEMA, source: 'operations-manage' }
      }, { onConflict: 'idempotency_key', ignoreDuplicates: false }).select('*').single();
      if (error) throw error;
      await audit(supabase, { operation_action: action, operation_status: data.action_status, entity_type: 'reconciliation_action_request', entity_id: data.id, actor_profile_id: profile.id, request_payload: safeRequest(body), response_payload: { action_type: data.action_type } });
      return Response.json({ ok: true, record: data }, { headers: corsHeaders });
    }

    if (action === 'equipment_scan_event') {
      requireRank(profile, 30, action);
      const equipmentReference = clean(body.equipment_reference || body.scan_code, 180);
      if (!equipmentReference) throw new HttpError(400, 'Equipment code/reference is required.');
      const key = idempotencyKey(req, body, 'equipment');
      const { data: scan, error: scanError } = await supabase.from('equipment_scan_events').upsert({
        idempotency_key: key,
        scan_code: clean(body.scan_code || equipmentReference, 180),
        scan_source: clean(body.scan_source || 'manual', 80),
        scan_stage: clean(body.scan_stage || 'field_check', 80),
        scan_status: clean(body.scan_status || 'captured', 80),
        equipment_reference: equipmentReference,
        job_reference: clean(body.job_reference, 180) || null,
        actor_profile_id: profile.id,
        location_hint: clean(body.location_hint, 240) || null,
        notes: clean(body.notes, 1000) || null,
        metadata: { build: BUILD, schema: SCHEMA, source: 'operations-manage' }
      }, { onConflict: 'idempotency_key', ignoreDuplicates: false }).select('*').single();
      if (scanError) throw scanError;
      const { data: custody, error: custodyError } = await supabase.from('equipment_custody_timeline_events').insert({
        equipment_reference: equipmentReference,
        custody_stage: clean(body.custody_stage || body.scan_stage || 'field_check', 80),
        custody_status: clean(body.custody_status || 'captured', 80),
        job_reference: clean(body.job_reference, 180) || null,
        condition_summary: clean(body.condition_summary, 500) || null,
        accessory_summary: clean(body.accessory_summary, 500) || null,
        signer_name: clean(body.signer_name || profile.full_name, 180) || null,
        actor_profile_id: profile.id,
        scan_event_id: scan.id,
        service_required: !!body.service_required,
        cost_recovery_required: !!body.cost_recovery_required,
        notes: clean(body.notes, 1000) || null,
        metadata: { build: BUILD, schema: SCHEMA, source: 'operations-manage' }
      }).select('*').single();
      if (custodyError) throw custodyError;
      await audit(supabase, { operation_action: action, operation_status: 'captured', entity_type: 'equipment_scan_event', entity_id: scan.id, actor_profile_id: profile.id, request_payload: safeRequest(body), response_payload: { custody_id: custody.id } });
      return Response.json({ ok: true, scan, custody }, { headers: corsHeaders });
    }

    if (action === 'visual_asset_register' || action === 'visual_asset_decision') {
      requireRank(profile, 45, action);
      const deciding = action === 'visual_asset_decision';
      const assetId = clean(body.asset_id, 80);
      if (deciding && !isUuid(assetId)) throw new HttpError(400, 'Valid asset_id is required.');
      const status = clean(body.asset_status || body.decision || 'draft', 80);
      if (!['draft','review','approved','rejected','archived'].includes(status)) throw new HttpError(400, 'Unsupported asset status.');
      const sourceUrl = clean(body.source_url, 600);
      const altText = clean(body.alt_text, 280);
      if (status === 'approved' && (!sourceUrl || altText.length < 12)) throw new HttpError(409, 'Approved assets need a source URL and useful alt text of at least 12 characters.');
      const consent = clean(body.consent_status || 'not_required', 80);
      const compression = clean(body.compression_status || 'pending', 80);
      const readiness = [!!sourceUrl, altText.length >= 12, ['approved','not_required'].includes(consent), ['ready','optimized'].includes(compression)].filter(Boolean).length * 25;
      const payload: Record<string, unknown> = {
        asset_status: status,
        surface_area: clean(body.surface_area || 'public', 120),
        image_role: clean(body.image_role || 'placeholder_replacement', 120),
        source_url: sourceUrl || null,
        alt_text: altText || null,
        consent_status: consent,
        compression_status: compression,
        route_key: clean(body.route_key, 120) || null,
        notes: clean(body.notes, 1000) || null,
        rejection_reason: status === 'rejected' ? clean(body.rejection_reason || body.notes, 1000) || 'Rejected during review.' : null,
        approved_by_profile_id: status === 'approved' ? profile.id : null,
        approved_at: status === 'approved' ? new Date().toISOString() : null,
        readiness_score: readiness,
        metadata: { build: BUILD, schema: SCHEMA, source: 'operations-manage' },
        updated_at: new Date().toISOString()
      };
      const query = deciding
        ? supabase.from('visual_asset_approval_items').update(payload).eq('id', assetId)
        : supabase.from('visual_asset_approval_items').insert(payload);
      const { data, error } = await query.select('*').single();
      if (error) throw error;
      await audit(supabase, { operation_action: action, operation_status: status, entity_type: 'visual_asset_approval_item', entity_id: data.id, actor_profile_id: profile.id, request_payload: safeRequest(body), response_payload: { readiness_score: readiness } });
      return Response.json({ ok: true, record: data }, { headers: corsHeaders });
    }

    if (action === 'public_route_register' || action === 'public_route_decision') {
      requireRank(profile, 45, action);
      const routeKey = clean(body.route_key, 120) || clean(body.route_path, 120).replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '').toLowerCase();
      if (!routeKey) throw new HttpError(400, 'route_key or route_path is required.');
      const status = clean(body.route_status || body.decision || 'draft', 80);
      if (!['draft','review','approved','rejected','archived'].includes(status)) throw new HttpError(400, 'Unsupported route status.');
      const title = clean(body.page_title, 180);
      const h1 = clean(body.h1_text, 180);
      const meta = clean(body.meta_description, 320);
      const proof = clean(body.local_proof_hint, 1000);
      const cta = clean(body.primary_cta_path, 240);
      const validation = {
        title_ok: title.length >= 20 && title.length <= 70,
        h1_ok: h1.length >= 10 && h1.length <= 120,
        meta_ok: meta.length >= 70 && meta.length <= 170,
        local_proof_ok: proof.length >= 20,
        cta_ok: cta.startsWith('/') || cta.startsWith('#')
      };
      const readiness = Object.values(validation).filter(Boolean).length * 20;
      if (status === 'approved' && readiness < 100) throw new HttpError(409, 'Route cannot be approved until title, H1, meta, local proof, and CTA checks all pass.', validation);
      const { data, error } = await supabase.from('public_route_approval_items').upsert({
        route_key: routeKey,
        route_status: status,
        route_path: clean(body.route_path || '/', 240),
        page_title: title || 'Page title required',
        h1_text: h1 || 'Main heading required',
        meta_description: meta || null,
        local_proof_hint: proof || null,
        primary_cta_path: cta || null,
        visual_asset_key: clean(body.visual_asset_key, 160) || null,
        sitemap_ready: status === 'approved' && readiness === 100 && body.sitemap_ready !== false,
        approved_by_profile_id: status === 'approved' ? profile.id : null,
        approved_at: status === 'approved' ? new Date().toISOString() : null,
        rejection_reason: status === 'rejected' ? clean(body.rejection_reason, 1000) || 'Rejected during review.' : null,
        seo_readiness_score: readiness,
        validation_json: validation,
        metadata: { build: BUILD, schema: SCHEMA, source: 'operations-manage' },
        updated_at: new Date().toISOString()
      }, { onConflict: 'route_key' }).select('*').single();
      if (error) throw error;
      await audit(supabase, { operation_action: action, operation_status: status, entity_type: 'public_route_approval_item', entity_id: data.id, actor_profile_id: profile.id, request_payload: safeRequest(body), response_payload: { readiness_score: readiness, validation } });
      return Response.json({ ok: true, record: data, validation }, { headers: corsHeaders });
    }

    if (action === 'offline_conflict_card' || action === 'offline_conflict_resolve') {
      requireRank(profile, 30, action);
      if (action === 'offline_conflict_resolve') {
        const conflictId = clean(body.conflict_id, 80);
        if (!isUuid(conflictId)) throw new HttpError(400, 'Valid conflict_id is required.');
        const resolution = clean(body.resolution_action, 80);
        if (!['retry_sync','keep_local','reload_server','discard_local'].includes(resolution)) throw new HttpError(400, 'Unsupported conflict resolution.');
        const { data, error } = await supabase.from('mobile_offline_conflict_cards').update({
          conflict_status: resolution === 'retry_sync' ? 'retrying' : 'resolved',
          resolution_action: resolution,
          resolution_note: clean(body.resolution_note, 1000) || null,
          resolved_by_profile_id: profile.id,
          resolved_at: resolution === 'retry_sync' ? null : new Date().toISOString(),
          retry_count: int(body.retry_count, 0) + (resolution === 'retry_sync' ? 1 : 0),
          updated_at: new Date().toISOString()
        }).eq('id', conflictId).select('*').single();
        if (error) throw error;
        return Response.json({ ok: true, record: data }, { headers: corsHeaders });
      }
      const { data, error } = await supabase.from('mobile_offline_conflict_cards').insert({
        entity_type: clean(body.entity_type || 'draft', 120),
        entity_reference: clean(body.entity_reference, 180) || null,
        conflict_status: clean(body.conflict_status || 'open', 80),
        local_payload: objectValue(body.local_payload),
        server_payload: objectValue(body.server_payload),
        recommended_action: clean(body.recommended_action || 'review', 80)
      }).select('*').single();
      if (error) throw error;
      return Response.json({ ok: true, record: data }, { headers: corsHeaders });
    }

    if (action === 'scorecard_update') {
      requireRank(profile, 45, action);
      const railKey = clean(body.rail_key, 120);
      if (!railKey) throw new HttpError(400, 'rail_key is required.');
      const { data, error } = await supabase.from('admin_scorecard_progress_rails').upsert({
        rail_key: railKey,
        rail_area: clean(body.rail_area || 'admin', 120),
        rail_title: clean(body.rail_title || 'Progress rail', 180),
        rail_status: clean(body.rail_status || 'active', 80),
        progress_percent: Math.max(0, Math.min(100, int(body.progress_percent, 0))),
        current_value: body.current_value === undefined ? null : money(body.current_value),
        target_value: body.target_value === undefined ? null : money(body.target_value),
        next_action_hint: clean(body.next_action_hint, 1000) || null,
        owner_hint: clean(body.owner_hint, 180) || null,
        sort_order: int(body.sort_order, 100),
        metadata: { build: BUILD, schema: SCHEMA, source: 'operations-manage' },
        updated_at: new Date().toISOString()
      }, { onConflict: 'rail_key' }).select('*').single();
      if (error) throw error;
      return Response.json({ ok: true, record: data }, { headers: corsHeaders });
    }

    throw new HttpError(400, `Unsupported operations-manage action: ${action}`);
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 500;
    const message = error instanceof Error ? error.message : 'operations-manage failed.';
    if (supabase) await audit(supabase, { operation_action: action || 'unknown', operation_status: 'error', actor_profile_id: profile?.id, request_payload: safeRequest(body), error_message: message });
    return Response.json({ ok: false, error: message, details: error instanceof HttpError ? error.details : undefined }, { status, headers: corsHeaders });
  }
});
