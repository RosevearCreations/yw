import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source568=fs.readFileSync('js/landscape-resolution-568.js','utf8');
const source569=fs.readFileSync('js/source-recurrence-569.js','utf8');
const html=fs.readFileSync('index.html','utf8');
const pkg=JSON.parse(fs.readFileSync('package.json','utf8'));
new vm.Script(source569,{filename:'source-recurrence-569.js'});
const window={addEventListener(){}};
const document={readyState:'loading',addEventListener(){}};
vm.runInNewContext(source568+'\n'+source569,{window,document,Date});
const evaluate=window.YW569Recurrence.evaluate;
const uuid=n=>n.toString(16).padStart(8,'0')+'-1111-4111-8111-111111111111';
const owner=uuid(1),company=uuid(2),request=uuid(3),receipt=uuid(4);
const reconciled=uuid(5),reopen=uuid(6),audit=uuid(7),observation=uuid(8);
const now=Date.parse('2026-11-14T18:00:00Z');
const date=(hoursAgo)=>new Date(now-hoursAgo*3600000).toISOString();
const scope={company,request,receipt};
const source=()=>({
 company_id:company,request_id:request,provider_verified_receipt_id:receipt,
 case_version:5,canonical_sha256:'a'.repeat(64),
 company_scope_only:true,read_only:true,source_only_not_continuous_uptime:true,
 master_owner_acceptance:false,master_connected:false,
 customer_message_sent:false,recipient_delivery_independently_verified:false,
 source_reconciliation_id:reconciled,source_reopen_id:reopen,
 latest_source_remediation_audit_id:audit,source_reopened_at:date(2),
 master_observation_id:observation,master_observation_verified_at:date(1.5),
 source_receipt_stale:false,signed_risk_after_reconciliation:false,
 source_sla_breached:false,source_sla_state:'WITHIN_TARGET',
 remediation_audit_current:true,independent_source_remediation_ready:false,
 remediation_classification:'SOURCE_REMEDIATION_AUDITED_MASTER_HOLD',
 checked_at:date(0.005)
});
const event=(n,action,ago,extra={})=>({
 id:uuid(n),idempotency_key:uuid(n+100),owner_user_id:owner,
 company_id:company,request_id:request,provider_verified_receipt_id:receipt,
 case_version:5,action,recorded_at:date(ago),...extra
});
const history=()=>[
 event(7,'audit_signed_source_remediation',1,{anchor_master_observation_id:observation}),
 event(6,'record_signed_source_reopen',2),
 event(9,'request_supervised_remediation_recheck',8)
];
test('YW569 trusts only owner-scoped append-only actions with a fresh independent post-reopen SLA proof',()=>{
 const result=evaluate(source(),scope,history(),owner,now);
 assert.equal(result.code,'SOURCE_RECOVERY_OBSERVED_MASTER_HOLD');
 assert.equal(result.metrics.reopened_7d,1);
 assert.equal(result.metrics.reopened_30d,1);
 assert.equal(result.metrics.audited_30d,1);
 assert.equal(result.metrics.rechecks_30d,1);
 assert.equal(result.metrics.historical_sla_recovery_percentage,null);
 assert.equal(result.metrics.master_connected,false);
 assert.equal(result.metrics.continuous_uptime_verified,false);
});
test('YW569 tracks recurring independently sourced reopen actions without granting Master acceptance',()=>{
 const v=evaluate(source(),scope,[...history(),event(10,'record_signed_source_reopen',12)],owner,now);
 assert.equal(v.code,'REPEAT_REOPEN_REVIEW_MASTER_HOLD');
 assert.equal(v.metrics.reopened_30d,2);
 assert.match(v.reason,/Master CONNECTED remains HOLD/);
});
test('YW569 denies stale, foreign, truncated, future, duplicate and altered history',()=>{
 const base=history();
 const blocked=[
  {rows:base.map((x,i)=>i===0?{...x,owner_user_id:uuid(29)}:x)},
  {rows:base.map((x,i)=>i===0?{...x,company_id:uuid(29)}:x)},
  {rows:base.map((x,i)=>i===0?{...x,anchor_master_observation_id:uuid(29)}:x)},
  {rows:[base[0],base[0]]},
  {rows:[...base,{...base[1],id:uuid(44),idempotency_key:uuid(144),recorded_at:date(-1)}]},
  {rows:[...Array.from({length:101},(_,i)=>event(i+1000,'record_signed_source_reopen',i+1))]},
  {rows:[]}
 ];
 for(const item of blocked)assert.equal(evaluate(source(),scope,item.rows,owner,now).code,'HOLD_UNVERIFIED_RETENTION');
 assert.equal(evaluate({...source(),checked_at:date(1)},scope,base,owner,now).code,'HOLD_UNVERIFIED_RETENTION');
 assert.equal(evaluate(source(),{...scope,company:uuid(40)},base,owner,now).code,'HOLD_UNVERIFIED_RETENTION');
});
test('YW569 never uses past actions as an override for present SLA breach or new signed risk',()=>{
 const sla=evaluate({...source(),source_sla_breached:true},scope,history(),owner,now);
 assert.equal(sla.code,'SLA_RECOVERY_HOLD');
 const risk=evaluate({...source(),signed_risk_after_reconciliation:true},scope,history(),owner,now);
 assert.equal(risk.code,'REOPEN_REQUIRED');
 assert.equal(evaluate({...source(),remediation_audit_current:false},scope,history(),owner,now).metrics.independently_verified_current_audit,false);
});
test('YW569 UI remains read-only and included in protected source/browser lanes',()=>{
 assert.doesNotMatch(source569,/\.insert\(|\.update\(|\.delete\(|localStorage|sessionStorage|service_role|STRIPE_SECRET_KEY/);
 assert.match(source569,/ywi_landscape_master_remediation_audits_567/);
 assert.match(source569,/ywi_rpc_landscape_master_remediation_review_567/);
 assert.match(source569,/YW568Resolution\.auditNavigation/);
 assert.match(source569,/ywi:auth-changed/);
 assert.match(html,/js\/source-recurrence-569\.js/);
 assert.match(pkg.scripts['test:landscape-supervisor-resolution-558'],/source-recurrence-569-check/);
 assert.match(pkg.scripts['test:browser:landscape-supervisor-resolution-558'],/source-recurrence-mobile-569\.spec/);
});
console.log('YW569 retained original-owner source recurrence and signed SLA trend boundaries PASS');
