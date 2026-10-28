// Fictional-only evidence: never seed production company or reviewer records.
import {fixture as previous,companyId,ownerId,alternativeId,reviewerId,foreignCompanyId} from './pms-owner-renewal-recheck-472.mjs';
export {companyId,ownerId,alternativeId,reviewerId,foreignCompanyId};
export const clarificationId='a4730000-0000-4473-8473-000000000001';
export function fixture({now=Date.now(),reviewDays=15,reviewer=false,responded=false,
 off=false,noRequest=false,noClarification=false}={}){
 const f=previous({now,ownerDays:reviewDays+1,reviewer,reviewed:!noRequest,off,noRequest});
 f.review.disposition=noClarification?'retain_independent_hold':'request_owner_source_clarification';
 f.review.created_at=new Date(now-reviewDays*86400000-1000).toISOString();
 const days=Math.max(0,Math.floor((now-Date.parse(f.review.created_at))/86400000));
 const age=noRequest?[]:[{assignment_review_id:f.review.id,owner_renewal_id:f.ownerRenewal.id,
  age_days:days,band:days>=15?'overdue':days>=8?'aging':'current'}];
 const clarification={id:clarificationId,company_id:companyId,assignment_review_id:f.review.id,
  owner_user_id:ownerId,decision:'retain_followup_hold',
  source_reference:'OWNER-473-DISTINCT-RECHECK-CLARIFICATION',created_at:new Date(now-50).toISOString()};
 const clarifications=responded&&!noRequest&&!noClarification?[clarification]:[];
 return {...f,clarification,view:{...f.view,outcome_as_of:f.view.captured_at,outcome_aging:age,
  review_outcome_total:age.length,owner_clarifications:clarifications,
  clarification_total:clarifications.length,clarification_sample_capped:false}};
}
