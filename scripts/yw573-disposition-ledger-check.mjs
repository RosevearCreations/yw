import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,sign} from 'node:crypto';
import fs from 'node:fs';
import {APPS_571,canonical571,fingerprint571} from './yw571-evidence-contract.mjs';
import {verifyClosureWitness573,verifySlaRenewalReceipt573,admitDisposition573,PostgresDisposition573} from './yw573-disposition-ledger.mjs';
const id=n=>n.toString(16).padStart(8,'0')+'-1111-4111-8111-111111111111';
const now=Date.parse('2026-11-15T22:00:00Z');
const at=minutes=>new Date(now+minutes*60000).toISOString();
const makeKey=()=>generateKeyPairSync('ec',{namedCurve:'prime256v1'});
const ownerKey=makeKey(),custodianKey=makeKey(),perApp=new Map(APPS_571.map(([n])=>[n,makeKey()]));
const pem=k=>k.publicKey.export({type:'spki',format:'pem'});
const roots={owner:{witness_id:'owner-signature-witness',public_key_pem:pem(ownerKey),trusted_spki_sha256:fingerprint571(pem(ownerKey))},
 independent_custodian:{witness_id:'custody-signature-witness',public_key_pem:pem(custodianKey),trusted_spki_sha256:fingerprint571(pem(custodianKey))}};
const witnessSig=(role,key,p)=>({role,witness_id:roots[role].witness_id,
 signature_base64:sign('sha256',Buffer.from(canonical571(p)),key.privateKey).toString('base64')});
const signOwner=p=>({payload:p,approvals:[witnessSig('owner',ownerKey,p),witnessSig('independent_custodian',custodianKey,p)]});
const registry=()=>signOwner({contract_version:'rosevear.issuer-registry.v1',registry_id:id(50),version:1,
 issued_at:at(-90),expires_at:at(600),issuers:APPS_571.map(([app,role])=>{
 const k=perApp.get(app),pub=pem(k);
 return {app_id:app,app_role:role,tenant_boundary:role==='master'?'master':role==='platform_shell'?'platform_shell':'internal_company',
  issuer_id:app==='YW'?'yw-original-owner':app.toLowerCase()+'-issuer',
  key_id:app==='YW'?'yw-key-v1':app.toLowerCase()+'-key-v1',
  audience:app==='YW'?'rosevear:yw:source-review':'rosevear:'+app.toLowerCase()+':handoff',
  public_key_pem:pub,spki_sha256:fingerprint571(pub),status:'active',
  valid_from:at(-120),valid_until:at(720),rotated_at:null,grace_until:null};
 })});
const trust=(observation=id(5))=>({issuer:'yw-original-owner',
 trusted_spki_sha256:fingerprint571(pem(perApp.get('YW'))),
 source_sha256:'a'.repeat(64),main_sha256:'b'.repeat(40),
 company_id:id(1),request_id:id(2),provider_receipt_id:id(3),
 owner_audit_id:id(4),master_observation_id:observation});
