import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { zipSync, strToU8 } from "npm:fflate@0.8.2";

const BUILD = '2026-06-20a';
const SCHEMA = 152;
const BUCKET = 'accountant-exports';
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
const roleRank = (role: unknown) => ({ worker:10, employee:10, staff:10, onsite_admin:18, site_leader:20, supervisor:30, hse:40, job_admin:45, admin:50 }[clean(role, 60).toLowerCase()] || 0);

function csvCell(value: unknown) {
  let text = value === null || value === undefined ? '' : (typeof value === 'object' ? JSON.stringify(value) : String(value));
  // Spreadsheet formula injection guard for user-controlled strings.
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

async function getActor(admin: any, req: Request) {
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) throw new HttpError(401, 'Sign in is required.');
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data?.user?.id) throw new HttpError(401, 'Your session could not be verified.');
  const { data: profile, error: profileError } = await admin.from('profiles').select('id, role, full_name, email, is_active').eq('id', data.user.id).maybeSingle();
  if (profileError || !profile || profile.is_active === false) throw new HttpError(403, 'An active staff profile is required.');
  if (roleRank(profile.role) < 45) throw new HttpError(403, 'Your role cannot generate an accountant export package.');
  return profile;
}
async function list(admin: any, table: string, select = '*', filter?: (query: any) => any) {
  let query = admin.from(table).select(select).limit(5000);
  if (filter) query = filter(query);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
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
    const action = clean(body.action || 'prepare', 60);

    if (action === 'download') {
      const exportId = clean(body.export_id, 80);
      if (!/^[0-9a-f-]{36}$/i.test(exportId)) throw new HttpError(400, 'A valid export_id is required.');
      const { data: existing, error } = await admin.from('accountant_handoff_exports').select('id, export_title, artifact_storage_path, artifact_expires_at, export_status').eq('id', exportId).maybeSingle();
      if (error) throw error;
      if (!existing?.artifact_storage_path || existing.export_status !== 'generated') throw new HttpError(404, 'A generated export artifact was not found.');
      const { data, error: signedError } = await admin.storage.from(BUCKET).createSignedUrl(existing.artifact_storage_path, 900, { download: `${clean(existing.export_title || 'accountant-package', 120).replace(/[^a-z0-9-_]+/gi,'-')}.zip` });
      if (signedError || !data?.signedUrl) throw signedError || new Error('Could not create a private download link.');
      return Response.json({ ok:true, export_id:existing.id, download_url:data.signedUrl, expires_in_seconds:900 }, { headers:corsHeaders });
    }

    if (action !== 'prepare') throw new HttpError(400, 'Unsupported accountant-export action.');
    const fallback = previousMonthRange();
    const periodStart = isIsoDate(body.period_start) ? clean(body.period_start, 20) : fallback.start;
    const periodEnd = isIsoDate(body.period_end) ? clean(body.period_end, 20) : fallback.end;
    if (periodEnd < periodStart) throw new HttpError(400, 'The end date must be on or after the start date.');
    const title = clean(body.export_title || `Accounting package ${periodStart} to ${periodEnd}`, 180);

    const [journals, invoices, bills, paymentActions, reconciliation, taxReview, trialBalance, readiness] = await Promise.all([
      list(admin, 'gl_journal_batches', '*', (q) => q.gte('batch_date', periodStart).lte('batch_date', periodEnd).order('batch_date')),
      list(admin, 'ar_invoices', '*', (q) => q.gte('invoice_date', periodStart).lte('invoice_date', periodEnd).order('invoice_date')),
      list(admin, 'ap_bills', '*', (q) => q.gte('bill_date', periodStart).lte('bill_date', periodEnd).order('bill_date')),
      list(admin, 'v_payment_action_workbench', '*', (q) => q.gte('transaction_date', periodStart).lte('transaction_date', periodEnd).order('transaction_date')),
      list(admin, 'v_reconciliation_action_workbench', '*', (q) => q.gte('created_at', `${periodStart}T00:00:00Z`).lte('created_at', `${periodEnd}T23:59:59Z`).order('created_at')),
      list(admin, 'v_sales_tax_prep_directory', '*', (q) => q.gte('period_start', periodStart).lte('period_end', periodEnd).order('period_start')),
      list(admin, 'v_gl_trial_balance_summary', '*', (q) => q.order('account_number')),
      list(admin, 'v_accountant_export_readiness', '*', (q) => q.limit(1))
    ]);

    const fileRows: Array<[string, Record<string, unknown>[]]> = [
      ['journals.csv', journals], ['ar-invoices.csv', invoices], ['ap-bills.csv', bills],
      ['payment-actions.csv', paymentActions], ['reconciliation-actions.csv', reconciliation],
      ['sales-tax-review.csv', taxReview], ['trial-balance.csv', trialBalance]
    ];
    const manifest = {
      product: 'YWI operations platform', build: BUILD, schema: SCHEMA,
      generated_at: new Date().toISOString(), generated_by: actor.email || actor.full_name || actor.id,
      period_start: periodStart, period_end: periodEnd,
      readiness: readiness[0] || {},
      files: fileRows.map(([filename, rows]) => ({ filename, row_count: rows.length })),
      limitations: ['This package is a management and accountant-review export, not a filed tax return.', 'Verify chart-of-accounts mapping, tax treatment, bank reconciliation sign-off, and final journal approval before filing or remittance.']
    };
    const readme = [
      title, '', `Period: ${periodStart} to ${periodEnd}`, `Generated: ${manifest.generated_at}`,
      '', 'Contents:', ...manifest.files.map((file) => `- ${file.filename}: ${file.row_count} row(s)`),
      '', 'Review reminders:', ...manifest.limitations.map((item) => `- ${item}`)
    ].join('\n');
    const zipFiles: Record<string, Uint8Array> = {
      'manifest.json': strToU8(JSON.stringify(manifest, null, 2)),
      'README.txt': strToU8(readme)
    };
    for (const [filename, rows] of fileRows) zipFiles[filename] = strToU8(toCsv(rows));
    const archive = zipSync(zipFiles, { level: 6 });
    const hash = await sha256Hex(archive);
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const storagePath = `${periodStart.slice(0,4)}/${periodStart}_to_${periodEnd}/${stamp}-${hash.slice(0,12)}.zip`;
    const { error: uploadError } = await admin.storage.from(BUCKET).upload(storagePath, archive, { contentType:'application/zip', upsert:false, cacheControl:'private, max-age=0' });
    if (uploadError) throw uploadError;

    const payload = { ...manifest, sha256:hash, size_bytes:archive.byteLength, storage_path:storagePath };
    const { data: exportRow, error: exportError } = await admin.from('accountant_handoff_exports').insert({
      export_kind:'closeout_bundle', entity_scope:'accounting_period', entity_id:`${periodStart}:${periodEnd}`,
      export_status:'generated', export_title:title, export_markdown:readme, export_payload:payload,
      bundle_kind:'management_close_bundle', delivery_channel:'download', bundle_item_count:fileRows.length + 2,
      bundle_payload:{ files:manifest.files, readiness:manifest.readiness }, generated_by_profile_id:actor.id,
      generated_at:new Date().toISOString(), artifact_storage_path:storagePath, artifact_sha256:hash,
      artifact_size_bytes:archive.byteLength, artifact_content_type:'application/zip',
      artifact_expires_at:new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), source_schema_version:SCHEMA
    }).select('*').single();
    if (exportError) throw exportError;
    const items = [...manifest.files.map((file, index) => ({ export_id:exportRow.id, item_kind:'csv', item_label:file.filename, source_type:'accountant-export', source_id:null, item_order:index + 1, item_payload:file })),
      { export_id:exportRow.id, item_kind:'manifest', item_label:'manifest.json', source_type:'accountant-export', source_id:null, item_order:99, item_payload:{ sha256:hash, size_bytes:archive.byteLength } },
      { export_id:exportRow.id, item_kind:'readme', item_label:'README.txt', source_type:'accountant-export', source_id:null, item_order:100, item_payload:{} }
    ];
    const { error: itemError } = await admin.from('accountant_handoff_export_items').insert(items);
    if (itemError) throw itemError;
    const { data: signed, error: signedError } = await admin.storage.from(BUCKET).createSignedUrl(storagePath, 900, { download:`${title.replace(/[^a-z0-9-_]+/gi,'-')}.zip` });
    if (signedError || !signed?.signedUrl) throw signedError || new Error('The package was created but a private download link could not be issued.');

    return Response.json({ ok:true, export:exportRow, manifest, download_url:signed.signedUrl, expires_in_seconds:900 }, { headers:corsHeaders });
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 500;
    const message = error instanceof Error ? error.message : 'Could not generate accountant export.';
    return Response.json({ ok:false, error:message }, { status, headers:corsHeaders });
  }
});
