import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=path=>fs.readFileSync(path,'utf8');
const sql=read('sql/landscape_recovery_closure_559.sql');
const ui=read('js/landscape-recovery-closure-559.js');
const pkg=JSON.parse(read('package.json'));
const must=(source,keys,tag)=>keys.forEach(k=>assert.ok(source.includes(k),`${tag}: missing ${k}`));
must(sql,[
 'ywi_landscape_closure_evidence_559','enable row level security',
 'revoke all on public.ywi_landscape_closure_evidence_559',
 'perform public.ywi_422_assert_owner(p_company_id)',
 'perform public.ywi_422_assert_jobs_create()',
 'ywi_rpc_landscape_closure_record_559','ywi_rpc_landscape_closure_review_559',
 'pg_advisory_xact_lock','p_expected_case_version','p_expected_dispatch_signature',
 'ywi_landscape_dispatch_signature_557','v_case.state<>\'closed_verified\'',
 'ywi_landscape_recovery_audit_556','v_close.result->>\'customer_confirmation_verified\'',
 'ywi_landscape_customer_confirmations_556','case_version=v_case.case_version-1',
 'v_customer.decision','ywi_landscape_supervisor_acknowledgements_557',
 'v_ack.supervisor_profile_id','ywi_landscape_resolution_events_558',
 'v_gate.supervisor_ack_id','idempotency key reused with different action',
 'closure_reviewed','supervisor_outcome_reviewed','customer_followup_requested',
 "'customer_message_sent',false","'dispatch_authorized',false",
 "'owner_acceptance_in_master',false",'company_scope_only'
],'SQL');
for(const original of ['work_orders','jobs','dispatch_schedule_items',
 'ywi_landscape_recovery_cases_556','ywi_landscape_customer_confirmations_556',
 'ywi_landscape_supervisor_acknowledgements_557','ywi_landscape_resolution_events_558']){
 assert.ok(!new RegExp(`\\b(insert into|update|delete from)\\s+public\\.${original}\\b`,'i').test(sql),
  `YW559 cannot mutate original ${original}`);
}
assert.ok(!/grant\s+(?:insert|update|delete|all)\b[^;]*\bon\s+public\.ywi_landscape_closure_evidence_559\s+to\s+authenticated/i.test(sql));
assert.ok(!/grant\s+execute\b[^;]*\bto\s+anon\b/i.test(sql));
must(ui,['owner559Company','owner559Case','owner559Refresh','owner559Timeline',
 'owner559Closure','owner559Customer','owner559Supervisor','owner559Record',
 'owner559Attest', "sb.rpc('ywi_rpc_landscape_closure_review_559'",
 "sb.rpc('ywi_rpc_landscape_closure_record_559'",
 'current.data?.user?.id!==state.user.id','owner_user_id!==id',
 'company_scope_only!==true','customer_message_sent!==false',
 'owner_acceptance_in_master!==false',
 "document.addEventListener('ywi:auth-changed'",'HOLD'],'UI');
assert.ok(!/\.from\(['"](?:dispatch_schedule_items|ywi_landscape_closure_evidence_559)['"]\)\s*\.(?:insert|update|delete|upsert)/i.test(ui));
must(read('index.html'),['landscape-recovery-closure-559.js'],'Index');
must(read('package.json'),['landscape-recovery-closure-559-check.mjs'],'Package');
must(pkg.scripts['test:landscape-supervisor-resolution-558'],['landscape-recovery-closure-559-check.mjs'],'CI direct lane chaining');
must(pkg.scripts['test:browser:landscape-supervisor-resolution-558'],
 ['landscape-recovery-closure-559.spec.mjs'],'CI browser lane chaining');
must(read('.github/workflows/staging-browser-integration.yml'),
 ['npm run test:landscape-supervisor-resolution-558',
  'npm run test:browser:landscape-supervisor-resolution-558'],'Existing workflow lanes');
assert.ok(!/owner_accepted\s*:\s*true|connected\s*:\s*true|customer_message_sent\s*:\s*true/.test(sql+ui));
console.log('YW559 immutable closure, original customer/Dispatch binding, staged follow-up and company-owner security PASS');
