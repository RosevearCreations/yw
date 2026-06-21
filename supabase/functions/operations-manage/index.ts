import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const BUILD = '2026-06-20a';
const SCHEMA = 152;
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
  } catch { /* audit cannot block the requested action */ }
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
function scoreTarget(item: any, target: any) {
  const amount = money(target?.row?.amount ?? target?.row?.total_amount ?? target?.row?.balance_due ?? 0);
  const bankAmount = Math.abs(money(item.amount));
  const difference = Math.abs(bankAmount - Math.abs(amount));
  let amountScore = 0;
  if (difference < 0.005) amountScore = 55;
  else if (difference <= 1) amountScore = 40;
  else if (bankAmount && difference / bankAmount <= 0.02) amountScore = 25;
  const targetDateRaw = target?.row?.payment_date || target?.row?.invoice_date || target?.row?.bill_date || target?.row?.batch_date;
  const bankDate = item.item_date ? new Date(`${item.item_date}T00:00:00Z`) : null;
  const targetDate = targetDateRaw ? new Date(`${targetDateRaw}T00:00:00Z`) : null;
  const dayDifference = bankDate && targetDate ? Math.round(Math.abs(bankDate.valueOf() - targetDate.valueOf()) / 86400000) : null;
  const dateScore = dayDifference === null ? 0 : dayDifference === 0 ? 20 : dayDifference <= 3 ? 15 : dayDifference <= 7 ? 8 : 0;
  const refText = normalize(target?.reference);
  const description = normalize(item.item_description);
  const referenceScore = refText && description.includes(refText) ? 15 : refText ? 8 : 0;
  const words = refText.split(' ').filter((word) => word.length > 3);
  const descriptionScore = words.some((word) => description.includes(word)) ? 10 : 0;
  const score = Math.min(100, amountScore + dateScore + referenceScore + descriptionScore);
  return {
    score,
    target_amount: amount,
    amount_difference: Number(difference.toFixed(2)),
    day_difference: dayDifference,
    components: { amount: amountScore, date: dateScore, reference: referenceScore, description: descriptionScore },
    summary: `${amountScore}/55 amount, ${dateScore}/20 date, ${referenceScore}/15 reference, ${descriptionScore}/10 description.`
  };
}
async function suggestMatches(supabase: any, item: any) {
  const absAmount = Math.abs(money(item.amount));
  const tables = [
    { table:'ar_payments', type:'ar_payment', refCol:'payment_number', dateCol:'payment_date', amountCol:'amount', select:'id, payment_number, reference_number, payment_date, amount, client_id' },
    { table:'ap_payments', type:'ap_payment', refCol:'payment_number', dateCol:'payment_date', amountCol:'amount', select:'id, payment_number, reference_number, payment_date, amount, vendor_id' },
    { table:'ar_invoices', type:'ar_invoice', refCol:'invoice_number', dateCol:'invoice_date', amountCol:'total_amount', select:'id, invoice_number, invoice_date, total_amount, balance_due, client_id' },
    { table:'ap_bills', type:'ap_bill', refCol:'bill_number', dateCol:'bill_date', amountCol:'total_amount', select:'id, bill_number, bill_date, total_amount, balance_due, vendor_id' }
  ];
  const candidates: any[] = [];
  for (const config of tables) {
    const { data } = await supabase.from(config.table).select(config.select).gte(config.amountCol, Math.max(0, absAmount - 1)).lte(config.amountCol, absAmount + 1).limit(8);
    for (const row of data || []) {
      const type = config.type;
      const refCol = config.refCol;
      const target = { type, row, reference: row[refCol] };
      candidates.push({ ...target, explanation: scoreTarget(item, target) });
    }
  }
  return candidates.sort((a, b) => b.explanation.score - a.explanation.score).slice(0, 8);
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
async function queuePayload(supabase: any, profile: any) {
  const queueNames: Record<string, string> = {
    quotes: 'v_quote_contact_followup_queue', payments: 'v_payment_action_workbench', bank_imports: 'v_bank_csv_import_workbench',
    reconciliation: 'v_reconciliation_action_workbench', equipment: 'v_equipment_scan_resolution_queue', equipment_service: 'v_equipment_service_cost_recovery_queue',
    assets: 'v_visual_asset_publication_readiness', routes: 'v_public_route_publication_readiness', portal: 'v_customer_portal_quote_directory', job_costs: 'v_live_job_cost_dashboard'
  };
  const entries = await Promise.all(Object.entries(queueNames).map(async ([key, view]) => {
    const rows = await safeSelect(supabase.from(view).select('*').limit(60));
    return [key, rows];
  }));
  const [bankItems, profiles, banks, rails, stripeRows, exportRows, testRows, capabilitySnapshot] = await Promise.all([
    safeSelect(supabase.from('bank_reconciliation_items').select('id, reconciliation_session_id, item_date, item_description, amount, match_status, clearing_status, difference_reason, notes, created_at').eq('clearing_status', 'open').order('item_date', { ascending: false }).limit(100)),
    safeSelect(supabase.from('profiles').select('id, full_name, email, role').order('full_name').limit(200)),
    safeSelect(supabase.from('bank_accounts').select('id, account_name, currency_code, account_mask, is_default, gl_account_id').eq('account_status', 'open').order('is_default', { ascending: false }).order('account_name')),
    safeSelect(supabase.from('admin_scorecard_progress_rails').select('*').eq('rail_status', 'active').order('sort_order')),
    safeSelect(supabase.from('v_stripe_webhook_health').select('*').limit(1)),
    safeSelect(supabase.from('v_accountant_export_readiness').select('*').limit(1)),
    safeSelect(supabase.from('v_operations_staging_test_summary').select('*').limit(6)),
    callRpc(supabase, 'ywi_get_operations_capabilities', { p_actor_profile_id: profile.id }).catch(() => ({ actor_role: profile?.role || 'unknown', actor_rank: roleRank(profile?.role), actions: {} }))
  ]);
  return {
    ...Object.fromEntries(entries), bank_items: bankItems, profiles, banks, rails,
    capabilities: capabilitySnapshot,
    stripe_health: {
      ...(stripeRows?.[0] || {}),
      webhook_secret_configured: Boolean(clean(Deno.env.get('STRIPE_WEBHOOK_SECRET'), 8)),
      api_key_configured: Boolean(clean(Deno.env.get('STRIPE_SECRET_KEY'), 8))
    },
    accountant_export: exportRows?.[0] || {},
    staging_tests: testRows || []
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

    if (action === 'operations_queue_list') {
      requireRank(profile, 30, action);
      return Response.json({ ok: true, build: BUILD, schema: SCHEMA, queues: await queuePayload(supabase, profile) }, { headers: corsHeaders });
    }

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
        action_key: key, idempotency_key: key, action_type: actionType, action_status: 'submitted',
        ledger_side: clean(body.ledger_side || 'auto', 20), bank_account_id: isUuid(body.bank_account_id) ? body.bank_account_id : null,
        bank_account_hint: clean(body.bank_account_hint, 180) || null, transaction_date: isoDate(body.transaction_date) || today(),
        customer_or_vendor_name: clean(body.customer_or_vendor_name, 180) || null,
        invoice_reference: clean(body.invoice_reference, 160) || null, payment_reference: clean(body.payment_reference, 160) || null,
        reversal_of_request_id: isUuid(body.reversal_of_request_id) ? body.reversal_of_request_id : null,
        amount, currency_code: clean(body.currency_code || 'CAD', 8) || 'CAD', reason,
        proof_required: proofRequired, proof_reference: proofReference || null, requested_by_profile_id: profile.id,
        posting_status: 'not_posted', rollback_hint: 'Reverse through a new approved reversal request; never edit posted journal lines.',
        metadata: { build: BUILD, schema: SCHEMA, source: 'operations-cockpit' }, updated_at: nowIso()
      };
      const { data, error } = await supabase.from('payment_action_requests').upsert(row, { onConflict: 'action_key', ignoreDuplicates: false }).select('*').single();
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
      if (decision === 'post') {
        const postedResult = await callRpc(supabase, 'ywi_rpc_post_payment_action', { p_request_id: requestId, p_actor_profile_id: profile.id });
        const posted = postedResult.record || postedResult;
        await audit(supabase, { operation_action: action, operation_status: 'posted', entity_type: 'payment_action_request', entity_id: requestId, actor_profile_id: profile.id, request_payload: safeRequest(body), response_payload: { rpc: 'ywi_rpc_post_payment_action', gl_batch_id: posted?.gl_batch_id, result: postedResult } });
        return Response.json({ ok: true, record: posted, rpc: postedResult }, { headers: corsHeaders });
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
        created_by_profile_id: profile.id, metadata: { build: BUILD, schema: SCHEMA, source: 'operations-cockpit' }, updated_at: nowIso()
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
      if (!['match','split','undo','signoff','reject'].includes(actionType)) throw new HttpError(400, 'Unsupported reconciliation action.');
      const bankRowId = clean(body.reconciliation_item_id || body.bank_row_id, 80);
      const splitRows = arrayValue(body.split_rows || body.split_json).map((row) => objectValue(row));
      if (actionType !== 'undo' && !isUuid(bankRowId)) throw new HttpError(400, 'A promoted reconciliation item ID is required.');
      if (actionType === 'split' && splitRows.length < 2) throw new HttpError(400, 'Split actions require at least two allocations.');
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
      const sourceUrl = clean(body.public_url || body.source_url, 900);
      const altText = clean(body.alt_text, 280);
      const consent = clean(body.consent_status || 'not_required', 80);
      const compression = clean(body.compression_status || 'pending', 80);
      const width = int(body.pixel_width, 0);
      const height = int(body.pixel_height, 0);
      const ready = !!sourceUrl && altText.length >= 12 && ['approved','not_required'].includes(consent) && ['ready','optimized'].includes(compression) && width >= 800 && height >= 450;
      if (status === 'approved' && !ready) throw new HttpError(409, 'Approved assets require an uploaded/linked image, useful alt text, consent, optimized compression, and at least 800×450 dimensions.');
      const readiness = [!!sourceUrl, altText.length >= 12, ['approved','not_required'].includes(consent), ['ready','optimized'].includes(compression), width >= 800 && height >= 450].filter(Boolean).length * 20;
      const payload: Record<string, unknown> = {
        asset_status: status, surface_area: clean(body.surface_area || 'public', 120), image_role: clean(body.image_role || 'placeholder_replacement', 120),
        source_url: clean(body.source_url, 900) || sourceUrl || null, public_url: clean(body.public_url, 900) || sourceUrl || null,
        thumbnail_url: clean(body.thumbnail_url, 900) || null, alt_text: altText || null, consent_status: consent, compression_status: compression,
        route_key: clean(body.route_key, 120) || null, pixel_width: width || null, pixel_height: height || null,
        thumbnail_width: int(body.thumbnail_width, 0) || null, thumbnail_height: int(body.thumbnail_height, 0) || null,
        file_size_bytes: int(body.file_size_bytes, 0) || null, mime_type: clean(body.mime_type, 120) || null,
        original_file_name: clean(body.original_file_name, 260) || null, storage_bucket: clean(body.storage_bucket, 120) || null,
        storage_path: clean(body.storage_path, 500) || null, thumbnail_path: clean(body.thumbnail_path, 500) || null,
        checksum_sha256: clean(body.checksum_sha256, 128) || null, placeholder_selector: clean(body.placeholder_selector, 240) || null,
        replacement_status: clean(body.replacement_status || 'not_replaced', 80), notes: clean(body.notes, 1000) || null,
        rejection_reason: status === 'rejected' ? clean(body.rejection_reason || body.notes, 1000) || 'Rejected during review.' : null,
        approved_by_profile_id: status === 'approved' ? profile.id : null, approved_at: status === 'approved' ? nowIso() : null,
        readiness_score: readiness, metadata: { build: BUILD, schema: SCHEMA, source: 'operations-manage' }, updated_at: nowIso()
      };
      const query = deciding ? supabase.from('visual_asset_approval_items').update(payload).eq('id', assetId) : supabase.from('visual_asset_approval_items').insert(payload);
      const { data, error } = await query.select('*').single();
      if (error) throw error;
      await audit(supabase, { operation_action: action, operation_status: status, entity_type: 'visual_asset_approval_item', entity_id: data.id, actor_profile_id: profile.id, request_payload: safeRequest(body), response_payload: { readiness_score: readiness } });
      return Response.json({ ok: true, record: data }, { headers: corsHeaders });
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

    if (action === 'dispatch_schedule') {
      requireRank(profile, 45, action);
      const workOrderId = clean(body.work_order_id, 80);
      if (!isUuid(workOrderId)) throw new HttpError(400, 'Valid work_order_id is required.');
      const start = clean(body.scheduled_start, 80); const end = clean(body.scheduled_end, 80);
      if (!start || !end || new Date(end) <= new Date(start)) throw new HttpError(400, 'Valid start and end times are required.');
      const { data: workOrder, error: workOrderError } = await supabase.from('work_orders').select('*').eq('id', workOrderId).single();
      if (workOrderError) throw workOrderError;
      const { data, error } = await supabase.from('dispatch_schedule_items').insert({
        work_order_id: workOrderId, job_id: workOrder.legacy_job_id || null, schedule_status: clean(body.schedule_status || 'scheduled', 60),
        scheduled_start: start, scheduled_end: end, assigned_supervisor_profile_id: isUuid(body.assigned_supervisor_profile_id) ? body.assigned_supervisor_profile_id : null,
        assigned_crew_profile_ids: arrayValue(body.assigned_crew_profile_ids), route_id: isUuid(body.route_id) ? body.route_id : workOrder.route_id,
        dispatch_notes: clean(body.dispatch_notes, 1000) || null, customer_notification_status: 'pending', crew_notification_status: 'pending',
        dispatched_at: clean(body.schedule_status || 'scheduled') === 'dispatched' ? nowIso() : null, dispatched_by_profile_id: profile.id
      }).select('*').single();
      if (error) throw error;
      await supabase.from('work_orders').update({ scheduled_start: start, scheduled_end: end, supervisor_profile_id: isUuid(body.assigned_supervisor_profile_id) ? body.assigned_supervisor_profile_id : workOrder.supervisor_profile_id, status: 'scheduled', updated_at: nowIso() }).eq('id', workOrderId);
      return Response.json({ ok: true, record: data }, { headers: corsHeaders });
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
