// Entirely fictional independent review chain. Do not seed live data.
import {fixture as previous,companyId,ownerId,alternativeId,reviewerId,foreignCompanyId}
 from './pms-continuity-finding-owner-renewal-475.mjs';
export {companyId,ownerId,alternativeId,reviewerId,foreignCompanyId};
export const followupId='a4760000-0000-4476-8476-000000000001';
export function fixture({now=Date.now(),renewalDays=15,reviewer=false,followedUp=false,
 off=false,noRequest=false,noFinding=false,noOwnerRenewal=false,holdOnly=false}={}){
 const f=previous({now,findingDays:renewalDays+1,reviewer,renewed:!noOwnerRenewal,
  off,noRequest,noFinding});
 f.ownerRequest.created_at=new Date(now-renewalDays*86400000-1000).toISOString();
 if(holdOnly)f.ownerRequest.decision='retain_followup_hold';
 const requests=f.view.owner_renewal_requests;
 const age=requests.map(p=>{const days=Math.max(0,Math.floor((now-Date.parse(p.created_at))/86400000));
  return {owner_request_id:p.id,continuity_review_id:p.continuity_review_id,
   age_days:days,band:days>=15?'overdue':days>=8?'aging':'current'};});
 const followup={id:followupId,company_id:companyId,owner_request_id:f.ownerRequest.id,
  reviewer_user_id:alternativeId,disposition:'retain_independent_hold',
  source_reference:'REVIEWER-476-FRESH-RENEWAL-RECEIPT',created_at:new Date(now-40).toISOString()};
 const receipts=followedUp&&age.length?[followup]:[];
 return {...f,followup,view:{...f.view,reviewer_renewal_as_of:f.view.captured_at,
  owner_renewal_evidence_aging:age,owner_renewal_evidence_age_total:age.length,
  reviewer_followup_receipts:receipts,reviewer_followup_receipt_total:receipts.length,
  reviewer_followup_receipt_sample_capped:false}};
}
