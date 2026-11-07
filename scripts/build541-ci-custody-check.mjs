#!/usr/bin/env node
/** Build 541 protected source tests. All original gates remain authoritative. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { webcrypto,createHash } from 'node:crypto';
import { createEvidenceArchive } from './build540-ci-slo-retention-core.mjs';
import { createCheckpoint } from './build541-ci-custody-checkpoint-core.mjs';
import { REQUIRED_GATES } from './build530-ci-runtime-audit-core.mjs';

if(!globalThis.crypto?.subtle)globalThis.crypto=webcrypto;
const core=globalThis.YWICiCustodyCore541;
const older=globalThis.YWICiSloCore540;
const warn=[{code:'SOURCE_STEP_GAP_P95',observedSeconds:19,limitSeconds:15,overSeconds:4}];
const fixture=(runId=541100001,sha='a'.repeat(40),alerts=warn)=>({
  schema:older.REPORT,observedAt:'2026-11-07T14:00:00.000Z',sourceRunId:runId,
  currentMainSha:sha,exactCurrentMain:true,
  current:{runId,headSha:sha,status:'VERIFIED_GREEN'},
  build539:{currentRunId:runId,state:'EXACT_MAIN_VERIFIED_ORIGINAL_ACTIONS_SCHEDULING',
    sloState:alerts.length?'REVIEW_OBSERVED_SLO_DRIFT':'MEETS_OBSERVATIONAL_SLO_BUDGET',
    trendState:'SIX_RELEASE_VERIFIED_TREND',verifiedDistinctSamples:6,
    current:{handoffSeconds:4,setupSeconds:8,interStepGapSeconds:5},
    historicalP95:{runnerHandoffSeconds:9,runnerSetupSeconds:12,
      sourceStepGapSeconds:11,sourceSeconds:190,releaseSeconds:700},
    cohorts:{metrics:{sourceSeconds:{increaseSeconds:2},warmSeconds:{increaseSeconds:-1},
      releaseSeconds:{increaseSeconds:8}}},alerts,
    safeguards:{requiredGates:[...REQUIRED_GATES],requireExactCurrentMain:true,
      changesProtectedJobs:false,releaseAuthority:false,gateWaiver:false}}
});
const report=fixture(),auditRaw=JSON.stringify(report,null,2)+'\n';
const {archive,receipt}=createEvidenceArchive(report,auditRaw);
const archiveRaw=JSON.stringify(archive,null,2)+'\n';
const receiptRaw=JSON.stringify(receipt,null,2)+'\n';
const checkpoint=await createCheckpoint(auditRaw,archiveRaw,receiptRaw);
const checkpointRaw=JSON.stringify(checkpoint,null,2)+'\n';
const bundle=await core.verifyBundle({auditRaw,archiveRaw,receiptRaw,checkpointRaw});
let checks=0;
const pass=label=>{checks++;console.log(`PASS build541 ${label}`);};

assert.equal(bundle.status,'THREE_FILES_AND_CHECKPOINT_BYTES_MATCH');
assert.equal(bundle.record.sha,report.currentMainSha);
assert.equal(bundle.independentCustodyVerified,false);
assert.equal(bundle.independentSourceSignatureVerified,false);
assert.equal(checkpoint.state,'SECOND_COPY_READBACK_REQUIRED');
assert.equal(checkpoint.originalActionsRunId,report.sourceRunId);
assert.equal(checkpoint.estimatedArtifactExpiryAt,'2026-12-07T14:00:00.000Z');
assert.equal(checkpoint.githubActionsArtifactRetentionDays,30);
assert.equal(checkpoint.independentArchiveCustodyVerified,false);
pass('four-file original Actions run byte and authority contract');

const tamper=async parts=>assert.rejects(()=>core.verifyBundle({...{
  auditRaw,archiveRaw,receiptRaw,checkpointRaw},...parts}));
await tamper({auditRaw:auditRaw.replace('"handoffSeconds": 4','"handoffSeconds": 40')});
await tamper({archiveRaw:archiveRaw.replace('"handoff": 4','"handoff": 44')});
await tamper({receiptRaw:receiptRaw.replace(receipt.originalMainSha,'b'.repeat(40))});
await tamper({checkpointRaw:checkpointRaw.replace(checkpoint.archivePayloadSha256,'c'.repeat(64))});
const three=await core.verifyBundle({auditRaw,archiveRaw,receiptRaw});
assert.equal(three.status,'THREE_FILES_MATCH_CHECKPOINT_NOT_IMPORTED');
assert.equal(three.checkpoint,null); // Cannot claim four-file proof.
pass('tampered originals, receipt and checkpoint never silently accepted');

const second=await core.compareIndependentCopy(bundle,archiveRaw);
assert.equal(second.bytesMatch,true);
assert.equal(second.independentCustodyVerified,false);
await assert.rejects(()=>core.compareIndependentCopy(bundle,archiveRaw.replace('OWNER_PORTABLE','MUTATED_OWNER')),
  /differs/);
pass('second owner-selected copy byte compare without false independent custody');

const records=[older.fromAudit(fixture(541100003,'c'.repeat(40),[])),
  older.fromAudit(fixture(541100002,'b'.repeat(40),[])),bundle.record];
const alert=core.alertLifecycle(records);
assert.equal(alert.length,1);
assert.equal(alert[0].observedState,'TWO_LATER_IMPORTED_RELEASES_CLEARANCE_CANDIDATE');
assert.equal(alert[0].externallyVerifiedClosed,false);
assert.equal(core.alertLifecycle([bundle.record])[0].observedState,'ACTIVE_IN_LATEST_IMPORTED_RELEASE');
assert.throws(()=>core.alertLifecycle(records,[{code:'SOURCE_STEP_GAP_P95',action:'RESOLVED'}]),/Invalid/);
pass('rolling alert lifecycle preserves originals and withholds automatic closure');

await assert.rejects(()=>core.sealOwnerReview(bundle,{copyCompared:true,ownerAcknowledged:false}),
  /explicit owner/);
await assert.rejects(()=>core.sealOwnerReview(bundle,{copyCompared:false,ownerAcknowledged:true}),
  /matching second copy/);
const reviewed=await core.sealOwnerReview(bundle,{copyCompared:true,ownerAcknowledged:true,
  records,alertDecisions:[{code:'SOURCE_STEP_GAP_P95',action:'INVESTIGATING'}]},
  '2026-11-07T16:00:00.000Z');
assert.equal(reviewed.originalGitHubArtifactExpiryUnchanged,true);
assert.equal(reviewed.nextOwnerReviewAfter,'2026-12-07T16:00:00.000Z');
assert.equal(reviewed.ownerConfirmedSeparateCustody,true);
assert.equal(reviewed.independentCustodyVerified,false);
assert.equal(reviewed.originalAlertStates[0].ownerAction,'INVESTIGATING');
assert.equal(reviewed.originalAlertStates[0].externallyVerifiedClosed,false);
assert.equal((await core.openOwnerReview(reviewed,bundle)).originalMainSha,bundle.record.sha);
const fake=structuredClone(reviewed);fake.ownerConfirmedSeparateCustody=false;
await assert.rejects(()=>core.openOwnerReview(fake,bundle),/changed after export/);
pass('explicit owner renewal after second-copy readback; exported review tamper rejection');

const index=readFileSync('index.html','utf8');
const staticBuild=readFileSync('scripts/build-vercel-site.mjs','utf8');
const ui=readFileSync('js/owner-ci-custody-ui-541.js','utf8');
for(const asset of ['build541-ci-custody.css','js/owner-ci-custody-core-541.js',
  'js/owner-ci-custody-ui-541.js'])assert.ok(index.includes(`/${asset}?v=20261107b541`));
assert.ok(staticBuild.includes("'build541-ci-custody.css'"));
assert.ok(ui.includes('owner?.mount'));
assert.ok(ui.includes("getElementById('owner540CiSlo')"));
assert.ok(ui.includes('core.compareIndependentCopy'));
assert.ok(ui.includes('core.sealOwnerReview'));
assert.ok(!/\b(fetch|XMLHttpRequest|WebSocket|localStorage|sessionStorage)\s*\(/.test(ui));
pass('owner management UI, versioned static assets and no privileged browser API');

const source=readFileSync('.github/workflows/staging-browser-integration.yml','utf8');
const post=readFileSync('.github/workflows/post-promotion-dev-reconciliation.yml','utf8');
const sep=readFileSync('scripts/release-job-separation-check.mjs','utf8');
const runbook=readFileSync('docs/build541-ci-archive-custody-runbook.txt','utf8');
assert.equal((source.match(/run: node scripts\/build541-ci-custody-check\.mjs/g)??[]).length,1);
assert.ok(!source.includes('  build541:'));
assert.equal(REQUIRED_GATES.length,7);
assert.ok(sep.includes('build541-independent-owner-custody-review-is-read-only'));
assert.ok(post.includes('Build 530–541 read-only CI throughput and recovery evidence'));
assert.ok(post.includes('run: node scripts/build541-ci-custody-checkpoint.mjs'));
assert.ok(post.includes('ci-slo-custody-checkpoint.json'));
assert.ok(post.includes('retention-days: 30'));
assert.ok(runbook.includes('does NOT extend GitHub'));
assert.ok(!post.includes('secrets.DATABASE_URL'));
pass('source job and post-GREEN independent artifact checkpoint preserve protections');

const originalHash=createHash('sha256').update(archiveRaw).digest('hex');
assert.equal(bundle.original.archiveDigest,originalHash);
assert.equal(checkpoint.ownerArchiveFileSha256,originalHash);
assert.equal(checkpoint.originalRetentionReceiptSha256,
  createHash('sha256').update(receiptRaw).digest('hex'));
pass('portable SHA-256 checkpoint matches all original archived bytes');

console.log(`Build 541: ${checks} original source, two-copy, renewal and alert lifecycle checks GREEN.`);
