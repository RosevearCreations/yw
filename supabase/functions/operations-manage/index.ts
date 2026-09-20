import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { hasModuleAccess } from "../_shared/module-permissions.ts";
import { boundaryAuditFields, resolveModuleWriteBoundary } from "../_shared/module-write-boundaries.ts";

const BUILD = '2026-09-01a';
const PAYMENT_APPLICATION_BUILD = 313;
const RECONCILIATION_EXCEPTION_BUILD = 315;
const PAYMENT_POSTING_RPC = 'ywi_rpc_post_payment_action'; // Preserved authority contract; Build 313 does not invoke it.
const SCHEMA = 159;
const WRITE_BOUNDARY_BUILD = '2026-09-01f';
const WRITE_BOUNDARY_SCHEMA = 164;
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

const clean = (value: unknown, max = 1000) => String(value ?? '').trim().slice(0, max);
const money = (value: unknown) => {
  const n = Number(String(value ?? '').replace(/[$,]/g, ''));
  return Number.isFinite(n) ? Number(n.toFixed(2)) : 0;
};
const int = (value: unknown, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
};
const objectValue = (value: unknown) => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const arrayValue = (value: unknown) => Array.isArray(value) ? value : [];
const nowIso = () => new Date().toISOString();
const today = () => new Date().toISOString().slice(0, 10);
const cents = (value: unknown) => Math.round(Math.abs(money(value)) * 100);
const normalize = (value: unknown) => clean(value, 300).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const slug = (value: unknown) => clean(value, 180).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'asset';
const isUuid = (value: unknown) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(clean(value, 80));
const idempotencyKey = (req: Request, body: Record<string, unknown>, prefix: string) => clean(req.headers.get('x-idempotency-key') || body.idempotency_key, 180) || `${prefix}_${crypto.randomUUID()}`;

const RESERVED_PUBLIC_ROUTE_ROOTS = new Set(['api','archive','docs','icons','js','scripts','sql','supabase','index.html','style.css','favicon.ico','manifest.json','robots.txt','sitemap.xml','server-worker.js']);
function safePublicPath(value: unknown) {
  const routePath = `/${clean(value || '/', 240).replace(/^\/+|\/+$/g, '')}`.replace(/^\/$/, '/');
  const root = routePath.split('/').filter(Boolean)[0]?.toLowerCase() || '';
  return { routePath, valid: routePath !== '/' && /^\/[a-z0-9][a-z0-9\/-]*$/.test(routePath) && !routePath.includes('..') && !RESERVED_PUBLIC_ROUTE_ROOTS.has(root) };
}
function safeHttpUrl(value: unknown) {
  const raw = clean(value, 600);
  if (!raw) return null;
  try { const parsed = new URL(raw); return ['http:', 'https:'].includes(parsed.protocol) ? parsed.href : null; } catch { return null; }
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
function bankPreviewCounts(rows: any[] = []) {
  const duplicateFrequency = new Map<string, number>();
  for (const row of rows) {
    const key = clean(row?.duplicate_key, 1200);
    if (key) duplicateFrequency.set(key, (duplicateFrequency.get(key) || 0) + 1);
  }
  const accepted = rows.filter((row) => row?.row_status === 'accepted').length;
  const rejected = rows.filter((row) => row?.row_status === 'rejected').length;
  const duplicates = [...duplicateFrequency.values()].reduce((total, count) => total + Math.max(0, count - 1), 0);
  return { accepted, rejected, duplicates, total: rows.length };
}
async function refreshBankPreviewSummary(supabase: any, importId: string, extraSummary: Record<string, unknown> = {}) {
  const rows = await safeSelect(supabase.from('bank_csv_import_preview_rows')
    .select('id,row_status,duplicate_key,rejection_reason')
    .eq('import_id', importId)
    .is('promoted_at', null)
    .order('row_number')
    .limit(2500));
  const counts = bankPreviewCounts(rows);
  const { data: current, error: readError } = await supabase.from('bank_csv_import_previews')
    .select('validation_summary')
    .eq('id', importId)
    .single();
  if (readError) throw readError;
  const validationSummary = { ...objectValue(current?.validation_summary), accepted: counts.accepted, rejected: counts.rejected, duplicates: counts.duplicates, ...extraSummary };
  const { data, error } = await supabase.from('bank_csv_import_previews').update({
    total_rows: counts.total,
    accepted_rows: counts.accepted,
    rejected_rows: counts.rejected,
    duplicate_rows: counts.duplicates,
    validation_summary: validationSummary,
    updated_at: nowIso()
  }).eq('id', importId).select('*').single();
  if (error) throw error;
  return { preview: data, counts };
}
async function requireBankPreviewReview(supabase: any, profile: any, importId: string) {
  if (!isUuid(importId)) throw new HttpError(400, 'Valid import_id is required.');
  if (!(await hasModuleAccess(supabase, profile, 'finance', 'approve'))) {
    throw new HttpError(403, 'Finance approve access is required to review bank-import rows.');
  }
  const { data: preview, error } = await supabase.from('bank_csv_import_previews').select('*').eq('id', importId).single();
  if (error) throw error;
  if (preview?.promoted_at) throw new HttpError(409, 'This bank import is already promoted and can no longer be edited.');
  if (preview?.preview_status === 'discarded') throw new HttpError(409, 'This bank import was discarded before promotion.');
  return preview;
}
function safeRequest(body: Record<string, unknown>) {
  const copy: Record<string, unknown> = { ...body };
  delete copy.local_payload;
  delete copy.server_payload;
  if (copy.rows) copy.rows = `[${Array.isArray(copy.rows) ? copy.rows.length : 0} rows]`;
  if (copy.file) copy.file = '[file]';
  return copy;
}

async function getActor(supabase: any, req: Request) {
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) return { user: null, profile: null };
  const { data } = await supabase.auth.getUser(token);
  const user = data?.user || null;
  if (!user?.id) return { user: null, profile: null };
  const { data: profile } = await supabase.from('profiles').select('id, role, full_name, email, is_active').eq('id', user.id).maybeSingle();
  return { user, profile: profile?.is_active === false ? null : profile };
}
async function audit(supabase: any, payload: Record<string, unknown>) {
  try {
    const operationAction = clean(payload.operation_action, 120) || 'unknown';
    const operationStatus = clean(payload.operation_status, 80) || 'captured';
    const boundary = resolveModuleWriteBoundary(operationAction);
    const boundaryFields = boundaryAuditFields(boundary);
    const entityType = clean(payload.entity_type, 120) || null;
    const entityId = isUuid(payload.entity_id) ? payload.entity_id : null;
    const actorProfileId = isUuid(payload.actor_profile_id) ? payload.actor_profile_id : null;
    await supabase.from('operation_write_audit_events').insert({
      operation_action: operationAction,
      operation_status: operationStatus,
      entity_type: entityType,
      entity_id: entityId,
      actor_profile_id: actorProfileId,
      request_payload: objectValue(payload.request_payload),
      response_payload: objectValue(payload.response_payload),
      error_message: clean(payload.error_message, 2000) || null,
      ...boundaryFields
    });
    if (boundary?.crossModule && boundary.eventKey && operationStatus !== 'error') {
      await supabase.from('module_boundary_events').insert({
        event_key: boundary.eventKey,
        source_module: boundary.ownerModule,
        operation_action: operationAction,
        domain_key: boundary.domain,
        entity_type: entityType,
        entity_id: entityId,
        actor_profile_id: actorProfileId,
        event_payload: {
          boundary_mode: boundary.mode,
          minimum_access: boundary.minimum,
          operation_status: operationStatus,
          build: WRITE_BOUNDARY_BUILD,
          schema: WRITE_BOUNDARY_SCHEMA
        }
      });
    }
  } catch { /* audit and boundary-event capture cannot block the requested action */ }
}
async function sendEmailIfConfigured(notification: Record<string, unknown>) {
  const apiKey = clean(Deno.env.get('RESEND_API_KEY'), 500);
  const from = clean(Deno.env.get('RESEND_FROM_EMAIL') || Deno.env.get('EMAIL_FROM'), 320);
  const to = clean(notification.email_to || Deno.env.get('ADMIN_NOTIFICATION_TO'), 1000);
  if (!apiKey || !from || !to) return { attempted: false };
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      from,
      to: to.split(/[;,]/).map((value) => value.trim()).filter(Boolean),
      subject: clean(notification.email_subject || notification.title || 'YWI notification', 300),
      text: clean(notification.body || notification.message || 'A YWI operation needs attention.', 5000)
    })
  });
  if (!response.ok) throw new Error(`Resend email failed: ${await response.text()}`);
  return { attempted: true };
}

async function callRpc(supabase: any, name: string, args: Record<string, unknown>) {
  const { data, error } = await supabase.rpc(name, args);
  if (error) throw error;
  return data || {};
}

async function createAdminNotification(supabase: any, payload: Record<string, unknown>) {
  try {
    const row = {
      notification_type: clean(payload.notification_type, 120) || 'operations_alert',
      recipient_role: clean(payload.recipient_role, 80) || 'admin',
      target_profile_id: isUuid(payload.target_profile_id) ? payload.target_profile_id : null,
      target_table: clean(payload.target_table, 120) || null,
      target_id: clean(payload.target_id, 160) || null,
      title: clean(payload.title, 300) || 'Operations alert',
      body: clean(payload.body || payload.message, 5000) || 'An operation needs attention.',
      message: clean(payload.message || payload.body, 5000) || 'An operation needs attention.',
      payload: objectValue(payload.payload),
      status: 'queued',
      email_to: clean(payload.email_to, 1000) || null,
      email_subject: clean(payload.email_subject || payload.title, 300) || 'YWI operations alert',
      email_status: 'pending',
      created_by_profile_id: isUuid(payload.created_by_profile_id) ? payload.created_by_profile_id : null
    };
    const { data, error } = await supabase.from('admin_notifications').insert(row).select('*').single();
    if (error) throw error;
    try {
      const sent = await sendEmailIfConfigured(row);
      if (sent.attempted) {
        await supabase.from('admin_notifications').update({ status:'sent', email_status:'sent', email_provider:'resend', email_attempt_count:1, email_last_attempt_at:nowIso(), sent_at:nowIso() }).eq('id', data.id);
      }
    } catch (error) {
      await supabase.from('admin_notifications').update({ status:'failed', email_status:'failed', email_provider:'resend', email_attempt_count:1, email_last_attempt_at:nowIso(), email_error:clean(error instanceof Error ? error.message : error, 2000) }).eq('id', data.id);
    }
    return data;
  } catch {
    return null;
  }
}
async function safeSelect(query: PromiseLike<any>) {
  try {
    const { data, error } = await query;
    if (error) return [];
    return Array.isArray(data) ? data : (data ? [data] : []);
  } catch {
    return [];
  }
}

// Review uploads are private. Only this protected approval path copies an
// approved asset to public-assets, which is the only bucket exposed to routes.
async function publishApprovedAsset(supabase: any, asset: any) {
  const reviewBucket = clean(asset.review_storage_bucket || asset.storage_bucket || 'review-assets', 120) || 'review-assets';
  const sourcePath = clean(asset.review_storage_path || asset.storage_path, 500);
  const thumbPath = clean(asset.review_thumbnail_path || asset.thumbnail_path, 500);
  if (!sourcePath) throw new HttpError(409, 'This review asset has no private storage path to publish.');
  const extension = (sourcePath.split('.').pop() || 'jpg').replace(/[^a-z0-9]/gi, '').toLowerCase() || 'jpg';
  const base = `approved/${slug(asset.route_key || 'general')}/${new Date().toISOString().slice(0,10)}/${crypto.randomUUID()}`;
  const publicPath = `${base}.${extension}`;
  const { data: sourceBlob, error: sourceError } = await supabase.storage.from(reviewBucket).download(sourcePath);
  if (sourceError || !sourceBlob) throw new HttpError(409, 'The private review image is no longer available for publication.');
  const { error: uploadError } = await supabase.storage.from('public-assets').upload(publicPath, sourceBlob, { contentType: clean(asset.mime_type,120) || 'image/jpeg', cacheControl:'31536000', upsert:false });
  if (uploadError) throw uploadError;
  let publicThumbnailPath = '';
  if (thumbPath) {
    const { data: thumbBlob, error: thumbError } = await supabase.storage.from(reviewBucket).download(thumbPath);
    if (thumbError || !thumbBlob) {
      await supabase.storage.from('public-assets').remove([publicPath]);
      throw new HttpError(409, 'The private review thumbnail is no longer available for publication.');
    }
    const thumbExtension = (thumbPath.split('.').pop() || extension).replace(/[^a-z0-9]/gi, '').toLowerCase() || extension;
    publicThumbnailPath = `${base}-thumb.${thumbExtension}`;
    const { error: uploadThumbError } = await supabase.storage.from('public-assets').upload(publicThumbnailPath, thumbBlob, { contentType: clean(asset.mime_type,120) || 'image/jpeg', cacheControl:'31536000', upsert:false });
    if (uploadThumbError) {
      await supabase.storage.from('public-assets').remove([publicPath]);
      throw uploadThumbError;
    }
  }
  return {
    public_url: supabase.storage.from('public-assets').getPublicUrl(publicPath).data.publicUrl,
    thumbnail_url: publicThumbnailPath ? supabase.storage.from('public-assets').getPublicUrl(publicThumbnailPath).data.publicUrl : null,
    published_storage_bucket: 'public-assets', published_storage_path: publicPath,
    published_thumbnail_path: publicThumbnailPath || null, published_at: nowIso()
  };
}
async function resolveBankAccount(supabase: any, id: unknown, hint: unknown) {
  const bankId = clean(id, 80);
  if (isUuid(bankId)) {
    const { data } = await supabase.from('bank_accounts').select('id, account_name, gl_account_id, currency_code, is_default, account_status').eq('id', bankId).maybeSingle();
    if (data) return data;
  }
  const name = clean(hint, 180);
  if (name) {
    const { data } = await supabase.from('bank_accounts').select('id, account_name, gl_account_id, currency_code, is_default, account_status').ilike('account_name', `%${name}%`).eq('account_status', 'open').limit(1).maybeSingle();
    if (data) return data;
  }
  const { data } = await supabase.from('bank_accounts').select('id, account_name, gl_account_id, currency_code, is_default, account_status').eq('account_status', 'open').order('is_default', { ascending: false }).order('account_name').limit(1).maybeSingle();
  return data || null;
}
async function assertPeriodOpen(supabase: any, dateValue: string, side: 'ar'|'ap'|'gl') {
  const { data, error } = await supabase.from('accounting_period_closes')
    .select('period_code, close_status, ar_locked, ap_locked, gl_locked')
    .lte('period_start', dateValue).gte('period_end', dateValue)
    .in('close_status', ['in_review', 'closed']).limit(10);
  if (error) throw error;
  const locked = (data || []).find((row: any) => row.gl_locked || (side === 'ar' && row.ar_locked) || (side === 'ap' && row.ap_locked));
  if (locked) throw new HttpError(409, `Accounting period ${locked.period_code} is locked for ${side.toUpperCase()} or GL posting.`);
}
async function findAccount(supabase: any, candidates: string[]) {
  const rows = await safeSelect(supabase.from('chart_of_accounts').select('id, account_number, account_name, account_type, system_code, is_active').eq('is_active', true));
  const normalized = candidates.map(normalize);
  return rows.find((row: any) => normalized.includes(normalize(row.system_code)))
    || rows.find((row: any) => normalized.some((candidate) => normalize(row.account_name).includes(candidate)))
    || null;
}
async function createJournal(supabase: any, profileId: string, requestId: string, entryDate: string, memo: string, lines: any[]) {
  if (!lines.length || lines.some((line) => !line.account_id || money(line.amount) <= 0)) {
    throw new HttpError(409, 'Journal accounts are incomplete. Configure active control and bank accounts before posting.');
  }
  const debit = lines.filter((line) => line.side === 'debit').reduce((sum, line) => sum + cents(line.amount), 0);
  const credit = lines.filter((line) => line.side === 'credit').reduce((sum, line) => sum + cents(line.amount), 0);
  if (debit !== credit) throw new HttpError(409, 'Journal entry is not balanced to the cent.', { debit: debit / 100, credit: credit / 100 });
  const batchNumber = `OPS-${entryDate.replaceAll('-', '')}-${requestId.slice(0, 8)}-${Date.now().toString().slice(-5)}`;
  const { data: batch, error: batchError } = await supabase.from('gl_journal_batches').insert({
    batch_number: batchNumber,
    source_module: 'operations_payment_action',
    batch_status: 'posted',
    batch_date: entryDate,
    memo,
    posted_at: nowIso(),
    created_by_profile_id: profileId
  }).select('*').single();
  if (batchError) throw batchError;
  const entries = lines.map((line) => ({
    batch_id: batch.id,
    entry_date: entryDate,
    account_id: line.account_id,
    debit_amount: line.side === 'debit' ? money(line.amount) : 0,
    credit_amount: line.side === 'credit' ? money(line.amount) : 0,
    client_id: line.client_id || null,
    work_order_id: line.work_order_id || null,
    memo: clean(line.memo || memo, 1000)
  }));
  const { data: journalEntries, error: entriesError } = await supabase.from('gl_journal_entries').insert(entries).select('*');
  if (entriesError) {
    await supabase.from('gl_journal_batches').update({ batch_status: 'error', memo: `${memo} | Entry failure: ${entriesError.message}` }).eq('id', batch.id);
    throw entriesError;
  }
  return { batch, entries: journalEntries || [] };
}
async function findExact(supabase: any, table: string, ref: string, idColumn: string, referenceColumns: string[], select = '*') {
  if (!ref) return null;
  if (isUuid(ref) && idColumn) {
    const { data } = await supabase.from(table).select(select).eq(idColumn, ref).maybeSingle();
    if (data) return data;
  }
  for (const column of referenceColumns) {
    const { data } = await supabase.from(table).select(select).eq(column, ref).limit(1).maybeSingle();
    if (data) return data;
  }
  return null;
}
async function resolvePaymentContext(supabase: any, request: any) {
  const invoiceRef = clean(request.invoice_reference, 160);
  const paymentRef = clean(request.payment_reference, 160);
  let side = clean(request.ledger_side, 20).toLowerCase();
  let invoice = request.ar_invoice_id ? await findExact(supabase, 'ar_invoices', request.ar_invoice_id, 'id', [], '*') : null;
  let bill = request.ap_bill_id ? await findExact(supabase, 'ap_bills', request.ap_bill_id, 'id', [], '*') : null;
  let arPayment = request.ar_payment_id ? await findExact(supabase, 'ar_payments', request.ar_payment_id, 'id', [], '*') : null;
  let apPayment = request.ap_payment_id ? await findExact(supabase, 'ap_payments', request.ap_payment_id, 'id', [], '*') : null;
  if (!side || side === 'auto') {
    invoice ||= await findExact(supabase, 'ar_invoices', invoiceRef, 'id', ['invoice_number'], '*');
    arPayment ||= await findExact(supabase, 'ar_payments', paymentRef, 'id', ['payment_number', 'reference_number'], '*');
    if (invoice || arPayment) side = 'ar';
    if (!side) {
      bill ||= await findExact(supabase, 'ap_bills', invoiceRef, 'id', ['bill_number'], '*');
      apPayment ||= await findExact(supabase, 'ap_payments', paymentRef, 'id', ['payment_number', 'reference_number'], '*');
      if (bill || apPayment) side = 'ap';
    }
  } else if (side === 'ar') {
    invoice ||= await findExact(supabase, 'ar_invoices', invoiceRef, 'id', ['invoice_number'], '*');
    arPayment ||= await findExact(supabase, 'ar_payments', paymentRef, 'id', ['payment_number', 'reference_number'], '*');
  } else if (side === 'ap') {
    bill ||= await findExact(supabase, 'ap_bills', invoiceRef, 'id', ['bill_number'], '*');
    apPayment ||= await findExact(supabase, 'ap_payments', paymentRef, 'id', ['payment_number', 'reference_number'], '*');
  }
  if (!['ar', 'ap'].includes(side)) throw new HttpError(409, 'Could not resolve the request to AR or AP. Choose a ledger side and enter an exact invoice/bill and payment reference.');
  return { side, invoice, bill, arPayment, apPayment };
}
async function postedDepositRecognition(supabase: any, arPaymentId: string, excludeRequestId = '') {
  let query = supabase.from('payment_action_requests')
    .select('id, amount, posting_status')
    .eq('ar_payment_id', arPaymentId)
    .eq('action_type', 'overpayment_credit')
    .eq('posting_status', 'posted');
  if (excludeRequestId) query = query.neq('id', excludeRequestId);
  const rows = await safeSelect(query);
  return { exists: rows.length > 0, amount: rows.reduce((sum: number, row: any) => sum + money(row.amount), 0), rows };
}

