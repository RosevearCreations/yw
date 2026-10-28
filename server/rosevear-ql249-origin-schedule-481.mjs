// Build 481: offline, fail-closed provenance and owner-scoped GET scheduling review.
// Operator-provided observations require independent confirmation; this module performs no I/O.
import {createHash} from 'node:crypto';
import {paths} from './rosevear-ql246-source-proof-478.mjs';

const sha40=x=>typeof x==='string'&&/^[0-9a-f]{40}$/.test(x);
const sha64=x=>typeof x==='string'&&/^[0-9a-f]{64}$/.test(x);
const fail=(ok,code)=>{if(!ok)throw new Error('QL249_HOLD_'+code);};
const exact=(o,fields)=>o&&typeof o==='object'&&!Array.isArray(o)
 &&Object.keys(o).sort().join('|')===[...fields].sort().join('|');
const originFields=['repository','sourceRevisionSha','proofCommitSha','sourceCiUrl',
 'proofRawSha256','githubRawSha256','proofFilePath','sourceCiConclusion',
 'proofCommitContainsFile','independentReviewerReceiptId'];
const scheduleFields=['businessId','tenantId','environment','methods','paths','destinationApproved',
 'ownerApprovalReceiptId','independentReviewerReceiptId','expiresAt','now','rollbackWitnessed',
 'hmacRegistryKeyId','privateRunnerApproved'];
const receipt=x=>typeof x==='string'&&/^np-[a-z0-9][a-z0-9-]{2,100}$/.test(x);

export function reviewOrigin(proof,origin) {
 fail(exact(proof,['sourceRevisionSha','proofCommitSha','rawProofBase64'])&&exact(origin,originFields),'ORIGIN_FIELDS');
 fail(origin.repository==='RosevearCreations/yw'&&origin.proofFilePath==='docs/integration/ql246-source-proof.json','REPOSITORY');
 fail(sha40(origin.sourceRevisionSha)&&sha40(origin.proofCommitSha)
  &&origin.sourceRevisionSha!==origin.proofCommitSha,'TWO_SHA');
 fail(proof.sourceRevisionSha===origin.sourceRevisionSha&&proof.proofCommitSha===origin.proofCommitSha,'IDENTITIES');
 fail(/^https:\/\/github\.com\/RosevearCreations\/yw\/actions\/runs\/[1-9]\d*$/.test(origin.sourceCiUrl)
  &&origin.sourceCiConclusion==='success','SOURCE_CI');
 fail(sha64(origin.proofRawSha256)&&sha64(origin.githubRawSha256),'DIGEST');
 fail(typeof proof.rawProofBase64==='string'&&/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(proof.rawProofBase64)
  &&proof.rawProofBase64.length>0&&proof.rawProofBase64.length<1000000,'RAW');
 const bytes=Buffer.from(proof.rawProofBase64,'base64');
 fail(bytes.toString('base64')===proof.rawProofBase64,'CANONICAL_RAW');
 const digest=createHash('sha256').update(bytes).digest('hex');
 fail(digest===origin.proofRawSha256&&digest===origin.githubRawSha256,'RAW_MISMATCH');
 fail(origin.proofCommitContainsFile===true&&receipt(origin.independentReviewerReceiptId),'ORIGIN_WITNESS');
 // A self-declared observation is not independently authenticated by this offline function.
 return {metadata_consistent:true,github_origin_independently_authenticated:false,
  external_review_required:true,connection_state:'DISCONNECTED',result:'ORIGIN_METADATA_MATCHED_HOLD'};
}

export function reviewNonproductionGetSchedule(s) {
 fail(exact(s,scheduleFields),'SCHEDULE_FIELDS');
 fail(s.businessId==='yw'&&receipt(s.tenantId)&&s.environment==='nonproduction','TENANT');
 fail(JSON.stringify(s.methods)==='["GET"]'&&JSON.stringify(s.paths)===JSON.stringify(paths),'GET_ONLY');
 fail(Number.isSafeInteger(s.now)&&Number.isSafeInteger(s.expiresAt)
  &&s.expiresAt>s.now&&s.expiresAt-s.now<=3600000,'EXPIRY');
 const blockers=[];
 for(const [key,valid] of [
  ['destination',s.destinationApproved===true],
  ['owner_approval',receipt(s.ownerApprovalReceiptId)],
  ['reviewer',receipt(s.independentReviewerReceiptId)],
  ['rollback',s.rollbackWitnessed===true],
  ['server_key_registry',receipt(s.hmacRegistryKeyId)],
  ['private_runner',s.privateRunnerApproved===true]
 ])if(!valid)blockers.push(key);
 return {schedule_review: blockers.length?'HOLD':'MANUAL_AUTHORITY_REVIEW_REQUIRED',
  blockers,request_executed:false,credentials_provisioned:false,
  owner_pilot_authorized:false,connection_state:'DISCONNECTED',dispatch_enabled:false,
  result:'NONPRODUCTION_GET_SCHEDULING_HELD'};
}
