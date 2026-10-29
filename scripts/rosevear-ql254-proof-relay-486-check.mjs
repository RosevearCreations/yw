import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {ageQl254Exceptions,emptyQl254Register,simulatePrivateRelay,reviewQl254} from '../server/rosevear-ql254-proof-relay-486.mjs';
const now=1790000000000,rows=emptyQl254Register();
assert.equal(rows.length,11);
const overdue=ageQl254Exceptions(rows,{now});
assert.equal(overdue.escalated_count,11);assert.equal(overdue.decision,'HOLD');
const renewed=rows.map(r=>({...r,renewalRequestedAt:now-1000}));
assert.equal(ageQl254Exceptions(renewed,{now}).escalated_count,0);
assert.equal(ageQl254Exceptions(renewed,{now:now+3*86400000}).escalated_count,11);
assert.throws(()=>ageQl254Exceptions([...rows.slice(1),rows[1]],{now}),/CATEGORY/);
assert.throws(()=>ageQl254Exceptions(rows,{now,renewAfterMs:300000,escalateAfterMs:1000}),/CLOCK/);
const relay=simulatePrivateRelay(['SIMULATE_START','SIMULATE_STOP','SIMULATE_REVOKE','SIMULATE_RESTORE']);
assert.equal(relay.simulation_final_running,false);assert.equal(relay.real_relay_installed,false);
assert.equal(relay.network_requests,0);assert.equal(relay.decision,'HOLD');
assert.throws(()=>simulatePrivateRelay(['SIMULATE_REVOKE','SIMULATE_START']),/START_GUARD/);
assert.throws(()=>simulatePrivateRelay(['SIMULATE_START','SIMULATE_START']),/START_GUARD/);
assert.throws(()=>simulatePrivateRelay(['SIMULATE_START'],{checkSeconds:20}),/CHECK_INTERVAL/);
const p={repository:'RosevearCreations/yw',sourceShaA:null,proofShaB:null,
 sourceCiRunUrl:null,sourceCiHeadSha:null,sourceCiConclusion:'NOT_AVAILABLE',
 immutableHttpStatus:404,rawProofSha256:null,publicSpkiSha256:null,
 ancestryIndependentlyVerified:false,custodyReceiptId:null,witnessReceiptId:null,
 ownerTestDecision:'NOT_GIVEN',ownerTestReceiptId:null,actualGatewayTest:'NOT_RUN'};
const snapshot={observedMainSha:'a'.repeat(40),proofHttpStatus:404,sourceProofObservation:p,
 publicCiHeadSha:null,publicAncestryConfirmed:false,publicSignatureCryptographicallyValid:false,
 actualHealthGetReceipt:null,actualCapabilitiesGetReceipt:null,actualSevenDenialsVerified:false};
assert.equal(reviewQl254(snapshot,rows,{now}).decision,'HOLD');
assert.equal(reviewQl254(snapshot,rows,{now}).origin_status,404);
assert.equal(existsSync('docs/integration/ql246-source-proof.json'),false);
const doc=readFileSync('docs/integration/ql254-build486-PENDING.txt','utf8');
for(const token of ['QL-254','404','source SHA A','proof commit B','DISCONNECTED / HOLD','NOT_GIVEN'])assert.ok(doc.includes(token),token);
const pkg=JSON.parse(readFileSync('package.json','utf8'));
assert.ok(pkg.scripts['test:rosevear-ql254-proof-relay-486']);
assert.ok(readFileSync('.github/workflows/staging-browser-integration.yml','utf8').includes('npm run test:rosevear-ql254-proof-relay-486'));
console.log('QL254 Build 486 original proof aging and reversible relay simulation HOLD fixtures PASS');
