// QL-253 offline reconciliation. Public source data never proves private custody or owner consent.
import {reviewPublicProofPublication} from './rosevear-ql249-renewal-483.mjs';
import {reviewCustodyClaim,reviewOwnerTestOnlyClaim} from './rosevear-ql252-proof-custody-484.mjs';
const error=(ok,code)=>{if(!ok)throw Error('QL253_485_HOLD_'+code);};
const shape=(o,fields)=>o&&typeof o==='object'&&!Array.isArray(o)
 &&Object.keys(o).sort().join('|')===[...fields].sort().join('|');
const sha=x=>typeof x==='string'&&/^[a-f0-9]{40}$/.test(x);
const digest=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
const receipt=x=>typeof x==='string'&&/^np-[a-z0-9][a-z0-9-]{2,100}$/.test(x);

export function reviewQl253RegistryCandidate(registry){
 error(shape(registry,['sourceShaA','proofShaB','tenantId','publicSignerSpkiSha256',
  'registrySnapshotSha256','registryReceiptId','custodianReceiptId','witnessReceiptId',
  'independentRegistryMatch','privateWitnessAuthenticated','nonceAgeMs']),'REGISTRY_FIELDS');
 error(sha(registry.sourceShaA)&&sha(registry.proofShaB)
  &&registry.sourceShaA!==registry.proofShaB,'TWO_SHA');
 error(receipt(registry.tenantId)&&digest(registry.publicSignerSpkiSha256)
  &&digest(registry.registrySnapshotSha256),'PIN_AND_REGISTRY_DIGEST');
 error(receipt(registry.registryReceiptId)&&receipt(registry.custodianReceiptId)
  &&receipt(registry.witnessReceiptId)&&new Set([registry.registryReceiptId,
   registry.custodianReceiptId,registry.witnessReceiptId]).size===3,'DISTINCT_RECEIPTS');
 error(typeof registry.independentRegistryMatch==='boolean'
  &&typeof registry.privateWitnessAuthenticated==='boolean','AUTH_FLAGS');
 error(Number.isSafeInteger(registry.nonceAgeMs)&&registry.nonceAgeMs>=0
  &&registry.nonceAgeMs<=300000,'NONCE_AGE');
 return {private_registry_claim_consistent:true,independent_registry_match_claimed:registry.independentRegistryMatch,
  original_private_registry_verified_here:false,original_witness_verified_here:false,
  connection_state:'DISCONNECTED',decision:'HOLD'};
}

export function reconcileQl253PublicSnapshot(snapshot,{custody=null,registry=null,owner=null}={}){
 error(shape(snapshot,['observedMainSha','proofHttpStatus','sourceProofObservation',
  'publicCiHeadSha','publicAncestryConfirmed','publicSignatureCryptographicallyValid',
  'actualHealthGetReceipt','actualCapabilitiesGetReceipt','actualSevenDenialsVerified']),'SNAPSHOT_FIELDS');
 error(sha(snapshot.observedMainSha),'MAIN_SHA');
 error([200,404].includes(snapshot.proofHttpStatus),'PROOF_HTTP');
 error(snapshot.proofHttpStatus===snapshot.sourceProofObservation.immutableHttpStatus,'HTTP_BINDING');
 error(snapshot.publicCiHeadSha===null||sha(snapshot.publicCiHeadSha),'CI_SHA');
 error(typeof snapshot.publicAncestryConfirmed==='boolean'
  &&typeof snapshot.publicSignatureCryptographicallyValid==='boolean','PUBLIC_FLAGS');
 error(snapshot.actualHealthGetReceipt===null&&snapshot.actualCapabilitiesGetReceipt===null
  &&snapshot.actualSevenDenialsVerified===false,'LIVE_RECEIPTS_NOT_AUTHORIZED');
 const proof=reviewPublicProofPublication(snapshot.sourceProofObservation);
 const source=snapshot.sourceProofObservation.sourceShaA;
 const proofSha=snapshot.sourceProofObservation.proofShaB;
 if(proofSha!==null)error(proofSha===snapshot.observedMainSha||
  snapshot.publicAncestryConfirmed,'PROOF_MAIN_ANCESTRY');
 const sourceMatch=source!==null&&snapshot.publicCiHeadSha===source
  &&snapshot.sourceProofObservation.sourceCiHeadSha===source;
 const publicCandidate=proof.public_proof_available_candidate&&sourceMatch
  &&snapshot.publicAncestryConfirmed&&snapshot.publicSignatureCryptographicallyValid;
 const custodyReview=custody===null?null:reviewCustodyClaim(custody);
 const registryReview=registry===null?null:reviewQl253RegistryCandidate(registry);
 const ownerReview=owner===null?null:reviewOwnerTestOnlyClaim(owner);
 for(const record of [custody,registry])if(record!==null){
  error(record.sourceShaA===source&&record.proofShaB===proofSha,'IDENTITY_BINDING');
  if(registry!==null)error(record.tenantId===registry.tenantId,'TENANT_BINDING');
 }
 if(owner!==null&&registry!==null)error(owner.tenantId===registry.tenantId,'OWNER_TENANT');
 if(registry!==null)error(registry.publicSignerSpkiSha256===snapshot.sourceProofObservation.publicSpkiSha256,'SPKI_BINDING');
 const blockers=[];
 if(snapshot.proofHttpStatus===404)blockers.push('PUBLIC_PROOF_HTTP_404');
 if(!publicCandidate)blockers.push('TWO_SHA_CI_ANCESTRY_SIGNATURE_NOT_VERIFIED');
 if(custodyReview===null||registryReview===null)blockers.push('PRIVATE_PIN_REGISTRY_CUSTODY_WITNESS_NOT_AVAILABLE');
 else blockers.push('ORIGINAL_PRIVATE_PIN_AND_WITNESS_ATTESTATIONS_REQUIRE_HUMAN_REVIEW');
 if(ownerReview===null||!ownerReview.test_only_approval_claim_candidate)
  blockers.push('OWNER_TEST_APPROVAL_NOT_GIVEN_OR_NOT_VERIFIED');
 else blockers.push('OWNER_TEST_CLAIM_REQUIRES_INDEPENDENT_AUTHENTICATION');
 blockers.push('REAL_GET_DENIAL_AUDIT_AND_PILOT_RELEASE_NOT_AUTHORIZED');
 return {observed_main_sha:snapshot.observedMainSha,public_proof_status:snapshot.proofHttpStatus,
  public_source_origin_candidate:publicCandidate,private_registry_verified:false,
  owner_test_authorized:false,real_gateway_test:'NOT_RUN',blockers,
  private_24_7_relay_deployed:false,credentials_provisioned:false,
  connection_state:'DISCONNECTED',decision:'HOLD'};
}
