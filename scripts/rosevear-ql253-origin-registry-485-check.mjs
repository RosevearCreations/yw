import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import {reviewQl253RegistryCandidate,reconcileQl253PublicSnapshot} from '../server/rosevear-ql253-origin-registry-485.mjs';
const shaA='a'.repeat(40),shaB='b'.repeat(40),now=1790000000000;
const p={repository:'RosevearCreations/yw',sourceShaA:null,proofShaB:null,
 sourceCiRunUrl:null,sourceCiHeadSha:null,sourceCiConclusion:'NOT_AVAILABLE',
 immutableHttpStatus:404,rawProofSha256:null,publicSpkiSha256:null,
 ancestryIndependentlyVerified:false,custodyReceiptId:null,witnessReceiptId:null,
 ownerTestDecision:'NOT_GIVEN',ownerTestReceiptId:null,actualGatewayTest:'NOT_RUN'};
const snapshot={observedMainSha:'c'.repeat(40),proofHttpStatus:404,sourceProofObservation:p,
 publicCiHeadSha:null,publicAncestryConfirmed:false,publicSignatureCryptographicallyValid:false,
 actualHealthGetReceipt:null,actualCapabilitiesGetReceipt:null,actualSevenDenialsVerified:false};
const pending=reconcileQl253PublicSnapshot(snapshot);
assert.equal(pending.decision,'HOLD');assert.equal(pending.public_proof_status,404);
assert.equal(pending.private_24_7_relay_deployed,false);
assert.ok(pending.blockers.includes('PUBLIC_PROOF_HTTP_404'));
const registry={sourceShaA:shaA,proofShaB:shaB,tenantId:'np-yard-rosevear',
 publicSignerSpkiSha256:'d'.repeat(64),registrySnapshotSha256:'e'.repeat(64),
 registryReceiptId:'np-registry-fixture',custodianReceiptId:'np-custodian-fixture',
 witnessReceiptId:'np-witness-fixture',independentRegistryMatch:true,
 privateWitnessAuthenticated:true,nonceAgeMs:200000};
assert.equal(reviewQl253RegistryCandidate(registry).decision,'HOLD');
assert.throws(()=>reviewQl253RegistryCandidate({...registry,witnessReceiptId:registry.registryReceiptId}),/DISTINCT_RECEIPTS/);
assert.throws(()=>reviewQl253RegistryCandidate({...registry,nonceAgeMs:300001}),/NONCE_AGE/);
const claimed={...p,sourceShaA:shaA,proofShaB:shaB,sourceCiHeadSha:shaA,
 sourceCiRunUrl:'https://github.com/RosevearCreations/yw/actions/runs/123',
 sourceCiConclusion:'success',immutableHttpStatus:200,rawProofSha256:'f'.repeat(64),
 publicSpkiSha256:registry.publicSignerSpkiSha256,ancestryIndependentlyVerified:true};
const full=reconcileQl253PublicSnapshot({...snapshot,observedMainSha:shaB,
 proofHttpStatus:200,sourceProofObservation:claimed,publicCiHeadSha:shaA,
 publicAncestryConfirmed:true,publicSignatureCryptographicallyValid:true},{registry});
assert.equal(full.public_source_origin_candidate,true);assert.equal(full.decision,'HOLD');
assert.equal(full.private_registry_verified,false);assert.equal(full.owner_test_authorized,false);
assert.throws(()=>reconcileQl253PublicSnapshot({...snapshot,actualHealthGetReceipt:'fake'}),/LIVE_RECEIPTS_NOT_AUTHORIZED/);
assert.throws(()=>reconcileQl253PublicSnapshot({...snapshot,proofHttpStatus:200}),/HTTP_BINDING/);
assert.equal(existsSync('docs/integration/ql246-source-proof.json'),false);
const text=readFileSync('docs/integration/ql253-build485-PENDING.txt','utf8');
for(const marker of ['404','QL-253','source SHA A','proof commit B','DISCONNECTED / HOLD','NOT_GIVEN'])assert.ok(text.includes(marker),marker);
const pkg=JSON.parse(readFileSync('package.json','utf8'));
assert.ok(pkg.scripts['test:rosevear-ql253-origin-registry-485']);
assert.ok(readFileSync('.github/workflows/staging-browser-integration.yml','utf8').includes('npm run test:rosevear-ql253-origin-registry-485'));
console.log('QL253 Build 485 immutable proof, registry and owner HOLD fixtures PASS');