async function postingAccounts(supabase: any, bankAccount: any, side: string, actionType: string) {
  const cash = bankAccount?.gl_account_id ? { id: bankAccount.gl_account_id } : await findAccount(supabase, ['cash', 'bank', 'operating cash']);
  const ar = await findAccount(supabase, ['accounts receivable', 'ar control', 'trade receivables']);
  const ap = await findAccount(supabase, ['accounts payable', 'ap control', 'trade payables']);
  const badDebt = await findAccount(supabase, ['bad debt expense', 'write off expense', 'credit loss expense']);
  const deposits = await findAccount(supabase, ['customer deposits', 'unapplied cash', 'customer credits', 'deferred revenue']);
  const refunds = await findAccount(supabase, ['customer refunds', 'refund expense', 'sales returns']);
  if (!cash?.id) throw new HttpError(409, 'No active bank/cash GL account is configured.');
  if (side === 'ar' && !ar?.id) throw new HttpError(409, 'No active Accounts Receivable control account is configured.');
  if (side === 'ap' && !ap?.id) throw new HttpError(409, 'No active Accounts Payable control account is configured.');
  if (actionType === 'write_off' && !badDebt?.id) throw new HttpError(409, 'No bad-debt/write-off expense account is configured.');
  if (actionType === 'overpayment_credit' && !deposits?.id) throw new HttpError(409, 'No customer-deposit/unapplied-cash account is configured.');
  if (actionType === 'refund' && !refunds?.id && !deposits?.id) throw new HttpError(409, 'No refund or customer-deposit account is configured.');
  return { cash, ar, ap, badDebt, deposits, refunds };
}
async function reversePostedRequest(supabase: any, request: any, profile: any, entryDate: string) {
  let prior: any = null;
  if (request.reversal_of_request_id) {
    prior = await findExact(supabase, 'payment_action_requests', request.reversal_of_request_id, 'id', [], '*');
  }
  if (!prior && request.payment_reference) {
    const { data } = await supabase.from('payment_action_requests').select('*')
      .eq('payment_reference', request.payment_reference).eq('posting_status', 'posted')
      .neq('id', request.id).order('posted_at', { ascending: false }).limit(1).maybeSingle();
    prior = data || null;
  }
  if (!prior?.gl_batch_id || prior.posting_status !== 'posted') throw new HttpError(409, 'A currently posted source request with a journal batch is required for reversal.');
  await assertPeriodOpen(supabase, entryDate, prior.ledger_side === 'ap' ? 'ap' : 'ar');
  const { data: originalEntries, error: originalError } = await supabase.from('gl_journal_entries').select('*').eq('batch_id', prior.gl_batch_id);
  if (originalError) throw originalError;
  if (!originalEntries?.length) throw new HttpError(409, 'The source journal batch has no entries to reverse.');
  if (prior.ar_application_id) {
    const { data: app } = await supabase.from('ar_payment_applications').select('*').eq('id', prior.ar_application_id).maybeSingle();
    if (app && app.application_status === 'applied') {
      const { data: inv } = await supabase.from('ar_invoices').select('*').eq('id', app.invoice_id).single();
      const { data: pay } = await supabase.from('ar_payments').select('*').eq('id', app.payment_id).single();
      await supabase.from('ar_payment_applications').update({ application_status: 'reversed', updated_at: nowIso() }).eq('id', app.id);
      await supabase.from('ar_invoices').update({ balance_due: money(inv.balance_due) + money(app.applied_amount), invoice_status: 'partial', updated_at: nowIso() }).eq('id', inv.id);
      const unapplied = money(pay.unapplied_amount) + money(app.applied_amount);
      await supabase.from('ar_payments').update({ unapplied_amount: unapplied, application_status: unapplied >= money(pay.amount) ? 'unapplied' : 'partial', updated_at: nowIso() }).eq('id', pay.id);
    }
  }
  if (prior.ap_application_id) {
    const { data: app } = await supabase.from('ap_payment_applications').select('*').eq('id', prior.ap_application_id).maybeSingle();
    if (app && app.application_status === 'applied') {
      const { data: bill } = await supabase.from('ap_bills').select('*').eq('id', app.bill_id).single();
      const { data: pay } = await supabase.from('ap_payments').select('*').eq('id', app.payment_id).single();
      await supabase.from('ap_payment_applications').update({ application_status: 'reversed', updated_at: nowIso() }).eq('id', app.id);
      await supabase.from('ap_bills').update({ balance_due: money(bill.balance_due) + money(app.applied_amount), bill_status: 'partial', updated_at: nowIso() }).eq('id', bill.id);
      const unapplied = money(pay.unapplied_amount) + money(app.applied_amount);
      await supabase.from('ap_payments').update({ unapplied_amount: unapplied, application_status: unapplied >= money(pay.amount) ? 'unapplied' : 'partial', updated_at: nowIso() }).eq('id', pay.id);
    }
  }
  if (prior.action_type === 'write_off' && prior.ar_invoice_id && !prior.ar_application_id) {
    const { data: invoice } = await supabase.from('ar_invoices').select('*').eq('id', prior.ar_invoice_id).maybeSingle();
    if (invoice) {
      const restored = Number((money(invoice.balance_due) + money(prior.amount)).toFixed(2));
      await supabase.from('ar_invoices').update({ balance_due: restored, invoice_status: 'partial', updated_at: nowIso() }).eq('id', invoice.id);
    }
  }
  if (prior.action_type === 'refund' && prior.ar_payment_id) {
    const { data: payment } = await supabase.from('ar_payments').select('*').eq('id', prior.ar_payment_id).maybeSingle();
    if (payment) {
      const unapplied = Math.min(money(payment.amount), Number((money(payment.unapplied_amount) + money(prior.amount)).toFixed(2)));
      await supabase.from('ar_payments').update({ unapplied_amount: unapplied, application_status: unapplied >= money(payment.amount) ? 'unapplied' : 'partial', updated_at: nowIso() }).eq('id', payment.id);
    }
  }
  const reversedLines = originalEntries.map((line: any) => ({
    account_id: line.account_id,
    side: money(line.debit_amount) > 0 ? 'credit' : 'debit',
    amount: money(line.debit_amount) || money(line.credit_amount),
    client_id: line.client_id,
    work_order_id: line.work_order_id,
    memo: `Reversal of ${prior.action_key}`
  }));
  const journal = await createJournal(supabase, profile.id, request.id, entryDate, `Reverse payment action ${prior.action_key}`, reversedLines);
  await supabase.from('payment_action_requests').update({ posting_status: 'reversed', posting_message: `Reversed by ${request.action_key}`, updated_at: nowIso() }).eq('id', prior.id);
  return { prior, journal };
}
async function postPaymentAction(supabase: any, request: any, profile: any) {
  if (request.posting_status === 'posted') return request;
  if (request.action_status !== 'approved') throw new HttpError(409, 'Approve the payment action before posting it.');
  if (request.proof_required && !clean(request.proof_reference, 240)) throw new HttpError(409, 'Posting is blocked until proof is attached or referenced.');
  const { data: claimed, error: claimError } = await supabase.from('payment_action_requests').update({ posting_status: 'posting', posting_message: 'Preflight validation in progress.', updated_at: nowIso() })
    .eq('id', request.id).eq('action_status', 'approved').in('posting_status', ['not_posted', 'failed']).select('*').maybeSingle();
  if (claimError) throw claimError;
  if (!claimed) {
    const { data: current } = await supabase.from('payment_action_requests').select('*').eq('id', request.id).maybeSingle();
    if (current?.posting_status === 'posted') return current;
    throw new HttpError(409, current?.posting_status === 'posting' ? 'This payment action is already being posted.' : 'This payment action is not available for posting.');
  }
  request = claimed;
  const entryDate = isoDate(request.transaction_date) || today();
  try {
    if (request.action_type === 'reverse_payment') {
      const reversal = await reversePostedRequest(supabase, request, profile, entryDate);
      const { data, error } = await supabase.from('payment_action_requests').update({
        action_status: 'posted', posting_status: 'posted', posted_at: nowIso(), posted_by_profile_id: profile.id,
        gl_batch_id: reversal.journal.batch.id, posting_message: `Reversed ${reversal.prior.action_key}.`,
        posting_payload: { reversed_request_id: reversal.prior.id, journal_entry_count: reversal.journal.entries.length }, updated_at: nowIso()
      }).eq('id', request.id).select('*').single();
      if (error) throw error;
      return data;
    }
    const context = await resolvePaymentContext(supabase, request);
    const bank = await resolveBankAccount(supabase, request.bank_account_id, request.bank_account_hint);
    if (!bank) throw new HttpError(409, 'Choose or configure an open bank account before posting.');
    await assertPeriodOpen(supabase, entryDate, context.side as 'ar'|'ap');
    const accounts = await postingAccounts(supabase, bank, context.side, request.action_type);
    const amount = money(request.amount);
    const memo = `${request.action_type.replaceAll('_', ' ')} ${request.action_key}: ${clean(request.reason, 500)}`;
    let application: any = null;
    let journal: any = null;
    let clientId: string | null = null;

    if (request.action_type === 'apply_payment' && context.side === 'ar') {
      if (!context.invoice || !context.arPayment) throw new HttpError(409, 'AR posting requires an exact invoice and AR payment reference.');
      const available = money(context.arPayment.unapplied_amount || context.arPayment.amount);
      if (amount > money(context.invoice.balance_due) || amount > available) throw new HttpError(409, 'Applied amount exceeds the invoice balance or unapplied payment amount.', { invoice_balance: context.invoice.balance_due, payment_unapplied: available });
      const { data, error } = await supabase.from('ar_payment_applications').insert({ payment_id: context.arPayment.id, invoice_id: context.invoice.id, applied_amount: amount, application_date: entryDate, application_status: 'applied', notes: memo, created_by_profile_id: profile.id }).select('*').single();
      if (error) throw error;
      application = data;
      const invoiceBalance = Number((money(context.invoice.balance_due) - amount).toFixed(2));
      const unapplied = Number((available - amount).toFixed(2));
      await supabase.from('ar_invoices').update({ balance_due: invoiceBalance, invoice_status: invoiceBalance === 0 ? 'paid' : 'partial', updated_at: nowIso() }).eq('id', context.invoice.id);
      await supabase.from('ar_payments').update({ unapplied_amount: unapplied, application_status: unapplied === 0 ? 'applied' : 'partial', last_applied_at: nowIso(), last_application_notes: memo, updated_at: nowIso() }).eq('id', context.arPayment.id);
      clientId = context.invoice.client_id;
      const depositRecognition = await postedDepositRecognition(supabase, context.arPayment.id, request.id);
      const debitAccount = depositRecognition.exists ? accounts.deposits : accounts.cash;
      if (!debitAccount?.id) throw new HttpError(409, 'The payment was previously recognized as a customer deposit, but no active customer-deposit account is configured.');
      journal = await createJournal(supabase, profile.id, request.id, entryDate, memo, [
        { account_id: debitAccount.id, side: 'debit', amount, client_id: clientId, work_order_id: context.invoice.work_order_id },
        { account_id: accounts.ar.id, side: 'credit', amount, client_id: clientId, work_order_id: context.invoice.work_order_id }
      ]);
    } else if (request.action_type === 'apply_payment' && context.side === 'ap') {
      if (!context.bill || !context.apPayment) throw new HttpError(409, 'AP posting requires an exact bill and AP payment reference.');
      const available = money(context.apPayment.unapplied_amount || context.apPayment.amount);
      if (amount > money(context.bill.balance_due) || amount > available) throw new HttpError(409, 'Applied amount exceeds the bill balance or unapplied payment amount.', { bill_balance: context.bill.balance_due, payment_unapplied: available });
      const { data, error } = await supabase.from('ap_payment_applications').insert({ payment_id: context.apPayment.id, bill_id: context.bill.id, applied_amount: amount, application_date: entryDate, application_status: 'applied', notes: memo, created_by_profile_id: profile.id }).select('*').single();
      if (error) throw error;
      application = data;
      const billBalance = Number((money(context.bill.balance_due) - amount).toFixed(2));
      const unapplied = Number((available - amount).toFixed(2));
      await supabase.from('ap_bills').update({ balance_due: billBalance, bill_status: billBalance === 0 ? 'paid' : 'partial', updated_at: nowIso() }).eq('id', context.bill.id);
      await supabase.from('ap_payments').update({ unapplied_amount: unapplied, application_status: unapplied === 0 ? 'applied' : 'partial', last_applied_at: nowIso(), last_application_notes: memo, updated_at: nowIso() }).eq('id', context.apPayment.id);
      journal = await createJournal(supabase, profile.id, request.id, entryDate, memo, [
        { account_id: accounts.ap.id, side: 'debit', amount },
        { account_id: accounts.cash.id, side: 'credit', amount }
      ]);
    } else if (request.action_type === 'write_off') {
      if (context.side !== 'ar' || !context.invoice) throw new HttpError(409, 'Write-off posting requires an AR invoice.');
      if (amount > money(context.invoice.balance_due)) throw new HttpError(409, 'Write-off exceeds the invoice balance.');
      const invoiceBalance = Number((money(context.invoice.balance_due) - amount).toFixed(2));
      await supabase.from('ar_invoices').update({ balance_due: invoiceBalance, invoice_status: invoiceBalance === 0 ? 'paid' : 'partial', updated_at: nowIso() }).eq('id', context.invoice.id);
      clientId = context.invoice.client_id;
      journal = await createJournal(supabase, profile.id, request.id, entryDate, memo, [
        { account_id: accounts.badDebt.id, side: 'debit', amount, client_id: clientId, work_order_id: context.invoice.work_order_id },
        { account_id: accounts.ar.id, side: 'credit', amount, client_id: clientId, work_order_id: context.invoice.work_order_id }
      ]);
    } else if (request.action_type === 'overpayment_credit') {
      if (context.side !== 'ar' || !context.arPayment) throw new HttpError(409, 'Overpayment credit requires an AR payment reference.');
      clientId = context.arPayment.client_id;
      const currentUnapplied = money(context.arPayment.unapplied_amount || context.arPayment.amount);
      const priorRecognition = await postedDepositRecognition(supabase, context.arPayment.id, request.id);
      if (priorRecognition.exists) throw new HttpError(409, 'This AR payment has already been posted to customer deposits. Apply or refund the existing unapplied credit instead of posting it again.');
      if (cents(amount) !== cents(currentUnapplied)) throw new HttpError(409, 'Customer-deposit recognition must equal the payment’s current unapplied amount.', { requested_amount: amount, unapplied_amount: currentUnapplied });
      journal = await createJournal(supabase, profile.id, request.id, entryDate, memo, [
        { account_id: accounts.cash.id, side: 'debit', amount, client_id: clientId },
        { account_id: accounts.deposits.id, side: 'credit', amount, client_id: clientId }
      ]);
    } else if (request.action_type === 'refund') {
      if (context.side !== 'ar' || !context.arPayment) throw new HttpError(409, 'Refund posting requires the original AR payment reference.');
      clientId = context.arPayment.client_id;
      const currentUnapplied = money(context.arPayment.unapplied_amount || 0);
      if (amount > currentUnapplied) throw new HttpError(409, 'Refund exceeds the payment’s unapplied customer credit.', { requested_amount: amount, unapplied_amount: currentUnapplied });
      const depositRecognition = await postedDepositRecognition(supabase, context.arPayment.id, request.id);
      const refundDebit = depositRecognition.exists ? accounts.deposits : accounts.refunds;
      if (!refundDebit?.id) throw new HttpError(409, 'No customer-deposit or refund account is configured for this refund.');
      journal = await createJournal(supabase, profile.id, request.id, entryDate, memo, [
        { account_id: refundDebit.id, side: 'debit', amount, client_id: clientId },
        { account_id: accounts.cash.id, side: 'credit', amount, client_id: clientId }
      ]);
      const unapplied = Number((currentUnapplied - amount).toFixed(2));
      await supabase.from('ar_payments').update({ unapplied_amount: unapplied, application_status: unapplied === 0 ? 'applied' : 'partial', last_applied_at: nowIso(), last_application_notes: memo, updated_at: nowIso() }).eq('id', context.arPayment.id);
    } else {
      throw new HttpError(400, `Unsupported posting action ${request.action_type}.`);
    }

    const update: Record<string, unknown> = {
      action_status: 'posted', posting_status: 'posted', ledger_side: context.side,
      bank_account_id: bank.id, transaction_date: entryDate, posted_at: nowIso(), posted_by_profile_id: profile.id,
      gl_batch_id: journal.batch.id, posting_message: `Posted ${journal.entries.length} balanced journal entries.`,
      posting_payload: { bank_account: bank.account_name, application_id: application?.id || null, journal_entry_count: journal.entries.length },
      period_lock_checked: true, updated_at: nowIso()
    };
    if (context.invoice) update.ar_invoice_id = context.invoice.id;
    if (context.bill) update.ap_bill_id = context.bill.id;
    if (context.arPayment) update.ar_payment_id = context.arPayment.id;
    if (context.apPayment) update.ap_payment_id = context.apPayment.id;
    if (application && context.side === 'ar') update.ar_application_id = application.id;
    if (application && context.side === 'ap') update.ap_application_id = application.id;
    const { data, error } = await supabase.from('payment_action_requests').update(update).eq('id', request.id).select('*').single();
    if (error) throw error;
    return data;
  } catch (error) {
    await supabase.from('payment_action_requests').update({ posting_status: 'failed', posting_message: error instanceof Error ? error.message : 'Posting failed.', updated_at: nowIso() }).eq('id', request.id);
    throw error;
  }
}

async function resolveReconItem(supabase: any, rowId: string) {
  if (!isUuid(rowId)) return null;
  const { data: direct } = await supabase.from('bank_reconciliation_items').select('*').eq('id', rowId).maybeSingle();
  if (direct) return direct;
  const { data: preview } = await supabase.from('bank_csv_import_preview_rows').select('*').eq('id', rowId).maybeSingle();
  if (preview?.promoted_reconciliation_item_id) {
    const { data } = await supabase.from('bank_reconciliation_items').select('*').eq('id', preview.promoted_reconciliation_item_id).maybeSingle();
    return data || null;
  }
  return null;
}
async function targetByReference(supabase: any, ref: string) {
  if (!ref) return null;
  const searches = [
    ['ar_payments', 'ar_payment', ['payment_number', 'reference_number'], 'id, payment_number, reference_number, payment_date, amount, client_id'],
    ['ap_payments', 'ap_payment', ['payment_number', 'reference_number'], 'id, payment_number, reference_number, payment_date, amount, vendor_id'],
    ['ar_invoices', 'ar_invoice', ['invoice_number'], 'id, invoice_number, invoice_date, total_amount, balance_due, client_id'],
    ['ap_bills', 'ap_bill', ['bill_number'], 'id, bill_number, bill_date, total_amount, balance_due, vendor_id'],
    ['gl_journal_batches', 'gl_batch', ['batch_number'], 'id, batch_number, batch_date, memo']
  ];
  for (const [table, type, columns, select] of searches as any[]) {
    const row = await findExact(supabase, table, ref, 'id', columns, select);
    if (row) return { type, row, reference: row.payment_number || row.reference_number || row.invoice_number || row.bill_number || row.batch_number || ref };
  }
  return null;
}
function reconciliationConfidence(score: number) {
  return score >= 85 ? 'high' : score >= 65 ? 'medium' : 'low';
}
function reconciliationTargetAmount(target: any) {
  return money(target?.row?.__match_amount ?? target?.row?.unapplied_amount ?? target?.row?.paid_amount ?? target?.row?.balance_due ?? target?.row?.amount ?? target?.row?.total_amount ?? target?.row?.requested_amount ?? 0);
}
function reconciliationTargetDate(target: any) {
  return target?.row?.__match_date || target?.row?.payment_date || target?.row?.invoice_date || target?.row?.bill_date || target?.row?.paid_at || target?.row?.item_date || target?.row?.updated_at || target?.row?.created_at || null;
}
function scoreTarget(item: any, target: any) {
  const amount = Math.abs(reconciliationTargetAmount(target));
  const bankAmount = Math.abs(money(item.amount));
  const difference = Math.abs(bankAmount - amount);
  let amountScore = 0;
  if (difference < 0.005) amountScore = 55;
  else if (difference <= 1) amountScore = 42;
  else if (bankAmount && difference / bankAmount <= 0.02) amountScore = 30;
  else if (bankAmount && difference / bankAmount <= 0.10) amountScore = 18;
  else if (bankAmount && Math.min(bankAmount, amount) / Math.max(bankAmount, amount) >= 0.50) amountScore = 10;
  const targetDateRaw = reconciliationTargetDate(target);
  const bankDate = item.item_date ? new Date(`${item.item_date}T00:00:00Z`) : null;
  const targetDate = targetDateRaw ? new Date(String(targetDateRaw).length === 10 ? `${targetDateRaw}T00:00:00Z` : targetDateRaw) : null;
  const dayDifference = bankDate && targetDate && Number.isFinite(bankDate.valueOf()) && Number.isFinite(targetDate.valueOf())
    ? Math.round(Math.abs(bankDate.valueOf() - targetDate.valueOf()) / 86400000)
    : null;
  const dateScore = dayDifference === null ? 0 : dayDifference === 0 ? 20 : dayDifference <= 3 ? 15 : dayDifference <= 7 ? 8 : dayDifference <= 14 ? 4 : 0;
  const refText = normalize(target?.reference);
  const description = normalize(item.item_description);
  const referenceScore = refText && description.includes(refText) ? 15 : refText ? 8 : 0;
  const words = refText.split(' ').filter((word) => word.length > 3);
  const descriptionScore = words.some((word) => description.includes(word)) ? 10 : 0;
  const score = Math.min(100, amountScore + dateScore + referenceScore + descriptionScore);
  const coverage = bankAmount > 0 ? Number((Math.min(bankAmount, amount) / Math.max(bankAmount, amount) * 100).toFixed(1)) : 0;
  return {
    score,
    confidence_band: reconciliationConfidence(score),
    target_amount: amount,
    amount_difference: Number(difference.toFixed(2)),
    amount_coverage_percent: coverage,
    day_difference: dayDifference,
    components: { amount: amountScore, date: dateScore, reference: referenceScore, description: descriptionScore },
    summary: `${amountScore}/55 amount, ${dateScore}/20 date, ${referenceScore}/15 reference, ${descriptionScore}/10 description; ${coverage}% amount coverage.`
  };
}
function reconciliationTarget(target: any) {
  return {
    target_type: target.type,
    target_id: clean(target?.row?.id, 80) || null,
    target_reference: clean(target.reference, 180) || clean(target?.row?.id, 80),
    allocated_amount: Math.abs(reconciliationTargetAmount(target)),
    target_date: reconciliationTargetDate(target)
  };
}
function reconciliationSuggestion(item: any, target: any, matchMode = 'one_to_one', extra: Record<string, unknown> = {}) {
  const explanation = scoreTarget(item, target);
  const exact = explanation.amount_difference < 0.005;
  const partial = !exact;
  return {
    match_mode: matchMode,
    type: target.type,
    target_id: clean(target?.row?.id, 80) || null,
    reference: clean(target.reference, 180) || clean(target?.row?.id, 80),
    targets: [reconciliationTarget(target)],
    group_total: explanation.target_amount,
    partial,
    actionable: matchMode === 'one_to_one' && exact,
    requires_human_confirmation: true,
    confidence_band: explanation.confidence_band,
    explanation,
    ...extra
  };
}
function buildOneToManySuggestions(item: any, candidates: any[]) {
  const bankAmount = Math.abs(money(item.amount));
  const eligible = candidates.filter((candidate) => candidate.type !== 'bank_transfer' && candidate?.row?.id).slice(0, 10);
  const groups: any[] = [];
  const seen = new Set<string>();
  const addGroup = (parts: any[]) => {
    const targets = parts.map(reconciliationTarget);
    const key = targets.map((target) => target.target_id || target.target_reference).sort().join('|');
    if (!key || seen.has(key)) return;
    seen.add(key);
    const total = targets.reduce((sum, target) => sum + Math.abs(money(target.allocated_amount)), 0);
    if (!bankAmount || total <= 0 || total > bankAmount * 1.20) return;
    const reference = targets.map((target) => target.target_reference).filter(Boolean).join(' + ');
    const dated = parts.map((part) => reconciliationTargetDate(part)).filter(Boolean).sort();
    const target = { type:'multi_target', reference, row:{ id:key, __match_amount:total, __match_date:dated[0] || null } };
    const explanation = scoreTarget(item, target);
    if (explanation.amount_coverage_percent < 50) return;
    groups.push({
      match_mode:'one_to_many',
      type:'multi_target',
      target_id:null,
      reference,
      targets,
      group_total:Number(total.toFixed(2)),
      partial:explanation.amount_difference >= 0.005,
      actionable:explanation.amount_difference < 0.005,
      requires_human_confirmation:true,
      confidence_band:explanation.confidence_band,
      explanation:{...explanation, summary:`${explanation.summary} Combined ${targets.length} source records; exact-cent split remains mandatory before confirmation.`}
    });
  };
  for (let i=0;i<eligible.length;i++) {
    for (let j=i+1;j<eligible.length;j++) addGroup([eligible[i], eligible[j]]);
  }
  for (let i=0;i<Math.min(eligible.length,7);i++) {
    for (let j=i+1;j<Math.min(eligible.length,8);j++) {
      for (let k=j+1;k<Math.min(eligible.length,9);k++) addGroup([eligible[i], eligible[j], eligible[k]]);
    }
  }
  return groups.sort((a,b)=>b.explanation.score-a.explanation.score || a.explanation.amount_difference-b.explanation.amount_difference).slice(0,6);
}
function buildManyToOneSuggestions(item: any, candidates: any[], otherBankRows: any[]) {
  const bankAmount = Math.abs(money(item.amount));
  const suggestions:any[] = [];
  for (const target of candidates.filter((candidate)=>candidate.type !== 'bank_transfer').slice(0,10)) {
    const targetAmount = Math.abs(reconciliationTargetAmount(target));
    if (!targetAmount || targetAmount <= bankAmount + 0.005) continue;
    for (const other of otherBankRows.slice(0,40)) {
      if (String(other.id) === String(item.id) || Number(other.amount || 0) === 0) continue;
      const combined = bankAmount + Math.abs(money(other.amount));
      if (Math.abs(targetAmount - combined) > Math.max(1, targetAmount * 0.02)) continue;
      const combinedItem = { ...item, amount: combined };
      const explanation = scoreTarget(combinedItem, target);
      suggestions.push({
        match_mode:'many_to_one',
        type:target.type,
        target_id:clean(target?.row?.id,80) || null,
        reference:clean(target.reference,180) || clean(target?.row?.id,80),
        targets:[reconciliationTarget(target)],
        related_bank_rows:[
          { id:item.id, item_date:item.item_date, item_description:item.item_description, amount:money(item.amount) },
          { id:other.id, item_date:other.item_date, item_description:other.item_description, amount:money(other.amount) }
        ],
        group_total:Number(combined.toFixed(2)),
        partial:explanation.amount_difference >= 0.005,
        actionable:false,
        requires_human_confirmation:true,
        confidence_band:explanation.confidence_band,
        explanation:{...explanation, summary:`${explanation.summary} Two bank rows appear to map to one source record. Review-only: the current transactional RPC does not auto-aggregate bank rows.`}
      });
      if (suggestions.length >= 6) return suggestions;
    }
  }
  return suggestions;
}
async function suggestMatches(supabase: any, item: any) {
  const absAmount = Math.abs(money(item.amount));
  const lower = Math.max(0.01, absAmount * 0.25);
  const upper = Math.max(absAmount + 1, absAmount * 2);
  const tables = [
    { table:'ar_payments', type:'customer_payment', refCol:'payment_number', amountCol:'amount', select:'id, payment_number, reference_number, payment_date, amount, unapplied_amount, client_id' },
    { table:'ap_payments', type:'vendor_payment', refCol:'payment_number', amountCol:'amount', select:'id, payment_number, reference_number, payment_date, amount, vendor_id' },
    { table:'ar_invoices', type:'customer_invoice', refCol:'invoice_number', amountCol:'balance_due', select:'id, invoice_number, invoice_date, total_amount, balance_due, client_id' },
    { table:'ap_bills', type:'vendor_bill', refCol:'bill_number', amountCol:'balance_due', select:'id, bill_number, bill_date, total_amount, balance_due, vendor_id' }
  ];
  const candidates:any[] = [];
  for (const config of tables) {
    const { data } = await supabase.from(config.table).select(config.select).gte(config.amountCol, lower).lte(config.amountCol, upper).limit(12);
    for (const row of data || []) {
      candidates.push({ type:config.type, row:{...row, __match_amount:row[config.amountCol]}, reference:row[config.refCol] || row.reference_number || row.id });
    }
  }
  const { data: deposits } = await supabase.from('customer_deposit_requests')
    .select('id, quote_package_id, estimate_id, client_id, requested_amount, paid_amount, deposit_status, payment_reference, paid_at, updated_at')
    .gt('paid_amount',0)
    .gte('paid_amount',lower)
    .lte('paid_amount',upper)
    .order('paid_at',{ascending:false})
    .limit(12);
  for (const row of deposits || []) {
    candidates.push({ type:'customer_deposit', row:{...row,__match_amount:row.paid_amount,__match_date:row.paid_at}, reference:row.payment_reference || `deposit:${row.id}` });
  }

  const { data: bankRows } = await supabase.from('bank_reconciliation_items')
    .select('id,reconciliation_session_id,item_date,item_description,amount,match_status,clearing_status')
    .neq('id',item.id)
    .eq('clearing_status','open')
    .order('item_date',{ascending:false})
    .limit(80);
  const otherBankRows = bankRows || [];
  for (const row of otherBankRows) {
    if (Number(row.amount || 0) === 0 || Math.sign(Number(row.amount || 0)) === Math.sign(Number(item.amount || 0))) continue;
    const target = { type:'bank_transfer', row:{...row,__match_amount:Math.abs(money(row.amount)),__match_date:row.item_date}, reference:`transfer:${row.id}` };
    const explanation = scoreTarget(item,target);
    if (explanation.amount_coverage_percent >= 90 && (explanation.day_difference === null || explanation.day_difference <= 7)) candidates.push(target);
  }

  const singles = candidates
    .map((target)=>reconciliationSuggestion(item,target))
    .filter((suggestion)=>suggestion.explanation.amount_coverage_percent >= 25)
    .sort((a,b)=>b.explanation.score-a.explanation.score || a.explanation.amount_difference-b.explanation.amount_difference)
    .slice(0,14);
  const oneToMany = buildOneToManySuggestions(item,candidates);
  const manyToOne = buildManyToOneSuggestions(item,candidates,otherBankRows);
  const ranked = [...singles,...oneToMany,...manyToOne]
    .sort((a,b)=>b.explanation.score-a.explanation.score || Number(a.partial)-Number(b.partial) || a.explanation.amount_difference-b.explanation.amount_difference)
    .slice(0,12)
    .map((suggestion,index)=>({
      ...suggestion,
      rank:index+1,
      matching_rule:suggestion.match_mode === 'one_to_many'
        ? 'Exact-cent split only after operator review.'
        : suggestion.match_mode === 'many_to_one'
          ? 'Review-only aggregate candidate; no automatic multi-bank-row action.'
          : suggestion.partial
            ? 'Partial candidate requires operator review; no automatic application.'
            : 'Exact candidate still requires operator confirmation.'
    }));
  return ranked;
}
async function resolveEquipment(supabase: any, code: string) {
  const fields = ['equipment_code', 'asset_tag', 'serial_number'];
  for (const field of fields) {
    const { data } = await supabase.from('equipment_items').select('*').eq(field, code).limit(1).maybeSingle();
    if (data) return { type: 'item', item: data, master: null };
  }
  const { data: master } = await supabase.from('equipment_master').select('*').eq('equipment_code', code).limit(1).maybeSingle();
  return master ? { type: 'master', item: null, master } : { type: 'unresolved', item: null, master: null };
}
async function resolveJob(supabase: any, reference: string) {
  if (!reference) return null;
  if (/^\d+$/.test(reference)) {
    const { data } = await supabase.from('jobs').select('*').eq('id', Number(reference)).maybeSingle();
    if (data) return data;
  }
  const { data } = await supabase.from('jobs').select('*').eq('job_code', reference).limit(1).maybeSingle();
  return data || null;
}

