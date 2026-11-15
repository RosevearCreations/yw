import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const files=['js/landscape-resolution-568.js','js/source-recurrence-569.js',
 'js/source-assurance-570.js','js/source-disposition-571.js'];
const scripts=files.map(f=>fs.readFileSync(f,'utf8'));
const window={addEventListener(){}},document={readyState:'loading',addEventListener(){}};
new vm.Script(scripts.at(-1),{filename:files.at(-1)});
vm.runInNewContext(scripts.join('\n'),{window,document,Date});
const evaluate=window.YW571Disposition.evaluate;
const id=n=>n.toString(16).padStart(8,'0')+'-1111-4111-8111-111111111111';
const owner=id(1),company=id(2),request=id(3),receipt=id(4),
 reconciled=id(5),reopened=id(6),audit=id(7),observed=id(8);
const now=Date.parse('2026-11-15T03:00:00Z'),when=h=>new Date(now-h*3600000).toISOString();
const scope={company,request,receipt};
const source=()=>({
 company_id:company,request_id:request,provider_verified_receipt_id:receipt,
 case_version:5,canonical_sha256:'a'.repeat(64),
 company_scope_only:true,read_only:true,source_only_not_continuous_uptime:true,
 master_owner_acceptance:false,master_connected:false,
 customer_message_sent:false,recipient_delivery_independently_verified:false,
 source_reconciliation_id:reconciled,source_reopen_id:reopened,
 latest_source_remediation_audit_id:audit,
 source_reopened_at:when(20),master_observation_id:observed,
 master_observation_verified_at:when(17),
 source_receipt_stale:false,signed_risk_after_reconciliation:false,
 source_sla_breached:false,source_sla_state:'WITHIN_TARGET',
 source_sla_due_at:when(-6),remediation_audit_current:true,
 independent_source_remediation_ready:false,
 remediation_classification:'SOURCE_REMEDIATION_AUDITED_MASTER_HOLD',
 checked_at:when(0.01)
});
const event=(n,action,ago,extra={})=>({
 id:id(n),idempotency_key:id(n+100),company_id:company,request_id:request,
 provider_verified_receipt_id:receipt,case_version:5,owner_user_id:owner,
 action,recorded_at:when(ago),...extra
});
const rows=()=>[
 event(7,'audit_signed_source_remediation',16,{anchor_master_observation_id:observed}),
 event(6,'record_signed_source_reopen',20),event(10,'record_signed_source_reopen',72),
 event(11,'request_supervised_remediation_recheck',80)
];
test('YW571 readiness requires original signed recurrence proof while leaving signer, renewal and Master unverified',()=>{
 const r=evaluate(source(),scope,rows(),owner,now);
 assert.equal(r.code,'SOURCE_DISPOSITION_REVIEW_READY_SIGNER_HOLD');
 assert.equal(r.closure_authorized,false);
 assert.equal(r.master_connected,false);
 assert.equal(r.customer_delivery_verified,false);
 assert.equal(r.signed_disposition,'NO_INDEPENDENT_SIGNATURE_ADMITTED');
 assert.equal(r.renewal_effectiveness,'NOT_ESTABLISHED');
 assert.equal(r.security_tiers.length,5);
});
test('YW571 warns on independent signed observation age >=18h without granting closure',()=>{
 const s=source();s.master_observation_verified_at=when(19);
 const h=rows();h[0].recorded_at=when(18);
 const r=evaluate(s,scope,h,owner,now);
 assert.equal(r.code,'SIGNED_RENEWAL_AND_DISPOSITION_RECHECK_HOLD');
 assert.equal(r.observation_age_hours,19);
 assert.equal(r.closure_authorized,false);
});
test('YW571 original source SLA or signed risk HOLD overrides optimistic past audits',()=>{
 assert.equal(evaluate({...source(),source_sla_due_at:when(0.1)},scope,rows(),owner,now).code,'HOLD_SOURCE_OR_DISPOSITION_UNVERIFIED');
 assert.equal(evaluate({...source(),signed_risk_after_reconciliation:true},scope,rows(),owner,now).code,'HOLD_SOURCE_OR_DISPOSITION_UNVERIFIED');
 assert.equal(evaluate({...source(),master_connected:true},scope,rows(),owner,now).code,'HOLD_SOURCE_OR_DISPOSITION_UNVERIFIED');
 assert.equal(evaluate(source(),scope,[],owner,now).code,'HOLD_SOURCE_OR_DISPOSITION_UNVERIFIED');
 assert.equal(evaluate(source(),{...scope,company:id(99)},rows(),owner,now).code,'HOLD_SOURCE_OR_DISPOSITION_UNVERIFIED');
});
test('YW571 original source-only watch never represents signed provider or cross-app ACK',()=>{
 const h=rows().filter(r=>r.id!==id(10));
 const r=evaluate(source(),scope,h,owner,now);
 assert.equal(r.code,'SOURCE_STABILITY_REVIEW_SIGNER_HOLD');
 assert.equal(window.YW571Disposition.apps.length,7);
 assert.deepEqual(Array.from(window.YW571Disposition.apps,x=>x[0]),
  ['ai-data-platform','rosevear-ai-hub','rosevear-comms-hub','iCamp','YW','devilndove','rosiedazzlers']);
});
test('YW571 new UI and offline verifier remain in protected source/browser CI lanes',()=>{
 const html=fs.readFileSync('index.html','utf8');
 const pkg=JSON.parse(fs.readFileSync('package.json','utf8'));
 const ui=scripts.at(-1);
 assert.match(html,/js\/source-disposition-571\.js/);
 assert.match(pkg.scripts['test:landscape-supervisor-resolution-558'],/source-disposition-571-check/);
 assert.match(pkg.scripts['test:landscape-supervisor-resolution-558'],/yw571-evidence-contract-check/);
 assert.match(pkg.scripts['test:browser:landscape-supervisor-resolution-558'],/source-disposition-mobile-571\.spec/);
 assert.doesNotMatch(ui,/\.insert\(|\.update\(|\.delete\(|localStorage|sessionStorage|SUPABASE_SERVICE_ROLE_KEY/);
 assert.match(ui,/YW570Assurance\.evaluate/);
 assert.match(ui,/ywi_rpc_landscape_master_remediation_review_567/);
});
console.log('YW571 source-only disposition review, SLA renewal gating and cross-app hierarchy checks PASS');
