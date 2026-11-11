import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=p=>fs.readFileSync(p,'utf8');
const sql=read('sql/landscape_dispatch_reconciliation_557.sql');
const ui=read('js/landscape-dispatch-reconciliation-557.js');
const index=read('index.html');
const workflow=read('.github/workflows/staging-browser-integration.yml');
const release=read('scripts/release-job-separation-check.mjs');
const pkg=JSON.parse(read('package.json'));
const required=(text,need,label)=>need.forEach(word=>assert.ok(text.includes(word),`${label} missing ${word}`));
required(sql,['ywi_landscape_supervisor_acknowledgements_557','enable row level security',
 'revoke all on public.ywi_landscape_supervisor_acknowledgements_557',
 'ywi_rpc_landscape_supervisor_queue_557','ywi_rpc_landscape_supervisor_ack_557',
 'ywi_rpc_landscape_recovery_review_557','ywi_landscape_dispatch_signature_557',
 'perform public.ywi_422_assert_owner(p_company_id)',
 'public.ywi_rpc_landscape_availability_553',"v_availability->>'schedule_state'<>'company_dispatch_verified'",
 "v_dispatch.assigned_supervisor_profile_id is distinct from v_user",
 'pg_advisory_xact_lock','p_expected_case_version','p_expected_dispatch_signature',
 'idempotency key reused with changed payload','case_version','dispatch_signature',
 'critical_72h','overdue_48h','aging_24h','coalesce((auth.jwt()->>\'is_anonymous\')::boolean,false)',
 "v_case.state='closed_verified'",'original_dispatch_mutated',"'dispatch_authorized',false",
 "'customer_confirmation_authorized',false","'master_shell_connection_proven',false"],'SQL');
for(const original of ['work_orders','jobs','dispatch_schedule_items','crew_members','ywi_landscape_capacity_plans_553',
 'ywi_landscape_recovery_cases_556','ywi_landscape_customer_confirmations_556'])
 assert.ok(!new RegExp(`\\b(insert into|update|delete from)\\s+public\\.${original}\\b`,'i').test(sql),`original ${original} must not be mutated`);
assert.ok(!/grant\s+(?:insert|update|delete|all)\b[^;]*\bon\s+public\.ywi_landscape_supervisor_acknowledgements_557\s+to\s+authenticated/i.test(sql),'No direct ledger writes');
assert.ok(!/grant\s+execute\b[^;]*\bto\s+anon\b/i.test(sql),'No anonymous RPC exposure');
required(ui,['owner557Company','owner557Case','owner557Refresh','owner557Aging','owner557Capacity',
 'owner557Supervisor','supervisor557Case','supervisor557Ack','supervisor557Attest',
 "sb.rpc('ywi_rpc_landscape_recovery_review_557'", "sb.rpc('ywi_rpc_landscape_supervisor_queue_557'",
 "sb.rpc('ywi_rpc_landscape_supervisor_ack_557'",'original_source_authority!==true',
 'dispatch_authorized!==false','state.user.id','current.data?.user?.id!==state.user.id',
 'owner_user_id!==id',"document.addEventListener('ywi:auth-changed'",'HOLD'],'UI');
assert.ok(!/\.from\(['"](?:work_orders|dispatch_schedule_items|ywi_landscape_supervisor_acknowledgements_557)['"]\)\s*\.(?:insert|update|delete|upsert)/i.test(ui),'No client source or direct ack writes');
required(index,['landscape-dispatch-reconciliation-557.js'],'Index');
required(workflow,['npm run test:landscape-dispatch-reconciliation-557',
 'npm run test:browser:landscape-dispatch-reconciliation-557'],'CI');
assert.ok(pkg.scripts['test:landscape-dispatch-reconciliation-557']&&pkg.scripts['test:browser:landscape-dispatch-reconciliation-557']);
required(release,['221 browser suites','111 direct lane calls',"lanes.includes('npm run test:browser:landscape-dispatch-reconciliation-557')"],'Release accounting');
console.log('YW557 original Dispatch capacity, age buckets, supervisor identity, source signatures, tenant isolation and CI: PASS');
