// Build 482: offline, owner-safe evidence aging. Observations are not live authorization.
export const categories=Object.freeze([
 'source_sha_ci','proof_commit_raw_digest','independent_spki_pin','two_sha_consumer_agreement',
 'issued_yw_tenant','named_nonproduction_destination','owner_test_approval',
 'independent_reviewer','scoped_hmac_registry','private_runner','rollback_revocation',
 'health_capabilities_receipts','seven_real_denial_traces','durable_audit_after_restart'
]);
const receipt=x=>typeof x==='string'&&/^np-[a-z0-9][a-z0-9-]{2,100}$/.test(x);
const fail=(ok,reason)=>{if(!ok)throw new Error('QL249_482_HOLD_'+reason);};
const allowed=['PENDING','UNVERIFIED','NOT_PROVISIONED','BLOCKED','REVIEWED'];
export function assessEvidenceFollowup(rows,{now,maxAgeMs=86400000}={}){
 fail(Number.isSafeInteger(now)&&Number.isSafeInteger(maxAgeMs)&&maxAgeMs>0&&maxAgeMs<=7*86400000,'CLOCK');
 fail(Array.isArray(rows)&&rows.length===categories.length,'ROW_COUNT');
 const seen=new Set();
 const cases=rows.map(row=>{
  fail(row&&typeof row==='object'&&!Array.isArray(row)&&
   Object.keys(row).sort().join('|')===['category','state','observedAt','reviewerReceiptId','ownerFollowupAt'].sort().join('|'),'ROW_SCHEMA');
  fail(categories.includes(row.category)&&!seen.has(row.category),'CATEGORY');seen.add(row.category);
  fail(allowed.includes(row.state),'STATE');
  fail(row.observedAt===null||Number.isSafeInteger(row.observedAt)&&row.observedAt<=now&&row.observedAt>=0,'OBSERVED_AT');
  fail(row.ownerFollowupAt===null||Number.isSafeInteger(row.ownerFollowupAt)&&row.ownerFollowupAt<=now&&row.ownerFollowupAt>=0,'FOLLOWUP_AT');
  fail(row.reviewerReceiptId===null||receipt(row.reviewerReceiptId),'REVIEWER_ID');
  const independentlyReviewed=row.state==='REVIEWED'&&row.observedAt!==null&&receipt(row.reviewerReceiptId);
  const ageMs=row.observedAt===null?null:now-row.observedAt;
  const overdue=!independentlyReviewed||ageMs>maxAgeMs;
  const action=independentlyReviewed&&!overdue?'REVALIDATE_ORIGINAL_SOURCE':'REQUEST_ORIGINAL_EVIDENCE';
  return {category:row.category,evidence_status:independentlyReviewed&&!overdue?'REVIEW_CANDIDATE':'HOLD',
   age_ms:ageMs,overdue,owner_followup_recorded:row.ownerFollowupAt!==null,next_safe_action:action};
 });
 return {cases,unresolved:cases.filter(x=>x.evidence_status==='HOLD').length,
  review_candidate_count:cases.filter(x=>x.evidence_status==='REVIEW_CANDIDATE').length,
  original_source_independently_verified:false,read_only_test_authorized:false,
  owner_pilot_authorized:false,connection_state:'DISCONNECTED',
  dispatch_enabled:false,credentials_provisioned:false,decision:'HOLD'};
}
export function pendingFollowup(now){
 return categories.map(category=>({category,state:'UNVERIFIED',observedAt:null,
  reviewerReceiptId:null,ownerFollowupAt:null}));
}
