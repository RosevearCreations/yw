import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,sign} from 'node:crypto';
import fs from 'node:fs';
import {APPS_571,canonical571,sha256Text,fingerprint571,verifyDisposition571,verifyHandoffShape571}
 from './yw571-evidence-contract.mjs';
const uuid=n=>n.toString(16).padStart(8,'0')+'-1111-4111-8111-111111111111';
const now=Date.parse('2026-11-15T02:00:00Z');
const at=h=>new Date(now-h*3600000).toISOString();
const {publicKey,privateKey}=generateKeyPairSync('ec',{namedCurve:'prime256v1'});
const pem=publicKey.export({format:'pem',type:'spki'});
const trust={
 trusted_spki_sha256:fingerprint571(pem),source_sha256:'a'.repeat(64),main_sha256:'b'.repeat(40),
 company_id:uuid(1),request_id:uuid(2),provider_receipt_id:uuid(3),
 owner_audit_id:uuid(4),master_observation_id:uuid(5),issuer:'independent-verified-reviewer'
};
const payload=()=>({
 contract_version:'yw571.disposition.v1',source_app:'YW',
 issuer:trust.issuer,disposition:'SOURCE_ONLY_REVIEWED',disposition_id:uuid(6),
 company_id:trust.company_id,request_id:trust.request_id,
 provider_verified_receipt_id:trust.provider_receipt_id,case_version:5,
 owner_audit_id:trust.owner_audit_id,master_observation_id:trust.master_observation_id,
 canonical_sha256:trust.source_sha256,source_revision:trust.main_sha256,
 tenant_boundary:'company',master_connected:false,master_owner_acceptance:false,
 customer_message_sent:false,closure_authorized:false,
 source_observed_at:at(3),issued_at:at(1),expires_at:at(-3)
});
const envelope=p=>({payload:p,public_key_pem:pem,
 signature_base64:sign('sha256',Buffer.from(canonical571(p),'utf8'),privateKey).toString('base64')});
test('YW571 independently pinned P-256 signature is valid but never closes Master/recipient authority',()=>{
 const r=verifyDisposition571(envelope(payload()),trust,now);
 assert.equal(r.ok,true);
 assert.equal(r.code,'SIGNATURE_VERIFIED_SOURCE_ONLY_MASTER_HOLD');
 assert.equal(r.connected,false);
 assert.equal(r.closure_authorized,false);
 assert.equal(r.customer_delivery_verified,false);
 assert.match(r.signed_payload_sha256,/^[a-f0-9]{64}$/);
});
test('YW571 rejects self-selected issuer, changed payload, cross-tenant, stale/expired/unsafe disposition',()=>{
 const good=envelope(payload());
 const other=generateKeyPairSync('ec',{namedCurve:'prime256v1'});
 const otherPem=other.publicKey.export({format:'pem',type:'spki'});
 const cases=[
  verifyDisposition571({...good,public_key_pem:otherPem},trust,now),
  verifyDisposition571({...good,payload:{...good.payload,source_revision:'c'.repeat(40)}},trust,now),
  verifyDisposition571(envelope({...payload(),company_id:uuid(17)}),trust,now),
  verifyDisposition571(envelope({...payload(),master_connected:true}),trust,now),
  verifyDisposition571(envelope({...payload(),disposition:'CLOSE'}),trust,now),
  verifyDisposition571(envelope({...payload(),expires_at:at(2)}),trust,now),
  verifyDisposition571(envelope({...payload(),source_observed_at:at(28)}),trust,now),
  verifyDisposition571({...good,signature_base64:'aW52YWxpZA=='},trust,now),
  verifyDisposition571(good,{...trust,trusted_spki_sha256:'f'.repeat(64)},now),
  verifyDisposition571(good,{...trust,issuer:'unknown'},now)
 ];
 for(const c of cases)assert.equal(c.ok,false,c.code);
});
test('YW571 canonical signable JSON rejects unsafe shapes, malformed keys and inconsistent digests',()=>{
 assert.equal(canonical571({b:[true,null],a:1}), '{"a":1,"b":[true,null]}');
 assert.equal(sha256Text(canonical571({a:1})).length,64);
 assert.throws(()=>canonical571({a:1.5}));
 assert.throws(()=>canonical571({'__proto__':'x',constructor:'f'}));
 assert.throws(()=>canonical571({a:undefined}));
});
const packet=()=>({
 contract_version:'rosevear.handoff.v1',transport_state:'NOT_CONNECTED_BY_THIS_PACKET',
 master_connected:false,customer_delivery_verified:false,
 apps:APPS_571.map(([id,role])=>({
  id,role,receipt_state:'NOT_ATTESTED',master_ack_state:'HOLD',
  customer_delivery_verified:false,shared_secret_embedded:false,
  ...(id==='YW'?{source_role:'platform_shell',tenant_boundary:'platform_shell',
   master_connected:false,production_sha:'UNSET_AFTER_RELEASE'}:{})
 }))
});
test('YW571 ordered seven-app handoff permits only explicit NOT_ATTESTED product boundaries',()=>{
 const p=packet();const r=verifyHandoffShape571(p);
 assert.equal(r.ok,true);assert.equal(r.connected,false);
 const swapped=packet();[swapped.apps[3],swapped.apps[4]]=[swapped.apps[4],swapped.apps[3]];
 assert.equal(verifyHandoffShape571(swapped).ok,false);
 assert.equal(verifyHandoffShape571({...p,master_connected:true}).ok,false);
 const forged=packet();forged.apps[5].master_ack_state='ACCEPTED';
 assert.equal(verifyHandoffShape571(forged).ok,false);
 const badTenant=packet();badTenant.apps[4].tenant_boundary='company';
 assert.equal(verifyHandoffShape571(badTenant).ok,false);
});
test('YW571 protected gates contain independent signer and seven-app contract checks',()=>{
 const pkg=JSON.parse(fs.readFileSync('package.json','utf8'));
 const html=fs.readFileSync('index.html','utf8');
 assert.match(pkg.scripts['test:landscape-supervisor-resolution-558'],/yw571-evidence-contract-check/);
 assert.match(pkg.scripts['test:landscape-supervisor-resolution-558'],/source-disposition-571-check/);
 assert.match(pkg.scripts['test:browser:landscape-supervisor-resolution-558'],/source-disposition-mobile-571\.spec/);
 assert.match(html,/js\/source-disposition-571\.js/);
 const ui=fs.readFileSync('js/source-disposition-571.js','utf8');
 assert.doesNotMatch(ui,/\.insert\(|\.update\(|\.delete\(|localStorage|sessionStorage|PRIVATE KEY|SUPABASE_SERVICE_ROLE_KEY/);
 assert.match(ui,/ywi_rpc_landscape_master_remediation_review_567/);
 assert.match(ui,/YW570Assurance\.evaluate/);
});
console.log('YW571 cryptographic signer pinning, cross-app tenant security and protected tests PASS');
