import test from 'node:test';
import assert from 'node:assert/strict';
import {sourceManifest574,evaluateStagingProvenance574,negotiateIndependentSync574,YW574_ORDER} from './yw574-migration-provenance.mjs';

const SRC='2d0097dc03e4e83fcd6cbd69ddae16ca07266940';
const staging='isolatedstaging123456';
const production='jmqvkgiqlimdhcofwkxr';
const manifest=sourceManifest574();
const snapshot=()=>({
  sourceCommit:SRC,sourceFingerprint:manifest.sourceFingerprint,
  files:manifest.files.filter(x=>x.file).map(x=>({path:x.file,sha256:x.sha256}))
});
const candidate=(extra={})=>({
  manifest,snapshot:snapshot(),environment:'staging',
  projectRef:staging,registeredStagingRef:staging,productionRef:production,...extra
});

test('YW574 covers every ordered YW556–573 build without silently treating source-only revisions as migrations',()=>{
  assert.deepEqual(YW574_ORDER.map(x=>x.build),Array.from({length:18},(_,i)=>i+556));
  assert.equal(manifest.files.filter(x=>x.phase==='ORIGINAL_SQL_PROVENANCE_UNATTESTED').length,12);
  assert.equal(manifest.files.filter(x=>x.phase==='SOURCE_ONLY_NO_NEW_SQL').length,4);
  assert.equal(manifest.files.filter(x=>x.phase==='STAGING_DESIGN_NOT_APPLIED').length,2);
  assert.match(manifest.sourceFingerprint,/^[0-9a-f]{64}$/);
  assert.equal(manifest.executedMigrationCount,0);
  assert.ok(manifest.files.filter(x=>x.file).every(x=>/^[0-9a-f]{64}$/.test(x.sha256)));
});

test('A matching source snapshot only requests independent staging review: never implies database parity or migration approval',()=>{
  const r=evaluateStagingProvenance574(candidate());
  assert.equal(r.sourceMatched,true);
  assert.equal(r.stagingReviewCandidate,true);
  assert.equal(r.productionParityVerified,false);
  assert.equal(r.stagingSqlApplied,false);
  assert.equal(r.productionMigrationAuthorized,false);
  assert.equal(r.originalWitnessQuorumVerified,false);
  assert.equal(r.actualCrossAppTransport,false);
});

test('Reject any Production target, unknown project registration, wrong source revision, reorder, duplicate or altered file hash',()=>{
  const failing=[
    candidate({environment:'production'}),
    candidate({projectRef:production,registeredStagingRef:production}),
    candidate({registeredStagingRef:'otherstaging99999999'}),
    candidate({productionRef:staging}),
    candidate({snapshot:{...snapshot(),sourceCommit:'not-a-commit'}}),
    candidate({snapshot:{...snapshot(),sourceFingerprint:'f'.repeat(64)}}),
    candidate({snapshot:{...snapshot(),files:[...snapshot().files].reverse()}}),
    candidate({snapshot:{...snapshot(),files:snapshot().files.map((x,i)=>i===0?{...x,sha256:'0'.repeat(64)}:x)}}),
    candidate({snapshot:{...snapshot(),files:[...snapshot().files,snapshot().files[0]]}}),
    candidate({manifest:{...manifest,files:[...manifest.files].reverse()}})
  ];
  for(const input of failing){
    const r=evaluateStagingProvenance574(input);
    assert.equal(r.sourceMatched,false);
    assert.equal(r.productionMigrationAuthorized,false);
    assert.equal(r.productionParityVerified,false);
    assert.notEqual(r.code,'SOURCE_INVENTORY_MATCHED_STAGING_REVIEW_REQUIRED');
  }
});

test('Existing protocol 1.0 peer remains compatible for existing capability without lockstep, no implicit actual ACK',()=>{
  const r=negotiateIndependentSync574({
    peerProtocol:'1.0',peerAvailable:true,capability:'yw.original-receipt.read',
    tenantId:'owned-company',audience:'comms',authorizationVerified:true,consentVerified:true
  });
  assert.equal(r.compatible,true);
  assert.equal(r.negotiatedProtocol,'1.0');
  assert.equal(r.localOperationsContinue,true);
  assert.equal(r.allSevenAppsReleaseTogether,false);
  assert.equal(r.actualDeliveryVerified,false);
});

test('1.1 additive capability is gated independently; unavailable legacy peers never block local operations',()=>{
  const context={peerAvailable:true,capability:'yw.staging-parity.review',
    tenantId:'owned-company',audience:'ai-data-platform',authorizationVerified:true,consentVerified:true};
  assert.equal(negotiateIndependentSync574({...context,peerProtocol:'1.1'}).compatible,true);
  const old=negotiateIndependentSync574({...context,peerProtocol:'1.0'});
  assert.equal(old.compatible,false);
  assert.equal(old.code,'HOLD_ADDITIVE_1_1_CAPABILITY_ON_1_0_PEER');
  const down=negotiateIndependentSync574({...context,peerProtocol:'1.1',peerAvailable:false});
  assert.equal(down.code,'HOLD_PEER_UNAVAILABLE');
  assert.equal(down.localOperationsContinue,true);
});

test('Unknown, major-incompatible, missing exact tenant/audience, revoked consent and absent authorization fail closed',()=>{
  const c={peerProtocol:'1.1',peerAvailable:true,capability:'yw.original-receipt.read',
    tenantId:'owned-company',audience:'comms',authorizationVerified:true,consentVerified:true};
  const cases=[
    [{...c,capability:'*'},'HOLD_UNKNOWN_CAPABILITY'],
    [{...c,peerProtocol:'2.0'},'HOLD_INCOMPATIBLE_MAJOR'],
    [{...c,tenantId:''},'HOLD_SCOPE_AUTH_OR_CONSENT'],
    [{...c,audience:''},'HOLD_SCOPE_AUTH_OR_CONSENT'],
    [{...c,authorizationVerified:false},'HOLD_SCOPE_AUTH_OR_CONSENT'],
    [{...c,consentVerified:false},'HOLD_SCOPE_AUTH_OR_CONSENT']
  ];
  for(const [input,code] of cases){
    const result=negotiateIndependentSync574(input);
    assert.equal(result.code,code);
    assert.equal(result.compatible,false);
    assert.equal(result.localOperationsContinue,true);
    assert.equal(result.rawSecretSync,false);
    assert.equal(result.directPeerDatabaseSync,false);
  }
});
console.log('YW574 ordered provenance and protocol 1.0↔1.1 source-only regression PASS');
