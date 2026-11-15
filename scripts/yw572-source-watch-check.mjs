import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const files=['js/landscape-resolution-568.js','js/source-recurrence-569.js',
 'js/source-assurance-570.js','js/source-disposition-571.js','js/source-security-572.js'];
const scripts=files.map(path=>fs.readFileSync(path,'utf8'));
const window={addEventListener(){}},document={readyState:'loading',addEventListener(){}};
new vm.Script(scripts.at(-1),{filename:files.at(-1)});
vm.runInNewContext(scripts.join('\n'),{window,document,Date});
const check=window.YW572Security.check;
const id=n=>n.toString(16).padStart(8,'0')+'-1111-4111-8111-111111111111';
const owner=id(1),company=id(2),request=id(3),receipt=id(4),
 reconciled=id(5),reopened=id(6),audit=id(7),observed=id(8);
const now=Date.parse('2026-11-15T14:00:00Z'),when=h=>new Date(now-h*3600000).toISOString();
const scope={company,request,receipt};
const source=()=>({
 company_id:company,request_id:request,provider_verified_receipt_id:receipt,
 case_version:5,canonical_sha256:'a'.repeat(64),
 company_scope_only:true,read_only:true,source_only_not_continuous_uptime:true,
 master_owner_acceptance:false,master_connected:false,
 customer_message_sent:false,recipient_delivery_independently_verified:false,
 source_reconciliation_id:reconciled,source_reopen_id:reopened,
 latest_source_remediation_audit_id:audit,source_reopened_at:when(3),
 master_observation_id:observed,master_observation_verified_at:when(2),
 source_receipt_stale:false,signed_risk_after_reconciliation:false,
 source_sla_breached:false,source_sla_state:'WITHIN_TARGET',
 source_sla_due_at:when(-6),remediation_audit_current:true,
 independent_source_remediation_ready:false,
 remediation_classification:'SOURCE_REMEDIATION_AUDITED_MASTER_HOLD',
 checked_at:when(0.01)
});
const entry=(n,action,ago,extra={})=>({
 id:id(n),idempotency_key:id(n+100),company_id:company,request_id:request,
 provider_verified_receipt_id:receipt,case_version:5,owner_user_id:owner,
 action,recorded_at:when(ago),...extra
});
const rows=()=>[
 entry(7,'audit_signed_source_remediation',1,{anchor_master_observation_id:observed}),
 entry(6,'record_signed_source_reopen',3),
 entry(10,'record_signed_source_reopen',72),
 entry(11,'request_supervised_remediation_recheck',80)
];
test('YW572 original owner source review cannot auto-enroll governance keys or admit replay custody',()=>{
 const result=check(source(),scope,rows(),owner,now);
 assert.equal(result.code,'SOURCE_READBACK_VERIFIED_REGISTRY_UNENROLLED_MASTER_HOLD');
 assert.equal(result.registered_issuers,0);
 assert.equal(result.independently_verified_custodians,0);
 assert.equal(result.replay_admission,'NOT_AUTHORIZED');
 assert.equal(result.master_connected,false);
 assert.equal(result.customer_delivery_verified,false);
 assert.equal(result.app_count,7);
});
test('YW572 denies stale source, unauthorized owner, foreign tenant, and current SLA risk',()=>{
 const cases=[
  check({...source(),checked_at:when(2)},scope,rows(),owner,now),
  check({...source(),source_sla_breached:true},scope,rows(),owner,now),
  check({...source(),master_connected:true},scope,rows(),owner,now),
  check(source(),{...scope,company:id(19)},rows(),owner,now),
  check(source(),scope,rows().map((x,i)=>i===0?{...x,owner_user_id:id(19)}:x),owner,now),
  check(source(),scope,[],owner,now)
 ];
 for(const result of cases)assert.notEqual(result.code,'SOURCE_READBACK_VERIFIED_REGISTRY_UNENROLLED_MASTER_HOLD');
});
test('YW572 enforces seven-app exact trust boundary and browser source-only UI',()=>{
 assert.deepEqual(Array.from(window.YW572Security.apps,x=>x[0]),
  ['ai-data-platform','rosevear-ai-hub','rosevear-comms-hub','iCamp',
   'YW','devilndove','rosiedazzlers']);
 const html=fs.readFileSync('index.html','utf8');
 const pkg=JSON.parse(fs.readFileSync('package.json','utf8'));
 assert.match(html,/js\/source-security-572\.js/);
 assert.match(pkg.scripts['test:landscape-supervisor-resolution-558'],/yw572-issuer-registry-check/);
 assert.match(pkg.scripts['test:landscape-supervisor-resolution-558'],/yw572-source-watch-check/);
 assert.match(pkg.scripts['test:browser:landscape-supervisor-resolution-558'],/source-security-mobile-572\.spec/);
 assert.doesNotMatch(scripts.at(-1),/\.insert\(|\.update\(|\.delete\(|localStorage|sessionStorage|SERVICE_ROLE|PRIVATE KEY|crypto\.subtle/);
 assert.match(scripts.at(-1),/YW571Disposition\?\.evaluate/);
 assert.match(scripts.at(-1),/ywi_rpc_landscape_master_remediation_review_567/);
});
console.log('YW572 signed owner source, issuer enrollment HOLD, tenant protection and source-only UI boundaries PASS');
