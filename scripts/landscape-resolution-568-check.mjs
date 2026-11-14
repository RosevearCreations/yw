import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync('js/landscape-resolution-568.js','utf8');
const html=fs.readFileSync('index.html','utf8');
const packageJson=JSON.parse(fs.readFileSync('package.json','utf8'));
new vm.Script(source,{filename:'landscape-resolution-568.js'});
const window={addEventListener(){}};
const document={readyState:'loading',addEventListener(){}};
vm.runInNewContext(source,{window,document,Date});
const evaluate=window.YW568Resolution.evaluate;
const company='11111111-1111-4111-8111-111111111111';
const request='22222222-2222-4222-8222-222222222222';
const receipt='33333333-3333-4333-8333-333333333333';
const reconciled='44444444-4444-4444-8444-444444444444';
const reopened='55555555-5555-4555-8555-555555555555';
const audit='66666666-6666-4666-8666-666666666666';
const observation='77777777-7777-4777-8777-777777777777';
const scope={company,request,receipt};
const evidence=()=>({
 company_id:company,request_id:request,provider_verified_receipt_id:receipt,
 case_version:5,canonical_sha256:'a'.repeat(64),
 company_scope_only:true,read_only:true,source_only_not_continuous_uptime:true,
 master_owner_acceptance:false,master_connected:false,customer_message_sent:false,
 recipient_delivery_independently_verified:false,
 source_reconciliation_id:reconciled,source_reopen_id:reopened,
 latest_source_remediation_audit_id:audit,
 source_reopened_at:'2026-11-14T09:00:00Z',
 master_observation_id:observation,master_observation_verified_at:'2026-11-14T10:00:00Z',
 source_receipt_stale:false,signed_risk_after_reconciliation:false,
 source_sla_breached:false,source_sla_state:'WITHIN_TARGET',
 remediation_audit_current:true,independent_source_remediation_ready:false,
 remediation_classification:'SOURCE_REMEDIATION_AUDITED_MASTER_HOLD'
});
test('YW568 only accepts original owner scope with independent post-reopen source-only audit',()=>{
 assert.equal(evaluate(evidence(),scope).code,'SOURCE_RESOLUTION_VERIFIED_MASTER_HOLD');
 assert.match(evaluate(evidence(),scope).reason,/Master CONNECTED/);
 assert.equal(evaluate(evidence(),{...scope,company:receipt}).code,'HOLD_UNVERIFIED_SOURCE');
 assert.equal(evaluate({...evidence(),master_connected:true},scope).code,'HOLD_UNVERIFIED_SOURCE');
 assert.equal(evaluate({...evidence(),customer_message_sent:true},scope).code,'HOLD_UNVERIFIED_SOURCE');
 assert.equal(evaluate({...evidence(),source_reopened_at:'2026-11-14T11:00:00Z'},scope).code,'HOLD_UNVERIFIED_SOURCE');
 assert.equal(evaluate({...evidence(),latest_source_remediation_audit_id:null},scope).code,'HOLD_UNVERIFIED_SOURCE');
});
test('YW568 fails closed on signed risks, stale proof, SLA breach, and lack of owner audit',()=>{
 assert.equal(evaluate({...evidence(),signed_risk_after_reconciliation:true},scope).code,'REOPEN_REQUIRED');
 assert.equal(evaluate({...evidence(),source_receipt_stale:true},scope).code,'HOLD_UNVERIFIED_SOURCE');
 assert.equal(evaluate({...evidence(),source_sla_breached:true},scope).code,'SLA_RECOVERY_HOLD');
 assert.equal(evaluate({...evidence(),source_sla_state:'UNKNOWN'},scope).code,'SLA_RECOVERY_HOLD');
 assert.equal(evaluate({...evidence(),remediation_audit_current:false,independent_source_remediation_ready:true},scope).code,'OWNER_AUDIT_REQUIRED');
 assert.equal(evaluate({...evidence(),remediation_audit_current:false,independent_source_remediation_ready:false},scope).code,'HOLD_UNVERIFIED_SOURCE');
 assert.equal(evaluate({...evidence(),source_reconciliation_id:null},scope).code,'HOLD_UNVERIFIED_SOURCE');
});
test('YW568 cannot elevate provider/master authority, change theme, or write source data',()=>{
 assert.match(source,/ywi_rpc_landscape_master_remediation_review_567/);
 assert.doesNotMatch(source,/\.insert\(|\.update\(|\.delete\(|rpc\(['"]ywi_rpc_landscape_master_remediation_decide_567/);
 assert.doesNotMatch(source,/SUPABASE_SERVICE_ROLE_KEY/);
 assert.match(source,/YWNavigationAcceptance566/);
 assert.match(source,/owner568NavStatus/);
 assert.match(html,/js\/landscape-resolution-568\.js/);
 assert.match(packageJson.scripts['test:landscape-supervisor-resolution-558'],/landscape-resolution-568-check/);
 assert.match(packageJson.scripts['test:browser:landscape-supervisor-resolution-558'],/operations-command-accessibility-568\.spec/);
});
console.log('YW568 source-only resolution, SLA effectiveness and cross-module accessible route regression checks PASS');
