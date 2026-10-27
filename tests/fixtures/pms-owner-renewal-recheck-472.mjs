// Fictitious only: do not insert into any live YW company.
import {fixture as previous,companyId,ownerId,alternativeId,reviewerId,foreignCompanyId} from './pms-continuity-exception-471.mjs';
export {companyId,ownerId,alternativeId,reviewerId,foreignCompanyId};
export const reviewId='a4720000-0000-4472-8472-000000000001';
export function fixture({now=Date.now(),ownerDays=15,reviewer=false,reviewed=false,off=false,noRequest=false}={}){
 const f=previous({now,exceptionDays:ownerDays+1,reviewer,renewed:true,off});
 f.ownerRenewal.decision=noRequest?'retain_exception_hold':'request_independent_recheck';
 f.ownerRenewal.created_at=new Date(now-ownerDays*86400000-1000).toISOString();
 const days=Math.max(0,Math.floor((now-Date.parse(f.ownerRenewal.created_at))/86400000));
 const age=noRequest?[]:[{owner_renewal_id:f.ownerRenewal.id,confirmation_id:f.confirmation.id,
  age_days:days,band:days>=15?'overdue':days>=8?'aging':'current'}];
 const review={id:reviewId,company_id:companyId,owner_renewal_id:f.ownerRenewal.id,
  reviewer_user_id:alternativeId,disposition:'retain_independent_hold',
  source_reference:'REVIEWER-472-DISTINCT-RECHECK-INTAKE',created_at:new Date(now-50).toISOString()};
 const reviews=reviewed&&!noRequest?[review]:[];
 return {...f,review,view:{...f.view,recheck_as_of:f.view.captured_at,
  recheck_aging:age,recheck_request_total:age.length,
  assignment_reviews:reviews,assignment_review_total:reviews.length,assignment_review_sample_capped:false}};
}
