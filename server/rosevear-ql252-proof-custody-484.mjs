// Offline intake only: public observations and private receipt claims never grant integration authority.
import {reviewPublicProofPublication} from './rosevear-ql249-renewal-483.mjs';
const fail=(ok,name)=>{if(!ok)throw Error('QL252_484_HOLD_'+name);};
const exact=(o,keys)=>o&&typeof o==='object'&&!Array.isArray(o)
 &&Object.keys(o).sort().join('|')===[...keys].sort().join('|');
const receipt=x=>typeof x==='string'&&/^np-[a-z0-9][a-z0-9-]{2,100}$/.test(x);
const digest=x=>typeof x==='string'&&/^[0-9a-f]{64}$/.test(x);
const sha=x=>typeof x==='string'&&/^[0-9a-f]{40}$/.test(x);
export const endpoints=Object.freeze(['/api/integration/v1/health','/api/integration/v1/capabilities']);

export function reviewCustodyClaim(claim){
 fail(exact(claim,['sourceShaA','proofShaB','businessId','tenantId','responseSha256',
  'custodianReceiptId','witnessReceiptId','custodianSpkiSha256','witnessSpkiSha256',
  'nonceIssuedAt','nonceAnsweredAt','witnessSignedAt','independentOriginConfirmed']),'FIELDS');
 fail(sha(claim.sourceShaA)&&sha(claim.proofShaB)&&claim.sourceShaA!==claim.proofShaB,'TWO_SHA');
 fail(claim.businessId==='yw'&&receipt(claim.tenantId),'TENANT');
 fail(digest(claim.responseSha256)&&digest(claim.custodianSpkiSha256)&&digest(claim.witnessSpkiSha256)
  &&claim.custodianSpkiSha256!==claim.witnessSpkiSha256,'DISTINCT_PINS');
 fail(receipt(claim.custodianReceiptId)&&receipt(claim.witnessReceiptId)
  &&claim.custodianReceiptId!==claim.witnessReceiptId,'DISTINCT_RECEIPTS');
 fail(Number.isSafeInteger(claim.nonceIssuedAt)&&Number.isSafeInteger(claim.nonceAnsweredAt)
  &&claim.nonceAnsweredAt>=claim.nonceIssuedAt&&claim.nonceAnsweredAt-claim.nonceIssuedAt<=300000,'NONCE');
 fail(Number.isSafeInteger(claim.witnessSignedAt)&&claim.witnessSignedAt>=claim.nonceIssuedAt
  &&claim.witnessSignedAt<=claim.nonceAnsweredAt+300000,'WITNESS_TIME');
 fail(typeof claim.independentOriginConfirmed==='boolean','ORIGIN_CONFIRMATION');
 return {custody_claim_shape_valid:true,claimed_origin_confirmation:claim.independentOriginConfirmed,
  original_private_attestations_independently_verified:false,trust_state:'UNTRUSTED_CANDIDATE',
  connection_state:'DISCONNECTED',decision:'HOLD'};
}

export function reviewOwnerTestOnlyClaim(claim){
 fail(exact(claim,['businessId','tenantId','environment','method','paths','windowStartUtc',
  'windowEndUtc','observedAtUtc','ownerDecision','ownerReceiptId','privateIdentityVerified',
  'gatewayRequestsExecuted']),'FIELDS');
 fail(claim.businessId==='yw'&&receipt(claim.tenantId)&&claim.environment==='nonproduction','SCOPE');
 fail(claim.method==='GET'&&JSON.stringify(claim.paths)===JSON.stringify(endpoints),'GET_ONLY');
 fail(Number.isSafeInteger(claim.observedAtUtc)&&Number.isSafeInteger(claim.windowStartUtc)
  &&Number.isSafeInteger(claim.windowEndUtc)&&claim.windowStartUtc>claim.observedAtUtc
  &&claim.windowEndUtc>claim.windowStartUtc&&claim.windowEndUtc-claim.windowStartUtc<=1800000,'FUTURE_WINDOW');
 fail(['NOT_GIVEN','REQUESTED_PRIVATE_REVIEW','INDEPENDENTLY_VERIFIED_BY_OWNER'].includes(claim.ownerDecision),'OWNER_DECISION');
 fail(claim.ownerReceiptId===null||receipt(claim.ownerReceiptId),'OWNER_RECEIPT');
 fail(typeof claim.privateIdentityVerified==='boolean'&&claim.gatewayRequestsExecuted===false,'NO_TEST');
 const candidate=claim.ownerDecision==='INDEPENDENTLY_VERIFIED_BY_OWNER'
  &&receipt(claim.ownerReceiptId)&&claim.privateIdentityVerified;
 return {test_only_approval_claim_candidate:candidate,independent_private_approval_verified_here:false,
  window_reserved:false,request_executed:false,dispatch_enabled:false,
  owner_pilot_authorized:false,connection_state:'DISCONNECTED',decision:'HOLD'};
}

export function reconcileQl252(publicObservation,custodyClaim,ownerClaim){
 const publication=reviewPublicProofPublication(publicObservation);
 const custody=custodyClaim===null?null:reviewCustodyClaim(custodyClaim);
 const owner=ownerClaim===null?null:reviewOwnerTestOnlyClaim(ownerClaim);
 fail(custody===null||publicObservation.sourceShaA===custodyClaim.sourceShaA
  &&publicObservation.proofShaB===custodyClaim.proofShaB,'SOURCE_CUSTODY_BINDING');
 fail(owner===null||custody===null||ownerClaim.tenantId===custodyClaim.tenantId,'TENANT_BINDING');
 return {publication_status:publication.public_proof_available_candidate?'PUBLIC_METADATA_CANDIDATE':'404_OR_NOT_AVAILABLE',
  custody_status:custody?.trust_state??'NOT_AVAILABLE',
  owner_test_status:owner?.test_only_approval_claim_candidate?'PRIVATE_RECHECK_REQUIRED':'NOT_VERIFIED',
  immutable_public_proof_url:publication.immutable_public_proof_url,
  real_negative_tests_verified:false,real_gateway_gets_verified:false,
  credentials_provisioned:false,connection_state:'DISCONNECTED',decision:'HOLD'};
}
