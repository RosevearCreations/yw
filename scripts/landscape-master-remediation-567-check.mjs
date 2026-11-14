import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const read=p=>fs.readFileSync(p,'utf8');
const sql=read('sql/landscape_master_remediation_567.sql');
const owner=read('js/landscape-master-remediation-567.js');
const drill=read('js/operations-command-drilldown-567.js');
const gate=read('js/command-navigation-acceptance-566.js');
const css=read('theme-operations-drilldown-567.css');
const html=read('index.html');
const pkg=JSON.parse(read('package.json'));
const must=(x,t,name)=>t.forEach(v=>assert.ok(x.includes(v),'YW567 '+name+' missing '+v));
new vm.Script(owner,{filename:'landscape-master-remediation-567.js'});
new vm.Script(drill,{filename:'operations-command-drilldown-567.js'});
must(sql,[
 'ywi_landscape_master_remediation_audits_567',
 'enable row level security',
 'ywi_rpc_landscape_master_remediation_review_567',
 'ywi_rpc_landscape_master_drift_forecast_review_566',
 'ywi_landscape_master_escalation_outcomes_566',
 'ywi_landscape_master_observations_563',
 "'reconcile_signed_source_recovery'",
 "v_last_risk>v_reconciled.recorded_at",
 "v_last_risk>v_audited.recorded_at",
 'v_observation.verified_at>v_reopened.recorded_at',
 "v_source->>'source_recovery_effective_after_escalation'='true'",
 "v_source->>'forecast_classification'='SOURCE_STABLE_OBSERVATION_WATCH'",
 "'REOPEN_NEW_INDEPENDENT_SIGNED_RISK'",
 "'SOURCE_SLA_BREACH_REMEDIATION_REQUIRED'",
 "'STALE_SIGNED_RECEIPT_RECHECK'",
 "'FRESH_SIGNED_SOURCE_REMEDIATION_READY'",
 "'SOURCE_REMEDIATION_AUDITED_MASTER_HOLD'",
 'ywi_rpc_landscape_master_remediation_decide_567',
 'pg_advisory_xact_lock',
 'for update;',
 'p_owner_attested is distinct from true',
 '567 new independently signed remediation after reopen required',
 '567 conflicting owner idempotency replay',
 'ywi_rpc_landscape_master_remediation_summary_567',
 "current_user<>'service_role'",
 "'tenant_boundary','platform_shell'",
 "'master_owner_acceptance',false",
 "'master_connected',false",
 "'recipient_delivery_independently_verified',false"
], 'SQL');
assert.ok(!/grant\s+(?:insert|update|delete)[^;]*on\s+public\.ywi_landscape_master_remediation_audits_567\s+to\s+(?:authenticated|service_role)/i.test(sql),
 'YW567 original owner ledger cannot permit raw inserts/updates/deletes');
for(const prior of ['jobs','work_orders','dispatch_schedule_items',
 'ywi_landscape_master_observations_563',
 'ywi_landscape_master_escalation_outcomes_566',
 'ywi_landscape_provider_verified_561']){
 assert.ok(!new RegExp('\\b(?:insert into|update|delete from)\\s+public\\.'+prior+'\\b','i').test(sql),
  'YW567 must never mutate source '+prior);
}
must(owner,[
 'owner567Company','owner567Case','owner567Receipt',
 "sb.rpc('ywi_rpc_landscape_master_remediation_review_567'",
 "sb.rpc('ywi_rpc_landscape_master_remediation_decide_567'",
 'signed_risk_after_reconciliation===true',
 'independent_source_remediation_ready===true',
 'master_owner_acceptance===false',
 'master_connected===false',
 "document.addEventListener('ywi:auth-changed'",
 'SOURCE_REMEDIATION_ACTION_RECORDED_MASTER_HOLD'
], 'Original owner');
assert.ok(!owner.includes('SUPABASE_SERVICE_ROLE_KEY'));
must(drill,[
 '.yw565-command-card',
 "document.createElement('details')",
 "document.createElement('summary')",
 "'yw567-drilldown'",
 'aria-label',
 "window.YWNavigationAcceptance566?.isOffered?.(route)===true",
 'a.dataset.yw567Route=target',
 "window.addEventListener('hashchange'",
 'heading.focus({preventScroll:true})',
 "document.addEventListener('ywi:auth-changed'",
 "document.addEventListener('yw:theme-changed'"
], 'Accessible drilldown');
assert.ok(!drill.includes('SUPABASE_SERVICE_ROLE_KEY'));
assert.ok(!drill.includes('window.YWI_SB'));
must(gate,['workspace550SysopLink','YWNavigationAcceptance566'],'Original route authority');
must(css,[
 'html[data-yw-theme="futuristic"] .yw567-drilldown',
 'summary:focus-visible',
 '[aria-current="page"]',
 '@media(max-width:760px)',
 'prefers-reduced-motion'
], 'Scoped Futuristic appearance');
assert.ok(!/^\s*(?:body|html|:root)\s*\{/m.test(css),'Standard Blue must not change');
must(html,[
 'landscape-master-remediation-567.js',
 'operations-command-drilldown-567.js',
 'theme-operations-drilldown-567.css',
 'theme-futuristic-564.css'
], 'HTML');
must(pkg.scripts['test:landscape-supervisor-resolution-558'],
 ['landscape-master-remediation-567-check.mjs'],'Retained source acceptance');
must(pkg.scripts['test:browser:landscape-supervisor-resolution-558'],
 ['landscape-master-remediation-567.spec.mjs',
  'operations-command-drilldown-567.spec.mjs'],'Retained browser acceptance');
console.log('YW567 signed original owner source reopen/SLA remediation & accessible restricted command drilldown PASS');
