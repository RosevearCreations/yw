import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,existsSync} from 'node:fs';
import {paths} from '../server/rosevear-ql246-source-proof-478.mjs';
import {reviewOrigin,reviewNonproductionGetSchedule} from '../server/rosevear-ql249-origin-schedule-481.mjs';
const raw=Buffer.from('{"synthetic":true}');
const digest=createHash('sha256').update(raw).digest('hex');
const proof={sourceRevisionSha:'a'.repeat(40),proofCommitSha:'b'.repeat(40),rawProofBase64:raw.toString('base64')};
const origin={repository:'RosevearCreations/yw',sourceRevisionSha:proof.sourceRevisionSha,
 proofCommitSha:proof.proofCommitSha,sourceCiUrl:'https://github.com/RosevearCreations/yw/actions/runs/123',
 proofRawSha256:digest,githubRawSha256:digest,proofFilePath:'docs/integration/ql246-source-proof.json',
 sourceCiConclusion:'success',proofCommitContainsFile:true,independentReviewerReceiptId:'np-reviewer-fixture'};
const review=reviewOrigin(proof,origin);
assert.equal(review.metadata_consistent,true);
assert.equal(review.github_origin_independently_authenticated,false);
assert.equal(review.connection_state,'DISCONNECTED');
for(const override of [{githubRawSha256:'f'.repeat(64)},{sourceCiConclusion:'failure'},
 {proofCommitSha:proof.sourceRevisionSha},{proofCommitContainsFile:false},
 {independentReviewerReceiptId:null},{proofFilePath:'docs/integration/other.json'}])
 assert.throws(()=>reviewOrigin(proof,{...origin,...override}),/QL249_HOLD_/);
const schedule={businessId:'yw',tenantId:'np-company-fixture',environment:'nonproduction',methods:['GET'],
 paths, destinationApproved:false,ownerApprovalReceiptId:null,independentReviewerReceiptId:null,
 expiresAt:1790000300000,now:1790000000000,rollbackWitnessed:false,hmacRegistryKeyId:null,privateRunnerApproved:false};
const pending=reviewNonproductionGetSchedule(schedule);
assert.equal(pending.schedule_review,'HOLD');assert.equal(pending.blockers.length,6);
assert.equal(pending.request_executed,false);assert.equal(pending.credentials_provisioned,false);
const hypothetical=reviewNonproductionGetSchedule({...schedule,destinationApproved:true,
 ownerApprovalReceiptId:'np-approval-fixture',independentReviewerReceiptId:'np-reviewer-fixture',
 rollbackWitnessed:true,hmacRegistryKeyId:'np-key-fixture',privateRunnerApproved:true});
assert.equal(hypothetical.schedule_review,'MANUAL_AUTHORITY_REVIEW_REQUIRED');
assert.equal(hypothetical.request_executed,false);
for(const override of [{methods:['GET','POST']},{paths:[paths[0]]},{environment:'production'},
 {tenantId:'np-other',businessId:'icamp'},{expiresAt:schedule.now+3600001}])
 assert.throws(()=>reviewNonproductionGetSchedule({...schedule,...override}),/QL249_HOLD_/);
assert.equal(existsSync('docs/integration/ql246-source-proof.json'),false);
const handoff=readFileSync('docs/integration/ql249-build481-PENDING.txt','utf8');
for(const marker of ['DISCONNECTED / HOLD','UNVERIFIED','NOT GIVEN','sourceRevisionSha','proofCommitSha','GET /api/integration/v1/health'])
 assert.ok(handoff.includes(marker),marker);
const pkg=JSON.parse(readFileSync('package.json','utf8'));
assert.ok(pkg.scripts['test:rosevear-ql249-origin-schedule-481']);
assert.ok(readFileSync('.github/workflows/staging-browser-integration.yml','utf8').includes('npm run test:rosevear-ql249-origin-schedule-481'));
console.log('QL249 Build 481 immutable-origin and GET scheduling HOLD PASS');
