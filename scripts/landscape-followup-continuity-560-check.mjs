import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=p=>fs.readFileSync(p,'utf8');
const sql=read('sql/landscape_followup_continuity_560.sql');
const ui=read('js/landscape-followup-continuity-560.js');
const pkg=JSON.parse(read('package.json'));
const must=(s,fragments,where)=>fragments.forEach(f=>assert.ok(s.includes(f),`YW560 ${where} missing ${f}`));
must(sql,[
 'ywi_landscape_followup_provider_reports_560','ywi_landscape_reopen_links_560',
 'enable row level security','owner_user_id=(select auth.uid())',
 'ywi_rpc_landscape_provider_report_560',"current_user<>'service_role'",
 'grant execute on function public.ywi_rpc_landscape_provider_report_560',
 'to service_role','p_receipt_sha256',"provider='rosevear-comms-hub'",
 'provider_reported_state',"delivery_independently_verified',false",
 'ywi_rpc_landscape_reopen_560','perform public.ywi_422_assert_owner(p_company_id)',
 'perform public.ywi_422_assert_jobs_create()','pg_advisory_xact_lock',
 'p_expected_closed_version','p_expected_dispatch_signature',
 'public.ywi_landscape_dispatch_signature_557',
 "action='customer_followup_requested'",
 "public.ywi_rpc_landscape_recovery_556(p_company_id,p_request_id,'open'",
 'ywi_landscape_recovery_audit_556','ORIGINAL_556_EXCEPTION_REOPENED_SUPERVISOR_HOLD',
 'ywi_rpc_landscape_continuity_review_560',
 'ywi_landscape_supervisor_acknowledgements_557',
 'v_ack.supervisor_profile_id=v_dispatch.assigned_supervisor_profile_id',
 'HOLD_FRESH_ORIGINAL_SUPERVISOR_ACK',
 "'master_shell_connection_proven',false",
 "'owner_acceptance_in_master',false",
 "'customer_message_sent_verified',false",
 'company_scope_only'
],'SQL');
for(const original of ['jobs','work_orders','dispatch_schedule_items',
 'ywi_landscape_customer_confirmations_556','ywi_landscape_supervisor_acknowledgements_557']){
 assert.ok(!new RegExp(`\\b(insert into|update|delete from)\\s+public\\.${original}\\b`,'i').test(sql),
  `YW560 cannot directly mutate original ${original}`);
}
assert.ok(!/grant\s+execute\b[^;]*\bto\s+(?:anon|authenticated)\b/i.test(
 sql.slice(sql.indexOf('create or replace function public.ywi_rpc_landscape_provider_report_560'),
 sql.indexOf('create table if not exists public.ywi_landscape_reopen_links_560'))));
must(ui,['owner560Company','owner560Case','owner560ProviderHistory','owner560ReopenHistory',
 'owner560Supervisor','owner560Reason','owner560Note','owner560Attest','owner560Reopen',
 "sb.rpc('ywi_rpc_landscape_continuity_review_560'",
 "sb.rpc('ywi_rpc_landscape_reopen_560'",
 'company_scope_only!==true','delivery_independently_verified!==false',
 'customer_message_sent_verified!==false','owner_acceptance_in_master!==false',
 "document.addEventListener('ywi:auth-changed'",'HOLD'],'UI');
assert.ok(!/sb\.rpc\(['"]ywi_rpc_landscape_provider_report_560['"]/.test(ui),
 'Owner must never call protected provider receiver');
assert.ok(!/\.from\(['"](?:dispatch_schedule_items|work_orders)['"]\)\s*\.(?:insert|update|upsert|delete)/i.test(ui),
 'No browser mutations to canonical Jobs or Dispatch');
must(read('index.html'),['landscape-followup-continuity-560.js'],'Index');
must(read('package.json'),['landscape-followup-continuity-560-check.mjs'],'Package');
must(pkg.scripts['test:landscape-supervisor-resolution-558'],
 ['landscape-followup-continuity-560-check.mjs'],'Existing CI source lane');
must(pkg.scripts['test:browser:landscape-supervisor-resolution-558'],
 ['landscape-followup-continuity-560.spec.mjs'],'Existing CI browser lane');
must(read('.github/workflows/staging-browser-integration.yml'),
 ['npm run test:landscape-supervisor-resolution-558',
  'npm run test:browser:landscape-supervisor-resolution-558'],'Retained GitHub CI');
console.log('YW560 service-role provider reports, original 556 reopening, supervisor continuation and owner/tenant HOLD PASS');
