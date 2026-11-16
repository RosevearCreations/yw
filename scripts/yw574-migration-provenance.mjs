/* YW574 - source-only ordered migration provenance and independent protocol compatibility.
 * NO SQL execution, network request, private credentials, signer enrollment or production apply.
 * A source fingerprint matching a supplied snapshot does NOT attest database migration history.
 */
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';

export const YW574_ORDER=Object.freeze([
  [556,'sql/landscape_recovery_556.sql'],
  [557,'sql/landscape_dispatch_reconciliation_557.sql'],
  [558,'sql/landscape_supervisor_resolution_558.sql'],
  [559,'sql/landscape_recovery_closure_559.sql'],
  [560,'sql/landscape_followup_continuity_560.sql'],
  [561,'sql/landscape_provider_validation_561.sql'],
  [562,'sql/landscape_provider_runtime_pilot_562.sql'],
  [563,'sql/landscape_master_receipt_triage_563.sql'],
  [564,'sql/landscape_master_continuity_564.sql'],
  [565,'sql/landscape_master_stability_565.sql'],
  [566,'sql/landscape_master_forecast_566.sql'],
  [567,'sql/landscape_master_remediation_567.sql'],
  [568,null],[569,null],[570,null],[571,null],
  [572,'docs/security/YW572_STAGING_ONLY_REPLAY_REGISTRY_SCHEMA.sql'],
  [573,'docs/security/YW573_STAGING_ONLY_DISPOSITION_SCHEMA.sql'],
].map(([build,file])=>Object.freeze({
  build,file,
  phase:file ? (build>=572?'STAGING_DESIGN_NOT_APPLIED':'ORIGINAL_SQL_PROVENANCE_UNATTESTED') : 'SOURCE_ONLY_NO_NEW_SQL'
})));
const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
const hashPattern=/^[a-f0-9]{64}$/;
const revisionPattern=/^[a-f0-9]{40}$/;
const refPattern=/^[a-z0-9-]{15,35}$/;
const normal=s=>typeof s==='string'?s.trim():'';
const hasOwn=(obj,k)=>Object.prototype.hasOwnProperty.call(obj,k);

export function sourceManifest574(root=process.cwd(),reader=fs){
  const files=YW574_ORDER.map(step=>{
    if(!step.file)return {...step,sha256:null};
    const raw=reader.readFileSync(path.resolve(root,step.file));
    if(!raw || !raw.length)throw new Error('EMPTY_OR_MISSING_SOURCE:'+step.file);
    return {...step,sha256:sha256(raw)};
  });
  return Object.freeze({
    build:574,sourceOnly:true,executedMigrationCount:0,
    files,sourceFingerprint:sha256(files.map(x=>String(x.build)+'|'+(x.file||'none')+'|'+(x.sha256||'none')).join('\n'))
  });
}

