import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const read = p => fs.readFileSync(p, 'utf8');
const sql = read('sql/landscape_provider_runtime_pilot_562.sql');
const ui = read('js/landscape-provider-runtime-pilot-562.js');
const pkg = JSON.parse(read('package.json'));
const index = read('index.html');
const must = (text, fragments, name) => fragments.forEach(f =>
 assert.ok(text.includes(f), 'YW562 '+name+' missing '+f));
new vm.Script(ui, {filename:'landscape-provider-runtime-pilot-562.js'});
must(sql, [
 'ywi_landscape_provider_pilot_decisions_562',
 'references\n  public.ywi_landscape_provider_verified_561',
 'unique(company_id,idempotency_key)',
 'unique(company_id,request_id,case_version,provider_verified_receipt_id)',
 'enable row level security',
 'for select to authenticated',
 'auth.uid()',
 "is_anonymous",
 'ywi_rpc_landscape_provider_pilot_review_562',
 'ywi_rpc_landscape_reopen_review_561',
 "v_receipt.verified_at>=now()-interval '24 hours'",
 "v_case.case_version=v_receipt.case_version",
 "v_source->>'owner_decision'='continuity_reviewed'",
 "v_source->>'fresh_original_supervisor_verified'='true'",
 "v_source->>'closure_source_verified'='true'",
 'ywi_rpc_landscape_provider_pilot_decide_562',
 'p_owner_attested is distinct from true',
 'pg_advisory_xact_lock',
 'for update',
 '562 conflicting owner idempotency replay',
 'ywi_rpc_landscape_master_pilot_summary_562',
 "current_user<>'service_role'",
 "'source_role','platform_shell'",
 "'tenant_boundary','platform_shell'",
 "'master_owner_acceptance',false",
 "'master_connected',false",
 "'recipient_delivery_independently_verified',false",
], 'SQL');
assert.ok(/revoke all on public\.ywi_landscape_provider_pilot_decisions_562 from public,anon,authenticated/i.test(sql));
assert.ok(!/grant\s+(?:insert|update|delete)\s+on\s+public\.ywi_landscape_provider_pilot_decisions_562\s+to\s+(?:anon|authenticated)/i.test(sql));
for(const original of ['jobs','work_orders','dispatch_schedule_items',
 'ywi_landscape_provider_verified_561','ywi_landscape_recovery_cases_556']){
 assert.ok(!new RegExp('\\b(?:insert into|update|delete from)\\s+public\\.'+original+'\\b','i').test(sql),
  'YW562 must never mutate source '+original);
}
must(ui,[
 'owner562Company','owner562Case','owner562Receipt','owner562Decide',
 'ywi_landscape_provider_verified_561',
 "sb.rpc('ywi_rpc_landscape_provider_pilot_review_562'",
 "sb.rpc('ywi_rpc_landscape_provider_pilot_decide_562'",
 'source_pilot_ready===true','master_owner_acceptance===false',
 'recipient_delivery_independently_verified===false',
 "document.addEventListener('ywi:auth-changed'",
 'SOURCE_OWNER_PILOT_RECORDED_MASTER_HOLD'
], 'Owner UI');
assert.ok(!ui.includes("ywi_rpc_landscape_provider_verify_561"), 'No browser provider receiver writes');
assert.ok(!ui.includes('SUPABASE_SERVICE_ROLE_KEY'), 'No privileged credentials in browser');
assert.ok(!ui.includes('customer_send'), 'No browser customer-send operation');
must(index,['landscape-provider-runtime-pilot-562.js'], 'Index');
must(pkg.scripts['test:landscape-supervisor-resolution-558'],
 ['landscape-provider-runtime-pilot-562-check.mjs'], 'Retained source lane');
must(pkg.scripts['test:browser:landscape-supervisor-resolution-558'],
 ['landscape-provider-runtime-pilot-562.spec.mjs'], 'Retained browser lane');
console.log('YW562 immutable original source pilot, exact receipt, anti-replay, RLS and independent Master HOLD PASS');