const receipt=(options={})=>{
 const p={contract_version:'yw571.disposition.v1',source_app:'YW',issuer:'yw-original-owner',
 audience:'rosevear:yw:source-review',signer_key_id:'yw-key-v1',registry_version:1,
 disposition:'SOURCE_ONLY_REVIEWED',disposition_id:id(6),nonce:id(9),
 company_id:id(1),request_id:id(2),provider_verified_receipt_id:id(3),case_version:5,
 owner_audit_id:id(4),master_observation_id:id(5),canonical_sha256:'a'.repeat(64),
 source_revision:'b'.repeat(40),tenant_boundary:'company',
 master_connected:false,master_owner_acceptance:false,customer_message_sent:false,
 closure_authorized:false,source_observed_at:at(-45),issued_at:at(-30),expires_at:at(60),...options};
 return {payload:p,public_key_pem:pem(perApp.get('YW')),
  signature_base64:sign('sha256',Buffer.from(canonical571(p)),perApp.get('YW').privateKey).toString('base64')};
};
const witness=(source,manifest,opts={})=>{
 const p={contract_version:'yw573.original-disposition-witness.v1',witness_receipt_id:id(90),
 app_id:'YW',tenant_boundary:'company',source_role:'platform_shell',
 company_id:source.payload.company_id,request_id:source.payload.request_id,
 provider_verified_receipt_id:source.payload.provider_verified_receipt_id,
 owner_audit_id:source.payload.owner_audit_id,master_observation_id:source.payload.master_observation_id,
 disposition_id:source.payload.disposition_id,nonce:source.payload.nonce,
 signed_source_sha256:requireHash(source.payload),registry_sha256:requireHash(manifest.payload),
 source_revision:source.payload.source_revision,disposition:source.payload.disposition,
 master_connected:false,closure_authorized:false,customer_delivery_verified:false,
 owner_acceptance:false,issued_at:at(-10),expires_at:at(60),...opts};
 return signOwner(p);
};
function requireHash(obj){return requireHashFn(canonical571(obj));}
import {createHash} from 'node:crypto';
const requireHashFn=t=>createHash('sha256').update(t).digest('hex');
test('YW573 independent two-witness signed source-only dispositions never imply closure',()=>{
 const src=receipt(),reg=registry(),w=witness(src,reg);
 const q=verifyClosureWitness573(w,src,reg,roots,trust(),now);
 assert.equal(q.ok,true,q.code+' — '+q.reason);
 assert.equal(q.code,'TWO_SIGNED_WITNESSES_VERIFIED_LEDGER_PENDING_MASTER_HOLD');
 assert.equal(q.master_connected,false);assert.equal(q.closure_authorized,false);
 assert.equal(q.customer_delivery_verified,false);
 assert.equal(q.payload_sha256,requireHash(src.payload));
 assert.equal(q.witness_sha256,requireHash(w.payload));
});
test('YW573 tampering, one witness, shared authority, foreign tenant and invalid source are HOLD',()=>{
 const src=receipt(),reg=registry(),w=witness(src,reg);
 const wrong=structuredClone(w);wrong.payload.owner_acceptance=true;
 const single=structuredClone(w);single.approvals.pop();
 const swapped=structuredClone(w);swapped.approvals.reverse();swapped.approvals[0].role='owner';
 const wrongScope=witness(src,reg,{company_id:id(71)});
 const expired=witness(src,reg,{expires_at:at(-1)});
 const invalidSource=receipt({source_revision:'f'.repeat(40)});
 const shared={owner:roots.owner,independent_custodian:{...roots.owner,witness_id:roots.independent_custodian.witness_id}};
 const x=[verifyClosureWitness573(wrong,src,reg,roots,trust(),now),
  verifyClosureWitness573(single,src,reg,roots,trust(),now),
  verifyClosureWitness573(swapped,src,reg,roots,trust(),now),
  verifyClosureWitness573(wrongScope,src,reg,roots,trust(),now),
  verifyClosureWitness573(expired,src,reg,roots,trust(),now),
  verifyClosureWitness573(w,invalidSource,reg,roots,trust(),now),
  verifyClosureWitness573(w,src,reg,shared,trust(),now),
  verifyClosureWitness573(w,src,reg,roots,{...trust(),company_id:id(55)},now)];
 for(const z of x)assert.equal(z.ok,false,z.code);
});
test('YW573 signed SLA renewal requires two source observations, distinct nonce, exact registry and valid ordering',()=>{
 const old=receipt({source_observed_at:at(-100),issued_at:at(-90),expires_at:at(60),
  master_observation_id:id(40),disposition_id:id(41),nonce:id(42)});
 const fresh=receipt({source_observed_at:at(-45),issued_at:at(-30),expires_at:at(60),
  master_observation_id:id(5),disposition_id:id(6),nonce:id(9)});
 const r=verifySlaRenewalReceipt573(old,fresh,registry(),roots,trust(id(40)),trust(),now);
 assert.equal(r.ok,true,r.code+' — '+r.reason);
 assert.equal(r.delta_minutes,55);assert.equal(r.sla_recovery_rate,null);assert.equal(r.master_connected,false);
 const duplicate=verifySlaRenewalReceipt573(fresh,fresh,registry(),roots,trust(),trust(),now);
 assert.equal(duplicate.ok,false);
 const reverse=verifySlaRenewalReceipt573(fresh,old,registry(),roots,trust(),trust(id(40)),now);
 assert.equal(reverse.ok,false);
});
test('YW573 no private durable source ledger or in-memory adapter refuses signed closure admission',async()=>{
 const source=receipt(),manifest=registry(),w=witness(source,manifest);
 const r=await admitDisposition573(w,source,manifest,roots,trust(),null,now);
 assert.equal(r.ok,false);assert.equal(r.code,'HOLD_NO_DURABLE_DISPOSITION');
 const fake=await admitDisposition573(w,source,manifest,roots,trust(),{kind:'memory',verifySourceAndClaimIfAbsent:async()=>({status:'INSERTED'})},now);
 assert.equal(fake.ok,false);
});
test('YW573 transactional Postgres source custody check is mandatory and duplicate witness fails closed',async()=>{
 const seen=new Set();let sourceCustodied=true,rollbacks=0,commits=0;
 const driver={async connect(){return {async query(sql,args){
  if(sql==='begin')return {};
  if(sql==='commit'){commits++;return {};}
  if(sql==='rollback'){rollbacks++;return {};}
  if(sql.startsWith('select payload_sha256'))return sourceCustodied?{rowCount:1,rows:[{payload_sha256:args[2]}]}:{rowCount:0,rows:[]};
  assert.match(sql,/insert into ywi_security_573\.original_disposition/);
  assert.match(sql,/on conflict do nothing returning/);
  assert.equal(args.length,10);
  const key=args[1]+'|'+args[4];if(seen.has(key))return {rowCount:0,rows:[]};
  seen.add(key);return {rowCount:1,rows:[{witness_sha256:args[7],source_payload_sha256:args[6]}]};
 },release(){}};}};
 const store=new PostgresDisposition573(driver),src=receipt(),reg=registry(),w=witness(src,reg);
 const first=await admitDisposition573(w,src,reg,roots,trust(),store,now);
 assert.equal(first.ok,true,first.code+' — '+first.reason);
 assert.equal(first.code,'SIGNED_DISPOSITION_LEDGER_ADMITTED_MASTER_HOLD');
 assert.equal(first.closure_authorized,false);
 const replay=await admitDisposition573(w,src,reg,roots,trust(),store,now);
 assert.equal(replay.ok,false);assert.equal(replay.code,'HOLD_WITNESS_REPLAY');
 sourceCustodied=false;
 const absent=await admitDisposition573(w,src,reg,roots,trust(),store,now);
 assert.equal(absent.code,'HOLD_SOURCE_CUSTODY_ABSENT');
 assert.equal(commits,1);assert.ok(rollbacks>=2);
});
test('YW573 staging-only SQL is append-only, private RLS with unique witness and source constraints',()=>{
 const sql=fs.readFileSync('docs/security/YW573_STAGING_ONLY_DISPOSITION_SCHEMA.sql','utf8');
 assert.match(sql,/STAGING-ONLY DESIGN DRAFT/);
 assert.match(sql,/enable row level security/);
 assert.match(sql,/force row level security/);
 assert.match(sql,/revoke all.*anon, authenticated/);
 assert.match(sql,/unique\(app_id,tenant_id,disposition_id\)/);
 assert.match(sql,/unique\(app_id,tenant_id,witness_receipt_id\)/);
 assert.match(sql,/unique\(app_id,tenant_id,witness_sha256\)/);
 assert.match(sql,/references ywi_security_572/);
 assert.doesNotMatch(sql,/create\s+(or replace\s+)?function[\s\S]*security definer/i);
 const pkg=JSON.parse(fs.readFileSync('package.json','utf8'));
 assert.match(pkg.scripts['test:landscape-supervisor-resolution-558'],/yw573-disposition-ledger-check/);
 assert.match(pkg.scripts['test:browser:landscape-supervisor-resolution-558'],/source-disposition-mobile-573\.spec/);
});
console.log('YW573 independent signed original disposition, witness quorum and signed SLA renewal HOLD PASS');
