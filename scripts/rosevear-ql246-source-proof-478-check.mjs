import assert from 'node:assert/strict';
import {createHash,generateKeyPairSync,sign} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {keys,denials,paths,canonical,pending,verifyPublic} from '../server/rosevear-ql246-source-proof-478.mjs';
assert.equal(keys.length,24);assert.equal(denials.length,7);
assert.equal(pending().approval,'HOLD');assert.equal(pending().dispatch_enabled,false);
const kp=generateKeyPairSync('ed25519'),pub=kp.publicKey.export({type:'spki',format:'pem'});
const fingerprint=createHash('sha256').update(kp.publicKey.export({type:'spki',format:'der'})).digest('hex');
const now=1790000000000,sourceRevision='a'.repeat(40),challengeSha256='b'.repeat(64);
const ciRunUrl='https://github.com/RosevearCreations/yw/actions/runs/40624344370';
const p={schema_version:'rosevear.integration.v1',source_system:'yw',repository:'RosevearCreations/yw',
 source_revision:sourceRevision,challenge_id:'np-operator-challenge',challenge_sha256:challengeSha256,
 business_id:'yw',tenant_id:'np-yw-company-source',environment:'nonproduction',ci_run_url:ciRunUrl,
 allowed_methods:['GET'],allowed_paths:paths,negative_tests:Object.fromEntries(denials.map(k=>[k,true])),
 gateway_audit_receipt_id:null,health_receipt_id:null,capabilities_receipt_id:null,registered_key_id:null,
 owner_authorization:'NOT_GIVEN',connection_state:'DISCONNECTED',external_gateway_get_verified:false,
 durable_audit_verified:false,owner_identity_verified:false,issued_at:now-1000,expires_at:now+300000};
const packet={publicKeyPem:pub,payload:p,signature:sign(null,Buffer.from(canonical(p)),kp.privateKey).toString('base64url')};
const trust={pinSha256:fingerprint,sourceRevision,ciRunUrl,challengeId:p.challenge_id,
 challengeSha256,tenantId:p.tenant_id,now};
assert.equal(canonical(p).split('\n').length,24);
const r=verifyPublic(packet,trust);
assert.equal(r.result,'SIGNATURE_MATCHED_REAL_PROOF_PENDING_HELD');
assert.equal(r.seven_denials_independently_observed,false);
for(const override of [{source_system:'icamp'},{connection_state:'CONNECTED'},
 {owner_authorization:'GIVEN'},{allowed_methods:['GET','POST']},
 {tenant_id:'np-other-company'},{source_revision:'c'.repeat(40)},
 {negative_tests:{...p.negative_tests,write_denied:false}},
 {negative_tests:{...p.negative_tests,additional:true}},{issued_at:now-800000},
 {external_gateway_get_verified:true},{allowed_paths:['/api/integration/v1/commands']}])
 assert.throws(()=>verifyPublic({...packet,payload:{...p,...override}},trust),/QL246_HOLD_/);
assert.throws(()=>verifyPublic(packet,{...trust,pinSha256:'f'.repeat(64)}),/QL246_HOLD_/);
assert.throws(()=>verifyPublic({...packet,signature:'a'.repeat(86)},trust),/QL246_HOLD_/);
const docs=readFileSync('docs/integration/ql246-build478-PENDING.md','utf8');
assert.match(docs,/NOT PROVISIONED/);
const pkg=JSON.parse(readFileSync('package.json','utf8'));
assert.ok(pkg.scripts['test:rosevear-ql246-source-proof-478']);
assert.ok(readFileSync('.github/workflows/staging-browser-integration.yml','utf8').includes('npm run test:rosevear-ql246-source-proof-478'));
console.log('QL246 Build 478 offline evidence verification and HOLD gates PASS');
