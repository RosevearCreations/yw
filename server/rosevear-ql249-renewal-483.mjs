// Build 483: deterministic public-proof blocker and renewal disposition, never a live trust decision.
import {categories,assessEvidenceFollowup} from './rosevear-ql249-evidence-aging-482.mjs';
const sha40=x=>typeof x==='string'&&/^[0-9a-f]{40}$/.test(x);
const hex64=x=>typeof x==='string'&&/^[0-9a-f]{64}$/.test(x);
const fail=(ok,code)=>{if(!ok)throw new Error('QL249_483_HOLD_'+code);};
const fields=(x,keys)=>x&&typeof x==='object'&&!Array.isArray(x)
 &&Object.keys(x).sort().join('|')===[...keys].sort().join('|');
const receipt=x=>typeof x==='string'&&/^np-[a-z0-9][a-z0-9-]{2,100}$/.test(x);
const proofPath='docs/integration/ql246-source-proof.json';
export const publicProofPath=proofPath;

// An HTTP observation is evidence of availability only, never signer custody or authority.
export function reviewPublicProofPublication(p){
 fail(fields(p,['repository','sourceShaA','proofShaB','sourceCiRunUrl','sourceCiHeadSha',
  'sourceCiConclusion','immutableHttpStatus','rawProofSha256','publicSpkiSha256',
  'ancestryIndependentlyVerified','custodyReceiptId','witnessReceiptId','ownerTestDecision',
  'ownerTestReceiptId','actualGatewayTest']),'PROOF_FIELDS');
 fail(p.repository==='RosevearCreations/yw','REPOSITORY');
 fail(p.sourceShaA===null||sha40(p.sourceShaA),'SOURCE_SHA');
 fail(p.proofShaB===null||sha40(p.proofShaB),'PROOF_SHA');
 fail(p.sourceShaA===null||p.proofShaB===null||p.sourceShaA!==p.proofShaB,'DISTINCT_SHA');
 fail(p.sourceCiRunUrl===null||/^https:\/\/github\.com\/RosevearCreations\/yw\/actions\/runs\/[1-9]\d*$/.test(p.sourceCiRunUrl),'CI_URL');
 fail(p.sourceCiHeadSha===null||sha40(p.sourceCiHeadSha),'CI_HEAD');
 fail(['NOT_AVAILABLE','success','failure','pending'].includes(p.sourceCiConclusion),'CI_CONCLUSION');
 fail([200,404,null].includes(p.immutableHttpStatus),'HTTP_STATUS');
 fail(p.rawProofSha256===null||hex64(p.rawProofSha256),'RAW_DIGEST');
 fail(p.publicSpkiSha256===null||hex64(p.publicSpkiSha256),'SPKI_DIGEST');
 fail(typeof p.ancestryIndependentlyVerified==='boolean','ANCESTRY');
 fail(p.custodyReceiptId===null||receipt(p.custodyReceiptId),'CUSTODY_RECEIPT');
 fail(p.witnessReceiptId===null||receipt(p.witnessReceiptId),'WITNESS_RECEIPT');
 fail(['NOT_GIVEN','REQUESTED_PRIVATE_REVIEW','INDEPENDENTLY_VERIFIED_BY_OWNER'].includes(p.ownerTestDecision),'OWNER_DECISION');
 fail(p.ownerTestReceiptId===null||receipt(p.ownerTestReceiptId),'OWNER_RECEIPT');
 fail(p.actualGatewayTest==='NOT_RUN','GATEWAY_TEST');
 const available=p.immutableHttpStatus===200&&p.proofShaB!==null&&p.rawProofSha256!==null;
 const originCandidate=available&&p.sourceShaA!==null&&p.sourceCiHeadSha===p.sourceShaA
  &&p.sourceCiConclusion==='success'&&p.sourceCiRunUrl!==null&&p.ancestryIndependentlyVerified;
 const blockers=[];
 if(!available)blockers.push('PUBLIC_PROOF_404_OR_NOT_AVAILABLE');
 if(!originCandidate)blockers.push('TWO_SHA_SOURCE_CI_OR_ANCESTRY_UNVERIFIED');
 if(!p.publicSpkiSha256||!p.custodyReceiptId||!p.witnessReceiptId)blockers.push('INDEPENDENT_SIGNER_CUSTODY_WITNESS_UNVERIFIED');
 if(p.ownerTestDecision!=='INDEPENDENTLY_VERIFIED_BY_OWNER'||!p.ownerTestReceiptId)blockers.push('PRIVATE_OWNER_TEST_AUTHORIZATION_NOT_VERIFIED');
 // Receipt-shaped strings and booleans are operator claims; always require external verification.
 blockers.push('ORIGINAL_PRIVATE_ATTESTATIONS_AND_GATEWAY_DENIAL_RECEIPTS_NOT_VERIFIED');
 return {immutable_public_proof_url:p.proofShaB===null?null:
  `https://raw.githubusercontent.com/RosevearCreations/yw/${p.proofShaB}/${proofPath}`,
  public_proof_available_candidate:available,source_origin_metadata_candidate:originCandidate,
  blockers,private_authentication_required:true,actual_gateway_test:'NOT_RUN',
  connection_state:'DISCONNECTED',owner_pilot_authorized:false,dispatch_enabled:false,decision:'HOLD'};
}

export function reviewRenewalDisposition(rows,{now,maxAgeMs=86400000,escalationAfterMs=172800000}={}){
 fail(Number.isSafeInteger(escalationAfterMs)&&escalationAfterMs>=maxAgeMs&&escalationAfterMs<=30*86400000,'ESCALATION_WINDOW');
 const prior=assessEvidenceFollowup(rows,{now,maxAgeMs});
 const byCategory=new Map(rows.map(x=>[x.category,x]));
 const queue=prior.cases.map(x=>{
  const row=byCategory.get(x.category);
  const waitingMs=row.ownerFollowupAt===null?null:now-row.ownerFollowupAt;
  const overdueEscalation=x.overdue&&(waitingMs===null||waitingMs>escalationAfterMs);
  return {category:x.category,status:x.evidence_status,age_ms:x.age_ms,
   followup_wait_ms:waitingMs,escalation:overdueEscalation?'INDEPENDENT_OWNER_REVIEW_OVERDUE':'RECHECK_OR_REQUEST',
   next_action:overdueEscalation?'ESCALATE_PRIVATE_ORIGINAL_SOURCE_REQUEST':x.next_safe_action};
 });
 fail(queue.length===categories.length,'QUEUE_COUNT');
 return {queue,escalated_count:queue.filter(x=>x.escalation==='INDEPENDENT_OWNER_REVIEW_OVERDUE').length,
  source_proof_publication:'NOT_VERIFIED',test_approval:'NOT_GIVEN',actual_gateway_test:'NOT_RUN',
  connection_state:'DISCONNECTED',decision:'HOLD'};
}
