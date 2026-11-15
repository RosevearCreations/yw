import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {generateKeyPairSync,sign} from 'node:crypto';
import {APPS_571,canonical571,fingerprint571} from './yw571-evidence-contract.mjs';
import {verifyRegistry572,verifyRotation572,verifyEnvelope572,admitEnvelope572,PostgresCustody572}
 from './yw572-issuer-registry.mjs';

const uuid=n=>n.toString(16).padStart(8,'0')+'-1111-4111-8111-111111111111';
const now=Date.parse('2026-11-15T14:00:00Z');
const at=mins=>new Date(now+mins*60000).toISOString();
const key=()=>generateKeyPairSync('ec',{namedCurve:'prime256v1'});
const rootOwner=key(),rootCustodian=key();
const pinned=(k,witness_id)=>({witness_id,public_key_pem:k.publicKey.export({type:'spki',format:'pem'}),
 trusted_spki_sha256:fingerprint571(k.publicKey.export({type:'spki',format:'pem'}))});
const roots={
 owner:pinned(rootOwner,'governance-owner-1'),
 independent_custodian:pinned(rootCustodian,'governance-custodian-1')
};
const issuerKeys=new Map(APPS_571.map(([name])=>[name,key()]));
const appBoundary=role=>role==='master'?'master':role==='platform_shell'?'platform_shell':'internal_company';
const issuers=()=>APPS_571.map(([name,role],i)=>{
 const kp=issuerKeys.get(name),pem=kp.publicKey.export({type:'spki',format:'pem'});
 return {app_id:name,app_role:role,tenant_boundary:appBoundary(role),
  issuer_id:name==='YW'?'yw-original-owner':name+'-source-issuer',
  key_id:name==='YW'?'yw-key-v1':name.toLowerCase()+'-key-v1',
  audience:name==='YW'?'rosevear:yw:source-review':'rosevear:'+name.toLowerCase()+':handoff',
  public_key_pem:pem,spki_sha256:fingerprint571(pem),status:'active',
  valid_from:at(-180),valid_until:at(720),rotated_at:null,grace_until:null};
});
const signRegistry=payload=>({payload,approvals:[
 {role:'owner',witness_id:roots.owner.witness_id,
  signature_base64:sign('sha256',Buffer.from(canonical571(payload)),rootOwner.privateKey).toString('base64')},
 {role:'independent_custodian',witness_id:roots.independent_custodian.witness_id,
  signature_base64:sign('sha256',Buffer.from(canonical571(payload)),rootCustodian.privateKey).toString('base64')}
]});
const makePayload=()=>({contract_version:'rosevear.issuer-registry.v1',registry_id:uuid(50),
 version:1,issued_at:at(-75),expires_at:at(600),issuers:issuers()});
