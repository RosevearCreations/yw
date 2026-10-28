import assert from 'node:assert/strict';
import {createHash,generateKeyPairSync,sign} from 'node:crypto';
import {readFileSync,existsSync} from 'node:fs';
import {canonical,denials,paths} from '../server/rosevear-ql246-source-proof-478.mjs';
import {verifyYwProofCommit} from '../server/rosevear-ql248-proof-commit-480.mjs';
const pair=generateKeyPairSync('ed25519');
const source='a'.repeat(40),proof='b'.repeat(40),now=1790000000000;
const ci='https://github.com/RosevearCreations/yw/actions/runs/123456';
const challengeId='np-operator-test',challengeSha256='c'.repeat(64),tenant='np-yw-source-test';
const payload={schema_version:'rosevear.integration.v1',source_system:'yw',repository:'RosevearCreations/yw',
 source_revision:source,challenge_id:challengeId,challenge_sha256:challengeSha256,business_id:'yw',
 tenant_id:tenant,environment:'nonproduction',ci_run_url:ci,allowed_methods:['GET'],allowed_paths:paths,
 negative_tests:Object.fromEntries(denials.map(k=>[k,true])),gateway_audit_receipt_id:null,
 health_receipt_id:null,capabilities_receipt_id:null,registered_key_id:null,owner_authorization:'NOT_GIVEN',
 connection_state:'DISCONNECTED',external_gateway_get_verified:false,durable_audit_verified:false,
 owner_identity_verified:false,issued_at:now-1000,expires_at:now+300000};
const packet={publicKeyPem:pair.publicKey.export({format:'pem',type:'spki'}),payload,
 signature:sign(null,Buffer.from(canonical(payload)),pair.privateKey).toString('base64url')};
const raw=Buffer.from(JSON.stringify(packet));
const bundle={system:'yw',sourceRevisionSha:source,proofCommitSha:proof,rawProofBase64:raw.toString('base64')};
const pins={system:'yw',sourceRevisionSha:source,proofCommitSha:proof,
 proofSha256:createHash('sha256').update(raw).digest('hex'),ciRunUrl:ci,
 publicKeySpkiSha256:createHash('sha256').update(pair.publicKey.export({format:'der',type:'spki'})).digest('hex'),
 businessId:'yw',tenantId:tenant};
const trust={challengeId,challengeSha256,now};
const result=verifyYwProofCommit(bundle,pins,trust);
assert.equal(result.signature_matched,true);
assert.equal(result.github_origin_independently_attested,false);
assert.equal(result.consumer_amendment_accepted,false);
assert.equal(result.connection_state,'DISCONNECTED');
assert.equal(result.owner_pilot_authorized,false);
assert.throws(()=>verifyYwProofCommit({...bundle,proofCommitSha:source},{...pins,proofCommitSha:source},trust),/QL248_HOLD_DISTINCT_SHAS/);
assert.throws(()=>verifyYwProofCommit({...bundle,proofCommitSha:'d'.repeat(40)},pins,trust),/QL248_HOLD_PINNED_SHAS/);
assert.throws(()=>verifyYwProofCommit(bundle,{...pins,proofSha256:'f'.repeat(64)},trust),/QL248_HOLD_PROOF_DIGEST/);
assert.throws(()=>verifyYwProofCommit(bundle,{...pins,ciRunUrl:ci+'9'},trust),/QL248_HOLD_SOURCE_CI/);
assert.throws(()=>verifyYwProofCommit(bundle,{...pins,publicKeySpkiSha256:'f'.repeat(64)},trust),/QL246_HOLD_/);
assert.throws(()=>verifyYwProofCommit(bundle,{...pins,tenantId:'np-foreign-company'},trust),/QL248_HOLD_TENANT/);
assert.throws(()=>verifyYwProofCommit(bundle,pins,{...trust,now:now+400000}),/QL246_HOLD_CLOCK/);
assert.throws(()=>verifyYwProofCommit({...bundle,rawProofBase64:'!!!!'},pins,trust),/QL248_HOLD_RAW_ENCODING/);
assert.equal(existsSync('docs/integration/ql246-source-proof.json'),false);
const handoff=readFileSync('docs/integration/ql248-build480-PENDING.txt','utf8');
for(const marker of ['DISCONNECTED / HOLD','source_revision','proofCommitSha','proofSha256','publicKeySpkiSha256','NOT GIVEN','UNVERIFIED'])
 assert.ok(handoff.includes(marker),marker);
const pkg=JSON.parse(readFileSync('package.json','utf8'));
assert.ok(pkg.scripts['test:rosevear-ql248-proof-commit-480']);
assert.ok(readFileSync('.github/workflows/staging-browser-integration.yml','utf8').includes('npm run test:rosevear-ql248-proof-commit-480'));
console.log('QL248 Build 480 two-SHA offline proof-commit amendment HOLD PASS');
