// Exact QL-258 Comms Hub sanitized Yard Workers handoff contract.
// Owner progress is NEVER proof of real key custody, tenant isolation or TEST authorization.
export const QL258_RELEASE='ql258-six-app-owner-custody-checklist-public-source-recheck-held-v1';
export const YW_PUBLIC_SNAPSHOT_SHA='5c8f4a104fd8f0375a89f58c6ee65ea08b82b5fd';
export const YW_REPOSITORY='RosevearCreations/yw';
export const REQUIRED_PATH='docs/integration/ql246-source-proof.json';
export const STEP_KEYS=Object.freeze(['privateCustodian','independentWitness',
 'independentReviewer','privateHost','signerPresence','outOfBandPin','tenantIsolation']);
const STEPS=Object.freeze({
 privateCustodian:'PRIVATELY_ASSIGN_OR_AUTHENTICATE_SIGNER_CUSTODIAN',
 independentWitness:'APPOINT_DISTINCT_INDEPENDENT_WITNESS',
 independentReviewer:'APPOINT_INDEPENDENT_REVIEWER',
 privateHost:'APPROVE_RESTRICTED_PERSISTENT_PRIVATE_SIGNER_HOST',
 signerPresence:'AUTHORIZED_OPERATOR_MUST_CHECK_REAL_SIGNER_PRESENCE',
 outOfBandPin:'VERIFY_REAL_SIGNER_PUBLIC_PIN_OUT_OF_BAND',
 tenantIsolation:'INDEPENDENTLY_VERIFY_SEPARATE_NONPRODUCTION_TENANT'
});
const VALID=new Set(['NOT_REPORTED','OWNER_REPORTS_IN_PROGRESS','OWNER_REPORTS_DONE_NOT_VERIFIED']);
const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
function exactKeys(x,keys){return x && typeof x==='object' && !Array.isArray(x) &&
 Object.keys(x).length===keys.length && Object.keys(x).every(k=>keys.includes(k));}
function requireCondition(condition,code){if(!condition)throw Error('QL258_490_REJECT_'+code);}

export function acceptSanitizedYwOwnerHandoff(input) {
 const keys=['release','system','repository','publicGitHubSnapshot',
  'ownerReportedUnverifiedProgress','independentCustodyAuthenticated',
  'sourceProofAccepted','ownerTestAuthorization','authenticatedGatewayGets',
  'connection','livePilotHolds','disposition'];
 requireCondition(exactKeys(input,keys),'UNEXPECTED_FIELDS');
 requireCondition(input.release===QL258_RELEASE && input.system==='yw' &&
  input.repository==='yw','APP_SOURCE');
 const snap=input.publicGitHubSnapshot;
 requireCondition(exactKeys(snap,['observed','mainSha','requiredPath','httpStatusAtObservedSha']) &&
  snap.observed==='29 October 2026' && snap.mainSha===YW_PUBLIC_SNAPSHOT_SHA &&
  snap.requiredPath===REQUIRED_PATH && snap.httpStatusAtObservedSha===404,'DATED_SNAPSHOT');
 const progress=input.ownerReportedUnverifiedProgress;
 requireCondition(exactKeys(progress,STEP_KEYS) &&
  STEP_KEYS.every(k=>own(progress,k)&&VALID.has(progress[k])),'UNSAFE_PROGRESS');
 requireCondition(input.independentCustodyAuthenticated===false &&
  input.sourceProofAccepted===false && input.ownerTestAuthorization==='NOT_GIVEN' &&
  input.authenticatedGatewayGets===0 && input.connection==='DISCONNECTED' &&
  input.livePilotHolds===12 &&
  input.disposition==='OWNER_SELF_REPORT_ONLY_NOT_SECURITY_EVIDENCE_HELD','FAKE_AUTHORITY');
 const next=STEP_KEYS.find(k=>progress[k]!=='OWNER_REPORTS_DONE_NOT_VERIFIED');
 return Object.freeze({
  system:'yw',repository:YW_REPOSITORY,
  owner_report_accepted:true,owner_progress_authentication:'SELF_REPORT_ONLY',
  reported_steps:STEP_KEYS.filter(k=>progress[k]==='OWNER_REPORTS_DONE_NOT_VERIFIED').length,
  next_owner_action:next?STEPS[next]:'OBTAIN_AND_INDEPENDENTLY_VERIFY_REAL_PRIVATE_RECEIPTS',
  genuine_signer_status:'NOT_VERIFIED',independent_witness_status:'NOT_VERIFIED',
  nonproduction_tenant_verified:false,proof_b_published:false,
  authenticated_gateway_gets:0,owner_test_authorization:'NOT_GIVEN',
  connection:'DISCONNECTED',decision:'HOLD'
 });
}

export function noOwnerHandoffYet() {
 return {system:'yw',owner_report_accepted:false,
  next_owner_action:'REQUEST_SANITIZED_YW_QL258_PACKET_FROM_COMMS_HUB',
  genuine_signer_status:'NOT_VERIFIED',independent_witness_status:'NOT_VERIFIED',
  nonproduction_tenant_verified:false,proof_b_published:false,
  connection:'DISCONNECTED',decision:'HOLD'};
}
