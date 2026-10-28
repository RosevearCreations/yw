// QL-245 / YW 477: SOURCE-ONLY, offline, nonsecret readiness classification.
// This module cannot create a QL-245 signed envelope, receipt, credential, or owner approval.
export const sourceSystem='yw';
export const canonicalPaths=Object.freeze(['/api/integration/v1/health','/api/integration/v1/capabilities']);
export const canonicalScopes=Object.freeze(['read_health','read_capabilities']);
export const requiredDenials=Object.freeze(['nonce_replay','stale_request','wrong_business',
 'wrong_tenant','revoked_key','prohibited_write','prohibited_dispatch']);
const isSha=x=>typeof x==='string'&&/^[a-f0-9]{40}$/.test(x);
const isCi=x=>typeof x==='string'&&/^https:\/\/github\.com\/RosevearCreations\/yw\/actions\/runs\/[1-9][0-9]*$/.test(x);
const isIssued=x=>typeof x==='string'&&/^np-[a-z0-9][a-z0-9-]{5,100}$/.test(x);
const isUuid=x=>typeof x==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(x);
const isPin=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
const isOrigin=x=>{try{const u=new URL(x);return u.protocol==='https:'&&u.origin===x&&
  !u.username&&!u.password&&!u.search&&!u.hash&&!u.pathname.replaceAll('/','') &&
  !['localhost','127.0.0.1'].includes(u.hostname);}catch{return false;}};
export function assessSourceEvidence(candidate={}){
 const blocks=[];
 const check=(ok,reason)=>{if(!ok)blocks.push(reason);};
 check(isUuid(candidate.tenantId)&&candidate.tenantIndependentlyIssued===true,'ISSUED_REAL_YW_COMPANY_TENANT_UNVERIFIED');
 check(candidate.enabledModule==='jobs'&&candidate.moduleIndependentlyVerified===true,'ENABLED_MODULE_UNVERIFIED');
 check(isSha(candidate.sourceRevision)&&isCi(candidate.ciRunUrl),'EXACT_SOURCE_SHA_GREEN_CI_UNVERIFIED');
 check(isOrigin(candidate.nonproductionOrigin)&&candidate.deployedRevision===candidate.sourceRevision&&
  candidate.originIndependentlyVerified===true,'NONPRODUCTION_ORIGIN_REVISION_UNVERIFIED');
 check(isIssued(candidate.hmacKeyId)&&isIssued(candidate.registryReceiptId)&&candidate.keyRegistryIndependentlyReviewed===true,
  'SEPARATE_NONPRODUCTION_REGISTRY_NOT_PROVISIONED');
 check(isIssued(candidate.signerKeyId)&&isPin(candidate.publicSpkiSha256)&&candidate.pinSeparatelyVerified===true,
  'INDEPENDENT_PUBLIC_SIGNING_PIN_UNVERIFIED');
 check(isIssued(candidate.healthReceiptId)&&isIssued(candidate.capabilitiesReceiptId)&&
  isIssued(candidate.gatewayAuditId)&&candidate.signedSourceReceiptsIndependentlyRead===true,
  'SIGNED_SOURCE_GATEWAY_ORIGINAL_RECEIPTS_UNVERIFIED');
 for(const name of requiredDenials){
  const n=candidate.negativeTests?.[name];
  check(n?.actuallyExecuted===true&&n?.independentlyWitnessed===true&&
   Number.isInteger(n.httpStatus)&&n.httpStatus>=400&&n.httpStatus<=499&&
   isIssued(n.traceId)&&isIssued(n.auditReceiptId),'DENIAL_'+name.toUpperCase()+'_UNVERIFIED');
 }
 check(candidate.auditAfterRestartIndependentlyObserved===true,'DURABLE_GATEWAY_RESTART_PROOF_UNVERIFIED');
 check(candidate.separateExternalReviewerVerified===true,'EXTERNAL_REVIEWER_NOT_VERIFIED');
 // Even a complete applicant-provided packet is a claim, not independently authenticated origin.
 return Object.freeze({
  schema_version:'rosevear.integration.v1',source_system:sourceSystem,business_id:'yw',
  tenant_id:isUuid(candidate.tenantId)?candidate.tenantId:null,environment:'nonproduction',
  allowed_paths:[...canonicalPaths],scope:[...canonicalScopes],
  owner_authorization:'NOT_GIVEN',connection_state:'DISCONNECTED',
  audit_storage_review:'INDEPENDENT_RESTART_PROOF_PENDING',
  real_world_witness_confirmed:false,rollback_verified:false,
  pilot_approved:false,server_connection_authorized:false,
  source_evidence_state:'UNVERIFIED',signed_ql245_packet_emitted:false,
  candidate_claim_complete:blocks.length===0,remaining_gaps:blocks
 });
}
