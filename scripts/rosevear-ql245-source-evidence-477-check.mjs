import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {assessSourceEvidence,canonicalPaths,canonicalScopes,requiredDenials}
 from '../server/rosevear-ql245-source-evidence-477.mjs';
const read=(p)=>readFileSync(p,'utf8');
const actual=assessSourceEvidence();
assert.equal(actual.source_system,'yw');
assert.equal(actual.environment,'nonproduction');
assert.equal(actual.connection_state,'DISCONNECTED');
assert.equal(actual.owner_authorization,'NOT_GIVEN');
assert.equal(actual.source_evidence_state,'UNVERIFIED');
assert.equal(actual.signed_ql245_packet_emitted,false);
assert.equal(actual.server_connection_authorized,false);
assert.equal(actual.pilot_approved,false);
assert.equal(actual.candidate_claim_complete,false);
assert.deepEqual(canonicalPaths,['/api/integration/v1/health','/api/integration/v1/capabilities']);
assert.deepEqual(canonicalScopes,['read_health','read_capabilities']);
assert.deepEqual(requiredDenials,['nonce_replay','stale_request','wrong_business','wrong_tenant','revoked_key','prohibited_write','prohibited_dispatch']);
assert.ok(actual.remaining_gaps.includes('ISSUED_REAL_YW_COMPANY_TENANT_UNVERIFIED'));
assert.ok(actual.remaining_gaps.includes('DURABLE_GATEWAY_RESTART_PROOF_UNVERIFIED'));
assert.ok(actual.remaining_gaps.includes('EXTERNAL_REVIEWER_NOT_VERIFIED'));
const candidate={
 tenantId:'4567cbf0-a0d0-45c0-b87d-afd009016f41',tenantIndependentlyIssued:true,
 enabledModule:'jobs',moduleIndependentlyVerified:true,sourceRevision:'a'.repeat(40),
 ciRunUrl:'https://github.com/RosevearCreations/yw/actions/runs/40624344370',
 nonproductionOrigin:'https://example.org',deployedRevision:'a'.repeat(40),originIndependentlyVerified:true,
 hmacKeyId:'np-yw-claimed-key',registryReceiptId:'np-yw-claimed-registry',keyRegistryIndependentlyReviewed:true,
 signerKeyId:'np-yw-claimed-signer',publicSpkiSha256:'b'.repeat(64),pinSeparatelyVerified:true,
 healthReceiptId:'np-yw-claimed-health',capabilitiesReceiptId:'np-yw-claimed-capabilities',
 gatewayAuditId:'np-yw-claimed-gateway-audit',signedSourceReceiptsIndependentlyRead:true,
 negativeTests:Object.fromEntries(requiredDenials.map(k=>[k,{actuallyExecuted:true,independentlyWitnessed:true,
 httpStatus:403,traceId:'np-'+k.replaceAll('_','-')+'-trace',auditReceiptId:'np-'+k.replaceAll('_','-')+'-audit'}])),
 auditAfterRestartIndependentlyObserved:true,separateExternalReviewerVerified:true
};
const claimed=assessSourceEvidence(candidate);
assert.equal(claimed.candidate_claim_complete,true);
assert.equal(claimed.source_evidence_state,'UNVERIFIED');
assert.equal(claimed.pilot_approved,false);
candidate.negativeTests.nonce_replay.actuallyExecuted=false;
assert.ok(assessSourceEvidence(candidate).remaining_gaps.includes('DENIAL_NONCE_REPLAY_UNVERIFIED'));
assert.ok(!read('server/rosevear-ql245-source-evidence-477.mjs').includes('createPrivateKey'));
assert.ok(read('docs/ROSEVEAR_QL245_YW_BUILD477_HOLD.txt').includes('NOT PROVISIONED'));
const scripts=JSON.parse(read('package.json')).scripts;
const wf=read('.github/workflows/staging-browser-integration.yml');
assert.ok(scripts['test:rosevear-ql245-source-evidence-477']);
assert.ok(wf.includes('npm run test:rosevear-ql245-source-evidence-477'));
console.log('YW477 QL245 nonsecret, offline source evidence — UNVERIFIED/HOLD PASS');
