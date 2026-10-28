// Fictional chain for local/CI checks only. Never write synthetic users into production.
import {fixture as previous,companyId,ownerId,alternativeId,reviewerId,foreignCompanyId}
 from './pms-owner-clarification-continuity-474.mjs';
export {companyId,ownerId,alternativeId,reviewerId,foreignCompanyId};
export const requestId='a4750000-0000-4475-8475-000000000001';
export function fixture({now=Date.now(),findingDays=15,reviewer=false,renewed=false,
 off=false,noRequest=false,noFinding=false,noClarification=false}={}){
 const f=previous({now,clarificationDays:findingDays+1,reviewer,
  reviewed:!noFinding,off,noRequest,noClarification});
 f.continuity.disposition='request_refreshed_owner_evidence';
 f.continuity.created_at=new Date(now-findingDays*86400000-1000).toISOString();
 const findings=f.view.continuity_reviews;
 const age=findings.map(t=>{const days=Math.max(0,Math.floor((now-Date.parse(t.created_at))/86400000));
  return {continuity_review_id:t.id,owner_clarification_id:t.owner_clarification_id,
   age_days:days,band:days>=15?'overdue':days>=8?'aging':'current'};});
 const ownerRequest={id:requestId,company_id:companyId,continuity_review_id:f.continuity.id,
  owner_user_id:ownerId,decision:'submit_renewed_documentary_source',
  source_reference:'OWNER-475-FRESH-CONTINUITY-RENEWAL',created_at:new Date(now-50).toISOString()};
 const requests=renewed&&age.length?[ownerRequest]:[];
 return {...f,ownerRequest,view:{...f.view,owner_renewal_as_of:f.view.captured_at,
  continuity_finding_aging:age,continuity_finding_age_total:age.length,
  owner_renewal_requests:requests,owner_renewal_request_total:requests.length,
  owner_renewal_request_sample_capped:false}};
}