export function evaluateStagingProvenance574(input){
  const {manifest,snapshot,environment,projectRef,registeredStagingRef,productionRef,knownProductionRef='jmqvkgiqlimdhcofwkxr'}=input||{};
  const holds=[];
  const production=normal(productionRef).toLowerCase();
  const known=normal(knownProductionRef).toLowerCase();
  const project=normal(projectRef).toLowerCase();
  const registered=normal(registeredStagingRef).toLowerCase();
  if(normal(environment).toLowerCase()!=='staging')holds.push('HOLD_NOT_STAGING');
  if(!refPattern.test(project)||project===production||project===known)holds.push('HOLD_PRODUCTION_OR_INVALID_TARGET');
  if(!refPattern.test(registered)||registered!==project)holds.push('HOLD_STAGING_IDENTITY_NOT_CONFIRMED');
  if(!production || !refPattern.test(production))holds.push('HOLD_PRODUCTION_REF_UNKNOWN');
  if(!manifest||manifest.build!==574||!Array.isArray(manifest.files)||manifest.files.length!==YW574_ORDER.length)
    holds.push('HOLD_SOURCE_INVENTORY_MISSING');
  const fileList=Array.isArray(manifest?.files)?manifest.files:[];
  for(let i=0;i<YW574_ORDER.length;i++){
    const required=YW574_ORDER[i],entry=fileList[i];
    if(!entry||entry.build!==required.build||entry.file!==required.file||entry.phase!==required.phase||
      (required.file?!hashPattern.test(entry.sha256):entry.sha256!==null))
      holds.push('HOLD_SOURCE_ORDER_OR_FINGERPRINT_'+required.build);
  }
  if(!hashPattern.test(manifest?.sourceFingerprint))holds.push('HOLD_SOURCE_DIGEST_MISSING');
  if(!snapshot||!revisionPattern.test(snapshot.sourceCommit)||!Array.isArray(snapshot.files))
    holds.push('HOLD_INDEPENDENT_SOURCE_SNAPSHOT_MISSING');
  else{
    const requiredFiles=fileList.filter(x=>x.file);
    if(snapshot.files.length!==requiredFiles.length)holds.push('HOLD_SOURCE_FILE_COUNT_DRIFT');
    const seen=new Set();
    for(let i=0;i<requiredFiles.length;i++){
      const expected=requiredFiles[i],actual=snapshot.files[i];
      if(!actual||seen.has(actual.path)||actual.path!==expected.file||actual.sha256!==expected.sha256)
        holds.push('HOLD_ORDERED_SHA256_DRIFT_'+expected.build);
      if(actual?.path)seen.add(actual.path);
    }
    if(snapshot.sourceFingerprint!==manifest?.sourceFingerprint)holds.push('HOLD_SOURCE_SNAPSHOT_DIGEST_DRIFT');
  }
  // No signature/key/policy enrollment, database readback or backup validation is performed here.
  // A perfect source match only qualifies for a supervised staging ceremony request.
  const sourceMatched=holds.length===0;
  return Object.freeze({
    code:sourceMatched?'SOURCE_INVENTORY_MATCHED_STAGING_REVIEW_REQUIRED':'HOLD_SOURCE_OR_TARGET_DRIFT',
    holds,sourceMatched,stagingReviewCandidate:sourceMatched,
    stagingSqlApplied:false,productionMigrationAuthorized:false,
    productionParityVerified:false,originalWitnessQuorumVerified:false,
    externalMasterAcknowledged:false,actualCrossAppTransport:false
  });
}
const KNOWN=Object.freeze({
  'yw.original-receipt.read': '1.0',
  'yw.migration-provenance.read':'1.0',
  'yw.staging-parity.review':'1.1'
});
export function negotiateIndependentSync574({
  peerProtocol='1.0',peerAvailable=false,capability='yw.original-receipt.read',
  tenantId='',audience='',authorizationVerified=false,consentVerified=false
}={}){
  const legacy=peerProtocol==='1.0',modern=peerProtocol==='1.1';
  const known=hasOwn(KNOWN,capability);
  const supported=known && (KNOWN[capability]==='1.0'||modern);
  const correctMajor=legacy||modern;
  const exactScope=normal(tenantId).length>0&&normal(audience).length>0;
  const negotiable=correctMajor&&peerAvailable&&supported&&exactScope&&authorizationVerified&&consentVerified;
  const code=!correctMajor?'HOLD_INCOMPATIBLE_MAJOR':
    !peerAvailable?'HOLD_PEER_UNAVAILABLE':
    !known?'HOLD_UNKNOWN_CAPABILITY':
    !supported?'HOLD_ADDITIVE_1_1_CAPABILITY_ON_1_0_PEER':
    !exactScope||!authorizationVerified||!consentVerified?'HOLD_SCOPE_AUTH_OR_CONSENT':
    'COMPATIBLE_CONTRACT_ONLY_RUNTIME_ACK_REQUIRED';
  return Object.freeze({
    code,compatible:negotiable,negotiatedProtocol:legacy?'1.0':modern?'1.1':null,
    localOperationsContinue:true,allSevenAppsReleaseTogether:false,
    peerCapabilityHoldsOnly:!negotiable,actualDeliveryVerified:false,
    originalMasterAuthorityVerified:false,
    rawSecretSync:false,directPeerDatabaseSync:false
  });
}

if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
  const source=sourceManifest574();
  const status=evaluateStagingProvenance574({manifest:source});
  console.log(JSON.stringify({
    build:574,sourceOnly:true,files:source.files.length,sourceFingerprint:source.sourceFingerprint,
    status:status.code,productionParityVerified:false,sqlExecuted:false
  },null,2));
}
