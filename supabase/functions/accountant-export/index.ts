import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { hasModuleAccess } from "../_shared/module-permissions.ts";
import { evaluateMonthEndCloseCockpit } from "../_shared/month-end-close-cockpit.ts";
import { zipSync, strToU8 } from "npm:fflate@0.8.2";

const BUILD = 317;
const SCHEMA = 208;
const PACKAGE_VERSION = 2;
const BUCKET = 'accountant-exports';
const ROW_LIMIT = 5000;
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

const clean = (value: unknown, max = 1000) => String(value ?? '').trim().slice(0, max);
const isIsoDate = (value: unknown) => /^\d{4}-\d{2}-\d{2}$/.test(clean(value, 20));
const isUuid = (value: unknown) => /^[0-9a-f-]{36}$/i.test(clean(value, 80));
const roleRank = (role: unknown) => ({ worker:10, employee:10, staff:10, onsite_admin:18, site_leader:20, supervisor:30, hse:40, job_admin:45, admin:50 }[clean(role, 60).toLowerCase()] || 0);

function csvCell(value: unknown) {
  let text = value === null || value === undefined ? '' : (typeof value === 'object' ? JSON.stringify(value) : String(value));
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""').replaceAll('\r', ' ').replaceAll('\n', ' ')}"`;
}
function toCsv(rows: Record<string, unknown>[]) {
  const columns = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  if (!columns.length) return 'No rows returned for this section.\n';
  return `${columns.map(csvCell).join(',')}\n${rows.map((row) => columns.map((column) => csvCell(row[column])).join(',')).join('\n')}\n`;
}
async function sha256Hex(value: Uint8Array) {
  const digest = await crypto.subtle.digest('SHA-256', value);
  return [...new Uint8Array(digest)].map((item) => item.toString(16).padStart(2, '0')).join('');
}
function previousMonthRange() {
  const now = new Date();
  const firstThisMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(firstThisMonth.valueOf() - 86400000);
  const start = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1));
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}
function objectValue(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
function parseJson(value: unknown) {
  const raw = clean(value, 8000);
  if (!raw) return {};
  try { return objectValue(JSON.parse(raw)); } catch { return {}; }
}
function numberValue(value: unknown) {
  const valueNumber = Number(value);
  return Number.isFinite(valueNumber) ? valueNumber : 0;
}
function overlapsPeriod(start: unknown, end: unknown, periodStart: string, periodEnd: string) {
  const rowStart = clean(start, 20);
  const rowEnd = clean(end || start, 20);
  if (!rowStart && !rowEnd) return false;
  return (!rowStart || rowStart <= periodEnd) && (!rowEnd || rowEnd >= periodStart);
}
function buildTrialBalance(accounts: any[], entries: any[]) {
  const totals = new Map<string, { debit:number; credit:number }>();
  for (const entry of entries) {
    const id = clean(entry.account_id, 80);
    if (!id) continue;
    const current = totals.get(id) || { debit:0, credit:0 };
    current.debit += numberValue(entry.debit_amount);
    current.credit += numberValue(entry.credit_amount);
    totals.set(id, current);
  }
  return accounts.map((account) => {
    const total = totals.get(String(account.id)) || { debit:0, credit:0 };
    return {
      account_id: account.id,
      account_number: account.account_number,
      account_name: account.account_name,
      account_type: account.account_type,
      system_code: account.system_code,
      gifi_code: account.gifi_code,
      gifi_description: account.gifi_description,
      tax_export_group: account.tax_export_group,
      accountant_export_group: account.accountant_export_group,
      normal_balance: account.normal_balance,
      is_control_account: account.is_control_account,
      debit_total_through_period_end: Number(total.debit.toFixed(2)),
      credit_total_through_period_end: Number(total.credit.toFixed(2)),
      net_movement_through_period_end: Number((total.debit - total.credit).toFixed(2)),
    };
  });
}
function currentAgingSummary(rows: any[], label: 'ar'|'ap') {
  const buckets = new Map<string, { count:number; balance:number }>();
  for (const row of rows) {
    if (numberValue(row.balance_due) <= 0) continue;
    const key = clean(row.aging_bucket || 'unknown', 40) || 'unknown';
    const current = buckets.get(key) || { count:0, balance:0 };
    current.count += 1;
    current.balance += numberValue(row.balance_due);
    buckets.set(key, current);
  }
  return [...buckets.entries()].map(([aging_bucket, values]) => ({
    ledger: label.toUpperCase(),
    aging_bucket,
    open_item_count: values.count,
    current_balance_due: Number(values.balance.toFixed(2)),
    snapshot_basis: 'Current balance/aging at export generation for documents dated on or before period end; not reconstructed historical aging.',
  }));
}

async function getActor(admin: any, req: Request) {
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) throw new HttpError(401, 'Sign in is required.');
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data?.user?.id) throw new HttpError(401, 'Your session could not be verified.');
  const { data: profile, error: profileError } = await admin.from('profiles').select('id, role, full_name, email, is_active').eq('id', data.user.id).maybeSingle();
  if (profileError || !profile || profile.is_active === false) throw new HttpError(403, 'An active staff profile is required.');
  if (roleRank(profile.role) < 45) throw new HttpError(403, 'Your role cannot generate an accountant export package.');
  if (!(await hasModuleAccess(admin, profile, 'finance', 'manage'))) throw new HttpError(403, 'Finance module manage access is required for accountant exports.');
  return profile;
}
async function list(admin: any, table: string, select = '*', filter?: (query: any) => any) {
  let query = admin.from(table).select(select).limit(ROW_LIMIT);
  if (filter) query = filter(query);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}
