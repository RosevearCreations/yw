// Fictional 476 reviewer chain only. No live company records are generated.
import {fixture as prior,companyId,ownerId,alternativeId,reviewerId,foreignCompanyId}
 from './pms-owner-renewal-reviewer-followup-476.mjs';
export {companyId,ownerId,alternativeId,reviewerId,foreignCompanyId};
export const responseId='a4770000-0000-4477-8477-000000000001';
export function fixture({now=Date.now(),days=15,ownerResponse=false,off=false}={}){
 const f=prior({now,renewalDays:days+1,reviewer:false,followedUp:true,off});
 f.followup.disposition='request_owner_source_refresh';
 const reviewerReceipt={...f.followup,disposition:'request_owner_source_refresh',created_at:new Date(now-days*86400000-1000).toISOString()};
 f.view.reviewer_followup_receipts=[reviewerReceipt];
 const age=Math.max(0,Math.floor((now-Date.parse(reviewerReceipt.created_at))/86400000));
 const response={id:responseId,company_id:companyId,reviewer_receipt_id:reviewerReceipt.id,
  owner_user_id:ownerId,decision:'provide_fresh_owner_source',
  source_reference:'OWNER-477-FRESH-EVIDENCE-REFERENCE',created_at:new Date(now-50).toISOString()};
 return {...f,reviewerReceipt,response,view:{...f.view,owner_reviewer_as_of:f.view.captured_at,
  reviewer_receipt_aging:[{reviewer_receipt_id:reviewerReceipt.id,owner_request_id:reviewerReceipt.owner_request_id,
   age_days:age,band:age>=15?'overdue':age>=8?'aging':'current'}],reviewer_receipt_age_total:1,
  owner_reviewer_responses:ownerResponse?[response]:[],owner_reviewer_response_total:ownerResponse?1:0,
  owner_reviewer_response_sample_capped:false}};
}