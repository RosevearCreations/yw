import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  YW371_CONTROLLER_MAIN,
  YW371_AI_HUB_MAIN,
  YW371_COMMS_MAIN,
  evaluateYw371SourceClosure
} from '../server/yw371-source-closure.mjs';

const read=p=>fs.readFileSync(p,'utf8');
const manifest=JSON.parse(read('public/.well-known/rosevear-integration-manifest.json'));

assert.equal(manifest.source_id,'yw');
assert.equal(manifest.source_app_id,'yard-workers');
assert.equal(manifest.source_role,'platform_shell');
assert.equal(manifest.tenant_boundary,'platform_shell');
assert.equal(manifest.repository,'RosevearCreations/yw');
assert.equal(manifest.source_revision,null);
assert.equal(manifest.source_revision_state,'HOLD_UNVERIFIED_SOURCE_REVISION');
assert.equal(manifest.source_revision_binding.production,'build_time_vercel_git_commit_sha');
assert.equal(manifest.signature.algorithm,'Ed25519');
assert.equal(manifest.signature.state,'AWAITING_INDEPENDENT_SOURCE_SIGNER');
assert.equal(manifest.connection_state,'DISCONNECTED / HOLD');

const build=read('scripts/build-vercel-site.mjs');
for(const token of [
  "manifest.source_role !== 'platform_shell'",
  "manifest.tenant_boundary !== 'platform_shell'",
  "manifest.source_revision = releaseSha",
  "DEPLOYMENT_BOUND_UNSIGNED",
  "AWAITING_INDEPENDENT_SOURCE_SIGNER",
  "DISCONNECTED / HOLD"
]) assert.ok(build.includes(token),`YW371 build missing ${token}`);

const now=Date.UTC(2026,10,11,18,50,0);
const productionRevision='a'.repeat(40);

const hold=evaluateYw371SourceClosure({
  now,
  productionRevision,
  deployedManifestRevision:productionRevision,
  sourceRole:'platform_shell',
  tenantBoundary:'platform_shell',
  signer:{},
  receipt:{},
  replay:{},
  masters:{
    aiDataMain:YW371_CONTROLLER_MAIN,
    aiHubMain:YW371_AI_HUB_MAIN,
    commsMain:YW371_COMMS_MAIN,
    aiHubRuntime:'HOLD',
    commsRuntime:'HOLD',
    ownerDecision:'HOLD'
  }
});
assert.equal(hold.identityState,'VERIFIED_EXACT');
assert.equal(hold.signerState,'HOLD');
assert.equal(hold.receiptState,'HOLD');
assert.equal(hold.replayState,'HOLD');
assert.equal(hold.threeMasterRuntimeState,'HOLD');
assert.equal(hold.sourceClosureState,'HOLD');
assert.equal(hold.connection,'HOLD');
assert.equal(hold.ownerAccepted,false);
assert.ok(hold.blockers.includes('SOURCE_SIGNER_KEY_ID_MISSING'));
assert.ok(hold.blockers.includes('CONTROLLER_RECEIPT_NOT_ADMITTED'));
assert.ok(hold.blockers.includes('DURABLE_REPLAY_NOT_COMMITTED'));
assert.ok(hold.blockers.includes('AI_HUB_RUNTIME_HOLD'));
assert.ok(hold.blockers.includes('COMMS_RUNTIME_HOLD'));

const ready=evaluateYw371SourceClosure({
  now,
  productionRevision,
  deployedManifestRevision:productionRevision,
  sourceRole:'platform_shell',
  tenantBoundary:'platform_shell',
  signer:{
    keyId:'yw-source-key-371',
    spkiSha256:'sha256:'+'b'.repeat(64),
    controllerEnrollment:'ENROLLED',
    custodyVerified:true,
    witnessVerified:true,
    custodyEvidenceUri:'urn:rosevear:evidence:yw371:custody',
    witnessEvidenceUri:'urn:rosevear:evidence:yw371:witness'
  },
  receipt:{
    schema:'rosevear.ai-data-platform.source-convergence-receipt.v1',
    sourceId:'yw',
    sourceRevision:productionRevision,
    manifestRevision:productionRevision,
    keyId:'yw-source-key-371',
    healthState:'HEALTHY',
    observedAt:new Date(now-60_000).toISOString(),
    controllerAdmission:'ADMITTED'
  },
  replay:{
    state:'COMMITTED',
    evidenceUri:'urn:rosevear:evidence:yw371:replay',
    digest:'sha256:'+'c'.repeat(64)
  },
  masters:{
    aiDataMain:YW371_CONTROLLER_MAIN,
    aiHubMain:YW371_AI_HUB_MAIN,
    commsMain:YW371_COMMS_MAIN,
    aiHubRuntime:'HOLD',
    commsRuntime:'HOLD',
    ownerDecision:'HOLD'
  }
});
assert.equal(ready.identityState,'VERIFIED_EXACT');
assert.equal(ready.signerState,'VERIFIED_CORRELATED');
assert.equal(ready.receiptState,'VERIFIED_CURRENT');
assert.equal(ready.replayState,'VERIFIED');
assert.equal(ready.sourceClosureState,'READY_FOR_CONTROLLER_RECHECK');
assert.equal(ready.threeMasterRuntimeState,'HOLD');
assert.equal(ready.connection,'HOLD');
assert.equal(ready.ownerAccepted,false);

const roleMismatch=evaluateYw371SourceClosure({
  now,
  productionRevision,
  deployedManifestRevision:productionRevision,
  sourceRole:'business_shell',
  tenantBoundary:'platform_shell'
});
assert.equal(roleMismatch.identityState,'HOLD');
assert.ok(roleMismatch.blockers.includes('SOURCE_ROLE_NOT_PLATFORM_SHELL'));

const ql364=read('tests/ql364-source-health.test.mjs');
assert.ok(ql364.includes("assert.equal(manifest.source_role,'platform_shell');"));

const source=read('server/yw371-source-closure.mjs');
assert.ok(!source.includes('PRIVATE KEY'));
assert.ok(!source.includes('process.env'));
assert.ok(source.includes("connection: 'HOLD'"));
assert.ok(source.includes("ownerAccepted: false"));

const pkg=JSON.parse(read('package.json'));
assert.equal(pkg.scripts['test:yw371-source-closure'],'node scripts/yw371-source-closure-check.mjs');
assert.ok(pkg.scripts['build:vercel'].includes('yw371-source-closure-check.mjs'));

console.log('YW371 Product-Shell Identity Reconciliation, Independent Signer/Receipt Closure & Three-Master Runtime Discrepancy verification PASS');
