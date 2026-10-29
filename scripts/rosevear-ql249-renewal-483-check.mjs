import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import {pendingFollowup} from '../server/rosevear-ql249-evidence-aging-482.mjs';
import {publicProofPath,reviewPublicProofPublication,reviewRenewalDisposition} from '../server/rosevear-ql249-renewal-483.mjs';
const now=1790000000000,sha='a'.repeat(40),b='b'.repeat(40);
const pending=pendingFollowup(now);
const report=reviewRenewalDisposition(pending,{now});
assert.equal(report.escalated_count,14);assert.equal(report.decision,'HOLD');
assert.ok(report.queue.every(x=>x.next_action==='ESCALATE_PRIVATE_ORIGINAL_SOURCE_REQUEST'));
const followed=pending.map(x=>({...x,ownerFollowupAt:now-1000}));
assert.equal(reviewRenewalDisposition(followed,{now}).escalated_count,0);
assert.equal(reviewRenewalDisposition(followed,{now:now+3*86400000}).escalated_count,14);
assert.throws(()=>reviewRenewalDisposition(followed,{now,escalationAfterMs:1}),/ESCALATION_WINDOW/);
const observation={repository:'RosevearCreations/yw',sourceShaA:sha,proofShaB:null,
 sourceCiRunUrl:null,sourceCiHeadSha:null,sourceCiConclusion:'NOT_AVAILABLE',
 immutableHttpStatus:404,rawProofSha256:null,publicSpkiSha256:null,
 ancestryIndependentlyVerified:false,custodyReceiptId:null,witnessReceiptId:null,
 ownerTestDecision:'NOT_GIVEN',ownerTestReceiptId:null,actualGatewayTest:'NOT_RUN'};
const missing=reviewPublicProofPublication(observation);
assert.equal(missing.public_proof_available_candidate,false);
assert.equal(missing.immutable_public_proof_url,null);
assert.equal(missing.decision,'HOLD');
const claimed={...observation,proofShaB:b,immutableHttpStatus:200,
 rawProofSha256:'c'.repeat(64),publicSpkiSha256:'d'.repeat(64),
 sourceCiRunUrl:'https://github.com/RosevearCreations/yw/actions/runs/123',
 sourceCiHeadSha:sha,sourceCiConclusion:'success',ancestryIndependentlyVerified:true,
 custodyReceiptId:'np-fixture-custodian',witnessReceiptId:'np-fixture-witness',
 ownerTestDecision:'INDEPENDENTLY_VERIFIED_BY_OWNER',ownerTestReceiptId:'np-fixture-owner'};
const candidate=reviewPublicProofPublication(claimed);
assert.equal(candidate.source_origin_metadata_candidate,true);
assert.equal(candidate.decision,'HOLD');assert.equal(candidate.actual_gateway_test,'NOT_RUN');
assert.throws(()=>reviewPublicProofPublication({...claimed,proofShaB:sha}),/DISTINCT_SHA/);
assert.equal(reviewPublicProofPublication({...claimed,sourceCiHeadSha:b}).source_origin_metadata_candidate,false);
assert.throws(()=>reviewPublicProofPublication({...claimed,actualGatewayTest:'SUCCESS'}),/GATEWAY_TEST/);
assert.equal(publicProofPath,'docs/integration/ql246-source-proof.json');
assert.equal(existsSync(publicProofPath),false,'must not mint a fake signed proof');
const handoff=readFileSync('docs/integration/ql249-build483-PENDING.txt','utf8');
for(const marker of ['QL-252','DISCONNECTED / HOLD','404','NOT GIVEN','source SHA A','proof commit B'])assert.ok(handoff.includes(marker),marker);
const pkg=JSON.parse(readFileSync('package.json','utf8'));
assert.ok(pkg.scripts['test:rosevear-ql249-renewal-483']);
assert.ok(readFileSync('.github/workflows/staging-browser-integration.yml','utf8').includes('npm run test:rosevear-ql249-renewal-483'));
console.log('QL249 Build 483 renewal, public proof blocker and HOLD fixtures PASS');
