// Fictitious documentary evidence. Do not seed production.
import {fixture as prior,companyId,ownerId,alternativeId,reviewerId,foreignCompanyId} from './pms-reassessment-continuity-470.mjs';
export {companyId,ownerId,alternativeId,reviewerId,foreignCompanyId};
export const renewalId='a4710000-0000-4471-8471-000000000001';
export function fixture({now=Date.now(),exceptionDays=15,reviewer=false,renewed=false,off=false,holdOnly=false}={}){
 const f=prior({now,reassessmentDays:exceptionDays+1,reviewer,confirmed:true,off});
 f.confirmation.created_at=new Date(now-exceptionDays*86400000-1000).toISOString();
 f.confirmation.finding=holdOnly?'continuity_hold_confirmed':'request_source_clarification';
 const days=Math.max(0,Math.floor((now-Date.parse(f.confirmation.created_at))/86400000));
 const aging=holdOnly?[]:[{confirmation_id:f.confirmation.id,reassessment_id:f.reassessment.id,
  age_days:days,band:days>=15?'overdue':days>=8?'aging':'current'}];
 const renewal={id:renewalId,company_id:companyId,confirmation_id:f.confirmation.id,
  owner_user_id:ownerId,decision:'retain_exception_hold',source_reference:'OWNER-471-NEW-DOCUMENT',
  created_at:new Date(now-50).toISOString()};
 const entries=renewed&&!holdOnly?[renewal]:[];
 return {...f,ownerRenewal:renewal,view:{...f.view,exception_as_of:f.view.captured_at,
  exception_aging:aging,exception_total:aging.length,owner_renewals:entries,
  owner_renewal_total:entries.length,owner_renewal_sample_capped:false}};
}