const BUILD313_APPLICATION_TYPES = new Set(['receipt','unapplied_cash','deposit','credit','discount','writeoff','overpayment']);
function build313ActionType(applicationType: string) {
  const map: Record<string,string> = {
    receipt:'apply_payment',
    unapplied_cash:'apply_unapplied_cash',
    deposit:'apply_deposit',
    credit:'apply_credit',
    discount:'apply_discount',
    writeoff:'write_off',
    overpayment:'overpayment_credit'
  };
  return map[applicationType] || '';
}
async function resolveBuild313ArApplication(supabase: any, body: Record<string, unknown>) {
  const applicationType = clean(body.application_type, 40).toLowerCase();
  if (!BUILD313_APPLICATION_TYPES.has(applicationType)) throw new HttpError(400, 'Unsupported A/R application type.');
  const amount = money(body.amount);
  const applicationDate = isoDate(body.application_date || body.transaction_date) || today();
  const invoiceRef = clean(body.invoice_id || body.invoice_reference, 160);
  const paymentRef = clean(body.payment_id || body.payment_reference, 160);
  const depositRef = clean(body.deposit_id || body.deposit_reference, 160);
  const manualSourceReference = clean(body.source_reference, 240);
  const validations: Array<{key:string,status:'pass'|'fail',message:string}> = [];
  const push = (key:string, ok:boolean, message:string) => validations.push({ key, status:ok ? 'pass' : 'fail', message });

  let invoice:any = null;
  if (invoiceRef) invoice = await findExact(supabase,'ar_invoices',invoiceRef,'id',['invoice_number'],'*');
  const invoiceRequired = applicationType !== 'overpayment';
  push('invoice', !invoiceRequired || Boolean(invoice?.id), invoiceRequired ? (invoice ? 'Invoice found.' : 'Choose an exact open A/R invoice.') : (invoice ? 'Optional invoice context found.' : 'No invoice required for overpayment classification.'));

  let payment:any = null;
  let deposit:any = null;
  let sourceType = '';
  let sourceId:string|null = null;
  let sourceReference = manualSourceReference || null;
  let sourceClientId:string|null = null;
  let sourceDate:string|null = null;
  let availableAmount = 0;

  if (['receipt','unapplied_cash','overpayment'].includes(applicationType)) {
    payment = paymentRef ? await findExact(supabase,'ar_payments',paymentRef,'id',['payment_number','reference_number'],'*') : null;
    sourceType = 'ar_payment';
    sourceId = payment?.id || null;
    sourceReference = clean(payment?.payment_number || payment?.reference_number || paymentRef,160) || null;
    sourceClientId = payment?.client_id || null;
    sourceDate = isoDate(payment?.payment_date);
    availableAmount = money(payment?.unapplied_amount ?? payment?.amount);
    push('source', Boolean(payment?.id), payment ? 'A/R payment source found.' : 'Choose an exact A/R payment or unapplied-cash source.');
  } else if (applicationType === 'deposit') {
    deposit = depositRef ? await findExact(supabase,'customer_deposit_requests',depositRef,'id',['payment_reference'],'*') : null;
    sourceType = 'customer_deposit';
    sourceId = deposit?.id || null;
    sourceReference = clean(deposit?.payment_reference || depositRef,160) || null;
    sourceClientId = deposit?.client_id || null;
    sourceDate = isoDate(deposit?.paid_at || deposit?.updated_at);
    availableAmount = money(deposit?.paid_amount);
    const paid = Boolean(deposit?.id) && availableAmount > 0 && !['failed','cancelled','expired'].includes(clean(deposit?.deposit_status,40).toLowerCase());
    push('source', paid, paid ? 'Paid customer deposit source found.' : 'Choose a paid customer deposit with available value.');
  } else {
    sourceType = 'manual_adjustment';
    sourceId = null;
    availableAmount = money(invoice?.balance_due);
    push('source', manualSourceReference.length >= 3, manualSourceReference.length >= 3 ? 'Adjustment source/reference supplied.' : 'Credit, discount, and write-off applications require a source/reference.');
  }

  const invoiceClientId = invoice?.client_id || null;
  let client:any = null;
  const resolvedClientId = invoiceClientId || sourceClientId;
  if (resolvedClientId) client = await findExact(supabase,'clients',resolvedClientId,'id',[],'id,client_code,legal_name,display_name,is_active');
  const identityMatches = !invoiceClientId || !sourceClientId || String(invoiceClientId) === String(sourceClientId);
  push('customer_identity', identityMatches && Boolean(resolvedClientId), identityMatches && resolvedClientId ? 'Customer identity matches invoice and source.' : 'Invoice and source must belong to the same customer.');

  push('amount', amount > 0, amount > 0 ? 'Application amount is greater than zero.' : 'Application amount must be greater than zero.');
  const invoiceBalance = money(invoice?.balance_due);
  const invoiceAmountAllowed = !invoiceRequired || (invoiceBalance > 0 && amount <= invoiceBalance);
  push('invoice_balance', invoiceAmountAllowed, invoiceRequired ? (invoiceAmountAllowed ? 'Amount fits within the open invoice balance.' : 'Amount exceeds the invoice balance or the invoice has no open balance.') : 'Invoice balance does not constrain overpayment classification.');

  const sourceAmountAllowed = ['credit','discount','writeoff'].includes(applicationType)
    ? amount > 0 && (!invoiceRequired || amount <= invoiceBalance)
    : availableAmount > 0 && amount <= availableAmount;
  push('available_balance', sourceAmountAllowed, sourceAmountAllowed ? 'Amount fits within the available source balance.' : 'Amount exceeds the available source balance.');

  const sourceDateOk = !sourceDate || applicationDate >= sourceDate;
  push('date', sourceDateOk, sourceDateOk ? 'Application date is on or after the source date.' : 'Application date cannot precede the source transaction date.');

  let periodOpen = true;
  let periodMessage = 'A/R period is open for this application date.';
  try { await assertPeriodOpen(supabase, applicationDate, 'ar'); }
  catch (error) { periodOpen = false; periodMessage = error instanceof Error ? error.message : 'A/R period is locked.'; }
  push('open_period', periodOpen, periodMessage);

  const proofReference = clean(body.proof_reference,240);
  push('proof', proofReference.length >= 3, proofReference.length >= 3 ? 'Proof reference supplied.' : 'Proof reference is required.');

  const allowed = validations.every((item)=>item.status === 'pass');
  return {
    allowed,
    application: {
      application_type: applicationType,
      action_type: build313ActionType(applicationType),
      application_date: applicationDate,
      amount,
      invoice_id: invoice?.id || null,
      invoice_reference: invoice?.invoice_number || invoiceRef || null,
      invoice_balance: invoiceBalance,
      payment_id: payment?.id || null,
      payment_reference: payment?.payment_number || payment?.reference_number || null,
      deposit_id: deposit?.id || null,
      deposit_reference: deposit?.payment_reference || null,
      source_type: sourceType,
      source_id: sourceId,
      source_reference: sourceReference,
      source_date: sourceDate,
      available_amount: availableAmount,
      client_id: resolvedClientId || null,
      client_name: clean(client?.display_name || client?.legal_name,180) || null,
      customer_identity_match: identityMatches,
      posting_enabled: false,
      approval_required: ['credit','discount','writeoff'].includes(applicationType)
    },
    validations
  };
}


const RECON_EXCEPTION_CATEGORIES = new Set([
  'timing_difference','duplicate','missing_document','wrong_account','amount_mismatch',
  'transfer_pair','provider_settlement','manual_accounting_review'
]);
const RECON_EXCEPTION_SEVERITIES = new Set(['low','medium','high','critical']);

function parseReconReviewNotes(value: unknown) {
  const raw = clean(value, 6000);
  if (!raw) return {} as Record<string, unknown>;
  try {
    const parsed = JSON.parse(raw);
    return objectValue(parsed);
  } catch {
    return { legacy_note: raw };
  }
}
function inferReconExceptionCategory(row: any) {
  const text = normalize(`${row?.difference_reason || ''} ${row?.item_description || ''} ${row?.notes || ''}`);
  if (text.includes('duplicate')) return 'duplicate';
  if (text.includes('transfer')) return 'transfer_pair';
  if (text.includes('stripe') || text.includes('paypal') || text.includes('provider') || text.includes('settlement')) return 'provider_settlement';
  if (text.includes('wrong account') || text.includes('account mismatch')) return 'wrong_account';
  if (text.includes('document') || text.includes('receipt') || text.includes('invoice missing')) return 'missing_document';
  if (text.includes('amount') || text.includes('difference')) return 'amount_mismatch';
  if (text.includes('timing') || text.includes('date')) return 'timing_difference';
  return 'manual_accounting_review';
}
function defaultReconExceptionSeverity(row: any, ageDays: number) {
  const amount = Math.abs(money(row?.amount));
  if (amount >= 5000 || ageDays >= 60) return 'critical';
  if (amount >= 1000 || ageDays >= 30) return 'high';
  if (amount >= 250 || ageDays >= 14) return 'medium';
  return 'low';
}
function reconciliationExceptionView(row: any, profileMap: Map<string, any>) {
  const note = parseReconReviewNotes(row?.review_notes);
  const created = new Date(row?.created_at || row?.item_date || nowIso());
  const ageDays = Number.isNaN(created.valueOf()) ? 0 : Math.max(0, Math.floor((Date.now() - created.valueOf()) / 86400000));
  const severityCandidate = clean(note.severity, 30).toLowerCase();
  const categoryCandidate = clean(note.category, 80).toLowerCase();
  const severity = RECON_EXCEPTION_SEVERITIES.has(severityCandidate) ? severityCandidate : defaultReconExceptionSeverity(row, ageDays);
  const category = RECON_EXCEPTION_CATEGORIES.has(categoryCandidate) ? categoryCandidate : inferReconExceptionCategory(row);
  const ownerProfileId = isUuid(note.owner_profile_id) ? clean(note.owner_profile_id,80) : (isUuid(row?.reviewed_by_profile_id) ? row.reviewed_by_profile_id : null);
  const owner = ownerProfileId ? profileMap.get(String(ownerProfileId)) : null;
  const resolutionStatus = clean(note.resolution_status, 30).toLowerCase() === 'resolved' || row?.manual_review_status === 'approved' ? 'resolved' : 'open';
  const material = ['high','critical'].includes(severity) || Math.abs(money(row?.amount)) >= 1000;
  const blocker = resolutionStatus !== 'resolved' && material;
  return {
    ...row,
    exception_severity: severity,
    exception_category: category,
    owner_profile_id: ownerProfileId,
    owner_name: owner?.full_name || owner?.email || null,
    age_days: ageDays,
    evidence_reference: clean(note.evidence_reference || row?.notes || row?.difference_reason, 1000) || null,
    resolution_reason: clean(note.resolution_reason, 1000) || null,
    resolution_status: resolutionStatus,
    material,
    finance_readiness_blocker: blocker,
    month_end_close_blocker: blocker,
    review_metadata: note
  };
}


const ATTENTION_PRIORITY_RANK: Record<string, number> = { critical:0, high:10, medium:20, low:30, info:40 };
function attentionPriority(value: unknown, fallback = 'medium') {
  const cleanValue = clean(value, 40).toLowerCase();
  return Object.prototype.hasOwnProperty.call(ATTENTION_PRIORITY_RANK, cleanValue) ? cleanValue : fallback;
}
function attentionItem(input: Record<string, unknown>) {
  const sourceModule = clean(input.source_module, 20).toLowerCase();
  const sourceType = clean(input.source_type, 80).toLowerCase();
  const sourceId = clean(input.source_id, 160);
  return {
    source_key: `${sourceModule}:${sourceType}:${sourceId}`,
    source_module: sourceModule,
    source_type: sourceType,
    source_id: sourceId,
    title: clean(input.title, 240),
    context: clean(input.context, 600),
    priority: attentionPriority(input.priority, 'medium'),
    owner: clean(input.owner, 180) || 'Unassigned',
    due_at: input.due_at || null,
    route_hint: clean(input.route_hint, 60) || sourceModule,
    state_status: 'open',
    deferred_until: null,
    state_note: null
  };
}
function buildOperationsAttentionQueue(input: Record<string, any[]>) {
  const now = Date.now();
  const todayText = new Date().toISOString().slice(0,10);
  const items: any[] = [];
  const jobs = input.jobs || [];
  for (const row of jobs) {
    const status = clean(row?.status,40).toLowerCase();
    const active = !['completed','done','closed','cancelled','canceled'].includes(status);
    const reasons:string[] = [];
    if (active && row?.start_date && String(row.start_date) < todayText) reasons.push('overdue');
    if (active && !row?.crew_id && !row?.assigned_supervisor_profile_id) reasons.push('unassigned');
    if (reasons.length) items.push(attentionItem({
      source_module:'jobs', source_type:'job_schedule', source_id:row.id,
      title:`${row.job_code || 'Job'} · ${reasons.join(' / ')}`,
      context:`${row.job_name || ''}${row.client_name ? ` · ${row.client_name}` : ''}`,
      priority: reasons.includes('overdue') ? 'high' : 'medium',
      owner: row.assigned_supervisor_name || row.supervisor_name || row.crew_name,
      due_at: row.start_date || row.end_date, route_hint:'jobs'
    }));
    if (['completed','done','closed'].includes(status) && !clean(row?.invoice_number,100)) {
      items.push(attentionItem({
        source_module:'jobs', source_type:'completed_not_invoiced', source_id:row.id,
        title:`${row.job_code || 'Job'} · completed, not invoiced`,
        context:`${row.job_name || ''}${row.client_name ? ` · ${row.client_name}` : ''}`,
        priority:'high', owner:row.admin_name || row.assigned_supervisor_name || row.supervisor_name,
        due_at:row.end_date || row.updated_at, route_hint:'jobs'
      }));
    }
  }
  for (const row of input.quotes || []) {
    if (row?.overdue === true || !row?.assigned_to_profile_id) items.push(attentionItem({
      source_module:'jobs', source_type:'customer_followup', source_id:row.id,
      title:`${row.full_name || 'Customer'} · ${row?.overdue === true ? 'follow-up overdue' : 'follow-up unassigned'}`,
      context:`${row.service_type || 'Service inquiry'}${row.service_area ? ` · ${row.service_area}` : ''}`,
      priority:row?.overdue === true ? 'high' : 'medium', owner:row.assigned_owner_name,
      due_at:row.followup_due_at, route_hint:'jobs'
    }));
  }
  for (const row of input.equipment || []) {
    if (row?.is_locked_out === true || !['','none','resolved','closed'].includes(clean(row?.defect_status,40).toLowerCase())) items.push(attentionItem({
      source_module:'jobs', source_type:'equipment_defect', source_id:row.id,
      title:`${row.equipment_code || 'Equipment'} · ${row?.is_locked_out === true ? 'LOCKED OUT' : 'defect review'}`,
      context:row.equipment_name || row.job_reference || 'Equipment issue',
      priority:row?.is_locked_out === true ? 'critical' : 'high', owner:'',
      due_at:row.created_at, route_hint:'jobs'
    }));
  }
  for (const row of input.maintenance || []) {
    const status = clean(row?.task_status,40).toLowerCase();
    const due = row?.due_at ? new Date(row.due_at).valueOf() : 0;
    if (!['resolved','closed','complete','completed'].includes(status) && due && due < now) items.push(attentionItem({
      source_module:'jobs', source_type:'maintenance_overdue', source_id:row.id,
      title:`${row.equipment_code || 'Equipment'} · maintenance overdue`,
      context:`${row.task_type || 'Service'}${row.failure_reason ? ` · ${row.failure_reason}` : ''}`,
      priority:attentionPriority(row.priority,'high'), owner:row.assigned_to_name,
      due_at:row.due_at, route_hint:'jobs'
    }));
  }
  for (const row of input.safety || []) {
    items.push(attentionItem({
      source_module:'safety', source_type:row.queue_type || 'safety_action', source_id:row.queue_id,
      title:row.headline || 'Safety action requires attention',
      context:row.primary_context || row.site_name || row.job_code || '',
      priority:attentionPriority(row.queue_priority,'high'), owner:row.owner_name || row.supervisor_name,
      due_at:row.due_label || row.sort_at, route_hint:'toolbox'
    }));
  }
  for (const row of input.time || []) {
    if (row?.needs_review === true) items.push(attentionItem({
      source_module:'admin', source_type:'timesheet_issue', source_id:row.time_entry_id,
      title:`${row.full_name || 'Employee'} · ${row.issue_summary || row.issue_code || 'time review'}`,
      context:`${row.job_code || row.job_name || 'Unassigned time'}${row.crew_name ? ` · ${row.crew_name}` : ''}`,
      priority:attentionPriority(row.latest_severity || row.default_severity,'medium'),
      owner:row.latest_reviewed_by_name, due_at:row.signed_out_at || row.signed_in_at, route_hint:'admin'
    }));
  }
  for (const row of input.ar || []) {
    if (Number(row?.balance_due || 0) > 0 && Number(row?.days_past_due || 0) > 0) items.push(attentionItem({
      source_module:'finance', source_type:'overdue_receivable', source_id:row.id,
      title:`${row.invoice_number || 'Invoice'} · ${Number(row.days_past_due || 0)} day(s) overdue`,
      context:`${row.client_name || 'Customer'} · ${money(row.balance_due).toFixed(2)} CAD open`,
      priority:Number(row.days_past_due || 0) >= 60 ? 'critical' : Number(row.days_past_due || 0) >= 30 ? 'high' : 'medium',
      owner:'Finance', due_at:row.due_date, route_hint:'finance'
    }));
  }
  for (const row of input.reconciliation || []) {
    items.push(attentionItem({
      source_module:'finance', source_type:'reconciliation_exception', source_id:row.reconciliation_item_id,
      title:`${row.session_code || 'Reconciliation'} · ${row.item_description || 'manual review'}`,
      context:`${row.account_name || 'Bank'} · ${row.match_status || row.reconciliation_status || 'review'}`,
      priority:Number(row.review_priority || 90) <= 20 ? 'high' : 'medium',
      owner:'Finance', due_at:row.item_date || row.period_end, route_hint:'finance'
    }));
  }

  const states = new Map((input.states || []).map((row:any)=>[String(row.source_key),row]));
  const active:any[] = [];
  for (const item of items) {
    const state:any = states.get(item.source_key);
    if (state?.state_status === 'resolved') continue;
    if (state?.state_status === 'deferred' && state?.deferred_until && new Date(state.deferred_until).valueOf() > now) continue;
    active.push({
      ...item,
      state_status:state?.state_status === 'deferred' ? 'open' : (state?.state_status || 'open'),
      deferred_until:state?.deferred_until || null,
      state_note:state?.state_note || null
    });
  }
  active.sort((a,b)=>
    (ATTENTION_PRIORITY_RANK[a.priority] ?? 99) - (ATTENTION_PRIORITY_RANK[b.priority] ?? 99)
    || new Date(a.due_at || '2999-12-31').valueOf() - new Date(b.due_at || '2999-12-31').valueOf()
    || String(a.title).localeCompare(String(b.title))
  );
  const resolved=(input.states || [])
    .filter((row:any)=>row?.state_status === 'resolved')
    .sort((a:any,b:any)=>new Date(b.resolved_at || b.updated_at || 0).valueOf()-new Date(a.resolved_at || a.updated_at || 0).valueOf())
    .slice(0,20)
    .map((row:any)=>({
      source_key:row.source_key, source_module:row.source_module, source_type:row.source_type, source_id:row.source_id,
      title:row.source_title || row.source_key, context:row.source_context || '', priority:row.source_priority || 'medium',
      owner:'Resolved', due_at:row.source_due_at, state_status:'resolved', state_note:row.state_note,
      resolved_at:row.resolved_at, route_hint:row.source_module
    }));
  const deferredCount=(input.states || []).filter((row:any)=>row?.state_status==='deferred' && row?.deferred_until && new Date(row.deferred_until).valueOf()>now).length;
  return { active:active.slice(0,120), resolved, deferred_count:deferredCount, total_active:active.length };
}

