import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import {reviewCustodyClaim,reviewOwnerTestOnlyClaim,reconcileQl252,endpoints} from '../server/rosevear-ql252-proof-custody-484.mjs';
const now=1790000000000,A='a'.repeat(40),B='b'.repeat(40);
const publicObservation={repository:'RosevearCreations/yw',sourceShaA:A,proofShaB:null,
 sourceCiRunUrl:null,sourceCiHeadSha:null,sourceCiConclusion:'NOT_AVAILABLE',immutableHttpStatus:404,
 rawProofSha256:null,publicSpkiSha256:null,ancestryIndependentlyVerified:false,
 custodyReceiptId:null,witnessReceiptId:null,ownerTestDecision:'NOT_GIVEN',
 ownerTestReceiptId:null,actualGatewayTest:'NOT_RUN'};
const custody={sourceShaA:A,proofShaB:B,businessId:'yw',tenantId:'np-test-company',
 responseSha256:'c'.repeat(64),custodianReceiptId:'np-custodian-fixture',witnessReceiptId:'np-witness-fixture',
 custodianSpkiSha256:'d'.repeat(64),witnessSpkiSha256:'e'.repeat(64),nonceIssuedAt:now,
 nonceAnsweredAt:now+10000,witnessSignedAt:now+20000,independentOriginConfirmed:true};
const owner={businessId:'yw',tenantId:'np-test-company',environment:'nonproduction',
 method:'GET',paths:endpoints,windowStartUtc:now+3600000,windowEndUtc:now+4800000,
 observedAtUtc:now,ownerDecision:'INDEPENDENTLY_VERIFIED_BY_OWNER',
 ownerReceiptId:'np-owner-fixture',privateIdentityVerified:true,gatewayRequestsExecuted:false};
assert.equal(reviewCustodyClaim(custody).decision,'HOLD');
assert.equal(reviewOwnerTestOnlyClaim(owner).decision,'HOLD');
assert.equal(reconcileQl252(publicObservation,null,null).publication_status,'404_OR_NOT_AVAILABLE');
assert.equal(reconcileQl252({...publicObservation,proofShaB:B},custody,owner).decision,'HOLD');
assert.throws(()=>reviewCustodyClaim({...custody,witnessReceiptId:custody.custodianReceiptId}),/DISTINCT_RECEIPTS/);
assert.throws(()=>reviewCustodyClaim({...custody,witnessSpkiSha256:custody.custodianSpkiSha256}),/DISTINCT_PINS/);
assert.throws(()=>reviewCustodyClaim({...custody,nonceAnsweredAt:now+300001}),/NONCE/);
assert.throws(()=>reviewOwnerTestOnlyClaim({...owner,method:'POST'}),/GET_ONLY/);
assert.throws(()=>reviewOwnerTestOnlyClaim({...owner,windowEndUtc:now+6000000}),/FUTURE_WINDOW/);
assert.throws(()=>reviewOwnerTestOnlyClaim({...owner,gatewayRequestsExecuted:true}),/NO_TEST/);
assert.throws(()=>reconcileQl252(publicObservation,custody,owner),/SOURCE_CUSTODY_BINDING/);
assert.equal(existsSync('docs/integration/ql246-source-proof.json'),false);
const handoff=readFileSync('docs/integration/ql252-build484-PENDING.txt','utf8');
for(const mark of ['404','DISCONNECTED / HOLD','NOT GIVEN','QL-252','source SHA A','proof commit B'])assert.ok(handoff.includes(mark),mark);
const pkg=JSON.parse(readFileSync('package.json','utf8'));
assert.ok(pkg.scripts['test:rosevear-ql252-proof-custody-484']);
assert.ok(readFileSync('.github/workflows/staging-browser-integration.yml','utf8').includes('npm run test:rosevear-ql252-proof-custody-484'));
console.log('QL252 Build 484 public publication and private custody HOLD fixtures PASS');