async function one(admin: any, table: string, id: string) {
  const { data, error } = await admin.from(table).select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data || null;
}
async function resolvePeriod(admin: any, body: any, periodStart: string, periodEnd: string) {
  const requested = clean(body.period_close_id, 80);
  if (isUuid(requested)) {
    const row = await one(admin, 'accounting_period_closes', requested);
    if (!row) throw new HttpError(404, 'The requested accounting close period was not found.');
    return row;
  }
  const rows = await list(admin, 'accounting_period_closes', '*', (q) =>
    q.eq('period_start', periodStart).eq('period_end', periodEnd).order('updated_at', { ascending:false }).limit(2)
  );
  return rows[0] || null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return Response.json({ ok:false, error:'Use POST.' }, { status:405, headers:corsHeaders });

  let admin: any = null;
  try {
    const url = Deno.env.get('SUPABASE_URL') || Deno.env.get('SB_URL') || '';
    const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SB_SERVICE_ROLE_KEY') || '';
    if (!url || !key) throw new HttpError(500, 'accountant-export is not configured.');
    admin = createClient(url, key, { auth:{ persistSession:false } });
    const body = await req.json().catch(() => ({}));
    const actor = await getActor(admin, req);
    const action = clean(body.action || 'prepare_v2', 60);

    if (action === 'download') {
      const exportId = clean(body.export_id, 80);
      if (!isUuid(exportId)) throw new HttpError(400, 'A valid export_id is required.');
      const { data: existing, error } = await admin.from('accountant_handoff_exports').select('id, export_title, artifact_storage_path, artifact_expires_at, export_status').eq('id', exportId).maybeSingle();
      if (error) throw error;
      if (!existing?.artifact_storage_path || existing.export_status !== 'generated') throw new HttpError(404, 'A generated export artifact was not found.');
      const { data, error: signedError } = await admin.storage.from(BUCKET).createSignedUrl(existing.artifact_storage_path, 900, { download: `${clean(existing.export_title || 'accountant-package', 120).replace(/[^a-z0-9-_]+/gi,'-')}.zip` });
      if (signedError || !data?.signedUrl) throw signedError || new Error('Could not create a private download link.');
      return Response.json({ ok:true, build:BUILD, package_version:PACKAGE_VERSION, export_id:existing.id, download_url:data.signedUrl, expires_in_seconds:900 }, { headers:corsHeaders });
    }

    if (!['prepare','prepare_v2'].includes(action)) throw new HttpError(400, 'Unsupported accountant-export action.');
    const fallback = previousMonthRange();
    let periodStart = isIsoDate(body.period_start) ? clean(body.period_start, 20) : fallback.start;
    let periodEnd = isIsoDate(body.period_end) ? clean(body.period_end, 20) : fallback.end;
    if (periodEnd < periodStart) throw new HttpError(400, 'The end date must be on or after the start date.');

    let periodClose = await resolvePeriod(admin, body, periodStart, periodEnd);
    if (periodClose?.id) {
      periodStart = clean(periodClose.period_start, 20);
      periodEnd = clean(periodClose.period_end, 20);
    }
    if (action === 'prepare_v2' && !periodClose?.id) {
      throw new HttpError(400, 'Build 317 package v2 requires an accounting period close row so period and close/reopen provenance are auditable.');
    }
    const title = clean(body.export_title || `Accountant close package ${periodStart} to ${periodEnd}`, 180);

    const [
      journalBatches,
      periodEntries,
      cumulativeEntries,
      accounts,
      invoices,
      bills,
      arAging,
      apAging,
      paymentActions,
      reconSummary,
      reconItems,
      salesTax,
      payrollRemittance,
      mappings,
      financeLifecycle,
      readiness,
    ] = await Promise.all([
      list(admin, 'gl_journal_batches', '*', (q) => q.gte('batch_date', periodStart).lte('batch_date', periodEnd).order('batch_date')),
      list(admin, 'gl_journal_entries', '*', (q) => q.gte('entry_date', periodStart).lte('entry_date', periodEnd).order('entry_date')),
      list(admin, 'gl_journal_entries', '*', (q) => q.lte('entry_date', periodEnd).order('entry_date')),
      list(admin, 'chart_of_accounts', '*', (q) => q.order('account_number')),
      list(admin, 'ar_invoices', '*', (q) => q.lte('invoice_date', periodEnd).order('invoice_date')),
      list(admin, 'ap_bills', '*', (q) => q.lte('bill_date', periodEnd).order('bill_date')),
      list(admin, 'v_ar_invoice_aging_detail', '*', (q) => q.lte('invoice_date', periodEnd).order('due_date')),
      list(admin, 'v_ap_bill_aging_detail', '*', (q) => q.lte('bill_date', periodEnd).order('due_date')),
      list(admin, 'v_payment_action_workbench', '*', (q) => q.gte('transaction_date', periodStart).lte('transaction_date', periodEnd).order('transaction_date')),
      list(admin, 'v_bank_reconciliation_summary', '*', (q) => q.lte('period_start', periodEnd).gte('period_end', periodStart).order('period_end')),
      list(admin, 'bank_reconciliation_items', '*', (q) => q.gte('item_date', periodStart).lte('item_date', periodEnd).order('item_date')),
      list(admin, 'v_sales_tax_filing_review_directory', '*', (q) => q.lte('filing_period_start', periodEnd).gte('filing_period_end', periodStart).order('filing_period_start')),
      list(admin, 'v_payroll_remittance_review_directory', '*', (q) => q.lte('remittance_period_start', periodEnd).gte('remittance_period_end', periodStart).order('remittance_period_start')),
      list(admin, 'v_finance_account_mapping_review_directory', '*', (q) => q.order('mapping_key')),
      list(admin, 'v_finance_job_completion_operational_lifecycle', '*', (q) => q.order('queued_at', { ascending:false })),
      list(admin, 'v_accountant_export_readiness', '*', (q) => q.limit(1)),
    ]);

    const accountMap = new Map(accounts.map((row:any) => [String(row.id), row]));
    const batchMap = new Map(journalBatches.map((row:any) => [String(row.id), row]));
    const glDetail = periodEntries.map((entry:any) => {
      const account = accountMap.get(String(entry.account_id)) || {};
      const batch = batchMap.get(String(entry.batch_id)) || {};
      return {
        entry_id: entry.id,
        batch_id: entry.batch_id,
        batch_number: batch.batch_number || null,
        batch_status: batch.batch_status || null,
        batch_date: batch.batch_date || null,
        entry_date: entry.entry_date,
        line_number: entry.line_number ?? null,
        account_id: entry.account_id,
        account_number: account.account_number || null,
        account_name: account.account_name || null,
        debit_amount: entry.debit_amount,
        credit_amount: entry.credit_amount,
        client_id: entry.client_id,
        work_order_id: entry.work_order_id,
        dispatch_id: entry.dispatch_id,
        source_record_type: entry.source_record_type || null,
        source_record_id: entry.source_record_id || null,
        memo: entry.memo,
        created_at: entry.created_at,
      };
    });
    const trialBalance = buildTrialBalance(accounts, cumulativeEntries);
    const arAgingSummary = currentAgingSummary(arAging, 'ar');
    const apAgingSummary = currentAgingSummary(apAging, 'ap');
    const unresolvedExceptions = reconItems.filter((row:any) => {
      const match = clean(row.match_status, 40).toLowerCase();
      const clearing = clean(row.clearing_status, 40).toLowerCase();
      const review = clean(row.manual_review_status, 40).toLowerCase();
      const note = parseJson(row.review_notes);
      const resolved = clean(note.resolution_status, 40).toLowerCase() === 'resolved' || review === 'approved';
      return !resolved && (['unmatched','partial','exception'].includes(match) || clearing === 'open' || ['exception','review','needs_review','pending'].includes(review));
    }).map((row:any) => {
      const note = parseJson(row.review_notes);
      return {
        ...row,
        exception_severity: note.severity || null,
        exception_category: note.category || null,
        owner_profile_id: note.owner_profile_id || row.reviewed_by_profile_id || null,
        evidence_reference: note.evidence_reference || row.notes || row.difference_reason || null,
        resolution_reason: note.resolution_reason || null,
        material: note.material === true || note.month_end_close_blocker === true,
        finance_readiness_blocker: note.finance_readiness_blocker === true,
        month_end_close_blocker: note.month_end_close_blocker === true,
      };
    });
    const mappingExceptions = mappings.filter((row:any) => row.mapping_approved !== true || clean(row.blocker_code, 80) !== 'READY');
    const postingExceptions = financeLifecycle.filter((row:any) => {
      if (!overlapsPeriod(row.completion_date || row.source_occurred_at, row.completion_date || row.source_occurred_at, periodStart, periodEnd)) return false;
      return !['posted','reversed'].includes(clean(row.lifecycle_stage, 80).toLowerCase());
    });
    const closeState = periodClose ? [{
      period_close_id: periodClose.id,
      period_code: periodClose.period_code,
      period_start: periodClose.period_start,
      period_end: periodClose.period_end,
      close_scope: periodClose.close_scope,
      close_status: periodClose.close_status,
      period_lock_status: periodClose.period_lock_status,
      ar_locked: periodClose.ar_locked,
      ap_locked: periodClose.ap_locked,
      gl_locked: periodClose.gl_locked,
      payroll_locked: periodClose.payroll_locked,
      tax_locked: periodClose.tax_locked,
      locked_by_profile_id: periodClose.locked_by_profile_id,
      locked_at: periodClose.locked_at,
      closed_by_profile_id: periodClose.closed_by_profile_id,
      closed_at: periodClose.closed_at,
      reopened_by_profile_id: periodClose.reopened_by_profile_id,
      reopened_at: periodClose.reopened_at,
      reopen_reason: periodClose.reopen_reason,
      close_notes: periodClose.close_notes,
      accountant_package_export_id: periodClose.accountant_package_export_id,
      updated_at: periodClose.updated_at,
    }] : [];
    const closeCockpit = periodClose?.id ? await evaluateMonthEndCloseCockpit(admin, String(periodClose.id)) : null;

    const fileRows: Array<{ filename:string; rows:Record<string, unknown>[]; source:string; filter:string; note?:string }> = [
      { filename:'trial-balance-through-period-end.csv', rows:trialBalance, source:'chart_of_accounts + gl_journal_entries', filter:`entry_date <= ${periodEnd}` },
      { filename:'gl-detail-period.csv', rows:glDetail, source:'gl_journal_entries + gl_journal_batches + chart_of_accounts', filter:`${periodStart} <= entry_date <= ${periodEnd}` },
      { filename:'journal-batches-period.csv', rows:journalBatches, source:'gl_journal_batches', filter:`${periodStart} <= batch_date <= ${periodEnd}` },
      { filename:'ar-invoice-register-through-period-end.csv', rows:invoices, source:'ar_invoices', filter:`invoice_date <= ${periodEnd}` },
      { filename:'ar-aging-current-for-period-documents.csv', rows:arAging, source:'v_ar_invoice_aging_detail', filter:`invoice_date <= ${periodEnd}`, note:'Current balance/aging at generation, not reconstructed historical aging.' },
      { filename:'ar-aging-summary-current.csv', rows:arAgingSummary, source:'derived from v_ar_invoice_aging_detail', filter:`invoice_date <= ${periodEnd}`, note:'Current outstanding-balance context.' },
      { filename:'ap-bill-register-through-period-end.csv', rows:bills, source:'ap_bills', filter:`bill_date <= ${periodEnd}` },
      { filename:'ap-aging-current-for-period-documents.csv', rows:apAging, source:'v_ap_bill_aging_detail', filter:`bill_date <= ${periodEnd}`, note:'Current balance/aging at generation, not reconstructed historical aging.' },
      { filename:'ap-aging-summary-current.csv', rows:apAgingSummary, source:'derived from v_ap_bill_aging_detail', filter:`bill_date <= ${periodEnd}`, note:'Current outstanding-balance context.' },
      { filename:'payment-actions-period.csv', rows:paymentActions, source:'v_payment_action_workbench', filter:`${periodStart} <= transaction_date <= ${periodEnd}` },
      { filename:'bank-reconciliation-summary.csv', rows:reconSummary, source:'v_bank_reconciliation_summary', filter:`session overlaps ${periodStart}..${periodEnd}` },
      { filename:'unresolved-reconciliation-exceptions.csv', rows:unresolvedExceptions, source:'bank_reconciliation_items + review_notes metadata', filter:`item_date in period and unresolved reconciliation/review state` },
      { filename:'sales-tax-schedule.csv', rows:salesTax, source:'v_sales_tax_filing_review_directory', filter:`filing period overlaps ${periodStart}..${periodEnd}` },
      { filename:'payroll-remittance-schedule.csv', rows:payrollRemittance, source:'v_payroll_remittance_review_directory', filter:`remittance period overlaps ${periodStart}..${periodEnd}` },
      { filename:'account-mapping-review.csv', rows:mappings, source:'v_finance_account_mapping_review_directory', filter:'canonical Finance posting mappings' },
      { filename:'account-mapping-exceptions.csv', rows:mappingExceptions, source:'v_finance_account_mapping_review_directory', filter:'mapping_approved != true or blocker_code != READY' },
      { filename:'posting-exceptions-period.csv', rows:postingExceptions, source:'v_finance_job_completion_operational_lifecycle', filter:`completion/source date in period and lifecycle_stage not posted/reversed` },
      { filename:'close-reopen-state.csv', rows:closeState, source:'accounting_period_closes', filter:periodClose?.id ? `id = ${periodClose.id}` : 'no linked period close row' },
    ];

    const generatedAt = new Date().toISOString();
    const sourceRows = Object.fromEntries(fileRows.map((file) => [file.filename, file.rows.length]));
    const sourceQueryCounts = {
      journal_batches_period: journalBatches.length,
      gl_entries_period: periodEntries.length,
      gl_entries_through_period_end: cumulativeEntries.length,
      chart_of_accounts: accounts.length,
      ar_invoices_through_period_end: invoices.length,
      ap_bills_through_period_end: bills.length,
      ar_aging_rows: arAging.length,
      ap_aging_rows: apAging.length,
      payment_actions_period: paymentActions.length,
      bank_reconciliation_sessions: reconSummary.length,
      bank_reconciliation_items_period: reconItems.length,
      sales_tax_schedule: salesTax.length,
      payroll_remittance_schedule: payrollRemittance.length,
      account_mapping_review: mappings.length,
      finance_lifecycle_rows_loaded: financeLifecycle.length,
    };
    const sourceQueryTruncation = Object.fromEntries(
      Object.entries(sourceQueryCounts).map(([key, count]) => [key, Number(count) >= ROW_LIMIT])
    );
    const manifest:any = {
      product: 'YWI operations platform',
      build: BUILD,
      schema: SCHEMA,
      package_version: PACKAGE_VERSION,
      generated_at: generatedAt,
      generated_by: actor.email || actor.full_name || actor.id,
      period: {
        period_close_id: periodClose?.id || null,
        period_code: periodClose?.period_code || null,
        period_start: periodStart,
        period_end: periodEnd,
        close_status: periodClose?.close_status || null,
        period_lock_status: periodClose?.period_lock_status || null,
      },
      readiness: readiness[0] || {},
      close_cockpit: closeCockpit ? {
        build: closeCockpit.build,
        ready_for_hard_lock: closeCockpit.ready_for_hard_lock,
        required_gate_count: closeCockpit.required_gate_count,
        blocking_gate_count: closeCockpit.blocking_gate_count,
      } : null,
      source_row_counts: sourceRows,
      source_query_counts: sourceQueryCounts,
      source_query_truncation_possible: sourceQueryTruncation,
      files: fileRows.map((file) => ({
        filename:file.filename,
        row_count:file.rows.length,
        source:file.source,
        filter:file.filter,
        note:file.note || null,
        row_limit:ROW_LIMIT,
        truncation_possible:file.rows.length >= ROW_LIMIT,
      })),
      controls: {
        private_storage_bucket: BUCKET,
        signed_download_seconds: 900,
        posting_execution_authorized: false,
        provider_mutation: false,
        jobs_writeback: false,
      },
      limitations: [
        'This package is a management and accountant-review export, not a filed tax return or accountant-reviewed financial statement.',
        'A/R and A/P aging uses current balance/aging at generation for documents dated on or before period end; YW does not claim a reconstructed historical aging snapshot.',
        'Verify chart-of-accounts mapping, tax treatment, bank reconciliation sign-off, and final journal approval before filing or remittance.',
        `Each exported source is bounded to ${ROW_LIMIT} rows; manifest entries flag any source that reaches that bound for manual completeness review.`,
      ]
    };

    const readme = [
      title, '',
      `Build ${BUILD} · Accountant Export Package v${PACKAGE_VERSION}`,
      `Period: ${periodStart} to ${periodEnd}`,
      `Period close: ${periodClose?.period_code || periodClose?.id || 'not linked'}`,
      `Generated: ${generatedAt}`,
      '',
      'Contents:',
      ...manifest.files.map((file:any) => `- ${file.filename}: ${file.row_count} row(s) · ${file.source} · ${file.filter}${file.note ? ` · ${file.note}` : ''}`),
      '- close-cockpit.json: Build 316 close-gate snapshot',
      '- manifest.json: Build 317 provenance, row counts and controls',
      '',
      'Review reminders:',
      ...manifest.limitations.map((item:string) => `- ${item}`),
      '',
      'Safety boundary:',
      '- Finance posting execution is not authorized by this export.',
      '- Provider/payment mutation is not authorized by this export.',
      '- The ZIP is stored privately and downloaded through a short-lived signed URL.',
    ].join('\n');

    const zipFiles: Record<string, Uint8Array> = {
      'manifest.json': strToU8(JSON.stringify(manifest, null, 2)),
      'README.txt': strToU8(readme),
      'close-cockpit.json': strToU8(JSON.stringify(closeCockpit || { available:false }, null, 2)),
    };
    for (const file of fileRows) zipFiles[file.filename] = strToU8(toCsv(file.rows));

    const archive = zipSync(zipFiles, { level: 6 });
    const hash = await sha256Hex(archive);
    const stamp = generatedAt.replace(/[:.]/g, '-');
    const storagePath = `${periodStart.slice(0,4)}/${periodStart}_to_${periodEnd}/v2-${stamp}-${hash.slice(0,12)}.zip`;
    const { error: uploadError } = await admin.storage.from(BUCKET).upload(storagePath, archive, { contentType:'application/zip', upsert:false, cacheControl:'private, max-age=0' });
    if (uploadError) throw uploadError;

    const payload = { ...manifest, sha256:hash, size_bytes:archive.byteLength, storage_path:storagePath };
    const { data: exportRow, error: exportError } = await admin.from('accountant_handoff_exports').insert({
      export_kind:'closeout_bundle',
      entity_scope:periodClose?.id ? 'accounting_period_close' : 'accounting_period',
      entity_id:periodClose?.id || `${periodStart}:${periodEnd}`,
      source_period_close_id:periodClose?.id || null,
      export_status:'generated',
      export_title:title,
      export_markdown:readme,
      export_payload:payload,
      package_status:'prepared',
      bundle_kind:'management_close_bundle',
      delivery_channel:'download',
      bundle_item_count:fileRows.length + 3,
      bundle_payload:{ package_version:PACKAGE_VERSION, files:manifest.files, readiness:manifest.readiness, close_cockpit:manifest.close_cockpit },
      generated_by_profile_id:actor.id,
      generated_at:generatedAt,
      artifact_storage_path:storagePath,
      artifact_sha256:hash,
      artifact_size_bytes:archive.byteLength,
      artifact_content_type:'application/zip',
      artifact_expires_at:new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      source_schema_version:SCHEMA
    }).select('*').single();
    if (exportError) throw exportError;

    let closeSnapshot:any = {};
    if (periodClose?.id) {
      const { data, error: closeSnapshotError } = await admin.rpc('ywi_rpc_capture_accountant_close_snapshot', {
        p_export_id: exportRow.id,
        p_period_close_id: periodClose.id,
        p_actor_profile_id: actor.id
      });
      if (closeSnapshotError) throw closeSnapshotError;
      closeSnapshot = closeSnapshot || {};
      await admin.from('accounting_period_closes').update({
        accountant_package_export_id: exportRow.id,
        close_package_manifest: {
          build:BUILD,
          package_version:PACKAGE_VERSION,
          export_id:exportRow.id,
          sha256:hash,
          generated_at:generatedAt,
          file_count:fileRows.length + 3,
          source_row_counts:sourceRows,
          source_query_counts:sourceQueryCounts,
          source_query_truncation_possible:sourceQueryTruncation,
        },
        updated_at:generatedAt,
      }).eq('id', periodClose.id);
    }

    const items = [
      ...manifest.files.map((file:any, index:number) => ({
        export_id:exportRow.id,
        item_kind:'csv',
        item_label:file.filename,
        source_type:file.source,
        source_id:periodClose?.id || null,
        item_order:index + 1,
        item_payload:file,
      })),
      {
        export_id:exportRow.id,
        item_kind:'json',
        item_label:'close-cockpit.json',
        source_type:'month-end-close-cockpit',
        source_id:periodClose?.id || null,
        item_order:90,
        item_payload:manifest.close_cockpit || {},
      },
      {
        export_id:exportRow.id,
        item_kind:'manifest',
        item_label:'manifest.json',
        source_type:'accountant-export-v2',
        source_id:periodClose?.id || null,
        item_order:99,
        item_payload:{ sha256:hash, size_bytes:archive.byteLength, package_version:PACKAGE_VERSION, source_row_counts:sourceRows, source_query_counts:sourceQueryCounts, source_query_truncation_possible:sourceQueryTruncation },
      },
      {
        export_id:exportRow.id,
        item_kind:'readme',
        item_label:'README.txt',
        source_type:'accountant-export-v2',
        source_id:periodClose?.id || null,
        item_order:100,
        item_payload:{},
      }
    ];
    const { error: itemError } = await admin.from('accountant_handoff_export_items').insert(items);
    if (itemError) throw itemError;

    const { data: signed, error: signedError } = await admin.storage.from(BUCKET).createSignedUrl(storagePath, 900, { download:`${title.replace(/[^a-z0-9-_]+/gi,'-')}.zip` });
    if (signedError || !signed?.signedUrl) throw signedError || new Error('The package was created but a private download link could not be issued.');

    return Response.json({
      ok:true,
      build:BUILD,
      schema:SCHEMA,
      package_version:PACKAGE_VERSION,
      export:exportRow,
      manifest,
      close_mapping_snapshot:closeSnapshot,
      download_url:signed.signedUrl,
      expires_in_seconds:900,
      posting_execution_authorized:false,
      provider_mutation:false,
      jobs_writeback:false,
    }, { headers:corsHeaders });
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 500;
    const message = error instanceof Error ? error.message : 'Could not generate accountant export.';
    return Response.json({ ok:false, build:BUILD, package_version:PACKAGE_VERSION, error:message, posting_execution_authorized:false, provider_mutation:false }, { status, headers:corsHeaders });
  }
});
