import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source568=fs.readFileSync('js/landscape-resolution-568.js','utf8');
const source569=fs.readFileSync('js/source-recurrence-569.js','utf8');
const source570=fs.readFileSync('js/source-assurance-570.js','utf8');
const html=fs.readFileSync('index.html','utf8');
const pkg=JSON.parse(fs.readFileSync('package.json','utf8'));
const window={addEventListener(){}},document={readyState:'loading',addEventListener(){}};
new vm.Script(source570,{filename:'source-assurance-570.js'});
vm.runInNewContext(source568+'\n'+source569+'\n'+source570,{window,document,Date});
const evaluate=window.YW570Assurance.evaluate;
const id=n=>n.toString(16).padStart(8,'0')+'-1111-4111-8111-111111111111';
const owner=id(1),company=id(2),request=id(3),receipt=id(4),reconciliation=id(5),reopen=id(6),audit=id(7),observation=id(8);
const earlier=id(10);
const now=Date.parse('2026-11-14T22:00:00Z');
const date=hours=>new Date(now-hours*3600000).toISOString();
const scope={company,request,receipt};
const source=()=>({
 company_id:company,request_id:request,provider_verified_receipt_id:receipt,
 case_version:5,canonical_sha256:'a'.repeat(64),company_scope_only:true,read_only:true,
 source_only_not_continuous_uptime:true,master_owner_acceptance:false,
 master_connected:false,customer_message_sent:false,recipient_delivery_independently_verified:false,
 source_reconciliation_id:reconciliation,source_reopen_id:reopen,
 latest_source_remediation_audit_id:audit,source_reopened_at:date(20),
 master_observation_id:observation,master_observation_verified_at:date(19),
 source_receipt_stale:false,signed_risk_after_reconciliation:false,
 source_sla_breached:false,source_sla_state:'WITHIN_TARGET',
 remediation_audit_current:true,independent_source_remediation_ready:false,
 remediation_classification:'SOURCE_REMEDIATION_AUDITED_MASTER_HOLD',
 source_sla_due_at:date(-3),checked_at:date(0.01)
});
const entry=(n,action,hours,extra={})=>({
 id:id(n),idempotency_key:id(n+100),owner_user_id:owner,company_id:company,
 request_id:request,provider_verified_receipt_id:receipt,case_version:5,
 action,recorded_at:date(hours),...extra
});
const history=()=>[
 entry(7,'audit_signed_source_remediation',18,{anchor_master_observation_id:observation}),
 entry(6,'record_signed_source_reopen',20),
 entry(10,'record_signed_source_reopen',72),
 entry(11,'request_supervised_remediation_recheck',80)
];
test('YW570 warns on real 18h signed observation aging and 4h deadline while human closure remains gated',()=>{
 const r=evaluate(source(),scope,history(),owner,now);
 assert.equal(r.code,'RECURRENCE_CLOSURE_REVIEW_READY_MASTER_HOLD');
 assert.equal(r.closure_authorized,false);
 assert.equal(r.metrics.reopened_90d,2);
 assert.equal(r.metrics.historical_sla_recovery_percentage,null);
 assert.equal(r.metrics.master_connected,false);
 assert.equal(r.alerts.some(a=>a.code==='SIGNED_EVIDENCE_AGING'),true);
 assert.equal(r.alerts.some(a=>a.code==='SLA_DEADLINE_APPROACHING'),true);
 assert.equal(r.alerts.some(a=>a.code==='LONG_HORIZON_REOPEN_PATTERN'),true);
});
test('YW570 with only one reopen stays original signed source stability WATCH, not closure',()=>{
 const r=evaluate(source(),scope,history().filter(x=>x.id!==earlier),owner,now);
 assert.equal(r.code,'SIGNED_SOURCE_STABILITY_WATCH_MASTER_HOLD');
 assert.equal(r.closure_authorized,false);
});
test('YW570 refuses source evidence older than 24h and unverified retained history',()=>{
 assert.equal(evaluate({...source(),master_observation_verified_at:date(25)},scope,history(),owner,now).code,'HOLD_UNVERIFIED_SOURCE');
 assert.equal(evaluate(source(),scope,[],owner,now).code,'HOLD_UNVERIFIED_SOURCE');
 assert.equal(evaluate(source(),{...scope,company:id(40)},history(),owner,now).code,'HOLD_UNVERIFIED_SOURCE');
 assert.equal(evaluate(source(),scope,history().map((x,i)=>i===0?{...x,owner_user_id:id(33)}:x),owner,now).code,'HOLD_UNVERIFIED_SOURCE');
});
test('YW570 never allows an expired SLA deadline or current signed SLA breach to count as closure readiness',()=>{
 const expired=evaluate({...source(),source_sla_due_at:date(0.2)},scope,history(),owner,now);
 assert.equal(expired.code,'SLA_RECOVERY_EVIDENCE_HOLD');
 assert.equal(expired.alerts.some(a=>a.code==='SLA_DEADLINE_REACHED'),true);
 const breached=evaluate({...source(),source_sla_breached:true,source_sla_state:'BREACHED'},scope,history(),owner,now);
 assert.notEqual(breached.code,'RECURRENCE_CLOSURE_REVIEW_READY_MASTER_HOLD');
 assert.equal(breached.closure_authorized,false);
 const risky=evaluate({...source(),signed_risk_after_reconciliation:true},scope,history(),owner,now);
 assert.equal(risky.code,'REOPEN_REQUIRED');
});
test('YW570 requires owner audit newer than last signed reopen, never edits audit or escalates access',()=>{
 const h=history();h.splice(0,0,entry(12,'record_signed_source_reopen',1));
 const r=evaluate(source(),scope,h,owner,now);
 assert.notEqual(r.code,'RECURRENCE_CLOSURE_REVIEW_READY_MASTER_HOLD');
 assert.equal(r.closure_authorized,false);
 assert.doesNotMatch(source570,/\.insert\(|\.update\(|\.delete\(|localStorage|sessionStorage|SUPABASE_SERVICE_ROLE_KEY/);
 assert.match(source570,/ywi_rpc_landscape_master_remediation_review_567/);
 assert.match(source570,/YW569Recurrence\.auditContinuity/);
 assert.match(source570,/ywi:auth-changed/);
 assert.match(html,/js\/source-assurance-570\.js/);
 assert.match(pkg.scripts['test:landscape-supervisor-resolution-558'],/source-assurance-570-check/);
 assert.match(pkg.scripts['test:browser:landscape-supervisor-resolution-558'],/source-assurance-mobile-570\.spec/);
});
console.log('YW570 independent long-horizon source retention, aging, closure hold and navigation boundaries PASS');