async function queuePayload(supabase: any, profile: any, bankWorkbenchV2 = false, bankReviewImportId = '') {
  const queueNames: Record<string, string> = {
    quotes: 'v_quote_contact_followup_queue', payments: 'v_payment_action_workbench', bank_imports: 'v_bank_csv_import_workbench',
    reconciliation: 'v_reconciliation_action_workbench', equipment: 'v_equipment_scan_resolution_queue', equipment_service: 'v_equipment_service_cost_recovery_queue',
    assets: 'v_visual_asset_publication_readiness', routes: 'v_public_route_publication_readiness', portal: 'v_customer_portal_quote_directory', job_costs: 'v_live_job_cost_dashboard',
    job_updates: 'v_work_order_live_update_queue', customer_notifications: 'v_customer_notification_delivery_queue', execution_proofs: 'v_work_order_execution_proof_queue', execution_costs: 'v_work_order_execution_cost_dashboard', closeouts: 'v_work_order_closeout_queue'
  };
  const entries = await Promise.all(Object.entries(queueNames).map(async ([key, view]) => {
    const rows = await safeSelect(supabase.from(view).select('*').limit(60));
    return [key, rows];
  }));
  const queueMap = Object.fromEntries(entries) as Record<string, any[]>;
  const bankHistoryIds = bankWorkbenchV2
    ? (queueMap.bank_imports || []).slice(0, 20).map((row: any) => clean(row.id, 80)).filter(isUuid)
    : [];
  const requestedReviewId = bankWorkbenchV2 && isUuid(bankReviewImportId) ? clean(bankReviewImportId, 80) : '';
  const bankReviewIds = requestedReviewId ? [requestedReviewId] : [];
  const [bankItems, profiles, banks, rails, stripeRows, exportRows, testRows, policyRows, signalRows, alertRows, releaseRows, capabilitySnapshot, arInvoices, arPayments, customerDeposits, arApplications] = await Promise.all([
    safeSelect(supabase.from('bank_reconciliation_items').select('id, reconciliation_session_id, item_date, item_description, amount, match_status, clearing_status, difference_reason, notes, manual_review_status, reviewed_by_profile_id, reviewed_at, review_notes, created_at, updated_at').eq('clearing_status', 'open').order('item_date', { ascending: false }).limit(100)),
    safeSelect(supabase.from('profiles').select('id, full_name, email, role').order('full_name').limit(200)),
    safeSelect(supabase.from('bank_accounts').select('id, account_name, currency_code, account_mask, is_default, gl_account_id').eq('account_status', 'open').order('is_default', { ascending: false }).order('account_name')),
    safeSelect(supabase.from('admin_scorecard_progress_rails').select('*').eq('rail_status', 'active').order('sort_order')),
    safeSelect(supabase.from('v_stripe_webhook_health').select('*').limit(1)),
    safeSelect(supabase.from('v_accountant_export_readiness').select('*').limit(1)),
    safeSelect(supabase.from('v_operations_staging_test_summary').select('*').limit(6)),
    safeSelect(supabase.from('v_security_policy_assertion_summary').select('*').limit(1)),
    safeSelect(supabase.from('v_route_content_decision_queue').select('*').limit(12)),
    callRpc(supabase, 'ywi_refresh_stripe_webhook_alerts', {}).catch(() => ({})).then(() => safeSelect(supabase.from('v_stripe_webhook_alert_queue').select('*').limit(12))),
    safeSelect(supabase.from('v_release_readiness_dashboard').select('*').limit(1)),
    callRpc(supabase, 'ywi_get_operations_capabilities', { p_actor_profile_id: profile.id }).catch(() => ({ actor_role: profile?.role || 'unknown', actor_rank: roleRank(profile?.role), actions: {} })),
    safeSelect(supabase.from('ar_invoices').select('id,invoice_number,invoice_date,due_date,invoice_status,total_amount,balance_due,client_id,work_order_id,updated_at').gt('balance_due',0).order('due_date',{ascending:true}).limit(250)),
    safeSelect(supabase.from('ar_payments').select('id,payment_number,reference_number,payment_date,amount,unapplied_amount,application_status,client_id,invoice_id,updated_at').gt('unapplied_amount',0).order('payment_date',{ascending:false}).limit(250)),
    safeSelect(supabase.from('customer_deposit_requests').select('id,quote_package_id,estimate_id,client_id,requested_amount,paid_amount,deposit_status,payment_reference,paid_at,updated_at').gt('paid_amount',0).order('paid_at',{ascending:false}).limit(200)),
    safeSelect(supabase.from('ar_payment_applications').select('id,payment_id,invoice_id,application_date,applied_amount,application_status,application_type,credit_amount,discount_amount,writeoff_amount,overpayment_amount,review_status,source_reconciliation_item_id,application_payload,created_at,updated_at').order('created_at',{ascending:false}).limit(100))
  ]);
  const [bankReviewRows, bankDetails] = await Promise.all([
    bankReviewIds.length ? safeSelect(supabase.from('bank_csv_import_preview_rows')
      .select('id,import_id,row_number,row_status,transaction_date,description,amount,debit_amount,credit_amount,reference,duplicate_key,rejection_reason,raw_row,promoted_at,created_at')
      .in('import_id', bankReviewIds)
      .is('promoted_at', null)
      .order('row_number')
      .limit(2500)) : Promise.resolve([]),
    bankHistoryIds.length ? safeSelect(supabase.from('bank_csv_import_previews')
      .select('id,validation_summary,metadata,header_json,updated_at')
      .in('id', bankHistoryIds)
      .limit(20)) : Promise.resolve([])
  ]);
  const bankDetailMap = new Map((bankDetails || []).map((row: any) => [String(row.id), row]));
  const profileMap = new Map((profiles || []).map((row: any) => [String(row.id), row]));
  const reconciliationExceptions = (bankItems || []).filter((row: any) => ['unmatched','partial','exception'].includes(clean(row?.match_status,40).toLowerCase()) || clean(row?.manual_review_status,40).toLowerCase() === 'exception').map((row: any) => reconciliationExceptionView(row, profileMap));
  queueMap.bank_imports = (queueMap.bank_imports || []).map((row: any) => ({
    ...row,
    validation_summary: bankDetailMap.get(String(row.id))?.validation_summary || {},
    metadata: bankDetailMap.get(String(row.id))?.metadata || {},
    header_json: bankDetailMap.get(String(row.id))?.header_json || []
  }));


  const [jobsAttentionAllowed,safetyAttentionAllowed,financeAttentionAllowed] = await Promise.all([
    hasModuleAccess(supabase, profile, 'jobs', 'view'),
    hasModuleAccess(supabase, profile, 'safety', 'view'),
    hasModuleAccess(supabase, profile, 'finance', 'view')
  ]);
  const [attentionJobs,attentionQuotes,attentionEquipment,attentionMaintenance,attentionSafety,attentionTime,attentionAr,attentionRecon,attentionStates] = await Promise.all([
    jobsAttentionAllowed ? safeSelect(supabase.from('v_jobs_directory').select('*').order('start_date',{ascending:true}).limit(250)) : Promise.resolve([]),
    jobsAttentionAllowed ? safeSelect(supabase.from('v_quote_contact_followup_queue').select('*').order('followup_due_at',{ascending:true}).limit(160)) : Promise.resolve([]),
    jobsAttentionAllowed ? safeSelect(supabase.from('v_equipment_scan_resolution_queue').select('*').order('created_at',{ascending:false}).limit(160)) : Promise.resolve([]),
    jobsAttentionAllowed ? safeSelect(supabase.from('v_equipment_service_task_directory').select('*').order('due_at',{ascending:true}).limit(160)) : Promise.resolve([]),
    safetyAttentionAllowed ? safeSelect(supabase.from('v_supervisor_safety_queue').select('*').order('sort_at',{ascending:false}).limit(160)) : Promise.resolve([]),
    safeSelect(supabase.from('v_employee_time_review_queue').select('*').eq('needs_review',true).limit(160)),
    financeAttentionAllowed ? safeSelect(supabase.from('v_ar_invoice_aging_detail').select('*').gt('balance_due',0).order('due_date',{ascending:true}).limit(200)) : Promise.resolve([]),
    financeAttentionAllowed ? safeSelect(supabase.from('v_accounting_reconciliation_manual_review_queue').select('*').order('review_priority',{ascending:true}).limit(160)) : Promise.resolve([]),
    safeSelect(supabase.from('operations_attention_states').select('*').order('updated_at',{ascending:false}).limit(300))
  ]);
  const operationsAttention = buildOperationsAttentionQueue({
    jobs:attentionJobs, quotes:attentionQuotes, equipment:attentionEquipment, maintenance:attentionMaintenance,
    safety:attentionSafety, time:attentionTime, ar:attentionAr, reconciliation:attentionRecon, states:attentionStates
  });

  const [dispatchSchedule,dispatchCrews,dispatchEquipment,dispatchRoutes,dispatchCandidates] = jobsAttentionAllowed ? await Promise.all([
    safeSelect(supabase.from('v_crew_dispatch_schedule').select('*').order('scheduled_start',{ascending:true}).limit(240)),
    safeSelect(supabase.from('v_crew_directory').select('*').order('crew_name',{ascending:true}).limit(120)),
    safeSelect(supabase.from('equipment_items').select('id,equipment_code,equipment_name,category,status,is_locked_out,defect_status,condition_status').order('equipment_name',{ascending:true}).limit(300)),
    safeSelect(supabase.from('routes').select('id,route_code,name,route_type,day_of_week,is_active').eq('is_active',true).order('name',{ascending:true}).limit(160)),
    safeSelect(supabase.from('v_crew_dispatch_work_order_candidates').select('*').order('scheduled_start',{ascending:true}).limit(300))
  ]) : [[],[],[],[],[]];

  const [recurringPrograms,recurringVisits,recurringClients,recurringSites] = jobsAttentionAllowed ? await Promise.all([
    safeSelect(supabase.from('v_recurring_service_program_directory').select('*').order('agreement_code',{ascending:true}).limit(240)),
    safeSelect(supabase.from('v_recurring_service_visit_schedule').select('*').order('service_date',{ascending:true}).limit(500)),
    safeSelect(supabase.from('clients').select('id,display_name,legal_name').order('display_name',{ascending:true}).limit(300)),
    safeSelect(supabase.from('client_sites').select('id,client_id,site_name,service_address,city').order('site_name',{ascending:true}).limit(400))
  ]) : [[],[],[],[]];

  const [propertySites,propertyZones,propertyPhotos,propertyClients] = jobsAttentionAllowed ? await Promise.all([
    safeSelect(supabase.from('v_property_site_intelligence').select('*').order('site_name',{ascending:true}).limit(400)),
    safeSelect(supabase.from('v_property_site_zone_directory').select('*').order('sort_order',{ascending:true}).order('zone_name',{ascending:true}).limit(700)),
    safeSelect(supabase.from('v_property_site_photo_directory').select('*').eq('is_active',true).order('created_at',{ascending:false}).limit(500)),
    safeSelect(supabase.from('clients').select('id,client_code,display_name,legal_name,is_active').eq('is_active',true).order('display_name',{ascending:true}).limit(400))
  ]) : [[],[],[],[]];

  const [estimateWorkflow,estimateAssumptions,estimateVariance,estimateTemplates,estimateClients,estimateSites,estimateChangeOrders] = jobsAttentionAllowed ? await Promise.all([
    safeSelect(supabase.from('v_estimate_job_invoice_workflow').select('*').order('estimate_number',{ascending:false}).limit(400)),
    safeSelect(supabase.from('v_estimate_workflow_assumption_directory').select('*').order('estimate_number',{ascending:false}).order('sort_order',{ascending:true}).limit(900)),
    safeSelect(supabase.from('v_estimate_assumption_variance').select('*').order('work_order_number',{ascending:false}).limit(400)),
    safeSelect(supabase.from('service_pricing_templates').select('id,template_code,template_name,job_family,project_scope,default_estimated_duration_hours,default_markup_percent,default_quoted_charge_total,default_estimated_cost_total,is_active').eq('is_active',true).order('template_name',{ascending:true}).limit(300)),
    safeSelect(supabase.from('clients').select('id,client_code,display_name,legal_name,is_active').eq('is_active',true).order('display_name',{ascending:true}).limit(400)),
    safeSelect(supabase.from('client_sites').select('id,client_id,site_code,site_name,service_address,city,is_active').eq('is_active',true).order('site_name',{ascending:true}).limit(500)),
    safeSelect(supabase.from('change_orders').select('id,change_order_number,status,work_order_id,estimate_id,job_id,scope_summary,reason,estimated_cost_delta,estimated_charge_delta,customer_approval_reference,customer_approved_at,customer_approved_by_name,requested_at,approved_at,updated_at').order('requested_at',{ascending:false}).limit(500))
  ]) : [[],[],[],[],[],[],[]];

  const [productionSessions,productionQuantities,productionWorkOrders,productionMaterialIssues,productionEquipmentSignouts] = jobsAttentionAllowed ? await Promise.all([
    safeSelect(supabase.from('v_landscape_production_session_directory').select('*').order('session_date',{ascending:false}).order('started_at',{ascending:false}).limit(500)),
    safeSelect(supabase.from('v_landscape_production_quantity_directory').select('*').eq('is_active',true).order('session_date',{ascending:false}).order('sort_order',{ascending:true}).limit(1000)),
    safeSelect(supabase.from('work_orders').select('id,work_order_number,legacy_job_id,client_id,client_site_id,status,scheduled_start,scheduled_end,supervisor_profile_id,crew_notes').order('created_at',{ascending:false}).limit(500)),
    safeSelect(supabase.from('material_issues').select('id,issue_number,work_order_id,job_session_id,issue_status,issue_date,line_count,quantity_total,issue_total,notes').order('issue_date',{ascending:false}).limit(500)),
    safeSelect(supabase.from('equipment_signouts').select('id,equipment_item_id,job_id,work_order_id,job_session_id,checked_out_at,returned_at,verification_status,signout_notes').order('checked_out_at',{ascending:false}).limit(500))
  ]) : [[],[],[],[],[]];

  return {
    operations_attention: operationsAttention.active,
    operations_attention_resolved: operationsAttention.resolved,
    operations_attention_meta: { build:320, schema:209, total_active:operationsAttention.total_active, deferred_count:operationsAttention.deferred_count, permission_filtered:true },
    crew_dispatch_schedule: dispatchSchedule,
    crew_dispatch_crews: dispatchCrews,
    crew_dispatch_equipment: dispatchEquipment,
    crew_dispatch_routes: dispatchRoutes,
    crew_dispatch_work_orders: dispatchCandidates,
    crew_dispatch_meta: { build:321, schema:210, permission_filtered:true, scheduler_authority:'dispatch_schedule_items', conflict_policy:'explicit_override_required' },
    recurring_service_programs: recurringPrograms,
    recurring_service_visits: recurringVisits,
    recurring_service_clients: recurringClients,
    recurring_service_sites: recurringSites,
    recurring_service_meta: { build:322, schema:211, permission_filtered:true, agreement_authority:'recurring_service_agreements', scheduler_authority:'v_service_execution_scheduler_candidates' },
    property_sites: propertySites,
    property_zones: propertyZones,
    property_photos: propertyPhotos,
    property_clients: propertyClients,
    property_site_meta: { build:323, schema:212, permission_filtered:true, property_authority:'client_sites', legacy_safety_site_authority:'sites', photo_mode:'private_reference' },
    estimate_invoice_workflows: estimateWorkflow,
    estimate_workflow_assumptions: estimateAssumptions,
    estimate_assumption_variance: estimateVariance,
    estimate_pricing_templates: estimateTemplates,
    estimate_workflow_clients: estimateClients,
    estimate_workflow_sites: estimateSites,
    estimate_change_orders: estimateChangeOrders,
    estimate_invoice_meta: { build:324, schema:213, permission_filtered:true, estimate_authority:'estimates', work_order_authority:'work_orders', customer_acceptance_authority:'ywi_rpc_accept_quote_package', invoice_authority:'job_invoice_candidates', finance_posting_enabled:false },
    landscape_production_sessions: productionSessions,
    landscape_production_quantities: productionQuantities,
    landscape_production_work_orders: productionWorkOrders,
    landscape_production_material_issues: productionMaterialIssues,
    landscape_production_equipment_signouts: productionEquipmentSignouts,
    landscape_production_meta: { build:325, schema:214, permission_filtered:true, session_authority:'job_sessions', labour_authority:'job_session_crew_hours', material_authority:'material_issues', equipment_authority:'equipment_signouts', photo_authority:'work_order_execution_proofs', closeout_authority:'work_order_closeout_packages' },
    ...queueMap, bank_preview_rows: bankReviewRows, bank_items: bankItems, reconciliation_exceptions: reconciliationExceptions, profiles, banks, rails, ar_invoices: arInvoices, ar_payments: arPayments, customer_deposits: customerDeposits, ar_applications: arApplications,
    capabilities: capabilitySnapshot,
    stripe_health: {
      ...(stripeRows?.[0] || {}),
      webhook_secret_configured: Boolean(clean(Deno.env.get('STRIPE_WEBHOOK_SECRET'), 8)),
      api_key_configured: Boolean(clean(Deno.env.get('STRIPE_SECRET_KEY'), 8))
    },
    accountant_export: exportRows?.[0] || {},
    staging_tests: testRows || [],
    security_policy: policyRows?.[0] || {},
    content_signals: signalRows || [],
    webhook_alerts: alertRows || [],
    release_dashboard: releaseRows?.[0] || {},
    customer_notification_delivery: {
      enabled: clean(Deno.env.get('YWI_CUSTOMER_NOTIFICATION_DELIVERY_ENABLED'), 20).toLowerCase() === 'true',
      resend_configured: Boolean(clean(Deno.env.get('RESEND_API_KEY'), 8) && clean(Deno.env.get('RESEND_FROM_EMAIL') || Deno.env.get('EMAIL_FROM'), 8)),
      run_token_configured: Boolean(clean(Deno.env.get('YWI_CUSTOMER_NOTIFICATION_RUN_TOKEN'), 24)),
      email_only: true
    }
  };
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
    const boundary = resolveModuleWriteBoundary(action);
    if (!boundary) {
      throw new HttpError(400, `Unsupported operations-manage action: ${action}`, { boundary: 'unregistered_action' });
    }
    if (boundary.mode === 'disabled') {
      throw new HttpError(409, `The ${action} action is disabled by the module write-boundary contract.`, {
        module_key: boundary.ownerModule,
        required_access: boundary.minimum,
        boundary_mode: boundary.mode,
        boundary_event_key: boundary.eventKey
      });
    }
    if (!(await hasModuleAccess(supabase, profile, boundary.ownerModule, boundary.minimum))) {
      throw new HttpError(403, `${boundary.ownerModule} module ${boundary.minimum} access is required.`, {
        module_key: boundary.ownerModule,
        required_access: boundary.minimum,
        boundary_mode: boundary.mode,
        boundary_event_key: boundary.eventKey
      });
    }

    if (action === 'operations_queue_list') {
      requireRank(profile, 30, action);
      return Response.json({ ok: true, build: BUILD, schema: SCHEMA, queues: await queuePayload(
        supabase,
        profile,
        body.bank_workbench_v2 === true,
        clean(body.bank_review_import_id, 80)
      ) }, { headers: corsHeaders });
    }


    if (action === 'operations_attention_defer' || action === 'operations_attention_resolve') {
      requireRank(profile, 50, action);
      const sourceKey = clean(body.source_key, 240);
      const sourceModule = clean(body.source_module, 20).toLowerCase();
      const sourceType = clean(body.source_type, 100).toLowerCase();
      const sourceId = clean(body.source_id, 180);
      if (!sourceKey || !['safety','finance','jobs','admin'].includes(sourceModule) || !sourceType || !sourceId) {
        throw new HttpError(400, 'A valid source_key, source_module, source_type and source_id are required.');
      }
      if (sourceKey !== `${sourceModule}:${sourceType}:${sourceId}`) {
        throw new HttpError(400, 'Attention source identity does not match the canonical source key.');
      }
      const title = clean(body.source_title, 240);
      const context = clean(body.source_context, 600);
      const priority = attentionPriority(body.source_priority,'medium');
      const sourceDueAt = body.source_due_at ? new Date(String(body.source_due_at)) : null;
      const note = clean(body.note, 1200);
      const isResolve = action === 'operations_attention_resolve';
      const deferredUntil = !isResolve && body.deferred_until ? new Date(String(body.deferred_until)) : null;
      if (!isResolve && (!deferredUntil || Number.isNaN(deferredUntil.valueOf()) || deferredUntil.valueOf() <= Date.now())) {
        throw new HttpError(400, 'Choose a future defer date/time.');
      }
      if (isResolve && note.length < 3) throw new HttpError(400, 'Add a short resolution note.');
      const row = {
        source_key:sourceKey, source_module:sourceModule, source_type:sourceType, source_id:sourceId,
        source_title:title || sourceKey, source_context:context || null, source_priority:priority,
        source_due_at:sourceDueAt && !Number.isNaN(sourceDueAt.valueOf()) ? sourceDueAt.toISOString() : null,
        state_status:isResolve ? 'resolved' : 'deferred',
        deferred_until:isResolve ? null : deferredUntil!.toISOString(),
        state_note:note || (isResolve ? 'Resolved from Operations Needs Attention.' : 'Deferred from Operations Needs Attention.'),
        resolved_at:isResolve ? nowIso() : null,
        resolved_by_profile_id:isResolve ? profile.id : null,
        last_source_seen_at:nowIso(),
        created_by_profile_id:profile.id, updated_by_profile_id:profile.id, updated_at:nowIso()
      };
      const { data, error } = await supabase.from('operations_attention_states').upsert(row,{onConflict:'source_key'}).select('*').single();
      if (error) throw error;
      await audit(supabase, {
        operation_action:action, operation_status:'completed', entity_type:'operations_attention',
        actor_profile_id:profile.id, request_payload:{source_key:sourceKey,state_status:row.state_status},
        response_payload:{source_key:sourceKey,state_status:data.state_status}
      });
      return Response.json({ok:true,build:320,schema:209,attention_state:data},{headers:corsHeaders});
    }

    if (action === 'payment_action_request') {
      requireRank(profile, 45, action);
      const applicationType = clean(body.application_type,40).toLowerCase();
      const preview = applicationType ? await resolveBuild313ArApplication(supabase, body) : null;
      if (body.preview_only === true) {
        if (!preview) throw new HttpError(400, 'A/R application preview requires an application_type.');
        return Response.json({ ok:true, preview, preview_only:true, posting_enabled:false, build:PAYMENT_APPLICATION_BUILD }, { headers:corsHeaders });
      }
      if (preview && !preview.allowed) {
        throw new HttpError(409, 'A/R application validation failed. Correct the failed checks before submitting.', { validations: preview.validations, application: preview.application });
      }

      const allowed = ['apply_payment','apply_unapplied_cash','apply_deposit','apply_credit','apply_discount','reverse_payment','refund','write_off','overpayment_credit'];
      const actionType = preview?.application?.action_type || clean(body.action_type || 'apply_payment', 80);
      if (!allowed.includes(actionType)) throw new HttpError(400, 'Unsupported payment action type.');
      const amount = money(preview?.application?.amount ?? body.amount);
      if (amount <= 0) throw new HttpError(400, 'Payment action amount must be greater than zero.');
      const reason = clean(body.reason, 1000);
      if (reason.length < 8) throw new HttpError(400, 'Add a clear reason of at least 8 characters.');
      const proofRequired = body.proof_required !== false;
      const proofReference = clean(body.proof_reference, 240);
      if (proofRequired && !proofReference) throw new HttpError(400, 'Proof reference is required for this action.');
      const key = idempotencyKey(req, body, 'payment');
      const application = preview?.application || null;
      const row = {
        action_key: key, idempotency_key: key, action_type: actionType, action_status: 'submitted',
        ledger_side: application ? 'ar' : clean(body.ledger_side || 'auto', 20),
        bank_account_id: isUuid(body.bank_account_id) ? body.bank_account_id : null,
        bank_account_hint: clean(body.bank_account_hint, 180) || null,
        transaction_date: application?.application_date || isoDate(body.transaction_date) || today(),
        customer_or_vendor_name: clean(application?.client_name || body.customer_or_vendor_name, 180) || null,
        invoice_reference: clean(application?.invoice_reference || body.invoice_reference, 160) || null,
        payment_reference: clean(application?.payment_reference || application?.deposit_reference || application?.source_reference || body.payment_reference, 160) || null,
        reversal_of_request_id: isUuid(body.reversal_of_request_id) ? body.reversal_of_request_id : null,
        ar_invoice_id: isUuid(application?.invoice_id) ? application.invoice_id : null,
        ar_payment_id: isUuid(application?.payment_id) ? application.payment_id : null,
        amount, currency_code: clean(body.currency_code || 'CAD', 8) || 'CAD', reason,
        proof_required: proofRequired, proof_reference: proofReference || null, requested_by_profile_id: profile.id,
        posting_status: 'not_posted',
        rollback_hint: 'Build 313 stages reviewed A/R applications only. Ledger posting remains disabled until separately authorized.',
        metadata: {
          build: 313, schema: SCHEMA, source: application ? 'payment-application-ar-completion' : 'operations-cockpit',
          payment_application: application || undefined,
          validations: preview?.validations || undefined,
          posting_enabled: false
        },
        updated_at: nowIso()
      };
      const { data, error } = await supabase.from('payment_action_requests').upsert(row, { onConflict: 'action_key', ignoreDuplicates: false }).select('*').single();
      if (error) throw error;
      await audit(supabase, {
        operation_action: action, operation_status: 'submitted', entity_type: 'payment_action_request',
        entity_id: data.id, actor_profile_id: profile.id, request_payload: safeRequest(body),
        response_payload: { action_key: data.action_key, build:PAYMENT_APPLICATION_BUILD, application_type:application?.application_type || null, posting_enabled:false }
      });
      return Response.json({ ok: true, record: data, preview, posting_enabled:false }, { headers: corsHeaders });
    }

    if (action === 'payment_action_decision') {
      requireRank(profile, 45, action);
      const requestId = clean(body.request_id, 80);
      if (!isUuid(requestId)) throw new HttpError(400, 'Valid request_id is required.');
      const decision = clean(body.decision, 40);
      if (!['approve','reject','post','cancel'].includes(decision)) throw new HttpError(400, 'Unsupported payment decision.');
      const { data: existing, error: readError } = await supabase.from('payment_action_requests').select('*').eq('id', requestId).single();
      if (readError) throw readError;
      if (decision === 'post') {
        throw new HttpError(409, 'Ledger posting is disabled for Build 313. Review and approve A/R application requests only; posting requires a separately authorized release.', { posting_enabled:false, posting_rpc:PAYMENT_POSTING_RPC });
      }
      const note = clean(body.decision_note, 1000);
      if ((decision === 'reject' || decision === 'cancel') && note.length < 5) throw new HttpError(400, 'Add a decision note.');
      const update: Record<string, unknown> = { action_status: decision === 'approve' ? 'approved' : decision === 'reject' ? 'rejected' : 'cancelled', decision_note: note || null, updated_at: nowIso() };
      if (decision === 'approve') { update.approved_by_profile_id = profile.id; update.approved_at = nowIso(); update.rejection_reason = null; }
      if (decision === 'reject') update.rejection_reason = note;
      const { data, error } = await supabase.from('payment_action_requests').update(update).eq('id', requestId).select('*').single();
      if (error) throw error;
      await audit(supabase, { operation_action: action, operation_status: String(update.action_status), entity_type: 'payment_action_request', entity_id: requestId, actor_profile_id: profile.id, request_payload: safeRequest(body) });
      return Response.json({ ok: true, record: data }, { headers: corsHeaders });
    }

    if (action === 'bank_csv_preview') {
      requireRank(profile, 45, action);
      const reviewOperation = clean(body.review_operation, 40);
      if (reviewOperation) {
        const importId = clean(body.import_id, 80);
        const preview = await requireBankPreviewReview(supabase, profile, importId);

        if (reviewOperation === 'discard_import') {
          const reason = clean(body.reason, 1000);
          if (reason.length < 5) throw new HttpError(400, 'Add a discard reason of at least 5 characters.');
          const { error: rowsError } = await supabase.from('bank_csv_import_preview_rows').update({
            row_status: 'rejected',
            rejection_reason: `Import discarded before promotion: ${reason}`
          }).eq('import_id', importId).is('promoted_at', null);
          if (rowsError) throw rowsError;
          const summary = await refreshBankPreviewSummary(supabase, importId, { discarded: true, discard_reason: reason });
          const { data, error } = await supabase.from('bank_csv_import_previews').update({
            preview_status: 'discarded',
            metadata: { ...objectValue(preview.metadata), discarded_at: nowIso(), discarded_by_profile_id: profile.id, discard_reason: reason },
            updated_at: nowIso()
          }).eq('id', importId).select('*').single();
          if (error) throw error;
          await audit(supabase, { operation_action: action, operation_status: 'discarded', entity_type: 'bank_csv_import_preview', entity_id: importId, actor_profile_id: profile.id, request_payload: safeRequest(body), response_payload: summary.counts });
          return Response.json({ ok: true, record: data, summary: summary.counts, discarded: true }, { headers: corsHeaders });
        }

        if (reviewOperation === 'row_decision') {
          const rowId = clean(body.row_id, 80);
          const decision = clean(body.decision, 30);
          if (!isUuid(rowId)) throw new HttpError(400, 'Valid row_id is required.');
          if (!['approve','reject','correct','undo'].includes(decision)) throw new HttpError(400, 'Unsupported bank-row decision.');
          const { data: row, error: rowError } = await supabase.from('bank_csv_import_preview_rows').select('*').eq('id', rowId).eq('import_id', importId).is('promoted_at', null).single();
          if (rowError) throw rowError;
          let update: Record<string, unknown> = {};

          if (decision === 'reject') {
            const reason = clean(body.reason, 1000);
            if (reason.length < 5) throw new HttpError(400, 'Add a rejection reason of at least 5 characters.');
            update = { row_status: 'rejected', rejection_reason: reason };
          } else if (decision === 'approve') {
            const validated = validateBankRows([{ date: row.transaction_date, description: row.description, amount: row.amount, reference: row.reference }])[0];
            const coreReasons = validated.reasons.filter((reason) => reason !== 'Possible duplicate row.');
            if (coreReasons.length) throw new HttpError(409, `Correct this row before approval: ${coreReasons.join(' ')}`);
            update = { row_status: 'accepted', rejection_reason: null };
          } else {
            const source = decision === 'undo' ? objectValue(row.raw_row) : {
              date: body.transaction_date,
              description: body.description,
              amount: body.amount,
              reference: body.reference,
              __source_row: objectValue(row.raw_row)?.__source_row || objectValue(row.raw_row)
            };
            const validated = validateBankRows([source])[0];
            const duplicateMatch = await safeSelect(supabase.from('bank_csv_import_preview_rows')
              .select('id')
              .eq('import_id', importId)
              .eq('duplicate_key', validated.duplicateKey)
              .neq('id', rowId)
              .limit(1));
            const reasons = [...validated.reasons.filter((reason) => reason !== 'Possible duplicate row.')];
            if (duplicateMatch.length) reasons.push('Possible duplicate row.');
            update = {
              transaction_date: validated.dateText,
              description: validated.description || null,
              amount: validated.amount,
              debit_amount: validated.debit,
              credit_amount: validated.credit,
              reference: validated.reference || null,
              duplicate_key: validated.duplicateKey,
              row_status: reasons.length ? 'rejected' : 'accepted',
              rejection_reason: reasons.join(' ') || null
            };
          }
          const { data, error } = await supabase.from('bank_csv_import_preview_rows').update(update).eq('id', rowId).eq('import_id', importId).is('promoted_at', null).select('*').single();
          if (error) throw error;
          const summary = await refreshBankPreviewSummary(supabase, importId, { last_review_operation: decision, last_reviewed_at: nowIso() });
          await audit(supabase, { operation_action: action, operation_status: `row_${decision}`, entity_type: 'bank_csv_import_preview_row', entity_id: rowId, actor_profile_id: profile.id, request_payload: safeRequest(body), response_payload: { import_id: importId, row_status: data.row_status, counts: summary.counts } });
          return Response.json({ ok: true, record: data, summary: summary.counts }, { headers: corsHeaders });
        }

        if (reviewOperation === 'bulk_decision') {
          const rowIds = [...new Set(arrayValue(body.row_ids).map((value) => clean(value, 80)).filter(isUuid))].slice(0, 101);
          if (!rowIds.length) throw new HttpError(400, 'Select at least one bank row.');
          if (rowIds.length > 100) throw new HttpError(400, 'Bulk bank review is limited to 100 explicitly selected rows.');
          const decision = clean(body.decision, 20);
          if (!['approve','reject'].includes(decision)) throw new HttpError(400, 'Bulk review supports approve or reject only.');
          const reason = clean(body.reason, 1000);
          if (decision === 'reject' && reason.length < 5) throw new HttpError(400, 'Add a rejection reason of at least 5 characters.');
          const selected = await safeSelect(supabase.from('bank_csv_import_preview_rows').select('*').eq('import_id', importId).in('id', rowIds).is('promoted_at', null).limit(100));
          if (selected.length !== rowIds.length) throw new HttpError(409, 'One or more selected rows are missing, already promoted, or outside this import.');
          if (decision === 'approve') {
            const invalid = selected.filter((row: any) => validateBankRows([{ date: row.transaction_date, description: row.description, amount: row.amount, reference: row.reference }])[0].reasons.filter((reason) => reason !== 'Possible duplicate row.').length);
            if (invalid.length) throw new HttpError(409, `${invalid.length} selected row(s) still need correction before approval.`);
          }
          const { error } = await supabase.from('bank_csv_import_preview_rows').update({
            row_status: decision === 'approve' ? 'accepted' : 'rejected',
            rejection_reason: decision === 'approve' ? null : reason
          }).eq('import_id', importId).in('id', rowIds).is('promoted_at', null);
          if (error) throw error;
          const summary = await refreshBankPreviewSummary(supabase, importId, { last_review_operation: `bulk_${decision}`, last_review_count: rowIds.length, last_reviewed_at: nowIso() });
          await audit(supabase, { operation_action: action, operation_status: `bulk_${decision}`, entity_type: 'bank_csv_import_preview', entity_id: importId, actor_profile_id: profile.id, request_payload: safeRequest(body), response_payload: { selected_count: rowIds.length, counts: summary.counts } });
          return Response.json({ ok: true, summary: summary.counts, reviewed: rowIds.length }, { headers: corsHeaders });
        }

        throw new HttpError(400, 'Unsupported bank-import review operation.');
      }

      const rows = arrayValue(body.rows).slice(0, 2500).map((row) => objectValue(row));
      if (!rows.length) throw new HttpError(400, 'CSV rows are required.');
      const validated = validateBankRows(rows);
      const headers = arrayValue(body.headers).map((h) => clean(h, 120)).filter(Boolean).slice(0, 80);
      const accepted = validated.filter((r) => r.status === 'accepted');
      const rejected = validated.filter((r) => r.status === 'rejected');
      const duplicates = validated.filter((r) => r.duplicate);
      const key = idempotencyKey(req, body, 'bank');
      const bank = await resolveBankAccount(supabase, body.bank_account_id, body.bank_account_hint);
      const { data: batch, error: batchError } = await supabase.from('bank_csv_import_previews').upsert({
        import_key: key, original_filename: clean(body.original_filename, 260) || null,
        bank_account_hint: clean(body.bank_account_hint, 180) || bank?.account_name || null, bank_account_id: bank?.id || null,
        preview_status: 'review', header_json: headers, total_rows: validated.length, accepted_rows: accepted.length,
        rejected_rows: rejected.length, duplicate_rows: duplicates.length,
        validation_summary: { accepted: accepted.length, rejected: rejected.length, duplicates: duplicates.length, rules: ['valid date','description required','non-zero amount','duplicate fingerprint'] },
        created_by_profile_id: profile.id, metadata: {
          build: BUILD, schema: SCHEMA, source: 'operations-cockpit',
          source_file_sha256: clean(body.source_file_sha256, 80) || null,
          source_file_bytes: Math.max(0, int(body.source_file_bytes)),
          source_file_last_modified: clean(body.source_file_last_modified, 80) || null,
          column_mapping: objectValue(body.column_mapping)
        }, updated_at: nowIso()
      }, { onConflict: 'import_key' }).select('*').single();
      if (batchError) throw batchError;
      await supabase.from('bank_csv_import_preview_rows').delete().eq('import_id', batch.id).is('promoted_at', null);
      const previewRows = validated.map((result) => ({
        import_id: batch.id, row_number: result.index, row_status: result.status, transaction_date: result.dateText,
        description: result.description || null, amount: result.amount, debit_amount: result.debit, credit_amount: result.credit,
        reference: result.reference || null, duplicate_key: result.duplicateKey,
        rejection_reason: result.reasons.join(' ') || null, raw_row: result.row
      }));
      const { error: rowsError } = await supabase.from('bank_csv_import_preview_rows').insert(previewRows);
      if (rowsError) throw rowsError;
      await audit(supabase, { operation_action: action, operation_status: 'review', entity_type: 'bank_csv_import_preview', entity_id: batch.id, actor_profile_id: profile.id, request_payload: safeRequest(body), response_payload: { accepted: accepted.length, rejected: rejected.length, duplicates: duplicates.length } });
      return Response.json({ ok: true, batch, summary: { accepted: accepted.length, rejected: rejected.length, duplicates: duplicates.length }, rows: validated.slice(0, 100) }, { headers: corsHeaders });
    }

    if (action === 'bank_csv_confirm_import') {
      requireRank(profile, 45, action);
      const importId = clean(body.import_id, 80);
      if (!isUuid(importId)) throw new HttpError(400, 'Valid import_id is required.');
      const { data: promotionGuard, error: promotionGuardError } = await supabase.from('bank_csv_import_previews').select('id,preview_status,promoted_at,accepted_rows').eq('id', importId).single();
      if (promotionGuardError) throw promotionGuardError;
      if (promotionGuard.preview_status === 'discarded') throw new HttpError(409, 'Discarded bank imports cannot be promoted. Restore or create a new preview instead.');
      if (!promotionGuard.promoted_at && Number(promotionGuard.accepted_rows || 0) < 1) throw new HttpError(409, 'No explicitly accepted rows are available for promotion.');
      const promotedResult = await callRpc(supabase, 'ywi_rpc_promote_bank_csv_import', {
        p_import_id: importId,
        p_actor_profile_id: profile.id,
        p_bank_account_id: isUuid(body.bank_account_id) ? body.bank_account_id : null,
        p_closing_balance: body.closing_balance === undefined ? null : money(body.closing_balance),
        p_confirmation_note: clean(body.confirmation_note, 1000) || null
      });
      await audit(supabase, { operation_action: action, operation_status: 'promoted', entity_type: 'bank_csv_import_preview', entity_id: importId, actor_profile_id: profile.id, request_payload: safeRequest(body), response_payload: { rpc: 'ywi_rpc_promote_bank_csv_import', result: promotedResult } });
      return Response.json({ ok: true, record: promotedResult.record || promotedResult, rpc: promotedResult, promoted: true }, { headers: corsHeaders });
      const { data: preview, error: previewError } = await supabase.from('bank_csv_import_previews').select('*').eq('id', importId).single();
      if (previewError) throw previewError;
      if (preview.promoted_at && preview.reconciliation_session_id) return Response.json({ ok: true, record: preview, promoted: true }, { headers: corsHeaders });
      const bank = await resolveBankAccount(supabase, body.bank_account_id || preview.bank_account_id, body.bank_account_hint || preview.bank_account_hint);
      if (!bank) throw new HttpError(409, 'Confirming a bank import requires a configured bank account.');
      const { data: acceptedRows, error: rowsError } = await supabase.from('bank_csv_import_preview_rows').select('*').eq('import_id', importId).eq('row_status', 'accepted').is('promoted_at', null).order('row_number');
      if (rowsError) throw rowsError;
      if (!acceptedRows?.length) throw new HttpError(409, 'No accepted, unpromoted rows remain.');
      const dates = acceptedRows.map((row: any) => row.transaction_date).filter(Boolean).sort();
      const statementStart = dates[0] || null;
      const statementEnd = dates[dates.length - 1] || null;
      const suffix = `${Date.now()}-${importId.slice(0, 8)}`;
      const { data: statement, error: statementError } = await supabase.from('bank_statement_imports').insert({
        bank_account_id: bank.id, import_code: `CSV-${suffix}`, statement_start: statementStart, statement_end: statementEnd,
        import_status: 'imported', transaction_count: acceptedRows.length, source_file_name: preview.original_filename,
        source_format: 'csv', import_payload: { preview_id: preview.id, validation_summary: preview.validation_summary },
        imported_by_profile_id: profile.id, imported_at: nowIso()
      }).select('*').single();
      if (statementError) throw statementError;
      const { data: session, error: sessionError } = await supabase.from('bank_reconciliation_sessions').insert({
        bank_account_id: bank.id, statement_import_id: statement.id, session_code: `RECON-${suffix}`,
        period_start: statementStart, period_end: statementEnd, reconciliation_status: 'in_review',
        bank_balance: body.closing_balance === undefined ? null : money(body.closing_balance),
        notes: clean(body.confirmation_note, 1000) || `Promoted from ${preview.original_filename || preview.import_key}`,
        created_by_profile_id: profile.id
      }).select('*').single();
      if (sessionError) throw sessionError;
      const itemRows = acceptedRows.map((row: any) => ({
        reconciliation_session_id: session.id, item_source_type: 'bank_statement_line', item_source_id: row.id,
        item_date: row.transaction_date, item_description: row.description, amount: money(row.amount),
        match_status: 'unmatched', clearing_status: 'open', notes: row.reference ? `Reference: ${row.reference}` : null
      }));
      const { data: items, error: itemError } = await supabase.from('bank_reconciliation_items').insert(itemRows).select('id, item_source_id');
      if (itemError) throw itemError;
      const itemMap = new Map((items || []).map((item: any) => [item.item_source_id, item.id]));
      for (const row of acceptedRows) {
        await supabase.from('bank_csv_import_preview_rows').update({ promoted_reconciliation_item_id: itemMap.get(row.id), promoted_at: nowIso() }).eq('id', row.id);
      }
      const { data, error } = await supabase.from('bank_csv_import_previews').update({
        preview_status: 'promoted', bank_account_id: bank.id, statement_import_id: statement.id, reconciliation_session_id: session.id,
        confirmed_by_profile_id: profile.id, confirmed_at: nowIso(), confirmation_note: clean(body.confirmation_note, 1000) || null,
        promoted_by_profile_id: profile.id, promoted_at: nowIso(), promotion_message: `${acceptedRows.length} accepted rows promoted to reconciliation.`, updated_at: nowIso()
      }).eq('id', importId).select('*').single();
      if (error) throw error;
      await audit(supabase, { operation_action: action, operation_status: 'promoted', entity_type: 'bank_csv_import_preview', entity_id: importId, actor_profile_id: profile.id, request_payload: safeRequest(body), response_payload: { statement_import_id: statement.id, reconciliation_session_id: session.id, promoted_rows: acceptedRows.length } });
      return Response.json({ ok: true, record: data, statement, session, promoted_rows: acceptedRows.length }, { headers: corsHeaders });
    }

    if (action === 'reconciliation_suggest') {
      requireRank(profile, 45, action);
      const item = await resolveReconItem(supabase, clean(body.bank_row_id, 80));
      if (!item) throw new HttpError(404, 'Promoted reconciliation row was not found.');
      return Response.json({ ok: true, item, suggestions: await suggestMatches(supabase, item) }, { headers: corsHeaders });
    }

    if (action === 'reconciliation_action') {
      requireRank(profile, 45, action);
      const actionType = clean(body.action_type || 'match', 50);
      if (!['match','split','undo','signoff','reject','exception_update','exception_resolve'].includes(actionType)) throw new HttpError(400, 'Unsupported reconciliation action.');
      const bankRowId = clean(body.reconciliation_item_id || body.bank_row_id, 80);
      const splitRows = arrayValue(body.split_rows || body.split_json).map((row) => objectValue(row));
      if (actionType !== 'undo' && !isUuid(bankRowId)) throw new HttpError(400, 'A promoted reconciliation item ID is required.');
      if (actionType === 'split' && splitRows.length < 2) throw new HttpError(400, 'Split actions require at least two allocations.');
      if (['exception_update','exception_resolve'].includes(actionType)) {
        const item = await resolveReconItem(supabase, bankRowId);
        if (!item) throw new HttpError(404, 'Promoted reconciliation row was not found.');
        const severity = clean(body.exception_severity || 'medium', 30).toLowerCase();
        const category = clean(body.exception_category || 'manual_accounting_review', 80).toLowerCase();
        if (!RECON_EXCEPTION_SEVERITIES.has(severity)) throw new HttpError(400, 'Exception severity must be low, medium, high, or critical.');
        if (!RECON_EXCEPTION_CATEGORIES.has(category)) throw new HttpError(400, 'Unsupported reconciliation exception category.');
        const ownerProfileId = isUuid(body.owner_profile_id) ? clean(body.owner_profile_id,80) : profile.id;
        const evidenceReference = clean(body.evidence_reference, 1000);
        if (evidenceReference.length < 3) throw new HttpError(400, 'Evidence reference is required for reconciliation exception work.');
        const resolutionReason = clean(body.resolution_reason || body.signoff_note, 1000);
        const resolved = actionType === 'exception_resolve';
        if (resolved && resolutionReason.length < 8) throw new HttpError(400, 'Resolved reconciliation exceptions require a clear resolution reason of at least 8 characters.');
        const material = ['high','critical'].includes(severity) || Math.abs(money(item.amount)) >= 1000;
        const reviewMetadata = {
          build: RECONCILIATION_EXCEPTION_BUILD,
          severity,
          category,
          owner_profile_id: ownerProfileId,
          evidence_reference: evidenceReference,
          resolution_reason: resolutionReason || null,
          resolution_status: resolved ? 'resolved' : 'open',
          material,
          finance_readiness_blocker: !resolved && material,
          month_end_close_blocker: !resolved && material,
          updated_by_profile_id: profile.id,
          updated_at: nowIso(),
          posting_execution_authorized: false,
          provider_mutation: false
        };
        const { data, error } = await supabase.from('bank_reconciliation_items').update({
          manual_review_status: resolved ? 'approved' : 'exception',
          reviewed_by_profile_id: ownerProfileId,
          reviewed_at: nowIso(),
          review_notes: JSON.stringify(reviewMetadata),
          difference_reason: resolved ? (resolutionReason || item.difference_reason) : (clean(body.exception_summary,1000) || item.difference_reason || `Open ${category.replaceAll('_',' ')} exception.`),
          updated_at: nowIso()
        }).eq('id', item.id).select('*').single();
        if (error) throw error;
        await audit(supabase, {
          operation_action: action,
          operation_status: resolved ? 'exception_resolved' : 'exception_updated',
          entity_type: 'bank_reconciliation_item',
          entity_id: item.id,
          actor_profile_id: profile.id,
          request_payload: safeRequest(body),
          response_payload: { build:RECONCILIATION_EXCEPTION_BUILD, severity, category, owner_profile_id:ownerProfileId, material, resolved, posting_execution_authorized:false, provider_mutation:false }
        });
        return Response.json({
          ok:true,
          record:data,
          exception:reconciliationExceptionView(data, new Map([[String(profile.id), profile]])),
          posting_execution_authorized:false,
          provider_mutation:false,
          build:RECONCILIATION_EXCEPTION_BUILD
        }, { headers:corsHeaders });
      }
      const reconResult = await callRpc(supabase, 'ywi_rpc_apply_reconciliation_action', {
        p_payload: { ...safeRequest(body), action_type: actionType, bank_row_id: bankRowId, reconciliation_item_id: bankRowId, split_rows: splitRows },
        p_actor_profile_id: profile.id
      });
      await audit(supabase, { operation_action: action, operation_status: actionType, entity_type: 'reconciliation_action_request', entity_id: reconResult?.record?.id, actor_profile_id: profile.id, request_payload: safeRequest(body), response_payload: { rpc: 'ywi_rpc_apply_reconciliation_action', result: reconResult } });
      return Response.json({ ok: true, record: reconResult.record || reconResult, rpc: reconResult, match_explanation: reconResult?.record?.match_explanation || {} }, { headers: corsHeaders });
    }

    if (action === 'equipment_scan_event') {
      requireRank(profile, 30, action);
      const scanCode = clean(body.scan_code || body.equipment_reference, 180);
      if (!scanCode) throw new HttpError(400, 'Scan code or equipment reference is required.');
      const resolved = await resolveEquipment(supabase, scanCode);
      const jobRef = clean(body.job_reference, 180);
      const job = await resolveJob(supabase, jobRef);
      const serviceRequired = body.service_required === true || ['failed','damaged','service required','repair'].some((word) => normalize(body.condition_summary).includes(word));
      const costRecoveryRequired = body.cost_recovery_required === true;
      const resolutionStatus = resolved.type === 'unresolved' ? 'unresolved' : 'resolved';
      const resolvedName = resolved.item?.equipment_name || resolved.master?.item_name || null;
      const resolvedStatus = resolved.item?.status || (resolved.master ? (resolved.master.is_active ? 'active' : 'inactive') : null);
      const { data: scan, error: scanError } = await supabase.from('equipment_scan_events').insert({
        scan_code: scanCode, scan_source: clean(body.scan_source || 'manual', 80), scan_stage: clean(body.scan_stage || 'field_check', 80),
        scan_status: resolutionStatus === 'resolved' ? 'captured' : 'needs_review', equipment_reference: clean(body.equipment_reference || scanCode, 180),
        equipment_item_id: resolved.item?.id || null, equipment_master_id: resolved.master?.id || null, resolution_status: resolutionStatus,
        resolved_equipment_name: resolvedName, resolved_equipment_status: resolvedStatus, job_reference: job?.job_code || jobRef || null,
        actor_profile_id: profile.id, location_hint: clean(body.location_hint, 240) || null, notes: clean(body.notes, 1000) || null,
        metadata: { build: BUILD, schema: SCHEMA, source: 'operations-cockpit' }
      }).select('*').single();
      if (scanError) throw scanError;
      let serviceTask: any = null;
      if (serviceRequired && resolved.item?.id) {
        const { data, error } = await supabase.from('equipment_service_tasks').insert({
          equipment_item_id: resolved.item.id, job_id: job?.id || null,
          task_type: clean(body.task_type || (clean(body.scan_stage) === 'site_arrival' ? 'arrival_test_followup' : 'return_test_followup'), 80),
          task_status: 'open', priority: clean(body.priority || 'high', 40),
          failure_reason: clean(body.condition_summary || body.notes, 1000) || 'Failed custody/return inspection.',
          estimated_cost: money(body.estimated_cost), assigned_to_profile_id: isUuid(body.assigned_to_profile_id) ? body.assigned_to_profile_id : null,
          due_at: clean(body.service_due_at, 80) || null, notes: `Created from custody scan ${scan.id}. ${clean(body.notes, 700)}`,
          created_by_profile_id: profile.id
        }).select('*').single();
        if (error) throw error;
        serviceTask = data;
        await supabase.from('equipment_items').update({ status: 'maintenance', defect_status: 'open', defect_notes: clean(body.condition_summary || body.notes, 1000), is_locked_out: true, locked_out_at: nowIso(), locked_out_by_profile_id: profile.id, lockout_reason: 'Failed custody/return inspection', updated_at: nowIso() }).eq('id', resolved.item.id);
      }
      const { data: custody, error: custodyError } = await supabase.from('equipment_custody_timeline_events').insert({
        equipment_reference: resolved.item?.equipment_code || resolved.master?.equipment_code || scanCode,
        equipment_item_id: resolved.item?.id || null, equipment_master_id: resolved.master?.id || null, job_id: job?.id || null,
        custody_stage: clean(body.custody_stage || body.scan_stage || 'field_check', 80), custody_status: resolutionStatus === 'resolved' ? 'captured' : 'needs_review',
        job_reference: job?.job_code || jobRef || null, condition_summary: clean(body.condition_summary, 1000) || null,
        accessory_summary: clean(body.accessory_summary, 1000) || null, signer_name: clean(body.signer_name, 180) || null,
        actor_profile_id: profile.id, scan_event_id: scan.id, service_required: serviceRequired,
        cost_recovery_required: costRecoveryRequired, service_task_id: serviceTask?.id || null,
        notes: clean(body.notes, 1000) || null, metadata: { build: BUILD, schema: SCHEMA, source: 'operations-manage' }
      }).select('*').single();
      if (custodyError) throw custodyError;
      let recovery: any = null;
      if (costRecoveryRequired || serviceTask) {
        const estimatedCost = money(body.estimated_cost || serviceTask?.estimated_cost);
        const { data, error } = await supabase.from('equipment_cost_recovery_actions').insert({
          custody_event_id: custody.id, service_task_id: serviceTask?.id || null, equipment_item_id: resolved.item?.id || null,
          equipment_master_id: resolved.master?.id || null, job_id: job?.id || null, action_status: 'review', recovery_decision: 'pending',
          estimated_cost: estimatedCost, recoverable_amount: body.customer_billable === true ? estimatedCost : 0,
          customer_billable: body.customer_billable === true, created_by_profile_id: profile.id
        }).select('*').single();
        if (error) throw error;
        recovery = data;
        await supabase.from('equipment_custody_timeline_events').update({ cost_recovery_action_id: recovery.id }).eq('id', custody.id);
      }
      await audit(supabase, { operation_action: action, operation_status: resolutionStatus, entity_type: 'equipment_scan_event', entity_id: scan.id, actor_profile_id: profile.id, request_payload: safeRequest(body), response_payload: { custody_id: custody.id, service_task_id: serviceTask?.id || null, cost_recovery_action_id: recovery?.id || null } });
      return Response.json({ ok: true, scan, custody, resolution: { status: resolutionStatus, equipment: resolvedName, equipment_status: resolvedStatus, job: job?.job_code || null }, service_task: serviceTask, cost_recovery: recovery }, { headers: corsHeaders });
    }

    if (action === 'equipment_cost_recovery_decision') {
      requireRank(profile, 45, action);
      const recoveryId = clean(body.recovery_id, 80);
      if (!isUuid(recoveryId)) throw new HttpError(400, 'Valid recovery_id is required.');
      const decision = clean(body.decision, 40);
      if (!['approve','decline','resolve'].includes(decision)) throw new HttpError(400, 'Unsupported recovery decision.');
      const { data: recovery, error: readError } = await supabase.from('equipment_cost_recovery_actions').select('*').eq('id', recoveryId).single();
      if (readError) throw readError;
      let financialEventId = recovery.financial_event_id;
      const actual = money(body.actual_cost || recovery.actual_cost || recovery.estimated_cost);
      const recoverable = money(body.recoverable_amount || recovery.recoverable_amount || (recovery.customer_billable ? actual : 0));
      if (decision === 'approve' && recovery.job_id && !financialEventId) {
        const { data, error } = await supabase.from('job_financial_events').insert({
          job_id: recovery.job_id, event_date: today(), event_type: 'equipment_repair', cost_amount: actual,
          revenue_amount: recovery.customer_billable ? recoverable : 0, is_billable: recovery.customer_billable,
          reference_number: `ECR-${recovery.id.slice(0,8)}`, notes: clean(body.decision_note, 1000) || 'Approved equipment cost-recovery action.',
          created_by_profile_id: profile.id
        }).select('*').single();
        if (error) throw error;
        financialEventId = data.id;
      }
      const { data, error } = await supabase.from('equipment_cost_recovery_actions').update({
        action_status: decision === 'resolve' || decision === 'decline' ? 'resolved' : 'approved', recovery_decision: decision,
        actual_cost: actual, recoverable_amount: recoverable, financial_event_id: financialEventId || null,
        decision_note: clean(body.decision_note, 1000) || null, decided_by_profile_id: profile.id, decided_at: nowIso(), updated_at: nowIso()
      }).eq('id', recoveryId).select('*').single();
      if (error) throw error;
      return Response.json({ ok: true, record: data }, { headers: corsHeaders });
    }

    if (action === 'visual_asset_register' || action === 'visual_asset_decision') {
      requireRank(profile, 45, action);
      const deciding = action === 'visual_asset_decision';
      const assetId = clean(body.asset_id, 80);
      if (deciding && !isUuid(assetId)) throw new HttpError(400, 'Valid asset_id is required.');
      const status = clean(body.asset_status || body.decision || 'draft', 80);
      if (!['draft','review','approved','rejected','archived'].includes(status)) throw new HttpError(400, 'Unsupported asset status.');
      const { data: existing, error: existingError } = deciding
        ? await supabase.from('visual_asset_approval_items').select('*').eq('id', assetId).single()
        : { data:null, error:null };
      if (existingError) throw existingError;
      const altText = clean(body.alt_text || existing?.alt_text, 280);
      const consent = clean(body.consent_status || existing?.consent_status || 'not_required', 80);
      const compression = clean(body.compression_status || existing?.compression_status || 'pending', 80);
      const width = int(body.pixel_width ?? existing?.pixel_width, 0);
      const height = int(body.pixel_height ?? existing?.pixel_height, 0);
      let publication: Record<string, unknown> = {};
      const suppliedAssetUrl = clean(body.public_url || body.source_url, 900);
      if (suppliedAssetUrl && !safeHttpUrl(suppliedAssetUrl)) throw new HttpError(400, 'Visual source URLs must use HTTP or HTTPS.');
      let sourceUrl = safeHttpUrl(suppliedAssetUrl || existing?.public_url || existing?.source_url) || '';
      if (status === 'approved' && !sourceUrl && existing) {
        if (!['approved','not_required'].includes(consent) || !['ready','optimized'].includes(compression) || width < 800 || height < 450 || altText.length < 12) {
          throw new HttpError(409, 'Approved assets require useful alt text, consent, optimized compression, and at least 800×450 dimensions.');
        }
        publication = await publishApprovedAsset(supabase, existing);
        sourceUrl = clean(publication.public_url, 900);
      }
      const ready = !!sourceUrl && altText.length >= 12 && ['approved','not_required'].includes(consent) && ['ready','optimized'].includes(compression) && width >= 800 && height >= 450;
      if (status === 'approved' && !ready) throw new HttpError(409, 'Approved assets require an uploaded/linked image, useful alt text, consent, optimized compression, and at least 800×450 dimensions.');
      const readiness = [!!sourceUrl, altText.length >= 12, ['approved','not_required'].includes(consent), ['ready','optimized'].includes(compression), width >= 800 && height >= 450].filter(Boolean).length * 20;
      const payload: Record<string, unknown> = {
        asset_status: status, surface_area: clean(body.surface_area || existing?.surface_area || 'public', 120), image_role: clean(body.image_role || existing?.image_role || 'placeholder_replacement', 120),
        source_url: sourceUrl || null, public_url: sourceUrl || null,
        thumbnail_url: clean(body.thumbnail_url || publication.thumbnail_url || existing?.thumbnail_url, 900) || null, alt_text: altText || null, consent_status: consent, compression_status: compression,
        route_key: clean(body.route_key || existing?.route_key, 120) || null, pixel_width: width || null, pixel_height: height || null,
        thumbnail_width: int(body.thumbnail_width ?? existing?.thumbnail_width, 0) || null, thumbnail_height: int(body.thumbnail_height ?? existing?.thumbnail_height, 0) || null,
        file_size_bytes: int(body.file_size_bytes ?? existing?.file_size_bytes, 0) || null, mime_type: clean(body.mime_type || existing?.mime_type, 120) || null,
        original_file_name: clean(body.original_file_name || existing?.original_file_name, 260) || null, storage_bucket: clean(body.storage_bucket || existing?.storage_bucket, 120) || null,
        storage_path: clean(body.storage_path || existing?.storage_path, 500) || null, thumbnail_path: clean(body.thumbnail_path || existing?.thumbnail_path, 500) || null,
        review_storage_bucket: clean(existing?.review_storage_bucket || existing?.storage_bucket,120) || null,
        review_storage_path: clean(existing?.review_storage_path || existing?.storage_path,500) || null,
        review_thumbnail_path: clean(existing?.review_thumbnail_path || existing?.thumbnail_path,500) || null,
        checksum_sha256: clean(body.checksum_sha256 || existing?.checksum_sha256, 128) || null, placeholder_selector: clean(body.placeholder_selector || existing?.placeholder_selector, 240) || null,
        replacement_status: clean(body.replacement_status || existing?.replacement_status || 'not_replaced', 80), notes: clean(body.notes || existing?.notes, 1000) || null,
        rejection_reason: status === 'rejected' ? clean(body.rejection_reason || body.notes, 1000) || 'Rejected during review.' : null,
        approved_by_profile_id: status === 'approved' ? profile.id : existing?.approved_by_profile_id || null, approved_at: status === 'approved' ? nowIso() : existing?.approved_at || null,
        readiness_score: readiness, metadata: { build: BUILD, schema: SCHEMA, source: 'operations-manage', review_asset_promoted: Boolean(publication.public_url) }, updated_at: nowIso(), ...publication
      };
      const query = deciding ? supabase.from('visual_asset_approval_items').update(payload).eq('id', assetId) : supabase.from('visual_asset_approval_items').insert(payload);
      const { data, error } = await query.select('*').single();
      if (error) throw error;
      await audit(supabase, { operation_action: action, operation_status: status, entity_type: 'visual_asset_approval_item', entity_id: data.id, actor_profile_id: profile.id, request_payload: safeRequest(body), response_payload: { readiness_score: readiness, promoted_public_copy:Boolean(publication.public_url) } });
      return Response.json({ ok: true, record: data, publication }, { headers: corsHeaders });
    }

    if (action === 'public_route_register' || action === 'public_route_decision' || action === 'public_route_publish') {
      requireRank(profile, 45, action);
      if (action === 'public_route_publish') {
        const routeId = clean(body.route_id, 80);
        if (!isUuid(routeId)) throw new HttpError(400, 'Valid route_id is required.');
        const { data: route, error: routeError } = await supabase.from('v_public_route_publication_readiness').select('*').eq('id', routeId).single();
        if (routeError) throw routeError;
        if (!route.publication_ready) throw new HttpError(409, 'Route publication is blocked until SEO fields and an approved visual are ready.', route.validation_json);
        const canonicalBase = safeHttpUrl(Deno.env.get('PUBLIC_SITE_URL') || Deno.env.get('SITE_URL') || '');
        const canonical = safeHttpUrl(route.canonical_url) || (canonicalBase ? new URL(route.route_path, canonicalBase).href : null);
        if (!canonical) throw new HttpError(409, 'A valid HTTP(S) canonical URL or PUBLIC_SITE_URL is required before publication.');
        const generated = { route_key: route.route_key, route_path: route.route_path, title: route.page_title, h1: route.h1_text, meta_description: route.meta_description, intro: route.page_intro, local_proof: route.local_proof_hint, cta: route.primary_cta_path, visual_asset_key: route.visual_asset_key, build: BUILD, schema: SCHEMA };
        const { data: sitemap, error: sitemapError } = await supabase.from('public_sitemap_entries').upsert({ route_id: route.id, route_path: route.route_path, canonical_url: canonical, last_modified: today(), change_frequency: clean(body.change_frequency || 'monthly', 30), priority: money(body.priority || 0.7), entry_status: 'active', updated_at: nowIso() }, { onConflict: 'route_path' }).select('*').single();
        if (sitemapError) throw sitemapError;
        const { data, error } = await supabase.from('public_route_approval_items').update({ published_at: nowIso(), published_by_profile_id: profile.id, canonical_url: canonical, sitemap_entry_id: sitemap.id, generated_page_json: generated, sitemap_ready: true, updated_at: nowIso() }).eq('id', route.id).select('*').single();
        if (error) throw error;
        return Response.json({ ok: true, record: data, sitemap_entry: sitemap, generated_page: generated }, { headers: corsHeaders });
      }
      const routeKey = clean(body.route_key, 120) || clean(body.route_path, 120).replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '').toLowerCase();
      if (!routeKey) throw new HttpError(400, 'route_key or route_path is required.');
      const status = clean(body.route_status || body.decision || 'draft', 80);
      if (!['draft','review','approved','rejected','archived'].includes(status)) throw new HttpError(400, 'Unsupported route status.');
      const title = clean(body.page_title, 180); const h1 = clean(body.h1_text, 180); const meta = clean(body.meta_description, 320);
      const proof = clean(body.local_proof_hint, 1000); const cta = clean(body.primary_cta_path, 240);
      const pathCheck = safePublicPath(body.route_path || '/');
      const path = pathCheck.routePath;
      const canonicalInput = clean(body.canonical_url, 600);
      const validation = {
        title_ok: title.length >= 20 && title.length <= 70, h1_ok: h1.length >= 10 && h1.length <= 120,
        meta_ok: meta.length >= 70 && meta.length <= 170, local_proof_ok: proof.length >= 20,
        cta_ok: cta.startsWith('/') || cta.startsWith('#'), path_ok: pathCheck.valid,
        canonical_ok: !canonicalInput || !!safeHttpUrl(canonicalInput)
      };
      const readiness = Math.round(Object.values(validation).filter(Boolean).length / Object.keys(validation).length * 100);
      if (status === 'approved' && readiness < 100) throw new HttpError(409, 'Route cannot be approved until all title, H1, meta, local proof, CTA, and clean-path checks pass.', validation);
      const { data, error } = await supabase.from('public_route_approval_items').upsert({
        route_key: routeKey, route_status: status, route_type: clean(body.route_type || 'service', 80), route_path: path,
        service_name: clean(body.service_name, 180) || null, location_name: clean(body.location_name, 180) || null,
        page_title: title || 'Page title required', h1_text: h1 || 'Main heading required', meta_description: meta || null,
        page_intro: clean(body.page_intro, 1200) || null, page_body_markdown: clean(body.page_body_markdown, 10000) || null,
        page_body_html: clean(body.page_body_html, 20000) || null, local_proof_hint: proof || null,
        primary_cta_path: cta || null, visual_asset_key: clean(body.visual_asset_key, 160) || null,
        canonical_url: safeHttpUrl(body.canonical_url), sitemap_ready: status === 'approved' && readiness === 100 && body.sitemap_ready !== false,
        approved_by_profile_id: status === 'approved' ? profile.id : null, approved_at: status === 'approved' ? nowIso() : null,
        rejection_reason: status === 'rejected' ? clean(body.rejection_reason, 1000) || 'Rejected during review.' : null,
        seo_readiness_score: readiness, validation_json: validation, metadata: { build: BUILD, schema: SCHEMA, source: 'operations-manage' }, updated_at: nowIso()
      }, { onConflict: 'route_key' }).select('*').single();
      if (error) throw error;
      await audit(supabase, { operation_action: action, operation_status: status, entity_type: 'public_route_approval_item', entity_id: data.id, actor_profile_id: profile.id, request_payload: safeRequest(body), response_payload: { readiness_score: readiness, validation } });
      return Response.json({ ok: true, record: data, validation }, { headers: corsHeaders });
    }

    if (action === 'quote_owner_assign' || action === 'quote_followup_event') {
      requireRank(profile, 45, action);
      const requestId = clean(body.request_id, 80);
      if (!isUuid(requestId)) throw new HttpError(400, 'Valid request_id is required.');
      const ownerId = isUuid(body.assigned_to_profile_id) ? clean(body.assigned_to_profile_id, 80) : null;
      const followup = clean(body.followup_due_at, 80) || null;
      const eventType = action === 'quote_owner_assign' ? 'owner_assigned' : clean(body.event_type || 'contacted', 80);
      const note = clean(body.event_note || body.notes, 1000);
      const { data: request, error: requestError } = await supabase.from('quote_contact_requests').select('*').eq('id', requestId).single();
      if (requestError) throw requestError;
      const update: Record<string, unknown> = { updated_at: nowIso(), last_event_at: nowIso() };
      if (action === 'quote_owner_assign') {
        update.assigned_to_profile_id = ownerId; update.owner_assigned_at = nowIso(); update.owner_assigned_by_profile_id = profile.id;
        update.followup_due_at = followup; update.request_status = request.request_status === 'new' ? 'review' : request.request_status;
      } else {
        update.last_contacted_at = nowIso(); update.first_response_at = request.first_response_at || nowIso(); update.response_status = clean(body.response_status || 'responded', 80);
        update.request_status = clean(body.request_status || 'contacted', 80); if (followup) update.followup_due_at = followup;
      }
      const { data, error } = await supabase.from('quote_contact_requests').update(update).eq('id', requestId).select('*').single();
      if (error) throw error;
      await supabase.from('quote_contact_request_events').insert({ request_id: requestId, event_type: eventType, event_note: note || null, actor_profile_id: profile.id, metadata: { build: BUILD, schema: SCHEMA, owner_id: ownerId, followup_due_at: followup } });
      await supabase.from('quote_followup_alerts').update({ alert_status: 'superseded', updated_at: nowIso() }).eq('request_id', requestId).eq('alert_status', 'open');
      if (followup) await supabase.from('quote_followup_alerts').insert({ request_id: requestId, alert_type: 'followup_due', alert_status: 'open', due_at: followup, assigned_to_profile_id: ownerId || data.assigned_to_profile_id, alert_message: note || `Follow up with ${data.full_name}.`, delivery_channels: ['in_app','email'] });
      const targetOwnerId = ownerId || data.assigned_to_profile_id || null;
      const ownerRows = targetOwnerId ? await safeSelect(supabase.from('profiles').select('id,email,full_name').eq('id', targetOwnerId).limit(1)) : [];
      const owner = ownerRows[0] || null;
      const alertTitle = action === 'quote_owner_assign' ? `Quote request assigned: ${data.full_name}` : `Quote follow-up updated: ${data.full_name}`;
      await createAdminNotification(supabase, {
        notification_type: followup ? 'quote_followup_due' : 'quote_owner_assigned', recipient_role:'admin',
        target_profile_id:targetOwnerId, target_table:'quote_contact_requests', target_id:requestId,
        title:alertTitle,
        body:`${data.full_name} · ${data.service_type || 'Service request'}${followup ? ` · follow up by ${followup}` : ''}${note ? ` · ${note}` : ''}`,
        email_to:owner?.email || null, email_subject:alertTitle, created_by_profile_id:profile.id,
        payload:{ request_id:requestId, assigned_to_profile_id:targetOwnerId, followup_due_at:followup, event_type:eventType, build:BUILD, schema:SCHEMA }
      });
      return Response.json({ ok: true, record: data }, { headers: corsHeaders });
    }

    if (action === 'landscape_production_session_save') {
      requireRank(profile,20,action);
      const id=isUuid(body.id)?clean(body.id,80):null;
      const workOrderId=isUuid(body.work_order_id)?clean(body.work_order_id,80):null;
      if(!id && !workOrderId) throw new HttpError(400,'Choose a work order before creating a production session.');
      const crewHour=objectValue(body.crew_hour);
      const payload:any={
        id,work_order_id:workOrderId,
        dispatch_schedule_item_id:isUuid(body.dispatch_schedule_item_id)?clean(body.dispatch_schedule_item_id,80):null,
        session_date:clean(body.session_date,30)||null,
        session_kind:clean(body.session_kind || 'field_service',60),
        session_status:clean(body.session_status || 'planned',40).toLowerCase(),
        service_frequency_label:clean(body.service_frequency_label,160)||null,
        scheduled_start_at:clean(body.scheduled_start_at,80)||null,
        started_at:clean(body.started_at,80)||null,
        ended_at:clean(body.ended_at,80)||null,
        delay_minutes:Math.max(0,int(body.delay_minutes,0)),
        notes:clean(body.notes,3000)||null,
        site_supervisor_profile_id:isUuid(body.site_supervisor_profile_id)?clean(body.site_supervisor_profile_id,80):null,
        workability_status:clean(body.workability_status || 'not_recorded',40).toLowerCase(),
        weather_summary:clean(body.weather_summary,1200)||null,
        delay_reason:clean(body.delay_reason,1200)||null,
        completion_state:clean(body.completion_state || 'open',40).toLowerCase(),
        unfinished_work_notes:clean(body.unfinished_work_notes,2500)||null,
        return_visit_required:body.return_visit_required===true || String(body.return_visit_required).toLowerCase()==='true',
        return_visit_reason:clean(body.return_visit_reason,2000)||null,
        customer_site_issue_notes:clean(body.customer_site_issue_notes,2500)||null,
        production_notes:clean(body.production_notes,3000)||null,
        material_issue_id:isUuid(body.material_issue_id)?clean(body.material_issue_id,80):null,
        equipment_signout_id:body.equipment_signout_id===''||body.equipment_signout_id==null?null:String(body.equipment_signout_id),
        execution_proof_id:isUuid(body.execution_proof_id)?clean(body.execution_proof_id,80):null,
        live_update_id:isUuid(body.live_update_id)?clean(body.live_update_id,80):null,
        crew_hour:Object.keys(crewHour).length ? {
          id:isUuid(crewHour.id)?clean(crewHour.id,80):null,
          crew_id:isUuid(crewHour.crew_id)?clean(crewHour.crew_id,80):null,
          profile_id:isUuid(crewHour.profile_id)?clean(crewHour.profile_id,80):null,
          worker_name:clean(crewHour.worker_name,220)||null,
          started_at:clean(crewHour.started_at,80)||null,
          ended_at:clean(crewHour.ended_at,80)||null,
          hours_worked:crewHour.hours_worked===''||crewHour.hours_worked==null?null:Number(crewHour.hours_worked),
          regular_hours:crewHour.regular_hours===''||crewHour.regular_hours==null?null:Number(crewHour.regular_hours),
          overtime_hours:crewHour.overtime_hours===''||crewHour.overtime_hours==null?null:Number(crewHour.overtime_hours),
          break_minutes:Math.max(0,int(crewHour.break_minutes,0)),
          pay_code:clean(crewHour.pay_code || 'regular',30).toLowerCase(),
          notes:clean(crewHour.notes,1200)||null
        } : {}
      };
      const {data,error}=await supabase.rpc('ywi_rpc_landscape_production_session_save',{p_payload:payload,p_actor_profile_id:profile.id});
      if(error) throw error;
      const sessionId=clean((data as any)?.session?.job_session_id || id,80);
      await audit(supabase,{
        operation_action:action,operation_status:id?'updated':'saved',entity_type:'job_session',entity_id:sessionId,actor_profile_id:profile.id,
        request_payload:{work_order_id:workOrderId,session_status:payload.session_status,workability_status:payload.workability_status,completion_state:payload.completion_state,has_crew_hour:Object.keys(crewHour).length>0},
        response_payload:{job_session_id:sessionId,production_state:(data as any)?.session?.production_state || null}
      });
      return Response.json({ok:true,build:325,schema:214,...(data as any)},{headers:corsHeaders});
    }

    if (action === 'landscape_production_quantity_save') {
      requireRank(profile,20,action);
      const id=isUuid(body.id)?clean(body.id,80):null;
      const sessionId=isUuid(body.job_session_id)?clean(body.job_session_id,80):null;
      if(!id && !sessionId) throw new HttpError(400,'Choose a production session before saving a quantity.');
      if(!id && !clean(body.metric_label,240)) throw new HttpError(400,'Metric label is required.');
      const payload:any={
        id,job_session_id:sessionId,
        client_site_zone_id:isUuid(body.client_site_zone_id)?clean(body.client_site_zone_id,80):null,
        source_work_order_line_id:isUuid(body.source_work_order_line_id)?clean(body.source_work_order_line_id,80):null,
        source_estimate_assumption_id:isUuid(body.source_estimate_assumption_id)?clean(body.source_estimate_assumption_id,80):null,
        record_type:clean(body.record_type || 'production',30).toLowerCase(),
        activity_type:clean(body.activity_type || 'other',40).toLowerCase(),
        metric_label:clean(body.metric_label,240)||null,
        planned_quantity:body.planned_quantity===''||body.planned_quantity==null?null:Number(body.planned_quantity),
        actual_quantity:body.actual_quantity===''||body.actual_quantity==null?0:Number(body.actual_quantity),
        waste_quantity:body.waste_quantity===''||body.waste_quantity==null?0:Number(body.waste_quantity),
        disposal_quantity:body.disposal_quantity===''||body.disposal_quantity==null?0:Number(body.disposal_quantity),
        unit_label:clean(body.unit_label,80)||null,
        completion_percent:body.completion_percent===''||body.completion_percent==null?null:Number(body.completion_percent),
        disposal_destination:clean(body.disposal_destination,400)||null,
        notes:clean(body.notes,1800)||null,
        sort_order:Math.max(0,Math.min(10000,int(body.sort_order,100))),
        is_active:body.is_active!==false && String(body.is_active).toLowerCase()!=='false'
      };
      const {data,error}=await supabase.rpc('ywi_rpc_landscape_production_quantity_save',{p_payload:payload,p_actor_profile_id:profile.id});
      if(error) throw error;
      await audit(supabase,{
        operation_action:action,operation_status:id?'updated':'saved',entity_type:'job_session_production_quantity',entity_id:clean((data as any)?.id,80),actor_profile_id:profile.id,
        request_payload:{job_session_id:sessionId,record_type:payload.record_type,activity_type:payload.activity_type,actual_quantity:payload.actual_quantity},
        response_payload:{production_quantity_id:(data as any)?.id || null,work_order_id:(data as any)?.work_order_id || null}
      });
      return Response.json({ok:true,build:325,schema:214,record:data},{headers:corsHeaders});
    }

    if (action === 'estimate_workflow_save') {
      requireRank(profile,45,action);
      const id=isUuid(body.id) ? clean(body.id,80) : null;
      const clientId=isUuid(body.client_id) ? clean(body.client_id,80) : null;
      if(!id && !clientId) throw new HttpError(400,'Choose a customer before creating an estimate.');
      const statusValue=clean(body.status || 'draft',40).toLowerCase();
      if(!['draft','sent','accepted','declined','expired','cancelled','approved'].includes(statusValue)) throw new HttpError(400,'Unsupported estimate status.');
      const assumption=objectValue(body.assumption);
      if(Object.keys(assumption).length && !clean(assumption.assumption_label,240)) throw new HttpError(400,'Assumption label is required.');
      const payload:any={
        id,
        client_id:clientId,
        client_site_id:isUuid(body.client_site_id)?clean(body.client_site_id,80):null,
        service_pricing_template_id:isUuid(body.service_pricing_template_id)?clean(body.service_pricing_template_id,80):null,
        estimate_number:clean(body.estimate_number,80)||null,
        estimate_type:clean(body.estimate_type || 'landscaping',60),
        status:statusValue,
        valid_until:clean(body.valid_until,20)||null,
        quote_title:clean(body.quote_title,220)||null,
        scope_notes:clean(body.scope_notes,3500)||null,
        terms_notes:clean(body.terms_notes,3500)||null,
        pricing_basis_label:clean(body.pricing_basis_label,220)||null,
        discount_mode:clean(body.discount_mode || 'none',40),
        discount_value:body.discount_value===''||body.discount_value==null?0:Number(body.discount_value),
        approval_required:body.approval_required===true || String(body.approval_required).toLowerCase()==='true',
        client_notes:clean(body.client_notes,2500)||null,
        internal_notes:clean(body.internal_notes,2500)||null,
        estimated_labour_hours:body.estimated_labour_hours===''||body.estimated_labour_hours==null?null:Number(body.estimated_labour_hours),
        assumed_crew_size:body.assumed_crew_size===''||body.assumed_crew_size==null?null:int(body.assumed_crew_size,0),
        markup_percent:body.markup_percent===''||body.markup_percent==null?null:Number(body.markup_percent),
        target_margin_percent:body.target_margin_percent===''||body.target_margin_percent==null?null:Number(body.target_margin_percent),
        deposit_required_amount:body.deposit_required_amount===''||body.deposit_required_amount==null?0:Number(body.deposit_required_amount),
        deposit_required_percent:body.deposit_required_percent===''||body.deposit_required_percent==null?0:Number(body.deposit_required_percent),
        workflow_notes:clean(body.workflow_notes,2500)||null,
        approval_notes:clean(body.approval_notes,1800)||null,
        assumption:Object.keys(assumption).length ? {
          id:isUuid(assumption.id)?clean(assumption.id,80):null,
          assumption_code:clean(assumption.assumption_code,80)||null,
          assumption_type:clean(assumption.assumption_type || 'other',40).toLowerCase(),
          assumption_label:clean(assumption.assumption_label,240),
          quantity:assumption.quantity===''||assumption.quantity==null?1:Number(assumption.quantity),
          unit_label:clean(assumption.unit_label,80)||null,
          unit_cost:assumption.unit_cost===''||assumption.unit_cost==null?0:Number(assumption.unit_cost),
          estimated_cost:assumption.estimated_cost===''||assumption.estimated_cost==null?0:Number(assumption.estimated_cost),
          estimated_charge:assumption.estimated_charge===''||assumption.estimated_charge==null?0:Number(assumption.estimated_charge),
          optional_work:assumption.optional_work===true || String(assumption.optional_work).toLowerCase()==='true',
          selected:assumption.selected!==false && String(assumption.selected).toLowerCase()!=='false',
          notes:clean(assumption.notes,1800)||null,
          sort_order:Math.max(0,Math.min(10000,int(assumption.sort_order,100))),
          is_active:assumption.is_active!==false && String(assumption.is_active).toLowerCase()!=='false'
        } : {}
      };
      const {data,error}=await supabase.rpc('ywi_rpc_estimate_workflow_save',{p_payload:payload,p_actor_profile_id:profile.id});
      if(error) throw error;
      const estimateId=clean((data as any)?.estimate?.id || id,80);
      const rows=estimateId ? await safeSelect(supabase.from('v_estimate_job_invoice_workflow').select('*').eq('estimate_id',estimateId).limit(1)) : [];
      await audit(supabase,{
        operation_action:action,operation_status:id?'updated':'created',entity_type:'estimate',entity_id:estimateId,
        actor_profile_id:profile.id,
        request_payload:{client_id:clientId,status:statusValue,approval_required:payload.approval_required,has_assumption:Object.keys(assumption).length>0},
        response_payload:{estimate_id:estimateId,workflow_stage:rows[0]?.workflow_stage || null}
      });
      return Response.json({ok:true,build:324,schema:213,record:rows[0] || (data as any)?.estimate,assumption:(data as any)?.assumption || null},{headers:corsHeaders});
    }

    if (action === 'estimate_approval_decision') {
      requireRank(profile,45,action);
      const estimateId=clean(body.estimate_id,80);
      const decision=clean(body.decision,30).toLowerCase();
      const note=clean(body.note,1800);
      if(!isUuid(estimateId)) throw new HttpError(400,'Valid estimate_id is required.');
      if(!['request','approve','reject','reopen'].includes(decision)) throw new HttpError(400,'Unsupported estimate approval decision.');
      const {data,error}=await supabase.rpc('ywi_rpc_estimate_approval_decision',{p_estimate_id:estimateId,p_actor_profile_id:profile.id,p_decision:decision,p_note:note||null});
      if(error) throw error;
      await audit(supabase,{
        operation_action:action,operation_status:decision,entity_type:'estimate',entity_id:estimateId,actor_profile_id:profile.id,
        request_payload:{decision,note:Boolean(note)},response_payload:{approval_status:(data as any)?.approval_status || null}
      });
      return Response.json({ok:true,build:324,schema:213,record:data},{headers:corsHeaders});
    }

    if (action === 'estimate_convert_work_order') {
      requireRank(profile,45,action);
      const estimateId=clean(body.estimate_id,80);
      if(!isUuid(estimateId)) throw new HttpError(400,'Valid estimate_id is required.');
      const {data,error}=await supabase.rpc('ywi_rpc_estimate_convert_work_order',{p_estimate_id:estimateId,p_actor_profile_id:profile.id});
      if(error) throw error;
      const workOrderId=clean((data as any)?.work_order?.id,80);
      await audit(supabase,{
        operation_action:action,operation_status:'converted',entity_type:'work_order',entity_id:workOrderId,actor_profile_id:profile.id,
        request_payload:{estimate_id:estimateId},response_payload:{work_order_id:workOrderId,deposit_required:(data as any)?.deposit_required,deposit_paid:(data as any)?.deposit_paid}
      });
      return Response.json({ok:true,build:324,schema:213,...(data as any)},{headers:corsHeaders});
    }

    if (action === 'change_order_save') {
      requireRank(profile,45,action);
      const id=isUuid(body.id)?clean(body.id,80):null;
      const workOrderId=isUuid(body.work_order_id)?clean(body.work_order_id,80):null;
      const statusValue=clean(body.status || 'draft',30).toLowerCase();
      const scopeSummary=clean(body.scope_summary,2500);
      const approvalReference=clean(body.customer_approval_reference,1000);
      if(!id && !workOrderId) throw new HttpError(400,'Choose a work order before creating a change order.');
      if(!id && !scopeSummary) throw new HttpError(400,'Change-order scope is required.');
      if(statusValue==='approved' && !approvalReference) throw new HttpError(400,'Customer approval evidence/reference is required before approval.');
      const payload:any={
        id,work_order_id:workOrderId,change_order_number:clean(body.change_order_number,80)||null,status:statusValue,
        scope_summary:scopeSummary||null,reason:clean(body.reason,1800)||null,
        estimated_cost_delta:body.estimated_cost_delta===''||body.estimated_cost_delta==null?0:Number(body.estimated_cost_delta),
        estimated_charge_delta:body.estimated_charge_delta===''||body.estimated_charge_delta==null?0:Number(body.estimated_charge_delta),
        actual_cost_delta:body.actual_cost_delta===''||body.actual_cost_delta==null?0:Number(body.actual_cost_delta),
        actual_charge_delta:body.actual_charge_delta===''||body.actual_charge_delta==null?0:Number(body.actual_charge_delta),
        customer_approval_reference:approvalReference||null,
        customer_approved_at:clean(body.customer_approved_at,80)||null,
        customer_approved_by_name:clean(body.customer_approved_by_name,240)||null,
        notes:clean(body.notes,2200)||null
      };
      const {data,error}=await supabase.rpc('ywi_rpc_change_order_save',{p_payload:payload,p_actor_profile_id:profile.id});
      if(error) throw error;
      const changeId=clean((data as any)?.id,80);
      await audit(supabase,{
        operation_action:action,operation_status:statusValue,entity_type:'change_order',entity_id:changeId,actor_profile_id:profile.id,
        request_payload:{work_order_id:workOrderId,status:statusValue,approval_reference:Boolean(approvalReference)},
        response_payload:{change_order_id:changeId,change_order_number:(data as any)?.change_order_number || null}
      });
      return Response.json({ok:true,build:324,schema:213,record:data},{headers:corsHeaders});
    }

    if (action === 'property_site_save') {
      requireRank(profile,45,action);
      const id=isUuid(body.id) ? clean(body.id,80) : null;
      const clientId=isUuid(body.client_id) ? clean(body.client_id,80) : null;
      const siteName=clean(body.site_name,180);
      if(!id && !clientId) throw new HttpError(400,'Choose a customer before creating a property.');
      if(!id && !siteName) throw new HttpError(400,'Property/site name is required.');
      const area=body.approximate_serviceable_area === '' || body.approximate_serviceable_area == null ? null : Number(body.approximate_serviceable_area);
      if(area!==null && (!Number.isFinite(area) || area<0)) throw new HttpError(400,'Approximate serviceable area must be zero or greater.');
      const areaUnit=clean(body.area_unit || 'sq_ft',20).toLowerCase();
      if(!['sq_ft','sq_m','acre','hectare'].includes(areaUnit)) throw new HttpError(400,'Unsupported property area unit.');
      const payload:any={
        id,
        client_id:clientId,
        legacy_site_id:isUuid(body.legacy_site_id) ? clean(body.legacy_site_id,80) : null,
        site_code:clean(body.site_code,80) || null,
        site_name:siteName || null,
        service_address:clean(body.service_address,400) || null,
        city:clean(body.city,120) || null,
        province:clean(body.province,80) || null,
        postal_code:clean(body.postal_code,30) || null,
        latitude:body.latitude === '' || body.latitude == null ? null : Number(body.latitude),
        longitude:body.longitude === '' || body.longitude == null ? null : Number(body.longitude),
        access_notes:clean(body.access_notes,2500) || null,
        hazard_notes:clean(body.hazard_notes,2500) || null,
        is_active:body.is_active !== false && String(body.is_active).toLowerCase()!=='false',
        approximate_serviceable_area:area,
        area_unit:areaUnit,
        gate_fence_summary:clean(body.gate_fence_summary,1800) || null,
        parking_trailer_limits:clean(body.parking_trailer_limits,1800) || null,
        pet_notes:clean(body.pet_notes,1800) || null,
        irrigation_notes:clean(body.irrigation_notes,1800) || null,
        slope_notes:clean(body.slope_notes,1800) || null,
        drainage_wet_area_notes:clean(body.drainage_wet_area_notes,1800) || null,
        utility_locate_notes:clean(body.utility_locate_notes,1800) || null,
        tree_brush_notes:clean(body.tree_brush_notes,1800) || null,
        recurring_property_instructions:clean(body.recurring_property_instructions,3000) || null,
        verify_access_now:body.verify_access_now===true || String(body.verify_access_now).toLowerCase()==='true'
      };
      const {data,error}=await supabase.rpc('ywi_rpc_property_site_save',{p_payload:payload,p_actor_profile_id:profile.id});
      if(error) throw error;
      const propertyId=clean((data as any)?.id,80);
      const rows=propertyId ? await safeSelect(supabase.from('v_property_site_intelligence').select('*').eq('id',propertyId).limit(1)) : [];
      await audit(supabase,{
        operation_action:action,operation_status:id?'updated':'created',entity_type:'client_site',entity_id:propertyId,
        actor_profile_id:profile.id,request_payload:{client_id:clientId,site_name:siteName,verify_access_now:payload.verify_access_now},
        response_payload:{property_id:propertyId,site_code:(data as any)?.site_code || null}
      });
      return Response.json({ok:true,build:323,schema:212,record:rows[0] || data},{headers:corsHeaders});
    }

    if (action === 'property_zone_save') {
      requireRank(profile,45,action);
      const id=isUuid(body.id) ? clean(body.id,80) : null;
      const siteId=isUuid(body.client_site_id) ? clean(body.client_site_id,80) : null;
      const zoneName=clean(body.zone_name,180);
      const zoneType=clean(body.zone_type || 'other',40).toLowerCase();
      const areaUnit=clean(body.area_unit || 'sq_ft',20).toLowerCase();
      const priority=clean(body.service_priority || 'normal',30).toLowerCase();
      const area=body.approximate_area === '' || body.approximate_area == null ? null : Number(body.approximate_area);
      if(!id && !siteId) throw new HttpError(400,'Choose a property before creating a zone.');
      if(!id && !zoneName) throw new HttpError(400,'Zone name is required.');
      if(!['lawn','garden_bed','hedge_shrub','tree_brush','driveway_parking','access','utility','drainage','other'].includes(zoneType)) throw new HttpError(400,'Unsupported zone type.');
      if(!['sq_ft','sq_m','acre','hectare'].includes(areaUnit)) throw new HttpError(400,'Unsupported zone area unit.');
      if(!['low','normal','high','restricted'].includes(priority)) throw new HttpError(400,'Unsupported zone service priority.');
      if(area!==null && (!Number.isFinite(area) || area<0)) throw new HttpError(400,'Zone area must be zero or greater.');
      const payload:any={
        id,client_site_id:siteId,zone_code:clean(body.zone_code,80) || null,zone_name:zoneName || null,
        zone_type:zoneType,approximate_area:area,area_unit:areaUnit,service_priority:priority,
        access_instructions:clean(body.access_instructions,1800) || null,
        irrigation_notes:clean(body.irrigation_notes,1800) || null,
        slope_notes:clean(body.slope_notes,1800) || null,
        drainage_wet_area_notes:clean(body.drainage_wet_area_notes,1800) || null,
        hazard_notes:clean(body.hazard_notes,1800) || null,
        utility_locate_notes:clean(body.utility_locate_notes,1800) || null,
        tree_brush_notes:clean(body.tree_brush_notes,1800) || null,
        recurring_instructions:clean(body.recurring_instructions,2400) || null,
        is_active:body.is_active !== false && String(body.is_active).toLowerCase()!=='false',
        sort_order:Math.max(0,Math.min(10000,int(body.sort_order,100)))
      };
      const {data,error}=await supabase.rpc('ywi_rpc_property_zone_save',{p_payload:payload,p_actor_profile_id:profile.id});
      if(error) throw error;
      const zoneId=clean((data as any)?.id,80);
      await audit(supabase,{
        operation_action:action,operation_status:id?'updated':'created',entity_type:'client_site_zone',entity_id:zoneId,
        actor_profile_id:profile.id,request_payload:{client_site_id:siteId,zone_name:zoneName,zone_type:zoneType},
        response_payload:{zone_id:zoneId}
      });
      return Response.json({ok:true,build:323,schema:212,record:data},{headers:corsHeaders});
    }

    if (action === 'property_photo_register') {
      requireRank(profile,45,action);
      const id=isUuid(body.id) ? clean(body.id,80) : null;
      const siteId=isUuid(body.client_site_id) ? clean(body.client_site_id,80) : null;
      const zoneId=isUuid(body.zone_id) ? clean(body.zone_id,80) : null;
      const kind=clean(body.photo_kind || 'overview',40).toLowerCase();
      if(!['overview','access','gate_fence','parking_trailer','pet','irrigation','slope_drainage','hazard','utility_locate','tree_brush','zone','other'].includes(kind)) throw new HttpError(400,'Unsupported property photo kind.');
      const rawUrl=clean(body.source_url,1200);
      const sourceUrl=rawUrl ? safeHttpUrl(rawUrl) : null;
      if(rawUrl && !sourceUrl) throw new HttpError(400,'Property photo URL must use http or https.');
      const storageBucket=clean(body.storage_bucket,180) || null;
      const storagePath=clean(body.storage_path,800) || null;
      if(!id && !siteId) throw new HttpError(400,'Choose a property before registering a photo.');
      if(!id && !sourceUrl && !(storageBucket && storagePath)) throw new HttpError(400,'Provide a photo URL or private storage bucket/path.');
      const payload:any={
        id,client_site_id:siteId,zone_id:zoneId,photo_kind:kind,source_url:sourceUrl,
        storage_bucket:storageBucket,storage_path:storagePath,caption:clean(body.caption,1200) || null,
        captured_at:clean(body.captured_at,80) || null,
        is_active:body.is_active !== false && String(body.is_active).toLowerCase()!=='false',
        metadata:{build:323,schema:212,source:'operations-manage'}
      };
      const {data,error}=await supabase.rpc('ywi_rpc_property_photo_register',{p_payload:payload,p_actor_profile_id:profile.id});
      if(error) throw error;
      const photoId=clean((data as any)?.id,80);
      await audit(supabase,{
        operation_action:action,operation_status:id?'updated':'registered',entity_type:'client_site_photo',entity_id:photoId,
        actor_profile_id:profile.id,request_payload:{client_site_id:siteId,zone_id:zoneId,photo_kind:kind,reference_type:storageBucket&&storagePath?'storage_reference':'url_reference'},
        response_payload:{photo_id:photoId}
      });
      return Response.json({ok:true,build:323,schema:212,record:data},{headers:corsHeaders});
    }

    if (action === 'recurring_service_program_save') {
      requireRank(profile,45,action);
      const serviceName=clean(body.service_name,180);
      const agreementStatus=clean(body.agreement_status || 'draft',40).toLowerCase();
      const programType=clean(body.service_program_type || 'other',60).toLowerCase();
      const frequency=clean(body.recurrence_frequency || 'weekly',40).toLowerCase();
      if(!serviceName && !isUuid(body.id)) throw new HttpError(400,'Service name is required.');
      if(!['draft','active','paused','completed','cancelled'].includes(agreementStatus)) throw new HttpError(400,'Unsupported agreement status.');
      if(!['mowing','garden_bed_maintenance','hedge_shrub_trimming','spring_cleanup','fall_cleanup','aeration','fertilizing','seasonal_program','other'].includes(programType)) throw new HttpError(400,'Unsupported lawn/yard program type.');
      if(!['weekly','biweekly','custom_days','seasonal_once','manual'].includes(frequency)) throw new HttpError(400,'Unsupported recurrence frequency.');
      const customDays=body.custom_interval_days === '' || body.custom_interval_days === null || body.custom_interval_days === undefined ? null : int(body.custom_interval_days,0);
      if(frequency==='custom_days' && (!customDays || customDays<1 || customDays>366)) throw new HttpError(400,'Custom recurrence requires 1–366 days.');
      const preferredWeekday=body.preferred_weekday === '' || body.preferred_weekday === null || body.preferred_weekday === undefined ? null : int(body.preferred_weekday,-1);
      if(preferredWeekday!==null && (preferredWeekday<0 || preferredWeekday>6)) throw new HttpError(400,'Preferred weekday must be Sunday (0) through Saturday (6).');
      if(agreementStatus==='paused' && !clean(body.pause_reason,1000)) throw new HttpError(400,'A pause/hold reason is required.');
      if(agreementStatus==='cancelled' && !clean(body.cancellation_reason,1000)) throw new HttpError(400,'A cancellation reason is required.');
      const payload:any={
        id:isUuid(body.id)?body.id:null,
        agreement_code:clean(body.agreement_code,80) || null,
        client_id:isUuid(body.client_id)?body.client_id:null,
        client_site_id:isUuid(body.client_site_id)?body.client_site_id:null,
        route_id:isUuid(body.route_id)?body.route_id:null,
        crew_id:isUuid(body.crew_id)?body.crew_id:null,
        service_name:serviceName || null,
        agreement_status:agreementStatus,
        billing_method:clean(body.billing_method || 'per_visit',40),
        service_pattern:clean(body.service_pattern,180) || null,
        recurrence_frequency:frequency,
        recurrence_rule:clean(body.recurrence_rule,300) || null,
        recurrence_interval:Math.max(1,int(body.recurrence_interval,1)),
        recurrence_anchor_date:clean(body.recurrence_anchor_date,20) || null,
        custom_interval_days:customDays,
        preferred_weekday:preferredWeekday,
        start_date:clean(body.start_date,20) || null,
        end_date:clean(body.end_date,20) || null,
        open_end_date:body.open_end_date===true || String(body.open_end_date).toLowerCase()==='true',
        service_window_start:clean(body.service_window_start,20) || null,
        service_window_end:clean(body.service_window_end,20) || null,
        season_start_month:body.season_start_month === '' || body.season_start_month == null ? null : int(body.season_start_month,0),
        season_start_day:body.season_start_day === '' || body.season_start_day == null ? null : int(body.season_start_day,0),
        season_end_month:body.season_end_month === '' || body.season_end_month == null ? null : int(body.season_end_month,0),
        season_end_day:body.season_end_day === '' || body.season_end_day == null ? null : int(body.season_end_day,0),
        visit_estimated_minutes:body.visit_estimated_minutes === '' || body.visit_estimated_minutes == null ? null : Math.max(1,int(body.visit_estimated_minutes,1)),
        default_travel_allowance_minutes:Math.max(0,int(body.default_travel_allowance_minutes,0)),
        weather_delay_policy:clean(body.weather_delay_policy || 'manual',40),
        weather_makeup_days:Math.max(0,int(body.weather_makeup_days,1)),
        customer_hold_until:clean(body.customer_hold_until,20) || null,
        customer_hold_reason:clean(body.customer_hold_reason,1000) || null,
        pause_reason:clean(body.pause_reason,1000) || null,
        cancellation_reason:clean(body.cancellation_reason,1000) || null,
        service_notes:clean(body.service_notes,2000) || null,
        auto_create_session_candidates:body.auto_create_session_candidates !== false && String(body.auto_create_session_candidates).toLowerCase()!=='false'
      };
      const {data,error}=await supabase.rpc('ywi_rpc_recurring_program_save',{p_payload:payload,p_actor_profile_id:profile.id});
      if(error) throw error;
      const programId=clean((data as any)?.id,80);
      const rows=programId ? await safeSelect(supabase.from('v_recurring_service_program_directory').select('*').eq('id',programId).limit(1)) : [];
      await audit(supabase,{
        operation_action:action,operation_status:agreementStatus,entity_type:'recurring_service_agreement',
        entity_id:programId,actor_profile_id:profile.id,
        request_payload:{service_name:serviceName,agreement_status:agreementStatus,service_program_type:programType,recurrence_frequency:frequency},
        response_payload:{agreement_id:programId,agreement_code:(data as any)?.agreement_code || null}
      });
      return Response.json({ok:true,build:322,schema:211,record:rows[0] || data},{headers:corsHeaders});
    }

    if (action === 'recurring_service_visit_event') {
      requireRank(profile,45,action);
      const agreementId=clean(body.agreement_id,80);
      const originalDate=clean(body.original_service_date,20);
      const eventType=clean(body.event_type,40).toLowerCase();
      const effectiveDate=clean(body.effective_service_date,20) || null;
      const reason=clean(body.reason,1200);
      const workability=clean(body.workability_state,40).toLowerCase() || null;
      if(!isUuid(agreementId)) throw new HttpError(400,'Valid agreement_id is required.');
      if(!/^\d{4}-\d{2}-\d{2}$/.test(originalDate)) throw new HttpError(400,'Valid original service date is required.');
      if(!['skip','weather_delay','makeup','customer_hold','resume','cancel_visit'].includes(eventType)) throw new HttpError(400,'Unsupported recurring visit event.');
      if(eventType!=='resume' && !reason) throw new HttpError(400,'A reason is required.');
      if(['weather_delay','makeup'].includes(eventType) && !effectiveDate) throw new HttpError(400,'Weather delay and make-up events require an effective service date.');
      if(workability && !['not_assessed','workable','caution','delayed','blocked'].includes(workability)) throw new HttpError(400,'Unsupported workability state.');
      const {data,error}=await supabase.rpc('ywi_rpc_recurring_visit_event',{
        p_agreement_id:agreementId,
        p_original_service_date:originalDate,
        p_event_type:eventType,
        p_effective_service_date:effectiveDate,
        p_reason:reason || null,
        p_workability_state:workability,
        p_actor_profile_id:profile.id
      });
      if(error) throw error;
      const eventId=clean((data as any)?.id,80);
      await audit(supabase,{
        operation_action:action,operation_status:eventType,entity_type:'recurring_service_visit_event',
        entity_id:eventId,actor_profile_id:profile.id,
        request_payload:{agreement_id:agreementId,original_service_date:originalDate,event_type:eventType,effective_service_date:effectiveDate},
        response_payload:{event_id:eventId}
      });
      return Response.json({ok:true,build:322,schema:211,event:data},{headers:corsHeaders});
    }

    if (action === 'dispatch_schedule') {
      requireRank(profile, 45, action);
      const workOrderId = clean(body.work_order_id, 80);
      if (!isUuid(workOrderId)) throw new HttpError(400, 'Valid work_order_id is required.');
      const start = clean(body.scheduled_start, 80);
      const end = clean(body.scheduled_end, 80);
      if (!start || !end || Number.isNaN(new Date(start).valueOf()) || Number.isNaN(new Date(end).valueOf()) || new Date(end) <= new Date(start)) {
        throw new HttpError(400, 'Valid start and end times are required.');
      }
      const scheduleStatus = clean(body.schedule_status || 'scheduled', 40).toLowerCase();
      const workabilityState = clean(body.workability_state || 'not_assessed', 40).toLowerCase();
      if (!['draft','scheduled','dispatched','rescheduled','cancelled'].includes(scheduleStatus)) throw new HttpError(400, 'Unsupported dispatch schedule status.');
      if (!['not_assessed','workable','caution','delayed','blocked'].includes(workabilityState)) throw new HttpError(400, 'Unsupported workability state.');
      if (scheduleStatus === 'dispatched' && workabilityState === 'blocked') throw new HttpError(409, 'A workability-blocked visit cannot be dispatched.');
      const rescheduleReason = clean(body.reschedule_reason,1000);
      const cancellationReason = clean(body.cancellation_reason,1000);
      if (scheduleStatus === 'rescheduled' && !rescheduleReason) throw new HttpError(400, 'A reschedule reason is required.');
      if (scheduleStatus === 'cancelled' && !cancellationReason) throw new HttpError(400, 'A cancellation reason is required.');

      const crewProfiles = arrayValue(body.assigned_crew_profile_ids).map((value:any)=>clean(value,80)).filter(isUuid);
      const equipmentIds = arrayValue(body.assigned_equipment_item_ids).map((value:any)=>int(value,0)).filter((value:number)=>value>0);
      const args = {
        p_work_order_id: workOrderId,
        p_schedule_status: scheduleStatus,
        p_scheduled_start: new Date(start).toISOString(),
        p_scheduled_end: new Date(end).toISOString(),
        p_crew_id: isUuid(body.crew_id) ? body.crew_id : null,
        p_lead_profile_id: isUuid(body.lead_profile_id) ? body.lead_profile_id : null,
        p_supervisor_profile_id: isUuid(body.assigned_supervisor_profile_id) ? body.assigned_supervisor_profile_id : null,
        p_assigned_crew_profile_ids: crewProfiles,
        p_route_id: isUuid(body.route_id) ? body.route_id : null,
        p_client_site_id: isUuid(body.client_site_id) ? body.client_site_id : null,
        p_route_order: body.route_order === null || body.route_order === undefined || body.route_order === '' ? null : Math.max(1,int(body.route_order,1)),
        p_estimated_duration_minutes: body.estimated_duration_minutes === null || body.estimated_duration_minutes === undefined || body.estimated_duration_minutes === '' ? null : Math.max(1,int(body.estimated_duration_minutes,1)),
        p_travel_allowance_minutes: Math.max(0,int(body.travel_allowance_minutes,0)),
        p_truck_equipment_item_id: int(body.assigned_truck_equipment_item_id,0) || null,
        p_trailer_equipment_item_id: int(body.assigned_trailer_equipment_item_id,0) || null,
        p_equipment_item_ids: equipmentIds,
        p_recurring_visit_key: clean(body.recurring_visit_key,180) || null,
        p_recurrence_label: clean(body.recurrence_label,180) || null,
        p_workability_state: workabilityState,
        p_weather_summary: clean(body.weather_summary,500) || null,
        p_workability_note: clean(body.workability_note,1000) || null,
        p_schedule_reason: clean(body.schedule_reason,1000) || null,
        p_reschedule_reason: rescheduleReason || null,
        p_cancellation_reason: cancellationReason || null,
        p_supersedes_dispatch_id: isUuid(body.supersedes_dispatch_id) ? body.supersedes_dispatch_id : null,
        p_conflict_override_note: clean(body.conflict_override_note,1200) || null,
        p_dispatch_notes: clean(body.dispatch_notes,1500) || null,
        p_actor_profile_id: profile.id
      };
      const { data, error } = await supabase.rpc('ywi_rpc_dispatch_schedule_v2', args);
      if (error) {
        const message = clean(error.message || error.details || 'Dispatch scheduling failed.',2000);
        if (/conflict detected|locked out|unavailable|reschedule reason|cancellation reason|workability/i.test(message)) throw new HttpError(409,message);
        throw error;
      }
      const recordId = clean((data as any)?.id,80);
      const rows = recordId ? await safeSelect(supabase.from('v_crew_dispatch_schedule').select('*').eq('id',recordId).limit(1)) : [];
      await audit(supabase, {
        operation_action:action, operation_status:scheduleStatus, entity_type:'dispatch_schedule_item',
        entity_id:recordId, actor_profile_id:profile.id,
        request_payload:{work_order_id:workOrderId,schedule_status:scheduleStatus,scheduled_start:start,scheduled_end:end,crew_id:args.p_crew_id,route_id:args.p_route_id},
        response_payload:{dispatch_id:recordId,dispatch_readiness:rows[0]?.dispatch_readiness || null,conflict_count:rows[0]?.conflict_count || 0}
      });
      return Response.json({ ok:true, build:321, schema:210, record:rows[0] || data }, { headers:corsHeaders });
    }

    if (action === 'job_cost_refresh') {
      requireRank(profile, 45, action);
      const jobId = int(body.job_id, 0);
      if (!jobId) throw new HttpError(400, 'Valid job_id is required.');
      const { data: depth, error: depthError } = await supabase.from('v_job_cost_depth_directory').select('*').eq('job_id', jobId).single();
      if (depthError) throw depthError;
      const estimateTotal = money(body.estimate_total || depth.quoted_charge_total);
      const revenue = money(depth.total_known_revenue || depth.actual_charge_total || depth.quoted_charge_total);
      const equipment = money(depth.equipment_usage_cost_total) + money(depth.equipment_repair_event_cost_total) + money(depth.equipment_replacement_cost_total);
      const material = money(depth.material_cost_total); const subcontract = money(depth.subcontract_cost_total);
      const other = Math.max(0, money(depth.total_known_cost) - equipment - material - subcontract);
      const totalCost = equipment + material + subcontract + other;
      const margin = revenue - totalCost;
      const marginPercent = revenue ? Number((margin / revenue * 100).toFixed(2)) : 0;
      const { data, error } = await supabase.from('job_cost_live_snapshots').insert({
        job_id: jobId, work_order_id: isUuid(body.work_order_id) ? body.work_order_id : null, estimate_total: estimateTotal,
        revenue_total: revenue, labour_cost_total: money(body.labour_cost_total), material_cost_total: material,
        equipment_cost_total: equipment, subcontract_cost_total: subcontract, other_cost_total: other,
        margin_amount: margin, margin_percent: marginPercent, snapshot_status: 'current', snapshot_payload: depth, calculated_at: nowIso()
      }).select('*').single();
      if (error) throw error;
      await supabase.from('job_cost_live_snapshots').update({ snapshot_status: 'superseded' }).eq('job_id', jobId).neq('id', data.id).eq('snapshot_status', 'current');
      return Response.json({ ok: true, record: data }, { headers: corsHeaders });
    }

    if (action === 'work_order_live_update_create') {
      requireRank(profile, 20, action);
      const workOrderId = clean(body.work_order_id, 80);
      if (!isUuid(workOrderId)) throw new HttpError(400, 'Valid work_order_id is required.');
      const suppliedAssetIds = Array.isArray(body.asset_ids) ? body.asset_ids : [];
      const assetIds = suppliedAssetIds.map((value) => clean(value, 80)).filter((value) => isUuid(value));
      if (assetIds.length !== suppliedAssetIds.length) throw new HttpError(400, 'Every selected visual asset must have a valid ID.');
      const result = await callRpc(supabase, 'ywi_rpc_create_work_order_live_update', {
        p_work_order_id: workOrderId,
        p_actor_profile_id: profile.id,
        p_visibility: clean(body.visibility || 'staff', 20),
        p_update_type: clean(body.update_type || 'progress', 40),
        p_title: clean(body.title, 180),
        p_message: clean(body.message, 4000) || null,
        p_occurred_at: clean(body.occurred_at, 80) || null,
        p_progress_percent: body.progress_percent === '' || body.progress_percent === undefined || body.progress_percent === null ? null : Number(body.progress_percent),
        p_asset_ids: assetIds,
        p_customer_notification_requested: body.customer_notification_requested === true,
        p_metadata: {
          build: BUILD,
          schema: SCHEMA,
          source: 'operations-manage',
          client_request_id: clean(body.idempotency_key, 160) || null
        }
      });
      if (isUuid(body.job_session_id) && result?.live_update_id) {
        const linked = await callRpc(supabase,'ywi_rpc_landscape_production_session_save',{
          p_payload:{id:clean(body.job_session_id,80),work_order_id:workOrderId,live_update_id:result.live_update_id},
          p_actor_profile_id:profile.id
        });
        result.production_session = linked?.session || null;
      }
      let notification: any = null;
      if (result?.visibility === 'customer' && body.customer_notification_requested === true && result?.live_update_id) {
        notification = await callRpc(supabase, 'ywi_rpc_enqueue_customer_live_update_notification', {
          p_live_update_id: result.live_update_id,
          p_actor_profile_id: profile.id
        });
      }
      await audit(supabase, {
        operation_action: action,
        operation_status: 'published',
        entity_type: 'work_order_live_update',
        entity_id: result?.live_update_id,
        actor_profile_id: profile.id,
        request_payload: safeRequest(body),
        response_payload: { ...result, notification }
      });
      return Response.json({ ok: true, live_update: result, notification }, { headers: corsHeaders });
    }


    if (action === 'work_order_execution_proof_submit') {
      requireRank(profile, 20, action);
      const workOrderId = clean(body.work_order_id, 80);
      if (!isUuid(workOrderId)) throw new HttpError(400, 'Valid work_order_id is required.');
      const assetIds = arrayValue(body.asset_ids).map((value) => clean(value, 80)).filter(isUuid);
      const result = await callRpc(supabase, 'ywi_rpc_submit_work_order_execution_proof', {
        p_work_order_id: workOrderId,
        p_actor_profile_id: profile.id,
        p_proof_type: clean(body.proof_type || 'progress', 40),
        p_title: clean(body.title, 180),
        p_staff_notes: clean(body.staff_notes, 4000) || null,
        p_customer_summary: clean(body.customer_summary, 1500) || null,
        p_customer_visible: body.customer_visible === true,
        p_occurred_at: clean(body.occurred_at, 80) || null,
        p_progress_percent: body.progress_percent === null || body.progress_percent === '' || body.progress_percent === undefined ? null : money(body.progress_percent),
        p_asset_ids: assetIds,
        p_labour_minutes: int(body.labour_minutes, 0),
        p_labour_hourly_rate: money(body.labour_hourly_rate),
        p_material_cost_total: money(body.material_cost_total),
        p_equipment_cost_total: money(body.equipment_cost_total),
        p_other_cost_total: money(body.other_cost_total),
        p_metadata: { build: BUILD, schema: SCHEMA, idempotency_key: idempotencyKey(req, body, 'execution-proof') }
      });
      if (isUuid(body.job_session_id) && result?.execution_proof_id) {
        const linked = await callRpc(supabase,'ywi_rpc_landscape_production_session_save',{
          p_payload:{id:clean(body.job_session_id,80),work_order_id:workOrderId,execution_proof_id:result.execution_proof_id},
          p_actor_profile_id:profile.id
        });
        result.production_session = linked?.session || null;
      }
      await audit(supabase, { operation_action: action, operation_status: 'submitted', entity_type: 'work_order_execution_proof', entity_id: result.execution_proof_id, actor_profile_id: profile.id, request_payload: safeRequest(body), response_payload: result });
      return Response.json({ ok: true, proof: result }, { headers: corsHeaders });
    }

    if (action === 'work_order_execution_proof_decision') {
      requireRank(profile, 30, action);
      const proofId = clean(body.execution_proof_id, 80);
      if (!isUuid(proofId)) throw new HttpError(400, 'Valid execution_proof_id is required.');
      const decision = clean(body.decision || '', 40);
      const result = await callRpc(supabase, 'ywi_rpc_decide_work_order_execution_proof', {
        p_execution_proof_id: proofId,
        p_actor_profile_id: profile.id,
        p_decision: decision,
        p_decision_note: clean(body.decision_note, 1200) || null
      });
      await audit(supabase, { operation_action: action, operation_status: decision || result.proof_status, entity_type: 'work_order_execution_proof', entity_id: proofId, actor_profile_id: profile.id, request_payload: safeRequest(body), response_payload: result });
      return Response.json({ ok: true, proof: result }, { headers: corsHeaders });
    }


    if (action === 'work_order_closeout_submit') {
      requireRank(profile, 30, action);
      const workOrderId = clean(body.work_order_id, 80);
      if (!isUuid(workOrderId)) throw new HttpError(400, 'Valid work_order_id is required.');
      const beforeAssetIds = arrayValue(body.before_asset_ids).map((value) => clean(value, 80)).filter(isUuid);
      const afterAssetIds = arrayValue(body.after_asset_ids).map((value) => clean(value, 80)).filter(isUuid);
      const result = await callRpc(supabase, 'ywi_rpc_submit_work_order_closeout_package', {
        p_work_order_id: workOrderId,
        p_actor_profile_id: profile.id,
        p_customer_summary: clean(body.customer_summary, 2000),
        p_staff_closeout_notes: clean(body.staff_closeout_notes, 4000) || null,
        p_invoice_ready_requested: body.invoice_ready_requested === true,
        p_review_request_requested: body.review_request_requested === true,
        p_maintenance_followup_due_at: isoDate(body.maintenance_followup_due_at) || null,
        p_before_asset_ids: beforeAssetIds,
        p_after_asset_ids: afterAssetIds,
        p_metadata: { build: BUILD, schema: SCHEMA, idempotency_key: idempotencyKey(req, body, 'closeout-submit') }
      });
      await audit(supabase, { operation_action: action, operation_status: 'submitted', entity_type: 'work_order_closeout_package', entity_id: result.closeout_package_id, actor_profile_id: profile.id, request_payload: safeRequest(body), response_payload: result });
      return Response.json({ ok: true, closeout: result }, { headers: corsHeaders });
    }

    if (action === 'work_order_closeout_decision') {
      requireRank(profile, 30, action);
      const closeoutId = clean(body.closeout_package_id, 80);
      if (!isUuid(closeoutId)) throw new HttpError(400, 'Valid closeout_package_id is required.');
      const decision = clean(body.decision || '', 40);
      const result = await callRpc(supabase, 'ywi_rpc_decide_work_order_closeout_package', {
        p_closeout_package_id: closeoutId,
        p_actor_profile_id: profile.id,
        p_decision: decision,
        p_decision_note: clean(body.decision_note, 1500) || null
      });
      await audit(supabase, { operation_action: action, operation_status: decision || result.closeout_status, entity_type: 'work_order_closeout_package', entity_id: closeoutId, actor_profile_id: profile.id, request_payload: safeRequest(body), response_payload: result });
      return Response.json({ ok: true, closeout: result }, { headers: corsHeaders });
    }

    if (action === 'customer_notification_retry') {
      requireRank(profile, 45, action);
      const outboxId = clean(body.outbox_id, 80);
      if (!isUuid(outboxId)) throw new HttpError(400, 'Valid outbox_id is required.');
      const result = await callRpc(supabase, 'ywi_rpc_retry_customer_notification', {
        p_outbox_id: outboxId,
        p_actor_profile_id: profile.id,
        p_retry_note: clean(body.retry_note, 1000) || null
      });
      await audit(supabase, {
        operation_action: action,
        operation_status: result?.status || 'queued',
        entity_type: 'customer_notification_outbox',
        entity_id: outboxId,
        actor_profile_id: profile.id,
        request_payload: safeRequest(body),
        response_payload: result
      });
      return Response.json({ ok:true, notification:result }, { headers:corsHeaders });
    }

    if (action === 'work_order_live_update_retract') {
      requireRank(profile, 30, action);
      const liveUpdateId = clean(body.live_update_id, 80);
      if (!isUuid(liveUpdateId)) throw new HttpError(400, 'Valid live_update_id is required.');
      const result = await callRpc(supabase, 'ywi_rpc_retract_work_order_live_update', {
        p_live_update_id: liveUpdateId,
        p_actor_profile_id: profile.id,
        p_retraction_reason: clean(body.retraction_reason, 1000) || null
      });
      await audit(supabase, {
        operation_action: action,
        operation_status: 'retracted',
        entity_type: 'work_order_live_update',
        entity_id: liveUpdateId,
        actor_profile_id: profile.id,
        request_payload: safeRequest(body),
        response_payload: result
      });
      return Response.json({ ok: true, live_update: result }, { headers: corsHeaders });
    }

    if (action === 'staging_fixture_create' || action === 'staging_fixture_cleanup') {
      requireRank(profile, 45, action);
      if (action === 'staging_fixture_create') {
        // Never allow disposable fixtures by default. Enable only on a dedicated
        // staging deployment with YWI_ALLOW_STAGING_FIXTURES=true.
        if (clean(Deno.env.get('YWI_ALLOW_STAGING_FIXTURES'), 20).toLowerCase() !== 'true') {
          throw new HttpError(409, 'Staging fixture creation is disabled for this deployment. Enable YWI_ALLOW_STAGING_FIXTURES=true only on a dedicated staging project.');
        }
        const label = clean(body.fixture_label || 'STAGING-RPC', 100).toUpperCase();
        if (!label.startsWith('STAGING-')) throw new HttpError(400, 'Fixture labels must begin with STAGING-.');
        const result = await callRpc(supabase, 'ywi_rpc_create_staging_fixture_set', { p_actor_profile_id: profile.id, p_fixture_label: label });
        await audit(supabase, { operation_action: action, operation_status:'created', entity_type:'operations_staging_fixture_set', entity_id:result.fixture_set_id, actor_profile_id:profile.id, request_payload:safeRequest(body), response_payload:result });
        return Response.json({ ok:true, fixture:result }, { headers:corsHeaders });
      }
      const fixtureSetId = clean(body.fixture_set_id, 80);
      if (!isUuid(fixtureSetId)) throw new HttpError(400, 'Valid fixture_set_id is required.');
      const result = await callRpc(supabase, 'ywi_rpc_cleanup_staging_fixture_set', { p_fixture_set_id:fixtureSetId, p_actor_profile_id:profile.id, p_cleanup_note:clean(body.cleanup_note,1000) || null });
      await audit(supabase, { operation_action:action, operation_status:'cleaned', entity_type:'operations_staging_fixture_set', entity_id:fixtureSetId, actor_profile_id:profile.id, request_payload:safeRequest(body), response_payload:result });
      return Response.json({ ok:true, fixture:result }, { headers:corsHeaders });
    }

    if (action === 'content_signal_record' || action === 'content_signal_decision') {
      requireRank(profile, 45, action);
      if (action === 'content_signal_decision') {
        const observationId = clean(body.observation_id,80); if (!isUuid(observationId)) throw new HttpError(400,'Valid observation_id is required.');
        const decision = clean(body.decision_status,40); if (!['review','actioned','no_change','archived'].includes(decision)) throw new HttpError(400,'Unsupported content decision.');
        const { data,error }=await supabase.from('content_signal_observations').update({ decision_status:decision, decision_note:clean(body.decision_note,1500)||null, decided_by_profile_id:profile.id, decided_at:nowIso(), updated_at:nowIso() }).eq('id',observationId).select('*').single();
        if(error) throw error; return Response.json({ok:true,record:data},{headers:corsHeaders});
      }
      const source=clean(body.source_name,80); if(!['search_console','google_business_profile','manual_analytics'].includes(source)) throw new HttpError(400,'Choose Search Console, Google Business Profile, or manual analytics.');
      const key=idempotencyKey(req,body,'signal');
      const { data,error }=await supabase.from('content_signal_observations').upsert({ observation_key:key, source_name:source, route_key:clean(body.route_key,120)||null, observation_date:isoDate(body.observation_date)||today(), period_start:isoDate(body.period_start)||null, period_end:isoDate(body.period_end)||null, impressions:int(body.impressions,0)||null, clicks:int(body.clicks,0)||null, average_position:body.average_position===undefined?null:money(body.average_position), calls:int(body.calls,0)||null, direction_requests:int(body.direction_requests,0)||null, website_visits:int(body.website_visits,0)||null, review_count:int(body.review_count,0)||null, rating:body.rating===undefined?null:money(body.rating), notes:clean(body.notes,1500)||null, evidence_url:safeHttpUrl(body.evidence_url)||null, decision_status:'new', created_by_profile_id:profile.id, updated_at:nowIso() },{onConflict:'observation_key'}).select('*').single();
      if(error) throw error; return Response.json({ok:true,record:data},{headers:corsHeaders});
    }

    if (action === 'stripe_webhook_alert_decision') {
      requireRank(profile,45,action);
      const alertId=clean(body.alert_id,80); if(!isUuid(alertId)) throw new HttpError(400,'Valid alert_id is required.');
      const statusValue=clean(body.alert_status,40); if(!['acknowledged','resolved'].includes(statusValue)) throw new HttpError(400,'Unsupported alert decision.');
      const { data,error }=await supabase.from('stripe_webhook_operational_alerts').update({ alert_status:statusValue, acknowledged_by_profile_id:statusValue==='acknowledged'?profile.id:null, acknowledged_at:statusValue==='acknowledged'?nowIso():null, resolved_by_profile_id:statusValue==='resolved'?profile.id:null, resolved_at:statusValue==='resolved'?nowIso():null, updated_at:nowIso() }).eq('id',alertId).select('*').single();
      if(error) throw error; return Response.json({ok:true,record:data},{headers:corsHeaders});
    }

    if (action === 'release_readiness_capture') {
      requireRank(profile, 45, action);
      const reviewScope = clean(body.review_scope || 'staging', 40).toLowerCase();
      const confirmationPhrase = clean(body.confirmation_phrase, 80);
      const reviewerNote = clean(body.reviewer_note, 2000) || null;
      const result = await callRpc(supabase, 'ywi_rpc_capture_release_readiness_snapshot', {
        p_actor_profile_id: profile.id,
        p_review_scope: reviewScope,
        p_reviewer_note: reviewerNote,
        p_confirmation_phrase: confirmationPhrase
      });
      await audit(supabase, {
        operation_action: action,
        operation_status: 'captured',
        entity_type: 'release_readiness_review_snapshot',
        entity_id: result?.snapshot_id,
        actor_profile_id: profile.id,
        request_payload: safeRequest(body),
        response_payload: result
      });
      return Response.json({ ok:true, snapshot:result }, { headers:corsHeaders });
    }

    if (action === 'deposit_status_update') {
      // Deliberately fail closed: a staff screen must never mark a hosted payment as paid.
      // Stripe webhook verification owns paid/failed/expired lifecycle updates through schema 151 RPCs.
      requireRank(profile, 45, action);
      throw new HttpError(409, 'Manual deposit-status changes are disabled. Use Stripe test-mode webhooks or the customer portal checkout flow so amount, currency, session, and signature checks remain intact.');
    }

    if (action === 'offline_conflict_card' || action === 'offline_conflict_resolve') {
      requireRank(profile, 30, action);
      if (action === 'offline_conflict_resolve') {
        const conflictId = clean(body.conflict_id, 80);
        if (!isUuid(conflictId)) throw new HttpError(400, 'Valid conflict_id is required.');
        const resolution = clean(body.resolution_action, 80);
        if (!['retry_sync','keep_local','reload_server','discard_local'].includes(resolution)) throw new HttpError(400, 'Unsupported conflict resolution.');
        const { data, error } = await supabase.from('mobile_offline_conflict_cards').update({ conflict_status: resolution === 'retry_sync' ? 'retrying' : 'resolved', resolution_action: resolution, resolution_note: clean(body.resolution_note, 1000) || null, resolved_by_profile_id: profile.id, resolved_at: resolution === 'retry_sync' ? null : nowIso(), retry_count: int(body.retry_count, 0) + (resolution === 'retry_sync' ? 1 : 0), updated_at: nowIso() }).eq('id', conflictId).select('*').single();
        if (error) throw error;
        return Response.json({ ok: true, record: data }, { headers: corsHeaders });
      }
      const { data, error } = await supabase.from('mobile_offline_conflict_cards').insert({ entity_type: clean(body.entity_type || 'draft', 120), entity_reference: clean(body.entity_reference, 180) || null, conflict_status: clean(body.conflict_status || 'open', 80), local_payload: objectValue(body.local_payload), server_payload: objectValue(body.server_payload), recommended_action: clean(body.recommended_action || 'review', 80) }).select('*').single();
      if (error) throw error;
      return Response.json({ ok: true, record: data }, { headers: corsHeaders });
    }

    if (action === 'scorecard_update') {
      requireRank(profile, 45, action);
      const railKey = clean(body.rail_key, 120);
      if (!railKey) throw new HttpError(400, 'rail_key is required.');
      const { data, error } = await supabase.from('admin_scorecard_progress_rails').upsert({ rail_key: railKey, rail_area: clean(body.rail_area || 'admin', 120), rail_title: clean(body.rail_title || 'Progress rail', 180), rail_status: clean(body.rail_status || 'active', 80), progress_percent: Math.max(0, Math.min(100, int(body.progress_percent, 0))), current_value: body.current_value === undefined ? null : money(body.current_value), target_value: body.target_value === undefined ? null : money(body.target_value), next_action_hint: clean(body.next_action_hint, 1000) || null, owner_hint: clean(body.owner_hint, 180) || null, sort_order: int(body.sort_order, 100), metadata: { build: BUILD, schema: SCHEMA, source: 'operations-manage' }, updated_at: nowIso() }, { onConflict: 'rail_key' }).select('*').single();
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
