// Purely fictitious 470 documentary continuity data. Never seed Supabase.
import {fixture as previous,companyId,ownerId,alternativeId,reviewerId,foreignCompanyId} from './pms-renewal-reassessment-469.mjs';
export {companyId,ownerId,alternativeId,reviewerId,foreignCompanyId};
export const confirmationId='a4700000-0000-4470-8470-000000000001';
export function fixture({now=Date.now(),reassessmentDays=15,reviewer=false,confirmed=false,off=false}={}){
 const f=previous({now,renewalDays:reassessmentDays+1,reviewer,reassessed:true,off});
 f.reassessment.created_at=new Date(now-reassessmentDays*86400000-1000).toISOString();
 const days=Math.floor((now-Date.parse(f.reassessment.created_at))/86400000);
 const aging=[{reassessment_id:f.reassessment.id,renewal_id:f.renewal.id,age_days:days,
  band:days>=15?'overdue':days>=8?'aging':'current'}];
 const confirmation={id:confirmationId,company_id:companyId,reassessment_id:f.reassessment.id,
  reviewer_user_id:alternativeId,finding:'continuity_hold_confirmed',
  source_reference:'REVIEWER-470-NEW-CONTINUITY-REF',created_at:new Date(now-100).toISOString()};
 const confirmations=confirmed?[confirmation]:[];
 return {...f,confirmation,view:{...f.view,continuity_as_of:f.view.captured_at,reassessment_aging:aging,
  confirmations,confirmation_total:confirmations.length,confirmation_sample_capped:false}};
}
