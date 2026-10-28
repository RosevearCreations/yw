import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {fixture,companyId,ownerId,alternativeId,foreignCompanyId} from '../tests/fixtures/pms-owner-renewal-reviewer-followup-476.mjs';
import {assessSourceEvidence,canonicalPaths,canonicalScopes,requiredDenials}
 from '../server/rosevear-ql245-source-evidence-477.mjs';
const read=p=>readFileSync(p,'utf8');
const sources=['js/pms-independent-handoff-465.js','js/pms-comparison-followup-467.js',
 'js/pms-followup-renewal-468.js','js/pms-renewal-reassessment-469.js','js/pms-reassessment-continuity-470.js',
 'js/pms-continuity-exception-owner-471.js','js/pms-owner-renewal-recheck-472.js',
 'js/pms-review-outcome-owner-clarification-473.js','js/pms-owner-clarification-continuity-474.js',
 'js/pms-continuity-finding-owner-renewal-475.js','js/pms-owner-renewal-reviewer-followup-476.js',
 'js/pms-reviewer-receipt-aging-477.js'];
const ctx={window:{},document:{readyState:'loading',addEventListener(){}}};
for(const file of sources)vm.runInNewContext(read(file),ctx);
for(const days of [0,7,8,14,15,40]){
 const f=fixture({now:Date.now(),followedUp:true,renewalDays:days});
 f.followup.created_at=new Date(Date.parse(f.view.captured_at)-days*86400000-1000).toISOString();
 f.view.reviewer_followup_receipts[0].created_at=f.followup.created_at;
 const x=ctx.window.YWI477.inspect(f.view,{companyId,userId:ownerId});
 assert.equal(x.state,'source_verified',x.reason);
 assert.equal(x.reviewerReceiptAging[0].band,days>=15?'overdue':days>=8?'aging':'current');
 assert.equal(x.reviewerReceiptAging[0].age_days,days);
 assert.equal(x.releaseGreen,false);assert.equal(x.connectionState,'DISCONNECTED');
}
let f=fixture({followedUp:false});
let x=ctx.window.YWI477.inspect(f.view,{companyId,userId:ownerId});
assert.equal(x.state,'source_verified');assert.equal(x.outstandingOwnerEvidence.length,1);
f=fixture({followedUp:true});f.view.reviewer_followup_receipts[0].created_at=new Date(Date.now()+100000).toISOString();
assert.equal(ctx.window.YWI477.inspect(f.view,{companyId,userId:ownerId}).state,'withheld');
f=fixture({followedUp:true});assert.equal(ctx.window.YWI477.inspect(f.view,{companyId:foreignCompanyId,userId:ownerId}).state,'withheld');
const none=assessSourceEvidence();
assert.equal(none.connection_state,'DISCONNECTED');
assert.equal(none.signed_ql245_packet_emitted,false);
assert.equal(none.owner_authorization,'NOT_GIVEN');
assert.equal(none.candidate_claim_complete,false);
assert.equal(none.remaining_gaps.length,16);
assert.deepEqual(canonicalPaths,['/api/integration/v1/health','/api/integration/v1/capabilities']);
assert.deepEqual(canonicalScopes,['read_health','read_capabilities']);
assert.equal(requiredDenials.length,7);
const candidate={tenantId:companyId,tenantIndependentlyIssued:true,enabledModule:'jobs',moduleIndependentlyVerified:true,
 sourceRevision:'a'.repeat(40),ciRunUrl:'https://github.com/RosevearCreations/yw/actions/runs/40624344370',
 nonproductionOrigin:'https://test.example.org',deployedRevision:'a'.repeat(40),originIndependentlyVerified:true,
 hmacKeyId:'np-yw-claimed-key',registryReceiptId:'np-yw-claimed-registry',keyRegistryIndependentlyReviewed:true,
 signerKeyId:'np-yw-claimed-signer',publicSpkiSha256:'b'.repeat(64),pinSeparatelyVerified:true,
 healthReceiptId:'np-yw-claimed-health',capabilitiesReceiptId:'np-yw-claimed-capabilities',
 gatewayAuditId:'np-yw-claimed-gateway-audit',signedSourceReceiptsIndependentlyRead:true,
 negativeTests:Object.fromEntries(requiredDenials.map(k=>[k,{actuallyExecuted:true,independentlyWitnessed:true,
  httpStatus:403,traceId:'np-'+k.replaceAll('_','-')+'-trace',auditReceiptId:'np-'+k.replaceAll('_','-')+'-audit'}])),
 auditAfterRestartIndependentlyObserved:true,separateExternalReviewerVerified:true};
const claimed=assessSourceEvidence(candidate);
assert.equal(claimed.candidate_claim_complete,true);
assert.equal(claimed.source_evidence_state,'UNVERIFIED');
assert.equal(claimed.server_connection_authorized,false);
candidate.negativeTests.wrong_tenant.actuallyExecuted=false;
assert.ok(assessSourceEvidence(candidate).remaining_gaps.includes('DENIAL_WRONG_TENANT_UNVERIFIED'));
assert.ok(!read('server/rosevear-ql245-source-evidence-477.mjs').includes('createPrivateKey'));
assert.ok(read('index.html').includes('pms-reviewer-receipt-aging-477.js'));
assert.ok(read('docs/ROSEVEAR_QL245_YW_BUILD477_HOLD.md').includes('NOT PROVISIONED'));
const scripts=JSON.parse(read('package.json')).scripts,ci=read('.github/workflows/staging-browser-integration.yml');
for(const name of ['test:pms-reviewer-receipt-aging-477','test:browser:pms-reviewer-receipt-aging-477'])
 {assert.ok(scripts[name]);assert.ok(ci.includes('npm run '+name));}
console.log('YW477: independent receipt aging, QL245 claim refusal, DISCONNECTED/HOLD PASS');
