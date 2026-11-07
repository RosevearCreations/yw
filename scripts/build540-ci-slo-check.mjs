#!/usr/bin/env node
/** Build 540 protected source verification: owner dashboard, original-run SLO
 * evidence, rolling alert groups and time-limited portable retention custody. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash, webcrypto } from 'node:crypto';
import { createEvidenceArchive } from './build540-ci-slo-retention-core.mjs';
import { REQUIRED_GATES } from './build530-ci-runtime-audit-core.mjs';

if (!globalThis.crypto?.subtle) globalThis.crypto = webcrypto;
const core = globalThis.YWICiSloCore540;
assert.ok(core);
let tests = 0;
function check(label, fn) { fn(); tests++; console.log(`PASS build540 ${label}`); }
const sha = 'a'.repeat(40);
const fixture = (runId = 540000010, commitSha = sha, alerts = []) => ({
  schema: core.REPORT, observedAt: '2026-11-07T08:00:00.000Z',
  sourceRunId: runId, currentMainSha: commitSha, exactCurrentMain: true,
  current: { runId, headSha: commitSha, status: 'VERIFIED_GREEN' },
  build539: {
    currentRunId: runId, state: 'EXACT_MAIN_VERIFIED_ORIGINAL_ACTIONS_SCHEDULING',
    sloState: alerts.length ? 'REVIEW_OBSERVED_SLO_DRIFT' : 'MEETS_OBSERVATIONAL_SLO_BUDGET',
    trendState: 'SIX_RELEASE_VERIFIED_TREND', verifiedDistinctSamples: 6,
    originalMainRunIds: [runId, runId-1, runId-2, runId-3, runId-4, runId-5],
    current: { handoffSeconds: 7, setupSeconds: 9, interStepGapSeconds: 3 },
    historicalP95: { runnerHandoffSeconds: 13, runnerSetupSeconds: 20,
      sourceStepGapSeconds: 10, sourceSeconds: 190, releaseSeconds: 560 },
    cohorts: { metrics: { sourceSeconds: { increaseSeconds: 8 },
      warmSeconds: { increaseSeconds: -2 }, releaseSeconds: { increaseSeconds: 12 } } },
    alerts,
    safeguards: { requiredGates: [...REQUIRED_GATES], requireExactCurrentMain: true,
      changesProtectedJobs: false, releaseAuthority: false, gateWaiver: false },
  },
});
const warning = [{code:'SOURCE_STEP_GAP_P95',observedSeconds:18,limitSeconds:15,overSeconds:3}];
const report = fixture(540000010,sha,warning);
const record = core.fromAudit(report);
check('exact-main read-only original run', () => {
  assert.equal(record.runId, report.sourceRunId);
  assert.equal(record.runner.handoff, 7);
  assert.equal(record.p95.release, 560);
  assert.equal(record.drift.warm, -2);
  assert.equal(record.sloState,'REVIEW_OBSERVED_SLO_DRIFT');
});
check('wrong audit identity fails closed', () => {
  const fake = structuredClone(report);fake.currentMainSha='b'.repeat(40);
  assert.throws(()=>core.fromAudit(fake), /exact current main/);
  const stale = structuredClone(report);stale.exactCurrentMain=false;
  assert.throws(()=>core.fromAudit(stale), /exact current main/);
  const run = structuredClone(report);run.build539.currentRunId++;
  assert.throws(()=>core.fromAudit(run), /source identity/);
  const incomplete = structuredClone(report);incomplete.current.status='PENDING';
  assert.throws(()=>core.fromAudit(incomplete), /exact current main/);
});
check('incomplete and forged SLO evidence rejected', () => {
  const incomplete = structuredClone(report);delete incomplete.build539.historicalP95.releaseSeconds;
  assert.throws(()=>core.fromAudit(incomplete), /incomplete/);
  const duplicate = structuredClone(report);duplicate.build539.alerts=[...warning,...warning];
  assert.throws(()=>core.fromAudit(duplicate), /duplicate alert/);
  const noWarn = structuredClone(report);noWarn.build539.alerts=[];
  assert.throws(()=>core.fromAudit(noWarn), /does not match/);
  const few = structuredClone(report);few.build539.verifiedDistinctSamples=4;
  assert.throws(()=>core.fromAudit(few), /six distinct/);
});
check('rolling six-release dedup preserves repeated alerts', () => {
  const releases = [record,core.fromAudit(fixture(540000009,'b'.repeat(40),warning)),
    core.fromAudit(fixture(540000008,'c'.repeat(40)))];
  const alerts = core.dedupeAlerts(releases);
  assert.equal(alerts.length,1);
  assert.deepEqual([alerts[0].occurrences,alerts[0].repeatState,alerts[0].maxOverSeconds],
    [2,'REPEATED',3]);
  assert.equal(core.dedupeAlerts(releases,1)[0].repeatState,'FIRST_OBSERVATION');
  assert.throws(()=>core.mergeRecords(releases,[{...record,runner:{...record.runner,handoff:80}}]),
    /Conflicting evidence/);
  assert.throws(()=>core.mergeRecords(releases,[{...record,runId:540000011}]),
    /reuse a commit SHA/);
});
const {archive,receipt}=createEvidenceArchive(report);
check('independent Node SHA-256 receipt for bounded owner archive', () => {
  assert.equal(archive.schema,core.ARCHIVE);
  assert.equal(archive.records.length,1);
  assert.equal(receipt.originalActionsRunId,record.runId);
  assert.equal(receipt.originalMainSha,record.sha);
  assert.equal(receipt.artifactRetentionDays,30);
  assert.equal(receipt.longTermOwnerExportRequired,true);
  assert.equal(receipt.independentArchiveCustodyVerified,false);
  assert.equal(receipt.independentSourceSignatureVerified,false);
  assert.equal(receipt.productionMutation,false);
  assert.equal(receipt.protectedGateWaiver,false);
  assert.equal(archive.integrity.payloadDigest,
    createHash('sha256').update(JSON.stringify({schema:core.ARCHIVE,records:[record]})).digest('hex'));
});
assert.deepEqual(await core.openArchive(archive),[record]);
assert.equal((await core.sealArchive([record])).integrity.payloadDigest,archive.integrity.payloadDigest);
const altered=structuredClone(archive);altered.records[0].runner.handoff=100;
await assert.rejects(()=>core.openArchive(altered),/digest mismatch/);
const malformed=structuredClone(archive);malformed.records[0].alerts.push({...warning[0]});
await assert.rejects(()=>core.openArchive(malformed),/duplicate alert/);
tests++;console.log('PASS build540 browser and CI archives interoperate and tampering fails closed');

const source=readFileSync('.github/workflows/staging-browser-integration.yml','utf8');
const post=readFileSync('.github/workflows/post-promotion-dev-reconciliation.yml','utf8');
const index=readFileSync('index.html','utf8');
const staticBuild=readFileSync('scripts/build-vercel-site.mjs','utf8');
const ui=readFileSync('js/owner-ci-slo-dashboard-540.js','utf8');
const runbook=readFileSync('docs/build540-ci-slo-owner-evidence-runbook.txt','utf8');
check('dashboard assets and owner-management mount are versioned',()=>{
  for(const asset of ['build540-ci-slo.css','js/owner-ci-slo-core-540.js',
    'js/owner-ci-slo-dashboard-540.js'])assert.ok(index.includes(`/${asset}?v=20261107b540`));
  assert.ok(staticBuild.includes("'build540-ci-slo.css'"));
  assert.ok(ui.includes("getElementById('ownerCommand350')"));
  assert.ok(ui.includes("owner?.mount"));
});
check('static owner dashboard performs no live privileged requests',()=>{
  assert.ok(!/\b(fetch|XMLHttpRequest|WebSocket|localStorage|sessionStorage)\s*\(/.test(ui));
  assert.ok(!ui.includes('Authorization:'));
  assert.ok(ui.includes('textContent'));
  assert.ok(ui.includes('core.dedupeAlerts(records,6)'));
  assert.ok(runbook.includes('not independently signed'));
});
check('original source job retains all protected release checks',()=>{
  assert.equal((source.match(/run: node scripts\/build540-ci-slo-check\.mjs/g)||[]).length,1);
  assert.ok(source.includes('  browser-regression-lanes:'));
  for(const name of ['source-checks','repository-enforcement','release-source-evidence',
    'release-truth-summary'])assert.ok(source.includes(`  ${name}:`));
  assert.deepEqual(REQUIRED_GATES.length,7);
  assert.ok(!source.includes('  build540:'));
});
check('post-promotion original audit, checksum archive and 30-day receipt',()=>{
  assert.ok(post.includes('Build 530–540 read-only CI throughput and recovery evidence'));
  assert.ok(post.includes('node scripts/build530-ci-runtime-audit.mjs'));
  assert.ok(post.includes('run: node scripts/build540-ci-slo-retention.mjs'));
  assert.ok(post.includes('ci-runtime-audit.json'));
  assert.ok(post.includes('ci-slo-archive.json'));
  assert.ok(post.includes('ci-slo-retention-receipt.json'));
  assert.ok(post.includes('retention-days: 30'));
});
console.log(`Build 540: ${tests} source/retention acceptance checks plus browser/Node integrity and tamper rejection passed.`);