const base=()=>signRegistry(makePayload());
const trust={
 source_sha256:'a'.repeat(64),main_sha256:'b'.repeat(40),
 company_id:uuid(1),request_id:uuid(2),provider_receipt_id:uuid(3),
 owner_audit_id:uuid(4),master_observation_id:uuid(5),issuer:'yw-original-owner'
};
const disposition=(overrides={},privateKey=issuerKeys.get('YW').privateKey)=> {
 const p={contract_version:'yw571.disposition.v1',source_app:'YW',
  issuer:'yw-original-owner',audience:'rosevear:yw:source-review',
  signer_key_id:'yw-key-v1',registry_version:1,
  disposition:'SOURCE_ONLY_REVIEWED',disposition_id:uuid(6),nonce:uuid(9),
  company_id:trust.company_id,request_id:trust.request_id,
  provider_verified_receipt_id:trust.provider_receipt_id,case_version:5,
  owner_audit_id:trust.owner_audit_id,master_observation_id:trust.master_observation_id,
  canonical_sha256:trust.source_sha256,source_revision:trust.main_sha256,
  tenant_boundary:'company',master_connected:false,master_owner_acceptance:false,
  customer_message_sent:false,closure_authorized:false,
  source_observed_at:at(-42),issued_at:at(-24),expires_at:at(160),...overrides};
 return {payload:p,public_key_pem:issuerKeys.get('YW').publicKey.export({type:'spki',format:'pem'}),
  signature_base64:sign('sha256',Buffer.from(canonical571(p)),privateKey).toString('base64')};
};
test('YW572 two independent pinned governance roots enroll complete seven-app source registry',()=>{
 const r=verifyRegistry572(base(),roots,now);
 assert.equal(r.ok,true);assert.equal(r.code,'TWO_WITNESS_REGISTRY_VERIFIED_MASTER_HOLD');
 assert.equal(r.master_connected,false);
 assert.match(r.registry_sha256,/^[a-f0-9]{64}$/);
 assert.equal(base().payload.issuers.length,7);
});
test('YW572 rejects unilateral ownership, self-pins, altered app, duplicate key, wrong tenant or expired registry',()=>{
 const one=base();one.approvals.pop();
 const swap=base();swap.payload.issuers[3].app_id='YW';
 const duplicate=makePayload();duplicate.issuers[3].spki_sha256=duplicate.issuers[4].spki_sha256;
 const tenant=makePayload();tenant.issuers[4].tenant_boundary='company';
 const expired=makePayload();expired.expires_at=at(-1);
 const shared={...roots,independent_custodian:{...roots.owner,witness_id:'governance-custodian-1'}};
 const inputs=[
  verifyRegistry572(one,roots,now),verifyRegistry572(swap,roots,now),
  verifyRegistry572(signRegistry(duplicate),roots,now),
  verifyRegistry572(signRegistry(tenant),roots,now),
  verifyRegistry572(signRegistry(expired),roots,now),
  verifyRegistry572(base(),shared,now),
  verifyRegistry572(base(),{...roots,owner:{...roots.owner,trusted_spki_sha256:'f'.repeat(64)}},now)
 ];
 for(const r of inputs)assert.equal(r.ok,false,r.code);
});
test('YW572 exact-key source disposition is verified but not admitted without PostgreSQL custody',()=>{
 const r=verifyEnvelope572(disposition(),base(),roots,trust,now);
 assert.equal(r.ok,true);assert.equal(r.code,'PINNED_ENVELOPE_VERIFIED_CUSTODY_NOT_ADMITTED');
 assert.equal(r.master_connected,false);
 assert.equal(r.original_tenant_id,trust.company_id);
 assert.equal(verifyEnvelope572(disposition({audience:'rosevear:other:source-review'}),base(),roots,trust,now).ok,false);
 assert.equal(verifyEnvelope572(disposition({registry_version:9}),base(),roots,trust,now).ok,false);
 assert.equal(verifyEnvelope572(disposition({signer_key_id:'other-key'}),base(),roots,trust,now).ok,false);
 assert.equal(verifyEnvelope572(disposition({company_id:uuid(66)}),base(),roots,trust,now).ok,false);
});
const nextGeneration=()=>{
 const p=makePayload();p.version=2;p.issued_at=at(-10);
 const old=p.issuers.find(x=>x.app_id==='YW');
 old.status='grace';old.rotated_at=at(-15);old.grace_until=at(30);
 const fresh=key();const pem=fresh.publicKey.export({type:'spki',format:'pem'});
 p.issuers.push({...old,key_id:'yw-key-v2',public_key_pem:pem,spki_sha256:fingerprint571(pem),
  status:'active',valid_from:at(-12),valid_until:at(720),rotated_at:null,grace_until:null});
 return {manifest:signRegistry(p),fresh};
};
test('YW572 approves rotation only with second independent quorum and distinct replacement',()=>{
 const {manifest}=nextGeneration();
 const ok=verifyRotation572(base(),manifest,roots,now);
 assert.equal(ok.ok,true);assert.equal(ok.master_connected,false);
 assert.equal(verifyEnvelope572(disposition(),manifest,roots,trust,now).ok,false,
  'old generation envelope is replay denied because registry_version is signed');
 const grace=disposition({registry_version:2});
 assert.equal(verifyEnvelope572(grace,manifest,roots,trust,now).ok,true);
 const late=disposition({registry_version:2,issued_at:at(-1),source_observed_at:at(-2),expires_at:at(180)});
 assert.equal(verifyEnvelope572(late,manifest,roots,trust,now).ok,false);
 const beyond=structuredClone(manifest.payload);beyond.issuers.find(x=>x.app_id==='YW'&&x.key_id==='yw-key-v1').grace_until=at(3000);
 assert.equal(verifyRegistry572(signRegistry(beyond),roots,now).ok,false);
 const resurrect=structuredClone(manifest.payload);resurrect.version=3;resurrect.issued_at=at(-2);
 resurrect.issuers.find(x=>x.app_id==='YW'&&x.key_id==='yw-key-v1').status='active';
 resurrect.issuers.find(x=>x.app_id==='YW'&&x.key_id==='yw-key-v1').rotated_at=null;
 resurrect.issuers.find(x=>x.app_id==='YW'&&x.key_id==='yw-key-v1').grace_until=null;
 resurrect.issuers.find(x=>x.app_id==='YW'&&x.key_id==='yw-key-v2').status='revoked';
 assert.equal(verifyRotation572(manifest,signRegistry(resurrect),roots,now).ok,false);
 const missing=structuredClone(manifest.payload);missing.issuers=missing.issuers.filter(x=>x.key_id!=='yw-key-v2');
 assert.equal(verifyRotation572(base(),signRegistry(missing),roots,now).ok,false);
});
test('YW572 revocation is fail closed, including old signed receipts',()=>{
 const p=makePayload();p.issuers.find(x=>x.app_id==='YW').status='revoked';
 const r=verifyEnvelope572(disposition(),signRegistry(p),roots,trust,now);
 assert.equal(r.ok,false);assert.equal(r.code,'HOLD_REVOKED_OR_EXPIRED_ISSUER');
});
test('YW572 never admits an envelope using ephemeral memory storage or missing database authority',async()=>{
 const no=await admitEnvelope572(disposition(),base(),roots,trust,null,now);
 assert.equal(no.ok,false);assert.equal(no.code,'HOLD_NO_DURABLE_CUSTODY');
 const fake=await admitEnvelope572(disposition(),base(),roots,trust,{kind:'in-memory',claimIfAbsent:async()=>({status:'INSERTED'})},now);
 assert.equal(fake.ok,false);assert.equal(fake.code,'HOLD_NO_DURABLE_CUSTODY');
});
test('YW572 parameterized PostgreSQL unique insertion accepts once and rejects same nonce/disposition on replay',async()=>{
 const seenNonce=new Set(),seenDisp=new Set(),seenHash=new Set();
 const db={async query(sql,params){
  assert.match(sql,/insert into ywi_security_572\.replay_custody/);
  assert.match(sql,/on conflict do nothing returning payload_sha256/);
  assert.equal(params.length,9);
  const [app,tenant,,,,disposition,hash]=params;
  const nonce=params[4],key=app+'|'+tenant;
  if(seenNonce.has(key+'|'+nonce)||seenDisp.has(key+'|'+disposition)||seenHash.has(key+'|'+hash))
   return {rowCount:0,rows:[]};
  seenNonce.add(key+'|'+nonce);seenDisp.add(key+'|'+disposition);seenHash.add(key+'|'+hash);
  return {rowCount:1,rows:[{payload_sha256:hash}]};
 }};
 const store=new PostgresCustody572(db);
 const first=await admitEnvelope572(disposition(),base(),roots,trust,store,now);
 assert.equal(first.ok,true);assert.equal(first.code,'SOURCE_RECEIPT_DURABLY_CUSTODIED_MASTER_HOLD');
 assert.equal(first.master_connected,false);
 const again=await admitEnvelope572(disposition(),base(),roots,trust,store,now);
 assert.equal(again.ok,false);assert.equal(again.code,'HOLD_REPLAY');
 const altered=disposition({disposition_id:uuid(91)});
 const sameNonce=await admitEnvelope572(altered,base(),roots,trust,store,now);
 assert.equal(sameNonce.ok,false);assert.equal(sameNonce.code,'HOLD_REPLAY');
 const failed=await admitEnvelope572(disposition({nonce:uuid(27),disposition_id:uuid(28)}),
  base(),roots,trust,new PostgresCustody572({query:async()=>{throw Error('database unavailable')}}),now);
 assert.equal(failed.ok,false);assert.equal(failed.code,'HOLD_CUSTODY_UNAVAILABLE');
});
test('YW572 SQL is staging-only private, RLS enabled, client roles revoked and uniqueness enforced',()=>{
 const sql=fs.readFileSync('docs/security/YW572_STAGING_ONLY_REPLAY_REGISTRY_SCHEMA.sql','utf8');
 assert.match(sql,/STAGING-ONLY DESIGN DRAFT/);
 assert.match(sql,/create schema if not exists ywi_security_572/);
 assert.match(sql,/enable row level security/);
 assert.match(sql,/force row level security/);
 assert.match(sql,/revoke all.*anon, authenticated/);
 assert.match(sql,/unique\(app_id,tenant_id,nonce\)/);
 assert.match(sql,/unique\(app_id,tenant_id,disposition_id\)/);
 assert.doesNotMatch(sql,/security definer/i);
 const pkg=JSON.parse(fs.readFileSync('package.json','utf8'));
 assert.match(pkg.scripts['test:landscape-supervisor-resolution-558'],/yw572-issuer-registry-check/);
 assert.match(pkg.scripts['test:landscape-supervisor-resolution-558'],/yw572-source-watch-check/);
 assert.match(pkg.scripts['test:browser:landscape-supervisor-resolution-558'],/source-security-mobile-572\.spec/);
});
console.log('YW572 2-witness registry, P-256 rotation, provenance, replay uniqueness and RLS staging-only gates PASS');
