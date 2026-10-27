// Synthetic source-linked 469 examples. Never insert into a live tenant.
import {fixture as previous,companyId,ownerId,alternativeId,reviewerId,foreignCompanyId} from './pms-followup-renewal-468.mjs';
export {companyId,ownerId,alternativeId,reviewerId,foreignCompanyId};
export const reassessmentId='a4690000-0000-4469-8469-000000000001';
export function fixture({now=Date.now(),renewalDays=15,reviewer=false,reassessed=false,off=false}={}){
 const f=previous({now,days:renewalDays+1,reviewer,renewed:true,off});
 f.renewal.created_at=new Date(now-renewalDays*86400000-1000).toISOString();
 const days=Math.floor((now-Date.parse(f.renewal.created_at))/86400000);
 const aging=[{renewal_id:f.renewal.id,followup_id:f.followup.id,age_days:days,
  band:days>=15?'overdue':days>=8?'aging':'current'}];
 const reassessment={id:reassessmentId,company_id:companyId,renewal_id:f.renewal.id,owner_user_id:ownerId,
  decision:'retain_owner_hold',source_reference:'OWNER-469-NEW-EVIDENCE',created_at:new Date(now-100).toISOString()};
 const reassessments=reassessed?[reassessment]:[];
 return {...f,reassessment,view:{...f.view,renewal_as_of:f.view.captured_at,renewal_aging:aging,
  reassessments,reassessment_total:reassessments.length,reassessment_sample_capped:false}};
}
