// Entirely fictional documentary chain; never seed live companies or reviewers.
import {fixture as previous,companyId,ownerId,alternativeId,reviewerId,foreignCompanyId}
 from './pms-recheck-outcome-clarification-473.mjs';
export {companyId,ownerId,alternativeId,reviewerId,foreignCompanyId};
export const continuityId='a4740000-0000-4474-8474-000000000001';
export function fixture({now=Date.now(),clarificationDays=15,reviewer=false,reviewed=false,
 off=false,noRequest=false,noClarification=false}={}){
 const f=previous({now,reviewDays:clarificationDays+1,reviewer,responded:!noClarification,
  off,noRequest});
 f.clarification.created_at=new Date(now-clarificationDays*86400000-1000).toISOString();
 const days=Math.max(0,Math.floor((now-Date.parse(f.clarification.created_at))/86400000));
 const age=noClarification||noRequest?[]:[{owner_clarification_id:f.clarification.id,
  assignment_review_id:f.review.id,age_days:days,band:days>=15?'overdue':days>=8?'aging':'current'}];
 const continuity={id:continuityId,company_id:companyId,owner_clarification_id:f.clarification.id,
  reviewer_user_id:alternativeId,disposition:'retain_independent_hold',
  source_reference:'REVIEWER-474-FRESH-CONTINUITY-REVIEW',created_at:new Date(now-50).toISOString()};
 const reviews=reviewed&&age.length?[continuity]:[];
 return {...f,continuity,view:{...f.view,continuity_review_as_of:f.view.captured_at,
  clarification_aging:age,clarification_age_total:age.length,
  continuity_reviews:reviews,continuity_review_total:reviews.length,continuity_review_sample_capped:false}};
}
